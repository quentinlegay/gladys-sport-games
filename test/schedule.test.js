import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { resetLnbSession } from '../src/providers/lnb.js';
import { resetFfbbSession } from '../src/providers/ffbb.js';
import {
  CACHE_MAX_AGE_MS,
  followsFor,
  formatMatch,
  formatResult,
  formatStart,
  getFollowedMatches,
  getMatches,
  inWatchWindow,
  isLive,
  lastResult,
  nextMatch,
  opponentOf,
  resetScheduleCache,
  RETRY_DELAY_MS,
  sourcesFor,
  startingBetween,
  upcomingMatches,
} from '../src/schedule.js';
import { restoreFetch } from './helpers/mockFetch.js';
import { mockSources, NOW } from './helpers/sources.js';

const config = normalizeConfig();
const MIN = 60_000;

afterEach(() => {
  restoreFetch();
  resetScheduleCache();
  resetLnbSession();
  resetFfbbSession();
});

test('sources: one per season for EuroLeague and NM1, one per team for NBA and LNB', () => {
  const keys = sourcesFor(
    {
      asvel: ['euroleague', 'betclic_elite'],
      paris_basketball: ['euroleague', 'betclic_elite'],
      boston_celtics: ['nba'],
      vitre: ['nationale_1'],
      rennes: ['nationale_1'],
    },
    2026,
  ).map((s) => s.key);
  assert.deepEqual(keys, [
    'nba:2026:2',
    'euroleague:2026',
    'betclic_elite:2026:91',
    'betclic_elite:2026:58',
    'nationale_1:2026',
  ]);
  // Only the competitions a team is followed in are downloaded.
  assert.deepEqual(
    sourcesFor({ asvel: ['betclic_elite'], boston_celtics: [] }, 2026).map((s) => s.key),
    ['betclic_elite:2026:91'],
  );
});

test('followsFor: the followed competitions, or all of them for an unfollowed team', () => {
  const follows = followsFor(['asvel', 'boston_celtics', 'nope'], {
    follows: { asvel: ['betclic_elite'] },
  });
  assert.deepEqual(follows, { asvel: ['betclic_elite'], boston_celtics: ['nba'] });
});

test('a game is kept when one of its teams is followed in its competition', async () => {
  mockSources();
  // ASVEL in Betclic Élite only, Paris in EuroLeague only.
  const { matches } = await getMatches({
    follows: { asvel: ['betclic_elite'], paris_basketball: ['euroleague'] },
    now: NOW,
  });
  const el = matches.filter((m) => m.competition === 'euroleague');
  // Paris - ASVEL and Paris - Virtus, not ASVEL - Etoile Rouge or Real - ASVEL.
  assert.deepEqual(
    el.map((m) => m.id),
    ['euroleague:E2026_31', 'euroleague:E2026_50'],
  );
  assert.equal(matches.filter((m) => m.competition === 'betclic_elite').length, 5);
});

test('getMatches aggregates the sources, keeps only the wanted teams, sorted', async () => {
  mockSources();
  const { matches, errors } = await getFollowedMatches(config, { now: NOW });
  assert.deepEqual(errors, []);
  // 4 EuroLeague games of Paris / ASVEL + 5 LNB games of ASVEL (listed twice).
  assert.equal(matches.length, 9);
  assert.ok(
    matches.every(
      (m) =>
        ['asvel', 'paris_basketball'].includes(m.homeTeam.id) ||
        ['asvel', 'paris_basketball'].includes(m.awayTeam.id),
    ),
  );
  const starts = matches.map((m) => Date.parse(m.start));
  assert.deepEqual(
    starts,
    [...starts].sort((a, b) => a - b),
  );
});

test('the calendars are cached: polling every minute downloads nothing', async () => {
  const calls = mockSources();
  await getFollowedMatches(config, { now: NOW });
  const first = calls.length;
  await getFollowedMatches(config, { now: NOW + MIN });
  await getFollowedMatches(config, { now: NOW + 60 * MIN });
  assert.equal(calls.length, first);
  // After 6 h, downloaded again.
  await getFollowedMatches(config, { now: NOW + CACHE_MAX_AGE_MS + MIN });
  assert.ok(calls.length > first);
});

test('a failing provider never breaks the others', async () => {
  mockSources({ 'api-live.euroleague.net': new Error('down') });
  const { matches, errors } = await getFollowedMatches(config, { now: NOW });
  assert.deepEqual(
    errors.map((e) => e.competition),
    ['euroleague'],
  );
  assert.equal(matches.length, 5);
  assert.ok(matches.every((m) => m.competition === 'betclic_elite'));
});

test('after a failure, the old calendar is kept and the source retried 15 min later', async () => {
  let fail = false;
  const calls = mockSources({
    'api-live.euroleague.net': () => (fail ? new Error('down') : 'euroleague-games.json'),
  });
  const elCalls = () => calls.filter((c) => c.url.includes('euroleague.net')).length;
  await getFollowedMatches(config, { now: NOW });
  assert.equal(elCalls(), 1);

  fail = true;
  const later = NOW + CACHE_MAX_AGE_MS + MIN;
  const { matches, errors } = await getFollowedMatches(config, { now: later });
  assert.equal(elCalls(), 2);
  assert.deepEqual(errors, []);
  assert.equal(matches.filter((m) => m.competition === 'euroleague').length, 4);

  // No new try during the retry delay...
  await getFollowedMatches(config, { now: later + 5 * MIN });
  assert.equal(elCalls(), 2);
  // ...then a new one.
  fail = false;
  await getFollowedMatches(config, { now: later + RETRY_DELAY_MS + MIN });
  assert.equal(elCalls(), 3);
});

test('a source that never answered is not hammered every minute', async () => {
  const calls = mockSources({ 'api-live.euroleague.net': new Error('down') });
  await getFollowedMatches(config, { now: NOW });
  await getFollowedMatches(config, { now: NOW + MIN });
  const { errors } = await getFollowedMatches(config, { now: NOW + 2 * MIN });
  assert.equal(calls.filter((c) => c.url.includes('euroleague.net')).length, 1);
  assert.deepEqual(
    errors.map((e) => e.competition),
    ['euroleague'],
  );
});

test('while a game waits for its score, its calendar is refreshed every 15 min', async () => {
  const calls = mockSources();
  const lnbCalls = () => calls.filter((c) => c.url.includes('getCalendar')).length;
  // Gravelines - ASVEL starts 2026-10-04 14:30 UTC.
  const before = Date.parse('2026-10-04T14:00:00Z');
  await getFollowedMatches(config, { now: before });
  const first = lnbCalls();
  await getFollowedMatches(config, { now: before + 10 * MIN });
  assert.equal(lnbCalls(), first);
  await getFollowedMatches(config, { now: before + 46 * MIN });
  assert.ok(lnbCalls() > first);
});

test('force downloads again', async () => {
  const calls = mockSources();
  await getMatches({ follows: { asvel: ['euroleague'] }, now: NOW });
  await getMatches({ follows: { asvel: ['euroleague'] }, now: NOW, force: true });
  assert.equal(calls.length, 2);
});

test('next game and last result of a team', async () => {
  mockSources();
  const { matches } = await getFollowedMatches(config, { now: NOW });
  const next = nextMatch(matches, 'asvel', NOW);
  assert.equal(formatMatch(next), 'Gravelines – ASVEL (Betclic Élite)');
  assert.equal(formatStart(next), 'dim. 4 oct. 16:30');
  assert.equal(opponentOf(next, 'asvel').shortName, 'Gravelines');
  assert.equal(formatResult(lastResult(matches, 'asvel')), 'Cholet 85 – 97 ASVEL');

  const paris = nextMatch(matches, 'paris_basketball', NOW);
  assert.equal(formatMatch(paris), 'Paris – ASVEL (EuroLeague)');
  assert.equal(lastResult(matches, 'paris_basketball'), null);
  assert.equal(formatResult(null), '');
});

test('a game is live from its start until reported finished (3 h at most)', async () => {
  mockSources();
  const { matches } = await getFollowedMatches(config, { now: NOW });
  const game = nextMatch(matches, 'asvel', NOW);
  const start = Date.parse(game.start);
  assert.equal(isLive(game, start - MIN), false);
  assert.equal(isLive(game, start + 90 * MIN), true);
  // Still the next game while it is being played.
  assert.equal(nextMatch(matches, 'asvel', start + 90 * MIN), game);
  assert.equal(isLive(game, start + 181 * MIN), false);
  assert.equal(upcomingMatches([game], start + 181 * MIN).length, 0);
});

test('inWatchWindow keeps the games starting in the window, or all of them', async () => {
  mockSources();
  const { matches } = await getFollowedMatches(config, { now: NOW });
  const inWindow = inWatchWindow(matches, config);
  // 16:30 Paris games are out of 18:00 - 23:30.
  assert.ok(!inWindow.some((m) => m.start === '2026-10-04T14:30:00.000Z'));
  assert.ok(inWindow.some((m) => m.start === '2026-10-07T18:45:00.000Z'));
  assert.equal(inWatchWindow(matches, { ...config, include_night_games: true }).length, 9);
});

test('startingBetween applies the delay and excludes `from`', async () => {
  mockSources();
  const { matches } = await getFollowedMatches(config, { now: NOW });
  const at = (iso) => new Date(iso);
  // Paris - ASVEL at 18:45 UTC, 15 min before = 18:30.
  const due = startingBetween(matches, at('2026-10-07T18:29:00Z'), at('2026-10-07T18:30:00Z'), 15);
  assert.deepEqual(
    due.map((m) => m.id),
    ['euroleague:E2026_31'],
  );
  assert.equal(
    startingBetween(matches, at('2026-10-07T18:30:00Z'), at('2026-10-07T18:31:00Z'), 15).length,
    0,
  );
});

test('getMatches: Nationale 1 games of a followed club', async () => {
  mockSources();
  const { matches, errors } = await getMatches({ follows: { vitre: ['nationale_1'] }, now: NOW });
  assert.deepEqual(errors, []);
  assert.equal(matches.length, 6);
  assert.equal(nextMatch(matches, 'vitre', NOW).id, 'nationale_1:200000014596818');
  assert.equal(formatResult(lastResult(matches, 'vitre')), 'Lorient 70 – 63 Vitré');
  assert.equal(formatMatch(nextMatch(matches, 'vitre', NOW)), 'Tours – Vitré (Nationale 1)');
});

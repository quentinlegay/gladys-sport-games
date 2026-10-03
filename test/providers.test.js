import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { euroleague, parseEuroleague, scheduleUrl } from '../src/providers/euroleague.js';
import { nba, parseNba } from '../src/providers/nba.js';
import { lnb, parseLnb, resetLnbSession } from '../src/providers/lnb.js';
import { fixture, mockFetch, restoreFetch } from './helpers/mockFetch.js';

afterEach(() => {
  restoreFetch();
  resetLnbSession();
});

const MATCH_KEYS = [
  'id',
  'sport',
  'competition',
  'homeTeam',
  'awayTeam',
  'start',
  'status',
  'score',
  'broadcaster',
].sort();

function assertMatchShape(match) {
  assert.deepEqual(Object.keys(match).sort(), MATCH_KEYS);
  assert.equal(match.sport, 'basketball');
  assert.match(match.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
  assert.ok(['scheduled', 'live', 'finished', 'postponed'].includes(match.status));
  for (const team of [match.homeTeam, match.awayTeam]) {
    assert.deepEqual(Object.keys(team).sort(), ['id', 'name', 'shortName']);
  }
}

// --- EuroLeague --------------------------------------------------------------

test('euroleague: games are normalized, with known teams mapped', () => {
  const matches = parseEuroleague(fixture('euroleague-games.json'));
  assert.equal(matches.length, 7);
  matches.forEach(assertMatchShape);
  const derby = matches.find((m) => m.id === 'euroleague:E2026_31');
  assert.ok(derby, 'Paris - ASVEL of round 3');
  assert.equal(derby.homeTeam.id, 'paris_basketball');
  assert.equal(derby.awayTeam.id, 'asvel');
  assert.equal(derby.start, '2026-10-07T18:45:00.000Z');
  assert.equal(derby.status, 'scheduled');
  assert.deepEqual(derby.score, { home: null, away: null });
});

test('euroleague: a played game is finished, with its score', () => {
  const played = parseEuroleague(fixture('euroleague-games.json')).find(
    (m) => m.homeTeam.id === 'hapoel_tel_aviv',
  );
  assert.equal(played.status, 'finished');
  assert.deepEqual(played.score, { home: 84, away: 86 });
  assert.equal(played.awayTeam.shortName, 'Bayern');
});

test('euroleague: virtual play-off slots and unknown clubs', () => {
  const json = fixture('euroleague-games.json');
  json.data[0].local.club.isVirtual = true;
  json.data[1].local.club.code = 'NEW';
  json.data[1].local.club.name = 'New Club';
  const matches = parseEuroleague(json);
  assert.equal(matches.length, 6);
  assert.deepEqual(matches[0].homeTeam, {
    id: 'euroleague:NEW',
    name: 'New Club',
    shortName: json.data[1].local.club.abbreviatedName,
  });
  assert.deepEqual(parseEuroleague({}), []);
});

test('euroleague: fetchSchedule reads the season URL', async () => {
  const calls = mockFetch({ 'api-live.euroleague.net': 'euroleague-games.json' });
  const matches = await euroleague.fetchSchedule({ season: 2026 });
  assert.equal(matches.length, 7);
  assert.equal(calls[0].url, scheduleUrl(2026));
  assert.match(calls[0].url, /seasons\/E2026\/games$/);
});

// --- NBA (ESPN) --------------------------------------------------------------

test('nba: a team schedule is normalized, home and away from ESPN', () => {
  const matches = parseNba(fixture('nba-schedule.json'));
  assert.equal(matches.length, 3);
  matches.forEach(assertMatchShape);
  assert.equal(matches[0].homeTeam.id, 'detroit_pistons');
  assert.equal(matches[0].awayTeam.id, 'boston_celtics');
  assert.equal(matches[0].start, '2026-10-20T19:00:00.000Z');
  assert.equal(matches[0].status, 'scheduled');
  // US channels are of no use in France.
  assert.equal(matches[0].broadcaster, null);
});

test('nba: finished games carry their score', () => {
  const [, last] = parseNba(fixture('nba-schedule-final.json'));
  assert.equal(last.status, 'finished');
  assert.equal(last.homeTeam.shortName, 'Celtics');
  assert.deepEqual(last.score, { home: 113, away: 108 });
});

test('nba: live and postponed statuses', () => {
  const json = fixture('nba-schedule.json');
  json.events[0].competitions[0].status.type = { name: 'STATUS_IN_PROGRESS', state: 'in' };
  json.events[0].competitions[0].competitors[0].score = '54';
  json.events[1].competitions[0].status.type = { name: 'STATUS_POSTPONED', state: 'post' };
  const [live, postponed] = parseNba(json);
  assert.equal(live.status, 'live');
  assert.equal(live.score.home, 54);
  assert.equal(postponed.status, 'postponed');
});

test('nba: fetchSchedule merges the season types and survives a missing one', async () => {
  const calls = mockFetch({
    'seasontype=1': { events: [] },
    'seasontype=2': 'nba-schedule.json',
    'seasontype=3': new Error('no playoffs yet'),
  });
  const matches = await nba.fetchSchedule({ season: 2026, team: '2' });
  assert.equal(matches.length, 3);
  assert.equal(calls.length, 3);
  // ESPN names the season after its ending year.
  assert.ok(calls.every((c) => c.url.includes('/teams/2/schedule?season=2027&')));
});

test('nba: fetchSchedule fails when every request fails', async () => {
  mockFetch({});
  await assert.rejects(() => nba.fetchSchedule({ season: 2026, team: '2' }), /HTTP 404/);
});

// --- LNB ---------------------------------------------------------------------

test('lnb: the first team is at home, broadcasters are joined', () => {
  const matches = parseLnb(fixture('lnb-calendar.json'));
  assert.equal(matches.length, 5);
  matches.forEach(assertMatchShape);
  const [first, second, third] = matches;
  assert.equal(first.homeTeam.id, 'cholet');
  assert.equal(first.awayTeam.id, 'asvel');
  assert.equal(first.status, 'finished');
  assert.deepEqual(first.score, { home: 85, away: 97 });
  assert.equal(first.broadcaster, "DAZN / L'Équipe Live");
  assert.equal(second.status, 'scheduled');
  assert.deepEqual(second.score, { home: null, away: null });
  assert.equal(second.start, '2026-10-04T14:30:00.000Z');
  assert.equal(third.broadcaster, "La Chaine L'Équipe / DAZN");
});

test('lnb: fetchSchedule resolves the season team id of a club', async () => {
  const calls = mockFetch({
    'lnb.fr/api/token': { message: 'Success', token: 'abc' },
    'getMainCompetition?year=2026': {
      data: [
        { external_id: 318, competition_abbrev: 'PROB' },
        { external_id: 317, competition_abbrev: 'PROA' },
      ],
    },
    'getCompetitionTeams?competition_external_id=317': {
      data: [{ external_id: 1866, club_external_id: 91, team_name: 'Lyon-Villeurbanne' }],
    },
    'match/v3/getCalendar': 'lnb-calendar.json',
  });
  const matches = await lnb.fetchSchedule({ season: 2026, team: '91' });
  assert.equal(matches.length, 5);

  const calendar = calls.find((c) => c.url.endsWith('match/v3/getCalendar'));
  assert.equal(calendar.init.method, 'POST');
  assert.equal(calendar.init.headers.Authorization, 'Bearer abc');
  const body = JSON.parse(calendar.init.body);
  assert.equal(body.team_external_id, 1866);
  assert.equal(body.year, 2026);
  assert.equal(body.competition_abbrev, 'PROA');

  // The token and the season context are shared by the next club.
  await lnb.fetchSchedule({ season: 2026, team: '91' });
  assert.equal(calls.filter((c) => c.url.includes('api/token')).length, 1);
  assert.equal(calls.filter((c) => c.url.includes('getCompetitionTeams')).length, 1);
});

test('lnb: a club not in Betclic Élite this season has no game', async () => {
  const calls = mockFetch({
    'lnb.fr/api/token': { token: 'abc' },
    getMainCompetition: { data: [{ external_id: 317, competition_abbrev: 'PROA' }] },
    getCompetitionTeams: { data: [] },
  });
  assert.deepEqual(await lnb.fetchSchedule({ season: 2026, team: '39' }), []);
  assert.ok(!calls.some((c) => c.url.includes('getCalendar')));
});

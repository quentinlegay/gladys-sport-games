import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { resetLnbSession } from '../src/providers/lnb.js';
import { resetScheduleCache } from '../src/schedule.js';
import {
  createMatchWatcher,
  getNextMatchAction,
  MAX_CATCH_UP_MS,
  TRIGGER_MATCH_STARTING,
} from '../src/scenes.js';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch } from './helpers/mockFetch.js';
import { mockSources, NOW } from './helpers/sources.js';

const config = normalizeConfig();
const at = (iso) => new Date(iso);

afterEach(() => {
  restoreFetch();
  resetScheduleCache();
  resetLnbSession();
});

function watcherFor(gladys, cfg = config, onKickoff) {
  return createMatchWatcher(gladys, { getConfig: () => cfg, onKickoff });
}

test('the watcher never replays the past on its first check', async () => {
  mockSources();
  const gladys = createFakeGladys();
  const watcher = watcherFor(gladys);
  assert.deepEqual(await watcher.check(at('2026-10-07T18:46:00Z')), []);
  assert.equal(gladys.sceneEvents.length, 0);
});

test('one event per delay and per followed team, then the kick-off refresh', async () => {
  mockSources();
  const gladys = createFakeGladys();
  let kickoffs = 0;
  const watcher = watcherFor(gladys, config, () => (kickoffs += 1));
  // Paris - ASVEL, 18:45 UTC (20:45 Paris).
  await watcher.check(at('2026-10-07T17:44:30Z'));
  await watcher.check(at('2026-10-07T17:45:30Z')); // 60 min before
  await watcher.check(at('2026-10-07T17:46:30Z')); // nothing new
  await watcher.check(at('2026-10-07T18:15:30Z')); // 30 min before
  await watcher.check(at('2026-10-07T18:30:30Z')); // 15 min before
  await watcher.check(at('2026-10-07T18:45:30Z')); // kick-off
  assert.ok(gladys.sceneEvents.every((e) => e.key === TRIGGER_MATCH_STARTING));
  assert.deepEqual(
    gladys.sceneEvents.map((e) => `${e.data.minutes_before}:${e.data.team}`),
    [
      '60:paris_basketball',
      '60:asvel',
      '30:paris_basketball',
      '30:asvel',
      '15:paris_basketball',
      '15:asvel',
      '0:paris_basketball',
      '0:asvel',
    ],
  );
  assert.deepEqual(gladys.sceneEvents[0].data, {
    team: 'paris_basketball',
    competition: 'euroleague',
    minutes_before: '60',
    home_team: 'Paris',
    away_team: 'ASVEL',
    start: '20:45',
    broadcaster: '',
  });
  assert.equal(kickoffs, 1);
});

test('games out of the watching window do not fire, unless included', async () => {
  mockSources();
  // Gravelines - ASVEL, 14:30 UTC = 16:30 Paris.
  const quiet = createFakeGladys();
  let kickoffs = 0;
  const watcher = watcherFor(quiet, config, () => (kickoffs += 1));
  await watcher.check(at('2026-10-04T14:29:30Z'));
  await watcher.check(at('2026-10-04T14:30:30Z'));
  assert.equal(quiet.sceneEvents.length, 0);
  // The widget still changes at the kick-off.
  assert.equal(kickoffs, 1);

  const night = createFakeGladys();
  const all = watcherFor(night, { ...config, include_night_games: true });
  await all.check(at('2026-10-04T14:29:30Z'));
  await all.check(at('2026-10-04T14:30:30Z'));
  assert.deepEqual(night.sceneEvents[0].data, {
    team: 'asvel',
    competition: 'betclic_elite',
    minutes_before: '0',
    home_team: 'Gravelines',
    away_team: 'ASVEL',
    start: '16:30',
    broadcaster: 'DAZN',
  });
});

test('unfollowed teams and disabled competitions do not fire', async () => {
  mockSources();
  const gladys = createFakeGladys();
  const watcher = watcherFor(
    gladys,
    normalizeConfig({ teams: ['asvel'], competitions: ['betclic_elite'] }),
  );
  await watcher.check(at('2026-10-07T18:44:30Z'));
  await watcher.check(at('2026-10-07T18:45:30Z'));
  assert.equal(gladys.sceneEvents.length, 0);
});

test('catch-up is limited to 5 min after a pause', async () => {
  mockSources();
  const gladys = createFakeGladys();
  const watcher = watcherFor(gladys);
  await watcher.check(at('2026-10-07T18:30:00Z'));
  // Long pause: the kick-off at 18:45 is older than MAX_CATCH_UP_MS.
  await watcher.check(new Date(Date.parse('2026-10-07T18:45:00Z') + MAX_CATCH_UP_MS + 60_000));
  assert.equal(gladys.sceneEvents.length, 0);

  // A short pause is caught up.
  const other = createFakeGladys();
  const w2 = watcherFor(other);
  await w2.check(at('2026-10-07T18:40:00Z'));
  await w2.check(at('2026-10-07T18:48:00Z'));
  assert.equal(other.sceneEvents.length, 2);
});

test('a refused event does not stop the following ones', async () => {
  mockSources();
  const gladys = createFakeGladys();
  let calls = 0;
  gladys.publishSceneEvent = async () => {
    calls += 1;
    if (calls === 1) throw new Error('429');
  };
  const watcher = watcherFor(gladys);
  await watcher.check(at('2026-10-07T18:44:30Z'));
  await watcher.check(at('2026-10-07T18:45:30Z'));
  assert.equal(calls, 2);
});

test('get_next_match returns the declared outputs', async () => {
  mockSources();
  assert.deepEqual(await getNextMatchAction({ team: 'asvel' }, NOW), {
    next_match: 'Gravelines – ASVEL (Betclic Élite)',
    next_start: 'dim. 4 oct. 16:30',
    opponent: 'Gravelines',
    is_home: false,
    competition: 'Betclic Élite',
    broadcaster: 'DAZN',
    last_result: 'Cholet 85 – 97 ASVEL',
  });
});

test('get_next_match works for an unfollowed team', async () => {
  mockSources();
  const outputs = await getNextMatchAction({ team: 'boston_celtics' }, NOW);
  assert.equal(outputs.next_match, 'Pistons – Celtics (NBA)');
  assert.equal(outputs.next_start, 'mar. 20 oct. 21:00');
  assert.equal(outputs.is_home, false);
  assert.equal(outputs.last_result, '');
});

test('get_next_match fails on an unknown team or when the source is down', async () => {
  await assert.rejects(() => getNextMatchAction({ team: 'nope' }), /Unknown team/);
  mockSources({ 'api-live.euroleague.net': new Error('down') });
  await assert.rejects(() => getNextMatchAction({ team: 'real_madrid' }, NOW), /down/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOCK_OPTIONS, DEFAULT_CONFIG, normalizeConfig, POLL_FREQUENCY } from '../src/config.js';

test('defaults when nothing is configured', () => {
  const config = normalizeConfig();
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    assert.deepEqual(config[key], value, key);
  }
  assert.deepEqual(normalizeConfig({}), config);
  assert.deepEqual(config.follows, {
    asvel: ['euroleague', 'betclic_elite'],
    paris_basketball: ['euroleague', 'betclic_elite'],
  });
  assert.deepEqual(config.teams, ['asvel', 'paris_basketball']);
  assert.deepEqual(config.competitions, ['euroleague', 'betclic_elite']);
});

test('one list per competition: a club is followed where it is ticked', () => {
  const config = normalizeConfig({
    teams_betclic_elite: ['asvel', 'cholet'],
    teams_euroleague: ['paris_basketball'],
    teams_nba: ['boston_celtics'],
  });
  assert.deepEqual(config.follows, {
    boston_celtics: ['nba'],
    paris_basketball: ['euroleague'],
    asvel: ['betclic_elite'],
    cholet: ['betclic_elite'],
  });
  assert.deepEqual(config.competitions, ['nba', 'euroleague', 'betclic_elite']);
});

test('lists drop unknown ids, duplicates and teams of another competition', () => {
  const config = normalizeConfig({
    teams_betclic_elite: ['asvel', 'nope', 'asvel', 'real_madrid'],
    teams_euroleague: 'real_madrid, asvel,boston_celtics',
    teams_nba: [],
  });
  assert.deepEqual(config.teams_betclic_elite, ['asvel']);
  assert.deepEqual(config.teams_euroleague, ['real_madrid', 'asvel']);
  assert.deepEqual(config.teams_nba, []);
  assert.deepEqual(config.competitions, ['euroleague', 'betclic_elite']);
});

test('nothing ticked: no team, no competition', () => {
  const config = normalizeConfig({ teams_betclic_elite: [], teams_euroleague: [], teams_nba: [] });
  assert.deepEqual(config.follows, {});
  assert.deepEqual(config.teams, []);
  assert.deepEqual(config.competitions, []);
});

test('a configuration of the first version is migrated', () => {
  const config = normalizeConfig({
    teams: ['asvel', 'boston_celtics'],
    competitions: ['nba', 'betclic_elite'],
  });
  assert.deepEqual(config.teams_betclic_elite, ['asvel']);
  assert.deepEqual(config.teams_euroleague, []);
  assert.deepEqual(config.teams_nba, ['boston_celtics']);
  // Without `competitions`, every competition was checked.
  assert.deepEqual(normalizeConfig({ teams: ['asvel'] }).follows, {
    asvel: ['euroleague', 'betclic_elite'],
  });
});

test('window bounds fall back to the defaults when invalid', () => {
  assert.equal(normalizeConfig({ watch_start: '20:30' }).watch_start, '20:30');
  assert.equal(normalizeConfig({ watch_start: '9:00' }).watch_start, '09:00');
  assert.equal(normalizeConfig({ watch_start: '25:00' }).watch_start, '18:00');
  assert.equal(normalizeConfig({ watch_end: null }).watch_end, '23:30');
});

test('include_night_games accepts the usual boolean encodings', () => {
  for (const value of [true, 'true', 1, '1']) {
    assert.equal(normalizeConfig({ include_night_games: value }).include_night_games, true);
  }
  for (const value of [false, 'false', 0, undefined, null]) {
    assert.equal(normalizeConfig({ include_night_games: value }).include_night_games, false);
  }
});

test('poll_frequency is fixed', () => {
  assert.equal(normalizeConfig({ poll_frequency: 1000 }).poll_frequency, POLL_FREQUENCY);
});

test('clock options: every half hour', () => {
  assert.equal(CLOCK_OPTIONS.length, 48);
  assert.equal(CLOCK_OPTIONS[0], '00:00');
  assert.equal(CLOCK_OPTIONS[37], '18:30');
  assert.ok(CLOCK_OPTIONS.includes(DEFAULT_CONFIG.watch_start));
  assert.ok(CLOCK_OPTIONS.includes(DEFAULT_CONFIG.watch_end));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOCK_OPTIONS, DEFAULT_CONFIG, normalizeConfig, POLL_FREQUENCY } from '../src/config.js';

test('defaults when nothing is configured', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig({}), DEFAULT_CONFIG);
});

test('lists drop unknown ids and duplicates, accept a comma string', () => {
  const config = normalizeConfig({
    teams: ['asvel', 'nope', 'asvel', 'boston_celtics'],
    competitions: 'nba, euroleague,foot',
  });
  assert.deepEqual(config.teams, ['asvel', 'boston_celtics']);
  assert.deepEqual(config.competitions, ['nba', 'euroleague']);
  assert.deepEqual(normalizeConfig({ teams: [] }).teams, []);
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

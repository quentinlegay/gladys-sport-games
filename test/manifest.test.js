// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/devices/index.js';
import { DEFAULT_CONFIG, normalizeConfig, POLL_FREQUENCY } from '../src/config.js';
import { resetLnbSession } from '../src/providers/lnb.js';
import { parseEuroleague } from '../src/providers/euroleague.js';
import { resetScheduleCache } from '../src/schedule.js';
import {
  ACTION_GET_NEXT_MATCH,
  buildStartingEvent,
  getNextMatchAction,
  MINUTES_BEFORE,
  TRIGGER_MATCH_STARTING,
} from '../src/scenes.js';
import { WIDGET_UPCOMING_MATCHES } from '../src/widget.js';
import { syncManifest } from '../scripts/sync-manifest.js';
import { fixture, restoreFetch } from './helpers/mockFetch.js';
import { mockSources, NOW } from './helpers/sources.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const field = (key) => manifest.config_schema.find((f) => f.key === key);

afterEach(() => {
  restoreFetch();
  resetScheduleCache();
  resetLnbSession();
});

test('every manifest action has a registered handler, and the other way round', () => {
  const declared = (manifest.actions ?? []).map((a) => a.key).sort();
  assert.deepEqual(declared, Object.keys(ACTIONS).sort());
});

test('widgets and scene declarations require Gladys >= 5.1.0', () => {
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  const minVersion = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.\d+/);
  assert.ok(minVersion, 'gladys_version must declare a minimum version');
  const [, major, minor] = minVersion.map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 1), manifest.gladys_version);
});

test('name, version and image tag stay consistent', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${pkg.version}`));
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const f of manifest.config_schema) {
    if (f.default !== undefined) {
      assert.deepEqual(
        normalizeConfig({ [f.key]: f.default })[f.key],
        DEFAULT_CONFIG[f.key],
        `DEFAULT_CONFIG.${f.key} must match the manifest default`,
      );
    }
  }
});

// Values of DEVICE_POLL_FREQUENCIES in the Gladys core (server/utils/constants.js):
// any other device poll_frequency rejects the whole discovery (HTTP 400).
const GLADYS_POLL_FREQUENCIES = [1000, 2000, 10_000, 15_000, 30_000, 60_000];

test('poll_frequency is a value Gladys accepts, and is not configurable', () => {
  assert.equal(field('poll_frequency'), undefined);
  assert.equal(POLL_FREQUENCY, 60_000);
  assert.ok(GLADYS_POLL_FREQUENCIES.includes(POLL_FREQUENCY));
});

test('option lists are in sync with the code (run `npm run sync-manifest`)', () => {
  assert.deepEqual(syncManifest(structuredClone(manifest)), manifest);
  assert.equal(field('teams').options.length, 64);
});

test('frozen keys stay generic', () => {
  const keys = [
    ...manifest.config_schema.map((f) => f.key),
    ...manifest.actions.map((a) => a.key),
    ...manifest.widgets.flatMap((w) => [w.key, ...w.settings.map((s) => s.key)]),
    ...manifest.scene_triggers.flatMap((t) => [
      t.key,
      ...t.fields.map((f) => f.key),
      ...t.variables.map((v) => v.key),
    ]),
    ...manifest.scene_actions.flatMap((a) => [
      a.key,
      ...a.fields.map((f) => f.key),
      ...a.outputs.map((o) => o.key),
    ]),
    ...field('teams').options.map((o) => o.value),
  ];
  for (const key of keys) {
    assert.doesNotMatch(key, /basket_|nba_/, key);
  }
});

test('the upcoming_matches widget is declared', () => {
  const widget = manifest.widgets.find((w) => w.key === WIDGET_UPCOMING_MATCHES);
  assert.ok(widget);
  assert.deepEqual(
    widget.settings.map((s) => s.key),
    ['teams'],
  );
});

test('match_starting: every declared field and variable is in the event data', () => {
  const trigger = manifest.scene_triggers.find((t) => t.key === TRIGGER_MATCH_STARTING);
  assert.ok(trigger);
  const [match] = parseEuroleague(fixture('euroleague-games.json'));
  const data = buildStartingEvent(match, match.homeTeam.id, '0');
  for (const key of [...trigger.fields, ...trigger.variables].map((f) => f.key)) {
    assert.ok(key in data, `event data lacks "${key}"`);
  }
  assert.ok(Object.keys(data).length <= 30, 'event data is capped at 30 keys');
  for (const value of Object.values(data)) {
    assert.equal(typeof value, 'string', 'flat primitive values');
  }
  const minutes = trigger.fields.find((f) => f.key === 'minutes_before');
  assert.deepEqual(
    minutes.options.map((o) => o.value),
    MINUTES_BEFORE,
  );
  assert.equal(minutes.required, true);
});

test('get_next_match: the handler returns exactly the declared outputs', async () => {
  const action = manifest.scene_actions.find((a) => a.key === ACTION_GET_NEXT_MATCH);
  assert.ok(action);
  mockSources();
  const outputs = await getNextMatchAction({ team: 'asvel' }, NOW);
  assert.deepEqual(Object.keys(outputs).sort(), action.outputs.map((o) => o.key).sort());
  for (const output of action.outputs) {
    assert.equal(typeof outputs[output.key], output.type, output.key);
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.ok(section.label?.en);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

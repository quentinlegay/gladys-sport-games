import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import {
  ACTIONS,
  buildDiscoveredDevices,
  createStatePublisher,
  findTeamByDevice,
  selectedTeams,
  teamOfField,
} from '../src/devices/index.js';
import { FEATURE, NO_MATCH, NO_RESULT, teamDevice } from '../src/devices/team.js';
import { normalizeConfig, teamsKey } from '../src/config.js';
import { resetLnbSession } from '../src/providers/lnb.js';
import { getFollowedMatches, resetScheduleCache } from '../src/schedule.js';
import { COMPETITIONS, findTeam, TEAMS } from '../src/teams.js';
import { createFakeGladys } from './helpers/fakeGladys.js';
import { restoreFetch } from './helpers/mockFetch.js';
import { mockSources, NOW } from './helpers/sources.js';

const config = normalizeConfig();

afterEach(() => {
  restoreFetch();
  resetScheduleCache();
  resetLnbSession();
});

test('one device per followed team, polled every minute', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, normalizeConfig({ poll_frequency: '30000' }));
  assert.deepEqual(
    devices.map((d) => d.name),
    ['Matchs LDLC ASVEL', 'Matchs Paris Basketball'],
  );
  for (const device of devices) {
    assert.equal(device.poll_frequency, 60_000);
    assert.equal(device.features.length, 3);
  }
});

test('device external_ids are unique across all teams', () => {
  const gladys = createFakeGladys();
  const ids = TEAMS.map((t) => t.id);
  const all = buildDiscoveredDevices(
    gladys,
    normalizeConfig(Object.fromEntries(COMPETITIONS.map((c) => [teamsKey(c.id), ids]))),
  );
  assert.equal(all.length, TEAMS.length);
  const externalIds = all.map((d) => d.external_id);
  assert.equal(new Set(externalIds).size, externalIds.length);
});

test('features are read-only text sensors with frozen keys', () => {
  const gladys = createFakeGladys();
  const device = teamDevice.buildDevice(gladys, findTeam('asvel'), config);
  for (const feature of device.features) {
    assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.TEXT);
    assert.equal(feature.type, DEVICE_FEATURE_TYPES.TEXT.TEXT);
    assert.equal(feature.read_only, true);
  }
  assert.deepEqual(
    device.features.map((f) => f.external_id),
    ['team:asvel:next_match', 'team:asvel:next_match_start', 'team:asvel:last_result'],
  );
  assert.deepEqual(Object.values(FEATURE), ['next_match', 'next_match_start', 'last_result']);
});

test('an empty team list publishes no device', () => {
  const gladys = createFakeGladys();
  assert.deepEqual(buildDiscoveredDevices(gladys, normalizeConfig({ teams: [] })), []);
});

test('findTeamByDevice routes any team device, even an unfollowed one', () => {
  const gladys = createFakeGladys();
  for (const team of TEAMS) {
    const external_id = teamDevice.deviceExternalId(gladys, team);
    assert.equal(findTeamByDevice(gladys, { external_id }), team);
  }
  assert.equal(findTeamByDevice(gladys, { external_id: 'nope' }), undefined);
});

test('selectedTeams keeps the configuration order', () => {
  const list = selectedTeams(
    normalizeConfig({
      teams_nba: ['boston_celtics'],
      teams_euroleague: [],
      teams_betclic_elite: ['asvel'],
    }),
  );
  assert.deepEqual(
    list.map((t) => t.id),
    ['boston_celtics', 'asvel'],
  );
});

test('buildStates publishes the 3 texts of a team, ignoring the watching window', async () => {
  mockSources();
  const gladys = createFakeGladys();
  const { matches } = await getFollowedMatches(config, { now: NOW });
  const states = teamDevice.buildStates(gladys, findTeam('asvel'), matches, NOW);
  assert.deepEqual(states, [
    {
      device_feature_external_id: 'team:asvel:next_match',
      // 16:30, out of the 18:00 - 23:30 window: the sensors still show it.
      text: 'Gravelines – ASVEL (Betclic Élite)',
    },
    { device_feature_external_id: 'team:asvel:next_match_start', text: 'dim. 4 oct. 16:30' },
    { device_feature_external_id: 'team:asvel:last_result', text: 'Cholet 85 – 97 ASVEL' },
  ]);
});

test('buildStates keeps the competitions the team is followed in', async () => {
  mockSources();
  const gladys = createFakeGladys();
  const followed = normalizeConfig({
    teams_betclic_elite: [],
    teams_euroleague: ['asvel', 'paris_basketball'],
  });
  const { matches } = await getFollowedMatches(followed, { now: NOW });
  const [next] = teamDevice.buildStates(gladys, findTeam('asvel'), matches, NOW, followed.follows);
  // Not Gravelines - ASVEL: ASVEL is not followed in Betclic Élite.
  assert.equal(next.text, 'Paris – ASVEL (EuroLeague)');
});

test('teamOfField reads a device external_id or a team id', () => {
  const gladys = createFakeGladys();
  assert.equal(teamOfField(gladys, 'team:asvel').id, 'asvel');
  assert.equal(teamOfField(gladys, 'boston_celtics').id, 'boston_celtics');
  assert.equal(teamOfField(gladys, 'nope'), undefined);
});

test('buildStates without games', () => {
  const gladys = createFakeGladys();
  const states = teamDevice.buildStates(gladys, findTeam('asvel'), [], NOW);
  assert.deepEqual(
    states.map((s) => s.text),
    [NO_MATCH, NO_MATCH, NO_RESULT],
  );
});

test('the state publisher only sends what changed, until reset', async () => {
  const gladys = createFakeGladys();
  const publisher = createStatePublisher(gladys);
  const states = [
    { device_feature_external_id: 'a', text: 'x' },
    { device_feature_external_id: 'b', text: 'y' },
  ];
  assert.equal(await publisher.publish(states), 2);
  assert.equal(await publisher.publish(states), 0);
  assert.equal(await publisher.publish([{ device_feature_external_id: 'a', text: 'z' }]), 1);
  publisher.reset();
  assert.equal(await publisher.publish(states), 2);
  assert.equal(gladys.published.length, 5);
});

test('the test_sources action reports every competition', async () => {
  mockSources({ 'api-live.euroleague.net': new Error('down') });
  const message = await ACTIONS.test_sources(createFakeGladys(), { fields: {}, config });
  // No NBA team ticked: NBA is not downloaded.
  assert.doesNotMatch(message.fr, /NBA/);
  assert.match(message.fr, /EuroLeague : erreur \(down\)/);
  assert.match(message.fr, /Betclic Élite : 5 matchs/);
  assert.match(message.en, /Next game of LDLC ASVEL: /);
});

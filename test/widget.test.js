import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { resetLnbSession } from '../src/providers/lnb.js';
import { getFollowedMatches, resetScheduleCache } from '../src/schedule.js';
import {
  buildWidgetContent,
  getUpcomingMatchesWidget,
  MAX_ITEMS,
  widgetTeams,
} from '../src/widget.js';
import { restoreFetch } from './helpers/mockFetch.js';
import { mockSources, NOW } from './helpers/sources.js';

const config = normalizeConfig();

afterEach(() => {
  restoreFetch();
  resetScheduleCache();
  resetLnbSession();
});

async function followedMatches() {
  mockSources();
  return (await getFollowedMatches(config, { now: NOW })).matches;
}

test('the widget lists the next games in the watching window', async () => {
  const matches = await followedMatches();
  const content = buildWidgetContent(matches, {
    language: 'fr',
    config,
    teams: config.teams,
    now: NOW,
  });
  assert.equal(content.components.length, 1);
  const [list] = content.components;
  assert.equal(list.type, 'card-list');
  assert.equal(list.display, 'list');
  // The 16:30 games are out of 18:00 - 23:30.
  assert.deepEqual(
    list.items.map((i) => `${i.badge.text} ${i.title}`),
    [
      'mer. 20:45 Paris – ASVEL',
      '11/10 19:00 ASVEL – Roanne',
      '13/10 20:00 ASVEL – Etoile Rouge',
      '14/10 20:45 Paris – Virtus',
      '15/10 21:00 Real Madrid – ASVEL',
      '17/10 19:00 Limoges – ASVEL',
    ],
  );
  const [derby] = list.items;
  assert.equal(derby.subtitle, 'EuroLeague');
  assert.equal(derby.badge.color, 'info');
  assert.equal(
    derby.description,
    'Paris Basketball – LDLC ASVEL\nEuroLeague\nmer. 7 oct. 20:45 (heure de Paris)',
  );
  assert.equal(list.items[1].subtitle, "Betclic Élite · La Chaine L'Équipe / DAZN");
  for (const item of list.items) {
    assert.ok(
      item.title.length <= 60 && item.subtitle.length <= 60 && item.badge.text.length <= 16,
    );
  }
  // Next kick-off in more than one hour.
  assert.equal(content.ttl_seconds, 3600);
});

test('night games can be included; 8 rows at most', async () => {
  const matches = await followedMatches();
  const content = buildWidgetContent(matches, {
    language: 'en',
    config: { ...config, include_night_games: true },
    teams: config.teams,
    now: NOW,
  });
  const items = content.components[0].items;
  assert.equal(items.length, MAX_ITEMS);
  assert.equal(items[0].badge.text, 'tomorrow 16:30');
});

test('ttl_seconds ends at the next kick-off; a live game has a badge', async () => {
  const matches = await followedMatches();
  // 10 min before Paris - ASVEL.
  const now = Date.parse('2026-10-07T18:35:00Z');
  const before = buildWidgetContent(matches, { language: 'fr', config, teams: config.teams, now });
  assert.equal(before.ttl_seconds, 600);

  const during = buildWidgetContent(matches, {
    language: 'fr',
    config,
    teams: config.teams,
    now: now + 20 * 60_000,
  });
  const [first] = during.components[0].items;
  assert.equal(first.title, 'Paris – ASVEL');
  assert.deepEqual(first.badge, { text: 'En direct', color: 'danger' });
});

test('empty states', async () => {
  const none = buildWidgetContent([], { language: 'fr', config, teams: [], now: NOW });
  assert.equal(none.components[0].type, 'text');
  assert.match(none.components[0].text, /Aucune équipe suivie/);
  const empty = buildWidgetContent([], { language: 'en', config, teams: ['asvel'], now: NOW });
  assert.match(empty.components[0].text, /No upcoming game/);
});

test('widgetTeams: own setting, else the configuration', () => {
  assert.deepEqual(widgetTeams({}, config), ['asvel', 'paris_basketball']);
  assert.deepEqual(widgetTeams({ teams: ['boston_celtics', 'nope'] }, config), ['boston_celtics']);
});

test('the widget handler downloads the games of its teams', async () => {
  const calls = mockSources();
  const content = await getUpcomingMatchesWidget(
    { settings: { teams: ['boston_celtics'] }, language: 'fr' },
    { ...config, include_night_games: true },
  );
  assert.ok(calls.some((c) => c.url.includes('/teams/2/schedule')));
  assert.ok(content.components[0].items.some((i) => i.title.includes('Celtics')));
});

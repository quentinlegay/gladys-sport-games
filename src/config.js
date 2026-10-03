// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies you of every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides defaults and normalizes the received object, so the
// rest of the code never has to deal with `undefined`.
// -----------------------------------------------------------------------------

import { COMPETITIONS, findTeam } from './teams.js';
import { parseClock } from './time.js';

// Refresh interval of the sensors, in MILLISECONDS. Gladys only accepts a few
// values for a device `poll_frequency` (DEVICE_POLL_FREQUENCIES of the core:
// 1 s, 2 s, 10 s, 15 s, 30 s, 1 min) and rejects the whole discovery otherwise.
// 1 min is the slowest: it is fixed and not offered in the config.
export const POLL_FREQUENCY = 60_000;

// Choices of the `watch_start` / `watch_end` selects: every half hour.
export const CLOCK_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  return `${hours}:${i % 2 === 0 ? '00' : '30'}`;
});

// Key of the config field listing the followed teams of a competition
// (`teams_betclic_elite`, `teams_euroleague`, `teams_nba`): one checkbox list
// per competition, so the user never scrolls through every team at once, and
// ticking a club in a list follows it in THAT competition only.
export const teamsKey = (competition) => `teams_${competition}`;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest.
export const DEFAULT_CONFIG = {
  teams_betclic_elite: ['asvel', 'paris_basketball'],
  teams_euroleague: ['asvel', 'paris_basketball'],
  teams_nba: [],
  watch_start: '18:00',
  watch_end: '23:30',
  include_night_games: false,
  poll_frequency: POLL_FREQUENCY,
};

/**
 * Merge the user config with the defaults.
 *
 * Besides the raw fields, the result holds what the rest of the code uses:
 *   - `follows`: team id -> competitions followed for that team;
 *   - `teams`: the followed team ids (one device each);
 *   - `competitions`: the competitions with at least one followed team.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const lists = teamLists(raw);
  const follows = {};
  for (const { id: competition } of COMPETITIONS) {
    for (const team of lists[teamsKey(competition)]) {
      (follows[team] ??= []).push(competition);
    }
  }
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    ...lists,
    follows,
    teams: Object.keys(follows),
    competitions: COMPETITIONS.map((c) => c.id).filter((c) =>
      Object.values(follows).some((list) => list.includes(c)),
    ),
    watch_start: normalizeClock(raw.watch_start, DEFAULT_CONFIG.watch_start),
    watch_end: normalizeClock(raw.watch_end, DEFAULT_CONFIG.watch_end),
    include_night_games: normalizeBoolean(raw.include_night_games),
    // Not configurable: ignore any value saved by an older version.
    poll_frequency: POLL_FREQUENCY,
  };
}

// One list of team ids per competition, keeping only the teams of that
// competition. A configuration saved by the first version (one `teams` list
// and a `competitions` list) is migrated: each team is followed in every
// checked competition it plays.
function teamLists(raw) {
  const perCompetition = COMPETITIONS.some((c) => raw[teamsKey(c.id)] !== undefined);
  const legacy = !perCompetition && raw.teams !== undefined && raw.teams !== null;
  const legacyCompetitions = legacy
    ? toList(raw.competitions ?? COMPETITIONS.map((c) => c.id))
    : [];
  const lists = {};
  for (const { id: competition } of COMPETITIONS) {
    const key = teamsKey(competition);
    let ids;
    if (legacy) {
      ids = legacyCompetitions.includes(competition) ? toList(raw.teams) : [];
    } else {
      const value = raw[key];
      ids = value === undefined || value === null ? DEFAULT_CONFIG[key] : toList(value);
    }
    lists[key] = [...new Set(ids)].filter((id) => findTeam(id)?.refs[competition] !== undefined);
  }
  return lists;
}

// `multi_select` stores an array of option values. Also accept a
// comma-separated string.
function toList(value) {
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((id) => String(id).trim()).filter(Boolean);
}

function normalizeClock(value, fallback) {
  return parseClock(value) === null ? fallback : String(value).trim().padStart(5, '0');
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

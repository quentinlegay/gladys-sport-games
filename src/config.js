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

import { findCompetition, findTeam } from './teams.js';
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

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest.
export const DEFAULT_CONFIG = {
  competitions: ['nba', 'euroleague', 'betclic_elite'],
  teams: ['asvel', 'paris_basketball'],
  watch_start: '18:00',
  watch_end: '23:30',
  include_night_games: false,
  poll_frequency: POLL_FREQUENCY,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    competitions: normalizeList(raw.competitions, DEFAULT_CONFIG.competitions, findCompetition),
    teams: normalizeList(raw.teams, DEFAULT_CONFIG.teams, findTeam),
    watch_start: normalizeClock(raw.watch_start, DEFAULT_CONFIG.watch_start),
    watch_end: normalizeClock(raw.watch_end, DEFAULT_CONFIG.watch_end),
    include_night_games: normalizeBoolean(raw.include_night_games),
    // Not configurable: ignore any value saved by an older version.
    poll_frequency: POLL_FREQUENCY,
  };
}

// `multi_select` stores an array of option values. Also accept a
// comma-separated string, drop unknown ids and duplicates.
function normalizeList(value, fallback, find) {
  if (value === undefined || value === null) {
    return [...fallback];
  }
  const list = Array.isArray(value) ? value : String(value).split(',');
  const ids = list.map((id) => String(id).trim()).filter((id) => find(id));
  return [...new Set(ids)];
}

function normalizeClock(value, fallback) {
  return parseClock(value) === null ? fallback : String(value).trim().padStart(5, '0');
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

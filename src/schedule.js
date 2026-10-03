// -----------------------------------------------------------------------------
// Schedule: aggregates the providers, caches their calendars and answers the
// questions of the devices, the widget and the scenes (next match, last
// result, games starting now).
//
// Cache, per source (a whole season for EuroLeague, a team for NBA and LNB):
//   - kept 6 h, so a 1 min poll_frequency does NOT mean more downloads;
//   - kept only 15 min while one of its games is being played or waits for
//     its final score, so `last_result` follows quickly;
//   - after a failure, the previous calendar keeps being served and the source
//     is tried again 15 min later. A failing provider never breaks the others.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { euroleague } from './providers/euroleague.js';
import { lnb } from './providers/lnb.js';
import { nba } from './providers/nba.js';
import { findCompetition, findTeam } from './teams.js';
import { formatDateTime, isInWindow, seasonOf } from './time.js';

const logger = createLogger({ name: 'schedule' });

/**
 * @typedef {{ id: string, name: string, shortName: string }} MatchTeam
 * @typedef {object} Match
 * @property {string} id provider prefix + source id, e.g. `nba:401909088`
 * @property {string} sport
 * @property {string} competition nba | euroleague | betclic_elite
 * @property {MatchTeam} homeTeam id = id of src/teams.js when known
 * @property {MatchTeam} awayTeam
 * @property {string} start ISO date, UTC
 * @property {'scheduled'|'live'|'finished'|'postponed'} status
 * @property {{ home: number|null, away: number|null }} score
 * @property {string|null} broadcaster
 */

/** Providers, keyed by competition. */
export const PROVIDERS = {
  nba,
  euroleague,
  betclic_elite: lnb,
};

export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const RETRY_DELAY_MS = 15 * 60 * 1000;
export const SCORE_REFRESH_MS = 15 * 60 * 1000;
// A game whose source does not report live status is considered as being
// played during this time after its start.
export const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
// Beyond this, a game still not "finished" is not awaited any more.
const AWAITED_RESULT_MS = 12 * 60 * 60 * 1000;

// Maximum length of a published text state.
export const MAX_TEXT_LENGTH = 250;

// --- Cache -------------------------------------------------------------------

// key -> { matches: Match[]|null, fetchedAt, lastFailureAt, lastError, pending }
const cache = new Map();

/** Forget every cached calendar (tests). */
export function resetScheduleCache() {
  cache.clear();
}

function awaitsResult(matches, now) {
  return matches.some((m) => {
    const start = Date.parse(m.start);
    return (
      m.status !== 'finished' &&
      m.status !== 'postponed' &&
      start <= now &&
      now - start < AWAITED_RESULT_MS
    );
  });
}

function isFresh(entry, now) {
  if (!entry?.matches) {
    return false;
  }
  const maxAge = awaitsResult(entry.matches, now) ? SCORE_REFRESH_MS : CACHE_MAX_AGE_MS;
  return now - entry.fetchedAt < maxAge;
}

/**
 * Calendar of one source, from the cache or downloaded.
 * @returns {Promise<Match[]>} rejects only when the source never answered
 */
function loadEntry(key, fetcher, { now, force }) {
  let entry = cache.get(key);
  if (!entry) {
    entry = { matches: null, fetchedAt: 0, lastFailureAt: 0, lastError: null, pending: null };
    cache.set(key, entry);
  }
  const waitBeforeRetry = entry.lastFailureAt > 0 && now - entry.lastFailureAt < RETRY_DELAY_MS;
  if (!force && (isFresh(entry, now) || waitBeforeRetry)) {
    if (entry.matches) {
      return Promise.resolve(entry.matches);
    }
    return Promise.reject(entry.lastError ?? new Error(`${key}: not loaded`));
  }
  if (!entry.pending) {
    entry.pending = fetcher()
      .then((matches) => {
        entry.matches = matches;
        entry.fetchedAt = now;
        entry.lastFailureAt = 0;
        entry.lastError = null;
        logger.info(`${key}: ${matches.length} games loaded`);
        return matches;
      })
      .catch((err) => {
        entry.lastFailureAt = now;
        entry.lastError = err;
        if (entry.matches) {
          logger.warn(`${key}: download failed, keeping the previous calendar`, err);
          return entry.matches;
        }
        logger.error(`${key}: download failed`, err);
        throw err;
      })
      .finally(() => {
        entry.pending = null;
      });
  }
  return entry.pending;
}

/**
 * Sources needed for some teams and competitions.
 * @returns {Array<{ key: string, competition: string, fetcher: () => Promise<Match[]> }>}
 */
export function sourcesFor(teamIds, competitions, season) {
  const sources = [];
  for (const competition of competitions) {
    const provider = PROVIDERS[competition];
    if (!provider) {
      continue;
    }
    const refs = teamIds
      .map((id) => findTeam(id)?.refs[competition])
      .filter((ref) => ref !== undefined);
    if (refs.length === 0) {
      continue;
    }
    if (provider.perTeam) {
      for (const ref of new Set(refs)) {
        sources.push({
          key: `${competition}:${season}:${ref}`,
          competition,
          fetcher: () => provider.fetchSchedule({ season, team: ref }),
        });
      }
    } else {
      sources.push({
        key: `${competition}:${season}`,
        competition,
        fetcher: () => provider.fetchSchedule({ season }),
      });
    }
  }
  return sources;
}

/**
 * Games of some teams, in some competitions, from every needed source.
 * Never rejects: a failing source is reported in `errors`.
 * @param {{ teams: string[], competitions: string[], now?: number, force?: boolean }} options
 * @returns {Promise<{ matches: Match[], errors: Array<{ competition: string, error: Error }> }>}
 */
export async function getMatches({ teams, competitions, now = Date.now(), force = false }) {
  const season = seasonOf(new Date(now));
  const sources = sourcesFor(teams, competitions, season);
  const results = await Promise.allSettled(
    sources.map((s) => loadEntry(s.key, s.fetcher, { now, force })),
  );
  const byId = new Map();
  const errors = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      errors.push({ competition: sources[i].competition, error: result.reason });
      return;
    }
    for (const match of result.value) {
      byId.set(match.id, match);
    }
  });
  const wanted = new Set(teams);
  const matches = [...byId.values()]
    .filter((m) => wanted.has(m.homeTeam.id) || wanted.has(m.awayTeam.id))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { matches, errors };
}

/** Games of the teams followed in the configuration. */
export function getFollowedMatches(config, options = {}) {
  return getMatches({ teams: config.teams, competitions: config.competitions, ...options });
}

// --- Questions ---------------------------------------------------------------

const startOf = (match) => Date.parse(match.start);

/** The game is being played (reported live, or started a moment ago). */
export function isLive(match, now = Date.now()) {
  if (match.status === 'live') {
    return true;
  }
  const start = startOf(match);
  return match.status === 'scheduled' && start <= now && now - start < LIVE_WINDOW_MS;
}

/** Games not played yet, or being played, sorted by start. */
export function upcomingMatches(matches, now = Date.now()) {
  return matches.filter((m) => (m.status === 'scheduled' && startOf(m) > now) || isLive(m, now));
}

export const involves = (match, teamId) =>
  match.homeTeam.id === teamId || match.awayTeam.id === teamId;

/** Next (or current) game of a team. */
export function nextMatch(matches, teamId, now = Date.now()) {
  return upcomingMatches(matches, now).find((m) => involves(m, teamId)) ?? null;
}

/** Last finished game of a team, with its score. */
export function lastResult(matches, teamId) {
  const finished = matches.filter(
    (m) => m.status === 'finished' && involves(m, teamId) && m.score.home !== null,
  );
  return finished.at(-1) ?? null;
}

/**
 * Keep the games in the daily watching window of the configuration, unless
 * the night games are included. Applies to the widget and the trigger only.
 */
export function inWatchWindow(matches, config) {
  if (config.include_night_games) {
    return matches;
  }
  return matches.filter((m) => isInWindow(new Date(m.start), config.watch_start, config.watch_end));
}

/**
 * Games whose start, minus `offsetMinutes`, falls in ]from, to].
 * @param {Match[]} matches
 * @param {Date} from excluded
 * @param {Date} to included
 */
export function startingBetween(matches, from, to, offsetMinutes = 0) {
  const offset = offsetMinutes * 60_000;
  return matches.filter((m) => {
    const at = startOf(m) - offset;
    return m.status !== 'postponed' && m.status !== 'finished' && at > from && at <= to;
  });
}

// --- Display -----------------------------------------------------------------

function truncate(text) {
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
}

export const competitionName = (id) => findCompetition(id)?.name ?? id;

/** `ASVEL – Paris` */
export function formatTeams(match) {
  return `${match.homeTeam.shortName} – ${match.awayTeam.shortName}`;
}

/** `ASVEL – Paris (Betclic Élite)` */
export function formatMatch(match) {
  return match ? truncate(`${formatTeams(match)} (${competitionName(match.competition)})`) : '';
}

/** `ASVEL 85 – 78 Paris` */
export function formatResult(match) {
  if (!match) {
    return '';
  }
  return truncate(
    `${match.homeTeam.shortName} ${match.score.home} – ${match.score.away} ${match.awayTeam.shortName}`,
  );
}

/** `sam. 4 oct. 20:00`, Paris time. */
export function formatStart(match) {
  return match ? formatDateTime(new Date(match.start)) : '';
}

/** The opponent of a team in a game. */
export function opponentOf(match, teamId) {
  return match.homeTeam.id === teamId ? match.awayTeam : match.homeTeam;
}

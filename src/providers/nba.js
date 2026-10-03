// -----------------------------------------------------------------------------
// Provider NBA: unofficial ESPN API (site.api.espn.com). No key.
//
// The static schedule of cdn.nba.com answers 403 to non-browser clients, so
// ESPN is used instead. The league scoreboard only accepts one day at a time,
// so the schedule is read team by team (`teams/{id}/schedule`), only for the
// followed teams: preseason, regular season and play-offs (season types 1-3).
// ESPN names a season after its ending year (2026-27 = 2027).
// -----------------------------------------------------------------------------

import { findTeamByRef } from '../teams.js';
import { fetchJson } from './http.js';

export const COMPETITION = 'nba';

const SEASON_TYPES = [1, 2, 3];

export const scheduleUrl = (teamRef, season, seasonType) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamRef}/schedule` +
  `?season=${season + 1}&seasontype=${seasonType}`;

function toTeam(competitor) {
  const team = competitor?.team ?? {};
  const known = findTeamByRef(COMPETITION, team.id);
  if (known) {
    return { id: known.id, name: known.name, shortName: known.shortName };
  }
  return {
    id: `${COMPETITION}:${team.id}`,
    name: team.displayName ?? team.abbreviation,
    shortName: team.shortDisplayName ?? team.abbreviation,
  };
}

function toStatus(status) {
  const type = status?.type ?? {};
  if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED/.test(type.name ?? '')) {
    return 'postponed';
  }
  if (type.state === 'post' || type.completed) {
    return 'finished';
  }
  if (type.state === 'in') {
    return 'live';
  }
  return 'scheduled';
}

// The team schedule gives `{ value, displayValue }`, the scoreboard a string.
function toScore(competitor) {
  const score = competitor?.score;
  const value = typeof score === 'object' && score !== null ? score.value : score;
  const number = Number(value);
  return value === undefined || value === null || !Number.isFinite(number) ? null : number;
}

/**
 * Normalize an ESPN team schedule.
 * @param {{ events?: object[] }} json
 * @returns {import('../schedule.js').Match[]}
 */
export function parseNba(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const matches = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    const start = new Date(event.date ?? competition?.date);
    if (!home || !away || Number.isNaN(start.getTime())) {
      continue;
    }
    const status = toStatus(competition.status ?? event.status);
    const hasScore = status === 'finished' || status === 'live';
    matches.push({
      id: `${COMPETITION}:${event.id}`,
      sport: 'basketball',
      competition: COMPETITION,
      homeTeam: toTeam(home),
      awayTeam: toTeam(away),
      start: start.toISOString(),
      status,
      score: hasScore ? { home: toScore(home), away: toScore(away) } : { home: null, away: null },
      // ESPN only lists US channels: useless for a French audience.
      broadcaster: null,
    });
  }
  return matches;
}

export const nba = {
  competition: COMPETITION,
  // One request per followed team (and per season type).
  perTeam: true,

  /**
   * @param {{ season: number, team: string }} options starting year of the
   *   season, ESPN team id
   */
  async fetchSchedule({ season, team }) {
    const results = await Promise.allSettled(
      SEASON_TYPES.map((type) => fetchJson(scheduleUrl(team, season, type))),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    if (ok.length === 0) {
      throw results[0].reason;
    }
    const byId = new Map();
    for (const { value } of ok) {
      for (const match of parseNba(value)) {
        byId.set(match.id, match);
      }
    }
    return [...byId.values()];
  },
};

// -----------------------------------------------------------------------------
// Provider EUROLEAGUE: public API of api-live.euroleague.net (Swagger at
// https://api-live.euroleague.net/swagger). No key.
//
// One request returns the whole season (~380 regular season games, then the
// play-offs as they are drawn), so the calendar is fetched once for all teams.
// -----------------------------------------------------------------------------

import { findTeamByRef } from '../teams.js';
import { fetchJson } from './http.js';

export const COMPETITION = 'euroleague';

export const scheduleUrl = (season) =>
  `https://api-live.euroleague.net/v2/competitions/E/seasons/E${season}/games`;

function toTeam(side) {
  const club = side?.club ?? {};
  const known = findTeamByRef(COMPETITION, club.code);
  if (known) {
    return { id: known.id, name: known.name, shortName: known.shortName };
  }
  return {
    id: `${COMPETITION}:${club.code}`,
    name: club.name ?? club.code,
    shortName: club.abbreviatedName ?? club.name ?? club.code,
  };
}

function toStatus(game) {
  if (/postpon|cancel|suspend/i.test(game.gameStatus ?? '')) {
    return 'postponed';
  }
  return game.played ? 'finished' : 'scheduled';
}

/**
 * Normalize the `games` response of the EuroLeague API.
 * @param {{ data?: object[] }} json
 * @returns {import('../schedule.js').Match[]}
 */
export function parseEuroleague(json) {
  const games = Array.isArray(json?.data) ? json.data : [];
  const matches = [];
  for (const game of games) {
    // Play-off slots not drawn yet are "virtual" clubs: nothing to show.
    if (!game.utcDate || game.local?.club?.isVirtual || game.road?.club?.isVirtual) {
      continue;
    }
    const status = toStatus(game);
    const hasScore = status === 'finished' || game.local?.score > 0 || game.road?.score > 0;
    matches.push({
      id: `${COMPETITION}:${game.identifier ?? game.id}`,
      sport: 'basketball',
      competition: COMPETITION,
      homeTeam: toTeam(game.local),
      awayTeam: toTeam(game.road),
      start: new Date(game.utcDate).toISOString(),
      status,
      score: hasScore
        ? { home: game.local?.score ?? null, away: game.road?.score ?? null }
        : { home: null, away: null },
      broadcaster: null,
    });
  }
  return matches;
}

export const euroleague = {
  competition: COMPETITION,
  // The whole season comes in one request.
  perTeam: false,

  /** @param {{ season: number }} options starting year of the season */
  async fetchSchedule({ season }) {
    return parseEuroleague(await fetchJson(scheduleUrl(season)));
  },
};

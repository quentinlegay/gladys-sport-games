// -----------------------------------------------------------------------------
// Provider LNB (Betclic Élite): API of the official lnb.fr website
// (api-prod.lnb.fr). No account and no key, but undocumented: it is the API
// the website itself calls, with the anonymous token the website fetches from
// https://lnb.fr/api/token (valid 15 minutes).
//
// TheSportsDB and API-Basketball were evaluated: their free tiers are too
// limited (a handful of games per request) to follow a season. This source has
// the exact UTC times, the scores and the French broadcasters (DAZN, La Chaîne
// L'Équipe), and shows the late scheduling of the LNB as soon as it is
// published.
//
// Flow, for a season and a club:
//   1. GET  competition/getMainCompetition?year=Y  -> id of "PROA" this season
//   2. GET  competition/getCompetitionTeams        -> club id -> season team id
//   3. POST match/v3/getCalendar { team_external_id } -> games of that team
// Steps 1-2 are shared by every followed club and kept for a few hours.
// -----------------------------------------------------------------------------

import { findTeamByRef } from '../teams.js';
import { fetchJson } from './http.js';

export const COMPETITION = 'betclic_elite';

export const API_URL = 'https://api-prod.lnb.fr/';
export const TOKEN_URL = 'https://lnb.fr/api/token';
const COMPETITION_ABBREV = 'PROA';

// The token lives 15 min: renew it a bit before.
const TOKEN_TTL_MS = 10 * 60 * 1000;
// Competition id and team ids of a season: they hardly ever change.
const CONTEXT_TTL_MS = 6 * 60 * 60 * 1000;

function toTeam(team) {
  const known = findTeamByRef(COMPETITION, team?.club_external_id);
  if (known) {
    return { id: known.id, name: known.name, shortName: known.shortName };
  }
  return {
    id: `${COMPETITION}:${team?.club_external_id ?? team?.external_id}`,
    name: team?.team_name ?? '?',
    shortName: team?.team_name ?? '?',
  };
}

function toStatus(value) {
  const status = String(value ?? '').toUpperCase();
  if (/POSTPON|CANCEL|DELAY|REPORT/.test(status)) {
    return 'postponed';
  }
  if (/COMPLETE|FINISH|FINAL|ENDED/.test(status)) {
    return 'finished';
  }
  if (/LIVE|PROGRESS|STARTED|RUNNING|HALF|PERIOD/.test(status)) {
    return 'live';
  }
  return 'scheduled';
}

function toScore(team) {
  const number = Number(team?.score_string);
  return team?.score_string === undefined || !Number.isFinite(number) ? null : number;
}

function toBroadcaster(broadcasts) {
  const names = (Array.isArray(broadcasts) ? broadcasts : [])
    .map((b) => b?.broadcast_provider?.broadcast_provider)
    .filter(Boolean);
  return names.length > 0 ? [...new Set(names)].join(' / ') : null;
}

/**
 * Normalize a `match/v3/getCalendar` response: days, each with its games.
 * The first team of a game is the home team.
 * @param {{ data?: Array<{ data?: object[] }> }} json
 * @returns {import('../schedule.js').Match[]}
 */
export function parseLnb(json) {
  const days = Array.isArray(json?.data) ? json.data : [];
  const matches = [];
  for (const game of days.flatMap((day) => (Array.isArray(day?.data) ? day.data : []))) {
    const [home, away] = Array.isArray(game.teams) ? game.teams : [];
    const start = new Date(game.match_time_utc);
    if (!home || !away || Number.isNaN(start.getTime())) {
      continue;
    }
    const status = toStatus(game.match_status);
    const hasScore = status === 'finished' || status === 'live';
    matches.push({
      id: `${COMPETITION}:${game.external_id ?? game.match_id}`,
      sport: 'basketball',
      competition: COMPETITION,
      homeTeam: toTeam(home),
      awayTeam: toTeam(away),
      start: start.toISOString(),
      status,
      score: hasScore ? { home: toScore(home), away: toScore(away) } : { home: null, away: null },
      broadcaster: toBroadcaster(game.broadcast),
    });
  }
  return matches;
}

// --- API session -------------------------------------------------------------

let token = null; // { value, expiresAt }
const contexts = new Map(); // season -> { expiresAt, promise }

async function getToken(now = Date.now()) {
  if (token && now < token.expiresAt) {
    return token.value;
  }
  const json = await fetchJson(TOKEN_URL);
  if (!json?.token) {
    throw new Error('LNB: no token');
  }
  token = { value: json.token, expiresAt: now + TOKEN_TTL_MS };
  return token.value;
}

async function api(path, { body } = {}) {
  const headers = {
    Authorization: `Bearer ${await getToken()}`,
    device_type: 'web',
    language_code: 'fr',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return fetchJson(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function loadContext(season) {
  const main = await api(`competition/getMainCompetition?year=${season}`);
  const competition = (main?.data ?? []).find((c) => c.competition_abbrev === COMPETITION_ABBREV);
  if (!competition) {
    throw new Error(`LNB: no Betclic Élite competition for ${season}`);
  }
  const teams = await api(
    `competition/getCompetitionTeams?competition_external_id=${competition.external_id}`,
  );
  const teamIds = new Map(
    (teams?.data ?? []).map((t) => [String(t.club_external_id), t.external_id]),
  );
  return { competitionId: competition.external_id, teamIds };
}

// Shared by the followed clubs; a failure is not kept.
function getContext(season, now = Date.now()) {
  const cached = contexts.get(season);
  if (cached && now < cached.expiresAt) {
    return cached.promise;
  }
  const promise = loadContext(season);
  contexts.set(season, { expiresAt: now + CONTEXT_TTL_MS, promise });
  promise.catch(() => contexts.delete(season));
  return promise;
}

/** Forget the token and the season contexts (tests). */
export function resetLnbSession() {
  token = null;
  contexts.clear();
}

export const lnb = {
  competition: COMPETITION,
  // One request per followed club.
  perTeam: true,

  /**
   * @param {{ season: number, team: string }} options starting year of the
   *   season, LNB club id (`club_external_id`)
   */
  async fetchSchedule({ season, team }) {
    const { teamIds } = await getContext(season);
    const teamId = teamIds.get(String(team));
    if (teamId === undefined) {
      // Not in Betclic Élite this season (relegated, or not promoted yet).
      return [];
    }
    const json = await api('match/v3/getCalendar', {
      body: {
        year: season,
        competition_abbrev: COMPETITION_ABBREV,
        division_external_id: 0,
        phase_id: 0,
        tournament_number: 0,
        round_number: 0,
        team_external_id: teamId,
      },
    });
    return parseLnb(json);
  },
};

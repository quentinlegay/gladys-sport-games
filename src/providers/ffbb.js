// -----------------------------------------------------------------------------
// Provider FFBB (Nationale masculine 1): API of the official FFBB app
// (api.ffbb.app, a Directus server). No account, but undocumented: it is the
// API the app itself calls, with the anonymous key the app reads from
// https://api.ffbb.app/items/configuration (`key_dh`).
//
// The LNB API does not cover the NM1: the FFBB runs it. Times are published as
// Paris wall-clock times (no offset), results are entered after the game and
// there is no live status nor broadcaster.
//
// Flow, for a season:
//   1. GET items/configuration                      -> anonymous key
//   2. GET items/ffbbserver_competitions (NM1, 26-27) -> competition ids
//   3. GET items/ffbbserver_rencontres  (those ids)   -> every game (~310)
// Steps 1-2 are kept for a few hours. One download serves every followed club.
// -----------------------------------------------------------------------------

import { findTeamByRef } from '../teams.js';
import { parisToDate } from '../time.js';
import { fetchJson } from './http.js';

export const COMPETITION = 'nationale_1';

export const API_URL = 'https://api.ffbb.app/';
export const CONFIG_URL = `${API_URL}items/configuration`;
const COMPETITION_CODE = 'NM1';

// Key and competition ids of a season: they hardly ever change.
const CONTEXT_TTL_MS = 6 * 60 * 60 * 1000;

const GAME_FIELDS = [
  'id',
  'date_rencontre',
  'nomEquipe1',
  'nomEquipe2',
  'idOrganismeEquipe1',
  'idOrganismeEquipe2',
  'resultatEquipe1',
  'resultatEquipe2',
  'joue',
  'remise',
];

/** FFBB season code: `26-27` for 2026. */
export const seasonCode = (season) =>
  `${String(season % 100).padStart(2, '0')}-${String((season + 1) % 100).padStart(2, '0')}`;

// `LYONSO BASKET - 1` -> `LYONSO BASKET`: the suffix numbers the teams of a club.
const cleanName = (name) => String(name ?? '?').replace(/\s+-\s+\d+$/, '');

function toTeam(organisme, name) {
  const known = findTeamByRef(COMPETITION, organisme);
  if (known) {
    return { id: known.id, name: known.name, shortName: known.shortName };
  }
  return { id: `${COMPETITION}:${organisme}`, name: cleanName(name), shortName: cleanName(name) };
}

function toScore(value) {
  const number = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(number)
    ? null
    : number;
}

/**
 * Normalize an `items/ffbbserver_rencontres` response. Team 1 is at home.
 * @param {{ data?: object[] }} json
 * @returns {import('../schedule.js').Match[]}
 */
export function parseFfbb(json) {
  const games = Array.isArray(json?.data) ? json.data : [];
  const matches = [];
  for (const game of games) {
    const start = parisToDate(game.date_rencontre);
    if (!start || !game.idOrganismeEquipe1 || !game.idOrganismeEquipe2) {
      continue;
    }
    let status = 'scheduled';
    if (game.remise === true) {
      status = 'postponed';
    } else if (game.joue === true) {
      status = 'finished';
    }
    matches.push({
      id: `${COMPETITION}:${game.id}`,
      sport: 'basketball',
      competition: COMPETITION,
      homeTeam: toTeam(game.idOrganismeEquipe1, game.nomEquipe1),
      awayTeam: toTeam(game.idOrganismeEquipe2, game.nomEquipe2),
      start: start.toISOString(),
      status,
      score:
        status === 'finished'
          ? { home: toScore(game.resultatEquipe1), away: toScore(game.resultatEquipe2) }
          : { home: null, away: null },
      broadcaster: null,
    });
  }
  return matches;
}

// --- API session -------------------------------------------------------------

const contexts = new Map(); // season -> { expiresAt, promise }

const items = (path, key) =>
  fetchJson(`${API_URL}items/${path}`, { headers: { Authorization: `Bearer ${key}` } });

async function loadContext(season) {
  const config = await fetchJson(CONFIG_URL);
  const key = config?.data?.key_dh;
  if (!key) {
    throw new Error('FFBB: no key');
  }
  const query = new URLSearchParams({
    'filter[code][_eq]': COMPETITION_CODE,
    'filter[saison][code][_eq]': seasonCode(season),
    fields: 'id',
  });
  const competitions = await items(`ffbbserver_competitions?${query}`, key);
  const ids = (competitions?.data ?? []).map((c) => c.id).filter(Boolean);
  if (ids.length === 0) {
    throw new Error(`FFBB: no ${COMPETITION_CODE} competition for ${seasonCode(season)}`);
  }
  return { key, ids };
}

// A failure is not kept.
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

/** Forget the key and the season contexts (tests). */
export function resetFfbbSession() {
  contexts.clear();
}

export const ffbb = {
  competition: COMPETITION,

  /** @param {{ season: number }} options starting year of the season */
  async fetchSchedule({ season }) {
    const { key, ids } = await getContext(season);
    const query = new URLSearchParams({
      'filter[competitionId][_in]': ids.join(','),
      fields: GAME_FIELDS.join(','),
      limit: '-1',
    });
    try {
      return parseFfbb(await items(`ffbbserver_rencontres?${query}`, key));
    } catch (err) {
      // The key may have been renewed: read it again on the next try.
      contexts.delete(season);
      throw err;
    }
  },
};

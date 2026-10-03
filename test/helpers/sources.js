// -----------------------------------------------------------------------------
// Every source answering with the fixtures (real data, trimmed):
//   - EuroLeague 2026-27: 3 games of round 1 (played), then Paris and ASVEL;
//   - NBA: 3 games of the Celtics (regular season 2026-27);
//   - LNB: the first 5 games of ASVEL (round 1 played, Cholet 85 - 97 ASVEL);
//   - FFBB: the first 6 games of Vitré in Nationale 1, and a forfeit.
// Pass `overrides` to replace one route (an Error makes it fail).
// -----------------------------------------------------------------------------

import { mockFetch } from './mockFetch.js';

// Saturday 3 October 2026, 14:00 in Paris.
export const NOW = Date.parse('2026-10-03T12:00:00Z');

export function mockSources(overrides = {}) {
  return mockFetch({
    'api-live.euroleague.net': 'euroleague-games.json',
    'seasontype=1': { events: [] },
    'seasontype=2': 'nba-schedule.json',
    'seasontype=3': { events: [] },
    'lnb.fr/api/token': { token: 'token' },
    getMainCompetition: { data: [{ external_id: 317, competition_abbrev: 'PROA' }] },
    getCompetitionTeams: {
      data: [
        { external_id: 1866, club_external_id: 91 },
        { external_id: 1870, club_external_id: 58 },
      ],
    },
    'match/v3/getCalendar': 'lnb-calendar.json',
    'items/configuration': { data: { key_dh: 'key' } },
    'items/ffbbserver_competitions': { data: [{ id: '200000002897178' }] },
    'items/ffbbserver_rencontres': 'ffbb-rencontres.json',
    ...overrides,
  });
}

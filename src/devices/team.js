// -----------------------------------------------------------------------------
// Device type: TEAM
// One device per followed team, with 3 read-only text sensors:
//   - "Prochain match"  : `ASVEL – Paris (Betclic Élite)`;
//   - "Coup d'envoi"    : start of that game, Paris time (`sam. 4 oct. 20:00`);
//   - "Dernier résultat": `ASVEL 85 – 78 Paris`.
// The sensors ignore the watching window: they always show the real next game.
// Values are refreshed by polling, every `poll_frequency` milliseconds.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { formatMatch, formatResult, formatStart, lastResult, nextMatch } from '../schedule.js';

const DEVICE_TYPE = 'team';

// Feature keys, stored by Gladys: never rename them.
export const FEATURE = {
  NEXT_MATCH: 'next_match',
  NEXT_MATCH_START: 'next_match_start',
  LAST_RESULT: 'last_result',
};

const FEATURE_NAMES = {
  [FEATURE.NEXT_MATCH]: 'Prochain match',
  [FEATURE.NEXT_MATCH_START]: "Coup d'envoi",
  [FEATURE.LAST_RESULT]: 'Dernier résultat',
};

export const NO_MATCH = 'Aucun match prévu';
export const NO_RESULT = 'Aucun résultat';

function textFeature(ids, key) {
  return {
    name: FEATURE_NAMES[key],
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    read_only: true, // sensor: no action possible
    has_feedback: false,
    keep_history: false,
  };
}

export const teamDevice = {
  key: DEVICE_TYPE,

  // The team id of src/teams.js is the unique and stable platform id.
  deviceExternalId(gladys, team) {
    return gladys.externalIds(DEVICE_TYPE, team.id).device;
  },

  buildDevice(gladys, team, config) {
    const ids = gladys.externalIds(DEVICE_TYPE, team.id);
    return {
      name: `Matchs ${team.name}`,
      external_id: ids.device,
      // Gladys will call onPoll at this interval (in MILLISECONDS, see
      // POLL_FREQUENCY in src/config.js).
      poll_frequency: config.poll_frequency,
      features: [
        textFeature(ids, FEATURE.NEXT_MATCH),
        textFeature(ids, FEATURE.NEXT_MATCH_START),
        textFeature(ids, FEATURE.LAST_RESULT),
      ],
    };
  },

  /**
   * Build the 3 text states of a team, from the games.
   * @param {object} gladys
   * @param {{ id: string }} team
   * @param {import('../schedule.js').Match[]} allMatches
   * @param {number} [now]
   * @param {Record<string, string[]>} [follows] when given, only the games of
   *   the competitions the team is followed in
   */
  buildStates(gladys, team, allMatches, now = Date.now(), follows) {
    const ids = gladys.externalIds(DEVICE_TYPE, team.id);
    const competitions = follows?.[team.id];
    const matches = competitions
      ? allMatches.filter((m) => competitions.includes(m.competition))
      : allMatches;
    const next = nextMatch(matches, team.id, now);
    const last = lastResult(matches, team.id);
    return [
      {
        device_feature_external_id: ids.feature(FEATURE.NEXT_MATCH),
        text: next ? formatMatch(next) : NO_MATCH,
      },
      {
        device_feature_external_id: ids.feature(FEATURE.NEXT_MATCH_START),
        text: next ? formatStart(next) : NO_MATCH,
      },
      {
        device_feature_external_id: ids.feature(FEATURE.LAST_RESULT),
        text: last ? formatResult(last) : NO_RESULT,
      },
    ];
  },
};

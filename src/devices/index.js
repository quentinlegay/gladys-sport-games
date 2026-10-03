// -----------------------------------------------------------------------------
// Device registry.
//
// The devices are the teams followed in the configuration (`teams` field):
// one `team` device per team.
// -----------------------------------------------------------------------------

import { getMatches, competitionName, formatMatch, nextMatch } from '../schedule.js';
import { findTeam, TEAMS } from '../teams.js';
import { teamDevice } from './team.js';

/**
 * Teams followed in the configuration, in the configuration order.
 */
export function selectedTeams(config) {
  return config.teams.map(findTeam).filter(Boolean);
}

/**
 * Build the discovery payload for Gladys (one device per followed team).
 */
export function buildDiscoveredDevices(gladys, config) {
  return selectedTeams(config).map((team) => teamDevice.buildDevice(gladys, team, config));
}

/**
 * Find the team of a device, from its external_id (used to route onPoll).
 * Search in ALL the teams: a device created before the user stopped following
 * its team is still known.
 */
export function findTeamByDevice(gladys, device) {
  return TEAMS.find((team) => teamDevice.deviceExternalId(gladys, team) === device.external_id);
}

/**
 * Publish only the states that changed: the host API accepts 300 states per
 * minute per integration, and every device is polled every minute.
 */
export function createStatePublisher(gladys) {
  const lastValues = new Map();
  return {
    async publish(states) {
      const changed = states.filter((s) => lastValues.get(s.device_feature_external_id) !== s.text);
      // 100 states per request at most.
      for (let i = 0; i < changed.length; i += 99) {
        await gladys.publishStates(changed.slice(i, i + 99));
      }
      for (const s of changed) {
        lastValues.set(s.device_feature_external_id, s.text);
      }
      return changed.length;
    },
    // After a reconnection, Gladys may have restarted: publish everything again.
    reset() {
      lastValues.clear();
    },
  };
}

/**
 * Handlers of the manifest actions (see the `actions` field of
 * gladys-assistant-integration.json), keyed by action `key`.
 */
export const ACTIONS = {
  // Download every calendar now and report what each competition returned.
  async test_sources(_gladys, { config }) {
    const lines = { en: [], fr: [] };
    for (const competition of config.competitions) {
      const { matches, errors } = await getMatches({
        teams: config.teams,
        competitions: [competition],
        force: true,
      });
      const name = competitionName(competition);
      if (errors.length > 0) {
        const reason = errors[0].error?.message ?? String(errors[0].error);
        lines.en.push(`${name}: error (${reason})`);
        lines.fr.push(`${name} : erreur (${reason})`);
      } else {
        lines.en.push(`${name}: ${matches.length} games`);
        lines.fr.push(`${name} : ${matches.length} matchs`);
      }
    }
    const [team] = selectedTeams(config);
    if (team) {
      const { matches } = await getMatches({ teams: [team.id], competitions: config.competitions });
      const next = formatMatch(nextMatch(matches, team.id)) || '-';
      lines.en.push(`Next game of ${team.name}: ${next}`);
      lines.fr.push(`Prochain match de ${team.name} : ${next}`);
    }
    if (lines.en.length === 0) {
      return { en: 'No team followed.', fr: 'Aucune équipe suivie.' };
    }
    return { en: lines.en.join(' · '), fr: lines.fr.join(' · ') };
  },
};

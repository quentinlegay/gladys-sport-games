// -----------------------------------------------------------------------------
// Scene triggers and actions (manifest `scene_triggers` / `scene_actions`).
//
// - Trigger `match_starting`: fired 0, 15, 30 or 60 minutes before the start of
//   a game of a followed team, in the watching window. The scene author
//   filters by team, competition and delay (`minutes_before`, required).
//   The `team` field lists the integration's devices (`source: "devices"`),
//   so the event `team` value is the device external_id of the team.
//   A game between two followed teams fires one event per team, so that a
//   scene filtered on either team sees it.
// - Action `get_next_match`: returns the next game and the last result of a
//   team to the following actions of the scene.
//
// Keys (trigger, action, fields, variables, outputs) are stored by the scenes:
// never rename them once published.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  competitionName,
  formatMatch,
  formatResult,
  followsFor,
  formatStart,
  getFollowedMatches,
  getMatches,
  inWatchWindow,
  lastResult,
  nextMatch,
  opponentOf,
  startingBetween,
} from './schedule.js';
import { teamOfField } from './devices/index.js';
import { teamDevice } from './devices/team.js';
import { findTeam } from './teams.js';
import { formatTime } from './time.js';

const logger = createLogger({ name: 'scenes' });

export const TRIGGER_MATCH_STARTING = 'match_starting';
export const ACTION_GET_NEXT_MATCH = 'get_next_match';

// Values of the `minutes_before` field (strings: a select stores strings).
export const MINUTES_BEFORE = ['0', '15', '30', '60'];

// How often the watcher looks for games about to start.
export const WATCH_INTERVAL_MS = 60 * 1000;
// After a pause (disconnection, slow download), do not fire events whose time
// is more than this long ago: they would come too late.
export const MAX_CATCH_UP_MS = 5 * 60 * 1000;

// Event strings are capped at 1000 characters by the core.
const MAX_EVENT_STRING = 1000;
const cap = (text) => String(text ?? '').slice(0, MAX_EVENT_STRING);

/**
 * Flat data of a `match_starting` event. Keys match the manifest trigger
 * `fields` (filters) and `variables` (exposed to the scene).
 * @param {import('./schedule.js').Match} match
 * @param {string} team device external_id of the followed team
 * @param {string} minutesBefore one of MINUTES_BEFORE
 */
export function buildStartingEvent(match, team, minutesBefore) {
  return {
    team,
    competition: match.competition,
    minutes_before: minutesBefore,
    home_team: cap(match.homeTeam.shortName),
    away_team: cap(match.awayTeam.shortName),
    start: formatTime(new Date(match.start)),
    broadcaster: cap(match.broadcaster),
  };
}

/**
 * Events due in ]from, to] for some games.
 * @param {import('./schedule.js').Match[]} matches already filtered (window)
 * @param {Record<string, string[]>} follows team id -> followed competitions
 * @param {(teamId: string) => string} teamValue event `team` value of a team
 */
export function findStartingEvents(matches, follows, from, to, teamValue) {
  const events = [];
  for (const minutesBefore of MINUTES_BEFORE) {
    for (const match of startingBetween(matches, from, to, Number(minutesBefore))) {
      for (const team of [match.homeTeam, match.awayTeam]) {
        if (follows[team.id]?.includes(match.competition)) {
          events.push(buildStartingEvent(match, teamValue(team.id), minutesBefore));
        }
      }
    }
  }
  return events;
}

/** Device external_id of a team: the value of the `team` scene fields. */
export const teamDeviceId = (gladys, teamId) =>
  teamDevice.deviceExternalId(gladys, findTeam(teamId));

/**
 * Watch the schedule and fire `match_starting`, once per game, team and delay.
 * @param {object} gladys SDK instance
 * @param {{ getConfig: () => object, onKickoff?: () => void }} options
 *   `onKickoff` is called after a check that saw a followed game start (used
 *   to refresh the widget)
 */
export function createMatchWatcher(gladys, { getConfig, onKickoff }) {
  let timer = null;
  let lastCheck = null;

  async function check(now = new Date()) {
    if (lastCheck === null) {
      // First check: start from now, never replay the past.
      lastCheck = now;
      return [];
    }
    const from = new Date(Math.max(lastCheck.getTime(), now.getTime() - MAX_CATCH_UP_MS));
    const config = getConfig();
    const { matches } = await getFollowedMatches(config, { now: now.getTime() });
    lastCheck = now;

    const events = findStartingEvents(
      inWatchWindow(matches, config),
      config.follows,
      from,
      now,
      (id) => teamDeviceId(gladys, id),
    );
    for (const event of events) {
      logger.debug(
        `match_starting (${event.minutes_before} min) -> ${event.home_team} – ${event.away_team}`,
      );
      try {
        await gladys.publishSceneEvent(TRIGGER_MATCH_STARTING, event);
      } catch (err) {
        // One refused event must not hide the others.
        logger.error(`match_starting refused for ${event.home_team} – ${event.away_team}`, err);
      }
    }
    // Any kick-off of a followed team changes the widget (window or not).
    if (startingBetween(matches, from, now).length > 0) {
      onKickoff?.();
    }
    return events;
  }

  return {
    check,
    start() {
      this.stop();
      lastCheck = null;
      check().catch(() => {});
      timer = setInterval(() => {
        check().catch((err) => logger.error('Match watcher check failed', err));
      }, WATCH_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

/**
 * Handler of the `get_next_match` scene action. The `team` field lists the
 * integration's devices: the team of the chosen device, in the competitions
 * it is followed in (all of them when it is not followed any more).
 * @param {object} gladys SDK instance
 * @param {{ team: string }} fields resolved by the core
 * @param {object} config normalized configuration
 * @returns {Promise<object>} the outputs declared in the manifest
 */
export async function getNextMatchAction(gladys, fields, config, now = Date.now()) {
  const team = teamOfField(gladys, fields?.team);
  if (!team) {
    throw new Error(`Unknown team "${fields?.team}"`);
  }
  const { matches, errors } = await getMatches({ follows: followsFor([team.id], config), now });
  if (matches.length === 0 && errors.length > 0) {
    throw errors[0].error;
  }
  const next = nextMatch(matches, team.id, now);
  const last = lastResult(matches, team.id);
  return {
    next_match: formatMatch(next),
    next_start: formatStart(next),
    opponent: next ? opponentOf(next, team.id).shortName : '',
    is_home: next ? next.homeTeam.id === team.id : false,
    competition: next ? competitionName(next.competition) : '',
    broadcaster: next?.broadcaster ?? '',
    last_result: formatResult(last),
  };
}

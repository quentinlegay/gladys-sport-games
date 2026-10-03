// -----------------------------------------------------------------------------
// Entry point of the "Sport Games" Gladys external integration.
//
// Role of this file: wire the SDK to the device catalog (src/devices/). It holds
// NO schedule logic (see src/schedule.js and src/providers/). It only:
//   1. instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. registers the event handlers BEFORE connect();
//   3. connects and publishes the discovered devices.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import {
  ACTIONS,
  buildDiscoveredDevices,
  createStatePublisher,
  findTeamByDevice,
  selectedTeams,
} from './src/devices/index.js';
import { teamDevice } from './src/devices/team.js';
import { competitionName, getFollowedMatches } from './src/schedule.js';
import { ACTION_GET_NEXT_MATCH, createMatchWatcher, getNextMatchAction } from './src/scenes.js';
import { getUpcomingMatchesWidget, WIDGET_UPCOMING_MATCHES } from './src/widget.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();

// Last connection status sent to Gladys (avoid sending the same one again).
let lastStatus = null;

// Publishes only the sensor values that changed.
const states = createStatePublisher(gladys);

// Fires the `match_starting` scene trigger, and asks the dashboard to re-pull
// the widget at every kick-off.
const watcher = createMatchWatcher(gladys, {
  getConfig: () => config,
  onKickoff: () => {
    try {
      gladys.requestWidgetRefresh(WIDGET_UPCOMING_MATCHES);
    } catch (err) {
      logger.debug('Widget refresh request failed', err);
    }
  },
});

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing discovered devices');
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
});

// --- Polling: Gladys asks to refresh a device --------------------------------
// Called every `poll_frequency` milliseconds for each created team device. The
// calendars are cached: this only downloads them when they are old.
gladys.onPoll(async (device) => {
  const team = findTeamByDevice(gladys, device);
  if (!team) {
    logger.debug(`onPoll ignored (unknown device) for ${device.external_id}`);
    return;
  }
  const { matches, errors } = await getFollowedMatches({
    ...config,
    teams: [...new Set([...config.teams, team.id])],
  });
  await states.publish(teamDevice.buildStates(gladys, team, matches));
  await reportStatus(errors);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
for (const [actionKey, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(actionKey, (fields) => handler(gladys, { fields, config }));
}

// --- Dashboard widget: Gladys pulls the content to display -------------------
gladys.onWidgetGet(WIDGET_UPCOMING_MATCHES, ({ settings, language }) =>
  getUpcomingMatchesWidget({ settings, language }, config),
);

// --- Scene action: a scene asks for the next game of a team -----------------
gladys.onSceneAction(ACTION_GET_NEXT_MATCH, (fields) => getNextMatchAction(fields));

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  // Re-publish the devices: the team list depends on it.
  // publishDiscoveredDevices is idempotent (upsert by external_id).
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
  await refreshCreatedDevices();
  gladys.requestWidgetRefresh(WIDGET_UPCOMING_MATCHES);
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    // 1) Fetch the config filled in by the user.
    config = normalizeConfig(await gladys.getConfig());

    // 2) (Re)publish all devices as soon as we are connected.
    await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));

    // 3) Watch the kick-offs (scene trigger). Started before the downloads
    // below, so a download failure does not stop it: it retries every minute.
    watcher.start();

    // 4) Fill the sensors right away, without waiting for the first poll.
    // Gladys may have restarted: publish every value again.
    states.reset();
    lastStatus = null;
    await refreshCreatedDevices();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    lastStatus = null;
    await reportStatus([{ competition: 'all', error: err }]);
  }
});

gladys.on('disconnected', () => {
  watcher.stop();
});

// Publish the states of every team device already created in Gladys.
async function refreshCreatedDevices() {
  const created = new Set(gladys.devices.map((device) => device.external_id));
  const teams = selectedTeams(config).filter((team) =>
    created.has(teamDevice.deviceExternalId(gladys, team)),
  );
  const { matches, errors } = await getFollowedMatches(config);
  await states.publish(teams.flatMap((team) => teamDevice.buildStates(gladys, team, matches)));
  await reportStatus(errors);
}

// Connected when every source answered at least once; otherwise name the
// competitions whose calendar is missing (their sensors stay empty).
async function reportStatus(errors) {
  const failing = [...new Set(errors.map((e) => e.competition))];
  const connected = failing.length === 0;
  const key = connected ? 'ok' : failing.join(',');
  if (lastStatus === key) {
    return;
  }
  lastStatus = key;
  const names = failing.map((c) => (c === 'all' ? '' : competitionName(c))).filter(Boolean);
  await gladys
    .setConnectionStatus(
      connected,
      connected
        ? undefined
        : {
            en: `Cannot download the schedule${names.length ? ` (${names.join(', ')})` : ''}, check the integration logs.`,
            fr: `Impossible de télécharger le calendrier${names.length ? ` (${names.join(', ')})` : ''}, consultez les logs.`,
          },
    )
    .catch((err) => logger.error('setConnectionStatus failed', err));
}

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  watcher.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Sport Games integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});

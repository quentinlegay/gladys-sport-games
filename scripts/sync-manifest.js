// -----------------------------------------------------------------------------
// Fill the option lists of the manifest from the code, so the 64 teams are
// never copied by hand:
//   - `teams` / `team`               <- src/teams.js (TEAMS)
//   - `competitions` / `competition` <- src/teams.js (COMPETITIONS)
//   - `watch_start` / `watch_end`    <- src/config.js (CLOCK_OPTIONS)
// in the config_schema, the widget settings, the trigger and action fields.
//
// Usage: npm run sync-manifest (test/manifest.test.js fails when it is due).
// -----------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises';
import { CLOCK_OPTIONS } from '../src/config.js';
import { COMPETITIONS, TEAMS } from '../src/teams.js';

const MANIFEST = new URL('../gladys-assistant-integration.json', import.meta.url);

const label = (text) => ({ en: text, fr: text });

export function teamOptions() {
  return TEAMS.map((team) => {
    const competitions = COMPETITIONS.filter((c) => c.id in team.refs).map((c) => c.name);
    return { value: team.id, label: label(`${team.name} (${competitions.join(', ')})`) };
  });
}

export function competitionOptions() {
  return COMPETITIONS.map((c) => ({ value: c.id, label: label(c.name) }));
}

export function clockOptions() {
  return CLOCK_OPTIONS.map((value) => ({ value, label: label(value) }));
}

const OPTIONS_BY_KEY = {
  teams: teamOptions,
  team: teamOptions,
  competitions: competitionOptions,
  competition: competitionOptions,
  watch_start: clockOptions,
  watch_end: clockOptions,
};

/** Every field list of a manifest that may hold one of the keys above. */
export function fieldLists(manifest) {
  return [
    manifest.config_schema ?? [],
    ...(manifest.widgets ?? []).map((w) => w.settings ?? []),
    ...(manifest.scene_triggers ?? []).map((t) => t.fields ?? []),
    ...(manifest.scene_actions ?? []).map((a) => a.fields ?? []),
  ];
}

export function syncManifest(manifest) {
  for (const field of fieldLists(manifest).flat()) {
    const build = OPTIONS_BY_KEY[field.key];
    if (build && (field.type === 'select' || field.type === 'multi_select')) {
      field.options = build();
    }
  }
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  await writeFile(MANIFEST, `${JSON.stringify(syncManifest(manifest), null, 2)}\n`);
  console.log('gladys-assistant-integration.json: option lists updated');
}

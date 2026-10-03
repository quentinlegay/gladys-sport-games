// -----------------------------------------------------------------------------
// Dashboard widget `upcoming_matches` (manifest `widgets`).
//
// A `card-list` of the next games of the followed teams (8 at most), in the
// watching window of the configuration. Tapping a row opens the core's detail
// panel (competition, date, broadcaster).
//
// The content lives until the next kick-off (`ttl_seconds`), and the scene
// watcher calls `requestWidgetRefresh` at every kick-off.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  competitionName,
  formatStart,
  formatTeams,
  getMatches,
  inWatchWindow,
  isLive,
  upcomingMatches,
} from './schedule.js';
import { findTeam } from './teams.js';
import { formatShort } from './time.js';

export const WIDGET_UPCOMING_MATCHES = 'upcoming_matches';

// `list` display of a card-list: 1 to 8 items.
export const MAX_ITEMS = 8;
const MAX_TITLE = 60;
const MAX_SUBTITLE = 60;

// Content lifetime (the core pulls again when it expires).
const TTL_MIN = 60;
const TTL_MAX = 3600;

const TEXTS = {
  noTeam: {
    en: 'No team followed: pick teams in the widget or integration settings.',
    fr: "Aucune équipe suivie : cochez des équipes dans le widget ou la configuration de l'intégration.",
  },
  noMatch: {
    en: 'No upcoming game in the watching window.',
    fr: 'Aucun match à venir dans la plage de visionnage.',
  },
  live: { en: 'Live', fr: 'En direct' },
  parisTime: { en: 'Paris time', fr: 'heure de Paris' },
  broadcaster: { en: 'TV', fr: 'Diffusion' },
};

const lang = (language) => (language === 'en' ? 'en' : 'fr');
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Teams shown by a widget instance: its own `teams` setting, or the teams of
 * the integration configuration when the setting is empty.
 */
export function widgetTeams(settings, config) {
  const own = Array.isArray(settings?.teams) ? settings.teams : [];
  const ids = own.length > 0 ? own : config.teams;
  return [...new Set(ids)].filter((id) => findTeam(id));
}

function buildItem(match, language, now) {
  const competition = competitionName(match.competition);
  const live = isLive(match, now);
  const item = {
    title: truncate(formatTeams(match), MAX_TITLE),
    subtitle: truncate(
      match.broadcaster ? `${competition} · ${match.broadcaster}` : competition,
      MAX_SUBTITLE,
    ),
    badge: live
      ? { text: TEXTS.live[language], color: WIDGET_COLORS.DANGER }
      : {
          text: formatShort(new Date(match.start), new Date(now), language),
          color: WIDGET_COLORS.INFO,
        },
  };
  const details = [
    `${match.homeTeam.name} – ${match.awayTeam.name}`,
    competition,
    `${formatStart(match)} (${TEXTS.parisTime[language]})`,
  ];
  if (match.broadcaster) {
    details.push(`${TEXTS.broadcaster[language]} : ${match.broadcaster}`);
  }
  item.description = details.join('\n');
  return item;
}

/**
 * Build the widget content.
 * @param {import('./schedule.js').Match[]} matches games of the shown teams
 * @param {{ language?: string, config: object, teams: string[], now?: number }} options
 */
export function buildWidgetContent(matches, { language, config, teams, now = Date.now() }) {
  const l = lang(language);
  if (teams.length === 0) {
    return { ttl_seconds: TTL_MAX, components: [{ type: 'text', text: TEXTS.noTeam[l] }] };
  }
  const shown = inWatchWindow(upcomingMatches(matches, now), config).slice(0, MAX_ITEMS);
  if (shown.length === 0) {
    return { ttl_seconds: TTL_MAX, components: [{ type: 'text', text: TEXTS.noMatch[l] }] };
  }

  // Pull again at the next kick-off (a live game keeps its row until the
  // next pull after its live window).
  const nextStart = shown
    .map((m) => (Date.parse(m.start) - now) / 1000)
    .find((seconds) => seconds > 0);
  const ttl = nextStart === undefined ? 15 * 60 : Math.ceil(nextStart);

  return {
    ttl_seconds: Math.min(TTL_MAX, Math.max(TTL_MIN, ttl)),
    components: [
      {
        type: 'card-list',
        display: 'list',
        items: shown.map((match) => buildItem(match, l, now)),
      },
    ],
  };
}

/**
 * Handler of `onWidgetGet('upcoming_matches')`.
 */
export async function getUpcomingMatchesWidget({ settings, language }, config) {
  const teams = widgetTeams(settings, config);
  const { matches } = await getMatches({ teams, competitions: config.competitions });
  return buildWidgetContent(matches, { language, config, teams });
}

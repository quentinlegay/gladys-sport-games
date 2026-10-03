// -----------------------------------------------------------------------------
// Time helpers. Every computation and every display uses Europe/Paris, whatever
// the time zone of the container (Docker images usually run in UTC).
// -----------------------------------------------------------------------------

export const TIME_ZONE = 'Europe/Paris';

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const WEEKDAY_FORMATS = {
  fr: new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'short' }),
  en: new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short' }),
};
const TOMORROW = { fr: 'demain', en: 'tomorrow' };

/**
 * Calendar parts of a date in Paris.
 * @param {Date} date
 */
export function zonedParts(date) {
  const parts = PARTS_FORMAT.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/**
 * Date of a Paris wall-clock time, e.g. `2026-10-09T20:00:00` (no offset), as
 * some sources publish it. Null when the text is not such a time.
 * @param {string} local `YYYY-MM-DDTHH:MM[:SS]`
 */
export function parisToDate(local) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local ?? ''));
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  // Shift by the Paris offset; a second pass settles the days the offset
  // changes (last Sundays of March and October).
  let utc = wanted;
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(utc));
    utc += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(utc);
}

const pad = (n) => String(n).padStart(2, '0');

/** `20:45`, Paris time. */
export function formatTime(date) {
  const { hour, minute } = zonedParts(date);
  return `${pad(hour)}:${pad(minute)}`;
}

/** `sam. 4 oct. 20:45`, Paris time. */
export function formatDateTime(date) {
  return `${DAY_FORMAT.format(date)} ${formatTime(date)}`;
}

/** Same Paris calendar day. */
export function isSameDay(a, b) {
  const pa = zonedParts(a);
  const pb = zonedParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/**
 * Short label for a badge (16 characters max): `20:45` today, `demain 20:45`,
 * `sam. 20:45` within the week, `4/10 20:45` beyond.
 * @param {Date} date
 * @param {Date} [now]
 * @param {'fr'|'en'} [language]
 */
export function formatShort(date, now = new Date(), language = 'fr') {
  const lang = language === 'en' ? 'en' : 'fr';
  const time = formatTime(date);
  if (isSameDay(date, now)) {
    return time;
  }
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  if (isSameDay(date, tomorrow)) {
    return `${TOMORROW[lang]} ${time}`;
  }
  if (date - now < 6 * 24 * 3600 * 1000) {
    return `${WEEKDAY_FORMATS[lang].format(date)} ${time}`;
  }
  const { day, month } = zonedParts(date);
  return `${day}/${month} ${time}`;
}

/**
 * Parse `HH:MM` into minutes since midnight, or null.
 * @param {unknown} value
 */
export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Minutes since midnight of a date, Paris time. */
export function minutesOfDay(date) {
  const { hour, minute } = zonedParts(date);
  return hour * 60 + minute;
}

/**
 * Whether a date falls in a daily window `[start, end]` (Paris time). A window
 * whose end is before its start crosses midnight (e.g. 18:00 → 01:00).
 * @param {Date} date
 * @param {string} start `HH:MM`
 * @param {string} end `HH:MM`
 */
export function isInWindow(date, start, end) {
  const from = parseClock(start);
  const to = parseClock(end);
  if (from === null || to === null) {
    return true;
  }
  const m = minutesOfDay(date);
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
}

/**
 * Starting year of the basketball season that `date` belongs to (2026 for
 * 2026-27). Seasons switch on July 1st, Paris time.
 */
export function seasonOf(date = new Date()) {
  const { year, month } = zonedParts(date);
  return month >= 7 ? year : year - 1;
}

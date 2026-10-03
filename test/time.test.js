import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateTime,
  formatShort,
  formatTime,
  isInWindow,
  parisToDate,
  parseClock,
  seasonOf,
} from '../src/time.js';

test('times are shown in Paris, summer and winter time', () => {
  assert.equal(formatTime(new Date('2026-10-07T18:45:00Z')), '20:45'); // UTC+2
  assert.equal(formatTime(new Date('2026-12-07T18:45:00Z')), '19:45'); // UTC+1
  assert.equal(formatDateTime(new Date('2026-10-07T18:45:00Z')), 'mer. 7 oct. 20:45');
});

test('NBA night games land on the next Paris day', () => {
  // 7 pm in New York = 1 am in Paris.
  assert.equal(formatDateTime(new Date('2026-10-23T23:00:00Z')), 'sam. 24 oct. 01:00');
});

test('formatShort fits a 16-character badge', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  assert.equal(formatShort(new Date('2026-10-03T18:00:00Z'), now), '20:00');
  assert.equal(formatShort(new Date('2026-10-04T14:30:00Z'), now), 'demain 16:30');
  assert.equal(formatShort(new Date('2026-10-04T14:30:00Z'), now, 'en'), 'tomorrow 16:30');
  assert.equal(formatShort(new Date('2026-10-07T18:45:00Z'), now), 'mer. 20:45');
  assert.equal(formatShort(new Date('2026-10-25T15:30:00Z'), now), '25/10 16:30');
  for (const label of ['tomorrow 16:30', 'mer. 20:45', '25/10 16:30']) {
    assert.ok(label.length <= 16);
  }
});

test('parseClock reads HH:MM only', () => {
  assert.equal(parseClock('18:00'), 1080);
  assert.equal(parseClock('7:30'), 450);
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('18h'), null);
  assert.equal(parseClock(undefined), null);
});

test('isInWindow, including a window crossing midnight', () => {
  const at = (iso) => new Date(iso);
  // 20:45 Paris
  assert.equal(isInWindow(at('2026-10-07T18:45:00Z'), '18:00', '23:30'), true);
  // 16:30 Paris
  assert.equal(isInWindow(at('2026-10-04T14:30:00Z'), '18:00', '23:30'), false);
  // Bounds are included.
  assert.equal(isInWindow(at('2026-10-07T16:00:00Z'), '18:00', '23:30'), true);
  // 01:00 Paris, window 20:00 -> 02:00.
  assert.equal(isInWindow(at('2026-10-23T23:00:00Z'), '20:00', '02:00'), true);
  assert.equal(isInWindow(at('2026-10-23T23:00:00Z'), '18:00', '23:30'), false);
});

test('seasonOf switches on July 1st, Paris time', () => {
  assert.equal(seasonOf(new Date('2026-10-03T12:00:00Z')), 2026);
  assert.equal(seasonOf(new Date('2027-06-15T12:00:00Z')), 2026);
  // 30 June 23:30 UTC = 1 July 01:30 in Paris.
  assert.equal(seasonOf(new Date('2027-06-30T23:30:00Z')), 2027);
});

test('parisToDate reads a Paris wall-clock time, across the offset changes', () => {
  const iso = (text) => parisToDate(text)?.toISOString();
  assert.equal(iso('2026-09-18T20:00:00'), '2026-09-18T18:00:00.000Z');
  assert.equal(iso('2026-12-05T20:30'), '2026-12-05T19:30:00.000Z');
  // Day the clocks go back (25 October 2026), and the day they go forward.
  assert.equal(iso('2026-10-25T20:00:00'), '2026-10-25T19:00:00.000Z');
  assert.equal(iso('2027-03-28T20:00:00'), '2027-03-28T18:00:00.000Z');
  assert.equal(parisToDate(null), null);
  assert.equal(parisToDate('2026-09-18'), null);
});

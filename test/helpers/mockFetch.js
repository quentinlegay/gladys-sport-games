// -----------------------------------------------------------------------------
// Replace the global `fetch` with a router over JSON fixtures, for tests.
//
//   const calls = mockFetch({ 'euroleague.net': 'euroleague-games.json' });
//
// A route value is a fixture file name, a JSON value, an Error (the request
// fails) or a function `(url, init) => value`. The first route whose key is
// contained in the URL wins; an unrouted URL answers HTTP 404.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const realFetch = globalThis.fetch;

export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

export function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    let value = key === undefined ? undefined : routes[key];
    if (typeof value === 'function') {
      value = await value(String(url), init);
    }
    if (value instanceof Error) {
      throw value;
    }
    if (value === undefined) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    const body = typeof value === 'string' && value.endsWith('.json') ? fixture(value) : value;
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
  return calls;
}

export function restoreFetch() {
  globalThis.fetch = realFetch;
}

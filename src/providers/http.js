// -----------------------------------------------------------------------------
// Small JSON HTTP helper shared by the providers (Node 20+ `fetch`, no
// dependency). Every request has a timeout: a hung source must never block
// the polling of the devices.
// -----------------------------------------------------------------------------

export const REQUEST_TIMEOUT_MS = 30_000;

const USER_AGENT = 'gladys-sport-games (+https://github.com/prohand/gladys-sport-games)';

/**
 * Fetch a URL and parse its JSON body.
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...init.headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} <- ${url}`);
  }
  return response.json();
}

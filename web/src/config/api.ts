/**
 * Production API origin (scheme + host + port). When empty, requests use `/api/*`
 * and the Vite dev server proxies to the backend (see vite.config.ts).
 */

function normalizeApiBaseUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.origin;
  } catch {
    return s.replace(/\/+$/, '');
  }
}

/** Backend origin for REST calls. Empty → same-origin `/api` (dev proxy or same host as static files). */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw === undefined || raw === null) return '';
  return normalizeApiBaseUrl(String(raw));
}

/** Warn once if production build has no API URL (calls would hit wrong host). */
export function warnIfProductionMissingApiUrl(): void {
  if (!import.meta.env.PROD) return;
  if (getApiBaseUrl()) return;
  console.warn(
    '[smart-garage] VITE_API_URL is not set. Set it to your API origin when the frontend is served from a different host than the API.'
  );
}

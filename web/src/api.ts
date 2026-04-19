declare global {
  interface Window {
    /** Optional runtime override when the static build has no VITE_API_BASE_URL (set in index.html). */
    __API_BASE__?: string
  }
}

function trimBase(s: string): string {
  return s.replace(/\/$/, '').trim()
}

/**
 * Base URL of the Go API (no trailing slash).
 * - **Development:** empty string → same origin; Vite `server.proxy` forwards `/detect` and `/healthz` to the API.
 * - **Production:** set `VITE_API_BASE_URL` at build time, or `window.__API_BASE__` before the app bundle loads.
 */
export function getApiBase(): string {
  const fromVite = import.meta.env.VITE_API_BASE_URL
  if (typeof fromVite === 'string' && trimBase(fromVite) !== '') {
    return trimBase(fromVite)
  }
  if (import.meta.env.DEV) {
    return ''
  }
  if (typeof window !== 'undefined' && typeof window.__API_BASE__ === 'string') {
    return trimBase(window.__API_BASE__)
  }
  return ''
}

/** True when requests use relative URLs (Vite dev/preview proxy, or misconfigured static deploy). */
export function usesRelativeApiBase(): boolean {
  return getApiBase() === ''
}

/** `vite preview` serves a production bundle on localhost with the same proxy as dev. */
export function isLikelyLocalViteHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

/** Hosted production bundle on a real domain without API base → relative URLs hit the static host. */
export function isRemoteStaticMissingApiBase(): boolean {
  return !import.meta.env.DEV && usesRelativeApiBase() && !isLikelyLocalViteHost()
}

export function apiUrl(path: string): string {
  const base = getApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

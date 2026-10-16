// The admin token lives in sessionStorage: it survives a reload but is dropped when the tab is closed,
// and it is never written to localStorage or a cookie. Every access is guarded (private mode, blocked storage).
const KEY = "spbu-admin-token";

export function getAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // the session then lasts until reload, which is acceptable
  }
}

export function clearAdminToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** Calls an admin API with the token header. */
export async function adminFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-token": token },
  });
}

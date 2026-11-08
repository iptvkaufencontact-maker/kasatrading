"use client";

const TOKEN_KEY = "kasa_session_token";

export function getToken() {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  try { if (token) window.localStorage.setItem(TOKEN_KEY, token); else window.localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

/** Fetch that also sends the stored session token, so the app works even when cookies are blocked. */
export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store", credentials: "same-origin" });
}

export function goToLogin() {
  setToken(null);
  window.location.replace("/login");
}

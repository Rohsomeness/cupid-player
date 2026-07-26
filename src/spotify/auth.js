/**
 * Spotify OAuth 2.0 PKCE — browser only.
 * Client ID from VITE_SPOTIFY_CLIENT_ID (build) or localStorage override (setup).
 */

const TOKEN_KEY = 'spotify_token';
const REFRESH_KEY = 'spotify_refresh_token';
const EXPIRY_KEY = 'spotify_token_expiry';
const CODE_VERIFIER_KEY = 'spotify_code_verifier';
const CLIENT_ID_KEY = 'spotify_client_id';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
];

export function getClientId() {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch { /* ignore */ }
  return import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
}

export function setClientId(id) {
  localStorage.setItem(CLIENT_ID_KEY, (id || '').trim());
}

export function getRedirectUri() {
  const base = import.meta.env.BASE_URL || '/';
  const root = `${window.location.origin}${base.endsWith('/') ? base : `${base}/`}`;
  return new URL('callback', root).href;
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  const str = String.fromCharCode(...bytes);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

function storeTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expires_in * 1000));
}

/**
 * @param {string} [returnPath] path+query to restore after OAuth (e.g. /play?playlist=…)
 */
export async function login(returnPath) {
  const CLIENT_ID = getClientId();
  if (!CLIENT_ID) {
    throw new Error('Missing Spotify Client ID. Open Setup and paste your Client ID first.');
  }

  if (returnPath) {
    sessionStorage.setItem('cupid_post_login', returnPath);
  }

  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem(CODE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

let _callbackInFlight = false;

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) throw new Error(`Spotify auth error: ${error}`);
  if (!code) return null;
  if (_callbackInFlight) return null;
  _callbackInFlight = true;

  const CLIENT_ID = getClientId();
  if (!CLIENT_ID) throw new Error('Missing Spotify Client ID');

  try {
    const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Missing PKCE code verifier — try logging in again.');
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    storeTokens(data);
    localStorage.removeItem(CODE_VERIFIER_KEY);
    return data.access_token;
  } finally {
    _callbackInFlight = false;
  }
}

export async function getAccessToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) || '0');

  if (token && Date.now() < expiry - 60_000) return token;

  const refreshed = await refreshAccessToken();
  if (refreshed) return refreshed;
  return token || null;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const CLIENT_ID = getClientId();
  if (!CLIENT_ID) return null;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    logout();
    return null;
  }

  const data = await response.json();
  storeTokens(data);
  return data.access_token;
}

export function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(CODE_VERIFIER_KEY);
}

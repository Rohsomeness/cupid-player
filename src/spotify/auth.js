/**
 * Spotify OAuth 2.0 PKCE — browser only.
 *
 * Client ID resolution (first match wins):
 *  1. URL ?client_id= / ?cid=  (share-link friendly — no setup for partner)
 *  2. sessionStorage (survives OAuth redirect in the same tab)
 *  3. localStorage (optional setup “remember on this browser”)
 *  4. VITE_SPOTIFY_CLIENT_ID build-time env
 *
 * Client IDs are public for SPA apps; putting them in a share URL is fine.
 * Never put a client *secret* in a URL.
 */

const TOKEN_KEY = 'spotify_token';
const REFRESH_KEY = 'spotify_refresh_token';
const EXPIRY_KEY = 'spotify_token_expiry';
const CODE_VERIFIER_KEY = 'spotify_code_verifier';
const CLIENT_ID_KEY = 'spotify_client_id';
const CLIENT_ID_SESSION_KEY = 'spotify_client_id_session';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
];

/** Read client id from a URLSearchParams / location.search string. */
export function clientIdFromSearch(search) {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
    : search;
  const id = params.get('client_id') || params.get('cid') || '';
  return id.trim();
}

/**
 * Pull client id from the current page URL into sessionStorage so OAuth
 * and later API calls still work after Spotify redirects to /callback.
 * Safe to call on every route render.
 */
export function absorbClientIdFromUrl(search = window.location.search) {
  const fromUrl = clientIdFromSearch(search);
  if (fromUrl) {
    try {
      sessionStorage.setItem(CLIENT_ID_SESSION_KEY, fromUrl);
    } catch { /* ignore */ }
    return fromUrl;
  }
  return null;
}

export function getClientId() {
  // Live URL wins every time (share links)
  try {
    const fromUrl = clientIdFromSearch(window.location.search);
    if (fromUrl) {
      sessionStorage.setItem(CLIENT_ID_SESSION_KEY, fromUrl);
      return fromUrl;
    }
  } catch { /* ignore */ }

  try {
    const session = sessionStorage.getItem(CLIENT_ID_SESSION_KEY);
    if (session && session.trim()) return session.trim();
  } catch { /* ignore */ }

  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch { /* ignore */ }

  return (import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();
}

export function setClientId(id) {
  const v = (id || '').trim();
  localStorage.setItem(CLIENT_ID_KEY, v);
  try {
    if (v) sessionStorage.setItem(CLIENT_ID_SESSION_KEY, v);
  } catch { /* ignore */ }
}

/** Build a play URL that embeds client id + playlist so partner needs zero setup. */
export function buildShareLink({ playlistId, clientId, origin, base } = {}) {
  const root = origin ?? window.location.origin;
  const b = base ?? import.meta.env.BASE_URL ?? '/';
  const basePath = `${root}${b.endsWith('/') ? b : `${b}/`}`;
  const params = new URLSearchParams();
  if (playlistId) params.set('playlist', playlistId);
  const cid = (clientId || getClientId() || '').trim();
  if (cid) params.set('client_id', cid);
  const q = params.toString();
  return `${basePath}play${q ? `?${q}` : ''}`;
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

function base64UrlEncodeString(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeString(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
 * @param {string} [returnPath] path+query to restore after OAuth (e.g. /play?playlist=…&client_id=…)
 */
export async function login(returnPath) {
  const CLIENT_ID = getClientId();
  if (!CLIENT_ID) {
    throw new Error(
      'Missing Spotify Client ID. Use a share link that includes client_id, or open Setup.',
    );
  }

  // Ensure client id survives the trip even if returnPath is lost
  try {
    sessionStorage.setItem(CLIENT_ID_SESSION_KEY, CLIENT_ID);
  } catch { /* ignore */ }

  // Always put client_id on the post-login path when we have it
  let next = returnPath || '/play';
  if (!/[?&](client_id|cid)=/.test(next)) {
    next += `${next.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(CLIENT_ID)}`;
  }

  sessionStorage.setItem('cupid_post_login', next);

  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem(CODE_VERIFIER_KEY, verifier);

  // Pack client_id into OAuth state so callback works even if sessionStorage is wiped
  const state = base64UrlEncodeString(JSON.stringify({ c: CLIENT_ID, r: next }));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

let _callbackInFlight = false;

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const stateRaw = params.get('state');

  if (error) throw new Error(`Spotify auth error: ${error}`);
  if (!code) return null;
  if (_callbackInFlight) return null;
  _callbackInFlight = true;

  // Recover client id + return path from OAuth state if present
  if (stateRaw) {
    try {
      const parsed = JSON.parse(base64UrlDecodeString(stateRaw));
      if (parsed?.c) {
        sessionStorage.setItem(CLIENT_ID_SESSION_KEY, parsed.c);
      }
      if (parsed?.r) {
        sessionStorage.setItem('cupid_post_login', parsed.r);
      }
    } catch { /* ignore bad state */ }
  }

  const CLIENT_ID = getClientId();
  if (!CLIENT_ID) throw new Error('Missing Spotify Client ID after redirect');

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

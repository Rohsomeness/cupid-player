import { getAccessToken } from './auth.js';

const API_BASE = 'https://api.spotify.com/v1';

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.ok || (res.status < 500 && res.status !== 429)) return res;
    if (i < retries) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return fetch(url, options);
}

export function parsePlaylistUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();

  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  // bare id
  if (/^[a-zA-Z0-9]{16,32}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === 'open.spotify.com') {
      const parts = url.pathname.split('/');
      const idx = parts.indexOf('playlist');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
    }
  } catch {
    // not a URL
  }

  return null;
}

export async function fetchPlaylistTracks(playlistId) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const tracks = [];
  let url = `${API_BASE}/playlists/${playlistId}?market=from_token`;

  while (url) {
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const container = data.tracks
      ?? (Array.isArray(data.items) ? data : data.items);

    if (!Array.isArray(container?.items)) {
      throw new Error('Unexpected playlist response from Spotify');
    }

    for (const entry of container.items) {
      const t = entry.track || entry.item;
      if (!t || !t.uri || t.is_local) continue;

      tracks.push({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(', '),
        art: t.album?.images?.[0]?.url ?? null,
        uri: t.uri,
        id: t.id,
        durationMs: t.duration_ms ?? 0,
      });
    }

    url = container?.next ?? null;
  }

  return tracks;
}

export async function fetchMyPlaylists() {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const playlists = [];
  let url = `${API_BASE}/me/playlists?limit=50`;

  while (url) {
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (!Array.isArray(data.items)) {
      throw new Error('Unexpected playlists response from Spotify');
    }
    for (const p of data.items) {
      playlists.push({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url ?? null,
        trackCount: p.tracks?.total ?? 0,
      });
    }
    url = data.next;
  }

  return playlists;
}

export async function fetchPlaylistInfo(playlistId) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const res = await fetchWithRetry(
    `${API_BASE}/playlists/${playlistId}?fields=name,images,owner`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    name: data.name,
    image: data.images?.[0]?.url ?? null,
    owner: data.owner?.display_name ?? null,
  };
}

/** Transfer playback + start a list of track URIs on the Web Playback device. */
export async function playUris(deviceId, uris, offsetUri) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  const body = { uris };
  if (offsetUri) body.offset = { uri: offsetUri };

  const res = await fetch(
    `${API_BASE}/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  // 204 = ok; 202 sometimes; 404 device not found
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Play failed (${res.status}): ${text}`);
  }
}

export async function transferPlayback(deviceId, play = false) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated with Spotify');

  await fetch(`${API_BASE}/me/player`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

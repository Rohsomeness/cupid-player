import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Player from '../components/Player.jsx';
import {
  absorbClientIdFromUrl,
  getClientId,
  isLoggedIn,
  login,
  logout,
} from '../spotify/auth.js';
import {
  fetchMyPlaylists,
  fetchPlaylistInfo,
  fetchPlaylistTracks,
  parsePlaylistUrl,
} from '../spotify/api.js';
import '../pages.css';

export default function PlayerPage() {
  const { playlistId: pathId } = useParams();
  const [searchParams] = useSearchParams();

  // Pull ?client_id= / ?cid= from the share link into this tab (no setup for partner)
  useEffect(() => {
    absorbClientIdFromUrl(searchParams.toString());
  }, [searchParams]);

  const queryPlaylist = searchParams.get('playlist') || searchParams.get('p');
  const deepPlaylistId = useMemo(
    () => pathId || parsePlaylistUrl(queryPlaylist || '') || queryPlaylist || null,
    [pathId, queryPlaylist],
  );

  const [connected, setConnected] = useState(() => isLoggedIn());
  const [tracks, setTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [error, setError] = useState(null);
  const [pasteUrl, setPasteUrl] = useState('');
  // Re-read when search params change so share-link client_id is seen immediately
  const hasClientId = Boolean(getClientId());

  const returnPath = useMemo(() => {
    const params = new URLSearchParams();
    if (deepPlaylistId) params.set('playlist', deepPlaylistId);
    const cid = getClientId();
    if (cid) params.set('client_id', cid);
    const q = params.toString();
    return q ? `/play?${q}` : '/play';
  }, [deepPlaylistId, searchParams]);

  const loadPlaylist = useCallback(async (id) => {
    if (!id) return;
    setLoadingList(true);
    setError(null);
    try {
      const [info, list] = await Promise.all([
        fetchPlaylistInfo(id).catch(() => ({ name: 'playlist' })),
        fetchPlaylistTracks(id),
      ]);
      setPlaylistName(info.name || 'playlist');
      setTracks(list);
      if (list.length === 0) {
        setError('this playlist has no playable tracks');
      }
    } catch (err) {
      setError(err.message || String(err));
      setTracks([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const list = await fetchMyPlaylists();
      setPlaylists(list);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  // After login, load deep-linked playlist or open settings
  useEffect(() => {
    if (!connected) return;
    if (deepPlaylistId) {
      loadPlaylist(deepPlaylistId);
    } else {
      setShowSettings(true);
      loadPlaylists();
    }
  }, [connected, deepPlaylistId, loadPlaylist, loadPlaylists]);

  const handleLogin = async () => {
    try {
      await login(returnPath);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Gates ──────────────────────────────────────────────
  if (!hasClientId) {
    return (
      <div className="player-page">
        <div className="player-topbar">
          <Link to="/">← home</Link>
        </div>
        <div className="gate">
          <div className="gate-card">
            <h1>need a share link</h1>
            <p>
              this page was opened without a spotify client id. ask whoever set this
              up to send you the full link from <strong>setup</strong> (it includes{' '}
              <code>client_id=…</code> in the url).
            </p>
            <p className="note" style={{ marginTop: '0.75rem' }}>
              if you&apos;re the setup person, open setup and copy the magic share link.
            </p>
            <Link to="/setup" className="btn-pixel" style={{ textDecoration: 'none', display: 'inline-block' }}>
              go to setup →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="player-page">
        <div className="player-topbar">
          <Link to="/">← home</Link>
          <span className="spacer" />
          <Link to="/setup">setup</Link>
        </div>
        <div className="gate">
          <div className="gate-card">
            <h1>{deepPlaylistId ? 'a playlist for you' : 'cupid player'}</h1>
            <p>
              log in with spotify to play. you need <strong>premium</strong>, and
              your email must be on the app&apos;s allowlist (ask whoever sent you this).
            </p>
            <p className="note">no setup for you — the link they sent already has everything.</p>
            {error && <p className="warn-msg">{error}</p>}
            <button type="button" className="btn-pixel" onClick={handleLogin}>
              continue with spotify
            </button>
          </div>
        </div>
      </div>
    );
  }

  const settingsSlot = (
    <>
      <div className="settings-label">spotify</div>
      {loadingList && <div className="settings-label">loading playlist…</div>}
      {error && <div className="settings-error">{error}</div>}

      <div className="settings-label">paste playlist url</div>
      <input
        className="settings-input"
        type="text"
        placeholder="open.spotify.com/playlist/…"
        value={pasteUrl}
        onChange={(e) => setPasteUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const id = parsePlaylistUrl(pasteUrl);
            if (id) loadPlaylist(id);
          }
        }}
      />
      <button
        type="button"
        className="settings-theme-btn"
        onClick={() => {
          const id = parsePlaylistUrl(pasteUrl);
          if (id) loadPlaylist(id);
          else setError('could not parse playlist url');
        }}
      >
        load
      </button>

      <div className="settings-label">your playlists</div>
      <div className="settings-playlist-list">
        {loadingPlaylists ? (
          <div className="settings-label">loading…</div>
        ) : playlists.length === 0 ? (
          <button type="button" className="settings-theme-btn" onClick={loadPlaylists}>
            load my playlists
          </button>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              className="settings-playlist-item"
              onClick={() => {
                loadPlaylist(p.id);
                setShowSettings(false);
              }}
            >
              {p.name}
            </button>
          ))
        )}
      </div>

      <div className="settings-theme-row">
        <button type="button" className="settings-theme-btn" onClick={loadPlaylists}>
          refresh
        </button>
        <button
          type="button"
          className="settings-theme-btn"
          onClick={() => {
            logout();
            setConnected(false);
            setTracks([]);
          }}
        >
          logout
        </button>
      </div>
    </>
  );

  return (
    <div className="player-page">
      <div className="player-topbar">
        <Link to="/">← home</Link>
        <span className="spacer" />
        {playlistName && <span style={{ opacity: 0.75 }}>{playlistName}</span>}
        <button
          type="button"
          className="btn-pixel secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          onClick={() => {
            setShowSettings((v) => !v);
            if (!playlists.length) loadPlaylists();
          }}
        >
          {showSettings ? 'close' : 'playlists'}
        </button>
        <Link to="/setup">setup</Link>
      </div>
      <Player
        tracks={tracks}
        playlistName={playlistName}
        showSettings={showSettings}
        onOpenSettings={() => {
          setShowSettings((v) => !v);
          if (!playlists.length) loadPlaylists();
        }}
        settingsSlot={settingsSlot}
      />
    </div>
  );
}

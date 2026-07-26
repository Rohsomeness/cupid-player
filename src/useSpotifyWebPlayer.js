/**
 * Spotify Web Playback SDK hook — real Spotify audio in the browser.
 * Requires Premium + streaming scope.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from './spotify/auth.js';
import { playUris } from './spotify/api.js';

function waitForSpotifySDK() {
  return new Promise((resolve) => {
    if (window.Spotify) {
      resolve(window.Spotify);
      return;
    }
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.Spotify);
    };
  });
}

export default function useSpotifyWebPlayer(tracks, playMode = 'normal') {
  const playerRef = useRef(null);
  const deviceIdRef = useRef(null);
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const trackIndexRef = useRef(0);

  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('cupid-volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [muted, setMuted] = useState(false);

  const prevTracksRef = useRef(tracks);
  if (prevTracksRef.current !== tracks) {
    prevTracksRef.current = tracks;
    trackIndexRef.current = 0;
    setTrackIndex(0);
  }

  trackIndexRef.current = trackIndex;

  const track = tracks[trackIndex] ?? {
    title: 'No track',
    artist: '',
    art: null,
    uri: null,
  };

  // Init SDK player once
  useEffect(() => {
    let disposed = false;
    let player;

    (async () => {
      try {
        await waitForSpotifySDK();
        if (disposed) return;

        player = new window.Spotify.Player({
          name: 'Cupid Player',
          getOAuthToken: async (cb) => {
            const token = await getAccessToken();
            cb(token || '');
          },
          volume,
        });

        player.addListener('ready', ({ device_id }) => {
          deviceIdRef.current = device_id;
          setReady(true);
          setLoading(false);
          setError(null);
        });

        player.addListener('not_ready', () => {
          deviceIdRef.current = null;
          setReady(false);
        });

        player.addListener('initialization_error', ({ message }) => {
          setError(message || 'Failed to init Spotify player');
          setLoading(false);
        });
        player.addListener('authentication_error', ({ message }) => {
          setError(message || 'Spotify auth error — try logging in again');
          setLoading(false);
        });
        player.addListener('account_error', ({ message }) => {
          setError(
            message ||
              'Spotify Premium is required to play music in the browser.',
          );
          setLoading(false);
        });
        player.addListener('playback_error', ({ message }) => {
          setError(message || 'Playback error');
        });

        player.addListener('player_state_changed', (state) => {
          if (!state) return;
          setIsPlaying(!state.paused);
          const dur = (state.duration || 0) / 1000;
          const pos = (state.position || 0) / 1000;
          setDuration(dur);
          setCurrentTime(pos);
          setProgress(dur > 0 ? pos / dur : 0);

          const currentUri = state.track_window?.current_track?.uri;
          if (currentUri) {
            const idx = tracksRef.current.findIndex((t) => t.uri === currentUri);
            if (idx >= 0 && idx !== trackIndexRef.current) {
              setTrackIndex(idx);
            }
          }

          // Auto-advance when track ends (position near end + paused)
          if (
            state.paused &&
            state.duration > 0 &&
            state.position >= state.duration - 500 &&
            !state.loading
          ) {
            // handled via next on user; SDK often auto-continues context
          }
        });

        const ok = await player.connect();
        if (!ok) {
          setError('Could not connect to Spotify Web Playback');
          setLoading(false);
        }
        playerRef.current = player;
      } catch (err) {
        setError(err.message || String(err));
        setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      try {
        player?.disconnect();
      } catch { /* ignore */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress polling while playing (state_changed can be sparse)
  useEffect(() => {
    if (!isPlaying || !playerRef.current) return;
    const id = setInterval(async () => {
      try {
        const state = await playerRef.current.getCurrentState();
        if (!state) return;
        const dur = (state.duration || 0) / 1000;
        const pos = (state.position || 0) / 1000;
        setDuration(dur);
        setCurrentTime(pos);
        setProgress(dur > 0 ? pos / dur : 0);
      } catch { /* ignore */ }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  // When playlist (tracks) changes, start playback on device from track 0
  useEffect(() => {
    if (!ready || !deviceIdRef.current || tracks.length === 0) return;
    // Spotify play endpoint accepts at most ~100 URIs; keep first 100
    const uris = tracks.map((t) => t.uri).filter(Boolean).slice(0, 100);
    if (uris.length === 0) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Small delay so device is fully registered
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;
        await playUris(deviceIdRef.current, uris, uris[0]);
        setTrackIndex(0);
        setIsPlaying(true);
        setError(null);
      } catch (err) {
        // Autoplay may need a user gesture (press play once)
        console.warn(err);
        setError(
          err.message?.includes('Premium')
            ? err.message
            : `${err.message} — try pressing play`,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ready, tracks]);

  const togglePlay = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.togglePlay();
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const next = useCallback(async () => {
    const list = tracksRef.current;
    if (list.length === 0) return;

    if (playModeRef.current === 'shuffle' && list.length > 1) {
      let n;
      do {
        n = Math.floor(Math.random() * list.length);
      } while (n === trackIndexRef.current);
      setTrackIndex(n);
      return;
    }

    // Prefer SDK next within context
    try {
      if (playerRef.current) {
        await playerRef.current.nextTrack();
        return;
      }
    } catch { /* fall through */ }

    setTrackIndex((i) => (i + 1) % list.length);
  }, []);

  const prev = useCallback(async () => {
    try {
      const state = await playerRef.current?.getCurrentState();
      if (state && state.position > 3000) {
        await playerRef.current.seek(0);
        return;
      }
      await playerRef.current?.previousTrack();
    } catch {
      setTrackIndex((i) => {
        const len = tracksRef.current.length;
        return (i - 1 + len) % len;
      });
    }
  }, []);

  const seek = useCallback(async (fraction) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const state = await player.getCurrentState();
      if (!state?.duration) return;
      await player.seek(Math.min(1, Math.max(0, fraction)) * state.duration);
    } catch (err) {
      console.warn(err);
    }
  }, []);

  const setVolume = useCallback(async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    localStorage.setItem('cupid-volume', String(clamped));
    if (clamped > 0) setMuted(false);
    try {
      await playerRef.current?.setVolume(clamped);
    } catch { /* ignore */ }
  }, []);

  const toggleMute = useCallback(async () => {
    setMuted((m) => {
      const nextMuted = !m;
      const vol = nextMuted ? 0 : volume;
      playerRef.current?.setVolume(vol).catch(() => {});
      return nextMuted;
    });
  }, [volume]);

  return {
    track,
    trackIndex,
    isPlaying,
    progress,
    duration,
    currentTime,
    togglePlay,
    next,
    prev,
    seek,
    volume,
    setVolume,
    muted,
    toggleMute,
    loading,
    ready,
    error,
    setError,
    setTrackIndex,
  };
}

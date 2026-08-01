import { useCallback, useEffect, useRef, useState } from 'react';
import '../Player.css';
import useTheme from '../useTheme.js';
import useSpotifyWebPlayer from '../useSpotifyWebPlayer.js';
import progressBarStars from '../../assets/progress_bar_stars.png';
import star from '../../assets/star.png';
import starSelected from '../../assets/star_selected.png';

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MarqueeText({ className, text }) {
  const outerRef = useRef(null);
  const textRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const textEl = textRef.current;
    if (!outer || !textEl) return;
    setShouldScroll(textEl.offsetWidth > outer.clientWidth);
  }, [text]);

  return (
    <div className={`${className} marquee-container`} ref={outerRef}>
      <span ref={textRef} className="marquee-measure">{text}</span>
      <span className={shouldScroll ? 'marquee-scroll' : ''}>
        {text}
        {shouldScroll && <span className="marquee-gap">{text}</span>}
      </span>
    </div>
  );
}

function goHome() {
  const base = import.meta.env.BASE_URL || '/';
  window.location.href = base.endsWith('/') ? base : `${base}/`;
}

/**
 * Pixel player shell — cupid vibe, Spotify Web Playback under the hood.
 */
export default function Player({
  tracks,
  playlistName,
  onOpenSettings,
  showSettings,
  settingsSlot,
}) {
  const { theme, toggleTheme, assets } = useTheme();
  const [playMode, setPlayMode] = useState('normal'); // normal | shuffle | repeat

  const {
    track,
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
    error,
    ready,
  } = useSpotifyWebPlayer(tracks, playMode);

  const [hoverProgress, setHoverProgress] = useState(null);
  const [starHovered, setStarHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [volumeHovered, setVolumeHovered] = useState(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  const seekRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [needleFrame, setNeedleFrame] = useState(0);
  const [isPink, setIsPink] = useState(true);
  const [swapping, setSwapping] = useState(false);
  const [needleLifted, setNeedleLifted] = useState(false);
  const [needleChangeFrame, setNeedleChangeFrame] = useState(0);
  const prevTrackRef = useRef(null);
  const swapTimersRef = useRef([]);

  // Pick a vinyl face; continuous spin is CSS (not frame-cycling)
  const diskSrc = isPink ? assets.recordFramesA[0] : assets.recordFramesB[0];
  const incomingDiskSrc = isPink ? assets.recordFramesB[0] : assets.recordFramesA[0];

  // Needle bob while playing (faster + smoother interval)
  useEffect(() => {
    if (!isPlaying || swapping || needleLifted) return;
    const interval = setInterval(() => {
      setNeedleFrame((f) => (f + 1) % assets.needlePlayFrames.length);
    }, 180);
    return () => clearInterval(interval);
  }, [isPlaying, swapping, needleLifted, assets.needlePlayFrames.length]);

  // Track change: lift needle → swap disk → lower needle
  useEffect(() => {
    if (prevTrackRef.current === track.title) return;
    const wasInitialOrPlaceholder =
      prevTrackRef.current === null || prevTrackRef.current === 'No track';
    prevTrackRef.current = track.title;
    if (track.title === 'No track') return;
    if (wasInitialOrPlaceholder) return;
    if (needleLifted) return;

    swapTimersRef.current.forEach(clearTimeout);
    swapTimersRef.current = [];

    setNeedleLifted(true);
    setNeedleChangeFrame(0);

    const t = (ms, fn) => {
      swapTimersRef.current.push(setTimeout(fn, ms));
    };

    t(160, () => setNeedleChangeFrame(1));
    t(320, () => setNeedleChangeFrame(2));
    t(420, () => setSwapping(true));
    t(1180, () => {
      setIsPink((p) => !p);
      setSwapping(false);
    });
    t(1280, () => setNeedleChangeFrame(1));
    t(1420, () => {
      setNeedleChangeFrame(0);
      setNeedleLifted(false);
      setNeedleFrame(0);
    });

    return () => {
      swapTimersRef.current.forEach(clearTimeout);
      swapTimersRef.current = [];
    };
  }, [track.title, needleLifted]);

  // Seek drag
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const el = seekRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverProgress(pct);
    };
    const onUp = (e) => {
      const el = seekRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(pct);
      }
      setDragging(false);
      setHoverProgress(null);
      setStarHovered(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, seek]);

  // Volume drag
  useEffect(() => {
    if (!volumeDragging) return;
    const onMove = (e) => {
      const el = volumeBarRef.current;
      if (!el) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      setVolume(pct);
    };
    const onUp = () => {
      setVolumeDragging(false);
      setVolumeHovered(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [volumeDragging, setVolume]);

  const cyclePlayMode = useCallback(() => {
    setPlayMode((m) => {
      if (m === 'normal') return 'shuffle';
      if (m === 'shuffle') return 'repeat';
      return 'normal';
    });
  }, []);

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = assets.favicon;
  }, [assets.favicon]);

  const displayProgress = hoverProgress ?? progress;
  // Star position along progress bar (design coords → unit --u)
  const starShift = -3 / 306 + displayProgress * (226 / 512) * (526 / 306);

  const spinClass = [
    'record-player',
    'record-disk',
    !swapping ? 'spinning' : '',
    !isPlaying || swapping ? 'is-paused' : '',
    swapping ? 'record-slide-out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`player ${theme === 'blue' ? 'theme-blue' : ''}`}>
      <img src={assets.frame} className="layer" alt="" draggable={false} />

      <div className="window-title">
        {playlistName ? `cupid · ${playlistName}` : 'cupid player'}
      </div>

      {/* Platter base (static) */}
      <img
        src={assets.recordPlayer}
        className="record-player record-platter"
        alt=""
        draggable={false}
      />

      {/* Vinyl — CSS continuous spin while playing */}
      <img
        src={diskSrc}
        className={spinClass}
        alt=""
        draggable={false}
      />
      {swapping && (
        <img
          src={incomingDiskSrc}
          className="record-player record-disk record-slide-in"
          alt=""
          draggable={false}
        />
      )}

      {/* Needle */}
      <img
        src={
          needleLifted
            ? assets.needleChangeFrames[needleChangeFrame]
            : assets.needlePlayFrames[needleFrame]
        }
        className="record-player record-needle"
        alt=""
        draggable={false}
      />

      <img src={assets.frameNoBg} className="layer frame-overlay" alt="" draggable={false} />
      <img src={assets.plant} className="layer layer-ui" alt="" draggable={false} />

      <img src={assets.progressBar} className="layer layer-ui" alt="" draggable={false} />
      <img
        src={progressBarStars}
        className="layer layer-ui progress-fill-layer"
        alt=""
        draggable={false}
        style={{
          clipPath: `inset(0 ${(1 - (131 + displayProgress * 226 + 10) / 512) * 100}% 0 0)`,
        }}
      />
      <img
        src={starHovered ? starSelected : star}
        className={`layer layer-ui star-indicator ${starHovered ? 'star-hovered' : ''}`}
        alt=""
        draggable={false}
        style={{
          transform: `translateX(calc(${starShift} * var(--u)))`,
        }}
      />

      <img src={assets.backwardsButton} className="layer layer-ui" alt="" draggable={false} />
      <img
        src={isPlaying ? assets.pauseButton : assets.playButton}
        className="layer layer-ui"
        alt=""
        draggable={false}
      />
      <img src={assets.forwardsButton} className="layer layer-ui" alt="" draggable={false} />

      <img
        src={muted ? assets.muteButton : assets.volumeButton}
        className="layer layer-ui"
        alt=""
        draggable={false}
        style={{ opacity: 0.8 }}
      />

      <img
        src={playMode === 'repeat' ? assets.repeatButton : assets.shuffleButton}
        className="layer layer-ui"
        alt=""
        draggable={false}
        style={{ opacity: playMode === 'normal' ? 0.4 : 0.8 }}
      />

      {/* Chrome: settings + close only (mask covers baked min/max) */}
      <div className="chrome-btn-mask" aria-hidden />
      <img src={assets.settings} className="layer layer-ui settings-layer" alt="" draggable={false} />
      <img src={assets.exitButton} className="layer layer-ui chrome-exit-layer" alt="" draggable={false} />

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="album-mask" clipPathUnits="objectBoundingBox">
            <rect x="0.07317" y="0" width="0.85366" height="1" />
            <rect x="0.04878" y="0.02439" width="0.90244" height="0.95122" />
            <rect x="0.02439" y="0.04878" width="0.95122" height="0.90244" />
            <rect x="0" y="0.07317" width="1" height="0.85366" />
          </clipPath>
        </defs>
      </svg>

      {track.art && (
        <div className="album-mask">
          <img src={track.art} className="album-art" alt="" draggable={false} />
        </div>
      )}

      <img src={assets.albumFrame} className="layer album-frame-layer" alt="" draggable={false} />

      <div className="now-playing">
        <div className="track-info">
          <div className="now-playing-label">now playing...</div>
          <MarqueeText className="track-title" text={track.title} />
          <div className="track-artist">by {track.artist || '—'}</div>
        </div>
      </div>

      <div className="time-display">
        <span className="time-current">{formatTime(currentTime)}</span>
        <span className="time-remaining">{formatTime(Math.max(0, duration - currentTime))}</span>
      </div>

      <div
        className="progress-seek"
        ref={seekRef}
        onMouseEnter={() => setStarHovered(true)}
        onMouseLeave={() => {
          if (!dragging) setStarHovered(false);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging(true);
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          setHoverProgress(pct);
          seek(pct);
        }}
      />

      <div className="btn btn-prev" onClick={prev} />
      <div className="btn btn-play" onClick={togglePlay} />
      <div className="btn btn-next" onClick={next} />

      {(volumeHovered || volumeDragging) && (
        <>
          <img src={assets.volumeBarLow} className="layer layer-ui volume-bar-layer" alt="" draggable={false} />
          <img
            src={assets.volumeBarHigh}
            className="layer layer-ui volume-bar-layer"
            alt=""
            draggable={false}
            style={{
              clipPath: `inset(${((1 - (muted ? 0 : volume)) * (420 - 338) / 512 + 338 / 512) * 100}% 0 0 0)`,
            }}
          />
        </>
      )}

      <div
        className={`volume-hover-zone ${volumeHovered || volumeDragging ? 'expanded' : ''}`}
        onMouseLeave={() => {
          if (!volumeDragging) setVolumeHovered(false);
        }}
      >
        <div
          className="btn-volume-icon"
          onClick={toggleMute}
          onMouseEnter={() => setVolumeHovered(true)}
        />
        {(volumeHovered || volumeDragging) && (
          <div
            className="volume-bar-area"
            ref={volumeBarRef}
            onMouseDown={(e) => {
              e.preventDefault();
              setVolumeDragging(true);
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
              setVolume(pct);
            }}
          />
        )}
      </div>

      <div className="btn btn-playmode" onClick={cyclePlayMode} title={playMode} />

      <div className="btn btn-settings" onClick={onOpenSettings} title="settings" />
      <div className="btn btn-exit" onClick={goHome} title="close" />

      {showSettings && (
        <div className="settings-panel">
          <div className="settings-panel-inner">
            <div className="settings-label">theme</div>
            <div className="settings-theme-row">
              <button
                type="button"
                className={`settings-theme-btn ${theme === 'pink' ? 'active' : ''}`}
                onClick={() => { if (theme !== 'pink') toggleTheme(); }}
              >
                pink
              </button>
              <button
                type="button"
                className={`settings-theme-btn ${theme === 'blue' ? 'active' : ''}`}
                onClick={() => { if (theme !== 'blue') toggleTheme(); }}
              >
                blue
              </button>
            </div>
            {settingsSlot}
          </div>
        </div>
      )}

      {(loading || !ready) && tracks.length > 0 && (
        <div className="status-banner">connecting to spotify…</div>
      )}
      {error && <div className="status-banner error">{error}</div>}
      {!loading && ready && tracks.length === 0 && (
        <div className="status-banner">pick a playlist in settings ⚙</div>
      )}
    </div>
  );
}

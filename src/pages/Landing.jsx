import { Link } from 'react-router-dom';
import favicon from '../../assets/pink/favicon.png';
import '../pages.css';

export default function Landing() {
  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="brand-row">
          <img src={favicon} alt="" className="brand-icon" />
          <div>
            <h1 className="brand-title">cupid player</h1>
            <p className="brand-sub">a pixel-art spotify player for you &amp; your person</p>
          </div>
        </div>

        <p className="brand-sub" style={{ marginTop: '0.75rem' }}>
          two paths. set it up once, then share a playlist link they can open and play.
        </p>

        <div className="paths">
          <Link to="/setup" className="path-card">
            <span className="path-tag">for you · the setup person</span>
            <h2>i&apos;m setting this up →</h2>
            <p>
              create a spotify developer app, whitelist your partner, and build a
              share link to a playlist. takes about 10 minutes the first time.
            </p>
          </Link>

          <Link to="/play" className="path-card">
            <span className="path-tag">for them · open &amp; play</span>
            <h2>i was sent a link →</h2>
            <p>
              log in with spotify (premium), open the playlist, and press play.
              no install. no terminal. just the player.
            </p>
          </Link>
        </div>

        <p className="page-footer">
          needs spotify premium for in-browser playback ·{' '}
          <a
            href="https://github.com/cupidbity/cupid-music-player"
            target="_blank"
            rel="noreferrer"
          >
            inspired by cupid music player
          </a>
        </p>
      </div>
    </div>
  );
}

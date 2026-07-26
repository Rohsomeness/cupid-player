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
          set it up once in the browser, then send one link. the link carries the
          playlist <em>and</em> your client id — they just log in.
        </p>

        <div className="paths">
          <Link to="/setup" className="path-card">
            <span className="path-tag">for you · the setup person</span>
            <h2>i&apos;m setting this up →</h2>
            <p>
              create a spotify app, whitelist their email, paste client id +
              playlist, copy the magic share link. no clone, no deploy.
            </p>
          </Link>

          <Link to="/play" className="path-card">
            <span className="path-tag">for them · open the link they sent</span>
            <h2>i was sent a link →</h2>
            <p>
              use the full url they texted you (it has client_id in it). log in
              with spotify premium and press play. nothing to configure.
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

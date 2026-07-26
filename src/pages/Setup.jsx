import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getClientId,
  setClientId as saveClientId,
  getRedirectUri,
} from '../spotify/auth.js';
import { parsePlaylistUrl } from '../spotify/api.js';
import '../pages.css';

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <p className="note">{label}</p>}
      <div className="field-row">
        <code className="copy-box" style={{ flex: 1, margin: 0 }}>{value}</code>
        <button
          type="button"
          className="btn-pixel secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
    </div>
  );
}

export default function Setup() {
  const [clientId, setClientId] = useState(() => getClientId());
  const [saved, setSaved] = useState(false);
  const [playlistInput, setPlaylistInput] = useState('');
  const redirectUri = useMemo(() => {
    try {
      return getRedirectUri();
    } catch {
      return '(open this page on the live site to see the redirect uri)';
    }
  }, []);

  const playlistId = parsePlaylistUrl(playlistInput);
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/');
  const shareLink = playlistId
    ? `${base}play?playlist=${playlistId}`
    : '';

  return (
    <div className="page-shell">
      <div className="setup-nav">
        <Link to="/">← home</Link>
        <Link to="/play">open player →</Link>
      </div>

      <div className="page-card wide">
        <h1 className="brand-title">setup guide</h1>
        <p className="brand-sub">
          you do this once. your partner only opens a link and logs into spotify.
        </p>

        <div className="setup-steps">
          <section className="setup-step">
            <h3>1 · create a spotify developer app</h3>
            <ol>
              <li>
                go to{' '}
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                  developer.spotify.com/dashboard
                </a>
              </li>
              <li>log in → <strong>Create app</strong></li>
              <li>name it anything (e.g. “cupid player”)</li>
              <li>under APIs, enable <strong>Web API</strong></li>
              <li>create the app, then open <strong>Settings</strong></li>
            </ol>
            <p className="note">
              as of 2026, the account that owns the developer app may need an active
              spotify premium subscription for the api to work.
            </p>
          </section>

          <section className="setup-step">
            <h3>2 · add this redirect uri</h3>
            <p>in app settings → Redirect URIs → add exactly:</p>
            <CopyField value={redirectUri} />
            <p className="note">
              for local testing also add:{' '}
              <code style={{ display: 'inline', padding: '0.1rem 0.3rem' }}>
                http://127.0.0.1:5173/callback
              </code>{' '}
              (and run with base <code style={{ display: 'inline' }}>/</code> if needed).
            </p>
            <p>save settings.</p>
          </section>

          <section className="setup-step">
            <h3>3 · paste your client id</h3>
            <p>
              copy the <strong>Client ID</strong> from the dashboard (not the secret — pkce doesn’t need it).
            </p>
            <div className="field-row">
              <input
                type="text"
                placeholder="spotify client id"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setSaved(false);
                }}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn-pixel"
                onClick={() => {
                  saveClientId(clientId);
                  setSaved(true);
                }}
              >
                save on this browser
              </button>
            </div>
            {saved && <p className="success-msg">saved. this browser can log into spotify now.</p>}
            <p className="note">
              saving here stores the id in <em>this browser only</em>. for a permanent site
              that works for your partner without them pasting anything, also set{' '}
              <code style={{ display: 'inline' }}>VITE_SPOTIFY_CLIENT_ID</code> as a GitHub
              Actions secret and redeploy (recommended).
            </p>
          </section>

          <section className="setup-step">
            <h3>4 · whitelist your partner</h3>
            <ol>
              <li>dashboard → your app → <strong>Settings → User Management</strong></li>
              <li>add the email on their spotify account</li>
              <li>save</li>
            </ol>
            <p className="note">
              development mode only allows allowlisted users (about 25). add yourself too.
              they need <strong>spotify premium</strong> to hear music in the browser.
            </p>
          </section>

          <section className="setup-step">
            <h3>5 · make (or pick) a playlist</h3>
            <ul>
              <li>curate a playlist in spotify</li>
              <li>
                make it <strong>public</strong> or <strong>collaborative</strong> if they
                should open your list under their account
              </li>
              <li>copy the playlist link from spotify (share → copy link)</li>
            </ul>
          </section>

          <section className="setup-step">
            <h3>6 · build a share link</h3>
            <p>paste a spotify playlist url or id:</p>
            <div className="field-row">
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/…"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                spellCheck={false}
              />
            </div>
            {playlistId && shareLink ? (
              <>
                <p className="success-msg">share this with them:</p>
                <CopyField value={shareLink} />
                <p className="note">
                  they open it → log in with spotify once → playlist loads → play.
                </p>
              </>
            ) : playlistInput.trim() ? (
              <p className="warn-msg">couldn’t parse that as a playlist link</p>
            ) : null}
          </section>

          <section className="setup-step">
            <h3>7 · try it yourself</h3>
            <p>
              open the player, log in with your spotify account, and confirm playback works
              before you send the link.
            </p>
            <div className="field-row" style={{ marginTop: '0.6rem' }}>
              <Link to="/play" className="btn-pixel" style={{ textDecoration: 'none' }}>
                open player →
              </Link>
              {shareLink && (
                <Link
                  to={`/play?playlist=${playlistId}`}
                  className="btn-pixel secondary"
                  style={{ textDecoration: 'none' }}
                >
                  open share link →
                </Link>
              )}
            </div>
          </section>
        </div>

        <p className="page-footer" style={{ marginTop: '1.5rem' }}>
          stuck? common issues: wrong redirect uri, partner not in user management,
          free account (premium required), or client id not set for their browser / deploy.
        </p>
      </div>
    </div>
  );
}

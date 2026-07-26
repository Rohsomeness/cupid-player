import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getClientId,
  getRedirectUri,
  buildShareLink,
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
  const [playlistInput, setPlaylistInput] = useState('');
  const redirectUri = useMemo(() => {
    try {
      return getRedirectUri();
    } catch {
      return '(open this page on the live site to see the redirect uri)';
    }
  }, []);

  const playlistId = parsePlaylistUrl(playlistInput);
  const shareLink =
    playlistId && clientId.trim()
      ? buildShareLink({ playlistId, clientId: clientId.trim() })
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
          you do this once on the website. your partner only opens the share link
          and logs into spotify — no install, no client id paste, no repo.
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
            <p>save settings. (this is the public cupid-player site — no clone required.)</p>
          </section>

          <section className="setup-step">
            <h3>3 · whitelist your partner</h3>
            <ol>
              <li>dashboard → your app → <strong>Settings → User Management</strong></li>
              <li>add the email on <strong>their</strong> spotify account</li>
              <li>add yourself too</li>
              <li>save</li>
            </ol>
            <p className="note">
              development mode only allows allowlisted users (~25). they need{' '}
              <strong>spotify premium</strong> to hear music in the browser.
            </p>
          </section>

          <section className="setup-step">
            <h3>4 · paste your client id + playlist</h3>
            <p>
              copy the <strong>Client ID</strong> from the dashboard (not the secret).
              it goes <em>into the share link</em> — client ids are public for web apps.
              your partner never types it.
            </p>
            <div className="field-row">
              <input
                type="text"
                placeholder="spotify client id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                spellCheck={false}
              />
            </div>
            <p style={{ marginTop: '0.75rem' }}>
              paste a spotify playlist link (public or collaborative works best):
            </p>
            <div className="field-row">
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/…"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>

          <section className="setup-step">
            <h3>5 · copy the magic share link</h3>
            {!clientId.trim() && (
              <p className="warn-msg">paste your client id above first</p>
            )}
            {clientId.trim() && !playlistId && playlistInput.trim() && (
              <p className="warn-msg">couldn’t parse that as a playlist link</p>
            )}
            {clientId.trim() && !playlistInput.trim() && (
              <p className="note">waiting for a playlist url…</p>
            )}
            {shareLink && (
              <>
                <p className="success-msg">
                  send this to them. it includes the playlist <em>and</em> your client id.
                </p>
                <CopyField value={shareLink} />
                <p className="note">
                  they open it → log in with spotify once → playlist plays.
                  you only need to have whitelisted their email (step 3).
                </p>
                <div className="field-row" style={{ marginTop: '0.6rem' }}>
                  <a
                    className="btn-pixel"
                    href={shareLink}
                    style={{ textDecoration: 'none' }}
                  >
                    try the link yourself →
                  </a>
                </div>
              </>
            )}
          </section>
        </div>

        <p className="page-footer" style={{ marginTop: '1.5rem' }}>
          stuck? common issues: wrong redirect uri, partner not in user management,
          free account (premium required), or a stale share link missing client_id.
        </p>
      </div>
    </div>
  );
}

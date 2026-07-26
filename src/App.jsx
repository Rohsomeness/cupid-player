import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Landing from './pages/Landing.jsx';
import Setup from './pages/Setup.jsx';
import PlayerPage from './pages/PlayerPage.jsx';
import { handleCallback } from './spotify/auth.js';
import './pages.css';

function Callback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await handleCallback();
        if (cancelled) return;
        const next = sessionStorage.getItem('cupid_post_login') || '/play';
        sessionStorage.removeItem('cupid_post_login');
        const base = import.meta.env.BASE_URL.endsWith('/')
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;
        const path = next.startsWith('/') ? next.slice(1) : next;
        window.location.replace(`${window.location.origin}${base}${path}`);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <h1 className="brand-title">login failed</h1>
          <p className="muted brand-sub">{error}</p>
          <a className="btn-pixel" href={`${import.meta.env.BASE_URL}play`.replace(/([^:]\/)\/+/g, '$1')}>
            back to player
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-card">
        <p className="brand-sub">finishing spotify login…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/play" element={<PlayerPage />} />
      <Route path="/p/:playlistId" element={<PlayerPage />} />
      <Route path="/callback" element={<Callback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

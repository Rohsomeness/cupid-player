# cupid player (web)

Pixel-art Spotify player for the browser — set it up once, then share a playlist link.

Inspired by [cupidbity/cupid-music-player](https://github.com/cupidbity/cupid-music-player). This fork is **web-only**: Spotify Web Playback SDK (no Electron, no yt-dlp).

## Live

After deploy: **https://rohsomeness.github.io/cupid-player/**

## Two paths

| Path | Who | What |
|------|-----|------|
| `/setup` | You | Spotify developer app, whitelist partner, build share link |
| `/play?playlist=ID` | Partner | Log in once → play |

## Requirements

- **Spotify Premium** for anyone who wants in-browser audio
- App owner may need Premium (Spotify developer policy as of 2026)
- Partner email added under Dashboard → User Management (Development Mode)

## Local dev

```bash
cp .env.example .env
# put VITE_SPOTIFY_CLIENT_ID in .env
npm install
# for local base path:
VITE_BASE=/ npm run dev
```

Add redirect URI: `http://127.0.0.1:5173/callback`

## Deploy (GitHub Pages)

1. Push to `main`
2. Repo **Settings → Pages → Source: GitHub Actions**
3. Optional: add secret `VITE_SPOTIFY_CLIENT_ID` so partners don’t paste a client id
4. In Spotify Dashboard, add redirect:  
   `https://rohsomeness.github.io/cupid-player/callback`

## Share link format

```
https://rohsomeness.github.io/cupid-player/play?playlist=SPOTIFY_PLAYLIST_ID
```

Or use the generator on `/setup`.

## License / assets

Pixel assets and Rainyhearts font originate from the cupid music player project. Use respectfully; this is a fan web adaptation for personal gifting.

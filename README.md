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

Site is published from the `gh-pages` branch.

```bash
# optional: bake client id into the build (recommended for your partner)
export VITE_SPOTIFY_CLIENT_ID=your_id_here
npm run deploy
```

In Spotify Dashboard, add redirect URI:

`https://rohsomeness.github.io/cupid-player/callback`

(A GitHub Actions workflow file lives at `.github/workflows/deploy.yml` for optional CI deploy if your token has the `workflow` scope.)

## Share link format

```
https://rohsomeness.github.io/cupid-player/play?playlist=SPOTIFY_PLAYLIST_ID
```

Or use the generator on `/setup`.

## License / assets

Pixel assets and Rainyhearts font originate from the cupid music player project. Use respectfully; this is a fan web adaptation for personal gifting.

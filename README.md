# ReddID Love Button v2

Chrome / Firefox extension (Manifest V3) that lets you look up ReddID @handles and tip creators with RDD directly from your browser.

## Features

- **Popup search** — type any ReddID @handle to retrieve the linked RDD address
- **Auto-detection** — when you visit a creator's profile the extension shows a banner to look them up instantly
- **In-page tip buttons** — injects a "Tip with Ɍ RDD" button next to Follow/Subscribe on supported platforms
- **Copy to clipboard** — one-click copy of the RDD address or BIP21 URI
- **Open tip page** — jumps straight to the creator's public tip page on redd.love
- **On-chain balance** — fetches live balance from the ReddCoin block explorer
- **Transaction history** — shows the last 8 incoming tips from Blockbook v2 API
- **5-minute cache** — identity lookups cached in local storage; clears on settings save or manual purge

## Supported platforms (v2.5)

| Platform | Content script | Trigger URL pattern |
|----------|---------------|---------------------|
| Twitter / X | `content/twitter.js` | `twitter.com/{user}`, `x.com/{user}` |
| Reddit | `content/reddit.js` | `reddit.com/user/{u}`, `reddit.com/u/{u}` |
| YouTube | `content/youtube.js` | `youtube.com/@{handle}`, `/channel/`, `/c/`, `/user/` |
| Twitch | `content/twitch.js` | `twitch.tv/{channel}` |
| Instagram | `content/instagram.js` | `instagram.com/{user}` |
| TikTok | `content/tiktok.js` | `tiktok.com/@{user}` |
| Bluesky | `content/bluesky.js` | `bsky.app/profile/{handle}` |
| Mastodon | `content/mastodon.js` | `mastodon.social/@{user}` + 14 other instances |
| Rumble | `content/rumble.js` | `rumble.com/c/{channel}`, `/user/{u}` |
| TruthSocial | `content/truthsocial.js` | `truthsocial.com/@{user}` |
| Odysee | `content/odysee.js` | `odysee.com/@{user}` |
| Kick | `content/kick.js` | `kick.com/{channel}` |
| GitHub | `content/github.js` | `github.com/{user}` (profile only) |

## Install (development / unpacked)

1. Clone or copy this folder somewhere permanent on your machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select this folder (`love-button/`).
5. The REDD icon appears in your toolbar. Pin it for quick access.

**Firefox:** Run `npm run build:firefox` (requires Node.js), then load the generated `love-button-firefox/` folder as a temporary extension at `about:debugging`.

## Settings

Click the REDD icon → **Settings** (bottom-left of the popup) to open the options page.

| Setting | Default | Description |
|---------|---------|-------------|
| API base URL | `https://redd.love` | Root URL of the ReddID Next instance to query |
| Block explorer URL | `https://blockbook.reddcoin.com` | Blockbook v2 or Insight-compatible endpoint for on-chain data |

Change the API base to `http://localhost:3000` while developing against a local reddid-web instance.

## Build & package

```bash
npm install            # installs web-ext as a dev dep
npm run lint           # web-ext lint (Chrome + Firefox)
npm run build:chrome   # zips love-button/ → love-button-chrome-{version}.zip
npm run build:firefox  # copies + patches manifest → love-button-firefox/
```

## Development

### Project structure

```
love-button/
├── manifest.json              MV3 manifest
├── background.js              Service worker — API calls, caching, message router
├── popup.html                 Extension popup UI
├── popup.js                   Popup logic
├── options.html               Settings page
├── options.js                 Settings logic
├── lib/
│   └── reddid-platform-util.js  Shared content-script helpers
├── content/
│   ├── twitter.js
│   ├── reddit.js
│   ├── youtube.js
│   ├── twitch.js
│   ├── instagram.js
│   ├── tiktok.js
│   ├── bluesky.js
│   ├── mastodon.js
│   ├── rumble.js
│   ├── truthsocial.js
│   ├── odysee.js
│   ├── kick.js
│   └── github.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── store/                     Chrome Web Store / AMO listing assets
│   ├── README.md
│   ├── listing.md
│   └── screenshots.md
├── PLUGINS.md                 Plugin authoring specification
├── TESTING.md                 Manual test checklist
├── package.json
├── build-firefox.js           Firefox manifest patcher (run via npm run build:firefox)
└── gen-icons.js               One-off icon generator (Node.js)
```

### API contract

The extension expects the ReddID Next API to expose:

```
GET /api/identities/{handle}
→ {
    identity: {
      handle,
      displayName,
      bio,
      wallets: [{ chain, address, primary, revokedAt, visibility }, ...],
      rddAddress,      // v1 compat — may be null in v2 responses
      socialProofs: [{ platform, username, verificationStatus, proofUrl }, ...],
      ...
    }
  }
  or 404

GET /api/identities/by-social?platform={platform}&username={username}
→ { identity: { ... } }
  or 404
```

The extension reads the primary RDD wallet via `wallets[]` first, falling back to the `rddAddress` field for v1 API compatibility.

### Message types (popup / content → background)

| Type | Payload | Response |
|------|---------|----------|
| `LOOKUP_HANDLE` | `{ handle }` | `{ identity }` or `{}` |
| `LOOKUP_SOCIAL` | `{ platform, username }` | `{ identity }` or `{}` |
| `LOOKUP_ADDRESS_INFO` | `{ address }` | `{ info }` |
| `GET_API_BASE` | — | `{ base }` |
| `GET_EXPLORER_BASE` | — | `{ base }` |
| `GET_HISTORY` | — | `{ history }` |
| `ADD_TO_HISTORY` | `{ identity }` | `{ ok }` |
| `CLEAR_CACHE` | — | `{ ok }` |
| `CLEAR_PENDING` | — | `{ ok }` |

### Running a local ReddID Next instance

```bash
cd reddid-web
npm install
npm run dev
# Runs on http://localhost:3000
```

Then in extension settings, set API base to `http://localhost:3000`.

## Privacy

- No analytics, no telemetry.
- Handle lookups hit only the configured API base (default: `redd.love`).
- Block explorer queries hit the configured explorer base (default: `blockbook.reddcoin.com`).
- The extension requests `activeTab` (not `<all_urls>`) — tab URL is only read when the popup is open.
- Host permissions cover the 13 supported platforms for content script injection:
  `twitter.com`, `x.com`, `reddit.com`, `youtube.com`, `twitch.tv`, `instagram.com`,
  `tiktok.com`, `bsky.app`, 15 Mastodon instances, `rumble.com`, `truthsocial.com`,
  `odysee.com`, `kick.com`, `github.com`.
- No personal data is transmitted — only the handle or social username being looked up.
- Cache entries are stored in `chrome.storage.local` on-device and expire after 5 minutes.

## License

MIT — see repository root for full license text.

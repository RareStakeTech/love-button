# Changelog — ReddID Love Button

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.5.1] — 2026-05-25

### Changed
- **`store/listing.md`** — rewritten for v2.5.0 / 13 platforms; full permission justifications for `redd.love` and `blockbook.reddcoin.com`; explicit no-custody, no-keys, no-analytics language; permission-by-permission breakdown matching the Chrome Web Store review format
- **`store/screenshots.md`** — version references updated from 2.2.0 to 2.5.0; "6 platforms" expanded to "13 platforms" throughout; all screenshot scene descriptions updated to reflect current UI
- **`options.html`** — "Platforms supported" list updated to all 13 live platforms: X, Reddit, YouTube, Twitch, Instagram, TikTok, Bluesky, Mastodon, Rumble, TruthSocial, Odysee, Kick, GitHub
- **`README.md`** — Privacy section updated to list `redd.love` and `blockbook.reddcoin.com` as explicit host permissions with justifications; 13-platform support matrix reflects GitHub addition
- **`TESTING.md`** — sections renumbered; added section 10 (Host permissions — API + explorer), section 11 (Social proof label accuracy — 🔗 vs ○ labels); section 11 (Firefox-specific), section 12 (Chrome packaging)

---

## [2.5.0] — 2026-05-25

### Added
- **GitHub content script** (`content/github.js`) — detects GitHub user profile pages (`github.com/{username}`); uses `RESERVED` set to skip non-profile paths (login, explore, marketplace, etc.); injects Tip RDD button into `.js-profile-editable-area` sidebar with `.p-note` and `.js-profile-edit-toggle` fallbacks; floating fallback at `top:72px right:16px`; SPA-aware via `popstate` + `watchSpa(600ms)`
- **`package.json`** — formal devDependency on `web-ext ^8.3.0`; npm scripts: `lint` (Chrome), `lint:firefox` (builds Firefox folder then lints), `build:chrome` (web-ext zip with explicit `--ignore-files` to exclude dev files on Windows), `build:firefox` (Node.js patcher)
- **`.web-ext-ignore`** — Chrome build exclusion list (belt-and-suspenders alongside `--ignore-files` in `build:chrome`)
- **`build-firefox.js`** (rewritten) — now produces complete `love-button-firefox/` output directory by recursively copying all runtime files (excluding dev files via `EXCLUDE_NAMES` set); patches `manifest.json` in-place: converts `background.service_worker` → `background.scripts: [file]` (Firefox 109–120 compatibility), removes `"type":"module"` from background, overwrites `browser_specific_settings.gecko` block; omits `data_collection_permissions` (minItems:1 schema validation error until Mozilla publishes valid enum values); prints file count and testing instructions

### Changed
- **`manifest.json`** — version bumped to `2.5.0`; description shortened to 127 chars (`≤132` Chrome Web Store limit); `host_permissions` expanded to include `"https://redd.love/*"` and `"https://blockbook.reddcoin.com/*"` (required for cross-origin fetch from the service worker and popup in MV3); GitHub `content_scripts` and `host_permissions` entries added
- **`background.js`** — `primaryRddAddress(identity)` helper added: reads `identity.wallets[]` (v2 API) finding the primary non-revoked RDD wallet, then falls back to `identity.rddAddress` (v1 API); `ADD_TO_HISTORY` handler updated to store the resolved address via `primaryRddAddress()` instead of the bare `rddAddress` field
- **`popup.js`** — `primaryRddAddress()` helper added (matches background.js logic); `showResult()` now derives address via `primaryRddAddress(identity)` throughout; tab handler, copy address button, and `getBip21Uri()` all use `primaryRddAddress()`; social proof badge rendering updated: `verificationStatus === 'verified'` → `🔗` span with title "Proof URL on record (not independently verified)"; otherwise `○` "Self-reported" — removed misleading green checkmark
- **`popup.html`** — version badge updated to v2.5; CSS `.verified` (green checkmark) replaced with `.proof-linked` (muted, 9px) and `.self-reported` (dim, 9px)
- **`lib/reddid-platform-util.js`** — `tryLookup(platform, username, onFound)` now sends `GET_API_BASE` to the background service worker first, then passes `{ identity, apiBase }` (not just `{ identity }`) to the callback; this allows content scripts to respect the configured API base URL rather than hardcoding production
- **`content/bluesky.js`**, **`mastodon.js`**, **`rumble.js`**, **`truthsocial.js`**, **`odysee.js`**, **`kick.js`**, **`github.js`** — all updated from `({ identity })` to `({ identity, apiBase })` callback signature; pass `apiBase` to `ReddIDPlatformUtil.tipUrl(identity, apiBase)`; mastodon nested fallback lookup also updated to `({ identity: i2, apiBase: ab2 })`

### Fixed
- **Social proof "Verified" label** — popup previously displayed a green `✓` for proofs with `verificationStatus: 'verified'`, implying independent verification. The backend records challenge submission but does not independently verify the proof URL. Changed to `🔗` with tooltip "Proof URL on record (not independently verified)". Self-reported proofs (no status or `pending`) show `○`. The word "verified" is reserved for future v0.5 platform API verification.
- **Firefox background script format** — `build-firefox.js` now correctly converts `service_worker` to `scripts: [filename]` so the Firefox build is valid for Firefox 109+ (kept `strict_min_version: "109.0"` honest)
- **Chrome build included dev files** — `.web-ext-ignore` alone was not respected on Windows; `build:chrome` script now passes explicit `--ignore-files` flags to `web-ext build`
- **API base in content scripts** — tip URL in util-based content scripts previously hardcoded production `redd.love`; now fetches `GET_API_BASE` from background so custom API endpoints configured in Settings are respected

---

## [2.4.0] — 2026-05-25

### Added
- **Bluesky (AT Protocol) support** — `content/bluesky.js` detects `bsky.app/profile/{handle}` pages; tries `[data-testid="followBtn"]` and `[aria-label="Follow"]` selectors with floating fallback
- **Mastodon / ActivityPub support** — `content/mastodon.js` detects `/@username` on 15 curated instances; stores fully-qualified `user@instance.social` handle; double-lookup (full handle first, then local username) for maximum match rate
- **Rumble support** — `content/rumble.js` detects both `/c/{channel}` and `/user/{username}` patterns; targets creator header action area
- **TruthSocial support** — `content/truthsocial.js` detects `/@username` (Mastodon-fork); reuses Mastodon-style DOM selectors with TruthSocial-specific additions
- **Odysee support** — `content/odysee.js` detects `/@ChannelName:claimId?` pattern; strips claim ID for lookup; targets `.channel-header__actions` and siblings
- **Kick support** — `content/kick.js` detects `/{username}` root-path streamer pages; targets subscribe/follow button container
- **`lib/reddid-platform-util.js`** — shared utility library (`window.ReddIDPlatformUtil`) with: `createButton()`, `floatingButton()`, `waitForElement()`, `removeButton()`, `watchSpa()`, `lookupSocial()`, `lookupHandle()`, `tryLookup()`, `tipUrl()` — eliminates per-script boilerplate
- **`PLUGINS.md`** — formal plugin specification v1.0: contract, API reference, step-by-step guide with full code template, federated-platform guidance, 15-item platform checklist, submission process

### Changed
- `manifest.json` bumped to `2.4.0`; added `content_scripts` and `host_permissions` entries for all 6 new platforms; Mastodon list covers 15 popular instances; all new scripts load `lib/reddid-platform-util.js` as a dependency before the platform script; extension description updated to list all supported platforms
- `popup.js` — `PLAT_ICONS` extended with icons for `bluesky` (☁), `mastodon` (🐘), `rumble` (▣), `truthsocial` (◉), `odysee` (◎), `kick` (⚡), `github` (⌥); `detectPlatform()` extended to detect all 6 new platforms plus GitHub from the current tab URL, enabling the auto-lookup detected-banner for these platforms

---

## [2.3.0] — 2026-05-25

### Added
- **Transactions tab** — second tab ("Transactions") in result card fetches `Blockbook v2 /api/v2/address/{addr}?details=txs&pageSize=10`; filters to incoming vouts only; renders up to 8 entries with amount, relative timestamp, and truncated txid linking to Blockbook; lazy-loads only when tab is clicked; does not re-fetch within the same result session
- **Social proof badges** — `social-proofs` section above tab bar renders a chip for each linked platform with icon + username; verified proofs (those with `proofUrl` set) display a green `✓` checkmark badge

### Changed
- `manifest.json` version bumped to `2.3.0`
- `popup.html` — added `tab-bar` (Profile | Transactions), `tab-panel` wrappers, `social-proofs` container, `txn-list`/`txn-loading` elements; new CSS for `.tab-btn`, `.tab-panel`, `.social-badge`, `.txn-item`, `.txn-loading`, `.txn-empty`
- `popup.js` — added `renderSocialProofs()`, `loadTxns()`, `resetTabs()`; tab-switching logic wires `.tab-btn` click to panel visibility + lazy transaction fetch; `txnsLoaded` guard prevents duplicate fetches; `showResult()` and `clearBtn` handler updated to call new helpers; version label updated to v2.3

---

## [2.2.0] — 2026-05-25

### Added
- **TikTok support** — `content/tiktok.js` detects `tiktok.com/@username` profile pages;
  multi-strategy insertion (`data-e2e` selectors + Follow button fallback); floating fallback
  button at `top:72px right:16px` when native point unavailable; MutationObserver +
  `setInterval(600ms)` + `popstate` for SPA navigation
- **Firefox compatibility** — `browser_specific_settings.gecko` block in `manifest.json`
  (id: `reddid-tipbutton@rarestaketech.com`, min: 109.0); removed `"type":"module"` from
  background entry (Firefox MV3 doesn't require it for plain scripts)
- **`build-firefox.js`** — Node.js script that generates `manifest.firefox.json` with
  Firefox-specific patches; prints step-by-step testing and AMO submission instructions
- **Tip amount pre-selection** — Popup now includes 100 / 500 / 1K / 5K / custom Ɍ chip
  selector above the BIP21 buttons; selected amount is appended as `?amount=X` to the
  `reddcoin:` URI for both "Open in wallet" and "Copy Ɍ URI" flows; resets on clear/new result
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — four jobs: manifest validation,
  file existence check (content scripts + icons), ESLint, Firefox manifest generation + validation
- **Store assets** (`store/listing.md`, `store/screenshots.md`) — full Chrome Web Store
  listing copy (description, permissions justification, privacy policy), screenshot guide
  with 5 scenes and promotional tile spec

### Changed
- `manifest.json` version bumped to `2.2.0`
- `popup.js`: TikTok added to tab detection (`detectPlatform()`); `selectedAmount` state
  tracks chosen tip amount; `getBip21Uri()` appends amount param when set

---

## [2.1.1] — 2026-05-25

### Changed
- Default block explorer changed from `live.reddcoin.com` to **`blockbook.reddcoin.com`** (Blockbook v2 API)
- `lookupAddressInfo` now tries Blockbook v2 (`/api/v2/address/{address}`) first and falls back to Insight (`/api/addr/{address}`) for self-hosted nodes — balances from Blockbook are parsed as satoshi strings and converted to RDD (÷ 10⁸)
- Options page placeholder and hint updated to reflect Blockbook as the default; clarifies dual-format support

---

## [2.1.0] — 2026-05-25

### Added
- **Twitch support** — `content/twitch.js` detects channel pages and injects Tip RDD button near Subscribe/Follow area; handles SPA navigation via `popstate` + MutationObserver
- **Instagram support** — `content/instagram.js` with multi-strategy DOM insertion; floating fixed-position fallback button (`top: 72px; right: 16px`) when native insertion point not found; URL-change polling for SPA navigation
- **Context menu** — right-click any selected @handle on the web → "Look up ReddID: …"; result pre-loaded into popup via `pendingQuery`/`pendingResult` in local storage; opens popup via `chrome.action.openPopup()` (Chrome 127+) with new-tab fallback
- **Keyboard shortcut** — `Alt+Shift+R` (`_execute_action` command) to open the popup from anywhere
- **On-chain balance display** — popup fetches address data async from block explorer after showing identity result; displays balance, total received, and transaction count
- **Handle history** — last 10 looked-up handles stored in `chrome.storage.local`; rendered in popup with relative timestamps; each entry re-triggers lookup on click
- **BIP21 wallet URI** — "Open in wallet" opens `reddcoin:{address}` deep link; "Copy Ɍ URI" copies the URI to clipboard
- **Copy @handle** — dedicated button copies `@handle` to clipboard with green flash feedback
- **Address type badge** — popup shows "Legacy" (blue) for `R…` addresses and "SegWit" (purple) for `rdd1…` bech32 addresses
- **Detected-banner** — popup auto-detects current tab's platform and shows a click-to-lookup banner for Twitter/X, Reddit, YouTube, Twitch, Instagram
- New background message types: `LOOKUP_ADDRESS_INFO`, `GET_EXPLORER_BASE`, `GET_HISTORY`, `ADD_TO_HISTORY`, `CLEAR_PENDING`

### Changed
- **popup.html** redesigned to 340 px width with address section, balance section, BIP21 row, history section, and footer
- **popup.js** fully rewritten — state machine, pending-result on open, async balance, tab detection across all 5 platforms, full BIP21 and copy flows
- **background.js** rewritten — Insight API balance fetching with 2-min cache, handle history (max 10), selective `CLEAR_CACHE` (preserves settings + history), configurable explorer base URL
- **options.html/js** — brand color corrected (`#CC1111` → `#E30613`); block explorer URL field added; storage split corrected (`apiBase` → `chrome.storage.sync`, `explorerBase` → `chrome.storage.local`); cache count uses correct key prefixes
- **content/twitter.js** — brand color fixed; RESERVED set expanded; `trySocial() ?? tryDirect()` lookup chain
- **content/reddit.js** — brand color fixed; added `shreddit-profile-info` selector for new Reddit Shreddit UI
- **content/youtube.js** — brand color fixed

### Fixed
- Brand red was `#CC1111` across all content scripts and options page; corrected to `#E30613` everywhere

---

## [2.0.0] — 2026-05-25

### Added
- Initial Manifest V3 Chrome extension
- Content scripts for Twitter/X, Reddit, and YouTube — detect creator profile pages and inject "Tip with RDD" button near Follow/Subscribe
- Service worker (`background.js`) with identity lookup via ReddID API, 5-minute cache in `chrome.storage.local`, configurable API base URL
- Popup with handle search, result display (name, bio, RDD address), copy address, open tip page
- Options page with API base URL field, cache info, clear cache action
- `LOOKUP_HANDLE` and `LOOKUP_SOCIAL` message types (LOOKUP_SOCIAL returns null pending v0.2 API endpoint)

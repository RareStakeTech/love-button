# Changelog — ReddID Love Button

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

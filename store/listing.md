# Chrome Web Store / Firefox AMO — ReddID Love Button

## Extension name
ReddID — Tip with RDD

## Short description (132 chars max)
Ɍ RDD tips for creators on X, Reddit, YouTube, Twitch, Instagram, TikTok, Bluesky, Mastodon, Rumble, GitHub & more. Via ReddID.

## Full description

ReddID Love Button automatically detects creator profiles on 13 social platforms and adds a native Ɍ RDD tipping button — no wrapped tokens, no custodian, just real ReddCoin on the base chain.

**Platforms supported (v2.5):**
• Twitter / X
• Reddit
• YouTube
• Twitch
• Instagram
• TikTok
• Bluesky (AT Protocol)
• Mastodon / ActivityPub (top instances)
• Rumble
• TruthSocial
• Odysee (LBRY)
• Kick
• GitHub

**Features:**
• One-click @handle lookup via ReddID identity registry (redd.love)
• Live on-chain balance and tip history from blockbook.reddcoin.com (Blockbook v2 API)
• Tip amount pre-selection: 100 / 500 / 1K / 5K Ɍ or custom
• BIP21 wallet URI — opens directly in any ReddCoin wallet app
• Recent lookup history (last 10 handles)
• Right-click any selected @handle → "Look up ReddID"
• Keyboard shortcut: Alt+Shift+R
• Tab auto-detection: popup shows a click-to-look-up banner for the current creator page
• Configurable API and block explorer endpoints (supports self-hosted nodes)

**What is ReddCoin (RDD)?**
ReddCoin is the social cryptocurrency — built for tipping, rewarding, and engaging with creators. Proof of Stake Velocity (PoSV) rewards active participants. Native on-chain, no bridge or custodian required.

**What is ReddID?**
ReddID is a non-custodial identity layer for ReddCoin. Creators register a short @handle linked to their RDD address, making it easy for fans to find and tip them across any platform. Register free at redd.love.

**Privacy:**
No user data is collected or transmitted beyond what is necessary for handle lookups. All API calls go directly to:
• redd.love — identity lookups
• blockbook.reddcoin.com — on-chain balance and transaction data (configurable)

No analytics, no tracking, no third-party telemetry. Lookups are cached on-device for 5 minutes.

**No custody, no private keys:**
The extension never stores, transmits, or accesses private keys or seed phrases. Tips are sent by the user's own wallet application, opened via a BIP21 URI. ReddID is a directory service only.

**Open source:**
github.com/RareStakeTech/love-button

---

## Category
Productivity

## Tags (5 max)
reddcoin, crypto, tip, creator, rdd

## Privacy policy URL
https://redd.love/privacy

## Homepage URL
https://redd.love

## Support URL
https://github.com/RareStakeTech/love-button/issues

---

## Justification for permissions

**storage**
Saves cached identity lookups (5-min TTL), block explorer URL setting, API base URL setting, and recent lookup history. No personal data is stored. All data stays on-device.

**activeTab**
Reads the URL of the currently active tab to detect if the user is on a supported creator profile page, enabling the auto-detection banner in the popup. Only accessed when the popup is open.

**contextMenus**
Adds a "Look up ReddID: …" item to the right-click context menu when text is selected, allowing quick handle lookups from any webpage.

**host_permissions — social platforms**
Required for content script injection on 13 supported platforms. Scripts run only on creator profile pages and only inject the "Tip with Ɍ RDD" button. No data is read from these pages beyond the URL pathname used for username detection.

Covered domains: twitter.com, x.com, reddit.com, youtube.com, twitch.tv, instagram.com, tiktok.com, bsky.app, mastodon.social + 14 other Mastodon instances, rumble.com, truthsocial.com, odysee.com, kick.com, github.com.

**host_permissions — redd.love**
Required for the popup and background service worker to call the ReddID identity API (GET /api/identities/{handle}, GET /api/identities/by-social). This is the only origin that receives handle lookup requests. Users may override this with a self-hosted endpoint in Settings.

**host_permissions — blockbook.reddcoin.com**
Required for the popup and service worker to fetch on-chain balance and transaction data from the ReddCoin Blockbook v2 API. No wallet credentials or private keys are involved. Users may configure a self-hosted explorer in Settings; this host_permission covers the public default.

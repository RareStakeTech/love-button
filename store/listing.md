# Chrome Web Store — ReddID Love Button

## Extension name
ReddID — Tip with RDD

## Short description (132 chars max)
Tip your favorite creators with Ɍ ReddCoin on Twitter/X, Reddit, YouTube, Twitch, Instagram, and TikTok.

## Full description

ReddID Love Button automatically detects creator profiles on your favorite social platforms and adds a native Ɍ RDD tipping button — no wrapped tokens, no custodian, just real ReddCoin on the base chain.

**Platforms supported:**
• Twitter / X
• Reddit
• YouTube
• Twitch
• Instagram
• TikTok

**Features:**
• One-click @handle lookup via ReddID Next identity registry (redd.love)
• Live on-chain balance from blockbook.reddcoin.com (Blockbook v2 API)
• Tip amount pre-selection: 100 / 500 / 1K / 5K Ɍ or custom
• BIP21 wallet URI — opens directly in any ReddCoin wallet app
• Recent lookup history (last 10 handles)
• Right-click any selected @handle → "Look up ReddID"
• Keyboard shortcut: Alt+Shift+R
• Tab auto-detection: popup shows a click-to-look-up banner for the current creator page
• Configurable block explorer and API endpoints (self-hosted node support)

**What is ReddCoin (RDD)?**
ReddCoin is the social cryptocurrency — built for tipping, rewarding, and engaging with the creators you love. Proof of Stake Velocity (PoSV) rewards holders who actively participate in the ecosystem. Native on-chain, no bridge or custodian required.

**What is ReddID?**
ReddID Next is a decentralised identity layer for ReddCoin. Creators register a short @handle linked to their RDD address, making it easy for fans to find and tip them across any platform. Register free at redd.love.

**Privacy:**
No user data is collected or transmitted beyond what is necessary for handle lookups. All API calls go directly to redd.love (ReddID Next) and blockbook.reddcoin.com. No analytics, no tracking, no third-party telemetry.

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

**storage** — Saves cached identity lookups (5-min TTL), block explorer URL setting, API base URL setting, and recent lookup history. No personal data is stored.

**activeTab** — Reads the URL of the currently active tab to detect if the user is on a supported creator profile page, enabling the auto-detection banner in the popup.

**contextMenus** — Adds a "Look up ReddID: …" item to the right-click context menu when text is selected, allowing quick handle lookups from any webpage.

**host_permissions (social platforms)** — Required for content script injection on supported platforms (Twitter/X, Reddit, YouTube, Twitch, Instagram, TikTok). Scripts only activate on creator profile pages and only inject the Tip RDD button.

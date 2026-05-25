# ReddID Love Button — Platform Plugin Specification v1.0

This document is the canonical reference for adding new social platform support to the ReddID Love Button browser extension. Anyone — internal team or open-source contributor — can add a platform by following this spec.

---

## Table of contents

1. [Overview](#overview)
2. [Plugin contract](#plugin-contract)
3. [Shared utility library](#shared-utility-library)
4. [Step-by-step: adding a new platform](#step-by-step-adding-a-new-platform)
5. [Manifest entry](#manifest-entry)
6. [Federated / multi-instance platforms](#federated--multi-instance-platforms)
7. [Platform checklist](#platform-checklist)
8. [Submitting a plugin](#submitting-a-plugin)
9. [Platform registry reference](#platform-registry-reference)

---

## Overview

Each platform is implemented as a standalone **content script** (`content/{platform}.js`) plus a **manifest entry** that declares which URLs the script runs on. Scripts communicate with the background service worker via `chrome.runtime.sendMessage()` and share a common utility library (`lib/reddid-platform-util.js`).

The architecture is intentionally simple:

```
manifest.json
  └─ content_scripts[n]
       ├─ matches: ["*://bsky.app/*"]
       └─ js: ["lib/reddid-platform-util.js", "content/bluesky.js"]
```

No bundler required. Each script is plain ES5-compatible JavaScript so it loads in both Chrome and Firefox MV3 environments.

---

## Plugin contract

Every content script **MUST** implement the following behaviour:

### 1. Profile detection

```js
/**
 * Inspect the current URL and return a { username } object if this is a
 * creator profile page for this platform, or null otherwise.
 *
 * @param {URL} url - the current page URL
 * @returns {{ username: string } | null}
 */
function detectProfile(url) { ... }
```

Rules:
- Strip leading `@` from handles before returning
- Return `null` on non-profile pages (feeds, search, settings, etc.)
- Include a `RESERVED` set of path segments that should never match (see existing scripts for examples)
- For **federated platforms** (Mastodon), return the fully-qualified handle: `"user@instance.social"`

### 2. Button injection

```js
/**
 * Inject the "Tip with Ɍ RDD" button into the page DOM.
 * MUST be idempotent — calling this multiple times should not duplicate the button.
 *
 * @param {string} username  - as returned by detectProfile()
 * @param {string} address   - the creator's RDD address (from the API)
 * @param {string} tipUrl    - full URL to the creator's tip page
 * @returns {void}
 */
function injectButton(username, address, tipUrl) { ... }
```

Rules:
- Check for an existing button (`document.getElementById('reddid-tip-btn')`) before injecting
- Use the shared `ReddIDPlatformUtil.createButton(tipUrl, label)` helper (see below)
- Provide a **floating fallback** (`position: fixed; top: 72px; right: 16px`) when the native insertion point cannot be found
- The button ID **must** be `reddid-tip-btn` (allows the utility to detect duplicates)

### 3. SPA navigation

Single-page apps navigate without full page reloads. Scripts **MUST** handle this:

```js
// Minimum required: listen for popstate
window.addEventListener('popstate', () => { cleanup(); tryInject(); });

// Recommended: also use MutationObserver or setInterval polling
// Use ReddIDPlatformUtil.watchSpa(callback, intervalMs) for the standard pattern
```

### 4. Cleanup

```js
/**
 * Remove injected elements and cancel any pending timers/observers.
 */
function cleanup() {
  const btn = document.getElementById('reddid-tip-btn');
  if (btn) btn.remove();
  // cancel any MutationObserver / setInterval
}
```

---

## Shared utility library

`lib/reddid-platform-util.js` is automatically available to all content scripts (it's listed first in the `js` array of every manifest entry). Do not re-implement these helpers.

```js
ReddIDPlatformUtil.createButton(tipUrl, label)
// Creates and returns a styled <a> element pointing to tipUrl.
// label defaults to "Tip with Ɍ RDD"
// The element has id="reddid-tip-btn"

ReddIDPlatformUtil.lookupSocial(platform, username, onFound)
// Calls the ReddID API (LOOKUP_SOCIAL → background.js → /api/identities/by-social)
// Invokes onFound({ identity }) when a match exists.
// platform: string (e.g. "bluesky"), username: string

ReddIDPlatformUtil.lookupHandle(handle, onFound)
// Calls the ReddID API (LOOKUP_HANDLE → background.js) and invokes onFound({ identity })

ReddIDPlatformUtil.waitForElement(selector, callback, maxWaitMs)
// Polls the DOM at 200ms intervals until selector matches, then invokes callback(el).
// Stops polling after maxWaitMs (default: 8000ms).

ReddIDPlatformUtil.watchSpa(callback, intervalMs)
// Combines MutationObserver (subtree, childList) + setInterval for SPA nav detection.
// Calls callback() on every navigation change detected.
// Returns a cleanup function.

ReddIDPlatformUtil.floatingButton(tipUrl)
// Injects the button at position: fixed; top: 72px; right: 16px
// Used as a fallback when the native insertion point is not found.
```

---

## Step-by-step: adding a new platform

### Step 1 — Create `content/{platform}.js`

```js
'use strict';
// ── {PlatformName} content script ──────────────────────────────────────────
// Detects {platform.com} creator profile pages and injects the ReddID tip button.

const PLATFORM_ID = 'newplatform';

// Path segments that are NOT user profiles
const RESERVED = new Set([
  'about', 'login', 'register', 'settings', 'help', 'legal', 'privacy',
  'terms', 'explore', 'trending', 'search', 'notifications',
  // add platform-specific reserved paths here
]);

function detectProfile(url) {
  // --- example for a simple /username pattern ---
  const m = url.pathname.match(/^\/([A-Za-z0-9_.-]{1,50})\/?$/);
  if (!m || RESERVED.has(m[1].toLowerCase())) return null;
  return { username: m[1] };
}

let stopSpaWatch = null;

function cleanup() {
  const btn = document.getElementById('reddid-tip-btn');
  if (btn) btn.remove();
}

function tryInject() {
  cleanup();
  const detected = detectProfile(new URL(location.href));
  if (!detected) return;
  const { username } = detected;

  // Try social-proof lookup first, then fallback to handle === username
  ReddIDPlatformUtil.lookupSocial(PLATFORM_ID, username, ({ identity }) => {
    if (!identity) {
      ReddIDPlatformUtil.lookupHandle(username.toLowerCase(), ({ identity: i2 }) => {
        if (i2) inject(username, i2);
      });
      return;
    }
    inject(username, identity);
  });
}

function inject(username, identity) {
  const tipUrl = `https://redd.love/${identity.handle}`;

  // Try native insertion point
  ReddIDPlatformUtil.waitForElement('.follow-button-container', el => {
    if (document.getElementById('reddid-tip-btn')) return;
    const btn = ReddIDPlatformUtil.createButton(tipUrl);
    el.parentNode.insertBefore(btn, el.nextSibling);
  });

  // Floating fallback after 3s
  setTimeout(() => {
    if (!document.getElementById('reddid-tip-btn')) {
      ReddIDPlatformUtil.floatingButton(tipUrl);
    }
  }, 3000);
}

// ── Init ────────────────────────────────────────────────────────────────────

tryInject();
window.addEventListener('popstate', tryInject);
stopSpaWatch = ReddIDPlatformUtil.watchSpa(tryInject, 600);
```

### Step 2 — Add the manifest entry

In `manifest.json`, add to `content_scripts`:

```json
{
  "matches": ["*://newplatform.com/*"],
  "js": ["lib/reddid-platform-util.js", "content/newplatform.js"],
  "run_at": "document_idle"
}
```

And to `host_permissions`:

```json
"*://newplatform.com/*"
```

### Step 3 — Add to the popup's `detectPlatform()`

In `popup.js`, inside the `detectPlatform(url)` function:

```js
if (h === 'newplatform.com') {
  const m = p.match(/^\/([A-Za-z0-9_.-]{1,50})\/?$/);
  if (m && !RESERVED.has(m[1].toLowerCase()))
    return { platform: 'newplatform', username: m[1] };
}
```

### Step 4 — Add the platform icon

In both `popup.js` (the `PLAT_ICONS` object) and `content/newplatform.js`:

```js
const PLAT_ICONS = {
  // ... existing
  newplatform: '◎',   // choose a descriptive Unicode symbol
};
```

### Step 5 — Add to reddid-web

In `src/lib/platforms.ts`, add a `PlatformDef` entry. This controls the register page form, social proof badges, and OG images.

---

## Manifest entry

The minimum manifest entry for a simple platform:

```json
{
  "matches": ["*://platform.com/*"],
  "js": ["lib/reddid-platform-util.js", "content/platform.js"],
  "run_at": "document_idle"
}
```

For platforms with subdomains or alternate TLDs:

```json
{
  "matches": [
    "*://platform.com/*",
    "*://*.platform.com/*"
  ],
  "js": ["lib/reddid-platform-util.js", "content/platform.js"],
  "run_at": "document_idle"
}
```

For **federated platforms** (Mastodon instances), list each known instance separately or use the `optional_host_permissions` mechanism with dynamic injection (see Federated section below).

---

## Federated / multi-instance platforms

### Mastodon / ActivityPub

Mastodon and compatible ActivityPub servers (Pixelfed, PeerTube, Friendica) can run on any domain. The detection heuristic is:

1. Path matches `/@username` (most Mastodon/ActivityPub profiles use this pattern)
2. The domain is either in the hardcoded known-instances list OR has returned a positive response to `/.well-known/nodeinfo`

Since content scripts cannot make cross-origin requests to arbitrary domains, we use **approach (1)** with a curated known-instances list in `manifest.json`, and expose an options-page setting for users to add custom instances.

```json
{
  "matches": [
    "*://mastodon.social/*",
    "*://mastodon.online/*",
    "*://fosstodon.org/*",
    "*://infosec.exchange/*",
    "*://mstdn.social/*",
    "*://hachyderm.io/*",
    "*://techhub.social/*",
    "*://mastodon.world/*",
    "*://aus.social/*",
    "*://social.coop/*"
  ],
  "js": ["lib/reddid-platform-util.js", "content/mastodon.js"],
  "run_at": "document_idle"
}
```

The handle returned is the fully-qualified `user@instance.social` form, which is stored as the `username` in the social proof entry.

### AT Protocol (Bluesky)

Bluesky operates through `bsky.app` for the primary client but AT Protocol supports custom PDS hosts. For the initial implementation, target only `bsky.app`. Profile URLs are `bsky.app/profile/{did-or-handle}`.

### Nostr

Nostr has many clients (iris.to, primal.net, snort.social, nostrudel.ninja). Each client is added as a separate content script entry. The username stored is the `npub` (public key) or the NIP-05 identifier.

---

## Platform checklist

Before submitting a plugin, verify all of the following:

- [ ] `detectProfile()` returns `null` for non-profile pages (home feed, settings, search, notifications)
- [ ] `detectProfile()` handles the platform's SPA navigation (test by navigating between profiles without page reload)
- [ ] Button is not injected on your own profile page (optional but ideal — requires knowing the logged-in user)
- [ ] Button is idempotent — navigating to the same profile twice does not show two buttons
- [ ] Floating fallback appears within 3s when native insertion fails
- [ ] Button links to the correct `redd.love/{handle}` tip page
- [ ] Works with no registered ReddID (button does not appear — silent fail is correct)
- [ ] Tested on Chrome 120+ and Firefox 109+
- [ ] No `console.error()` output in normal operation
- [ ] `PLATFORM_ID` matches the string stored in `socialProofs[].platform` in the ReddID registry
- [ ] `manifest.json` entry added to both `content_scripts` and `host_permissions`
- [ ] `popup.js` `detectPlatform()` updated
- [ ] `src/lib/platforms.ts` entry added in reddid-web

---

## Submitting a plugin

1. Fork [github.com/RareStakeTech/love-button](https://github.com/RareStakeTech/love-button)
2. Create a branch: `feat/platform-{platformname}`
3. Add your content script + manifest entry following this spec
4. Open a pull request with:
   - Platform name and URL
   - Screenshot of the button injected on a real profile
   - Notes on any non-standard SPA navigation behaviour
5. The PR description must include a completed [Platform checklist](#platform-checklist)

Plugins are reviewed for:
- Correct detection (no false positives on non-profile pages)
- Brand compliance (button style must match the existing design)
- Security (no data exfiltration, no third-party requests outside blockbook/reddid API)

---

## Platform registry reference

| ID | Platform | Status | Notes |
|----|----------|--------|-------|
| `twitter` | Twitter / X | ✅ Live | `x.com` + `twitter.com` |
| `youtube` | YouTube | ✅ Live | `/@handle` pattern |
| `reddit` | Reddit | ✅ Live | Shreddit UI + old Reddit |
| `twitch` | Twitch | ✅ Live | Channel pages |
| `instagram` | Instagram | ✅ Live | Floating fallback |
| `tiktok` | TikTok | ✅ Live | `/@username` |
| `github` | GitHub | ✅ Live | User + org profiles |
| `bluesky` | Bluesky (AT Protocol) | ✅ Live | `bsky.app` |
| `mastodon` | Mastodon / ActivityPub | ✅ Live | Top-10 instances; more via options |
| `rumble` | Rumble | ✅ Live | `rumble.com/c/` + `/user/` |
| `truthsocial` | TruthSocial | ✅ Live | `truthsocial.com/@` |
| `odysee` | Odysee (LBRY) | ✅ Live | `odysee.com/@` |
| `kick` | Kick | ✅ Live | `kick.com/` |
| `nostr` | Nostr | 🔜 Planned | Multiple clients; npub / NIP-05 ID |
| `farcaster` | Farcaster | 🔜 Planned | `warpcast.com` |
| `substack` | Substack | 🔜 Planned | Newsletter handle type |
| `linkedin` | LinkedIn | 🔜 Planned | `/in/username` |
| `minds` | Minds | 🔜 Planned | Crypto-native |
| `locals` | Locals.com | 🔜 Planned | Creator communities |
| `cohost` | Cohost | 🔜 Planned | Artist/creator focus |

# ReddID Love Button — Manual Test Checklist

Run this checklist before every store submission or major release.
Test on both Chrome (latest stable) and Firefox (latest stable + ESR).

Mark each item: ✅ pass · ❌ fail (note the bug) · ⏭ skipped (explain why)

---

## Environment setup

- [ ] Chrome: `chrome://extensions/` → Developer mode ON → Load unpacked → select `love-button/`
- [ ] Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json` inside `love-button-firefox/` (built via `npm run build:firefox`)
- [ ] Local reddid-web running at `http://localhost:3000` with at least one registered test handle
- [ ] Test handle has: RDD address, at least one social proof (one self-reported, one challenge-verified if possible), bio set

---

## 1. Extension loads without errors

- [ ] Extension icon appears in toolbar (Chrome) / toolbar overflow (Firefox)
- [ ] No errors in `chrome://extensions/` error badge (Chrome)
- [ ] No errors in `about:debugging` console (Firefox)
- [ ] Background service worker starts cleanly — check DevTools → Service Workers

---

## 2. Popup — idle state

- [ ] Opens without JavaScript errors (check DevTools console)
- [ ] Search input is focused automatically
- [ ] History section hidden when no previous lookups exist
- [ ] "Settings" link opens options page in new tab

---

## 3. Popup — handle lookup (happy path)

- [ ] Type a registered handle (with or without `@` prefix) → Enter → result shows
- [ ] Handle, display name, and bio display correctly
- [ ] RDD address shows (from `wallets[]` primary RDD wallet, or `rddAddress` fallback)
- [ ] Address type badge shows correctly (P2PKH / P2SH / bech32)
- [ ] Social proof badges show with correct platform icons
- [ ] Self-reported proofs show `○` (Self-reported) marker
- [ ] Challenge-verified proofs show `✓` (Challenge verified) marker
- [ ] Balance tab shows on-chain balance (or graceful error if blockbook unreachable)
- [ ] Txns tab loads last 8 incoming transactions (or "No incoming tips" if empty)
- [ ] Copy address button copies RDD address to clipboard
- [ ] Copy `@ Handle` button copies `@handle` to clipboard
- [ ] Copy Ɍ URI button copies `reddcoin:{address}` (or `reddcoin:{address}?amount={n}` with chip selected)
- [ ] Open tip page button opens `https://redd.love/{handle}` in new tab
- [ ] History entry added for this lookup

---

## 4. Popup — handle lookup (not found)

- [ ] Unregistered handle shows error state: "@handle is not registered on ReddID."
- [ ] Error state has no broken UI elements
- [ ] Back/clear clears to idle state

---

## 5. Popup — auto-detection banner

- [ ] Visit a supported platform profile URL → open popup → detected banner appears
- [ ] Banner text: "{username} on {platform} — click to look up"
- [ ] Clicking banner triggers lookup (same as typing the handle)
- [ ] Visiting a non-profile page → no banner shown

---

## 6. In-page tip button — all 13 platforms

For each platform, visit a creator profile that has a registered ReddID, verify the button appears.

| Platform | Profile URL pattern | Button location | ✅/❌ |
|----------|--------------------|-----------------|----|
| Twitter / X | `x.com/{user}` | Next to Follow button | |
| Reddit | `reddit.com/user/{u}` | Near profile actions | |
| YouTube | `youtube.com/@{handle}` | Near Subscribe button | |
| Twitch | `twitch.tv/{channel}` | Near Follow button | |
| Instagram | `instagram.com/{user}` | Floating or near Follow | |
| TikTok | `tiktok.com/@{user}` | Near Follow button | |
| Bluesky | `bsky.app/profile/{handle}` | Next to Follow button | |
| Mastodon | `mastodon.social/@{user}` | Near Follow button | |
| Rumble | `rumble.com/c/{channel}` | Near Subscribe button | |
| TruthSocial | `truthsocial.com/@{user}` | Near Follow button | |
| Odysee | `odysee.com/@{user}` | Near Follow/Subscribe | |
| Kick | `kick.com/{channel}` | Near Follow button | |
| GitHub | `github.com/{user}` | In profile sidebar | |

Additional checks per platform:
- [ ] Button does **not** appear on non-profile pages (feeds, settings, search, repos)
- [ ] Button is idempotent — navigating to the same profile twice shows only one button
- [ ] Button disappears when navigating away (SPA navigation cleanup)
- [ ] Button does **not** appear for creators with no ReddID registration (silent fail)
- [ ] Floating fallback button appears within 3 seconds when native insertion point is not found

---

## 7. Context menu

- [ ] Right-click a selected handle text (e.g., `@creator`) → "Look up ReddID: @creator" appears
- [ ] Clicking menu item: if found, pending result stored and popup shows result on open
- [ ] Clicking menu item: if not found, popup shows "not registered" error

---

## 8. Settings page

- [ ] Opens via popup "Settings" link
- [ ] API base URL saves and persists across browser restarts
- [ ] Block explorer URL saves and persists
- [ ] Reset to defaults restores `redd.love` and `blockbook.reddcoin.com`
- [ ] Cache count shows number of cached entries
- [ ] Clear cache removes all `handle:`, `social:`, and `explorer:` keys
- [ ] Settings page works with keyboard (Tab, Enter)

---

## 9. Rate limits and edge cases

- [ ] Rapidly opening multiple lookups does not cause duplicate history entries
- [ ] Malformed handle input is sanitized (only `a-z0-9-` allowed)
- [ ] Empty handle does not trigger a lookup
- [ ] Very long display names / bios do not break the popup layout

---

## 10. Identity schema compatibility

- [ ] Extension works against a **v1 API** response (bare `rddAddress` field, no `wallets[]`)
- [ ] Extension works against a **v2 API** response (`wallets[]` array, `rddAddress` may be null)
- [ ] Balance lookup uses correct address in both cases
- [ ] BIP21 URI uses correct address in both cases
- [ ] History stores the resolved address (not null)

---

## 11. Firefox-specific

- [ ] `npm run build:firefox` completes without errors
- [ ] Resulting `love-button-firefox/` manifest has `browser_specific_settings.gecko` intact
- [ ] Popup opens correctly in Firefox
- [ ] Content scripts inject on all 13 platforms
- [ ] `web-ext lint` reports 0 errors (warnings are acceptable)

---

## 12. Chrome packaging

- [ ] `npm run build:chrome` (or manual zip) produces a valid zip
- [ ] Zip uploaded to Chrome Web Store developer dashboard passes automated review checks
- [ ] No sensitive files included: `.web-ext-ignore`, `package.json`, `node_modules/`, `*.zip`, `store/`

---

## Sign-off

| Environment | Tester | Date | Result |
|-------------|--------|------|--------|
| Chrome (latest stable) | | | |
| Firefox (latest stable) | | | |
| Firefox ESR | | | |

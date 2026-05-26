'use strict';
// ── Bluesky (AT Protocol) content script ───────────────────────────────────
// Matches: bsky.app/profile/{handle-or-did}
// Handle format stored: the handle string (e.g. "username.bsky.social" or custom domain)

const PLATFORM_ID = 'bluesky';

const RESERVED = new Set([
  'search', 'feeds', 'notifications', 'messages', 'lists',
  'moderation', 'settings', 'start', 'login', 'signup', 'hashtag',
  'intent', 'compose', 'about', 'support', 'privacy', 'tos',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // bsky.app/profile/{handle or did:plc:...}
  const m = url.pathname.match(/^\/profile\/([^/?#]+)\/?$/);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (RESERVED.has(raw)) return null;
  // Strip leading @ if present (some links include it)
  const username = raw.replace(/^@/, '');
  return { username };
}

// ── Injection ──────────────────────────────────────────────────────────────

function tryInject() {
  ReddIDPlatformUtil.removeButton();
  const detected = detectProfile(new URL(location.href));
  if (!detected) return;
  const { username } = detected;

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity, apiBase, tipTarget }) => {
    inject(ReddIDPlatformUtil.tipUrl(identity, apiBase, tipTarget));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // Bluesky: the follow button area uses aria-label or data-testid="followBtn"
  const SELECTORS = [
    '[data-testid="followBtn"]',
    '[aria-label="Follow"]',
    '.r-1awozwy',   // common follow button wrapper class (may change)
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.marginLeft = '8px';
      el.parentNode.insertBefore(btn, el.nextSibling);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    setTimeout(() => {
      if (!document.getElementById(ReddIDPlatformUtil.BTN_ID)) {
        ReddIDPlatformUtil.floatingButton(tipUrl);
      }
    }, 3000);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

tryInject();
window.addEventListener('popstate', tryInject);
ReddIDPlatformUtil.watchSpa(tryInject, 600);

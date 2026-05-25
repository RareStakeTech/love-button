'use strict';
// ── Kick content script ────────────────────────────────────────────────────
// Matches: kick.com/{username}  (all streamer pages are at root path)

const PLATFORM_ID = 'kick';

const RESERVED = new Set([
  'about', 'login', 'signup', 'settings', 'help', 'legal', 'privacy', 'terms',
  'categories', 'browse', 'clips', 'following', 'search', 'careers', 'news',
  'press', 'contact', 'blog', 'safety', 'creator', 'docs', 'affiliates',
  'partners', 'discover', 'gaming', 'music', 'just-chatting',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // kick.com/{username} — streamer channel pages
  const m = url.pathname.match(/^\/([A-Za-z0-9_]{3,30})\/?$/);
  if (!m) return null;
  const username = m[1].toLowerCase();
  if (RESERVED.has(username)) return null;
  return { username };
}

// ── Injection ──────────────────────────────────────────────────────────────

function tryInject() {
  ReddIDPlatformUtil.removeButton();
  const detected = detectProfile(new URL(location.href));
  if (!detected) return;
  const { username } = detected;

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity }) => {
    if (identity) inject(ReddIDPlatformUtil.tipUrl(identity));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // Kick's subscribe / follow button container
  const SELECTORS = [
    '#subscribe-button',
    '[data-testid="subscribe-button"]',
    '.channel-info-bar__actions',
    '.streamer-channel-follow-button',
    '#channel-header-actions',
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

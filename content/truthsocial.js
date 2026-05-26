'use strict';
// ── TruthSocial content script ─────────────────────────────────────────────
// Matches: truthsocial.com/@{username}
// TruthSocial is Mastodon-fork; uses the same /@username URL pattern

const PLATFORM_ID = 'truthsocial';

const RESERVED = new Set([
  'about', 'auth', 'login', 'sign_in', 'sign_up', 'settings', 'admin',
  'explore', 'local', 'home', 'notifications', 'favourites', 'lists',
  'bookmarks', 'search', 'tags', 'deck', 'statuses', 'oauth', 'api',
  'help', 'privacy', 'terms', 'news', 'marketplace', 'truth-plus',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  const m = url.pathname.match(/^\/@([A-Za-z0-9_]{1,50})\/?$/);
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

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity, apiBase, tipTarget }) => {
    if (identity) inject(ReddIDPlatformUtil.tipUrl(identity, apiBase, tipTarget));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // TruthSocial shares much of Mastodon's DOM structure
  const SELECTORS = [
    '.account__header__tabs__buttons',
    '.account__header__extra__links',
    '.profile-info-panel-content__deeds',
    '[data-testid="followButton"]',
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.margin = '0 6px';
      el.appendChild(btn);
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

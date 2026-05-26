'use strict';
// ── Mastodon / ActivityPub content script ──────────────────────────────────
// Works on any Mastodon instance listed in manifest.json host_permissions.
// Stored handle format: "username@instance.social" (fully-qualified Mastodon handle)

const PLATFORM_ID = 'mastodon';

const RESERVED = new Set([
  'about', 'auth', 'login', 'sign_in', 'sign_up', 'settings', 'admin',
  'explore', 'local', 'public', 'home', 'notifications', 'favourites',
  'lists', 'bookmarks', 'pinned', 'search', 'tags', 'directory',
  'deck', 'statuses', 'oauth', 'api', 'nodeinfo', 'well-known',
  'users', 'actors', 'media', 'emoji', 'groups',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // Standard Mastodon profile: /@username or /@username@remote.tld
  const m = url.pathname.match(/^\/@([A-Za-z0-9_]+)(@[A-Za-z0-9.-]+)?\/?$/);
  if (!m) return null;
  const localUser = m[1].toLowerCase();
  if (RESERVED.has(localUser)) return null;

  const instance = url.hostname;
  // Fully-qualified handle: "user@instance.social"
  const username = `${localUser}@${instance}`;
  return { username, localUser, instance };
}

// ── Injection ──────────────────────────────────────────────────────────────

function tryInject() {
  ReddIDPlatformUtil.removeButton();
  const detected = detectProfile(new URL(location.href));
  if (!detected) return;
  const { username } = detected;

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity, apiBase, tipTarget }) => {
    // Also try lookup by local username alone (creator may have registered with just their local name)
    if (!identity) {
      ReddIDPlatformUtil.tryLookup(PLATFORM_ID, detected.localUser, ({ identity: i2, apiBase: ab2, tipTarget: tt2 }) => {
        if (i2) inject(ReddIDPlatformUtil.tipUrl(i2, ab2, tt2));
      });
      return;
    }
    inject(ReddIDPlatformUtil.tipUrl(identity, apiBase, tipTarget));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // Mastodon's follow/actions area
  const SELECTORS = [
    '.account__header__extra__links',
    '.account-role',
    '.profile__header__extra',
    '.public-account-header__extra',
    '[data-account-role]',
    '.account__header__tabs__buttons',
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.margin = '4px 0';
      btn.style.display = 'block';
      el.parentNode.insertBefore(btn, el);
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

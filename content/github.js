'use strict';
// ── GitHub content script ──────────────────────────────────────────────────
// Matches: github.com/{username}  (profile pages only — exactly 1 path segment)
// Repos, org pages, and reserved system paths are all excluded.

const PLATFORM_ID = 'github';

const RESERVED = new Set([
  // System / auth
  'login', 'logout', 'signup', 'sessions', 'join',
  // Org / settings
  'settings', 'organizations', 'orgs', 'account',
  // Discovery
  'explore', 'trending', 'topics', 'collections', 'events', 'marketplace',
  'sponsors', 'showcases', 'discussions',
  // Notifications / social
  'notifications', 'issues', 'pulls', 'stars', 'watching', 'followers',
  'following', 'codespaces',
  // Static / marketing
  'about', 'contact', 'security', 'pricing', 'features', 'enterprise',
  'team', 'readme', 'blog', 'careers', 'press', 'education',
  'customer-stories', 'community', 'open-source',
  // Technical
  'new', 'search', 'dashboard', 'profile', 'apps', 'dev', 'api', 'docs',
  'actions', 'packages', 'projects', 'gist', 'gitignore', 'github',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // Only match github.com/{username} — exactly one lowercase-alphanumeric path segment
  // GitHub usernames: 1–39 chars, letters/digits/hyphens, can't start or end with hyphen
  const m = url.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]{0,37}[A-Za-z0-9]|[A-Za-z0-9])\/?$/);
  if (!m) return null;
  const username = m[1];
  if (RESERVED.has(username.toLowerCase())) return null;
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

  // GitHub profile sidebar — try several selectors that have appeared across redesigns
  const SELECTORS = [
    '.js-profile-editable-area',       // editable profile wrapper (logged-in own profile)
    '.p-note',                          // bio element — button appended after
    'div[data-view-component="true"] .d-flex.flex-column.gap-3', // newer sidebar stack
    '.vcard-names-container',           // classic name block
    '.js-follow-container',             // legacy follow button wrapper
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.width           = '100%';
      btn.style.justifyContent  = 'center';
      btn.style.marginTop       = '10px';
      btn.style.borderRadius    = '6px';
      // Insert after the matched element (not inside it) to avoid disrupting layout
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

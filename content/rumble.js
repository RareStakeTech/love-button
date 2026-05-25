'use strict';
// ── Rumble content script ──────────────────────────────────────────────────
// Matches: rumble.com/c/{channel} and rumble.com/user/{username}

const PLATFORM_ID = 'rumble';

const RESERVED = new Set([
  'about', 'login', 'register', 'signup', 'settings', 'help', 'advertise',
  'legal', 'privacy', 'terms', 'news', 'trending', 'search', 'tag',
  'videos', 'live', 'schedule', 'policy', 'press', 'contact', 'jobs',
  'creators', 'rumbles', 'podcasts', 'clips', 'playlists', 'categories',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // rumble.com/c/{channel-name}  — creator channels (primary)
  const chan = url.pathname.match(/^\/c\/([A-Za-z0-9_-]{2,60})\/?$/);
  if (chan && !RESERVED.has(chan[1].toLowerCase())) {
    return { username: chan[1].toLowerCase(), type: 'channel' };
  }

  // rumble.com/user/{username}  — user profile pages
  const user = url.pathname.match(/^\/user\/([A-Za-z0-9_-]{2,60})\/?$/);
  if (user && !RESERVED.has(user[1].toLowerCase())) {
    return { username: user[1].toLowerCase(), type: 'user' };
  }

  return null;
}

// ── Injection ──────────────────────────────────────────────────────────────

function tryInject() {
  ReddIDPlatformUtil.removeButton();
  const detected = detectProfile(new URL(location.href));
  if (!detected) return;
  const { username } = detected;

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity, apiBase }) => {
    if (identity) inject(ReddIDPlatformUtil.tipUrl(identity, apiBase));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // Rumble channel page follow/subscribe button area
  const SELECTORS = [
    '.channel-header--subscribe',
    '.rumbles-vote',
    '.channel-subheader--actions',
    '.creator-header',
    '.channel-header',
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.marginLeft = '8px';
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

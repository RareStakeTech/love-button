'use strict';
// ── Odysee (LBRY) content script ───────────────────────────────────────────
// Matches: odysee.com/@{channel}:{claim_id_prefix}
// Odysee channels use the format @ChannelName:claimId in URLs

const PLATFORM_ID = 'odysee';

const RESERVED = new Set([
  '$', 'search', 'settings', 'signin', 'signup', 'help', 'news', 'youtube',
  'embed', 'auth', 'privacy', 'terms', 'about', 'discover', 'following',
  'subscriptions', 'notifications', 'library', 'uploads', 'publish',
  'creator', 'wallet', 'rewards', 'sync', 'channels', 'tags',
]);

// ── Profile detection ──────────────────────────────────────────────────────

function detectProfile(url) {
  // odysee.com/@ChannelName:claimId  (claimId may be absent on some links)
  const m = url.pathname.match(/^\/@([A-Za-z0-9_-]{2,60})(?::[a-f0-9]+)?\/?$/);
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

  ReddIDPlatformUtil.tryLookup(PLATFORM_ID, username, ({ identity, apiBase }) => {
    if (identity) inject(ReddIDPlatformUtil.tipUrl(identity, apiBase));
  });
}

function inject(tipUrl) {
  if (document.getElementById(ReddIDPlatformUtil.BTN_ID)) return;

  // Odysee channel header action buttons
  const SELECTORS = [
    '.channel-header__actions',
    '.channel-thumbnail',
    '.channel__header-group',
    'div[class*="ChannelPage__wrapper"]',
  ];

  let inserted = false;
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const btn = ReddIDPlatformUtil.createButton(tipUrl);
      btn.style.margin = '8px 0';
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

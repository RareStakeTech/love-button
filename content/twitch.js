/**
 * ReddID Love Button v2.1 — Twitch content script
 *
 * Detects Twitch channel pages (twitch.tv/channelname).
 * Looks up whether the streamer has a linked ReddID handle.
 * If found, injects a "Tip Ɍ RDD" button near the Follow/Subscribe button.
 */

(function () {
  'use strict';

  const BUTTON_ID = 'reddid-tip-btn';
  const BRAND_RED = '#E30613';
  const BRAND_RED_DARK = '#B80510';

  const RESERVED = new Set([
    'directory', 'downloads', 'explore', 'following', 'friends',
    'inventory', 'jobs', 'payments', 'prime', 'search', 'settings',
    'subs', 'subscriptions', 'turbo', 'bits', 'drops', 'store',
    'login', 'signup', 'moderator', 'popout', 'embed', 'broadcast',
    'dashboard', 'wallet', 'messages', 'notifications',
  ]);

  let lastCheckedChannel = null;
  let injected = false;
  let navTimeout;

  function getChannelName() {
    // twitch.tv/channelname — single path segment, no slashes after
    const match = location.pathname.match(/^\/([a-zA-Z0-9_]{1,25})\/?$/);
    if (!match) return null;
    const name = match[1].toLowerCase();
    if (RESERVED.has(name)) return null;
    return name;
  }

  function findInsertionPoint() {
    // Primary: Subscribe button area
    const subscribe = document.querySelector(
      '[data-a-target="subscribe-button"], [data-a-target="subscriptions-gate-subscribe-button"]'
    );
    if (subscribe) return subscribe.parentElement;

    // Secondary: Follow button area
    const follow = document.querySelector('[data-a-target="follow-button"]');
    if (follow) return follow.parentElement;

    // Tertiary: channel header actions
    const headerActions = document.querySelector(
      '.channel-info-content [class*="Layout-sc"], .channel-header-right'
    );
    if (headerActions) return headerActions;

    return null;
  }

  function removeExistingButton() {
    const el = document.getElementById(BUTTON_ID);
    if (el) el.remove();
    injected = false;
  }

  function injectTipButton(identity, apiBase) {
    if (injected) return;
    const point = findInsertionPoint();
    if (!point) return;

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = `${apiBase}/${identity.handle}`;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.title = `Tip this streamer Ɍ RDD via ReddID @${identity.handle}`;

    btn.innerHTML = `<span style="font-size:0.9rem;line-height:1">🔴</span><span>Tip Ɍ RDD</span>`;

    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      background:     BRAND_RED,
      color:          'white',
      textDecoration: 'none',
      border:         'none',
      borderRadius:   '4px',       // Twitch uses square-ish buttons
      padding:        '9px 16px',
      cursor:         'pointer',
      fontFamily:     'inherit',
      fontSize:       '0.85rem',
      fontWeight:     '700',
      letterSpacing:  '0.02em',
      marginLeft:     '8px',
      transition:     'background 0.12s',
      verticalAlign:  'middle',
      lineHeight:     '1',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = BRAND_RED_DARK; });
    btn.addEventListener('mouseleave', () => { btn.style.background = BRAND_RED; });

    point.appendChild(btn);
    injected = true;
  }

  async function checkPage() {
    const channel = getChannelName();
    if (!channel) { removeExistingButton(); return; }
    if (channel === lastCheckedChannel && injected) return;

    lastCheckedChannel = channel;
    removeExistingButton();

    // Try direct handle match first (streamer may have registered same username)
    const tryDirect = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_HANDLE', payload: { handle: channel } },
        res => resolve(res?.identity ?? null)
      )
    );

    const trySocial = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'twitch', username: channel } },
        res => resolve(res?.identity ?? null)
      )
    );

    const identity = await tryDirect() ?? await trySocial();
    if (!identity) return;

    const { base } = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, resolve)
    );
    injectTipButton(identity, base || 'https://redd.love');
  }

  // Twitch is a React SPA — watch DOM mutations and popstate
  const observer = new MutationObserver(() => {
    clearTimeout(navTimeout);
    navTimeout = setTimeout(checkPage, 900);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    injected = false;
    lastCheckedChannel = null;
    checkPage();
  });

  checkPage();
})();

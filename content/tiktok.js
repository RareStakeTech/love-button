/**
 * ReddID Love Button v2.2 — TikTok content script
 *
 * Detects TikTok profile pages (tiktok.com/@username).
 * Looks up whether the creator has a linked ReddID handle.
 * If found, injects a "Tip Ɍ RDD" button in the profile header.
 */

(function () {
  'use strict';

  const BUTTON_ID   = 'reddid-tip-btn';
  const BRAND_RED   = '#E30613';
  const BRAND_DARK  = '#B80510';

  const RESERVED = new Set([
    'explore', 'following', 'foryou', 'discover', 'live', 'trending',
    'music', 'effects', 'upload', 'creator-academy', 'business',
    'legal', 'privacy', 'safety', 'feedback', 'about', 'login', 'signup',
    'messages', 'notifications', 'search', 'setting', 'settings',
    'activity', 'brand', 'ads', 'tiktokshop', 'shop',
  ]);

  let lastCheckedUsername = null;
  let injected = false;
  let scanTimeout;
  let observer;

  function getUsername() {
    // TikTok always includes @ in the URL: tiktok.com/@username
    const match = location.pathname.match(/^\/@([a-zA-Z0-9_.]{1,24})\/?$/);
    if (!match) return null;
    const name = match[1].toLowerCase();
    if (RESERVED.has(name)) return null;
    return match[1]; // preserve original casing
  }

  function findInsertionPoint() {
    // Primary: share/follow button container
    for (const testId of ['user-avatar', 'follow-button', 'message-button']) {
      const el = document.querySelector(`[data-e2e="${testId}"]`);
      if (el) {
        const parent = el.closest('div[class]') || el.parentElement;
        if (parent) return parent;
      }
    }

    // Buttons area in profile header
    const header = document.querySelector('h1[data-e2e="user-title"]');
    if (header) {
      const section = header.closest('section') || header.parentElement?.parentElement;
      if (section) return section;
    }

    // Generic: any Follow button in the viewport
    const followBtns = [...document.querySelectorAll('button')]
      .filter(b => b.textContent.trim().toLowerCase() === 'follow');
    if (followBtns.length > 0) return followBtns[0].parentElement;

    return null;
  }

  function removeExistingButton() {
    const el = document.getElementById(BUTTON_ID);
    if (el) el.remove();
    injected = false;
  }

  function injectTipButton(identity, apiBase) {
    if (injected) return;

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = `${apiBase}/${identity.handle}`;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.title = `Tip @${identity.handle} with Ɍ RDD`;
    btn.innerHTML = `🔴 Tip Ɍ RDD`;

    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      background:     BRAND_RED,
      color:          'white',
      textDecoration: 'none',
      border:         'none',
      borderRadius:   '4px',
      padding:        '8px 16px',
      cursor:         'pointer',
      fontFamily:     '"TikTok Sans", "Helvetica Neue", sans-serif',
      fontSize:       '0.85rem',
      fontWeight:     '700',
      letterSpacing:  '0.02em',
      margin:         '8px 4px',
      transition:     'background 0.12s',
      lineHeight:     '1',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = BRAND_DARK; });
    btn.addEventListener('mouseleave', () => { btn.style.background = BRAND_RED; });

    const point = findInsertionPoint();
    if (point) {
      point.appendChild(btn);
    } else {
      // Floating fallback — top right corner
      Object.assign(btn.style, {
        position:  'fixed',
        top:       '72px',
        right:     '16px',
        zIndex:    '999999',
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
      });
      document.body.appendChild(btn);
    }

    injected = true;
  }

  async function checkPage() {
    const username = getUsername();
    if (!username) { removeExistingButton(); return; }
    if (username.toLowerCase() === lastCheckedUsername?.toLowerCase() && injected) return;

    lastCheckedUsername = username;
    removeExistingButton();

    const trySocial = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'tiktok', username } },
        res => resolve(res?.identity ?? null)
      )
    );

    const tryDirect = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_HANDLE', payload: { handle: username.toLowerCase() } },
        res => resolve(res?.identity ?? null)
      )
    );

    const identity = await trySocial() ?? await tryDirect();
    if (!identity) return;

    const { base } = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, resolve)
    );
    injectTipButton(identity, base || 'https://redd.love');
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(checkPage, 1200);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // TikTok uses pushState / history API navigation
  let lastPathname = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      injected = false;
      lastCheckedUsername = null;
      checkPage();
    }
  }, 600);

  // Also listen for popstate
  window.addEventListener('popstate', () => {
    injected = false;
    lastCheckedUsername = null;
    setTimeout(checkPage, 800);
  });

  startObserver();
  checkPage();
})();

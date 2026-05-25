/**
 * ReddID Love Button v2.1 — Instagram content script
 *
 * Detects Instagram profile pages (instagram.com/username).
 * Instagram uses heavily obfuscated/hashed class names that change
 * frequently, so this script uses a multi-strategy DOM search with
 * a floating fallback button positioned near the profile header.
 *
 * Looks up whether the profile owner has a linked ReddID handle.
 * If found, injects a "Tip Ɍ RDD" button.
 */

(function () {
  'use strict';

  const BUTTON_ID = 'reddid-tip-btn';
  const BRAND_RED = '#E30613';
  const BRAND_RED_DARK = '#B80510';

  // Non-profile paths to skip
  const RESERVED = new Set([
    'explore', 'direct', 'accounts', 'p', 'reel', 'reels',
    'stories', 'tv', 'ar', 'challenge', 'about', 'legal',
    'privacy', 'help', 'press', 'api', 'oauth', 'graphql',
    'static', 'emails', 'ads', 'studio', 'developers',
  ]);

  let lastCheckedUsername = null;
  let injected = false;
  let scanTimeout;
  let observer;

  function getUsername() {
    // instagram.com/username or instagram.com/username/
    const segs = location.pathname.split('/').filter(Boolean);
    if (segs.length === 0 || segs.length > 2) return null;
    const name = segs[0].toLowerCase();
    if (RESERVED.has(name)) return null;
    // If there's a second segment it must be a sub-page like /tagged or /reels (still valid profile)
    // but we only inject on the root profile view
    if (segs.length === 2 && !['tagged', 'reels', 'igtv', 'saved', 'channel'].includes(segs[1])) return null;
    return segs[0]; // preserve original casing for display; use lowercase for lookup
  }

  // ── Insertion point strategies ────────────────────────────────────────────

  function findNativeInsertionPoint() {
    // Strategy 1: look for the section containing the follow button
    // Instagram renders buttons inside <section> under the profile header
    const followBtns = [
      ...document.querySelectorAll('button'),
    ].filter(b => {
      const t = b.textContent.trim().toLowerCase();
      return t === 'follow' || t === 'following' || t === 'message';
    });
    if (followBtns.length > 0) return followBtns[0].closest('section') || followBtns[0].parentElement;

    // Strategy 2: header section containing the username h2
    const h2 = document.querySelector('header h2, header h1, main header');
    if (h2) return h2.closest('section') || h2.parentElement;

    // Strategy 3: any <header> inside main
    const mainHeader = document.querySelector('main > div > div > div > header');
    if (mainHeader) return mainHeader;

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
    btn.title = `Tip this creator Ɍ RDD via ReddID @${identity.handle}`;
    btn.innerHTML = `🔴 Tip Ɍ RDD`;

    const baseStyle = {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      background:     BRAND_RED,
      color:          'white',
      textDecoration: 'none',
      border:         'none',
      borderRadius:   '8px',
      padding:        '8px 16px',
      cursor:         'pointer',
      fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize:       '0.85rem',
      fontWeight:     '700',
      letterSpacing:  '0.02em',
      transition:     'background 0.12s',
      lineHeight:     '1',
    };

    btn.addEventListener('mouseenter', () => { btn.style.background = BRAND_RED_DARK; });
    btn.addEventListener('mouseleave', () => { btn.style.background = BRAND_RED; });

    const nativePoint = findNativeInsertionPoint();

    if (nativePoint) {
      Object.assign(btn.style, baseStyle, { marginTop: '8px', marginLeft: '8px' });
      nativePoint.appendChild(btn);
    } else {
      // Fallback: floating button anchored to top-right
      Object.assign(btn.style, baseStyle, {
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
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'instagram', username } },
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

  // Instagram is a heavy SPA — MutationObserver + URL change polling
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(checkPage, 1000);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Instagram uses pushState for navigation
  let lastPathname = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      injected = false;
      lastCheckedUsername = null;
      checkPage();
    }
  }, 500);

  startObserver();
  checkPage();
})();

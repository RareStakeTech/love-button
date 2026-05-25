/**
 * ReddID Love Button v2.1 — Twitter/X content script
 *
 * Detects profile pages on twitter.com and x.com.
 * Tries social-proof lookup first; falls back to direct handle match
 * (many creators register their Twitter username as their ReddID handle).
 * Injects a Ɍ Tip RDD button near the Follow/Message button area.
 */

(function () {
  'use strict';

  const BUTTON_ID   = 'reddid-tip-btn';
  const BRAND_RED   = '#E30613';
  const BRAND_DARK  = '#B80510';

  const RESERVED = new Set([
    'home', 'explore', 'notifications', 'messages', 'search',
    'settings', 'i', 'compose', 'intent', 'share', 'login',
    'signup', 'logout', 'privacy', 'tos', 'about', 'jobs',
    'communities', 'lists', 'bookmarks', 'topics', 'tw',
  ]);

  let lastCheckedUsername = null;
  let injected = false;
  let observerTimeout;

  function getProfileUsername() {
    const match = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    if (!match) return null;
    if (RESERVED.has(match[1].toLowerCase())) return null;
    return match[1];
  }

  function findInsertionPoint() {
    // Follow / Unfollow / Message button area
    for (const testId of ['followButton', 'unfollowButton', 'placeholderButton', 'sendDMFromProfile']) {
      const btn = document.querySelector(`[data-testid="${testId}"]`);
      if (btn) return btn.parentElement;
    }
    // Profile header action bar
    const actionBar = document.querySelector('[data-testid="UserProfileHeader_Items"]');
    if (actionBar) return actionBar;
    // Generic: any button labelled Follow in the header zone
    const followBtns = [...document.querySelectorAll('[role="button"]')]
      .filter(el => el.textContent.trim() === 'Follow');
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
    const point = findInsertionPoint();
    if (!point) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.title = `Tip @${identity.handle} with Ɍ RDD`;
    btn.innerHTML = `<span style="font-size:0.95rem;line-height:1">🔴</span><span>Tip Ɍ RDD</span>`;

    Object.assign(btn.style, {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '5px',
      background:    BRAND_RED,
      color:         'white',
      border:        'none',
      borderRadius:  '20px',
      padding:       '7px 15px',
      cursor:        'pointer',
      fontFamily:    'inherit',
      fontSize:      '0.82rem',
      fontWeight:    '700',
      letterSpacing: '0.03em',
      marginLeft:    '8px',
      transition:    'background 0.12s',
      verticalAlign: 'middle',
      lineHeight:    '1',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = BRAND_DARK; });
    btn.addEventListener('mouseleave', () => { btn.style.background = BRAND_RED; });
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      window.open(`${apiBase}/${identity.handle}`, '_blank', 'noopener,noreferrer');
    });

    point.appendChild(btn);
    injected = true;
  }

  async function checkProfile() {
    const username = getProfileUsername();
    if (!username) { removeExistingButton(); return; }
    if (username === lastCheckedUsername && injected) return;

    lastCheckedUsername = username;
    removeExistingButton();

    // Social proof lookup (v0.2+), then direct handle fallback
    const trySocial = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'twitter', username } },
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

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(checkProfile, 600);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  checkProfile();
})();

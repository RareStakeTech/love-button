/**
 * ReddID Love Button v2.9 — Reddit content script
 *
 * Detects Reddit user profile pages (/user/username or /u/username).
 * Looks up whether the user has a linked ReddID handle.
 * If found, injects a Ɍ Tip with RDD button in the profile header.
 */

(function () {
  'use strict';

  const BUTTON_ID  = 'reddid-tip-btn';
  const BRAND_RED  = '#E30613';
  const BRAND_DARK = '#B80510';

  let lastCheckedUsername = null;
  let injected = false;
  let observerTimeout;

  function getProfileUsername() {
    const match = location.pathname.match(/^\/(?:user|u)\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function findInsertionPoint() {
    // New Reddit (2024+) Shreddit UI
    for (const sel of [
      'shreddit-profile-info',
      '[slot="header-buttons"]',
      'div[data-testid="profile-actions"]',
      '.ProfileCard__buttons',
      // Legacy selectors
      '._2iuoyPiKHN3kfOoeIQalDT',
      'div[data-testid="profile-section"]',
    ]) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: any button that says "Follow" in the top header area
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

  function injectTipButton(identity, apiBase, tipTarget) {
    if (injected) return;
    const point = findInsertionPoint();
    if (!point) return;

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = tipTarget === 'pay'
      ? `${apiBase}/pay/${identity.handle}`
      : `${apiBase}/${identity.handle}`;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.title = `Tip u/${lastCheckedUsername} Ɍ RDD via ReddID @${identity.handle}`;
    btn.innerHTML = `🔴 Tip Ɍ RDD`;

    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      background:     BRAND_RED,
      color:          'white',
      textDecoration: 'none',
      border:         'none',
      borderRadius:   '20px',
      padding:        '7px 16px',
      cursor:         'pointer',
      fontFamily:     'inherit',
      fontSize:       '0.82rem',
      fontWeight:     '700',
      letterSpacing:  '0.03em',
      margin:         '8px 4px',
      transition:     'background 0.12s',
      lineHeight:     '1',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = BRAND_DARK; });
    btn.addEventListener('mouseleave', () => { btn.style.background = BRAND_RED; });

    point.appendChild(btn);
    injected = true;
  }

  async function checkProfile() {
    const username = getProfileUsername();
    if (!username) { removeExistingButton(); return; }
    if (username === lastCheckedUsername && injected) return;

    lastCheckedUsername = username;
    removeExistingButton();

    const trySocial = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'reddit', username } },
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

    const [{ base }, tipSettings] = await Promise.all([
      new Promise(resolve => chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, resolve)),
      chrome.storage.sync.get({ tipUrlTarget: 'tip' }),
    ]);
    injectTipButton(identity, base || 'https://redd.love', tipSettings.tipUrlTarget || 'tip');
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(checkProfile, 600);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  checkProfile();
})();

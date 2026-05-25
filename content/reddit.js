/**
 * ReddID Love Button v2 — Reddit content script
 *
 * Detects Reddit user profile pages (/user/username or /u/username).
 * Looks up whether the user has a linked ReddID handle.
 * If found, injects a "Tip with RDD" button in the profile header.
 */

(function () {
  'use strict';

  const BUTTON_ID = 'reddid-tip-btn';
  let lastCheckedUsername = null;
  let injected = false;

  function getProfileUsername() {
    const match = location.pathname.match(/^\/(?:user|u)\/([^/]+)\/?/);
    return match ? match[1] : null;
  }

  function findInsertionPoint() {
    // Reddit profile header actions area
    const headerAction = document.querySelector('[data-testid="profile-actions"], .ProfileCard__buttons, ._2iuoyPiKHN3kfOoeIQalDT');
    if (headerAction) return headerAction;
    // New Reddit UI fallback
    const profileHeader = document.querySelector('div[data-testid="profile-section"]');
    if (profileHeader) return profileHeader;
    return null;
  }

  function removeExistingButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
    injected = false;
  }

  function injectTipButton(identity, apiBase) {
    if (injected) return;
    const insertionPoint = findInsertionPoint();
    if (!insertionPoint) return;

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = `${apiBase}/${identity.handle}`;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.title = `Tip u/${lastCheckedUsername} with RDD via ReddID @${identity.handle}`;
    btn.innerHTML = `🔴 Tip with RDD`;
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: '#CC1111',
      color: 'white',
      textDecoration: 'none',
      border: 'none',
      borderRadius: '20px',
      padding: '7px 16px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.82rem',
      fontWeight: '700',
      margin: '8px 4px',
      letterSpacing: '0.03em',
    });

    insertionPoint.appendChild(btn);
    injected = true;
  }

  async function checkProfile() {
    const username = getProfileUsername();
    if (!username) { removeExistingButton(); return; }
    if (username === lastCheckedUsername && injected) return;

    lastCheckedUsername = username;
    removeExistingButton();

    chrome.runtime.sendMessage(
      { type: 'LOOKUP_SOCIAL', payload: { platform: 'reddit', username } },
      async (response) => {
        if (chrome.runtime.lastError) return;
        if (!response?.identity) return;

        const { base } = await new Promise(resolve =>
          chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, resolve)
        );
        injectTipButton(response.identity, base || 'https://redd.love');
      }
    );
  }

  let observerTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(checkProfile, 600);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  checkProfile();
})();

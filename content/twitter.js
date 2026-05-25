/**
 * ReddID Love Button v2 — Twitter/X content script
 *
 * Detects profile pages on twitter.com and x.com.
 * Looks up whether the profile owner has a linked ReddID handle.
 * If found, injects a "Tip with RDD" button near the Follow button.
 */

(function () {
  'use strict';

  const BUTTON_ID = 'reddid-tip-btn';
  let lastCheckedUsername = null;
  let injected = false;

  // Extract Twitter/X username from current URL
  function getProfileUsername() {
    const match = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    if (!match) return null;
    const reserved = ['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i', 'compose'];
    if (reserved.includes(match[1].toLowerCase())) return null;
    return match[1];
  }

  // Find the Follow button area to inject next to
  function findInsertionPoint() {
    // Look for the Follow/Following button — heuristic, Twitter changes DOM often
    const followBtns = document.querySelectorAll('[data-testid="followButton"], [data-testid="unfollowButton"], [data-testid="placeholderButton"]');
    if (followBtns.length > 0) return followBtns[0].parentElement;
    // Fallback: look for profile action bar
    const actionBar = document.querySelector('[data-testid="UserProfileHeader_Items"]');
    if (actionBar) return actionBar;
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

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.title = `Tip @${identity.handle} with RDD`;
    btn.innerHTML = `
      <span style="font-size:1rem;line-height:1">🔴</span>
      <span style="font-size:0.78rem;font-weight:700;letter-spacing:0.04em">Tip RDD</span>
    `;
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      background: '#CC1111',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      padding: '7px 14px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      marginLeft: '8px',
      transition: 'background 0.15s',
      verticalAlign: 'middle',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = '#aa0e0e'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#CC1111'; });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(`${apiBase}/${identity.handle}`, '_blank', 'noopener,noreferrer');
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

    // Ask background service worker for a social proof lookup
    chrome.runtime.sendMessage(
      { type: 'LOOKUP_SOCIAL', payload: { platform: 'twitter', username } },
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

  // Run on navigation — Twitter is a SPA
  let observerTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(checkProfile, 600);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  checkProfile();
})();

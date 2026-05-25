/**
 * ReddID Love Button v2 — YouTube content script
 *
 * Detects YouTube channel pages.
 * Looks up whether the channel owner has a linked ReddID handle.
 * If found, injects a "Tip with RDD" button near the Subscribe button.
 */

(function () {
  'use strict';

  const BUTTON_ID = 'reddid-tip-btn';
  let lastCheckedChannel = null;
  let injected = false;

  function getChannelHandle() {
    // @handle-style URLs: youtube.com/@channelname
    const atMatch = location.pathname.match(/^\/@([^/]+)/);
    if (atMatch) return atMatch[1];
    // Legacy /channel, /c, /user
    const legacyMatch = location.pathname.match(/^\/(?:channel|c|user)\/([^/]+)/);
    if (legacyMatch) return legacyMatch[1];
    return null;
  }

  function findInsertionPoint() {
    // YouTube channel header subscribe area
    const subscribe = document.querySelector('#subscribe-button, ytd-subscribe-button-renderer');
    if (subscribe) return subscribe.parentElement;
    // Channel header metadata actions
    const meta = document.querySelector('#channel-header-container #buttons, #inner-header-container #buttons');
    if (meta) return meta;
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
    btn.title = `Tip this creator with RDD via ReddID @${identity.handle}`;
    btn.innerHTML = `🔴 Tip with RDD`;
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: '#E30613',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '20px',
      padding: '8px 18px',
      cursor: 'pointer',
      fontSize: '0.88rem',
      fontWeight: '600',
      fontFamily: 'Roboto, sans-serif',
      marginLeft: '8px',
      letterSpacing: '0.02em',
      verticalAlign: 'middle',
      lineHeight: 1,
    });

    insertionPoint.appendChild(btn);
    injected = true;
  }

  async function checkPage() {
    const channel = getChannelHandle();
    if (!channel) { removeExistingButton(); return; }
    if (channel === lastCheckedChannel && injected) return;

    lastCheckedChannel = channel;
    removeExistingButton();

    // YouTube channel @handles map naturally to ReddID; try direct handle lookup first
    // (creators can register @channelname as their ReddID handle)
    const tryDirect = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_HANDLE', payload: { handle: channel } },
        (res) => resolve(res?.identity ?? null)
      )
    );

    const tryYouTubeSocial = () => new Promise(resolve =>
      chrome.runtime.sendMessage(
        { type: 'LOOKUP_SOCIAL', payload: { platform: 'youtube', username: channel } },
        (res) => resolve(res?.identity ?? null)
      )
    );

    const identity = await tryDirect() ?? await tryYouTubeSocial();
    if (!identity) return;

    const { base } = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, resolve)
    );
    injectTipButton(identity, base || 'https://redd.love');
  }

  // YouTube is a SPA — watch for navigation events
  let navTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(navTimeout);
    navTimeout = setTimeout(checkPage, 1000);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => {
    injected = false;
    lastCheckedChannel = null;
    checkPage();
  });

  checkPage();
})();

/**
 * ReddID Platform Utility Library v1.0
 *
 * Shared helpers for all ReddID Love Button content scripts.
 * Loaded first in every manifest content_scripts entry so it's available
 * to the platform-specific script that follows.
 *
 * Exposes a single global: window.ReddIDPlatformUtil
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  const BRAND_RED  = '#E30613';
  const BTN_ID     = 'reddid-tip-btn';
  const API_BASE   = 'https://redd.love';

  // ── Button factory ─────────────────────────────────────────────────────────

  /**
   * Create and return a styled <a> tip button.
   * The returned element has id="reddid-tip-btn".
   * @param {string} tipUrl  - full URL to the creator's redd.love tip page
   * @param {string} [label] - button text (default "Tip with Ɍ RDD")
   * @returns {HTMLAnchorElement}
   */
  function createButton(tipUrl, label) {
    const a = document.createElement('a');
    a.id   = BTN_ID;
    a.href = tipUrl;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.textContent = label || 'Tip with Ɍ RDD';

    Object.assign(a.style, {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '5px',
      background:     BRAND_RED,
      color:          '#fff',
      border:         'none',
      borderRadius:   '6px',
      padding:        '7px 14px',
      fontSize:       '13px',
      fontWeight:     '700',
      fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      cursor:         'pointer',
      textDecoration: 'none',
      whiteSpace:     'nowrap',
      letterSpacing:  '0.01em',
      transition:     'background 0.15s, transform 0.1s',
      zIndex:         '9999',
    });

    a.addEventListener('mouseenter', () => {
      a.style.background = '#B80510';
      a.style.transform  = 'scale(1.03)';
    });
    a.addEventListener('mouseleave', () => {
      a.style.background = BRAND_RED;
      a.style.transform  = 'scale(1)';
    });

    return a;
  }

  /**
   * Inject a floating fallback button in the bottom-right corner.
   * Safe to call multiple times — checks for existing button first.
   * @param {string} tipUrl
   * @param {string} [label]
   */
  function floatingButton(tipUrl, label) {
    if (document.getElementById(BTN_ID)) return;
    const btn = createButton(tipUrl, label);
    Object.assign(btn.style, {
      position: 'fixed',
      top:      '72px',
      right:    '16px',
      zIndex:   '2147483647',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(btn);
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  /**
   * Poll the DOM until `selector` matches, then invoke `callback(element)`.
   * Stops after `maxWaitMs` without a match (default 8000ms).
   * @param {string}   selector
   * @param {Function} callback  - receives the matched HTMLElement
   * @param {number}   [maxWaitMs=8000]
   */
  function waitForElement(selector, callback, maxWaitMs) {
    const deadline = Date.now() + (maxWaitMs || 8000);
    const iv = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(iv);
        callback(el);
      } else if (Date.now() > deadline) {
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }

  /**
   * Remove the injected tip button if present.
   */
  function removeButton() {
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.remove();
  }

  // ── SPA navigation watcher ─────────────────────────────────────────────────

  /**
   * Watch for SPA-style navigation changes using MutationObserver + setInterval.
   * Calls `callback()` whenever the page URL appears to have changed.
   *
   * @param {Function} callback     - invoked on each detected navigation
   * @param {number}   [intervalMs=600] - polling interval in ms
   * @returns {Function} cleanup — call to stop watching
   */
  function watchSpa(callback, intervalMs) {
    let lastHref = location.href;
    const ms = intervalMs || 600;

    const iv = setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        callback();
      }
    }, ms);

    const observer = new MutationObserver(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        callback();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(iv);
      observer.disconnect();
    };
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  /**
   * Look up a ReddID by social platform + username.
   * Sends LOOKUP_SOCIAL to the background service worker.
   * @param {string}   platform - e.g. "bluesky", "mastodon"
   * @param {string}   username
   * @param {Function} callback - receives { identity } (identity may be null)
   */
  function lookupSocial(platform, username, callback) {
    chrome.runtime.sendMessage(
      { type: 'LOOKUP_SOCIAL', payload: { platform, username } },
      res => callback(res || { identity: null })
    );
  }

  /**
   * Look up a ReddID by @handle.
   * Sends LOOKUP_HANDLE to the background service worker.
   * @param {string}   handle   - without leading @
   * @param {Function} callback - receives { identity } (identity may be null)
   */
  function lookupHandle(handle, callback) {
    chrome.runtime.sendMessage(
      { type: 'LOOKUP_HANDLE', payload: { handle } },
      res => callback(res || { identity: null })
    );
  }

  /**
   * Full lookup pipeline: try social proof first, then handle fallback.
   * Also fetches the configured API base URL so the tip URL respects the
   * user-configured endpoint (default: https://redd.love, overridable in Settings).
   *
   * @param {string}   platform
   * @param {string}   username
   * @param {Function} onFound  - receives { identity, apiBase } when found (never called if not found)
   */
  function tryLookup(platform, username, onFound) {
    // Fetch the configured API base and tip URL target before doing identity lookups
    chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, (resp) => {
      const apiBase = (resp && resp.base) || API_BASE;
      chrome.storage.sync.get({ tipUrlTarget: 'tip' }, (settings) => {
        const tipTarget = settings.tipUrlTarget || 'tip';
        lookupSocial(platform, username, ({ identity }) => {
          if (identity) { onFound({ identity, apiBase, tipTarget }); return; }
          // Fallback: try the username as a handle directly
          lookupHandle(username.toLowerCase().replace(/[^a-z0-9-]/g, ''), ({ identity: i2 }) => {
            if (i2) onFound({ identity: i2, apiBase, tipTarget });
          });
        });
      });
    });
  }

  /**
   * Build the tip page URL for a registered identity.
   * @param {Object} identity      - ReddID identity object
   * @param {string} [base]        - override API base URL
   * @param {string} [target]      - 'tip' (default) or 'pay' for the /pay/[handle] page
   * @returns {string}
   */
  function tipUrl(identity, base, target) {
    const root = base || API_BASE;
    return target === 'pay'
      ? `${root}/pay/${identity.handle}`
      : `${root}/${identity.handle}`;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  window.ReddIDPlatformUtil = {
    BRAND_RED,
    BTN_ID,
    API_BASE,
    createButton,
    floatingButton,
    waitForElement,
    removeButton,
    watchSpa,
    lookupSocial,
    lookupHandle,
    tryLookup,
    tipUrl,
  };

})();

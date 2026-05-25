/**
 * ReddID Love Button v2 — Popup script
 */

const $ = id => document.getElementById(id);

// ── State management ─────────────────────────────────────────────────────────

let currentIdentity = null;
let apiBase = 'https://redd.love';

function showState(name) {
  ['idle', 'loading', 'error', 'result'].forEach(s => {
    $(`state-${s}`).style.display = s === name ? 'block' : 'none';
  });
}

function showError(msg) {
  $('error-msg').textContent = msg;
  showState('error');
}

function showResult(identity) {
  currentIdentity = identity;
  $('result-handle').textContent = `@${identity.handle}`;
  $('result-name').textContent = identity.displayName ?? `@${identity.handle}`;
  $('result-bio').textContent = identity.bio ?? '';
  $('result-bio').style.display = identity.bio ? 'block' : 'none';
  $('result-address').textContent = identity.rddAddress;
  $('open-tip-page').href = `${apiBase}/${identity.handle}`;
  resetCopyBtn();
  showState('result');
}

// ── Copy button ───────────────────────────────────────────────────────────────

function resetCopyBtn() {
  const btn = $('copy-btn');
  btn.textContent = 'Copy';
  btn.classList.remove('copied');
}

$('copy-btn').addEventListener('click', async () => {
  if (!currentIdentity) return;
  try {
    await navigator.clipboard.writeText(currentIdentity.rddAddress);
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = currentIdentity.rddAddress;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  const btn = $('copy-btn');
  btn.textContent = '✓ Copied';
  btn.classList.add('copied');
  setTimeout(resetCopyBtn, 2000);
});

// ── Lookup ────────────────────────────────────────────────────────────────────

async function lookupHandle(raw) {
  const handle = raw.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return;

  $('loading-handle').textContent = handle;
  showState('loading');

  chrome.runtime.sendMessage(
    { type: 'LOOKUP_HANDLE', payload: { handle } },
    (response) => {
      if (chrome.runtime.lastError) {
        showError('Extension error. Try reloading.');
        return;
      }
      if (!response?.identity) {
        showError(`@${handle} not found. Check the handle and try again, or register at redd.love/register.`);
        return;
      }
      showResult(response.identity);
    }
  );
}

// ── Search form ───────────────────────────────────────────────────────────────

const searchInput = $('search-input');
const searchBtn = $('search-btn');

searchBtn.addEventListener('click', () => lookupHandle(searchInput.value));
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupHandle(searchInput.value);
});

// Sanitize input live: lowercase, alphanumeric + hyphens only
searchInput.addEventListener('input', () => {
  const clean = searchInput.value.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  if (clean !== searchInput.value) searchInput.value = clean;
});

// ── Clear ──────────────────────────────────────────────────────────────────────

$('clear-btn').addEventListener('click', () => {
  currentIdentity = null;
  searchInput.value = '';
  showState('idle');
  searchInput.focus();
});

// ── Options ───────────────────────────────────────────────────────────────────

$('options-link').addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── Page detection (show detected banner if current tab has a known creator) ──

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    let platform = null;
    let username = null;

    // Twitter / X
    if (url.hostname === 'twitter.com' || url.hostname === 'x.com') {
      const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      const reserved = ['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i'];
      if (match && !reserved.includes(match[1].toLowerCase())) {
        platform = 'twitter';
        username = match[1];
      }
    }

    // Reddit
    if (url.hostname === 'www.reddit.com' || url.hostname === 'reddit.com') {
      const match = url.pathname.match(/^\/(?:user|u)\/([^/]+)/);
      if (match) { platform = 'reddit'; username = match[1]; }
    }

    // YouTube
    if (url.hostname === 'www.youtube.com') {
      const atMatch = url.pathname.match(/^\/@([^/]+)/);
      if (atMatch) { platform = 'youtube'; username = atMatch[1]; }
    }

    if (!platform || !username) return;

    // Look up by social proof
    chrome.runtime.sendMessage(
      { type: 'LOOKUP_SOCIAL', payload: { platform, username } },
      (response) => {
        if (chrome.runtime.lastError || !response?.identity) return;
        const identity = response.identity;
        const banner = $('detected-banner');
        $('detected-text').textContent =
          `${username} on ${platform} → @${identity.handle} — click to tip`;
        banner.style.display = 'flex';
        banner.style.cursor = 'pointer';
        banner.addEventListener('click', () => {
          showResult(identity);
          banner.style.display = 'none';
        });
      }
    );
  } catch {
    // Tab access not available — ignore
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Load API base from background
  chrome.runtime.sendMessage({ type: 'GET_API_BASE' }, (response) => {
    if (response?.base) apiBase = response.base;
  });

  showState('idle');
  searchInput.focus();
  checkCurrentTab();
}

init();

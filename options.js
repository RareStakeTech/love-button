/**
 * ReddID Love Button v2.1 — Options / settings page
 */

const DEFAULT_API_BASE      = 'https://redd.love';
const DEFAULT_EXPLORER_BASE = 'https://live.reddcoin.com';

const apiInput      = document.getElementById('api-base');
const explorerInput = document.getElementById('explorer-base');
const saveBtn       = document.getElementById('save-btn');
const resetBtn      = document.getElementById('reset-btn');
const saveStatus    = document.getElementById('save-status');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const cacheStatus   = document.getElementById('cache-status');
const cacheCount    = document.getElementById('cache-count');
const extVersion    = document.getElementById('ext-version');

// ── Status helper ─────────────────────────────────────────────────────────────

function showStatus(el, type, msg, duration = 3000) {
  el.className = `status ${type}`;
  el.textContent = msg;
  if (duration) setTimeout(() => { el.className = 'status'; el.textContent = ''; }, duration);
}

// ── URL validation ────────────────────────────────────────────────────────────

function validateUrl(raw, fallback) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '') || fallback;
  try {
    const u = new URL(trimmed);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, value: null };
  }
}

// ── Load stored settings ──────────────────────────────────────────────────────

async function load() {
  // apiBase is in sync storage; explorerBase in local
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['apiBase']),
    chrome.storage.local.get(['explorerBase']),
  ]);

  apiInput.value      = syncData.apiBase      || DEFAULT_API_BASE;
  explorerInput.value = localData.explorerBase || DEFAULT_EXPLORER_BASE;

  extVersion.textContent = chrome.runtime.getManifest().version;
  refreshCacheCount();
}

async function refreshCacheCount() {
  const all = await chrome.storage.local.get(null);
  const count = Object.keys(all).filter(k =>
    k.startsWith('handle:') || k.startsWith('social:') || k.startsWith('explorer:')
  ).length;
  cacheCount.textContent = count === 0 ? 'empty' : `${count} entries`;
}

// ── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const api = validateUrl(apiInput.value, DEFAULT_API_BASE);
  if (!api.ok) {
    showStatus(saveStatus, 'error', 'API URL invalid — must start with https:// or http://');
    return;
  }
  const explorer = validateUrl(explorerInput.value, DEFAULT_EXPLORER_BASE);
  if (!explorer.ok) {
    showStatus(saveStatus, 'error', 'Explorer URL invalid — must start with https:// or http://');
    return;
  }

  apiInput.value      = api.value;
  explorerInput.value = explorer.value;

  await Promise.all([
    chrome.storage.sync.set({ apiBase: api.value }),
    chrome.storage.local.set({ explorerBase: explorer.value }),
  ]);

  // Drop identity and explorer cache so new settings take effect immediately
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  showStatus(saveStatus, 'success', 'Settings saved.');
});

// ── Reset ─────────────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', async () => {
  apiInput.value      = DEFAULT_API_BASE;
  explorerInput.value = DEFAULT_EXPLORER_BASE;

  await Promise.all([
    chrome.storage.sync.set({ apiBase: DEFAULT_API_BASE }),
    chrome.storage.local.set({ explorerBase: DEFAULT_EXPLORER_BASE }),
  ]);

  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  showStatus(saveStatus, 'success', 'Reset to defaults.');
});

// ── Clear cache ───────────────────────────────────────────────────────────────

clearCacheBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, async () => {
    await refreshCacheCount();
    showStatus(cacheStatus, 'success', 'Cache cleared.');
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

load();

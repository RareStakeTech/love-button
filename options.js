/**
 * ReddID Love Button v2 — Options / settings page
 */

const DEFAULT_API_BASE = 'https://redd.love';

const apiInput    = document.getElementById('api-base');
const saveBtn     = document.getElementById('save-btn');
const resetBtn    = document.getElementById('reset-btn');
const saveStatus  = document.getElementById('save-status');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const cacheStatus = document.getElementById('cache-status');
const cacheCount  = document.getElementById('cache-count');
const extVersion  = document.getElementById('ext-version');

// ── Status helpers ────────────────────────────────────────────────────────────

function showStatus(el, type, msg, duration = 3000) {
  el.className = `status ${type}`;
  el.textContent = msg;
  if (duration) setTimeout(() => { el.className = 'status'; el.textContent = ''; }, duration);
}

// ── Load stored settings ──────────────────────────────────────────────────────

async function load() {
  const { apiBase } = await chrome.storage.local.get('apiBase');
  apiInput.value = apiBase || DEFAULT_API_BASE;

  const manifest = chrome.runtime.getManifest();
  extVersion.textContent = manifest.version;

  refreshCacheCount();
}

async function refreshCacheCount() {
  const all = await chrome.storage.local.get(null);
  // Cache entries are keyed 'cache_<handle>' or 'social_<platform>_<username>'
  const count = Object.keys(all).filter(k => k.startsWith('cache_') || k.startsWith('social_')).length;
  cacheCount.textContent = count === 0 ? 'empty' : `${count} entries`;
}

// ── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const raw = apiInput.value.trim();
  let base = raw || DEFAULT_API_BASE;

  // Normalize: strip trailing slash
  base = base.replace(/\/+$/, '');

  // Basic URL validation
  try {
    const u = new URL(base);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('must be http/https');
  } catch {
    showStatus(saveStatus, 'error', 'Invalid URL — must start with https:// or http://');
    return;
  }

  await chrome.storage.local.set({ apiBase: base });
  apiInput.value = base;

  // Notify background to drop cache so new base takes effect immediately
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });

  showStatus(saveStatus, 'success', 'Settings saved.');
});

// ── Reset ─────────────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ apiBase: DEFAULT_API_BASE });
  apiInput.value = DEFAULT_API_BASE;
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  showStatus(saveStatus, 'success', 'Reset to default.');
});

// ── Clear cache ───────────────────────────────────────────────────────────────

clearCacheBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, async () => {
    await refreshCacheCount();
    showStatus(cacheStatus, 'success', 'Cache cleared.');
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

load();

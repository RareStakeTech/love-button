/**
 * ReddID Love Button v2.1 — Service Worker (Manifest V3)
 *
 * Handles:
 * - ReddID Next API lookups (5-min cache)
 * - Block explorer balance/tx queries (2-min cache)
 * - Context menu right-click lookup
 * - Handle history (last 10 looked-up handles)
 * - Message routing from popup and content scripts
 */

const CACHE_TTL_MS      = 5 * 60 * 1000; // 5 min — identity lookups
const EXPLORER_TTL_MS   = 2 * 60 * 1000; // 2 min — on-chain data
const HISTORY_MAX       = 10;

// ── Settings ─────────────────────────────────────────────────────────────────

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get(['apiBase']);
  return apiBase || 'https://redd.love';
}

async function getExplorerBase() {
  const { explorerBase } = await chrome.storage.local.get(['explorerBase']);
  // Default: Reddcoin Insight-compatible explorer.
  // Configurable in Options so users can point at a self-hosted node.
  return explorerBase || 'https://live.reddcoin.com';
}

// ── Generic cache ─────────────────────────────────────────────────────────────

async function getCached(key, ttl = CACHE_TTL_MS) {
  const result = await chrome.storage.local.get([key]);
  const entry = result[key];
  if (!entry) return undefined; // undefined = miss; null = cached-negative
  if (Date.now() - entry.timestamp > ttl) {
    await chrome.storage.local.remove([key]);
    return undefined;
  }
  return entry.data;
}

async function setCache(key, data) {
  await chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } });
}

// ── ReddID API ────────────────────────────────────────────────────────────────

async function lookupHandle(handle) {
  const key = `handle:${handle.toLowerCase()}`;
  const cached = await getCached(key);
  if (cached !== undefined) return cached;

  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/identities/${encodeURIComponent(handle)}`);
    const identity = res.ok ? ((await res.json()).identity ?? null) : null;
    await setCache(key, identity);
    return identity;
  } catch {
    return null;
  }
}

async function lookupBySocialProof(platform, username) {
  const key = `social:${platform}:${username.toLowerCase()}`;
  const cached = await getCached(key);
  if (cached !== undefined) return cached;

  try {
    const apiBase = await getApiBase();
    const params = new URLSearchParams({ platform, username });
    const res = await fetch(`${apiBase}/api/identities/by-social?${params}`);
    const identity = res.ok ? ((await res.json()).identity ?? null) : null;
    await setCache(key, identity);
    return identity;
  } catch {
    return null;
  }
}

// ── Block explorer ────────────────────────────────────────────────────────────

/**
 * Fetch on-chain address info from an Insight-compatible API.
 * Returns { balance, totalReceived, txCount } or null on failure.
 *
 * Insight API endpoint: GET /api/addr/{address}
 * Compatible with: reddcore insight, bitcore insight, blockbook (partial)
 */
async function lookupAddressInfo(address) {
  const key = `explorer:${address}`;
  const cached = await getCached(key, EXPLORER_TTL_MS);
  if (cached !== undefined) return cached;

  try {
    const explorerBase = await getExplorerBase();
    if (!explorerBase) { await setCache(key, null); return null; }

    const res = await fetch(`${explorerBase}/api/addr/${encodeURIComponent(address)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) { await setCache(key, null); return null; }

    const d = await res.json();
    const info = {
      balance:       d.balance       ?? 0,
      totalReceived: d.totalReceived ?? 0,
      totalSent:     d.totalSent     ?? 0,
      txCount:       d.txApperances  ?? 0, // insight typo is intentional
      unconfirmed:   d.unconfirmedBalance ?? 0,
    };
    await setCache(key, info);
    return info;
  } catch {
    await setCache(key, null);
    return null;
  }
}

// ── Handle history ────────────────────────────────────────────────────────────

async function getHistory() {
  const { lookupHistory } = await chrome.storage.local.get(['lookupHistory']);
  return lookupHistory || [];
}

async function addToHistory(identity) {
  if (!identity?.handle) return;
  let history = await getHistory();
  // Remove any existing entry for this handle, then prepend
  history = history.filter(h => h.handle !== identity.handle);
  history.unshift({
    handle:      identity.handle,
    displayName: identity.displayName ?? null,
    rddAddress:  identity.rddAddress,
    timestamp:   Date.now(),
  });
  if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
  await chrome.storage.local.set({ lookupHistory: history });
}

// ── Context menu ──────────────────────────────────────────────────────────────

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:        'reddid-lookup',
      title:     'Look up ReddID: "%s"',
      contexts:  ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(setupContextMenu);
chrome.runtime.onStartup.addListener(setupContextMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'reddid-lookup') return;

  // Clean the selected text into a handle candidate
  const raw = (info.selectionText || '').trim().replace(/^@/, '').toLowerCase();
  if (!raw || !/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(raw)) return;

  const identity = await lookupHandle(raw);

  if (identity) {
    // Found — store as pending result so popup can display it immediately
    await chrome.storage.local.set({ pendingQuery: raw, pendingResult: identity });
    await addToHistory(identity);
  } else {
    // Not found — store query so popup can show "not found" gracefully
    await chrome.storage.local.set({ pendingQuery: raw, pendingResult: null });
  }

  // Open the popup (requires Chrome 127+; gracefully fails on older versions)
  try {
    await chrome.action.openPopup();
  } catch {
    // Fallback: open the tip page search in a new tab
    const apiBase = await getApiBase();
    chrome.tabs.create({ url: `${apiBase}/register` });
  }
});

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'LOOKUP_HANDLE') {
    lookupHandle(payload.handle).then(identity => sendResponse({ identity }));
    return true;
  }

  if (type === 'LOOKUP_SOCIAL') {
    lookupBySocialProof(payload.platform, payload.username)
      .then(identity => sendResponse({ identity }));
    return true;
  }

  if (type === 'LOOKUP_ADDRESS_INFO') {
    lookupAddressInfo(payload.address).then(info => sendResponse({ info }));
    return true;
  }

  if (type === 'GET_API_BASE') {
    getApiBase().then(base => sendResponse({ base }));
    return true;
  }

  if (type === 'GET_EXPLORER_BASE') {
    getExplorerBase().then(base => sendResponse({ base }));
    return true;
  }

  if (type === 'GET_HISTORY') {
    getHistory().then(history => sendResponse({ history }));
    return true;
  }

  if (type === 'ADD_TO_HISTORY') {
    addToHistory(payload.identity).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (type === 'CLEAR_CACHE') {
    // Clear cache keys but preserve settings and history
    chrome.storage.local.get(null, items => {
      const cacheKeys = Object.keys(items).filter(k =>
        k.startsWith('handle:') || k.startsWith('social:') || k.startsWith('explorer:')
      );
      if (cacheKeys.length) chrome.storage.local.remove(cacheKeys);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (type === 'CLEAR_PENDING') {
    chrome.storage.local.remove(['pendingQuery', 'pendingResult'])
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});

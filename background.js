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
  return explorerBase || 'https://blockbook.reddcoin.com';
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
 * Fetch on-chain address info.
 * Tries Blockbook v2 API first (default: blockbook.reddcoin.com),
 * falls back to Insight API format for self-hosted nodes.
 *
 * Blockbook: GET /api/v2/address/{address}  — balances are satoshi strings
 * Insight:   GET /api/addr/{address}         — balances are RDD floats
 */
async function lookupAddressInfo(address) {
  const key = `explorer:${address}`;
  const cached = await getCached(key, EXPLORER_TTL_MS);
  if (cached !== undefined) return cached;

  try {
    const explorerBase = await getExplorerBase();
    if (!explorerBase) { await setCache(key, null); return null; }

    // Blockbook v2
    const bbRes = await fetch(
      `${explorerBase}/api/v2/address/${encodeURIComponent(address)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (bbRes.ok) {
      const d = await bbRes.json();
      // Blockbook returns satoshi values as decimal strings; RDD has 8 decimals
      const sat = s => (parseInt(s || '0', 10) / 1e8);
      const info = {
        balance:       sat(d.balance),
        totalReceived: sat(d.totalReceived),
        totalSent:     sat(d.totalSent),
        txCount:       d.txs ?? 0,
        unconfirmed:   sat(d.unconfirmedBalance),
      };
      await setCache(key, info);
      return info;
    }

    // Insight fallback (for self-hosted reddcore nodes)
    const insightRes = await fetch(
      `${explorerBase}/api/addr/${encodeURIComponent(address)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!insightRes.ok) { await setCache(key, null); return null; }
    const d = await insightRes.json();
    const info = {
      balance:       d.balance            ?? 0,
      totalReceived: d.totalReceived      ?? 0,
      totalSent:     d.totalSent          ?? 0,
      txCount:       d.txApperances       ?? 0, // insight typo is intentional
      unconfirmed:   d.unconfirmedBalance ?? 0,
    };
    await setCache(key, info);
    return info;
  } catch {
    await setCache(key, null);
    return null;
  }
}

// ── Identity helpers ──────────────────────────────────────────────────────────

/**
 * Extract the primary RDD address from a v1 or v2 identity object.
 *
 * v2 identities expose a `wallets[]` array; v1 used a bare `rddAddress` string.
 * We try wallets[] first, then fall back to the legacy field so the extension
 * works against both old and new API responses during the schema migration window.
 *
 * @param {Object|null} identity
 * @returns {string|null}
 */
function primaryRddAddress(identity) {
  if (!identity) return null;
  // v2: wallets[] — prefer primary, fall back to any active RDD wallet
  if (Array.isArray(identity.wallets)) {
    const primary = identity.wallets.find(
      w => w.chain === 'rdd' && w.primary && !w.revokedAt
    );
    if (primary) return primary.address;
    const any = identity.wallets.find(
      w => w.chain === 'rdd' && !w.revokedAt
    );
    if (any) return any.address;
  }
  // v1 fallback
  return identity.rddAddress ?? null;
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
    rddAddress:  primaryRddAddress(identity),
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

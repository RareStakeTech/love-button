/**
 * ReddID Love Button v2 — Service Worker (Manifest V3)
 *
 * Handles:
 * - ReddID Next API calls (cached)
 * - Message passing from content scripts
 * - Storage of user settings and cache
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Settings ────────────────────────────────────────────────────────────────

async function getApiBase() {
  const result = await chrome.storage.sync.get(['apiBase']);
  return result.apiBase || 'https://redd.love';
}

// ── Cache helpers ────────────────────────────────────────────────────────────

async function getCached(key) {
  const result = await chrome.storage.local.get([key]);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    await chrome.storage.local.remove([key]);
    return null;
  }
  return entry.data;
}

async function setCache(key, data) {
  await chrome.storage.local.set({
    [key]: { data, timestamp: Date.now() },
  });
}

// ── ReddID API ───────────────────────────────────────────────────────────────

/**
 * Look up a ReddID handle. Returns identity object or null.
 */
async function lookupHandle(handle) {
  const cacheKey = `handle:${handle.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/identities/${encodeURIComponent(handle)}`);
    if (!res.ok) {
      await setCache(cacheKey, null); // cache negative result too
      return null;
    }
    const data = await res.json();
    const identity = data.identity ?? null;
    await setCache(cacheKey, identity);
    return identity;
  } catch {
    return null;
  }
}

/**
 * Look up a ReddID handle by social proof (platform + username).
 * Calls the social-proof lookup endpoint (available in v0.2+).
 */
async function lookupBySocialProof(platform, username) {
  const cacheKey = `social:${platform}:${username.toLowerCase()}`;
  const cached = await getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const apiBase = await getApiBase();
    const params = new URLSearchParams({ platform, username });
    const res = await fetch(`${apiBase}/api/identities/by-social?${params}`);
    if (!res.ok) {
      await setCache(cacheKey, null);
      return null;
    }
    const data = await res.json();
    const identity = data.identity ?? null;
    await setCache(cacheKey, identity);
    return identity;
  } catch {
    return null;
  }
}

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  if (type === 'LOOKUP_HANDLE') {
    lookupHandle(payload.handle).then(identity => {
      sendResponse({ identity });
    });
    return true; // keeps the message channel open for async response
  }

  if (type === 'LOOKUP_SOCIAL') {
    lookupBySocialProof(payload.platform, payload.username).then(identity => {
      sendResponse({ identity });
    });
    return true;
  }

  if (type === 'GET_API_BASE') {
    getApiBase().then(base => sendResponse({ base }));
    return true;
  }

  if (type === 'CLEAR_CACHE') {
    chrome.storage.local.clear().then(() => sendResponse({ ok: true }));
    return true;
  }
});

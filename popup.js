/**
 * ReddID Love Button v2.1 — Popup controller
 */

'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const searchInput    = $('search-input');
const searchBtn      = $('search-btn');
const detectedBanner = $('detected-banner');
const detectedText   = $('detected-text');
const loadingHandle  = $('loading-handle');
const resultHandle   = $('result-handle');
const resultName     = $('result-name');
const resultBio      = $('result-bio');
const resultAddress  = $('result-address');
const addrTypeBadge  = $('addr-type-badge');
const openTipPage    = $('open-tip-page');
const copyHandleBtn  = $('copy-handle-btn');
const clearBtn       = $('clear-btn');
const copyAddrBtn      = $('copy-addr-btn');
const openWalletBtn    = $('open-wallet-btn');
const copyBip21Btn     = $('copy-bip21-btn');
const tipChips         = $('tip-chips');
const customAmountRow  = $('custom-amount-row');
const customAmountInput = $('custom-amount-input');
const balanceLoading = $('balance-loading');
const balanceData    = $('balance-data');
const balanceError   = $('balance-error');
const balBalance     = $('bal-balance');
const balReceived    = $('bal-received');
const balTxcount     = $('bal-txcount');
const historySection = $('history-section');
const historyList    = $('history-list');
const historyCount   = $('history-count');
const optionsLink    = $('options-link');

// ── State ─────────────────────────────────────────────────────────────────────

let currentIdentity  = null;
let currentApiBase   = 'https://redd.love';
let selectedAmount   = null; // number | null

function showState(state) {
  for (const s of ['idle', 'loading', 'error', 'result']) {
    const el = $(`state-${s}`);
    if (el) el.style.display = s === state ? '' : 'none';
  }
}

// ── Message helper ────────────────────────────────────────────────────────────

function sendMsg(msg) {
  return new Promise(resolve =>
    chrome.runtime.sendMessage(msg, res => resolve(res ?? {}))
  );
}

// ── Address type badge ────────────────────────────────────────────────────────

function setAddrTypeBadge(addr) {
  addrTypeBadge.style.display = 'none';
  addrTypeBadge.className = 'addr-type-badge';
  if (!addr) return;
  if (addr.startsWith('rdd1')) {
    addrTypeBadge.style.display = '';
    addrTypeBadge.classList.add('addr-type-segwit');
    addrTypeBadge.textContent = 'SegWit';
  } else if (addr.startsWith('R') && addr.length === 34) {
    addrTypeBadge.style.display = '';
    addrTypeBadge.classList.add('addr-type-legacy');
    addrTypeBadge.textContent = 'Legacy';
  }
}

// ── Balance display ───────────────────────────────────────────────────────────

function formatRdd(val) {
  const n = typeof val === 'number' ? val : parseFloat(val) || 0;
  if (n === 0)            return '0 Ɍ';
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M Ɍ`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(2)}K Ɍ`;
  return `${n.toFixed(4)} Ɍ`;
}

function resetBalance() {
  balanceLoading.style.display = '';
  balanceData.style.display    = 'none';
  balanceError.style.display   = 'none';
}

function showBalance(info) {
  balanceLoading.style.display = 'none';
  if (!info) {
    balanceError.style.display = '';
    balanceData.style.display  = 'none';
    return;
  }
  balanceData.style.display  = '';
  balanceError.style.display = 'none';
  balBalance.textContent  = formatRdd(info.balance);
  balReceived.textContent = formatRdd(info.totalReceived);
  balTxcount.textContent  = String(info.txCount ?? 0);
}

async function fetchBalance(address) {
  resetBalance();
  const { info } = await sendMsg({ type: 'LOOKUP_ADDRESS_INFO', payload: { address } });
  showBalance(info ?? null);
}

// ── Copy helpers ──────────────────────────────────────────────────────────────

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function flashCopied(btn, originalText) {
  btn.textContent = '✓ Copied';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = originalText;
    btn.classList.remove('copied');
  }, 1800);
}

// ── Show result ───────────────────────────────────────────────────────────────

async function showResult(identity) {
  currentIdentity = identity;
  resetAmountChips();

  resultHandle.textContent = `@${identity.handle}`;
  resultName.textContent   = identity.displayName || identity.handle;

  if (identity.bio) {
    resultBio.textContent   = identity.bio;
    resultBio.style.display = '';
  } else {
    resultBio.style.display = 'none';
  }

  resultAddress.textContent = identity.rddAddress || '—';
  setAddrTypeBadge(identity.rddAddress);

  const { base } = await sendMsg({ type: 'GET_API_BASE' });
  currentApiBase = base || 'https://redd.love';
  openTipPage.href = `${currentApiBase}/${identity.handle}`;

  showState('result');
  detectedBanner.style.display = 'none';

  sendMsg({ type: 'ADD_TO_HISTORY', payload: { identity } });

  if (identity.rddAddress) {
    fetchBalance(identity.rddAddress);
  } else {
    balanceLoading.style.display = 'none';
    balanceError.style.display   = '';
  }

  renderHistory();
}

// ── Handle lookup ─────────────────────────────────────────────────────────────

async function lookupHandle(raw) {
  const handle = (raw || '').trim().replace(/^@/, '').toLowerCase();
  if (!handle) return;

  loadingHandle.textContent = handle;
  showState('loading');
  searchBtn.disabled = true;

  const { identity } = await sendMsg({ type: 'LOOKUP_HANDLE', payload: { handle } });
  searchBtn.disabled = false;

  if (identity) {
    await showResult(identity);
  } else {
    $('error-msg').textContent =
      `@${handle} is not registered on ReddID.\nVisit redd.love to claim this handle.`;
    showState('error');
  }
}

// ── Tab detection ─────────────────────────────────────────────────────────────

const RESERVED = new Set([
  'home', 'explore', 'notifications', 'messages', 'search', 'settings',
  'i', 'compose', 'intent', 'share', 'login', 'signup', 'logout',
  'privacy', 'tos', 'about', 'jobs', 'communities', 'lists',
  'bookmarks', 'topics', 'tw', 'user', 'u',
  'direct', 'accounts', 'p', 'reel', 'reels', 'stories', 'tv',
  'ar', 'challenge', 'legal', 'help', 'press', 'api', 'oauth',
  'graphql', 'static', 'emails', 'ads', 'studio', 'developers',
]);

function detectPlatform(url) {
  const h = url.hostname.replace(/^www\./, '');
  const p = url.pathname;

  if (h === 'twitter.com' || h === 'x.com') {
    const m = p.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'twitter', username: m[1] };
  }
  if (h === 'reddit.com') {
    const m = p.match(/^\/(?:user|u)\/([^/?#]+)/);
    if (m) return { platform: 'reddit', username: m[1] };
  }
  if (h === 'youtube.com') {
    const m = p.match(/^\/@([^/]+)/);
    if (m) return { platform: 'youtube', username: m[1] };
  }
  if (h === 'twitch.tv') {
    const m = p.match(/^\/([a-zA-Z0-9_]{1,25})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'twitch', username: m[1] };
  }
  if (h === 'instagram.com') {
    const segs = p.split('/').filter(Boolean);
    if (segs.length >= 1 && !RESERVED.has(segs[0].toLowerCase()))
      return { platform: 'instagram', username: segs[0] };
  }
  if (h === 'tiktok.com') {
    const m = p.match(/^\/@([a-zA-Z0-9_.]{1,24})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'tiktok', username: m[1] };
  }
  return null;
}

async function autoLookupSocial(platform, username) {
  detectedBanner.style.display = 'none';
  loadingHandle.textContent = username;
  showState('loading');

  const { identity: social } = await sendMsg({
    type: 'LOOKUP_SOCIAL',
    payload: { platform, username },
  });
  if (social) { await showResult(social); return; }

  const { identity: direct } = await sendMsg({
    type: 'LOOKUP_HANDLE',
    payload: { handle: username.toLowerCase() },
  });
  if (direct) { await showResult(direct); return; }

  $('error-msg').textContent =
    `No ReddID found for ${username} on ${platform}.\nThey may not have registered yet.`;
  showState('error');
}

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url = new URL(tab.url);
    const detected = detectPlatform(url);
    if (!detected) return;

    const { platform, username } = detected;
    detectedText.textContent = `${username} on ${platform} — click to look up`;
    detectedBanner.style.display = 'flex';
    detectedBanner.onclick = () => autoLookupSocial(platform, username);
  } catch {
    // tab access unavailable
  }
}

// ── History ───────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function relativeTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function renderHistory() {
  const { history } = await sendMsg({ type: 'GET_HISTORY' });
  if (!history?.length) { historySection.style.display = 'none'; return; }

  historySection.style.display = '';
  historyCount.textContent = `${history.length}/10`;
  historyList.innerHTML = '';

  for (const entry of history) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="history-handle">@${escapeHtml(entry.handle)}</div>
        ${entry.displayName ? `<div class="history-name">${escapeHtml(entry.displayName)}</div>` : ''}
      </div>
      <div style="font-size:9px;color:var(--dim);white-space:nowrap">${relativeTime(entry.timestamp)}</div>
    `;
    item.addEventListener('click', () => lookupHandle(entry.handle));
    historyList.appendChild(item);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

searchBtn.addEventListener('click', () => lookupHandle(searchInput.value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') lookupHandle(searchInput.value); });
searchInput.addEventListener('input', () => {
  const clean = searchInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (clean !== searchInput.value) searchInput.value = clean;
});

clearBtn.addEventListener('click', () => {
  currentIdentity = null;
  searchInput.value = '';
  detectedBanner.style.display = 'none';
  resetAmountChips();
  showState('idle');
});

copyAddrBtn.addEventListener('click', async () => {
  if (!currentIdentity?.rddAddress) return;
  if (await copyText(currentIdentity.rddAddress)) flashCopied(copyAddrBtn, 'Copy');
});

copyHandleBtn.addEventListener('click', async () => {
  if (!currentIdentity?.handle) return;
  if (await copyText(`@${currentIdentity.handle}`)) flashCopied(copyHandleBtn, '@ Copy');
});

// ── Tip amount chips ──────────────────────────────────────────────────────────

function resetAmountChips() {
  if (!tipChips) return;
  tipChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  customAmountRow.style.display = 'none';
  customAmountInput.value = '';
  selectedAmount = null;
}

tipChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  tipChips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  if (chip.dataset.amount === 'custom') {
    customAmountRow.style.display = '';
    customAmountInput.focus();
    const v = parseInt(customAmountInput.value, 10);
    selectedAmount = (!isNaN(v) && v > 0) ? v : null;
  } else {
    customAmountRow.style.display = 'none';
    selectedAmount = parseInt(chip.dataset.amount, 10);
  }
});

customAmountInput.addEventListener('input', () => {
  const v = parseInt(customAmountInput.value, 10);
  selectedAmount = (!isNaN(v) && v > 0) ? v : null;
});

function getBip21Uri() {
  if (!currentIdentity?.rddAddress) return null;
  const base = `reddcoin:${currentIdentity.rddAddress}`;
  return selectedAmount ? `${base}?amount=${selectedAmount}` : base;
}

// ── BIP21 handlers ────────────────────────────────────────────────────────────

openWalletBtn.addEventListener('click', () => {
  const uri = getBip21Uri();
  if (!uri) return;
  window.open(uri, '_blank', 'noopener,noreferrer');
});

copyBip21Btn.addEventListener('click', async () => {
  const uri = getBip21Uri();
  if (!uri) return;
  if (await copyText(uri)) flashCopied(copyBip21Btn, 'Copy Ɍ URI');
});

optionsLink.addEventListener('click', e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  showState('idle');
  renderHistory();

  // Pending context-menu result takes priority
  const stored = await chrome.storage.local.get(['pendingQuery', 'pendingResult']);
  if (stored.pendingQuery !== undefined) {
    sendMsg({ type: 'CLEAR_PENDING' });
    if (stored.pendingResult) {
      await showResult(stored.pendingResult);
    } else {
      $('error-msg').textContent =
        `@${stored.pendingQuery} is not registered on ReddID.\nVisit redd.love to claim this handle.`;
      showState('error');
    }
    return;
  }

  // Otherwise show detected-banner for current tab (no auto-resolve, just the banner)
  checkCurrentTab();
}

init();

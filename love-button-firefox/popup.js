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

/**
 * Extract the primary RDD address from a v1 or v2 identity object.
 * v2 identities expose wallets[]; v1 used a bare rddAddress string.
 * Falls back to rddAddress so the popup works during the schema migration window.
 */
function primaryRddAddress(identity) {
  if (!identity) return null;
  if (Array.isArray(identity.wallets)) {
    const primary = identity.wallets.find(
      w => w.chain === 'rdd' && w.primary && !w.revokedAt
    );
    if (primary) return primary.address;
    const any = identity.wallets.find(w => w.chain === 'rdd' && !w.revokedAt);
    if (any) return any.address;
  }
  return identity.rddAddress ?? null;
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
  txnsLoaded = false;
  resetAmountChips();
  resetTabs();

  resultHandle.textContent = `@${identity.handle}`;
  resultName.textContent   = identity.displayName || identity.handle;
  renderSocialProofs(identity);

  if (identity.bio) {
    resultBio.textContent   = identity.bio;
    resultBio.style.display = '';
  } else {
    resultBio.style.display = 'none';
  }

  const rddAddr = primaryRddAddress(identity);
  resultAddress.textContent = rddAddr || '—';
  setAddrTypeBadge(rddAddr);

  const { base } = await sendMsg({ type: 'GET_API_BASE' });
  currentApiBase = base || 'https://redd.love';
  openTipPage.href = `${currentApiBase}/${identity.handle}`;

  showState('result');
  detectedBanner.style.display = 'none';

  sendMsg({ type: 'ADD_TO_HISTORY', payload: { identity } });

  if (rddAddr) {
    fetchBalance(rddAddr);
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
  if (h === 'github.com') {
    const m = p.match(/^\/([A-Za-z0-9_-]{1,39})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'github', username: m[1] };
  }
  if (h === 'bsky.app') {
    const m = p.match(/^\/profile\/([^/?#]+)\/?$/);
    if (m) return { platform: 'bluesky', username: m[1] };
  }
  // Mastodon — any instance that matches the /@user pattern
  if (p.match(/^\/@([A-Za-z0-9_]{1,60})(?:@[^/?#]+)?\/?$/)) {
    // Only fire for known Mastodon instances (avoid collisions with TruthSocial etc.)
    const MASTODON_INSTANCES = new Set([
      'mastodon.social', 'mastodon.online', 'fosstodon.org', 'infosec.exchange',
      'mstdn.social', 'hachyderm.io', 'techhub.social', 'mastodon.world',
      'aus.social', 'social.coop', 'sigmoid.social', 'indieweb.social',
      'mastodon.gamedev.place', 'scholar.social', 'universeodon.com',
    ]);
    if (MASTODON_INSTANCES.has(h)) {
      const m = p.match(/^\/@([A-Za-z0-9_]{1,60})(?:@[^/?#]+)?\/?$/);
      if (m) return { platform: 'mastodon', username: `${m[1]}@${h}` };
    }
  }
  if (h === 'truthsocial.com') {
    const m = p.match(/^\/@([A-Za-z0-9_]{1,50})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'truthsocial', username: m[1] };
  }
  if (h === 'rumble.com') {
    const mc = p.match(/^\/c\/([A-Za-z0-9_-]{2,50})\/?$/);
    if (mc) return { platform: 'rumble', username: mc[1] };
    const mu = p.match(/^\/user\/([A-Za-z0-9_-]{2,50})\/?$/);
    if (mu) return { platform: 'rumble', username: mu[1] };
  }
  if (h === 'odysee.com') {
    const m = p.match(/^\/@([A-Za-z0-9_-]{2,60})(?::[a-f0-9]+)?\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'odysee', username: m[1] };
  }
  if (h === 'kick.com') {
    const m = p.match(/^\/([A-Za-z0-9_]{3,30})\/?$/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return { platform: 'kick', username: m[1] };
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

// ── Tab switching ─────────────────────────────────────────────────────────────

const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
    if (target === 'txns' && primaryRddAddress(currentIdentity)) {
      loadTxns(primaryRddAddress(currentIdentity));
    }
  });
});

function resetTabs() {
  tabBtns.forEach((b, i) => b.classList.toggle('active', i === 0));
  tabPanels.forEach((p, i) => p.classList.toggle('active', i === 0));
}

// ── Social proof badges (E7 — richer display) ────────────────────────────────

const PLAT_ICONS = {
  twitter:     '𝕏',
  youtube:     '▶',
  reddit:      '●',
  twitch:      '⬟',
  instagram:   '◈',
  tiktok:      '♪',
  github:      '⌥',
  bluesky:     '☁',
  mastodon:    '🐘',
  rumble:      '▣',
  truthsocial: '◉',
  odysee:      '◎',
  kick:        '⚡',
};

const PLAT_NAMES = {
  twitter:     'X',
  youtube:     'YouTube',
  reddit:      'Reddit',
  twitch:      'Twitch',
  instagram:   'Instagram',
  tiktok:      'TikTok',
  github:      'GitHub',
  bluesky:     'Bluesky',
  mastodon:    'Mastodon',
  rumble:      'Rumble',
  truthsocial: 'Truth',
  odysee:      'Odysee',
  kick:        'Kick',
};

function socialProfileUrl(platform, username) {
  switch (platform) {
    case 'twitter':     return `https://twitter.com/${username}`;
    case 'reddit':      return `https://reddit.com/u/${username}`;
    case 'youtube':     return `https://youtube.com/@${username}`;
    case 'twitch':      return `https://twitch.tv/${username}`;
    case 'instagram':   return `https://instagram.com/${username}`;
    case 'tiktok':      return `https://tiktok.com/@${username}`;
    case 'github':      return `https://github.com/${username}`;
    case 'bluesky':     return `https://bsky.app/profile/${username}`;
    case 'mastodon': {
      if (username.includes('@')) {
        const [user, host] = username.split('@');
        return `https://${host}/@${user}`;
      }
      return `https://mastodon.social/@${username}`;
    }
    case 'rumble':      return `https://rumble.com/user/${username}`;
    case 'truthsocial': return `https://truthsocial.com/@${username}`;
    case 'odysee':      return `https://odysee.com/@${username}`;
    case 'kick':        return `https://kick.com/${username}`;
    default:            return null;
  }
}

function renderSocialProofs(identity) {
  const container = $('social-proofs');
  if (!container) return;
  const proofs = identity?.socialProofs ?? [];
  if (!proofs.length) { container.style.display = 'none'; return; }

  container.style.display = 'flex';
  container.innerHTML = '';

  for (const p of proofs) {
    const icon     = PLAT_ICONS[p.platform] ?? '🔗';
    const name     = PLAT_NAMES[p.platform]  ?? p.platform;
    const url      = socialProfileUrl(p.platform, p.username);
    const isLinked = p.verificationStatus === 'verified';

    const statusDot = isLinked
      ? '<span class="proof-dot proof-dot--linked" title="Proof URL on record">●</span>'
      : '<span class="proof-dot proof-dot--self"   title="Self-reported">○</span>';

    const inner = `<i class="plat-icon">${icon}</i> ${escapeHtml(name)}${statusDot}`;

    let el;
    if (url) {
      el = document.createElement('a');
      el.href   = url;
      el.target = '_blank';
      el.rel    = 'noopener noreferrer';
    } else {
      el = document.createElement('span');
    }
    el.className = `social-badge${isLinked ? ' social-badge--linked' : ''}`;
    el.title     = `@${p.username} on ${name}`;
    el.innerHTML = inner;
    container.appendChild(el);
  }
}

// ── Transaction history (Blockbook) ──────────────────────────────────────────

const SAT_DIVISOR = 1e8;
let txnsLoaded = false;

function satToRdd(s) {
  return (parseInt(s || '0', 10) / SAT_DIVISOR);
}

function relTimeShort(unix) {
  const d = Math.floor(Date.now() / 1000) - unix;
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

async function loadTxns(address) {
  const txnLoading = $('txn-loading');
  const txnList    = $('txn-list');
  if (!txnLoading || !txnList) return;

  // Don't re-fetch within the same result session
  if (txnsLoaded) return;

  txnLoading.style.display = 'flex';
  txnList.style.display    = 'none';
  txnList.innerHTML        = '';

  try {
    const { explorerBase } = await chrome.storage.local.get({ explorerBase: 'https://blockbook.reddcoin.com' });
    const url = `${explorerBase}/api/v2/address/${encodeURIComponent(address)}?details=txs&pageSize=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();

    const txs = (data.transactions ?? []).filter(tx => {
      const tot = (tx.vout ?? [])
        .filter(o => (o.addresses ?? []).includes(address))
        .reduce((s, o) => s + satToRdd(o.value), 0);
      return tot > 0;
    }).slice(0, 8);

    if (!txs.length) {
      txnList.innerHTML = '<div class="txn-empty">No incoming tips on-chain yet.</div>';
    } else {
      for (const tx of txs) {
        const amount = (tx.vout ?? [])
          .filter(o => (o.addresses ?? []).includes(address))
          .reduce((s, o) => s + satToRdd(o.value), 0);
        const time = tx.blockTime ? relTimeShort(tx.blockTime) : '⏳ unconfirmed';
        const a = document.createElement('a');
        a.className = 'txn-item';
        a.href = `https://blockbook.reddcoin.com/tx/${tx.txid}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.innerHTML = `
          <div>
            <div class="txn-amount">+${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} Ɍ</div>
            <div class="txn-time">${time}</div>
          </div>
          <div class="txn-id">${tx.txid.slice(0, 8)}…</div>
        `;
        txnList.appendChild(a);
      }
    }

    txnsLoaded = true;
  } catch {
    txnList.innerHTML = '<div class="txn-empty">Could not load transactions.<br>Check your block explorer setting.</div>';
  }

  txnLoading.style.display = 'none';
  txnList.style.display    = '';
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
  txnsLoaded = false;
  searchInput.value = '';
  detectedBanner.style.display = 'none';
  resetAmountChips();
  resetTabs();
  showState('idle');
});

copyAddrBtn.addEventListener('click', async () => {
  const addr = primaryRddAddress(currentIdentity);
  if (!addr) return;
  if (await copyText(addr)) flashCopied(copyAddrBtn, 'Copy');
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
  const addr = primaryRddAddress(currentIdentity);
  if (!addr) return null;
  const base = `reddcoin:${addr}`;
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

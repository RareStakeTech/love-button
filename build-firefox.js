#!/usr/bin/env node
/**
 * build-firefox.js — Create a Firefox MV3-compatible extension folder
 *
 * Usage:
 *   node build-firefox.js
 *
 * Produces: love-button-firefox/
 *   - All runtime extension files (see INCLUDE list below)
 *   - manifest.json patched for Firefox (gecko id + strict_min_version preserved,
 *     "type": "module" removed from background if present)
 *
 * Source manifest.json is NEVER modified.
 *
 * Key Firefox MV3 differences from Chrome:
 *   - Keep browser_specific_settings.gecko (required for AMO)
 *   - chrome.action.openPopup() unsupported in Firefox — the background.js
 *     call is wrapped in try/catch so it falls back gracefully
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────

const SRC_DIR = __dirname;
const OUT_DIR = path.join(SRC_DIR, 'love-button-firefox');

// ── Exclusion list ────────────────────────────────────────────────────────────
// Files/dirs excluded from the output. Exact name match at any depth.

const EXCLUDE_NAMES = new Set([
  // Build tooling
  'node_modules',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  // Dev-only scripts
  'gen-icons.js',
  'build-firefox.js',
  // Docs (not part of extension bundle)
  'README.md',
  'PLUGINS.md',
  'TESTING.md',
  'CHANGELOG.md',
  // CI/config
  '.web-ext-ignore',
  '.git',
  // Artefacts
  'manifest.firefox.json',
  'love-button-firefox',
  // Store assets
  'store',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE_NAMES.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// ── Build ─────────────────────────────────────────────────────────────────────

// 1. Clean output directory
if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}

// 2. Copy all runtime files (exclusions handled by copyDir)
copyDir(SRC_DIR, OUT_DIR);

// 3. Patch and overwrite manifest.json in the output directory
const base = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf8'));
const ff   = JSON.parse(JSON.stringify(base)); // deep clone

// Firefox MV3 background:
//   Firefox 109–120 require `scripts: [...]` (no service_worker field).
//   Firefox 121+ accepts `service_worker` as a Chrome compat alias.
//   Using `scripts` keeps the declared strict_min_version of 109.0 honest
//   and avoids the MANIFEST_FIELD_UNSUPPORTED lint error.
if (base.background.service_worker) {
  ff.background = { scripts: [base.background.service_worker] };
} else {
  ff.background = { ...base.background };
}
delete ff.background.type; // "type":"module" is not valid in Firefox MV3

// Ensure gecko block is present and accurate (required for AMO submission)
ff.browser_specific_settings = {
  gecko: {
    id: 'reddid-tipbutton@rarestaketech.com',
    strict_min_version: '109.0',
    // data_collection_permissions: will be required by AMO in a future Firefox release.
    // Omitted here until Mozilla publishes the valid enum values — adding an empty
    // required[] array causes a schema validation error (minItems: 1).
    // Track: https://blog.mozilla.org/addons/2025/03/31/data-consent-firefox-nightly/
  },
};

fs.writeFileSync(
  path.join(OUT_DIR, 'manifest.json'),
  JSON.stringify(ff, null, 2) + '\n'
);

// ── Report ────────────────────────────────────────────────────────────────────

const allFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); } else { allFiles.push(p); }
  }
}
walk(OUT_DIR);

console.log('');
console.log('✓ love-button-firefox/ created  (v' + ff.version + ')');
console.log('  ' + allFiles.length + ' files');
console.log('');
console.log('To test in Firefox:');
console.log('  1. about:debugging > This Firefox > Load Temporary Add-on');
console.log('  2. Select love-button-firefox/manifest.json');
console.log('');
console.log('To submit to addons.mozilla.org:');
console.log('  Zip love-button-firefox/ and upload to AMO');
console.log('');

#!/usr/bin/env node
/**
 * build-firefox.js — Generate a Firefox MV3-compatible manifest
 *
 * Usage:
 *   node build-firefox.js
 *
 * Reads manifest.json, applies Firefox-specific patches, and writes
 * manifest.firefox.json. Use this file when packaging for addons.mozilla.org.
 *
 * Key differences from Chrome MV3:
 *   - Remove "type": "module" from background (Firefox uses plain scripts)
 *   - Keep browser_specific_settings (gecko id + min version)
 *   - chrome.action.openPopup() is not supported in Firefox — falls back to tab open
 */

'use strict';

const fs = require('fs');

const base = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

const ff = JSON.parse(JSON.stringify(base)); // deep clone

// Firefox MV3 background: drop "type": "module" — not needed for plain scripts
ff.background = { service_worker: base.background.service_worker };

// Ensure gecko block is present (already in base, but be explicit)
ff.browser_specific_settings = {
  gecko: {
    id: 'reddid-tipbutton@rarestaketech.com',
    strict_min_version: '109.0',
  },
};

fs.writeFileSync('manifest.firefox.json', JSON.stringify(ff, null, 2) + '\n');
console.log('✓ manifest.firefox.json written (version ' + ff.version + ')');
console.log('');
console.log('To test in Firefox:');
console.log('  1. Open about:debugging > This Firefox > Load Temporary Add-on');
console.log('  2. Select manifest.json (works as-is for Firefox 109+)');
console.log('');
console.log('To submit to addons.mozilla.org:');
console.log('  1. Run: node build-firefox.js');
console.log('  2. Replace manifest.json with manifest.firefox.json in your zip');
console.log('  3. Zip the extension directory and upload to AMO');

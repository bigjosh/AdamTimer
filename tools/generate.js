#!/usr/bin/env node
'use strict';
// Bundle generator for AdamTimer group landing pages.
//
//   node tools/generate.js build-index          Regenerate the root index (group list).
//   node tools/generate.js add-group "<name>"   Create a group bundle for <name> (JSON result on stdout).
//   node tools/generate.js rebuild-all          Regenerate every /g/<id> bundle + the root index.
//
// Each group lives in /g/<ID>/ where ID is a 5-char Crockford-base32 hash of the
// normalized (case/space-folded) name. The hash is frozen forever: never change
// the algorithm once groups exist. The root index.html is a list of the existing
// groups (links to their subdirs), regenerated from ground truth (g/<ID>/group.json)
// every time a group is added.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(ROOT, 'templates');
const GROUPS_DIR = path.join(ROOT, 'g');
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I,L,O,U)

// A no-fetch "kill switch" service worker that retires the former root timer SW
// (so the root shows the list and group-page navigations are no longer hijacked
// by the old root app-shell rule). It unregisters itself and reloads windows;
// it never deletes caches, so installed group bundles keep their offline data.
const ROOT_SW = [
  '// Kill switch: retires the former root timer service worker.',
  "self.addEventListener('install', function () { self.skipWaiting(); });",
  "self.addEventListener('activate', function (event) {",
  '  event.waitUntil((async function () {',
  '    try { await self.registration.unregister(); } catch (e) {}',
  "    var clients = await self.clients.matchAll({ type: 'window' });",
  '    clients.forEach(function (c) { c.navigate(c.url); });',
  '  })());',
  '});',
  ''
].join('\n');

// --- name handling -------------------------------------------------------
function displayName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}
function hashKey(name) {
  return displayName(name).toLowerCase();
}
function hashId(name) {
  const digest = crypto.createHash('sha256').update(hashKey(name)).digest();
  let bits = 0, val = 0, out = '';
  for (const byte of digest) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(val >>> (bits - 5)) & 31];
      bits -= 5;
      if (out.length === 5) return out;
    }
  }
  return out;
}
function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- templating ----------------------------------------------------------
function jsForScript(value) {
  // JSON safe to embed inside an inline <script> (escape </script> breakouts).
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
function render(tplName, subs) {
  let s = fs.readFileSync(path.join(TPL, tplName), 'utf8');
  for (const key of Object.keys(subs)) {
    s = s.split('{{' + key + '}}').join(subs[key]);
  }
  return s;
}
function buildVersion() {
  const h = crypto.createHash('sha256');
  for (const rel of ['app.js', 'app.css',
      'templates/index.template.html', 'templates/manifest.template.json',
      'templates/sw.template.js', 'tools/generate.js']) {
    h.update(fs.readFileSync(path.join(ROOT, rel)));
  }
  return h.digest('hex').slice(0, 12);
}

// --- group bundles -------------------------------------------------------
function buildGroup(id, name) {
  const disp = displayName(name);
  const dir = path.join(GROUPS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const html = render('index.template.html', {
    BUILD: buildVersion(),
    BASE: '../../',
    TITLE: htmlEscape('AdamTimer - ' + disp),
    GROUP_JSON: jsForScript({ id: id, name: disp })
  });
  const manifest = render('manifest.template.json', {
    BASE: '../../',
    ID: JSON.stringify(id),
    NAME: JSON.stringify('AdamTimer - ' + disp),
    SHORT_NAME: JSON.stringify(disp)
  });
  JSON.parse(manifest); // sanity: must be valid JSON
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(dir, 'sw.js'), render('sw.template.js', { BASE: '../../' }));
  // Per-bundle metadata: the implicit registry the generator reads back for
  // collision checks, rebuilds, and the root list.
  fs.writeFileSync(path.join(dir, 'group.json'), JSON.stringify({ id: id, name: disp }, null, 2) + '\n');
}

function existingGroup(id) {
  const f = path.join(GROUPS_DIR, id, 'group.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}

function listGroups() {
  const groups = [];
  if (fs.existsSync(GROUPS_DIR)) {
    for (const id of fs.readdirSync(GROUPS_DIR)) {
      const g = existingGroup(id);
      if (g) groups.push(g);
    }
  }
  groups.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return groups;
}

// --- root index (list of groups) ----------------------------------------
function buildIndex() {
  const groups = listGroups();
  const rows = groups.length
    ? groups.map(g => '      <li><a href="g/' + encodeURIComponent(g.id) + '/">' + htmlEscape(g.name) + '</a></li>').join('\n')
    : '      <li class="empty">No groups yet.</li>';
  fs.writeFileSync(path.join(ROOT, 'index.html'), render('index-list.template.html', { ROWS: rows }));
  fs.writeFileSync(path.join(ROOT, 'sw.js'), ROOT_SW);
  // The root is no longer an installable PWA.
  try { fs.unlinkSync(path.join(ROOT, 'manifest.json')); } catch (e) {}
}

// --- operations ----------------------------------------------------------
function addGroup(name) {
  const disp = displayName(name);
  if (!disp) return { status: 'EMPTY' };
  const id = hashId(disp);
  const existing = existingGroup(id);
  if (existing) {
    if (hashKey(existing.name) === hashKey(disp)) {
      return { status: 'EXISTS', id: id, name: existing.name };
    }
    return { status: 'COLLISION', id: id, name: disp, collidesWith: existing.name };
  }
  buildGroup(id, disp);
  buildIndex(); // regenerate the root list from ground truth
  return { status: 'CREATED', id: id, name: disp };
}

function rebuildAll() {
  let n = 0;
  if (fs.existsSync(GROUPS_DIR)) {
    for (const id of fs.readdirSync(GROUPS_DIR)) {
      const g = existingGroup(id);
      if (g) { buildGroup(g.id, g.name); n++; }
    }
  }
  buildIndex();
  return n;
}

// --- cli -----------------------------------------------------------------
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'build-index' || cmd === 'build-root') {
  buildIndex();
  console.error('built root index');
} else if (cmd === 'add-group') {
  process.stdout.write(JSON.stringify(addGroup(arg || '')) + '\n');
} else if (cmd === 'rebuild-all') {
  const n = rebuildAll();
  console.error('rebuilt ' + n + ' group(s) + root index');
} else {
  console.error('usage: generate.js build-index | add-group "<name>" | rebuild-all');
  process.exit(1);
}

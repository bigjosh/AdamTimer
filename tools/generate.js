#!/usr/bin/env node
'use strict';
// Bundle generator for AdamTimer group landing pages.
//
//   node tools/generate.js build-root           Regenerate the root (ungrouped) app.
//   node tools/generate.js add-group "<name>"   Create a group bundle for <name> (JSON result on stdout).
//   node tools/generate.js rebuild-all          Regenerate the root + every existing /g/<id> bundle.
//
// Each group lives in /g/<ID>/ where ID is a 5-char Crockford-base32 hash of the
// normalized (case/space-folded) name. The hash is frozen forever: never change
// the algorithm once groups exist. groups.md is a human-readable hash->name list.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(ROOT, 'templates');
const GROUPS_DIR = path.join(ROOT, 'g');
const GROUPS_MD = path.join(ROOT, 'groups.md');
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I,L,O,U)

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

function writeBundle(dir, opts) {
  // opts: { base, title, name, shortName, id, group }  group is null for root.
  fs.mkdirSync(dir, { recursive: true });
  const html = render('index.template.html', {
    BUILD: buildVersion(),
    BASE: opts.base,
    TITLE: htmlEscape(opts.title),
    GROUP_JSON: jsForScript(opts.group)
  });
  const manifest = render('manifest.template.json', {
    BASE: opts.base,
    ID: JSON.stringify(opts.id),
    NAME: JSON.stringify(opts.name),
    SHORT_NAME: JSON.stringify(opts.shortName)
  });
  JSON.parse(manifest); // sanity: must be valid JSON
  const sw = render('sw.template.js', { BASE: opts.base });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(dir, 'sw.js'), sw);
  if (opts.group) {
    // Per-bundle metadata: the implicit registry the generator reads back for
    // collision checks and rebuilds (groups.md stays human-only).
    fs.writeFileSync(path.join(dir, 'group.json'), JSON.stringify(opts.group, null, 2) + '\n');
  }
}
function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- builds --------------------------------------------------------------
function buildRoot() {
  writeBundle(ROOT, {
    base: '', id: 'AdamTimer',
    title: 'Meditation Timer', name: 'Meditation Timer', shortName: 'Meditate',
    group: null
  });
}
function buildGroup(id, name) {
  const disp = displayName(name);
  writeBundle(path.join(GROUPS_DIR, id), {
    base: '../../', id: id,
    title: 'AdamTimer - ' + disp,
    name: 'AdamTimer - ' + disp,
    shortName: disp,
    group: { id: id, name: disp }
  });
}

function existingGroup(id) {
  const f = path.join(GROUPS_DIR, id, 'group.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}

function appendGroupsMd(id, name) {
  const line = id + '  ' + displayName(name) + '\n';
  if (!fs.existsSync(GROUPS_MD)) {
    fs.writeFileSync(GROUPS_MD, '# Groups\n\nGenerated bundles (hash -> name). Do not edit by hand.\n\n' + line);
  } else {
    fs.appendFileSync(GROUPS_MD, line);
  }
}

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
  appendGroupsMd(id, disp);
  return { status: 'CREATED', id: id, name: disp };
}

function rebuildAll() {
  buildRoot();
  let n = 0;
  if (fs.existsSync(GROUPS_DIR)) {
    for (const id of fs.readdirSync(GROUPS_DIR)) {
      const g = existingGroup(id);
      if (g) { buildGroup(g.id, g.name); n++; }
    }
  }
  return n;
}

// --- cli -----------------------------------------------------------------
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'build-root') {
  buildRoot();
  console.error('built root');
} else if (cmd === 'add-group') {
  const result = addGroup(arg || '');
  process.stdout.write(JSON.stringify(result) + '\n');
} else if (cmd === 'rebuild-all') {
  const n = rebuildAll();
  console.error('rebuilt root + ' + n + ' group(s)');
} else {
  console.error('usage: generate.js build-root | add-group "<name>" | rebuild-all');
  process.exit(1);
}

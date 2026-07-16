---
name: verify
description: Build/launch/drive recipe for verifying AdamTimer changes end-to-end in a real browser (static PWA with per-group service workers).
---

# Verifying AdamTimer

Static site — no build step. The generated group bundles ARE the app; after
editing `app.js`/`app.css`/`templates/*`, run `node tools/generate.js
rebuild-all` first or the served bundles won't include your change.

## Launch

```bash
python3 -m http.server 8787 --bind 127.0.0.1   # from the repo root
```

Service workers work on http://127.0.0.1 (secure context). The timer lives at
`/g/<ID>/` (e.g. `/g/DTXXT/`), NOT the root — the root is just the group list
with no scripts.

## Drive (Playwright, preinstalled globally)

```bash
NODE_PATH=/opt/node22/lib/node_modules node your-script.js
```

Gotchas learned the hard way:

- The first-run email dialog (`#email-dialog-overlay.active`) covers the app —
  click `#email-skip` before driving anything else.
- Wait for `#start-screen.active` (a loading screen gates on asset fetches).
- SW install precaches ~16 entries into `meditation-cache-active::/g/<ID>/`;
  poll for a `/sounds/` entry plus `__app_shell__` before asserting cache
  state — install outlasts `serviceWorker.ready`.
- Cache-entry counts can legitimately be 0 right after (re)registration;
  assert key presence, not truthiness of counts.
- Duration inputs are readonly — drive the preset buttons
  (`.preset-btn[data-add="10"]`, `[data-clear]`); a 10s meditation gives a
  fast full-session run (start → complete screen → `#log-yes`).
- Sheet POSTs go to `script.google.com` — stub with `ctx.route()`; the client
  uses no-cors so any fulfilled response counts as delivered.
- To exercise the update flow, edit the `<!-- build ... -->` comment in the
  group's `index.html` and reload; `#start-update-btn` appears the same visit
  (restore the file afterwards).

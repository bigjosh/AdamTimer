# Timer App 

## Architecture

Single Page Web App. Designed to look simple and modern - especially on mobile. Uses localStorage to store user state including a generated user-id and usage history.

Easily installable on homepage on mobile.  Uses js libs to keep phone from falling asleep after user presses start button. 

On first startup, the app asks for an optional email address. If provided, the app includes it with spreadsheet logging so usage can be studied. The user can later update or delete it from the menu.

### Local storage model

localStorage and Cache Storage are **origin-scoped**, so on shared-storage platforms (Android — an installed WebAPK shares Chrome's storage — plus desktop and iOS Safari-the-browser) every `/g/<ID>/` bundle sees the same storage. Only installed iOS apps get a private copy. Keys are therefore split by what they belong to:

- **Person-scoped (bare keys, deliberately shared across groups):** `meditation-user-id`, `meditation-email`, `meditation-email-prompted`, `meditation-settings` (durations), `meditation-sounds`, `meditation-post-queue` (payloads carry their own groupId).
- **Group-scoped (suffixed `:<groupId>`):** `meditation-history:<id>`, `meditation-installed:<id>`, `meditation-install-seen:<id>`.

**Migration:** pre-namespacing installs stored group-owned state under bare keys. On startup, the first group bundle that finds a bare group-owned key claims it (copies it to its namespaced key and deletes the bare one). On installed iOS each app migrates its own private copy; on shared-storage platforms the first group visited wins.

The service worker's caches are namespaced the same way — every cache name carries a `::<scope path>` suffix (e.g. `meditation-meta::/g/DTXXT/`) so group apps sharing an origin never touch each other's caches or update state. Cache cleanup (including the menu's force-Update) only ever deletes this scope's caches plus known bare legacy names.

## UI

all page transitions are smoothed with 500ms fade-in and fade-out. 

### Start page

Start page is simple and modern and sparse, large simple font. White letters, back background. 

There are three duration fields (0–999 minutes, set via +15m/+5m/+1m/+10s/C preset buttons) for ...
* Lead in (default 0)
* Meditation (default 20m)
* Come out (default 0)

All fields are persistent via localStorage. 

After loading for the first time, the app shows a dialog asking "Can I have your email address?" with an email field and skip/submit actions. Sharing is optional.

There is a START button, and a hamburger menu (Statistics, Sounds, Email Address, Update, and — where supported — Install App / iOS add-to-home-screen hint).

If the service worker has already staged a newer version of the app, the start page also shows an update button. Pressing it reloads into the staged version.

When the user presses start, we fade out the start page and enter the timer page.

### Timer page

The meditation page has a large count-down timer with mins:secs (hh:mm:ss for 1h+) in the center of the screen. Simple font, white text over the prescribed background. Background images are cropped and scaled so they always fill the screen at their fixed aspect ratio. 

There is a "pause" button below the count down text that will pause the current timer (hidden during the come-out phase). While paused, the text of the remaining time subtly heartbeats between 100% and 50% brightness. 

There is always an "end" below the pause button. Pressing end button stops the timer and then smoothly brings us to the completion page with a fade-out and fade-in.

The end-of-phase sounds are configurable per phase from the Sounds settings screen (six options); defaults are Wood Block (lead in), Singing Bowl (meditation), and Short Bell (come out).

# lead-in screen

If there was a non-zero lead-in time set, the lead in counts down over a plain near-black background. At the end of the lead-in (0:00), we play the lead-in sound, fade out, and move on to the meditation screen. 

# meditation screen

we fade-in `sand.jpg` and count down the meditation timeout. When the timer expires (0:00), we play the meditation sound and fade out.

# come-out screen

If a come-out time is non-zero, we fade in `sea.jpg` and the timer counts **up** to the come-out duration. At the end, we play the come-out sound and fade out. 

### Completion page

This shows the most recently completed meditation stats with text "Log this session?" and yes and no buttons. If the user sat past the end of the meditation phase, an "Add mm:ss" chip with a "+" button offers to log that additional time too. Pressing any of the buttons returns to the start page.

### iOS Safari install gate

On iOS, only Safari gives an installed web app its own storage. To keep group attribution intact, iOS Safari visitors who haven't installed are shown a full-screen add-to-home-screen walkthrough instead of the timer (with a gentle "you may have already added it" note on repeat visits). Other iOS browsers get an optional hint in the menu instead.

## Session Logging

When a session is logged, the app POSTs session data to a Google Apps Script endpoint that appends a row to a Google Sheet. The endpoint URL is hardcoded as `SHEET_URL`. Setting it to an empty string disables logging.

Three event types are logged:
- **session** — when the user logs a meditation session
- **install** — when the user installs the PWA (via the browser `appinstalled` event, which iOS Safari never fires)
- **installed** — the first time the app is launched as an installed PWA (detected via `navigator.standalone` / `display-mode: standalone`); fires once per install and covers iOS, where `install` is unavailable

Every logged event carries a common set of fields: `action`, `date`, `v` (log payload version), `userId`, plus `groupId` and `email` when set. The `groupId` is the group's hash, baked into the page (see Per-group bundles). Session events add the per-session duration/completion fields on top.

### Per-group bundles

To attribute usage to a group on every platform (including iOS, whose installed home-screen apps are fully storage-isolated from Safari since iOS 17.4), each group gets its **own static bundle** under `/g/<ID>/` rather than passing the group through a URL/storage channel. The group identity is therefore intrinsic to *which app you installed*.

- **ID.** `<ID>` is a 5-char Crockford-base32 hash of the normalized (trimmed, whitespace-collapsed, case-folded) group name. The algorithm is frozen — never change it once groups exist.
- **Bundle.** `g/<ID>/` holds `index.html`, `manifest.json`, `sw.js` (each `start_url`/`scope`/`id` scoped to the folder so it installs as a distinct app), plus `group.json` (the implicit registry — the only source of truth) and `qr.png`.
- **Thin shell.** Each group page is generated from `templates/` and shares `app.js` / `app.css` / assets at the site root, referenced relatively (`../../`) so it survives a custom domain. The page bakes `window.APP = { base, group:{id,name} }`; `app.js` reads the group id from there.
- **Root.** The root `index.html` is **not** the timer — it is a generated, alphabetically-sorted list of the existing groups (each name links to `g/<ID>/`), rebuilt from the `group.json` files every time a group is added. The root `sw.js` is a no-fetch "kill switch" that unregisters the former root timer service worker (so the list shows and group-page navigations aren't hijacked by the old root app-shell rule); the root is no longer an installable PWA.
- **Generation.** `tools/generate.js` (`build-index` / `add-group` / `rebuild-all`) is driven by the `groups` GitHub Action: opening an issue titled "New group" with the name in the body creates the bundle, regenerates the root list, commits, and replies with the URL + QR. Pushes that touch the shared sources regenerate all bundles (a build-hash in each group `index.html` triggers the SW update flow).

### Offline queue

POSTs are queued in localStorage (`meditation-post-queue`) and retried automatically:
- Immediately after queuing
- On page load
- When the browser comes back online (`online` event)

Delivery is **at least once**: an item is only removed from the queue after its POST resolves, so an event survives the app being killed mid-send but may occasionally be sent twice. `(action, userId, date)` uniquely identifies an event; the Apps Script endpoint drops repeats on that key (see appscript.md). The queue is shared across group bundles on the same origin — each payload carries its own `groupId`, and whichever group page is open flushes whatever is pending.

## App Updates

The service worker precaches the page (`index.html`) and the full shared asset set at **install** time, so the app works offline from its first launch — if precaching fails (e.g. installing while offline), the install aborts and is retried on a later visit.

The service worker treats `index.html` as the update signal (the generator bakes a build hash — covering app.js/app.css, the templates, and all images/sounds — into a comment, so any shared change edits the file). Each time the start page becomes active, the page asks the service worker to check: the worker fetches `index.html`, and on a change stages the full asset set into a pending cache and answers when staging completes — so on a reasonably fast connection the update button appears on the same visit (on slow ones, the next visit).

# Timer App 

## Architecture

Single Page Web App. Designed to look simple and modern - especially on mobile. Uses cookies to store user state including an optional user-id and usage history.

Easily installable on homepage on mobile.  Uses js libs to keep phone from falling asleep after user presses start button. 

On first startup, the app asks for an optional email address. If provided, the app includes it with spreadsheet logging so usage can be studied. The user can later update or delete it from the menu.

## UI

all page transitions are smoothed with 250ms fade-in and fade-out. 

### Start page

Start page is simple and modern and sparse, large simple font. White letters, back background. 

There a three fillable fields (all in minutes 0-999) for ...
* Lead in (default 0)
* Mediation (default 20)
* lead out (default 0)

All fields are persistent via cookies. 

After loading for the first time, the app shows a dialog asking "Can I have your email address?" with an email field and skip/submit actions. Sharing is optional.

There is a START button.

If the service worker has already staged a newer version of the app, the start page also shows an update button. Pressing it reloads into the staged version.

When the user presses start, we fade out the start page and enter the timer page.

### Timer page

The mediation page has a large count-down timers with mins:secs in the center of the screen. Simple font, white text over the prescribed background image. The image is cropped and scaled so that it always fills the screen at its fixed aspect ratio. 

There is always a "pause" button below the count down text that will pause the current timer. While paused, the text of the remaining time subtly heartbeats between 100% and 50% brightness. 

There is always an "end" below the pause button. Pressing end button stops the timer and then smoothly brings us to the completion page with a fade-out and fade-in.

If the timer reaches 0:00 then we fade out and go to the completion page. 

# lead-in screen

If there was a non-zero lead-in time set, then we fade-in `sand.jpg` background image and then the lead in counts down. At the end of the lead-in (0:00), we play `knock.mp3`, fade out the image, and move on to the meditation screen. 

# meditation screen

we fade-in `sea.jpg` and count down the meditation timeout. When the timer expires (0:00), we play `gong.mp3` and fade out.

# lead-out screen

If a lead out time is non-zero, we fade in `sand.jpg` and count down the lead-out time. At the end (0:00), we play `knock.mp3` and fade out. 

### Completion page

This shows the most recently completed meditaion stats with text "Log this session?" and yes and no buttons. Pressing either button returns to the start page.

## Session Logging

When a session is logged, the app POSTs session data to a Google Apps Script endpoint that appends a row to a Google Sheet. The endpoint URL is hardcoded as `SHEET_URL`. Setting it to an empty string disables logging.

Four event types are logged:
- **session** — when the user logs a meditation session
- **install** — when the user installs the PWA (via the browser `appinstalled` event, which iOS Safari never fires)
- **installed** — the first time the app is launched as an installed PWA (detected via `navigator.standalone` / `display-mode: standalone`); fires once per install and covers iOS, where `install` is unavailable
- **changed** — when a URL query string replaces the stored group-id (logs the old group-id)

Every logged event carries a common set of fields: `action`, `date`, `v` (log payload version), `userId`, plus `groupId` and `email` when set. Session events add the per-session duration/completion fields on top.

### Cross-context identity handoff

On iOS, a web app installed to the home screen runs in a standalone context that is **fully isolated** from Safari: since iOS 17.4, neither `localStorage`, `IndexedDB`, cookies, **nor `CacheStorage`** are shared across that boundary. Without mitigation the installed app loses the `userId`, `groupId`, and `email` captured during the Safari visit — producing missing group-ids in the log (#30), a second email prompt (#31), and an inflated user count from a freshly generated `userId`.

The one channel that *does* cross the boundary is the **launch URL**. The app builds its install manifest at runtime (a Blob-URL manifest, replacing the static `<link rel="manifest">`) whose `start_url` carries the current identity as an encoded token: `index.html?i=<base64url(JSON)>` covering `userId`, `groupId`, `email`, and the `email-prompted` flag. When "Add to Home Screen" captures that `start_url`, the installed app launches with the token, reads it back in (`ingestIdentityFromUrl`), and strips it from the address bar.

- **Filled, never clobbered.** The handoff only sets fields the launching context doesn't already have, so it never overwrites a locally-set value.
- **Manifest stays current.** It is rebuilt whenever identity changes (group captured, email entered/cleared), so a later install reflects the latest values. Blob-URL manifests have no base URL, so `start_url` and icon paths inside it are absolute.
- **Ordering.** The URL handoff is ingested **before** identity is finalized and before any logging, so an installed first-launch reuses the inherited identity instead of generating a new one.
- **Best-effort + diagnostics.** Falls back to local-only behavior if anything is unsupported. The `installed` log event includes the raw `launchUrl` it started from, so we can confirm whether the handoff survived.

A secondary `CacheStorage` mirror (cache `meditation-identity`, two-way last-write-wins per field, blank never overwrites non-blank) is also maintained; it is a no-op on isolated iOS but helps on platforms that don't isolate the cache.

### Offline queue

POSTs are queued in localStorage (`meditation-post-queue`) and retried automatically:
- Immediately after queuing
- On page load
- When the browser comes back online (`online` event)

## App Updates

The service worker treats `index.html` as the update signal. Each time the start page becomes active, the page asks the service worker whether a staged update is already available. If not, the service worker starts a background fetch of `index.html`; when it detects a change, it stages the full asset set into a pending cache and marks the update as available for the next time the start page appears.

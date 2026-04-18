# Meditation Timer - Google Sheets Logging

This Apps Script receives session data from the Meditation Timer app via POST and appends each session as a row in a Google Sheet.

## Columns

| Column | Field |
|--------|-------|
| A | Timestamp (server-side, when the row was written) |
| B | Action (`"session"`, `"install"`, or `"changed"` - see Action Types below) |
| C | User ID (stable per-device identifier, randomly generated on first pageload) |
| D | Date (ISO string from the client when the session started) |
| E | Version (data format version) |
| F | Lead In (configured duration in seconds) |
| G | Meditation (configured duration in seconds) |
| H | Lead Out (configured duration in seconds) |
| I | Lead In Paused (seconds spent paused during lead in) |
| J | Lead In Completed (seconds of lead in actually completed) |
| K | Meditation Paused (seconds spent paused during meditation) |
| L | Meditation Completed (seconds of meditation actually completed) |
| M | Lead Out Completed (seconds of lead out actually completed) |
| N | Meditation Logged (seconds the user chose to log, may include additional time) |
| O | Email Address (optional, provided by the user) |
| P | Group ID (optional, supplied via URL query string and sticky across loads) |

## Action Types

| Action | When it fires | Fields populated |
|--------|---------------|------------------|
| `session` | User logs a meditation session (clicks "Yes" or the "+" additional time button) | User ID (C), session fields (D-N), optional Email Address (O), optional Group ID (P) |
| `install` | User installs the PWA on their device | User ID (C), optional Email Address (O) and Group ID (P); columns D-N are blank |
| `changed` | A URL query string replaces the stored group-id | User ID (C) is the current user, Group ID (P) contains the **old** group-id, Email Address (O) is optional, and columns D-N are blank |

If you already have an older sheet without the email column, the updated script rewrites row 1 with the new header set before appending data.

The script now writes to the first sheet in the spreadsheet by default. If you want a specific tab, set `SHEET_NAME` in `appscript.js`.

## Setup

1. Create a new Google Sheet (or open an existing one).
2. Open **Extensions > Apps Script**.
3. Delete any existing code in `Code.gs` and paste the contents of `appscript.js`.
4. Click **Save**.
5. Click **Deploy > New deployment**.
6. Set type to **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone**.
9. Click **Deploy** and authorize when prompted.
10. Copy the **Web app URL** - this is the endpoint the timer app will POST to.

## Testing

You can verify the endpoint is active with a GET request:

```bash
curl https://script.google.com/macros/s/AKfycbztPI-tkV2t_d3e7QQv_WZ7kOL8QWu5cmrsss8vTc2W8bpJDX9MS4lXWPFV_0F5_LX3sw/exec
```

Expected response: `{"status":"ok","message":"Meditation Timer endpoint is active."}`

### Testing POST with curl

Google Apps Script returns a 302 redirect with the JSON response encoded in the redirect URL. This means:

- From the browser (`fetch`): works naturally - the browser handles the redirect and the script executes.
- From curl: do not use `-L` (follow redirects) because curl will replay the POST to a different host and fail. Instead, fire the POST and check the response headers.

**bash/macOS/Linux:**

```bash
curl -s -D - -o /dev/null -X POST -H 'Content-Type: application/json' -d '{"action":"session","userId":"test","groupId":"mygroup","email":"person@example.com","date":"2026-03-02T12:00:00Z","v":3,"leadIn":60,"meditation":600,"leadOut":60,"leadInPaused":0,"leadInCompleted":60,"meditationPaused":0,"meditationCompleted":600,"leadOutCompleted":60,"meditationLogged":600}' https://script.google.com/macros/s/AKfycbztPI-tkV2t_d3e7QQv_WZ7kOL8QWu5cmrsss8vTc2W8bpJDX9MS4lXWPFV_0F5_LX3sw/exec
```

**Windows cmd:**

```bash
curl -s -D - -o NUL -X POST -H "Content-Type: application/json" -d "{\"action\":\"session\",\"userId\":\"test\",\"groupId\":\"mygroup\",\"email\":\"person@example.com\",\"date\":\"2026-03-02T12:00:00Z\",\"v\":3,\"leadIn\":60,\"meditation\":600,\"leadOut\":60,\"leadInPaused\":0,\"leadInCompleted\":60,\"meditationPaused\":0,\"meditationCompleted\":600,\"leadOutCompleted\":60,\"meditationLogged\":600}" https://script.google.com/macros/s/AKfycbztPI-tkV2t_d3e7QQv_WZ7kOL8QWu5cmrsss8vTc2W8bpJDX9MS4lXWPFV_0F5_LX3sw/exec
```

A `302` response means the script executed successfully. To see the actual JSON response, GET the URL from the `Location` header. A new row should appear in the spreadsheet.

## Redeploying

After making changes to the script:

1. Open **Deploy > Manage deployments**.
2. Click the edit (pencil) icon on the active deployment.
3. Set **Version** to **New version**.
4. Click **Deploy**.

The URL stays the same. You must create a new version for changes to take effect.

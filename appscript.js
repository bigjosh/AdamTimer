// Google Apps Script — Meditation Timer data endpoint
// Deploy as: Web app → Execute as: Me → Access: Anyone
//
// The client queues events with at-least-once delivery (an event is retried
// until a POST resolves, so the same event can arrive more than once). Repeats
// are dropped here by matching (Action, User ID, Date) against recent rows.

var HEADERS = [
  'Timestamp',
  'Action',
  'User ID',
  'Date',
  'Version',
  'Lead In',
  'Meditation',
  'Lead Out',
  'Lead In Paused',
  'Lead In Completed',
  'Meditation Paused',
  'Meditation Completed',
  'Lead Out Completed',
  'Meditation Logged',
  'Email Address',
  'Group ID'
];

// How many recent rows to scan for duplicates. Retries cluster around the
// original send (immediately, next app open, next time online), so a shallow
// scan is enough; anything older than this simply isn't deduped.
var DEDUPE_SCAN_ROWS = 200;

// Set this to a specific sheet tab name to avoid ambiguity.
var SHEET_NAME = 'LOG';

function getTargetSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  var namedSheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!namedSheet) {
    throw new Error('Sheet not found: ' + SHEET_NAME);
  }
  return namedSheet;
}

function ensureHeaders(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    headerRange.setFontWeight('bold');
    return;
  }

  var currentHeaders = headerRange.getValues()[0];
  var needsUpdate = HEADERS.some(function(header, index) {
    return currentHeaders[index] !== header;
  });

  if (needsUpdate) {
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
  }
}

// Sheets may parse the ISO date string into a Date cell, so compare dates by
// epoch ms rather than string equality. An unparseable date yields NaN, which
// never equals anything — i.e. we fail toward keeping a row, never dropping one.
function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  return new Date(String(value)).getTime();
}

function isDuplicate(sheet, data) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var n = Math.min(DEDUPE_SCAN_ROWS, lastRow - 1);
  // Columns 2..4 = Action, User ID, Date
  var rows = sheet.getRange(lastRow - n + 1, 2, n, 3).getValues();
  var action = data.action || '';
  var userId = data.userId || '';
  var dateMs = toEpochMs(data.date || '');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === action && rows[i][1] === userId && toEpochMs(rows[i][2]) === dateMs) {
      return true;
    }
  }
  return false;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();

    ensureHeaders(sheet);

    if (isDuplicate(sheet, data)) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', deduped: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var row = [
      new Date(),
      data.action || '',
      data.userId || '',
      data.date || '',
      data.v || '',
      data.leadIn || 0,
      data.meditation || 0,
      data.leadOut || 0,
      data.leadInPaused || 0,
      data.leadInCompleted || 0,
      data.meditationPaused || 0,
      data.meditationCompleted || 0,
      data.leadOutCompleted || 0,
      data.meditationLogged || 0,
      data.email || '',
      data.groupId || ''
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', sheet: sheet.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Meditation Timer endpoint is active.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

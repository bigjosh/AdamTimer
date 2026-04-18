// Google Apps Script — Meditation Timer data endpoint
// Deploy as: Web app → Execute as: Me → Access: Anyone

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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();

    ensureHeaders(sheet);

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

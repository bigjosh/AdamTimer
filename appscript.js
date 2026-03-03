// Google Apps Script — Meditation Timer data endpoint
// Deploy as: Web app → Execute as: Me → Access: Anyone

var HEADERS = [
  'Timestamp',
  'Action',
  'Source',
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
  'Meditation Logged'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Add headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }

    var row = [
      new Date(),
      data.action || '',
      data.source || '',
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
      data.meditationLogged || 0
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
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

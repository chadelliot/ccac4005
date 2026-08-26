/**
 * HARVEST LIST 2026 — receive contacts added on ccacbmore.com
 * ---------------------------------------------------------------------------
 * Paste this into the sheet's Apps Script editor and deploy it as a Web App.
 * Setup instructions are at the bottom of this file.
 *
 * It runs as the sheet's owner, so no service account, no key file, and no
 * Google Cloud project are involved. The site posts a contact here and this
 * appends it to the tab for the month the soul was witnessed.
 */

// Must match the HARVEST_SHEET_SECRET set in Supabase. Anyone who learns the
// deployment URL could otherwise append rows to the church's harvest list.
var SHARED_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

// The header row, found rather than assumed: the tabs do not all start it on
// the same line, so scanning for it survives a tab with an extra title row.
var HEADER_FIRST_CELL = 'Date';
var MAX_HEADER_SCAN = 15;

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'bad secret' });
    }

    var sheet = findMonthTab(body.met_on);
    if (!sheet) {
      return json({ ok: false, error: 'no tab for ' + body.met_on });
    }

    var headerRow = findHeaderRow(sheet);
    if (!headerRow) {
      return json({ ok: false, error: 'no header row on ' + sheet.getName() });
    }

    var row = firstBlankRow(sheet, headerRow);

    // Column order matches the sheet: Date, Who Witnessed, Outreach Location,
    // Name of the Soul, Phone Number, notes.
    sheet.getRange(row, 1, 1, 6).setValues([[
      body.met_on || '',
      body.witness || '',
      body.where_met || '',
      body.name || '',
      body.phone || '',
      body.notes || ''
    ]]);

    return json({ ok: true, tab: sheet.getName(), row: row });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * The tab for a given date.
 *
 * Matched on the first three letters of the month name, case-insensitively,
 * because the tabs are not named consistently — "JANUARY 2026", "FEBUARY 2026"
 * (a typo in the original), "May 2026", "August 2026". Matching the exact name
 * would silently fail on February, and losing a soul to a spelling mistake is
 * not acceptable.
 */
function findMonthTab(isoDate) {
  if (!isoDate) return null;
  var parts = String(isoDate).split('-');
  if (parts.length < 2) return null;

  var names = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  var want = names[monthIndex];
  var year = parts[0];

  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < tabs.length; i++) {
    var name = tabs[i].getName().toLowerCase();
    if (name.indexOf(want) === 0 && name.indexOf(year) !== -1) return tabs[i];
  }
  // Year absent from the tab name is fine — match on the month alone.
  for (var j = 0; j < tabs.length; j++) {
    if (tabs[j].getName().toLowerCase().indexOf(want) === 0) return tabs[j];
  }
  return null;
}

function findHeaderRow(sheet) {
  var scan = sheet.getRange(1, 1, MAX_HEADER_SCAN, 1).getValues();
  for (var i = 0; i < scan.length; i++) {
    if (String(scan[i][0]).trim() === HEADER_FIRST_CELL) return i + 1;
  }
  return null;
}

/**
 * The first row below the header with no name in it.
 *
 * Deliberately not getLastRow(): the tabs contain rows carrying only a date,
 * left as placeholders, and appending after those would leave a block of blanks
 * in the middle of the list. A row counts as free when the soul's name is empty.
 */
function firstBlankRow(sheet, headerRow) {
  var last = Math.max(sheet.getLastRow(), headerRow);
  var names = sheet.getRange(headerRow + 1, 4, Math.max(last - headerRow, 1), 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === '') return headerRow + 1 + i;
  }
  return last + 1;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------------
 * SETUP
 *
 * 1. In the sheet: Extensions -> Apps Script. Delete anything there and paste
 *    this whole file in.
 *
 * 2. Replace CHANGE_ME_TO_A_LONG_RANDOM_STRING above with a long random string.
 *    Keep a copy — you need the same value in step 5.
 *
 * 3. Save, then Deploy -> New deployment -> gear icon -> Web app.
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    "Anyone" is what lets the website reach it; the shared secret is what stops
 *    anyone else using it. Authorise when Google asks.
 *
 * 4. Copy the Web app URL. It looks like:
 *      https://script.google.com/macros/s/AKfycb…/exec
 *
 * 5. In a terminal, give both values to Supabase:
 *      supabase secrets set HARVEST_SHEET_WEBHOOK=<the URL from step 4>
 *      supabase secrets set HARVEST_SHEET_SECRET=<the string from step 2>
 * ------------------------------------------------------------------------- */

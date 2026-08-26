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
    var created = false;
    if (!sheet) {
      sheet = createMonthTab(body.met_on);
      created = true;
    }
    if (!sheet) {
      return json({ ok: false, error: 'no tab for ' + body.met_on + ' and none could be made' });
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

    // Gender is written separately, into whichever column carries that header.
    // Not assumed to be column 7: if someone has since inserted a column, the
    // header is the truth and a fixed index would quietly overwrite it.
    if (body.gender) {
      var gcol = genderColumn(sheet, headerRow, true);
      if (gcol) sheet.getRange(row, gcol).setValue(titleCase(body.gender));
    }

    return json({ ok: true, tab: sheet.getName(), row: row, created: created });
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

/**
 * Make the tab for a month that does not have one yet.
 *
 * Copies the nearest earlier month rather than starting blank, so the new tab
 * inherits the same headers, column widths, colours and fonts — a month created
 * automatically should be indistinguishable from one made by hand.
 *
 * Only the data rows are cleared, with clearContent rather than clear, so the
 * formatting the copy brought with it survives. Last month's rows would
 * otherwise appear as this month's harvest.
 */
function createMonthTab(isoDate) {
  var parts = String(isoDate).split('-');
  if (parts.length < 2) return null;

  var monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  var year = parts[0];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ss.getSheets();
  if (tabs.length === 0) return null;

  // Prefer the closest earlier month as the template — it is the most likely to
  // carry the layout currently in use.
  var template = null;
  var bestDistance = 99;
  for (var i = 0; i < tabs.length; i++) {
    var m = monthIndexOf(tabs[i].getName());
    if (m === -1) continue;
    var distance = monthIndex - m;
    if (distance > 0 && distance < bestDistance) {
      bestDistance = distance;
      template = tabs[i];
    }
  }
  if (!template) template = tabs[tabs.length - 1];

  var copy = template.copyTo(ss);
  copy.setName(nameFor(template.getName(), monthIndex, year));

  // Chronological order, so the tab strip still reads January to December.
  var target = ss.getSheets().length;
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    var jm = monthIndexOf(all[j].getName());
    if (jm !== -1 && jm > monthIndex) { target = j + 1; break; }
  }
  ss.setActiveSheet(copy);
  ss.moveActiveSheet(target);

  // Empty the rows, keep the look.
  var headerRow = findHeaderRow(copy);
  if (headerRow) {
    var last = copy.getLastRow();
    if (last > headerRow) {
      copy.getRange(headerRow + 1, 1, last - headerRow, copy.getLastColumn()).clearContent();
    }
  }
  return copy;
}

/** Month index a tab name starts with, or -1. */
function monthIndexOf(tabName) {
  var names = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var lower = String(tabName).toLowerCase();
  for (var i = 0; i < names.length; i++) {
    if (lower.indexOf(names[i]) === 0) return i;
  }
  return -1;
}

/**
 * Name the new tab the way the template is named.
 *
 * The existing tabs are not consistent — "JANUARY 2026" shouts, "August 2026"
 * does not — so the case of the template is copied rather than imposed. A tab
 * that matches its neighbours is one nobody has to think about.
 */
function nameFor(templateName, monthIndex, year) {
  var full = ['January','February','March','April','May','June',
              'July','August','September','October','November','December'][monthIndex];
  var t = String(templateName);
  var alpha = t.replace(/[^A-Za-z]/g, '');
  if (alpha && alpha === alpha.toUpperCase()) return full.toUpperCase() + ' ' + year;
  return full + ' ' + year;
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

function titleCase(s) {
  var t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/* ===========================================================================
 * GENDER COLUMN
 *
 * Run "Harvest list -> Set up the Gender column" once from the sheet menu. It
 * is safe to run again: it finds an existing Gender column rather than adding
 * a second one, and never overwrites a value already chosen by hand.
 * ========================================================================= */

var GENDER_HEADER = 'Gender';
var GENDER_ROWS = 500;   // how far down the dropdown is applied

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Harvest list')
    .addItem('Set up the Gender column', 'setUpGenderColumn')
    .addItem('Fill blank genders from names', 'fillGenderFromNames')
    .addToUi();
}

/**
 * The column carrying the Gender header, optionally creating it.
 *
 * Found by header text rather than position, so inserting a column somewhere
 * to the left cannot turn this into a writer of somebody else's data.
 */
function genderColumn(sheet, headerRow, createIfMissing) {
  var lastCol = Math.max(sheet.getLastColumn(), 6);
  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === GENDER_HEADER.toLowerCase()) return i + 1;
  }
  if (!createIfMissing) return null;

  // Prefer column 7 — immediately after notes — but only while it is genuinely
  // free. Otherwise go to the end rather than displacing anything.
  var col = (String(headers[6] || '').trim() === '') ? 7 : lastCol + 1;
  sheet.getRange(headerRow, col).setValue(GENDER_HEADER);
  return col;
}

function setUpGenderColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ss.getSheets();
  var touched = 0;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Male', 'Female'], true)
    .setAllowInvalid(false)
    .setHelpText('Choose Male or Female, or leave blank if it was never asked.')
    .build();

  for (var i = 0; i < tabs.length; i++) {
    var sheet = tabs[i];
    if (monthIndexOf(sheet.getName()) === -1) continue;   // skip non-month tabs

    var headerRow = findHeaderRow(sheet);
    if (!headerRow) continue;

    var col = genderColumn(sheet, headerRow, true);
    if (!col) continue;

    // Match the header row's own formatting so the new column doesn't announce
    // itself as an afterthought.
    var header = sheet.getRange(headerRow, col);
    sheet.getRange(headerRow, 1).copyTo(header, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    header.setValue(GENDER_HEADER);

    sheet.getRange(headerRow + 1, col, GENDER_ROWS, 1).setDataValidation(rule);
    touched++;
  }

  SpreadsheetApp.getUi().alert(
    'Gender column ready on ' + touched + ' month tab' + (touched === 1 ? '' : 's') + '.\n\n' +
    'Each cell is now a Male / Female dropdown. Blank means nobody has recorded it.'
  );
}

/**
 * Fill blank gender cells from the soul's first name.
 *
 * Only blanks are touched — anything a person has already chosen is left
 * exactly as it is, so running this after correcting a few by hand cannot
 * undo that work.
 *
 * Names not in the list below are left blank on purpose. A guess sitting in a
 * record looks like a fact and gets acted on; a blank asks the question.
 */
var MALE_NAMES = ['anthony','antoine','bernard','dwayne','elijah','ernest','john','kameron',
  'keon','king','marquis','mike','pete','phil','reese','ricky','ronald','ryen','tay','theron',
  'kavon','tommy','travis','brian','eian','ryan','cymon','tim','deshawn','michael'];

var FEMALE_NAMES = ['adrianna','arletta','brianca','brittany','dajai','dejah','icis','jakeelah',
  'kacey','kadija','konstance','mira','natalie','nicole','pam','raya','samia','saron','tierra',
  'treyana','valerie','deasia','janay','kayla','rukia','shay','tammy','tina','whitney','jasmine',
  'kiera','kirah','kristen','petra','rachel','rokea','sasha','shamia','tiara','veronica',
  'vondelier','zella','rayshawna','destiny'];

function fillGenderFromNames() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ss.getSheets();
  var filled = 0;
  var skipped = 0;

  for (var i = 0; i < tabs.length; i++) {
    var sheet = tabs[i];
    if (monthIndexOf(sheet.getName()) === -1) continue;

    var headerRow = findHeaderRow(sheet);
    if (!headerRow) continue;
    var col = genderColumn(sheet, headerRow, true);
    if (!col) continue;

    var last = sheet.getLastRow();
    if (last <= headerRow) continue;
    var count = last - headerRow;

    var names = sheet.getRange(headerRow + 1, 4, count, 1).getValues();
    var range = sheet.getRange(headerRow + 1, col, count, 1);
    var current = range.getValues();
    var changed = false;

    for (var r = 0; r < count; r++) {
      var name = String(names[r][0]).trim();
      if (!name) continue;
      if (String(current[r][0]).trim() !== '') continue;   // never overwrite a choice

      var first = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
      if (MALE_NAMES.indexOf(first) !== -1) { current[r][0] = 'Male'; filled++; changed = true; }
      else if (FEMALE_NAMES.indexOf(first) !== -1) { current[r][0] = 'Female'; filled++; changed = true; }
      else skipped++;
    }
    if (changed) range.setValues(current);
  }

  SpreadsheetApp.getUi().alert(
    'Filled ' + filled + ' blank gender cell' + (filled === 1 ? '' : 's') + '.\n\n' +
    skipped + ' left blank because the name was not one this could judge. Pick those from ' +
    'the dropdown — the site has the same three unresolved.'
  );
}

/* ---------------------------------------------------------------------------
 * SETUP
 *
 * 1. In the sheet: Extensions -> Apps Script. Delete anything there and paste
 *    this whole file in.
 *
 *    If you have pasted an earlier version already: replace it with this one,
 *    keep the same SHARED_SECRET, and then Deploy -> Manage deployments ->
 *    edit the existing deployment -> Version: New version -> Deploy. Editing
 *    the existing deployment keeps the same URL, so the Supabase secret still
 *    points at it and nothing else needs changing.
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
 *
 * 6. GENDER COLUMN (only needed once, after pasting this version in)
 *    Reload the sheet. A "Harvest list" menu appears next to Help.
 *      Harvest list -> Set up the Gender column
 *        Adds a Gender header and a Male / Female dropdown to every month tab.
 *      Harvest list -> Fill blank genders from names
 *        Fills the blanks it can judge from the first name. It never changes a
 *        cell someone has already set, so run it whenever you like.
 *
 *    Google will ask for authorisation the first time a menu item runs — it is
 *    the same script you already deployed, now allowed to edit the sheet.
 * ------------------------------------------------------------------------- */

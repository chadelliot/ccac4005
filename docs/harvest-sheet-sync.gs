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

    // Serialize simultaneous edits and additions, so two requests do not
    // claim the same free row before either of them has finished writing.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'update') return json(updateContactRow(body));

      if (body.contact_id) {
        var existing = findContactById(body.contact_id);
        if (existing.error) return json({ ok: false, error: existing.error });
        if (existing.sheet) {
          return json({ ok: true, tab: existing.sheet.getName(), row: existing.row, already_exists: true });
        }
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

    if (body.contact_id) {
      var idCol = contactIdColumn(sheet, headerRow, true);
      sheet.getRange(row, idCol).setValue(String(body.contact_id));
    }

    // Keep new entries in chronological order within their month. Sorting the
    // complete row keeps attribution, notes, gender and CCAC IDs together.
    sortMonthRows(sheet);
    var appended = body.contact_id ? findContactById(body.contact_id) : {};
    return json({ ok: true, tab: sheet.getName(), row: appended.row || row, created: created });
    } finally {
      lock.releaseLock();
    }
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
  // Match a yearless legacy tab if one exists, but never route a record
  // to the wrong year (e.g. January 2027 into January 2026).
  for (var j = 0; j < tabs.length; j++) {
    var tabName = tabs[j].getName().toLowerCase();
    if (tabName.indexOf(want) === 0 && !/\b20\d{2}\b/.test(tabName)) return tabs[j];
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
 * CHRONOLOGICAL HARVEST LIST
 *
 * Each month is sorted oldest to newest by Date (column A). Move the entire
 * record together, including sheet-only notes, witness names and hidden
 * contact IDs. Equal dates retain their prior order.
 *
 * Google Sheets sometimes stores historic dates as strings ("2/28/26",
 * "9/1st/26") instead of real dates. A temporary numeric key sorts both
 * reliably without rewriting anyone's displayed outreach date.
 * Missing/unrecognized dates go last and are never silently guessed.
 * ========================================================================= */

/** Convert a Google Sheets date or historic human-entered date to YYYYMMDD. */
function dateSortNumber(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Number(Utilities.formatDate(value, tz, 'yyyyMMdd'));
  }
  var text = String(value == null ? '' : value).trim();
  if (!text) return null;
  // Tolerate handwritten ordinal dates, e.g. "9/1st/26", "9/2nd/26".
  text = text.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  var m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  var y, month, day;
  if (m) {
    y = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
  } else {
    m = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (!m) return null;
    month = Number(m[1]); day = Number(m[2]); y = Number(m[3]);
    if (y < 100) y += 2000;
  }
  var candidate = new Date(y, month - 1, day);
  if (candidate.getFullYear() !== y ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day) return null;
  return y * 10000 + month * 100 + day;
}

/**
 * Sort all populated rows BELOW the existing header. Uses an unused temporary
 * column at the right, sorting every physical column together so nothing in
 * a record becomes detached. The temporary values are removed in finally.
 */
function sortMonthRows(sheet) {
  var headerRow = findHeaderRow(sheet);
  if (!headerRow) throw new Error('Cannot sort ' + sheet.getName() + ': Date header not found');
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow + 1) return;
  var count = lastRow - headerRow;
  var dates = sheet.getRange(headerRow + 1, 1, count, 1).getValues();
  var helperCol = Math.max(sheet.getLastColumn() + 1, 8);
  if (helperCol > sheet.getMaxColumns()) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), helperCol - sheet.getMaxColumns());
  }
  var helperRange = sheet.getRange(headerRow + 1, helperCol, count, 1);
  var keys = [];
  for (var i = 0; i < dates.length; i++) {
    var sortDate = dateSortNumber(dates[i][0]);
    // 100,000 slots per date retain the previous row order for equal dates.
    // Unknown/blank dates sort after the known dates.
    keys.push([sortDate == null ? 9999999900000 + i : sortDate * 100000 + i]);
  }
  helperRange.setValues(keys);
  try {
    sheet.getRange(headerRow + 1, 1, count, helperCol)
      .sort({ column: helperCol, ascending: true });
  } finally {
    helperRange.clearContent();
  }
}

/**
 * Also keep manual edits to the Date column chronological. Apps Script's
 * built-in onEdit trigger runs for human edits; script and API writes do not
 * recursively fire it, so website synchronization is handled by doPost.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (monthIndexOf(sheet.getName()) < 0) return;
  var header = findHeaderRow(sheet);
  if (!header || e.range.getLastRow() <= header) return;
  if (e.range.getColumn() > 1 || e.range.getLastColumn() < 1) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    sortMonthRows(sheet);
  } finally {
    lock.releaseLock();
  }
}

/** One-time cleanup, available from the sheet's Harvest list menu. */
function sortAllHarvestMonths() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    var count = 0;
    for (var i = 0; i < sheets.length; i++) {
      if (monthIndexOf(sheets[i].getName()) < 0) continue;
      sortMonthRows(sheets[i]);
      count++;
    }
    SpreadsheetApp.getUi().alert('Sorted ' + count +
      ' Harvest List monthly tabs, earliest to latest. Entire contact rows moved together.');
  } finally {
    lock.releaseLock();
  }
}

/* ===========================================================================
 * RETROACTIVE SYNC
 *
 * The CCAC contact UUID identifies the row across month tabs. Historic sheet
 * entries have no UUID; their first correction may claim exactly one row by
 * original name + outreach date + phone or location. Ambiguous matches fail
 * closed rather than altering somebody else's record or appending a duplicate.
 * ========================================================================= */

var CONTACT_ID_HEADER = 'CCAC Contact ID';

function contactIdColumn(sheet, headerRow, create) {
  // A:G are reserved for contact fields, including Notes and Gender even if
  // their headers are blank. Never store internal IDs in those columns.
  var last = Math.max(sheet.getLastColumn(), 7);
  var headers = sheet.getRange(headerRow, 1, 1, last).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === CONTACT_ID_HEADER.toLowerCase()) return i + 1;
  }
  if (!create) return null;
  var col = last + 1;
  if (col > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  sheet.getRange(headerRow, col).setValue(CONTACT_ID_HEADER);
  // Internal mapping only, not another field for the evangelism team to fill.
  sheet.hideColumns(col);
  return col;
}

function findContactById(contactId) {
  if (!contactId) return {};
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var found = [];
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (monthIndexOf(sheet.getName()) === -1) continue;
    var header = findHeaderRow(sheet);
    if (!header || sheet.getLastRow() <= header) continue;
    var col = contactIdColumn(sheet, header, false);
    if (!col) continue;
    var ids = sheet.getRange(header + 1, col, sheet.getLastRow() - header, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(contactId)) {
        found.push({ sheet: sheet, row: header + 1 + i, headerRow: header });
      }
    }
  }
  if (found.length > 1) return { error: 'Duplicate CCAC contact IDs in Harvest List — resolve before syncing' };
  return found[0] || {};
}

function norm(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function sheetDateIso(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  var text = String(value == null ? '' : value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  var parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) return text;
  return parts[3] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
}

function findLegacyRow(previous) {
  if (!previous || !previous.name || !previous.met_on) return { error: 'Previous name and outreach date required' };
  var name = norm(previous.name);
  var date = sheetDateIso(previous.met_on);
  var phone = digits(previous.phone);
  var location = norm(previous.where_met);
  if (!phone && !location) return { error: 'A phone or location is needed to identify the original row' };

  var matches = [];
  var looseMatches = [];
  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var t = 0; t < tabs.length; t++) {
    var sheet = tabs[t];
    if (monthIndexOf(sheet.getName()) === -1) continue;
    var header = findHeaderRow(sheet);
    if (!header || sheet.getLastRow() <= header) continue;
    var values = sheet.getRange(header + 1, 1, sheet.getLastRow() - header, 5).getValues();
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      if (norm(row[3]) !== name) continue;
      if (phone && digits(row[4]) !== phone) continue;
      if (!phone && norm(row[2]) !== location) continue;
      var candidate = { sheet: sheet, row: header + 1 + r, headerRow: header };
      looseMatches.push(candidate);
      if (sheetDateIso(row[0]) === date) matches.push(candidate);
    }
  }
  if (matches.length > 1) return { error: 'Multiple historic rows match — resolve manually before syncing' };
  if (matches.length === 1) return matches[0];
  // Earlier website edits may already have changed the outreach date, leaving
  // the sheet behind. A single name+phone (or name+location) match can still
  // safely claim the historic row; multiple visits must be resolved manually.
  if (looseMatches.length === 1) return looseMatches[0];
  if (looseMatches.length > 1) return { error: 'Multiple historic visits found. Identify the correct row manually.' };
  return { error: 'Original Harvest List row not found. Contact remains saved on CCAC; reconcile this row manually.' };
}

function updateContactRow(body) {
  if (!body.contact_id || !body.met_on || !body.name) {
    return { ok: false, error: 'contact_id, met_on, and name are required' };
  }
  var match = findContactById(body.contact_id);
  if (match.error) return { ok: false, error: match.error };
  if (!match.sheet) {
    match = findLegacyRow(body.previous);
    if (match.error) return { ok: false, error: match.error };
    // Claim the historic record for reliable updates from now on.
    var legacyCol = contactIdColumn(match.sheet, match.headerRow, true);
    match.sheet.getRange(match.row, legacyCol).setValue(String(body.contact_id));
  }

  var destination = findMonthTab(body.met_on) || createMonthTab(body.met_on);
  if (!destination) return { ok: false, error: 'Unable to find or create outreach month tab' };

  var destHeader = findHeaderRow(destination);
  if (!destHeader) return { ok: false, error: 'Destination tab has no date header' };

  var target = match.row;
  var moved = destination.getSheetId() !== match.sheet.getSheetId();
  if (moved) {
    var destRow = firstBlankRow(destination, destHeader);
    var srcIdCol = contactIdColumn(match.sheet, match.headerRow, false);
    var destIdCol = contactIdColumn(destination, destHeader, true);
    var width = Math.max(match.sheet.getLastColumn(), destination.getLastColumn(), srcIdCol || 0, destIdCol);
    if (width > destination.getMaxColumns()) {
      destination.insertColumnsAfter(destination.getMaxColumns(), width - destination.getMaxColumns());
    }
    if (width > match.sheet.getMaxColumns()) {
      match.sheet.insertColumnsAfter(match.sheet.getMaxColumns(), width - match.sheet.getMaxColumns());
    }
    var rowValues = match.sheet.getRange(match.row, 1, 1, width).getValues()[0];
    if (srcIdCol && srcIdCol !== destIdCol) rowValues[srcIdCol - 1] = '';
    rowValues[destIdCol - 1] = String(body.contact_id);

    // Write the complete historical row (including notes and other columns)
    // before clearing its previous location, to avoid losing information.
    destination.getRange(destRow, 1, 1, width).setValues([rowValues]);
    match.sheet.getRange(match.row, 1, 1, width).clearContent();
    target = destRow;
  }

  // Update only fields managed by the website. Preserve witness attribution
  // and follow-up notes maintained by the evangelism team in Google Sheets.
  destination.getRange(target, 1).setValue(body.met_on);
  destination.getRange(target, 3).setValue(body.where_met || '');
  destination.getRange(target, 4).setValue(body.name);
  destination.getRange(target, 5).setValue(body.phone || '');
  if (body.gender !== undefined) {
    var genderCol = genderColumn(destination, destHeader, !!body.gender);
    if (genderCol) destination.getRange(target, genderCol).setValue(body.gender ? titleCase(body.gender) : '');
  }
  var cidCol = contactIdColumn(destination, destHeader, true);
  destination.getRange(target, cidCol).setValue(String(body.contact_id));
  // When the date moves to another month, close the gap in the old tab too.
  if (moved) sortMonthRows(match.sheet);
  sortMonthRows(destination);
  var updated = findContactById(body.contact_id);
  return { ok: true, tab: destination.getName(), row: updated.row || target, moved: moved };
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
    .addSeparator()
    .addItem('Sort all months by outreach date', 'sortAllHarvestMonths')
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
 * 2. BEFORE saving, replace the placeholder with the EXISTING Google Apps
 *    Script shared secret that matches Supabase's HARVEST_SHEET_SECRET.
 *    Do not publish this secret in GitHub or a chat.
 *
 * 3. For an EXISTING installation, use Deploy -> Manage deployments ->
 *    Edit (pencil) -> Version: New version -> Deploy. Keep the original
 *    Web App URL. Do NOT use New deployment for an upgrade.
 *
 * 4. After the updated script is active, reload HARVEST LIST 2026 and run:
 *    Harvest list -> Sort all months by outreach date
 *    This one-time action sorts older data. Future website additions/edits
 *    and direct manual edits to Date will be sorted automatically.
 *
 * 5. Only for a new installation: configure HARVEST_SHEET_WEBHOOK and
 *    HARVEST_SHEET_SECRET in Supabase. On upgrades, keep existing values.
 *    If the shared secret was exposed, rotate it in BOTH systems.
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

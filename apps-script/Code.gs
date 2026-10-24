// The KCM scheduler's shared store: the when2meet replacement in the FF guide.
// It lives in a Google Sheet in the KCM account, so it never pauses and the next
// leader inherits it with the Drive. Two tabs, one row per poll and one row per
// answer, readable by anyone who opens the sheet.
//
// The page sends {fn, args} as a POST and gets back {result} or {error}. The four
// functions and their rules match the old Supabase ones exactly:
//   create  -> {id, admin_token}       the admin token is the only way to edit later
//   get     -> {poll, responses} | null, never a hash or a token
//   respond -> {token}                 a name is owned by its token, or the organizer
//   update  -> {ok: true}              organizer only
//   remove  -> {ok: true}              organizer only: the poll and every answer
// Tokens are handed to the browser once and stored only as a sha256 hash. The
// organizer's email is optional, never handed back, and only used by daily().
//
// daily() runs each morning: it emails each organizer whose poll got new answers
// since the last email, and deletes each poll 5 days after its date.
//
// Deploy: paste this file, run setup once (it also schedules daily), then
// Deploy > New deployment > Web app, Execute as Me, Who has access Anyone.
// After any change: Deploy > Manage deployments > edit > New version.

var POLLS = ["id", "kind", "title", "config", "status", "final", "admin_hash", "created_at", "updated_at", "email", "notified_at"];
var RESPONSES = ["poll_id", "name", "name_key", "slots", "data", "token_hash", "updated_at"];
var ID_ABC = "abcdefghijkmnpqrstuvwxyz23456789";
var MAX_ANSWERS = 200;
var KEEP_DAYS = 5;          // a poll is deleted this many days after its date
var UNDATED_DAYS = 30;      // weekday-only polls have no date: this long after the last change
var PAGE_URL = "https://andliu7.github.io/ff_technical_instructions/";
// The sheet the polls live in, from its address (docs.google.com/spreadsheets/d/<this>/edit).
// Used when the script is not inside that sheet; a script made from the sheet's
// Extensions > Apps Script menu finds it without this.
var SHEET_ID = "1u-KAFEc4JSALOOoKSSnIQLimElWbkONQfvlFpzfrqUE";

// Run from the editor once, and again after this file changes: writes both
// tabs' header rows and schedules daily() for 8 each morning, once.
function setup() {
  var ss = book();
  [["polls", POLLS], ["responses", RESPONSES]].forEach(function (t) {
    var sh = ss.getSheetByName(t[0]) || ss.insertSheet(t[0]);
    sh.getRange(1, 1, 1, t[1].length).setValues([t[1]]);
  });
  var scheduled = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "daily"; });
  if (!scheduled) ScriptApp.newTrigger("daily").timeBased().everyDays(1).atHour(8).create();
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    if (!API.hasOwnProperty(req.fn)) throw new Error("unknown_function");
    // One writer at a time, so two people saving at once cannot both take a name
    // or both slip under the 200 cap.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { out = { result: API[req.fn](req.args || {}) }; } finally { lock.releaseLock(); }
  } catch (err) {
    out = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the web app URL in a browser shows this, which is a quick "is it up" check.
function doGet() {
  return ContentService.createTextOutput("KCM scheduler is running.");
}

var API = {
  create: function (a) {
    var title = trim(a.p_title), email = trim(a.p_email);
    check(a.p_kind === "group" || a.p_kind === "one", "invalid_kind");
    check(email === "" || (email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)), "invalid_email");
    check(title.length >= 1 && title.length <= 120, "invalid_title");
    check(a.p_config != null && JSON.stringify(a.p_config).length < 20000, "invalid_config");
    var id = newId(), admin = newToken(), now = new Date().toISOString();
    sheet("polls").appendRow(text([id, a.p_kind, title, JSON.stringify(a.p_config), "open", "", hash(admin), now, now, email, now]));
    return { id: id, admin_token: admin };
  },

  get: function (a) {
    var p = findPoll(a.p_id);
    if (!p) return null;
    var responses = answersFor(a.p_id).map(function (r) {
      return { name: r.v[1], slots: r.v[3], data: JSON.parse(r.v[4] || "{}"), updated_at: r.v[6] };
    });
    responses.sort(function (x, y) { return x.updated_at < y.updated_at ? -1 : x.updated_at > y.updated_at ? 1 : 0; });
    return { poll: pollOut(p.v), responses: responses };
  },

  respond: function (a) {
    var p = findPoll(a.p_id);
    if (!p) throw new Error("not_found");
    if (p.v[4] === "closed") throw new Error("closed");
    var name = trim(a.p_name), slots = a.p_slots == null ? "" : String(a.p_slots), data = JSON.stringify(a.p_data || {});
    check(name.length >= 1 && name.length <= 60, "invalid_name");
    check(slots.length <= 5000 && /^[012]*$/.test(slots), "invalid_slots");
    check(data.length < 4000, "invalid_data");

    var key = name.toLowerCase(), now = new Date().toISOString(), sh = sheet("responses");
    var all = answersFor(a.p_id), mine = all.filter(function (r) { return r.v[2] === key; })[0];
    if (mine) {
      var ownToken = mine.v[5] === hash(a.p_token);
      if (!ownToken && p.v[6] !== hash(a.p_admin)) throw new Error("name_taken");
      sh.getRange(mine.row, 1, 1, RESPONSES.length).setValues([text([a.p_id, name, key, slots, data, mine.v[5], now])]);
      // Only the hash is stored, so an organizer's edit cannot hand back the owner's token.
      return { token: ownToken ? a.p_token : null };
    }
    if (all.length >= MAX_ANSWERS) throw new Error("full");
    var token = newToken();
    sh.appendRow(text([a.p_id, name, key, slots, data, hash(token), now]));
    return { token: token };
  },

  update: function (a) {
    var p = findPoll(a.p_id);
    // A missing poll and a wrong token look the same, so ids cannot be probed.
    if (!p || p.v[6] !== hash(a.p_admin)) throw new Error("forbidden");
    var patch = a.p_patch || {}, v = p.v.slice();
    if ("status" in patch) check(patch.status === "open" || patch.status === "closed", "invalid_status");
    if ("title" in patch) { v[2] = trim(patch.title); check(v[2].length >= 1 && v[2].length <= 120, "invalid_title"); }
    if ("config" in patch) { v[3] = JSON.stringify(patch.config); check(patch.config != null && v[3].length < 20000, "invalid_config"); }
    if ("status" in patch) v[4] = patch.status;
    if ("final" in patch) v[5] = patch.final == null ? "" : JSON.stringify(patch.final);
    v[8] = new Date().toISOString();
    sheet("polls").getRange(p.row, 1, 1, POLLS.length).setValues([text(v)]);

    if (a.p_remove != null) {
      var key = trim(a.p_remove).toLowerCase();
      // Bottom up, so deleting a row does not shift the ones still to check.
      answersFor(a.p_id).reverse().forEach(function (r) { if (r.v[2] === key) sheet("responses").deleteRow(r.row); });
    }
    return { ok: true };
  },

  remove: function (a) {
    var p = findPoll(a.p_id);
    if (!p || p.v[6] !== hash(a.p_admin)) throw new Error("forbidden");
    deletePolls([a.p_id]);
    return { ok: true };
  }
};

/* ---------- the daily run ---------- */

function daily() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var today = todayKey(), now = new Date().toISOString(), expired = [];
    var answers = rows("responses", RESPONSES.length);
    rows("polls", POLLS.length).forEach(function (p) {
      if (today > deleteOn(p.v)) { expired.push(p.v[0]); return; }
      var email = p.v[9];
      if (!email || p.v[4] !== "open") return;
      var since = p.v[10] || p.v[7];
      var mine = answers.filter(function (r) { return r.v[0] === p.v[0]; });
      var fresh = mine.filter(function (r) { return r.v[6] > since; });
      if (!fresh.length) return;
      MailApp.sendEmail({ to: email, name: "KCM Scheduler", subject: "New answers: " + p.v[2], body: digest(p.v, fresh, mine) });
      p.v[10] = now;
      sheet("polls").getRange(p.row, 1, 1, POLLS.length).setValues([text(p.v)]);
    });
    deletePolls(expired);
  } finally {
    lock.releaseLock();
  }
}

// The date a poll goes: KEEP_DAYS after its confirmed time, else after its last
// day; a weekday-only poll has no date, so UNDATED_DAYS after its last change.
function deleteOn(v) {
  var config = JSON.parse(v[3] || "{}"), final = v[5] ? JSON.parse(v[5]) : null;
  var dated = function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); };
  if (final && dated(final.day)) return addDays(final.day, KEEP_DAYS);
  var days = (config.days || []).filter(dated).sort();
  if (days.length) return addDays(days[days.length - 1], KEEP_DAYS);
  return addDays(v[8].slice(0, 10), UNDATED_DAYS);
}

function digest(v, fresh, all) {
  var config = JSON.parse(v[3] || "{}");
  var names = all.map(function (r) { return r.v[2]; });
  var waiting = (config.invitees || []).filter(function (n) { return names.indexOf(trim(n).toLowerCase()) === -1; });
  return [
    fresh.length + (fresh.length === 1 ? " new answer" : " new answers") + " to \"" + v[2] + "\": " +
      fresh.map(function (r) { return r.v[1]; }).join(", ") + ".",
    all.length + " answered so far." + (waiting.length ? " Still waiting on: " + waiting.join(", ") + "." : ""),
    "",
    "See the results: " + PAGE_URL + "?meet=" + v[0],
    "To pick the final time, open the poll from the browser you made it in, or from your organiser link.",
    "",
    "This poll deletes itself on " + deleteOn(v) + ". You get this email only on days someone answers."
  ].join("\n");
}

// Removes polls and all their answers. Bottom up, so deleting a row does not
// shift the rows still to delete.
function deletePolls(ids) {
  if (!ids.length) return;
  rows("responses", RESPONSES.length).reverse().forEach(function (r) { if (ids.indexOf(r.v[0]) !== -1) sheet("responses").deleteRow(r.row); });
  rows("polls", POLLS.length).reverse().forEach(function (r) { if (ids.indexOf(r.v[0]) !== -1) sheet("polls").deleteRow(r.row); });
}

/* ---------- helpers ---------- */

function book() { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID); }
function sheet(name) { return book().getSheetByName(name); }

// A leading apostrophe makes Sheets keep a value as typed text: "0011" stays
// "0011" rather than 11, and a name starting with = is never run as a formula.
// The apostrophe is not part of the value read back.
function text(row) { return row.map(function (v) { return "'" + v; }); }

// Every data row of a tab as {row, v}, row being the sheet's 1-based row number.
function rows(name, width) {
  var sh = sheet(name), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, width).getValues().map(function (v, i) {
    return { row: i + 2, v: v.map(String) };
  });
}
function findPoll(id) {
  return rows("polls", POLLS.length).filter(function (r) { return r.v[0] === String(id); })[0] || null;
}
function answersFor(id) {
  return rows("responses", RESPONSES.length).filter(function (r) { return r.v[0] === String(id); });
}
function todayKey() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"); }
function addDays(day, n) { return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10); }

function pollOut(v) {
  return {
    id: v[0], kind: v[1], title: v[2], config: JSON.parse(v[3]), status: v[4],
    final: v[5] ? JSON.parse(v[5]) : null, created_at: v[7], updated_at: v[8]
  };
}

function trim(s) { return String(s == null ? "" : s).trim(); }
function check(ok, code) { if (!ok) throw new Error(code); }

function hex(bytes) {
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16); })
    .map(function (h) { return h.length === 1 ? "0" + h : h; }).join("");
}
function hash(token) {
  return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token == null ? "" : String(token), Utilities.Charset.UTF_8));
}
// 64 hex characters from two v4 uuids.
function newToken() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""); }
// 10 characters from an alphabet with no 0/o/1/l. Each byte of a sha256 is uniform
// and 256 is a multiple of 32, so each character is too.
function newId() {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
  var s = "";
  for (var i = 0; i < 10; i++) s += ID_ABC[(b[i] + 256) % 32];
  return s;
}

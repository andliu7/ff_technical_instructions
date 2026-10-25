// Runs Code.gs against a fake Google Sheet, with the same cases the old Supabase
// tests had. No Google account needed: node apps-script/test.mjs
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import assert from "node:assert/strict";

// Just enough of SpreadsheetApp for Code.gs. Like Sheets, a leading apostrophe
// stores the rest as text and is not read back.
const cell = v => String(v).replace(/^'/, "");
function fakeSheet() {
  const data = [];
  return {
    data,
    getLastRow: () => data.length,
    appendRow: row => { data.push(row.map(cell)); },
    deleteRow: n => { data.splice(n - 1, 1); },
    getRange: (row, col, nr, nc) => ({
      getValues: () => data.slice(row - 1, row - 1 + nr).map(r => r.slice(col - 1, col - 1 + nc).map(v => v ?? "")),
      setValues: vals => vals.forEach((v, i) => { data[row - 1 + i] = v.map(cell); })
    })
  };
}
const clock = { today: "2026-10-24" };
// drive.gone = true makes openById fail the way Apps Script does when the sheet
// was deleted or the script's account lost access to it.
const drive = { gone: false };
const mail = [];
const triggers = [];
function load() {
  const sheets = {};
  const ss = { getName: () => "KCM Scheduler", getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = fakeSheet()) };
  const ctx = {
    // A standalone script has no active spreadsheet, so Code.gs opens it by id.
    SpreadsheetApp: { getActiveSpreadsheet: () => null,
      openById: () => { if (drive.gone) throw new Error("Exception: You do not have access to the requested document."); return ss; } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: m => mail.push(m) },
    Session: { getScriptTimeZone: () => "America/New_York" },
    ScriptApp: {
      getProjectTriggers: () => triggers.map(f => ({ getHandlerFunction: () => f })),
      newTrigger: f => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => triggers.push(f) }) }) }) })
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ text: s, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      getUuid: () => randomUUID(),
      formatDate: () => clock.today,
      // Apps Script hands back signed bytes, -128 to 127.
      computeDigest: (_alg, s) => [...createHash("sha256").update(String(s), "utf8").digest()].map(b => (b > 127 ? b - 256 : b))
    }
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("./Code.gs", import.meta.url), "utf8"), ctx);
  ctx.setup();
  // Through doPost, the way the page calls it.
  const call = (fn, args) => {
    const out = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ fn, args }) } }).text);
    if (out.error) throw new Error(out.error);
    return out.result;
  };
  return { call, sheets, ctx };
}

const { call, sheets, ctx } = load();
const CONFIG = { days: ["2026-10-06"], startMin: 540, endMin: 600, step: 30 };
const create = (title = "Leaders meeting", kind = "group", config = CONFIG, email = "") => call("create", { p_kind: kind, p_title: title, p_config: config, p_email: email });
const remove = (id, admin) => call("remove", { p_id: id, p_admin: admin });
const answerRows = id => sheets.responses.data.filter(r => r[0] === id).length;
const get = id => call("get", { p_id: id });
const respond = (id, name, slots, token = null, admin = null, data = {}) =>
  call("respond", { p_id: id, p_name: name, p_slots: slots, p_data: data, p_token: token, p_admin: admin });
const update = (id, admin, patch, remove = null) => call("update", { p_id: id, p_admin: admin, p_patch: patch, p_remove: remove });

const tests = {
  "creates a poll with a 10 character id and a long organizer token"() {
    const { id, admin_token } = create("  Leaders meeting  ");
    assert.match(id, /^[abcdefghijkmnpqrstuvwxyz23456789]{10}$/);
    assert.match(admin_token, /^[0-9a-f]{64}$/);
    const got = get(id);
    assert.equal(got.poll.title, "Leaders meeting");
    assert.equal(got.poll.status, "open");
    assert.equal(got.poll.final, null);
    assert.deepEqual(got.poll.config, CONFIG);
    assert.deepEqual(got.responses, []);
    assert.equal(new Set(Array.from({ length: 20 }, () => create().id)).size, 20);
  },
  "returns null for a poll that does not exist"() {
    assert.equal(get("zzzzzzzzzz"), null);
  },
  "saves an answer, and lets the same device overwrite it with its token"() {
    const { id } = create();
    const first = respond(id, "Sam", "1100", null, null, { note: "late" });
    assert.match(first.token, /^[0-9a-f]{64}$/);
    assert.equal(respond(id, " sam ", "0011", first.token).token, first.token);
    assert.deepEqual(get(id).responses.map(r => ({ name: r.name, slots: r.slots, data: r.data })), [{ name: "sam", slots: "0011", data: {} }]);
  },
  "refuses another device answering under a name already taken"() {
    const { id } = create();
    respond(id, "Sam", "1111");
    assert.throws(() => respond(id, "SAM", "0000"), /^Error: name_taken$/);
    assert.throws(() => respond(id, "Sam", "0000", "f".repeat(64)), /^Error: name_taken$/);
    assert.throws(() => respond(id, "Sam", "0000", null, "not-the-admin"), /^Error: name_taken$/);
    assert.deepEqual(get(id).responses.map(r => r.slots), ["1111"]);
  },
  "lets the organizer overwrite and remove any answer"() {
    const { id, admin_token } = create();
    const sam = respond(id, "Sam", "1111");
    respond(id, "Ana", "2222");
    assert.equal(respond(id, "Sam", "1000", null, admin_token).token, null);
    assert.equal(get(id).responses.find(r => r.name === "Sam").slots, "1000");
    respond(id, "Sam", "1001", sam.token);
    assert.deepEqual(update(id, admin_token, {}, " ANA "), { ok: true });
    assert.deepEqual(get(id).responses.map(r => r.name), ["Sam"]);
  },
  "lets the organizer edit the poll, set and clear the final time, and close it"() {
    const { id, admin_token } = create();
    update(id, admin_token, { title: " Renamed ", config: { days: ["dow:1"], startMin: 0, endMin: 60, step: 60 } });
    assert.equal(get(id).poll.title, "Renamed");
    assert.deepEqual(get(id).poll.config, { days: ["dow:1"], startMin: 0, endMin: 60, step: 60 });
    update(id, admin_token, { final: { day: "2026-10-06", startMin: 540, endMin: 600 } });
    assert.deepEqual(get(id).poll.final, { day: "2026-10-06", startMin: 540, endMin: 600 });
    update(id, admin_token, { final: null });
    assert.equal(get(id).poll.final, null);
    update(id, admin_token, { status: "closed" });
    assert.throws(() => respond(id, "Late", "1"), /^Error: closed$/);
    update(id, admin_token, { status: "open" });
    assert.match(respond(id, "Late", "1").token, /^[0-9a-f]{64}$/);
  },
  "refuses every edit without the organizer token, and says forbidden for a missing poll too"() {
    const { id } = create();
    respond(id, "Sam", "1");
    assert.throws(() => update(id, "wrong", { title: "Hacked" }), /^Error: forbidden$/);
    assert.throws(() => update(id, "", {}, "Sam"), /^Error: forbidden$/);
    assert.throws(() => update("zzzzzzzzzz", "wrong", {}), /^Error: forbidden$/);
    assert.equal(get(id).poll.title, "Leaders meeting");
    assert.deepEqual(get(id).responses.map(r => r.name), ["Sam"]);
  },
  "says not_found when answering a poll that does not exist"() {
    assert.throws(() => respond("zzzzzzzzzz", "Sam", "1"), /^Error: not_found$/);
  },
  "never hands back a hash or a token when reading a poll"() {
    const { id, admin_token } = create();
    const { token } = respond(id, "Sam", "1");
    const text = JSON.stringify(get(id));
    assert.doesNotMatch(text, /hash/);
    assert.ok(!text.includes(admin_token) && !text.includes(token));
    const pollRow = sheets.polls.data.find(r => r[0] === id);
    assert.ok(!text.includes(pollRow[6]));
    assert.notEqual(pollRow[6], admin_token);
    assert.match(pollRow[6], /^[0-9a-f]{64}$/);
  },
  "stops taking new names at 200 answers, but still lets an existing one update"() {
    const { id } = create();
    const tokens = [];
    for (let i = 0; i < 200; i++) tokens.push(respond(id, `Person ${i}`, "1").token);
    assert.throws(() => respond(id, "Person 200", "1"), /^Error: full$/);
    assert.equal(respond(id, "Person 0", "2", tokens[0]).token, tokens[0]);
    assert.equal(get(id).responses.length, 200);
  },
  "writes every cell with a leading apostrophe so Sheets keeps it as text"() {
    const { id } = create();
    const raw = [];
    const sh = sheets.responses, append = sh.appendRow;
    sh.appendRow = row => { raw.push(row); append(row); };
    respond(id, "=HYPERLINK(1)", "0011");
    sh.appendRow = append;
    assert.ok(raw[0].every(v => v.startsWith("'")));
    assert.equal(get(id).responses[0].slots, "0011");
    assert.equal(get(id).responses[0].name, "=HYPERLINK(1)");
  },
  "refuses bad input on create"() {
    assert.throws(() => create("t", "party"), /invalid_kind/);
    assert.throws(() => create("   "), /invalid_title/);
    assert.throws(() => create("x".repeat(121)), /invalid_title/);
    assert.throws(() => create("t", "group", { pad: "x".repeat(20000) }), /invalid_config/);
    assert.throws(() => create("t", "group", null), /invalid_config/);
  },
  "refuses bad answers and saves nothing"() {
    const { id } = create();
    assert.throws(() => respond(id, "Sam", "01a2"), /invalid_slots/);
    assert.throws(() => respond(id, "Sam", "0123"), /invalid_slots/);
    assert.throws(() => respond(id, "Sam", "1".repeat(5001)), /invalid_slots/);
    assert.throws(() => respond(id, "   ", "1"), /invalid_name/);
    assert.throws(() => respond(id, "x".repeat(61), "1"), /invalid_name/);
    assert.throws(() => respond(id, "Sam", "1", null, null, { pad: "x".repeat(4000) }), /invalid_data/);
    assert.deepEqual(get(id).responses, []);
  },
  "accepts exactly 5000 slots and an empty slot string"() {
    const { id } = create();
    respond(id, "Sam", "2".repeat(5000));
    respond(id, "Ana", "", null, null, { pick: { day: "2026-10-06", startMin: 540, endMin: 600 } });
    assert.deepEqual(get(id).responses.map(r => r.slots.length).sort(), [0, 5000]);
  },
  "lets only the organizer delete a poll, answers and all"() {
    const { id, admin_token } = create();
    respond(id, "Sam", "1");
    assert.throws(() => remove(id, "wrong"), /^Error: forbidden$/);
    assert.throws(() => remove(id, ""), /^Error: forbidden$/);
    assert.notEqual(get(id), null);
    assert.deepEqual(remove(id, admin_token), { ok: true });
    assert.equal(get(id), null);
    assert.equal(answerRows(id), 0);
  },
  "keeps the organizer email private and checks its shape"() {
    const { id } = create("t", "group", CONFIG, "lead@example.com");
    assert.doesNotMatch(JSON.stringify(get(id)), /lead@example\.com/);
    assert.throws(() => create("t", "group", CONFIG, "not an email"), /invalid_email/);
    assert.ok(create("t", "group", CONFIG, "").id);
  },
  "schedules daily once, however often setup runs"() {
    ctx.setup(); ctx.setup();
    assert.equal(triggers.filter(f => f === "daily").length, 1);
  },
  "deletes a poll 5 days after its confirmed time, else its last day"() {
    clock.today = "2026-10-24";
    const last = create("Last day", "group", { ...CONFIG, days: ["2026-10-20", "2026-11-01"] });
    const fixed = create("Confirmed", "group", { ...CONFIG, days: ["2026-10-20", "2026-11-01"] });
    update(fixed.id, fixed.admin_token, { final: { day: "2026-10-20", startMin: 540, endMin: 600 } });
    respond(fixed.id, "Sam", "1");
    clock.today = "2026-10-25"; ctx.daily();
    assert.notEqual(get(fixed.id), null, "day 5 after the confirmed time still kept");
    clock.today = "2026-10-26"; ctx.daily();
    assert.equal(get(fixed.id), null);
    assert.equal(answerRows(fixed.id), 0);
    assert.notEqual(get(last.id), null, "last day is Nov 1, so kept");
    clock.today = "2026-11-07"; ctx.daily();
    assert.equal(get(last.id), null);
    clock.today = "2026-10-24";
  },
  "keeps a weekday-only poll for 30 days after its last change"() {
    const { id } = create("Weekly", "group", { ...CONFIG, days: ["dow:1", "dow:3"] });
    const changed = get(id).poll.updated_at.slice(0, 10);
    clock.today = changed; ctx.daily();
    assert.notEqual(get(id), null);
    clock.today = "2099-01-01"; ctx.daily();
    assert.equal(get(id), null);
    clock.today = "2026-10-24";
  },
  "emails the organizer only on days with new answers"() {
    clock.today = "2026-10-24";
    mail.length = 0;
    const { id } = create("Bible study", "group", { ...CONFIG, days: ["2026-11-01"], invitees: ["Marc", "Ana"] }, "lead@example.com");
    const quiet = create("No email", "group", { ...CONFIG, days: ["2026-11-01"] });
    respond(quiet.id, "Sam", "1");
    ctx.daily();
    assert.equal(mail.length, 0, "no answers yet, and the other poll has no email");
    // Timestamps are to the millisecond, and in a real poll an answer comes
    // seconds after creation. Without this wait the answer can share the
    // creation millisecond and not count as new, which made this test flaky.
    const t = Date.now(); while (Date.now() <= t) { /* wait for the clock to tick */ }
    respond(id, "Marc", "1");
    ctx.daily();
    assert.equal(mail.length, 1);
    assert.equal(mail[0].to, "lead@example.com");
    assert.match(mail[0].subject, /Bible study/);
    assert.match(mail[0].body, /1 new answer to "Bible study": Marc\./);
    assert.match(mail[0].body, /Still waiting on: Ana\./);
    assert.match(mail[0].body, new RegExp("\\?meet=" + id));
    ctx.daily();
    assert.equal(mail.length, 1, "nothing new, no second email");
  },
  "says sheet_unavailable when the sheet is deleted or access is lost, and recovers when it is back"() {
    const { id } = create();
    drive.gone = true;
    try {
      assert.throws(() => get(id), /^Error: sheet_unavailable$/);
      assert.throws(() => create(), /^Error: sheet_unavailable$/);
      const report = JSON.parse(ctx.doGet({ parameter: { check: "1" } }).text);
      assert.equal(report.ok, false);
      assert.match(report.problems[0].problem, /cannot open its Google Sheet/);
      assert.ok(report.problems[0].fix.length >= 2, "gives more than one way to fix it");
    } finally { drive.gone = false; }
    assert.notEqual(get(id), null, "works again once the sheet is reachable");
  },
  "says sheet_not_set_up when a tab is missing, and the health check names it"() {
    const saved = sheets.responses;
    delete sheets.responses;
    try {
      const { id } = create();
      assert.throws(() => get(id), /^Error: sheet_not_set_up$/);
      const report = JSON.parse(ctx.doGet({ parameter: { check: "1" } }).text);
      assert.equal(report.ok, false);
      assert.match(report.problems.map(p => p.problem).join(" "), /'responses' tab/);
    } finally { sheets.responses = saved; }
  },
  "reports healthy when the sheet, tabs and daily job are all there"() {
    const report = JSON.parse(ctx.doGet({ parameter: { check: "1" } }).text);
    assert.deepEqual(report.problems, []);
    assert.equal(report.ok, true);
    assert.equal(ctx.doGet({ parameter: {} }).text, "KCM scheduler is running.");
  },
  "refuses an unknown status from the organizer and changes nothing"() {
    const { id, admin_token } = create();
    assert.throws(() => update(id, admin_token, { status: "archived", title: "X" }), /invalid_status/);
    assert.equal(get(id).poll.status, "open");
    assert.equal(get(id).poll.title, "Leaders meeting");
  }
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

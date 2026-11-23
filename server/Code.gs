/**
 * 보카토리 스터디 - 결과 저장 서버 (Google Apps Script)
 * 이 스크립트가 붙어 있는 구글 시트에 시험 결과와 반·학생 명단을 저장해요.
 *
 * 처음 한 번: 위 메뉴에서 함수 'setup' 을 골라 [실행] → 권한 허용.
 * 그다음: [배포] → [새 배포] → 유형 '웹 앱' → 실행 사용자 '나', 액세스 권한 '모든 사용자' → 배포.
 * 나온 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 Claude에게 알려 주세요.
 */

var RESULT_SHEET = '결과';
var ROSTER_SHEET = '명단';
var CONFIG_SHEET = '설정';
var RESULT_HEAD = ['일시', '반', '이름', '권', '교재', 'DAY', '시험 종류', '맞은 수', '문항 수', '점수(%)', '결과', '확인 코드', '틀린 단어', 'mode', 'd', '받은 시각'];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var r = ss.getSheetByName(RESULT_SHEET) || ss.insertSheet(RESULT_SHEET);
  if (r.getLastRow() === 0) r.appendRow(RESULT_HEAD);
  r.getRange('A:P').setNumberFormat('@');
  r.setFrozenRows(1);
  r.getRange(1, 1, 1, RESULT_HEAD.length).setFontWeight('bold').setBackground('#0E6D62').setFontColor('#FFFFFF');
  r.hideColumns(14, 2);

  var ro = ss.getSheetByName(ROSTER_SHEET) || ss.insertSheet(ROSTER_SHEET);
  if (ro.getLastRow() === 0) {
    ro.appendRow(['반', '이름']);
    ro.appendRow(['예시반', '홍길동']);
  }
  ro.getRange('A:B').setNumberFormat('@');
  ro.setFrozenRows(1);
  ro.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#0E6D62').setFontColor('#FFFFFF');

  var c = ss.getSheetByName(CONFIG_SHEET) || ss.insertSheet(CONFIG_SHEET);
  c.getRange('B:B').setNumberFormat('@');
  if (c.getLastRow() === 0) {
    c.appendRow(['항목', '값']);
    c.appendRow(['선생님 비밀번호', '0000']);
  }
  c.getRange('B:B').setNumberFormat('@');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function teacherPw_() {
  var c = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
  return String(c.getRange('B2').getValue()).trim();
}
function roster_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET);
  var vals = sh.getDataRange().getValues().slice(1);
  var map = {}, order = [];
  vals.forEach(function (row) {
    var c = String(row[0]).trim(), n = String(row[1]).trim();
    if (!c || !n) return;
    if (!map[c]) { map[c] = []; order.push(c); }
    map[c].push(n);
  });
  return order.map(function (c) { return { c: c, n: map[c] }; });
}
function results_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESULT_SHEET);
  var vals = sh.getDataRange().getDisplayValues().slice(1);
  return vals.map(function (x) {
    return { when: x[0], cls: x[1], name: x[2], v: +x[3], d: x[14], mode: x[13], score: +x[7], total: +x[8], pct: +x[9],
      pass: x[10] === '-' ? null : x[10] === '합격', code: x[11] };
  });
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'roster') return json_({ ok: true, roster: roster_() });
    if (p.action === 'mine') {
      var mine = results_().filter(function (r) { return r.cls === p.cls && r.name === p.name && r.mode === 'day'; });
      return json_({ ok: true, results: mine });
    }
    if (p.action === 'results') {
      if (String(p.pw) !== teacherPw_()) return json_({ ok: false, error: 'password' });
      var all = results_();
      if (p.since) all = all.filter(function (r) { return r.when >= p.since; });
      return json_({ ok: true, results: all });
    }
    return json_({ ok: true, app: 'vocatory' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (body.action === 'result') {
      var list = body.results || [body.r];
      var sh = ss.getSheetByName(RESULT_SHEET);
      var existing = {};
      sh.getRange(1, 12, Math.max(sh.getLastRow(), 1), 1).getDisplayValues().forEach(function (x, i) { existing[x[0]] = 1; });
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      var saved = [];
      list.forEach(function (r) {
        if (!r || !r.name) return;
        var uid = r.code + '';
        if (existing[uid]) { saved.push(r.code); return; }
        existing[uid] = 1;
        sh.appendRow([r.when, r.cls || '', r.name, String(r.v), r.book || '', r.dayLabel || String(r.d), r.modeName || r.mode,
          String(r.score), String(r.total), String(r.pct), r.pass === null ? '-' : (r.pass ? '합격' : '재시험'), r.code,
          (r.wrongWords || []).join(', '), r.mode, String(r.d), now]);
        saved.push(r.code);
      });
      return json_({ ok: true, saved: saved });
    }
    if (body.action === 'saveRoster') {
      if (String(body.pw) !== teacherPw_()) return json_({ ok: false, error: 'password' });
      var ro = ss.getSheetByName(ROSTER_SHEET);
      ro.getRange(2, 1, Math.max(ro.getLastRow() - 1, 1), 2).clearContent();
      var rows = [];
      (body.roster || []).forEach(function (g) { g.n.forEach(function (n) { rows.push([g.c, n]); }); });
      if (rows.length) ro.getRange(2, 1, rows.length, 2).setValues(rows);
      return json_({ ok: true, count: rows.length });
    }
    if (body.action === 'setPw') {
      if (String(body.pw) !== teacherPw_()) return json_({ ok: false, error: 'password' });
      ss.getSheetByName(CONFIG_SHEET).getRange('B2').setValue(String(body.newPw));
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

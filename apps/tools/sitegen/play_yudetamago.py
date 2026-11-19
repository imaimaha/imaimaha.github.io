# /play/yudetamago/logic.js と play.js を、アプリ（~/Developer/apps/YudeTamago/game.js）から作りなおす。three.min.js・xmas.js はアプリからコピーして、three.min.js の fetch 2か所だけ Promise.reject にする
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import BASE   # サイトの住所（gen.py の1か所）
SRC = os.path.expanduser('~/Developer/apps/YudeTamago/game.js')
OUT = os.path.expanduser('~/Developer/imaimaha.github.io/play/yudetamago/')
lines = open(SRC, encoding='utf-8').read().split('\n')
def find(s, start=0):
    for i in range(start, len(lines)):
        if s in lines[i]: return i
    raise SystemExit('not found: ' + s)
# ---- logic.js: YudeLogic（アプリの game.js の先頭、そのまま） ----
lg_end = find('dailyEgg: dailyEgg, xmasEgg: xmasEgg') + 2   # '})();'
assert lines[lg_end] == '})();', lines[lg_end]
logic = '\n'.join(lines[:lg_end + 1]) + '\n'
open(OUT + 'logic.js', 'w', encoding='utf-8').write(logic)

body_start = find('// ゲーム本体') + 2      # '(function () {'
assert lines[body_start].startswith('(function () {')
B = lines[body_start:]
def idx(s, start=0):
    for i in range(start, len(B)):
        if s in B[i]: return i
    raise SystemExit('not found in body: ' + s)
def cut(a_marker, b_marker, repl, a_off=0, b_off=0, start=0):
    """B[a .. b) を repl（行のリスト）にかえる"""
    global B
    a = idx(a_marker, start) + a_off; b = idx(b_marker, a + 1) + b_off
    B = B[:a] + repl + B[b:]

# 1) 振動・たまごの選択・ランキング（アプリだけ）
cut("// 振動のオン・オフ", "function todayStr()", [
 "  // 振動・ランキング・たまごの選択はアプリだけ（ブラウザ版は今日のたまごだけ）",
 "  var selEgg = 'white';",
 "  function vibPost() { /* なし */ }",
 "  var vibOff = true;"])
B[idx("function todayStr()")] = "  function todayStr() { return dstr(jstDay()); }   // ブラウザ版は日本時間の日付（アプリは端末の日付。日本ではおなじ）"
# 2) 全画面広告・動画（アプリだけ）→ 何もしない
cut("// ===================== 結果のあとの全画面広告", "// ===================== 今日のスコア", [
 "  // 広告はない（アプリだけ）",
 "  var Inter = { gameOver: function () {}, clear: function () {}, atResult: function () { return false; }, leave: function (f) { f(); } };",
 "  var Reward = { hasAds: function () { return false; }, request: function (cb) { cb('unavailable'); } };"])
# 3) 今日のスコア（アプリのランキング用）の保存はなし。日付は日本時間
cut("// ===================== 今日のスコア", "function jstDay()", ["  // ===================== 今日のたまご（日本時間の日付） ====================="])
a = idx("// ===================== クリスマス期間"); b = idx("function nowMs()")
B = B[:a] + [
 "  // ===================== クリスマス期間（毎年 12/1〜12/25 日本時間。xmas.js。見た目だけ・今日のたまごの中身は同じ） =====================",
 "  function xmasOn() { return !!(window.Xmas && Xmas.active()); }",
 "  var xSnow = null;",
 "  function xmasDeco() { document.body.classList.toggle('xmas', xmasOn()); }",
 "  // 雪: クリスマス期間の今日のたまごのとき（ブラウザ版は遊ぶところの中だけ）",
 "  function xmasSnow() {",
 "    var want = xmasOn() && (state === 'title' || (G && G.egg && G.egg.id === 'xmas' && state !== 'result'));",
 "    if (want && !xSnow) xSnow = Xmas.snow({ parent: $('yd-game'), before: el.stage, count: 34, css: 'position:absolute;' });",
 "    if (xSnow) { if (want) xSnow.start(); else xSnow.stop(); }",
 "  }",
 ""] + B[b:]
# 4) 音: ミュートは WebPlay のボタンと同じ
i = idx("try { muted = localStorage.getItem(KEY_MUTE) === '1'; }"); B[i] = "    muted = WP.muted();   // 音のボタンは WebPlay（web.yudetamago.set）"
i = idx("try { localStorage.setItem(KEY_MUTE, muted ? '1' : '0'); }"); del B[i]
i = idx("window.__gameAudioCtx = ac;"); B[i] = re.sub(r"\s*window\.__gameAudioCtx = ac;.*$", "", B[i]) if B[i].strip() != '' else B[i]
# 5) 統計なし
cut("// 遊びの統計（匿名の数", "var peel = null, bigQ = []", [
 "  function pstat() { /* 統計は送らない */ }",
 "  function pkey() { return null; }"])
# 6) startGame / showScreen（タイトル・結果は WebPlay の画面）
cut("function startGame(modeKey, eggId, daily, pastDay)", "// 入力", [
 "  function startGame(modeKey, eggId, daily) {",
 "    Snd.init();",
 "    WP.closeClear(); closeFail();",
 "    newRound(modeKey, eggId);",
 "    G.daily = !!daily;",
 "    G.day = jstDay();",
 "    G.past = null;",
 "    G.chanceUsed = false;",
 "    state = 'play';",
 "    WP.timer.reset(); WP.timer.start();   // 日付がかわったときに、遊んでいる途中で読みなおさないように（common.js）",
 "    showScreen();",
 "    el.hint.textContent = '';",
 "  }",
 "",
 "  function showScreen() {",
 "    el.start.hidden = state !== 'title';",
 "    var inGame = state === 'play' || state === 'reveal' || state === 'over';",
 "    el.hud.hidden = !inGame;",
 "    el.bottom.hidden = state !== 'play';",
 "    el.hint.hidden = state !== 'play';",
 "    el.ring.hidden = true;",
 "    xmasSnow();",
 "  }",
 "",
 "  // ========================================================================="], b_off=-1)
# 7) 入力: 座標は遊ぶところの中の位置にする（ページをスクロールしても合うように）
a = idx("// 入力"); b = idx("// タップ（ヒビ・力み・爆発）")
for k in range(a, b):
    B[k] = B[k].replace('e.clientX', 'ex(e)').replace('e.clientY', 'ey(e)')
B = [l.replace('(window.innerWidth || 390)', 'VW()').replace('(window.innerHeight || 844)', 'VH()') for l in B]
i = idx("var w = window.innerWidth || 390, h = window.innerHeight || 844;"); B[i] = B[i].replace("window.innerWidth || 390", "VW()").replace("window.innerHeight || 844", "VH()")
# ページのスクロールは止めない（遊ぶところの中だけ止める）
cut("// ページのスクロール・ズーム・長押しメニューを止める", "// たまご（3D の絵）の上では", [
 "  // 遊ぶところの中だけ、スクロール・ズーム・長押しメニュー・文字えらびを止める（下の「このページについて」は読める）",
 "  function inGame(t) { return !!(t && t.closest && t.closest('#yd-game')); }",
 "  document.addEventListener('touchmove', function (e) { if (inGame(e.target)) e.preventDefault(); }, { passive: false });",
 "  document.addEventListener('dblclick', function (e) { if (inGame(e.target)) e.preventDefault(); });",
 "  document.addEventListener('contextmenu', function (e) { if (inGame(e.target)) e.preventDefault(); }, true);",
 "  document.addEventListener('selectstart', function (e) { if (inGame(e.target)) e.preventDefault(); }, true);"])
# 8) 結果（WebPlay のクリアの画面・割れたときの画面）。タイトル・図鑑・過去の問題・説明・ランキング・もう1回チャンス・撮影用フックはない
a = idx("// 結果"); a -= 1   # '// ====' の行から
b = idx("// UI 部品"); b -= 1
B = B[:a] + ["@@RESULT@@"] + B[b:]
cut("function syncMute()", "function toTitle()", ["@@INPUT@@"])
cut("function toTitle()", "var hud = { time:", [])
# 9) 起動・一時停止・デバッグ
cut("// 起動: タイトル画面の後ろで", "})();", ["@@BOOT@@"], b_off=1)
body = '\n'.join(B)
RESULT = r'''  // =========================================================================
  // 結果（ブラウザ版: むけたら WebPlay のクリアの画面、割れたら もう1回）
  // =========================================================================
  var EXPLODE_LINES = ['力を込めすぎです', 'たまごは星になった', 'キッチンが大変なことに', 'ゆでたまごは爆発するものではない'];
  function rankRow(r) {   // シェアの絵文字（答えはない。ランクと点だけ）
    var n = Math.max(1, 6 - Math.min(5, L.rankIndex(r.rank)));
    var s = '🥚'; for (var i = 0; i < 5; i++) s += i < n ? '✨' : '・'; return s + ' ' + r.rank;
  }
  function showResult() {
    state = 'result';
    WP.timer.stop();
    var dmg = Math.round(100 - G.hp), reason = G.endReason, pct = Math.floor((1 - attachedTris / totalOuterTris) * 100);
    showScreen();
    if (reason === 'clear') {
      var score = L.computeScore(G.time, dmg, G.saltBonus, G.modeKey), rank = L.rankFromScore(score);
      var prev = WP.record();
      WP.saveRecord(G.time, { score: Math.round(score * 10) / 10, rank: rank, damage: dmg, rare: G.rare });
      result(true, { sec: G.time, score: score, rank: rank, damage: dmg, salt: G.saltBonus, rare: G.rare }, prev);
    } else showFail(reason, pct, dmg);
  }
  function result(fresh, r, prev) {
    var rk = document.createElement('div'); rk.className = 'yd-rank';
    var rb = document.createElement('b'); rb.className = 'r-' + r.rank; rb.textContent = r.rank; rk.appendChild(rb);
    var rs = document.createElement('span'); rs.textContent = Number(r.score).toFixed(1) + '点'; rk.appendChild(rs);
    var cm = document.createElement('p'); cm.textContent = L.COMMENTS[r.rank] || '';
    var dt = document.createElement('p'); dt.className = 'yd-detail';
    dt.textContent = 'タイム ' + Number(r.sec).toFixed(1) + '秒 ／ 白身ダメージ ' + r.damage + (r.salt != null ? ' ／ 塩 +' + r.salt : '');
    var ex = [rk, cm, dt];
    if (r.rare && r.rare !== 'none') { var rr = document.createElement('p'); rr.className = 'yd-rare'; rr.textContent = r.rare === 'gold' ? '★ レア！ 黄金のたまごが出た' : r.rare === 'oji' ? '★ レア！ おじさんの顔が描いてあった' : '★ ひよこが出てきた！？'; ex.push(rr); }
    WP.showClear({ sec: r.sec, fresh: fresh, head: 'ツルツル完成！', emoji: '🥚', row: rankRow(r), extra: ex,
      note: prev ? '今日の記録（1回目）: ' + prev.rank + '（' + prev.score + '点）' : null,
      again: function () { startGame('normal', DAILY_ID, true); } });
  }
  var failBox = null;
  function closeFail() { if (failBox) { failBox.remove(); failBox = null; } }
  function showFail(reason, pct, dmg) {
    closeFail();
    var ov = document.createElement('div'); ov.className = 'yd-fail';
    var box = document.createElement('div'); box.className = 'box';
    function p(cls, t) { var e = document.createElement(cls === 'h2' ? 'h2' : 'p'); if (cls !== 'h2') e.className = cls; e.textContent = t; box.appendChild(e); }
    p('h2', reason === 'explode' ? 'ドカーン！ 爆発しました' : '白身が崩壊しました…');
    p('cm', reason === 'explode' ? EXPLODE_LINES[(Math.random() * EXPLODE_LINES.length) | 0] : L.COMMENTS.F);
    p('dt', '剥けた殻 ' + pct + '% ／ タイム ' + G.time.toFixed(1) + '秒 ／ 白身ダメージ ' + dmg);
    p('tip', reason === 'explode' ? '連打しすぎると爆発します（力みゲージに注意）' : 'ゆっくり、まっすぐ引くと削れにくい');
    var rec = WP.record();
    if (rec) p('tip', '今日の記録（1回目）: ' + rec.rank + '（' + rec.score + '点）');
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn main'; bt.id = 'yd-retry'; bt.textContent = 'もう1個むく';
    bt.addEventListener('click', function () { closeFail(); startGame('normal', DAILY_ID, true); });
    box.appendChild(bt);
    ov.appendChild(box); $('yd-game').appendChild(ov); failBox = ov;
  }
'''
INPUT = r'''  // ミュートは WebPlay の 🔊 ボタン（web.yudetamago.set）。押されたら音もあわせる
  document.getElementById('wp-mute').addEventListener('click', function () { if (Snd.isMuted() !== WP.muted()) Snd.toggle(); });
  el.btnStart.addEventListener('click', function () { startGame('normal', DAILY_ID, true); });
  el.btnBig.addEventListener('click', bigPeel);
  el.btnSalt.addEventListener('click', shakeSalt);
  window.addEventListener('keydown', function (e) {
    if ((e.key === 'r' || e.key === 'R') && G && state === 'play') startGame('normal', DAILY_ID, true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) Snd.suspend(); else { Snd.resume(); lastT = 0; }
  });
'''
BOOT = r'''  // 起動: 今日のたまごを、はじめの画面の後ろで回しておく
  newRound('normal', DAILY_ID);
  state = 'title';
  xmasDeco();
  showScreen();
  requestAnimationFrame(frame);
  var eg0 = L.eggById(DAILY_ID);
  el.startName.textContent = eg0.name;
  el.startDesc.textContent = eg0.desc;
  el.startRule.textContent = 'ふつうモード・基準タイム ' + L.applyEgg(L.MODES.normal, eg0).par + '秒';
  var rec0 = WP.record();
  if (rec0) result(false, rec0, null);

  // 自動テスト用（今日のたまごは日付からいつでも計算できるので、出してもこまらない）
  root.__webPlay = {
    day: function () { return DAY; }, egg: function () { return DAILY_ID; }, state: function () { return state; },
    dailyEgg: function (d) { return L.dailyEgg(dstr(d)).id; },
    finish: function (t) { if (state === 'play') { G.time = t || 30; complete(); } },   // 殻をぜんぶむいたことにする
    boom: function () { if (state === 'play') explode(); }
  };
})(window);'''
body = body.replace("@@RESULT@@", RESULT.rstrip('\n')).replace("@@INPUT@@", INPUT.rstrip('\n')).replace("@@BOOT@@", BOOT)
# 先頭: WebPlay と今日のたまご
head = r'''/* つるっと ゆでたまご剥き — ブラウザ版「今日のたまご」（/play/yudetamago/）
 * たまごの種類・ランク・点数は アプリと同じ logic.js（YudeLogic。アプリの game.js の先頭をそのまま）。3D は three.min.js（アプリと同じ r158。MIT）。
 * three.min.js は、使っていないファイル読みこみ（FileLoader・ImageBitmapLoader）の fetch だけ Promise.reject にかえてある（ほかはアプリと同じ）。
 * むく画面（殻・白身・剥がし・塩・演出・音）は アプリの game.js からそのまま写したもの。
 * アプリにあってブラウザ版にないもの: タイトル・たまご選び・図鑑・半熟・過去の問題・説明・ランキング・広告・統計・振動・一時停止。
 * サーバーとは通信しない。今日の記録だけ、この端末に保存（web.yudetamago.）
 */
(function (root) {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof THREE === 'undefined') return;
  var L = YudeLogic, WP = root.WebPlay;
  function dstr(day) { var p = day.split('-'); return +p[0] + '-' + (+p[1]) + '-' + (+p[2]); }   // dailyEgg のたねの形（2026-10-7）。アプリと同じ
  function jstDay() {
    var d = new Date(Date.now() + 9 * 3600000), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  var DAY = jstDay();
  // 今日のたまご（クリスマス期間は、見た目だけクリスマスのたまご。中身は同じ。アプリの startDailyPre と同じ）
  var DAILY_ID = L.dailyEgg(dstr(DAY)).id;
  if (window.Xmas && Xmas.active()) DAILY_ID = 'xmas:' + DAILY_ID;
  WP.init({ ns: 'yudetamago', day: DAY, name: '今日のたまご', tag: '今日のたまご', emoji: '🥚', url: 'https://imaimaha.github.io/play/yudetamago/',
    appId: '6821884836', appLabel: 'アプリなら 図鑑とランキングで勝負', landing: '../../yudetamago/', landingName: 'つるっと ゆでたまご剥き',
    today: jstDay });
  // 遊ぶところ（#yd-game）の中の位置。アプリは画面いっぱいなので window の大きさを使っていた
  function VW() { return (el.stage && el.stage.clientWidth) || window.innerWidth || 390; }
  function VH() { return (el.stage && el.stage.clientHeight) || window.innerHeight || 844; }
  function ex(e) { return e.clientX - (e.clientX || e.clientY ? el.stage.getBoundingClientRect().left : 0); }
  function ey(e) { return e.clientY - (e.clientX || e.clientY ? el.stage.getBoundingClientRect().top : 0); }
'''
head = head.replace('https://imaimaha.github.io', BASE)   # サイトの住所は gen.py の BASE
# 本体の先頭3行（(function () { / if (...) return; / var L = YudeLogic;）をとりかえる
bl = body.split('\n')
assert bl[0].startswith('(function () {') and 'typeof THREE' in bl[1] and 'var L = YudeLogic' in bl[2]
body = head + '\n'.join(bl[3:])
# 要らないものを消す（アプリの保存の名前・広告のつなぎ・二重の jstDay）
def drop(text, old, new=''):
    assert old in text, old[:60]
    return text.replace(old, new, 1)
body = drop(body, "  var KEY_BEST = 'yudetamago-best-v1', KEY_ZUKAN = 'yudetamago-zukan-v1', KEY_MUTE = 'yudetamago-muted';\n  var KEY_EGGS = 'yudetamago-eggs-v1', KEY_ST = 'yudetamago-stats-v1', KEY_SEL = 'yudetamago-sel-v1';\n")
body = drop(body, "  // 振動・ランキング・たまごの選択はアプリだけ（ブラウザ版は今日のたまごだけ）\n  var selEgg = 'white';\n  function vibPost() { /* なし */ }\n  var vibOff = true;\n  function todayStr() { return dstr(jstDay()); }   // ブラウザ版は日本時間の日付（アプリは端末の日付。日本ではおなじ）\n",
            "  var selEgg = 'white';   // ブラウザ版は今日のたまごだけ（たまご選び・振動・ランキングはアプリ）\n")
body = re.sub(r"\n  function loadJSON\(k, d\).*\n  function saveJSON\(k, v\).*\n", "\n", body)
body = drop(body, "  // 広告はない（アプリだけ）\n  var Inter = { gameOver: function () {}, clear: function () {}, atResult: function () { return false; }, leave: function (f) { f(); } };\n  var Reward = { hasAds: function () { return false; }, request: function (cb) { cb('unavailable'); } };\n")
body = re.sub(r"  // ===================== 今日のたまご（日本時間の日付） =====================\n  function jstDay\(\) \{\n.*\n.*\n  \}\n", "", body)
body = drop(body, "['stage', 'hud',", "['start', 'btnStart', 'startName', 'startDesc', 'startRule', 'stage', 'hud',")
open(OUT + 'play.js', 'w', encoding='utf-8').write(body + ('\n' if not body.endswith('\n') else ''))
print('ok', len(body))

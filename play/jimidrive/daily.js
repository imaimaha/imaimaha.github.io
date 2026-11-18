/* ナンバー暗算ドライブ — ブラウザ版「今日のドライブ」の きまりごと（/play/jimidrive/）
 * アプリの game.js から、今日のドライブの作り方（dailySpec）・ナンバーの出し方（makePlate）・制限時間・点数・称号を そのまま写したもの。
 * 写した関数は1文字もかえていない（だれの端末でも、アプリと同じナンバーが同じ順番で来る）。画面・音・通信はここにはない。
 * solver.js（Make10）と data.js（JimiData）はアプリのファイルをそのまま。
 */
var JDDaily = (function () {
  'use strict';

  // ---- CONFIG（そのまま） ----
  var CONFIG = {
    GOAL_ANSWERS_BASE: 10,   // 到着までに必要な正解数 = BASE + 距離km × PER_KM（MIN〜MAX に収める）
    GOAL_ANSWERS_PER_KM: 0.45,
    GOAL_ANSWERS_MIN: 12,
    GOAL_ANSWERS_MAX: 40,
    KM_COMBO_BONUS: 0.08,    // 連続正解1回ごとの追加距離（正解1回で進む距離に対する割合）
    KM_COMBO_MAX: 0.5,       // 追加距離の上限（同じく割合）
    TIME_LIMIT_START: 6.0,   // 最初の制限時間（秒）
    TIME_LIMIT_END: 4.0,     // 目的地付近での制限時間（秒）
    PRIME_TIME_SCALE: 1.4,   // 素数の問題は制限時間をこれだけ長くする
    MISS_CHOICES: [1, 3, 5], // 選べるミスの回数（1.0.2 で「なし」はやめた。保存していた 0 は 3 にする）
    ENDLESS_TIME: 180,       // 目的地なし×タイムアタックの持ち時間（秒）
    ENDLESS_KM_MIN: 1.2,     // 目的地なしで、正解1回で進む距離（路線の長さ÷25 をこの範囲に収める）
    ENDLESS_KM_MAX: 8,
    TIME_PENALTY: 5,         // タイムアタックで、1回まちがえるごとに足される秒数
    APPROACH_SEC: 2.0,       // 対向車が見えてからすれ違うまで
    FEEDBACK_SEC: 1.7,       // 答え合わせの表示時間
    GAP_MIN: 0.3,            // 次の車が来るまでの間（最小）
    GAP_MAX: 1.2,            // 次の車が来るまでの間（最大）
    SOLVABLE_RATIO: 0.5,     // 出題で「はい」が正解のナンバーを出す割合（10は自然分布だと約85%が作れる）
    RARE_CHANCE: 0.06,       // レアご当地ナンバーの出現率
    SPECIAL_CHANCE: 0.03,    // ぞろ目・連番が出る確率
    TRIVIA_CHANCE: 0.75,     // 停車地を通りすぎたとき「まめ知識」（data.js の tip）を出す確率（1回のドライブで同じ場所は1回だけ）
    TRIVIA_GAP: 1.8,         // まめ知識を出すとき、次の車が来るまでの間をこれだけはあける（秒。タイムアタックでは延ばさない）
    SCORE_BASE: 100,         // 正解の基本点
    SCORE_TIME: 20,          // 残り1秒あたりの加点
    SCORE_COMBO: 10,         // 連続正解1回あたりの加点
    SCORE_RARE: 300,         // レアナンバー正解ボーナス
    SCORE_GOAL_LIFE: 500,    // 到着時のボーナス（3 − ミス数）× これ
    DRIVE_SPEED: 24,         // 画面の走行速度（m/s）
    CAR_START_Z: 150,        // 対向車が現れる距離（m）
    CAR_PASS_Z: 6            // すれ違い判定の距離（m）
  };


  // ---- 問題の種類・かな（そのまま） ----
  var D = JimiData;
  var KANA = 'さすせそたちつてとなにぬねのはひふほまみむめもやゆよらりるろ'.split('');
  var KANA_BIZ = 'あいうえかきくけこを'.split('');

  // 問題の種類
  var MODES = {
    make10: { name: '10作れる？', yes: '10作れる！', no: '10は無理！' },
    prime: { name: '素数？', yes: '素数！', no: '素数じゃない！' },
    mix: { name: 'ミックス' }
  };
  var RULES = {
    normal: { name: 'ふつう' },
    time: { name: 'タイムアタック' }
  };


  // ---- ユーティリティ（そのまま。画面と保存の関数はのぞく） ----
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // ナンバー（数字・問題・車種・地域・レア）を決める乱数。今日のドライブでは日付から作った乱数にして、だれでも同じ並びにする
  var plateRng = Math.random;
  function rnd() { return plateRng(); }
  function pickR(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- 今日のドライブ（そのまま） ----
  // 作り方（dailySpec・makePlate の乱数の使い方）を変えるときは DAILY_VERSION を上げる（古いアプリと同じ日の道がずれるのは承知のうえで）
  var DAILY_VERSION = 1;
  var DAILY_KEY = 'jimidrive.daily.v1';
  var DAILY_KM_MIN = 15, DAILY_KM_MAX = 40; // 区間の長さ（正解 17〜28 回くらい。3分前後）
  function dayKey() { // 日本時間の日付 '2026-10-14'（ランキングのサーバーと同じ）
    var d = new Date(Date.now() + 9 * 3600000), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function fmtDay(day) { var p = day.split('-'); return parseInt(p[1], 10) + '/' + parseInt(p[2], 10); }
  function hashStr(str) { // FNV-1a
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dailySpec(day) {
    var rng = mulberry32(hashStr('jimi-daily-' + DAILY_VERSION + '-' + day));
    var li = Math.floor(rng() * D.LINES.length), st = D.LINES[li].stops, segs = [];
    for (var i = 0; i < st.length; i++) for (var j = 0; j < st.length; j++) {
      var km = Math.abs(st[j].km - st[i].km);
      if (i !== j && km >= DAILY_KM_MIN && km <= DAILY_KM_MAX) segs.push([i, j]);
    }
    var sg = segs[Math.floor(rng() * segs.length)];
    var wd = new Date(day + 'T00:00:00Z').getUTCDay();
    return { day: day, line: li, from: sg[0], to: sg[1], mode: wd === 0 || wd === 6 ? 'mix' : wd === 3 ? 'prime' : 'make10',
      rule: 'normal', miss: 3, seed: hashStr('jimi-plates-' + DAILY_VERSION + '-' + day) };
  }

  // ---- ルート（そのまま） ----
  function endless() { return sel.to === -1; }
  function buildRoute() {
    var line = D.LINES[sel.line], a = line.stops[sel.from], free = endless();
    var r = { line: line, stops: [], endless: free, total: 0, answers: 0, kmPer: 0, idx: sel.from, dir: 1 };
    r.stops.push({ name: a.name, d: 0, reg: a.reg, arrive: a.arrive, note: a.note, tip: a.tip, lk: a.km });
    if (free) {
      var len = line.stops[line.stops.length - 1].km - line.stops[0].km;
      r.dir = sel.from === line.stops.length - 1 ? -1 : sel.from === 0 ? 1 : (len - a.km > a.km ? 1 : -1);
      r.kmPer = clamp(len / 25, CONFIG.ENDLESS_KM_MIN, CONFIG.ENDLESS_KM_MAX);
      extendRoute(r, 60);
      return r;
    }
    var b = line.stops[sel.to], dir = sel.to > sel.from ? 1 : -1;
    for (var i = sel.from + dir; ; i += dir) {
      var st = line.stops[i];
      r.stops.push({ name: st.name, d: Math.abs(st.km - a.km), reg: st.reg, arrive: st.arrive, note: st.note, tip: st.tip, lk: st.km });
      if (i === sel.to) break;
    }
    r.total = Math.abs(b.km - a.km);
    r.answers = Math.round(clamp(CONFIG.GOAL_ANSWERS_BASE + r.total * CONFIG.GOAL_ANSWERS_PER_KM, CONFIG.GOAL_ANSWERS_MIN, CONFIG.GOAL_ANSWERS_MAX));
    r.kmPer = r.total / r.answers;
    return r;
  }
  function extendRoute(r, ahead) {
    var st = r.line.stops;
    while (r.stops[r.stops.length - 1].d < ahead) {
      var ni = r.idx + r.dir;
      if (ni < 0 || ni >= st.length) { r.dir = -r.dir; ni = r.idx + r.dir; }
      var last = r.stops[r.stops.length - 1], nx = st[ni];
      r.stops.push({ name: nx.name, d: last.d + Math.abs(nx.km - st[r.idx].km), reg: nx.reg, arrive: nx.arrive, note: nx.note, tip: nx.tip, lk: nx.km, turn: ni === 0 || ni === st.length - 1 });
      r.idx = ni;
    }
  }

  // ---- 制限時間・問題・ナンバー（そのまま） ----
  function timeLimit(q) {
    var p = R.endless ? clamp(S.correct / 40, 0, 1) : clamp(S.km / R.total, 0, 1);
    var t = CONFIG.TIME_LIMIT_START - (CONFIG.TIME_LIMIT_START - CONFIG.TIME_LIMIT_END) * p;
    return q === 'prime' ? t * CONFIG.PRIME_TIME_SCALE : t;
  }

  // ---- 問題 ----
  function isPrime(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (var i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  }
  var SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function factorText(n) {
    var parts = [], m = n;
    for (var p = 2; p * p <= m; p++) {
      var e = 0;
      while (m % p === 0) { m /= p; e++; }
      if (e) parts.push(p + (e === 1 ? '' : SUP[e] || '^' + e));
    }
    if (m > 1) parts.push(String(m));
    return n + ' = ' + parts.join(' × ');
  }
  function primeHint(n) {
    if (n % 2 === 0) return '（偶数）';
    if (n % 5 === 0) return '（5で割れる）';
    var ds = 0, x = n;
    while (x) { ds += x % 10; x = Math.floor(x / 10); }
    if (ds % 3 === 0) return '（各桁の和 ' + ds + ' が3で割れる）';
    return '';
  }
  function truthOf(q, n) { return q === 'prime' ? isPrime(n) : Make10.isSolvable(n); }

  function pickNumber(q) {
    if (rnd() < CONFIG.SPECIAL_CHANCE) {
      var sp = pickR(D.SPECIAL).num;
      if (sp !== S.lastNum) return sp;
    }
    var want = rnd() < CONFIG.SOLVABLE_RATIO, hard = q === 'prime' && !want && rnd() < 0.6;
    var n = 1000, tries = 0;
    do {
      n = 1000 + Math.floor(rnd() * 9000); // 「35-24」形式（先頭は0以外）
      tries++;
    } while ((truthOf(q, n) !== want || n === S.lastNum || (hard && (n % 2 === 0 || n % 5 === 0))) && tries < 600);
    return n;
  }

  function pickCar() {
    var sum = 0, i;
    for (i = 0; i < D.CARS.length; i++) sum += D.CARS[i].weight;
    var r = rnd() * sum;
    for (i = 0; i < D.CARS.length; i++) { r -= D.CARS[i].weight; if (r <= 0) return D.CARS[i]; }
    return D.CARS[0];
  }

  // 乱数を使う回数は、走った場所（地域の候補の数）で変わらないようにしてある（今日のドライブで、だれでも同じナンバーの並びになるように）
  function makePlate() {
    var q = sel.mode === 'mix' ? (rnd() < 0.5 ? 'make10' : 'prime') : sel.mode;
    var n = pickNumber(q);
    S.lastNum = n;
    var car = pickCar();
    var local = D.REGIONS[R.stops[S.wpIndex].reg] || D.REGIONS.tokyo;
    var rare = rnd() < CONFIG.RARE_CHANCE, region;
    var far = D.RARE_REGIONS.filter(function (r) { return local.indexOf(r) < 0; });
    var rr = rnd();
    region = rare ? far[Math.floor(rr * far.length)] : local[Math.floor(rr * local.length)];
    var biz = car.plate === 'green' || car.plate === 'black';
    var kr = rnd(), kw = rnd();
    var kana = biz ? KANA_BIZ[Math.floor(kr * KANA_BIZ.length)] : (kw < 0.07 ? 'わ' : KANA[Math.floor(kr * KANA.length)]);
    var cls = car.cls[Math.floor(rnd() * car.cls.length)];
    var special = null;
    for (var i = 0; i < D.SPECIAL.length; i++) if (D.SPECIAL[i].num === n) special = D.SPECIAL[i];
    return { num: n, q: q, digits: Make10.digitsOf(n), region: region, cls: cls, kana: kana, rare: rare, car: car, special: special };
  }

  // ---- 称号（そのまま） ----
  function rankTitle() {
    var sc = S.score;
    if ((S.goal || (R.endless && S.correct >= 30)) && S.misses === 0) return R.line.short + 'の生きた電卓';
    if (sel.rule === 'time') { // タイムアタックは点ではなく正解率で決める
      var acc = S.total ? S.correct / S.total : 0;
      if (acc >= 0.9) return '夜の計算機';
      if (acc >= 0.75) return sel.mode === 'prime' ? '夜の素数ハンター' : '高速のテンメイカー';
      if (acc >= 0.6) return 'ナンバー読み見習い';
      if (acc >= 0.4) return '助手席向き';
      return '地味な人';
    }
    if (sc >= 6000) return 'ナンバープレートの神';
    if (sc >= 4000) return '夜の計算機';
    if (sc >= 2500) return sel.mode === 'prime' ? '夜の素数ハンター' : '高速のテンメイカー';
    if (sc >= 1200) return 'ナンバー読み見習い';
    if (sc >= 400) return '助手席向き';
    return '地味な人';
  }

  // ---- ここからブラウザ版だけ（アプリの startRun / startDaily と同じ順で、今日のドライブの道とナンバーを用意する） ----
  var S = { lastNum: -1, wpIndex: 0, km: 0, correct: 0, score: 0, misses: 0, goal: false };
  var sel = null, R = null;
  // 今日のドライブを1本はじめる（アプリの startDaily → startRun と同じ: 乱数は dailySpec の seed、lastNum は -1、wpIndex は 0）
  function start(day) {
    var sp = dailySpec(day);
    sel = { line: sp.line, from: sp.from, to: sp.to, mode: sp.mode, rule: sp.rule, miss: sp.miss };
    plateRng = mulberry32(sp.seed);
    S = { lastNum: -1, wpIndex: 0, km: 0, correct: 0, score: 0, misses: 0, goal: false };
    R = buildRoute();
    return { spec: sp, sel: sel, R: R, S: S };
  }
  // そのドライブの n 枚のナンバー（日付あわせのテスト用。アプリの __jd.plates(day, n) と同じ形の文字）
  function plates(day, n) {
    var keep = [plateRng, S, sel, R], o = start(day), out = [];
    for (var i = 0; i < n; i++) { S.wpIndex = 0; var pl = makePlate(); out.push(pl.num + pl.q[0] + (pl.rare ? 'R' : '')); }
    plateRng = keep[0]; S = keep[1]; sel = keep[2]; R = keep[3];
    return out.join(' ');
  }
  return {
    CONFIG: CONFIG, MODES: MODES, dayKey: dayKey, dailySpec: dailySpec, start: start, plates: plates,
    makePlate: function () { return makePlate(); }, timeLimit: function (q) { return timeLimit(q); }, truthOf: truthOf, isPrime: isPrime,
    factorText: factorText, primeHint: primeHint, rankTitle: function () { return rankTitle(); }, clamp: clamp
  };
})();

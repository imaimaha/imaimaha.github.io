/* おかず詰めパズル — ブラウザ版「今日のおべんとう」（/play/okazu/）
 * 問題づくり・ルールはアプリと同じ logic.js（OB）、おかずの絵は draw.js（DR）。
 * あそぶ画面（並べ方・さわり方・絵）はアプリの game.js からそのまま写したもの。
 * サーバーとは通信しない（ランキングなし）。今日の記録だけ、この端末に保存（web.okazu.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay;
  var $ = function (id) { return document.getElementById(id); };
  var FOODS = OB.FOODS;
  var DAY = OB.dayKey();
  WP.init({ ns: 'okazu', day: DAY, name: '今日のおべんとう', tag: '今日のおべんとう', emoji: '🍱', url: 'https://imaimaha.github.io/play/okazu/',
    appId: '6823270044', appLabel: 'アプリなら 200ステージとランキングで勝負', landing: '../../okazu/', landingName: 'おかず詰めパズル',
    today: function () { return OB.dayKey(); } });

  // アプリにあって、ブラウザ版にはないもの（統計・広告・ふるえ・とちゅうの保存・一時停止）
  var save = { get mute() { return WP.muted(); } };
  function pstat() { /* 統計は送らない */ }
  function pkey() { return null; }
  function haptic() { /* なし */ }
  function tellScreen() { /* なし */ }
  function paintMute() { /* 音のボタンは WebPlay */ }
  function saveCur() { /* とちゅうは保存しない */ }
  var Reward = { hasAds: function () { return false; }, request: function () {} };
  var PauseKit = { isOpen: function () { return false; } };
  var pkExtra = [];
  var screen = 'play';
  function show() { screen = 'play'; }
  function fmtT10(t10) { var sec = Math.floor(t10 / 10), m = Math.floor(sec / 60), ss = sec % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function fmtNum(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var G = null, raf = 0;
  var cv = $('cv'), cx = cv.getContext('2d');
  var FREE_UNDO = 3, VIDEO_UNDO = 3, FREE_HINT = 1;

  // ---------- 音（Web Audio でその場で作る） ----------
  var Snd = (function () {
    var ac = null, master = null, noise = null;
    function init() {
      if (ac) { if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* */ } } return true; }
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      try {
        ac = new AC(); root.__gameAudioCtx = ac;
        master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return false; }
      return true;
    }
    function tone(f, dur, type, vol, delay, f2) {
      if (save.mute || !init()) return;
      try {
        var t = ac.currentTime + (delay || 0), g = ac.createGain(), o = ac.createOscillator();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* 音が出なくても遊べる */ }
    }
    function crunch(delay, vol) {
      if (save.mute || !init()) return;
      try {
        var t = ac.currentTime + (delay || 0), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
        g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 0.14);
      } catch (e) { /* */ }
    }
    var api = {
      init: init,
      pick: function () { tone(520, 0.08, 'sine', 0.12, 0, 760); },
      rot: function () { tone(980, 0.04, 'triangle', 0.08); },
      place: function () { tone(240, 0.09, 'triangle', 0.2, 0, 160); tone(700, 0.04, 'sine', 0.05, 0.01); },
      bad: function () { tone(180, 0.16, 'square', 0.05); },
      back: function () { tone(420, 0.09, 'sine', 0.08, 0, 300); },
      stash: function () { tone(640, 0.07, 'sine', 0.1); tone(860, 0.08, 'sine', 0.08, 0.05); },
      clear: function (n) {
        crunch(0, 0.28); crunch(0.09, 0.2);
        var base = [523, 659, 784, 1047, 1319];
        for (var i = 0; i < Math.min(5, 2 + n); i++) tone(base[i], 0.16, 'triangle', 0.13, 0.08 + i * 0.07);
      },
      thaw: function () { tone(1400, 0.1, 'sine', 0.06); tone(1900, 0.12, 'sine', 0.05, 0.06); },
      win: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone(f, i === 6 ? 0.5 : 0.18, 'triangle', 0.14, i * 0.1); }); },
      fail: function () { tone(392, 0.2, 'triangle', 0.12); tone(330, 0.3, 'triangle', 0.12, 0.18); },
      tap: function () { tone(660, 0.06, 'sine', 0.08); }
    };
    return api;
  })();

  function onTap(el, fn) {
    var last = 0;
    function go(ev) { ev.preventDefault(); var n = Date.now(); if (n - last < 350) return; last = n; Snd.init(); fn(ev); }
    el.addEventListener('touchend', go, { passive: false }); el.addEventListener('click', go);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) { if (/^(p|li|div|b)$/.test(tag)) phr(e, String(text)); else e.textContent = text; } return e; }
  // 日本語の文を、読点・句点・空白のところでだけ折り返す（1文字だけ次の行に落ちないように）
  function phr(e, text) {
    e.textContent = '';
    if (text.length < 10 || !/[ 　、。！？）（」\n]/.test(text)) { e.textContent = text; return e; }
    var parts = [], cur = '', depth = 0;   // （ ）「 」の中では切らない
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '\n') { if (cur) parts.push(cur); parts.push(c); cur = ''; continue; }
      if ('（「『'.indexOf(c) >= 0) { if (cur && !depth && c !== '『') { parts.push(cur); cur = ''; } depth++; cur += c; continue; }
      if ('）」』'.indexOf(c) >= 0) { depth = Math.max(0, depth - 1); cur += c; if (!depth) { parts.push(cur); cur = ''; } continue; }
      if (depth) { cur += c; continue; }
      if (c === ' ' || c === '　') { if (cur.length > 2) { parts.push(cur); parts.push(c); cur = ''; } else cur += c; continue; }
      cur += c;
      if ('、。'.indexOf(c) >= 0 || ('！？'.indexOf(c) >= 0 && (i + 1 >= text.length || ' 　「（'.indexOf(text[i + 1]) >= 0))) { parts.push(cur); cur = ''; }
    }
    if (cur) parts.push(cur);
    // 句読点だけ・閉じかっこだけのかたまりは前にくっつける
    for (var k = parts.length - 1; k > 0; k--) if (/^[、。！？）」』]+$/.test(parts[k]) && parts[k - 1].length > 1) { parts[k - 1] += parts[k]; parts.splice(k, 1); }
    parts.forEach(function (t) {
      if (t === ' ' || t === '　') { e.appendChild(document.createTextNode(t)); return; }
      if (t === '\n') { e.appendChild(document.createElement('br')); return; }
      if (t.length > 15) { e.appendChild(document.createTextNode(t)); return; }   // 長いかたまりは ふつうに折り返す
      var sp = document.createElement('span'); sp.className = 'ph'; sp.textContent = t; e.appendChild(sp);
    });
    return e;
  }
  // ---------- かさねる画面 ----------
  var ovOpen = false;
  function overlay(build) {
    var ov = $('ov'); ov.innerHTML = ''; ov.className = '';
    var box = el('div', 'box'); build(box); ov.appendChild(box); ov.hidden = false; ovOpen = true;
    clockStop();
    return box;
  }
  function closeOverlay() { $('ov').className = ''; $('ov').hidden = true; $('ov').innerHTML = ''; ovOpen = false; clockGo(); }
  // 同じ中身の画面を出しなおす（ふりかえりから もどるとき。ランキングに送りなおさない）
  function overlayKids() { var b = $('ov').firstChild; return b ? Array.prototype.slice.call(b.children) : []; }
  function reopen(kids) { overlay(function (box) { kids.forEach(function (k) { box.appendChild(k); }); }); }

  // ---------- 時計（1.0.4 から。かさねる画面・一時停止・タイトルにいるあいだは止まる） ----------
  function clockMs() { return !G ? 0 : G.ms + (G.run ? performance.now() - G.run : 0); }
  function clockStop() { if (G && G.run) { G.ms += performance.now() - G.run; G.run = 0; } }
  function clockGo() { if (G && !G.run && !G.over && screen === 'play' && !ovOpen && !(root.PauseKit && PauseKit.isOpen())) G.run = performance.now(); }
  function btn(box, label, main, fn, sub) {
    var b = el('button', 'btn' + (main ? ' main' : '')); b.type = 'button'; b.innerHTML = label + (sub ? '<small>' + sub + '</small>' : '');
    onTap(b, fn); box.appendChild(b); return b;
  }
  ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove'].forEach(function (t) { $('ov').addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });

  function begin(st, o) {
    closeOverlay();
    var ctx = OB.makeCtx(st), N = st.size, vis = [], s = OB.initState(ctx);
    for (var b = 0; b < N * N; b++) {
      var ch = st.map && st.map.length ? st.map[Math.floor(b / N)][b % N] : '.';
      vis.push(ch === 'o' ? { t: 'rice' } : ch === '#' ? { t: 'balan' } : ch === 'i' ? { t: 'ice', k: 'karaage', pid: 'i' + b } : null);
    }
    G = {
      st: st, ctx: ctx, s: s, N: N, vis: vis, pid: 0, face: {}, rot: {}, hist: [], index: o.index, daily: !!o.daily,
      undoFree: FREE_UNDO, undoUsed: 0, hintFree: FREE_HINT, rewarded: false, over: false,
      score: 0, streak: 0, drag: null, hint: null, placeAnim: null, rotAnim: null, clearAnim: null, back: null,
      parts: [], floats: [], winT: 0, moved: 0, t0: performance.now(), shake: null, lastLines: [],
      ms: 0, run: 0, moves: [], restarts: 0, peek: false, hints: 0
    };
    pkExtra.length = 0;
    if (o.daily) pkExtra.push({ label: 'ここでおわる（記録する）', run: function () { if (G && G.daily && !G.over) { pstat('quit', pkey(), clockMs() / 1000); G.over = true; clockStop(); refreshUI(); dailyEnd(); } } });
    ctx.pieces.forEach(function (p, i) { G.rot[i] = p.r0; });
    // 時計は止めたまま始める（あそぶ前の説明の「はじめる」か、説明を出さないときは startStage / startDaily で動かす。1.0.6 ビルド 8 から）
    // 答えの手順の とちゅうの盤（ヒントで「答えどおりに来ているか」を見る）
    if (st.sol) {
      G.solKeys = []; var ss = s;
      st.sol.forEach(function (mv) {
        G.solKeys.push(OB.key(ss));
        if (mv[0] === 2) { ss = OB.stash(ss); return; }
        var pp = ctx.pieces[mv[0] === 1 ? ss.hold : ss.idx], pl = OB.placeAt(ctx, pp.k, mv[1], mv[2], mv[3]);
        ss = OB.apply(ctx, ss, mv[0], pl).s;
      });
    }
    // ステージ1 は「はこぶ」だけおぼえる: 答えの向きで出す（回すのは つぎから）
    if (o.index === 0 && st.sol) { var qi = 0; st.sol.forEach(function (mv) { if (mv[0] === 0) G.rot[qi++] = mv[1]; }); }
    // 小さい画面（SE）でも切れないように短く（2026-11-18）: 今日は「今日のおべんとう」、過去の問題は「11/17 のおべんとう」
    $('pl-title').textContent = G.daily ? (st.day !== OB.dayKey() ? +st.day.slice(5, 7) + '/' + +st.day.slice(8, 10) + ' のおべんとう' : G.ny ? 'お正月のおべんとう' : '今日のおべんとう') : st.id + '. ' + st.name;
    show('play');
    tellScreen('play');
    paintMute();
    layout();
    refreshUI();
    startLoop();
  }

  // ---------- 目標・ボタンの表示 ----------
  function goalText(g) {
    var s = G.s, ctx = G.ctx;
    switch (g.t) {
      case 'lines': return { ic: '🥢', tx: '列を消す ' + Math.min(s.lines, g.n) + '/' + g.n };
      case 'rice': return { ic: '🍚', tx: 'ごはん のこり ' + (OB.popc(s.rL) + OB.popc(s.rH)) };
      case 'ice': return { ic: '🧊', tx: 'こおり のこり ' + (OB.popc(s.aL) + OB.popc(s.aH)) };
      case 'food': return { ic: '', food: g.k, tx: FOODS[g.k].name + ' ' + Math.min(s.eaten, g.n) + '/' + g.n + 'マス' };
      case 'fill': var tot = 0, f = 0; for (var b = 0; b < G.N * G.N; b++) { if (G.vis[b] && G.vis[b].t === 'balan') continue; tot++; if (OB.has(s.fL, s.fH, b)) f++; } return { ic: '📦', tx: 'すきまなく ' + f + '/' + tot };
    }
    return { ic: '', tx: '' };
  }
  function refreshUI() {
    if (!G) return;
    var box = $('goals'); box.innerHTML = '';
    if (G.daily) {
      var d = el('div', 'goal'); d.innerHTML = '🍱 のこり <b>' + OB.left(G.ctx, G.s) + '</b>こ'; box.appendChild(d);
      var d2 = el('div', 'goal'); d2.innerHTML = '↺ やりなおし <b>' + G.restarts + '</b>回'; box.appendChild(d2);
      G.timeEl = el('div', 'goal'); G.timeEl.textContent = '⏱ ' + fmtT10(clockMs() / 100); box.appendChild(G.timeEl);
      if (G.past) box.appendChild(el('div', 'goal', 'ランキングなし'));
      else if (G.again) box.appendChild(el('div', 'goal', 'れんしゅう（ランキングには入りません）'));
    } else {
      G.ctx.goals.forEach(function (g) {
        var t = goalText(g), p = OB.goalProgress(G.ctx, G.s, g), c = el('div', 'goal' + (p >= 1 ? ' done' : ''));
        if (t.food) { var mini = el('canvas'); mini.width = 44; mini.height = 44; mini.style.width = '22px'; mini.style.height = '22px'; drawMini(mini, t.food); c.appendChild(mini); }
        else c.appendChild(el('span', null, t.ic));
        c.appendChild(el('span', null, t.tx));
        var bar = el('span', 'bar'), i = el('i'); i.style.width = Math.round(p * 100) + '%'; bar.appendChild(i); c.appendChild(bar);
        box.appendChild(c);
      });
      // タイムと ★3 のめやす（1つにまとめて、目標の行がふえないように）
      var tc = el('div', 'goal star'); G.timeEl = el('span', null, '⏱ ' + fmtT10(clockMs() / 100)); tc.appendChild(G.timeEl);
      tc.appendChild(el('span', null, '★3: ' + fmtT10(OB.starTimes(G.st)[0] * 10) + ' まで' + (G.hints ? '（ヒント +' + G.hints * OB.HINT_SEC + '秒）' : '')));
      box.appendChild(tc);
    }
    // ボタン
    var p = curPiece(0);
    $('btn-rot').disabled = !p || G.over || p.fix;
    $('btn-rot').innerHTML = p && p.fix ? '🔒 まわせない' : '↻ まわす';
    var undo = $('btn-undo'), hint = $('btn-hint');
    if (G.daily) {
      undo.innerHTML = '<span class="nw">↺ さいしょから</span><small>やりなおし +1</small>'; undo.disabled = G.over || !G.moves.length;
      if (G.hintOK) {   // はじめの7日間（1.0.8 から）: ステージと同じ（無料のぶん・そのあとは動画）。1回 +30秒
        hint.classList.remove('hidden'); hint.disabled = G.over;
        var ads2 = Reward.hasAds();
        hint.innerHTML = G.hintFree > 0 || !ads2 ? '💡 ヒント<small>+' + OB.HINT_SEC + '秒</small>' : '▶ ヒント<small>動画で見る</small>';
      } else hint.classList.add('hidden');
    } else {
      hint.classList.remove('hidden');
      var ads = Reward.hasAds();
      undo.disabled = G.over || !G.hist.length;
      undo.innerHTML = G.undoFree > 0 || !ads ? '↩︎ もどす<small>' + (ads ? 'のこり' + G.undoFree + '回' : '　') + '</small>' : '▶ もどす<small>動画で +' + VIDEO_UNDO + '回</small>';
      hint.disabled = G.over;
      hint.innerHTML = G.hintFree > 0 || !ads ? '💡 ヒント<small>' + (ads ? 'あと' + G.hintFree + '回' : '　') + '</small>' : '▶ ヒント<small>動画で見る</small>';
    }
  }
  function drawMini(canvas, k) {
    DR.skin = null;
    var c = canvas.getContext('2d'), sh = FOODS[k].cells, d = DR.dims(sh), s = 40 / Math.max(d[0], d[1], 2);
    DR.food(c, k, sh, (44 - d[1] * s) / 2, (44 - d[0] * s) / 2, s, { face: null });
  }

  // ---------- おかず ----------
  // src 0 = 順番のいま、1 = 小皿
  function curPiece(src) {
    if (!G) return null;
    var pi = src === 1 ? G.s.hold : G.s.idx;
    if (pi < 0 || pi >= G.ctx.pieces.length) return null;
    return G.ctx.pieces[pi];
  }
  function pieceIndex(src) { return src === 1 ? G.s.hold : G.s.idx; }
  function shapeOf(src) { var p = curPiece(src); if (!p) return null; return FOODS[p.k].rots[G.rot[pieceIndex(src)] % FOODS[p.k].rots.length]; }

  // ---------- 大きさ ----------
  var L = {};
  function layout() {
    if (!G) return;
    var r = $('board').getBoundingClientRect(), dpr = root.devicePixelRatio || 1, W = r.width, H = r.height, N = G.N;
    var NH = 44, gap1 = 30, gap2 = 8;
    var cell = Math.min((W - 40) / N, 62), PH = 0;
    for (var it = 0; it < 3; it++) {
      PH = Math.max(84, Math.min(136, cell * 2.3));
      var bw = Math.max(8, cell * 0.26);
      var avail = H - (bw * 2 + 10) - gap1 - PH - gap2 - NH - 6;
      cell = Math.min(cell, avail / N);
    }
    cell = Math.floor(cell);
    var bw2 = Math.max(8, cell * 0.26);
    L = { W: W, H: H, s: cell, N: N, gx: Math.round((W - cell * N) / 2), gy: Math.round(bw2 + 6) };
    L.py = L.gy + cell * N + bw2 + gap1;
    L.ph = PH;
    if (G.ctx.hold) {
      var pw = Math.min(W - 24, 360);
      var x0 = (W - pw) / 2;
      L.cur = { x: x0, y: L.py, w: pw * 0.62 - 5, h: PH };
      L.hold = { x: x0 + pw * 0.62 + 5, y: L.py, w: pw * 0.38 - 5, h: PH };
    } else {
      var w = Math.min(W - 24, 280);
      L.cur = { x: (W - w) / 2, y: L.py, w: w, h: PH };
      L.hold = null;
    }
    L.ny = L.py + PH + gap2; L.nh = NH;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  root.addEventListener('resize', function () { if (screen === 'play') layout(); if (screen === 'title') paintTitle(); });

  // お皿の中で、おかずをかく位置と大きさ
  function trayGeom(src) {
    var sh = shapeOf(src), box = src === 1 ? L.hold : L.cur;
    if (!sh || !box) return null;
    var d = DR.dims(sh), s = Math.min(L.s * 0.9, (box.w - 28) / Math.max(d[1], 1), (box.h - 34) / Math.max(d[0], 1));
    var cxm = box.x + box.w / 2, cym = box.y + 14 + (box.h - 14) / 2;
    return { s: s, x: cxm - d[1] * s / 2, y: cym - d[0] * s / 2, w: d[1] * s, h: d[0] * s, cx: cxm, cy: cym, sh: sh };
  }
  function inBox(b, x, y, pad) { pad = pad || 0; return b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad; }

  // ---------- さわる ----------
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  // 長押しで文字の範囲選択・メニュー・虫めがねが出ないように（1.0.6 から。名前の入力欄はそのまま）
  function editable(t) { return !!(t && t.closest && t.closest('input,textarea,[contenteditable="true"]')); }
  document.addEventListener('selectstart', function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('contextmenu', function (e) { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('selectionchange', function () {
    if (editable(document.activeElement)) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) sel.removeAllRanges();
  });
  cv.addEventListener('touchstart', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });   // 盤の上の長押し・ダブルタップ
  cv.addEventListener('pointerdown', function (e) {
    if (!G || G.over || ovOpen || PauseKit.isOpen()) return;
    Snd.init();
    var p = pos(e), src = -1;
    if (inBox(L.cur, p[0], p[1], 8) && curPiece(0)) src = 0;
    else if (L.hold && inBox(L.hold, p[0], p[1], 8) && curPiece(1)) src = 1;
    if (src < 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    G.drag = { src: src, x: p[0], y: p[1], sx: p[0], sy: p[1], moved: false, t: performance.now(), id: e.pointerId };
    G.back = null;
  });
  cv.addEventListener('pointermove', function (e) {
    if (!G || !G.drag || e.pointerId !== G.drag.id) return;
    e.preventDefault();
    var p = pos(e), d = G.drag;
    d.x = p[0]; d.y = p[1];
    if (!d.moved && Math.abs(p[0] - d.sx) + Math.abs(p[1] - d.sy) > 9) { d.moved = true; Snd.pick(); haptic('select'); G.hint = G.hint && G.hint.keep ? G.hint : null; }
    if (d.moved) {
      var t = target();
      var k = t && t.ok ? t.r + ',' + t.c : '';
      if (k && k !== d.lastSnap) haptic('select');
      d.lastSnap = k;
    }
  });
  function endDrag(e, cancel) {
    if (!G || !G.drag || (e && e.pointerId !== G.drag.id)) return;
    var d = G.drag, t = d.moved && !cancel ? target() : null;
    G.drag = null;
    if (!d.moved) { if (!cancel && performance.now() - d.t < 500) rotate(d.src); return; }
    if (t && t.ok) { place(d.src, t.rot, t.r, t.c); return; }
    if (t && t.stash) { doStash(); return; }
    // もとのお皿へもどる
    var tg = trayGeom(d.src);
    if (tg) G.back = { src: d.src, fx: t ? t.px : d.x, fy: t ? t.py : d.y, s0: L.s, t0: performance.now() };
    Snd.back();
  }
  cv.addEventListener('pointerup', function (e) { endDrag(e, false); });
  cv.addEventListener('pointercancel', function (e) { endDrag(e, true); });

  // 指の位置 → どこに置くか（近くの置ける場所にすいつく）
  function target() {
    var d = G.drag, sh = shapeOf(d.src); if (!sh) return null;
    var dm = DR.dims(sh), s = L.s, lift = liftPx();
    var px = d.x - dm[1] * s / 2, py = d.y - dm[0] * s - lift;
    var fr = (py - L.gy) / s, fc = (px - L.gx) / s;
    var p = curPiece(d.src), pi = pieceIndex(d.src), rot = G.rot[pi] % FOODS[p.k].rots.length;
    var res = { px: px, py: py, rot: rot, k: p.k, sh: sh, fr: fr, fc: fc };
    // 小皿の上ではなした（お皿の上のほう 3割は、お弁当箱のいちばん下の列に置くときの指の場所なので、のぞく）
    if (d.src === 0 && L.hold && !curPiece(1) && G.s.idx + 1 < G.ctx.pieces.length &&
        inBox(L.hold, d.x, d.y, 10) && d.y > L.hold.y + L.hold.h * 0.3) { res.stash = true; res.ok = false; return res; }
    var best = null, bd = 0.9 * 0.9;
    for (var r = Math.floor(fr) - 1; r <= Math.ceil(fr) + 1; r++) for (var c = Math.floor(fc) - 1; c <= Math.ceil(fc) + 1; c++) {
      var dd = (r - fr) * (r - fr) + (c - fc) * (c - fc);
      if (dd > bd) continue;
      var pl = OB.placeAt(G.ctx, p.k, rot, r, c);
      if (pl && OB.fits(G.s, pl)) { bd = dd; best = { r: r, c: c, pl: pl }; }
    }
    if (best) { res.ok = true; res.r = best.r; res.c = best.c; res.pl = best.pl; res.pre = OB.apply(G.ctx, G.s, d.src, best.pl); return res; }
    res.ok = false; res.r = Math.round(fr); res.c = Math.round(fc);
    return res;
  }

  // 指より どれだけ上に おかずを出すか（指でかくれないように）
  function liftPx() { return Math.max(L.s * 1.25, 54); }

  function rotate(src) {
    if (!G || G.over) return;
    var p = curPiece(src); if (!p) return;
    var pi = pieceIndex(src);
    if (p.fix) {
      G.shake = { src: src, t0: performance.now() }; Snd.bad(); haptic('ng');
      toast('🔒 このおかずは 回せない'); return;
    }
    var n = FOODS[p.k].rots.length;
    if (n <= 1) { G.rotAnim = { src: src, t0: performance.now(), spin: true }; Snd.rot(); return; }
    G.rot[pi] = (G.rot[pi] + 1) % n;
    G.rotAnim = { src: src, t0: performance.now() };
    Snd.rot(); haptic('select');
    if (G.hint && !G.hint.keep) G.hint = null;
  }
  onTap($('btn-rot'), function () { rotate(0); refreshUI(); });

  function snapshot() {
    return { s: OB.copy(G.s), vis: G.vis.slice(), face: Object.assign({}, G.face), rot: Object.assign({}, G.rot), score: G.score, streak: G.streak };
  }
  // 盤の見た目（vis）に、おかずを置いた結果をのせる（ふりかえりでも同じものを使う）。消えたマスと、とけた数を返す
  function visApply(vis, N, res, pl, k, pid, face) {
    pl.cells.forEach(function (b) { vis[b] = { t: 'food', k: k, pid: pid }; });
    if (face) face[pid] = pl.cells[Math.min(FOODS[k].face, pl.cells.length - 1)];
    var gone = [], thawed = 0;
    if (res.n) for (var b = 0; b < N * N; b++) {
      if (OB.has(res.eatL, res.eatH, b)) { gone.push({ b: b, v: vis[b] }); vis[b] = null; }
      else if (OB.has(res.thawL, res.thawH, b)) { vis[b] = { t: 'food', k: 'karaage', pid: 't' + b + '_' + pid }; thawed++; }
    }
    return { gone: gone, thawed: thawed };
  }
  // 置くだけ（音・動きなし）。置けたら OB.apply の結果
  function placeCore(src, rot, r, c) {
    var p = curPiece(src), pl = OB.placeAt(G.ctx, p.k, rot, r, c);
    if (!pl || !OB.fits(G.s, pl)) return null;
    G.hist.push(snapshot());
    G.moves.push([src, rot, r, c]);
    var res = OB.apply(G.ctx, G.s, src, pl), pid = ++G.pid;
    res.vis = visApply(G.vis, G.N, res, pl, p.k, pid, G.face);
    res.pid = pid;
    G.s = res.s; G.moved++;
    return res;
  }
  function place(src, rot, r, c) {
    var res = placeCore(src, rot, r, c);
    if (!res) return false;
    var pid = res.pid, N = G.N;
    G.placeAnim = { pid: pid, t0: performance.now() };
    G.hint = null;
    if (res.n) {
      var gone = res.vis.gone, thawed = res.vis.thawed;
      G.clearAnim = { gone: gone, lines: res.lines, t0: performance.now() };
      G.streak++;
      spawnClear(gone, res);
      Snd.clear(res.n); if (thawed) Snd.thaw();
      haptic(res.n >= 2 ? 'heavy' : 'ok');
      if (G.daily) {
        var pts = OB.scoreFor(res, G.streak, OB.isEmpty(G.ctx, G.s));
        G.score += pts;
        floatText('+' + fmtNum(pts), L.gx + L.s * N / 2, L.gy + L.s * N / 2 + 34, '#b9412f', 22);
        if (OB.isEmpty(G.ctx, G.s)) floatText('からっぽ +1000！', L.gx + L.s * N / 2, L.gy + L.s * N / 2 + 70, '#2f7a2f', 20);
      }
    } else {
      G.streak = 0;
      Snd.place(); haptic('light');
    }
    refreshUI();
    checkEnd();
    saveCur();
    return true;
  }
  function doStash() {
    G.hist.push(snapshot());
    G.moves.push([2]);
    G.s = OB.stash(G.s);
    G.hint = null;
    Snd.stash(); haptic('light');
    refreshUI();
    checkEnd();
    saveCur();
  }
  // 少しあとで（そのあいだに別のステージへ行っていたら、なにもしない）
  function later(f, ms) { var g0 = G; setTimeout(function () { if (G === g0 && screen === 'play') f(); }, ms); }
  function checkEnd() {
    if (G.daily) {
      if (OB.goalDone(G.ctx, G.s)) { G.over = true; clockStop(); pstat('clear', pkey(), clockMs() / 1000); G.winT = performance.now() + 380; refreshUI(); later(dailyEnd, 1350); Snd.win(); haptic('goal'); return; }
      if (OB.stuck(G.ctx, G.s)) { G.over = true; clockStop(); pstat('fail', pkey()); refreshUI(); later(dailyStuck, 400); }
      return;
    }
    if (OB.goalDone(G.ctx, G.s)) { G.over = true; clockStop(); pstat('clear', pkey(), clockMs() / 1000); G.winT = performance.now() + 380; refreshUI(); later(stageClear, 1350); Snd.win(); haptic('goal'); return; }
    if (OB.stuck(G.ctx, G.s)) {
      G.over = true; clockStop(); pstat('fail', pkey()); refreshUI();
      var why = G.s.idx >= G.ctx.pieces.length && G.s.hold < 0 ? 'おかずが なくなっちゃった…' : '「' + DR.nameOf(curPiece(0) ? curPiece(0).k : curPiece(1).k) + '」の入るすきまが ない…';
      later(function () { stageFail(why); }, 400);   // 行き止まりは すぐ知らせる（1.0.6 ビルド 8 から 0.65秒 → 0.4秒）
    }
  }

  // ---------- もどす・ヒント ----------
  // after = もどしたあとにすること（行き止まりの「ヒント」）
  function undo(fromFail, after) {
    if (!G || !G.hist.length) return;
    if (G.undoFree <= 0 && Reward.hasAds()) {
      Reward.request('undo', function (res) {
        if (res === 'granted') { G.rewarded = true; G.undoFree += VIDEO_UNDO; undo(fromFail, after); }
        else toast(res === 'unavailable' ? '動画を よみこめなかった。少したってから ためしてね' : '動画を さいごまで見ると もどせるよ');
      });
      return;
    }
    if (Reward.hasAds()) G.undoFree--;
    var h = G.hist.pop();
    G.moves.pop();
    pstat('retry', pkey());
    G.s = h.s; G.vis = h.vis; G.face = h.face; G.rot = h.rot; G.score = h.score; G.streak = h.streak;
    G.undoUsed++; G.over = false; G.clearAnim = null; G.hint = null; G.winT = 0;
    if (fromFail) closeOverlay();
    clockGo();
    tellScreen('play');
    Snd.back(); haptic('light');
    refreshUI();
    if (after) after();
  }
  onTap($('btn-undo'), function () {
    if (!G) return;
    if (G.daily) { if (!G.over && G.moves.length) confirmRestartDaily(); return; }
    undo(false);
  });
  function hint() {
    if (!G || G.over) return;
    if (G.daily && !G.hintOK) return;   // 今日のおべんとうのヒントは、はじめの7日間の1回目だけ
    if (G.hintFree <= 0 && Reward.hasAds()) {
      Reward.request('hint', function (res) {
        if (res === 'granted') { G.rewarded = true; G.hintFree++; hint(); }
        else toast(res === 'unavailable' ? '動画を よみこめなかった。少したってから ためしてね' : '動画を さいごまで見ると ヒントが出るよ');
      });
      return;
    }
    toast('かんがえ中…');
    setTimeout(function () {
      if (!G) return;
      var sol = null, k = OB.key(G.s);
      // 答えの手順どおりに来ているなら、その つぎの手（いちばん たしか）
      if (G.solKeys) for (var j = 0; j < G.solKeys.length; j++) if (G.solKeys[j] === k) { sol = { path: G.st.sol.slice(j) }; break; }
      if (!sol) sol = OB.solve(G.ctx, G.s, { cap: 2500, ms: 3000 });
      if (!sol || !sol.path.length) { toast('ここからの つめ方が 見つからなかった…\n「もどす」で 少し前から やりなおしてみよう'); return; }
      if (Reward.hasAds()) G.hintFree--;
      G.hints++; pstat('hint', pkey());   // ★のタイムに ヒント1回 +30秒（今日のおべんとうは記録のタイムに +30秒）
      if (G.daily) saveCur();
      var mv = sol.path[0];
      if (mv[0] === 2) { G.hint = { stash: true, t0: performance.now(), keep: true }; toast('いまのおかずは 小皿へ とっておこう'); }
      else {
        var pi = mv[0] === 1 ? G.s.hold : G.s.idx;
        if (!G.ctx.pieces[pi].fix) G.rot[pi] = mv[1];
        G.hint = { mv: mv, t0: performance.now(), keep: true };
        toast(mv[0] === 1 ? '小皿のおかずを ひかっている所へ' : 'ひかっている所へ つめよう');
      }
      refreshUI();
    }, 30);
  }
  onTap($('btn-hint'), hint);

  var toastT = 0;
  function toast(msg) {
    var t = $('toast'); phr(t, msg); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 1900);
  }

  function confirmRestartDaily() {
    overlay(function (box) {
      box.appendChild(el('h2', null, 'さいしょから やりなおす？'));
      box.appendChild(el('p', null, 'やりなおしの回数が 1回ふえます（タイムは そのまま）'));
      btn(box, 'やりなおす', true, function () { Snd.tap(); restartDaily(); });
      btn(box, 'つづける', false, function () { Snd.tap(); closeOverlay(); });
    });
  }
  function restartDaily() {
    if (!G || !G.daily) return;
    var keep = { restarts: G.restarts + 1, ms: clockMs(), hints: G.hints }, day = G.st.day;
    closeOverlay();
    startDaily(day, keep);
    saveCur();
  }
  // 入らなくなった: やりなおすか、ここでおわるか
  function dailyStuck() {
    if (!G || screen !== 'play' || !G.daily) return;
    Snd.fail(); haptic('ng');
    var left = OB.left(G.ctx, G.s);
    overlay(function (box) {
      box.classList.add('soft');
      box.appendChild(el('div', 'big', '🤔'));
      box.appendChild(el('h2', null, 'もう 入らない…'));
      box.appendChild(el('p', null, 'のこり ' + left + 'こ。さいしょから やりなおすと、やりなおしが 1回ふえます'));
      btn(box, '🔄 もう一回（さいしょから）', true, function () { Snd.tap(); restartDaily(); }, 'やりなおし +1回・タイムは そのまま');
      btn(box, 'ここでおわる（のこり ' + left + 'こ）', false, function () { Snd.tap(); closeOverlay(); dailyEnd(); });
      box.appendChild(el('p', 'note', G.hintOK ? '今日のおべんとうは 1手もどすは ありません（ヒントは、つまる前に使えます）' : (G.past ? '過去の問題も、' : '今日のおべんとうは ') + '1手もどす・ヒントは ありません'));
    });
    $('ov').classList.add('soft');
  }
  // =====================================================================
  // かく
  // =====================================================================
  function startLoop() { if (!raf) raf = requestAnimationFrame(frame); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function frame() {
    raf = 0; if (screen !== 'play' || !G) return;
    if (G.timeEl) G.timeEl.textContent = '⏱ ' + fmtT10(clockMs() / 100);
    draw(); raf = requestAnimationFrame(frame);
  }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }

  function spawnClear(gone, res) {
    var s = L.s;
    gone.forEach(function (g) {
      var x = L.gx + (g.b % G.N + 0.5) * s, y = L.gy + (Math.floor(g.b / G.N) + 0.5) * s;
      var col = g.v && g.v.t === 'rice' ? '#fffaf0' : g.v && g.v.k ? FOODS[g.v.k].color : '#fff';
      for (var i = 0; i < 4; i++) {
        var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
        G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.7 + Math.random() * 0.4, t: 0, col: col, r: s * (0.07 + Math.random() * 0.08), rice: g.v && g.v.t === 'rice' });
      }
    });
    var word = res.n >= 3 ? 'もぐもぐっ！' : res.n === 2 ? 'ぱくぱくっ！' : 'ぱくっ！';
    var ln = res.lines[0], mx = L.gx + L.s * G.N / 2, my = L.gy + L.s * G.N / 2;
    if (ln) { if (ln.kind === 'r') my = L.gy + (ln.i + 0.5) * s; else mx = L.gx + (ln.i + 0.5) * s; }
    floatText(word, mx, my, '#e8604c', res.n >= 2 ? 30 : 26);
  }
  function floatText(text, x, y, col, size) { G.floats.push({ text: text, x: x, y: y, col: col, size: size, t0: performance.now() }); }

  // 盤のおかずを pid ごとにまとめる
  function groups() {
    var N = G.N, gs = {}, rice = [], balans = [], order = [];
    for (var b = 0; b < N * N; b++) {
      var v = G.vis[b]; if (!v) continue;
      var rc = [Math.floor(b / N), b % N];
      if (v.t === 'rice') rice.push(rc);
      else if (v.t === 'balan') balans.push(rc);
      else { if (!gs[v.pid]) { gs[v.pid] = { k: v.k, ice: v.t === 'ice', cells: [], bs: [], pid: v.pid }; order.push(v.pid); } gs[v.pid].cells.push(rc); gs[v.pid].bs.push(b); }
    }
    return { gs: gs, order: order, rice: rice, balans: balans };
  }

  // 確認用: window.__bentoFreeze に時刻を入れると、その時刻で絵を止める（画面撮影で、動きのとちゅうを写す）
  function clock() { return root.__bentoFreeze != null ? root.__bentoFreeze : performance.now(); }
  function draw() {
    var now = clock(), c = cx, s = L.s, N = G.N, t = (now - G.t0) / 1000;
    c.clearRect(0, 0, L.W, L.H);
    DR.skin = G.ny ? 'osechi' : null;   // お正月の今日のおべんとう
    // ゆれ（小皿の「回せない」）
    DR.box(c, L.gx, L.gy, s, N);
    var gr = groups();
    gr.balans.forEach(function (p) { DR.balan(c, L.gx + p[1] * s, L.gy + p[0] * s, s); });
    if (gr.rice.length) DR.rice(c, gr.rice, L.gx, L.gy, s);

    // ドラッグ中の置き場所
    var tg = G.drag && G.drag.moved ? target() : null;
    var willEat = {};
    if (tg && tg.ok && tg.pre && tg.pre.n) {
      for (var b = 0; b < N * N; b++) if (OB.has(tg.pre.clearL, tg.pre.clearH, b)) willEat[b] = 1;
    }
    // 消える列を光らせる（おかずの上から）
    function glowLines() {
      if (!(tg && tg.ok && tg.pre && tg.pre.n)) return;
      c.save();
      tg.pre.lines.forEach(function (ln) {
        if (ln.kind === 'r') DR.rr(c, L.gx + 1, L.gy + ln.i * s + 1, s * N - 2, s - 2, s * 0.22);
        else DR.rr(c, L.gx + ln.i * s + 1, L.gy + 1, s - 2, s * N - 2, s * 0.22);
        c.fillStyle = 'rgba(255,225,100,' + (0.26 + 0.1 * Math.sin(now / 90)) + ')'; c.fill();
        c.strokeStyle = 'rgba(255,190,40,.95)'; c.lineWidth = 3; c.stroke();
      });
      c.restore();
    }
    // 置いたおかず
    var winning = G.winT && now > G.winT;
    gr.order.forEach(function (pid) {
      var g = gr.gs[pid], fb = G.face[pid], fc = null;
      if (fb != null && g.bs.indexOf(fb) >= 0) fc = [Math.floor(fb / N), fb % N];
      else if (!g.ice) fc = g.cells[0];
      var mood = 'smile';
      if (g.bs.some(function (b) { return willEat[b]; })) mood = 'happy';
      if (winning) mood = 'happy';
      if (G.over && !G.daily && !winning && !OB.goalDone(G.ctx, G.s)) mood = 'sad';
      var pa = G.placeAnim && G.placeAnim.pid === pid ? (now - G.placeAnim.t0) / 220 : 1;
      c.save();
      if (pa < 1) {
        var sc = 1 + 0.14 * Math.sin(Math.PI * pa) * (1 - pa);
        var mx = 0, my = 0; g.cells.forEach(function (p) { mx += p[1]; my += p[0]; }); mx = L.gx + (mx / g.cells.length + 0.5) * s; my = L.gy + (my / g.cells.length + 0.5) * s;
        c.translate(mx, my); c.scale(sc, sc); c.translate(-mx, -my);
      }
      if (winning) { var j = Math.sin(now / 110 + (typeof pid === 'number' ? pid : 3)) * 2; c.translate(0, j); }
      DR.food(c, g.k, g.cells, L.gx, L.gy, s, { face: g.ice ? 'cold' : mood, faceCell: fc, ice: g.ice, t: t });
      c.restore();
    });
    glowLines();
    // 消えるところ（ちぢんで、はしで つまむ）
    if (G.clearAnim) {
      var ca = (now - G.clearAnim.t0) / 420;
      if (ca >= 1) G.clearAnim = null;
      else {
        var sc2 = 1 - ease(ca);
        G.clearAnim.gone.forEach(function (gg) {
          var x = L.gx + (gg.b % N) * s, y = L.gy + Math.floor(gg.b / N) * s, ss = s * sc2, ox = x + (s - ss) / 2, oy = y + (s - ss) / 2 - ca * s * 0.3;
          if (!gg.v) return;
          if (gg.v.t === 'rice') DR.rice(c, [[0, 0]], ox, oy, ss);
          else DR.food(c, gg.v.k, [[0, 0]], ox, oy, ss, { face: null, alpha: 1 - ca * 0.4 });
        });
        // おはし
        G.clearAnim.lines.forEach(function (ln) {
          var p0 = ease(ca * 1.4), x0, y0, x1, y1;
          if (ln.kind === 'r') { y0 = L.gy + (ln.i + 0.5) * s; x0 = L.gx - s + p0 * (s * N + s); x1 = x0 - s * 2.2; y1 = y0 - s * 0.9; }
          else { x0 = L.gx + (ln.i + 0.5) * s; y0 = L.gy - s + p0 * (s * N + s); y1 = y0 - s * 2.2; x1 = x0 + s * 0.9; }
          c.save(); c.globalAlpha = 1 - Math.max(0, ca - 0.7) / 0.3;
          c.strokeStyle = '#7a3e1c'; c.lineCap = 'round'; c.lineWidth = Math.max(3, s * 0.1);
          c.beginPath(); c.moveTo(x0, y0 - s * 0.1); c.lineTo(x1, y1 - s * 0.1); c.stroke();
          c.beginPath(); c.moveTo(x0 + s * 0.06, y0 + s * 0.12); c.lineTo(x1 + s * 0.25, y1 + s * 0.1); c.stroke();
          c.restore();
        });
      }
    }
    // ヒント（ぴかぴか）
    if (G.hint && G.hint.mv && !G.over) {
      var mv = G.hint.mv, hp = curPiece(mv[0]);
      if (hp) {
        var hs = FOODS[hp.k].rots[mv[1]], cells = hs.map(function (q) { return [q[0] + mv[2], q[1] + mv[3]]; });
        var al = 0.35 + 0.25 * Math.sin(now / 160);
        DR.food(c, hp.k, cells, L.gx, L.gy, s, { alpha: al, face: null });
        c.save(); c.strokeStyle = 'rgba(255,190,0,' + (0.6 + 0.4 * Math.sin(now / 160)) + ')'; c.lineWidth = 3; DR.blobPath(c, cells, L.gx, L.gy, s, 2); c.stroke(); c.restore();
      }
    }
    // ドラッグの かげ（置ける所）
    if (tg) {
      if (tg.ok) {
        var cells2 = tg.sh.map(function (q) { return [q[0] + tg.r, q[1] + tg.c]; });
        DR.food(c, tg.k, cells2, L.gx, L.gy, s, { alpha: 0.38, face: null });
      } else if (tg.r > -3 && tg.c > -3 && tg.r < N + 1 && tg.c < N + 1 && !tg.stash) {
        c.save(); c.strokeStyle = 'rgba(220,60,50,.65)'; c.lineWidth = 2.5; c.setLineDash([5, 4]);
        DR.blobPath(c, tg.sh.map(function (q) { return [q[0] + tg.r, q[1] + tg.c]; }).filter(function (p) { return p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N; }), L.gx, L.gy, s, 3);
        c.stroke(); c.restore();
      }
    }

    drawTray(now, t, tg);

    // ちらばる つぶ
    var dt = 1 / 60;
    G.parts = G.parts.filter(function (p) {
      if (root.__bentoFreeze == null) { p.t += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.t > p.life) return false;
      c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col;
      if (p.rice) { c.beginPath(); c.ellipse(p.x, p.y, p.r * 1.3, p.r * 0.7, p.t * 6, 0, 7); c.fill(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke(); }
      c.globalAlpha = 1; return true;
    });
    // うかぶ文字
    G.floats = G.floats.filter(function (f) {
      var a = (now - f.t0) / 900; if (a >= 1) return false;
      var sc = a < 0.15 ? 0.6 + a / 0.15 * 0.5 : 1.1 - Math.min(0.1, (a - 0.15));
      c.save(); c.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
      c.translate(f.x, f.y - a * 30); c.scale(sc, sc);
      c.font = '900 ' + f.size + 'px "Hiragino Maru Gothic ProN", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = '#fff'; c.strokeText(f.text, 0, 0); c.fillStyle = f.col; c.fillText(f.text, 0, 0);
      c.restore(); return true;
    });
    // いただきます！
    if (winning) {
      var wa = Math.min(1, (now - G.winT) / 350);
      c.save(); c.translate(L.gx + s * N / 2, L.gy + s * N / 2); c.scale(0.6 + 0.4 * ease(wa), 0.6 + 0.4 * ease(wa)); c.globalAlpha = wa;
      var wt = G.ny ? 'あけましておめでとう！' : 'いただきます！';   // お正月の今日のおべんとう
      c.font = '900 ' + Math.round(Math.min(44, s * N / (G.ny ? wt.length + 1.5 : 6.5))) + 'px "Hiragino Maru Gothic ProN", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 10; c.strokeStyle = '#fff'; c.strokeText(wt, 0, 0); c.fillStyle = G.ny ? '#c0262d' : '#e8604c'; c.fillText(wt, 0, 0);
      c.restore();
      if (!G.confetti) {
        G.confetti = true;
        for (var q = 0; q < 40; q++) {
          var ks = OB.KINDS[q % OB.KINDS.length];
          G.parts.push({ x: L.gx + Math.random() * s * N, y: L.gy - 10, vx: (Math.random() - 0.5) * 120, vy: Math.random() * -160, life: 1.4, t: 0, col: G.ny ? ['#d9b44a', '#c0262d', '#fff7f2'][q % 3] : FOODS[ks].color, r: s * 0.1 });
        }
      }
    } else G.confetti = false;
  }

  // 下のお皿（いまのおかず・小皿・つぎ）
  function drawTray(now, t, tg) {
    var c = cx, s = L.s, d = G.drag;
    var left = OB.left(G.ctx, G.s);
    DR.plate(c, L.cur.x, L.cur.y, L.cur.w, L.cur.h, 'つめる順番 ' + (G.s.idx < G.ctx.pieces.length ? '（のこり ' + left + 'こ）' : ''), true);
    if (L.hold) {
      var hl = G.hint && G.hint.stash ? 0.5 + 0.5 * Math.sin(now / 150) : 0;
      DR.plate(c, L.hold.x, L.hold.y, L.hold.w, L.hold.h, '小皿', false);
      if (hl || (d && d.moved && d.src === 0 && !curPiece(1))) {
        c.save(); c.strokeStyle = 'rgba(255,170,0,' + (hl || (tg && tg.stash ? 0.95 : 0.45)) + ')'; c.lineWidth = 4; DR.rr(c, L.hold.x + 2, L.hold.y + 2, L.hold.w - 4, L.hold.h - 4, 20); c.stroke(); c.restore();
      }
      if (!curPiece(1)) {
        c.fillStyle = 'rgba(138,106,85,.45)'; c.font = '700 12px "Hiragino Maru Gothic ProN", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ここに', L.hold.x + L.hold.w / 2, L.hold.y + L.hold.h / 2 + 2); c.fillText('とっておける', L.hold.x + L.hold.w / 2, L.hold.y + L.hold.h / 2 + 18);
      }
    }
    [0, 1].forEach(function (src) {
      var p = curPiece(src); if (!p) return;
      var g = trayGeom(src); if (!g) return;
      if (d && d.moved && d.src === src) return;   // 指で持っている
      var ox = g.x, oy = g.y, ss = g.s;
      // もとへもどる動き
      if (G.back && G.back.src === src) {
        var ba = (now - G.back.t0) / 200;
        if (ba >= 1) G.back = null;
        else { var e = ease(ba); ss = G.back.s0 + (g.s - G.back.s0) * e; ox = G.back.fx + (g.x - G.back.fx) * e; oy = G.back.fy + (g.y - G.back.fy) * e; }
      }
      c.save();
      if (G.rotAnim && G.rotAnim.src === src) {
        var ra = (now - G.rotAnim.t0) / 160;
        if (ra >= 1) G.rotAnim = null;
        else { c.translate(g.cx, g.cy); c.rotate(-(1 - ease(ra)) * Math.PI / 2); c.translate(-g.cx, -g.cy); }
      }
      if (G.shake && G.shake.src === src) {
        var sa = (now - G.shake.t0) / 300;
        if (sa >= 1) G.shake = null; else c.translate(Math.sin(sa * 30) * 6 * (1 - sa), 0);
      }
      // さわれる感じ（ゆらゆら）
      if (!G.over && src === 0) { var bob = Math.sin(now / 420) * 1.5; c.translate(0, bob); }
      DR.food(c, p.k, g.sh, ox, oy, ss, { shadow: true, lock: p.fix, face: G.over && !G.daily && !OB.goalDone(G.ctx, G.s) ? 'sad' : 'smile', t: t });
      c.restore();
    });
    // はじめのステージ: ゆびのお手本
    if (!G.daily && G.index === 0 && G.moved === 0 && !d && G.st.sol && G.st.sol.length) {
      var mv = G.st.sol[0], g0 = trayGeom(0);
      if (g0 && G.rot[G.s.idx] === mv[1]) {
        var ph = ((now - G.t0) / 1600) % 1, e2 = ease(Math.min(1, ph * 1.4));
        var dm = DR.dims(g0.sh), tx = L.gx + (mv[3] + dm[1] / 2) * s, ty = L.gy + (mv[2] + dm[0]) * s + liftPx();
        var hx = g0.cx + (tx - g0.cx) * e2, hy = g0.cy + (ty - g0.cy) * e2;
        var cells = FOODS[G.ctx.pieces[0].k].rots[mv[1]].map(function (q) { return [q[0] + mv[2], q[1] + mv[3]]; });
        DR.food(c, G.ctx.pieces[0].k, cells, L.gx, L.gy, s, { alpha: 0.25 + 0.15 * Math.sin(now / 200), face: null });
        c.save(); c.globalAlpha = ph > 0.85 ? (1 - ph) / 0.15 : 1; c.font = '38px system-ui'; c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText('👆', hx, hy); c.restore();
      }
    }
    // つぎ
    var ny = L.ny, pcs = G.ctx.pieces, start = G.s.idx + 1, x = 18;
    c.fillStyle = '#8a6a55'; c.font = '800 13px "Hiragino Maru Gothic ProN", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('つぎ', 14, ny + L.nh / 2);
    x = 52;
    var shown = 0;
    for (var i = start; i < pcs.length && x < L.W - 30; i++) {
      var pk = pcs[i], sh = FOODS[pk.k].rots[G.rot[i] % FOODS[pk.k].rots.length], dm2 = DR.dims(sh);
      var ms = Math.min(13, (L.nh - 8) / Math.max(dm2[0], 2));
      var w = dm2[1] * ms;
      if (x + w > L.W - 14) break;
      c.save(); c.globalAlpha = Math.max(0.35, 1 - shown * 0.15);
      DR.food(c, pk.k, sh, x, ny + (L.nh - dm2[0] * ms) / 2, ms, { face: null, lock: false });
      if (pk.fix) { c.font = '10px system-ui'; c.fillText('🔒', x - 3, ny + 6); }
      c.restore();
      x += w + 14; shown++;
    }
    if (start >= pcs.length) { c.fillStyle = 'rgba(138,106,85,.6)'; c.fillText('これで さいご', 52, ny + L.nh / 2); }

    // 持っているおかず（指の少し上）
    if (d && d.moved && tg) {
      var p = curPiece(d.src);
      c.save(); c.translate(0, 0);
      var lift = 1.04 + 0.02 * Math.sin(now / 100);
      var dm3 = DR.dims(tg.sh), cxp = tg.px + dm3[1] * s / 2, cyp = tg.py + dm3[0] * s / 2;
      c.translate(cxp, cyp); c.scale(lift, lift); c.translate(-cxp, -cyp);
      DR.food(c, p.k, tg.sh, tg.px, tg.py, s, { shadow: true, lock: p.fix, face: tg.ok && tg.pre && tg.pre.n ? 'happy' : 'wow', alpha: 0.95, t: t });
      c.restore();
    }
  }

  // =====================================================================
  // 今日のおべんとう（ブラウザ版）
  // =====================================================================
  var PZ = OB.dailyPuzzle(DAY);
  // ---------- お正月（毎年 12/29〜1/7 日本時間。../oshogatsu.js。見た目とことばだけ・問題はそのまま。アプリの 1.0.10 と同じ） ----------
  function shogatsuOn() { return !!(root.Shogatsu && Shogatsu.active()); }
  var NY = shogatsuOn();
  function shogatsuDeco() {
    document.body.classList.toggle('shogatsu', NY);
    if (!NY) return;
    Shogatsu.banner(document.querySelector('.wp-app'), document.querySelector('.wp-how'));
    var h = document.querySelector('.wp-head h1'); if (h && h.firstChild && h.firstChild.nodeType === 3) h.firstChild.nodeValue = '🎍 お正月のおべんとう';
  }
  shogatsuDeco();
  function startDaily(day, keep) {
    begin(PZ, { daily: true });
    G.past = false; G.again = !!WP.record(); G.track = false; G.hintOK = false;
    G.ny = NY;   // お正月の今日のおべんとう（絵とことばだけ。問題は同じ）
    G.restarts = keep ? keep.restarts : 0; G.ms = keep ? keep.ms : 0; G.hints = 0;
    if (keep) G.started = true;
    refreshUI();
    checkEnd();
    if (keep) clockGo();
  }
  // さいしょにさわったときから時計を動かす
  cv.addEventListener('pointerdown', function () { if (G && !G.over && !ovOpen && !WP.clearOpen()) { G.started = true; clockGo(); } }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) clockStop(); else if (G && G.started) clockGo(); });

  function dailyEnd() {
    if (!G || !G.daily) return;
    closeOverlay(); clockStop();
    var left = OB.left(G.ctx, G.s), sec = clockMs() / 1000, prev = WP.record();
    WP.saveRecord(sec, { left: left, restarts: G.restarts });
    if (!left) { Snd.win(); }
    result(true, { sec: sec, left: left, restarts: G.restarts }, prev);
  }
  function result(fresh, r, prev) {
    var gone = !r.left;
    var row = (gone ? WP.tierRow(r.sec, [60, 120, 180, 300], '🍙', '⬜', '🍱') : '🍱のこり' + r.left) + (r.restarts ? ' ↺' + r.restarts : '');
    var info = document.createElement('p'); info.textContent = 'のこり ' + r.left + 'こ・やりなおし ' + r.restarts + '回';
    var ex = [info];
    if (NY) { var ny = document.createElement('p'); ny.className = 'ok-ny'; ny.textContent = (gone ? 'ぴったり！ ' : '') + 'お正月のおべんとう（1/7 まで）。ことしも よろしくね'; ex.unshift(ny); }
    WP.showClear({ sec: r.sec, fresh: fresh, head: NY ? 'あけましておめでとう！' : gone ? 'ぴったり！ いただきます！' : 'ごちそうさま！', emoji: NY ? '🎍' : gone ? '🍱' : '🍙', row: row, extra: ex,
      note: prev ? '今日の記録（1回目）: のこり ' + prev.left + 'こ・' + WP.fmt(prev.sec) : null,
      again: function () { startDaily(DAY); } });
  }

  // 自動テスト用（答えは問題からいつでも計算できるので、出してもこまらない）
  root.__webPlay = {
    puzzle: function () { return PZ; }, ny: function () { return NY; }, skin: function () { return DR.skin; }, done: function () { return !!(G && G.over); },
    geom: function (src) { var g = trayGeom(src); var sh = shapeOf(src); return { tray: g && { cx: g.cx, cy: g.cy }, dims: sh && DR.dims(sh), L: { gx: L.gx, gy: L.gy, s: L.s, hold: L.hold }, lift: liftPx(), rot: G.rot[pieceIndex(src)] % FOODS[curPiece(src).k].rots.length, placed: G.s.placed, hold: G.s.hold }; }
  };

  startDaily(DAY);
  var rec = WP.record();
  if (rec) result(false, rec, null);
})(window);

/* すうじのへや — ブラウザ版「今日のへや割り」「今日の住人さがし」（/play/suji/）
 * 問題づくり・ルールはアプリと同じ logic.js（SJ）。盤の作り方・さわり方はアプリの game.js からそのまま写したもの。
 * サーバーとは通信しない（ランキングなし）。今日クリアしたかだけ、この端末に保存（web.suji.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay;
  var $ = function (id) { return document.getElementById(id); };
  var DAY = SJ.dayKey();
  WP.init({ ns: 'suji', day: DAY, name: '今日のすうじのへや', emoji: '🏠', url: 'https://imaimaha.github.io/play/suji/',
    appId: '6825416177', appLabel: 'アプリなら 365ステージとランキングで勝負', landing: '../../suji/', landingName: 'すうじのへや',
    today: function () { return SJ.dayKey(); } });

  var MODES = {
    a: { name: 'へや割り', icon: '🏠', how: '数字＝へやのマス数。指でなぞって長方形のへやを作り、盤をぜんぶ分けよう（へやをタップで消す）' },
    b: { name: '住人さがし', icon: '👻', how: 'へやの数字の人数だけ住人を。たて・よこの列に1人ずつ、となり（ななめも）はだめ。タップで × → 住人' }
  };
  var RES = ['🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🦊', '🐸', '🐧', '🐤', '🐹', '🐷', '🐵', '🦉', '👻', '🤖', '👴', '👵', '🧙', '🧚', '🦄', '🐙', '🦔', '🦦', '🐢', '🐮', '🐯', '🦁', '🐲', '🐳', '👽', '🧑‍🍳', '👸', '🤠', '🧜'];
  var FURN = ['🛏️', '🪴', '🛋️', '📺', '🪑', '🧸', '📚', '🕰️', '🧺', '🎹', '🖼️', '🍵', '🛁', '🧁', '🎈', '💡', '🪞', '🎸', '⚽', '🍎'];
  var PPL = ['👻', '🤖', '👴', '🐱', '🧙', '👵', '🐶', '🧛', '🐼', '🐰', '🦊', '🐧', '🧚', '🐸', '🐻', '🦉'];
  var TINT = ['#ffe9c7', '#d8f1e1', '#dde7fb', '#fbdfe7', '#eadffb', '#d6eef3', '#f6eec8', '#e3eed6'];
  var ROOMC = ['#ffe3b8', '#cdeedb', '#d3e0fb', '#f9d4df', '#e3d5fa', '#cbe9ef', '#f3e8b8', '#dbe9c9'];
  var save = { set: {}, tips: WP.lget('web.suji.tips') || {} };
  function store() { WP.lset('web.suji.tips', save.tips); }

  // ---- 音（アプリと同じ）----
  var ac = null;
  function tone(freq, dur, type, vol, delay) {
    if (WP.muted()) return;
    try {
      if (!ac) { var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime + (delay || 0), g = ac.createGain(), os = ac.createOscillator();
      os.type = type || 'sine'; os.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t + dur + 0.02);
    } catch (e) { /* 音が出なくても遊べる */ }
  }
  function snd(kind) {
    switch (kind) {
      case 'put': tone(784, 0.08, 'triangle', 0.12); break;
      case 'mark': tone(520, 0.05, 'sine', 0.07); break;
      case 'room': tone(784, 0.09, 'triangle', 0.11); tone(1046, 0.12, 'triangle', 0.1, 0.07); break;
      case 'erase': tone(440, 0.07, 'triangle', 0.08); break;
      case 'bad': tone(220, 0.2, 'triangle', 0.12); tone(185, 0.25, 'triangle', 0.1, 0.12); break;
      case 'clear': [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.24, 'triangle', 0.12, i * 0.1); }); break;
      default: tone(600, 0.05, 'sine', 0.06);
    }
  }
  function haptic() { /* ブラウザではなし */ }
  function pstat() { /* 統計は送らない */ }
  function pkey() { return null; }
  function tutStep() { /* れんしゅうはアプリだけ */ }
  function checkStuck() { /* アプリでも出さない（11/18 から） */ }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var toastTimer = 0;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }
  function showMsg(text) { toast(text, 4000); }
  function showCant(why) { snd('bad'); toast('置けないよ（' + why + '）', 1800); }

  var G = null, CS = 40;
  function busy() { return !G || G.done || WP.clearOpen(); }
  function measure() {
    var w = $('p-wrap').getBoundingClientRect(), n = G.n;
    var size = Math.floor(Math.min(w.width - 16, w.height - 10, 540));
    CS = Math.max(18, Math.floor(size / n));
    var b = $('p-board'); b.style.width = CS * n + 'px'; b.style.height = CS * n + 'px';
  }
  function place(el, r, c, hh, ww, inset) {
    inset = inset || 0;
    el.style.left = (c * CS + inset) + 'px'; el.style.top = (r * CS + inset) + 'px';
    el.style.width = (ww * CS - inset * 2) + 'px'; el.style.height = (hh * CS - inset * 2) + 'px';
  }
  function stateOut() { return G.mode === 'a' ? { rooms: G.rooms } : { v: G.v, ord: G.ord }; }
  function snapshot() { G.undo.push(JSON.stringify(stateOut())); if (G.undo.length > 300) G.undo.shift(); }
  function changed() { render(); checkWin(); }

  // =====================================================================
  // 盤（アプリの game.js と同じ）
  // =====================================================================
  // =====================================================================
  var A = { clues: [], layer: null, roomEls: {}, pv: null, glow: null, drag: null };
  // 正しいへやどうしがとなりあうとき、ちがう色になるように
  function colorRoomsA(g) {
    var n = g.n, own = [], k, i;
    g.sol.forEach(function (rc, kk) { rc.cells.forEach(function (c) { own[c] = kk; }); });
    var adj = g.sol.map(function () { return {}; });
    for (i = 0; i < g.N; i++) {
      if (i % n < n - 1 && own[i] !== own[i + 1]) { adj[own[i]][own[i + 1]] = 1; adj[own[i + 1]][own[i]] = 1; }
      if (i + n < g.N && own[i] !== own[i + n]) { adj[own[i]][own[i + n]] = 1; adj[own[i + n]][own[i]] = 1; }
    }
    var col = [];
    for (k = 0; k < g.sol.length; k++) {
      var used = {};
      for (var o in adj[k]) if (col[o] != null) used[col[o]] = 1;
      var start = (k * 3) % ROOMC.length, c = start;
      for (var t = 0; t < ROOMC.length; t++) { c = (start + t) % ROOMC.length; if (!used[c]) break; }
      col[k] = c;
    }
    return col;
  }
  function buildA(b) {
    var n = G.n, i;
    for (i = 0; i < G.N; i++) { var d = h('div', 'cell'); place(d, Math.floor(i / n), i % n, 1, 1); b.appendChild(d); }
    A.layer = h('div'); A.layer.style.position = 'absolute'; A.layer.style.inset = '0'; b.appendChild(A.layer);
    A.roomEls = {};
    A.clues = G.P.clues.map(function (cl) {
      var e = h('div', 'clue'), s = h('span', null, String(cl.area));
      e.appendChild(s); place(e, Math.floor(cl.cell / n), cl.cell % n, 1, 1);
      e.style.fontSize = Math.floor(CS * 0.55) + 'px';
      b.appendChild(e); return e;
    });
    A.pv = h('div', 'pv'); A.pv.hidden = true; A.pv.appendChild(h('b')); b.appendChild(A.pv);
    A.glow = h('div', 'glow'); A.glow.hidden = true; b.appendChild(A.glow);
    b.onpointerdown = downA; b.onpointermove = moveA; b.onpointerup = upA; b.onpointercancel = function () { A.drag = null; A.pv.hidden = true; };
  }
  function cellFromEvent(e) {
    var r = $('p-board').getBoundingClientRect(), n = G.n;
    var x = Math.floor((e.clientX - r.left) / CS), y = Math.floor((e.clientY - r.top) / CS);
    return Math.max(0, Math.min(n - 1, y)) * n + Math.max(0, Math.min(n - 1, x));
  }
  function rectOf(a, b2) {
    var n = G.n, r0 = Math.min(Math.floor(a / n), Math.floor(b2 / n)), r1 = Math.max(Math.floor(a / n), Math.floor(b2 / n));
    var c0 = Math.min(a % n, b2 % n), c1 = Math.max(a % n, b2 % n);
    return { r: r0, c: c0, h: r1 - r0 + 1, w: c1 - c0 + 1 };
  }
  function cellsOf(rc) { return SJ.rectCells(G.n, rc.r, rc.c, rc.h, rc.w); }
  // へやの中の数字（k のならび）と、正しいか
  function infoA(rc) {
    var cs = cellsOf(rc), ks = [];
    cs.forEach(function (c) { var k = G.P.clueAt[c]; if (k >= 0) ks.push(k); });
    var ok = ks.length === 1 && G.P.clues[ks[0]].area === cs.length;
    return { cells: cs, ks: ks, ok: ok, k: ks.length === 1 ? ks[0] : -1 };
  }
  function roomAt(cell) { var n = G.n, r = Math.floor(cell / n), c = cell % n; for (var i = 0; i < G.rooms.length; i++) { var rc = G.rooms[i]; if (r >= rc.r && r < rc.r + rc.h && c >= rc.c && c < rc.c + rc.w) return i; } return -1; }
  function overlaps(a, b2) { return a.r < b2.r + b2.h && b2.r < a.r + a.h && a.c < b2.c + b2.w && b2.c < a.c + a.w; }
  function sameRect(a, b2) { return a.r === b2.r && a.c === b2.c && a.h === b2.h && a.w === b2.w; }
  function downA(e) {
    if (busy()) return;
    e.preventDefault();
    try { $('p-board').setPointerCapture(e.pointerId); } catch (x) { /* なし */ }
    var c = cellFromEvent(e);
    A.drag = { s: c, e: c, moved: false };
    showPreview();
  }
  function moveA(e) {
    if (!A.drag) return;
    var c = cellFromEvent(e);
    if (c !== A.drag.e) { A.drag.e = c; A.drag.moved = true; snd('mark'); haptic('select'); showPreview(); }
  }
  function showPreview() {
    var d = A.drag, rc = rectOf(d.s, d.e), inf = infoA(rc);
    place(A.pv, rc.r, rc.c, rc.h, rc.w, 1);
    A.pv.className = 'pv' + (inf.ok ? ' good' : '') + (rc.r === 0 ? ' below' : '');
    A.pv.firstChild.textContent = rc.w + '×' + rc.h + '＝' + (rc.w * rc.h) + 'マス';
    A.pv.hidden = !d.moved;
  }
  function upA(e) {
    if (!A.drag) return;
    var d = A.drag; A.drag = null; A.pv.hidden = true;
    if (busy()) return;
    var rc = rectOf(d.s, d.e);
    if (!d.moved) {
      var ri = roomAt(d.s);
      if (ri >= 0) {
        if (G.tut && G.tut.step < 2) { toast('光っているところを なぞってね'); return; }
        snapshot(); G.rooms.splice(ri, 1); snd('erase'); haptic('light'); changed(); return;
      }
      var k = G.P.clueAt[d.s];
      if (!(k >= 0 && G.P.clues[k].area === 1)) { toast('指でなぞって、へやを作ろう'); return; }
    }
    addRoom(rc);
  }
  function addRoom(rc) {
    if (G.tut && G.tut.step < 2) {
      var want = G.sol[G.tut.order[G.tut.step]];
      if (!sameRect(rc, want)) { snd('bad'); showMsg('おしい！ 光っているマスを、はしからはしまで なぞってね', 'tut', 0); return; }
    }
    snapshot();
    G.rooms = G.rooms.filter(function (x) { return !overlaps(x, rc); });
    G.rooms.push(rc);
    var inf = infoA(rc);
    if (inf.ok) { snd('room'); haptic('light'); } else { snd('put'); haptic('select'); }
    changed();
    if (G.tut && !G.done) { G.tut.step++; tutStep(); }
  }
  function renderA() {
    var keep = {}, own = {}, n = G.n;
    G.rooms.forEach(function (rc) {
      var key = rc.r + ',' + rc.c + ',' + rc.h + ',' + rc.w, inf = infoA(rc), el = A.roomEls[key];
      keep[key] = 1;
      if (inf.ok) own[inf.k] = 1;
      if (!el || el.okState !== inf.ok) {
        if (el) el.remove();
        el = h('div', 'rm' + (inf.ok ? '' : ' bad'));
        el.okState = inf.ok;
        place(el, rc.r, rc.c, rc.h, rc.w, 1.5);
        if (inf.ok) {
          el.style.background = ROOMC[G.colorOf[inf.k] != null ? G.colorOf[inf.k] : inf.k % ROOMC.length];
          var cl = G.P.clues[inf.k], who = h('div', 'who res', RES[(G.seed + inf.k) % RES.length]);
          var cr = Math.floor(cl.cell / n) - rc.r, cc = cl.cell % n - rc.c;
          who.style.left = (cc * CS) + 'px'; who.style.top = (cr * CS) + 'px'; who.style.width = CS + 'px'; who.style.height = CS + 'px';
          who.style.fontSize = Math.floor(CS * 0.62) + 'px';
          el.appendChild(who);
          // 家具（へやが大きいほど多く）
          var others = inf.cells.filter(function (c) { return c !== cl.cell; }), nf = Math.min(others.length, others.length >= 8 ? 3 : others.length >= 3 ? 2 : others.length >= 1 ? 1 : 0);
          var hs = (G.seed ^ (inf.k * 2654435761)) >>> 0;
          for (var f = 0; f < nf; f++) {
            var pick = others.splice((hs >>> (f * 5)) % others.length, 1)[0];
            var fu = h('div', 'who fur', FURN[(hs + f * 11 + inf.k) % FURN.length]);
            fu.style.left = ((pick % n - rc.c) * CS) + 'px'; fu.style.top = ((Math.floor(pick / n) - rc.r) * CS) + 'px';
            fu.style.width = CS + 'px'; fu.style.height = CS + 'px'; fu.style.fontSize = Math.floor(CS * 0.42) + 'px';
            el.appendChild(fu);
          }
        } else {
          el.appendChild(h('span', 'lab', inf.ks.length > 1 ? '数字が' + inf.ks.length + 'つ' : inf.ks.length ? inf.cells.length + 'マス' : '数字なし'));
        }
        A.layer.appendChild(el);
        A.roomEls[key] = el;
      }
    });
    for (var k in A.roomEls) if (!keep[k]) { A.roomEls[k].remove(); delete A.roomEls[k]; }
    A.clues.forEach(function (e, kk) {
      var inn = !!own[kk];
      e.className = 'clue' + (inn ? ' in' : '');
      e.style.fontSize = Math.floor(CS * (inn ? 0.3 : 0.55)) + 'px';
    });
  }
  function winA() {
    var cov = 0;
    for (var i = 0; i < G.rooms.length; i++) { var inf = infoA(G.rooms[i]); if (!inf.ok) return false; cov += inf.cells.length; }
    return cov === G.N;
  }

  // =====================================================================
  // モード B「住人さがし」  v: 0 空 / 1 × / 2 住人
  // =====================================================================
  var B = { cells: [], badges: [] };
  function colorRegionsB(P) {
    var n = P.n, adj = [], r, i;
    for (r = 0; r < P.R; r++) adj.push({});
    for (i = 0; i < P.N; i++) {
      if (i % n < n - 1 && P.rg[i] !== P.rg[i + 1]) { adj[P.rg[i]][P.rg[i + 1]] = 1; adj[P.rg[i + 1]][P.rg[i]] = 1; }
      if (i + n < P.N && P.rg[i] !== P.rg[i + n]) { adj[P.rg[i]][P.rg[i + n]] = 1; adj[P.rg[i + n]][P.rg[i]] = 1; }
    }
    var col = [];
    for (r = 0; r < P.R; r++) {
      var used = {};
      for (var o in adj[r]) if (col[o] != null) used[col[o]] = 1;
      var c = 0;
      for (var t = 0; t < TINT.length; t++) { c = (r * 3 + t) % TINT.length; if (!used[c]) break; }
      col[r] = c;
    }
    return col;
  }
  function buildB(b) {
    var n = G.n, P = G.P, i;
    B.cells = [];
    for (i = 0; i < G.N; i++) (function (i) {
      var d = h('div', 'bc'); place(d, Math.floor(i / n), i % n, 1, 1);
      d.style.background = TINT[G.tint[P.rg[i]]];
      d.style.boxShadow = 'inset -1px -1px 0 rgba(74,90,120,.25)';
      var con = h('div'); d.appendChild(con);
      b.appendChild(d); B.cells.push({ el: d, con: con });
    })(i);
    // へやのさかいめの太い線
    for (i = 0; i < G.N; i++) {
      var r = Math.floor(i / n), c = i % n, w;
      if (c < n - 1 && P.rg[i] !== P.rg[i + 1]) { w = h('div', 'wall'); w.style.left = ((c + 1) * CS - 1.5) + 'px'; w.style.top = (r * CS - 1.5) + 'px'; w.style.width = '3px'; w.style.height = (CS + 3) + 'px'; b.appendChild(w); }
      if (r < n - 1 && P.rg[i] !== P.rg[i + n]) { w = h('div', 'wall'); w.style.left = (c * CS - 1.5) + 'px'; w.style.top = ((r + 1) * CS - 1.5) + 'px'; w.style.width = (CS + 3) + 'px'; w.style.height = '3px'; b.appendChild(w); }
    }
    B.badges = [];
    for (r = 0; r < P.R; r++) {
      var first = P.cells[r][0], bd = h('div', 'bdg', String(P.need[r]));
      bd.style.left = ((first % n) * CS + 2) + 'px'; bd.style.top = (Math.floor(first / n) * CS + 2) + 'px';
      bd.style.fontSize = Math.max(10, Math.floor(CS * 0.28)) + 'px';
      b.appendChild(bd); B.badges.push(bd);
    }
    // タップ: 1マスずつ（空 → × → 住人 …）。なぞる（1.0.10 から）: なぞったマスに まとめて ×。× のマスから なぞると まとめて消す（住人のマスはそのまま）
    var dn = null;
    b.onpointerdown = function (e) {
      if (busy()) return; e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (er) { /* なし */ }
      dn = { cell: cellFromEvent(e), drag: false, last: [e.clientX, e.clientY], n: 0 };
    };
    b.onpointermove = function (e) {
      if (!dn || !G || G.done) return;
      if (busy()) { dragEnd(); return; }
      e.preventDefault();
      if (!dn.drag) {
        if (cellFromEvent(e) === dn.cell) return;
        if (G.tut && G.tut.step < 2) return;          // れんしゅうの はじめの2手は タップだけ
        dn.drag = true; dn.erase = G.v[dn.cell] === 1; snapshot(); dragMark(dn.cell);
      }
      var pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (!pts || !pts.length) pts = [e];
      pts.forEach(function (p) {
        // 速くなぞってマスをとばしても、間のマスに つける
        var l = dn.last, dx = p.clientX - l[0], dy = p.clientY - l[1], k = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / (CS / 4)));
        for (var q = 1; q <= k; q++) dragMark(cellFromEvent({ clientX: l[0] + dx * q / k, clientY: l[1] + dy * q / k }));
        dn.last = [p.clientX, p.clientY];
      });
      renderB();
    };
    b.onpointerup = function (e) {
      if (!dn) return;
      if (dn.drag) { dragEnd(); return; }
      var c = cellFromEvent(e), d = dn.cell; dn = null;
      if (c === d) tapB(c);
    };
    b.onpointercancel = function () { if (dn && dn.drag) dragEnd(); dn = null; };
    function dragMark(i) {
      if (i < 0 || !dn) return;
      if (dn.erase) { if (G.v[i] !== 1) return; G.v[i] = 0; snd('erase'); }
      else { if (G.v[i] !== 0) return; G.v[i] = 1; snd('mark'); }
      dn.n++; haptic('select');
    }
    function dragEnd() {
      var d = dn; dn = null;
      if (!d || !d.drag || !G) return;
      if (!d.n) { G.undo.pop(); return; }       // 何もかわらなかった
      tipSeen();
      changed();
      checkStuck(true);
    }
  }
  // ×をなぞる の ひとこと（住人さがしで はじめて × をつけたとき 1回だけ。上に小さく。タップで閉じる。あそびかた・ルールでも見られる）
  function tipSeen() { if (!save.tips) save.tips = {}; if (!save.tips.xdrag) { save.tips.xdrag = 1; store(); } }
  function xTip() {
    if ((save.tips && save.tips.xdrag) || (G.tut && G.tut.step < 2)) return;
    tipSeen();
    showMsg('✋ × は なぞって まとめて付けられるよ（× から なぞると まとめて消せる）', 'tip', 6000);
  }
  // 住人を置けないマスか（置けないなら理由。置けるなら ''）
  function cantPlace(i) {
    var P = G.P, n = G.n, L = P.L || 1, r = Math.floor(i / n), c = i % n, rc = 0, cc = 0, rg = 0, j;
    if (P.nb[i].some(function (t) { return G.v[t] === 2; })) return 'となりに 住人がいるよ（ななめも だめ）';
    for (j = 0; j < G.N; j++) if (j !== i && G.v[j] === 2) { if (Math.floor(j / n) === r) rc++; if (j % n === c) cc++; if (P.rg[j] === P.rg[i]) rg++; }
    if (P.L && rc >= L) return 'この よこの列には、もう住人がいるよ';
    if (P.L && cc >= L) return 'この たての列には、もう住人がいるよ';
    if (rg >= P.need[P.rg[i]]) return 'このへやは もう いっぱい（' + P.need[P.rg[i]] + '人）だよ';
    return '';
  }
  function showCant(why) {
    snd('bad'); haptic('ng'); pstat('fail', pkey());
    if (!CantGuide || !CantGuide.show({ emoji: '🙅', title: '置けないよ', tip: why, place: 'center',
      buttons: [{ label: 'OK', main: true }], hideNote: 'せっていで また出せます（出さないときは 下に小さく出ます）' })) toast('置けないよ（' + why + '）', 1800);
  }
  function tapB(i) {
    if (busy()) return;
    if (G.tut && G.tut.step < 2 && i !== G.tut.order[G.tut.step]) { snd('bad'); toast('光っているマスをタップしてね'); return; }
    var v = G.v[i], nv = save.set.order === 'p' ? [2, 0, 1][v] : [1, 2, 0][v];
    // 住人を置けないマス（1.0.10 から）: 住人はとばして次へ（×が先: 空 ／ 住人が先: ×）、「置けないよ」
    var why = nv === 2 ? cantPlace(i) : '';
    if (why) nv = save.set.order === 'p' ? 1 : 0;
    snapshot();
    G.v[i] = nv;
    G.ord = G.ord.filter(function (x) { return x !== i; }); if (nv === 2) G.ord.push(i);   // ふりかえり用の、住人を置いた順
    if (why) showCant(why);
    else if (nv === 2) { snd('put'); haptic('light'); } else if (nv === 1) { snd('mark'); haptic('select'); } else snd('erase');
    if (G.v[i] === v) G.undo.pop();      // かわらなかった
    changed();
    if (nv === 1 && !why) xTip();
    if (G.tut && !G.done && G.tut.step < 2 && G.v[G.tut.order[G.tut.step]] === 2) { G.tut.step++; tutStep(); }
    else checkStuck(true);
  }
  // 住人のぐあい: 住人のマス・まわりのマス・まちがい
  function statusB() {
    var P = G.P, n = G.n, near = {}, line = {}, bad = {}, have = [], r, i, j;
    for (r = 0; r < P.R; r++) have.push(0);
    var rowc = [], colc = [];
    for (i = 0; i < n; i++) { rowc.push(0); colc.push(0); }
    for (i = 0; i < G.N; i++) if (G.v[i] === 2) {
      have[P.rg[i]]++; rowc[Math.floor(i / n)]++; colc[i % n]++;
      for (j = 0; j < P.nb[i].length; j++) { var t = P.nb[i][j]; near[t] = 1; if (G.v[t] === 2) bad[i] = 1; }
      if (P.L) for (j = 0; j < n; j++) { line[Math.floor(i / n) * n + j] = 1; line[j * n + i % n] = 1; }
    }
    for (i = 0; i < G.N; i++) if (G.v[i] === 2) {
      if (have[P.rg[i]] > P.need[P.rg[i]]) bad[i] = 1;
      if (P.L && (rowc[Math.floor(i / n)] > P.L || colc[i % n] > P.L)) bad[i] = 1;
    }
    return { near: near, line: line, bad: bad, have: have, rowc: rowc, colc: colc };
  }
  function renderB() {
    var s = statusB(), P = G.P;
    for (var i = 0; i < G.N; i++) {
      var c = B.cells[i], v = G.v[i], cls = 'bc';
      // 住めないマスを自動ではうすくしない（1.0.1 から。自分で × をつけたマスだけうすい色）
      if (v === 1) cls += ' near';
      if (s.bad[i]) cls += ' bad';
      if (c.hint) cls += ' hint';
      if (G.tut && G.tut.step < 2 && i === G.tut.order[G.tut.step]) cls += ' tgt';
      if (c.el.className !== cls) c.el.className = cls;
      var want = v === 2 ? 'p' : v === 1 ? 'x' : '';
      if (c.state !== want) {
        c.state = want; c.con.innerHTML = '';
        if (want === 'p') { var e = h('div', 'ppl', PPL[(P.rg[i] + G.seed) % PPL.length]); e.style.fontSize = Math.floor(CS * 0.66) + 'px'; c.con.appendChild(e); }
        if (want === 'x') { var x = h('div', 'mk', '×'); x.style.fontSize = Math.floor(CS * 0.5) + 'px'; c.con.appendChild(x); }
      }
    }
    for (var r = 0; r < P.R; r++) B.badges[r].className = 'bdg' + (s.have[r] > P.need[r] ? ' over' : s.have[r] === P.need[r] && P.need[r] > 0 ? ' ok' : '');
  }
  function winB() {
    var s = statusB(), P = G.P;
    if (Object.keys(s.bad).length) return false;
    for (var r = 0; r < P.R; r++) if (s.have[r] !== P.need[r]) return false;
    if (P.L) for (var i = 0; i < G.n; i++) if (s.rowc[i] !== P.L || s.colc[i] !== P.L) return false;
    return true;
  }

  // =====================================================================
  // あそぶ（2問: へや割り・住人さがし。それぞれ時計と記録がある）
  // =====================================================================
  var GS = {}, cur = 'a';
  function make(mode) {
    var it = SJ.dailyOne(mode, DAY), st = it.st, n = st.n;
    var g = { mode: mode, st: st, n: n, N: n * n, ord: [], done: false, undo: [], tut: null, timer: WP.makeTimer() };
    if (mode === 'a') { g.P = SJ.parseA(st); g.sol = SJ.solutionA(st); g.rooms = []; var G0 = G; G = g; g.colorOf = colorRoomsA(g); G = G0; }
    else { g.P = SJ.parseB(st); g.v = []; for (var i = 0; i < g.N; i++) g.v.push(0); g.tint = colorRegionsB(g.P); }
    g.seed = SJ.hashStr((mode === 'a' ? 'x' : 'y') + DAY + '|0');
    return g;
  }
  function buildBoard() {
    measure();
    var b = $('p-board'); b.textContent = '';
    if (G.mode === 'a') buildA(b); else buildB(b);
  }
  function render() { if (!G) return; if (G.mode === 'a') renderA(); else renderB(); paintTabs(); }
  function relayout() { if (G) { buildBoard(); render(); } }
  root.addEventListener('resize', relayout);
  $('p-board').addEventListener('pointerdown', function () { if (!busy()) G.timer.start(); }, true);

  function paintTabs() {
    ['a', 'b'].forEach(function (m) {
      var bt = $('tab-' + m); bt.classList.toggle('on', m === cur);
      bt.textContent = MODES[m].icon + ' 今日の' + MODES[m].name;
      if (WP.record(m)) bt.appendChild(h('span', 'ok', ' ✅'));
    });
  }
  function select(mode, noResult) {
    if (G) G.timer.hold('tab');
    cur = mode;
    if (!GS[mode]) GS[mode] = make(mode);
    G = GS[mode];
    WP.timer = G.timer; G.timer.release('tab'); WP.paintTime();
    $('wp-how').textContent = MODES[mode].how;
    $('wp-left').textContent = G.n + '×' + G.n + ' ' + MODES[mode].name;
    buildBoard(); render();
    var rec = WP.record(mode);
    if (rec && !noResult && !G.done && !G.again) result(false, rec.sec);
  }
  function reset(mode) {
    var old = GS[mode];
    GS[mode] = make(mode); GS[mode].again = old ? old.again : false;
    if (cur === mode) { G = null; select(mode, true); }
  }
  ['a', 'b'].forEach(function (m) { $('tab-' + m).addEventListener('click', function () { if (cur !== m) select(m); }); });

  function undo() {
    if (busy()) return;
    var s = G.undo.pop();
    if (!s) { toast('もどせる手はありません'); return; }
    s = JSON.parse(s);
    if (G.mode === 'a') G.rooms = s.rooms; else { G.v = s.v; G.ord = s.ord || []; }
    snd('erase'); changed();
  }
  function clearAll() {
    if (busy()) return;
    var empty = G.mode === 'a' ? !G.rooms.length : G.v.every(function (x) { return !x; });
    if (empty) return;
    snapshot();
    if (G.mode === 'a') G.rooms = []; else G.v = G.v.map(function () { return 0; });
    snd('erase'); toast('ぜんぶ消しました（↶ 戻す でもどせます）'); changed();
  }
  $('b-undo').addEventListener('click', undo);
  $('b-clear').addEventListener('click', clearAll);

  function checkWin() {
    if (!G || G.done) return;
    if (!(G.mode === 'a' ? winA() : winB())) return;
    G.done = true;
    var sec = G.timer.stop(), prev = WP.record(G.mode), g = G;
    WP.saveRecord(sec, null, G.mode);
    if (G.mode === 'a') A.glow.hidden = true;
    snd('clear'); paintTabs();
    setTimeout(function () { if (G === g) result(true, sec, prev); }, root.__wpFast ? 0 : 900);
  }
  function result(fresh, sec, prev) {
    var mode = cur, other = mode === 'a' ? 'b' : 'a';
    var btns = [];
    if (!WP.record(other)) btns.push({ label: MODES[other].icon + ' 今日の' + MODES[other].name + 'もやる', main: false, run: function () { select(other); } });
    WP.showClear({ sec: sec, fresh: fresh, head: mode === 'a' ? 'へやが ぜんぶ できた！' : '住人が ぜんぶ入った！', emoji: mode === 'a' ? '🏠' : '👻',
      name: '今日の' + MODES[mode].name, tag: 'すうじのへや',
      row: WP.tierRow(sec, [60, 120, 180, 300], mode === 'a' ? '🏠' : '👻', '⬜'),
      note: prev ? '今日の記録（1回目）: ' + WP.fmt(prev.sec) : null,
      buttons: btns, again: function () { GS[mode].again = true; reset(mode); } });
  }

  // 自動テスト用（答えは盤からいつでも計算できるので、出してもこまらない）
  root.__webPlay = {
    puzzle: function (m) { return GS[m || cur].st; }, mode: function () { return cur; }, select: select, cs: function () { return CS; },
    done: function () { return !!(G && G.done); }, sol: function () { return G.mode === 'a' ? G.sol.map(function (rc) { return rc.cells; }) : null; }
  };

  GS.a = make('a'); GS.b = make('b');
  select(WP.record('a') && !WP.record('b') ? 'b' : 'a');
})(window);

/* つるっと ゆでたまご剥き — ブラウザ版「今日のたまご」（/play/yudetamago/）
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
  WP.init({ ns: 'yudetamago', day: DAY, name: '今日のたまご', tag: '今日のたまご', emoji: '🥚', url: 'https://imaimaha.com/play/yudetamago/',
    appId: '6821884836', appLabel: 'アプリなら 図鑑とランキングで勝負', landing: '../../yudetamago/', landingName: 'つるっと ゆでたまご剥き',
    today: jstDay });
  // 遊ぶところ（#yd-game）の中の位置。アプリは画面いっぱいなので window の大きさを使っていた
  function VW() { return (el.stage && el.stage.clientWidth) || window.innerWidth || 390; }
  function VH() { return (el.stage && el.stage.clientHeight) || window.innerHeight || 844; }
  function ex(e) { return e.clientX - (e.clientX || e.clientY ? el.stage.getBoundingClientRect().left : 0); }
  function ey(e) { return e.clientY - (e.clientX || e.clientY ? el.stage.getBoundingClientRect().top : 0); }

  // ---- 調整しやすい定数 ----
  var CFG = {
    FRAGMENTS: 170,      // 殻のかけらの数（ボロノイ風に分割）
    SHELL_DETAIL: 26,    // 殻の元になる球の細かさ（三角形 20*(n+1)^2 枚）
    WHITE_DETAIL: 26,    // 白身の細かさ（削れ跡の解像度）
    SHELL_OUT: 0.03,     // 殻の厚み
    SHELL_IN: 0.004,
    TAP_SLOP: 10,        // px: これ以上動いたらタップではなくドラッグ
    TAP_MAX_MS: 450,
    PEEL_STEP: 0.12,     // 指が「たまご半径×これ」動くたびに次のかけらが剥がれる
    SNAP_STRESS: 1.75,   // 負荷がこれを超えると、ちぎれて剥がしが止まる
    ROT_SPEED: 0.0085,   // rad/px
    BIG_PEEL_FRAC: 0.4,  // 「一気に剥く」で剥ける割合
    GRAVITY: 13,
    MAX_FLYING: 80
  };
  var selEgg = 'white';   // ブラウザ版は今日のたまごだけ（たまご選び・振動・ランキングはアプリ）


  // ===================== クリスマス期間（毎年 12/1〜12/25 日本時間。xmas.js。見た目だけ・今日のたまごの中身は同じ） =====================
  function xmasOn() { return !!(window.Xmas && Xmas.active()); }
  var xSnow = null;
  function xmasDeco() { document.body.classList.toggle('xmas', xmasOn()); }
  // 雪: クリスマス期間の今日のたまごのとき（ブラウザ版は遊ぶところの中だけ）
  function xmasSnow() {
    var want = xmasOn() && (state === 'title' || (G && G.egg && G.egg.id === 'xmas' && state !== 'result'));
    if (want && !xSnow) xSnow = Xmas.snow({ parent: $('yd-game'), before: el.stage, count: 34, css: 'position:absolute;' });
    if (xSnow) { if (want) xSnow.start(); else xSnow.stop(); }
  }

  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // =========================================================================
  // サウンド（Web Audio API で生成。音源ファイルなし）
  // =========================================================================
  var Snd = (function () {
    var ac = null, master = null, noiseBuf = null, rustleG = null, rustleF = null, muted = false, lastPeel = 0;
    muted = WP.muted();   // 音のボタンは WebPlay（web.yudetamago.set）
    var VOL = 0.85;
    function init() {
      if (ac) { if (ac.state === 'suspended' && !document.hidden) { try { ac.resume(); } catch (e) { /* noop */ } } return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { ac = null; return; }

      master = ac.createGain(); master.gain.value = muted ? 0 : VOL; master.connect(ac.destination);
      var len = Math.floor(ac.sampleRate * 2);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 剥がしている間のシャリシャリ音（常時鳴らして音量だけ動かす）
      var src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      rustleF = ac.createBiquadFilter(); rustleF.type = 'bandpass'; rustleF.frequency.value = 1800; rustleF.Q.value = 1.2;
      rustleG = ac.createGain(); rustleG.gain.value = 0;
      src.connect(rustleF); rustleF.connect(rustleG); rustleG.connect(master); src.start();
      // iOS のロック解除用の無音
      var b = ac.createBuffer(1, 1, 22050), s2 = ac.createBufferSource(); s2.buffer = b; s2.connect(ac.destination); s2.start(0);
      if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* noop */ } }
    }
    function nz(at, dur, type, f0, f1, q, vol) {
      var s = ac.createBufferSource(); s.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, at);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + Math.min(0.006, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(at, Math.random() * Math.max(0, 1.9 - dur)); s.stop(at + dur + 0.03);
    }
    function tn(at, dur, type, f0, f1, vol) {
      var o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, at);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.03);
    }
    function ok() { return !!ac && !muted; }
    function t0() { return ac.currentTime + 0.005; }
    return {
      init: init,
      // パリッ（短い高域ノイズの連打）
      crack: function (p) {
        if (!ok()) return;
        var t = t0(), n = 3 + (Math.random() * 3 | 0);
        for (var i = 0; i < n; i++) {
          t += 0.008 + Math.random() * 0.022;
          nz(t, 0.025 + Math.random() * 0.03, 'highpass', 2200 + Math.random() * 3500, 0, 0.8, (0.34 - i * 0.04) * p);
        }
        tn(t0(), 0.05, 'sine', 900, 300, 0.1 * p);
      },
      // ペリッ（帯域ノイズのスイープ）
      peel: function () {
        if (!ok()) return;
        var t = t0(); if (t - lastPeel < 0.035) return; lastPeel = t;
        nz(t, 0.11 + Math.random() * 0.06, 'bandpass', 700 + Math.random() * 300, 2600 + Math.random() * 1400, 1.6, 0.24);
        nz(t, 0.02, 'highpass', 4500, 0, 0.7, 0.1);
      },
      // ブチッ（白身が削れる）
      tear: function () {
        if (!ok()) return;
        var t = t0();
        nz(t, 0.3, 'lowpass', 1400, 180, 1, 0.45);
        tn(t, 0.22, 'triangle', 230, 70, 0.22);
        nz(t + 0.03, 0.14, 'bandpass', 500, 1600, 3, 0.25);
      },
      rustle: function (lv) {
        if (!ac) return;
        rustleG.gain.setTargetAtTime(muted ? 0 : Math.min(1, lv) * 0.09, ac.currentTime, 0.05);
        rustleF.frequency.setTargetAtTime(1200 + Math.min(1, lv) * 2600, ac.currentTime, 0.05);
      },
      // ずるるるっ（一気に剥く）
      big: function () {
        if (!ok()) return;
        var t = t0();
        nz(t, 0.7, 'bandpass', 500, 4200, 1.2, 0.35);
        for (var i = 0; i < 8; i++) nz(t + i * 0.06 + Math.random() * 0.03, 0.04, 'highpass', 3000 + Math.random() * 2000, 0, 0.8, 0.18);
      },
      boom: function () {
        if (!ok()) return;
        var t = t0();
        nz(t, 1.6, 'lowpass', 2400, 70, 0.8, 0.95);
        tn(t, 1.3, 'sine', 120, 28, 0.9);
        tn(t, 0.4, 'square', 80, 30, 0.15);
        for (var i = 0; i < 10; i++) nz(t + 0.05 + Math.random() * 0.6, 0.05, 'highpass', 2000 + Math.random() * 4000, 0, 0.8, 0.2);
      },
      // シャカシャカ
      salt: function () {
        if (!ok()) return;
        var t = t0();
        for (var i = 0; i < 3; i++) nz(t + i * 0.12, 0.08, 'highpass', 6500, 0, 0.8, 0.16);
      },
      poke: function () { if (!ok()) return; tn(t0(), 0.13, 'sine', 260, 560, 0.2); },
      knock: function () { if (!ok()) return; tn(t0(), 0.06, 'sine', 500, 220, 0.12); nz(t0(), 0.03, 'bandpass', 1500, 0, 2, 0.12); },
      // ミシッ（力みすぎ警告）
      creak: function () {
        if (!ok()) return;
        var t = t0();
        tn(t, 0.22, 'sawtooth', 150, 110, 0.05);
        nz(t, 0.18, 'bandpass', 900, 600, 6, 0.12);
      },
      chime: function () {
        if (!ok()) return;
        var t = t0(), ns = [784, 988, 1175, 1568];
        for (var i = 0; i < ns.length; i++) tn(t + i * 0.09, 0.5, 'triangle', ns[i], 0, 0.14);
        nz(t, 0.25, 'highpass', 5000, 9000, 0.7, 0.06);
      },
      fanfare: function () {
        if (!ok()) return;
        var t = t0(), ns = [523, 659, 784, 1047, 784, 1047, 1319];
        var ds = [0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.72];
        for (var i = 0; i < ns.length; i++) { tn(t + ds[i], 0.4, 'square', ns[i], 0, 0.06); tn(t + ds[i], 0.45, 'triangle', ns[i] / 2, 0, 0.1); }
      },
      sad: function () {
        if (!ok()) return;
        var t = t0(), ns = [392, 370, 349, 262];
        for (var i = 0; i < ns.length; i++) tn(t + i * 0.28, 0.42, 'triangle', ns[i], ns[i] * 0.98, 0.12);
      },
      isMuted: function () { return muted; },
      toggle: function () {
        muted = !muted;
        if (ac) master.gain.setTargetAtTime(muted ? 0 : VOL, ac.currentTime, 0.03);
        return muted;
      },
      suspend: function () { if (ac) { try { ac.suspend(); } catch (e) { /* noop */ } } },
      resume: function () { if (ac) { try { ac.resume(); } catch (e) { /* noop */ } } }
    };
  })();

  // =========================================================================
  // DOM
  // =========================================================================
  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  ['start', 'btnStart', 'startName', 'startDesc', 'startRule', 'stage', 'hud', 'time', 'rank', 'btnRetry', 'mute', 'power', 'powerBar', 'hint', 'bottom', 'peelBar', 'peelPct',
    'hpRow', 'hpBar', 'hpVal', 'btnBig', 'bigLeft', 'btnSalt', 'saltInfo', 'ring', 'fx', 'banner', 'toast', 'flash', 'vignette',
    'title', 'btnNormal', 'btnHanjuku', 'bestNormal', 'bestHanjuku', 'zukan',
    'result', 'resTitle', 'resRank', 'resScore', 'resComment', 'resDetail', 'resRare', 'resBest', 'btnAgain', 'btnTitle',
    'btnRank', 'resGC', 'resGCText', 'btnRankRes', 'btnPick', 'pickName', 'daily', 'dailyName', 'btnZukan', 'zukanCount', 'eggSheet', 'sheetTitle', 'sheetSub', 'eggGrid', 'eggDetail', 'sheetClose', 'resEgg', 'eggPager', 'eggPrev', 'eggNext', 'eggPageNo',
    'todaySub', 'resToday', 'chance', 'chanceGo', 'chanceSub', 'chanceMsg', 'chanceNo'
  ].forEach(function (id) { el[id] = $(id); });

  // =========================================================================
  // レンダラー・シーン
  // =========================================================================
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    var err = document.createElement('div'); err.id = 'err';
    err.textContent = 'この端末ではWebGLが使えないため遊べません。';
    document.body.appendChild(err);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.stage.appendChild(renderer.domElement);
  var cvs = renderer.domElement;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  var camBase = new THREE.Vector3(), camRight = new THREE.Vector3(1, 0, 0), camUp = new THREE.Vector3(0, 1, 0), camToward = new THREE.Vector3(0, 0, 1);
  var eggScreenR = 130;

  // 簡易スタジオ環境（反射用。PMREMで一度だけ焼く）
  (function buildEnv() {
    var es = new THREE.Scene();
    var g = new THREE.SphereGeometry(10, 32, 16), p = g.attributes.position, cols = new Float32Array(p.count * 3);
    for (var i = 0; i < p.count; i++) {
      var t = p.getY(i) / 10;
      var r, gg, b;
      if (t > 0) { r = 0.75 + 0.25 * t; gg = 0.7 + 0.24 * t; b = 0.66 + 0.2 * t; } else { r = 0.75 + 0.55 * t; gg = 0.7 + 0.52 * t; b = 0.66 + 0.48 * t; }
      cols[i * 3] = r; cols[i * 3 + 1] = gg; cols[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
    function box(x, y, z, w, h, c) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    }
    box(-5, 6, 4, 6, 4, new THREE.Color(4, 3.8, 3.4));
    box(6, 2, -5, 4, 6, new THREE.Color(1.6, 1.9, 2.3));
    box(4, -1, 6, 3, 3, new THREE.Color(1.2, 1.1, 1.0));
    try {
      var pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(es, 0.03).texture;
      pm.dispose();
    } catch (e) { /* 環境マップなしでも描ける */ }
  })();

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5b4a3c, 0.6));
  var key = new THREE.DirectionalLight(0xfff2e0, 2.0); key.position.set(-2.5, 4, 4); scene.add(key);
  var rim = new THREE.DirectionalLight(0xdde8ff, 1.3); rim.position.set(3, 1.5, -4); scene.add(rim);
  var fill = new THREE.DirectionalLight(0xffe7cc, 0.4); fill.position.set(3, -2, 3); scene.add(fill);

  function canvasTex(size, draw) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var ctx = c.getContext('2d');
    if (ctx) draw(ctx, size);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var dotTex = canvasTex(64, function (ctx, s) {
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });

  // 影
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({
    map: canvasTex(128, function (ctx, s) {
      var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(5,10,14,0.55)'); g.addColorStop(0.6, 'rgba(5,10,14,0.2)'); g.addColorStop(1, 'rgba(5,10,14,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    }), transparent: true, depthWrite: false
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.62; shadow.scale.set(1, 0.75, 1);
  scene.add(shadow);

  var egg = new THREE.Group();
  scene.add(egg);

  // =========================================================================
  // ジオメトリの下ごしらえ
  // =========================================================================
  function buildIco(detail) {
    var g = new THREE.IcosahedronGeometry(1, detail);
    var p = g.attributes.position.array, n = p.length / 3;
    var map = new Map(), verts = [], index = new Uint32Array(n);
    for (var i = 0; i < n; i++) {
      var x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      var k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      var id = map.get(k);
      if (id === undefined) { id = verts.length / 3; map.set(k, id); verts.push(x, y, z); }
      index[i] = id;
    }
    g.dispose();
    var vCount = verts.length / 3;
    return { verts: new Float32Array(verts), index: vCount < 65536 ? new Uint16Array(index) : index, vCount: vCount, tCount: n / 3 };
  }

  var _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0];
  var V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), V5 = new THREE.Vector3();
  function eggNormal(dx, dy, dz, out) {
    var d = V1.set(dx, dy, dz);
    var t1 = Math.abs(dy) < 0.9 ? V2.set(0, 1, 0).cross(d).normalize() : V2.set(1, 0, 0).cross(d).normalize();
    var t2 = V3.copy(d).cross(t1).normalize();
    var e = 1e-3;
    L.eggPoint(dx, dy, dz, _a);
    V4.copy(d).addScaledVector(t1, e).normalize(); L.eggPoint(V4.x, V4.y, V4.z, _b);
    V4.copy(d).addScaledVector(t2, e).normalize(); L.eggPoint(V4.x, V4.y, V4.z, _c);
    V4.set(_b[0] - _a[0], _b[1] - _a[1], _b[2] - _a[2]);
    V5.set(_c[0] - _a[0], _c[1] - _a[1], _c[2] - _a[2]);
    V4.cross(V5).normalize();
    if (V4.x * _a[0] + V4.y * _a[1] + V4.z * _a[2] < 0) V4.negate();
    out[0] = V4.x; out[1] = V4.y; out[2] = V4.z;
    return out;
  }
  function surfaceData(ico) {
    var n = ico.vCount, P = new Float32Array(n * 3), N = new Float32Array(n * 3), o = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var x = ico.verts[i * 3], y = ico.verts[i * 3 + 1], z = ico.verts[i * 3 + 2];
      L.eggPoint(x, y, z, o); P[i * 3] = o[0]; P[i * 3 + 1] = o[1]; P[i * 3 + 2] = o[2];
      eggNormal(x, y, z, o); N[i * 3] = o[0]; N[i * 3 + 1] = o[1]; N[i * 3 + 2] = o[2];
    }
    return { P: P, N: N };
  }

  // =========================================================================
  // 白身
  // =========================================================================
  var IW = buildIco(CFG.WHITE_DETAIL), WS = surfaceData(IW), nW = IW.vCount;
  var wPos = new Float32Array(WS.P), wCol = new Float32Array(nW * 3), wDisp = new Float32Array(nW), wJag = new Float32Array(nW), wBase = new Float32Array(nW * 3);
  var wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
  wGeo.setIndex(new THREE.BufferAttribute(IW.index, 1));
  var C_WHITE = new THREE.Color(0xfffcf6), C_DAMAGE = new THREE.Color(0xcfbf9f), C_YOLK = new THREE.Color(0xffa412);
  var rimU = { value: new THREE.Color(0xfff0e0).multiplyScalar(0.28) };
  var WHITE_DEF = { color: new THREE.Color(0xffffff), roughness: 0.4, metalness: 0, clearcoat: 0.4, sheen: 0.5, emissive: new THREE.Color(0x221a12), rim: new THREE.Color(0xfff0e0).multiplyScalar(0.28) };
  var whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: WHITE_DEF.roughness, metalness: 0,
    clearcoat: WHITE_DEF.clearcoat, clearcoatRoughness: 0.3, sheen: WHITE_DEF.sheen, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffeedd),
    emissive: WHITE_DEF.emissive.clone()
  });
  // 縁がほんのり明るくなる＝光が透けて回り込んだような（なんちゃってSSS）
  whiteMat.onBeforeCompile = function (sh) {
    sh.uniforms.uRim = rimU;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>',
      'gl_FragColor.rgb += uRim * pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);\n#include <tonemapping_fragment>');
  };
  var whiteMesh = new THREE.Mesh(wGeo, whiteMat);
  egg.add(whiteMesh);
  var whiteDirty = false;

  function resetWhite() {
    wPos.set(WS.P); wDisp.fill(0);
    for (var i = 0; i < nW; i++) {
      var v = 0.985 + Math.random() * 0.015;
      wBase[i * 3] = C_WHITE.r * v; wBase[i * 3 + 1] = C_WHITE.g * v; wBase[i * 3 + 2] = C_WHITE.b * v;
      wJag[i] = Math.random();
    }
    wCol.set(wBase);
    whiteMat.color.copy(WHITE_DEF.color); whiteMat.metalness = 0; whiteMat.roughness = WHITE_DEF.roughness;
    whiteMat.sheen = WHITE_DEF.sheen; whiteMat.emissive.copy(WHITE_DEF.emissive); rimU.value.copy(WHITE_DEF.rim);
    whiteDirty = true;
  }

  // 白身を削る（頂点を内側にへこませて色を変える）
  function gouge(lx, ly, lz, radius, depth) {
    var r2 = radius * radius, yolk = G && G.mode.yolk;
    for (var i = 0; i < nW; i++) {
      var k = i * 3, dx = WS.P[k] - lx, dy = WS.P[k + 1] - ly, dz = WS.P[k + 2] - lz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r2) continue;
      var f = 1 - d2 / r2; f *= f;
      var amt = depth * f * (0.6 + 0.8 * wJag[i]);
      wDisp[i] = Math.min(0.17, Math.max(wDisp[i], amt) + amt * 0.3);
      var dd = wDisp[i];
      wPos[k] = WS.P[k] - WS.N[k] * dd; wPos[k + 1] = WS.P[k + 1] - WS.N[k + 1] * dd; wPos[k + 2] = WS.P[k + 2] - WS.N[k + 2] * dd;
      var t = Math.min(1, dd / 0.025), y = yolk ? L.clamp((dd - 0.06) / 0.04, 0, 1) : 0;
      for (var c = 0; c < 3; c++) {
        var base = wBase[k + c], dm = c === 0 ? C_DAMAGE.r : c === 1 ? C_DAMAGE.g : C_DAMAGE.b, yk = c === 0 ? C_YOLK.r : c === 1 ? C_YOLK.g : C_YOLK.b;
        var v = base + (dm - base) * t;
        wCol[k + c] = v + (yk - v) * y;
      }
    }
    whiteDirty = true;
  }

  // =========================================================================
  // 殻（かけらの集まり）
  // =========================================================================
  var IS = buildIco(CFG.SHELL_DETAIL), SS = surfaceData(IS), nSV = IS.vCount, nST = IS.tCount, sIdx = IS.index;
  var triNbr = new Int32Array(nST * 3).fill(-1), triC = new Float32Array(nST * 3);
  (function () {
    var em = new Map();
    for (var t = 0; t < nST; t++) {
      for (var e = 0; e < 3; e++) {
        var a = sIdx[t * 3 + e], b = sIdx[t * 3 + (e + 1) % 3];
        var k = a < b ? a * nSV + b : b * nSV + a, o = em.get(k);
        if (o === undefined) em.set(k, t * 3 + e);
        else { triNbr[t * 3 + e] = (o / 3) | 0; triNbr[o] = t; }
      }
      var x = 0, y = 0, z = 0;
      for (var j = 0; j < 3; j++) { var v = sIdx[t * 3 + j] * 3; x += IS.verts[v]; y += IS.verts[v + 1]; z += IS.verts[v + 2]; }
      var l = Math.hypot(x, y, z) || 1;
      triC[t * 3] = x / l; triC[t * 3 + 1] = y / l; triC[t * 3 + 2] = z / l;
    }
  })();

  var shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  var shellMesh = new THREE.Mesh(new THREE.BufferGeometry(), shellMat);
  egg.add(shellMesh);
  var frags = [], attached = new Uint8Array(0), cracked = new Uint8Array(0), triFrag = new Int32Array(0), vBorder = new Uint8Array(0);
  var sPos, sNor, sCol, seeds = null, seedToFrag = null, totalOuterTris = 0, attachedTris = 0, attachedCount = 0;
  var shellPosDirty = false, shellColDirty = false;
  var C_MEMBRANE = new THREE.Color(0xf7f2ea), shellBase = new THREE.Color(), crackCol = new THREE.Color();

  function genShell() {
    var EG = (G && G.egg) || L.EGGS[0];
    var N = EG.frags || CFG.FRAGMENTS, i, t, k;
    seeds = new Float32Array(N * 3);
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)));
    var ga = Math.PI * (3 - Math.sqrt(5)), v = new THREE.Vector3();
    for (i = 0; i < N; i++) {
      var y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = ga * i;
      v.set(Math.cos(th) * r + rand(-0.07, 0.07), y + rand(-0.07, 0.07), Math.sin(th) * r + rand(-0.07, 0.07)).normalize().applyQuaternion(q);
      seeds[i * 3] = v.x; seeds[i * 3 + 1] = v.y; seeds[i * 3 + 2] = v.z;
    }
    var ph = []; for (i = 0; i < 6; i++) ph.push(rand(0, 6.283));
    var tf = new Int32Array(nST);
    for (t = 0; t < nST; t++) {
      var cx = triC[t * 3], cy = triC[t * 3 + 1], cz = triC[t * 3 + 2];
      var px = cx + 0.035 * (Math.sin(9 * cy + ph[0]) + 0.5 * Math.sin(17 * cz + ph[1]));
      var py = cy + 0.035 * (Math.sin(9 * cz + ph[2]) + 0.5 * Math.sin(17 * cx + ph[3]));
      var pz = cz + 0.035 * (Math.sin(9 * cx + ph[4]) + 0.5 * Math.sin(17 * cy + ph[5]));
      var best = 0, bd = -9;
      for (var s = 0; s < N; s++) {
        var d = seeds[s * 3] * px + seeds[s * 3 + 1] * py + seeds[s * 3 + 2] * pz;
        if (d > bd) { bd = d; best = s; }
      }
      tf[t] = best;
    }
    // 孤立した三角形をならす
    for (var it = 0; it < 2; it++) {
      for (t = 0; t < nST; t++) {
        var a = tf[triNbr[t * 3]], b = tf[triNbr[t * 3 + 1]], c = tf[triNbr[t * 3 + 2]], me = tf[t];
        if (a !== me && b !== me && c !== me) tf[t] = (b === c) ? b : a;
      }
    }
    // かけらを作る
    seedToFrag = new Int32Array(N).fill(-1);
    frags = [];
    var tFrag = new Int32Array(nST);
    for (t = 0; t < nST; t++) {
      var sd = tf[t];
      if (seedToFrag[sd] < 0) { seedToFrag[sd] = frags.length; frags.push({ tris: [], nbs: [], edges: [], bset: {}, c: new THREE.Vector3(), n: new THREE.Vector3() }); }
      tFrag[t] = seedToFrag[sd];
      frags[tFrag[t]].tris.push(t);
    }
    var F = frags.length, o = [0, 0, 0];
    for (i = 0; i < F; i++) {
      var f = frags[i], nb = {}, dx = 0, dy = 0, dz = 0;
      for (k = 0; k < f.tris.length; k++) {
        t = f.tris[k];
        dx += triC[t * 3]; dy += triC[t * 3 + 1]; dz += triC[t * 3 + 2];
        for (var e = 0; e < 3; e++) {
          var ot = tFrag[triNbr[t * 3 + e]];
          if (ot !== i) {
            nb[ot] = 1; f.edges.push(t * 3 + e);
            f.bset[sIdx[t * 3 + e]] = 1; f.bset[sIdx[t * 3 + (e + 1) % 3]] = 1;
          }
        }
      }
      f.nbs = Object.keys(nb).map(Number);
      var l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      L.eggPoint(dx, dy, dz, o); f.c.set(o[0], o[1], o[2]);
      eggNormal(dx, dy, dz, o); f.n.set(o[0], o[1], o[2]);
    }
    // 殻の色と模様（たまごの種類ごと）
    shellBase.setHex(EG.shell);
    crackCol.copy(shellBase).multiplyScalar(EG.pattern === 'metal' || EG.pattern === 'moon' ? 0.45 : 0.36);
    var vc = new Float32Array(nSV * 3), cc = new THREE.Color(), spotC = new THREE.Color(EG.spot || 0x000000);
    var sph = []; for (i = 0; i < 8; i++) sph.push(rand(0, 6.283));
    var EASTER = [0xff9fb8, 0x8fd3ff, 0xa8e6a0, 0xffd36e, 0xc9a8ff];
    var craters = []; for (i = 0; i < 14; i++) { var cv = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); craters.push([cv, rand(0.08, 0.22)]); }
    for (i = 0; i < nSV; i++) {
      var px3 = SS.P[i * 3], py3 = SS.P[i * 3 + 1], pz3 = SS.P[i * 3 + 2];
      var hl = Math.hypot(px3, py3, pz3) || 1, ux = px3 / hl, uy = py3 / hl, uz = pz3 / hl;
      var m = 0.93 + Math.random() * 0.07;
      if (Math.random() < 0.035) m *= 0.8;
      cc.copy(shellBase);
      if (EG.pattern === 'spots') {
        var nz = Math.sin(ux * 7 + sph[0]) * Math.sin(uy * 9 + sph[1]) * Math.sin(uz * 8 + sph[2]) + 0.6 * Math.sin(ux * 17 + uy * 13 + sph[3]) * Math.sin(uz * 15 + sph[4]);
        if (nz > 0.45) cc.lerp(spotC, Math.min(1, (nz - 0.45) * 2.4));
      } else if (EG.pattern === 'easter') {
        var band = Math.floor((uy + 1) * 3.5) % EASTER.length;
        cc.setHex(EASTER[band]);
        var dots = Math.sin(Math.atan2(uz, ux) * 9 + sph[0]) * Math.sin(uy * 24 + sph[1]);
        if (dots > 0.82) cc.setHex(0xffffff);
      } else if (EG.pattern === 'pores') {
        if (Math.random() < 0.08) m *= 0.86;
      } else if (EG.pattern === 'mottle') {
        var mt = Math.sin(ux * 11 + sph[0]) + Math.sin(uy * 13 + sph[1]) + Math.sin(uz * 9 + sph[2]);
        cc.lerp(spotC, Math.max(0, Math.min(1, mt * 0.35 + 0.3)));
      } else if (EG.pattern === 'moon') {
        for (var ci = 0; ci < craters.length; ci++) {
          var dd = ux * craters[ci][0].x + uy * craters[ci][0].y + uz * craters[ci][0].z, ang = Math.acos(Math.max(-1, Math.min(1, dd)));
          if (ang < craters[ci][1]) { m *= 0.78 + 0.22 * (ang / craters[ci][1]); }
        }
      } else if (EG.pattern === 'metal') {
        m = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(uy * 6 + sph[0]));
      } else if (EG.pattern === 'xmas') {
        // オーナメント: 上は赤・下は緑、まん中に金の帯（白い水玉）、たての金のリボン、ところどころ白い雪の粒
        var ay = Math.abs(uy), an = Math.atan2(uz, ux), rib = Math.abs(Math.sin(an + sph[5]));
        m = 0.97 + Math.random() * 0.03;
        if (ay < 0.11) { cc.setHex(0xe3b444); if (Math.sin(an * 12) > 0.7 && ay < 0.06) cc.setHex(0xfff6dc); }
        else if (ay < 0.16) cc.setHex(0x1f7a46);
        else if (rib < 0.07) cc.setHex(0xe3b444);
        else if (Math.abs(ay - 0.6) < 0.035) cc.setHex(0xf2e6c4);
        else {
          cc.setHex(uy > 0 ? 0xc62a3a : 0x1f7a46);
          var sn = Math.sin(an * 7 + (uy > 0 ? 0 : 0.45)) * Math.sin(uy * 19 + sph[1]);
          if (sn > 0.86) cc.setHex(0xffffff);
        }
      }
      vc[i * 3] = cc.r * m; vc[i * 3 + 1] = cc.g * m; vc[i * 3 + 2] = cc.b * m;
    }
    // 1本のジオメトリにまとめる（外面＋かけらの縁の側面）
    var total = 0;
    for (i = 0; i < F; i++) total += frags[i].tris.length * 3 + frags[i].edges.length * 6;
    sPos = new Float32Array(total * 3); sNor = new Float32Array(total * 3); sCol = new Float32Array(total * 3);
    vBorder = new Uint8Array(total); triFrag = new Int32Array(total / 3);
    var P = SS.P, Nn = SS.N, OUT = CFG.SHELL_OUT, IN = CFG.SHELL_IN, w = 0;
    function put(x, y, z, nx, ny, nz, r, g, b) {
      var j = w * 3;
      sPos[j] = x; sPos[j + 1] = y; sPos[j + 2] = z; sNor[j] = nx; sNor[j + 1] = ny; sNor[j + 2] = nz;
      sCol[j] = r; sCol[j + 1] = g; sCol[j + 2] = b; w++;
    }
    totalOuterTris = 0;
    for (i = 0; i < F; i++) {
      var fr = frags[i], tint = 0.96 + Math.random() * 0.06;
      fr.start = w;
      for (k = 0; k < fr.tris.length; k++) {
        t = fr.tris[k];
        for (var jj = 0; jj < 3; jj++) {
          var vi = sIdx[t * 3 + jj], p3 = vi * 3;
          vBorder[w] = fr.bset[vi] ? 1 : 0;
          put(P[p3] + Nn[p3] * OUT, P[p3 + 1] + Nn[p3 + 1] * OUT, P[p3 + 2] + Nn[p3 + 2] * OUT, Nn[p3], Nn[p3 + 1], Nn[p3 + 2],
            vc[p3] * tint, vc[p3 + 1] * tint, vc[p3 + 2] * tint);
        }
      }
      totalOuterTris += fr.tris.length;
      fr.outerEnd = w;
      for (k = 0; k < fr.edges.length; k++) {
        var be = fr.edges[k], tt = (be / 3) | 0, ee = be % 3;
        var A = sIdx[tt * 3 + ee] * 3, B = sIdx[tt * 3 + (ee + 1) % 3] * 3;
        var nx = Nn[A] + Nn[B], ny = Nn[A + 1] + Nn[B + 1], nz = Nn[A + 2] + Nn[B + 2];
        var ex = P[B] - P[A], ey = P[B + 1] - P[A + 1], ez = P[B + 2] - P[A + 2];
        // outward = (b - a) × n
        var ox = ey * nz - ez * ny, oy = ez * nx - ex * nz, oz = ex * ny - ey * nx, ol = Math.hypot(ox, oy, oz) || 1;
        ox /= ol; oy /= ol; oz /= ol;
        var mr = C_MEMBRANE.r, mg = C_MEMBRANE.g, mb = C_MEMBRANE.b;
        var oAx = P[A] + Nn[A] * OUT, oAy = P[A + 1] + Nn[A + 1] * OUT, oAz = P[A + 2] + Nn[A + 2] * OUT;
        var iAx = P[A] + Nn[A] * IN, iAy = P[A + 1] + Nn[A + 1] * IN, iAz = P[A + 2] + Nn[A + 2] * IN;
        var oBx = P[B] + Nn[B] * OUT, oBy = P[B + 1] + Nn[B + 1] * OUT, oBz = P[B + 2] + Nn[B + 2] * OUT;
        var iBx = P[B] + Nn[B] * IN, iBy = P[B + 1] + Nn[B + 1] * IN, iBz = P[B + 2] + Nn[B + 2] * IN;
        put(oAx, oAy, oAz, ox, oy, oz, mr, mg, mb); put(iAx, iAy, iAz, ox, oy, oz, mr, mg, mb); put(oBx, oBy, oBz, ox, oy, oz, mr, mg, mb);
        put(oBx, oBy, oBz, ox, oy, oz, mr, mg, mb); put(iAx, iAy, iAz, ox, oy, oz, mr, mg, mb); put(iBx, iBy, iBz, ox, oy, oz, mr, mg, mb);
      }
      fr.end = w;
      for (k = fr.start / 3; k < fr.end / 3; k++) triFrag[k] = i;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(sNor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    g.computeBoundingSphere();
    shellMesh.geometry.dispose();
    shellMesh.geometry = g;
    attached = new Uint8Array(F).fill(1); cracked = new Uint8Array(F);
    attachedTris = totalOuterTris; attachedCount = F;
  }

  function crackFrag(fi) {
    var f = frags[fi], LIFT = 0.004;
    cracked[fi] = 1;
    for (var v = f.start; v < f.outerEnd; v++) {
      var j = v * 3;
      if (vBorder[v]) { sCol[j] = crackCol.r; sCol[j + 1] = crackCol.g; sCol[j + 2] = crackCol.b; }
      else { sCol[j] *= 0.94; sCol[j + 1] *= 0.94; sCol[j + 2] *= 0.94; }
      sPos[j] += sNor[j] * LIFT; sPos[j + 1] += sNor[j + 1] * LIFT; sPos[j + 2] += sNor[j + 2] * LIFT;
    }
    shellColDirty = shellPosDirty = true;
  }
  function bordersHole(fi) {
    var nb = frags[fi].nbs;
    for (var i = 0; i < nb.length; i++) if (!attached[nb[i]]) return true;
    return false;
  }
  function grabbable(fi) { return fi >= 0 && attached[fi] && (cracked[fi] || bordersHole(fi)); }
  function fragWorld(fi, out) { return egg.localToWorld(out.copy(frags[fi].c)); }
  function fragNormalWorld(fi, out) { return out.copy(frags[fi].n).applyQuaternion(egg.quaternion); }
  function coveringFrag(d) {
    if (!seeds) return -1;
    var best = 0, bd = -9;
    for (var s = 0; s < seedToFrag.length; s++) {
      var v = seeds[s * 3] * d[0] + seeds[s * 3 + 1] * d[1] + seeds[s * 3 + 2] * d[2];
      if (v > bd) { bd = v; best = s; }
    }
    return seedToFrag[best];
  }

  // かけら1枚ぶんの独立メッシュ（外面＋側面＋内側の薄皮）
  function fragMesh(fi) {
    var f = frags[fi], nAll = f.end - f.start, nOut = f.outerEnd - f.start, n = nAll + nOut;
    var p = new Float32Array(n * 3), nn = new Float32Array(n * 3), c = new Float32Array(n * 3);
    p.set(sPos.subarray(f.start * 3, f.end * 3)); nn.set(sNor.subarray(f.start * 3, f.end * 3)); c.set(sCol.subarray(f.start * 3, f.end * 3));
    var th = CFG.SHELL_OUT - CFG.SHELL_IN, w = nAll * 3;
    for (var t = 0; t < nOut; t += 3) {
      var order = [0, 2, 1];
      for (var j = 0; j < 3; j++) {
        var s = (f.start + t + order[j]) * 3;
        p[w] = sPos[s] - sNor[s] * th; p[w + 1] = sPos[s + 1] - sNor[s + 1] * th; p[w + 2] = sPos[s + 2] - sNor[s + 2] * th;
        nn[w] = -sNor[s]; nn[w + 1] = -sNor[s + 1]; nn[w + 2] = -sNor[s + 2];
        c[w] = C_MEMBRANE.r; c[w + 1] = C_MEMBRANE.g; c[w + 2] = C_MEMBRANE.b;
        w += 3;
      }
    }
    var cx = f.c.x + f.n.x * CFG.SHELL_OUT, cy = f.c.y + f.n.y * CFG.SHELL_OUT, cz = f.c.z + f.n.z * CFG.SHELL_OUT;
    for (var i = 0; i < n; i++) { p[i * 3] -= cx; p[i * 3 + 1] -= cy; p[i * 3 + 2] -= cz; }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.computeBoundingSphere();
    var m = new THREE.Mesh(g, shellMat);
    m.position.copy(egg.localToWorld(V1.set(cx, cy, cz)));
    m.quaternion.copy(egg.quaternion);
    return m;
  }

  // =========================================================================
  // 飛んでいく物体・パーティクル
  // =========================================================================
  var flying = [];
  var chunkGeo = new THREE.IcosahedronGeometry(1, 1);
  var chunkWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.45 });
  var yolkMat = new THREE.MeshStandardMaterial({ color: 0xffb21a, roughness: 0.35, emissive: 0x3a1a00 });

  function addFlying(mesh, vel, opts) {
    opts = opts || {};
    var fl = {
      mesh: mesh, vel: vel, axis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
      spin: opts.spin !== undefined ? opts.spin : rand(6, 13), life: opts.life || 2.6, max: opts.life || 2.6,
      held: !!opts.held, own: opts.own !== false, base: mesh.scale.x, flip: 0
    };
    flying.push(fl); scene.add(mesh);
    if (flying.length > CFG.MAX_FLYING) {
      for (var i = 0; i < flying.length; i++) if (!flying[i].held) { removeFlying(i); break; }
    }
    return fl;
  }
  function removeFlying(i) {
    var fl = flying[i];
    scene.remove(fl.mesh);
    if (fl.own) fl.mesh.geometry.dispose();
    flying.splice(i, 1);
  }
  function clearFlying() { while (flying.length) removeFlying(flying.length - 1); }

  function Particles(cap, size, additive) {
    this.cap = cap; this.n = 0; this.fade = !!additive;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.base = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3); this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage); this.ca.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa); this.geo.setAttribute('color', this.ca); this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
      size: size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, col, life, grav, drag) {
    var i = this.n < this.cap ? this.n++ : (Math.random() * this.cap) | 0, k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.base[k] = this.col[k] = col.r; this.base[k + 1] = this.col[k + 1] = col.g; this.base[k + 2] = this.col[k + 2] = col.b;
    this.life[i] = this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag || 0;
  };
  Particles.prototype.update = function (dt) {
    var i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      var k = i * 3;
      if (this.life[i] <= 0) {
        var last = --this.n, lk = last * 3;
        for (var c = 0; c < 3; c++) {
          this.pos[k + c] = this.pos[lk + c]; this.vel[k + c] = this.vel[lk + c];
          this.col[k + c] = this.col[lk + c]; this.base[k + c] = this.base[lk + c];
        }
        this.life[i] = this.life[last]; this.max[i] = this.max[last]; this.grav[i] = this.grav[last]; this.drag[i] = this.drag[last];
        continue;
      }
      var dr = Math.exp(-this.drag[i] * dt);
      this.vel[k + 1] -= this.grav[i] * dt;
      this.vel[k] *= dr; this.vel[k + 1] *= dr; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.fade) {
        var f = Math.min(1, this.life[i] / (this.max[i] * 0.5));
        this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
      }
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.pa.needsUpdate = true; this.ca.needsUpdate = true;
  };
  Particles.prototype.reset = function () { this.n = 0; this.geo.setDrawRange(0, 0); };

  var dust = new Particles(500, 0.12, false);
  var confetti = new Particles(220, 0.2, false);
  var sparkle = new Particles(200, 0.3, true);
  var TMPC = new THREE.Color();

  // ---- 塩 ----
  var SALT_CAP = 260, STUCK_CAP = 900;
  var salt = { pos: new Float32Array(SALT_CAP * 3), vel: new Float32Array(SALT_CAP * 3), bounced: new Uint8Array(SALT_CAP), n: 0 };
  var saltGeo = new THREE.BufferGeometry(), saltAttr = new THREE.BufferAttribute(salt.pos, 3);
  saltAttr.setUsage(THREE.DynamicDrawUsage); saltGeo.setAttribute('position', saltAttr); saltGeo.setDrawRange(0, 0);
  var saltMat = new THREE.PointsMaterial({ size: 0.07, map: dotTex, color: 0xffffff, transparent: true, depthWrite: false });
  var saltPts = new THREE.Points(saltGeo, saltMat); saltPts.frustumCulled = false; scene.add(saltPts);
  var stuck = { pos: new Float32Array(STUCK_CAP * 3), n: 0 };
  var stuckGeo = new THREE.BufferGeometry(), stuckAttr = new THREE.BufferAttribute(stuck.pos, 3);
  stuckGeo.setAttribute('position', stuckAttr); stuckGeo.setDrawRange(0, 0);
  var stuckPts = new THREE.Points(stuckGeo, saltMat); stuckPts.frustumCulled = false; egg.add(stuckPts);

  // ---- 残りわずかの殻の目印 ----
  var glowTex = canvasTex(64, function (ctx, s) {
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,240,170,0.9)'); g.addColorStop(0.4, 'rgba(255,215,90,0.5)'); g.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  var markers = [];
  for (var mi = 0; mi < 8; mi++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.visible = false; egg.add(sp); markers.push(sp);
  }

  // ---- レア: おじさんの顔 ----
  var faceMat, faceMesh, ojiTex, chickTex;
  (function buildFace() {
    // ひよこの顔（珍卵）
    chickTex = canvasTex(256, function (ctx) {
      ctx.fillStyle = 'rgba(255,214,60,0.0)'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#2a1a0c';
      ctx.beginPath(); ctx.arc(92, 112, 13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(164, 112, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(96, 107, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(168, 107, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,120,0.5)';
      ctx.beginPath(); ctx.arc(66, 146, 16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(190, 146, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9a1f';   // くちばし
      ctx.beginPath(); ctx.moveTo(110, 138); ctx.lineTo(146, 138); ctx.lineTo(128, 164); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e07a00'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(112, 140); ctx.lineTo(144, 140); ctx.stroke();
      ctx.strokeStyle = '#f0b400'; ctx.lineWidth = 6; ctx.lineCap = 'round';   // あたまの毛
      ctx.beginPath(); ctx.moveTo(128, 46); ctx.quadraticCurveTo(118, 22, 128, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(136, 48); ctx.quadraticCurveTo(150, 26, 146, 16); ctx.stroke();
    });
    var tex = ojiTex = canvasTex(256, function (ctx) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3a2618'; ctx.fillStyle = '#3a2618';
      ctx.fillStyle = 'rgba(255,110,110,0.35)';
      ctx.beginPath(); ctx.arc(72, 150, 15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(184, 150, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2618';
      ctx.lineWidth = 4;
      for (var k = 0; k < 3; k++) {   // バーコード
        ctx.beginPath(); ctx.moveTo(82, 52 - k * 9); ctx.quadraticCurveTo(128, 18 - k * 9, 174, 52 - k * 9); ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(100, 72); ctx.lineTo(156, 72); ctx.stroke();
      ctx.lineWidth = 10;   // 眉
      ctx.beginPath(); ctx.moveTo(68, 98); ctx.quadraticCurveTo(88, 80, 112, 94); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(144, 94); ctx.quadraticCurveTo(168, 80, 188, 98); ctx.stroke();
      ctx.beginPath(); ctx.arc(92, 117, 7, 0, Math.PI * 2); ctx.fill();   // 目
      ctx.beginPath(); ctx.arc(164, 117, 7, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(80, 106); ctx.lineTo(104, 108); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(152, 108); ctx.lineTo(176, 106); ctx.stroke();
      ctx.lineWidth = 5;    // 鼻
      ctx.beginPath(); ctx.moveTo(128, 110); ctx.quadraticCurveTo(114, 148, 134, 150); ctx.stroke();
      ctx.beginPath();      // ヒゲ
      ctx.moveTo(128, 162); ctx.quadraticCurveTo(102, 150, 76, 176); ctx.quadraticCurveTo(104, 174, 128, 170);
      ctx.quadraticCurveTo(152, 174, 180, 176); ctx.quadraticCurveTo(154, 150, 128, 162); ctx.fill();
      ctx.lineWidth = 5;    // 口
      ctx.beginPath(); ctx.arc(128, 182, 18, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    });
    var seg = 18, pos = [], uv = [], idx = [], o = [0, 0, 0], nn = [0, 0, 0];
    for (var j = 0; j <= seg; j++) {
      for (var i = 0; i <= seg; i++) {
        var u = i / seg, v = j / seg, az = (u - 0.5) * 1.25, elv = (v - 0.5) * 1.25 + 0.04;
        var dx = Math.sin(az) * Math.cos(elv), dy = Math.sin(elv), dz = Math.cos(az) * Math.cos(elv);
        L.eggPoint(dx, dy, dz, o); eggNormal(dx, dy, dz, nn);
        pos.push(o[0] + nn[0] * 0.006, o[1] + nn[1] * 0.006, o[2] + nn[2] * 0.006); uv.push(u, v);
      }
    }
    for (j = 0; j < seg; j++) for (i = 0; i < seg; i++) {
      var a = j * (seg + 1) + i, b = a + 1, c = a + seg + 2, d = a + seg + 1;
      idx.push(a, b, c, a, c, d);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    faceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    faceMesh = new THREE.Mesh(g, faceMat);
    faceMesh.visible = false;
    egg.add(faceMesh);
  })();

  // =========================================================================
  // カメラ
  // =========================================================================
  function fit() {
    var w = VW(), h = VH();
    renderer.setSize(w, h);
    camera.aspect = w / h;
    var tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var dist = Math.max(1.03 / (0.66 * tanH * camera.aspect), 2.7 / tanH);
    camera.position.set(0, dist * 0.14, dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(w, h, 0, h * 0.07, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    camBase.copy(camera.position);
    eggScreenR = (1.0 / (dist * tanH)) * (h / 2);
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camToward.copy(camera.position).normalize();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
  fit();

  // =========================================================================
  // ゲーム状態
  // =========================================================================
  var state = 'title';   // title | play | reveal | over | result
  var G = null;
  function pstat() { /* 統計は送らない */ }
  function pkey() { return null; }
  var peel = null, bigQ = [], bigT = 0;
  var rotVel = { x: 0, y: 0 }, wob = 0, wobV = 0, squash = 1, camShake = 0;
  var revealQ = new THREE.Quaternion(), revealFrom = new THREE.Quaternion();

  function newRound(modeKey, eggId) {
    var base = L.MODES[modeKey] || L.MODES.normal, eg = L.eggById(eggId || selEgg), m = L.applyEgg(base, eg);   // egg は3Dのたまご本体なので、種類は eg
    G = {
      modeKey: base.key, mode: m, egg: eg, daily: false, time: 0, timerOn: false, hp: 100, pressure: 0, bigLeft: m.bigPeels,
      saltBonus: 0, saltShakes: 0, cracksMade: 0, rare: 'none', endReason: '', seqT: 0, rareStep: 0, warnT: 0, hintT: 0, gold: 0
    };
    if (peel) endPeel(false);
    peel = null; bigQ = [];
    clearFlying(); dust.reset(); confetti.reset(); sparkle.reset();
    salt.n = 0; stuck.n = 0; stuckGeo.setDrawRange(0, 0); saltGeo.setDrawRange(0, 0);
    C_WHITE.setHex(eg.white);
    resetWhite();
    var metal = eg.pattern === 'metal' || eg.pattern === 'moon';
    shellMat.metalness = metal ? 0.75 : 0; shellMat.roughness = metal ? 0.28 : eg.pattern === 'xmas' ? 0.45 : 0.7;
    if ((eg.baseId || eg.id) === 'hiyoko' && faceMat) faceMat.map = chickTex; else if (faceMat) faceMat.map = ojiTex;
    if (faceMat) faceMat.needsUpdate = true;
    whiteMesh.visible = shellMesh.visible = true; stuckPts.visible = true;
    faceMesh.visible = false; faceMat.opacity = 0;
    genShell();
    egg.quaternion.setFromEuler(new THREE.Euler(rand(-0.25, 0.25), rand(0, 6.28), rand(-0.2, 0.2)));
    egg.position.set(0, 0, 0); squash = 1; wob = wobV = 0; rotVel.x = rotVel.y = 0;
    hideMarkers();
  }

  function startGame(modeKey, eggId, daily) {
    Snd.init();
    WP.closeClear(); closeFail();
    newRound(modeKey, eggId);
    G.daily = !!daily;
    G.day = jstDay();
    G.past = null;
    G.chanceUsed = false;
    state = 'play';
    WP.timer.reset(); WP.timer.start();   // 日付がかわったときに、遊んでいる途中で読みなおさないように（common.js）
    showScreen();
    el.hint.textContent = '';
  }

  function showScreen() {
    el.start.hidden = state !== 'title';
    var inGame = state === 'play' || state === 'reveal' || state === 'over';
    el.hud.hidden = !inGame;
    el.bottom.hidden = state !== 'play';
    el.hint.hidden = state !== 'play';
    el.ring.hidden = true;
    xmasSnow();
  }

  // =========================================================================
  // =========================================================================
  // 入力
  // =========================================================================
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function setRay(x, y) {
    ndc.set((x / VW()) * 2 - 1, -(y / VH()) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(x, y) {
    setRay(x, y);
    egg.updateMatrixWorld(true);
    var hits = ray.intersectObject(shellMesh, false);
    for (var i = 0; i < hits.length; i++) {
      var f = triFrag[hits[i].faceIndex];
      if (f >= 0 && attached[f]) return { type: 'shell', f: f, point: hits[i].point.clone(), local: egg.worldToLocal(hits[i].point.clone()) };
    }
    hits = ray.intersectObject(whiteMesh, false);
    if (hits.length) return { type: 'white', f: -1, point: hits[0].point.clone(), local: egg.worldToLocal(hits[0].point.clone()) };
    return null;
  }

  var pointers = new Map();
  var act = { type: 'none', id: -1, sx: 0, sy: 0, lx: 0, ly: 0, t0: 0, hit: null };
  var lastMoveT = 0, multi = { cx: 0, cy: 0, ang: 0 };
  var QA = new THREE.Quaternion();

  function rotateEgg(dx, dy) {
    QA.setFromAxisAngle(camUp, dx * CFG.ROT_SPEED); egg.quaternion.premultiply(QA);
    QA.setFromAxisAngle(camRight, dy * CFG.ROT_SPEED); egg.quaternion.premultiply(QA);
    egg.quaternion.normalize();
  }
  function twistEgg(da) { QA.setFromAxisAngle(camToward, -da); egg.quaternion.premultiply(QA); egg.quaternion.normalize(); }
  function multiState() {
    var arr = []; pointers.forEach(function (p) { arr.push(p); });
    var a = arr[0], b = arr[1];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  function canSpin() { return state !== 'reveal' || G.rareStep === 0 || G.rareStep >= 3; }

  function onDown(e) {
    if (e.preventDefault) e.preventDefault();
    Snd.init();
    try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
    pointers.set(e.pointerId, { x: ex(e), y: ey(e) });
    rotVel.x = rotVel.y = 0;
    if (pointers.size >= 2) {
      if (act.type === 'peel') endPeel(true);
      var m = multiState(); multi.cx = m.cx; multi.cy = m.cy; multi.ang = m.ang;
      act.type = 'multi';
      return;
    }
    act.id = e.pointerId; act.sx = act.lx = ex(e); act.sy = act.ly = ey(e); act.t0 = nowMs(); act.hit = null;
    lastMoveT = act.t0;
    if (state === 'play' && !bigQ.length) {
      var h = pick(ex(e), ey(e));
      act.hit = h;
      act.type = h ? (h.type === 'shell' ? 'pendShell' : 'pendWhite') : 'pendNone';
    } else act.type = 'rotate';
  }
  function onMove(e) {
    var p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = ex(e); p.y = ey(e);
    if (act.type === 'multi') {
      if (pointers.size < 2) return;
      var m = multiState();
      if (canSpin()) {
        rotateEgg(m.cx - multi.cx, m.cy - multi.cy);
        var da = m.ang - multi.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        twistEgg(da);
      }
      multi.cx = m.cx; multi.cy = m.cy; multi.ang = m.ang;
      return;
    }
    if (e.pointerId !== act.id) return;
    var t = nowMs();
    if (act.type.indexOf('pend') === 0) {
      if (Math.hypot(ex(e) - act.sx, ey(e) - act.sy) <= CFG.TAP_SLOP) return;
      if (act.type === 'pendShell' && state === 'play' && grabbable(act.hit.f)) {
        startPeel(act.hit, ex(e), ey(e), t);
        act.type = 'peel';
        return;
      }
      if (act.type === 'pendShell') toast('ヒビのない殻は剥けない！ まずタップでヒビを入れよう');
      act.type = 'rotate';
    }
    if (act.type === 'rotate') {
      var dx = ex(e) - act.lx, dy = ey(e) - act.ly, dtm = Math.max(4, t - lastMoveT) / 1000;
      if (canSpin()) rotateEgg(dx, dy);
      rotVel.x = rotVel.x * 0.4 + (dx / dtm) * 0.6; rotVel.y = rotVel.y * 0.4 + (dy / dtm) * 0.6;
      act.lx = ex(e); act.ly = ey(e); lastMoveT = t;
    } else if (act.type === 'peel') peelMove(ex(e), ey(e), t);
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (act.type === 'multi') {
      if (pointers.size === 1) {
        var it = pointers.entries().next().value;
        act.type = 'rotate'; act.id = it[0]; act.lx = it[1].x; act.ly = it[1].y; lastMoveT = nowMs();
        rotVel.x = rotVel.y = 0;
      } else if (pointers.size === 0) act.type = 'none';
      else { var m = multiState(); multi.cx = m.cx; multi.cy = m.cy; multi.ang = m.ang; }
      return;
    }
    if (e.pointerId !== act.id) return;
    var t = nowMs();
    if (act.type.indexOf('pend') === 0) {
      if (e.type === 'pointerup' && t - act.t0 < CFG.TAP_MAX_MS) onTap(act.hit, ex(e), ey(e));
    } else if (act.type === 'peel') endPeel(true);
    else if (act.type === 'rotate' && t - lastMoveT > 90) rotVel.x = rotVel.y = 0;
    act.type = 'none';
  }
  cvs.addEventListener('pointerdown', onDown);
  cvs.addEventListener('pointermove', onMove);
  cvs.addEventListener('pointerup', onUp);
  cvs.addEventListener('pointercancel', onUp);
  cvs.addEventListener('lostpointercapture', function (e) { if (pointers.has(e.pointerId)) onUp({ pointerId: e.pointerId, type: 'pointercancel', clientX: 0, clientY: 0 }); });

  // 遊ぶところの中だけ、スクロール・ズーム・長押しメニュー・文字えらびを止める（下の「このページについて」は読める）
  function inGame(t) { return !!(t && t.closest && t.closest('#yd-game')); }
  document.addEventListener('touchmove', function (e) { if (inGame(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { if (inGame(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { if (inGame(e.target)) e.preventDefault(); }, true);
  document.addEventListener('selectstart', function (e) { if (inGame(e.target)) e.preventDefault(); }, true);
  // たまご（3D の絵）の上では、長押しの虫めがね・ダブルタップの拡大をさせない（pointer のイベントはそのまま来る）
  cvs.addEventListener('touchstart', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (n) { document.addEventListener(n, function () { Snd.init(); }, true); });

  // =========================================================================
  // タップ（ヒビ・力み・爆発）
  // =========================================================================
  function onTap(h, x, y) {
    if (state !== 'play' || !h) return;
    G.timerOn = true;
    G.pressure += 1;
    var ratio = G.pressure / G.mode.pressureMax;
    if (ratio >= 1) { explode(); return; }
    if (ratio > 0.55) {
      Snd.creak();
      pop(x, y - 46, ratio > 0.8 ? 'やばい…！' : 'ミシミシ…', 'warn');
    }
    if (h.type === 'shell') crackAt(h.f, h.local, x, y);
    else { wobV += 2.2; Snd.poke(); pop(x, y, 'ぷにっ'); }
  }

  function crackAt(f0, lp, x, y) {
    var R = G.mode.crackR, newly = 0;
    for (var i = 0; i < frags.length; i++) {
      if (!attached[i] || cracked[i]) continue;
      var d = frags[i].c.distanceTo(lp);
      if (i === f0 || d < R * 0.55 || (d < R && Math.random() < 0.55)) { crackFrag(i); newly++; }
    }
    G.cracksMade += newly;
    if (newly) { Snd.crack(1); pop(x, y, 'パリッ'); } else { Snd.knock(); pop(x, y, 'コツッ'); }
    var wp = egg.localToWorld(V1.copy(lp));
    for (var k = 0; k < 10; k++) {
      TMPC.copy(shellBase).multiplyScalar(rand(0.7, 1.1));
      dust.spawn(wp.x, wp.y, wp.z, rand(-1.2, 1.2), rand(0, 2), rand(0.3, 1.8), TMPC, rand(0.4, 0.8), 9, 1);
    }
    wobV += 0.6;
  }

  // =========================================================================
  // 剥がす
  // =========================================================================
  var PW = new THREE.Vector3(), FW = new THREE.Vector3(), CW = new THREE.Vector3(), NW = new THREE.Vector3();
  var stamp = new Int32Array(1), stampN = 0;

  function startPeel(h, x, y, t) {
    var dx = x - act.sx, dy = y - act.sy, len = Math.hypot(dx, dy) || 1;
    G.timerOn = true;
    rotVel.x = rotVel.y = 0;
    peel = {
      front: h.f, list: [h.f], lx: x, ly: y, lt: t, speed: len / Math.max(0.016, (t - act.t0) / 1000), refX: dx / len, refY: dy / len,
      turn: 0, dist: 0, snapped: false, stress: 0, tears: 0, target: h.point.clone().addScaledVector(camToward, 0.35),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camToward, h.point.clone().addScaledVector(camToward, 0.35)), held: null
    };
    var fl = detach(h.f, { held: true });
    peel.held = fl;
    Snd.peel();
    el.ring.hidden = false;
    updateRing(x, y, 0);
  }

  function peelMove(x, y, t) {
    if (!peel) return;
    var dx = x - peel.lx, dy = y - peel.ly, len = Math.hypot(dx, dy), dt = Math.max(4, t - peel.lt) / 1000;
    peel.lx = x; peel.ly = y; peel.lt = t;
    peel.speed += (len / dt - peel.speed) * Math.min(1, dt / 0.07);
    if (len > 3) {
      var ix = dx / len, iy = dy / len;
      var ang = Math.acos(L.clamp(ix * peel.refX + iy * peel.refY, -1, 1));
      peel.turn += (ang - peel.turn) * Math.min(1, dt / 0.05);
      var k = Math.min(1, dt / 0.3);
      peel.refX += (ix - peel.refX) * k; peel.refY += (iy - peel.refY) * k;
      var rl = Math.hypot(peel.refX, peel.refY) || 1; peel.refX /= rl; peel.refY /= rl;
    }
    var speedR = peel.speed / eggScreenR;
    peel.stress = L.tearStress(speedR, peel.turn, false, G.mode.tearSpeed);
    updateRing(x, y, peel.stress);
    Snd.rustle(Math.min(1, speedR / G.mode.tearSpeed));
    setRay(x, y);
    ray.ray.intersectPlane(peel.plane, peel.target);
    if (peel.snapped || state !== 'play') return;
    peel.dist += len / eggScreenR;
    var n = 0;
    while (peel.dist >= CFG.PEEL_STEP && n < 3 && !peel.snapped && state === 'play') {
      peel.dist -= CFG.PEEL_STEP; n++;
      if (!peelStep(speedR, x, y)) { peel.dist = 0; break; }
    }
    if (peel) peel.dist = Math.min(peel.dist, CFG.PEEL_STEP);
  }

  // 剥がしの最前線の隣から、引っ張る向きにあるかけらを1枚はがす
  function peelStep(speedR, x, y) {
    PW.copy(camRight).multiplyScalar(peel.refX).addScaledVector(camUp, -peel.refY);
    fragWorld(peel.front, FW);
    if (stamp.length < frags.length) stamp = new Int32Array(frags.length);
    stampN++;
    var best = -1, bs = -1e9, from = Math.max(0, peel.list.length - 6);
    for (var i = from; i < peel.list.length; i++) {
      var nbs = frags[peel.list[i]].nbs;
      for (var j = 0; j < nbs.length; j++) {
        var c = nbs[j];
        if (!attached[c] || stamp[c] === stampN) continue;
        stamp[c] = stampN;
        fragWorld(c, CW).sub(FW);
        var dl = CW.length() || 1, along = CW.dot(PW) / dl;
        var sc = along + (cracked[c] ? 0.45 : 0) - dl * 1.2;
        if (sc > bs) { bs = sc; best = c; }
      }
    }
    if (best < 0 || bs < -0.9) return false;
    var unc = !cracked[best];
    var stress = L.tearStress(speedR, peel.turn, unc, G.mode.tearSpeed);
    fragNormalWorld(best, NW);
    var vel = new THREE.Vector3().copy(PW).multiplyScalar(1.4 + Math.min(4, speedR * 0.35)).addScaledVector(NW, 1.6);
    vel.y += 1.5;
    if (stress > 1) {
      var dmg = L.tearDamage(stress, G.mode.dmgMul);
      peel.tears++;
      Snd.tear();
      pop(x, y - 34, 'ブチッ！', 'bad');
      if (stress > CFG.SNAP_STRESS) { peel.snapped = true; pop(x, y + 30, 'ちぎれた！', 'bad'); Snd.rustle(0); }
      detach(best, { vel: vel });
      applyDamage(dmg, frags[best].c, stress);
    } else {
      Snd.peel();
      if (!unc && stress < 0.45 && Math.random() < 0.22) pop(x, y - 34, 'ツルッ', 'good');
      detach(best, { vel: vel });
    }
    peel.list.push(best); peel.front = best;
    if (peel.list.length > 30) peel.list = peel.list.slice(-8);
    checkClear();
    return true;
  }

  function endPeel(throwIt) {
    if (!peel) return;
    var fl = peel.held;
    if (fl && fl.held) {
      fl.held = false;
      var sp = Math.min(10, peel.speed / eggScreenR * 0.7);
      fl.vel.copy(camRight).multiplyScalar(peel.refX * sp).addScaledVector(camUp, -peel.refY * sp);
      fl.vel.y += throwIt ? 2.5 : 1; fl.vel.addScaledVector(camToward, 1.2);
      fl.life = 2.2;
    }
    Snd.rustle(0);
    el.ring.hidden = true;
    peel = null;
    checkClear();
  }

  function updateRing(x, y, s) {
    el.ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (0.8 + Math.min(1.6, s) * 0.35).toFixed(2) + ')';
    el.ring.style.borderColor = s < 0.6 ? '#7fe08a' : s < 1 ? '#ffd75e' : '#ff5a4a';
  }

  // かけらを殻から外して飛ばす
  function detach(fi, opts) {
    if (!attached[fi]) return null;
    opts = opts || {};
    var m = fragMesh(fi), f = frags[fi];
    sPos.fill(0, f.start * 3, f.end * 3); shellPosDirty = true;
    attached[fi] = 0; attachedTris -= f.tris.length; attachedCount--;
    var vel = opts.vel;
    if (!vel) {
      fragNormalWorld(fi, NW);
      vel = new THREE.Vector3().copy(NW).multiplyScalar(rand(1.5, 3)); vel.y += rand(1, 3);
      vel.x += rand(-0.8, 0.8);
    }
    return addFlying(m, vel, { held: opts.held, life: opts.life || 2.6 });
  }

  function applyDamage(dmg, lc, scale) {
    if (dmg <= 0 || !G) return;
    G.hp = Math.max(0, G.hp - dmg);
    var gs = G.mode.gouge;
    gouge(lc.x, lc.y, lc.z, (0.11 + 0.05 * Math.min(2, scale || 1)) * gs, (0.024 + 0.0025 * dmg) * gs);
    var wp = egg.localToWorld(V1.copy(lc));
    var nCh = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (var i = 0; i < nCh; i++) {
      var m = new THREE.Mesh(chunkGeo, G.mode.yolk && G.hp < 50 && Math.random() < 0.5 ? yolkMat : chunkWhiteMat);
      m.scale.setScalar(rand(0.04, 0.08)); m.position.copy(wp);
      addFlying(m, new THREE.Vector3(rand(-1.5, 1.5), rand(1.5, 3.5), rand(0.5, 2)), { own: false, life: 1.8 });
    }
    el.hpRow.classList.remove('hit'); void el.hpRow.offsetWidth; el.hpRow.classList.add('hit');
    if (G.hp <= 0 && state === 'play') collapse();
  }

  // =========================================================================
  // 特殊ボタン
  // =========================================================================
  function bigPeel() {
    if (state !== 'play' || G.bigLeft <= 0 || bigQ.length || peel) return;
    if (attachedCount === 0) return;
    G.bigLeft--; G.timerOn = true;
    // カメラに一番向いているかけらから広げる
    var start = -1, bd = -9;
    for (var i = 0; i < frags.length; i++) {
      if (!attached[i]) continue;
      var d = fragNormalWorld(i, NW).dot(camToward);
      if (d > bd) { bd = d; start = i; }
    }
    var K = attachedCount <= 20 ? attachedCount : Math.max(10, Math.ceil(attachedCount * CFG.BIG_PEEL_FRAC));
    var seen = {}, queue = [start], set = []; seen[start] = 1;
    while (queue.length && set.length < K) {
      var f = queue.shift(); set.push(f);
      var nb = frags[f].nbs.slice().sort(function () { return Math.random() - 0.5; });
      for (var j = 0; j < nb.length; j++) if (attached[nb[j]] && !seen[nb[j]]) { seen[nb[j]] = 1; queue.push(nb[j]); }
    }
    var r = Math.random(), outcome, budget;
    if (r < 0.5) { outcome = 'clean'; budget = rand(0, 4); }
    else if (r < 0.88) { outcome = 'tear'; budget = rand(10, 20); }
    else { outcome = 'disaster'; budget = rand(28, 40); }
    budget *= G.mode.dmgMul;
    var nG = budget < 1 ? 0 : Math.max(1, Math.round(budget / 4.5));
    var gi = {};
    for (var k = 0; k < nG; k++) gi[(Math.random() * set.length) | 0] = 1;
    var gl = Object.keys(gi).length || 1;
    bigQ = set.map(function (fi, n) { return { f: fi, t: n * 0.014, dmg: gi[n] ? budget / gl : 0 }; });
    bigT = 0;
    Snd.big();
    var msg = outcome === 'clean' ? 'ズルッ！！ 大成功' : outcome === 'tear' ? 'ベリベリッ… 白身も持っていかれた' : '大惨事！！';
    banner(msg, outcome === 'clean' ? '' : 'ハイリスクにはわけがある');
  }

  function shakeSalt() {
    if (!G || (state !== 'play' && state !== 'reveal' && state !== 'result')) return;
    G.saltShakes++;
    var bonus = false;
    if (state === 'play' && G.saltBonus < 3) { G.saltBonus++; bonus = true; }
    for (var i = 0; i < 70; i++) {
      var k;
      if (salt.n < SALT_CAP) k = salt.n++; else k = (Math.random() * SALT_CAP) | 0;
      salt.pos[k * 3] = rand(-0.9, 0.9); salt.pos[k * 3 + 1] = rand(2.3, 3.2); salt.pos[k * 3 + 2] = rand(-0.4, 0.9);
      salt.vel[k * 3] = rand(-0.2, 0.2); salt.vel[k * 3 + 1] = rand(-2.5, -1); salt.vel[k * 3 + 2] = rand(-0.2, 0.2);
      salt.bounced[k] = 0;
    }
    Snd.salt();
    var cx = VW() / 2, cy = VH() * 0.22;
    if (bonus) pop(cx, cy, '塩ボーナス +1点（' + G.saltBonus + '/3）', 'salt');
    else if (state === 'play') pop(cx, cy, G.saltShakes > 6 ? '塩分過多。体が心配' : 'しょっぱい…（ボーナスは3回まで）', 'salt');
    else pop(cx, cy, 'パラパラ…', 'salt');
  }

  // =========================================================================
  // 終わり方
  // =========================================================================
  function checkClear() {
    if (state === 'play' && attachedCount === 0 && !bigQ.length) complete();
  }
  function complete() {
    if (peel) endPeel(true);
    state = 'reveal'; G.timerOn = false; G.endReason = 'clear'; G.seqT = 0; G.rareStep = 0;
    pstat('clear', pkey(), G.time);
    G.rare = G.egg && (G.egg.baseId || G.egg.id) === 'hiyoko' ? 'hiyoko' : L.rollRare(Math.random(), G.modeKey);
    showScreen();
    banner('ツルンッ！！', '剥けた！');
    Snd.chime();
    for (var i = 0; i < 160; i++) {
      TMPC.setHSL(Math.random(), 0.85, 0.62);
      confetti.spawn(rand(-0.5, 0.5), rand(-0.3, 0.5), rand(0, 0.6), rand(-4, 4), rand(3, 8), rand(-1.5, 2.5), TMPC, rand(1.8, 3), 5, 1.4);
    }
    rotVel.x = 900; rotVel.y = 0;
  }
  function explode() {
    if (peel) endPeel(true);
    // もう1回チャンス用に、爆発する前の殻を覚えておく
    G.snap = { attached: attached.slice(), tris: attachedTris, count: attachedCount, pos: sPos ? sPos.slice() : null };
    state = 'over'; G.timerOn = false; G.endReason = 'explode'; G.seqT = 0;
    pstat('lose', pkey());
    showScreen();
    whiteMesh.visible = false; shellMesh.visible = false; stuckPts.visible = false; hideMarkers();
    var list = [];
    for (var i = 0; i < frags.length; i++) if (attached[i]) list.push(i);
    list.sort(function () { return Math.random() - 0.5; });
    for (i = 0; i < list.length; i++) {
      if (i < 45) {
        var f = list[i];
        fragNormalWorld(f, NW);
        detach(f, { vel: new THREE.Vector3().copy(NW).multiplyScalar(rand(5, 11)).add(V2.set(0, rand(1, 4), 0)), life: 2.4 });
      } else { attached[list[i]] = 0; attachedCount--; }
    }
    for (i = 0; i < 28; i++) {
      var m = new THREE.Mesh(chunkGeo, i % 3 === 0 ? yolkMat : chunkWhiteMat);
      m.scale.setScalar(rand(0.1, 0.28));
      V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      m.position.copy(V1).multiplyScalar(0.5);
      addFlying(m, V1.clone().multiplyScalar(rand(4, 10)).add(V2.set(0, 3, 0)), { own: false, life: 2.4 });
    }
    for (i = 0; i < 160; i++) {
      TMPC.setHex(Math.random() < 0.4 ? 0xffb21a : 0xfffaf0);
      V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      dust.spawn(V1.x * 0.6, V1.y * 0.6, V1.z * 0.6, V1.x * rand(3, 9), V1.y * rand(3, 9) + 2, V1.z * rand(3, 9), TMPC, rand(0.8, 1.6), 9, 0.6);
    }
    camShake = 0.5;
    el.flash.classList.remove('go'); void el.flash.offsetWidth; el.flash.classList.add('go');
    Snd.boom();
    banner('ドカーン！！', '力を込めすぎた');
  }
  function collapse() {
    if (peel) endPeel(false);
    state = 'over'; G.timerOn = false; G.endReason = 'collapse'; G.seqT = 0;
    pstat('lose', pkey());
    showScreen();
    for (var i = 0; i < 6; i++) {
      V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      var o = L.eggPoint(V1.x, V1.y, V1.z, [0, 0, 0]);
      gouge(o[0], o[1], o[2], 0.35 * G.mode.gouge, 0.08);
    }
    Snd.tear(); Snd.sad();
    banner('ぐしゃっ…', '白身が崩壊した');
  }

  // =========================================================================
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
  // =========================================================================
  // UI 部品
  // =========================================================================
  var popCount = 0;
  function pop(x, y, text, cls) {
    if (popCount > 14) return;
    var d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    el.fx.appendChild(d); popCount++;
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); popCount--; }, 900);
  }
  var toastTimer = 0, lastToast = 0;
  function toast(text) {
    var t = nowMs();
    if (t - lastToast < 2500) return;
    lastToast = t;
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }
  function banner(text, sub) {
    el.banner.innerHTML = '';
    el.banner.appendChild(document.createTextNode(text));
    if (sub) { var s = document.createElement('small'); s.textContent = sub; el.banner.appendChild(s); }
    el.banner.classList.remove('show'); void el.banner.offsetWidth; el.banner.classList.add('show');
  }
  function hideMarkers() { for (var i = 0; i < markers.length; i++) markers[i].visible = false; }

  // ミュートは WebPlay の 🔊 ボタン（web.yudetamago.set）。押されたら音もあわせる
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
  var hud = { time: '', rank: '', peel: -1, hp: -1, big: -1, power: -1, hint: '' };
  function updateHud() {
    if (!G) return;
    var t = G.time.toFixed(1);
    if (t !== hud.time) { el.time.textContent = t; hud.time = t; }
    var dmg = 100 - G.hp, r = L.computeRank(G.time, dmg, G.saltBonus, G.modeKey);
    if (r !== hud.rank) { el.rank.textContent = r; el.rank.className = 'r-' + r; hud.rank = r; }
    var pct = Math.floor((1 - attachedTris / totalOuterTris) * 100);
    if (pct !== hud.peel) { el.peelBar.style.width = pct + '%'; el.peelPct.textContent = pct + '%'; hud.peel = pct; }
    var hp = Math.ceil(G.hp);
    if (hp !== hud.hp) {
      el.hpBar.style.width = hp + '%'; el.hpVal.textContent = hp;
      el.hpBar.style.background = hp > 60 ? '#7fe08a' : hp > 30 ? '#ffd75e' : '#ff6a5a';
      hud.hp = hp;
    }
    if (G.bigLeft !== hud.big) {
      el.bigLeft.textContent = G.bigLeft > 0 ? 'ハイリスク・残り' + G.bigLeft + '回' : 'もう使えない';
      el.btnBig.disabled = G.bigLeft <= 0; hud.big = G.bigLeft;
    }
    var pr = Math.min(1, G.pressure / G.mode.pressureMax), pw = Math.round(pr * 100);
    if (pw !== hud.power) {
      el.powerBar.style.width = pw + '%';
      el.power.className = pr > 0.55 ? 'hot' : '';
      el.vignette.style.opacity = pr > 0.5 ? ((pr - 0.5) * 1.4).toFixed(2) : '0';
      hud.power = pw;
    }
    var hint;
    if (state !== 'play') hint = '';
    else if (G.cracksMade === 0) hint = '殻をタップしてヒビを入れよう（連打しすぎ注意）';
    else if (attachedCount === frags.length) hint = 'ヒビの入ったところからドラッグで剥がそう';
    else if (peel) hint = peel.snapped ? '一度はなして、別のところから' : 'ゆっくり・まっすぐ引くとキレイに剥ける';
    else if (attachedCount <= 8) hint = '残りわずか！ 光っている殻を探そう（裏側も）';
    else hint = '何もない所をドラッグ／2本指でたまごを回せる';
    if (hint !== hud.hint) { el.hint.textContent = hint; hud.hint = hint; }
  }

  // =========================================================================
  // メインループ
  // =========================================================================
  var CHICK = new THREE.Color(0xffd84a), GOLD = new THREE.Color(0xffc23a), GOLD_EM = new THREE.Color(0x3a2200), GOLD_RIM = new THREE.Color(0xffd27a).multiplyScalar(0.45);
  var Q_UP = new THREE.Vector3(0, 0.05, 1).normalize();

  function update(dt) {
    var i;
    if (G && state === 'play' && G.timerOn) G.time += dt;
    if (G) G.pressure = L.pressureAfter(G.pressure, dt, G.mode.pressureDecay);

    // 回転の慣性・タイトルでのゆっくり回転
    if (act.type !== 'rotate' && act.type !== 'multi' && act.type !== 'peel') {
      if (Math.abs(rotVel.x) + Math.abs(rotVel.y) > 2 && canSpin()) {
        rotateEgg(rotVel.x * dt, rotVel.y * dt);
        var dec = Math.exp(-(state === 'reveal' ? 2.2 : 3.5) * dt);
        rotVel.x *= dec; rotVel.y *= dec;
      } else if (state === 'title' || state === 'result') rotateEgg(dt * 22, 0);
    }

    // 演出シーケンス
    if (state === 'reveal') {
      G.seqT += dt;
      if (G.rare !== 'none') {
        if (G.rareStep === 0 && G.seqT > 1.1) {
          G.rareStep = 1; rotVel.x = rotVel.y = 0;
          revealFrom.copy(egg.quaternion);
          revealQ.setFromUnitVectors(Q_UP, camToward);
          if (G.rare === 'oji' || G.rare === 'hiyoko') { faceMesh.visible = true; faceMat.opacity = 0; }
        }
        if (G.rareStep === 1) {
          var k = L.clamp((G.seqT - 1.1) / 0.8, 0, 1), e = k * k * (3 - 2 * k);
          egg.quaternion.slerpQuaternions(revealFrom, revealQ, e);
          if (k >= 1) {
            G.rareStep = 2;
            Snd.fanfare();
            banner(G.rare === 'gold' ? '黄金のたまご！！' : G.rare === 'hiyoko' ? 'ひよこが出てきた！？' : 'おじさんだ！！', G.rare === 'gold' ? '超レア' : G.rare === 'hiyoko' ? 'ゆでたはずなのに……ぴよ' : 'なぜか顔が描いてある');
          }
        }
        if (G.rareStep >= 2) {
          var g = L.clamp((G.seqT - 1.9) / 0.9, 0, 1);
          if (G.rare === 'oji') faceMat.opacity = g;
          else if (G.rare === 'hiyoko') {
            faceMat.opacity = g;
            whiteMat.color.copy(WHITE_DEF.color).lerp(CHICK, g); whiteMat.sheen = WHITE_DEF.sheen * (1 + g);
          } else {
            whiteMat.color.copy(WHITE_DEF.color).lerp(GOLD, g);
            whiteMat.metalness = g; whiteMat.roughness = WHITE_DEF.roughness + (0.2 - WHITE_DEF.roughness) * g;
            whiteMat.sheen = WHITE_DEF.sheen * (1 - g);
            whiteMat.emissive.copy(WHITE_DEF.emissive).lerp(GOLD_EM, g);
            rimU.value.copy(WHITE_DEF.rim).lerp(GOLD_RIM, g);
          }
          if (G.seqT > 1.9 && G.rareStep === 2) G.rareStep = 3;
        }
        if (G.seqT > 3.8) showResult();
      } else if (G.seqT > 2.3) showResult();
    } else if (state === 'over') {
      G.seqT += dt;
      if (G.endReason === 'collapse') squash += (0.72 - squash) * Math.min(1, dt * 6);
      if (G.seqT > 1.9) showResult();
    }
    if (G && G.rare === 'gold' && (state === 'reveal' || state === 'result') && (G.rareStep >= 2 || state === 'result')) {
      for (i = 0; i < 2; i++) {
        V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        var o = L.eggPoint(V1.x, V1.y, V1.z, [0, 0, 0]);
        V2.set(o[0], o[1], o[2]).multiplyScalar(1.04).applyQuaternion(egg.quaternion);
        TMPC.setHex(0xffe08a);
        sparkle.spawn(V2.x, V2.y, V2.z, 0, rand(0.1, 0.4), 0, TMPC, rand(0.5, 1), 0, 0);
      }
    }

    // 「一気に剥く」の順次処理
    if (bigQ.length) {
      bigT += dt;
      while (bigQ.length && bigQ[0].t <= bigT) {
        var it = bigQ.shift();
        if (attached[it.f]) {
          var c = frags[it.f].c.clone();
          detach(it.f);
          if (it.dmg > 0 && state === 'play') applyDamage(it.dmg, c, 1 + it.dmg / 8);
        }
        if (state !== 'play') { bigQ = []; break; }
      }
      if (!bigQ.length) checkClear();
    }

    // 力みでたまごが震える
    var shake = G && state === 'play' ? Math.max(0, G.pressure / G.mode.pressureMax - 0.45) * 0.06 : 0;
    egg.position.set(rand(-1, 1) * shake, rand(-1, 1) * shake, 0);
    if (G && state === 'play' && G.pressure / G.mode.pressureMax > 0.65) {
      G.warnT -= dt;
      if (G.warnT <= 0) { G.warnT = 0.35; Snd.creak(); }
    }

    // ぷにぷに
    wobV += (-320 * wob - 14 * wobV) * dt; wob += wobV * dt;
    wob = L.clamp(wob, -0.25, 0.25);
    var sw = wob * 0.05;
    egg.scale.set((1 + sw * 0.5) * (2 - squash * 0.5 - 0.5), (1 - sw) * squash, (1 + sw * 0.5) * (2 - squash * 0.5 - 0.5));

    egg.updateMatrixWorld(true);

    // 飛ぶかけら
    for (i = flying.length - 1; i >= 0; i--) {
      var fl = flying[i];
      if (fl.held && peel) {
        fl.mesh.position.lerp(peel.target, 1 - Math.exp(-18 * dt));
        if (fl.flip < 2.0) {
          var fa = Math.min(2.0 - fl.flip, dt * 5);
          fl.flip += fa;
          V3.copy(camRight).multiplyScalar(peel.refX).addScaledVector(camUp, -peel.refY);
          V4.crossVectors(V3, camToward).normalize();
          if (V4.lengthSq() > 0.5) { QA.setFromAxisAngle(V4, -fa); fl.mesh.quaternion.premultiply(QA); }
        }
        continue;
      }
      if (fl.held) fl.held = false;
      fl.vel.y -= CFG.GRAVITY * dt;
      fl.mesh.position.addScaledVector(fl.vel, dt);
      QA.setFromAxisAngle(fl.axis, fl.spin * dt); fl.mesh.quaternion.premultiply(QA);
      fl.life -= dt;
      if (fl.life < 0.4) fl.mesh.scale.setScalar(fl.base * Math.max(0.01, fl.life / 0.4));
      if (fl.life <= 0 || fl.mesh.position.y < -9) removeFlying(i);
    }

    // 塩
    for (i = 0; i < salt.n; i++) {
      var k3 = i * 3;
      salt.vel[k3 + 1] -= 7 * dt;
      salt.pos[k3] += salt.vel[k3] * dt; salt.pos[k3 + 1] += salt.vel[k3 + 1] * dt; salt.pos[k3 + 2] += salt.vel[k3 + 2] * dt;
      var dead = salt.pos[k3 + 1] < -5;
      if (!dead && !salt.bounced[i] && whiteMesh.visible) {
        V1.set(salt.pos[k3], salt.pos[k3 + 1], salt.pos[k3 + 2]);
        egg.worldToLocal(V1);
        if (L.insideEgg(V1.x, V1.y, V1.z, 0.035)) {
          var dd = L.dirFromPoint(V1.x, V1.y, V1.z, [0, 0, 0]), fi = coveringFrag(dd);
          if (fi >= 0 && attached[fi] && shellMesh.visible) {
            salt.bounced[i] = 1;
            V2.set(salt.pos[k3], salt.pos[k3 + 1], salt.pos[k3 + 2]).normalize();
            salt.vel[k3] = V2.x * 2 + rand(-0.5, 0.5); salt.vel[k3 + 1] = V2.y * 2 + 0.8; salt.vel[k3 + 2] = V2.z * 2;
          } else {
            if (stuck.n < STUCK_CAP) {
              var sp0 = L.eggPoint(dd[0], dd[1], dd[2], [0, 0, 0]), sn = eggNormal(dd[0], dd[1], dd[2], [0, 0, 0]);
              stuck.pos[stuck.n * 3] = sp0[0] + sn[0] * 0.01; stuck.pos[stuck.n * 3 + 1] = sp0[1] + sn[1] * 0.01; stuck.pos[stuck.n * 3 + 2] = sp0[2] + sn[2] * 0.01;
              stuck.n++; stuckGeo.setDrawRange(0, stuck.n); stuckAttr.needsUpdate = true;
            }
            dead = true;
          }
        }
      }
      if (dead) {
        var last = --salt.n;
        salt.pos[k3] = salt.pos[last * 3]; salt.pos[k3 + 1] = salt.pos[last * 3 + 1]; salt.pos[k3 + 2] = salt.pos[last * 3 + 2];
        salt.vel[k3] = salt.vel[last * 3]; salt.vel[k3 + 1] = salt.vel[last * 3 + 1]; salt.vel[k3 + 2] = salt.vel[last * 3 + 2];
        salt.bounced[i] = salt.bounced[last];
        i--;
      }
    }
    saltGeo.setDrawRange(0, salt.n); saltAttr.needsUpdate = true;

    dust.update(dt); confetti.update(dt); sparkle.update(dt);

    // 残りわずかの殻を光らせる
    if (state === 'play' && attachedCount > 0 && attachedCount <= markers.length) {
      var mk = 0, pulse = 0.32 + Math.sin(nowMs() / 180) * 0.08;
      for (i = 0; i < frags.length && mk < markers.length; i++) {
        if (!attached[i]) continue;
        var s = markers[mk++];
        s.visible = true;
        s.position.copy(frags[i].c).addScaledVector(frags[i].n, 0.07);
        s.scale.setScalar(pulse);
      }
      for (; mk < markers.length; mk++) markers[mk].visible = false;
    } else if (markers[0].visible) hideMarkers();

    // ジオメトリの更新はフレームに1回だけ
    if (shellPosDirty) { shellMesh.geometry.attributes.position.needsUpdate = true; shellPosDirty = false; }
    if (shellColDirty) { shellMesh.geometry.attributes.color.needsUpdate = true; shellColDirty = false; }
    if (whiteDirty) {
      wGeo.attributes.position.needsUpdate = true; wGeo.attributes.color.needsUpdate = true;
      wGeo.computeVertexNormals(); whiteDirty = false;
    }

    // カメラの揺れ
    if (camShake > 0.002) {
      camera.position.set(camBase.x + rand(-1, 1) * camShake, camBase.y + rand(-1, 1) * camShake, camBase.z);
      camShake *= Math.exp(-4 * dt);
    } else if (camShake > 0) { camShake = 0; camera.position.copy(camBase); }

    updateHud();
  }

  var lastT = 0, pkPaused = false;
  function frame(t) {
    var dt = lastT ? Math.min(0.05, Math.max(0, (t - lastT) / 1000)) : 1 / 60;
    lastT = t;
    update(pkPaused ? 0 : dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // 起動: 今日のたまごを、はじめの画面の後ろで回しておく
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
})(window);

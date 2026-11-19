/* 暗算ランナー — ブラウザ版「今日のステージ」（/play/kakezan/）
 * コース（ゲートの組・はじめの数・速さ）・計算・フィーバー・記録は アプリと同じ logic.js（KZ。アプリの logic.js を1文字もかえずに写したもの）。
 * 走る・くぐる・アウトの決まり（step・passGate・die）は アプリの game.js から写したもの。
 * 3D（three.js）のかわりに、軽い 2D の遠近の絵を canvas に描く（道・木・ゲート・走る小学生）。
 * サーバーとは通信しない（ランキングなし）。今日の記録だけ、この端末に保存（web.kakezan.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay, KZ = root.KZ;
  var $ = function (id) { return document.getElementById(id); };
  var DAY = KZ.dayKey();
  WP.init({ ns: 'kakezan', day: DAY, name: '今日のステージ', tag: '暗算ランナー', emoji: '🏃', url: 'https://imaimaha.com/play/kakezan/',
    appId: '6821955613', appLabel: 'アプリなら 200ステージとランキングで勝負', landing: '../../kakezan/', landingName: '暗算ランナー',
    today: function () { return KZ.dayKey(); } });

  var COURSE = KZ.dailyCourse(DAY);
  var DEMO = KZ.dailyCourse('2026-01-01');   // はじめの画面のうしろで流すコース（アプリと同じ。今日のコースは見せない）
  var LANE = 1.6;               // 左右のゲートの中心（アプリと同じ）
  var NUM_FONT = '"Avenir Next Condensed","DIN Alternate","Avenir Next","Helvetica Neue",sans-serif';
  var FONT = '"Avenir Next","Hiragino Sans","Hiragino Kaku Gothic ProN",-apple-system,sans-serif';
  var COL = { up: '#1f9e8f', down: '#ee7a5a', deadly: '#3d4552' };

  // ---------- 音（アプリと同じ。Web Audio でその場で合成。ミュートは WebPlay の 🔊） ----------
  var Snd = (function () {
    var ctx = null, master = null;
    function init() {
      if (ctx) { if (ctx.state !== 'running' && ctx.resume) { try { ctx.resume(); } catch (e) { /* */ } } return; }
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
      try { var b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(master); b.start(0); } catch (e) { /* */ }
    }
    function tone(f, dur, type, vol, f2, delay) {
      if (!ctx || !master || WP.muted() || ctx.state !== 'running') return;
      try {
        var t = ctx.currentTime + (delay || 0);
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* */ }
    }
    return {
      init: init,
      suspend: function () { try { if (ctx && ctx.suspend) ctx.suspend(); } catch (e) { /* */ } },
      good: function (streak) { var f = 587 * Math.pow(1.122, streak); tone(f, 0.09, 'sine', 0.2); tone(f * 1.5, 0.14, 'sine', 0.14, null, 0.05); },
      meh: function () { tone(392, 0.16, 'sine', 0.14, 370); },
      bad: function () { tone(220, 0.26, 'triangle', 0.16, 150); },
      fever: function () { var n = [587, 740, 880, 1175]; for (var i = 0; i < n.length; i++) tone(n[i], 0.16, 'sine', 0.16, null, i * 0.05); },
      warn: function () { for (var i = 0; i < 2; i++) tone(740, 0.12, 'triangle', 0.12, null, i * 0.2); },
      safe: function () { tone(523, 0.1, 'sine', 0.18); tone(784, 0.18, 'sine', 0.18, null, 0.08); },
      boom: function () { tone(140, 0.6, 'triangle', 0.22, 50); tone(70, 0.8, 'sine', 0.2, 40, 0.04); },
      over: function () { tone(392, 0.25, 'triangle', 0.12, 370); tone(330, 0.6, 'triangle', 0.12, 247, 0.26); },
      clear: function () { var s = [523, 659, 784, 1047]; for (var i = 0; i < s.length; i++) tone(s[i], i === 3 ? 0.5 : 0.14, 'sine', 0.18, null, i * 0.1); }
    };
  })();
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { Snd.init(); }, true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) Snd.suspend(); else Snd.init(); });

  // ---------- 状態（アプリの G と同じ形。ゲートは番号 i で持つ） ----------
  var G = {
    mode: 'title',            // title / run / dying / clear / result
    st: KZ.newState(COURSE.start),
    s: 0, x: 0, lane: 0, t: 0, runT: 0,
    done: {}, chosen: {}, pop: {}, goalS: 0,
    dieT: 0, feverT: 0, hurtT: 0, shownN: COURSE.start, shake: 0,
    revived: false, ranked: null, deathBefore: 0, deathIdx: -1, deadlyDeath: false, warned: -1
  };
  function gateS(i) { return 26 + i * KZ.GAP; }
  function nextGate() { for (var i = 0; i < COURSE.pairs.length; i++) if (!G.done[i]) return i; return -1; }

  // ---------- HUD ----------
  var elBadge = $('badge'), elToast = $('toast'), elStreak = $('streak'), elWarn = $('warn'), elFlash = $('flash');
  function toast(text, cls) {
    var d = document.createElement('div'); d.className = 't ' + (cls || ''); d.textContent = text;
    elToast.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 800);
    while (elToast.childNodes.length > 2) elToast.removeChild(elToast.firstChild);
  }
  function warn(text, cls) {
    if (!text) { elWarn.hidden = true; return; }
    elWarn.textContent = text; elWarn.className = cls || ''; elWarn.hidden = false;
  }
  function renderStreak() {
    elStreak.textContent = '';
    for (var i = 0; i < KZ.FEVER_STREAK; i++) { var e = document.createElement('i'); if (i < G.st.streak) e.className = 'on'; elStreak.appendChild(e); }
  }
  function renderHud() {
    $('kz-gates').textContent = G.st.passed;
    $('kz-fill').style.width = Math.min(100, G.st.passed / COURSE.pairs.length * 100) + '%';
  }

  // ---------- 走る ----------
  function begin() {
    Snd.init();
    WP.closeClear();
    G.st = KZ.newState(COURSE.start);
    G.mode = 'run'; G.s = 0; G.x = 0; G.lane = 0; G.dieT = 0; G.feverT = 0; G.hurtT = 0; G.shownN = G.st.n; G.shake = 0; G.runT = 0;
    G.done = {}; G.chosen = {}; G.pop = {}; G.goalS = gateS(COURSE.pairs.length);
    G.revived = false; G.ranked = null; G.deadlyDeath = false; G.warned = -1; G.counted = false;
    warn(null);
    $('kz-start').hidden = true;
    $('hint').hidden = false;
    elToast.textContent = '';
    WP.timer.reset(); WP.timer.start();
    renderStreak(); renderHud();
  }

  // ---------- 操作（アプリと同じ: 左半分・右半分をタップ、スワイプ、← → / A D） ----------
  var stage = $('kz-stage');
  function setLane(l) { if (G.mode === 'run') G.lane = l; }
  var touchX = null;
  stage.addEventListener('pointerdown', function (e) {
    if (G.mode !== 'run') return;
    if (e.target.closest && e.target.closest('button')) return;
    var r = stage.getBoundingClientRect();
    touchX = e.clientX;
    setLane(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });
  stage.addEventListener('pointermove', function (e) {
    if (touchX === null || G.mode !== 'run') return;
    if (e.clientX - touchX > 18) { setLane(1); touchX = e.clientX; }
    else if (e.clientX - touchX < -18) { setLane(-1); touchX = e.clientX; }
  });
  root.addEventListener('pointerup', function () { touchX = null; });
  stage.addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { if (G.mode === 'run') { e.preventDefault(); setLane(-1); } }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { if (G.mode === 'run') { e.preventDefault(); setLane(1); } }
    else if ((k === ' ' || k === 'Enter') && !$('kz-start').hidden && !WP.clearOpen()) { e.preventDefault(); begin(); }
  });
  $('kz-go').addEventListener('click', begin);

  function passGate(i) {
    G.done[i] = true;
    var pair = COURSE.pairs[i];
    var side = G.x < 0 ? 0 : 1;
    if (G.lane === 0 && Math.abs(G.x) < 0.01) side = Math.random() < 0.5 ? 0 : 1;
    G.chosen[i] = side; G.pop[i] = 0.001;
    var before = G.st.n;
    var res = KZ.choose(G.st, pair, side);
    $('hint').hidden = true;
    var lbl = KZ.label(res.gate);
    if (G.st.over) {
      G.deathBefore = before; G.deathIdx = i;
      if (res.deadly) { toast('即アウト', 'bad'); Snd.boom(); die(true); }
      else { toast(lbl + ' → 0 以下', 'bad'); Snd.over(); die(false); }
      return;
    }
    if (res.deadly) { toast('セーフ', 'good'); Snd.safe(); }
    if (res.fever) { toast(lbl, 'good'); toast('フィーバー ×1.2', 'rare'); Snd.fever(); G.feverT = 1.4; }
    else if (res.after > res.before) { toast(lbl, res.best ? 'good' : 'small'); if (res.best) Snd.good(G.st.streak); else Snd.meh(); }
    else {
      toast(lbl, res.best ? 'small' : 'bad');
      if (res.best) Snd.meh(); else Snd.bad();
      G.hurtT = 0.5;
    }
    renderStreak(); renderHud();
  }
  // 次が命がけのときの帯
  function updateWarn() {
    if (G.mode !== 'run') return;
    var i = nextGate();
    if (i >= 0 && COURSE.pairs[i].deadly && gateS(i) - G.s < KZ.GAP * 1.6) {
      if (G.warned !== i) { G.warned = i; Snd.warn(); }
      warn('命がけ：0 以下になるほうは即アウト', 'deadly');
    } else warn(null);
  }
  function before0(n) { return Math.max(1, n || 1); }
  // dramatic = 命がけでアウト（画面が赤く光る）
  function die(dramatic) {
    G.mode = 'dying'; G.dieT = 0.0001; G.shake = dramatic ? 0.5 : 0; G.deadlyDeath = !!dramatic;
    warn(null);
    if (dramatic) { elFlash.className = 'on'; setTimeout(function () { elFlash.className = ''; }, 700); }
    // 記録は、はじめてアウトになったところまで（復活したあとの分は入れない。アプリのランキングと同じ）
    if (!G.ranked) G.ranked = { passed: G.st.passed, n: before0(G.deathBefore) };
    setTimeout(function () { end(false); }, root.__wpFast ? 0 : dramatic ? 1500 : 1200);
  }
  function clearRun() {
    G.mode = 'clear'; warn(null);
    toast('ゴール！', 'rare'); Snd.clear();
    if (!G.ranked) G.ranked = { passed: G.st.passed, n: G.st.n };
    setTimeout(function () { end(true); }, root.__wpFast ? 0 : 1100);
  }

  // ---------- 結果（WebPlay のクリアの画面） ----------
  function end(cleared) {
    if (G.mode !== 'dying' && G.mode !== 'clear') return;
    G.mode = 'result';
    var canRevive = !cleared && !G.revived;
    var sec;
    if (canRevive) { WP.timer.hold('result'); sec = WP.timer.sec(); } else sec = WP.timer.stop();   // 復活できるあいだは時計を止めておく
    var rk = G.ranked, prev = WP.record();
    var r = { sec: sec, gates: rk.passed, n: rk.n, score: KZ.runScore(rk.passed, rk.n), cleared: cleared, deadly: G.deadlyDeath, after: G.revived ? G.st.passed : null };
    if (!G.counted) { G.counted = true; WP.saveRecord(sec, { gates: r.gates, n: r.n, score: r.score, cleared: cleared }); }
    result(true, r, prev, canRevive);
  }
  // シェアの絵文字（コースの中身はのせない。超えたゲートの数だけ）: 15ゲートごとに 🟩（10マス）
  function shareRow(r) {
    var k = Math.min(10, Math.floor(r.gates / 15)), s = '🏃';
    for (var i = 0; i < 10; i++) s += i < k ? '🟩' : '⬜';
    return s + (r.cleared ? '🏁' : '') + ' ' + r.gates + 'ゲート';
  }
  function result(fresh, r, prev, canRevive) {
    var info = document.createElement('p'); info.textContent = '超えたゲート ' + r.gates + '・' + (r.cleared ? 'ゴールの数 ' : 'アウトの前の数 ') + KZ.fmt(r.n);
    var ex = [info];
    if (r.after != null) { var af = document.createElement('p'); af.className = 'kz-sub'; af.textContent = '復活したあと: ' + r.after + ' ゲート（記録は復活の前まで）'; ex.push(af); }
    var btns = [];
    if (canRevive) btns.push({ label: '1回だけ復活する（記録は復活の前まで）', main: true, run: revive });
    WP.showClear({ sec: r.sec, fresh: fresh, head: r.cleared ? 'さいごまで走った！' : r.deadly ? '命がけゲートでアウト' : '0 以下になってアウト', emoji: r.cleared ? '🏁' : '🏃',
      row: shareRow(r), extra: ex, buttons: btns,
      note: prev ? '今日の記録（1回目）: ' + prev.gates + 'ゲート・' + KZ.fmt(prev.n) : null,
      again: function () { WP.timer.release('result'); begin(); } });
  }
  // 1回だけ復活: アウトになったゲートのすぐあとから、アウトの前の数でつづける（アプリと同じ。ブラウザ版は動画なし）
  function revive() {
    if (G.revived || G.mode !== 'result') return;
    G.revived = true;
    G.st.over = false; G.st.cause = null; G.st.n = before0(G.deathBefore); G.st.streak = 0;
    G.st.passed++;   // アウトになったゲートはとばす（超えたことにする）
    G.mode = 'run'; G.dieT = 0; G.deadlyDeath = false; G.shake = 0; G.feverT = 0; G.hurtT = 0; G.lane = G.x < 0 ? -1 : 1;
    G.s = gateS(G.deathIdx) + 2;
    for (var i = 0; i <= G.deathIdx; i++) G.done[i] = true;
    WP.timer.release('result');
    toast('復活！', 'rare');
    renderStreak(); renderHud();
  }

  // ---------- 1フレーム（アプリの step と同じ進み方） ----------
  function step(dt) {
    G.t += dt;
    if (G.mode === 'run') {
      G.runT += dt;
      G.s += KZ.speedAt(COURSE.speed, G.runT) * dt;
      var tx = G.lane * LANE;
      G.x += (tx - G.x) * Math.min(1, dt * 16);
      if (Math.abs(tx - G.x) < 0.01) G.x = tx;
      var i = nextGate();
      if (i >= 0 && G.s >= gateS(i)) passGate(i);
      if (G.mode === 'run' && G.s >= G.goalS && G.st.passed >= COURSE.pairs.length) clearRun();
      updateWarn();
    } else if (G.mode === 'dying') {
      G.dieT += dt;
    } else if (G.mode === 'clear') {
      G.s += 5 * dt; G.x *= 0.9;
    } else if (G.mode === 'title') {
      G.s += 6 * dt;
      G.x = Math.sin(G.t * 0.8) * 1.2;
    }
    for (var k in G.pop) if (G.pop[k] > 0 && G.pop[k] < 2) G.pop[k] += dt * 3;
    G.feverT = Math.max(0, G.feverT - dt);
    G.hurtT = Math.max(0, G.hurtT - dt);
  }

  // ---------- 絵（3D のかわりに 2D の遠近。カメラはアプリと同じ高さ 5.6・うしろ 8.4） ----------
  var cv = $('kz-scene'), c = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, Y0 = 0, F = 0, CX = 0;
  var CAM_H = 5.6, CAM_BACK = 8.4, FAR = 95;
  function fit() {
    var r = stage.getBoundingClientRect();
    DPR = Math.min(2, root.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    Y0 = H * 0.24; F = Math.min(W * 1.15, (H * 0.8 - Y0) / (CAM_H / CAM_BACK));
  }
  root.addEventListener('resize', fit);
  var camX = 0;
  // 世界の点（x: 左右、h: 高さ、z: 走っている子からの前の距離）→ 画面
  function P(x, h, z) { var d = z + CAM_BACK; return { x: CX + F * (x - camX) / d, y: Y0 + F * (CAM_H - h) / d, k: F / d }; }
  function fog(z) { return Math.max(0, Math.min(1, (z - 26) / (FAR - 26))); }
  function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function quad(a, b, d, e, col) { c.fillStyle = col; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath(); c.fill(); }
  function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }
  var SKY = [220, 239, 247], FEVER_SKY = [255, 243, 214];

  function drawGround() {
    var sky = mix(SKY, FEVER_SKY, Math.min(1, G.feverT));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    var g = c.createLinearGradient(0, Y0, 0, H);
    g.addColorStop(0, sky); g.addColorStop(0.12, '#c8e6bd'); g.addColorStop(1, '#bfe0b2');
    c.fillStyle = g; c.fillRect(0, Y0, W, H - Y0);
    // 道（4 ごとに色がかわる帯。流れていく）
    var zs = -CAM_BACK + 0.6, TILE = 4, off = G.s % (TILE * 2);
    for (var z = -off - TILE * 2; z < FAR; z += TILE) {
      var z0 = Math.max(zs, z), z1 = Math.min(FAR, z + TILE); if (z1 <= z0) continue;
      var band = Math.round((z + off) / TILE) % 2 === 0;
      var f = fog(z0);
      quad(P(-3.7, 0, z0), P(3.7, 0, z0), P(3.7, 0, z1), P(-3.7, 0, z1), mix(band ? [236, 235, 230] : [228, 226, 220], SKY, f * 0.8));
      // まんなかの白い線
      var a0 = P(-0.03, 0, z0 + 0.3), a1 = P(0.03, 0, Math.min(z1, z0 + 2.2));
      if (z1 - z0 > 1) quad(a0, P(0.03, 0, z0 + 0.3), a1, P(-0.03, 0, Math.min(z1, z0 + 2.2)), 'rgba(255,255,255,' + (0.9 * (1 - f)) + ')');
    }
    // 道のふち
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2;
    [-3.7, 3.7].forEach(function (x) { var a = P(x, 0, zs), b = P(x, 0, FAR); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); });
  }
  // 道ばたの木（アプリと同じ並び: 24本・9 ごと・108 でくりかえし）
  var TREES = [];
  for (var ti = 0; ti < 24; ti++) TREES.push({ x: (ti % 2 ? 1 : -1) * (5.6 + (ti * 7 % 5) * 0.8), z: Math.floor(ti / 2) * 9, sc: 0.8 + (ti * 13 % 7) / 12, col: ['#8cc58a', '#7bb98a', '#9fcf8f'][ti % 3] });
  function treeItems(list) {
    TREES.forEach(function (t) {
      var rel = ((t.z - G.s) % 108 + 108) % 108 - 12;
      if (rel < -CAM_BACK + 1 || rel > FAR) return;
      list.push({ z: rel, draw: function () {
        var b = P(t.x, 0, rel), top = P(t.x, 1.45 * t.sc, rel), f = fog(rel);
        c.globalAlpha = 1 - f * 0.85;
        c.fillStyle = '#9b7b5c'; c.fillRect(b.x - 0.14 * b.k * t.sc, top.y, 0.28 * b.k * t.sc, b.y - top.y);
        c.fillStyle = t.col; c.beginPath(); c.arc(top.x, top.y, 0.85 * b.k * t.sc, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(top.x - 0.25 * b.k * t.sc, top.y - 0.25 * b.k * t.sc, 0.3 * b.k * t.sc, 0, 7); c.fill();
        c.globalAlpha = 1;
      } });
    });
  }
  // ゲートの札（アプリの gateCanvas と同じ色と字）
  function panel(g, deadly, cx, cy, w, h, alpha, scale) {
    if (alpha <= 0) return;
    c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.scale(scale, scale);
    var k = w / 256;
    rr(-w / 2 + 8 * k, -h / 2 + 8 * k, 240 * k, 144 * k, 20 * k);
    c.fillStyle = deadly ? COL.deadly : KZ.good(g) ? COL.up : COL.down;
    c.globalAlpha = alpha * 0.92; c.fill(); c.globalAlpha = alpha;
    c.lineWidth = Math.max(1, 6 * k); c.strokeStyle = deadly ? '#ff5a5f' : 'rgba(255,255,255,0.9)';
    if (deadly) c.setLineDash([16 * k, 10 * k]);
    c.stroke(); c.setLineDash([]);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var text = KZ.label(g), size = 100;
    do { c.font = '700 ' + size * k + 'px ' + NUM_FONT; size -= 4; } while (c.measureText(text).width > 216 * k && size > 24);
    c.fillStyle = '#fff'; c.fillText(text, 0, 6 * k);
    c.restore();
  }
  function gateItems(list) {
    var title = G.mode === 'title', CO = title ? DEMO : COURSE, n = title ? 1e9 : CO.pairs.length;
    var from = Math.max(0, Math.floor((G.s - 3) / KZ.GAP) - 1);
    for (var i = from; i < n; i++) {
      var z = gateS(i) - G.s;
      if (z > FAR) break;
      if ((G.done[i] || title) && z < -2.5) continue;   // 通りすぎたゲートは消す（アプリと同じ）
      (function (i, z) {
        list.push({ z: z, draw: function () {
          var pair = CO.pairs[i % CO.pairs.length], deadly = !!pair.deadly, f = fog(z), a = 1 - f;
          if (z < -CAM_BACK + 1.2) return;
          c.globalAlpha = a;
          // 柱
          var pc = deadly ? '#e5484d' : '#ffffff';
          [-3.15, 0, 3.15].forEach(function (x) { var b = P(x, 0, z), t = P(x, 2.5, z), w = Math.max(1.5, 0.14 * b.k); c.fillStyle = pc; c.fillRect(b.x - w / 2, t.y, w, b.y - t.y); });
          c.globalAlpha = 1;
          var pop = G.pop[i] || 0;
          for (var sd = 0; sd < 2; sd++) {
            var ctr = P(sd === 0 ? -LANE : LANE, 1.45, z), pw = 3.05 * ctr.k, ph = 1.9 * ctr.k;
            var al = a, sc = 1;
            if (pop > 0) { if (sd === G.chosen[i]) { sc = 1 + pop * 0.5; al = a * Math.max(0, 1 - pop); } else al = a * Math.max(0, 1 - pop * 2); }
            panel(pair.gates[sd], deadly, ctr.x, ctr.y, pw * 256 / 240, ph * 160 / 144, al, sc);
          }
          if (deadly) {
            var sg = P(0, 2.82, z), sw = 3.6 * sg.k, sh = 0.73 * sg.k;
            c.globalAlpha = a; rr(sg.x - sw / 2, sg.y - sh / 2, sw, sh, sh * 0.22); c.fillStyle = '#e5484d'; c.fill();
            c.fillStyle = '#fff'; c.font = '800 ' + Math.max(6, sh * 0.55) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('命がけ', sg.x, sg.y + 1);
            c.globalAlpha = 1;
          }
        } });
      })(i, z);
    }
    // ゴール（白い門と「ゴール」の幕）
    var gz = G.goalS - G.s;
    if (!title && gz < FAR && gz > -2.5) list.push({ z: gz, draw: function () {
      [-3.3, 3.3].forEach(function (x) { var b = P(x, 0, gz), t = P(x, 3.2, gz), w = Math.max(2, 0.2 * b.k); c.fillStyle = '#fff'; c.fillRect(b.x - w / 2, t.y, w, b.y - t.y); });
      var m = P(0, 3, gz), mw = 6.6 * m.k, mh = 1.24 * m.k;
      rr(m.x - mw / 2, m.y - mh / 2, mw, mh, mh * 0.18); c.fillStyle = '#1f9e8f'; c.fill();
      c.fillStyle = '#fff'; c.font = '800 ' + Math.max(6, mh * 0.6) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ゴール', m.x, m.y + 1);
    } });
  }
  // 走る小学生（うしろから見た、紺の制服とランドセル）
  function drawKid() {
    var dying = G.mode === 'dying' || (G.mode === 'result' && G.st.over) ? Math.min(G.dieT, 1.4) : 0;
    var ph = G.t * 11, sw = dying ? 0.2 : Math.sin(ph) * 0.75;
    var base = P(G.x, dying ? 0 : Math.abs(Math.cos(ph)) * 0.06, -0.2), k = base.k;
    c.save(); c.translate(base.x, base.y);
    if (dying) { c.rotate(0); c.scale(1, Math.max(0.35, 1 - dying * 0.5)); }
    var u = k;   // 1 = 1m
    // かげ
    c.fillStyle = 'rgba(34,49,63,.18)'; c.beginPath(); c.ellipse(0, 0, 0.32 * u, 0.08 * u, 0, 0, 7); c.fill();
    // 足（前後にふる＝上下の長さで見せる）
    [[-0.1, sw], [0.1, -sw]].forEach(function (l) {
      var lift = Math.max(0, l[1]) * 0.14 * u;
      c.fillStyle = '#f1d2b6'; c.fillRect(l[0] * u - 0.055 * u, -0.5 * u - lift, 0.11 * u, 0.36 * u);
      c.fillStyle = '#f2f2ee'; c.fillRect(l[0] * u - 0.06 * u, -0.16 * u - lift, 0.12 * u, 0.08 * u);
      c.fillStyle = '#3a3a3a'; c.fillRect(l[0] * u - 0.065 * u, -0.08 * u - lift, 0.13 * u, 0.08 * u);
      c.fillStyle = '#2b3a55'; c.fillRect(l[0] * u - 0.075 * u, -0.64 * u, 0.15 * u, 0.2 * u);
    });
    // うで
    [[-0.26, -sw], [0.26, sw]].forEach(function (a) {
      var dy = a[1] * 0.08 * u;
      c.fillStyle = '#2b3a55'; c.fillRect(a[0] * u - 0.05 * u, -1.06 * u + dy, 0.1 * u, 0.3 * u);
      c.fillStyle = '#f1d2b6'; c.fillRect(a[0] * u - 0.04 * u, -0.76 * u + dy, 0.08 * u, 0.08 * u);
    });
    // からだ
    c.fillStyle = '#2b3a55'; rr(-0.2 * u, -1.09 * u, 0.4 * u, 0.44 * u, 0.04 * u); c.fill();
    // あたま（うしろ髪）
    c.fillStyle = '#f1d2b6'; c.beginPath(); c.arc(0, -1.28 * u, 0.19 * u, 0, 7); c.fill();
    c.fillStyle = '#2e2725'; c.beginPath(); c.arc(0, -1.31 * u, 0.2 * u, 0, 7); c.fill();
    // ランドセル
    c.fillStyle = '#c0393f'; rr(-0.19 * u, -1.11 * u, 0.38 * u, 0.42 * u, 0.05 * u); c.fill();
    c.fillStyle = '#9e2b31'; rr(-0.195 * u, -1.11 * u, 0.39 * u, 0.24 * u, 0.05 * u); c.fill();
    c.fillStyle = '#e8c96a'; c.fillRect(-0.04 * u, -0.9 * u, 0.08 * u, 0.05 * u);
    c.restore();
    return P(G.x, 1.75, -0.2);
  }

  function render() {
    var n = G.st.n;
    G.shownN = n <= 0 ? n : (Math.abs(n - G.shownN) < 1 ? n : G.shownN + (n - G.shownN) * 0.25);
    G.shake = Math.max(0, (G.shake || 0) - 0.016);
    var sh = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 30 : 0;
    camX = G.x * 0.3; CX = W / 2 + sh;
    drawGround();
    var list = [];
    treeItems(list); gateItems(list);
    list.sort(function (a, b) { return b.z - a.z; });
    // 子より遠いものを先に、近い（通りすぎた）ものをあとに
    var kidAt = null;
    for (var i = 0; i < list.length; i++) {
      if (!kidAt && list[i].z < -0.2) kidAt = drawKid();
      list[i].draw();
    }
    if (!kidAt) kidAt = drawKid();
    // 頭の上の数
    var playing = G.mode === 'run' || G.mode === 'dying' || G.mode === 'clear';
    var text = KZ.fmt(Math.max(0, Math.round(G.shownN)));
    elBadge.style.transform = 'translate(' + kidAt.x + 'px,' + kidAt.y + 'px) translate(-50%,-100%)';
    if (elBadge.textContent !== text) elBadge.textContent = text;
    elBadge.hidden = !playing;
    elBadge.className = G.feverT > 0 ? 'fever' : G.hurtT > 0 || G.mode === 'dying' ? 'hurt' : '';
  }

  var last = 0;
  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (document.hidden || WP.clearOpen() && G.mode !== 'result') dt = 0;
    if (G.mode === 'title' && reduce) dt = 0;
    step(dt);
    render();
    root.requestAnimationFrame(frame);
  }

  // はじめの画面
  $('kz-start-n').textContent = KZ.fmt(COURSE.start);
  $('kz-total').textContent = COURSE.pairs.length;
  renderStreak(); renderHud();
  fit();
  root.requestAnimationFrame(frame);

  // 自動テスト用（今日のコースは日付からいつでも計算できるので、出してもこまらない）
  root.__webPlay = {
    day: function () { return DAY; },
    course: function (d) { var cc = d ? KZ.dailyCourse(d) : COURSE; return { start: cc.start, speed: cc.speed, pairs: cc.pairs.map(KZ.pairJSON) }; },
    state: function () { var i = nextGate(); return { mode: G.mode, n: G.st.n, passed: G.st.passed, next: i >= 0 ? COURSE.pairs[i].gates.map(KZ.label) : null, revived: G.revived }; },
    lane: setLane,
    // 次のゲートでいいほう（worst なら悪いほう）へ
    autopilot: function (worst) { var i = nextGate(); if (i < 0) return; var p = COURSE.pairs[i]; var a = KZ.apply(G.st.n, p.gates[0]), b = KZ.apply(G.st.n, p.gates[1]); setLane((a >= b) !== !!worst ? -1 : 1); },
    step: function (sec) { var k = Math.round(sec / 0.02); for (var j = 0; j < k; j++) { if (G.mode === 'run') this.autopilot(this.worst); step(0.02); } render(); },
    worst: false
  };
  var rec = WP.record();
  if (rec) result(false, rec, null, false);
})(window);

/* ナンバー暗算ドライブ — ブラウザ版「今日のドライブ」（/play/jimidrive/）
 * 今日の道・ナンバーの並び・制限時間・点数はアプリと同じ daily.js（JDDaily。アプリの game.js から そのまま写した関数）。
 * 3D の景色のかわりに、軽い夜の高速道路を canvas に描く。ルールはアプリの今日のドライブと同じ（ふつう・ミス3回）。
 * サーバーとは通信しない（ランキングなし）。今日の記録だけ、この端末に保存（web.jimidrive.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay, J = JDDaily, D = JimiData, C = J.CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var DAY = J.dayKey();
  WP.init({ ns: 'jimidrive', day: DAY, name: '今日のドライブ', tag: '今日のドライブ', emoji: '🚗', url: 'https://imaimaha.com/play/jimidrive/',
    appId: '6818812573', appLabel: 'アプリなら 5路線とランキングで勝負', landing: '../../jimidrive/', landingName: 'ナンバー暗算ドライブ',
    today: function () { return J.dayKey(); } });

  // ---- 音（アプリの効果音をかんたんにしたもの。Web Audio で作る・音源ファイルなし）----
  var Snd = (function () {
    var ctx = null, out = null, noise = null;
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      out = ctx.createGain(); out.gain.value = 0.8; out.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 1.2); noise = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ctx && !WP.muted(); }
    function horn(freqs, segs, type, vol, cutoff) {
      if (!ready()) return;
      var t0 = ctx.currentTime + 0.01;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 3;
      var g = ctx.createGain(); g.gain.value = 0; lp.connect(g); g.connect(out);
      var end = t0;
      for (var i = 0; i < segs.length; i++) {
        var a = t0 + segs[i][0], b = a + segs[i][1];
        g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(vol, a + 0.012); g.gain.setValueAtTime(vol, b - 0.035); g.gain.linearRampToValueAtTime(0, b);
        end = b;
      }
      for (var k = 0; k < freqs.length; k++) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freqs[k]; o.connect(lp); o.start(t0); o.stop(end + 0.05); }
    }
    function blip(f, t, dur, vol, type) {
      var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      init: init,
      happy: function () { horn([466, 587], [[0, 0.09], [0.15, 0.5]], 'square', 0.11, 2600); },      // パパーン！
      angry: function () { horn([262, 277, 294], [[0, 0.14], [0.2, 0.75]], 'sawtooth', 0.1, 1500); }, // ブブーッ！
      whoosh: function () {
        if (!ready()) return;
        var t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noise;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.25); bp.frequency.exponentialRampToValueAtTime(260, t + 0.8);
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
        src.connect(bp); bp.connect(g); g.connect(out); src.start(t, 0, 0.9);
      },
      tick: function () { if (ready()) blip(1250, ctx.currentTime, 0.05, 0.06); },
      chime: function () { if (!ready()) return; var t = ctx.currentTime; blip(988, t, 0.5, 0.07); blip(784, t + 0.18, 1.0, 0.07); },
      rare: function () { if (!ready()) return; var t = ctx.currentTime; [1047, 1319, 1568, 2093].forEach(function (f, i) { blip(f, t + i * 0.06, 0.4, 0.04, 'triangle'); }); },
      engine: function () {
        if (!ready()) return;
        var t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(95, t + 0.35); o.frequency.exponentialRampToValueAtTime(45, t + 1.1);
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 1.3);
      },
      goal: function () { if (!ready()) return; var t = ctx.currentTime; [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { blip(f, t + i * 0.13, 0.5, 0.06, 'triangle'); }); },
      over: function () { if (!ready()) return; var t = ctx.currentTime; [392, 330, 262, 196].forEach(function (f, i) { blip(f, t + i * 0.22, 0.6, 0.06, 'triangle'); }); }
    };
  })();

  // ---- 夜の高速道路（軽い canvas。アプリの3Dの景色のかわり）----
  var cv = $('jd-scene'), g2 = cv.getContext('2d'), W = 0, H = 0, DPR = 1;
  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var city = [];
  (function () { var r = 12345; function rr() { r = (r * 16807) % 2147483647; return r / 2147483647; } for (var i = 0; i < 40; i++) city.push({ w: 0.02 + rr() * 0.05, h: 0.04 + rr() * 0.16, win: rr() }); })();
  function fit() {
    var r = cv.getBoundingClientRect(); DPR = Math.min(2, root.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  root.addEventListener('resize', fit);
  var roadZ = 0, lampZ = 0, flash = 0, flashColor = '94,240,160', shake = 0;
  function proj(x, z) { // 道の横位置 x（-1〜1）・奥行き z（0=手前、1=地平線）→ 画面
    var hy = H * 0.42, k = 1 - z, y = hy + (H - hy) * k * k, half = W * 0.62 * k * k + W * 0.02;
    return { x: W / 2 + x * half, y: y, s: k * k };
  }
  function draw(dt) {
    var ctx = g2; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var hy = H * 0.42;
    var sky = ctx.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#05060f'); sky.addColorStop(1, '#1b2140');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 1);
    // 月と星
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.1, Math.max(8, W * 0.035), 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; for (var s = 0; s < 26; s++) ctx.fillRect((s * 97 % 100) / 100 * W, (s * 53 % 37) / 100 * hy, 1.2, 1.2);
    // ビル街
    var x = 0, i = 0;
    while (x < W) {
      var b = city[i % city.length], bw = b.w * W * 1.6, bh = b.h * H * 0.9;
      ctx.fillStyle = '#0c0f1f'; ctx.fillRect(x, hy - bh, bw + 1, bh);
      ctx.fillStyle = 'rgba(255,214,140,.55)';
      for (var wy = hy - bh + 4; wy < hy - 3; wy += 7) for (var wx = x + 3; wx < x + bw - 3; wx += 6) if (((wx * 7 + wy * 13 + i) % 11) / 11 < b.win * 0.5) ctx.fillRect(wx, wy, 2, 2.5);
      x += bw; i++;
    }
    // 道
    ctx.fillStyle = '#10121c'; ctx.fillRect(0, hy, W, H - hy);
    var a = proj(-1.15, 0), bb = proj(1.15, 0), c = proj(1.15, 0.999), d = proj(-1.15, 0.999);
    ctx.fillStyle = '#1d2030'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
    // 側壁
    ctx.strokeStyle = 'rgba(200,210,235,.35)'; ctx.lineWidth = 2;
    [-1.15, 1.15].forEach(function (sx) { var p = proj(sx, 0), q = proj(sx, 0.999); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); });
    // 白線（動く）
    roadZ = (roadZ + dt * 1.6) % 1;
    ctx.fillStyle = 'rgba(240,240,230,.85)';
    for (var k = 0; k < 14; k++) {
      var z0 = ((k + roadZ) / 14), z1 = z0 + 0.03;
      var zz0 = 1 - z0, zz1 = 1 - z1; if (zz1 < 0) continue;
      var p0 = proj(0, zz0), p1 = proj(0, zz1), w0 = Math.max(1, 5 * p0.s), w1 = Math.max(0.5, 5 * p1.s);
      ctx.beginPath(); ctx.moveTo(p0.x - w0, p0.y); ctx.lineTo(p0.x + w0, p0.y); ctx.lineTo(p1.x + w1, p1.y); ctx.lineTo(p1.x - w1, p1.y); ctx.fill();
    }
    // 街灯（オレンジの光）
    lampZ = (lampZ + dt * 0.55) % 1;
    for (var m = 0; m < 6; m++) {
      var lz = 1 - ((m + lampZ) / 6); if (lz <= 0.02) continue;
      [-1.3, 1.3].forEach(function (sx) {
        var p = proj(sx, lz), hgt = 220 * p.s + 4;
        ctx.strokeStyle = 'rgba(120,130,150,.7)'; ctx.lineWidth = Math.max(1, 3 * p.s);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - hgt); ctx.stroke();
        var gl = ctx.createRadialGradient(p.x, p.y - hgt, 0, p.x, p.y - hgt, 40 * p.s + 6);
        gl.addColorStop(0, 'rgba(255,190,110,.95)'); gl.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y - hgt, 40 * p.s + 6, 0, 7); ctx.fill();
      });
    }
    // 対向車（右の車線をこちらへ）
    if (G && G.phase === 'approach') {
      var t = 1 - G.t / C.APPROACH_SEC, cz = Math.max(0.02, 1 - t), cp = proj(0.5, cz), sz = 120 * cp.s + 3;
      ctx.fillStyle = 'rgba(20,22,30,.95)'; ctx.fillRect(cp.x - sz * 0.6, cp.y - sz * 0.75, sz * 1.2, sz * 0.75);
      [-0.38, 0.38].forEach(function (o) {
        var hx = cp.x + o * sz, hy2 = cp.y - sz * 0.3, r = sz * 0.5 + 2;
        var hg = ctx.createRadialGradient(hx, hy2, 0, hx, hy2, r * 2.4);
        hg.addColorStop(0, 'rgba(255,255,245,1)'); hg.addColorStop(0.25, 'rgba(255,250,220,.7)'); hg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy2, r * 2.4, 0, 7); ctx.fill();
      });
    }
    // 自分の車のボンネット
    ctx.fillStyle = '#07080d'; ctx.beginPath(); ctx.moveTo(W * 0.08, H); ctx.quadraticCurveTo(W * 0.5, H * 0.86, W * 0.92, H); ctx.fill();
    if (flash > 0) { ctx.fillStyle = 'rgba(' + flashColor + ',' + (flash * 0.28) + ')'; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 2.5); }
    if (shake > 0) { cv.style.transform = 'translate(' + ((Math.random() - 0.5) * 8 * shake) + 'px,' + ((Math.random() - 0.5) * 6 * shake) + 'px)'; shake = Math.max(0, shake - dt * 3); if (!shake) cv.style.transform = ''; }
  }

  // ---- ドライブ ----
  var G = null;   // { o: JDDaily.start の中身, phase, t, plate, limit, ... }
  var el = {
    plateWrap: $('plate-wrap'), plate: $('plate'), region: $('p-region'), cls: $('p-class'), kana: $('p-kana'), num: $('p-num'), question: $('question'), carTag: $('car-tag'),
    timerFill: $('timer-fill'), stamp: $('stamp'), feedback: $('feedback'), fbTitle: $('fb-title'), fbExpr: $('fb-expr'), approach: $('approach'),
    yes: $('btn-yes'), no: $('btn-no'), score: $('score'), dist: $('dist'), lives: $('lives'), fill: $('route-fill'), car: $('route-car'),
    from: $('route-from'), next: $('route-next'), to: $('route-to'), start: $('jd-start'), toast: $('toast'), pop: $('score-pop')
  };
  var SP = J.dailySpec(DAY), LINE = D.LINES[SP.line];
  function routeLabel() { return LINE.short + ' ' + LINE.stops[SP.from].name + ' → ' + LINE.stops[SP.to].name; }
  $('wp-how').textContent = SP.mode === 'prime' ? 'すれ違う車のナンバー4桁（35-24 なら 3524）が素数か、すばやく答えよう。ミス3回でおしまい'
    : SP.mode === 'mix' ? 'ナンバーごとに「10作れる？」か「素数？」が出る。すばやく答えて目的地へ。ミス3回でおしまい'
    : 'ナンバーの4つの数字を1回ずつ使って ＋−×÷ とカッコで 10 が作れるか、すばやく答えよう。ミス3回でおしまい';
  $('jd-start-route').textContent = routeLabel();
  $('jd-start-mode').textContent = 'Q. ' + J.MODES[SP.mode].name + '　ふつう・ミス3回まで';

  var toastT = 0;
  function toast(t, rare) { el.toast.textContent = t; el.toast.className = 'show' + (rare ? ' rare' : ''); clearTimeout(toastT); toastT = setTimeout(function () { el.toast.className = ''; }, 2000); }
  function scorePop(t) { el.pop.textContent = t; el.pop.className = ''; void el.pop.offsetWidth; el.pop.className = 'show'; }
  function setButtons(on) { el.yes.disabled = el.no.disabled = !on; }
  function setLabels(q) { el.yes.firstChild.textContent = J.MODES[q].yes; el.no.firstChild.textContent = J.MODES[q].no; }
  function buildLives() { el.lives.innerHTML = ''; for (var i = 0; i < SP.miss; i++) el.lives.appendChild(document.createElement('i')); }
  function hud() {
    var S = G.o.S, R = G.o.R;
    el.score.textContent = S.score;
    el.dist.textContent = S.km.toFixed(1);
    var lv = el.lives.getElementsByTagName('i'); for (var i = 0; i < lv.length; i++) lv[i].className = i < S.misses ? 'miss' : '';
    var p = J.clamp(S.km / R.total, 0, 1);
    el.fill.style.width = (p * 100) + '%'; el.car.style.left = (p * 100) + '%';
    var nx = R.stops[Math.min(R.stops.length - 1, S.wpIndex + 1)];
    el.next.textContent = S.goal ? '到着' : 'つぎ ' + nx.name;
  }

  function begin() {
    Snd.init(); Snd.engine();
    WP.closeClear();
    var o = J.start(DAY);
    G = { o: o, phase: 'gap', t: 1.4, plate: null, limit: 0, lastTick: -1, over: false, log: [] };
    el.from.textContent = o.R.stops[0].name; el.to.textContent = o.R.stops[o.R.stops.length - 1].name;
    buildLives(); setLabels(SP.mode === 'prime' ? 'prime' : 'make10'); setButtons(false);
    el.plateWrap.className = 'hidden'; el.start.hidden = true; el.approach.className = '';
    WP.timer.reset(); WP.timer.start();
    hud();
  }

  function spawn() {
    G.plate = J.makePlate();
    G.phase = 'approach'; G.t = C.APPROACH_SEC;
    el.approach.className = 'show';
    el.plateWrap.className = 'hidden';
  }
  function showPlate(p) {
    var d = p.digits;
    el.region.textContent = p.region; el.cls.textContent = p.cls; el.kana.textContent = p.kana;
    el.num.textContent = '';
    el.num.appendChild(document.createTextNode('' + d[0] + d[1]));
    var dash = document.createElement('span'); dash.className = 'dash'; dash.textContent = '-'; el.num.appendChild(dash);
    el.num.appendChild(document.createTextNode('' + d[2] + d[3]));
    el.plate.className = p.car.plate + (p.rare ? ' rare' : '');
    el.carTag.textContent = p.car.name;
    el.question.textContent = 'Q. ' + J.MODES[p.q].name; el.question.className = p.q;
    setLabels(p.q);
    el.stamp.className = ''; el.stamp.textContent = '';
    el.feedback.className = 'hidden';
    el.timerFill.style.transform = 'scaleX(1)'; el.timerFill.className = '';
    el.plateWrap.className = ''; void el.plateWrap.offsetWidth; el.plateWrap.className = 'pop';
  }
  function pass() {
    el.approach.className = '';
    Snd.whoosh();
    showPlate(G.plate);
    if (G.plate.rare) { Snd.rare(); toast('レアなご当地ナンバー「' + G.plate.region + '」！', true); }
    else if (G.plate.special) { Snd.rare(); toast(G.plate.special.kind + 'のナンバー！', true); }
    G.phase = 'question'; G.t = 0; G.limit = J.timeLimit(G.plate.q); G.lastTick = -1;
    setButtons(true);
  }

  // 答え（アプリの answer と同じ点数・進み方。図鑑・解放・ランキングはない）
  function answer(choice) {
    if (!G || G.phase !== 'question' || WP.clearOpen()) return;
    setButtons(false);
    var S = G.o.S, R = G.o.R, p = G.plate, truth = J.truthOf(p.q, p.num), timeout = choice === null, ok = !timeout && choice === truth;
    S.total = (S.total || 0) + 1;
    if (ok) {
      S.correct++; S.combo = (S.combo || 0) + 1; S.maxCombo = Math.max(S.maxCombo || 0, S.combo);
      var remain = Math.max(0, G.limit - G.t);
      var pts = C.SCORE_BASE + Math.round(remain * C.SCORE_TIME) + (S.combo - 1) * C.SCORE_COMBO;
      if (p.rare) pts += C.SCORE_RARE;
      S.score += pts;
      var step = R.kmPer * (1 + Math.min(C.KM_COMBO_MAX, (S.combo - 1) * C.KM_COMBO_BONUS));
      S.km = Math.min(R.total, S.km + step);
      Snd.happy(); flash = 1; flashColor = '94,240,160';
      el.stamp.className = 'ok';
      el.fbTitle.className = 'ok'; el.fbTitle.textContent = 'パパーン！';
      var sm = document.createElement('small'); sm.textContent = S.combo >= 2 ? S.combo + '連続 正解' : '正解'; el.fbTitle.appendChild(sm);
      scorePop('+' + pts);
      while (S.wpIndex + 1 < R.stops.length && S.km >= R.stops[S.wpIndex + 1].d - 1e-9) {
        S.wpIndex++;
        if (S.wpIndex < R.stops.length - 1) { var nm = R.stops[S.wpIndex].name; setTimeout(function () { Snd.chime(); toast('ポーン　まもなく ' + nm + ' です'); }, 900); }
      }
      if (S.km >= R.total - 1e-9) {
        S.goal = true;
        var bonus = Math.max(0, 3 - S.misses) * C.SCORE_GOAL_LIFE;
        S.score += bonus;
        var dest = R.stops[R.stops.length - 1].name;
        setTimeout(function () { toast(dest + 'に到着！ ボーナス +' + bonus); }, 600);
      }
      G.log.push(1);
    } else {
      S.misses++; S.combo = 0;
      Snd.angry(); shake = 1; flash = 1; flashColor = '255,80,100';
      el.stamp.className = 'ng'; el.stamp.textContent = '×';
      el.fbTitle.className = 'ng'; el.fbTitle.textContent = 'ブブーッ！';
      var why = timeout ? '時間切れ' : p.q === 'prime' ? (truth ? '素数でした' : '素数じゃない') : (truth ? '作れました' : '作れません');
      var sm2 = document.createElement('small'); sm2.textContent = why; el.fbTitle.appendChild(sm2);
      G.log.push(0);
    }
    var long = false;
    if (p.q === 'prime') {
      el.fbExpr.className = truth ? '' : 'small';
      el.fbExpr.textContent = truth ? p.num + ' は素数' : J.factorText(p.num) + J.primeHint(p.num);
      long = !truth;
    } else if (truth) {
      var expr = Make10.solve(p.num);
      el.fbExpr.className = ''; el.fbExpr.textContent = expr + ' = 10';
      long = expr.length > 14;
    } else { el.fbExpr.className = 'none'; el.fbExpr.textContent = 'どうやっても10にならないナンバー'; }
    el.feedback.className = '';
    G.phase = 'feedback'; G.t = C.FEEDBACK_SEC + (long ? 0.4 : 0);
    hud();
  }

  function end() {
    var S = G.o.S;
    G.phase = 'over'; G.over = true; setButtons(false);
    el.approach.className = '';
    var sec = WP.timer.stop(), prev = WP.record();
    var frac = Math.round(J.clamp(S.km / G.o.R.total, 0, 1) * 100) / 100;
    WP.saveRecord(sec, { score: S.score, goal: S.goal, correct: S.correct, total: S.total || 0, misses: S.misses, title: J.rankTitle(), frac: frac });
    if (S.goal) Snd.goal(); else Snd.over();
    var r = { sec: sec, score: S.score, goal: S.goal, correct: S.correct, total: S.total || 0, misses: S.misses, title: J.rankTitle(), frac: frac };
    setTimeout(function () { result(true, r, prev); }, root.__wpFast ? 0 : 1500);
  }

  // シェアの絵文字（答えはのせない）: 道のりを5マス・着いたら 🏁・点数
  function shareRow(r) {
    var n = r.goal ? 5 : Math.min(4, Math.floor((r.frac || 0) * 5));
    var s = '🚗'; for (var i = 0; i < 5; i++) s += i < n ? '🟩' : '⬛'; return s + (r.goal ? '🏁' : '💥') + ' ' + r.score + '点';
  }
  function result(fresh, r, prev) {
    var info = document.createElement('p');
    info.textContent = 'スコア ' + r.score + '点・正解 ' + r.correct + '/' + r.total + '・ミス ' + r.misses + '回';
    var ttl = document.createElement('p'); ttl.className = 'jd-title'; ttl.textContent = '称号「' + r.title + '」';
    WP.showClear({ sec: r.sec, fresh: fresh, head: r.goal ? LINE.stops[SP.to].name + 'に到着！' : 'ミス3回でおしまい', emoji: r.goal ? '🏁' : '🚗', row: shareRow(r),
      extra: [info, ttl], note: prev ? '今日の記録（1回目）: ' + prev.score + '点' : null, again: begin });
  }

  // ---- 進行（アプリの update と同じ順: gap → approach → question → feedback）----
  var last = 0;
  function frame(ts) {
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    if (document.hidden) dt = 0;
    if (G && !G.over) {
      if (G.phase === 'gap') { G.t -= dt; if (G.t <= 0) spawn(); }
      else if (G.phase === 'approach') { G.t -= dt; if (G.t <= 0) pass(); }
      else if (G.phase === 'question') {
        G.t += dt;
        var left = Math.max(0, 1 - G.t / G.limit);
        el.timerFill.style.transform = 'scaleX(' + left + ')';
        if (left < 0.35 && el.timerFill.className !== 'hurry') el.timerFill.className = 'hurry';
        var sl = Math.ceil(G.limit - G.t); if (sl <= 2 && sl !== G.lastTick) { G.lastTick = sl; Snd.tick(); }
        if (G.t >= G.limit) answer(null);
      } else if (G.phase === 'feedback') {
        G.t -= dt;
        if (G.t <= 0) {
          var S = G.o.S;
          if (S.goal || S.misses >= SP.miss) { el.plateWrap.className = 'leave'; end(); }
          else { el.plateWrap.className = 'leave'; G.phase = 'gap'; G.t = C.GAP_MIN + Math.random() * (C.GAP_MAX - C.GAP_MIN); }
        }
      }
    }
    draw(reduce ? 0 : dt);
    root.requestAnimationFrame(frame);
  }

  el.yes.addEventListener('click', function () { Snd.init(); answer(true); });
  el.no.addEventListener('click', function () { Snd.init(); answer(false); });
  $('btn-go').addEventListener('click', begin);
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'f' || k === 'F' || k === 'ArrowLeft') { if (G && G.phase === 'question') { e.preventDefault(); answer(true); } }
    else if (k === 'j' || k === 'J' || k === 'ArrowRight') { if (G && G.phase === 'question') { e.preventDefault(); answer(false); } }
    else if ((k === ' ' || k === 'Enter') && !el.start.hidden && !WP.clearOpen()) { e.preventDefault(); begin(); }
  });

  // 自動テスト用（今日のナンバーの並びは daily.js からいつでも計算できるので、出してもこまらない）
  root.__webPlay = {
    spec: function (d) { return J.dailySpec(d || DAY); }, plates: function (d, n) { return J.plates(d || DAY, n || 40); },
    phase: function () { return G ? G.phase : 'start'; }, plate: function () { return G && G.plate ? { num: G.plate.num, q: G.plate.q, truth: J.truthOf(G.plate.q, G.plate.num) } : null; },
    state: function () { return G ? { score: G.o.S.score, km: G.o.S.km, misses: G.o.S.misses, goal: G.o.S.goal } : null; },
    skip: function () { if (G && (G.phase === 'gap' || G.phase === 'approach' || G.phase === 'feedback')) G.t = G.phase === 'feedback' ? 0 : 0.001; }
  };

  fit(); root.requestAnimationFrame(frame);
  var rec = WP.record();
  if (rec) result(false, rec, null);
})(window);

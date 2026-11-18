// xmas.js — クリスマス期間（毎年 12/1 0:00 〜 12/25 23:59 日本時間）の見た目だけを切りかえる小さな道具。
// 原本は _shared/xmas.js。各ゲームのフォルダにコピーして使う（ゆでたまご・まど・すうじ）。
// - 問題（今日の問題のたね・盤面）は変えない。見た目・名前・図鑑/スタンプだけ
// - 確認用: URL に ?xmasPreview=1（期間外でもクリスマスにする）／ ?xmasPreview=0（期間中でもふつう）。
//   または localStorage の xmasPreview = '1'。どちらもふつうに遊ぶ人はさわれない（アプリは URL を変えられない）
(function () {
  if (typeof window === 'undefined') return;
  var forced = null;
  try { var m = /[?&]xmasPreview=([01])\b/.exec(location.search || ''); if (m) forced = m[1] === '1'; } catch (e) { /* noop */ }
  if (forced === null) { try { if (localStorage.getItem('xmasPreview') === '1') forced = true; } catch (e) { /* noop */ } }
  function jst(t) { return new Date((t == null ? Date.now() : t) + 9 * 3600000); }
  // 日本時間で 12月1日〜25日か
  function inPeriod(t) { var d = jst(t); return d.getUTCMonth() === 11 && d.getUTCDate() <= 25; }
  // 'YYYY-MM-DD' / 'YYYY-M-D' の日が期間か（過去の問題の日など）
  function dayIn(day) { var p = String(day || '').split('-'); return +p[1] === 12 && +p[2] >= 1 && +p[2] <= 25; }
  function active() { return forced !== null ? forced : inPeriod(); }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  // 雪（2D キャンバス1枚・粒は少なめ。動きを減らす設定のときは止まった雪を1回描くだけ）
  function snow(opt) {
    opt = opt || {};
    var cv = document.createElement('canvas'), c = cv.getContext('2d'), flakes = [], raf = 0, on = false, last = 0, W = 0, H = 0, dpr = 1;
    cv.className = 'xmas-snow';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;' + (opt.z == null ? '' : 'z-index:' + opt.z + ';') + (opt.css || '');
    var par = opt.parent || document.body;
    if (opt.before) par.insertBefore(cv, opt.before); else par.appendChild(cv);   // before: うしろに置きたい要素（ボタンの下に雪）
    var N = opt.count || 36, col = opt.color || 'rgba(255,255,255,0.85)';
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr | 0; cv.height = H * dpr | 0; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function mk(top) { return { x: Math.random() * W, y: top ? -8 : Math.random() * H, r: 1 + Math.random() * 2.4, v: 18 + Math.random() * 30, ph: Math.random() * 6.28, a: 0.45 + Math.random() * 0.5 }; }
    function draw() {
      c.clearRect(0, 0, W, H); c.fillStyle = col;
      for (var i = 0; i < flakes.length; i++) { var f = flakes[i]; c.globalAlpha = f.a; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.283); c.fill(); }
      c.globalAlpha = 1;
    }
    function step(t) {
      if (!on) return;
      raf = requestAnimationFrame(step);
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i]; f.ph += dt * 1.3; f.y += f.v * dt; f.x += Math.sin(f.ph) * 12 * dt;
        if (f.y > H + 6) flakes[i] = mk(true);
      }
      draw();
    }
    function start() {
      size(); if (!flakes.length) for (var i = 0; i < N; i++) flakes.push(mk(false));
      cv.style.display = '';
      if (reduced()) { draw(); return; }
      if (!on) { on = true; last = 0; raf = requestAnimationFrame(step); }
    }
    function stop() { on = false; cancelAnimationFrame(raf); cv.style.display = 'none'; }
    window.addEventListener('resize', function () { if (cv.style.display !== 'none') { size(); draw(); } });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { on = false; cancelAnimationFrame(raf); } else if (cv.style.display !== 'none') start();
    });
    stop();
    return { start: start, stop: stop, el: cv };
  }

  // タイトルの小さな帯「12/25 まで クリスマス期間」
  function banner(parent, before) {
    if (!parent || parent.querySelector('.xmas-banner')) return null;
    var b = document.createElement('div');
    b.className = 'xmas-banner';
    b.textContent = '🎄 12/25 まで クリスマス期間';
    b.style.cssText = 'display:inline-block;margin:6px auto;padding:4px 12px 5px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.04em;' +
      'color:#fff;background:linear-gradient(90deg,#b8232f,#1f7a46);box-shadow:0 2px 8px #0003;pointer-events:none;align-self:center;';
    if (before) parent.insertBefore(b, before); else parent.appendChild(b);
    return b;
  }

  window.Xmas = { active: active, inPeriod: inPeriod, dayIn: dayIn, reduced: reduced, snow: snow, banner: banner, preview: forced === true };
})();

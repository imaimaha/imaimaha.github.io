/* いまのアプリ — サイト共通の小さなスクリプト（ライブラリなし）
   今日の日付（日本時間）・次の問題までのカウントダウン・ふわっと出る動き・カードのかたむき・紙ふぶき・数のカウントアップ・
   note の記事（/apps/note.json）・アプリ一覧の絞りこみ。動きは「視差効果を減らす」設定のときは出さない */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = '日月火水木金土';
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function $$(s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)); }

  /* 今日（日本時間）とカウントダウン */
  function jst() { var n = Date.now() + 324e5; return { n: n, x: new Date(n) }; }
  function paintDate() {
    var t = jst().x, y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, dd = t.getUTCDate(), w = W[t.getUTCDay()];
    $$('[data-cal-m]').forEach(function (e) { e.textContent = y + '年 ' + m + '月'; });
    $$('[data-cal-d]').forEach(function (e) { e.textContent = dd; });
    $$('[data-cal-w]').forEach(function (e) { e.textContent = w + '曜日'; });
    $$('[data-today]').forEach(function (e) { e.textContent = m + '月' + dd + '日（' + w + '）'; });
    $$('time[data-today], time[data-cal]').forEach(function (e) { e.setAttribute('datetime', y + '-' + p2(m) + '-' + p2(dd)); });
  }
  var hh = d.getElementById('cd-h'), mm = d.getElementById('cd-m'), ss = d.getElementById('cd-s'), lastDay = '';
  function tick() {
    var j = jst(), r = Math.ceil((864e5 - j.n % 864e5) / 1e3) % 86400, day = j.x.getUTCDate() + '';
    if (day !== lastDay) { lastDay = day; paintDate(); }
    if (!hh) return;
    var v = [p2(Math.floor(r / 3600)), p2(Math.floor(r / 60) % 60), p2(r % 60)];
    [hh, mm, ss].forEach(function (e, i) {
      if (e.textContent !== v[i]) { e.textContent = v[i]; if (!still) { e.classList.remove('tick'); void e.offsetWidth; e.classList.add('tick'); } }
    });
  }
  tick(); setInterval(tick, 1000);

  /* ふわっと出る */
  if (!still && 'IntersectionObserver' in window) {
    root.classList.add('js-rv');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el) {
      var sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.setProperty('--dl', Math.min(sib, 6) * 0.07 + 's');
      io.observe(el);
    });
  }

  /* 数のカウントアップ */
  $$('[data-n]').forEach(function (el) {
    var to = +el.getAttribute('data-n'); if (still || !to || !('IntersectionObserver' in window)) return;
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; o.disconnect();
      var t0 = performance.now();
      (function step(t) { var k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
    });
    el.textContent = '0'; o.observe(el);
  });

  /* カードのかたむき（マウスのときだけ） */
  if (!still && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(700px) rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 9).toFixed(2) + 'deg) translateY(-6px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }


  /* プレイ動画: 見えるところに来たら読みこんで再生（動きを減らす設定のときは、ポスターのまま。押すと再生） */
  $$('video[data-vsrc]').forEach(function (v) {
    var src = v.getAttribute('data-vsrc');
    function load() { if (!v.getAttribute('src')) { v.src = src; } }
    if (still || !('IntersectionObserver' in window)) { v.controls = true; v.preload = 'none'; load(); return; }
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { load(); var pr = v.play(); if (pr && pr.catch) pr.catch(function () { v.controls = true; }); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    vo.observe(v);
  });

  /* 電話の画面のゆるい視差 */
  var stage = d.querySelector('.stage');
  if (stage && !still) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; var y = Math.min(window.scrollY, 600); stage.style.transform = 'translate3d(0,' + (y * -0.08).toFixed(1) + 'px,0)'; });
    }, { passive: true });
  }

  /* 紙ふぶき */
  var BITS = ['🎉', '✨', '⭐', '🐛', '🍱', '🥚', '🏆'];
  $$('[data-confetti]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (still || !a.animate) return;
      var r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 16; i++) {
        var s = d.createElement('span'); s.className = 'confetti'; s.setAttribute('aria-hidden', 'true');
        s.textContent = BITS[i % BITS.length]; s.style.left = cx + 'px'; s.style.top = cy + 'px'; d.body.appendChild(s);
        var ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 110;
        s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + Math.cos(ang) * dist + 'px), calc(-50% + ' + (Math.sin(ang) * dist - 40) + 'px)) rotate(' + (Math.random() * 360 - 180) + 'deg) scale(1)', opacity: 0 }],
          { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(s);
      }
      var href = a.getAttribute('href') || '';
      if (href && href.charAt(0) !== '#' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setTimeout(function () { location.href = href; }, 420); }
    });
  });

  /* note の記事 */
  var nl = d.getElementById('notes');
  if (nl && window.fetch) {
    fetch('/apps/note.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.items || !j.items.length) return;
      var max = +nl.getAttribute('data-max') || 999, thumbs = nl.classList.contains('thumbs');
      nl.textContent = '';
      j.items.slice(0, max).forEach(function (it) {
        if (!/^https:\/\/note\.com\//.test(it.url)) return;
        var li = d.createElement('li'), a = d.createElement('a'), t = d.createElement('time'), s = d.createElement('span'), g = d.createElement('span');
        a.href = it.url; a.rel = 'noopener';
        if (thumbs) {
          var th;
          if (it.thumb && /^https:\/\/assets\.st-note\.com\//.test(it.thumb)) { th = d.createElement('img'); th.src = it.thumb.replace(/width=\d+/, 'width=480'); th.alt = ''; th.loading = 'lazy'; th.width = 160; th.height = 84; }
          else { th = d.createElement('span'); th.textContent = '📝'; th.setAttribute('aria-hidden', 'true'); }
          th.className = 'th'; a.appendChild(th);
        }
        t.dateTime = it.date; t.textContent = String(it.date).replace(/-/g, '.');
        s.className = 'nt'; s.textContent = it.title; g.className = 'go2'; g.textContent = 'note で読む →';
        a.appendChild(t); a.appendChild(s); a.appendChild(g); li.appendChild(a); nl.appendChild(li);
      });
    }).catch(function () {});
  }

  /* アプリ一覧の絞りこみ */
  var fl = d.getElementById('filters'), q = d.getElementById('q');
  if (fl) {
    fl.hidden = false; if (q) q.closest('.search').hidden = false;
    var cur = 'all';
    function apply() {
      var word = q ? q.value.trim().toLowerCase() : '';
      $$('[data-sec]').forEach(function (sec) {
        var any = false;
        $$('[data-k]', sec).forEach(function (c) {
          var ok = (cur === 'all' || sec.getAttribute('data-sec') === cur) && (!word || c.getAttribute('data-k').toLowerCase().indexOf(word) >= 0);
          c.hidden = !ok; if (ok) any = true;
        });
        sec.hidden = !any;
      });
      var em = d.getElementById('empty'); if (em) em.hidden = $$('[data-sec]:not([hidden])').length > 0;
    }
    $$('button', fl).forEach(function (b) {
      b.addEventListener('click', function () {
        cur = b.getAttribute('data-f'); $$('button', fl).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); apply();
      });
    });
    if (q) q.addEventListener('input', apply);
    var h = (location.hash || '').slice(1);
    $$('button', fl).forEach(function (b) { if (b.getAttribute('data-f') === h) b.click(); });
  }
})();

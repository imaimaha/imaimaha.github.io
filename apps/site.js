/* いまのアプリ — サイト共通の小さなスクリプト（ライブラリなし）
   今日の日付（日本時間）・次の問題までのカウントダウン・ふわっと出る動き・カードのかたむき・紙ふぶき・数のカウントアップ・
   note の記事（/apps/note.json）・アプリ一覧の絞りこみ。動きは「視差効果を減らす」設定のときは出さない */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = '日月火水木金土';
  var EN = root.lang === 'en', MON = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
      DAY = 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ');
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function $$(s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)); }

  /* 今日（日本時間）とカウントダウン */
  function jst() { var n = Date.now() + 324e5; return { n: n, x: new Date(n) }; }
  function paintDate() {
    var t = jst().x, y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, dd = t.getUTCDate(), w = W[t.getUTCDay()];
    if (EN) {   /* 英語のページ（/en/）: 「Nov 2026」「20」「Thursday」 */
      $$('[data-cal-m]').forEach(function (e) { e.textContent = MON[m - 1] + ' ' + y; });
      $$('[data-cal-d]').forEach(function (e) { e.textContent = dd; });
      $$('[data-cal-w]').forEach(function (e) { e.textContent = DAY[t.getUTCDay()]; });
      $$('[data-today]').forEach(function (e) { e.textContent = DAY[t.getUTCDay()].slice(0, 3) + ', ' + MON[m - 1] + ' ' + dd; });
      $$('time[data-today], time[data-cal]').forEach(function (e) { e.setAttribute('datetime', y + '-' + p2(m) + '-' + p2(dd)); });
      return;
    }
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
    var v = [p2(Math.floor(r / 3600)), p2(Math.floor(r / 60) % 60), p2(r % 60)];
    $$('[data-cdf]').forEach(function (e) { e.textContent = v.join(':'); });   // フッターの「また あした。」
    if (!hh) return;
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


  /* 期間限定のかざり（日本時間。クリスマス 12/1〜12/25・お正月 12/29〜1/7）。HTML は いつも同じで、期間中だけ ここで出す。
     ためすとき: ?xmasPreview=1 / ?shogatsuPreview=1（=0 で期間中でも出さない）。リボンと雪は ヒーローの中に重ねるだけ（ほかの場所は動かない） */
  (function () {
    function flag(k) { var m = new RegExp('[?&]' + k + '=([01])(?:&|$)').exec(location.search || ''); return m ? m[1] === '1' : null; }
    var t = jst().x, mo = t.getUTCMonth() + 1, dd = t.getUTCDate();
    var xf = flag('xmasPreview'), sf = flag('shogatsuPreview');
    var xmas = xf !== null ? xf : (mo === 12 && dd <= 25);
    var ny = sf !== null ? sf : ((mo === 12 && dd >= 29) || (mo === 1 && dd <= 7));
    if (xmas && ny) xmas = false;
    var k = xmas ? 'xmas' : ny ? 'shogatsu' : '';
    if (!k) return;
    root.classList.add('season-' + k);
    $$('[data-season="' + k + '"]').forEach(function (e) { e.hidden = false; });
    var hero = d.querySelector('.hhero');
    if (!hero) return;
    var deco = d.createElement('div'); deco.className = 'sdeco ' + k; deco.setAttribute('aria-hidden', 'true');
    if (k === 'xmas') {
      var fall = hero.offsetHeight + 24;
      deco.style.setProperty('--fall', fall + 'px');
      for (var i = 0; i < 22; i++) {
        var f = d.createElement('i'), r = Math.random();
        f.style.left = (Math.random() * 100).toFixed(1) + '%';
        f.style.width = f.style.height = (3 + r * 4).toFixed(1) + 'px';
        f.style.opacity = (0.35 + Math.random() * 0.45).toFixed(2);
        if (still) f.style.top = (Math.random() * 96).toFixed(1) + '%';
        else { f.style.animationDuration = (9 + Math.random() * 9).toFixed(1) + 's'; f.style.animationDelay = (-Math.random() * 18).toFixed(1) + 's'; }
        deco.appendChild(f);
      }
    }
    hero.insertBefore(deco, hero.firstChild);
    var rb = d.createElement('p'); rb.className = 'sribbon ' + k;
    rb.textContent = k === 'xmas' ? 'クリスマス期間（12/25 まで）' : 'あけましておめでとう';
    hero.appendChild(rb);
  })();

  /* 「数字で見る」の日数（はじめてのアプリの公開日から。日本時間の今日で数えなおす） */
  $$('[data-since]').forEach(function (e) {
    var p = e.getAttribute('data-since').split('-'), n = Math.floor((jst().n - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 864e5);
    if (n >= 0) e.textContent = n;
  });

  /* アドベントカレンダー（クリスマスの期間だけ出る section の中。12/1〜12/25・日本時間）。
     開くのは今日のとびらだけ（その日のアプリの /play/ へ）。すぎた日は、この端末で開けた日にだけ ✓ と絵文字。?xmasPreview=1 のとき12月でなければ 12/1 として見せる（&advDay=9 で日をえらべる） */
  (function () {
    var adv = d.querySelector('[data-advent]');
    if (!adv || !root.classList.contains('season-xmas')) return;
    var t = jst().x, y = t.getUTCFullYear(), mo = t.getUTCMonth() + 1, today = t.getUTCDate();
    var key = y + '-' + p2(mo) + '-' + p2(today);
    var day = mo === 12 ? today : 1;
    var m = /[?&]advDay=(\d{1,2})(?:&|$)/.exec(location.search || '');
    if (m && /[?&]xmasPreview=1/.test(location.search)) day = Math.min(25, Math.max(1, +m[1]));
    var SK = 'site.advent.' + y, opened = {};
    try { (JSON.parse(localStorage.getItem(SK) || '[]') || []).forEach(function (k) { opened[k] = 1; }); } catch (e) {}
    function done(g) {
      var subs = g === 'suji' ? ['a', 'b'] : [''];
      return subs.some(function (s) { try { var r = JSON.parse(localStorage.getItem('web.' + g + '.today' + s) || 'null'); return r && r.day === key; } catch (e) { return false; } });
    }
    $$('li[data-day]', adv).forEach(function (li) {
      var k = +li.getAttribute('data-day'), g = li.getAttribute('data-d');
      function icon(cls) { var im = d.createElement('img'); im.className = cls; im.src = '/' + g + '/icon-256.webp'; im.alt = ''; im.width = im.height = 40; return im; }   // 絵文字のかわりにアプリのアイコン（2026-11-20）
      if (k < day) {
        li.className = 'past' + (opened[k] ? ' opened' : '');
        if (opened[k]) li.appendChild(icon('pe'));
      } else if (k > day) {
        li.className = 'fut';
      } else {
        li.className = 'now';
        li.textContent = '';
        var b = d.createElement('b'); b.textContent = '12/' + k + ' のとびら';
        var em = icon('em');
        var nm = d.createElement('b'); nm.className = 'nm'; nm.textContent = li.getAttribute('data-t');
        var a = d.createElement('a'); a.href = '/play/' + g + '/'; a.className = 'open';
        a.textContent = done(g) ? 'クリアずみ・もう一度' : '▶ あけて遊ぶ';
        a.setAttribute('aria-label', '12月' + k + '日のとびら：' + li.getAttribute('data-n') + 'の' + li.getAttribute('data-t') + 'をブラウザで遊ぶ');
        a.addEventListener('click', function () {
          opened[k] = 1;
          try { localStorage.setItem(SK, JSON.stringify(Object.keys(opened).map(Number))); } catch (e2) {}
        });
        li.appendChild(b); li.appendChild(em); li.appendChild(nm); li.appendChild(a);
      }
    });
  })();

  /* どれが合う？（/start/）。3つの質問の点数をたして、いちばん高いアプリ＋つぎの2本。答えはこの画面の中だけ */
  (function () {
    var box = d.getElementById('chooser');
    if (!box) return;
    box.hidden = false;
    var qs = $$('.q', box), st = $$('.steps i', box), res = d.getElementById('res'), sc = {}, k = 0;
    var order = $$('#cands li[data-app]').map(function (li) { return li.getAttribute('data-app'); });
    function show() {
      qs.forEach(function (q, i) { q.hidden = i !== k; });
      st.forEach(function (s, i) { s.classList.toggle('on', i <= k); });
    }
    function card(dd) { var c = d.querySelector('#cands li[data-app="' + dd + '"]'); return c ? c.cloneNode(true) : null; }
    function result() {
      qs.forEach(function (q) { q.hidden = true; });
      var ds = order.slice().sort(function (a, b) { return (sc[b] || 0) - (sc[a] || 0) || order.indexOf(a) - order.indexOf(b); });
      var top = d.getElementById('res-top'), also = d.getElementById('res-also');
      top.textContent = ''; also.textContent = '';
      var c0 = card(ds[0]); if (c0) top.appendChild(c0);
      ds.slice(1, 3).forEach(function (x) {
        var src = d.querySelector('#cands li[data-app="' + x + '"]'); if (!src) return;
        var li = d.createElement('li'), a = d.createElement('a'), im = d.createElement('img'), sp = d.createElement('span');
        a.href = '/' + x + '/'; im.src = '/' + x + '/icon-256.webp'; im.alt = ''; im.width = 36; im.height = 36;
        sp.textContent = src.querySelector('h3').textContent;
        a.appendChild(im); a.appendChild(sp); li.appendChild(a); also.appendChild(li);
      });
      res.hidden = false;
      var h = d.getElementById('res-k'); if (h) h.focus({ preventScroll: true });
      var r = box.getBoundingClientRect(); if (r.top < 70) window.scrollBy({ top: r.top - 80, behavior: still ? 'auto' : 'smooth' });
    }
    qs.forEach(function (q) {
      $$('button', q).forEach(function (b) {
        b.addEventListener('click', function () {
          var w = {}; try { w = JSON.parse(b.getAttribute('data-w')) || {}; } catch (e) {}
          for (var x in w) sc[x] = (sc[x] || 0) + w[x];
          k++;
          if (k < qs.length) { show(); var h2 = qs[k].querySelector('h2'); if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus({ preventScroll: true }); } }
          else result();
        });
      });
    });
    d.getElementById('res-again').addEventListener('click', function () {
      sc = {}; k = 0; res.hidden = true; show(); var h2 = qs[0].querySelector('h2'); if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus(); }
    });
    show();
  })();

  /* プレイ動画: 見えるところに来たら読みこんで再生（動きを減らす設定のときは、ポスターのまま。押すと再生） */
  /* データ節約モードのときも、動きを減らす設定と同じく自動では読みこまない。読みこみはページの load のあと（はじめの表示とぶつけない） */
  var lite = still || !!(navigator.connection && navigator.connection.saveData);
  function vids() { $$('video[data-vsrc]').forEach(function (v) {
    var src = v.getAttribute('data-vsrc');
    function load() { if (!v.getAttribute('src')) { v.src = src; } }
    if (lite || !('IntersectionObserver' in window)) { if (v.hasAttribute('data-card')) return; v.controls = true; v.preload = 'none'; load(); return; }
    var vo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { load(); var pr = v.play(); if (pr && pr.catch) pr.catch(function () { v.controls = true; }); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    vo.observe(v);
  }); }
  if (d.readyState === 'complete') vids(); else window.addEventListener('load', vids);

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
  var BITS = ['#ffcf3f', '#e05a3a', '#56b33a', '#5560c8', '#ff9a6b', '#2fa3c9', '#c94532'];   // 紙ふぶきは色の小さな四角（絵文字はやめた 2026-11-20）
  $$('[data-confetti]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (still || !a.animate) return;
      var r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 16; i++) {
        var s = d.createElement('span'); s.className = 'confetti'; s.setAttribute('aria-hidden', 'true');
        s.style.background = BITS[i % BITS.length]; s.style.left = cx + 'px'; s.style.top = cy + 'px'; d.body.appendChild(s);
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
          else { th = d.createElement('span'); th.textContent = 'note'; th.setAttribute('aria-hidden', 'true'); }
          th.className = 'th'; a.appendChild(th);
        }
        t.dateTime = it.date; t.textContent = String(it.date).replace(/-/g, '.');
        s.className = 'nt'; s.textContent = it.title; g.className = 'go2'; g.textContent = 'note で読む →';
        a.appendChild(t); a.appendChild(s); a.appendChild(g); li.appendChild(a); nl.appendChild(li);
      });
    }).catch(function () {});
  }

  /* トップの「今日のいもむしを ここで1問」: ボタンをおしたときだけ /play/hitofude/logic.js と /apps/hero-play.js を読む（トップは軽いまま） */
  (function () {
    var bt = d.querySelector('[data-hp]'), hb = d.getElementById('hpm-body');
    if (!bt || !hb) return;
    function load(src, next) { var sc = d.createElement('script'); sc.src = src; sc.onload = next; sc.onerror = fail; d.body.appendChild(sc); }
    function fail() { hb.textContent = '読みこめませんでした。'; var a = d.createElement('a'); a.href = '/play/hitofude/'; a.textContent = 'ブラウザ版のページで遊ぶ →'; hb.appendChild(a); bt.disabled = false; }
    function go() {
      bt.hidden = true; hb.hidden = false; hb.textContent = '盤を用意しています…';
      var v = bt.getAttribute('data-hp');
      if (window.HF) load('/apps/hero-play.js?v=' + v, function () {});
      else load('/play/hitofude/logic.js?v=' + v, function () { load('/apps/hero-play.js?v=' + v, function () {}); });
    }
    bt.addEventListener('click', go);
    if (/[?&]hpDemo=1(?:&|$)/.test(location.search)) go();
  })();

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

// 読み物: 目次で、いま読んでいる見出しに色をつける（記事の右の列・/guide/ の左の列）
(function () {
  var links = document.querySelectorAll('.tocs a, .gside a');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {}, cur = null;
  links.forEach(function (a) { var id = a.getAttribute('href').slice(1); var el = document.getElementById(id); if (el) map[id] = { a: a, el: el }; });
  var ids = Object.keys(map);
  function pick() {
    var best = ids[0];
    ids.forEach(function (id) { if (map[id].el.getBoundingClientRect().top < 140) best = id; });
    if (best !== cur) { if (cur) map[cur].a.classList.remove('on'); map[best].a.classList.add('on'); cur = best; }
  }
  var io = new IntersectionObserver(pick, { rootMargin: '-80px 0px -60% 0px' });
  ids.forEach(function (id) { io.observe(map[id].el); });
  window.addEventListener('scroll', function () { window.requestAnimationFrame(pick); }, { passive: true });
  pick();
})();

/* 今日のまとめ（/today/ と /play/ で使う）
 *   ブラウザ版の「今日の1問」の記録（この端末の localStorage の web.<ゲーム>.today / すうじは todaya・todayb）を読んで、
 *   1まいのカードにまとめるだけ。どこにも送らない。シェアの文は ✅/⬜ だけ（答えやタイムはのせない）
 *   置き場所: <div id="digest"></div>（中身はここで作る。CSP で style 属性が使えないので、見た目はクラスだけで変える）
 *   data-compact があるとき（/today/・/play/）: 同じページに問題の一覧がもうあるので、まとめの中には一覧を出さない。
 *     かわりに、ページの一覧の [data-play="<ゲーム>"] の行に「できた」のしるしをつける（2026-11-20 一覧が2回出ていたのをやめた）
 *   画面には絵文字を出さない。シェアの文だけは、前と同じ絵文字の形（✅/⬜）
 */
(function () {
  'use strict';
  var box = document.getElementById('digest');
  if (!box) return;
  // [ゲーム, 記録の名前のうしろ, 絵文字, 今日の1問の名前, アプリの名前]
  var ROWS = [
    ['hitofude', '', '🐛', '今日のいもむし', 'ひとふでいもむし'],
    ['suji', 'a', '🏠', '今日のへや割り', 'すうじのへや'],
    ['suji', 'b', '👤', '今日の住人さがし', 'すうじのへや'],
    ['okazu', '', '🍱', '今日のおべんとう', 'おかず詰めパズル'],
    ['jimidrive', '', '🚗', '今日のドライブ', 'ナンバー暗算ドライブ'],
    ['kakezan', '', '🏃', '今日のステージ', '暗算ランナー'],
    ['yudetamago', '', '🥚', '今日のたまご', 'つるっと ゆでたまご剥き']
  ];
  var WD = '日月火水木金土';
  var URL = 'https://imaimaha.com/play/';
  var compact = box.hasAttribute('data-compact');

  function dayKey() {
    var t = new Date(Date.now() + 324e5), m = t.getUTCMonth() + 1, d = t.getUTCDate();
    return t.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  function rec(ns, sub, day) {
    try { var r = JSON.parse(localStorage.getItem('web.' + ns + '.today' + sub) || 'null'); return r && typeof r === 'object' && r.day === day ? r : null; }
    catch (e) { return null; }
  }
  function fmt(s) { s = Math.max(0, Math.round(+s || 0)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'dg-buf';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); done(ok);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  var shown = '';
  function paint() {
    var day = dayKey();
    if (day === shown) return;
    shown = day;
    var p = day.split('-'), md = (+p[1]) + '/' + (+p[2]), wd = WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()];
    var ok = 0, line = [];
    var card = el('div', 'dg-card');
    var hd = el('div', 'dg-hd');
    hd.appendChild(el('b', null, md + '（' + wd + '）の今日の1問'));
    hd.appendChild(el('small', null, 'ブラウザ版'));
    card.appendChild(hd);
    var ul = el('ul', 'dg-list'), done = {};
    ROWS.forEach(function (r) {
      var x = rec(r[0], r[1], day), li = el('li', x ? 'ok' : '');
      var ic = el('img', 'e'); ic.src = '/' + r[0] + '/icon-256.webp'; ic.alt = ''; ic.width = 28; ic.height = 28; li.appendChild(ic);
      done[r[0]] = done[r[0]] || [0, 0]; done[r[0]][1]++; if (x) done[r[0]][0]++;
      var n = el('span', 'n', r[3]); n.appendChild(el('small', null, r[4])); li.appendChild(n);
      if (x) {
        ok++; line.push(r[2] + '✅');
        var st = el('span', 'st', x.sec != null ? fmt(x.sec) : 'できた');
        st.setAttribute('aria-label', 'できた' + (x.sec != null ? '（' + fmt(x.sec) + '）' : ''));
        li.appendChild(st);
      } else {
        line.push(r[2] + '⬜');
        var a = el('a', 'go', 'あそぶ'); a.href = '/play/' + r[0] + '/'; a.setAttribute('aria-label', r[3] + 'をあそぶ');
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    if (!compact) card.appendChild(ul);
    else Object.keys(done).forEach(function (g) {   // ページの一覧の行に「できた」をつける
      var rows = document.querySelectorAll('[data-play="' + g + '"]');
      for (var k = 0; k < rows.length; k++) {
        var row = rows[k], n = done[g], t = row.querySelector('.dg-done');
        if (t) t.remove();
        row.classList.toggle('dg-ok', n[0] === n[1]);
        if (!n[0]) continue;
        t = el('span', 'dg-done', n[1] > 1 && n[0] < n[1] ? 'できた ' + n[0] + '/' + n[1] : 'できた');
        row.appendChild(t);
      }
    });
    var pg = el('div', 'dg-prog'); pg.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < ROWS.length; i++) pg.appendChild(el('i', i < ok ? 'on' : ''));
    card.appendChild(pg);
    var sum = el('div', 'dg-sum');
    sum.appendChild(el('p', null, ok === ROWS.length ? 'ぜんぶできた！ ' + ok + ' / ' + ROWS.length : ok + ' / ' + ROWS.length + ' できた'));
    var text = 'いまのアプリ ' + md + ' の今日の1問 ' + ok + '/' + ROWS.length + '\n' + line.join(' ') + '\n' + URL;
    var msg = el('p', 'dg-msg'); msg.setAttribute('aria-live', 'polite');
    var sh = el('button', 'dg-share', 'まとめをシェア'); sh.type = 'button';
    if (!ok) { sh.disabled = true; msg.textContent = '1つ遊ぶと、まとめをシェアできます。'; }
    sh.addEventListener('click', function () {
      function say(t) { msg.textContent = t; }
      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        navigator.share({ text: text }).then(function () { say(''); }, function (e) { if (!e || e.name !== 'AbortError') copyText(text, function (c) { say(c ? 'コピーしました！' : text); }); });
        return;
      }
      copyText(text, function (c) { say(c ? 'コピーしました！' : text); });
    });
    sum.appendChild(sh);
    card.appendChild(sum);
    card.appendChild(msg);
    card.appendChild(el('p', 'dg-cap', 'ブラウザ版で遊んだ記録だけをまとめています。記録はこの端末の中だけで、どこにも送りません。アプリの記録はアプリの中で見られます。'));
    box.textContent = '';
    box.appendChild(card);
  }
  paint();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { shown = ''; paint(); } });
})();

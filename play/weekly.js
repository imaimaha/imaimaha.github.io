/* 今週のチャレンジ（/play/ のスタンプカード）
 *   今週の1本（週ごとにかわる・だれが見ても同じ）を、月〜日の7日つづけて遊ぶと、ぜんぶのマスにスタンプ。
 *   スタンプは、この端末で「今日の1問」をクリアした日（common.js が web.stamps に残す・web.<ゲーム>.today も読む）。
 *   どこにも送らない。景品やランキングはない。置き場所: <div id="weekly"></div>（CSP で style 属性が使えないので、見た目はクラスだけ）
 */
(function () {
  'use strict';
  var box = document.getElementById('weekly');
  if (!box) return;
  // [ゲーム, 今日の1問の名前, 絵文字, 記録の名前のうしろ（すうじは2問）]
  var GAMES = [
    ['hitofude', '今日のいもむし', '🐛', ['']],
    ['suji', '今日のすうじのへや', '🏠', ['a', 'b']],
    ['okazu', '今日のおべんとう', '🍱', ['']],
    ['jimidrive', '今日のドライブ', '🚗', ['']],
    ['kakezan', '今日のステージ', '🏃', ['']],
    ['yudetamago', '今日のたまご', '🥚', ['']]
  ];
  var WD = ['月', '火', '水', '木', '金', '土', '日'];
  var D = 864e5;
  var BASE_MON = Date.UTC(2026, 0, 5);   // 2026-01-05（月）から数えて、週ごとに次のゲーム

  function key(ms) { var t = new Date(ms), m = t.getUTCMonth() + 1, d = t.getUTCDate(); return t.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function lget(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var shown = '';
  function paint() {
    var now = Date.now() + 9 * 3600000, today = Math.floor(now / D) * D, todayKey = key(today);
    if (todayKey === shown) return;
    shown = todayKey;
    var wd = (new Date(today).getUTCDay() + 6) % 7, mon = today - wd * D;   // 月曜 0 … 日曜 6
    var wk = Math.round((mon - BASE_MON) / (7 * D)), g = GAMES[((wk % GAMES.length) + GAMES.length) % GAMES.length];
    // 遊んだ日
    var days = {}, st = lget('web.stamps'), a = st && Array.isArray(st[g[0]]) ? st[g[0]] : [];
    a.forEach(function (k) { days[k] = 1; });
    g[3].forEach(function (sub) { var r = lget('web.' + g[0] + '.today' + sub); if (r && typeof r.day === 'string') days[r.day] = 1; });

    var card = el('div', 'wk-card');
    var hd = el('div', 'wk-hd');
    hd.appendChild(el('span', 'wk-e', g[2])).setAttribute('aria-hidden', 'true');
    var t = el('div');
    var b = el('b', null, '今週は「' + g[1] + '」を'); b.appendChild(el('span', 'nw', '7日つづけよう')); t.appendChild(b);
    var m1 = new Date(mon), s1 = new Date(mon + 6 * D);
    t.appendChild(el('small', null, (m1.getUTCMonth() + 1) + '/' + m1.getUTCDate() + '（月）〜 ' + (s1.getUTCMonth() + 1) + '/' + s1.getUTCDate() + '（日）'));
    hd.appendChild(t);
    card.appendChild(hd);
    var ul = el('ol', 'wk-days'), n = 0;
    for (var i = 0; i < 7; i++) {
      var k = key(mon + i * D), done = !!days[k], cls = done ? 'ok' : i < wd ? 'miss' : i === wd ? 'now' : 'fut';
      if (done) n++;
      var li = el('li', cls);
      li.appendChild(el('span', 'd', WD[i]));
      li.appendChild(el('span', 's', done ? g[2] : i === wd ? '今日' : '・')).setAttribute('aria-hidden', 'true');
      li.setAttribute('aria-label', WD[i] + '曜日 ' + (done ? 'スタンプあり' : i < wd ? 'スタンプなし' : i === wd ? '今日・まだ' : 'これから'));
      ul.appendChild(li);
    }
    card.appendChild(ul);
    var ft = el('div', 'wk-ft');
    ft.appendChild(el('p', 'wk-n', n === 7 ? '🎉 7日ぜんぶ！ ' + n + ' / 7' : n + ' / 7 日'));
    if (!days[todayKey]) { var go = el('a', 'wk-go', '▶ 今日のぶんを遊ぶ'); go.href = g[0] + '/'; ft.appendChild(go); }
    else ft.appendChild(el('p', 'wk-ok', '今日のスタンプ OK！ また あした。'));
    card.appendChild(ft);
    card.appendChild(el('p', 'wk-cap', '遊ぶゲームは毎週月曜にかわります。スタンプはこの端末のブラウザ版の記録だけで、どこにも送りません（景品はありません）。'));
    box.textContent = '';
    box.appendChild(card);
  }
  paint();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { shown = ''; paint(); } });
})();

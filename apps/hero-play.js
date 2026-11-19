/* トップの「今日のいもむしを ここで1問」（ボタンをおしたときだけ site.js が読みこむ）
 *   盤とルールは /play/hitofude/logic.js（HF）そのもの＝アプリ・ブラウザ版と同じ今日の盤。
 *   クリアしたら、ブラウザ版と同じ形で この端末に記録（web.hitofude.today・web.stamps）。どこにも送らない。
 */
(function () {
  'use strict';
  var root = document.getElementById('hpm'), body = document.getElementById('hpm-body');
  if (!root || !body || !window.HF || root.getAttribute('data-ready')) return;
  root.setAttribute('data-ready', '1');
  var HF = window.HF, K = HF.K;
  var DAY = HF.dayKey(), P = HF.daily(DAY), b = HF.parse(P.map), s = HF.state(b);
  var PAIR = { w: '#9c5ad6', x: '#21a6a0', y: '#ef8a2a', z: '#e3528e' };
  var INFO = {};   // しかけ → [絵文字, 名前, 図鑑の場所]
  INFO[K.ROCK] = ['🪨', '石', 'hf-rock']; INFO[K.GOAL] = ['🌿', '枝', 'hf-goal']; INFO[K.ARROW] = ['➡️', '矢印の葉', 'hf-arrow']; INFO[K.BIG] = ['🍀', '大きな葉', 'hf-big'];
  INFO[K.WARP] = ['🕳️', 'ワープの穴', 'hf-warp']; INFO[K.MUSH] = ['🍄', 'キノコ', 'hf-mush']; INFO[K.BERRY] = ['🍒', '木の実', 'hf-berry'];
  var WHY = { wall: 'そこは通れないよ', full: 'そこはもう食べたよ', arrow: '矢印の向きにしか出られないよ', straight: 'キノコでしびれて、まっすぐだけ！',
    back: '大きな葉へ すぐ引き返すのはだめ', berry: '木の実は番号の順に', goal: '枝は さいごに行くところ', start: 'いもむしの頭から なぞってね' };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  function lget(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } }

  body.textContent = '';
  var info = el('div', 'hpm-info'), left = el('span', 'hpm-left'), clock = el('span', 'hpm-time', '⏱ 0:00');
  info.appendChild(left); info.appendChild(clock); body.appendChild(info);
  var bd = el('div', 'hpm-bd'); bd.setAttribute('role', 'application'); bd.setAttribute('aria-label', '今日のいもむしの盤。指でなぞって進む');
  bd.style.gridTemplateColumns = 'repeat(' + b.W + ', 1fr)';
  var cells = [];
  for (var i = 0; i < b.n; i++) { var c = el('div', 'c'); cells.push(c); bd.appendChild(c); }
  var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); bd.appendChild(svg);
  body.appendChild(bd);
  var msg = el('p', 'hpm-msg', 'いもむしの頭（🐛）から なぞってスタート'); msg.setAttribute('aria-live', 'polite'); body.appendChild(msg);
  // この盤のしかけ
  var kinds = {}; for (i = 0; i < b.n; i++) if (INFO[b.kind[i]]) kinds[b.kind[i]] = 1;
  var lg = el('p', 'hpm-legend');
  Object.keys(kinds).forEach(function (k) { var x = INFO[k], a = el('a', null, x[0] + ' ' + x[1]); a.href = '/zukan/#' + x[2]; lg.appendChild(a); });
  if (lg.childNodes.length) { lg.insertBefore(el('span', null, 'この盤のしかけ：'), lg.firstChild); body.appendChild(lg); }
  var bar = el('div', 'hpm-bar'), rs = el('button', 'ghost', '🔄 さいしょから'); rs.type = 'button';
  var big = el('a', 'more-link', '大きな画面であそぶ →'); big.href = '/play/hitofude/';
  bar.appendChild(rs); bar.appendChild(big); body.appendChild(bar);
  var win = el('div', 'hpm-win'); win.hidden = true; body.appendChild(win);

  var t0 = 0, sec = 0, timer = 0, over = false, DEMO = /[?&]hpDemo=1(?:&|$)/.test(location.search);   // ?hpDemo=1: 確認用に答えを入れる（記録はしない）
  function tick() { sec = (Date.now() - t0) / 1000; clock.textContent = '⏱ ' + fmt(sec); }

  function paint() {
    var h = HF.head(s), rem = 0;
    for (var i = 0; i < b.n; i++) {
      var k = b.kind[i], c = cells[i], t = '', r = b.need[i] - s.cnt[i];
      c.className = 'c'; c.style.boxShadow = '';
      if (k === K.VOID) c.className += ' v';
      else if (k === K.ROCK) { c.className += ' r'; t = '🪨'; }
      else {
        rem += Math.max(0, r);
        if (r <= 0) c.className += ' e';
        if (k === K.GOAL) { c.className += ' g'; t = '🌿'; }
        else if (r > 0) {
          if (k === K.ARROW) t = '⬆➡⬇⬅'.charAt(b.arrow[i]);
          else if (k === K.BERRY) t = String(b.berry[i]);
          else if (k === K.BIG) t = '🍀';
          else if (k === K.MUSH) t = '🍄';
        }
        if (k === K.BERRY && r > 0) c.className += ' bb' + (b.berry[i] === s.next ? ' nx' : '');
        if (k === K.WARP) { c.className += ' w'; c.style.boxShadow = 'inset 0 0 0 5px ' + (PAIR[b.warpLetter[i]] || '#9c5ad6'); t = '🕳️'; }
        if (i === b.start && !s.path.length) c.className += ' st';
      }
      if (i === h) { c.className += ' h'; t = '🐛'; }
      else if (!s.path.length && i === b.start) t = '🐛';
      c.textContent = t;
    }
    left.textContent = '🍃 のこり ' + rem;
    // 道
    var W = bd.clientWidth - 12, cw = (W - 4 * (b.W - 1)) / b.W, segs = [[]];
    s.path.forEach(function (i, k) { if (s.jump[k]) segs.push([]); segs[segs.length - 1].push(((i % b.W) * (cw + 4) + cw / 2) + ',' + (Math.floor(i / b.W) * (cw + 4) + cw / 2)); });
    svg.setAttribute('width', W); svg.setAttribute('height', (cw + 4) * b.H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    segs.forEach(function (g) {
      if (g.length < 2) return;
      var pl = document.createElementNS(NS, 'polyline'); pl.setAttribute('points', g.join(' '));
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#2f8a1c'); pl.setAttribute('stroke-width', String(cw * 0.34));
      pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round'); pl.setAttribute('opacity', '.55'); svg.appendChild(pl);
    });
  }

  function at(e) {
    var r = bd.getBoundingClientRect(), cw = (r.width - 12) / b.W, x = Math.floor((e.clientX - r.left - 6) / cw), y = Math.floor((e.clientY - r.top - 6) / cw);
    return x < 0 || y < 0 || x >= b.W || y >= b.H ? -1 : y * b.W + x;
  }
  function say(t) { msg.textContent = t; }
  function step(i) {
    if (over || i < 0) return;
    if (s.path.length && HF.prevCell(s) === i) { HF.pop(s); paint(); return; }
    if (i === HF.head(s)) return;
    var w = HF.why(s, i);
    if (w === '') {
      if (!t0) { t0 = Date.now(); timer = setInterval(tick, 250); }
      HF.push(s, i); paint(); say(HF.done(s) ? '' : 'そのまま なぞってね');
      if (HF.done(s)) clear();
    } else if (w !== 'far') say(WHY[w] || '');
  }
  var down = false;
  bd.addEventListener('pointerdown', function (e) {
    if (over) return;
    down = true; try { bd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    var i = at(e);
    if (s.path.length && s.path.indexOf(i) >= 0 && i !== HF.head(s)) { while (HF.head(s) !== i && s.path.length) HF.pop(s); paint(); return; }
    step(i);
  });
  bd.addEventListener('pointermove', function (e) { if (down) step(at(e)); });
  bd.addEventListener('pointerup', function () { down = false; });
  bd.addEventListener('pointercancel', function () { down = false; });
  rs.addEventListener('click', function () { if (over) return; s = HF.state(b); paint(); say('いもむしの頭（🐛）から なぞってスタート'); });

  function clear() {
    over = true; clearInterval(timer); tick();
    var prev = lget('web.hitofude.today'), fresh = !(prev && prev.day === DAY);
    if (DEMO) fresh = true;
    else if (fresh) lset('web.hitofude.today', { day: DAY, sec: Math.round(sec * 10) / 10, from: 'home' });
    var st = lget('web.stamps') || {}, a = Array.isArray(st.hitofude) ? st.hitofude : [];
    if (!DEMO && a.indexOf(DAY) < 0) { a.push(DAY); a.sort(); st.hitofude = a.slice(-40); lset('web.stamps', st); }
    var n = 1, lim = [45, 90, 150, 240]; for (var q = 0; q < lim.length; q++) if (sec <= lim[q]) { n = lim.length + 1 - q; break; }
    var row = ''; for (q = 0; q < 5; q++) row += q < n ? '🍃' : '🤍'; row = '🐛' + row + '🦋';
    var p = DAY.split('-'), text = '今日のいもむし ' + (+p[1]) + '/' + (+p[2]) + ' ' + row + ' ' + fmt(sec) + ' #今日のいもむし https://imaimaha.com/play/hitofude/';
    win.textContent = '';
    win.appendChild(el('p', 'hpm-wh', '🦋 ちょうちょになった！'));
    win.appendChild(el('p', 'hpm-wt', fmt(sec)));
    if (!fresh) win.appendChild(el('p', 'hpm-wn', '今日の記録（1回目）: ' + fmt(prev.sec || 0)));
    win.appendChild(el('p', 'hpm-row', row));
    var sh = el('button', 'go sm', '📣 結果をシェア'); sh.type = 'button';
    var sm = el('p', 'hpm-wn'); sm.setAttribute('aria-live', 'polite');
    sh.addEventListener('click', function () {
      function copy() {
        try { navigator.clipboard.writeText(text).then(function () { sm.textContent = 'コピーしました！'; }, function () { sm.textContent = text; }); }
        catch (e) { sm.textContent = text; }
      }
      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) navigator.share({ text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') copy(); });
      else copy();
    });
    var btns = el('div', 'hpm-wb'); btns.appendChild(sh);
    var more = el('a', 'ghost', 'ほかの今日の1問 →'); more.href = '/play/'; btns.appendChild(more);
    win.appendChild(btns); win.appendChild(sm);
    var app = el('a', 'more-link', '📱 アプリなら 200ステージとランキング（App Store・無料）'); app.href = 'https://apps.apple.com/jp/app/id6823269398'; app.rel = 'noopener';
    win.appendChild(app);
    win.hidden = false; root.classList.add('done');
  }

  paint();
  addEventListener('resize', paint);
  if (DEMO) { t0 = Date.now() - 41000; for (var k = 0; k < P.sol.length && !over; k++) { if (s.path.length > k) continue; step(P.sol[k]); } }
})();

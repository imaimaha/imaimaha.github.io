/* ブラウザで遊べる「今日の問題」共通の部品（/play/）
 *   ・サーバーとは通信しない（ランキングなし）。記録はこの端末の localStorage（web.<ゲーム>. で始まる名前）だけ
 *   ・時計 / 今日クリアしたか / クリアの画面（結果のシェア・次の問題までのカウントダウン・アプリへのリンク）
 */
(function (root) {
  'use strict';
  var WP = {};
  var $ = function (id) { return document.getElementById(id); };
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var cfg = null;

  function lget(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } }
  WP.lget = lget; WP.lset = lset;

  // 日本時間の日付 '2026-11-19' → '11/19（木）'
  WP.dayLabel = function (day, noWd) {
    var p = day.split('-'), wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    return (+p[1]) + '/' + (+p[2]) + (noWd ? '' : '（' + WD[wd] + '）');
  };
  WP.fmt = function (sec) { sec = Math.max(0, Math.floor(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; };

  // cfg: { ns, day, name(今日のいもむし), emoji, url, appId, appLabel, landing, landingName, how }
  WP.init = function (o) {
    cfg = o;
    if ($('wp-date')) $('wp-date').textContent = WP.dayLabel(o.day);
    var mb = $('wp-mute');
    if (mb) {
      var paint = function () { mb.textContent = WP.muted() ? '🔇' : '🔊'; mb.setAttribute('aria-label', WP.muted() ? '音をつける' : '音を消す'); };
      paint();
      mb.addEventListener('click', function () { var s = lget('web.' + cfg.ns + '.set') || {}; s.mute = !s.mute; lset('web.' + cfg.ns + '.set', s); paint(); });
    }
    // 日付がかわったら（ページを開いたまま夜中をこえた）、あそんでいないときに読みなおす
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { T.hide(); return; }
      T.show();
      if (o.today && o.today() !== cfg.day && !T.running()) location.reload();
    });
    // 長押しのメニュー・文字えらび・2本指の拡大を出さない（遊ぶ画面だけ）
    document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.wp-app')) e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  };
  WP.muted = function () { var s = cfg && lget('web.' + cfg.ns + '.set'); return !!(s && s.mute); };

  // ---- 時計（さいしょにさわったときから。ページをかくしているあいだ・ほかの問題を見ているあいだは止める）----
  //   WP.makeTimer() で いくつでも作れる（すうじのへやは 2問）。画面に出すのは WP.timer（いま見ている時計）だけ
  var timers = [];
  WP.makeTimer = function () {
    var acc = 0, t0 = 0, started = false, stopped = false, holds = {};
    function now() { return Date.now(); }
    function on() { return started && !stopped && !Object.keys(holds).length; }
    function sec() { return (acc + (on() ? now() - t0 : 0)) / 1000; }
    var t = {
      start: function () { if (started) return; started = true; t0 = now(); WP.paintTime(); },
      stop: function () { if (on()) acc += now() - t0; stopped = true; WP.paintTime(); return acc / 1000; },
      reset: function () { acc = 0; started = false; stopped = false; holds = {}; WP.paintTime(); },
      hold: function (k) { if (on()) acc += now() - t0; holds[k] = 1; },
      release: function (k) { var was = on(); delete holds[k]; if (!was && on()) t0 = now(); },
      running: function () { return started && !stopped; },
      sec: sec
    };
    timers.push(t);
    return t;
  };
  WP.timer = WP.makeTimer();
  WP.paintTime = function () { var e = $('wp-time'); if (e) e.textContent = WP.fmt(WP.timer.sec()); };
  setInterval(WP.paintTime, 250);
  var T = { hide: function () { timers.forEach(function (t) { t.hold('vis'); }); }, show: function () { timers.forEach(function (t) { t.release('vis'); }); },
    running: function () { return timers.some(function (t) { return t.running(); }); } };

  // ---- 今日の記録（この端末だけ）----
  WP.record = function (sub) { var r = lget('web.' + cfg.ns + '.today' + (sub || '')); return r && r.day === cfg.day ? r : null; };
  WP.saveRecord = function (sec, extra, sub) {
    if (WP.record(sub)) return;   // 1回目のクリアだけ記録する
    var r = { day: cfg.day, sec: Math.round(sec * 10) / 10 };
    if (extra) for (var k in extra) r[k] = extra[k];
    lset('web.' + cfg.ns + '.today' + (sub || ''), r);
    WP.stamp(cfg.ns, cfg.day);
  };
  // 今週のチャレンジ（/play/ の weekly.js）用: 遊んだ日をゲームごとに残す（この端末だけ・さいきんの 40 日）
  WP.stamp = function (ns, day) {
    if (!ns || !day) return;
    var st = lget('web.stamps') || {}, a = Array.isArray(st[ns]) ? st[ns] : [];
    if (a.indexOf(day) < 0) a.push(day);
    a.sort(); st[ns] = a.slice(-40); lset('web.stamps', st);
  };

  // 次の問題（日本時間の 0 時）まで
  function untilNext() {
    var jst = Date.now() + 9 * 3600000, left = 86400000 - (jst % 86400000);
    var s = Math.floor(left / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  // 結果をシェア（答えはのせない。絵文字とタイム）
  function shareText(o) {
    return (o.name || cfg.name) + ' ' + WP.dayLabel(cfg.day, true) + ' ' + o.row + ' ' + WP.fmt(o.sec) + ' #' + (o.tag || cfg.tag || cfg.name) + ' ' + cfg.url;
  }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.className = 'wp-copybuf'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); done(ok);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  WP.share = function (text, msgEl) {
    function say(t) { if (msgEl) msgEl.textContent = t; }
    if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).then(function () { say(''); }, function (e) { if (!e || e.name !== 'AbortError') copyText(text, function (ok) { say(ok ? 'コピーしました！' : text); }); });
      return;
    }
    copyText(text, function (ok) { say(ok ? 'コピーしました！' : text); });
  };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // クリアの画面。o: { sec, fresh, head, emoji, row(シェアの絵文字), again(もう一回), name, tag, extra[要素] }
  var nextTimer = 0;
  WP.showClear = function (o) {
    var ov = $('wp-ov'); ov.innerHTML = '';
    var box = el('div', 'box');
    box.appendChild(el('p', 'tip', (o.name || cfg.name) + ' ' + WP.dayLabel(cfg.day)));
    box.appendChild(el('h2', null, o.fresh ? (o.head || 'クリア！') : '今日はクリアずみ'));
    box.appendChild(el('div', 'big', o.emoji || cfg.emoji));
    box.appendChild(el('div', 'time', WP.fmt(o.sec)));
    if (o.row) box.appendChild(el('div', 'row', o.row));
    if (o.note) box.appendChild(el('p', 'tip', o.note));
    (o.extra || []).forEach(function (x) { box.appendChild(x); });
    var msg = el('p', 'copied', '');
    var sh = el('button', 'btn main', '結果をシェア'); sh.type = 'button'; sh.id = 'wp-share';
    sh.addEventListener('click', function () { WP.share(shareText(o), msg); });
    box.appendChild(sh); box.appendChild(msg);
    var st = el('a', 'store'); st.href = 'https://apps.apple.com/jp/app/id' + cfg.appId; st.rel = 'noopener'; st.id = 'wp-store';
    st.appendChild(document.createTextNode(cfg.appLabel)); st.appendChild(el('small', null, 'App Store で見る（無料・iPhone）'));
    box.appendChild(st);
    var nx = el('p', 'next', ''); box.appendChild(nx);
    function tick() { if (!nx.isConnected) { clearInterval(nextTimer); return; } nx.textContent = '次の問題まで ' + untilNext(); }
    (o.buttons || []).forEach(function (bt) { var x = el('button', 'btn' + (bt.main ? ' main' : ''), bt.label); x.type = 'button'; x.addEventListener('click', function () { WP.closeClear(); bt.run(); }); box.appendChild(x); });
    if (o.again) { var ag = el('button', 'btn', 'もう一回あそぶ（記録はそのまま）'); ag.type = 'button'; ag.addEventListener('click', function () { WP.closeClear(); o.again(); }); box.appendChild(ag); }
    var ld = el('a', 'land', cfg.landingName + ' の紹介ページへ ›'); ld.href = cfg.landing; box.appendChild(ld);
    ov.appendChild(box); ov.hidden = false;
    clearInterval(nextTimer); tick(); nextTimer = setInterval(tick, 1000);
  };
  WP.closeClear = function () { clearInterval(nextTimer); $('wp-ov').hidden = true; $('wp-ov').innerHTML = ''; };
  WP.clearOpen = function () { return !$('wp-ov').hidden; };

  // タイムでシェアの絵文字の数をきめる（はやいほど多い。5こ）
  WP.tierRow = function (sec, limits, good, rest, head, tail) {
    var n = 1; for (var i = 0; i < limits.length; i++) if (sec <= limits[i]) { n = limits.length + 1 - i; break; }
    var s = head || ''; for (var k = 0; k < limits.length + 1; k++) s += k < n ? good : rest; return s + (tail || '');
  };

  root.WebPlay = WP;
})(window);

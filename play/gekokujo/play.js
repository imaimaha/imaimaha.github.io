/* 下剋上デュエル — ブラウザ版「CPU と1試合」（/play/gekokujo/）
 * ルールと CPU の考え方はアプリと同じ core.js（DuelCore。アプリのファイルをそのまま）。
 * 対戦画面（並べ方・めくり方・下剋上の演出・試合のあとの発表）はアプリの game.js の CPU 戦から写したもの。
 * オンライン・2人で1台・段位戦・ランキングはない。サーバーとは通信しない。記録も残さない（音の設定だけ、この端末に保存: web.gekokujo.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay, C = DuelCore;
  var $ = function (id) { return document.getElementById(id); };
  WP.init({ ns: 'gekokujo', day: '', name: '下剋上デュエル', emoji: '⚔️', url: 'https://imaimaha.github.io/play/gekokujo/',
    appId: '6821823101', appLabel: '下剋上デュエル', landing: '../../gekokujo/', landingName: '下剋上デュエル' });

  var CFG = { CPU_THINK: [550, 1100], FLIP_SHOW: 1700, FX_SHOW: 2200 };   // アプリの game.js の CFG と同じ
  var LEVEL_NAMES = ['かんたん', 'ふつう', 'つよい'];
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var toastTimer = 0;
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.className = 'toast on'; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = 'toast'; }, ms || 2200); }

  // ---- 音（アプリと同じ）----
  var Snd = (function () {
    var ctx = null;
    function init() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; } try { ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) {} }
    function tone(f, d, type, vol, at) {
      if (!ctx || WP.muted()) return;
      var t = ctx.currentTime + (at || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + d + 0.05);
    }
    function noise(d, vol, at) {
      if (!ctx || WP.muted()) return;
      var n = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
      for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + (at || 0);
      src.buffer = b; g.gain.value = vol || 0.2; src.connect(g); g.connect(ctx.destination); src.start(t);
    }
    return {
      init: init,
      tap: function () { tone(880, 0.06, 'square', 0.05); },
      place: function () { tone(220, 0.12, 'triangle', 0.18); tone(330, 0.1, 'triangle', 0.1, 0.05); },
      flip: function () { tone(520, 0.08, 'sawtooth', 0.06); tone(780, 0.1, 'triangle', 0.08, 0.06); },
      win: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.14, i * 0.09); }); },
      lose: function () { tone(330, 0.2, 'sawtooth', 0.08); tone(247, 0.3, 'sawtooth', 0.08, 0.15); },
      skill: function () { tone(1046, 0.12, 'sine', 0.12); tone(1568, 0.16, 'sine', 0.08, 0.08); },
      gekokujo: function () {
        tone(70, 0.5, 'sine', 0.5); noise(0.35, 0.25);
        [392, 523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.22, 'square', 0.07, 0.25 + i * 0.07); });
        tone(1568, 0.6, 'triangle', 0.1, 0.72);
      },
      gekokujoBad: function () { tone(70, 0.5, 'sine', 0.5); noise(0.35, 0.2); [523, 466, 392, 311].forEach(function (f, i) { tone(f, 0.25, 'sawtooth', 0.06, 0.25 + i * 0.12); }); },
      rankup: function () { [523, 659, 784, 1046, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.13, i * 0.1); }); }
    };
  })();

  // ---- 状態（アプリの A から、CPU 戦に使うところだけ）----
  var A = { level: 0, s: null, viewer: 0, names: ['あなた', 'CPU'], sel: null, dbl: false, grd: false, flip: null, busy: false, lastScore: [], seq: 0 };
  function opp() { return 1 - A.viewer; }

  // ===================== 描画（アプリの render / message から） =====================
  function cardEl(v, cls) {
    var d = document.createElement('div');
    d.className = 'card' + (cls ? ' ' + cls : '') + (v === 1 ? ' one' : v === 9 ? ' nine' : '');
    d.textContent = v;
    return d;
  }
  function skillsHtml(sk) {
    return '<span class="' + (sk.peek ? '' : 'gone') + '">👁</span><span class="' + (sk.double ? '' : 'gone') + '">✖️2</span><span class="' + (sk.guard ? '' : 'gone') + '">🛡</span>';
  }
  function hiddenSkillsHtml() { return '<span class="secret">❓ひみつ</span>'; }
  function winsOf(s, p) { return s.history.filter(function (h) { return h.winner === p; }).length; }
  function setSlot(el, labelEl, play, reveal, isLeader, extra) {
    el.innerHTML = '';
    var label = isLeader ? '先手' : '後手';
    if (!play) { el.className = 'card empty'; labelEl.textContent = label; return; }
    if (reveal !== null && reveal !== undefined) { el.className = 'card' + (reveal === 1 ? ' one' : reveal === 9 ? ' nine' : '') + (extra ? ' ' + extra : ''); el.textContent = reveal; }
    else el.className = 'card back' + (extra ? ' ' + extra : '');
    if (play.showFlags && (play.double || play.guard)) { var f = document.createElement('div'); f.className = 'flag'; f.textContent = play.double ? '✖️2' : '🛡'; el.appendChild(f); }
    labelEl.textContent = label;
  }
  function bumpScore(el, v, prev) { el.textContent = v; if (v !== prev) { el.className = 'score'; void el.offsetWidth; el.className = 'score bump'; } }

  function render() {
    var s = A.s; if (!s) return;
    var me = A.viewer, op = opp();
    $('g-round').textContent = 'ラウンド ' + Math.min(s.round, C.ROUNDS) + ' / ' + C.ROUNDS;
    $('g-mode').textContent = 'CPU（' + LEVEL_NAMES[A.level] + '）';
    $('m-name').textContent = A.names[me]; $('o-name').textContent = A.names[op];
    var wins = [winsOf(s, 0), winsOf(s, 1)];
    bumpScore($('m-score'), '○' + wins[me], A.lastScore[me]); bumpScore($('o-score'), '○' + wins[op], A.lastScore[op]);
    A.lastScore = []; A.lastScore[me] = '○' + wins[me]; A.lastScore[op] = '○' + wins[op];
    $('m-skills').innerHTML = skillsHtml(s.skills[me]);
    $('o-skills').innerHTML = hiddenSkillsHtml();
    $('o-tracker').textContent = '残り ' + s.hands[op].length + ' 枚';

    if (A.flip) {
      var f = A.flip;
      var oCls = 'pop ' + (f.winner === op ? 'win' : f.winner === me ? 'lose' : '');
      var mCls = 'pop ' + (f.winner === me ? 'win' : f.winner === op ? 'lose' : '');
      setSlot($('s-opp'), $('l-opp'), { double: false, guard: false }, null, f.leader === op, oCls);
      $('l-opp').textContent = f.winner === op ? '勝ち' : f.winner === me ? '負け' : '引き分け';
      setSlot($('s-me'), $('l-me'), { double: f.double[me], guard: f.guard[me], showFlags: true }, f.cards[me], f.leader === me, mCls);
      $('l-me').textContent = f.winner === me ? '勝ち！' : f.winner === op ? '負け' : '引き分け';
    } else {
      var oppReveal = (s.peeked && me === C.follower(s)) ? s.peeked : null;
      setSlot($('s-opp'), $('l-opp'), s.play[op] && { double: false, guard: false }, oppReveal, s.leader === op);
      setSlot($('s-me'), $('l-me'), s.play[me] && { double: s.play[me].double, guard: s.play[me].guard, showFlags: true }, s.play[me] ? s.play[me].value : null, s.leader === me);
    }

    var hand = $('m-hand'); hand.innerHTML = '';
    var myTurn = !A.busy && !A.flip && C.toPlay(s) === me;
    C.CARDS.forEach(function (v) {
      var has = s.hands[me].indexOf(v) >= 0;
      var c = cardEl(v, (has ? '' : 'used') + (A.sel === v ? ' sel' : ''));
      if (has) {
        c.setAttribute('role', 'button'); c.setAttribute('aria-label', v + ' のカード'); c.dataset.v = v;
        c.addEventListener('pointerdown', function (e) { e.preventDefault(); if (!myTurn) return; Snd.init(); Snd.tap(); A.sel = A.sel === v ? null : v; render(); });
      }
      hand.appendChild(c);
    });

    var sk = s.skills[me];
    $('b-peek').disabled = !(myTurn && C.canPeek(s, me));
    $('b-double').disabled = !(myTurn && sk.double);
    $('b-guard').disabled = !(myTurn && sk.guard);
    $('b-double').className = 'skill' + (A.dbl ? ' on' : '');
    $('b-guard').className = 'skill' + (A.grd ? ' on' : '');
    $('b-go').disabled = !(myTurn && A.sel !== null);

    var hi = $('g-history'); hi.innerHTML = '';
    for (var i = 0; i < C.ROUNDS; i++) {
      var h = s.history[i], d = document.createElement('div');
      if (h) { d.className = h.winner === me ? 'w0' : h.winner === op ? 'w1' : ''; d.appendChild(document.createTextNode(h.cards[me])); d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(h.winner === me ? '○' : h.winner === op ? '×' : '△')); }
      else { d.appendChild(document.createTextNode('·')); d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode('·')); }
      hi.appendChild(d);
    }
    $('g-msg').className = 'msg' + (A.flip ? ' big' : '');
    $('g-msg').textContent = message();
  }

  function message() {
    var s = A.s, me = A.viewer, op = opp();
    if (A.flip) {
      var r = A.flip, txt;
      if (r.winner === -1) txt = r.guarded && r.guard[me] ? '🛡 ガードで引き分け' : '引き分け';
      else txt = (r.winner === me ? A.names[me] : A.names[op]) + ' の勝ち' + (r.double[me] && r.winner === me ? '（✖️2）' : '');
      if (r.gekokujo && r.winner === me) txt = '下剋上！ 1 で 9 をたおした！';
      else if (r.gekokujo) txt = '下剋上された…！';
      return txt;
    }
    if (s.over) return '';
    var p = C.toPlay(s);
    if (p === me) {
      if (s.leader === me) return 'あなたが先手。1枚えらんで伏せよう';
      var extra = s.round < C.PEEK_FROM_ROUND ? '（👁透視は2ラウンド目から）' : '';
      if (s.peeked) return '相手のカードは「' + s.peeked + '」。後手のあなたの番' + extra;
      return '相手が伏せた。後手のあなたの番' + extra;
    }
    return A.names[op] + ' が考えています…';
  }

  // ===================== 下剋上の演出（アプリと同じ） =====================
  var fxTimer = 0;
  function playFx(good, text, sub) {
    var fx = $('fx'), ft = $('fx-text');
    ft.textContent = text;
    if (sub) { var sm = document.createElement('small'); sm.textContent = sub; ft.appendChild(sm); }
    fx.querySelectorAll('i').forEach(function (n) { n.remove(); });
    if (good) {
      var colors = ['#ffd36b', '#ff5d73', '#5db8ff', '#5fe39a', '#fff3c4', '#c58bff'];
      for (var i = 0; i < 34; i++) {
        var c = document.createElement('i');
        c.style.left = (Math.random() * 100) + 'vw';
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
        c.style.animationDelay = (Math.random() * 0.4) + 's';
        fx.appendChild(c);
      }
    }
    fx.className = ''; void fx.offsetWidth; fx.className = 'on' + (good ? '' : ' bad');
    var app = $('gk-app'); app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
    clearTimeout(fxTimer);
    fxTimer = setTimeout(function () { fx.className = ''; app.classList.remove('shake'); }, CFG.FX_SHOW);
  }

  // ===================== 進行（アプリの startLocal / step / myPlace / showFlip の CPU 戦） =====================
  function start() {
    Snd.init();
    WP.closeClear();
    A.seq++;
    A.s = C.newMatch(Math.random() < 0.5 ? 0 : 1);
    A.names = ['あなた', 'CPU'];
    A.viewer = 0; A.sel = null; A.dbl = A.grd = false; A.flip = null; A.busy = false; A.lastScore = [0, 0];
    $('gk-start').hidden = true;
    toast((A.s.leader === 0 ? A.names[0] : A.names[1]) + ' が先手');
    step();
  }
  function step() {
    var s = A.s; if (!s) return;
    if (s.over) { finish(); return; }
    var p = C.toPlay(s);
    if (p === -1) { var rec = C.resolve(s); if (rec) showFlip(rec); return; }
    if (p === 1) {
      A.busy = true; render();
      var seq = A.seq;
      setTimeout(function () {
        if (A.s !== s || A.seq !== seq) return;
        var lv = A.level;
        var d = C.cpuDecide(s, 1, lv);
        // 透視・倍がけ・ガードを使っても、こちらの画面には何も出さない（試合が終わったら発表）
        if (d.peek) { C.usePeek(s, 1); C.setPeeked(s, s.play[s.leader].value); d = C.cpuDecide(s, 1, lv); if (d.peek) d = { value: s.hands[1][0] }; }
        C.place(s, 1, d.value, d);
        Snd.place(); A.busy = false; step();
      }, root.__wpFast ? 0 : CFG.CPU_THINK[0] + Math.random() * (CFG.CPU_THINK[1] - CFG.CPU_THINK[0]));
      return;
    }
    render();
  }
  function myPlace() {
    var s = A.s, me = A.viewer; if (!s || A.sel === null || A.busy || A.flip || C.toPlay(s) !== me) return;
    var err = C.place(s, me, A.sel, { double: A.dbl, guard: A.grd });
    if (err) { toast(err); return; }
    Snd.place();
    A.sel = null; A.dbl = A.grd = false;
    step();
  }
  function showFlip(rec) {
    A.flip = rec; A.busy = true; Snd.flip();
    var me = A.viewer, wait = root.__wpFast ? 30 : CFG.FLIP_SHOW, seq = A.seq;
    setTimeout(function () {
      if (rec.gekokujo) {
        if (rec.winner === me) { Snd.gekokujo(); playFx(true, '下剋上！', '1 が 9 をたおした'); }
        else { Snd.gekokujoBad(); playFx(false, '下剋上された…', '1 で 9 をたおされた'); }
      } else if (rec.winner === me) Snd.win();
      else if (rec.winner >= 0) Snd.lose();
    }, root.__wpFast ? 0 : 250);
    if (rec.gekokujo && !root.__wpFast) wait += 900;
    render();
    setTimeout(function () {
      if (A.seq !== seq) return;
      A.flip = null; A.busy = false;
      if (!A.s) return;
      step();
    }, wait);
  }

  // ===================== 試合のおわり（アプリの finish / renderReview から。記録・段位・広告はない） =====================
  function reviewTable() {
    var s = A.s, me = A.viewer, op = 1 - me, nameMe = 'あなた', nameOp = A.names[1];
    function skills(h, p) {
      var a = [];
      if (h.leader === p) a.push('先');
      if (h.peek && h.peek[p]) a.push('👁');
      if (h.double[p]) a.push('✖️2');
      if (h.guard[p]) a.push('🛡');
      return a.join(' ');
    }
    var html = '<tr><th>R</th><th>' + esc(nameMe) + '</th><th>' + esc(nameOp) + '</th><th>結果</th></tr>';
    s.history.forEach(function (h) {
      var res = h.winner === -1 ? (h.guarded ? 'ガードで引き分け' : '引き分け') : (h.winner === me ? nameMe : nameOp) + ' +' + h.points;
      if (h.gekokujo) res = '下剋上！ ' + res;
      html += '<tr' + (h.gekokujo ? ' class="gk"' : '') + '><td>' + h.round + '</td>' +
        '<td class="n' + (h.winner === me ? ' win' : '') + '">' + h.cards[me] + '<span class="sk">' + skills(h, me) + '</span></td>' +
        '<td class="n' + (h.winner === op ? ' win' : '') + '">' + h.cards[op] + '<span class="sk">' + skills(h, op) + '</span></td>' +
        '<td class="res">' + esc(res) + '</td></tr>';
    });
    var notes = [];
    s.history.forEach(function (h) {
      [me, op].forEach(function (p) {
        var who = p === me ? nameMe : nameOp, used = [];
        if (h.peek && h.peek[p]) used.push('👁透視');
        if (h.double[p]) used.push('✖️2倍がけ');
        if (h.guard[p]) used.push('🛡ガード');
        if (used.length) notes.push(h.round + 'R: ' + who + ' が ' + used.join('・') + (h.guard[p] && h.guarded ? '（負けを引き分けに）' : h.double[p] && h.winner >= 0 ? '（' + (h.winner === p ? '2点ゲット' : '相手に2点') + '）' : ''));
      });
    });
    var notesHtml = '<tr><td colspan="4" class="reveal"><b>特殊カードの発表</b><br>' + (notes.length ? notes.map(esc).join('<br>') : 'どちらも使わなかった') + '</td></tr>';
    var t = document.createElement('table'); t.className = 'rtable';
    t.innerHTML = html + notesHtml + '<tr><td colspan="4" class="legend">先＝先手　👁＝透視　✖️2＝倍がけ　🛡＝ガード（試合中は相手にひみつ）</td></tr>';
    var wrap = document.createElement('div'); wrap.className = 'rtable-wrap'; wrap.appendChild(t);
    return wrap;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function finish() {
    var s = A.s, me = A.viewer, res = C.result(s);
    var title = res === -1 ? '引き分け' : res === me ? '勝ち！' : '負け…';
    if (res === me) Snd.rankup();
    var gk = s.history.filter(function (h) { return h.gekokujo && h.winner === me; }).length;
    var gkAll = s.history.filter(function (h) { return h.gekokujo; }).length;
    var ov = $('wp-ov'); ov.innerHTML = '';
    var box = el('div', 'box');
    box.appendChild(el('p', 'tip', 'CPU（' + LEVEL_NAMES[A.level] + '）と1試合'));
    box.appendChild(el('h2', null, title));
    box.appendChild(el('div', 'score2', s.score[me] + ' - ' + s.score[1 - me]));
    if (gkAll) box.appendChild(el('p', 'tip', '下剋上 ' + gkAll + '回'));
    box.appendChild(reviewTable());
    // シェア（数字の並びは出さない。勝敗と点数だけ）
    var row = s.history.map(function (h) { return h.winner === me ? (h.gekokujo ? '💥' : '🟢') : h.winner === -1 ? '⚪' : '🔴'; }).join('');
    var text = '下剋上デュエルで CPU（' + LEVEL_NAMES[A.level] + '）に' + (res === me ? '勝った！ ' : res === -1 ? '引き分け ' : '負けた… ') + s.score[me] + '-' + s.score[1 - me] +
      (gk ? '（下剋上 ' + gk + '回）' : '') + ' ' + row + ' #下剋上デュエル https://imaimaha.github.io/play/gekokujo/';
    var msg = el('p', 'copied', '');
    var ag = el('button', 'btn main', 'もう一回'); ag.type = 'button'; ag.id = 'gk-again';
    ag.addEventListener('click', function () { WP.closeClear(); start(); });
    box.appendChild(ag);
    var lv = el('button', 'btn', '強さをかえる'); lv.type = 'button';
    lv.addEventListener('click', function () { WP.closeClear(); A.s = null; $('gk-start').hidden = false; });
    box.appendChild(lv);
    var sh = el('button', 'btn', '📣 結果をシェア'); sh.type = 'button'; sh.id = 'wp-share';
    sh.addEventListener('click', function () { WP.share(text, msg); });
    box.appendChild(sh); box.appendChild(msg);
    var st = el('a', 'store'); st.href = 'https://apps.apple.com/jp/app/id6821823101'; st.rel = 'noopener'; st.id = 'wp-store';
    st.appendChild(document.createTextNode('アプリなら 段位戦とオンライン対戦')); st.appendChild(el('small', null, 'App Store で見る（無料・iPhone）'));
    box.appendChild(st);
    var ld = el('a', 'land', '下剋上デュエル の紹介ページへ ›'); ld.href = '../../gekokujo/'; box.appendChild(ld);
    ov.appendChild(box); ov.hidden = false;
  }

  // ===================== 入力 =====================
  function on(id, fn) { $(id).addEventListener('click', fn); }
  on('b-go', myPlace);
  on('b-double', function () { if (!A.s || !A.s.skills[A.viewer].double) return; A.dbl = !A.dbl; if (A.dbl) A.grd = false; Snd.tap(); render(); });
  on('b-guard', function () { if (!A.s || !A.s.skills[A.viewer].guard) return; A.grd = !A.grd; if (A.grd) A.dbl = false; Snd.tap(); render(); });
  on('b-peek', function () {
    var s = A.s, me = A.viewer; if (!s) return;
    var err = C.usePeek(s, me); if (err) { toast(err); return; }
    C.setPeeked(s, s.play[s.leader].value); Snd.skill(); render();
  });
  on('b-rules', function () { $('gk-rules').hidden = false; });
  on('b-rules-close', function () { $('gk-rules').hidden = true; });
  var lvBtns = $('gk-level').getElementsByTagName('button');
  function paintLevel() { for (var i = 0; i < lvBtns.length; i++) { var on2 = +lvBtns[i].getAttribute('data-v') === A.level; lvBtns[i].className = on2 ? 'on' : ''; lvBtns[i].setAttribute('aria-pressed', on2 ? 'true' : 'false'); } }
  $('gk-level').addEventListener('click', function (e) { var v = e.target.closest('button'); if (!v) return; A.level = +v.getAttribute('data-v'); Snd.init(); Snd.tap(); paintLevel(); });
  paintLevel();
  on('b-start', start);
  document.addEventListener('keydown', function (e) {
    if (!A.s || WP.clearOpen()) return;
    if (e.key >= '1' && e.key <= '9') { var v = +e.key; if (A.s.hands[A.viewer].indexOf(v) >= 0 && !A.busy && !A.flip && C.toPlay(A.s) === A.viewer) { A.sel = v; render(); } }
    else if (e.key === 'Enter') myPlace();
  });

  // 自動テスト用（相手の札は見せない。自分の番かどうかと、試合が終わったかだけ）
  root.__webPlay = {
    myTurn: function () { return !!(A.s && !A.busy && !A.flip && C.toPlay(A.s) === A.viewer); },
    hand: function () { return A.s ? A.s.hands[A.viewer].slice() : []; },
    over: function () { return !!(A.s && A.s.over); }, score: function () { return A.s ? A.s.score.slice() : null; }
  };
})(window);

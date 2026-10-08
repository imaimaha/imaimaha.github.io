/* 変則将棋 — 画面・音・対局の進行・詰将棋（ルールは engine.js / variants.js / hasami.js、問題は puzzles.js） */
(function () {
  'use strict';
  var HS = window.HS, R = HS.rules, DEF = HS.DEF;
  var LEVELS = ['よわい', 'ふつう', 'つよい'];
  function $(id) { return document.getElementById(id); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  // ブラウザ版（友だちを招待するための入口）: オンライン対戦だけを出す
  var WEB = !!window.HS_WEB || /[?&]web=1/.test(location.search);
  if (isTouch) document.body.classList.add('touch');

  // ===================== 振動・音 =====================
  function haptic(k) { try { var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic; if (h) h.postMessage(k); } catch (e) {} }
  var Snd = (function () {
    var ctx = null, muted = load('hensoku.muted', false), noise = null;
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    function tone(f, dur, type, vol, at) {
      if (!ctx || muted) return;
      var t = ctx.currentTime + (at || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    // 駒を盤に打ちつける「パチッ」
    function clack(pitch, vol) {
      if (!ctx || muted) return;
      var t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; f.type = 'bandpass'; f.frequency.value = pitch || 1900; f.Q.value = 7;
      g.gain.setValueAtTime(vol || 1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + 0.1);
      tone((pitch || 1900) / 5.5, 0.06, 'sine', 0.2);
    }
    return {
      init: init, isMuted: function () { return muted; }, setMuted: function (m) { muted = m; save('hensoku.muted', m); },
      play: function (k) {
        switch (k) {
          case 'place': clack(1900, 1); break;
          case 'cap': clack(2300, 1); tone(660, 0.1, 'triangle', 0.12, 0.05); break;
          case 'select': tone(880, 0.05, 'sine', 0.07); break;
          case 'ng': tone(170, 0.16, 'square', 0.06); break;
          case 'check': tone(520, 0.09, 'square', 0.07); tone(520, 0.09, 'square', 0.07, 0.13); break;
          case 'win': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.16, i * 0.11); }); break;
          case 'lose': [392, 330, 262].forEach(function (f, i) { tone(f, 0.3, 'sine', 0.14, i * 0.16); }); break;
          case 'draw': tone(440, 0.25, 'sine', 0.12); tone(440, 0.25, 'sine', 0.12, 0.2); break;
          case 'tick': tone(1250, 0.05, 'square', 0.05); break;
          case 'fx': [523, 784, 1047].forEach(function (f, i) { tone(f, 0.14, 'triangle', 0.12, i * 0.06); }); break;
          case 'solved': [659, 784, 988, 1319].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.15, i * 0.09); }); break;
        }
      }
    };
  })();

  var toastTimer = null;
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 1800); }
  var SCREENS = ['home', 'variants', 'tsume', 'game', 'puzzle', 'mine', 'edit', 'records', 'replay', 'online'];
  // アプリに「今メニューか、対局・詰将棋の最中か」を知らせる（アプリは menu のときだけ広告を出す）
  function notifyScreen(kind) {
    try { var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.screen; if (h) h.postMessage(kind); } catch (e) { /* ブラウザでは何もしない */ }
  }
  var curScreen = 'home';
  function show(id) { curScreen = id; SCREENS.forEach(function (k) { $(k).hidden = k !== id; }); notifyScreen(id === 'game' || id === 'puzzle' ? 'play' : 'menu'); }
  function sheet(id, on) {
    $(id).classList.toggle('on', on);
    // 対局の結果シートが出ている間はメニュー扱い、閉じて盤にもどったら対局扱い
    if (id === 'result') notifyScreen(on || (curScreen !== 'game' && curScreen !== 'puzzle') ? 'menu' : 'play');
  }

  // ===================== 盤の表示（対局・詰将棋で共通） =====================
  // opts: { w, h, hands: bool, stones: bool(はさみ), restHand: bool(詰将棋の玉方) , onSquare(i), onHand(p, t) }
  function BoardView(host, opts) {
    var wrap = document.createElement('div'); wrap.className = 'sg-wrap';
    var hands = [null, null], sqs = [], board = document.createElement('div');
    board.className = 'sg-board wood';
    var w = opts.w, h = opts.h;
    // マスの大きさ: 画面の幅と高さに収まるように
    var avW = Math.min(window.innerWidth - 32, 460), avH = window.innerHeight - (opts.hands ? 330 : 250) - (opts.extra || 0);
    // 実際に使える高さ（盤の入れ物の高さ）がわかるときは、そこから持ち駒・筋の番号のぶんを引いて決める。
    // 上下のカードや持ち駒と重ならないように（画面の高さだけで見積もると、大きい画面で盤がはみ出していた）
    if (host.clientHeight > 0) {
      var hh = host.clientHeight - (opts.hands ? 2 * 62 + 16 : 0) - (opts.files ? 20 : 0) - 16;
      if (hh > 0) avH = Math.min(avH + (opts.extra || 0), hh);
    }
    var c = Math.floor(Math.min((avW - (opts.ranks ? 18 : 0)) / w, avH / (h * 1.08), 74));
    board.style.setProperty('--c', c + 'px');
    board.style.gridTemplateColumns = 'repeat(' + w + ', ' + c + 'px)';
    for (var i = 0; i < w * h; i++) { var q = document.createElement('div'); q.className = 'sg-sq'; q.dataset.i = i; board.appendChild(q); sqs.push(q); }
    // 9×9 の星（3段ごとの点）
    if (w === 9 && h === 9) [[3, 3], [6, 3], [3, 6], [6, 6]].forEach(function (p) {
      var d = document.createElement('i'); d.className = 'sg-star';
      d.style.left = (6 + p[0] * (c - 1)) + 'px'; d.style.top = (6 + p[1] * (c * 1.08 - 1)) + 'px'; board.appendChild(d);
    });
    // 筋の番号（本将棋のよび方: 右はしが1筋）
    var files = null;
    if (opts.files) {
      files = document.createElement('div'); files.className = 'sg-files';
      files.style.gridTemplateColumns = 'repeat(' + w + ', ' + (c - 1) + 'px)';
      for (var f = 0; f < w; f++) { var fs = document.createElement('span'); fs.textContent = w - f; files.appendChild(fs); }
    }
    board.addEventListener('pointerdown', function (e) { var q = e.target.closest('.sg-sq'); if (q && opts.onSquare) opts.onSquare(+q.dataset.i); });
    // 段の番号（一〜九）を盤の右に。本将棋の棋譜と同じよび方
    var boardEl = board;
    if (opts.ranks) {
      var rowEl = document.createElement('div'); rowEl.className = 'sg-rowwrap';
      var ranks = document.createElement('div'); ranks.className = 'sg-ranks';
      ranks.style.gridTemplateRows = 'repeat(' + h + ', ' + (c * 1.08 - 1) + 'px)';
      for (var rk = 0; rk < h; rk++) { var rs = document.createElement('span'); rs.textContent = '一二三四五六七八九'[rk] || (rk + 1); ranks.appendChild(rs); }
      rowEl.appendChild(board); rowEl.appendChild(ranks); boardEl = rowEl;
      if (files) files.style.marginRight = '16px';
    }
    if (opts.hands) {
      hands[1] = document.createElement('div'); hands[1].className = 'sg-hand';
      hands[0] = document.createElement('div'); hands[0].className = 'sg-hand';
      [0, 1].forEach(function (p) { hands[p].style.width = Math.max(w * c + 12, 300) + 'px'; });
      wrap.appendChild(hands[1]); if (files) wrap.appendChild(files); wrap.appendChild(boardEl); wrap.appendChild(hands[0]);
    } else { if (files) wrap.appendChild(files); wrap.appendChild(boardEl); }
    host.innerHTML = ''; host.appendChild(wrap);

    function pieceHTML(v, isKingSide) {
      if (!v) return '';
      if (opts.stones) return '<span class="sg-pc stone ' + (v < 0 ? 'gote' : 'sente') + '">' + (v < 0 ? 'と' : '歩') + '</span>';
      var t = R.kind(v), d = DEF[t], ch = d.n;
      if (t === 8) ch = v < 0 ? '王' : '玉';
      var cls = 'sg-pc ' + (v < 0 ? 'gote' : 'sente') + (d.base ? ' prom' : '') + (t === 8 ? ' king' : '') + (t >= 15 ? ' orig' : '');
      return '<span class="' + cls + '">' + ch + '</span>';
    }
    function handRow(p, s, V, info) {
      var el = hands[p]; el.innerHTML = '';
      var lab = document.createElement('span'); lab.className = 'sg-hlab'; lab.innerHTML = (info.labels ? info.labels[p] : (p === 0 ? '☗ 先手' : '☖ 後手')) + '<br>持ち駒';
      el.appendChild(lab);
      if (info.rest && p === 1) { var r = document.createElement('span'); r.className = 'sg-rest'; r.textContent = '残りの駒ぜんぶ（合い駒に使える）'; el.appendChild(r); return; }
      var any = false;
      for (var k = V.handTypes.length - 1; k >= 0; k--) {
        var n = s.hand[p][k]; if (!n) continue; any = true;
        var t = V.handTypes[k], btn = document.createElement('span');
        btn.className = 'sg-hp' + (info.selHand === t && p === s.turn ? ' sel' : '') + (info.hintHand === t && p === 0 ? ' hint' : '');
        btn.innerHTML = '<span class="sg-pc ' + (p ? 'gote' : 'sente') + (t >= 15 ? ' orig' : '') + '">' + DEF[t].n + '</span>' + (n > 1 ? '<b>' + n + '</b>' : '');
        (function (tt) { btn.addEventListener('pointerdown', function () { if (opts.onHand) opts.onHand(p, tt); }); })(t);
        el.appendChild(btn);
      }
      if (!any) { var e = document.createElement('span'); e.className = 'sg-none'; e.textContent = 'なし'; el.appendChild(e); }
    }
    return {
      // info: { sel, dests{}, last, check, hint{}, flip, labels, rest, selHand, hintHand, gone[] }
      render: function (s, V, info) {
        wrap.classList.toggle('flip', !!info.flip);
        if (files) {
          var fsp = files.children;
          for (var fi = 0; fi < w; fi++) { var fn = info.flip ? fi + 1 : w - fi; fsp[fi].textContent = fn; fsp[fi].className = info.files && info.files[fn] ? 'on' : ''; }
        }
        var last = info.noLast ? null : s.last, dests = info.dests || {}, hint = info.hint || {}, gone = info.gone || [];
        for (var i = 0; i < w * h; i++) {
          var q = sqs[i];
          q.className = 'sg-sq' + (info.files && info.files[w - (i % w)] ? ' fileok' : '') + (dests[i] ? ' dest' : '') + (info.sel === i ? ' sel' : '') + (last && i === last.t ? ' last' : '') + (last && i === last.f ? ' from' : '') +
            (info.check === i ? ' check' : '') + (hint[i] ? ' hint' : '') + (gone.indexOf(i) >= 0 ? ' gone' : '') +
            (info.mines && info.mines[i] ? ' mine' : '') + (info.fxt && info.fxt[i] ? ' fxt' : '');
          var html = pieceHTML(s.b[i]);
          // 安南の仲間: 動きを借りている駒に、借りた駒の字を小さく出す（設定で消せる。上級者向けは表示なし）
          if (html && V && V.an && info.showBorrow !== false) { var mk = R.moveKind(V, s.b, i); if (mk !== R.kind(s.b[i])) html += '<span class="sg-borrow">' + (mk === 8 ? '玉' : DEF[mk].n) + '</span>'; }
          if (q.dataset.h !== html) { q.dataset.h = html; q.innerHTML = html; if (last && i === last.t && html) q.firstChild.classList.add('pop'); }
        }
        if (opts.hands) { handRow(0, s, V, info); handRow(1, s, V, info); }
      }
    };
  }

  // 確認を画面の中に出す（アプリの WebView では window.confirm が出ず、いつも「いいえ」になることがあるため）
  // askYes('投了しますか？', '投了する', function () { … }, { danger: true })
  function askYes(msg, okLabel, onYes, o) {
    o = o || {};
    var old = document.querySelector('.sg-ask.yesno'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'sg-ask yesno';
    box.innerHTML = '<div class="sg-askbox"><p></p>' + (o.sub ? '<small class="sub"></small>' : '') +
      '<div><button class="btn ' + (o.danger ? 'danger' : '') + '" data-a="1"></button><button class="btn ghost" data-a="0"></button></div></div>';
    box.querySelector('p').textContent = msg;
    if (o.sub) box.querySelector('.sub').textContent = o.sub;
    box.querySelector('[data-a="1"]').textContent = okLabel || 'はい';
    box.querySelector('[data-a="0"]').textContent = o.noLabel || 'やめる';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) { if (e.target === box) box.remove(); return; }
      box.remove();
      if (b.dataset.a === '1') onYes(); else if (o.onNo) o.onNo();
    });
    document.body.appendChild(box);
    return box;
  }

  // 成るかどうかを聞く
  function askPromote(t, cb) {
    var box = document.createElement('div'); box.className = 'sg-ask';
    box.innerHTML = '<div class="sg-askbox"><p>成りますか？</p><div><button class="btn" data-a="1">' + DEF[DEF[t].prom].n + ' に成る</button><button class="btn ghost" data-a="0">' + DEF[t].n + ' のまま</button></div></div>';
    box.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      box.remove(); cb(b.dataset.a === '1');
    });
    document.body.appendChild(box);
  }

  // ===================== 対局 =====================
  var stats = load('hensoku.stats', {});
  function statOf(id) { return stats[id] || (stats[id] = { w: [0, 0, 0], l: [0, 0, 0], d: [0, 0, 0], local: 0 }); }

  // ゲームごとの「ルールの窓口」をそろえる（将棋系とはさみ将棋）
  function adapterFor(id, opt) {
    if (id === 'hasami') {
      var HA = HS.hasami;
      return {
        id: id, kind: 'hasami', title: 'はさみ将棋', w: 9, h: 9, hands: false,
        init: function () { return HA.init({ all: opt.all }); }, moves: HA.moves, play: HA.play, over: HA.over,
        rep: HA.repetition, ai: HA.ai, turn: function (s) { return s.turn; }, V: null
      };
    }
    if (id === 'koka') {
      var KV = HS.VARIANTS.honshogi, X = HS.effects, fxo = { n: opt.fxN === 2 ? 2 : 1, show: opt.fxShow !== false };
      return {
        id: id, kind: 'koka', title: '特殊効果将棋', w: 9, h: 9, hands: true, V: KV, fxOpt: fxo,
        init: function () { return X.init(KV, fxo, opt.seed); },
        moves: function (s) { return X.moves(KV, s); },
        play: function (s, m) { return X.play(KV, s, m); },
        over: function (s) { return X.over(KV, s); },
        rep: function (hist) { return X.repetition(KV, hist); },
        ai: function (s, lv, ms) { return X.ai(KV, s, lv, ms); },
        turn: function (s) { return s.turn; }
      };
    }
    if (id === 'trump') {
      var TV = HS.VARIANTS.trump, TR = HS.trump, H = opt.H || 0;
      return {
        id: id, kind: 'trump', title: TV.title, w: 9, h: 9, hands: true, V: TV, H: H,
        init: function () { return TR.init(TV, H, opt.seed); },
        moves: function (s) { return TR.moves(TV, s); },
        play: function (s, m) { return TR.play(TV, s, m); },
        over: function (s) { return TR.over(TV, s); },
        rep: function () { return null; },
        ai: function (s, lv, ms) { return TR.ai(TV, s, lv, ms); },
        turn: function (s) { return s.turn; }
      };
    }
    var V = HS.VARIANTS[id];
    return {
      id: id, kind: 'shogi', title: V.title, w: V.w, h: V.h, hands: V.drops, V: V,
      init: function () { return R.init(V); },
      moves: function (s) { return R.moves(V, s); },
      play: function (s, m) { return R.play(V, s, m); },
      over: function (s) { return R.over(V, s); },
      rep: function (hist) { return R.repetition(V, hist); },
      ai: function (s, lv, ms) { return R.ai(V, s, lv, ms); },
      turn: function (s) { return s.turn; }
    };
  }

  var G = { ad: null, mode: 'cpu', level: 1, human: 0, hist: [], busy: false, done: false, timer: null, view: null, sel: null, selHand: null, setupId: null, opt: {} };
  function curS() { return G.hist[G.hist.length - 1]; }
  function sideNames() {
    var komaochi = G.ad.V && G.ad.V.group === 'komaochi';
    var base = komaochi ? ['下手', '上手'] : ['先手', '後手'];
    if (G.mode === 'local') return base;
    var n = base.slice(); n[G.human] = 'あなた（' + base[G.human] + '）'; n[1 - G.human] = G.mode === 'online' ? 'あいて' : 'CPU'; return n;
  }
  function isHumanTurn(s) { return G.mode === 'local' || G.ad.turn(s) === G.human; }
  // 自分が下に来るように盤を回すか（CPU 戦・オンラインで後手のとき）
  function flipView() { return (G.mode === 'cpu' || G.mode === 'online') && G.human === 1; }

  // ---- ルール一覧 ----
  var MENU = ['go5', 'komagoma', 'ninja', 'kaeru', 'taiho', 'an', 'trump', 'koka', 'sougyoku', 'hasami', 'fudake', 'honshogi', 'irekae', 'komaochi'];
  function menuInfo(id) {
    if (id === 'koka') return { emoji: '🎴', title: '特殊効果将棋', tag: 'オリジナル', desc: '1局に1回だけ使える「特殊効果カード」つきの本将棋' };
    if (id === 'hasami') return { emoji: '🫸', title: 'はさみ将棋', tag: '変則', desc: '歩を縦横にすべらせて、はさんで取る' };
    if (id === 'komaochi') return { emoji: '🎓', title: '駒落ち', tag: '駒落ち', desc: '香落ち〜六枚落ち。強い人が駒を減らして戦う' };
    if (id === 'an') return { emoji: '🧭', title: '安南・安北・安東・安西', tag: '変則', desc: 'となりの味方の駒の動きを借りる。9×9 と 5×5' };
    var V = HS.VARIANTS[id]; return { emoji: V.emoji, title: V.title, tag: V.tag, desc: V.desc };
  }
  function buildVariants() {
    var list = $('v-list'); list.innerHTML = '';
    $('v-title').textContent = ON.pick ? '部屋のルールをえらぶ' : 'ルールをえらぶ';
    $('v-records').hidden = ON.pick || WEB;
    MENU.forEach(function (id) {
      var m = menuInfo(id), st = statOf(id), w = st.w[0] + st.w[1] + st.w[2], l = st.l[0] + st.l[1] + st.l[2];
      var c = document.createElement('button'); c.className = 'vcard';
      c.innerHTML = '<span class="ico">' + m.emoji + '</span><span class="txt"><b>' + m.title + '</b><span class="tag t-' + m.tag + '">' + m.tag + '</span><small>' + m.desc + '</small><em>' +
        (w + l ? 'CPU戦 ' + w + '勝 ' + l + '敗' : 'まだ遊んでいない') + '</em></span>';
      c.addEventListener('click', function () { Snd.init(); Snd.play('select'); openSetup(id); });
      list.appendChild(c);
    });
  }

  // ---- 対局の前の設定 ----
  var setupSel = { level: load('hensoku.level', 1), first: load('hensoku.first', 0), hc: load('hensoku.hc', 'kaku'), all: load('hensoku.hasamiAll', false),
    anDir: load('hensoku.anDir', 'S'), anBoard: load('hensoku.anBoard', '9'), H: load('hensoku.trumpH', 0),
    fxN: load('hensoku.fxN', 1), fxShow: load('hensoku.fxShow', true), clock: load('hensoku.clock', { kind: 'none', main: 600, byo: 30, inc: 5 }) };
  // 表示の設定（おぼえておく）: borrow = 安南の仲間で「借りている動き」の札を出す / dests = 選んだ駒の動ける場所を出す
  // 対局はどちらも出す（初心者向け）、詰将棋はどちらも出さない（上級者向け）がはじめの設定
  var disp = load('hensoku.disp', null) || { game: { borrow: true, dests: true }, tsume: { borrow: false, dests: false } };
  function setDisp(ctx, k, v) { disp[ctx][k] = v; save('hensoku.disp', disp); }
  // トグル（オン/オフ）を並べる
  function dispToggles(el, ctx, an, onChange) {
    el.innerHTML = '';
    var items = [];
    if (an) items.push({ k: 'borrow', t: '借りている動きを表示する', d: '駒の右下に、いま借りている駒の字を出す' });
    items.push({ k: 'dests', t: '動ける場所を表示する', d: '駒を選ぶと、動けるマスに印を出す' + (an ? '（借りた動きもわかってしまう）' : '') });
    items.forEach(function (it) {
      var b = document.createElement('button'); b.className = 'tg' + (disp[ctx][it.k] ? ' on' : '');
      b.innerHTML = '<span><b>' + it.t + '</b><small>' + it.d + '</small></span><i></i>';
      b.onclick = function () { setDisp(ctx, it.k, !disp[ctx][it.k]); Snd.play('select'); dispToggles(el, ctx, an, onChange); if (onChange) onChange(); };
      el.appendChild(b);
    });
    var lvl = document.createElement('div'); lvl.className = 'tgnote';
    var allOff = !disp[ctx].dests && (!an || !disp[ctx].borrow);
    lvl.textContent = allOff ? '🎓 上級者向け：ヒントなしで読む' : '🔰 初心者向け：動きが見える';
    el.appendChild(lvl);
  }
  function seg(el, labels, cur, onPick) {
    el.innerHTML = '';
    labels.forEach(function (n, i) { var b = document.createElement('button'); b.textContent = n; b.className = i === cur ? 'on' : ''; b.onclick = function () { onPick(i); Snd.play('select'); }; el.appendChild(b); });
  }
  function realId(id) {
    if (id === 'komaochi') return 'ochi-' + setupSel.hc;
    if (id === 'an') return 'an-' + setupSel.anDir + '-' + setupSel.anBoard;
    return id;
  }
  function openSetup(id) {
    G.setupId = id;
    var m = menuInfo(id), rid = realId(id);
    $('su-emoji').textContent = m.emoji; $('su-title').textContent = id === 'komaochi' ? '駒落ち' : id === 'an' ? HS.VARIANTS[rid].title : m.title; $('su-desc').textContent = m.desc;
    $('su-rules').innerHTML = id === 'hasami' ? HASAMI_RULES : id === 'trump' ? trumpRules(setupSel.H) : id === 'koka' ? kokaRules() : HS.VARIANTS[rid].rules + pieceNotes(HS.VARIANTS[rid]);
    $('su-hc-wrap').hidden = id !== 'komaochi' && id !== 'an' && id !== 'trump' && id !== 'koka';
    $('su-hc-wrap').querySelector('.lab').textContent = id === 'an' ? 'どのとなりから借りる？' : id === 'trump' ? '手札の枚数' : id === 'koka' ? 'カードの枚数（1人あたり）' : '駒落ち';
    if (id === 'koka') seg($('su-hc'), ['1枚', '2枚'], setupSel.fxN === 2 ? 1 : 0, function (i) { setupSel.fxN = i + 1; save('hensoku.fxN', i + 1); openSetup(id); });
    $('su-goal-wrap').querySelector('.lab').textContent = id === 'an' ? '盤' : '勝ち方';
    if (id === 'an') {
      seg($('su-hc'), HS.AN_DIRS.map(function (d) { return d.name + '（' + d.where + '）'; }), HS.AN_DIRS.map(function (d) { return d.id; }).indexOf(setupSel.anDir), function (i) { setupSel.anDir = HS.AN_DIRS[i].id; save('hensoku.anDir', setupSel.anDir); openSetup(id); });
    }
    if (id === 'trump') {
      seg($('su-hc'), ['0枚（めくって指す）', '1枚', '2枚', '3枚'], setupSel.H, function (i) { setupSel.H = i; save('hensoku.trumpH', i); openSetup(id); });
    }
    if (id === 'komaochi') seg($('su-hc'), HS.HANDICAPS.map(function (x) { return x.label; }), HS.HANDICAPS.map(function (x) { return x.id; }).indexOf(setupSel.hc), function (i) { setupSel.hc = HS.HANDICAPS[i].id; save('hensoku.hc', setupSel.hc); openSetup(id); });
    $('su-goal-wrap').hidden = id !== 'hasami' && id !== 'an';
    if (id === 'an') seg($('su-goal'), HS.AN_BOARDS.map(function (b) { return b.label; }), HS.AN_BOARDS.map(function (b) { return b.id; }).indexOf(setupSel.anBoard), function (i) { setupSel.anBoard = HS.AN_BOARDS[i].id; save('hensoku.anBoard', setupSel.anBoard); openSetup(id); });
    if (id === 'hasami') seg($('su-goal'), ['5枚取ったら勝ち', '1枚以下にしたら勝ち'], setupSel.all ? 1 : 0, function (i) { setupSel.all = i === 1; save('hensoku.hasamiAll', setupSel.all); openSetup(id); });
    seg($('su-level'), LEVELS, setupSel.level, function (i) { setupSel.level = i; save('hensoku.level', i); openSetup(id); });
    var sides = id === 'komaochi' ? ['下手（駒が多い）', '上手（駒を落とす）', 'ランダム'] : ['先手（☗）', '後手（☖）', 'ランダム'];
    seg($('su-first'), sides, setupSel.first, function (i) { setupSel.first = i; save('hensoku.first', i); openSetup(id); });
    dispToggles($('su-disp'), 'game', id === 'an');
    if (id === 'trump') {
      var tb = document.createElement('button'); tb.className = 'tg' + (trumpShow() ? ' on' : '');
      tb.innerHTML = '<span><b>相手の手札を見せる</b><small>' + (setupSel.H ? 'CPU戦：CPU の手札を見る／2人で1台：おたがいの手札を見せ合う（オフなら、手番の人だけが「見る」でのぞく）' : '手札0枚のときは、めくった札はいつもおたがい見えます') + '</small></span><i></i>';
      tb.onclick = function () { save('hensoku.trumpShow', !trumpShow()); Snd.play('select'); openSetup(id); };
      $('su-disp').insertBefore(tb, $('su-disp').lastChild);
    }
    if (id === 'koka') {
      var kb = document.createElement('button'); kb.className = 'tg' + (setupSel.fxShow ? ' on' : '');
      kb.innerHTML = '<span><b>相手のカードを見せる</b><small>オフにすると、おたがいのカードはふせたまま（山に「透視」が入る）。2人で1台では、手番の人だけがのぞく</small></span><i></i>';
      kb.onclick = function () { setupSel.fxShow = !setupSel.fxShow; save('hensoku.fxShow', setupSel.fxShow); Snd.play('select'); openSetup(id); };
      $('su-disp').insertBefore(kb, $('su-disp').lastChild);
    }
    setupOnlineParts(id);
    var st = statOf(id);
    $('su-stats').textContent = 'CPU戦の成績 — ' + LEVELS.map(function (n, i) { return n + ' ' + st.w[i] + '勝' + st.l[i] + '敗' + (st.d[i] ? st.d[i] + '分' : ''); }).join(' ・ ');
    sheet('setup', true);
  }
  var HASAMI_RULES = '9×9 の盤に、歩（先手）と と（後手）を9枚ずつ並べる。駒は縦か横に、何マスでも動ける（駒は跳びこえられない）。<br>' +
    '動かした駒ともう1枚の自分の駒で、縦か横に並んだ相手の駒をはさむと取れる（何枚並んでいてもまとめて取れる）。<br>' +
    'すみの駒は、となりの2マスを両方ふさぐと取れる。自分から相手の駒のあいだに入っても取られない。<br>勝ち方は「5枚取ったら勝ち」か「相手を1枚以下にしたら勝ち」。';
  // トランプ将棋のルール（手札の枚数で少し変わる）
  function trumpRules(H) {
    return 'ふつうの本将棋（9×9・同じ駒・同じ並び）に、<b>トランプ</b>を足したもの。カードは <b>A（1）〜9 を4組の36枚</b>と<b>ジョーカー2枚</b>。<br>' +
      '<b>カードの数字の「筋」にいる駒だけ</b>を動かせる（筋は本将棋のよび方。先手から見て<b>右はしが1筋</b>、左はしが9筋。盤の上に番号が出る）。' +
      'その筋にいる駒なら、どの駒でもふつうの動きで指せる。持ち駒は、その筋のマスにだけ打てる。ジョーカーはどの筋でもいい。<br>' +
      (H === 0 ? '<b>手札0枚</b>：自分の番のはじめに、山から1枚めくって、その筋の駒を動かす（めくった札はおたがい見える）。<br>'
               : '<b>手札' + H + '枚</b>：おたがい見える手札から1枚えらんで、その筋の駒を動かす。指したら山から1枚引いて、' + H + '枚にもどす。<br>') +
      '<b>例外（何をしてもいい）</b>：<br>・<b>王手をかけられているとき</b>は、カードに関係なく、どの手でも指せる。<b>このときカードは使わない</b>' +
      (H ? '（手札はそのまま。引きもしない）' : '（めくった札は使わずに残り、次に相手がその札で指す）') + '。カードは灰色になる。<br>' +
      '・<b>カードの筋で指せる手が1つもないとき</b>（その筋に動ける駒も、打てる持ち駒もない）は、どの手でも指せる。<br>' +
      'それ以外は本将棋と同じ（成り・二歩・打ち歩詰め・行き所のない駒・王手放置は禁止）。<b>詰み</b>＝王手をかけられて、指せる手が1つもないこと。<br>' +
      '山がなくなったら、捨てたカードをまぜて山にもどす。千日手はなし（とても長くなったら引き分け）。';
  }
  // 特殊効果将棋のルール
  function kokaRules() {
    var X = HS.effects, list = X.ORDER.map(function (c) { var C = X.CARDS[c]; return '<b>' + C.emoji + ' ' + C.name + '</b>: ' + C.desc + (c === 'toushi' ? '（カードがふせてあるルールのときだけ）' : ''); });
    return 'ふつうの本将棋に、<b>特殊効果カード</b>を足したもの。はじめに、おたがい山からカードを1枚（設定で2枚）引く。<br>' +
      'カードは<b>自分の番に、ふつうの手を指す前に1枚だけ</b>使える。1枚につき<b>1局に1回</b>。使っても、そのあとふつうに1手指す（二手指しは2手）。<br>' +
      '<b>王手をかけられているあいだは、カードは使えない</b>。盤を変えるカード（入れ替え・成り込み）は、王手・二歩・行き所のない駒になる使い方はできない。<br>' +
      'カードの効果で指せる手が1つもなくなるときは、その制限はなし（カードのせいで詰みにはしない）。<br><br>' + list.join('<br>') +
      '<br><br>地雷は、入った駒が消えると入った側の玉に王手がかかってしまうときは不発（地雷はそのまま残る）。棋譜には「★二手指し」のように書く（地雷の場所は書かない）。';
  }
  // オリジナル駒の説明
  function pieceNotes(V) {
    var have = {}, out = [];
    V.start.forEach(function (v) { if (v) have[R.kind(v)] = 1; });
    if (have[15]) out.push('<b>忍</b>: 桂馬の跳び方を8方向に（前後左右の「2つ先の1つ横」へ跳ぶ）。成ると<b>影</b>（忍＋玉の動き）');
    if (have[16]) out.push('<b>砲</b>: 縦横に何マスでも動ける。取るときは、ちょうど1枚をはさんだ向こうの敵を撃つ。成ると<b>轟</b>（砲＋ななめ1マス）');
    if (have[17]) out.push('<b>蛙</b>: 縦横ななめに、ちょうど2マス先へ跳ぶ。成ると<b>跳</b>（蛙＋玉の動き）');
    return out.length ? '<br><br>' + out.join('<br>') : '';
  }

  function gameTitle() {
    return G.ad.V && G.ad.V.group === 'komaochi' ? '駒落ち（' + G.ad.V.short + '）' : G.ad.kind === 'trump' ? 'トランプ将棋（手札' + G.ad.H + '枚）' :
      G.ad.kind === 'koka' ? '特殊効果将棋（' + G.ad.fxOpt.n + '枚）' : G.ad.title;
  }
  // 対局画面の準備（CPU・2人で1台・オンラインで共通）
  function setupGameView() {
    $('g-title').textContent = gameTitle();
    $('g-sub').textContent = G.mode === 'local' ? '2人で1台' : G.mode === 'online' ? 'オンライン（部屋 ' + ON.code + '）' : 'CPU（' + LEVELS[G.level] + '）';
    var isT = G.ad.kind === 'trump', isK = G.ad.kind === 'koka';
    $('g-cards').hidden = !isT; $('g-opp').hidden = !isT;
    $('g-fx').hidden = !isK; $('g-fxopp').hidden = !isK;
    // 盤の大きさは、画面に出ている入れ物の高さから決めるので、先に対局画面を出しておく（カードや持ち駒と重ならないように）
    if (curScreen !== 'game') show('game');
    G.view = BoardView($('g-board'), { w: G.ad.w, h: G.ad.h, hands: G.ad.hands, stones: G.ad.kind === 'hasami', files: isT, extra: isT ? (G.ad.H ? 120 : 84) : isK ? 110 : 0, onSquare: tapSquare, onHand: tapHand });
    $('g-undo').hidden = G.mode !== 'cpu';
    $('g-again').hidden = G.mode === 'online';   // オンラインでは「はじめから」も引き分けもなし（投了は右上）
    $('g-resign').hidden = false;
    document.body.classList.toggle('online', G.mode === 'online');
  }
  function startGame(id, mode) {
    clearTimeout(G.timer);
    var rid = realId(id);
    G.menuId = id;
    G.ad = adapterFor(rid, { all: setupSel.all, H: setupSel.H, fxN: setupSel.fxN, fxShow: setupSel.fxShow });
    G.selCard = 0; G.fxSel = null; G.cfg = null;
    G.mode = mode; G.level = setupSel.level;
    G.human = setupSel.first === 2 ? (Math.random() < 0.5 ? 0 : 1) : setupSel.first;
    G.hist = [G.ad.init()]; G.moves = []; G.busy = false; G.done = false; G.sel = null; G.selHand = null; G.peek = false; G.rid = rid;
    sheet('setup', false); sheet('result', false);
    setupGameView();
    show('game');
    if (hiddenHands()) handOver();
    if (mode === 'cpu') {
      var first = G.ad.turn(curS());
      toast(first === G.human ? 'あなたが先に指します' : 'CPU が先に指します');
    }
    refresh();
    next();
  }
  function legalNow() {
    var ms = G.ad.moves(curS());
    if (G.ad.kind === 'trump') { var k = G.selCard || 0; ms = ms.filter(function (m) { return m.card === k || m.card === -1; }); }
    return ms;
  }
  function tapSquare(i) {
    var s = curS();
    if (G.done || G.busy || !isHumanTurn(s)) return;
    if (G.fxSel) { fxTap(i); return; }
    var ms = legalNow();
    if (G.sel !== null || G.selHand) {
      var cand = ms.filter(function (m) { return m.t === i && (G.selHand ? m.f < 0 && m.d === G.selHand : m.f === G.sel); });
      if (cand.length === 2) {
        var t = R.kind(s.b[cand[0].f]);
        askPromote(t, function (pr) { doMove(cand.filter(function (x) { return !!x.pr === pr; })[0]); });
        return;
      }
      if (cand.length === 1) { doMove(cand[0]); return; }
      if (G.ad.kind === 'koka' && s.fx && s.fx.nite) {
        var raw = R.moves(G.ad.V, s).filter(function (m) { return m.t === i && (G.selHand ? m.f < 0 && m.d === G.selHand : m.f === G.sel); });
        if (raw.length) { Snd.play('ng'); haptic('ng'); toast('二手指しでは、駒を取る手・王手になる手は指せません'); return; }
      }
    }
    var mineV = G.ad.kind === 'hasami' ? (s.turn === 0 ? 1 : -1) : null;
    var isMine = G.ad.kind === 'hasami' ? s.b[i] === mineV : s.b[i] && R.owner(s.b[i]) === s.turn;
    if (isMine && ms.some(function (m) { return m.f === i; })) { G.sel = i; G.selHand = null; Snd.play('select'); haptic('light'); }
    else {
      if (isMine && G.ad.kind === 'koka' && s.fx && s.fx.nite) {
        Snd.play('ng');
        toast(s.fx.nite === 2 && i === s.fx.niteSq ? '二手指し：1手目で動かした駒は、もう動かせません' : '二手指し：その駒で指せる手がありません（駒を取る手・王手になる手はだめ）');
      }
      G.sel = null; G.selHand = null;
    }
    refresh();
  }
  function tapHand(p, t) {
    var s = curS();
    if (G.done || G.busy || !isHumanTurn(s) || p !== s.turn) return;
    if (!legalNow().some(function (m) { return m.f < 0 && m.d === t; })) { G.selHand = null; refresh(); return; }
    G.selHand = G.selHand === t ? null : t; G.sel = null; Snd.play('select'); haptic('light'); refresh();
  }
  function doMove(m) {
    var s = curS(), n;
    try { n = G.ad.play(s, m); } catch (e) { Snd.play('ng'); haptic('ng'); return; }
    G.sel = null; G.selHand = null; G.fxSel = null;
    G.moves.push(m);
    if (G.mode === 'online') onlineSend(m, n);
    commit(n);
  }
  function commit(n) {
    var prevTurn = curS().turn;
    G.hist.push(n); G.selCard = 0;
    if (n.fx && n.fx.log) {
      var lg = n.fx.log;
      if (lg.fx) { Snd.play('fx'); haptic('ok'); toast((lg.by === 0 ? '☗' : '☖') + ' ' + sideNames()[lg.by] + '：★' + HS.effects.CARDS[lg.fx].name + (lg.fx === 'jirai' ? '（どこかに地雷をしかけた）' : '') + '！', 2200); }
      if (lg.mine !== undefined) { setTimeout(function () { Snd.play('cap'); haptic('heavy'); toast('💣 地雷！ ' + DEF[lg.hit].n + ' が消えて、' + sideNames()[lg.by] + 'の持ち駒に', 2600); }, 250); }
    }
    var capt = G.ad.kind === 'hasami' ? n.gotSq && n.gotSq.length : n.last && n.last.cap;
    Snd.play(capt ? 'cap' : 'place');
    if (n.check) setTimeout(function () { Snd.play('check'); }, 120);
    haptic(n.check || capt ? 'medium' : 'light');
    refresh(n.gotSq);
    var o = G.ad.over(n) || G.ad.rep(G.hist);
    if (o) { G.done = true; refresh(); G.timer = setTimeout(function () { finish(o); }, 700); return; }
    if (G.mode === 'online') saveOnlineCur();
    if (hiddenHands() && n.turn !== prevTurn) { G.peek = false; refresh(); handOver(); }
    next();
  }
  function next() {
    var s = curS();
    if (G.done || G.mode !== 'cpu' || G.ad.turn(s) === G.human) return;
    G.busy = true; refresh();
    G.timer = setTimeout(function () {
      var t0 = Date.now(), m = G.ad.ai(s, G.level);
      var wait = Math.max(0, 380 - (Date.now() - t0));
      G.timer = setTimeout(function () { G.busy = false; if (curS() === s) { G.moves.push(m); commit(G.ad.play(s, m)); } }, wait);
    }, 250);
  }
  function refresh(gone) {
    var s = curS(), V = G.ad.V, dests = {};
    var interactive = !G.done && !G.busy && isHumanTurn(s);
    if (interactive && disp.game.dests && (G.sel !== null || G.selHand)) legalNow().forEach(function (m) { if (G.selHand ? m.f < 0 && m.d === G.selHand : m.f === G.sel) dests[m.t] = 1; });
    var checkSq = -1;
    if (G.ad.kind === 'shogi' && s.check) { var ks = R.kingSquares(V, s.b, s.turn); checkSq = ks.length ? ks[0] : -1; }
    var names = sideNames();
    var filesOn = null;
    if (G.ad.kind === 'trump') filesOn = renderCards(s, interactive);
    var mines = null, fxt = null;
    if (G.ad.kind === 'koka') { renderFx(s, interactive); mines = mineView(s); fxt = fxTargets(s); if (fxt) dests = {}; }
    G.view.render(s, V || { handTypes: [] }, { showBorrow: disp.game.borrow, sel: G.sel, selHand: G.selHand, dests: dests, check: checkSq, flip: flipView(), files: filesOn, mines: mines, fxt: fxt,
      labels: names.map(function (n, p) { return (p === 0 ? '☗ ' : '☖ ') + (G.mode === 'cpu' ? (p === G.human ? 'あなた' : 'CPU') : G.mode === 'online' ? (p === G.human ? 'あなた' : 'あいて') : n); }), gone: gone || [] });
    var t = G.ad.turn(s);
    for (var p = 0; p < 2; p++) {
      var el = $('pl' + p);
      el.className = 'pl' + (t === p && !G.done ? ' turn' : '');
      el.querySelector('.ic').textContent = G.ad.kind === 'hasami' ? (p === 0 ? '歩' : 'と') : p === 0 ? '☗' : '☖';
      el.querySelector('.nm').textContent = G.mode === 'online' ? (p === G.human ? 'あなた' : 'あいて') : names[p];
      el.querySelector('.sc').textContent = G.ad.kind === 'hasami' ? s.cap[p] + '枚' : '';
    }
    if (G.mode === 'online') paintClocks();
    $('g-undo').disabled = G.busy || G.hist.length < 2;
    $('g-resign').disabled = G.done;
    var st = $('g-status');
    st.className = 'status' + (s.check && !G.done ? ' warn' : '');
    if (G.done) st.textContent = 'おしまい';
    else if (G.busy) st.textContent = 'CPU が考えています…';
    else if (G.fxSel) st.textContent = FX_PROMPT[G.fxSel.c] + (G.fxSel.c === 'irekae' && G.fxSel.a >= 0 ? '（2枚目）' : '') + '　やめるときは「キャンセル」';
    else st.textContent = (G.mode === 'cpu' ? (t === G.human ? 'あなたの番です' : 'CPU の番です') : G.mode === 'online' ? (t === G.human ? 'あなたの番です' : 'あいての番です') : names[t] + ' の番です') +
      (s.check ? '　王手！' : '') + (G.ad.kind === 'trump' ? trumpHint(s) : '') + (G.mode === 'online' && !ON.oppHere && !G.done ? '　（相手の接続待ち）' : '');
  }
  // ---- トランプ将棋のカード ----
  var SUITS = ['♠', '♥', '♦', '♣'];
  function cardHTML(c, cls, k) {
    if (c === HS.trump.JOKER) return '<span class="cd joker ' + (cls || '') + '" data-k="' + k + '">JOKER<i>好きな筋</i></span>';
    var su = SUITS[(c + (k || 0)) % 4], red = su === '♥' || su === '♦';
    return '<span class="cd ' + (red ? 'red ' : '') + (cls || '') + '" data-k="' + k + '"><small>' + su + '</small>' + HS.trump.cardName(c) + '<i>' + c + '筋</i></span>';
  }
  // 相手の手札を見せるか（設定）。2人で1台で見せないときは、手番の人だけが「見る」でのぞく
  function trumpShow() { return load('hensoku.trumpShow', true); }
  function trumpHidden() { return G.ad && G.ad.kind === 'trump' && G.ad.H > 0 && !trumpShow() && G.mode === 'local'; }
  // 2人で1台で、手番ごとに交代画面をはさむか（トランプの手札・特殊効果カードを見せないルール）
  function hiddenHands() { return trumpHidden() || (G.ad && G.ad.kind === 'koka' && !G.ad.fxOpt.show && G.mode === 'local'); }
  function faceUp(p, s) {
    if (G.ad.H === 0 || trumpShow()) return true;
    if (G.mode === 'cpu' || G.mode === 'online') return p === G.human;
    return p === s.turn && G.peek && !G.done;
  }
  // 2人で1台: 交代のときは、うしろが見えない画面をはさむ
  function handOver() {
    var old = document.querySelector('.handover'); if (old) old.remove();
    var s = curS(), names = sideNames(), box = document.createElement('div'); box.className = 'handover';
    box.innerHTML = '<div><p>' + (s.turn === 0 ? '☗ ' : '☖ ') + names[s.turn] + ' の番です</p><small>相手に手札が見えないように、交代してね</small><button class="btn" id="ho-go">手札を見る</button></div>';
    document.body.appendChild(box);
    box.querySelector('#ho-go').addEventListener('click', function () { box.remove(); G.peek = true; Snd.play('select'); refresh(); });
  }
  // 手札はいつも同じ場所（上の段＝盤の上側の人、下の段＝盤の下側の人）。手番が変わっても動かない
  function renderCards(s, interactive) {
    var TR = HS.trump, opt = TR.options(s), all = G.ad.moves(s), mover = s.turn;
    var free = all.length && all[0].free, chk = all.length && all[0].card === -1, names = sideNames();
    var flip = flipView(), topP = flip ? 0 : 1, botP = 1 - topP;
    var k = Math.min(G.selCard || 0, Math.max(0, opt.length - 1));
    function row(host, p) {
      var html = '<span class="who">' + (p === 0 ? '☗' : '☖') + ' ' + names[p] + '<br>' + (G.ad.H ? 'の手札' : (p === mover ? 'がめくった札' : '')) + '</span>';
      var cards = G.ad.H ? s.cards[p] : (p === mover && s.cur !== null && s.cur !== undefined ? [s.cur] : []);
      var up = faceUp(p, s), mine = p === mover;
      if (!cards.length) html += '<span class="cd empty"></span>';
      cards.forEach(function (c, i) {
        if (!up) { html += '<span class="cd back"></span>'; return; }
        var usable = mine && all.some(function (m) { return m.card === i; });
        html += cardHTML(c, (mine && i === k && !G.done && !chk ? 'sel ' : '') + (mine && !usable && !chk ? 'dim' : '') + (mine ? '' : ' other'), i);
      });
      if (p === mover && chk && !G.done) html += '<span class="freenote">王手：どの駒でも動かせます（カードは使いません）</span>';
      if (p === mover && G.ad.H && !up && G.mode === 'local' && !G.done) html += '<button class="peek">👁 手札を見る</button>';
      if (p === botP) html += '<span class="deck">山 ' + s.deck.length + ' 枚' + (s.chk ? '<br>前の手は王手（札なし）' : s.usedCard !== undefined && s.usedCard !== null ? '<br>前の札 ' + TR.cardName(s.usedCard) : '') + '</span>';
      host.innerHTML = html;
      host.classList.toggle('mover', p === mover && !G.done);
      host.classList.toggle('free', p === mover && !!chk && !G.done);
      host.querySelectorAll('.cd[data-k]').forEach(function (el) {
        el.addEventListener('pointerdown', function () {
          if (!interactive || G.ad.H === 0 || p !== mover || !up || chk) return;
          G.selCard = +el.dataset.k; G.sel = null; G.selHand = null; Snd.play('select'); haptic('light'); refresh();
        });
      });
      var pk = host.querySelector('.peek'); if (pk) pk.addEventListener('click', function () { G.peek = true; Snd.play('select'); refresh(); });
    }
    row($('g-opp'), topP); row($('g-cards'), botP);
    var on = {}, f;
    if (chk) { /* 王手: カードを使わないので筋に色はつけない */ }
    else if (free) { for (f = 1; f <= 9; f++) on[f] = true; }
    else if (opt.length) { var c = opt[k], cf = TR.cardFile(c); if (cf === 0) { for (f = 1; f <= 9; f++) on[f] = true; } else on[cf] = true; }
    return on;
  }
  function trumpHint(s) {
    var all = G.ad.moves(s);
    if (!all.length) return '';
    if (all[0].card === -1) return '　王手：どの駒でも動かせます（カードは使いません）';
    if (all[0].free) return '（この札の筋では指せないので、何でも指せる）';
    var c = HS.trump.options(s)[Math.min(G.selCard || 0, HS.trump.options(s).length - 1)];
    return c === HS.trump.JOKER ? '　ジョーカー：どの筋でもOK' : '　' + c + '筋の駒を動かそう';
  }

  function undo() {
    if (G.mode !== 'cpu' || G.busy) return;
    clearTimeout(G.timer);
    var i = G.hist.length - 2;
    while (i >= 0 && G.ad.turn(G.hist[i]) !== G.human) i--;
    if (i < 0) return;
    G.hist = G.hist.slice(0, i + 1); G.moves = G.moves.slice(0, i); G.done = false; G.sel = null; G.selHand = null; G.selCard = 0;
    sheet('result', false); Snd.play('select'); haptic('light');
    refresh(); next();
  }
  function finish(o) {
    if (G.mode === 'online' && ON.clk && G.cfg && G.ad && !ON.frozen) { var mv = G.ad.turn(curS()); ON.clk[mv] = CLOCK.run(G.cfg.clock, ON.clk[mv], Date.now() - ON.turnStart); delete ON.clk[mv].flag; ON.frozen = true; paintClocks(); }
    var w = o.winner, st = statOf(G.menuId), title, cls, names = sideNames();
    stopTick();
    if (w === -1) { title = 'ひきわけ'; cls = 'draw'; Snd.play('draw'); if (G.mode === 'cpu') st.d[G.level]++; }
    else if (G.mode === 'online') {
      if (w === G.human) { title = 'あなたの勝ち！'; cls = 'win'; Snd.play('win'); haptic('goal'); }
      else { title = 'あいての勝ち'; cls = 'lose'; Snd.play('lose'); haptic('ng'); }
    }
    else if (G.mode === 'cpu') {
      if (w === G.human) { title = 'あなたの勝ち！'; cls = 'win'; Snd.play('win'); haptic('goal'); st.w[G.level]++; }
      else { title = 'CPU の勝ち'; cls = 'lose'; Snd.play('lose'); haptic('ng'); st.l[G.level]++; }
    } else { title = names[w] + ' の勝ち！'; cls = 'win'; Snd.play('win'); haptic('goal'); st.local++; }
    save('hensoku.stats', stats);
    saveRecord(o, title);
    $('r-title').textContent = title; $('r-title').className = cls;
    $('r-text').textContent = o.text || '';
    $('r-mode').textContent = $('g-title').textContent + '・' + (G.mode === 'local' ? '2人で1台' : G.mode === 'online' ? 'オンライン' + (G.cfg && G.cfg.clock && G.cfg.clock.kind !== 'none' ? '（' + ShogiNet.Clock.label(G.cfg.clock) + '）' : '') : 'CPU（' + LEVELS[G.level] + '）');
    $('r-undo').hidden = G.mode !== 'cpu';
    $('r-again').textContent = G.mode === 'online' ? 'もう一局（先後を入れかえ）' : 'もう一度';
    $('r-menu').textContent = G.mode === 'online' ? 'オンライン対戦をやめる' : 'ルール一覧へ';
    if (G.mode === 'online') { var sv = load('hensoku.onlineCur', null); if (sv) { sv.end = o; save('hensoku.onlineCur', sv); } }
    sheet('result', true);
  }
  function resign() {
    if (G.done) return;
    askYes('投了しますか？', '🏳 投了する', doResign, { danger: true, sub: '負けになります' });
  }
  function doResign() {
    if (G.done) return;
    clearTimeout(G.timer); G.busy = false; G.done = true;
    if (G.mode === 'online') { ON.net.resign(); refresh(); finish({ winner: 1 - G.human, text: 'あなたが投了' }); return; }
    var s = curS(), loser = G.mode === 'cpu' ? G.human : G.ad.turn(s);
    refresh();
    finish({ winner: 1 - loser, text: (G.mode === 'cpu' ? 'あなた' : sideNames()[loser]) + 'が投了' });
  }

  // ===================== 対局の記録・棋譜の見返し =====================
  // 終わった対局を、最初の局面＋指した手で保存する（新しい順に30局）。トランプ将棋は、各手のあとの札も一緒に
  var REC_KEY = 'hensoku.records';
  function loadRecords() { return load(REC_KEY, []); }
  function saveRecord(o, title) {
    if (!G.moves || G.moves.length !== G.hist.length - 1) return;
    var rec = {
      id: Date.now(), date: new Date().toISOString(), menuId: G.menuId, rid: G.rid, title: $('g-title').textContent, mode: G.mode, level: G.level, human: G.human,
      H: G.ad.H || 0, all: !!setupSel.all, winner: o.winner, result: title + (o.text ? '（' + o.text + '）' : ''), init: G.hist[0], moves: G.moves.slice()
    };
    if (G.ad.kind === 'koka') { rec.fxN = G.ad.fxOpt.n; rec.fxShow = G.ad.fxOpt.show; }
    if (G.mode === 'online' && G.cfg) { rec.all = !!G.cfg.opt.all; rec.H = G.cfg.opt.H || 0; rec.code = ON.code; rec.clock = G.cfg.clock; }
    if (G.ad.kind === 'trump') rec.tc = G.hist.slice(1).map(function (n) { return { c: n.cards, cur: n.cur, u: n.usedCard, fr: n.free ? 1 : 0, ck: n.chk ? 1 : 0, dl: n.deck.length }; });
    G.lastRec = rec;
    if (WEB) return;                                   // ブラウザ版は残さない（終わった直後の見返しだけ）
    var list = loadRecords(); list.unshift(rec);
    var on = 0; list = list.filter(function (r) { if (r.mode !== 'online') return true; on++; return on <= 5; });
    if (list.length > 35) list.length = 35;
    try { save(REC_KEY, list); } catch (e) { list.length = 10; save(REC_KEY, list); }
  }
  function recWho(r) {
    if (r.mode === 'online') return '🌐 オンライン・あなたは' + (r.human === 0 ? '先手' : '後手') + (r.clock && r.clock.kind !== 'none' ? '・' + ShogiNet.Clock.label(r.clock) : '');
    return r.mode === 'cpu' ? 'CPU（' + LEVELS[r.level] + '）・あなたは' + (r.human === 0 ? '先手' : '後手') : '2人で1台';
  }
  function buildRecords() {
    var host = $('rec-list'), list = loadRecords(); host.innerHTML = '';
    $('rec-clear').hidden = !list.length;
    if (!list.length) { host.innerHTML = '<p class="tnote">まだ記録がありません。対局が終わると、ここに残ります（新しい30局まで）。</p>'; return; }
    list.forEach(function (r) {
      var d = new Date(r.date), b = document.createElement('button'); b.className = 'vcard';
      b.innerHTML = '<span class="ico">' + (r.mode === 'online' ? '🌐' : '📜') + '</span><span class="txt"><b>' + r.title + '</b><small>' + recWho(r) + '</small><em>' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) +
        '　' + r.moves.length + '手　' + r.result + '</em></span>';
      b.addEventListener('click', function () { Snd.init(); Snd.play('select'); openReplay(r); });
      host.appendChild(b);
    });
  }
  // はさみ将棋の棋譜（▲５五→５三 ×2 のように）
  var ZEN = '０１２３４５６７８９', KAN = '〇一二三四五六七八九';
  function hsq(i) { var x = i % 9, y = (i - x) / 9; return ZEN[9 - x] + KAN[y + 1]; }
  var RP = { rec: null, ad: null, states: [], labels: [], k: 0, flip: false, timer: null };
  function recPlay(r) {
    var ad = adapterFor(r.rid, { all: r.all, H: r.H, fxN: r.fxN, fxShow: r.fxShow }), states = [r.init], labels = [], s = r.init, prevT = -1;
    for (var j = 0; j < r.moves.length; j++) {
      var m = r.moves[j], n, lab;
      if (ad.kind === 'koka') { lab = HS.effects.label(ad.V, s, m, prevT); n = ad.play(s, m); if (m.fx) { labels.push(lab); states.push(n); s = n; continue; } }
      else if (ad.kind === 'hasami') { n = ad.play(s, m); lab = (s.turn === 0 ? '▲' : '△') + hsq(m.f) + '→' + hsq(m.t) + (n.gotSq && n.gotSq.length ? ' ×' + n.gotSq.length : ''); }
      else if (ad.kind === 'trump') {
        lab = HS.kifu(ad.V, s, m, prevT);
        n = R.play(ad.V, s, m); n.last = { f: m.f, t: m.t, pr: m.pr, d: m.d, cap: m.cap };
        var tc = r.tc[j]; n.H = r.H; n.cards = tc.c; n.cur = tc.cur; n.usedCard = tc.u; n.free = !!tc.fr; n.chk = !!tc.ck; n.deck = { length: tc.dl };
        lab += '〔' + (tc.ck || tc.u === null ? '王手' : tc.fr ? '自由' : HS.trump.cardName(tc.u)) + '〕';
      } else { lab = HS.kifu(ad.V, s, m, prevT); n = ad.play(s, m); }
      labels.push(lab); states.push(n); s = n; prevT = m.t;
    }
    return { ad: ad, states: states, labels: labels };
  }
  // 棋譜を文字にする（コピー用）
  function kifuText(r) {
    var p = recPlay(r), d = new Date(r.date), lines = [];
    lines.push('変則将棋　' + r.title);
    lines.push('日時：' + d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2));
    lines.push('対局：' + recWho(r).replace('🌐 ', ''));
    lines.push('結果：' + r.result);
    lines.push('');
    p.labels.forEach(function (t, j) { lines.push((j + 1) + '　' + t); });
    return lines.join('\n');
  }
  function openReplay(r, fromGame) {
    var pr = recPlay(r), ad = pr.ad, states = pr.states, labels = pr.labels;
    RP = { rec: r, ad: ad, states: states, labels: labels, k: fromGame ? states.length - 1 : 0, flip: (r.mode === 'cpu' || r.mode === 'online') && r.human === 1, timer: null };
    RP.view = BoardView($('rp-board'), { w: ad.w, h: ad.h, hands: ad.hands, stones: ad.kind === 'hasami', files: ad.kind === 'trump', extra: ad.kind === 'trump' ? 40 : 0, onSquare: function () {}, onHand: function () {} });
    $('rp-title').textContent = r.title; $('rp-sub').textContent = recWho(r) + '　' + r.result;
    $('rp-try').hidden = ad.kind === 'trump' || WEB;
    sheet('result', false); show('replay'); rpRender();
  }
  function rpNames() {
    var r = RP.rec, komaochi = RP.ad.V && RP.ad.V.group === 'komaochi', base = komaochi ? ['下手', '上手'] : ['先手', '後手'];
    if (r.mode === 'local') return base;
    var n = base.slice(); n[r.human] = 'あなた'; n[1 - r.human] = r.mode === 'online' ? 'あいて' : 'CPU'; return n;
  }
  function rpGo(k) { RP.k = Math.max(0, Math.min(RP.states.length - 1, k)); Snd.play('place'); rpRender(); }
  function rpRender() {
    var s = RP.states[RP.k], ad = RP.ad, names = rpNames(), checkSq = -1;
    if (ad.kind !== 'hasami' && s.check) { var ks = R.kingSquares(ad.V, s.b, s.turn); checkSq = ks.length ? ks[0] : -1; }
    RP.view.render(s, ad.V || { handTypes: [] }, { showBorrow: disp.game.borrow, check: checkSq, flip: RP.flip, labels: names.map(function (n, p) { return (p === 0 ? '☗ ' : '☖ ') + n; }) });
    var total = RP.states.length - 1;
    $('rp-status').textContent = RP.k === 0 ? '開始の局面（全 ' + total + ' 手）' : RP.k + ' / ' + total + ' 手目　' + RP.labels[RP.k - 1];
    var el = $('rp-moves'), html = '<span class="mv' + (RP.k === 0 ? ' cur' : '') + '" data-k="0">開始</span>';
    RP.labels.forEach(function (t, j) { html += '<span class="mv' + (j + 1 === RP.k ? ' cur' : '') + '" data-k="' + (j + 1) + '">' + (j + 1) + '.' + t + '</span>'; });
    el.innerHTML = html;
    el.querySelectorAll('.mv').forEach(function (x) { x.onclick = function () { rpStop(); rpGo(+x.dataset.k); }; });
    var cur = el.querySelector('.mv.cur'); if (cur) el.scrollTop = cur.offsetTop - el.clientHeight / 2;
    $('rp-first').disabled = $('rp-prev').disabled = RP.k === 0; $('rp-next').disabled = $('rp-last').disabled = RP.k === total;
    $('rp-auto').textContent = RP.timer ? '⏸ 止める' : '▶ 自動';
    // トランプ将棋: その局面の手札（記録した札）
    var tc = $('rp-cards');
    tc.hidden = ad.kind !== 'trump';
    if (ad.kind === 'trump') {
      var h = '';
      [1, 0].forEach(function (p) {
        var cs = RP.rec.H ? (s.cards ? s.cards[p] : []) : (p === s.turn && s.cur !== null && s.cur !== undefined ? [s.cur] : []);
        h += '<div class="rprow"><span class="who">' + (p === 0 ? '☗' : '☖') + ' ' + names[p] + '</span>' + cs.map(function (c, i) { return cardHTML(c, 'small', i); }).join('') + '</div>';
      });
      tc.innerHTML = h;
    }
  }
  function rpStop() { if (RP.timer) { clearInterval(RP.timer); RP.timer = null; $('rp-auto').textContent = '▶ 自動'; } }
  function rpAuto() {
    if (RP.timer) { rpStop(); return; }
    if (RP.k >= RP.states.length - 1) RP.k = 0;
    RP.timer = setInterval(function () { if (RP.k >= RP.states.length - 1) { rpStop(); return; } rpGo(RP.k + 1); }, 900);
    rpRender();
  }
  // 記録のこの局面から、2人で1台で指してみる
  function tryFrom() {
    var r = RP.rec;
    if (RP.ad.kind === 'trump') return;
    clearTimeout(G.timer);
    G.menuId = r.menuId; G.rid = r.rid; G.ad = adapterFor(r.rid, { all: r.all, H: r.H, fxN: r.fxN, fxShow: r.fxShow }); G.selCard = 0; G.fxSel = null; G.mode = 'local'; G.level = r.level; G.human = 0; G.cfg = null;
    G.hist = RP.states.slice(0, RP.k + 1); G.moves = r.moves.slice(0, RP.k); G.busy = false; G.done = false; G.sel = null; G.selHand = null; G.peek = false;
    $('g-title').textContent = r.title; $('g-sub').textContent = '記録から検討（2人で1台）';
    $('g-cards').hidden = true; $('g-opp').hidden = true; $('g-fx').hidden = G.ad.kind !== 'koka'; $('g-fxopp').hidden = G.ad.kind !== 'koka';
    G.view = BoardView($('g-board'), { w: G.ad.w, h: G.ad.h, hands: G.ad.hands, stones: G.ad.kind === 'hasami', extra: G.ad.kind === 'koka' ? 110 : 0, onSquare: tapSquare, onHand: tapHand });
    $('g-undo').hidden = true;
    show('game'); refresh();
  }

  // ===================== 詰将棋 =====================
  var PZ = HS.PUZZLES || [];
  var solved = load('hensoku.solved2', {});
  // P.hist: 指した手の記録 [{ s: 指す前の局面, m: 手, by: 0 攻め方 / 1 玉方 }]
  var P = { i: 0, pz: null, V: null, s0: null, s: null, hist: [], solver: null, view: null, sel: null, selHand: null, busy: false, done: false, hint: 0, play: null, verdict: null, filter: load('hensoku.tFilter', 'all') };
  // 詰将棋の設定: mode = 'move'（盤を動かして解く）/ 'read'（盤を動かさずに解く）, def = 'auto'（玉方は自動）/ 'self'（玉方も自分で動かす）, hide = 手数をかくす
  var tset = load('hensoku.tset', null) || { mode: 'move', def: 'auto', hide: false };
  function setT(k, v) { tset[k] = v; save('hensoku.tset', tset); }
  function hiddenN(p) { return tset.hide && !solved[p.id]; }
  function lenShown(p) { return hiddenN(p) ? '？手詰め' : lenLabel(p.n); }
  var AN_SHORT = { S: '安南', N: '安北', E: '安東', W: '安西' };
  var AN_RULE = { S: '駒のすぐうしろに味方の駒がいれば、その駒の動きになる', N: '駒のすぐ前に味方の駒がいれば、その駒の動きになる', E: '駒の右どなりに味方の駒がいれば、その駒の動きになる', W: '駒の左どなりに味方の駒がいれば、その駒の動きになる' };
  function pzRule(p) { return HS.VARIANTS[p.v].anDir || p.v.split('-')[1]; }
  function vTitle(id) { var V = HS.VARIANTS[id]; return V.an ? AN_SHORT[V.anDir] + '将棋' : V.title; }
  function stars(n) { return '★★★★★'.slice(0, n) + '<span style="opacity:.3">' + '★★★★★'.slice(0, 5 - n) + '</span>'; }
  function lenLabel(n) { return n >= 9 ? n + '手詰め（長編）' : n + '手詰め'; }
  // 一覧に出す順番（手数 → 難しさ → 番号）。ルールのタブで絞りこむ
  function listOrder() {
    return PZ.map(function (p, i) { return i; })
      .filter(function (i) { return P.filter === 'all' || pzRule(PZ[i]) === P.filter; })
      .sort(function (a, b) { var p = PZ[a], q = PZ[b]; return p.n - q.n || p.stars - q.stars || p.no - q.no; });
  }
  // 今の問題のあとで、まだ解いていない問題（なければ一覧の次）
  function nextIndex(from) {
    var ord = listOrder(), k = ord.indexOf(from), j;
    for (j = 1; j <= ord.length; j++) { var c = ord[(k + j) % ord.length]; if (c !== from && !solved[PZ[c].id]) return c; }
    return k >= 0 && k < ord.length - 1 ? ord[k + 1] : -1;
  }
  function buildTsume() {
    var host = $('t-list'); host.innerHTML = '';
    var count = PZ.filter(function (p) { return solved[p.id]; }).length;
    $('t-prog').textContent = 'クリア ' + count + ' / ' + PZ.length + ' 問';
    // 東西南北で絞りこむ
    var tabs = [['all', 'ぜんぶ']].concat(['S', 'N', 'E', 'W'].map(function (d) { return [d, AN_SHORT[d]]; }));
    seg($('t-filter'), tabs.map(function (t) { return t[1]; }), tabs.map(function (t) { return t[0]; }).indexOf(P.filter), function (i) { P.filter = tabs[i][0]; save('hensoku.tFilter', P.filter); buildTsume(); });
    var onlyUn = load('hensoku.tUnsolved', false), closed = load('hensoku.tClosed', {});
    $('t-unsolved').className = 'chip' + (onlyUn ? ' on' : '');
    var ord = listOrder(), firstUn = -1;
    ord.forEach(function (i) { if (firstUn < 0 && !solved[PZ[i].id]) firstUn = i; });
    $('t-nextun').disabled = firstUn < 0;
    $('t-nextun').textContent = firstUn < 0 ? 'ぜんぶクリア！' : 'つぎの未クリア ›';
    var note = $('t-note');
    note.innerHTML = P.filter === 'all' ? 'ぜんぶ 9×9 の盤。駒の動きは、となりの<b>味方の駒</b>から借ります（安南＝うしろ／安北＝前／安東＝右／安西＝左、どれも攻め方・玉方それぞれの向き）。'
      : '<b>' + AN_SHORT[P.filter] + '将棋</b>：' + AN_RULE[P.filter] + '（向きは、その駒の持ち主から見て）。';
    var lens = [];
    if (tset.hide) { lens = ['?']; ord = ord.slice().sort(function (a, b) { return PZ[a].stars - PZ[b].stars || PZ[a].no - PZ[b].no; }); }
    else ord.forEach(function (i) { if (lens.indexOf(PZ[i].n) < 0) lens.push(PZ[i].n); });
    lens.forEach(function (n) {
      var all = ord.filter(function (i) { return n === '?' || PZ[i].n === n; });
      var done = all.filter(function (i) { return solved[PZ[i].id]; }).length;
      var list = onlyUn ? all.filter(function (i) { return !solved[PZ[i].id]; }) : all;
      // 見出しをタップすると、その手数の問題をたたむ／ひらく（覚えておく）
      var h = document.createElement('button'); h.className = 'sec' + (closed[n] ? ' closed' : '');
      h.innerHTML = '<span class="arw">▾</span>' + (n === '?' ? 'ぜんぶの問題（手数はかくしています）' : lenLabel(n)) + '<span class="cnt">' + done + ' / ' + all.length + ' 問クリア</span>';
      h.addEventListener('click', function () { closed[n] = !closed[n]; save('hensoku.tClosed', closed); Snd.play('select'); buildTsume(); });
      host.appendChild(h);
      if (closed[n]) return;
      var g = document.createElement('div'); g.className = 'pgrid'; host.appendChild(g);
      if (!list.length) { var e = document.createElement('p'); e.className = 'tnote'; e.textContent = 'この手数はぜんぶクリア！'; host.appendChild(e); }
      list.forEach(function (i) {
        var p = PZ[i], b = document.createElement('button'); b.className = 'pz' + (solved[p.id] ? ' solved' : '');
        b.innerHTML = '<b>第' + p.no + '問</b><small>' + vTitle(p.v) + (n === '?' ? '・' + lenShown(p) : '') + '</small><div class="st">' + stars(p.stars) + '</div>' + (solved[p.id] ? '<span class="ok">✓</span>' : '');
        b.addEventListener('click', function () { Snd.init(); Snd.play('select'); openPuzzle(i); });
        g.appendChild(b);
      });
    });
  }
  function decode(str) {
    if (str[0] === 'd') { var a = str.slice(1).split('@'); return { f: -1, d: +a[0], t: +a[1] }; }
    var pr = str[str.length - 1] === '+', b = (pr ? str.slice(0, -1) : str).split('-');
    return { f: +b[0], t: +b[1], pr: pr };
  }
  function puzzleStart(p) {
    var V = HS.VARIANTS[p.v], b = HS.parseRows(p.rows, V.w, V.h);
    var h0 = V.handTypes.map(function (t) { return p.hand[t] || 0; });
    return { b: b, hand: [h0, HS.tsumeHand(V, b, h0)], turn: 0, ply: 0, last: null, check: false };
  }
  // list を渡すと「じぶんの問題」（自作・読み込んだ問題）として開く
  function openPuzzle(i, list) {
    var p = (list || PZ)[i];
    P.i = i; P.mine = !!list; P.pz = p; P.V = HS.VARIANTS[p.v]; P.s0 = puzzleStart(p); P.solver = new HS.Solver(P.V);
    pView(40);
    pTitle();
    $('p-sub').innerHTML = vTitle(p.v) + (P.mine ? '' : '　' + '★★★★★'.slice(0, p.stars));
    $('p-rule').textContent = (P.V.an ? AN_SHORT[P.V.anDir] + '：' + AN_RULE[P.V.anDir] : '');
    show('puzzle');
    pReset();
    if (!load('hensoku.tsumeHelp2', false)) { toast('攻め方（☗）は王手だけ。' + (hiddenN(p) ? '' : p.n + '手以内に') + '玉を詰ませよう。間違えても最後まで指せます', 4000); save('hensoku.tsumeHelp2', true); }
  }
  // 盤の大きさ（検討モードは下にパネルがあるので小さめ）
  function pView(extra) {
    P.viewExtra = extra;
    P.view = BoardView($('p-board'), { w: P.V.w, h: P.V.h, hands: true, files: true, ranks: true, extra: extra, onSquare: pTap, onHand: pHand });
  }
  function pTitle() {
    var p = P.pz; if (!p) return;
    $('p-title').textContent = (P.mine ? 'じぶんの問題　' : '第' + p.no + '問　') + (P.play || P.study ? lenLabel(p.n) : lenShown(p));
  }
  // 下のボタンの列を、いまのモードに合わせる
  function pTools() {
    var read = tset.mode === 'read';
    $('p-tools').hidden = !!(P.play || P.study || read); $('p-read').hidden = !!(P.play || P.study || !read);
    $('p-play').hidden = !P.play; $('p-studytools').hidden = !P.study; $('p-study').hidden = !P.study;
  }
  // 最初から（または、ある手の前から）やりなおす
  function pReset(fromHist) {
    var h = fromHist || [];
    if (P.study) clearTimeout(P.study.pv);
    P.hist = h.slice(); P.s = h.length ? applyHist(h) : P.s0;
    P.sel = null; P.selHand = null; P.busy = false; P.done = false; P.hint = 0; P.play = null; P.verdict = null; P.study = null;
    P.rd = { moves: [], states: [P.s0], sel: null, selHand: null };
    if (P.viewExtra !== 40) pView(40);
    pTools(); pTitle();
    sheet('pres', false);
    pRender();
  }
  function applyHist(h) {
    var s = P.s0;
    h.forEach(function (x) { s = R.apply(P.V, s, x.m); s.check = R.inCheck(P.V, s, s.turn); });
    return s;
  }
  function usedAttack() { return P.hist.filter(function (x) { return x.by === 0; }).length; }
  function attackTotal() { return (P.pz.n + 1) / 2; }
  function leftPly() { return P.pz.n - P.hist.length; }
  // 本筋どおりに進んでいるか（ここまでの手が全部 line と同じ）
  function onMainLine() {
    for (var k = 0; k < P.hist.length; k++) if (!P.pz.line[k] || !R.same(decode(P.pz.line[k]), P.hist[k].m)) return false;
    return true;
  }
  function selfDef() { return tset.mode === 'move' && tset.def === 'self' && !P.play && !P.study && !P.done && P.s && P.s.turn === 1; }
  function pRender() {
    pTitle();
    if (P.study) return stRender(true);
    if (tset.mode === 'read' && !P.play) return rdRender();
    var s = P.s, dests = {}, hint = {}, hintHand = null, d = disp.tsume, sd = selfDef();
    if (!P.done && !P.busy && !P.play && d.dests && (P.sel !== null || P.selHand)) (sd ? R.moves(P.V, s) : pAtkMoves(s)).forEach(function (m) { if (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel) dests[m.t] = 1; });
    if (P.hint && !P.done && !P.play) {
      var hm = hintMove();
      if (hm) { if (P.hint >= 1) { if (hm.f >= 0) hint[hm.f] = 1; else hintHand = hm.d; } if (P.hint >= 2) hint[hm.t] = 1; }
    }
    var checkSq = -1;
    if (s.check) { var ks = R.kingSquares(P.V, s.b, s.turn); checkSq = ks.length ? ks[0] : -1; }
    P.view.render(s, P.V, { showBorrow: P.play ? true : d.borrow, sel: P.sel, selHand: P.selHand, dests: dests, hint: hint, hintHand: hintHand, check: checkSq, rest: !sd, labels: ['☗ 攻め方', '☖ 玉方'] });
    var st = $('p-status');
    st.className = 'status' + (s.check ? ' warn' : '');
    if (P.play) st.textContent = '正しい手順 ' + P.play.k + ' / ' + P.pz.line.length + ' 手目';
    else if (P.done) st.textContent = P.verdict && P.verdict.ok ? '詰み！' : '不正解　「最初から」でもう一度';
    else if (P.busy) st.textContent = '玉方が考えています…';
    else if (sd) st.textContent = '玉方の番　あなたが玉を逃がします（' + (P.hist.length + 1) + '手目）';
    else if (hiddenN(P.pz)) st.textContent = '攻め方の番（' + (P.hist.length + 1) + '手目）';
    else st.textContent = '攻め方の番　あと ' + (attackTotal() - usedAttack()) + ' 回指せます（' + (P.hist.length + 1) + '手目）';
    renderMoves();
    $('p-undo').disabled = !P.hist.length || P.busy || P.done;
  }
  // 盤の下に、ここまでの手順を棋譜で出す
  function renderMoves() {
    var el = $('p-moves'), parts = [], prevT = -1, s = P.s0;
    P.hist.forEach(function (x) { parts.push(HS.kifu(P.V, s, x.m, prevT)); prevT = x.m.t; s = R.apply(P.V, s, x.m); });
    el.textContent = parts.length ? parts.join('　') : '　';
    el.scrollLeft = el.scrollWidth;
  }
  function hintMove() {
    if (onMainLine() && P.pz.line[P.hist.length]) return decode(P.pz.line[P.hist.length]);
    var ms = P.solver.matingMoves(P.s, leftPly());
    if (!ms.length) { toast('この局面からは、もう間に合いません。「戻す」でやりなおそう'); return null; }
    return ms[0];
  }
  // 詰将棋の攻め方は王手しか指せない（王手にならない手は選べないようにする）
  function pAtkMoves(s) {
    return R.moves(P.V, s).filter(function (m) { var n = R.apply(P.V, s, m); return R.inCheck(P.V, n, n.turn); });
  }
  function pTap(i) {
    if (P.study) return stTap(i);
    if (tset.mode === 'read' && !P.play) return rdTap(i);
    if (P.done || P.busy || P.play) return;
    if (selfDef()) return defTap(i);
    var s = P.s, all = R.moves(P.V, s), ms = pAtkMoves(s);
    if (P.sel !== null || P.selHand) {
      var cand = ms.filter(function (m) { return m.t === i && (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel); });
      if (cand.length === 2) { askPromote(R.kind(s.b[cand[0].f]), function (pr) { pMove(cand.filter(function (x) { return !!x.pr === pr; })[0]); }); return; }
      if (cand.length === 1) { pMove(cand[0]); return; }
      var legalHere = all.some(function (m) { return m.t === i && (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel); });
      if (legalHere) { Snd.play('ng'); haptic('ng'); toast('詰将棋は王手しか指せません'); return; }
      if (P.sel !== null && !(s.b[i] > 0) && !disp.tsume.dests) { Snd.play('ng'); toast('そこへは動けません'); }
    }
    if (s.b[i] > 0 && all.some(function (m) { return m.f === i; })) { P.sel = i; P.selHand = null; Snd.play('select'); haptic('light'); }
    else if (s.b[i] > 0) { P.sel = null; P.selHand = null; Snd.play('ng'); toast('その駒は今は動かせません'); }
    else { P.sel = null; P.selHand = null; }
    pRender();
  }
  function pHand(p, t) {
    if (P.study) return stHand(p, t);
    if (tset.mode === 'read' && !P.play) return rdHand(p, t);
    if (P.done || P.busy || P.play) return;
    if (selfDef()) { if (p !== 1 || !R.moves(P.V, P.s).some(function (m) { return m.f < 0 && m.d === t; })) return; P.selHand = P.selHand === t ? null : t; P.sel = null; Snd.play('select'); haptic('light'); pRender(); return; }
    if (p !== 0) return;
    if (!R.moves(P.V, P.s).some(function (m) { return m.f < 0 && m.d === t; })) return;
    P.selHand = P.selHand === t ? null : t; P.sel = null; Snd.play('select'); haptic('light'); pRender();
  }
  // 攻め方の手（王手になる合法手だけ）。指し終わったら玉方が応じる
  function pMove(m) {
    var s = P.s, n = R.apply(P.V, s, m);
    n.check = R.inCheck(P.V, n, n.turn);
    P.sel = null; P.selHand = null; P.hint = 0;
    P.hist.push({ s: s, m: m, by: 0 }); P.s = n;
    Snd.play(m.cap ? 'cap' : 'place'); if (n.check) setTimeout(function () { Snd.play('check'); }, 110); haptic(n.check ? 'medium' : 'light');
    var replies = R.legalFrom(P.V, n, false);
    if (!replies.length) { judge(); return; }                    // 詰み（または玉方が指せない）
    if (usedAttack() >= attackTotal()) { judge(); return; }      // 手数を使い切った
    if (tset.def === 'self') { pRender(); return; }              // 玉方も自分で動かす
    P.busy = true; pRender();
    setTimeout(function () {
      var reply = defenderReply(P.s);
      var n2 = R.apply(P.V, P.s, reply); n2.check = R.inCheck(P.V, n2, n2.turn);
      P.hist.push({ s: P.s, m: reply, by: 1 }); P.s = n2; P.busy = false;
      Snd.play(reply.cap ? 'cap' : 'place'); haptic('light');
      pRender();
    }, 480);
  }
  // 玉方の応手: 本筋どおりならその手。それ以外は、いちばん長く逃げる手（詰まない手があればそれ）
  function defenderReply(s) {
    var k = P.hist.length;
    if (onMainLine() && P.pz.line[k]) {
      var mv = decode(P.pz.line[k]);
      if (R.legalFrom(P.V, s, false).some(function (x) { return R.same(x, mv); })) return mv;
    }
    return P.solver.bestDefense(s, leftPly());
  }
  // ===================== 判定 =====================
  // 間違えた手（攻め方の手で、そこから残りの手数では詰まなくなった最初の手）を探す
  function findMistake() {
    var left = P.pz.n;
    for (var k = 0; k < P.hist.length; k++) {
      var x = P.hist[k];
      if (x.by === 0) {
        var n = R.apply(P.V, x.s, x.m);
        var stillWin = R.inCheck(P.V, n, 1) && P.solver.and(n, left - 1);
        if (!stillWin) return { k: k, left: left };
      }
      left--;
    }
    return null;
  }
  function judge() {
    P.done = true; P.busy = false;
    var s = P.s, mated = s.turn === 1 && !R.legalFrom(P.V, s, false).length && R.inCheck(P.V, s, 1);
    var v = { ok: mated, hist: P.hist.slice() };
    if (tset.def === 'self') {
      v.self = true; v.defs = defenseReview(P.hist);
      if (mated && findMistake()) { v.ok = false; v.unsound = true; }
    }
    if (v.ok) {
      v.alt = !onMainLine();
      solved[P.pz.id] = true; save('hensoku.solved2', solved);
      Snd.play('solved'); haptic('goal');
      var b = document.createElement('div'); b.className = 'solved-banner'; b.innerHTML = '<span>詰み！</span>'; document.body.appendChild(b);
      setTimeout(function () { b.remove(); }, 1500);
    } else {
      Snd.play('ng'); haptic('ng');
      v.mis = findMistake();
      if (v.mis) {
        var x = P.hist[v.mis.k];
        v.misMove = x.m; v.misBefore = x.s; v.misLeft = v.mis.left;
        v.misNum = v.mis.k + 1;
        v.misCheck = R.inCheck(P.V, R.apply(P.V, x.s, x.m), 1);
        // 正しい手（その局面で、残りの手数で詰ませる手）。本筋の上なら本筋の手
        var good = null, mainBefore = true;
        for (var q = 0; q < v.mis.k; q++) if (!R.same(decode(P.pz.line[q]), P.hist[q].m)) { mainBefore = false; break; }
        if (mainBefore && P.pz.line[v.mis.k]) good = decode(P.pz.line[v.mis.k]);
        else good = P.solver.matingMoves(x.s, v.mis.left)[0] || null;
        v.good = good;
        // 玉方の切り返し（実際に玉方が指した次の手。なければソルバーで）
        var after = R.apply(P.V, x.s, x.m);
        var nx = P.hist[v.mis.k + 1];
        v.refute = nx ? nx.m : (R.legalFrom(P.V, after, false).length ? P.solver.bestDefense(after, v.mis.left - 1) : null);
        v.refuteBefore = after;
      }
    }
    P.verdict = v;
    pRender();
    setTimeout(showVerdict, v.ok ? 900 : 350);
  }
  // 手順を棋譜の文字列の配列にする（states が要るので、初期局面から並べなおす）
  function kifuList(start, moves) {
    var out = [], s = start, prevT = -1;
    moves.forEach(function (m) { out.push(HS.kifu(P.V, s, m, prevT)); prevT = m.t; s = R.apply(P.V, s, m); });
    return out;
  }
  // 結果のシート。不正解のときは、正しい手も手順も見せない（最初からもう一度考える）。答えは盤の下の「答え」からだけ
  function showVerdict() {
    var v = P.verdict; if (!v) return;
    var el = $('pres-body'), mine = kifuList(P.s0, v.hist.map(function (x) { return x.m; }));
    var html = '';
    if (v.ok) {
      $('pres-title').textContent = '正解！'; $('pres-title').className = 'win';
      html += '<p class="vmsg">' + mine.length + '手で詰みました。' + (v.alt ? '<br>本の手順とはちがう順番でも、ちゃんと詰んでいます（別の詰め方）。' : '<br>本の手順どおり。おみごと！') + '</p>';
      html += '<div class="kl one"><div><h4>あなたの手順</h4><ol>' + mine.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol></div></div>';
      html += defsHTML(v);
    } else {
      $('pres-title').textContent = '不正解'; $('pres-title').className = 'lose';
      if (v.unsound) html += '<p class="vmsg">あなたの選んだ逃げ方では詰みましたが、玉方がもっと粘る逃げ方をすると' + (hiddenN(P.pz) ? '' : ' ' + P.pz.n + '手以内に') + '詰みません。<br>どの逃げ方でも詰む手順を考えよう。</p>';
      else if (v.readReason) html += '<p class="vmsg">その手順は正解になりません。<br>' + v.readReason + '</p>';
      else html += '<p class="vmsg">' + (hiddenN(P.pz) ? '' : P.pz.n + '手以内に') + '詰みませんでした。<br>最初の局面から、もう一度考えてみよう。</p>';
      if (v.self) html += defsHTML(v);
      html += '<p class="vtip">どうしても分からないときは、盤の下の「答え」で正解を見られます。</p>';
    }
    el.innerHTML = html;
    $('pres-retryhere').hidden = true;
    $('pres-replay').hidden = !v.ok;
    $('pres-study').hidden = !v.ok;
    $('pres-again').textContent = v.ok ? 'もう一度' : '最初から';
    $('pres-again').className = v.ok ? 'btn ghost' : 'btn';
    $('pres-next').hidden = !v.ok || P.mine || nextIndex(P.i) < 0;
    sheet('pres', true);
  }
  // 答えを見る（1手ずつ）
  function pAnswer() {
    sheet('pres', false);
    P.play = { k: 0, states: [P.s0] };
    var s = P.s0;
    P.pz.line.forEach(function (str) { var m = decode(str); s = R.apply(P.V, s, m); s.check = R.inCheck(P.V, s, s.turn); P.play.states.push(s); });
    pTools();
    pStep(0);
  }
  function pStep(k) {
    var ps = P.play; ps.k = Math.max(0, Math.min(P.pz.line.length, k));
    P.s = ps.states[ps.k];
    var list = kifuList(P.s0, P.pz.line.map(decode));
    $('p-step').textContent = ps.k === 0 ? '最初の局面' : list[ps.k - 1];
    $('p-prev').disabled = ps.k === 0; $('p-nextstep').disabled = ps.k === P.pz.line.length;
    Snd.play('place');
    pRender();
    $('p-moves').textContent = list.slice(0, ps.k).join('　') || '　';
  }
  // 1手戻す（攻め方の手まで戻る）
  function pUndo() {
    if (P.busy || P.done || !P.hist.length) return;
    var h = P.hist.slice();
    if (h.length && h[h.length - 1].by === 1) h.pop();
    if (h.length && h[h.length - 1].by === 0) h.pop();
    Snd.play('select'); pReset(h);
  }
  // 詰将棋の設定シート（解き方・玉方の応手・表示・手数をかくす）
  function openDisp() {
    var modes = [['move', '盤を動かして解く'], ['read', '盤を動かさずに解く']], defs = [['auto', '自動で逃げる'], ['self', '自分で動かす']];
    function paint() {
      seg($('pd-mode'), modes.map(function (x) { return x[1]; }), tset.mode === 'read' ? 1 : 0, function (i) {
        var c = modes[i][0] !== tset.mode; setT('mode', modes[i][0]); paint(); if (c && P.pz && !P.study) pReset();
      });
      $('pd-modedesc').textContent = tset.mode === 'read' ? '読みの練習：盤は最初の局面のまま。攻め方・玉方の手を交互に棋譜で入力して、最後に「解答する」。' : '駒を動かしながら解きます。';
      seg($('pd-def'), defs.map(function (x) { return x[1]; }), tset.def === 'self' ? 1 : 0, function (i) {
        var c = defs[i][0] !== tset.def; setT('def', defs[i][0]); paint(); if (c && P.pz && !P.study && !P.done && tset.mode === 'move') pReset();
      });
      $('pd-defdesc').textContent = tset.def === 'self' ? '玉方の手も自分で指します。最後に、攻め方の手がどの逃げ方にも通じるか、選んだ逃げ方がいちばん粘る手だったかを判定します。（検討で変化を解くときも同じ）' : '玉方は、いちばん長く逃げる手で自動で応じます。';
      $('pd-defwrap').hidden = tset.mode === 'read';
      dispToggles($('pd-body'), 'tsume', true, function () { if (P.pz) pRender(); });
      var hb = document.createElement('button'); hb.className = 'tg' + (tset.hide ? ' on' : '');
      hb.innerHTML = '<span><b>手数をかくす</b><small>「○手詰め」を、解くまで「？手詰め」にする</small></span><i></i>';
      hb.onclick = function () { setT('hide', !tset.hide); Snd.play('select'); paint(); if (P.pz && curScreen === 'puzzle') pRender(); if (curScreen === 'tsume') buildTsume(); };
      $('pd-body').insertBefore(hb, $('pd-body').lastChild);
    }
    paint();
    sheet('pdisp', true);
  }
  function kif(s, m, prevT) { return HS.kifu(P.V, s, m, prevT === undefined ? -1 : prevT); }
  function encM(m) { return m.f < 0 ? 'd' + m.d + '@' + m.t : m.f + '-' + m.t + (m.pr ? '+' : ''); }
  // 玉方番の局面で、ぜんぶの応手と「詰むまでの手数」（その応手を含む。詰まなければ Infinity）
  function defReplies(s, left) {
    var V = P.V, solver = P.solver;
    return R.legalFrom(V, s, false).map(function (m) {
      var n = R.apply(V, s, m), d = left - 1 >= 1 ? solver.dist(n, left - 1) : -1;
      return { m: m, d: d, total: d < 0 ? Infinity : d + 1 };
    });
  }
  // 自分で動かした玉方の手が、いちばん粘る手だったか
  function defenseReview(hist) {
    var out = [], prevT = -1;
    hist.forEach(function (x, k) {
      if (x.by === 1) {
        var rows = defReplies(x.s, P.pz.n - k), best = -1, mine = -1;
        rows.forEach(function (r) { if (r.total > best) best = r.total; if (R.same(r.m, x.m)) mine = r.total; });
        out.push({ k: k, kif: kif(x.s, x.m, prevT), best: mine === best, mine: mine, bestTotal: best });
      }
      prevT = x.m.t;
    });
    return out;
  }
  function defsHTML(v) {
    if (!v.defs || !v.defs.length) return '';
    return '<div class="kl one"><div><h4>あなたが選んだ玉方の逃げ方</h4><ol>' + v.defs.map(function (d) {
      var t = d.best ? '✓ いちばん粘る逃げ方' : (d.bestTotal === Infinity ? '△ 詰まない逃げ方がありました' : '△ もっと粘れる逃げ方がありました（そのときは、ここから ' + d.bestTotal + ' 手）');
      return '<li value="' + (d.k + 1) + '">' + d.kif + '　<small>' + t + '</small></li>';
    }).join('') + '</ol></div></div>';
  }
  // 玉方を自分で動かすときのタップ
  function defTap(i) {
    var s = P.s, all = R.moves(P.V, s);
    if (P.sel !== null || P.selHand) {
      var cand = all.filter(function (m) { return m.t === i && (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel); });
      if (cand.length === 2) { askPromote(R.kind(s.b[cand[0].f]), function (pr) { defMove(cand.filter(function (x) { return !!x.pr === pr; })[0]); }); return; }
      if (cand.length === 1) { defMove(cand[0]); return; }
    }
    if (all.some(function (m) { return m.f === i; })) { P.sel = i; P.selHand = null; Snd.play('select'); haptic('light'); }
    else if (s.b[i]) { P.sel = null; P.selHand = null; Snd.play('ng'); toast('玉方の番です。玉方の駒を動かそう'); }
    else { P.sel = null; P.selHand = null; }
    pRender();
  }
  function defMove(m) {
    var n = R.apply(P.V, P.s, m); n.check = R.inCheck(P.V, n, n.turn);
    P.hist.push({ s: P.s, m: m, by: 1 }); P.s = n; P.sel = null; P.selHand = null;
    Snd.play(m.cap ? 'cap' : 'place'); haptic('light');
    pRender();
  }

  // ===================== 盤を動かさずに解く（読みの練習） =====================
  // 盤は最初の局面のまま。入力した手は、盤には何も残さず、棋譜だけに出す
  function rdState() { return P.rd.states[P.rd.states.length - 1]; }
  function rdRender() {
    var s = rdState(), d = disp.tsume, dests = {};
    if (d.dests && (P.rd.sel !== null || P.rd.selHand)) R.moves(P.V, s).forEach(function (m) { if (P.rd.selHand ? m.f < 0 && m.d === P.rd.selHand : m.f === P.rd.sel) dests[m.t] = 1; });
    var show0 = { b: P.s0.b, hand: P.s0.hand, turn: s.turn, last: null };
    P.view.render(show0, P.V, { showBorrow: d.borrow, sel: P.rd.sel, selHand: P.rd.selHand, dests: dests, rest: s.turn === 0, labels: ['☗ 攻め方', '☖ 玉方'], noLast: true });
    var st = $('p-status'), k = P.rd.moves.length;
    st.className = 'status';
    st.textContent = P.done ? (P.verdict && P.verdict.ok ? '正解！' : '不正解　「最初から」でもう一度')
      : '読みの練習：盤は最初のまま　' + (s.turn === 0 ? '☗ 攻め方' : '☖ 玉方') + 'の手を入力（' + (k + 1) + '手目）';
    var el = $('p-moves'), prevT = -1, ss = P.s0, html = '';
    P.rd.moves.forEach(function (m, j) { html += '<span class="mv read">' + kif(ss, m, prevT) + '</span>'; prevT = m.t; ss = R.apply(P.V, ss, m); });
    el.innerHTML = html || '<span style="opacity:.6">頭の中で動かして、手を棋譜で入力しよう</span>';
    el.scrollLeft = el.scrollWidth;
    $('r-del').disabled = !k || P.done; $('r-clear').disabled = !k || P.done; $('r-submit').disabled = !k || P.done;
  }
  function rdTap(i) {
    if (P.done) return;
    var s = rdState(), all = R.moves(P.V, s), rd = P.rd;
    if (rd.moves.length >= P.pz.n || !all.length) { Snd.play('ng'); toast('これ以上は入力できません。「解答する」を押そう'); return; }
    if (rd.sel !== null || rd.selHand) {
      var cand = all.filter(function (m) { return m.t === i && (rd.selHand ? m.f < 0 && m.d === rd.selHand : m.f === rd.sel); });
      if (s.turn === 0) {
        var chk = cand.filter(function (m) { var n = R.apply(P.V, s, m); return R.inCheck(P.V, n, n.turn); });
        if (cand.length && !chk.length) { Snd.play('ng'); haptic('ng'); toast('詰将棋は王手しか指せません'); return; }
        cand = chk;
      }
      if (cand.length === 2) { askPromote(R.kind(s.b[cand[0].f]), function (pr) { rdPush(cand.filter(function (x) { return !!x.pr === pr; })[0]); }); return; }
      if (cand.length === 1) { rdPush(cand[0]); return; }
    }
    if (all.some(function (m) { return m.f === i; })) { rd.sel = i; rd.selHand = null; Snd.play('select'); haptic('light'); }
    else if (s.b[i] || P.s0.b[i]) { rd.sel = null; rd.selHand = null; Snd.play('ng'); toast('入力した手のあとの局面では、そこに動かせる駒はありません'); }
    else { rd.sel = null; rd.selHand = null; }
    rdRender();
  }
  function rdHand(p, t) {
    if (P.done) return;
    var s = rdState();
    if (p !== s.turn) { toast((s.turn === 0 ? '攻め方' : '玉方') + 'の番です'); return; }
    if (!R.moves(P.V, s).some(function (m) { return m.f < 0 && m.d === t; })) { Snd.play('ng'); toast('その駒は今は打てません'); return; }
    P.rd.selHand = P.rd.selHand === t ? null : t; P.rd.sel = null; Snd.play('select'); haptic('light'); rdRender();
  }
  // 1手入力する（合法手・攻め方は王手だけ。ちがえば false）
  function rdPush(m) {
    var s = rdState(), ok = R.moves(P.V, s).some(function (x) { return R.same(x, m); });
    if (!ok) { toast('その手は指せません'); return false; }
    var n = R.apply(P.V, s, m); n.check = R.inCheck(P.V, n, n.turn);
    if (s.turn === 0 && !n.check) { toast('詰将棋は王手しか指せません'); return false; }
    P.rd.moves.push(m); P.rd.states.push(n); P.rd.sel = null; P.rd.selHand = null;
    Snd.play('place'); haptic('light'); rdRender();
    return true;
  }
  function rdDel() { if (P.done || !P.rd.moves.length) return; P.rd.moves.pop(); P.rd.states.pop(); P.rd.sel = null; P.rd.selHand = null; Snd.play('select'); rdRender(); }
  function rdClear() { if (P.done) return; P.rd = { moves: [], states: [P.s0], sel: null, selHand: null }; Snd.play('select'); rdRender(); }
  // 入力した手順が、どの逃げ方にも通じる正しい詰め手順か（玉方の手は、いちばん粘る手であること）
  function rdCheck(moves) {
    var s = P.s0, N = P.pz.n, states = [s];
    moves.forEach(function (m) { s = R.apply(P.V, s, m); states.push(s); });
    var end = states[states.length - 1], mated = end.turn === 1 && !R.legalFrom(P.V, end, false).length && R.inCheck(P.V, end, 1);
    if (!mated || moves.length > N) return { ok: false, why: '最後の局面が詰みになっていません。' };
    for (var k = 0; k < moves.length; k++) {
      var before = states[k], after = states[k + 1], left = N - k;
      if (k % 2 === 0) { if (!P.solver.and(after, left - 1)) return { ok: false, why: '途中の攻め方の手で、玉方がうまく逃げると詰まなくなります。' }; }
      else {
        var rows = defReplies(before, left), best = -1, mine = -1;
        rows.forEach(function (r) { if (r.total > best) best = r.total; if (R.same(r.m, moves[k])) mine = r.total; });
        if (mine !== best) return { ok: false, why: '玉方に、もっと粘る逃げ方があります（玉方の手も、いちばん粘る手を入力しよう）。' };
      }
    }
    return { ok: true };
  }
  function rdSubmit() {
    if (P.done || !P.rd.moves.length) return;
    var r = rdCheck(P.rd.moves), v = { ok: r.ok, hist: P.rd.moves.map(function (m, k) { return { m: m, by: k % 2 }; }) };
    P.done = true;
    if (r.ok) {
      var main = P.pz.line.map(decode);
      v.alt = !(P.rd.moves.length === main.length && P.rd.moves.every(function (m, k) { return R.same(m, main[k]); }));
      solved[P.pz.id] = true; save('hensoku.solved2', solved); Snd.play('solved'); haptic('goal');
    } else { v.readReason = r.why; Snd.play('ng'); haptic('ng'); }
    P.verdict = v; rdRender();
    setTimeout(showVerdict, r.ok ? 600 : 300);
  }

  // ===================== 検討モード（解いたあと・答えを見たあと） =====================
  // 玉方の逃げ方は、まず一覧（手数は出さない）。選んだ変化は自分で詰ませてみる。答えは「答えを見る」を押したときだけ
  var ST_LABEL = { undefined: '未挑戦', try: '挑戦中', ok: '解けた ✓', gave: '降参' };
  function stOpen(line, k) {
    sheet('pres', false);
    P.play = null; P.done = true; P.sel = null; P.selHand = null;
    P.study = { line: line.slice(), k: 0, states: null, main: P.pz.line.map(decode), vars: [], msg: '', msgOk: true, ref: null, token: 0, pv: null,
      status: {}, revealAll: {}, atkShown: {}, branch: null };
    stRebuild(); pTools(); pView(250); stGo(k === undefined ? 0 : k);
  }
  function stRebuild() {
    var st = P.study, s = P.s0; st.states = [s];
    st.line.forEach(function (m) { s = R.apply(P.V, s, m); s.check = R.inCheck(P.V, s, s.turn); st.states.push(s); });
  }
  function stGo(k) {
    var st = P.study; if (!st) return;
    st.k = Math.max(0, Math.min(st.line.length, k)); P.s = st.states[st.k]; P.sel = null; P.selHand = null;
    stRender(true);
  }
  function stLeft() { return Math.max(0, P.pz.n - P.study.k); }
  function isMain(line) { var m = P.study.main; return line.length <= m.length && line.every(function (x, j) { return R.same(x, m[j]); }); }
  function prefixKey(line, k) { return line.slice(0, k).map(encM).join(','); }
  // 今の変化（一覧から選んだ逃げ方）の中にいるか
  function inBranch() {
    var st = P.study, b = st.branch;
    return !!b && st.k > b.k0 && prefixKey(st.line, b.k0 + 1) === b.key;
  }
  function isMated(s) { return s.turn === 1 && !R.legalFrom(P.V, s, false).length && R.inCheck(P.V, s, 1); }
  function stRender(recompute) {
    var st = P.study, s = P.s, d = disp.tsume, dests = {};
    if (d.dests && (P.sel !== null || P.selHand)) (s.turn === 0 ? pAtkMoves(s) : R.moves(P.V, s)).forEach(function (m) { if (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel) dests[m.t] = 1; });
    var checkSq = -1; if (s.check) { var ks = R.kingSquares(P.V, s.b, s.turn); checkSq = ks.length ? ks[0] : -1; }
    P.view.render(s, P.V, { showBorrow: d.borrow, sel: P.sel, selHand: P.selHand, dests: dests, check: checkSq, rest: true, labels: ['☗ 攻め方', '☖ 玉方'] });
    var mated = isMated(s);
    $('p-status').className = 'status' + (s.check ? ' warn' : '');
    $('p-status').textContent = '検討　' + (mated ? '詰み（' + st.k + '手）' : (s.turn === 0 ? '☗ 攻め方' : '☖ 玉方') + 'の番（' + (st.k + 1) + '手目）');
    // 棋譜（タップでその局面へ）
    var el = $('p-moves'), prevT = -1, ss = P.s0, html = '<span class="mv' + (st.k === 0 ? ' cur' : '') + '" data-k="0">開始</span>';
    st.line.forEach(function (m, j) { html += '<span class="mv' + (j + 1 === st.k ? ' cur' : j + 1 > st.k ? ' after' : '') + '" data-k="' + (j + 1) + '">' + kif(ss, m, prevT) + '</span>'; prevT = m.t; ss = R.apply(P.V, ss, m); });
    el.innerHTML = html;
    el.querySelectorAll('.mv').forEach(function (x) { x.onclick = function () { Snd.play('select'); P.study.msg = ''; P.study.ref = null; stGo(+x.dataset.k); }; });
    var cur = el.querySelector('.mv.cur'); if (cur) el.scrollLeft = cur.offsetLeft - el.clientWidth / 2;
    $('s-first').disabled = $('s-prev').disabled = st.k === 0; $('s-next').disabled = $('s-last').disabled = st.k === st.line.length;
    $('s-main').disabled = isMain(st.line);
    if (recompute) stPanel(mated);
  }
  function stBtn(a, t) { return '<button class="sbtn" data-a="' + a + '">' + t + '</button>'; }
  // 下の検討パネル
  function stPanel(mated) {
    var st = P.study, tk = ++st.token, box = $('p-study');
    var head = st.msg ? '<div class="smsg ' + (st.msgOk ? 'ok' : 'bad') + '">' + st.msg + '</div>' : '';
    box.innerHTML = head + '<div style="opacity:.6">考え中…</div>';
    setTimeout(function () {
      if (!P.study || tk !== st.token) return;
      var s = P.s, left = stLeft(), k = st.k, html = head, prevT = k ? st.line[k - 1].t : -1, nk = prefixKey(st.line, k);
      if (st.ref) html += stBtn('ref', '△ その逃げ方を指してみる');
      if (mated) html += '<div>詰みです。ほかの手を試すときは、棋譜の手をタップして戻ろう。</div>';
      else if (s.turn === 1) {
        // 玉方の番: 逃げ方の一覧（手数は、答えを見るまで出さない）
        var replies = R.legalFrom(P.V, s, false), shown = st.revealAll[nk];
        var mainNext = k < st.main.length && isMain(st.line.slice(0, k)) ? st.main[k] : null;
        var lens = shown ? defReplies(s, left) : null, best = -1;
        if (lens) lens.forEach(function (r) { if (r.total > best) best = r.total; });
        html += '<div>☖ 玉方の逃げ方は ' + replies.length + ' 通り。選んで、その変化を自分で詰ませてみよう。</div>';
        html += '<table><tr><th>逃げ方</th><th>' + (shown ? '詰むまで' : 'じょうたい') + '</th></tr>' + replies.map(function (m, j) {
          var key = nk + '|' + encM(m), r = lens ? lens[j] : null;
          var right = shown ? (r.total === Infinity ? '詰まない' : 'あと ' + r.total + ' 手' + (r.total === best ? '（最長）' : '')) : ST_LABEL[st.status[key]];
          return '<tr class="row' + (shown && r.total === best ? ' best' : '') + '" data-j="' + j + '"><td>' + kif(s, m, prevT) + (mainNext && R.same(mainNext, m) ? '　<small>本手順</small>' : '') + '</td><td>' + right + '</td></tr>';
        }).join('') + '</table>';
        st.replies = replies;
        if (!shown) html += stBtn('all', '🔓 全部の答え（詰むまでの手数）を見る');
        // 直前の攻め方の手（本手順でないとき）が通じるかは、押したときだけ
        if (k > 0 && !isMain(st.line.slice(0, k))) {
          var ak = prefixKey(st.line, k);
          if (st.atkShown[ak]) html += '<div class="smsg ' + (st.atkShown[ak].ok ? 'ok' : 'bad') + '">' + st.atkShown[ak].text + '</div>' + (st.atkShown[ak].ref ? stBtn('ref2', '△ その逃げ方を指してみる') : '');
          else html += stBtn('atk', '🔓 直前の ' + kif(st.states[k - 1], st.line[k - 1], k > 1 ? st.line[k - 2].t : -1) + ' で詰むか見る');
        }
      } else {
        html += '<div>☗ 攻め方の番：王手で詰ませよう' + (hiddenN(P.pz) ? '' : '（残り ' + left + ' 手）') + '。</div>';
        html += stBtn('rev', inBranch() ? '🔓 この変化の答えを見る' : '🔓 ここからの詰め手順を見る');
      }
      if (st.vars.length) html += '<div class="vars">変化（タップで呼び出す）' + st.vars.map(function (v, j) { return '<button data-v="' + j + '">' + v.label + '</button>'; }).join('') + '</div>';
      box.innerHTML = html;
      box.querySelectorAll('tr.row').forEach(function (tr) { tr.onclick = function () { stPlay(st.replies[+tr.dataset.j]); }; });
      box.querySelectorAll('[data-a]').forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.a; Snd.play('select');
          if (a === 'all') stRevealAll();
          else if (a === 'rev') stReveal();
          else if (a === 'atk') stAtkReveal();
          else if (a === 'ref' && st.ref) stPlay(st.ref);
          else if (a === 'ref2') { var x = st.atkShown[prefixKey(st.line, st.k)]; if (x && x.ref) stPlay(x.ref); }
        };
      });
      box.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { var v = st.vars[+b.dataset.v]; st.line = v.line.slice(); st.msg = ''; st.ref = null; stRebuild(); stGo(v.line.length); }; });
    }, 30);
  }
  function stTap(i) {
    var s = P.s, all = R.moves(P.V, s);
    if (!all.length) return;
    if (P.sel !== null || P.selHand) {
      var cand = all.filter(function (m) { return m.t === i && (P.selHand ? m.f < 0 && m.d === P.selHand : m.f === P.sel); });
      if (s.turn === 0) {
        var chk = cand.filter(function (m) { var n = R.apply(P.V, s, m); return R.inCheck(P.V, n, n.turn); });
        if (cand.length && !chk.length) { Snd.play('ng'); toast('詰将棋は王手しか指せません'); return; }
        cand = chk;
      }
      if (cand.length === 2) { askPromote(R.kind(s.b[cand[0].f]), function (pr) { stPlay(cand.filter(function (x) { return !!x.pr === pr; })[0]); }); return; }
      if (cand.length === 1) { stPlay(cand[0]); return; }
    }
    if (all.some(function (m) { return m.f === i; })) { P.sel = i; P.selHand = null; Snd.play('select'); haptic('light'); }
    else { P.sel = null; P.selHand = null; }
    stRender(false);
  }
  function stHand(p, t) {
    var s = P.s; if (p !== s.turn) return;
    if (!R.moves(P.V, s).some(function (m) { return m.f < 0 && m.d === t; })) return;
    P.selHand = P.selHand === t ? null : t; P.sel = null; Snd.play('select'); stRender(false);
  }
  // 検討で1手指す。答え（詰むかどうか・手数）は出さない
  function stPlay(m) {
    var st = P.study, s = P.s, k = st.k, left = stLeft(), prevT = k ? st.line[k - 1].t : -1, label = kif(s, m, prevT);
    clearTimeout(st.pv);
    var nl = st.line.slice(0, k).concat([m]);
    if (!isMain(nl) && isMain(st.line) && st.line.length) stSaveVar(st.line);
    st.ref = null; st.msgOk = true;
    if (s.turn === 1) {
      // 逃げ方を選んだ → その変化に挑戦
      var key = prefixKey(nl, k + 1);
      st.branch = { k0: k, key: key };
      if (!st.status[key]) st.status[key] = 'try';
      st.msg = label + ' と逃げた変化。王手で詰ませてみよう';
      st.line = nl; stRebuild();
      Snd.play(m.cap ? 'cap' : 'place'); haptic('light');
      stGo(k + 1); return;
    }
    var n = R.apply(P.V, s, m);
    st.line = nl;
    if (isMated(n)) {
      st.msg = '詰みました！';
      if (inBranchAt(k + 1) && st.status[st.branch.key] !== 'gave') { st.status[st.branch.key] = 'ok'; st.msg += 'この変化は解けました ✓'; }
      Snd.play('solved'); haptic('goal');
      stRebuild(); stGo(k + 1); return;
    }
    if (left - 1 <= 0) {
      st.msg = '残りの手数では詰みませんでした。棋譜をタップして戻り、ほかの手を試そう'; st.msgOk = false;
      Snd.play('ng'); stRebuild(); stGo(k + 1); return;
    }
    Snd.play(m.cap ? 'cap' : 'place'); haptic('light');
    if (tset.def === 'auto') {
      // 玉方はいちばん粘る手で応じる（詰まない逃げ方があればそれ）
      var r = P.solver.bestDefense(n, left - 1);
      if (r) { st.line = nl.concat([r]); st.msg = ''; stRebuild(); stGo(k + 2); return; }
    }
    st.msg = ''; stRebuild(); stGo(k + 1);
  }
  function inBranchAt(k) { var st = P.study, b = st.branch; return !!b && k > b.k0 && prefixKey(st.line, b.k0 + 1) === b.key; }
  // 玉方番の逃げ方を全部、手数つきで見せる
  function stRevealAll() { var st = P.study; st.revealAll[prefixKey(st.line, st.k)] = true; stRender(true); }
  // 直前の攻め方の手で詰むか（詰まなければ、玉方の逃げ方も）
  function stAtkReveal() {
    var st = P.study, k = st.k, before = st.states[k - 1], a = st.line[k - 1], n = st.states[k], left = P.pz.n - (k - 1);
    var lab = kif(before, a, k > 1 ? st.line[k - 2].t : -1), out;
    if (P.solver.and(n, left - 1)) out = { ok: true, text: '✓ ' + lab + ' でも詰みます（ここから あと ' + P.solver.distAnd(n, Math.max(0, left - 1)) + ' 手）' };
    else {
      var ref = R.legalFrom(P.V, n, false).length ? P.solver.bestDefense(n, Math.max(1, left - 1)) : null;
      out = { ok: false, text: '✗ ' + lab + ' では、残り ' + (left - 1) + ' 手で詰みません' + (ref ? '。' + kif(n, ref, a.t) + ' と逃げられます' : ''), ref: ref };
    }
    st.atkShown[prefixKey(st.line, k)] = out; stRender(true);
  }
  // この変化（またはここから）の答え: 詰むまでの手数と、詰め手順を1手ずつ
  function stReveal() {
    var st = P.study, k0, from, msg = '';
    if (inBranch()) {
      var b = st.branch; k0 = b.k0;
      var root = st.states[k0], m = st.line[k0], left = P.pz.n - k0, rows = defReplies(root, left), best = -1, mine = Infinity;
      rows.forEach(function (r) { if (r.total > best) best = r.total; if (R.same(r.m, m)) mine = r.total; });
      var n = st.states[k0 + 1], lab = kif(root, m, k0 ? st.line[k0 - 1].t : -1);
      if (mine === Infinity) msg = lab + ' だと、残りの手数では詰みません';
      else {
        var d = mine - 1, first = d > 0 ? P.solver.matingMoves(n, d)[0] : null, fl = first ? kif(n, first, m.t) : '';
        msg = mine < best ? lab + ' なら ' + fl + ' から、あと ' + d + ' 手で詰み（いちばん粘る逃げ方より ' + (best - mine) + ' 手短い）'
          : lab + ' は、いちばん粘る逃げ方（' + (fl ? fl + ' から、' : '') + 'あと ' + d + ' 手で詰み）';
      }
      if (st.status[b.key] !== 'ok') st.status[b.key] = 'gave';
      from = k0 + 1;
    } else {
      from = st.k;
      var dd = P.study.states[from].turn === 0 ? P.solver.dist(st.states[from], Math.max(1, P.pz.n - from)) : P.solver.distAnd(st.states[from], Math.max(0, P.pz.n - from));
      msg = dd >= 0 ? 'ここから あと ' + dd + ' 手で詰みます' : '残りの手数では詰みません';
    }
    stPV(from, msg);
  }
  // from 手目の局面からの詰め手順（玉方はいちばん粘る手）を棋譜に足して、1手ずつ見せる
  function stPV(from, msg) {
    var st = P.study, s = st.states[from], left = Math.max(0, P.pz.n - from), add = [], guard = 0;
    while (guard++ < 24 && left > 0) {
      if (s.turn === 0) { var d = P.solver.dist(s, left); if (d < 0) break; var a = P.solver.matingMoves(s, d)[0]; if (!a) break; add.push(a); s = R.apply(P.V, s, a); left--; }
      else { if (!R.legalFrom(P.V, s, false).length) break; var r = P.solver.bestDefense(s, left); if (!r) break; add.push(r); s = R.apply(P.V, s, r); left--; }
    }
    st.line = st.line.slice(0, from).concat(add); st.msg = msg || ''; st.msgOk = true; st.ref = null; stRebuild();
    var j = 0; clearTimeout(st.pv);
    stGo(from);
    if (!add.length) return;
    (function tick() { if (!P.study || P.study !== st) return; j++; Snd.play('place'); stGo(from + j); if (j < add.length) st.pv = setTimeout(tick, 700); })();
  }
  function stSaveVar(line) {
    var st = P.study;
    var lab = kifuList(P.s0, line).join(' '), j;
    for (j = 0; j < st.vars.length; j++) if (st.vars[j].label === lab) return;
    st.vars.unshift({ line: line.slice(), label: lab.length > 60 ? lab.slice(0, 60) + '…' : lab });
    if (st.vars.length > 6) st.vars.pop();
  }
  function stMain() {
    var st = P.study; clearTimeout(st.pv); if (!isMain(st.line)) stSaveVar(st.line);
    st.line = st.main.slice(); st.msg = ''; st.ref = null; stRebuild(); stGo(Math.min(st.k, st.line.length));
  }


  // ===================== 詰将棋をつくる・じぶんの問題・共有 =====================
  var TC = HS.tsumeCode;
  var MINE_KEY = 'hensoku.mine';
  var mine = load(MINE_KEY, []);
  var E_RULES = ['an-S-9', 'an-N-9', 'an-E-9', 'an-W-9', 'honshogi'];
  var E_LENS = [1, 3, 5, 7, 9];
  var E_TOOLS = [1, 2, 3, 4, 5, 6, 7, 8];            // 歩 香 桂 銀 金 角 飛 玉
  // E: 作っている問題
  var E = { v: 'an-S-9', n: 3, b: new Array(81).fill(0), hand: {}, side: 0, tool: 5, prom: false, borrow: true, id: null, report: null, view: null, run: null, imported: false };
  function ruleName(v) { return TC.RULE_NAME[v] || v; }
  function eRows() {
    var rows = [];
    for (var y = 0; y < 9; y++) {
      var r = [];
      for (var x = 0; x < 9; x++) { var v = E.b[y * 9 + x]; r.push(!v ? '.' : (v < 0 ? 'v' : '') + (R.kind(v) === 8 ? (v < 0 ? '王' : '玉') : DEF[R.kind(v)].n)); }
      rows.push(r.join(' '));
    }
    return rows;
  }
  function ePuzzle() { var h = {}; Object.keys(E.hand).forEach(function (t) { if (E.hand[t]) h[t] = E.hand[t]; }); return { v: E.v, n: E.n, rows: eRows(), hand: h }; }
  function eLoad(pz, id) {
    E.v = pz.v; E.n = pz.n; E.b = HS.parseRows(pz.rows, 9, 9); E.hand = {}; Object.keys(pz.hand || {}).forEach(function (t) { E.hand[t] = pz.hand[t]; });
    E.id = id || null; E.report = null;
  }
  function eDirty() { E.report = null; if (E.run) { clearTimeout(E.run); E.run = null; } eRender(); }
  function openEditor(pz, id, imported) {
    if (pz) eLoad(pz, id);
    else { E.b = new Array(81).fill(0); E.hand = {}; E.id = null; E.report = null; E.b[1 * 9 + 7] = -8; }  // 新しい問題: 玉方の玉だけ（２二）
    E.imported = !!imported;
    show('edit');
    E.view = BoardView($('e-board'), { w: 9, h: 9, hands: false, files: true, ranks: true, extra: 250, onSquare: eTap });
    eRender();
  }
  function eRender() {
    var V = HS.VARIANTS[E.v];
    seg($('e-rule'), E_RULES.map(ruleName), E_RULES.indexOf(E.v), function (i) { E.v = E_RULES[i]; eDirty(); });
    seg($('e-len'), E_LENS.map(function (n) { return n + '手'; }), E_LENS.indexOf(E.n), function (i) { E.n = E_LENS[i]; eDirty(); });
    E.view.render({ b: E.b, hand: [[], []], turn: 0, last: null }, V, { showBorrow: E.borrow && !!V.an });
    // 駒のパレット
    var pal = $('e-pal'); pal.innerHTML = '';
    var sideB = document.createElement('button'); sideB.className = 'epb side' + (E.side ? ' gote' : '');
    sideB.textContent = E.side ? '☖ 玉方' : '☗ 攻め方';
    sideB.onclick = function () { E.side = 1 - E.side; Snd.play('select'); eRender(); };
    pal.appendChild(sideB);
    E_TOOLS.forEach(function (t) {
      var b = document.createElement('button'), pt = E.prom && DEF[t].prom ? DEF[t].prom : t, g = t === 8 || E.side === 1;
      b.className = 'epb' + (E.tool === t ? ' on' : '');
      b.innerHTML = '<span class="sg-pc ' + (g ? 'gote' : 'sente') + (DEF[pt].base ? ' prom' : '') + '">' + (t === 8 ? '王' : DEF[pt].n) + '</span>';
      b.onclick = function () { E.tool = t; Snd.play('select'); eRender(); };
      pal.appendChild(b);
    });
    var pr = document.createElement('button'); pr.className = 'epb txt' + (E.prom ? ' on' : ''); pr.textContent = '成';
    pr.onclick = function () { E.prom = !E.prom; Snd.play('select'); eRender(); };
    pal.appendChild(pr);
    var er = document.createElement('button'); er.className = 'epb txt' + (E.tool === 0 ? ' on' : ''); er.textContent = '消す';
    er.onclick = function () { E.tool = 0; Snd.play('select'); eRender(); };
    pal.appendChild(er);
    // 攻め方の持ち駒（タップで1枚ふやす・−で減らす）
    var hd = $('e-hand'); hd.innerHTML = '<span class="ehl">☗ 攻め方の持ち駒</span>';
    [7, 6, 5, 4, 3, 2, 1].forEach(function (t) {
      var c = E.hand[t] || 0, w = document.createElement('span'); w.className = 'ehc' + (c ? ' on' : '');
      var add = document.createElement('button'); add.className = 'eha'; add.innerHTML = DEF[t].n + (c ? '<b>' + c + '</b>' : '');
      add.onclick = function () { E.hand[t] = (E.hand[t] || 0) + 1; Snd.play('place'); eDirty(); };
      w.appendChild(add);
      if (c) { var sub = document.createElement('button'); sub.className = 'ehm'; sub.textContent = '−'; sub.onclick = function () { E.hand[t]--; Snd.play('select'); eDirty(); }; w.appendChild(sub); }
      hd.appendChild(w);
    });
    var bw = $('e-borrow'); bw.hidden = !V.an; bw.textContent = E.borrow ? '借りている動き：表示' : '借りている動き：かくす';
    $('e-title').textContent = E.id ? '問題を直す' : E.imported ? '読み込んだ問題' : '詰将棋をつくる';
    $('e-sub').textContent = ruleName(E.v) + '・' + E.n + '手詰め　玉方の持ち駒は残り全部';
    var st = $('e-state');
    st.className = 'estate' + (E.report ? (E.report.exact ? ' good' : ' bad') : '');
    st.textContent = E.report ? (E.report.exact ? '✓ 検証ずみ：' + E.n + '手で詰みます' : '✗ 検証で問題が見つかりました') : '駒を置いたら「検証」で、本当に詰むか確かめよう';
  }
  function eTap(i) {
    var cur = E.b[i];
    if (E.tool === 0) { if (!cur) return; E.b[i] = 0; Snd.play('select'); eDirty(); return; }
    var t = E.prom && DEF[E.tool].prom ? DEF[E.tool].prom : E.tool, v = E.tool === 8 ? -8 : (E.side ? -t : t);
    if (E.tool === 8) for (var k = 0; k < 81; k++) if (E.b[k] === -8 && k !== i) E.b[k] = 0;   // 玉は1枚だけ（置きなおす）
    E.b[i] = cur === v ? 0 : v;                                                              // 同じ駒をもう一度タップで消す
    Snd.play('place'); haptic('light'); eDirty();
  }
  // 検証（少しずつ進めて、進み具合を出す。25秒で時間切れ）
  function eVerify() {
    if (E.run) return;
    var pz = ePuzzle(), vf = new TC.Verifier(pz), t0 = Date.now(), LIMIT = 25000;
    $('ev-title').textContent = '検証しています…';
    $('ev-body').innerHTML = '<div class="evbar"><i id="ev-bar"></i></div><p class="evp" id="ev-p">王手の候補を調べています</p>';
    $('ev-btns').hidden = true;
    sheet('everify', true);
    function tick() {
      var t1 = Date.now();
      while (!vf.done && Date.now() - t1 < 40) vf.step();
      $('ev-bar').style.width = Math.round(vf.progress() * 100) + '%';
      $('ev-p').textContent = '王手の候補 ' + vf.k + ' / ' + vf.cands.length + ' を調べました';
      if (!vf.done && Date.now() - t0 > LIMIT) { E.run = null; eShowReport({ errors: [], timeout: true, n: E.n }); return; }
      if (!vf.done) { E.run = setTimeout(tick, 0); return; }
      E.run = null;
      var rep = vf.report(); rep.pz = pz; E.report = rep; eRender(); eShowReport(rep);
    }
    if (vf.done) { E.run = null; var rep = vf.report(); rep.pz = pz; E.report = rep; eRender(); eShowReport(rep); return; }
    E.run = setTimeout(tick, 30);
  }
  // 検証の結果（答えの手順は出さない）
  function eShowReport(r) {
    var items = [];
    function it(kind, text) { items.push('<li class="' + kind + '"><span>' + (kind === 'ok' ? '✓' : kind === 'ng' ? '✗' : kind === 'warn' ? '⚠' : 'ℹ') + '</span><div>' + text + '</div></li>'); }
    if (r.timeout) it('ng', '時間切れ。手数を短くするか、駒を減らしてみてください');
    r.errors.forEach(function (e) { it('ng', e); });
    if (!r.timeout && !r.errors.length) {
      if (!r.mates) it('ng', r.n + '手以内では詰みません');
      else if (!r.exact) it('ng', 'もっと短く <b>' + r.minLen + '手</b>で詰みます（' + r.n + '手詰めになっていません）');
      else it('ok', '<b>' + r.n + '手で詰みます</b>（玉方のどの逃げ方・合い駒でも）');
      if (r.mates) it(r.firstCount === 1 ? 'ok' : 'warn', r.firstCount === 1 ? '初手が1つに決まります' : '初手が <b>' + r.firstCount + ' 通り</b>あります（作品としては1つが理想）');
      if (r.exact) {
        it(r.yozume.length ? 'warn' : 'ok', r.yozume.length ? '余詰めがあります（' + r.yozume.join('・') + '手目に、ほかの手でも詰む）' : '余詰めなし（途中の攻め方の手も1つに決まる）');
        if (r.lastMulti) it('info', '最後の1手は、ほかの詰め方もあります');
        if (r.plainToo === true) it('info', 'ふつうの本将棋のルールでも同じ手数で詰みます（借りた動きを使わない問題）');
        if (r.plainToo === false) it('ok', '借りた動きを使わないと詰みません');
      }
    }
    var good = !!r.exact;
    $('ev-title').textContent = good ? (r.ok && !r.yozume.length ? '検証OK！' : '詰みます（注意あり）') : '詰将棋になっていません';
    $('ev-title').className = good ? 'win' : 'lose';
    $('ev-body').innerHTML = '<ul class="evl">' + items.join('') + '</ul>';
    $('ev-btns').hidden = false;
    $('ev-save').hidden = !good; $('ev-share').hidden = !good;
    Snd.play(good ? 'solved' : 'ng'); haptic(good ? 'goal' : 'ng');
  }
  function eSaveAndPlay() {
    var r = E.report; if (!r || !r.exact) return;
    var pz = r.pz, item = { id: E.id || 'u' + Date.now().toString(36), v: pz.v, n: pz.n, rows: pz.rows, hand: pz.hand, line: r.line, lastMulti: r.lastMulti, stars: Math.min(5, 1 + (pz.n >> 1)), custom: true, imported: E.imported, created: Date.now() };
    var k = mine.findIndex(function (q) { return q.id === item.id; });
    if (k >= 0) mine[k] = item; else mine.unshift(item);
    mine.forEach(function (q, j) { q.no = mine.length - j; });
    save(MINE_KEY, mine);
    E.id = item.id;
    sheet('everify', false);
    toast('じぶんの問題に保存しました');
    openPuzzle(mine.indexOf(item), mine);
  }
  // じぶんの問題の一覧
  function buildMine() {
    var host = $('m-list'); host.innerHTML = '';
    if (!mine.length) { host.innerHTML = '<p class="tnote">まだありません。「＋ 新しくつくる」で詰将棋を作るか、友だちのコードを読み込もう。</p>'; return; }
    mine.forEach(function (p, i) {
      var c = document.createElement('div'); c.className = 'mcard' + (solved[p.id] ? ' solved' : '');
      var d = new Date(p.created || 0);
      c.innerHTML = '<div class="mt"><b>' + ruleName(p.v) + '・' + p.n + '手詰め</b><small>' + (p.imported ? '📥 読み込んだ問題' : '✏️ 作った問題') + '　' + (d.getMonth() + 1) + '/' + d.getDate() + (solved[p.id] ? '　✓ 解いた' : '') + '</small></div>' +
        '<div class="mb"><button data-a="play">解く</button><button data-a="edit">直す</button><button data-a="share">📤 共有</button><button data-a="del">🗑</button></div>';
      c.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        Snd.init(); Snd.play('select');
        if (b.dataset.a === 'play') openPuzzle(i, mine);
        if (b.dataset.a === 'edit') openEditor(p, p.id, p.imported);
        if (b.dataset.a === 'share') openShare(p);
        if (b.dataset.a === 'del') askYes('この問題を消しますか？', '消す', function () { mine.splice(i, 1); save(MINE_KEY, mine); buildMine(); }, { danger: true });
      });
      host.appendChild(c);
    });
  }
  // コードで読み込む
  function doImport() {
    var txt = $('imp-text').value, err = $('imp-err');
    var pz;
    try { pz = TC.decode(txt); } catch (e) { err.textContent = e.message; Snd.play('ng'); return; }
    var c = TC.check(pz);
    if (c.errors.length) { err.textContent = '読み込めましたが、盤がおかしいです：' + c.errors[0]; Snd.play('ng'); return; }
    err.textContent = '';
    sheet('import', false);
    openEditor(pz, null, true);
    eVerify();
  }
  // ---- 共有（文章＋盤の画像） ----
  function shareText(pz, code) {
    return '変則詰将棋をつくったよ！ ' + ruleName(pz.v) + '・' + pz.n + '手詰め\n解けるかな？ 変則将棋アプリの「じぶんの問題 → コードで読み込む」に貼ると遊べます\n' + code;
  }
  // 盤の画像（PNG の data URL）
  function boardImage(pz) {
    var V = HS.VARIANTS[pz.v], b = HS.parseRows(pz.rows, 9, 9);
    var C = 70, X0 = 40, Y0 = 150, W = X0 * 2 + C * 9 + 26, H = Y0 + C * 9 + 150;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3a2414'); bg.addColorStop(1, '#22140a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff3dc'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 40px "Hiragino Mincho ProN", serif'; g.fillText('変則詰将棋', W / 2, 52);
    g.font = '800 28px "Hiragino Sans", sans-serif'; g.fillText(ruleName(pz.v) + '・' + pz.n + '手詰め', W / 2, 100);
    var wood = g.createLinearGradient(X0, Y0, X0 + C * 9, Y0 + C * 9); wood.addColorStop(0, '#f1cf8f'); wood.addColorStop(1, '#d9a95c');
    g.fillStyle = wood; g.fillRect(X0 - 8, Y0 - 8, C * 9 + 16, C * 9 + 16);
    g.strokeStyle = '#5a3a18'; g.lineWidth = 2;
    for (var k = 0; k <= 9; k++) { g.beginPath(); g.moveTo(X0 + k * C, Y0); g.lineTo(X0 + k * C, Y0 + C * 9); g.stroke(); g.beginPath(); g.moveTo(X0, Y0 + k * C); g.lineTo(X0 + C * 9, Y0 + k * C); g.stroke(); }
    g.fillStyle = '#fff3dc'; g.font = '700 18px "Hiragino Sans", sans-serif';
    for (k = 0; k < 9; k++) { g.fillText(String(9 - k), X0 + k * C + C / 2, Y0 - 22); g.fillText('一二三四五六七八九'[k], X0 + C * 9 + 22, Y0 + k * C + C / 2); }
    for (var i = 0; i < 81; i++) {
      var v = b[i]; if (!v) continue;
      var t = R.kind(v), ch = t === 8 ? (v < 0 ? '王' : '玉') : DEF[t].n, cx = X0 + (i % 9) * C + C / 2, cy = Y0 + ((i / 9) | 0) * C + C / 2;
      g.save(); g.translate(cx, cy); if (v < 0) g.rotate(Math.PI);
      g.beginPath(); g.moveTo(0, -C * 0.44); g.lineTo(C * 0.32, -C * 0.3); g.lineTo(C * 0.38, C * 0.42); g.lineTo(-C * 0.38, C * 0.42); g.lineTo(-C * 0.32, -C * 0.3); g.closePath();
      g.fillStyle = '#f8e2b4'; g.fill(); g.strokeStyle = '#8a5a2b'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = DEF[t].base ? '#c4161c' : '#1d120a'; g.font = '900 ' + Math.round(C * 0.5) + 'px "Hiragino Mincho ProN", serif'; g.fillText(ch, 0, C * 0.05);
      g.restore();
    }
    var hs = [7, 6, 5, 4, 3, 2, 1].filter(function (t) { return pz.hand[t]; }).map(function (t) { return DEF[t].n + (pz.hand[t] > 1 ? pz.hand[t] : ''); }).join(' ');
    g.fillStyle = '#fff3dc'; g.font = '800 24px "Hiragino Sans", sans-serif'; g.textAlign = 'left';
    g.fillText('☗ 攻め方の持ち駒：' + (hs || 'なし'), X0, Y0 + C * 9 + 46);
    g.font = '600 20px "Hiragino Sans", sans-serif'; g.globalAlpha = .75;
    g.fillText('☖ 玉方の持ち駒：残り全部', X0, Y0 + C * 9 + 84);
    g.textAlign = 'right'; g.fillText('変則将棋', W - 24, H - 24);
    return cv.toDataURL('image/png');
  }
  var shareNow = null;
  function openShare(pz) {
    var code = TC.encode(pz), text = shareText(pz, code), img = boardImage(pz);
    shareNow = { text: text, image: img, code: code };
    $('sh-img').src = img;
    $('sh-text').textContent = text;
    sheet('shareprev', true);
  }
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }
  // iOS アプリの中なら共有シート（アプリ側の share）。ブラウザなら navigator.share、だめならコピー
  function doShare() {
    var s = shareNow; if (!s) return;
    var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.share;
    if (h) { try { h.postMessage({ text: s.text, image: s.image }); return 'app'; } catch (e) {} }
    if (navigator.share) { navigator.share({ text: s.text }).catch(function () {}); return 'web'; }
    toast(copyText(s.text) ? '文章とコードをコピーしました' : 'コピーできませんでした');
    return 'copy';
  }

  // ===================== 特殊効果将棋のカード =====================
  var FX_PROMPT = { narikomi: '⭐ 成らせる駒をタップ', irekae: '🔁 入れ替える自分の駒をタップ', jirai: '💣 地雷をしかける空きマスをタップ' };
  // カードを表にして見せるか
  function fxFace(p, s) {
    var fx = s.fx;
    if (fx.show || fx.seen[1 - p]) return true;
    if (G.mode === 'local') return p === s.turn && G.peek && !G.done;
    return p === G.human || G.done;
  }
  function renderFx(s, interactive) {
    var X = HS.effects, fx = s.fx, flip = flipView(), topP = flip ? 0 : 1, botP = 1 - topP, names = sideNames();
    var acts = interactive ? X.actions(G.ad.V, s) : [];
    function row(host, p) {
      var html = '<span class="who">' + (p === 0 ? '☗' : '☖') + ' ' + names[p] + '</span>';
      fx.cards[p].forEach(function (c) {
        var used = fx.used[p].indexOf(c) >= 0, up = used || fxFace(p, s), C = X.CARDS[c];
        if (!up) { html += '<span class="fxc back"><b>？</b><small>ふせたカード</small></span>'; return; }
        var usable = p === s.turn && acts.some(function (a) { return a.fx === c; });
        var mineTurn = p === s.turn && interactive && !G.done;
        var why = mineTurn && !used && !usable ? X.whyNot(G.ad.V, s, c) : '';
        var selNow = G.fxSel && G.fxSel.c === c && p === s.turn;
        html += '<div class="fxc' + (used ? ' used' : '') + (usable ? ' ok' : '') + (selNow ? ' sel' : '') + '">' +
          '<b>' + C.emoji + ' ' + C.name + (used ? '<em class="usedtag">使用済み</em>' : '<em class="newtag">未使用</em>') + '</b><small>' + C.desc + '</small>' +
          (mineTurn && !used ? (selNow ? '<button class="fxuse cancel" data-x="1">✕ キャンセル</button>'
            : '<button class="fxuse" data-c="' + c + '"' + (usable ? '' : ' disabled') + '>' + C.emoji + ' 使う</button>' + (why ? '<span class="fxwhy">' + why + '</span>' : '')) : '') +
          '</div>';
      });
      if (G.mode === 'local' && !fx.show && p === s.turn && !G.peek && !G.done) html += '<button class="peek">👁 カードを見る</button>';
      var tags = [];
      if (fx.seal[p] > 0) tags.push('🔒 あと' + fx.seal[p] + '回 打てない');
      if (fx.noCheck === p) tags.push('🛡 この番は王手できない');
      if (fx.nite && s.turn === p) tags.push('⏩ 二手指し ' + fx.nite + '手目' + (fx.nite === 2 ? '（別の駒で）' : ''));
      if (fx.mine[p] >= 0) tags.push('💣 地雷をしかけ中');
      if (tags.length) html += '<span class="fxtag">' + tags.join('<br>') + '</span>';
      host.innerHTML = html;
      host.classList.toggle('mover', p === s.turn && !G.done);
      host.querySelectorAll('.fxuse[data-c]').forEach(function (el) {
        el.addEventListener('click', function () { if (!interactive || el.disabled) return; onFxCard(el.dataset.c); });
      });
      host.querySelectorAll('.fxuse[data-x]').forEach(function (el) {
        el.addEventListener('click', function () { G.fxSel = null; Snd.play('select'); refresh(); });
      });
      var pk = host.querySelector('.peek'); if (pk) pk.addEventListener('click', function () { G.peek = true; Snd.play('select'); refresh(); });
    }
    row($('g-fxopp'), topP); row($('g-fx'), botP);
  }
  // 盤に出す地雷（しかけた本人にだけ見える。2人で1台では出さない）
  function mineView(s) {
    var out = null;
    for (var p = 0; p < 2; p++) {
      var q = s.fx.mine[p];
      if (q < 0 || G.mode === 'local') continue;
      if (p === G.human || G.done) { out = out || {}; out[q] = true; }
    }
    return out;
  }
  function fxActs(s, c) { return HS.effects.actions(G.ad.V, s).filter(function (a) { return a.fx === c; }); }
  // カードの対象にできるマス
  function fxTargets(s) {
    if (!G.fxSel) return null;
    var acts = fxActs(s, G.fxSel.c), out = {};
    acts.forEach(function (a) {
      if (a.sq !== undefined) out[a.sq] = true;
      else if (G.fxSel.a < 0) { out[a.a] = true; out[a.b] = true; }
      else if (a.a === G.fxSel.a) out[a.b] = true;
      else if (a.b === G.fxSel.a) out[a.a] = true;
    });
    if (G.fxSel.a >= 0) out[G.fxSel.a] = true;
    return out;
  }
  function fxTap(i) {
    var s = curS(), c = G.fxSel.c, acts = fxActs(s, c), hit;
    if (c === 'narikomi' || c === 'jirai') {
      hit = acts.filter(function (a) { return a.sq === i; })[0];
      if (!hit) { Snd.play('ng'); toast(c === 'jirai' ? '空いているマスをえらんでね' : 'その駒は成らせられません'); return; }
      if (c === 'jirai') { askYes('ここに地雷をしかけますか？', 'しかける', function () { doMove(hit); }); return; }
      doMove(hit); return;
    }
    // 入れ替え
    if (G.fxSel.a < 0) {
      if (!acts.some(function (a) { return a.a === i || a.b === i; })) { Snd.play('ng'); toast('その駒は入れ替えられません'); return; }
      G.fxSel.a = i; Snd.play('select'); haptic('light'); refresh(); return;
    }
    if (i === G.fxSel.a) { G.fxSel.a = -1; refresh(); return; }
    var A = G.fxSel.a;
    hit = acts.filter(function (a) { return (a.a === A && a.b === i) || (a.a === i && a.b === A); })[0];
    if (!hit) { Snd.play('ng'); toast('その2枚は入れ替えられません（王手・二歩などになる）'); return; }
    doMove(hit);
  }
  function onFxCard(c) {
    var s = curS(), acts = fxActs(s, c), C = HS.effects.CARDS[c];
    if (G.fxSel && G.fxSel.c === c) { G.fxSel = null; Snd.play('select'); refresh(); return; }
    if (!acts.length) { Snd.play('ng'); toast('使えません：' + HS.effects.whyNot(G.ad.V, s, c)); return; }
    var next = c === 'narikomi' || c === 'irekae' || c === 'jirai' ? '使うと、盤のマスをえらびます（とちゅうでキャンセルもできます）' :
      c === 'migawari' ? '使うと、取りもどす駒をえらびます' : c === 'nite' ? 'このあと2手続けて指します' : '1局に1回だけ。使うとなくなります';
    askYes(C.emoji + ' ' + C.name + 'を使いますか？', '使う', function () {
      if (c === 'narikomi' || c === 'irekae' || c === 'jirai') { G.fxSel = { c: c, a: -1 }; G.sel = null; G.selHand = null; Snd.play('select'); haptic('light'); refresh(); return; }
      if (c === 'migawari') {
        chooseFrom('🪆 身代わり：どの駒を取りもどす？', acts.map(function (a) { return { label: DEF[a.d].n, v: a }; }), function (a) { doMove(a); });
        return;
      }
      doMove(acts[0]);
      if (c === 'nite') toast('⏩ 二手指し：2手は別々の駒で。駒を取る手・王手になる手はだめ', 3200);
    }, { sub: C.desc + '\n' + next });
  }
  // かんたんな「えらんでね」画面
  function chooseFrom(title, items, cb) {
    var old = document.querySelector('.chooser'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'chooser';
    box.innerHTML = '<div class="box"><p>' + title + '</p><div class="opts"></div><button class="btn ghost cx">やめる</button></div>';
    items.forEach(function (it) {
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = it.label;
      b.onclick = function () { box.remove(); cb(it.v); };
      box.querySelector('.opts').appendChild(b);
    });
    box.querySelector('.cx').onclick = function () { box.remove(); };
    document.body.appendChild(box);
  }

  // ===================== オンライン対戦 =====================
  // 設定（Supabase の URL と、公開してよい publishable キー）は config.js。ないときはオンラインだけ「準備中」
  var NETCFG = window.SHOGI_CONFIG || window.DUEL_CONFIG || null;
  var APP_STORE_URL = '';      // TODO: 変則将棋を App Store に出したら、ここに URL を入れる（ブラウザ版の「アプリが遊びやすいよ」にボタンが出る）
  var INVITE_BASE = 'https://imaimaha.github.io/shogi/';
  var ON = { client: null, ch: null, net: null, code: null, host: false, oppHere: false, joinTimer: null, cfgPending: null, clk: null, turnStart: 0, tick: null, lowBeep: -1, claimAt: 0, claimed: false, pick: false };
  var CLOCK = ShogiNet.Clock;
  function onlineReady() { return typeof supabase !== 'undefined' && NETCFG && NETCFG.SUPABASE_URL && NETCFG.SUPABASE_ANON_KEY; }
  var clientId = (function () { var id = load('hensoku.cid', null); if (!id) { id = ShogiNet.rid(); save('hensoku.cid', id); } return id; })();
  function inviteURL(code) { return INVITE_BASE + '?room=' + code; }

  // ---- 部屋をつくるときの設定（ルールのシートに、持ち時間と「部屋をつくる」を出す） ----
  var CLOCK_KINDS = [{ k: 'none', t: 'なし' }, { k: 'kire', t: '切れ負け' }, { k: 'byo', t: '持ち時間＋秒読み' }, { k: 'byoonly', t: '秒読みだけ' }, { k: 'fischer', t: 'フィッシャー' }];
  function clockKind(c) { return c.kind === 'byo' && !c.main ? 'byoonly' : c.kind; }
  function setClock(c) { setupSel.clock = c; save('hensoku.clock', c); }
  function askNumber(msg, def, min, max) {
    var v = prompt(msg, String(def)); if (v === null) return null;
    v = parseInt(String(v).replace(/[０-９]/g, function (d) { return '０１２３４５６７８９'.indexOf(d); }), 10);
    if (isNaN(v) || v < min || v > max) { toast(min + '〜' + max + ' の数で入れてね'); return null; }
    return v;
  }
  function setupOnlineParts(id) {
    var pick = ON.pick;
    $('su-cpu').hidden = pick; $('su-local').hidden = pick; $('su-room').hidden = !pick;
    $('su-level').hidden = pick; $('su-level').previousElementSibling.hidden = pick;
    $('su-first').hidden = pick; $('su-first-lab').hidden = pick; $('su-stats').hidden = pick;
    $('su-clock-wrap').hidden = !pick;
    if (!pick) return;
    var c = setupSel.clock, kind = clockKind(c);
    seg($('su-clock'), CLOCK_KINDS.map(function (x) { return x.t; }), CLOCK_KINDS.map(function (x) { return x.k; }).indexOf(kind), function (i) {
      var k = CLOCK_KINDS[i].k, n = { kind: 'none', main: c.main || 600, byo: c.byo || 30, inc: c.inc || 5 };
      if (k === 'kire') { n.kind = 'kire'; if (!n.main) n.main = 600; }
      else if (k === 'byo') { n.kind = 'byo'; if (!n.main) n.main = 600; }
      else if (k === 'byoonly') { n.kind = 'byo'; n.main = 0; }
      else if (k === 'fischer') { n.kind = 'fischer'; if (!n.main) n.main = 180; }
      setClock(n); openSetup(id);
    });
    var c2 = $('su-clock2'), c3 = $('su-clock3'); c2.hidden = kind === 'none'; c3.hidden = kind !== 'byo';
    var MAINS = [60, 180, 300, 600, 900, 1800, 3600], BYOS = [10, 20, 30, 60], FISCH = [[60, 5], [180, 2], [300, 5], [600, 10]];
    function mainSeg(host) {
      var labels = MAINS.map(function (m) { return (m / 60) + '分'; }).concat(['ほか']);
      var cur = MAINS.indexOf(c.main); if (cur < 0) cur = labels.length - 1;
      seg(host, labels, cur, function (i) {
        var n = JSON.parse(JSON.stringify(c));
        if (i < MAINS.length) n.main = MAINS[i]; else { var v = askNumber('持ち時間（分）', Math.round(c.main / 60) || 10, 1, 180); if (v === null) return; n.main = v * 60; }
        setClock(n); openSetup(id);
      });
    }
    function byoSeg(host) {
      var labels = BYOS.map(function (b) { return b + '秒'; });
      seg(host, labels, BYOS.indexOf(c.byo), function (i) { var n = JSON.parse(JSON.stringify(c)); n.byo = BYOS[i]; setClock(n); openSetup(id); });
    }
    if (kind === 'kire') mainSeg(c2);
    else if (kind === 'byo') { mainSeg(c2); byoSeg(c3); }
    else if (kind === 'byoonly') byoSeg(c2);
    else if (kind === 'fischer') {
      var fl = FISCH.map(function (f) { return (f[0] / 60) + '分＋' + f[1] + '秒'; }).concat(['ほか']), fc = -1;
      FISCH.forEach(function (f, i) { if (f[0] === c.main && f[1] === c.inc) fc = i; }); if (fc < 0) fc = fl.length - 1;
      seg(c2, fl, fc, function (i) {
        var n = JSON.parse(JSON.stringify(c));
        if (i < FISCH.length) { n.main = FISCH[i][0]; n.inc = FISCH[i][1]; }
        else { var mv = askNumber('持ち時間（分）', Math.round(c.main / 60) || 3, 1, 180); if (mv === null) return; var iv = askNumber('1手ごとに増える秒数', c.inc || 5, 1, 120); if (iv === null) return; n.main = mv * 60; n.inc = iv; }
        setClock(n); openSetup(id);
      });
    }
    $('su-clock-note').textContent = CLOCK.label(setupSel.clock);
  }

  // ---- 画面 ----
  function showOnline(msg) {
    $('on-msg').textContent = msg || (onlineReady() ? '' : 'オンライン対戦は準備中です（通信の設定がありません）');
    var sv = load('hensoku.onlineCur', null);
    $('on-resume').hidden = !(sv && !sv.end && sv.code && Date.now() - (sv.at || 0) < 24 * 3600 * 1000);
    if (sv) $('on-resume').textContent = '▶ つづきから（部屋 ' + sv.code + '・' + sv.moves.length + '手まで）';
    $('on-back').hidden = WEB;
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic);
    $('on-appbanner').hidden = !(WEB && ios && !load('hensoku.bannerX', false));
    $('on-appstore').hidden = !APP_STORE_URL; if (APP_STORE_URL) $('on-appstore').href = APP_STORE_URL;
    show('online');
  }
  function roomStatus(t, bad) { var el = $('rm-status'); el.textContent = t; el.className = 'status' + (bad ? ' warn' : ''); }
  function openRoomSheet(code, host) {
    $('rm-title').textContent = host ? '部屋をつくりました' : '部屋に入ります';
    $('rm-code').textContent = code;
    $('rm-host').hidden = !host; $('rm-share').hidden = !host; $('rm-copy').hidden = !host;
    $('rm-link').textContent = inviteURL(code);
    if (host) { try { QR.draw($('rm-qr'), inviteURL(code), 5); } catch (e) {} }
    var c = ON.cfgPending;
    $('rm-rule').textContent = host && c ? menuInfo(c.menuId).title + (c.menuId !== c.rid && HS.VARIANTS[c.rid] ? '（' + HS.VARIANTS[c.rid].title + '）' : '') + '・' + CLOCK.label(c.clock) : '';
    roomStatus(host ? '相手を待っています…（招待リンクかコードを送ってね）' : 'つないでいます…');
    sheet('room', true);
  }
  function inviteText(code) { return '変則将棋で対戦しよう！\n部屋のコード：' + code + '\n' + inviteURL(code); }
  function sendInvite() {
    var code = ON.code; if (!code) return;
    var text = inviteText(code), h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.share;
    if (h) { h.postMessage({ text: text }); return; }
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
    toast(copyText(text) ? '招待の文をコピーしました' : 'コピーできませんでした');
  }

  // ---- つなぐ ----
  function openRoom(code, host, saved) {
    if (!onlineReady()) { showOnline('オンライン対戦は準備中です（通信の設定がありません）'); return false; }
    closeRoom();
    ON.code = code; ON.host = host; ON.oppHere = false;
    ON.client = ON.client || supabase.createClient(NETCFG.SUPABASE_URL, NETCFG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    var ch = ON.client.channel('hensoku-' + code, { config: { broadcast: { self: false }, presence: { key: clientId } } });
    ON.ch = ch;
    var net = ON.net = ShogiNet.create({ me: host ? 0 : 1, send: function (m) { ch.send({ type: 'broadcast', event: 'm', payload: m }); }, on: onNet });
    if (saved) net.restore(saved);
    ch.on('broadcast', { event: 'm' }, function (msg) { if (ON.ch === ch && ON.net) ON.net.handle(msg.payload); });
    ch.on('presence', { event: 'sync' }, function () {
      if (ON.ch !== ch) return;
      var keys = Object.keys(ch.presenceState()), others = keys.filter(function (k) { return k !== clientId; });
      if (others.length >= 2 && !net.started) { roomStatus('この部屋はもう満員です', true); closeRoom(); return; }
      var here = others.length > 0;
      if (here && !ON.oppHere) {
        ON.oppHere = true;
        roomStatus('相手が来た！');
        if (host && !net.started) net.start(ON.cfgPending); else net.hello();
        if (G.mode === 'online') { toast('相手とつながりました'); refresh(); }
      } else if (!here && ON.oppHere) {
        ON.oppHere = false;
        if (G.mode === 'online' && !G.done) { toast('相手の接続が切れました。もどってくるのを待っています…', 3200); refresh(); }
      }
    });
    ch.subscribe(function (status) {
      if (ON.ch !== ch) return;
      if (status === 'SUBSCRIBED') { ch.track({ at: Date.now() }); net.hello(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { roomStatus('つながりませんでした。電波を確かめてね', true); if (G.mode === 'online') toast('通信が切れました。つなぎ直しています…'); }
    });
    // 届かなかった手や「投了」なども、ときどきの hello でそろえ直す
    clearInterval(ON.hb); ON.hb = setInterval(function () { if (ON.net === net && ON.oppHere) net.hello(); }, 5000);
    clearTimeout(ON.joinTimer);
    if (!host && !saved) ON.joinTimer = setTimeout(function () {
      if (ON.net === net && !net.started) { closeRoom(); sheet('room', false); showOnline('部屋が見つかりませんでした。コードを確かめて、相手が「部屋をつくる」を押しているか見てね'); }
    }, 15000);
    return true;
  }
  function closeRoom() {
    clearTimeout(ON.joinTimer); clearInterval(ON.hb);
    if (ON.ch && ON.client) { try { ON.client.removeChannel(ON.ch); } catch (e) {} }
    ON.ch = null; ON.net = null; ON.oppHere = false;
  }
  function leaveOnline() {
    stopTick(); closeRoom(); sheet('room', false); sheet('result', false);
    save('hensoku.onlineCur', null);
    if (G.mode === 'online') { G.mode = null; G.done = true; }
    document.body.classList.remove('online');
    ON.code = null;
  }
  function createRoom(id) {
    var rid = realId(id), code = ShogiNet.newCode(6);
    ON.cfgPending = { menuId: id, rid: rid, opt: { all: setupSel.all, H: setupSel.H, fxN: setupSel.fxN, fxShow: setupSel.fxShow }, seed: (Math.random() * 2147483647) | 0, host: Math.random() < 0.5 ? 0 : 1, clock: JSON.parse(JSON.stringify(setupSel.clock)) };
    sheet('setup', false);
    if (!openRoom(code, true)) return;
    showOnline(); openRoomSheet(code, true);
  }
  function joinRoom(code) {
    code = ShogiNet.normCode(code);
    if (code.length !== 6) { toast('6文字のコードを入れてね'); return; }
    ON.cfgPending = null;
    if (!openRoom(code, false)) return;
    showOnline(); openRoomSheet(code, false);
  }
  function resumeOnline() {
    var sv = load('hensoku.onlineCur', null); if (!sv) return;
    ON.cfgPending = sv.cfg;
    if (!openRoom(sv.code, sv.host, { cfg: sv.cfg, gid: sv.gid, moves: sv.moves, clk: sv.clk })) return;
    ON.net.hello();
    beginOnline(sv.cfg, sv.moves, sv.clk, null);
    toast('つなぎ直しています…');
  }
  function saveOnlineCur() {
    if (!ON.net || !G.cfg) return;
    save('hensoku.onlineCur', { code: ON.code, host: ON.host, cfg: G.cfg, gid: ON.net.gid, moves: G.moves.slice(), clk: ON.clk, at: Date.now(), end: G.done ? (load('hensoku.onlineCur', {}) || {}).end || true : null });
  }

  // ---- 相手からのできごと ----
  function onNet(ev) {
    if (ev.t === 'start') { clearTimeout(ON.joinTimer); beginOnline(ev.cfg, [], null, null); return; }
    if (ev.t === 'state') { clearTimeout(ON.joinTimer); beginOnline(ev.cfg, ev.moves, ev.clk, ev.end); return; }
    if (ev.t === 'version') { toast('相手のアプリのバージョンがちがいます。新しくしてね', 3000); return; }
    if (G.mode !== 'online' || !G.ad) return;
    if (ev.t === 'move') { onlineIncoming(ev); return; }
    if (G.done && ev.t !== 'again' && ev.t !== 'draw') return;
    if (ev.t === 'resign') { G.done = true; refresh(); finish({ winner: G.human, text: '相手が投了' }); return; }
    if (ev.t === 'flag') { G.done = true; refresh(); finish({ winner: G.human, text: '相手の時間切れ' }); return; }
    if (ev.t === 'claim') { checkMyFlag(); return; }
    if (ev.t === 'draw') {
      // 引き分けの申し出はなくした（古い版から届いたら、だまって断る）
      if (ev.a === 'offer' && !G.done) ON.net.draw('no');
      return;
    }
    if (ev.t === 'again') { if (ON.host) hostRematch(); else toast('相手が「もう一局」を押しました。あなたも押すと始まります', 2600); }
  }
  function hostRematch() {
    var c = JSON.parse(JSON.stringify(G.cfg || ON.cfgPending));
    c.host = 1 - c.host; c.seed = (Math.random() * 2147483647) | 0;
    ON.cfgPending = c; ON.net.start(c);
  }
  // 対局を作る（はじめから / とちゅうから）
  function beginOnline(cfg, moves, clk, end) {
    sheet('room', false); sheet('result', false); sheet('setup', false);
    var old = document.querySelector('.handover'); if (old) old.remove();
    clearTimeout(G.timer);
    G.menuId = cfg.menuId; G.rid = cfg.rid; G.cfg = cfg;
    G.ad = adapterFor(cfg.rid, { all: cfg.opt.all, H: cfg.opt.H, fxN: cfg.opt.fxN, fxShow: cfg.opt.fxShow, seed: cfg.seed });
    G.mode = 'online'; G.level = 1; G.human = ON.net ? ON.net.mySide() : 0;
    G.hist = [G.ad.init()]; G.moves = []; G.busy = false; G.done = false; G.sel = null; G.selHand = null; G.peek = false; G.selCard = 0; G.fxSel = null;
    for (var i = 0; i < moves.length; i++) {
      var n; try { n = G.ad.play(curS(), moves[i]); } catch (e) { toast('棋譜が合いませんでした。つなぎ直します'); if (ON.net) ON.net.reject(); break; }
      G.moves.push(moves[i]); G.hist.push(n);
    }
    ON.clk = clk ? JSON.parse(JSON.stringify(clk)) : CLOCK.init(cfg.clock);
    ON.turnStart = Date.now(); ON.claimAt = 0; ON.claimed = false; ON.lowBeep = -1; ON.frozen = false;
    setupGameView(); show('game'); refresh();
    saveOnlineCur();
    if (end) { G.done = true; refresh(); finish(end.winner !== undefined ? end : endToResult(end)); return; }
    var o = G.ad.over(curS()) || G.ad.rep(G.hist);
    if (o) { G.done = true; refresh(); finish(o); return; }
    startTick();
    if (!moves.length) toast(G.human === 0 ? 'あなたは先手（☗）です' : 'あなたは後手（☖）です', 2200);
  }
  function endToResult(e) {
    var me = G.human;
    if (e.t === 'resign') return { winner: 1 - e.by, text: (e.by === me ? 'あなた' : '相手') + 'が投了' };
    if (e.t === 'flag') return { winner: 1 - e.by, text: (e.by === me ? 'あなた' : '相手') + 'の時間切れ' };
    return { winner: -1, text: '合意の引き分け' };
  }
  // 自分が指した: 時計を止めて、送る
  function onlineSend(m, n) {
    var me = G.human, c = G.cfg.clock, spent = Date.now() - ON.turnStart;
    // 同じ人の番が続く（特殊効果カードを使った・二手指しの1手目）ときは、秒読みをもどさない
    ON.clk[me] = n.turn === me ? CLOCK.run(c, ON.clk[me], spent) : CLOCK.afterMove(c, ON.clk[me], spent);
    delete ON.clk[me].flag;
    ON.turnStart = Date.now(); ON.lowBeep = -1;
    ON.net.move(m, ON.clk);
  }
  // 相手が指した
  function onlineIncoming(ev) {
    var s = curS(), n;
    if (G.done) return;
    if (G.ad.turn(s) === G.human) { ON.net.reject(); return; }
    try { n = G.ad.play(s, ev.m); } catch (e) { ON.net.reject(); return; }
    ON.net.accept(ev.m, ev.clk);
    var op = 1 - G.human;
    if (ev.clk && ev.clk[op]) ON.clk[op] = ev.clk[op];
    ON.turnStart = Date.now(); ON.claimAt = 0; ON.claimed = false;
    G.moves.push(ev.m);
    commit(n);
  }

  // ---- 時計 ----
  function clockNow(p) {
    var c = G.cfg && G.cfg.clock, st = ON.clk && ON.clk[p];
    if (!st) return { main: 0, byo: 0, inByo: false };
    if (G.done || G.ad.turn(curS()) !== p) return st;
    return CLOCK.run(c, st, Date.now() - ON.turnStart);
  }
  function paintClocks() {
    var c = G.cfg && G.cfg.clock;
    for (var p = 0; p < 2; p++) {
      var el = $('pl' + p).querySelector('.sc');
      if (!c || c.kind === 'none') { el.textContent = ''; el.classList.remove('clk', 'low'); continue; }
      var v = clockNow(p);
      el.textContent = '⏱ ' + CLOCK.text(c, v); el.classList.add('clk'); el.classList.toggle('low', CLOCK.low(c, v) && !G.done);
    }
  }
  function startTick() { stopTick(); ON.tick = setInterval(tickOnline, 250); }
  function stopTick() { if (ON.tick) { clearInterval(ON.tick); ON.tick = null; } }
  function tickOnline() {
    if (G.mode !== 'online' || !G.cfg || G.done) { stopTick(); return; }
    var c = G.cfg.clock; if (!c || c.kind === 'none') return;
    paintClocks();
    var mover = G.ad.turn(curS()), v = clockNow(mover);
    if (mover === G.human) {
      if (v.flag) { G.done = true; ON.net.flag(); refresh(); finish({ winner: 1 - G.human, text: 'あなたの時間切れ' }); return; }
      if (CLOCK.low(c, v)) {
        var sec = Math.ceil((v.inByo ? v.byo : v.main) / 1000);
        if (sec !== ON.lowBeep) { var first = ON.lowBeep === -1; ON.lowBeep = sec; Snd.play('tick'); if (first) haptic('warning'); else if (sec <= 3) haptic('light'); }
      }
    } else if (v.flag) {
      // 相手の時間が切れているはず: 少し待ってから確かめてもらう。相手がいないまま12秒たてば勝ち
      if (!ON.claimAt) ON.claimAt = Date.now();
      var waited = Date.now() - ON.claimAt;
      if (!ON.claimed && waited > 1500 + (ON.net ? ON.net.lat : 0)) { ON.claimed = true; ON.net.claim(); }
      if (ON.claimed && waited > 12000 && !ON.oppHere) { G.done = true; refresh(); finish({ winner: G.human, text: '相手の時間切れ（接続なし）' }); }
    }
  }
  // 相手に「時間が切れていない？」と聞かれた
  function checkMyFlag() {
    if (G.done || G.ad.turn(curS()) !== G.human) return;
    var v = clockNow(G.human);
    if (v.flag || (!v.inByo && v.main < 1000 && !(G.cfg.clock.kind === 'byo' && G.cfg.clock.byo))) { G.done = true; ON.net.flag(); refresh(); finish({ winner: 1 - G.human, text: 'あなたの時間切れ' }); }
  }
  // 引き分けの申し出は、画面からはなくした（テスト用に関数だけ残す）
  function offerDraw() {
    if (G.done) return;
    ON.net.draw('offer');
  }

  // ===================== ボタン =====================
  function bind() {
    $('go-play').addEventListener('click', function () { Snd.init(); Snd.play('select'); buildVariants(); show('variants'); });
    $('go-tsume').addEventListener('click', function () { Snd.init(); Snd.play('select'); buildTsume(); show('tsume'); });
    document.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { homeInfo(); show(b.dataset.back); }); });
    $('su-close').addEventListener('click', function () { sheet('setup', false); });
    $('setup').addEventListener('click', function (e) { if (e.target.id === 'setup') sheet('setup', false); });
    $('su-cpu').addEventListener('click', function () { Snd.init(); startGame(G.setupId, 'cpu'); });
    $('su-local').addEventListener('click', function () { Snd.init(); startGame(G.setupId, 'local'); });
    $('g-back').addEventListener('click', function () {
      if (G.mode === 'online') {
        var leave = function () { if (!G.done && ON.net) ON.net.resign(); leaveOnline(); showOnline(); };
        if (G.done) leave(); else askYes('オンライン対戦をやめますか？', 'やめる（投了）', leave, { danger: true, sub: '対局中なので、投了になります' });
        return;
      }
      clearTimeout(G.timer); G.busy = false; sheet('result', false); buildVariants(); show('variants');
    });
    $('g-undo').addEventListener('click', undo);
    $('g-resign').addEventListener('click', resign);
    $('g-again').addEventListener('click', function () { if (G.mode === 'online') return; askYes('はじめからやりなおしますか？', 'はじめから', function () { startGame(G.menuId, G.mode); }); });
    $('r-again').addEventListener('click', function () {
      if (G.mode === 'online') { if (!ON.net || !ON.oppHere) { toast('相手がいないので、もう一局はできません'); return; } if (ON.host) hostRematch(); else { ON.net.again(); toast('相手に「もう一局」を送りました'); } return; }
      startGame(G.menuId, G.mode);
    });
    $('r-menu').addEventListener('click', function () { sheet('result', false); if (G.mode === 'online') { leaveOnline(); showOnline(); return; } buildVariants(); show('variants'); });
    $('r-copy').addEventListener('click', function () { var r = G.lastRec; if (r) toast(copyText(kifuText(r)) ? '棋譜をコピーしました' : 'コピーできませんでした'); });
    $('r-undo').addEventListener('click', undo);
    $('r-board').addEventListener('click', function () { sheet('result', false); });
    $('r-kifu').addEventListener('click', function () { sheet('result', false); var r = G.lastRec || loadRecords()[0]; if (r) openReplay(r, true); });
    $('v-records').addEventListener('click', function () { Snd.init(); Snd.play('select'); buildRecords(); show('records'); });
    $('rec-back').addEventListener('click', function () { buildVariants(); show('variants'); });
    $('rec-clear').addEventListener('click', function () { askYes('対局の記録を、ぜんぶけしますか？', 'ぜんぶけす', function () { save(REC_KEY, []); buildRecords(); }, { danger: true }); });
    $('rp-back').addEventListener('click', function () { rpStop(); if (WEB) { showOnline(); return; } buildRecords(); show('records'); });
    $('rp-first').addEventListener('click', function () { rpStop(); rpGo(0); });
    $('rp-prev').addEventListener('click', function () { rpStop(); rpGo(RP.k - 1); });
    $('rp-next').addEventListener('click', function () { rpStop(); rpGo(RP.k + 1); });
    $('rp-last').addEventListener('click', function () { rpStop(); rpGo(RP.states.length - 1); });
    $('rp-auto').addEventListener('click', rpAuto);
    $('rp-flip').addEventListener('click', function () { RP.flip = !RP.flip; Snd.play('select'); rpRender(); });
    $('rp-try').addEventListener('click', function () { rpStop(); tryFrom(); });
    $('p-back').addEventListener('click', function () { sheet('pres', false); if (P.mine) { buildMine(); show('mine'); } else { buildTsume(); show('tsume'); } });
    $('p-hint').addEventListener('click', function () { if (P.done || P.busy) return; if (selfDef()) { toast('玉方の番です'); return; } P.hint = Math.min(2, P.hint + 1); Snd.play('select'); pRender(); });
    $('p-retry').addEventListener('click', function () { Snd.play('select'); pReset(); });
    $('p-undo').addEventListener('click', pUndo);
    $('p-answer').addEventListener('click', function () { askYes('答えを見ますか？', '答えを見る', function () { Snd.play('select'); pAnswer(); }); });
    $('p-disp').addEventListener('click', function () { Snd.play('select'); openDisp(); });
    $('pd-close').addEventListener('click', function () { sheet('pdisp', false); });
    $('pdisp').addEventListener('click', function (e) { if (e.target.id === 'pdisp') sheet('pdisp', false); });
    $('p-prev').addEventListener('click', function () { pStep(P.play.k - 1); });
    $('p-nextstep').addEventListener('click', function () { pStep(P.play.k + 1); });
    $('p-close').addEventListener('click', function () { pReset(); });
    $('pres-replay').addEventListener('click', function () { Snd.play('select'); pAnswer(); });
    $('pres-study').addEventListener('click', function () { Snd.play('select'); var v = P.verdict; stOpen(v && v.ok ? v.hist.map(function (x) { return x.m; }) : P.pz.line.map(decode), 0); });
    $('p-tostudy').addEventListener('click', function () { Snd.play('select'); var k = P.play ? P.play.k : 0; stOpen(P.pz.line.map(decode), k); });
    $('r-del').addEventListener('click', rdDel);
    $('r-clear').addEventListener('click', function () { askYes('入力した手を、ぜんぶけしますか？', 'ぜんぶけす', rdClear); });
    $('r-submit').addEventListener('click', function () { Snd.init(); rdSubmit(); });
    $('r-answer').addEventListener('click', function () { askYes('答えを見ますか？', '答えを見る', function () { Snd.play('select'); pAnswer(); }); });
    $('r-disp').addEventListener('click', function () { Snd.play('select'); openDisp(); });
    $('s-first').addEventListener('click', function () { P.study.msg = ''; stGo(0); });
    $('s-prev').addEventListener('click', function () { P.study.msg = ''; stGo(P.study.k - 1); });
    $('s-next').addEventListener('click', function () { P.study.msg = ''; stGo(P.study.k + 1); });
    $('s-last').addEventListener('click', function () { P.study.msg = ''; stGo(P.study.line.length); });
    $('s-main').addEventListener('click', function () { Snd.play('select'); stMain(); });
    $('s-close').addEventListener('click', function () { Snd.play('select'); pReset(); });
    $('pres-again').addEventListener('click', function () { Snd.play('select'); pReset(); });
    $('pres-retryhere').addEventListener('click', function () { var v = P.verdict; Snd.play('select'); pReset(v && v.mis ? v.hist.slice(0, v.mis.k) : []); });
    $('pres-board').addEventListener('click', function () { sheet('pres', false); });
    $('pres-next').addEventListener('click', function () { var j = nextIndex(P.i); if (j >= 0) openPuzzle(j); });
    $('go-mine').addEventListener('click', function () { Snd.init(); Snd.play('select'); buildMine(); show('mine'); });
    $('m-new').addEventListener('click', function () { Snd.init(); Snd.play('select'); openEditor(null); });
    $('m-import').addEventListener('click', function () { Snd.init(); Snd.play('select'); $('imp-text').value = ''; $('imp-err').textContent = ''; sheet('import', true); });
    $('imp-go').addEventListener('click', doImport);
    $('imp-cancel').addEventListener('click', function () { sheet('import', false); });
    $('e-back').addEventListener('click', function () { if (E.run) { clearTimeout(E.run); E.run = null; } buildMine(); show('mine'); });
    $('e-verify').addEventListener('click', function () { Snd.init(); eVerify(); });
    $('e-clear').addEventListener('click', function () { askYes('盤をからっぽにしますか？', 'からっぽにする', function () { var k = E.b.indexOf(-8); E.b = new Array(81).fill(0); if (k >= 0) E.b[k] = -8; E.hand = {}; eDirty(); }, { sub: '玉方の玉だけ残します' }); });
    $('e-borrow').addEventListener('click', function () { E.borrow = !E.borrow; eRender(); });
    $('e-save').addEventListener('click', function () { if (E.report && E.report.exact) eSaveAndPlay(); else { toast('先に「検証」で、' + E.n + '手で詰むか確かめよう'); } });
    $('e-share').addEventListener('click', function () { if (E.report && E.report.exact) openShare(E.report.pz); else toast('共有する前に「検証」してね'); });
    $('ev-save').addEventListener('click', eSaveAndPlay);
    $('ev-share').addEventListener('click', function () { sheet('everify', false); openShare(E.report.pz); });
    $('ev-close').addEventListener('click', function () { if (E.run) { clearTimeout(E.run); E.run = null; } sheet('everify', false); });
    $('sh-go').addEventListener('click', function () { Snd.play('select'); doShare(); });
    $('sh-copy').addEventListener('click', function () { if (shareNow) toast(copyText(shareNow.code) ? 'コードをコピーしました' : 'コピーできませんでした'); });
    $('sh-close').addEventListener('click', function () { sheet('shareprev', false); });
    $('t-unsolved').addEventListener('click', function () { save('hensoku.tUnsolved', !load('hensoku.tUnsolved', false)); Snd.init(); Snd.play('select'); buildTsume(); });
    $('t-nextun').addEventListener('click', function () { var ord = listOrder(); for (var k = 0; k < ord.length; k++) if (!solved[PZ[ord[k]].id]) { Snd.init(); Snd.play('select'); openPuzzle(ord[k]); return; } });
    // オンライン対戦
    $('go-online').addEventListener('click', function () { Snd.init(); Snd.play('select'); showOnline(); });
    $('on-back').addEventListener('click', function () { ON.pick = false; homeInfo(); show('home'); });
    $('on-create').addEventListener('click', function () { Snd.init(); Snd.play('select'); if (!onlineReady()) { showOnline(); return; } ON.pick = true; buildVariants(); show('variants'); });
    $('on-join').addEventListener('click', function () { Snd.init(); joinRoom($('on-code').value); });
    $('on-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom($('on-code').value); });
    $('on-resume').addEventListener('click', function () { Snd.init(); resumeOnline(); });
    $('on-banner-x').addEventListener('click', function () { save('hensoku.bannerX', true); $('on-appbanner').hidden = true; });
    $('v-back').addEventListener('click', function () { if (ON.pick) { ON.pick = false; showOnline(); return; } homeInfo(); show('home'); });
    $('su-room').addEventListener('click', function () { Snd.init(); createRoom(G.setupId); });
    $('rm-share').addEventListener('click', function () { Snd.play('select'); sendInvite(); });
    $('rm-copy').addEventListener('click', function () { toast(copyText(inviteURL(ON.code)) ? 'リンクをコピーしました' : 'コピーできませんでした'); });
    $('rm-cancel').addEventListener('click', function () { leaveOnline(); showOnline(); });
    $('rm-close').addEventListener('click', function () { leaveOnline(); showOnline(); });
    var mutes = document.querySelectorAll('.mute');
    function paint() { mutes.forEach(function (b) { b.textContent = Snd.isMuted() ? '🔇' : '🔊'; }); }
    mutes.forEach(function (b) { b.addEventListener('click', function () { Snd.init(); Snd.setMuted(!Snd.isMuted()); paint(); }); });
    paint();
  }
  function homeInfo() {
    var w = 0; Object.keys(stats).forEach(function (k) { w += stats[k].w[0] + stats[k].w[1] + stats[k].w[2]; });
    $('home-play').textContent = w ? 'CPU にこれまで ' + w + ' 勝' : '';
    var c = PZ.filter(function (p) { return solved[p.id]; }).length;
    $('home-tsume').textContent = PZ.length + '問　クリア ' + c + ' 問';
    $('home-mine').textContent = mine.length ? 'じぶんの問題 ' + mine.length + ' 問' : '';
  }

  bind(); homeInfo();
  if (WEB) document.body.classList.add('web');
  (function () {
    var m = /[?&]room=([A-Za-z0-9]+)/.exec(location.search);
    if (m) { showOnline(); joinRoom(m[1]); return; }
    if (WEB) { showOnline(); return; }
    show('home');
  })();

  // ===================== テスト用 =====================
  window.__hs = {
    G: G, P: P, start: function (id, mode, level, first, extra) {
      setupSel.level = level || 0; setupSel.first = first || 0;
      if (extra) { if (extra.H !== undefined) setupSel.H = extra.H; if (extra.anDir) setupSel.anDir = extra.anDir; if (extra.anBoard) setupSel.anBoard = extra.anBoard; }
      startGame(id, mode || 'local');
    },
    selCard: function (k) { G.selCard = k; refresh(); },
    setup: openSetup, variants: function () { buildVariants(); show('variants'); }, tsume: function () { buildTsume(); show('tsume'); },
    // CPU どうしで何手か進める（同期）
    auto: function (n, lv, ms) { for (var k = 0; k < n; k++) { var s = curS(); if (G.ad.over(s)) break; var m = G.ad.ai(s, lv === undefined ? 1 : lv, ms || 40); G.moves.push(m); G.hist.push(G.ad.play(s, m)); } clearTimeout(G.timer); G.busy = false; refresh(); },
    tap: tapSquare, hand: tapHand, puzzle: openPuzzle, ptap: pTap, phand: pHand, answer: pAnswer, step: pStep, hint: function () { P.hint = Math.min(2, P.hint + 1); pRender(); },
    // 詰将棋: 攻め方の手を指す（玉方は同期で応じる）。テストでは待たない
    pmove: function (str) {
      var m = decode(str), n = R.apply(P.V, P.s, m); n.check = R.inCheck(P.V, n, n.turn);
      P.hist.push({ s: P.s, m: m, by: 0 }); P.s = n;
      if (!R.legalFrom(P.V, n, false).length || usedAttack() >= attackTotal()) { judge(); return P.verdict; }
      var reply = defenderReply(P.s), n2 = R.apply(P.V, P.s, reply); n2.check = R.inCheck(P.V, n2, n2.turn);
      P.hist.push({ s: P.s, m: reply, by: 1 }); P.s = n2; pRender(); return null;
    },
    records: function () { return loadRecords(); }, openReplay: openReplay, rpGo: function (k) { rpGo(k); }, RP: function () { return RP; }, buildRecords: function () { buildRecords(); show('records'); }, tryFrom: tryFrom, refresh: function () { refresh(); }, finishNow: function (o) { finish(o); }, handOver: handOver, doMove: function (m) { doMove(m); },
    tset: tset, setT: setT, stOpen: stOpen, stPlay: stPlay, stGo: stGo, stMain: stMain, stReveal: stReveal, stRevealAll: function () { stRevealAll(); }, defReplies: defReplies, rdPush: rdPush, rdSubmit: rdSubmit, rdTap: rdTap, rdHand: rdHand, rdCheck: rdCheck, defMove: defMove, judge: judge, pMove: pMove, openDisp: openDisp, buildTsume: buildTsume, pReset: pReset,
    verdict: function () { return P.verdict; }, showVerdict: showVerdict, retryHere: function () { var v = P.verdict; pReset(v.hist.slice(0, v.mis.k)); }, undo: pUndo, disp: openDisp,
    setDisp: function (ctx, k, v) { setDisp(ctx, k, v); },
    // 詰将棋をつくる
    E: E, mine: function () { return mine; }, buildMine: function () { buildMine(); show('mine'); }, editor: openEditor, etap: eTap,
    everify: eVerify, ereport: function () { return E.report; }, esave: eSaveAndPlay, share: openShare, doShare: doShare, shareNow: function () { return shareNow; },
    online: { ON: ON, createRoom: createRoom, joinRoom: joinRoom, setClock: setClock, beginOnline: beginOnline, offerDraw: offerDraw, hostRematch: hostRematch, resign: function () { if (ON.net) ON.net.resign(); G.done = true; finish({ winner: 1 - G.human, text: 'あなたが投了' }); }, kifuText: function () { return G.lastRec ? kifuText(G.lastRec) : ''; }, setPick: function (v) { ON.pick = v; }, openSetup: openSetup, leave: leaveOnline, resume: resumeOnline, show: showOnline },
    fx: { onCard: onFxCard, tap: fxTap, sel: function () { return G.fxSel; } },
    importCode: function (code) { $('imp-text').value = code; doImport(); return $('imp-err').textContent; }
  };
})();

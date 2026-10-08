/* 特殊効果将棋 — 本将棋に「1局に1回だけ使える特殊効果カード」を足したもの（ルールと CPU。DOM は使わない）

   はじめに、おたがい山から効果カードを N 枚（1 か 2）引く。カードは自分の番に、ふつうの手を指す「前に」1枚だけ使える。
   使ったカードはなくなる（同じ番に2枚は使えない）。王手をかけられているあいだは、カードは使えない。

   カード（どれも1局に1回）
     二手指し  この番は2手続けて指せる。ただし ①2手は別々の駒で（同じ駒を2回は動かせない。打つのは別の駒あつかい）
               ②2手とも、相手の駒を取る手は指せない ③2手とも、王手になる手は指せない。
               こういう2手の組み合わせが1つもないときは、カードを使えない
     封印      相手は次の3回の番、持ち駒を打てない（王手をかけられているときだけは打ってよい）
     身代わり  相手の持ち駒から、もとは自分の駒だった1枚（どれでも）を自分の持ち駒にもどす
     入れ替え  自分の盤上の駒2枚（玉は除く）の位置を入れ替える
     成り込み  自分の盤上の駒1枚を、その場で成らせる（成れる駒だけ）
     地雷      空いているマスを1つ、こっそり決める。そこに相手の駒（玉は除く）が入ったら、その駒は自分の持ち駒になる
     鉄壁      相手の次の1手は、王手になる手を指せない
     透視      相手の手札（効果カード）を見る（カードがおたがい見えないルールのときだけ山に入る）

   盤を変えるカード（入れ替え・成り込み）は、使ったあとに「相手に王手がかかる」「自分に王手がかかる」「二歩」「行き所のない駒」になる使い方はできない。
   地雷: そこに入った駒が消えることで、入った側の玉に王手がかかってしまうときは、地雷は不発（そのまま残る）。
   鉄壁・封印で、指せる手が1つもなくなってしまうときは、その制限はなし（カードのせいで詰みにはしない）。
   二手指しは、2手の組み合わせがあるときだけ使えるので、とちゅうで指せなくなることはない。

   状態 s = 本将棋の局面 + fx: { cards[2][], used[2][], seal[2], mine[2], noCheck, nite, acted, seen[2] }, seed */
(function (root) {
  'use strict';
  var HS = root.HS, R = HS.rules, DEF = HS.DEF;

  var CARDS = {
    nite:     { name: '二手指し', emoji: '⏩', desc: 'この番は2手続けて指せる。2手は別々の駒で、駒を取る手・王手になる手はだめ' },
    fuin:     { name: '封印', emoji: '🔒', desc: '相手は次の3回の番、持ち駒を打てない（王手のときは打てる）' },
    migawari: { name: '身代わり', emoji: '🪆', desc: '相手の持ち駒から、もとは自分の駒だった1枚を取りもどす' },
    irekae:   { name: '入れ替え', emoji: '🔁', desc: '自分の駒2枚（玉以外）の位置を入れ替える' },
    narikomi: { name: '成り込み', emoji: '⭐', desc: '自分の駒1枚を、その場で成らせる' },
    jirai:    { name: '地雷', emoji: '💣', desc: '空きマスに地雷をしかける。入った相手の駒（玉以外）は自分の持ち駒に' },
    teppeki:  { name: '鉄壁', emoji: '🛡', desc: '相手の次の1手は、王手になる手を指せない' },
    toushi:   { name: '透視', emoji: '👁', desc: '相手の手札（効果カード）を見る' }
  };
  var ORDER = ['nite', 'fuin', 'migawari', 'irekae', 'narikomi', 'jirai', 'teppeki', 'toushi'];
  var SEAL_TURNS = 3;

  // 乱数（seed があれば決まった並び）。trump.js と同じ作り
  function rnd(st) {
    if (!st || typeof st.seed !== 'number') return Math.random();
    var t = st.seed = (st.seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // opt: { n: 1|2（1人あたりの枚数）, show: true（おたがい見える）/ false（見えない）}, seed
  function init(V, opt, seed) {
    var s = R.init(V), n = opt && opt.n === 2 ? 2 : 1, show = !(opt && opt.show === false);
    if (typeof seed === 'number') s.seed = seed | 0;
    var deck = ORDER.filter(function (c) { return c !== 'toushi' || !show; });
    for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(rnd(s) * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    s.fx = { cards: [deck.slice(0, n), deck.slice(n, 2 * n)], used: [[], []], seal: [0, 0], mine: [-1, -1], noCheck: -1, nite: 0, niteSq: -1, acted: false, show: show, seen: [false, false], n: n, log: null };
    return s;
  }
  function cloneFx(fx) {
    return { cards: [fx.cards[0].slice(), fx.cards[1].slice()], used: [fx.used[0].slice(), fx.used[1].slice()], seal: fx.seal.slice(), mine: fx.mine.slice(),
      noCheck: fx.noCheck, nite: fx.nite, niteSq: fx.niteSq === undefined ? -1 : fx.niteSq, acted: fx.acted, show: fx.show, seen: fx.seen.slice(), n: fx.n, log: null };
  }
  function clone(s) {
    var n = { b: s.b.slice(), hand: [s.hand[0].slice(), s.hand[1].slice()], turn: s.turn, last: s.last, ply: s.ply, check: s.check, fx: cloneFx(s.fx) };
    if (typeof s.seed === 'number') n.seed = s.seed;
    return n;
  }

  function givesCheck(V, s, m) { var n = R.apply(V, s, m); return R.inCheck(V, n, n.turn); }

  // ===================== 二手指し =====================
  // 二手指しで指してよい1手: 駒を取らない・王手にならない（封印中は打てない）
  function niteBase(V, s) {
    var p = s.turn, inChk = R.inCheck(V, s, p), all = R.moves(V, s);
    if (s.fx && s.fx.seal[p] > 0 && !inChk) all = all.filter(function (m) { return m.f >= 0; });
    return all.filter(function (m) { return !m.cap && !givesCheck(V, s, m); });
  }
  // 1手目を指したあと（まだ同じ人の番）の局面
  function afterFirst(s, V, m) {
    var b = R.apply(V, s, m);
    return { b: b.b, hand: b.hand, turn: s.turn, ply: b.ply, last: m, check: false, fx: s.fx };
  }
  // 2手目の候補: 1手目と別の駒（1手目で動かした駒は、いま to のマスにいる）
  function niteSecond(V, s1, firstTo) { return niteBase(V, s1).filter(function (m) { return m.f !== firstTo; }); }
  // 1手目の候補: そのあと2手目が1つでもあるもの。any=true なら1つ見つけた時点で終わる
  function niteFirst(V, s, any) {
    var out = [], base = niteBase(V, s);
    for (var i = 0; i < base.length; i++) {
      if (niteSecond(V, afterFirst(s, V, base[i]), base[i].t).length) { out.push(base[i]); if (any) break; }
    }
    return out;
  }

  // ===================== 指せる手 =====================
  // ふつうの手（カードの効果で絞る。絞りすぎて0になるときは絞らない）
  function boardMoves(V, s) {
    if (s.end) return [];
    var all = R.moves(V, s), p = s.turn, fx = s.fx, out = all, inChk = R.inCheck(V, s, p);
    if (fx.seal[p] > 0 && !inChk) {
      var noDrop = out.filter(function (m) { return m.f >= 0; });
      if (noDrop.length) out = noDrop;
    }
    if (fx.nite === 1) return niteFirst(V, s, false);
    if (fx.nite === 2) return niteSecond(V, s, fx.niteSq === undefined ? -1 : fx.niteSq);
    if (fx.noCheck === p) {
      var quiet = out.filter(function (m) { return !givesCheck(V, s, m); });
      if (quiet.length) out = quiet;
    }
    return out;
  }
  function owned(V, b, i, p) { return b[i] && R.owner(b[i]) === p; }
  // 盤を変えたあとの局面が、ルールどおりか（二歩・行き所・王手）
  function boardOk(V, n, p) {
    var w = V.w, sign = p === 0 ? 1 : -1;
    for (var x = 0; x < w; x++) {
      var c = 0;
      for (var y = 0; y < V.h; y++) if (n.b[y * w + x] === sign) c++;
      if (c > 1) return false;
    }
    for (var i = 0; i < V.n; i++) {
      if (!owned(V, n.b, i, p)) continue;
      if (R.deadAt(V, R.kind(n.b[i]), (i / w) | 0, p)) return false;
    }
    if (R.inCheck(V, n, p)) return false;
    if (R.inCheck(V, n, 1 - p)) return false;
    return true;
  }
  // 使えるカードの「使い方」の一覧（{ fx: 名前, ... }）
  function actions(V, s) {
    var p = s.turn, fx = s.fx, out = [];
    if (s.end || fx.acted || fx.nite || R.inCheck(V, s, p)) return out;
    var opp = 1 - p, sign = p === 0 ? 1 : -1;
    fx.cards[p].forEach(function (c) {
      if (fx.used[p].indexOf(c) >= 0) return;
      var i, j;
      if (c === 'nite') { if (niteFirst(V, s, true).length) out.push({ fx: c }); }
      else if (c === 'fuin' || c === 'teppeki') out.push({ fx: c });
      else if (c === 'toushi') { if (!fx.show && !fx.seen[p]) out.push({ fx: c }); }
      else if (c === 'migawari') {
        // 相手の持ち駒は、ぜんぶ「もとは相手の駒を取った」か「自分の駒を取られた」かは区別しないので、相手の持ち駒ならどれでも
        V.handTypes.forEach(function (t, k) { if (s.hand[opp][k] > 0) out.push({ fx: c, d: t }); });
      } else if (c === 'narikomi') {
        for (i = 0; i < V.n; i++) {
          if (!owned(V, s.b, i, p)) continue;
          var t = R.kind(s.b[i]); if (!DEF[t].prom) continue;
          var n = clone(s); n.b[i] = DEF[t].prom * sign;
          if (boardOk(V, n, p)) out.push({ fx: c, sq: i });
        }
      } else if (c === 'irekae') {
        var mine = [];
        for (i = 0; i < V.n; i++) if (owned(V, s.b, i, p) && !DEF[R.kind(s.b[i])].royal) mine.push(i);
        for (i = 0; i < mine.length; i++) for (j = i + 1; j < mine.length; j++) {
          var a = mine[i], bq = mine[j]; if (s.b[a] === s.b[bq]) continue;   // 同じ駒どうしは意味がない
          var n2 = clone(s); n2.b[a] = s.b[bq]; n2.b[bq] = s.b[a];
          if (boardOk(V, n2, p)) out.push({ fx: c, a: a, b: bq });
        }
      } else if (c === 'jirai') {
        if (fx.mine[p] >= 0) return;
        for (i = 0; i < V.n; i++) if (!s.b[i]) out.push({ fx: c, sq: i });
      }
    });
    return out;
  }
  function moves(V, s) { return boardMoves(V, s).concat(actions(V, s)); }
  // カード c がいま使えない理由（使えるなら ''）
  function whyNot(V, s, c) {
    var p = s.turn, fx = s.fx;
    if (fx.used[p].indexOf(c) >= 0) return '使った';
    if (s.end) return '';
    if (R.inCheck(V, s, p)) return '王手のあいだは使えない';
    if (fx.acted || fx.nite) return 'この番はもう使った';
    if (actions(V, s).some(function (a) { return a.fx === c; })) return '';
    return c === 'nite' ? '二手指しできる2手の組み合わせがない' : c === 'migawari' ? '相手の持ち駒がない' : c === 'toushi' ? 'もう見ている' :
      c === 'narikomi' ? '成らせられる駒がない' : c === 'irekae' ? '入れ替えられる組み合わせがない' : c === 'jirai' ? 'もうしかけてある' : 'いまは使えない';
  }
  function sameMove(a, b) {
    if (a.fx || b.fx) return a.fx === b.fx && (a.d || 0) === (b.d || 0) && (a.sq === undefined ? -1 : a.sq) === (b.sq === undefined ? -1 : b.sq) &&
      (a.a === undefined ? -1 : a.a) === (b.a === undefined ? -1 : b.a) && (a.b === undefined ? -1 : a.b) === (b.b === undefined ? -1 : b.b);
    return R.same(a, b);
  }

  // ===================== 指す =====================
  function play(V, s, m) {
    if (!moves(V, s).some(function (x) { return sameMove(x, m); })) throw new Error('illegal ' + JSON.stringify(m));
    var p = s.turn, opp = 1 - p, sign = p === 0 ? 1 : -1, n;
    if (m.fx) {
      n = clone(s); var fx = n.fx;
      fx.used[p].push(m.fx); fx.acted = true; fx.log = { fx: m.fx, by: p };
      if (m.fx === 'nite') fx.nite = 1;
      else if (m.fx === 'fuin') fx.seal[opp] = SEAL_TURNS;
      else if (m.fx === 'teppeki') fx.noCheck = opp;
      else if (m.fx === 'toushi') fx.seen[p] = true;
      else if (m.fx === 'migawari') { var k = V.handIdx[m.d]; n.hand[opp][k]--; n.hand[p][k]++; }
      else if (m.fx === 'narikomi') { n.b[m.sq] = DEF[R.kind(s.b[m.sq])].prom * sign; }
      else if (m.fx === 'irekae') { n.b[m.a] = s.b[m.b]; n.b[m.b] = s.b[m.a]; }
      else if (m.fx === 'jirai') fx.mine[p] = m.sq;
      n.last = s.last; n.check = R.inCheck(V, n, n.turn);
      return n;
    }
    var base = R.apply(V, s, m);
    n = { b: base.b, hand: base.hand, turn: base.turn, last: m, ply: base.ply, check: false, fx: cloneFx(s.fx) };
    if (typeof s.seed === 'number') n.seed = s.seed;
    var f = n.fx;
    // 地雷（相手がしかけたもの）
    var ms = f.mine[opp];
    if (ms >= 0 && m.t === ms && !DEF[R.kind(n.b[ms])].royal) {
      var test = n.b.slice(); test[ms] = 0;
      if (!R.inCheck(V, { b: test, hand: n.hand, turn: p }, p)) {
        var hit = R.base(R.kind(n.b[ms]));
        n.b[ms] = 0;
        if (V.handIdx[hit] !== undefined) n.hand[opp][V.handIdx[hit]]++;
        f.mine[opp] = -1; f.log = { mine: ms, hit: hit, by: opp };
      }
    }
    // 番の終わり（二手指しの1手目のあとは、まだ同じ人の番）
    if (f.nite === 1) { f.nite = 2; f.niteSq = m.t; n.turn = p; }
    else {
      f.nite = 0; f.niteSq = -1; f.acted = false;
      if (f.seal[p] > 0) f.seal[p]--;
      if (f.noCheck === p) f.noCheck = -1;
    }
    n.check = R.inCheck(V, n, n.turn);
    return n;
  }
  function over(V, s) {
    if (s.end) return s.end;
    if (s.ply >= V.maxPly) return { winner: -1, text: '手数が長すぎるので引き分け' };
    if (boardMoves(V, s).length) return null;
    return { winner: 1 - s.turn, text: R.inCheck(V, s, s.turn) ? '詰み！' : '指せる手がない' };
  }
  function repetition(V, hist) {
    // カードの状態が同じときだけ千日手（数えるのは本将棋と同じ）
    var last = hist[hist.length - 1];
    if (last.fx && (last.fx.nite || last.fx.acted)) return null;
    return R.repetition(V, hist.filter(function (h) { return !h.fx || (!h.fx.nite && !h.fx.acted); }));
  }

  // ===================== 棋譜の書き方 =====================
  function sq(V, i) { return HS.sqName(V, i); }
  function label(V, s, m, prevT) {
    if (!m.fx) return HS.kifu(V, s, m, prevT);
    var mark = s.turn === 0 ? '▲' : '△', c = CARDS[m.fx], nm = '★' + c.name;
    if (m.fx === 'migawari') return mark + nm + '（' + DEF[m.d].n + 'を取りもどす）';
    if (m.fx === 'narikomi') return mark + nm + '（' + sq(V, m.sq) + DEF[R.kind(s.b[m.sq])].n + '）';
    if (m.fx === 'irekae') return mark + nm + '（' + sq(V, m.a) + DEF[R.kind(s.b[m.a])].n + '⇔' + sq(V, m.b) + DEF[R.kind(s.b[m.b])].n + '）';
    if (m.fx === 'jirai') return mark + nm;               // 場所はひみつ
    return mark + nm;
  }

  // ===================== CPU =====================
  function valueOf(V, s, p) { var v = R.evaluate(V, s); return s.turn === p ? v : -v; }
  // 相手が次に王手をかけられるか
  function oppCanCheck(V, s, p) {
    var t = { b: s.b, hand: s.hand, turn: 1 - p, last: s.last, ply: s.ply, check: false };
    var ms = R.pseudoMoves(V, t);
    for (var i = 0; i < ms.length; i++) { var n = R.apply(V, t, ms[i]); if (R.inCheck(V, n, p)) return true; }
    return false;
  }
  function chooseCard(V, s, level) {
    var p = s.turn, acts = actions(V, s);
    if (!acts.length || level === 0 && Math.random() < 0.7) return null;
    var best = null, bv = 0, cur = valueOf(V, s, p), oppHand = s.hand[1 - p].reduce(function (a, b) { return a + b; }, 0);
    acts.forEach(function (a) {
      var gain = 0;
      if (a.fx === 'migawari') gain = DEF[a.d].v * 1.6;
      else if (a.fx === 'narikomi' || a.fx === 'irekae') { var n = play(V, s, a); gain = valueOf(V, n, p) - cur - (a.fx === 'irekae' ? 80 : 40); }
      else if (a.fx === 'fuin') gain = oppHand >= 2 ? 150 * oppHand : 0;
      else if (a.fx === 'teppeki') gain = oppCanCheck(V, s, p) ? 260 : 0;
      else if (a.fx === 'nite') gain = s.ply > 16 ? 300 : 0;
      else if (a.fx === 'toushi') gain = 40;
      else if (a.fx === 'jirai') {
        // 相手の駒が入ってきそうな、自分の陣地の近くのマス
        var y = (a.sq / V.w) | 0, near = p === 0 ? y >= V.h - 4 : y <= 3;
        var t = { b: s.b, hand: s.hand, turn: 1 - p, last: s.last, ply: s.ply, check: false };
        var reach = R.pseudoMoves(V, t).filter(function (m) { return m.t === a.sq && m.f >= 0; }).length;
        gain = near && reach ? 120 + reach * 30 + Math.random() * 40 : 0;
      }
      if (level === 2) gain *= 1.1;
      if (gain > bv) { bv = gain; best = a; }
    });
    return bv >= 140 ? best : null;
  }
  function ai(V, s, level, timeMs) {
    var card = chooseCard(V, s, level);
    if (card) return card;
    var bm = boardMoves(V, s), all = R.moves(V, s);
    if (bm.length === all.length) return R.ai(V, s, level, timeMs);
    // カードで手が絞られているとき: 絞った中から1手読みで
    var best = bm[0], bv = -Infinity;
    bm.forEach(function (m) {
      var n = R.apply(V, s, m), v = -R.evaluate(V, n) + (level === 0 ? Math.random() * 400 : Math.random() * 30);
      if (v > bv) { bv = v; best = m; }
    });
    return best;
  }

  HS.effects = { CARDS: CARDS, ORDER: ORDER, SEAL_TURNS: SEAL_TURNS, init: init, moves: moves, boardMoves: boardMoves, actions: actions, whyNot: whyNot, niteFirst: niteFirst, play: play, over: over,
    repetition: repetition, label: label, ai: ai, same: sameMove, rnd: rnd };
})(this);

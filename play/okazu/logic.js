/* おかず詰めパズル — ルールだけ（画面・音なし）
 * game.js（画面）と src/ の solver・ステージ作り・verify で同じものを使う。jsc でも動く（DOM を使わない）。
 *
 * 盤はたて・よこ N マス（5〜7）。マスの番号 b = 行 * N + 列。
 * 「うまっているか」などは 2 つの 32bit 整数（lo = 0〜27 番、hi = 28 番から）で持つ（速くさがすため）。
 *
 * マップの文字: '.' あき / 'o' ごはん（最初から入っている。列がそろうと食べられる）/
 *               '#' バラン（しきり。置けないが、列には数える。消えない）/ 'i' こおったおかず（1回目は とけるだけ、2回目で食べられる）
 * おかずの順番: "ebi" / "ebi:1"（はじめの向き）/ "ebi:1!"（向きが決まっていて回せない）
 * 目標 goals（ぜんぶ満たしたらクリア）:
 *   {t:'lines', n} 列を n 本消す / {t:'rice'} ごはんをぜんぶ食べる / {t:'ice'} こおったおかずをぜんぶ食べる /
 *   {t:'food', k, n} おかず k を n マス食べる / {t:'fill'} すきまなくつめる（noClear: 列は消えない）
 * hold: 小皿（おかずを1つとっておける。とっておいたおかずは、いつでもつめられる）
 * 手（move）: [0, 向き, 行, 列] 順番のおかずをつめる / [1, 向き, 行, 列] 小皿のおかずをつめる / [2] 小皿にとっておく
 */
(function (root) {
  'use strict';

  // ---------- おかず ----------
  // cells は (行, 列)。face = 顔をかくマス（cells の何番目か）
  var FOODS = {
    ume:     { name: 'うめぼし',         cells: [[0, 0]], color: '#e0465c', dark: '#a82a3f', face: 0 },
    edamame: { name: 'えだまめ',         cells: [[0, 0], [0, 1]], color: '#8bc95b', dark: '#4f8f2c', face: 0 },
    wiener:  { name: 'タコさんウインナー', cells: [[0, 0], [0, 1], [0, 2]], color: '#f06a5d', dark: '#b8392e', face: 0 },
    brocco:  { name: 'ブロッコリー',     cells: [[0, 0], [1, 0], [1, 1]], color: '#4fae55', dark: '#2c7a33', face: 1 },
    tamago:  { name: 'たまご焼き',       cells: [[0, 0], [0, 1], [0, 2], [0, 3]], color: '#f8cf4a', dark: '#c99a14', face: 1 },
    karaage: { name: 'からあげ',         cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: '#cf8a3e', dark: '#8f5520', face: 0 },
    ebi:     { name: 'エビフライ',       cells: [[0, 0], [1, 0], [2, 0], [2, 1]], color: '#f3a24b', dark: '#b8661a', face: 0 },
    onigiri: { name: 'おにぎり',         cells: [[0, 1], [1, 0], [1, 1], [1, 2]], color: '#fbfaf4', dark: '#9aa3ab', face: 0 },
    napo:    { name: 'ナポリタン',       cells: [[0, 1], [0, 2], [1, 0], [1, 1]], color: '#ee7b47', dark: '#b4481c', face: 0 },
    hamburg: { name: 'ハンバーグ',       cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]], color: '#9a6240', dark: '#5f3620', face: 0 },
    shake:   { name: 'しゃけ',           cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], color: '#f6987f', dark: '#c25e45', face: 1 }
  };
  var KINDS = Object.keys(FOODS);

  // 90度ずつ回した形（同じ形は1つにまとめる）。左上が (0,0) になるようにそろえる
  function rots(cells) {
    var out = [], seen = {}, cur = cells;
    for (var k = 0; k < 4; k++) {
      var mr = 1e9, mc = 1e9;
      cur.forEach(function (p) { mr = Math.min(mr, p[0]); mc = Math.min(mc, p[1]); });
      var n = cur.map(function (p) { return [p[0] - mr, p[1] - mc]; });
      var key = n.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).join(';');
      if (!seen[key]) { seen[key] = 1; out.push(n); }
      cur = cur.map(function (p) { return [p[1], -p[0]]; });
    }
    return out;
  }
  KINDS.forEach(function (k) { FOODS[k].rots = rots(FOODS[k].cells); });

  function popc(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24;
  }
  function bitLo(b) { return b < 28 ? (1 << b) : 0; }
  function bitHi(b) { return b < 28 ? 0 : (1 << (b - 28)); }
  function has(lo, hi, b) { return b < 28 ? (lo >>> b) & 1 : (hi >>> (b - 28)) & 1; }

  function parsePiece(s) {
    var m = /^([a-z]+)(?::(\d))?(!)?$/.exec(s);
    if (!m || !FOODS[m[1]]) throw new Error('bad piece ' + s);
    var n = FOODS[m[1]].rots.length;
    return { k: m[1], r0: (+m[2] || 0) % n, fix: !!m[3] };
  }

  // ---------- ステージの下ごしらえ ----------
  function makeCtx(stage) {
    var N = stage.size, ctx = { N: N, st: stage, noClear: !!stage.noClear, hold: !!stage.hold, goals: stage.goals || [], score: !!stage.score };
    ctx.pieces = stage.pieces.map(parsePiece);
    var fullL = 0, fullH = 0, bL = 0, bH = 0;
    for (var b = 0; b < N * N; b++) {
      fullL |= bitLo(b); fullH |= bitHi(b);
      var ch = stage.map && stage.map.length ? stage.map[Math.floor(b / N)][b % N] : '.';
      if (ch === '#') { bL |= bitLo(b); bH |= bitHi(b); }
    }
    ctx.fullL = fullL; ctx.fullH = fullH; ctx.bL = bL; ctx.bH = bH;
    // 列（たて・よこ）。バランだけの列は数えない
    ctx.lines = [];
    var r, c, lo, hi, cells;
    for (r = 0; r < N; r++) {
      lo = 0; hi = 0; cells = [];
      for (c = 0; c < N; c++) { b = r * N + c; lo |= bitLo(b); hi |= bitHi(b); cells.push(b); }
      if ((lo & ~bL) || (hi & ~bH)) ctx.lines.push({ lo: lo, hi: hi, kind: 'r', i: r, cells: cells });
    }
    for (c = 0; c < N; c++) {
      lo = 0; hi = 0; cells = [];
      for (r = 0; r < N; r++) { b = r * N + c; lo |= bitLo(b); hi |= bitHi(b); cells.push(b); }
      if ((lo & ~bL) || (hi & ~bH)) ctx.lines.push({ lo: lo, hi: hi, kind: 'c', i: c, cells: cells });
    }
    ctx.foodGoal = null;
    ctx.goals.forEach(function (g) { if (g.t === 'food') ctx.foodGoal = g; });
    ctx.places = {};
    var need = {};
    ctx.pieces.forEach(function (p) { need[p.k] = 1; });
    Object.keys(need).forEach(function (k) { ctx.places[k] = placesFor(N, k); });
    return ctx;
  }

  // おかず k を、向きごとに、置ける場所（盤からはみ出さない場所）をならべる
  function placesFor(N, k) {
    return FOODS[k].rots.map(function (cells, ri) {
      var h = 0, w = 0, list = [];
      cells.forEach(function (p) { h = Math.max(h, p[0] + 1); w = Math.max(w, p[1] + 1); });
      for (var r0 = 0; r0 + h <= N; r0++) for (var c0 = 0; c0 + w <= N; c0++) {
        var lo = 0, hi = 0, bs = [], inL = 0, inH = 0;
        cells.forEach(function (p) { var b = (r0 + p[0]) * N + c0 + p[1]; bs.push(b); lo |= bitLo(b); hi |= bitHi(b); });
        // まわりのマス（くっつき具合をはかる）
        var nbL = 0, nbH = 0, wall = 0;
        cells.forEach(function (p) {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var rr = r0 + p[0] + d[0], cc = c0 + p[1] + d[1];
            if (rr < 0 || cc < 0 || rr >= N || cc >= N) { wall++; return; }
            var b = rr * N + cc;
            if (!has(lo, hi, b)) { nbL |= bitLo(b); nbH |= bitHi(b); }
          });
        });
        list.push({ r: r0, c: c0, rot: ri, cells: bs, lo: lo, hi: hi, nbL: nbL, nbH: nbH, wall: wall });
      }
      return list;
    });
  }
  function placeAt(ctx, k, rot, r, c) {
    var L = ctx.places[k] || (ctx.places[k] = placesFor(ctx.N, k));
    var list = L[rot] || [];
    for (var i = 0; i < list.length; i++) if (list[i].r === r && list[i].c === c) return list[i];
    return null;
  }

  function initState(ctx) {
    var N = ctx.N, s = { fL: ctx.bL, fH: ctx.bH, rL: 0, rH: 0, iL: 0, iH: 0, aL: 0, aH: 0, kL: 0, kH: 0, eaten: 0, lines: 0, idx: 0, hold: -1, placed: 0, rice0: 0, ice0: 0 };
    var map = ctx.st.map || [];
    for (var b = 0; b < N * N && map.length; b++) {
      var ch = map[Math.floor(b / N)][b % N];
      if (ch === 'o') { s.fL |= bitLo(b); s.fH |= bitHi(b); s.rL |= bitLo(b); s.rH |= bitHi(b); s.rice0++; }
      if (ch === 'i') { s.fL |= bitLo(b); s.fH |= bitHi(b); s.iL |= bitLo(b); s.iH |= bitHi(b); s.aL |= bitLo(b); s.aH |= bitHi(b); s.ice0++; }
    }
    return s;
  }
  function copy(s) {
    return { fL: s.fL, fH: s.fH, rL: s.rL, rH: s.rH, iL: s.iL, iH: s.iH, aL: s.aL, aH: s.aH, kL: s.kL, kH: s.kH,
      eaten: s.eaten, lines: s.lines, idx: s.idx, hold: s.hold, placed: s.placed, rice0: s.rice0, ice0: s.ice0 };
  }
  function fits(s, pl) { return !(s.fL & pl.lo) && !(s.fH & pl.hi); }

  // おかずを置く（src 0 = 順番の、1 = 小皿の）。消えた列などを res に入れて返す
  function apply(ctx, s, src, pl) {
    var s2 = copy(s), pi = src === 1 ? s.hold : s.idx, k = ctx.pieces[pi].k;
    s2.fL |= pl.lo; s2.fH |= pl.hi;
    if (ctx.foodGoal && ctx.foodGoal.k === k) { s2.kL |= pl.lo; s2.kH |= pl.hi; }
    if (src === 1) s2.hold = -1; else s2.idx++;
    s2.placed++;
    var res = { s: s2, n: 0, clearL: 0, clearH: 0, eatL: 0, eatH: 0, thawL: 0, thawH: 0, lines: [], rice: 0, eatenK: 0 };
    if (ctx.noClear) return res;
    var L = ctx.lines;
    for (var i = 0; i < L.length; i++) {
      var ln = L[i];
      if ((s2.fL & ln.lo) === ln.lo && (s2.fH & ln.hi) === ln.hi) { res.n++; res.clearL |= ln.lo; res.clearH |= ln.hi; res.lines.push(ln); }
    }
    if (!res.n) return res;
    var eL = res.clearL & ~ctx.bL & ~s2.iL, eH = res.clearH & ~ctx.bH & ~s2.iH;
    res.eatL = eL; res.eatH = eH;
    res.thawL = res.clearL & s2.iL; res.thawH = res.clearH & s2.iH;
    res.rice = popc(s2.rL & eL) + popc(s2.rH & eH);
    res.eatenK = popc(s2.kL & eL) + popc(s2.kH & eH);
    s2.fL &= ~eL; s2.fH &= ~eH;
    s2.rL &= ~eL; s2.rH &= ~eH;
    s2.iL &= ~res.clearL; s2.iH &= ~res.clearH;
    s2.aL &= ~eL; s2.aH &= ~eH;
    s2.kL &= ~eL; s2.kH &= ~eH;
    s2.eaten += res.eatenK;
    s2.lines += res.n;
    return res;
  }
  function stash(s) { var s2 = copy(s); s2.hold = s.idx; s2.idx++; return s2; }

  function goalDone(ctx, s) {
    if (ctx.score) return false;
    for (var i = 0; i < ctx.goals.length; i++) if (goalProgress(ctx, s, ctx.goals[i]) < 1) return false;
    return ctx.goals.length > 0;
  }
  // 目標ごとの進み具合 0〜1
  function goalProgress(ctx, s, g) {
    switch (g.t) {
      case 'lines': return Math.min(1, s.lines / g.n);
      case 'rice': return s.rice0 ? 1 - (popc(s.rL) + popc(s.rH)) / s.rice0 : 1;
      case 'ice': return s.ice0 ? 1 - (popc(s.aL) + popc(s.aH)) / s.ice0 : 1;
      case 'food': return Math.min(1, s.eaten / g.n);
      case 'fill': return (s.fL === ctx.fullL && s.fH === ctx.fullH) ? 1 : (popc(s.fL) + popc(s.fH)) / (ctx.N * ctx.N);
    }
    return 0;
  }
  function left(ctx, s) { return ctx.pieces.length - s.idx + (s.hold >= 0 ? 1 : 0); }

  // いまの向きで置けるか（おかず pi が、どこかに入るか）
  function pieceFits(ctx, s, pi) {
    var p = ctx.pieces[pi], L = ctx.places[p.k];
    for (var ri = 0; ri < L.length; ri++) {
      if (p.fix && ri !== p.r0) continue;
      var list = L[ri];
      for (var j = 0; j < list.length; j++) if (fits(s, list[j])) return true;
    }
    return false;
  }
  // もう打つ手がない（目標はまだ）
  function stuck(ctx, s) {
    if (s.idx < ctx.pieces.length && pieceFits(ctx, s, s.idx)) return false;
    if (s.hold >= 0 && pieceFits(ctx, s, s.hold)) return false;
    if (ctx.hold && s.hold < 0 && s.idx + 1 < ctx.pieces.length) return false;   // 小皿にとっておけば、つぎのおかずへ進める
    return true;
  }

  function key(s) {
    return s.fL + ',' + s.fH + ',' + s.rL + ',' + s.rH + ',' + s.iL + ',' + s.iH + ',' + s.aL + ',' + s.aH + ',' + s.kL + ',' + s.kH + ',' + s.eaten + ',' + s.lines + ',' + s.idx + ',' + s.hold;
  }

  // ---------- 1手ずつ全部ならべる（solver・ヒント・おためしプレイヤー用） ----------
  // f(s2, move, res) をよぶ。move = [src, 向き, 行, 列] / 小皿に入れてから置くときは [[2], [0, …]]
  function eachPlacement(ctx, s, f) {
    var L = ctx.pieces.length;
    function from(st, src, pre) {
      var pi = src === 1 ? st.hold : st.idx;
      if (pi < 0 || pi >= L) return;
      var p = ctx.pieces[pi], P = ctx.places[p.k];
      for (var ri = 0; ri < P.length; ri++) {
        if (p.fix && ri !== p.r0) continue;
        var list = P[ri];
        for (var j = 0; j < list.length; j++) {
          var pl = list[j];
          if (!fits(st, pl)) continue;
          var res = apply(ctx, st, src, pl), mv = [src, ri, pl.r, pl.c];
          f(res.s, pre ? [pre, mv] : [mv], res, pl);
        }
      }
    }
    from(s, 0, null);
    if (s.hold >= 0) from(s, 1, null);
    if (ctx.hold && s.hold < 0 && s.idx + 1 < L) from(stash(s), 0, [2]);
  }

  // 盤のよさ（solver のしぼりこみ用。大きいほどよい）
  function heur(ctx, s) {
    var h = 0;
    ctx.goals.forEach(function (g) { h += goalProgress(ctx, s, g) * 60; });
    var filled = popc(s.fL & ~ctx.bL) + popc(s.fH & ~ctx.bH);
    if (ctx.noClear) return h + holesPenalty(ctx, s) * -8;
    return h - filled * 1.2 - holesPenalty(ctx, s) * 3 + (s.hold >= 0 ? 0.5 : 0);
  }
  // まわりがぜんぶうまっている空きマスの数
  function holesPenalty(ctx, s) {
    var N = ctx.N, n = 0;
    for (var b = 0; b < N * N; b++) {
      if (has(s.fL, s.fH, b)) continue;
      var r = Math.floor(b / N), c = b % N, open = 0;
      if (r > 0 && !has(s.fL, s.fH, b - N)) open++;
      if (r < N - 1 && !has(s.fL, s.fH, b + N)) open++;
      if (c > 0 && !has(s.fL, s.fH, b - 1)) open++;
      if (c < N - 1 && !has(s.fL, s.fH, b + 1)) open++;
      if (!open) n++;
    }
    return n;
  }

  // ---------- solver（1個置くごとに、ありえる盤を全部ならべる。多すぎたら よい順に cap 個だけのこす） ----------
  // 返り値 { path: [move…], placed, left, exact, nodes } / とどかなければ null
  function solve(ctx, s0, opts) {
    opts = opts || {};
    var cap = opts.cap || 4000, deadline = opts.ms ? Date.now() + opts.ms : 0, exact = true, nodes = 0;
    var layer = [{ s: s0, par: null, mv: null }];
    if (goalDone(ctx, s0)) return { path: [], placed: 0, left: left(ctx, s0), exact: true, nodes: 0 };
    while (layer.length) {
      var next = [], seen = {}, found = null;
      for (var i = 0; i < layer.length && !found; i++) {
        var node = layer[i];
        eachPlacement(ctx, node.s, function (s2, mv) {
          if (found) return;
          nodes++;
          var nd = { s: s2, par: node, mv: mv };
          if (goalDone(ctx, s2)) { found = nd; return; }
          var kk = key(s2);
          if (seen[kk]) return;
          seen[kk] = 1;
          next.push(nd);
        });
        if (deadline && (i & 63) === 0 && Date.now() > deadline) return null;
      }
      if (found) {
        var path = [], n = found;
        while (n.par) { for (var m = n.mv.length - 1; m >= 0; m--) path.unshift(n.mv[m]); n = n.par; }
        return { path: path, placed: found.s.placed, left: left(ctx, found.s), exact: exact, nodes: nodes };
      }
      if (next.length > cap) {
        exact = false;
        next.forEach(function (x) { x.h = heur(ctx, x.s); });
        next.sort(function (a, b) { return b.h - a.h; });
        next.length = cap;
      }
      layer = next;
    }
    return null;
  }

  // 手順をはじめから流す（verify 用）。{ ok, s, err }
  function replay(ctx, path) {
    var s = initState(ctx);
    for (var i = 0; i < path.length; i++) {
      var mv = path[i];
      if (goalDone(ctx, s)) return { ok: false, err: '目標のあとに手がある', s: s };
      if (mv[0] === 2) {
        if (!ctx.hold || s.hold >= 0 || s.idx >= ctx.pieces.length) return { ok: false, err: '小皿に入れられない（' + i + '手目）', s: s };
        s = stash(s); continue;
      }
      var pi = mv[0] === 1 ? s.hold : s.idx;
      if (pi < 0 || pi >= ctx.pieces.length) return { ok: false, err: 'おかずがない（' + i + '手目）', s: s };
      var p = ctx.pieces[pi];
      if (p.fix && mv[1] !== p.r0) return { ok: false, err: '回せないおかずを回した（' + i + '手目）', s: s };
      var pl = placeAt(ctx, p.k, mv[1], mv[2], mv[3]);
      if (!pl || !fits(s, pl)) return { ok: false, err: '置けない（' + i + '手目）', s: s };
      s = apply(ctx, s, mv[0], pl).s;
    }
    return { ok: goalDone(ctx, s), s: s, err: goalDone(ctx, s) ? null : '目標にとどかない' };
  }

  // ---------- たね付きの乱数（どの端末でも同じ） ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  // ---------- おためしプレイヤー（むずかしさをはかる。ふつうの人のように、すきまの少ない所・列が消える所をえらびがち） ----------
  function casualMove(ctx, s, R) {
    var opts = [], tot = 0, h0 = ctx.noClear ? holesPenalty(ctx, s) : 0;
    eachPlacement(ctx, s, function (s2, mv, res, pl) {
      if (mv.length > 1) return;   // 小皿は下でまとめて考える
      var contact = pl.wall + popc(pl.nbL & s.fL) + popc(pl.nbH & s.fH);
      var w = Math.pow(1 + contact, 1.6) * (res.n ? 3 + 3 * res.n : 1);
      // ぴったりつめるときは、1マスだけの すきまを作る置き方を さける（人もそうする）
      if (ctx.noClear) w *= Math.pow(0.15, Math.max(0, holesPenalty(ctx, s2) - h0));
      if (ctx.foodGoal && res.eatenK) w *= 2;
      if (res.rice) w *= 1.5;
      opts.push({ s: s2, w: w, res: res, mv: mv }); tot += w;
    });
    var canStash = ctx.hold && s.hold < 0 && s.idx + 1 < ctx.pieces.length;
    if (canStash && (!opts.length || R() < 0.15)) return { s: stash(s), mv: [2], res: null };
    if (!opts.length) return null;
    var x = R() * tot;
    for (var i = 0; i < opts.length; i++) { x -= opts[i].w; if (x <= 0) return opts[i]; }
    return opts[opts.length - 1];
  }
  // trials 回あそんで、クリアした割合（rate）と ★3 の割合（rate3）
  function casual(ctx, trials, seed, star3Left) {
    var R = rng(seed || 1), win = 0, win3 = 0;
    for (var t = 0; t < trials; t++) {
      var s = initState(ctx), guard = 0;
      while (!goalDone(ctx, s) && guard++ < 200) {
        var m = casualMove(ctx, s, R);
        if (!m) break;
        s = m.s;
      }
      if (goalDone(ctx, s)) { win++; if (star3Left == null || left(ctx, s) >= star3Left) win3++; }
    }
    return { rate: win / trials, rate3: win3 / trials };
  }

  // ---------- ★ ----------
  // ふつう: のこりおかず star[0] 個以上で★3、star[1] 個以上で★2。ぴったり（fill）: もどした回数 0 回で★3、starUndo 回までで★2
  function starsFor(stage, leftN, undos) {
    if (stage.goals && stage.goals.length && stage.goals[0].t === 'fill') return undos <= 0 ? 3 : undos <= (stage.starUndo || 2) ? 2 : 1;
    return leftN >= stage.star[0] ? 3 : leftN >= stage.star[1] ? 2 : 1;
  }

  // ★はタイムで決める（1.0.3 から。前は のこしたおかず・もどした回数。もどし・まちがいでは へらさない）
  //   ★3 = 10秒 ＋ こたえの手数 × 4秒（ぴったりは 6秒）＋ (おべんとうの大きさ − 5) × 5秒（5秒きざみ）／ ★2 = その 2.5 倍（10秒きざみ）／ ★1 = クリア
  //   ヒント1回 +30秒
  var HINT_SEC = 30;
  function starTimes(stage) {
    var n = stage.sol ? stage.sol.length : (stage.pieces || []).length, fill = stage.goals && stage.goals[0] && stage.goals[0].t === 'fill';
    var t3 = Math.ceil((10 + n * (fill ? 6 : 4) + ((stage.size || 5) - 5) * 5) / 5) * 5;
    return [t3, Math.ceil(t3 * 2.5 / 10) * 10];
  }
  function starsByTime(stage, sec, hints) { var t = starTimes(stage), x = sec + (hints || 0) * HINT_SEC; return x <= t[0] ? 3 : x <= t[1] ? 2 : 1; }

  // ---------- 今日のおべんとう（日本時間の日付から。だれの端末でも同じ） ----------
  var DAILY_VERSION = 1;
  var DAILY_WEIGHTS = { ume: 4, edamame: 8, wiener: 9, brocco: 10, tamago: 8, karaage: 9, ebi: 9, onigiri: 9, napo: 7, hamburg: 5, shake: 3 };
  function dayKey(now) {
    var d = new Date((now == null ? Date.now() : now) + 9 * 3600000), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function pickW(R, weights) {
    var ks = Object.keys(weights), tot = 0, i;
    for (i = 0; i < ks.length; i++) tot += weights[ks[i]];
    var x = R() * tot;
    for (i = 0; i < ks.length; i++) { x -= weights[ks[i]]; if (x < 0) return ks[i]; }
    return ks[ks.length - 1];
  }
  // ごはんのかたまりを置く（ランダムに広げる）。map は文字の配列の配列
  function growBlob(map, N, R, n, ch) {
    var tries = 0;
    while (n > 0 && tries++ < 200) {
      var r = Math.floor(R() * N), c = Math.floor(R() * N);
      if (map[r][c] !== '.') continue;
      var size = Math.min(n, 1 + Math.floor(R() * 4)), q = [[r, c]];
      while (size > 0 && q.length) {
        var p = q.splice(Math.floor(R() * q.length), 1)[0];
        if (map[p[0]][p[1]] !== '.') continue;
        map[p[0]][p[1]] = ch; size--; n--;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var rr = p[0] + d[0], cc = p[1] + d[1];
          if (rr >= 0 && cc >= 0 && rr < N && cc < N && map[rr][cc] === '.') q.push([rr, cc]);
        });
      }
    }
  }
  function anyFullLine(map, N) {
    for (var i = 0; i < N; i++) {
      var row = true, col = true, rowAllB = true, colAllB = true;
      for (var j = 0; j < N; j++) {
        if (map[i][j] === '.') row = false;
        if (map[j][i] === '.') col = false;
        if (map[i][j] !== '#') rowAllB = false;
        if (map[j][i] !== '#') colAllB = false;
      }
      if ((row && !rowAllB) || (col && !colAllB)) return true;
    }
    return false;
  }
  function dailyStage(day) {
    var R = rng(hash('okazu-daily-v' + DAILY_VERSION + '-' + day)), N = 7, map, guard = 0;
    do {
      map = [];
      for (var r = 0; r < N; r++) { map.push([]); for (var c = 0; c < N; c++) map[r].push('.'); }
      growBlob(map, N, R, 5 + Math.floor(R() * 5), 'o');
      var nb = Math.floor(R() * 3);
      for (var k = 0; k < nb; k++) { var rr = 1 + Math.floor(R() * (N - 2)), cc = 1 + Math.floor(R() * (N - 2)); if (map[rr][cc] === '.') map[rr][cc] = '#'; }
    } while (anyFullLine(map, N) && guard++ < 20);
    var pieces = [], last = '';
    for (var i = 0; i < 40; i++) {
      var kd = pickW(R, DAILY_WEIGHTS);
      if (kd === last && R() < 0.6) kd = pickW(R, DAILY_WEIGHTS);   // 同じおかずが続きすぎないように
      last = kd;
      pieces.push(kd + ':' + Math.floor(R() * FOODS[kd].rots.length));
    }
    return { id: 'daily-' + day, daily: true, day: day, name: '今日のおべんとう', size: N, map: map.map(function (x) { return x.join(''); }),
      pieces: pieces, goals: [], hold: true, score: true };
  }
  // 今日のおべんとうの点: 1度に消した列 n 本 → 100 × n × n。つづけて消すと +50 × (つづけた回数-1)。
  // ごはん1マス +10。消したあと お弁当箱がからっぽ（バランだけ）になったら +1000
  function scoreFor(res, streak, emptied) {
    if (!res || !res.n) return 0;
    return 100 * res.n * res.n + 50 * Math.max(0, streak - 1) + 10 * res.rice + (emptied ? 1000 : 0);
  }
  function isEmpty(ctx, s) { return (s.fL & ~ctx.bL) === 0 && (s.fH & ~ctx.bH) === 0; }

  // ---------- 今日のおべんとう（1.0.4 から。みんな同じ1問の「ぴったりつめる」パズル） ----------
  // 6×6 のお弁当箱（バラン 2〜5 マス）を、おかずで ばらばらにしきって作るので、かならず ぴったりつめられる（sol がその1つ）。
  // おかずは まぜた順で出てくる（はじめの向きもばらばら）。小皿あり・列は消えない。
  // 記録: のこったおかずが少ないほど上 → やりなおし（さいしょから）が少ないほど上 → タイムが短いほど上（dailyRecord）
  // 作り方を変えたら DAILY_P_VERSION を上げる（上げると過去の日の問題もかわる）
  var DAILY_P_VERSION = 1;
  var DAILY_P_KINDS = ['edamame', 'wiener', 'brocco', 'tamago', 'karaage', 'ebi', 'onigiri', 'napo', 'hamburg', 'ume'];
  // まぜる（sort に乱数をわたすと、ブラウザによって順がかわるので使わない）
  function shuffle(a, R) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function dailyPuzzle(day) {
    var R = rng(hash('okazu-daily-p' + DAILY_P_VERSION + '-' + day)), N = 6;
    for (var tries = 0; tries < 200; tries++) {
      var map = [], r, c;
      for (r = 0; r < N; r++) { map.push([]); for (c = 0; c < N; c++) map[r].push('.'); }
      var nb = 2 + Math.floor(R() * 4);
      for (var k = 0; k < nb; k++) { r = Math.floor(R() * N); c = Math.floor(R() * N); map[r][c] = '#'; }
      var cells = map.map(function (row) { return row.map(function (x) { return x === '#' ? 1 : 0; }); });
      var tiles = [], steps = 0;
      var first = function () { for (var rr = 0; rr < N; rr++) for (var cc = 0; cc < N; cc++) if (!cells[rr][cc]) return [rr, cc]; return null; };
      var rec = function () {
        if (steps++ > 20000) return false;
        var f = first();
        if (!f) return true;
        var order = shuffle(DAILY_P_KINDS.slice(), R);
        for (var i = 0; i < order.length; i++) {
          var kd = order[i];
          if (FOODS[kd].cells.length <= 2 && R() < 0.7) continue;   // 小さいおかずばかりにならないように
          var rs = FOODS[kd].rots;
          for (var ri = 0; ri < rs.length; ri++) {
            var sh = rs[ri], top = null;
            sh.forEach(function (q) { if (q[0] === 0 && (!top || q[1] < top[1])) top = q; });
            var r0 = f[0] - top[0], c0 = f[1] - top[1], ok = true;
            sh.forEach(function (q) { var y = r0 + q[0], x = c0 + q[1]; if (y < 0 || x < 0 || y >= N || x >= N || cells[y][x]) ok = false; });
            if (!ok) continue;
            sh.forEach(function (q) { cells[r0 + q[0]][c0 + q[1]] = 1; });
            tiles.push({ k: kd, rot: ri, r: r0, c: c0 });
            if (rec()) return true;
            tiles.pop();
            sh.forEach(function (q) { cells[r0 + q[0]][c0 + q[1]] = 0; });
          }
        }
        return false;
      };
      if (!rec() || tiles.length < 7 || tiles.length > 11) continue;
      shuffle(tiles, R);
      var st = { id: 'dailyp-' + day, daily: true, day: day, name: '今日のおべんとう', size: N, map: map.map(function (x) { return x.join(''); }),
        noClear: true, hold: true, goals: [{ t: 'fill' }] };
      st.pieces = tiles.map(function (t) { var n = FOODS[t.k].rots.length; return t.k + (n > 1 ? ':' + Math.floor(R() * n) : ''); });
      st.sol = tiles.map(function (t) { return [0, t.rot, t.r, t.c]; });
      return st;
    }
    return null;
  }
  // 今日のおべんとうの記録（大きいほど上）= (40 − のこり) × 1000万 ＋ (99 − やりなおし) × 10万 ＋ (99999 − タイム 0.1秒)
  function dailyRecord(left, restarts, t10) {
    return (40 - Math.min(40, left)) * 10000000 + (99 - Math.min(99, restarts)) * 100000 + (99999 - Math.max(30, Math.min(99999, Math.round(t10))));
  }
  function dailyDecode(v) { return { left: 40 - Math.floor(v / 10000000), restarts: 99 - Math.floor(v / 100000) % 100, t10: 99999 - v % 100000 }; }

  var OB = {
    FOODS: FOODS, KINDS: KINDS, rots: rots, popc: popc, has: has, bitLo: bitLo, bitHi: bitHi, parsePiece: parsePiece,
    makeCtx: makeCtx, placesFor: placesFor, placeAt: placeAt, initState: initState, copy: copy, fits: fits, apply: apply, stash: stash,
    goalDone: goalDone, goalProgress: goalProgress, left: left, pieceFits: pieceFits, stuck: stuck, key: key,
    eachPlacement: eachPlacement, heur: heur, solve: solve, replay: replay, rng: rng, hash: hash, casual: casual, casualMove: casualMove,
    starsFor: starsFor, starTimes: starTimes, starsByTime: starsByTime, HINT_SEC: HINT_SEC, DAILY_VERSION: DAILY_VERSION, dayKey: dayKey, dailyStage: dailyStage, scoreFor: scoreFor, isEmpty: isEmpty,
    DAILY_P_VERSION: DAILY_P_VERSION, dailyPuzzle: dailyPuzzle, dailyRecord: dailyRecord, dailyDecode: dailyDecode,
    growBlob: growBlob, anyFullLine: anyFullLine, pickW: pickW
  };
  root.OB = OB;
  if (typeof module !== 'undefined') module.exports = OB;
})(this);

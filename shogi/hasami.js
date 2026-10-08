/* 変則将棋 — はさみ将棋（9×9。歩を縦横にすべらせて、相手の駒をはさんで取る）
   盤: b[y*9+x]。先手（下）の駒は 1、後手（上）の駒は -1。
   取り方: 動かした駒と、もう1枚の自分の駒で、縦か横に並んだ相手の駒（1枚でも何枚でも）をはさむと取れる。
   すみ（四隅）の駒は、となりの2マスを両方ふさぐと取れる。自分から相手の間に入っても取られない。
   勝ち: 相手の駒を先に5枚取る（オプションで「1枚以下になるまで」）。相手が動けなくなっても勝ち */
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};
  var W = 9, H = 9, N = 81;
  var DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  var CORNERS = [[0, 1, 9], [8, 7, 17], [72, 63, 73], [80, 71, 79]];   // [すみ, となり, となり]

  function init(opts) {
    var b = new Array(N).fill(0);
    for (var x = 0; x < W; x++) { b[x] = -1; b[72 + x] = 1; }
    return { b: b, turn: 0, cap: [0, 0], last: null, ply: 0, goal: opts && opts.all ? 8 : 5, gotSq: [] };
  }
  function mine(p) { return p === 0 ? 1 : -1; }

  function pseudo(s) {
    var b = s.b, me = mine(s.turn), out = [];
    for (var i = 0; i < N; i++) {
      if (b[i] !== me) continue;
      var x = i % W, y = (i - x) / W;
      for (var k = 0; k < 4; k++) {
        var nx = x, ny = y;
        for (;;) {
          nx += DIRS[k][0]; ny += DIRS[k][1];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;
          var j = ny * W + nx; if (b[j]) break;
          out.push({ f: i, t: j });
        }
      }
    }
    return out;
  }
  // 動かしたあとに取れる駒のマス
  function captures(b, t, me) {
    var got = [], x = t % W, y = (t - x) / W, k;
    for (k = 0; k < 4; k++) {
      var nx = x + DIRS[k][0], ny = y + DIRS[k][1], line = [];
      while (nx >= 0 && nx < W && ny >= 0 && ny < H && b[ny * W + nx] === -me) { line.push(ny * W + nx); nx += DIRS[k][0]; ny += DIRS[k][1]; }
      if (line.length && nx >= 0 && nx < W && ny >= 0 && ny < H && b[ny * W + nx] === me) got = got.concat(line);
    }
    // すみの駒: となり2マスが両方とも自分の駒（いま動かした駒がそのどちらか）
    for (k = 0; k < 4; k++) {
      var c = CORNERS[k];
      if (b[c[0]] === -me && (t === c[1] || t === c[2]) && b[c[1]] === me && b[c[2]] === me && got.indexOf(c[0]) < 0) got.push(c[0]);
    }
    return got;
  }
  function apply(s, m) {
    var b = s.b.slice(), me = mine(s.turn);
    b[m.f] = 0; b[m.t] = me;
    var got = captures(b, m.t, me);
    for (var k = 0; k < got.length; k++) b[got[k]] = 0;
    var cap = s.cap.slice(); cap[s.turn] += got.length;
    return { b: b, turn: 1 - s.turn, cap: cap, last: { f: m.f, t: m.t }, ply: s.ply + 1, goal: s.goal, gotSq: got };
  }
  function moves(s) { return over(s) ? [] : pseudo(s); }
  function play(s, m) {
    if (!pseudo(s).some(function (x) { return x.f === m.f && x.t === m.t; })) throw new Error('illegal');
    return apply(s, m);
  }
  function over(s) {
    if (s.cap[0] >= s.goal) return { winner: 0, text: '先手が ' + s.cap[0] + ' 枚取った！' };
    if (s.cap[1] >= s.goal) return { winner: 1, text: '後手が ' + s.cap[1] + ' 枚取った！' };
    if (!pseudo(s).length) return { winner: 1 - s.turn, text: '動ける駒がない' };
    if (s.ply >= 300) {
      if (s.cap[0] === s.cap[1]) return { winner: -1, text: '300手で同じ枚数。引き分け' };
      return { winner: s.cap[0] > s.cap[1] ? 0 : 1, text: '300手で取った数が多いほうの勝ち' };
    }
    return null;
  }
  function key(s) { return s.b.join('') + s.turn; }
  function repetition(hist) {
    var k = key(hist[hist.length - 1]), c = 0;
    for (var i = 0; i < hist.length; i++) if (key(hist[i]) === k) c++;
    if (c < 4) return null;
    var s = hist[hist.length - 1];
    if (s.cap[0] === s.cap[1]) return { winner: -1, text: '同じ形が4回。引き分け' };
    return { winner: s.cap[0] > s.cap[1] ? 0 : 1, text: '同じ形が4回。取った数が多いほうの勝ち' };
  }

  // ---- CPU ----
  // 取った数の差＋「次に取られそうな駒」の減点＋前に出すぎない
  function threatened(b, me) {
    var n = 0, x, y, i;
    for (i = 0; i < N; i++) {
      if (b[i] !== me) continue;
      x = i % W; y = (i - x) / W;
      // 左右か上下の片方に敵がいて、反対側が空いている → 相手が来たら取られる
      if (x > 0 && x < W - 1) { var l = b[i - 1], r = b[i + 1]; if ((l === -me && r === 0) || (r === -me && l === 0)) n++; }
      if (y > 0 && y < H - 1) { var u = b[i - W], d = b[i + W]; if ((u === -me && d === 0) || (d === -me && u === 0)) n++; }
    }
    return n;
  }
  function evaluate(s) {
    var me = mine(s.turn), v = (s.cap[s.turn] - s.cap[1 - s.turn]) * 1000;
    v -= threatened(s.b, me) * 140;
    v += threatened(s.b, -me) * 90;
    return v;
  }
  function order(s, ms) {
    var me = mine(s.turn);
    ms.forEach(function (m) { var b = s.b.slice(); b[m.f] = 0; b[m.t] = me; m.o = captures(b, m.t, me).length * 10 + Math.random(); });
    ms.sort(function (a, b) { return b.o - a.o; });
    return ms;
  }
  var WIN = 1e6;
  function negamax(s, depth, alpha, beta, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 511) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    var o = over(s);
    if (o) return o.winner === -1 ? 0 : o.winner === s.turn ? WIN - s.ply : -(WIN - s.ply);
    if (depth <= 0 || ctx.stop) return evaluate(s);
    var ms = order(s, pseudo(s)), best = -Infinity;
    for (var k = 0; k < ms.length; k++) {
      var v = -negamax(apply(s, ms[k]), depth - 1, -beta, -alpha, ctx);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta || ctx.stop) break;
    }
    return best;
  }
  function ai(s, level, timeMs) {
    var ms = order(s, pseudo(s)); if (ms.length === 1) return ms[0];
    var maxDepth = level === 0 ? 1 : level === 1 ? 2 : 5;
    var ctx = { nodes: 0, deadline: Date.now() + (timeMs || (level === 2 ? 1600 : 500)), stop: false };
    var bestMove = ms[0];
    for (var d = 1; d <= maxDepth; d++) {
      var bm = null, bv = -Infinity, alpha = -Infinity;
      for (var k = 0; k < ms.length; k++) {
        var v = -negamax(apply(s, ms[k]), d - 1, -Infinity, -alpha, ctx);
        if (level === 0) v += Math.random() * 1500;
        else if (level === 1) v += Math.random() * 120;
        if (ctx.stop && d > 1) break;
        if (v > bv) { bv = v; bm = ms[k]; }
        if (v > alpha) alpha = v;
      }
      if (ctx.stop && d > 1) break;
      if (bm) bestMove = bm;
      ms.sort(function (a, b) { return a === bestMove ? -1 : b === bestMove ? 1 : 0; });
    }
    return bestMove;
  }

  HS.hasami = {
    W: W, H: H, init: init, moves: moves, play: play, over: over, repetition: repetition, apply: apply,
    pseudo: pseudo, captures: captures, ai: ai, key: key, evaluate: evaluate
  };
})(this);

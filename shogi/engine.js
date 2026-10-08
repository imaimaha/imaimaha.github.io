/* 変則将棋 — ルールの心臓部（盤の大きさ・駒の種類・初期配置・成れる段数を変えられる将棋）
   ボードゲーム箱の 5五将棋（BoardBox/minishogi.js）を、どんな盤・どんな駒でも動くように広げたもの。
   盤: b[y*w+x]（y=0 がいちばん上＝後手の陣）。先手の駒は正の数、後手の駒は負の数。
   s = { b, hand: [先手の持ち駒[], 後手の持ち駒[]], turn, last, ply, check }
   ブラウザでも jsc（テスト・詰将棋の検証）でも動くように、DOM は使わない */
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};

  // ===================== 駒 =====================
  // 動きは先手から見た向き（y がマイナス＝前）。steps は1回だけの移動（跳ぶ駒もここ）、slides はまっすぐ何マスでも。
  // cannon は「大砲」: 縦横にすべるように動き、取るときだけ駒を1枚はさんで向こうの駒を取る
  var ORTH = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  var DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  var KING = ORTH.concat(DIAG);
  var GOLD = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  var SILVER = [[0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  var KNIGHT8 = [[-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2]];
  var FROG = [[0, -2], [-2, 0], [2, 0], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]];

  // n: 表示する字 / prom: 成ったらどの駒か / base: 成り駒のもと / v: CPU の値打ち / dead: 行き所がなくなる奥の段数
  var DEF = {
    1: { n: '歩', name: '歩兵', steps: [[0, -1]], prom: 9, v: 100, dead: 1 },
    2: { n: '香', name: '香車', slides: [[0, -1]], prom: 10, v: 300, dead: 1 },
    3: { n: '桂', name: '桂馬', steps: [[-1, -2], [1, -2]], prom: 11, v: 350, dead: 2 },
    4: { n: '銀', name: '銀将', steps: SILVER, prom: 12, v: 500 },
    5: { n: '金', name: '金将', steps: GOLD, v: 600 },
    6: { n: '角', name: '角行', slides: DIAG, prom: 13, v: 800 },
    7: { n: '飛', name: '飛車', slides: ORTH, prom: 14, v: 1000 },
    8: { n: '玉', name: '玉将', steps: KING, royal: true, v: 0 },
    9: { n: 'と', name: 'と金', steps: GOLD, base: 1, v: 620 },
    10: { n: '杏', name: '成香', steps: GOLD, base: 2, v: 620 },
    11: { n: '圭', name: '成桂', steps: GOLD, base: 3, v: 620 },
    12: { n: '全', name: '成銀', steps: GOLD, base: 4, v: 620 },
    13: { n: '馬', name: '竜馬', slides: DIAG, steps: ORTH, base: 6, v: 1150 },
    14: { n: '龍', name: '竜王', slides: ORTH, steps: DIAG, base: 7, v: 1350 },
    // ---- オリジナルの駒 ----
    15: { n: '忍', name: '忍者', steps: KNIGHT8, prom: 18, v: 650 },          // 桂馬の跳び方を8方向に。駒を跳びこえる
    16: { n: '砲', name: '大砲', cannon: true, prom: 19, v: 800 },            // 縦横にすべる。取るときは1枚はさんで撃つ
    17: { n: '蛙', name: '蛙', steps: FROG, prom: 20, v: 550 },               // 縦横ななめに、ちょうど2マス跳ぶ
    18: { n: '影', name: '影（成忍）', steps: KNIGHT8.concat(KING), base: 15, v: 1000 },
    19: { n: '轟', name: '轟（成砲）', cannon: true, steps: DIAG, base: 16, v: 1000 },
    20: { n: '跳', name: '跳（成蛙）', steps: FROG.concat(KING), base: 17, v: 850 }
  };
  var KINGT = 8, PAWN = 1;
  HS.DEF = DEF;
  HS.NAME_TO_T = {};
  for (var t in DEF) HS.NAME_TO_T[DEF[t].n] = +t;
  HS.NAME_TO_T['王'] = KINGT;

  function owner(v) { return v > 0 ? 0 : v < 0 ? 1 : -1; }
  function kind(v) { return v < 0 ? -v : v; }
  function base(t) { return DEF[t].base || t; }

  // ===================== 変則ルール（バリアント）を組み立てる =====================
  // def: { id, title, w, h, zone, rows: ['v飛 v角 v王 . .', ...], hand0, hand1, royal: 'check'|'capture', rep: 'sente'|'draw', maxPly }
  function parseRows(rows, w, h) {
    var b = new Array(w * h).fill(0);
    if (rows.length !== h) throw new Error('rows ' + rows.length + ' != ' + h);
    for (var y = 0; y < h; y++) {
      var cells = rows[y].trim().split(/\s+/);
      if (cells.length !== w) throw new Error('row ' + y + ' has ' + cells.length);
      for (var x = 0; x < w; x++) {
        var c = cells[x]; if (c === '.' || c === '・') continue;
        var gote = c[0] === 'v'; if (gote) c = c.slice(1);
        var t = HS.NAME_TO_T[c]; if (!t) throw new Error('unknown piece ' + c);
        b[y * w + x] = gote ? -t : t;
      }
    }
    return b;
  }
  HS.parseRows = parseRows;

  function makeVariant(def) {
    var V = {};
    for (var k in def) V[k] = def[k];
    V.n = V.w * V.h;
    V.zone = V.zone || 1;
    V.royal = V.royal || 'check';
    V.rep = V.rep || 'draw';
    V.maxPly = V.maxPly || (V.n > 50 ? 500 : 300);
    V.drops = V.drops !== false;
    V.start = parseRows(V.rows, V.w, V.h);
    // 持ち駒になりうる駒（初期配置にある駒のもと＋最初の持ち駒）
    var set = {};
    for (var i = 0; i < V.n; i++) if (V.start[i]) { var tt = base(kind(V.start[i])); if (!DEF[tt].royal) set[tt] = 1; }
    (V.extraHand || []).forEach(function (x) { set[x] = 1; });
    V.handTypes = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    V.handIdx = {};
    V.handTypes.forEach(function (x, j) { V.handIdx[x] = j; });
    return V;
  }
  HS.makeVariant = makeVariant;

  function emptyHand(V) { return V.handTypes.map(function () { return 0; }); }
  function init(V) {
    return { b: V.start.slice(), hand: [emptyHand(V), emptyHand(V)], turn: V.firstTurn || 0, last: null, ply: 0, check: false };
  }
  HS.init = init;

  // y が p から見て「奥から何段目」か（0 がいちばん奥）
  function depthFor(V, y, p) { return p === 0 ? y : V.h - 1 - y; }
  function inZone(V, y, p) { return depthFor(V, y, p) < V.zone; }
  function deadAt(V, t, y, p) { var d = DEF[t].dead; return !!d && depthFor(V, y, p) < d; }

  // ===================== 利き =====================
  // 安南の仲間（V.an = [dx, dy]、自分から見た向き）: その方向のとなりに味方の駒がいれば、その駒の動きになる。
  //   安南 [0, 1] = うしろ / 安北 [0, -1] = 前 / 安東 [1, 0] = 右どなり / 安西 [-1, 0] = 左どなり（どれも、その駒の持ち主から見た向き）
  function moveKind(V, b, i) {
    var v = b[i], t = kind(v);
    if (!V.an) return t;
    var p = owner(v), dir = p === 0 ? 1 : -1, w = V.w, x = i % w, y = (i - x) / w;
    var ax = x + V.an[0] * dir, ay = y + V.an[1] * dir;
    if (ax < 0 || ax >= w || ay < 0 || ay >= V.h) return t;
    var u = b[ay * w + ax];
    return u && owner(u) === p ? kind(u) : t;
  }
  function targets(V, b, i, out) {
    var v = b[i], p = owner(v), t = moveKind(V, b, i), w = V.w, h = V.h, x = i % w, y = (i - x) / w, dir = p === 0 ? 1 : -1, k, nx, ny, j, d = DEF[t];
    var st = d.steps;
    if (st) for (k = 0; k < st.length; k++) {
      nx = x + st[k][0] * dir; ny = y + st[k][1] * dir;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      j = ny * w + nx; if (b[j] && owner(b[j]) === p) continue;
      out.push(j);
    }
    var sl = d.slides;
    if (sl) for (k = 0; k < sl.length; k++) {
      nx = x; ny = y;
      for (;;) {
        nx += sl[k][0] * dir; ny += sl[k][1] * dir;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) break;
        j = ny * w + nx;
        if (b[j]) { if (owner(b[j]) !== p) out.push(j); break; }
        out.push(j);
      }
    }
    if (d.cannon) for (k = 0; k < 4; k++) {
      nx = x; ny = y; var screen = false;
      for (;;) {
        nx += ORTH[k][0]; ny += ORTH[k][1];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) break;
        j = ny * w + nx;
        if (!screen) {
          if (b[j]) { screen = true; continue; }
          out.push(j);                       // 空いているマスへは、ふつうに動ける
        } else if (b[j]) {
          if (owner(b[j]) !== p) out.push(j); // 1枚はさんだ向こうの敵を撃つ
          break;
        }
      }
    }
    return out;
  }
  // sq に by の駒が利いているか（大砲の「空きマスへの移動」は利きに数えない）
  function attacked(V, b, sq, by) {
    var tmp = [];
    for (var i = 0; i < V.n; i++) {
      if (!b[i] || owner(b[i]) !== by) continue;
      tmp.length = 0; targets(V, b, i, tmp);
      if (tmp.indexOf(sq) >= 0) {
        if (DEF[moveKind(V, b, i)].cannon && !b[sq]) {
          // 空きマスへの「移動」と「利き」を区別する（王手判定は玉がいるマスなので、ここには来ない）
          continue;
        }
        return true;
      }
    }
    return false;
  }
  function kingSquares(V, b, p) {
    var out = [], k = p === 0 ? KINGT : -KINGT;
    for (var i = 0; i < V.n; i++) if (b[i] === k) out.push(i);
    return out;
  }
  function inCheck(V, s, p) {
    if (V.royal !== 'check') return false;
    var ks = kingSquares(V, s.b, p);
    for (var k = 0; k < ks.length; k++) if (attacked(V, s.b, ks[k], 1 - p)) return true;
    return false;
  }

  // ===================== 手の生成 =====================
  function pseudoMoves(V, s) {
    var b = s.b, p = s.turn, out = [], tmp = [], i, k, w = V.w;
    for (i = 0; i < V.n; i++) {
      if (!b[i] || owner(b[i]) !== p) continue;
      var t = kind(b[i]), fy = (i / w) | 0, canPr = !!DEF[t].prom;
      tmp.length = 0; targets(V, b, i, tmp);
      for (k = 0; k < tmp.length; k++) {
        var j = tmp[k], ty = (j / w) | 0;
        var zone = canPr && (inZone(V, fy, p) || inZone(V, ty, p));
        var must = deadAt(V, t, ty, p);
        if (!must) out.push({ f: i, t: j, pr: false, cap: b[j] });
        if (zone) out.push({ f: i, t: j, pr: true, cap: b[j] });
      }
    }
    if (V.drops) {
      var hnd = s.hand[p];
      for (k = 0; k < V.handTypes.length; k++) {
        if (!hnd[k]) continue;
        var dt = V.handTypes[k];
        for (i = 0; i < V.n; i++) {
          if (b[i]) continue;
          var y = (i / w) | 0;
          if (deadAt(V, dt, y, p)) continue;               // 行き所のない駒は打てない
          if (dt === PAWN) {                               // 二歩
            var col = i % w, two = false, me = p === 0 ? PAWN : -PAWN;
            for (var yy = 0; yy < V.h; yy++) if (b[yy * w + col] === me) { two = true; break; }
            if (two) continue;
          }
          out.push({ f: -1, t: i, d: dt, cap: 0 });
        }
      }
    }
    return out;
  }
  function apply(V, s, m) {
    var b = s.b.slice(), hand = [s.hand[0].slice(), s.hand[1].slice()], p = s.turn, sign = p === 0 ? 1 : -1;
    if (m.f < 0) {
      b[m.t] = m.d * sign; hand[p][V.handIdx[m.d]]--;
    } else {
      var v = b[m.f], cap = b[m.t];
      if (cap) { var ct = base(kind(cap)); if (!DEF[ct].royal && V.handIdx[ct] !== undefined) hand[p][V.handIdx[ct]]++; }
      b[m.f] = 0;
      b[m.t] = m.pr ? DEF[kind(v)].prom * sign : v;
    }
    return { b: b, hand: hand, turn: 1 - p, last: m, ply: s.ply + 1, check: false };
  }
  // 打ち歩詰めかどうか（歩を打って王手し、相手に逃げ道がない）
  function isUchifuzume(V, s, m, n) {
    if (V.royal !== 'check' || m.f >= 0 || m.d !== PAWN) return false;
    if (!inCheck(V, n, 1 - s.turn)) return false;
    return !legalFrom(V, n, false).length;
  }
  function legalFrom(V, s, uchifu) {
    var ps = pseudoMoves(V, s), out = [], p = s.turn;
    for (var k = 0; k < ps.length; k++) {
      var n = apply(V, s, ps[k]);
      if (inCheck(V, n, p)) continue;                                  // 王手を放置できない
      if (uchifu && isUchifuzume(V, s, ps[k], n)) continue;           // 打ち歩詰め
      out.push(ps[k]);
    }
    return out;
  }
  function moves(V, s) { if (s.end) return []; return legalFrom(V, s, true); }
  function same(a, b) { return a.f === b.f && a.t === b.t && !!a.pr === !!b.pr && (a.d || 0) === (b.d || 0); }
  function play(V, s, m) {
    var ok = moves(V, s).some(function (x) { return same(x, m); });
    if (!ok) throw new Error('illegal ' + JSON.stringify(m));
    var n = apply(V, s, m);
    n.check = inCheck(V, n, n.turn);
    return n;
  }
  function kingsLeft(V, b, p) { return kingSquares(V, b, p).length; }
  function over(V, s) {
    if (s.end) return s.end;
    if (V.royal === 'capture') {
      if (!kingsLeft(V, s.b, 0)) return { winner: 1, text: '先手の王様が全部取られた' };
      if (!kingsLeft(V, s.b, 1)) return { winner: 0, text: '後手の王様が全部取られた' };
    }
    if (s.ply >= V.maxPly) return { winner: -1, text: '手数が長すぎるので引き分け' };
    if (moves(V, s).length) return null;
    return { winner: 1 - s.turn, text: inCheck(V, s, s.turn) ? '詰み！' : '指せる手がない' };
  }
  function key(s) { return s.b.join(',') + '|' + s.hand[0].join('.') + '|' + s.hand[1].join('.') + '|' + s.turn; }
  // 千日手: 同じ局面が4回。連続王手なら王手をかけた側の負け。それ以外はルールによって「先手の負け」か「引き分け」
  function repetition(V, hist) {
    var last = hist[hist.length - 1], k = key(last), idx = [];
    for (var i = 0; i < hist.length; i++) if (key(hist[i]) === k) idx.push(i);
    if (idx.length < 4) return null;
    var from = idx[0], checker = [true, true];
    for (i = from + 1; i < hist.length; i++) { var mover = 1 - hist[i].turn; if (!hist[i].check) checker[mover] = false; }
    if (V.royal === 'check') {
      if (checker[0]) return { winner: 1, text: '連続王手の千日手（先手の負け）' };
      if (checker[1]) return { winner: 0, text: '連続王手の千日手（後手の負け）' };
    }
    if (V.rep === 'sente') return { winner: 1, text: '千日手（先手の負け）' };
    return { winner: -1, text: '千日手で引き分け' };
  }

  // ===================== CPU =====================
  var WIN = 1000000;
  function evaluate(V, s) {
    var b = s.b, v = 0, i, w = V.w;
    for (i = 0; i < V.n; i++) {
      if (!b[i]) continue;
      var t = kind(b[i]), sg = b[i] > 0 ? 1 : -1, val = DEF[t].v;
      if (DEF[t].royal) val = V.royal === 'capture' ? 5000 : 0;
      if (t === PAWN) { var y = (i / w) | 0; val += (sg > 0 ? V.h - 1 - y : y) * (36 / V.h); }
      v += sg * val;
    }
    for (var k = 0; k < V.handTypes.length; k++) v += (s.hand[0][k] - s.hand[1][k]) * DEF[V.handTypes[k]].v * 1.1;
    // 玉のまわりの味方
    for (var p = 0; p < 2; p++) {
      var ks = kingSquares(V, b, p);
      for (var q = 0; q < ks.length; q++) {
        var kx = ks[q] % w, ky = (ks[q] - kx) / w, guard = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var x2 = kx + dx, y2 = ky + dy;
          if ((dx || dy) && x2 >= 0 && x2 < w && y2 >= 0 && y2 < V.h && b[y2 * w + x2] && owner(b[y2 * w + x2]) === p) guard++;
        }
        v += (p === 0 ? 1 : -1) * guard * 22;
      }
    }
    return s.turn === 0 ? v : -v;
  }
  function order(ms) {
    for (var k = 0; k < ms.length; k++) {
      var m = ms[k];
      m.o = (m.cap ? 10 * (DEF[kind(m.cap)].royal ? 100000 : DEF[kind(m.cap)].v) + 100 : 0) + (m.pr ? 300 : 0) + (m.f < 0 ? -50 : 0);
    }
    ms.sort(function (a, b) { return b.o - a.o; });
    return ms;
  }
  // 「王手放置で玉を取れる」局面は、直前の手が反則なので即勝ち（check ルール）。capture ルールでは玉を取ったら勝ち
  function negamax(V, s, depth, alpha, beta, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    if (V.royal === 'check') {
      var oks = kingSquares(V, s.b, 1 - s.turn);
      for (var q = 0; q < oks.length; q++) if (attacked(V, s.b, oks[q], s.turn)) return WIN;
    } else {
      if (!kingsLeft(V, s.b, s.turn)) return -(WIN - 1 - s.ply);
      if (!kingsLeft(V, s.b, 1 - s.turn)) return WIN - 1 - s.ply;
    }
    if (depth <= 0 || ctx.stop) return quiesce(V, s, alpha, beta, 4, ctx);
    var ms = order(pseudoMoves(V, s)), best = -WIN - 1, any = false;
    for (var k = 0; k < ms.length; k++) {
      var n = apply(V, s, ms[k]);
      var v = -negamax(V, n, depth - 1, -beta, -alpha, ctx);
      if (v === -WIN) continue;            // この手は王手放置
      any = true;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta || ctx.stop) break;
    }
    if (!any) return -(WIN - 1 - s.ply);   // どの手も負け＝詰み
    return best;
  }
  function quiesce(V, s, alpha, beta, left, ctx) {
    ctx.nodes++;
    var stand = evaluate(V, s);
    if (left <= 0) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var ms = pseudoMoves(V, s).filter(function (m) { return m.cap; });
    order(ms);
    for (var k = 0; k < ms.length; k++) {
      if (DEF[kind(ms[k].cap)].royal) return WIN;
      var v = -quiesce(V, apply(V, s, ms[k]), -beta, -alpha, left - 1, ctx);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  // level 0 よわい / 1 ふつう / 2 つよい。大きい盤ほど深く読めないので時間で打ち切る
  function ai(V, s, level, timeMs) {
    var ms = moves(V, s); if (ms.length === 1) return ms[0];
    var big = V.n > 50;
    var maxDepth = level === 0 ? 1 : level === 1 ? 2 : 8;
    var budget = timeMs || (level === 2 ? (big ? 2600 : 1800) : big ? 700 : 400);
    var ctx = { nodes: 0, deadline: Date.now() + budget, stop: false };
    // 1手で詰ませられる・玉を取れるなら迷わずそれ
    order(ms);
    var bestMove = ms[0];
    for (var d = 1; d <= maxDepth; d++) {
      var bm = null, bv = -Infinity, alpha = -Infinity;
      var ord = ms.slice().sort(function (a, b) { return same(a, bestMove) ? -1 : same(b, bestMove) ? 1 : 0; });
      for (var k = 0; k < ord.length; k++) {
        var v = -negamax(V, apply(V, s, ord[k]), d - 1, -Infinity, -alpha, ctx);
        if (level === 0) v += Math.random() * 600;     // よわい: かなり気まぐれ
        else if (level === 1) v += Math.random() * 60;
        if (ctx.stop && d > 1) break;
        if (v > bv) { bv = v; bm = ord[k]; }
        if (v > alpha) alpha = v;
      }
      if (ctx.stop && d > 1) break;
      if (bm) bestMove = bm;
      if (bv >= WIN - 300) break;
    }
    return bestMove;
  }

  // ===================== 詰将棋ソルバー =====================
  // 攻め方（s.turn）は王手だけを続け、玉方は最も長く逃げる。攻め方に玉はない（片玉）のが前提。
  // 玉方の持ち駒は「残り全部」を tsumeHand() で作る（詰将棋の決まり）
  function Solver(V) {
    this.V = V; this.proven = {}; this.disproven = {}; this.nodes = 0;
  }
  // 攻め方の王手になる合法手
  Solver.prototype.checks = function (s) {
    var V = this.V, ps = pseudoMoves(V, s), out = [];
    for (var k = 0; k < ps.length; k++) {
      var n = apply(V, s, ps[k]);
      if (!inCheck(V, n, 1 - s.turn)) continue;
      if (inCheck(V, n, s.turn)) continue;                       // （攻め方に玉がある問題用）
      if (isUchifuzume(V, s, ps[k], n)) continue;
      ps[k].n = n;
      out.push(ps[k]);
    }
    return out;
  };
  // 攻め方番で、d 手以内（d は奇数）に詰むか
  Solver.prototype.or = function (s, d) {
    if (d <= 0) return false;
    this.nodes++;
    var k = key(s), pv = this.proven[k], dv = this.disproven[k];
    if (pv !== undefined && pv <= d) return true;
    if (dv !== undefined && dv >= d) return false;
    var cs = this.checks(s);
    // 取る手・成る手・玉に近い手を先に
    for (var i = 0; i < cs.length; i++) {
      if (this.and(cs[i].n, d - 1)) { this.proven[k] = Math.min(this.proven[k] || 1e9, d); return true; }
    }
    this.disproven[k] = Math.max(dv || 0, d);
    return false;
  };
  // 玉方番で、d 手以内に詰むか（どの応手でも）
  Solver.prototype.and = function (s, d) {
    this.nodes++;
    var replies = legalFrom(this.V, s, false);
    if (!replies.length) return true;        // 詰み
    if (d <= 0) return false;
    var k = 'A' + key(s), pv = this.proven[k], dv = this.disproven[k];
    if (pv !== undefined && pv <= d) return true;
    if (dv !== undefined && dv >= d) return false;
    // 玉が動く手・取る手を先に試す（だいたいそこで詰まない）
    replies.sort(function (a, b) { return (b.cap ? 2 : 0) + (b.f >= 0 ? 1 : 0) - ((a.cap ? 2 : 0) + (a.f >= 0 ? 1 : 0)); });
    for (var i = 0; i < replies.length; i++) {
      if (!this.or(apply(this.V, s, replies[i]), d - 1)) { this.disproven[k] = Math.max(dv || 0, d); return false; }
    }
    this.proven[k] = Math.min(pv || 1e9, d);
    return true;
  };
  // いちばん短い詰み手数（maxd まで。詰まなければ -1）
  Solver.prototype.dist = function (s, maxd) {
    for (var d = 1; d <= maxd; d += 2) if (this.or(s, d)) return d;
    return -1;
  };
  // 玉方番の局面で、あと何手で詰むか（応手が無ければ 0）
  Solver.prototype.distAnd = function (s, maxd) {
    if (!legalFrom(this.V, s, false).length) return 0;
    for (var d = 2; d <= maxd; d += 2) if (this.and(s, d)) return d;
    return -1;
  };
  // 攻め方番・残り r 手で詰ませる手の一覧
  Solver.prototype.matingMoves = function (s, r) {
    var self = this;
    return this.checks(s).filter(function (m) { return self.and(m.n, r - 1); });
  };
  // 玉方のいちばん長い応手（同じ長さなら、玉が動く・取る手を優先＝無駄な合駒を本筋にしない）
  Solver.prototype.bestDefense = function (s, r) {
    var self = this, replies = legalFrom(this.V, s, false), best = null, bd = -2;
    replies.forEach(function (m) {
      var n = apply(self.V, s, m), d = self.dist(n, r - 1);
      if (d < 0) d = 999;
      var score = d * 10 + (m.f >= 0 ? 2 : 0) + (m.cap ? 1 : 0);
      if (score > bd) { bd = score; best = m; best.left = d; }
    });
    return best;
  };
  HS.Solver = Solver;

  // 詰将棋: 玉方の持ち駒は、盤と攻め方の持ち駒にない残り全部
  function tsumeHand(V, b, attackerHand) {
    var total = {}, i, t;
    for (i = 0; i < V.n; i++) if (V.start[i]) { t = base(kind(V.start[i])); if (!DEF[t].royal) total[t] = (total[t] || 0) + 1; }
    for (i = 0; i < V.n; i++) if (b[i]) { t = base(kind(b[i])); if (!DEF[t].royal) total[t] = (total[t] || 0) - 1; }
    var def = emptyHand(V);
    V.handTypes.forEach(function (x, j) { def[j] = Math.max(0, (total[x] || 0) - (attackerHand[j] || 0)); });
    return def;
  }
  HS.tsumeHand = tsumeHand;

  // ===================== 棋譜の書き方（▲２三銀成・△同玉 など） =====================
  var ZEN = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
  var KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var KIFU_NAME = { 8: '玉', 9: 'と', 10: '成香', 11: '成桂', 12: '成銀', 13: '馬', 14: '龍' };
  function sqName(V, i) { var x = i % V.w, y = (i - x) / V.w; return ZEN[V.w - x] + KANJI[y]; }
  // s: 指す前の局面、prevT: ひとつ前の手の行き先（同 にするため。なければ -1）
  function kifu(V, s, m, prevT) {
    var mark = s.turn === 0 ? '▲' : '△';
    var t = m.f < 0 ? m.d : kind(s.b[m.f]);
    var nm = KIFU_NAME[t] || DEF[t].n;
    var dest = prevT === m.t ? '同' + (nm.length === 1 ? '　' : '') : sqName(V, m.t);
    var tail = '';
    var ms = legalFrom(V, s, true);
    if (m.f < 0) {
      // 盤上の同じ駒もそこへ行けるときだけ「打」
      if (ms.some(function (z) { return z.f >= 0 && z.t === m.t && kind(s.b[z.f]) === t; })) tail = '打';
    } else {
      if (m.pr) tail = '成';
      else if (ms.some(function (z) { return z.f === m.f && z.t === m.t && z.pr; })) tail = '不成';
      // 同じ種類の駒が2枚以上そこへ行けるときは、元の位置を（ ）で
      var others = ms.filter(function (z) { return z.f >= 0 && z.f !== m.f && z.t === m.t && kind(s.b[z.f]) === t; });
      if (others.length) tail += '(' + sqName(V, m.f).replace(/[一二三四五六七八九]/, function (c) { return KANJI.indexOf(c) + 1; }).replace(/[０-９]/, function (c) { return ZEN.indexOf(c); }) + ')';
    }
    return mark + dest + nm + tail;
  }
  HS.kifu = kifu;
  HS.sqName = sqName;

  HS.rules = {
    init: init, moves: moves, play: play, over: over, repetition: repetition, apply: apply, pseudoMoves: pseudoMoves,
    legalFrom: legalFrom, inCheck: inCheck, attacked: attacked, targets: targets, moveKind: moveKind, kingSquares: kingSquares, key: key, same: same,
    evaluate: evaluate, ai: ai, owner: owner, kind: kind, base: base, inZone: inZone, deadAt: deadAt, isUchifuzume: isUchifuzume
  };
})(this);

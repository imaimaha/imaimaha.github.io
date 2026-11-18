/* ひとふでいもむし — ルール・答えさがし（solver）・盤づくり（generator）
 * 画面なし。ブラウザ（game.js）と jsc（src/gen.js・src/verify.js）の両方で使う。
 *
 * 盤の書き方（stage.map の1文字 = 1マス）
 *   '.' 葉っぱ        'S' いもむしのスタート（葉っぱ）   '#' 石（通れない）   ' ' なにもない（盤の外）
 *   'G' さなぎの枝（さいごにここで終わる）
 *   '^' '>' 'v' '<' 一方通行の葉（そこから出るときは矢印の向きだけ）
 *   'B' 大きな葉（2回通る。すぐ引き返すのはだめ）
 *   'w' 'x' 'y' 'z' ワープの穴（同じ文字の2つがつながっている。入るともう片方から出る）
 *   'M' しびれキノコ（食べたら、次の1歩はまっすぐ）
 *   '1'〜'9' 色の木の実（1 → 2 → 3 … の順にしか食べられない）
 * S がない盤は「好きな葉っぱからスタート」。
 */
(function (root) {
  'use strict';
  var HF = {};
  // 向き: 0 上 / 1 右 / 2 下 / 3 左
  var DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
  HF.ARROW = '^>v<';
  // マスの種類
  var VOID = 0, LEAF = 1, ROCK = 2, BIG = 3, GOAL = 4, MUSH = 5, ARROW = 6, BERRY = 7, WARP = 8;
  HF.K = { VOID: VOID, LEAF: LEAF, ROCK: ROCK, BIG: BIG, GOAL: GOAL, MUSH: MUSH, ARROW: ARROW, BERRY: BERRY, WARP: WARP };

  // ---------------------------------------------------------------------------
  // 盤を読む
  // ---------------------------------------------------------------------------
  HF.parse = function (map) {
    var H = map.length, W = 0, r, c;
    for (r = 0; r < H; r++) W = Math.max(W, map[r].length);
    var n = H * W, b = { H: H, W: W, n: n, kind: [], need: [], arrow: [], berry: [], warp: [], start: -1, goal: -1, total: 0, berries: 0, nb: [] };
    var warpSeen = {};
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      var ch = map[r].charAt(c) || ' ', i = r * W + c, k = LEAF, need = 1, ar = -1, be = 0;
      if (ch === ' ' || ch === '_') { k = VOID; need = 0; }
      else if (ch === '#') { k = ROCK; need = 0; }
      else if (ch === 'S') b.start = i;
      else if (ch === 'G') { k = GOAL; b.goal = i; }
      else if (ch === 'B') { k = BIG; need = 2; }
      else if (ch === 'M') k = MUSH;
      else if (HF.ARROW.indexOf(ch) >= 0) { k = ARROW; ar = HF.ARROW.indexOf(ch); }
      else if (ch >= '1' && ch <= '9') { k = BERRY; be = +ch; b.berries = Math.max(b.berries, be); }
      else if ('wxyz'.indexOf(ch) >= 0) { k = WARP; (warpSeen[ch] = warpSeen[ch] || []).push(i); }
      b.kind.push(k); b.need.push(need); b.arrow.push(ar); b.berry.push(be); b.warp.push(-1);
      b.total += need;
    }
    for (var key in warpSeen) { var p = warpSeen[key]; if (p.length === 2) { b.warp[p[0]] = p[1]; b.warp[p[1]] = p[0]; } }
    b.warpLetter = {};
    for (key in warpSeen) warpSeen[key].forEach(function (i) { b.warpLetter[i] = key; });
    // となりのマス（盤の外・石・なにもないマスはのぞく）
    for (var i = 0; i < n; i++) {
      var list = [];
      if (b.need[i] > 0) for (var d = 0; d < 4; d++) {
        var y = Math.floor(i / W) + DR[d], x = i % W + DC[d];
        if (y >= 0 && y < H && x >= 0 && x < W && b.need[y * W + x] > 0) list.push(y * W + x);
      }
      b.nb.push(list);
    }
    return b;
  };

  // a から b への向き（となりでなければ -1）
  HF.dir = function (b, a, c) {
    var ar = Math.floor(a / b.W), ac = a % b.W, br = Math.floor(c / b.W), bc = c % b.W;
    for (var d = 0; d < 4; d++) if (ar + DR[d] === br && ac + DC[d] === bc) return d;
    return -1;
  };

  // ---------------------------------------------------------------------------
  // あそんでいる様子（state）
  //   path: 通ったマス（ワープの穴は入口と出口の両方が入る） / jump[k]: path[k] にはワープで着いた
  //   cnt: マスごとに通った回数 / next: 次に食べられる木の実の番号
  // ---------------------------------------------------------------------------
  HF.state = function (b) { var cnt = []; for (var i = 0; i < b.n; i++) cnt.push(0); return { b: b, path: [], jump: [], cnt: cnt, next: 1 }; };

  // ここからスタートできるか
  HF.canStart = function (s, i) {
    var b = s.b;
    if (s.path.length || i < 0 || b.need[i] === 0) return false;
    if (b.start >= 0) return i === b.start;
    var k = b.kind[i];
    return k === LEAF || k === BIG || k === ARROW || (k === BERRY && b.berry[i] === 1);
  };

  // 頭から i へ進めるか。進めるなら ''、だめなら理由
  //   'far' となりじゃない / 'wall' 石など / 'full' もう食べた / 'arrow' 矢印の向きじゃない / 'straight' キノコでしびれてまっすぐしか行けない
  //   'back' 大きな葉へすぐ引き返した / 'berry' 木の実の順番がちがう / 'goal' 枝はさいごに
  HF.why = function (s, i) {
    var b = s.b, p = s.path, n = p.length;
    if (!n) return HF.canStart(s, i) ? '' : 'start';
    var h = p[n - 1];
    if (i < 0 || i >= b.n) return 'far';
    var d = HF.dir(b, h, i);
    if (d < 0) return 'far';
    if (b.need[i] === 0) return 'wall';
    if (s.cnt[i] >= b.need[i]) return 'full';
    if (b.kind[h] === ARROW && b.arrow[h] !== d) return 'arrow';
    if (b.kind[h] === MUSH && n >= 2 && !s.jump[n - 1] && HF.dir(b, p[n - 2], h) !== d) return 'straight';
    if (b.kind[i] === BIG && n >= 2 && p[n - 2] === i) return 'back';
    if (b.kind[i] === BERRY && b.berry[i] !== s.next) return 'berry';
    if (b.kind[i] === GOAL && n + 1 < b.total) return 'goal';
    return '';
  };

  // 進む（ワープの穴なら、もう片方の穴まで進む）。進んだマスの数を返す
  HF.push = function (s, i) {
    var b = s.b;
    s.path.push(i); s.jump.push(false); s.cnt[i]++;
    if (b.kind[i] === BERRY) s.next++;
    if (b.kind[i] === WARP) { var o = b.warp[i]; s.path.push(o); s.jump.push(true); s.cnt[o]++; return 2; }
    return 1;
  };
  // 1つもどる（ワープで着いたところなら、穴の入口までまとめてもどる）
  HF.pop = function (s) {
    var b = s.b, n = s.path.length;
    if (!n) return 0;
    var k = 1;
    if (s.jump[n - 1]) { s.cnt[s.path.pop()]--; s.jump.pop(); k = 2; }
    var i = s.path.pop(); s.jump.pop(); s.cnt[i]--;
    if (b.kind[i] === BERRY) s.next--;
    return k;
  };
  HF.done = function (s) { return s.path.length === s.b.total; };
  HF.head = function (s) { return s.path.length ? s.path[s.path.length - 1] : -1; };
  // 「ひとつ前」に見えるマス（ワープで着いたばかりなら、穴の入口の前）
  HF.prevCell = function (s) {
    var n = s.path.length;
    if (n < 2) return -1;
    if (s.jump[n - 1]) return n >= 3 ? s.path[n - 3] : -1;
    return s.path[n - 2];
  };
  // 頭から進めるマス
  HF.moves = function (s) {
    var b = s.b, out = [];
    if (!s.path.length) {
      for (var i = 0; i < b.n; i++) if (HF.canStart(s, i)) out.push(i);
      return out;
    }
    var nb = b.nb[HF.head(s)];
    for (var k = 0; k < nb.length; k++) if (HF.why(s, nb[k]) === '') out.push(nb[k]);
    return out;
  };

  // ---------------------------------------------------------------------------
  // 枝切り: もう答えにならない形なら false
  //   ・のこりのマスが、頭から1つにつながっていない
  //   ・となりに行き先が1つしかないマス（＝そこで終わるしかない）が2つ以上ある・枝以外にある
  // ---------------------------------------------------------------------------
  var Q = [], MARK = [], STAMP = 0;
  function feasible(s) {
    var b = s.b, cnt = s.cnt, need = b.need, h = HF.head(s), left = 0, i, k, nb;
    if (MARK.length < b.n) { MARK = []; for (i = 0; i < b.n; i++) MARK.push(0); }
    STAMP++;
    var ends = 0, endAt = -1;
    for (i = 0; i < b.n; i++) {
      if (cnt[i] >= need[i] || i === h) continue;   // 頭（大きな葉の1回目）は数えない
      left++;
      var kd = b.kind[i];
      if (kd === BIG || kd === WARP) continue;
      nb = b.nb[i]; var links = 0;
      for (k = 0; k < nb.length; k++) { var j = nb[k]; if (cnt[j] < need[j] || j === h) links++; }
      if (links === 0) return false;
      if (links === 1) { ends++; endAt = i; if (ends > 1) return false; }
    }
    if (ends === 1 && b.goal >= 0 && endAt !== b.goal) return false;
    if (!left) return true;
    // 頭からつながっているか
    var qh = 0, qt = 0, seen = 0;
    Q[qt++] = h; MARK[h] = STAMP;
    while (qh < qt) {
      var u = Q[qh++];
      nb = b.nb[u];
      for (k = 0; k < nb.length; k++) { var v = nb[k]; if (MARK[v] !== STAMP && cnt[v] < need[v]) { MARK[v] = STAMP; Q[qt++] = v; seen++; } }
      var w = b.warp[u];
      if (w >= 0 && MARK[w] !== STAMP && cnt[w] < need[w] && u !== h) { MARK[w] = STAMP; Q[qt++] = w; seen++; }
    }
    return seen === left;
  }

  // ---------------------------------------------------------------------------
  // 答えをさがす
  //   o.cap: 数える答えの上限 / o.limit: 調べる手の上限（ここで止めたら complete = false）
  //   o.rng: あると、ためす順番をまぜる（盤づくり用） / o.prefix: ここまで進んだところから
  //   返り値 { count, complete, nodes, first }
  // ---------------------------------------------------------------------------
  HF.solve = function (b, o) {
    o = o || {};
    var cap = o.cap || 1, limit = o.limit || 2e6, rng = o.rng || null;
    var s = HF.state(b), res = { count: 0, complete: true, nodes: 0, first: null };
    if (o.prefix) for (var q = 0; q < o.prefix.length; q++) {
      if (s.path.length > q) continue;   // ワープの出口はとばす
      if (HF.why(s, o.prefix[q]) !== '') { res.bad = true; return res; }
      HF.push(s, o.prefix[q]);
    }
    function rec() {
      if (res.count >= cap) return;
      if (res.nodes >= limit) { res.complete = false; return; }
      res.nodes++;
      if (s.path.length === b.total) { res.count++; if (!res.first) res.first = s.path.slice(); return; }
      if (s.path.length && !feasible(s)) return;
      var mv = HF.moves(s);
      if (rng) for (var a = mv.length - 1; a > 0; a--) { var z = Math.floor(rng() * (a + 1)), t = mv[a]; mv[a] = mv[z]; mv[z] = t; }
      for (var k = 0; k < mv.length; k++) {
        HF.push(s, mv[k]); rec(); HF.pop(s);
        if (res.count >= cap || !res.complete) return;
      }
    }
    rec();
    return res;
  };

  // 答えの手順として正しいか（verify 用）
  HF.check = function (b, path) {
    var s = HF.state(b);
    for (var q = 0; q < path.length; q++) {
      if (s.path.length > q) { if (s.path[q] !== path[q]) return 'warp exit ' + q; continue; }
      var w = HF.why(s, path[q]);
      if (w) return w + ' at ' + q;
      HF.push(s, path[q]);
    }
    return HF.done(s) ? '' : 'not all eaten';
  };

  // ---------------------------------------------------------------------------
  // むずかしさをはかる
  //   rw: でたらめに進む（行ける所からランダムに選ぶ・もどらない）と、食べきれる割合
  //   forced: 答えの道のうち「行ける所が1つしかない」手の割合（多いほどやさしい）
  //   traps: 答えの道のとちゅうで、選ぶと行きづまる（もう答えにならない）手の数の合計
  // ---------------------------------------------------------------------------
  HF.measure = function (b, sol, rng, tries) {
    tries = tries || 200;
    var ok = 0, i, s;
    for (var t = 0; t < tries; t++) {
      s = HF.state(b);
      if (b.start >= 0) HF.push(s, b.start); else HF.push(s, sol[0]);
      for (;;) {
        var mv = HF.moves(s);
        if (!mv.length) break;
        HF.push(s, mv[Math.floor(rng() * mv.length)]);
      }
      if (HF.done(s)) ok++;
    }
    var forced = 0, steps = 0, traps = 0;
    s = HF.state(b);
    HF.push(s, sol[0]);
    for (i = 1; i < sol.length; i++) {
      if (s.path.length > i) continue;
      var m = HF.moves(s);
      steps++;
      if (m.length <= 1) forced++;
      else for (var k = 0; k < m.length; k++) if (m[k] !== sol[i]) {
        HF.push(s, m[k]);
        var r = HF.solve(b, { prefix: s.path, cap: 1, limit: 4000 });
        if (r.complete && !r.count) traps++;
        HF.pop(s);
      }
      HF.push(s, sol[i]);
    }
    return { rw: ok / tries, forced: steps ? forced / steps : 1, traps: traps };
  };

  // ---------------------------------------------------------------------------
  // たね付きの乱数（同じたねなら、どの端末でも同じ数がでる）
  // ---------------------------------------------------------------------------
  HF.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  HF.hash = function (str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------------------------------------------------------------------------
  // 盤づくり
  //   spec: { H, W, voids, rocks, free(好きな所から), goal, arrows, bigs, warps, mush, berries }
  //   やり方: 形と石を決める → でたらめに一筆の道を1本さがす → その道に合うように仕掛けを置く
  //   （仕掛けは、答えの数がいちばん減る場所をいくつかの候補から選ぶ）→ 答えの数を数える
  //   返り値 { map, sol, count, complete } / 作れなかったら null
  // ---------------------------------------------------------------------------
  function grid(H, W, ch) { var g = []; for (var r = 0; r < H; r++) { var row = []; for (var c = 0; c < W; c++) row.push(ch); g.push(row); } return g; }
  function toMap(g) { return g.map(function (row) { return row.join(''); }); }
  function connected(g) {
    var H = g.length, W = g[0].length, first = -1, total = 0, r, c;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) if (g[r][c] !== ' ' && g[r][c] !== '#') { total++; if (first < 0) first = r * W + c; }
    if (first < 0) return false;
    var seen = {}, st = [first], cnt = 0; seen[first] = 1;
    while (st.length) {
      var u = st.pop(); cnt++;
      for (var d = 0; d < 4; d++) {
        var y = Math.floor(u / W) + DR[d], x = u % W + DC[d], v = y * W + x;
        if (y >= 0 && y < H && x >= 0 && x < W && !seen[v] && g[y][x] !== ' ' && g[y][x] !== '#') { seen[v] = 1; st.push(v); }
      }
    }
    return cnt === total;
  }
  function isOpen(g, y, x) { return y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x] !== ' '; }

  HF.makeBase = function (spec, rng) {
    var H = spec.H, W = spec.W, g = grid(H, W, '.'), tries, r, c, d;
    // なにもないマス（盤の形をいびつにする）: 外側からけずる
    for (var v = 0, t1 = 0; v < (spec.voids || 0) && t1 < 400; t1++) {
      r = Math.floor(rng() * H); c = Math.floor(rng() * W);
      if (g[r][c] !== '.') continue;
      var edge = false;
      for (d = 0; d < 4; d++) if (!isOpen(g, r + DR[d], c + DC[d])) edge = true;
      if (!edge) continue;
      g[r][c] = ' ';
      if (!connected(g)) { g[r][c] = '.'; continue; }
      v++;
    }
    for (var k = 0, t2 = 0; k < (spec.rocks || 0) && t2 < 400; t2++) {
      r = Math.floor(rng() * H); c = Math.floor(rng() * W);
      if (g[r][c] !== '.') continue;
      g[r][c] = '#';
      if (!connected(g)) { g[r][c] = '.'; continue; }
      k++;
    }
    // 大きな葉（となりが3つ以上ある葉。2回通るので、まわりに道が要る）
    for (var bg = 0, t3 = 0; bg < (spec.bigs || 0) && t3 < 400; t3++) {
      r = Math.floor(rng() * H); c = Math.floor(rng() * W);
      if (g[r][c] !== '.') continue;
      var deg = 0;
      for (d = 0; d < 4; d++) if (isOpen(g, r + DR[d], c + DC[d]) && g[r + DR[d]][c + DC[d]] !== '#' && g[r + DR[d]][c + DC[d]] !== 'B') deg++;
      if (deg < 3) continue;
      g[r][c] = 'B'; bg++;
    }
    // ワープの穴（はなれた2マス）
    var letters = 'wxyz';
    for (var w = 0; w < (spec.warps || 0); w++) {
      for (tries = 0; tries < 200; tries++) {
        var a = [Math.floor(rng() * H), Math.floor(rng() * W)], bb = [Math.floor(rng() * H), Math.floor(rng() * W)];
        if (g[a[0]][a[1]] !== '.' || g[bb[0]][bb[1]] !== '.') continue;
        if (Math.abs(a[0] - bb[0]) + Math.abs(a[1] - bb[1]) < Math.max(3, Math.floor((H + W) / 3))) continue;
        g[a[0]][a[1]] = letters[w]; g[bb[0]][bb[1]] = letters[w];
        break;
      }
    }
    return g;
  }

  // 白黒の数（市松もよう）。ワープがない盤で、ひと筆の道ができるには差が1以下
  function parityOk(g) {
    var bl = 0, wh = 0;
    for (var r = 0; r < g.length; r++) for (var c = 0; c < g[0].length; c++) if (g[r][c] !== ' ' && g[r][c] !== '#') { var m = g[r][c] === 'B' ? 2 : 1; if ((r + c) % 2) bl += m; else wh += m; }
    return Math.abs(bl - wh) <= 1;
  }

  function countOf(g, cap, limit) {
    var b = HF.parse(toMap(g));
    return HF.solve(b, { cap: cap, limit: limit });
  }

  HF.generate = function (spec, rng, o) {
    o = o || {};
    var cap = o.cap || 200, limit = o.limit || 300000, pick = o.pick || 5;
    for (var attempt = 0; attempt < (o.attempts || 30); attempt++) {
      var g = HF.makeBase(spec, rng);
      if (!spec.warps && !parityOk(g)) continue;
      var b0 = HF.parse(toMap(g));
      var r0 = HF.solve(b0, { cap: 1, limit: o.pathLimit || 60000, rng: rng });
      if (!r0.count) continue;
      var P = r0.first.slice(), W = spec.W, i, k;
      var at = function (i) { return g[Math.floor(i / W)][i % W]; };
      var put = function (i, ch) { g[Math.floor(i / W)][i % W] = ch; };
      // 道の向きを決める（ワープの穴でははじまらない・おわらない方がいい）
      if (rng() < 0.5) P.reverse();
      if (at(P[0]) !== '.') P.reverse();
      if (at(P[0]) !== '.') continue;
      if (!spec.free) put(P[0], 'S');
      if (spec.goal) { if (at(P[P.length - 1]) !== '.') continue; put(P[P.length - 1], 'G'); }
      // 仕掛けを1つずつ置く（候補から、答えがいちばん少なくなる場所）
      var jumped = function (k) { return k > 0 && at(P[k]) && 'wxyz'.indexOf(at(P[k])) >= 0 && 'wxyz'.indexOf(at(P[k - 1])) >= 0 && at(P[k]) === at(P[k - 1]); };
      var placeBest = function (cands, ch) {
        if (!cands.length) return false;
        var best = null, bestN = Infinity;
        for (var t = 0; t < Math.min(pick, cands.length); t++) {
          var j = Math.floor(rng() * cands.length), cell = cands[j], chv = typeof ch === 'function' ? ch(cell) : ch;
          cands.splice(j, 1);
          var old = at(cell); put(cell, chv);
          var rr = countOf(g, cap, limit);
          put(cell, old);
          var score = rr.complete ? rr.count : cap * 2;
          if (score < bestN) { bestN = score; best = [cell, chv]; }
        }
        if (!best) return false;
        put(best[0], best[1]);
        return true;
      };
      var okAll = true;
      for (k = 0; k < (spec.arrows || 0) && okAll; k++) {
        var ca = [];
        for (i = 0; i < P.length - 1; i++) if (at(P[i]) === '.' && !jumped(i + 1) && HF.dir(b0, P[i], P[i + 1]) >= 0) ca.push(P[i]);
        okAll = placeBest(ca, function (cell) { var q = P.indexOf(cell); return HF.ARROW[HF.dir(b0, cell, P[q + 1])]; });
      }
      for (k = 0; k < (spec.mush || 0) && okAll; k++) {
        var cm = [];
        for (i = 1; i < P.length - 1; i++) {
          if (at(P[i]) !== '.' || jumped(i) || jumped(i + 1)) continue;
          var d1 = HF.dir(b0, P[i - 1], P[i]), d2 = HF.dir(b0, P[i], P[i + 1]);
          if (d1 >= 0 && d1 === d2) cm.push(P[i]);
        }
        okAll = placeBest(cm, 'M');
      }
      if (spec.berries && okAll) {
        // 木の実: 道の順に 1, 2, 3 …。いくつかの並べ方から答えがいちばん少ないもの
        var plain = [];
        for (i = 0; i < P.length; i++) if (at(P[i]) === '.') plain.push(i);
        var bestSet = null, bestCnt = Infinity;
        for (var t3 = 0; t3 < pick + 2 && plain.length >= spec.berries; t3++) {
          var idx = plain.slice(), chosen = [];
          for (k = 0; k < spec.berries; k++) chosen.push(idx.splice(Math.floor(rng() * idx.length), 1)[0]);
          chosen.sort(function (p, q) { return p - q; });
          chosen.forEach(function (pi, n) { put(P[pi], String(n + 1)); });
          var rb = countOf(g, cap, limit);
          chosen.forEach(function (pi) { put(P[pi], pi === 0 && !spec.free ? 'S' : '.'); });
          var sc = rb.complete ? rb.count : cap * 2;
          if (sc < bestCnt) { bestCnt = sc; bestSet = chosen; }
        }
        if (!bestSet) okAll = false;
        else bestSet.forEach(function (pi, n) { put(P[pi], String(n + 1)); });
      }
      if (!okAll) continue;
      // スタートの葉が木の実で上書きされたら、そのステージは使わない（S は葉っぱだけ）
      if (!spec.free && at(P[0]) !== 'S') continue;
      var map = toMap(g), bF = HF.parse(map);
      var res = HF.solve(bF, { cap: cap, limit: limit });
      if (!res.complete || !res.count) continue;
      if (HF.check(bF, P) !== '') continue;
      return { map: map, sol: P, count: res.count, nodes: res.nodes, b: bF };
    }
    return null;
  };

  // ---------------------------------------------------------------------------
  // 今日のいもむし（日本時間の日付から毎日同じ盤。だれの端末でも同じ）
  //   作り方を変えたら DAILY_VERSION を上げる（ランキングがずれないように）
  // ---------------------------------------------------------------------------
  HF.DAILY_VERSION = 1;
  HF.dayKey = function (ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 9 * 3600000), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  };
  // 曜日でしかけを変える（月: 石 / 火: 矢印 / 水: 大きな葉 / 木: ワープ / 金: キノコ / 土: 木の実 / 日: まぜて）
  HF.dailySpec = function (day) {
    var p = day.split('-'), wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    var base = { H: 6, W: 6, rocks: 3, voids: 0 };
    var add = [
      { H: 7, W: 6, rocks: 2, arrows: 1, mush: 1, berries: 3, goal: true },   // 日
      { H: 6, W: 6, rocks: 4, voids: 2, goal: true },                        // 月
      { H: 6, W: 6, rocks: 2, arrows: 3 },                                   // 火
      { H: 6, W: 6, rocks: 1, bigs: 2 },                                     // 水
      { H: 6, W: 6, rocks: 2, warps: 1, goal: true },                        // 木
      { H: 6, W: 6, rocks: 2, mush: 3 },                                     // 金
      { H: 6, W: 6, rocks: 2, berries: 4 }                                   // 土
    ][wd];
    for (var k in add) base[k] = add[k];
    base.wd = wd;
    return base;
  };
  // 2026-11-09 からは曜日で分けず、毎日いくつかのしかけをまぜる（ユーザー「曜日ごとに効果変えなくていいから毎日ミックスに」）
  //   それより前の日（過去の問題）は今までどおり曜日のしかけ・同じ盤
  HF.MIX_FROM = '2026-11-09';
  HF.isMixDay = function (day) { return day >= HF.MIX_FROM; };
  HF.mixSpec = function (day) {
    var r = HF.rng(HF.hash('imomushi-mix-' + day));
    var pool = [{ voids: 2, goal: true }, { arrows: 2 }, { bigs: 1 }, { warps: 1, goal: true }, { mush: 2 }, { berries: 3 }];
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var k = r() < 0.4 ? 3 : 2;
    var spec = { H: k === 3 ? 7 : 6, W: 6, rocks: k === 3 ? 1 : 2, voids: 0 };
    for (var n = 0; n < k; n++) for (var key in pool[n]) spec[key] = pool[n][key];
    var p = day.split('-');
    spec.wd = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    spec.mix = true;
    return spec;
  };
  HF.daily = function (day) {
    var mix = HF.isMixDay(day);
    var rng = HF.rng(HF.hash('imomushi-daily-v' + (mix ? 2 : HF.DAILY_VERSION) + '-' + day));
    var spec = mix ? HF.mixSpec(day) : HF.dailySpec(day);
    // 候補をいくつか作って、答えがいちばん少ないもの
    var best = null;
    for (var t = 0; t < 3; t++) {
      var r = HF.generate(spec, rng, { cap: 60, limit: 60000, pick: 3, attempts: 20, pathLimit: 20000 });
      if (r && (!best || r.count < best.count)) best = r;
    }
    if (!best) {
      // 念のため: 作れなかった日は、石だけのやさしい盤
      best = HF.generate({ H: 5, W: 5, rocks: 1 }, rng, { cap: 60, limit: 60000, attempts: 200 });
    }
    return { name: '今日のいもむし', map: best.map, sol: best.sol, count: best.count, day: day, wd: spec.wd, mix: mix };
  };

  root.HF = HF;
  if (typeof module !== 'undefined') module.exports = HF;
})(typeof window !== 'undefined' ? window : this);

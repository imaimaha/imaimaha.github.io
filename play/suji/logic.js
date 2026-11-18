/* すうじのへや — 画面を使わないロジック SJ
 *
 * モード A「へや割り」: 盤を長方形のへやに分ける。どのへやにも数字が1つだけあり、その数字がへやのマスの数
 * モード B「住人さがし」: 盤はへや（色つきのかたまり）に分かれていて、へやの数字の人数だけ住人を入れる。
 *                        住人どうしは、たて・よこ・ななめのどれでもとなりあわない
 *
 * どちらも「こたえを数える」（ちょうど1つか）と「人のとき方で解く」（ヒント・むずかしさ）と「問題作り」がある。
 * jsc（src/make_stages.js・src/verify.js）とブラウザの両方で動く。
 */
(function (root) {
  'use strict';

  // ---------- 乱数（たねが同じなら、どの端末でも同じ） ----------
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function ri(rnd, n) { return Math.floor(rnd() * n); }
  function shuffle(rnd, a) { for (var i = a.length - 1; i > 0; i--) { var j = ri(rnd, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function enc(v) { return B36.charAt(v); }
  function dec(ch) { return B36.indexOf(ch); }

  // =====================================================================
  // モード A「へや割り」
  //   st = { n, q, a }  q: マスごとに '.' か へやの大きさ（36進）、a: マスごとのへやの番号（36進。へやの番号 = 数字のマスの順）
  // =====================================================================
  function parseA(st) {
    var n = st.n, N = n * n, clues = [], clueAt = new Int16Array(N);
    for (var i = 0; i < N; i++) {
      var ch = st.q.charAt(i);
      if (ch === '.') clueAt[i] = -1;
      else { clueAt[i] = clues.length; clues.push({ cell: i, area: dec(ch) }); }
    }
    return { n: n, N: N, clues: clues, clueAt: clueAt };
  }
  function rectCells(n, r, c, h, w) { var out = []; for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) out.push(y * n + x); return out; }
  // 数字 k のへやになれる長方形をぜんぶ（ほかの数字をふくまない）
  function candA(P, k) {
    var n = P.n, cl = P.clues[k], area = cl.area, r0 = Math.floor(cl.cell / n), c0 = cl.cell % n, list = [];
    for (var h = 1; h <= area; h++) {
      if (area % h) continue;
      var w = area / h;
      if (h > n || w > n) continue;
      for (var r = r0 - h + 1; r <= r0; r++) for (var c = c0 - w + 1; c <= c0; c++) {
        if (r < 0 || c < 0 || r + h > n || c + w > n) continue;
        var cells = rectCells(n, r, c, h, w), ok = true;
        for (var j = 0; j < cells.length; j++) { var o = P.clueAt[cells[j]]; if (o >= 0 && o !== k) { ok = false; break; } }
        if (ok) list.push({ k: k, r: r, c: c, h: h, w: w, cells: cells });
      }
    }
    return list;
  }
  function allCandA(P) { var out = []; for (var k = 0; k < P.clues.length; k++) out.push(candA(P, k)); return out; }
  function free(rc, own) { for (var j = 0; j < rc.cells.length; j++) if (own[rc.cells[j]] >= 0) return false; return true; }

  // こたえを数える（limit まで）。sols に見つけたこたえ（へやごとの長方形）を入れる
  function countA(P, limit, sols) {
    var K = P.clues.length, N = P.N, sum = 0;
    for (var k = 0; k < K; k++) sum += P.clues[k].area;
    if (sum !== N) return 0;
    var cands = allCandA(P), own = new Int16Array(N), placed = new Int8Array(K), cur = [], count = 0, nodes = 0;
    for (var i = 0; i < N; i++) own[i] = -1;
    limit = limit || 2;
    function rec(np) {
      if (count >= limit) return;
      nodes++;
      if (np === K) { count++; if (sols) sols.push(cur.slice()); return; }
      var cover = new Int16Array(N), vl = [], bestN = 1e9, best = null, k, j, m;
      for (k = 0; k < K; k++) {
        if (placed[k]) continue;
        var l = [];
        for (j = 0; j < cands[k].length; j++) if (free(cands[k][j], own)) l.push(cands[k][j]);
        if (!l.length) return;
        vl.push(l);
        if (l.length < bestN) { bestN = l.length; best = l; }
        for (j = 0; j < l.length; j++) for (m = 0; m < l[j].cells.length; m++) cover[l[j].cells[m]]++;
      }
      var bc = -1;
      for (i = 0; i < N; i++) if (own[i] < 0) {
        if (!cover[i]) return;
        if (cover[i] < bestN) { bestN = cover[i]; bc = i; }
      }
      if (bc >= 0) {
        best = [];
        for (k = 0; k < vl.length; k++) for (j = 0; j < vl[k].length; j++) if (vl[k][j].cells.indexOf(bc) >= 0) best.push(vl[k][j]);
      }
      for (j = 0; j < best.length && count < limit; j++) {
        var rc = best[j];
        for (m = 0; m < rc.cells.length; m++) own[rc.cells[m]] = rc.k;
        placed[rc.k] = 1; cur.push(rc);
        rec(np + 1);
        cur.pop(); placed[rc.k] = 0;
        for (m = 0; m < rc.cells.length; m++) own[rc.cells[m]] = -1;
      }
    }
    rec(0);
    return count;
  }

  // 人のとき方で解く。preset = { k: 長方形 }（もう決まっているへや）。
  //   only: 数字のへやになれる形が1つだけ
  //   reach: このマスに届く数字が1つだけ（その数字のへやは、このマスをふくむ）
  //   share: 数字のへやの形がどれでもかならず使うマス（ほかの数字はそこを使えない）
  //   trial: ためしにおくと、どこかのマスにどの数字も届かなくなる（level 2）
  // 返り値 { ok, solved, steps: [{ k, rect, rule }], use: {only, reach, share, trial}, level, diff }
  function logicA(P, opts) {
    opts = opts || {};
    var K = P.clues.length, N = P.N, maxLevel = opts.maxLevel || 2;
    var cands = allCandA(P), own = new Int16Array(N), placed = [], steps = [], use = { only: 0, reach: 0, share: 0, trial: 0 }, i, k, j;
    for (i = 0; i < N; i++) own[i] = -1;
    function put(k, rc, rule) { placed[k] = rc; for (var m = 0; m < rc.cells.length; m++) own[rc.cells[m]] = k; cands[k] = [rc]; if (rule) steps.push({ k: k, rect: rc, rule: rule }); }
    if (opts.preset) for (k in opts.preset) put(+k, opts.preset[k], null);
    // 1段の推理をくり返す（S = 状態。trial のときはコピーで使う）。進めなくなったら返す。矛盾は false
    function basic(S, rec) {
      for (;;) {
        var prog = false, k, j, m;
        for (k = 0; k < K; k++) {
          if (S.placed[k]) continue;
          var l = [];
          for (j = 0; j < S.cands[k].length; j++) if (free(S.cands[k][j], S.own)) l.push(S.cands[k][j]);
          if (!l.length) return false;
          S.cands[k] = l;
        }
        for (k = 0; k < K; k++) if (!S.placed[k] && S.cands[k].length === 1) {
          var rc = S.cands[k][0]; S.placed[k] = rc; for (m = 0; m < rc.cells.length; m++) S.own[rc.cells[m]] = k;
          if (rec) { rec.steps.push({ k: k, rect: rc, rule: S.lastRule || 'only' }); rec.use[S.lastRule || 'only']++; }
          S.lastRule = null; prog = true; break;
        }
        if (prog) continue;
        // share
        for (k = 0; k < K && !prog; k++) {
          if (S.placed[k]) continue;
          var cnt = {}, L = S.cands[k];
          for (j = 0; j < L.length; j++) for (m = 0; m < L[j].cells.length; m++) cnt[L[j].cells[m]] = (cnt[L[j].cells[m]] || 0) + 1;
          for (var cs in cnt) {
            if (cnt[cs] !== L.length) continue;
            var c = +cs;
            for (var o = 0; o < K; o++) {
              if (o === k || S.placed[o]) continue;
              var l2 = S.cands[o].filter(function (rc) { return rc.cells.indexOf(c) < 0; });
              if (l2.length !== S.cands[o].length) { if (!l2.length) return false; S.cands[o] = l2; prog = true; if (l2.length === 1) S.lastRule = 'share'; }
            }
          }
        }
        if (prog) { if (rec) rec.use.share++; continue; }
        // reach
        var reach = [];
        for (i = 0; i < N; i++) reach.push(S.own[i] >= 0 ? null : {});
        for (k = 0; k < K; k++) if (!S.placed[k]) for (j = 0; j < S.cands[k].length; j++) for (m = 0; m < S.cands[k][j].cells.length; m++) { var rr = reach[S.cands[k][j].cells[m]]; if (rr) rr[k] = 1; }
        for (i = 0; i < N && !prog; i++) {
          if (!reach[i]) continue;
          var ks = Object.keys(reach[i]);
          if (!ks.length) return false;
          if (ks.length === 1) {
            var kk = +ks[0], cell = i, l3 = S.cands[kk].filter(function (rc) { return rc.cells.indexOf(cell) >= 0; });
            if (l3.length !== S.cands[kk].length) { S.cands[kk] = l3; prog = true; if (l3.length === 1) S.lastRule = 'reach'; }
          }
        }
        if (prog) { if (rec) rec.use.reach++; continue; }
        return true;
      }
    }
    var S = { cands: cands, own: own, placed: placed, lastRule: null };
    var rec = { steps: steps, use: use };
    for (;;) {
      if (!basic(S, rec)) return { ok: false, solved: false, steps: steps, use: use };
      var done = true;
      for (k = 0; k < K; k++) if (!S.placed[k]) { done = false; break; }
      if (done) break;
      if (maxLevel < 2) break;
      // trial: ためしにおいてみて、矛盾すればその形は使えない
      var prog = false;
      for (k = 0; k < K && !prog; k++) {
        if (S.placed[k] || S.cands[k].length < 2) continue;
        for (j = 0; j < S.cands[k].length; j++) {
          var T = { cands: S.cands.map(function (l) { return l.slice(); }), own: new Int16Array(S.own), placed: S.placed.slice(), lastRule: null };
          var rc = S.cands[k][j];
          T.cands[k] = [rc];
          if (!basic(T, null)) {
            S.cands[k] = S.cands[k].filter(function (x) { return x !== rc; });
            use.trial++; prog = true;
            if (S.cands[k].length === 1) S.lastRule = 'trial';
            break;
          }
        }
      }
      if (!prog) break;
    }
    var solved = true;
    for (k = 0; k < K; k++) if (!S.placed[k]) solved = false;
    var level = use.trial ? 2 : 1;
    var diff = use.only + use.reach * 3 + use.share * 3 + use.trial * 12 + Math.round(N / 10);
    return { ok: true, solved: solved, steps: steps, use: use, level: level, diff: diff, placed: S.placed };
  }

  // こたえの長方形（へやの番号ごと）
  function solutionA(st) {
    var P = parseA(st), n = st.n, K = P.clues.length, out = [];
    for (var k = 0; k < K; k++) {
      var r0 = 99, c0 = 99, r1 = -1, c1 = -1;
      for (var i = 0; i < P.N; i++) if (dec(st.a.charAt(i)) === k) { var r = Math.floor(i / n), c = i % n; r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c); }
      out.push({ k: k, r: r0, c: c0, h: r1 - r0 + 1, w: c1 - c0 + 1, cells: rectCells(n, r0, c0, r1 - r0 + 1, c1 - c0 + 1) });
    }
    return out;
  }

  // 長方形の分け方を作る: 1マスずつのへやから、となりのへやと「長方形のまま」くっつけていく
  function partitionA(n, rnd, o) {
    var N = n * n, rects = [], own = new Int16Array(N), i;
    for (i = 0; i < N; i++) { rects.push({ r: Math.floor(i / n), c: i % n, h: 1, w: 1, alive: true }); own[i] = i; }
    var count = N, target = Math.max(2, Math.round(N / o.avg)), tries = 0;
    while (count > target && tries < N * 60) {
      tries++;
      var a = rects[own[ri(rnd, N)]], dir = ri(rnd, 4), b = null, cell;
      if (dir === 0 && a.c + a.w < n) { b = rects[own[a.r * n + a.c + a.w]]; if (b.r !== a.r || b.h !== a.h) b = null; }
      else if (dir === 1 && a.r + a.h < n) { b = rects[own[(a.r + a.h) * n + a.c]]; if (b.c !== a.c || b.w !== a.w) b = null; }
      else if (dir === 2 && a.c > 0) { b = rects[own[a.r * n + a.c - 1]]; if (b.r !== a.r || b.h !== a.h) b = null; }
      else if (dir === 3 && a.r > 0) { b = rects[own[(a.r - 1) * n + a.c]]; if (b.c !== a.c || b.w !== a.w) b = null; }
      if (!b) continue;
      var nr = Math.min(a.r, b.r), nc = Math.min(a.c, b.c), nh = (dir % 2) ? a.h + b.h : a.h, nw = (dir % 2) ? a.w : a.w + b.w;
      var area = nh * nw;
      if (area > o.maxA) continue;
      if (Math.max(nh, nw) > o.maxSide) continue;
      // 大きいへやは少しずつ（ばらつきを出す）
      if (area > o.avg * 1.6 && rnd() < 0.55) continue;
      a.r = nr; a.c = nc; a.h = nh; a.w = nw; b.alive = false;
      var cs = rectCells(n, nr, nc, nh, nw), id = rects.indexOf(a);
      for (cell = 0; cell < cs.length; cell++) own[cs[cell]] = id;
      count--;
    }
    return rects.filter(function (r) { return r.alive; });
  }

  // 問題を作る（o: { avg, maxA, maxSide, maxOnes, level, minDiff, maxDiff }）。作れなければ null
  function genA(n, rnd, o) {
    for (var attempt = 0; attempt < 60; attempt++) {
      var rects = partitionA(n, rnd, o), N = n * n;
      var ones = rects.filter(function (r) { return r.h * r.w === 1; }).length;
      if (ones > o.maxOnes) continue;
      if (o.minBig && !rects.some(function (r) { return r.h * r.w >= o.minBig; })) continue;
      var clue = rects.map(function (r) { return (r.r + ri(rnd, r.h)) * n + r.c + ri(rnd, r.w); });
      for (var fix = 0; fix < 40; fix++) {
        var q = [], i, k;
        for (i = 0; i < N; i++) q.push('.');
        rects.forEach(function (r, k2) { q[clue[k2]] = enc(r.h * r.w); });
        var st = { n: n, q: q.join('') };
        var P = parseA(st), sols = [], c = countA(P, 2, sols);
        if (c === 1) {
          var lg = logicA(P, { maxLevel: o.level });
          if (!lg.solved) break;
          if (o.maxTrial != null && lg.use.trial > o.maxTrial) break;
          if (o.minDiff && lg.diff < o.minDiff) break;
          // こたえ（へやの番号は数字のマスの順）
          var a = [];
          for (i = 0; i < N; i++) a.push('0');
          for (k = 0; k < P.clues.length; k++) lg.placed[k].cells.forEach(function (x) { a[x] = enc(k); });
          st.a = a.join('');
          st.diff = lg.diff; st.level = lg.level; st.rooms = P.clues.length;
          return st;
        }
        if (c === 0) break;
        // べつのこたえと形がちがうへやの数字を、動かしてみる
        var alt = null;
        for (var s = 0; s < sols.length; s++) {
          var same = sols[s].every(function (rc) { var r = rects.filter(function (x) { return x.r === rc.r && x.c === rc.c && x.h === rc.h && x.w === rc.w; }); return r.length === 1; });
          if (!same) { alt = sols[s]; break; }
        }
        if (!alt) break;
        var moved = 0;
        rects.forEach(function (r, k2) {
          var inAlt = alt.some(function (rc) { return rc.r === r.r && rc.c === r.c && rc.h === r.h && rc.w === r.w; });
          if (!inAlt && (rnd() < 0.6 || !moved)) { clue[k2] = (r.r + ri(rnd, r.h)) * n + r.c + ri(rnd, r.w); moved++; }
        });
      }
    }
    return null;
  }

  // ヒント: 正しく置けているへや（preset）から、次に決まるへやを1つ
  function hintA(st, preset) {
    var P = parseA(st), lg = logicA(P, { preset: preset, maxLevel: 2 }), sol = solutionA(st);
    if (lg.steps.length) { var s = lg.steps[0]; return { k: s.k, rect: sol[s.k], rule: s.rule }; }
    for (var k = 0; k < sol.length; k++) if (!preset[k]) return { k: k, rect: sol[k], rule: 'answer' };
    return null;
  }

  // =====================================================================
  // モード B「住人さがし」
  //   st = { n, rg, k, a }  rg: マスごとのへやの番号（36進）、k: へやごとの人数（へやの番号の順。1文字ずつ）、a: マスごとに 1（住人）/ 0
  // =====================================================================
  var nbCache = {};
  function nbs(n) {
    if (nbCache[n]) return nbCache[n];
    var out = [];
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n, l = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dy && !dx) continue;
        var y = r + dy, x = c + dx;
        if (y >= 0 && x >= 0 && y < n && x < n) l.push(y * n + x);
      }
      out.push(l);
    }
    nbCache[n] = out;
    return out;
  }
  function parseB(st) {
    var n = st.n, N = n * n, rg = new Int16Array(N), need = [], cells = [], i;
    for (i = 0; i < N; i++) rg[i] = dec(st.rg.charAt(i));
    for (i = 0; i < st.k.length; i++) { need.push(dec(st.k.charAt(i))); cells.push([]); }
    for (i = 0; i < N; i++) cells[rg[i]].push(i);
    // まとまり（へや・よこの列・たての列）。列には L 人ずつ
    var L = st.L == null ? 1 : st.L, U = [];
    for (i = 0; i < need.length; i++) U.push({ kind: 'room', idx: i, cells: cells[i], need: need[i] });
    if (L > 0) for (var y = 0; y < n; y++) {
      var rowc = [], colc = [];
      for (var x = 0; x < n; x++) { rowc.push(y * n + x); colc.push(x * n + y); }
      U.push({ kind: 'row', idx: y, cells: rowc, need: L });
      U.push({ kind: 'col', idx: y, cells: colc, need: L });
    }
    var unitsOf = [];
    for (i = 0; i < N; i++) unitsOf.push([]);
    U.forEach(function (u, ui) { u.cells.forEach(function (c) { unitsOf[c].push(ui); }); });
    return { n: n, N: N, rg: rg, need: need, cells: cells, R: need.length, nb: nbs(n), L: L, U: U, unitsOf: unitsOf };
  }
  var maskCache = {};
  function rowMasks(n) {
    if (maskCache[n]) return maskCache[n];
    var l = [];
    for (var m = 0; m < (1 << n); m++) if (!(m & (m >> 1))) l.push(m);
    maskCache[n] = l;
    return l;
  }
  // こたえを数える（1行ずつ、住人の並び方をえらぶ）
  function countB(P, limit, sols) {
    var n = P.n, R = P.R, L = P.L, colc = new Int16Array(n), masks = rowMasks(n).filter(function (m) { if (!L) return true; var c = 0; for (var b = m; b; b &= b - 1) c++; return c === L; }), have = new Int16Array(R), lastRow = new Int16Array(R), rows = [], count = 0, i, r;
    for (r = 0; r < R; r++) { lastRow[r] = -1; for (i = 0; i < P.cells[r].length; i++) lastRow[r] = Math.max(lastRow[r], Math.floor(P.cells[r][i] / n)); }
    // 行ごと: へやの残りの席（その行より下）で、まだ足りないへやを早めに切る
    var capBelow = [];   // capBelow[y][r] = y 行より下（y をふくまない）にある r のマスの数から考えた、入れられる最大（ざっくり (マス+1)/2 で上をおさえない。マスの数）
    for (var y = 0; y <= n; y++) {
      var cb = new Int16Array(R);
      for (i = y * n; i < n * n; i++) cb[P.rg[i]]++;
      capBelow.push(cb);
    }
    var endAt = [];
    for (y = 0; y < n; y++) endAt.push([]);
    for (r = 0; r < R; r++) { if (lastRow[r] < 0) return 0; endAt[lastRow[r]].push(r); }
    limit = limit || 2;
    function rec(y, prev) {
      if (count >= limit) return;
      if (y === n) { count++; if (sols) sols.push(rows.slice()); return; }
      var ban = prev | (prev << 1) | (prev >> 1), base = y * n;
      for (var mi = 0; mi < masks.length; mi++) {
        var m = masks[mi];
        if (m & ban) continue;
        var ok = true, x, rr;
        for (x = 0; x < n; x++) if (m & (1 << x)) { rr = P.rg[base + x]; have[rr]++; if (have[rr] > P.need[rr]) ok = false; colc[x]++; if (L && colc[x] > L) ok = false; }
        if (ok && L) {
          // たての列: のこりの行で L 人に届かない列
          for (x = 0; x < n; x++) if (L - colc[x] > n - 1 - y) { ok = false; break; }
        }
        if (ok) {
          var e = endAt[y];
          for (x = 0; x < e.length; x++) if (have[e[x]] !== P.need[e[x]]) { ok = false; break; }
        }
        if (ok) {
          // 下の行のマスの数で足りないへや
          var cb = capBelow[y + 1];
          for (rr = 0; rr < R; rr++) if (P.need[rr] - have[rr] > cb[rr]) { ok = false; break; }
        }
        if (ok) { rows.push(m); rec(y + 1, m); rows.pop(); }
        for (x = 0; x < n; x++) if (m & (1 << x)) { have[P.rg[base + x]]--; colc[x]--; }
        if (count >= limit) return;
      }
    }
    rec(0, 0);
    return count;
  }
  function rowsToA(n, rows) { var a = []; for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) a.push(rows[y] & (1 << x) ? '1' : '0'); return a.join(''); }

  // 住人の入れ方の最大（となりあわない）。cap に届いたらそこでやめる
  function misB(cellsList, nbSet, cap) {
    var best = 0;
    function rec(idx, chosen, cnt) {
      if (cnt > best) best = cnt;
      if (best >= cap) return;
      if (cnt + (cellsList.length - idx) <= best) return;
      for (var i = idx; i < cellsList.length; i++) {
        var c = cellsList[i], ok = true;
        for (var j = 0; j < chosen.length; j++) if (nbSet[c][chosen[j]]) { ok = false; break; }
        if (!ok) continue;
        chosen.push(c); rec(i + 1, chosen, cnt + 1); chosen.pop();
        if (best >= cap) return;
      }
    }
    rec(0, [], 0);
    return best;
  }
  var nbSetCache = {};
  function nbSet(n) {
    if (nbSetCache[n]) return nbSetCache[n];
    var l = nbs(n), out = [];
    for (var i = 0; i < l.length; i++) { var o = {}; for (var j = 0; j < l[i].length; j++) o[l[i][j]] = 1; out.push(o); }
    nbSetCache[n] = out;
    return out;
  }

  // 人のとき方。v: マスごとに 0 わからない / 1 住人 / 2 いない。まとまり = へや・よこの列・たての列
  //   住人のまわり8マスと、人数がそろったまとまりののこり → いない（手順に数えない）
  //   full: まとまりのあいているマスの数と、足りない人数が同じ → ぜんぶ住人
  //   corner: 足りない人数が1人のまとまりの、どのマスにもとなりあうマス → いない
  //   squeeze: そこに住人がいると、どこかのまとまりに入りきらなくなる
  //   trial: ためしにおくと、どこかで矛盾する（level 2）
  function logicB(P, opts) {
    opts = opts || {};
    var N = P.N, U = P.U, nb = P.nb, ns = nbSet(P.n), maxLevel = opts.maxLevel || 2;
    var v = new Int8Array(N), steps = [], use = { full: 0, corner: 0, squeeze: 0, trial: 0 }, i;
    if (opts.preset) for (i = 0; i < N; i++) if (opts.preset[i] === 1) v[i] = 1;
    function basic(v, rec, withSqueeze) {
      for (;;) {
        var prog = false, i, j, u;
        for (i = 0; i < N; i++) if (v[i] === 1) for (j = 0; j < nb[i].length; j++) {
          var t = nb[i][j];
          if (v[t] === 1) return false;
          if (v[t] === 0) v[t] = 2;
        }
        for (u = 0; u < U.length && !prog; u++) {
          var have = 0, unk = [], cs = U[u].cells;
          for (j = 0; j < cs.length; j++) { if (v[cs[j]] === 1) have++; else if (!v[cs[j]]) unk.push(cs[j]); }
          var rem = U[u].need - have;
          if (rem < 0 || unk.length < rem) return false;
          if (!unk.length) continue;
          if (rem === 0) { for (j = 0; j < unk.length; j++) v[unk[j]] = 2; prog = true; break; }
          if (unk.length === rem) {
            for (j = 0; j < unk.length; j++) { v[unk[j]] = 1; if (rec) rec.steps.push({ cell: unk[j], rule: 'full', u: u, kind: U[u].kind }); }
            if (rec) rec.use.full++;
            prog = true; break;
          }
          if (misB(unk, ns, rem) < rem) return false;
          if (rem === 1) {
            var common = null;
            for (j = 0; j < unk.length; j++) {
              var s = {};
              for (var q = 0; q < nb[unk[j]].length; q++) { var x = nb[unk[j]][q]; if (!common || common[x]) s[x] = 1; }
              common = s;
            }
            for (var cx in common) { cx = +cx; if (!v[cx]) { v[cx] = 2; prog = true; } }
            if (prog) { if (rec) rec.use.corner++; break; }
          }
        }
        if (prog) continue;
        if (withSqueeze) {
          for (i = 0; i < N && !prog; i++) {
            if (v[i]) continue;
            var touch = {};
            for (j = 0; j < nb[i].length; j++) P.unitsOf[nb[i][j]].forEach(function (x) { touch[x] = 1; });
            P.unitsOf[i].forEach(function (x) { touch[x] = 1; });
            for (var us in touch) {
              u = +us;
              var cs2 = U[u].cells, have2 = 0, unk2 = [], self = 0;
              for (j = 0; j < cs2.length; j++) {
                var c2 = cs2[j];
                if (c2 === i) { self = 1; continue; }
                if (v[c2] === 1) have2++;
                else if (!v[c2] && !ns[i][c2]) unk2.push(c2);
              }
              var rem2 = U[u].need - have2 - self;
              if (rem2 < 0 || misB(unk2, ns, rem2) < rem2) { v[i] = 2; prog = true; if (rec) rec.use.squeeze++; break; }
            }
          }
          if (prog) continue;
        }
        return true;
      }
    }
    var rec = { steps: steps, use: use };
    for (;;) {
      if (!basic(v, rec, true)) return { ok: false, solved: false, steps: steps, use: use };
      var done = true;
      for (i = 0; i < N; i++) if (!v[i]) { done = false; break; }
      if (done || maxLevel < 2) break;
      var prog = false;
      for (i = 0; i < N && !prog; i++) {
        if (v[i]) continue;
        var t1 = new Int8Array(v); t1[i] = 1;
        if (!basic(t1, null, true)) { v[i] = 2; use.trial++; prog = true; break; }
        var t2 = new Int8Array(v); t2[i] = 2;
        if (!basic(t2, null, true)) { v[i] = 1; use.trial++; steps.push({ cell: i, rule: 'trial', u: -1 }); prog = true; break; }
      }
      if (!prog) break;
    }
    var solved = true;
    for (i = 0; i < N; i++) if (!v[i]) solved = false;
    var diff = use.full + use.corner * 2 + use.squeeze * 3 + use.trial * 10 + Math.round(N / 10);
    return { ok: true, solved: solved, steps: steps, use: use, level: use.trial ? 2 : 1, diff: diff, v: v };
  }

  function connectedWithout(P2, cells, x) {
    var rest = cells.filter(function (c) { return c !== x; });
    if (!rest.length) return false;
    var n = P2.n, seen = {}, stack = [rest[0]], set = {}, cnt = 0;
    rest.forEach(function (c) { set[c] = 1; });
    seen[rest[0]] = 1;
    while (stack.length) {
      var c = stack.pop(); cnt++;
      var r = Math.floor(c / n), col = c % n, nn = [];
      if (r > 0) nn.push(c - n); if (r < n - 1) nn.push(c + n); if (col > 0) nn.push(c - 1); if (col < n - 1) nn.push(c + 1);
      for (var j = 0; j < nn.length; j++) if (set[nn[j]] && !seen[nn[j]]) { seen[nn[j]] = 1; stack.push(nn[j]); }
    }
    return cnt === rest.length;
  }
  // へやの番号を、左上から出てくる順にふりなおす
  function normB(n, rg, sol) {
    var map = {}, next = 0, out = [], k = [];
    for (var i = 0; i < n * n; i++) { if (map[rg[i]] == null) { map[rg[i]] = next++; k.push(0); } out.push(map[rg[i]]); if (sol[i]) k[map[rg[i]]]++; }
    return { rg: out.map(enc).join(''), k: k.map(enc).join('') };
  }

  // 問題を作る（o: { density, maxNeed, zeros, pair, level, maxTrial, minDiff }）
  function genB(n, rnd, o) {
    var N = n * n, nb = nbs(n);
    for (var attempt = 0; attempt < 80; attempt++) {
      // こたえ（住人の場所）: どの列にも1人。上下の行の住人は、となりの列にならない
      var sol = new Int8Array(N), order = shuffle(rnd, Array.from({ length: N }, function (_, i) { return i; })), cnt = 0, i, j, q;
      var perm = null;
      for (var pt = 0; pt < 200 && !perm; pt++) {
        var p = shuffle(rnd, Array.from({ length: n }, function (_, i) { return i; })), good = true;
        for (j = 1; j < n; j++) if (Math.abs(p[j] - p[j - 1]) <= 1) { good = false; break; }
        if (good) perm = p;
      }
      if (!perm) continue;
      for (j = 0; j < n; j++) { sol[j * n + perm[j]] = 1; cnt++; }
      // へや: 住人ひとりずつ（＋住人のいないへや）から、となりのマスを取りこんでふくらませる
      var rg = new Int16Array(N), seeds = [];
      for (i = 0; i < N; i++) { rg[i] = -1; if (sol[i]) seeds.push(i); }
      var zeros = o.zeros || 0;
      for (j = 0; j < order.length && zeros > 0; j++) {
        var z = order[order.length - 1 - j];
        if (sol[z]) continue;
        var far = true;
        for (q = 0; q < nb[z].length; q++) if (sol[nb[z][q]]) far = false;
        if (far) { seeds.push(z); zeros--; }
      }
      seeds.forEach(function (s, k) { rg[s] = k; });
      var R = seeds.length, left = N - R, guard = 0;
      while (left > 0 && guard++ < N * 200) {
        var x = ri(rnd, N);
        if (rg[x] >= 0) continue;
        var r = Math.floor(x / n), col = x % n, opts = [];
        if (r > 0 && rg[x - n] >= 0) opts.push(rg[x - n]);
        if (r < n - 1 && rg[x + n] >= 0) opts.push(rg[x + n]);
        if (col > 0 && rg[x - 1] >= 0) opts.push(rg[x - 1]);
        if (col < n - 1 && rg[x + 1] >= 0) opts.push(rg[x + 1]);
        if (!opts.length) continue;
        rg[x] = opts[ri(rnd, opts.length)]; left--;
      }
      if (left > 0) continue;
      // いくつかのへやをくっつけて2人のへやにする
      var pairs = Math.round(R * (o.pair || 0));
      for (var pi = 0; pi < pairs * 6 && pairs > 0; pi++) {
        var a0 = ri(rnd, N), dirs = [1, -1, n, -n], d = dirs[ri(rnd, 4)], b0 = a0 + d;
        if (b0 < 0 || b0 >= N || (Math.abs(d) === 1 && Math.floor(b0 / n) !== Math.floor(a0 / n))) continue;
        var ra = rg[a0], rb = rg[b0];
        if (ra === rb) continue;
        var na = 0, nbb = 0, sa = 0;
        for (i = 0; i < N; i++) { if (rg[i] === ra) { na += sol[i]; sa++; } if (rg[i] === rb) { nbb += sol[i]; sa++; } }
        if (na + nbb > o.maxNeed || na + nbb === 0 || sa > o.maxSize) continue;
        for (i = 0; i < N; i++) if (rg[i] === rb) rg[i] = ra;
        pairs--;
      }
      // こたえが1つになるように、へやのさかいめを1マスずつ動かす
      var st0 = normB(n, rg, sol), P = parseB({ n: n, rg: st0.rg, k: st0.k });
      var cur = countB(P, 40);
      var steps = 0;
      while (cur > 1 && steps++ < o.climb) {
        var x2 = ri(rnd, N), d2 = [1, -1, n, -n][ri(rnd, 4)], y2 = x2 + d2;
        if (y2 < 0 || y2 >= N || (Math.abs(d2) === 1 && Math.floor(y2 / n) !== Math.floor(x2 / n))) continue;
        var from = P.rg[x2], to = P.rg[y2];
        if (from === to) continue;
        if (!connectedWithout(P, P.cells[from], x2)) continue;
        if (P.cells[to].length + 1 > o.maxSize) continue;
        var newNeed = P.need[to] + sol[x2];
        if (newNeed > o.maxNeed) continue;
        var rg2 = Array.prototype.slice.call(P.rg); rg2[x2] = to;
        var st1 = normB(n, rg2, sol), P1 = parseB({ n: n, rg: st1.rg, k: st1.k });
        var c1 = countB(P1, 40);
        if (c1 >= 1 && (c1 <= cur || rnd() < 0.05)) { P = P1; cur = c1; st0 = st1; }
      }
      if (o.debug) o.debug.push(cur);
      if (cur !== 1) continue;
      // 小さすぎるへや（1マス）は多すぎないように
      var tiny = 0;
      for (var rr = 0; rr < P.R; rr++) if (P.cells[rr].length === 1) tiny++;
      if (tiny > (o.maxTiny == null ? 2 : o.maxTiny)) continue;
      var lg = logicB(P, { maxLevel: o.level });
      if (!lg.solved) continue;
      if (o.maxTrial != null && lg.use.trial > o.maxTrial) continue;
      if (o.minDiff && lg.diff < o.minDiff) continue;
      var a = [];
      for (i = 0; i < N; i++) a.push(sol[i] ? '1' : '0');
      return { n: n, L: 1, rg: st0.rg, k: st0.k, a: a.join(''), diff: lg.diff, level: lg.level, rooms: P.R, people: cnt };
    }
    return null;
  }

  // ヒント: 正しくおけている住人（preset: マスごとに 1）から、次に決まる住人を1人
  function hintB(st, preset) {
    var P = parseB(st), lg = logicB(P, { preset: preset, maxLevel: 2 });
    for (var j = 0; j < lg.steps.length; j++) if (st.a.charAt(lg.steps[j].cell) === '1' && !preset[lg.steps[j].cell]) return lg.steps[j];
    for (var i = 0; i < P.N; i++) if (st.a.charAt(i) === '1' && !preset[i]) return { cell: i, rule: 'answer', r: P.rg[i] };
    return null;
  }

  // =====================================================================
  // ステージのむずかしさ（作るときの設定）と、今日のへや
  // =====================================================================
  function optA(n, level) {
    var avg = { 4: 3.2, 5: 3.6, 6: 4.2, 7: 4.8, 8: 5.2, 9: 5.6, 10: 6.0 }[n];
    return { avg: avg, maxA: n <= 5 ? 6 : n <= 7 ? 9 : 12, maxSide: n <= 6 ? 4 : n <= 8 ? 6 : 7, maxOnes: n <= 6 ? 1 : 2, level: level || 1, maxTrial: level === 2 ? 2 : 0, minBig: n >= 7 ? 6 : 4 };
  }
  function optB(n, level) {
    return {
      density: { 5: 0.2, 6: 0.2, 7: 0.2, 8: 0.2, 9: 0.2 }[n] || 0.2,
      maxNeed: n <= 5 ? 2 : 3, maxSize: n <= 6 ? 9 : 12, zeros: n <= 6 ? 1 : 2, pair: n <= 5 ? 0.2 : 0.3,
      climb: 400, level: level || 1, maxTrial: level === 2 ? 3 : 0, maxTiny: 2
    };
  }

  // 日本時間の日付 '2026-10-20'
  function dayKey(ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 9 * 3600 * 1000);
    var m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  // 今日のへや割り・今日の住人さがし（1.0.1 から。1問ずつ・日付で決まる。だれの端末でも、あとから過去の日をえらんでも同じ）
  //   作り方を変えたら DAILY_VERSION を上げる（上げると過去の日の問題もかわるので、なるべく上げない）
  var DAILY_VERSION = 1;
  var DAILY = { a: { n: 8 }, b: { n: 8 } };
  var DAILY_FIRST = '2026-10-01';   // 「過去の問題」でえらべるいちばん古い日
  function dailyOne(mode, day) {
    day = day || dayKey();
    var n = DAILY[mode].n, st = null;
    for (var t = 0; !st && t < 50; t++) {
      var rnd = rng(hashStr('suji|d' + mode + '|' + DAILY_VERSION + '|' + day + '|' + t));
      st = mode === 'a' ? genA(n, rnd, optA(n, 1)) : genB(n, rnd, optB(n, 1));
    }
    return { mode: mode, day: day, ver: DAILY_VERSION, st: st };
  }
  // 記録: 調整タイム = かかった時間 ＋ ヒント × 30秒。ポイント = 1000 − 調整タイム(秒)（100 より下にはしない）
  //   記録 = ポイント × 10万 ＋ (99999 − 調整タイム(0.1秒))。5 秒より速いものはサーバーがことわる（0012_suji_daily_modes.sql）
  var PENALTY = { hint: 30 };
  var MIN_T10 = 50;
  function dailyScore(sec10, hints) {
    var t10 = Math.min(99999, Math.max(0, Math.round(sec10) + (hints || 0) * PENALTY.hint * 10));
    var pts = Math.max(100, 1000 - Math.floor(t10 / 10));
    return { t10: t10, points: pts, score: pts * 100000 + (99999 - t10) };
  }
  function decodeScore(score) { var pt = Math.floor(score / 100000), t10 = 99999 - score % 100000; return { points: pt, t10: t10 }; }
  function fmtTime(t10) {
    var s = Math.floor(t10 / 10), m = Math.floor(s / 60);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) + (t10 < 6000 ? '.' + (t10 % 10) : '');
  }

  var SJ = {
    rng: rng, hashStr: hashStr, enc: enc, dec: dec,
    parseA: parseA, candA: candA, countA: countA, logicA: logicA, solutionA: solutionA, genA: genA, hintA: hintA, optA: optA, rectCells: rectCells,
    parseB: parseB, countB: countB, logicB: logicB, genB: genB, hintB: hintB, optB: optB, nbs: nbs, rowsToA: rowsToA,
    dayKey: dayKey, dailyOne: dailyOne, DAILY_VERSION: DAILY_VERSION, DAILY: DAILY, DAILY_FIRST: DAILY_FIRST,
    dailyScore: dailyScore, decodeScore: decodeScore, fmtTime: fmtTime, PENALTY: PENALTY, MIN_T10: MIN_T10
  };
  root.SJ = SJ;
  if (typeof module !== 'undefined') module.exports = SJ;
})(typeof window !== 'undefined' ? window : this);

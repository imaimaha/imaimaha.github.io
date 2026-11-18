/*
 * Make 10 ソルバー（DOM非依存の純粋関数のみ）
 * 4つの数字を1回ずつ使い、＋−×÷とカッコで10が作れるかを厳密に判定する。
 * - 有理数（分子/分母の整数）で計算するので浮動小数の誤差なし
 * - 「2つ選んで1つにまとめる」を再帰することで、全ての並び順・全ての木の形を網羅
 * - 0での割り算は除外
 */
var Make10 = (function () {
  'use strict';

  var TARGET = 10;
  var SYM = [' + ', ' − ', ' × ', ' ÷ '];

  function gcd(a, b) {
    if (a < 0) a = -a;
    if (b < 0) b = -b;
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function leaf(v, wantExpr) {
    return { n: v, d: 1, e: wantExpr ? String(v) : null, p: 3 };
  }

  // 式の文字列（必要なカッコだけ付ける）。p: 1=加減, 2=乗除, 3=数字
  function fmt(a, b, op) {
    var L = a.e, R = b.e;
    if (op >= 2 && a.p === 1) L = '(' + L + ')';
    if ((op === 1 || op === 2) && b.p === 1) R = '(' + R + ')';
    if (op === 3 && b.p <= 2) R = '(' + R + ')';
    return L + SYM[op] + R;
  }

  // op: 0=+ 1=− 2=× 3=÷
  function combine(a, b, op, wantExpr) {
    var n, d;
    if (op === 0) { n = a.n * b.d + b.n * a.d; d = a.d * b.d; }
    else if (op === 1) { n = a.n * b.d - b.n * a.d; d = a.d * b.d; }
    else if (op === 2) { n = a.n * b.n; d = a.d * b.d; }
    else {
      if (b.n === 0) return null;
      n = a.n * b.d; d = a.d * b.n;
    }
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    if (g > 1) { n /= g; d /= g; }
    if (n === 0) d = 1;
    return { n: n, d: d, e: wantExpr ? fmt(a, b, op) : null, p: op < 2 ? 1 : 2 };
  }

  // 組み合わせ順: a+b, a×b, a−b, b−a, a÷b, b÷a
  var OPS_A = [0, 2, 1, 1, 3, 3];
  var SWAP = [false, false, false, true, false, true];

  // mode（表示用の式を見やすくするための制限）: 0=途中が負数・分数にならない式だけ, 1=負数なし, 2=制限なし
  function search(items, wantExpr, mode) {
    var len = items.length;
    if (len === 1) {
      var it = items[0];
      return (it.d === 1 && it.n === TARGET) ? it : null;
    }
    for (var i = 0; i < len; i++) {
      for (var j = i + 1; j < len; j++) {
        var rest = [];
        for (var k = 0; k < len; k++) if (k !== i && k !== j) rest.push(items[k]);
        for (var o = 0; o < 6; o++) {
          var a = items[i], b = items[j];
          if (SWAP[o]) { a = items[j]; b = items[i]; }
          var c = combine(a, b, OPS_A[o], wantExpr);
          if (!c) continue;
          if (mode < 2 && c.n < 0) continue;
          if (mode < 1 && c.d !== 1) continue;
          rest.push(c);
          var r = search(rest, wantExpr, mode);
          rest.pop();
          if (r) return r;
        }
      }
    }
    return null;
  }

  // 0〜9999 → [d0,d1,d2,d3]（先頭0埋め）
  function digitsOf(num) {
    num = Math.floor(num);
    return [Math.floor(num / 1000) % 10, Math.floor(num / 100) % 10, Math.floor(num / 10) % 10, num % 10];
  }

  function toDigits(x) {
    if (typeof x === 'number') return digitsOf(x);
    if (typeof x === 'string') return digitsOf(parseInt(x, 10) || 0);
    return x;
  }

  // 1つの解（式の文字列）を返す。作れなければ null
  function solve(x) {
    var ds = toDigits(x);
    var items = [];
    for (var i = 0; i < ds.length; i++) items.push(leaf(ds[i], true));
    // まず見やすい式を探し、なければ制限をゆるめる（判定結果は mode 2 と同じ）
    for (var mode = 0; mode <= 2; mode++) {
      var r = search(items, true, mode);
      if (r) return r.e;
    }
    return null;
  }

  // 計算だけ（式の文字列を作らない高速版）
  function solvableRaw(ds) {
    var items = [];
    for (var i = 0; i < ds.length; i++) items.push(leaf(ds[i], false));
    return search(items, false, 2) !== null;
  }

  // 0000〜9999 の判定表。並び順は結果に影響しないので、ソート済みの組（715通り）だけ計算する
  var table = null;
  var buildMs = 0;
  function buildTable() {
    if (table) return table;
    var t0 = Date.now();
    var memo = {};
    var tb = new Uint8Array(10000);
    for (var num = 0; num < 10000; num++) {
      var ds = digitsOf(num).sort();
      var key = ds.join('');
      var v = memo[key];
      if (v === undefined) { v = solvableRaw(ds) ? 1 : 0; memo[key] = v; }
      tb[num] = v;
    }
    table = tb;
    buildMs = Date.now() - t0;
    return table;
  }

  function isSolvable(x) {
    var ds = toDigits(x);
    if (ds.length === 4) {
      var tb = buildTable();
      return tb[ds[0] * 1000 + ds[1] * 100 + ds[2] * 10 + ds[3]] === 1;
    }
    return solvableRaw(ds);
  }

  function countSolvable() {
    var tb = buildTable(), c = 0;
    for (var i = 0; i < 10000; i++) c += tb[i];
    return c;
  }

  return {
    TARGET: TARGET,
    solve: solve,
    isSolvable: isSolvable,
    buildTable: buildTable,
    countSolvable: countSolvable,
    digitsOf: digitsOf,
    buildMs: function () { return buildMs; }
  };
})();

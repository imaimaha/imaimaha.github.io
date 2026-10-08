/* 小さな QR コード作成（通信なし）。招待リンク用。
   バイトモード・誤り訂正レベル M・バージョン 1〜10。考え方は Project Nayuki の QR Code generator（MIT）と同じ手順を、短く書き直したもの。
   QR.make(text) → { size, get(x, y) }、QR.draw(canvas, text, px) で描く */
var QR = (function () {
  'use strict';
  // バージョンごとの: [全体のコードワード数, 誤り訂正ブロック数, ブロックあたりの訂正コードワード数]（レベル M）
  var ECC_M = [null, [1, 10], [1, 16], [1, 26], [2, 18], [2, 24], [4, 16], [4, 18], [4, 22], [5, 22], [5, 26]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { var n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(ver) { var e = ECC_M[ver]; return Math.floor(rawModules(ver) / 8) - e[0] * e[1]; }

  // ガロア体 GF(256) の掛け算
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (var k = 0; k < deg; k++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }

  function utf8(text) { var out = [], s = unescape(encodeURIComponent(text)); for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }

  function make(text) {
    var bytes = utf8(text), ver;
    for (ver = 1; ver <= 10; ver++) { var cc = ver <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break; }
    if (ver > 10) throw new Error('QR: 長すぎる');
    var bits = [];
    function put(v, n) { for (var i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); }
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(ver) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
    // ブロックに分けて誤り訂正をつけ、交互に並べる
    var e = ECC_M[ver], nb = e[0], eccLen = e[1], raw = Math.floor(rawModules(ver) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = rsDivisor(eccLen), k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (b, bi) { if (i !== shortLen - eccLen || bi >= nShort) all.push(b[i]); });

    var size = ver * 4 + 17, mods = [], fn = [];
    for (i = 0; i < size; i++) { mods.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, d) { mods[y][x] = d; fn[y][x] = true; }
    function finder(x, y) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
    }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var al = ALIGN[ver];
    al.forEach(function (ax, ia) { al.forEach(function (ay, ib) {
      if ((ia === 0 && ib === 0) || (ia === 0 && ib === al.length - 1) || (ia === al.length - 1 && ib === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    function drawFormat(mask) {
      var d = (0 << 3) | mask, rem = d;           // レベル M = 0
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412;
      for (q = 0; q <= 5; q++) set(8, q, ((b >>> q) & 1) !== 0);
      set(8, 7, ((b >>> 6) & 1) !== 0); set(8, 8, ((b >>> 7) & 1) !== 0); set(7, 8, ((b >>> 8) & 1) !== 0);
      for (q = 9; q < 15; q++) set(14 - q, 8, ((b >>> q) & 1) !== 0);
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, ((b >>> q) & 1) !== 0);
      for (q = 8; q < 15; q++) set(8, size - 15 + q, ((b >>> q) & 1) !== 0);
      set(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var rem = ver; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); }
    }
    // データを置く（右下から、2列ずつジグザグ）
    var bi2 = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi2 < all.length * 8) { mods[y][x] = ((all[bi2 >>> 3] >>> (7 - (bi2 & 7))) & 1) !== 0; bi2++; }
      }
    }
    function maskFn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0; case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; case 5: return x * y % 2 + x * y % 3 === 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 === 0; default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }
    function applyMask(m) { for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) if (!fn[yy][xx] && maskFn(m, xx, yy)) mods[yy][xx] = !mods[yy][xx]; }
    // いちばん読みやすいマスクをえらぶ（かんたんな減点で）
    function penalty() {
      var p = 0, xx, yy, run, c;
      for (yy = 0; yy < size; yy++) { run = 1; for (xx = 1; xx < size; xx++) { if (mods[yy][xx] === mods[yy][xx - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (xx = 0; xx < size; xx++) { run = 1; for (yy = 1; yy < size; yy++) { if (mods[yy][xx] === mods[yy - 1][xx]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (yy = 0; yy < size - 1; yy++) for (xx = 0; xx < size - 1; xx++) { c = mods[yy][xx]; if (c === mods[yy][xx + 1] && c === mods[yy + 1][xx] && c === mods[yy + 1][xx + 1]) p += 3; }
      var dark = 0; for (yy = 0; yy < size; yy++) for (xx = 0; xx < size; xx++) if (mods[yy][xx]) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) { applyMask(mk); drawFormat(mk); var pp = penalty(); if (pp < bestP) { bestP = pp; best = mk; } applyMask(mk); }
    applyMask(best); drawFormat(best);
    return { size: size, version: ver, mask: best, get: function (x, y) { return mods[y][x]; } };
  }

  // canvas に描く（まわりに白い余白4マス）
  function draw(canvas, text, px) {
    var q = make(text), n = q.size + 8, s = px || 6;
    canvas.width = n * s; canvas.height = n * s;
    var g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, n * s, n * s); g.fillStyle = '#000';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.get(x, y)) g.fillRect((x + 4) * s, (y + 4) * s, s, s);
    return q;
  }
  return { make: make, draw: draw };
})();
if (typeof window !== 'undefined') window.QR = QR;

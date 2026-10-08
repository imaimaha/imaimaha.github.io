/* 変則将棋 — 自作の詰将棋の「共有コード」と、盤のおかしなところのチェック
   ブラウザでも jsc（テスト）でも動く（DOM は使わない）。engine.js・variants.js のあとに読み込む。
   コードの中身: "S5;<盤>;<持ち駒>" を base64url にして、先頭に "HS1." をつけたもの。最後の2文字は打ち間違いの検出用
     S/N/E/W = 安南/安北/安東/安西、H = 本将棋。数字は手数。
     盤は上（一段目）から9段を "/" でつなぐ。攻め方は大文字、玉方は小文字、成り駒は "+"、空きマスは数字（SFEN と同じ書き方）
     持ち駒は攻め方の分だけ（例 "R2P"、なければ "-"）。玉方の持ち駒は「残り全部」なので書かない */
(function (root) {
  'use strict';
  var HS = root.HS = root.HS || {};
  var R = HS.rules, DEF = HS.DEF;
  var RULES = { S: 'an-S-9', N: 'an-N-9', E: 'an-E-9', W: 'an-W-9', H: 'honshogi' };
  var RULE_OF = {}; Object.keys(RULES).forEach(function (k) { RULE_OF[RULES[k]] = k; });
  var RULE_NAME = { 'an-S-9': '安南', 'an-N-9': '安北', 'an-E-9': '安東', 'an-W-9': '安西', honshogi: '本将棋' };
  var LET = { 1: 'P', 2: 'L', 3: 'N', 4: 'S', 5: 'G', 6: 'B', 7: 'R', 8: 'K' };
  var PROM_OF = { 9: 1, 10: 2, 11: 3, 12: 4, 13: 6, 14: 7 };
  var T_OF = {}; Object.keys(LET).forEach(function (t) { T_OF[LET[t]] = +t; });
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function b64enc(str) {
    var out = '', i;
    for (i = 0; i < str.length; i += 3) {
      var a = str.charCodeAt(i), b = str.charCodeAt(i + 1), c = str.charCodeAt(i + 2);
      var n = (a << 16) | ((b || 0) << 8) | (c || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < str.length ? B64[(n >> 6) & 63] : '') + (i + 2 < str.length ? B64[n & 63] : '');
    }
    return out;
  }
  function b64dec(s) {
    var out = '', buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var v = B64.indexOf(s[i]); if (v < 0) throw new Error('コードに使えない文字があります');
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 255); }
    }
    return out;
  }
  function sum(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 4096; return B64[h >> 6] + B64[h & 63]; }

  // 問題 { v, n, rows, hand } → 共有コード
  function encode(pz) {
    var V = HS.VARIANTS[pz.v], b = HS.parseRows(pz.rows, 9, 9), rows = [];
    for (var y = 0; y < 9; y++) {
      var r = '', gap = 0;
      for (var x = 0; x < 9; x++) {
        var v = b[y * 9 + x];
        if (!v) { gap++; continue; }
        if (gap) { r += gap; gap = 0; }
        var t = R.kind(v), pr = PROM_OF[t], ch = LET[pr || t];
        r += (pr ? '+' : '') + (v < 0 ? ch.toLowerCase() : ch);
      }
      if (gap) r += gap;
      rows.push(r);
    }
    var hand = '';
    [7, 6, 5, 4, 3, 2, 1].forEach(function (t) { var c = pz.hand[t] || 0; if (c) hand += (c > 1 ? c : '') + LET[t]; });
    var raw = RULE_OF[pz.v] + pz.n + ';' + rows.join('/') + ';' + (hand || '-');
    if (!V || !RULE_OF[pz.v]) throw new Error('このルールは共有できません');
    return 'HS1.' + b64enc(raw) + sum(raw);
  }
  // 共有コード → 問題 { v, n, rows, hand }。おかしなコードは Error（日本語の説明）
  function decode(code) {
    // 前後の文章ごと貼られてもよいように、「HS1.」のあとのコードの文字だけを取り出す（途中の改行・空白は無視）
    var c = String(code || '').replace(/\s+/g, '');
    var at = c.indexOf('HS1.');
    if (at < 0) throw new Error('「HS1.」で始まるコードを貼ってください');
    c = (/^[A-Za-z0-9_-]*/.exec(c.slice(at + 4)) || [''])[0];
    if (c.length < 8) throw new Error('コードが短すぎます');
    var body = c.slice(0, -2), chk = c.slice(-2), raw = b64dec(body);
    if (sum(raw) !== chk) throw new Error('コードが途中で切れているか、まちがっています');
    var m = /^([SNEWH])(\d+);([^;]+);([^;]+)$/.exec(raw);
    if (!m) throw new Error('コードの形がおかしいです');
    var n = +m[2];
    if (!(n >= 1 && n <= 15 && n % 2 === 1)) throw new Error('手数は1〜15の奇数にしてください');
    var rowsIn = m[3].split('/');
    if (rowsIn.length !== 9) throw new Error('盤の段の数がおかしいです');
    var rows = rowsIn.map(function (r) {
      var cells = [], prom = false;
      for (var i = 0; i < r.length; i++) {
        var ch = r[i];
        if (ch === '+') { prom = true; continue; }
        if (/[1-9]/.test(ch)) { for (var k = 0; k < +ch; k++) cells.push('.'); prom = false; continue; }
        var up = ch.toUpperCase(), t = T_OF[up];
        if (!t) throw new Error('知らない駒「' + ch + '」があります');
        if (prom) { var pt = DEF[t].prom; if (!pt || t === 8) throw new Error('成れない駒が成っています'); t = pt; }
        var name = t === 8 ? (ch === up ? '玉' : '王') : DEF[t].n;
        cells.push((ch === up ? '' : 'v') + name); prom = false;
      }
      if (cells.length !== 9) throw new Error('盤の筋の数がおかしいです');
      return cells.join(' ');
    });
    var hand = {}, hs = m[4];
    if (hs !== '-') {
      var re = /(\d*)([PLNSGBR])/g, mm, used = 0;
      while ((mm = re.exec(hs))) { hand[T_OF[mm[2]]] = (hand[T_OF[mm[2]]] || 0) + (mm[1] ? +mm[1] : 1); used += mm[0].length; }
      if (used !== hs.length) throw new Error('持ち駒の書き方がおかしいです');
    }
    return { v: RULES[m[1]], n: n, rows: rows, hand: hand };
  }

  // 盤そのもののおかしなところ（ソルバーを使わずに分かるもの）。{ errors: [...], s: 局面 }
  function check(pz) {
    var V = HS.VARIANTS[pz.v], errors = [];
    var b = HS.parseRows(pz.rows, V.w, V.h);
    var h0 = V.handTypes.map(function (t) { return pz.hand[t] || 0; });
    var dk = 0, ak = 0, i, x, y;
    for (i = 0; i < V.n; i++) { if (b[i] === -8) dk++; if (b[i] === 8) ak++; }
    if (!dk) errors.push('玉方の玉（王）を1枚置いてください');
    if (dk > 1) errors.push('玉方の玉が' + dk + '枚あります（1枚だけにしてください）');
    if (ak) errors.push('攻め方に玉は置けません（詰将棋は玉方の玉だけ）');
    var total = {}, used = {};
    for (i = 0; i < V.n; i++) if (V.start[i]) { var t0 = R.base(R.kind(V.start[i])); if (!DEF[t0].royal) total[t0] = (total[t0] || 0) + 1; }
    for (i = 0; i < V.n; i++) if (b[i] && Math.abs(b[i]) !== 8) { var t1 = R.base(R.kind(b[i])); used[t1] = (used[t1] || 0) + 1; }
    V.handTypes.forEach(function (t, j) { used[t] = (used[t] || 0) + h0[j]; });
    Object.keys(used).forEach(function (t) { if (used[t] > (total[t] || 0)) errors.push('「' + DEF[t].n + '」が多すぎます（盤と持ち駒あわせて ' + used[t] + ' 枚。全部で ' + (total[t] || 0) + ' 枚まで）'); });
    [[1, '攻め方'], [-1, '玉方']].forEach(function (pp) {
      for (x = 0; x < V.w; x++) { var c = 0; for (y = 0; y < V.h; y++) if (b[y * V.w + x] === pp[0]) c++; if (c > 1) { errors.push('二歩があります（' + pp[1] + '・' + (V.w - x) + '筋）'); break; } }
    });
    for (i = 0; i < V.n; i++) if (b[i]) {
      y = (i / V.w) | 0;
      if (R.deadAt(V, R.kind(b[i]), y, R.owner(b[i]))) errors.push('行き所のない駒があります（' + HS.sqName(V, i) + 'の' + DEF[R.kind(b[i])].n + '）');
    }
    var anyA = h0.some(function (c) { return c > 0; });
    for (i = 0; i < V.n; i++) if (b[i] > 0) anyA = true;
    if (!anyA) errors.push('攻め方の駒（盤か持ち駒）がありません');
    var s = null;
    if (!errors.length) {
      s = { b: b, hand: [h0, HS.tsumeHand(V, b, h0)], turn: 0, ply: 0 };
      if (R.inCheck(V, s, 1)) errors.push('玉方の玉に、最初から王手がかかっています');
      if (!errors.length && !new HS.Solver(V).checks(s).length) errors.push('攻め方の王手になる手がありません');
    }
    if (!(pz.n >= 1 && pz.n <= 15 && pz.n % 2 === 1)) errors.push('手数は1〜15の奇数にしてください');
    return { errors: errors, s: errors.length ? null : s };
  }

  // ソルバーでの検証。少しずつ進められる（画面では1手ずつ進めて進み具合を出し、時間切れで止める）
  //   var vf = new Verifier(pz); while (!vf.done) vf.step(); var rep = vf.report();
  function Verifier(pz) {
    this.pz = pz; var c = check(pz);
    this.errors = c.errors; this.s = c.s; this.k = 0; this.cands = []; this.lens = [];
    if (this.s) { this.V = HS.VARIANTS[pz.v]; this.solver = new HS.Solver(this.V); this.cands = this.solver.checks(this.s); }
    this.done = !this.s;
  }
  // 王手の候補を1つ調べる（その手のあと、何手で詰むか。手数以内で詰まなければ -1）
  Verifier.prototype.step = function () {
    if (this.done) return;
    var m = this.cands[this.k], len = -1;
    for (var d = 0; d <= this.pz.n - 1; d += 2) if (this.solver.and(m.n, d)) { len = d + 1; break; }
    this.lens.push(len); this.k++;
    if (this.k >= this.cands.length) this.done = true;
  };
  Verifier.prototype.progress = function () { return this.cands.length ? this.k / this.cands.length : 1; };
  Verifier.prototype.report = function () {
    var r = { errors: this.errors.slice(), n: this.pz.n };
    if (!this.s) return r;
    var n = this.pz.n, lens = this.lens.filter(function (x) { return x > 0; });
    r.checks = this.cands.length;
    r.minLen = lens.length ? Math.min.apply(null, lens) : -1;
    r.mates = r.minLen > 0 && r.minLen <= n;
    r.exact = r.minLen === n;
    r.firstCount = this.lens.filter(function (x) { return x > 0 && x <= n; }).length;
    if (r.exact) {
      // 本筋を作る（玉方はいちばん長く逃げる手）。途中の攻め方の手が2つ以上あれば余詰め
      var S = this.solver, V = this.V, cur = this.s, left = n, line = [], yozume = [], lastMulti = false;
      while (left > 0) {
        var mm = S.matingMoves(cur, left);
        if (!mm.length) break;
        if (mm.length > 1) { if (left === 1) lastMulti = true; else if (line.length) yozume.push(line.length + 1); }
        var m = mm[0];
        line.push(m.f < 0 ? 'd' + m.d + '@' + m.t : m.f + '-' + m.t + (m.pr ? '+' : ''));
        cur = R.apply(V, cur, m); left--;
        if (left === 0) break;
        var dm = S.bestDefense(cur, left);
        if (!dm) break;
        line.push(dm.f < 0 ? 'd' + dm.d + '@' + dm.t : dm.f + '-' + dm.t + (dm.pr ? '+' : ''));
        cur = R.apply(V, cur, dm); left--;
      }
      r.line = line; r.yozume = yozume; r.lastMulti = lastMulti;
      // 安南の仲間: ふつうの本将棋のルールでも同じ手数で詰むか（借りた動きを使わない問題）
      if (V.an) {
        var VH = HS.VARIANTS.honshogi, sh = { b: this.s.b, hand: [this.s.hand[0], HS.tsumeHand(VH, this.s.b, this.s.hand[0])], turn: 0, ply: 0 };
        r.plainToo = new HS.Solver(VH).or(sh, n);
      }
    }
    r.ok = r.exact && r.firstCount === 1;
    return r;
  };

  HS.tsumeCode = { encode: encode, decode: decode, check: check, Verifier: Verifier, RULES: RULES, RULE_NAME: RULE_NAME };
})(this);

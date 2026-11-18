/* かけ算ランナー — ロジック（DOM/THREE を使わない。ゲーム・ステージ作り（src/）・テストで同じものを使う）
   jsc（JavaScriptCore）でも動くように、古い書き方（var・function）だけで書いている。

   ・コース = ゲートの組を決まった順にならべたもの。ステージ 1〜100 は stages.js（src/stages.json から作る。中身は変えない）、
     今日のステージは日付（日本時間）から毎日同じものを作る（genCourse）。
   ・ゲート1つ = { op: 'add'|'sub'|'mul'|'div', v }。JSON では "+5" "-3" "x2" "/2" の短い文字にする。
     走りながら一目で読めるように、ゲートは「記号と数」だけ（文の条件やかべは使わない）。
   ・数が 0 以下になったらアウト。前に悪いほうを選んで数が小さいと、あとの大きな「−」や「÷」で 0 以下になることがある。 */
(function (root) {
  'use strict';

  var KZ = (function () {
    var GAP = 20;                 // ゲートとゲートの間（道の長さ）
    var FEVER_STREAK = 5;         // 「いいほう」を続けて選ぶとフィーバー（×1.2 のおまけ）
    var FEVER_MUL = 1.2;
    var CAP = 9999;               // 数の上限（4けた。版3・今日のステージ版3 から）。コースは、いいほうを選び続けてもだいたいこれより小さく収まるように作る
    var MAX_N = CAP;              // ここで止める（前は 1e15）。ちがう道で大きくなっても 9999 より大きくはならない
    var STAGE_COUNT = 200;          // 1.0.4 で 101〜200 を足した（1〜100 はそのまま。版3 のまま）
    var DAILY_LEN = 150;          // 今日のステージのゲートの数（さいごまで行ける人はほとんどいない長さ）
    var STAGE_VERSION = 3;        // stages.js の版（1.0 は 1、1.0.1 は 2、1.0.2 から 3 = 数を4けたまでに。作り方を変えたら上げて、新しい版のファイルを作る）
    var DAILY_VERSION = 3;        // 今日のステージの作り方を変えたら上げる（同じ日に全員同じコースにするため。3 = 数を4けたまでに）

    function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
    function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    // L が a のとき lo、b のとき hi（そのあいだはまっすぐ。外は端の値）
    function lerp(L, a, b, lo, hi) { return lo + (hi - lo) * clamp((L - a) / (b - a), 0, 1); }

    // 見やすい数に丸める（2桁くらいの有効数字）
    function step(v) {
      var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
      if (v / p >= 50) p *= 5;
      return p;
    }
    function nice(v) {
      v = Math.max(1, Math.round(v));
      if (v < 20) return v;
      var p = step(v);
      return Math.max(1, Math.round(v / p) * p);
    }
    // v 以下の見やすい数（かべの数に使う）
    function niceDown(v) {
      v = Math.max(1, Math.floor(v));
      if (v < 20) return v;
      var p = step(v);
      return Math.max(1, Math.floor(v / p) * p);
    }

    // 決まった乱数（xorshift）と、文字から種を作る（FNV-1a）
    function seeded(seed) {
      var s = seed >>> 0 || 1;
      return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
    }
    function hash(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h >>> 0;
    }

    // ---------------- ゲート ----------------
    function apply(n, g) {
      var v;
      switch (g.op) {
        case 'mul': v = n * g.v; break;
        case 'add': v = n + g.v; break;
        case 'sub': v = n - g.v; break;
        case 'div': v = Math.floor(n / g.v); break;   // ÷ は切り捨て
        default: v = n;
      }
      return Math.min(MAX_N, v);
    }
    var SYM = { add: '+', sub: '-', mul: 'x', div: '/' };
    var OPS = { '+': 'add', '-': 'sub', 'x': 'mul', '/': 'div' };
    // "x3" → { op: 'mul', v: 3 }
    function parseGate(s) { return { op: OPS[s.charAt(0)], v: Number(s.slice(1)) }; }
    function gateStr(g) { return SYM[g.op] + g.v; }
    // JSON の組 {k, g:[..], d?} ⇔ ゲームで使う組 {kind, gates:[..], deadly?}
    function parsePair(p) {
      var o = { kind: p.k, gates: [parseGate(p.g[0]), parseGate(p.g[1])] };
      if (p.d) o.deadly = true;
      return o;
    }
    function pairJSON(p) {
      var o = { k: p.kind, g: [gateStr(p.gates[0]), gateStr(p.gates[1])] };
      if (p.deadly) o.d = 1;
      return o;
    }
    function parseCourse(c) {
      return { id: c.id, start: c.start, speed: c.speed, stars: c.stars, opt: c.opt, tip: c.tip || null, pairs: c.pairs.map(parsePair) };
    }
    // 札の文字（「×2」「−1,200」）
    function label(g) { return { mul: '×', add: '+', sub: '−', div: '÷' }[g.op] + fmt(g.v); }
    function good(g) { return g.op === 'mul' || g.op === 'add'; }
    // くぐった結果
    function outcome(n, pair, side) { return { v: apply(n, pair.gates[side]) }; }

    // ---------------- 1回えらぶ ----------------
    function newState(start) { return { n: start, best: start, passed: 0, streak: 0, over: false, cause: null, dodged: 0 }; }
    // best = いいほう（同じなら両方いいほう）を選んだか。アウトになったゲートは「超えたゲート」に数えない
    function choose(state, pair, side) {
      var mine = apply(state.n, pair.gates[side]), other = apply(state.n, pair.gates[1 - side]);
      var best = mine >= other;
      var res = { before: state.n, after: mine, best: best, gate: pair.gates[side], fever: false, deadly: !!pair.deadly };
      if (mine <= 0) {
        state.over = true;
        state.cause = pair.deadly ? 'deadly' : 'zero';
        state.n = mine;
        return res;
      }
      state.n = mine;
      state.passed++;
      state.streak = best ? state.streak + 1 : 0;
      if (state.streak >= FEVER_STREAK) {
        state.streak = 0; state.n = Math.min(MAX_N, Math.max(state.n + 1, Math.floor(state.n * FEVER_MUL))); res.fever = true; res.after = state.n;
      }
      if (state.n > state.best) state.best = state.n;
      if (pair.deadly) state.dodged++;
      return res;
    }

    // ---------------- 記録 ----------------
    // ★: クリアで1つ、最後の数が stars[0] 以上で2つ、stars[1] 以上で3つ
    function starsFor(course, cleared, n) {
      if (!cleared) return 0;
      return n >= course.stars[1] ? 3 : n >= course.stars[0] ? 2 : 1;
    }
    // ランキングの記録（整数1つ）: 超えたゲート数 × 100万 ＋ 最後の数の大きさ（log10 × 1万。同じゲート数のときの順番に使う）
    function tiebreak(n) { return n >= 1 ? Math.min(999999, Math.round(Math.log(n) / Math.LN10 * 10000)) : 0; }
    function runScore(passed, n) { return passed * 1000000 + tiebreak(n); }
    function decodeScore(s) { var t = s % 1000000; return { gates: Math.floor(s / 1000000), n: Math.round(Math.pow(10, t / 10000)) }; }

    // 日本時間の日付 '2026-10-13'
    function dayKey(ms) {
      var d = new Date((ms == null ? Date.now() : ms) + 9 * 3600000);
      var m = d.getUTCMonth() + 1, day = d.getUTCDate();
      return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    // ---------------- コースを作る ----------------
    // 難しさ L（だいたいステージ番号。今日のステージはゲートごとに上がる）ごとの決まり。くわしくは README の表
    // ステージ版 2（1.0.1〜）: 1〜10 はやさしいまま、そのあとは前より早く・きびしく
    function params(L) {
      if (L > 100) return params2(L);
      return {
        L: L,
        addOnly: L <= 10,                                     // 1〜10: たし算・ひき算だけ（小さい数）
        mulVals: L < 16 ? [2] : L < 46 ? [2, 2, 2, 3, 3, 4] : [2, 2, 3, 3, 4, 5],
        mm: L >= 16,                                          // × と ×
        div: L >= 16,
        divVals: L < 46 ? [2, 2, 3] : [2, 3, 4, 5],
        dd: L >= 21,                                          // ÷ と ÷
        noDeath: L <= 20,                                     // ここまでは、どう選んでもアウトにならない
        overSub: L >= 21 ? lerp(L, 21, 100, 0.1, 0.22) : 0,  // 「÷ と −」の − が引きすぎ（0以下）のことがある
        deadlyGap: L >= 26 ? [Math.round(lerp(L, 26, 100, 7, 4)), Math.round(lerp(L, 26, 100, 10, 6))] : null,
        tight: L >= 66 ? lerp(L, 66, 100, 0.45, 0.22) : 0,   // きびしい命がけ: 助かるほうに残る数の割合（小さいほどきびしい）
        // 36〜: 「− と −」のどっちも大きく引く組（ここで引く数より小さいと、どっちをくぐってもアウト）
        squeezeGap: L >= 36 ? [Math.round(lerp(L, 36, 100, 8, 4)), Math.round(lerp(L, 36, 100, 11, 6))] : null,
        squeeze: 0.25 + 0.55 * Math.pow(clamp((L - 36) / 64, 0, 1), 1.2),   // 引く数 = いいほうを選び続けたときの数 × これ
        toll: L >= 61 ? lerp(L, 61, 100, 0.1, 0.35) : 0      // へる組のなかで、ほかにも「− と −」の大きく引く組が出る割合
      };
    }

    // 101〜200（1.0.4）: 100 の決まりから、なめらかにつづけてきびしくする。今日のステージ（L は 100 まで）には使わない
    //   101〜 ロングコース（ゲートがふえる）、111〜 ×6〜×9・÷6〜÷9、131〜 もっときびしい命がけ、151〜 スピードアップ、171〜 ぜんぶまぜて、191〜 さいごの10ステージ
    function params2(L) {
      var P = params(100);
      P.L = L;
      if (L >= 111) { P.mulVals = [2, 3, 3, 4, 5, 6, 7, 8, 9]; P.divVals = [2, 3, 4, 5, 6, 7, 8, 9]; }
      P.overSub = lerp(L, 100, 200, 0.22, 0.3);
      P.deadlyGap = [4, Math.round(lerp(L, 100, 200, 6, 5))];
      P.squeezeGap = [4, Math.round(lerp(L, 100, 200, 6, 5))];
      P.tight = L >= 131 ? lerp(L, 131, 200, 0.21, 0.18) : 0.22;
      P.toll = lerp(L, 100, 200, 0.35, 0.4);
      return P;
    }

    // ふつうの組（n = いいほうを選び続けたときの数、minN = 悪いほうを選び続けたときの数、tgt = 目安の数）
    function genNormal(r, n, minN, tgt, P, feat) {
      var a, b, kind, k = r();
      if (P.addOnly) {
        // 小さい数の たし算・ひき算だけ。どう選んでも 0 にはならない
        var top = 3 + Math.floor(P.L * 0.6);
        if (k < 0.5 || minN < 3) kind = 'pp';
        else if (k < 0.78) kind = 'ps';
        else kind = 'ss';
        if (kind === 'pp') { a = ri(r, 1, top); b = ri(r, 1, top); if (a === b) b = a === top ? a - 1 : a + 1; a = { op: 'add', v: a }; b = { op: 'add', v: b }; }
        else if (kind === 'ps') { a = { op: 'add', v: ri(r, 1, top) }; b = { op: 'sub', v: ri(r, 1, Math.min(top, minN - 1)) }; }
        else {
          var lim = Math.min(top, minN - 1);
          a = ri(r, 1, lim); b = ri(r, 1, lim); if (a === b) b = a === 1 ? 2 : a - 1;
          a = { op: 'sub', v: a }; b = { op: 'sub', v: b };
        }
        return finish(r, n, kind, a, b);
      }

      var grow = tgt === Infinity ? 1 : n < tgt ? 0.8 : Math.max(0.12, 0.55 - 1.5 * Math.log(n / tgt) / Math.LN10);
      if ((feat === 'mul' || feat === 'mm' || feat === 'big5' || feat === 'big9') && n < tgt * 3) grow = Math.max(grow, 0.7);
      // 数が4けたの上のほうまで来たら、ふえる組を出しにくく、CAP の近くでは出さない（数が大きくなりすぎないように）
      if (n > CAP * 0.5) grow = Math.min(grow, n > CAP * 0.8 ? 0 : 0.3);
      if (P.noDeath && minN < 3) grow = 1;   // 悪いほうを選び続けた人の数が小さいときは、へる組を出さない
      var room = Math.max(0, CAP - n);       // CAP まであといくつふやせるか
      if (P.noDeath && n > tgt * 2 && (!P.div || minN < 3)) {
        // ÷ がまだないステージで数が大きくなりすぎたら、少しだけふえる「+ と +」にする（− は 0 にならない分しか出せないため）
        a = Math.max(1, nice(n * (0.02 + 0.08 * r()))); b = Math.max(1, nice(n * (0.02 + 0.08 * r())));
        if (room >= 4) { a = Math.min(a, niceDown(room / 2)); b = Math.min(b, niceDown(room / 2)); }
        if (a === b) b = a + 1;
        return finish(r, n, 'pp', { op: 'add', v: a }, { op: 'add', v: b });
      }
      if (r() < grow) {
        var kp = r();
        // × にできるのは、くぐっても CAP をこえない数だけ（数が大きいときは × を出さず、+ の組にする）
        var mulOk = P.mulVals.filter(function (m) { return n * m <= CAP; });
        var mmP = !P.mm || mulOk.length < 2 ? 0 : feat === 'mm' ? 0.45 : 0.18;
        var ppP = !mulOk.length ? 1 : n * 2 > CAP * 0.3 ? 0.45 : P.L < 21 && feat !== 'mul' ? 0.2 : 0.06;
        if (kp < mmP) {
          kind = 'mm';
          var m1 = pick(r, mulOk.slice(0, -1)), m2 = m1 + ri(r, 1, 2);
          if (m2 > mulOk[mulOk.length - 1]) m2 = m1 + 1;
          if (feat === 'big5' && r() < 0.5 && n * 5 <= CAP) { m1 = 4; m2 = 5; }
          if (feat === 'big9' && r() < 0.5) { var big = mulOk.filter(function (m) { return m >= 6; }); if (big.length >= 2) { m1 = big[big.length - 2]; m2 = big[big.length - 1]; } }
          a = { op: 'mul', v: m1 }; b = { op: 'mul', v: m2 };
        } else if (kp < mmP + ppP) {
          kind = 'pp';
          a = nice(n * (0.2 + 0.6 * r())); b = nice(n * (0.2 + 0.6 * r()));
          if (room >= 4) { var lim2 = niceDown(room * 0.8); a = Math.min(a, nice(lim2 * (0.4 + 0.5 * r()))); b = Math.min(b, lim2); }
          else { a = Math.min(a, 2); b = Math.min(b, 3); }
          if (a === b) b = nice(b * 1.3) === b ? b + 1 : nice(b * 1.3);
          a = { op: 'add', v: Math.max(1, a) }; b = { op: 'add', v: Math.max(1, b) };
        } else {
          kind = 'am';
          var v = feat === 'big5' && r() < 0.5 && n * 5 <= CAP ? 5 : pick(r, mulOk);
          if (feat === 'big9' && r() < 0.6) { var big9 = mulOk.filter(function (m) { return m >= 6; }); if (big9.length) v = pick(r, big9); }
          a = { op: 'mul', v: v };
          // ×v とほぼ同じくらいの「+」（少し上回ることも、下回ることもある。CAP はこえない）
          b = { op: 'add', v: Math.max(1, Math.min(nice(n * (v - 1) * (0.4 + r() * 1.2)), niceDown(Math.max(1, room)))) };
        }
        return finish(r, n, kind, a, b);
      }
      // へる組
      if (r() < P.toll && n >= 10) return genSqueeze(r, n, P.squeeze * (0.6 + 0.3 * r()));
      var ks = r();
      if (P.div && ks < (P.dd ? (feat === 'dd' ? 0.4 : 0.25) : 0)) {
        kind = 'dd';
        var d1 = pick(r, P.divVals.slice(0, -1)), d2 = d1 + 1;
        a = { op: 'div', v: d1 }; b = { op: 'div', v: d2 };
      } else if (P.div && ks < (feat === 'div' ? 0.95 : 0.75)) {
        kind = 'ds';
        var d = feat === 'big5' && r() < 0.5 ? pick(r, [4, 5]) : pick(r, P.divVals);
        if (feat === 'big9' && r() < 0.6) d = ri(r, 6, 9);
        a = { op: 'div', v: d };
        // n÷d とほぼ同じくらい減る「−」。ときどき引きすぎ（0以下になる）
        var sv = Math.max(1, nice(n * (1 - 1 / d) * (0.5 + r() * 0.9)));
        if (r() < P.overSub) sv = n + ri(r, 0, Math.max(1, Math.floor(n * 0.3)));
        // アウトにならないステージで − が引けないときは「÷2 と ÷3」にする（どっちも 0 にはならない）
        if (P.noDeath && sv >= minN) return finish(r, n, 'dd', { op: 'div', v: 2 }, { op: 'div', v: 3 });
        b = { op: 'sub', v: sv };
      } else {
        // − と −（へり方の少ないほうは？）
        kind = 'ss';
        a = nice(n * (0.1 + 0.3 * r())); b = nice(n * (0.1 + 0.3 * r()));
        if (a === b) b = nice(b * 1.5) === b ? b + 1 : nice(b * 1.5);
        if (P.noDeath) { var m = minN - 1; a = Math.min(a, m); b = Math.min(b, m); if (a === b) b = a > 1 ? a - 1 : 2; }
        a = { op: 'sub', v: a }; b = { op: 'sub', v: b };
      }
      return finish(r, n, kind, a, b);
    }
    // 左右をまぜる。念のため: 両方とも 0 以下になる組は出さない
    function finish(r, n, kind, a, b) {
      if (r() < 0.5) { var t = a; a = b; b = t; }
      var pair = [a, b];
      if (apply(n, a) <= 0 && apply(n, b) <= 0) {
        var keep = a.op === 'div' ? 1 : 0;
        pair[keep] = n >= 2 ? { op: 'div', v: 2 } : { op: 'mul', v: 2 };
      }
      return { gates: pair, kind: kind };
    }

    // ---- 「− と −」のどっちも大きく引く組 ----
    // 小さいほうの − は「いいほうを選び続けた人の数 × frac」。前にまちがえて数がこれより小さいと、どっちをくぐってもアウト
    function genSqueeze(r, n, frac) {
      var ta = niceDown(n * frac);
      if (ta >= n) ta = niceDown(n * 0.6);
      ta = Math.max(1, ta);
      var tb = nice(ta * (1.2 + 0.4 * r()));
      if (tb <= ta) tb = ta + 1;
      return finish(r, n, 'toll', { op: 'sub', v: ta }, { op: 'sub', v: tb });
    }

    // ---- 命がけゲート: 片方をくぐると 0 以下になって即アウト。もう片方は助かる ----
    // P.tight が 0（ステージ 31〜70）: 助かるほうは「÷2」や「半分くらい残る −」。少しまちがえて数が小さくても、たいてい助かる
    // P.tight があるとき（71〜）: 助かるほうも「ぎりぎり残る」だけ。前にまちがえて数が小さいと、どっちをくぐってもアウト
    function genDeadly(r, n, P) {
      var kill, safe, v = r();
      var near = Math.max(1, Math.ceil(n * 0.12));
      if (!P.tight) {
        if (v < 0.4) { kill = { op: 'sub', v: n + ri(r, 0, near) }; safe = { op: 'div', v: pick(r, [2, 2, 3]) }; }
        else if (v < 0.7) { kill = { op: 'sub', v: n + ri(r, 0, near) }; safe = { op: 'sub', v: Math.max(1, Math.round(n * (0.3 + 0.3 * r()))) }; }
        else { kill = { op: 'div', v: n + ri(r, 1, Math.max(2, near)) }; safe = { op: 'sub', v: Math.max(1, Math.round(n * (0.2 + 0.3 * r()))) }; }
      } else {
        var keep = clamp(Math.round(n * P.tight * (0.7 + 0.6 * r())), 1, n - 1);
        // 助かるほうは、たいてい「÷ 大きい数」（今の数がその数より小さいと 0 でアウト）。ときどき「− ぎりぎり」
        if (v < 0.4) { kill = { op: 'sub', v: n + ri(r, 0, near) }; safe = { op: 'div', v: Math.max(2, Math.floor(n / keep)) }; }
        else if (v < 0.75) { kill = { op: 'div', v: n + ri(r, 1, Math.max(2, near)) }; safe = { op: 'div', v: Math.max(2, Math.floor(n / keep)) }; }
        else { kill = { op: 'sub', v: n + ri(r, 0, near) }; safe = { op: 'sub', v: n - keep }; }
      }
      if (safe.op === kill.op && safe.v === kill.v) safe.v = Math.max(1, safe.v - 1);
      return { gates: r() < 0.5 ? [kill, safe] : [safe, kill], kind: 'deadly', deadly: true };
    }

    // コースを作る。o = { seed, len, start, Lat(i) → 難しさ, tgt(i) → 目安の数, feat }
    // 「いいほうを選び続ける人」（その場で大きくなるほうを選ぶ）の数 n に合わせて1組ずつ作る
    function genCourse(o) {
      var r = seeded(o.seed);
      var n = o.start, minN = o.start, streak = 0;
      var pairs = [];
      var nextDeadly = -1, nextSq = -1;
      for (var i = 0; i < o.len; i++) {
        var P = params(o.Lat(i));
        if (P.deadlyGap && nextDeadly < 0) nextDeadly = i + ((o.feat === 'deadly' || o.feat === 'tight2') ? ri(r, 2, 3) : ri(r, 3, P.deadlyGap[1] - 3));
        if (P.squeezeGap && nextSq < 0) nextSq = i + (o.feat === 'toll' ? ri(r, 2, 3) : ri(r, 4, P.squeezeGap[1]));
        var pair = null;
        var tail = i >= o.len - 3;   // さいごの3つは危ないゲートを置かず、ふえる組でしめくくる（ゴールの数で★を決めるため）
        if (tail && i === nextDeadly) nextDeadly++;
        if (tail && i === nextSq) nextSq++;
        if (i === nextDeadly) {
          if (n >= 4) { pair = genDeadly(r, n, P); nextDeadly = i + ((o.feat === 'deadly' || o.feat === 'tight2') ? ri(r, 3, 4) : ri(r, P.deadlyGap[0], P.deadlyGap[1])); }
          else nextDeadly++;
        }
        if (!pair && i === nextSq) {
          if (n >= 10) { pair = genSqueeze(r, n, P.squeeze * (0.9 + 0.2 * r())); nextSq = i + (o.feat === 'toll' ? ri(r, 3, 4) : ri(r, P.squeezeGap[0], P.squeezeGap[1])); }
          else nextSq++;
        } else if (pair && i === nextSq) nextSq++;
        if (!pair) pair = genNormal(r, n, minN, tail && !P.addOnly ? Infinity : o.tgt(i), P, o.feat);
        // いいほうを選んで進める（フィーバーも入れる）
        n = Math.max(apply(n, pair.gates[0]), apply(n, pair.gates[1]));
        if (++streak >= FEVER_STREAK) { streak = 0; n = Math.min(MAX_N, Math.max(n + 1, Math.floor(n * FEVER_MUL))); }
        // 悪いほうを選び続ける人（はじめのステージで、0 にならないことを確かめるため）
        minN = Math.min(apply(minN, pair.gates[0]), apply(minN, pair.gates[1]));
        pairs.push(pair);
      }
      return { start: o.start, pairs: pairs };
    }

    // ---------------- ステージ・今日のステージの決まり ----------------
    // 新しいことが出てくるステージ（はじめて出るステージでは、たくさん出す）と、そのときの説明
    var TIPS = {
      1: 'add', 11: 'mul', 16: 'div', 21: 'dd', 26: 'deadly', 36: 'toll', 46: 'big5', 56: 'bignum', 66: 'tight', 81: 'mix', 91: 'last',
      101: 'long', 111: 'big9', 131: 'tight2', 151: 'fast', 171: 'mix2', 191: 'final'
    };
    var TIP_TEXT = {
      add: { title: 'たし算・ひき算', text: '大きくなるほうのゲートをくぐろう。ゴールの数が大きいほど ★ がふえる' },
      mul: { title: '× のゲート', text: '「×2」と「+13」、どっちが大きくなる？ 今の数で考えよう' },
      mm: { title: '×3・×4', text: '×3 や ×4 も出てくる。「×2 と ×3」なら…？' },
      div: { title: '÷ と ×3・×4', text: '「÷2」と「−8」、どっちがまし？ へるときは、へり方の少ないほうへ。×3 や ×4 も出てくる' },
      dd: { title: '引きすぎに注意', text: '今の数より大きい数を引くと 0 以下でアウト' },
      deadly: { title: '命がけゲート', text: '片方は即アウト。今の数と比べて、0 以下にならないほうへ' },
      toll: { title: '大きな −', text: 'どっちも大きく引くゲートが来る。前に小さいほうを選んでいると、ここで足りなくなる' },
      big5: { title: '×5・÷5', text: '大きくふえる・大きくへるゲート。一回の差が大きい' },
      bignum: { title: '大きな数', text: 'はじめから数が大きい。百や千の暗算で、すばやく比べよう' },
      tight: { title: 'きびしい命がけ', text: '助かるほうも、ぎりぎりしか残らない。数が小さいと、どっちをくぐってもアウト' },
      mix: { title: 'ぜんぶまぜて', text: 'いままでのゲートがぜんぶ出てくる。スピードも上がる' },
      last: { title: '100 までのしめくくり', text: 'ひとつのまちがいが命とり。100 をクリアすると、101 からの新しいステージが開く' },
      long: { title: 'ロングコース', text: 'ここからはゲートがもっと多い。さいごまで気をぬかずに' },
      big9: { title: '×6〜×9・÷6〜÷9', text: '×9 や ÷7 も出てくる。九九を思い出して、すばやく比べよう' },
      tight2: { title: 'もっときびしい命がけ', text: '命がけゲートがもっと多く、助かるほうに残る数もさらに少ない' },
      fast: { title: 'スピードアップ', text: 'ここから走るのが速くなる。早めにゲートを読もう' },
      mix2: { title: 'ぜんぶまぜて・その2', text: 'いままでのゲートが、もっと速く、もっと多く出てくる' },
      final: { title: 'さいごの10ステージ', text: 'いちばん長くて、いちばん速い。ここまで来たらあと少し' }
    };
    function tipFor(id) { return TIPS[id] || null; }
    function bandOf(id) { var t = null; for (var k in TIPS) if (Number(k) <= id) t = TIPS[k]; return t; }
    // 速さ [はじめ, 1秒ごとに上がる量, いちばん速い]。ステージが進むほど速い
    function speedFor(L) {
      // 101〜: 上がり方をゆるく（151 からは少し速く）。200 で はじめ 14・いちばん速い 27
      if (L > 100) {
        var f = L <= 150 ? [lerp(L, 100, 150, 12.5, 13), lerp(L, 100, 150, 0.21, 0.22), lerp(L, 100, 150, 23.5, 24.5)]
          : [lerp(L, 151, 200, 13.3, 14), lerp(L, 151, 200, 0.225, 0.24), lerp(L, 151, 200, 25, 27)];
        return [Math.round(f[0] * 100) / 100, Math.round(f[1] * 1000) / 1000, Math.round(f[2] * 10) / 10];
      }
      return [Math.round((7 + L * 0.055) * 100) / 100, Math.round((0.05 + L * 0.0016) * 1000) / 1000, Math.round((14 + L * 0.095) * 10) / 10];
    }
    // 全体の速さの倍率（1.0.1: ちょっと速く。ステージごとの速さ speedFor にかける）
    var SPEED_MUL = 1.15;
    function speedAt(sp, runT) { return Math.min(sp[2], sp[0] + sp[1] * runT) * SPEED_MUL; }

    // ステージ id のコースの作り方（stages.json はこれで1回だけ作って、あとは変えない）
    function stageSpec(id) {
      var r = seeded(hash('kakezan-stage-' + id));
      var L = id;
      if (id > 100) return stageSpec2(id, r);
      var len = Math.round(10 + L * 0.4) + ri(r, -1, 1);   // 10 → 50
      var start = L <= 10 ? ri(r, 3, 8) : L < 56 ? Math.round(5 + L * 0.35) + ri(r, -2, 2) : nice(100 + (L - 56) * 15 + ri(r, -20, 20));
      var endN = Math.min(CAP * 0.6, Math.pow(10, 1.55 + L * 0.045));   // 版3: ゴールの目安は 6000 くらいまで
      return {
        id: id, seed: hash('kakezan-stage-gates-' + id), len: len, start: start, feat: TIPS[id] || null,
        Lat: function () { return L; },
        tgt: function (i) { return start * Math.pow(Math.max(1.5, endN / start), (i + 1) / len); },
        speed: speedFor(L)
      };
    }
    // 101〜200（1.0.4）: ゲート 52 → 72。はじめの数はステージごとにばらばら（40〜1200。小さいと ×6〜×9 が使える）
    function stageSpec2(id, r) {
      var L = id;
      var len = Math.round(50 + (L - 100) * 0.2) + ri(r, 0, 2);
      var start = nice(ri(r, 40, 1200));
      var endN = CAP * 0.6;
      return {
        id: id, seed: hash('kakezan-stage-gates-' + id), len: len, start: start, feat: TIPS[id] || null,
        Lat: function () { return L; },
        tgt: function (i) { return start * Math.pow(Math.max(1.5, endN / start), (i + 1) / len); },
        speed: speedFor(L)
      };
    }
    // 今日のステージ: 日付から毎日同じコース。ゲートが進むほど難しく（ステージ 25 くらい → 100）、速くなる
    function dailySpec(day) {
      var r = seeded(hash('kakezan-daily-v' + DAILY_VERSION + '-' + day));
      var start = ri(r, 8, 14);
      return {
        id: 'daily', day: day, seed: hash('kakezan-daily-gates-v' + DAILY_VERSION + '-' + day), len: DAILY_LEN, start: start, feat: null,
        Lat: function (i) { return Math.min(100, 25 + i * 0.7); },
        tgt: function (i) { return Math.min(CAP * 0.6, 10 + 0.5 * (i + 1) * (i + 1)); },
        speed: [9.5, 0.17, 24]
      };
    }
    function dailyCourse(day) {
      var s = dailySpec(day), c = genCourse(s);
      return { id: 'daily', day: day, start: c.start, speed: s.speed, stars: null, opt: null, tip: null, pairs: c.pairs };
    }

    // 数字の表示: 1万未満は「1,234」、それ以上は「12.3万」「4.56億」…
    var UNITS = [[1e4, '万'], [1e8, '億'], [1e12, '兆'], [1e16, '京']];
    function comma(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function sig3(x) {
      var s = x >= 100 ? String(Math.floor(x)) : x >= 10 ? (Math.floor(x * 10) / 10).toFixed(1) : (Math.floor(x * 100) / 100).toFixed(2);
      return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    }
    function fmt(n) {
      n = Math.floor(n);
      if (n < 0) return '−' + fmt(-n);
      if (n < 1e4) return comma(n);
      if (!isFinite(n)) return '∞';
      for (var i = UNITS.length - 1; i >= 0; i--) if (n >= UNITS[i][0]) return sig3(n / UNITS[i][0]) + UNITS[i][1];
      return comma(n);
    }

    return {
      GAP: GAP, FEVER_STREAK: FEVER_STREAK, FEVER_MUL: FEVER_MUL, MAX_N: MAX_N, CAP: CAP,
      STAGE_COUNT: STAGE_COUNT, STAGE_VERSION: STAGE_VERSION, DAILY_LEN: DAILY_LEN, DAILY_VERSION: DAILY_VERSION, TIPS: TIPS, TIP_TEXT: TIP_TEXT,
      nice: nice, niceDown: niceDown, seeded: seeded, hash: hash, apply: apply,
      parseGate: parseGate, gateStr: gateStr, parsePair: parsePair, pairJSON: pairJSON, parseCourse: parseCourse,
      label: label, good: good, outcome: outcome,
      newState: newState, choose: choose, starsFor: starsFor, tiebreak: tiebreak, runScore: runScore, decodeScore: decodeScore, dayKey: dayKey,
      params: params, genCourse: genCourse, genDeadly: genDeadly, genSqueeze: genSqueeze,
      tipFor: tipFor, bandOf: bandOf, speedFor: speedFor, speedAt: speedAt, stageSpec: stageSpec, dailySpec: dailySpec, dailyCourse: dailyCourse,
      fmt: fmt
    };
  })();
  root.KZ = KZ;
})(this);

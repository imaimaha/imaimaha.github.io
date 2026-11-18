/*
 * 下剋上デュエル — core.js（ルール・CPU・オンラインの約束ごと。DOM に触らない純粋な関数だけ。jsc でテストできる）
 *
 * ルール
 *  - 2人とも 1〜9 のカードを1枚ずつ持つ。毎ラウンド1枚ずつ出し、大きいほうが勝ち。ただし 1 は 9 に勝つ（下剋上）
 *  - 前のラウンドの勝者が先に出す（伏せて出す）。引き分けなら先手は変わらない。1ラウンド目はランダム
 *  - 後手は、先手が伏せたのを見てから出す（数字は見えない）
 *  - 特殊カード（1試合に1回ずつ）
 *      👁 透視  … 後手だけ。出す前に、先手の伏せたカードの数字を見る。1ラウンド目は使えない
 *      ✖️2 倍がけ … 出すときにこっそり使う。このラウンドの勝者は2点
 *      🛡 ガード … 出すときにこっそり使う。負けても引き分けになる
 *  - 特殊カードを使ったかどうかは、試合中は相手にわからない（透視されたことも、倍がけ・ガードも）。
 *    だから試合中は得点を出さず、ラウンドごとの「勝ち・負け・引き分け」だけを見せる。試合が終わったら全部を発表する
 *  - 9ラウンドの合計点が多いほうの勝ち。同点は引き分け
 *  - 相手が出した数字は見えない（わかるのは勝敗だけ。透視を使ったときだけ見える）
 */
var DuelCore = (function () {
  'use strict';

  var CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var ROUNDS = 9;
  var SKILLS = { peek: '透視', double: '倍がけ', guard: 'ガード' };
  var PROTOCOL = 2;   // 2: 倍がけ・ガードを伏せたまま送る（めくるときに見せる）

  // a が b に勝つか（1 は 9 にだけ勝つ）
  function beats(a, b) {
    if (a === 1 && b === 9) return true;
    if (a === 9 && b === 1) return false;
    return a > b;
  }

  function other(p) { return p === 0 ? 1 : 0; }

  function newMatch(firstLeader) {
    return {
      round: 1, leader: firstLeader === 1 ? 1 : 0,
      hands: [CARDS.slice(), CARDS.slice()],
      skills: [{ peek: true, double: true, guard: true }, { peek: true, double: true, guard: true }],
      score: [0, 0],
      // このラウンドの出し札。value は分からないあいだ null（オンラインの相手の札）
      play: [null, null],   // { value, double, guard, hash, salt }
      peeked: null,         // 後手が透視で見た数字
      peekBy: -1,           // このラウンドで透視を使った人（試合後の振り返り用）
      history: [],          // { round, leader, cards:[a,b], winner(0/1/-1), points, double:[..], guard:[..] }
      over: false
    };
  }

  function follower(s) { return other(s.leader); }
  // 次に出すべきプレイヤー（両方出したら -1）
  function toPlay(s) {
    if (s.over) return -1;
    if (!s.play[s.leader]) return s.leader;
    if (!s.play[follower(s)]) return follower(s);
    return -1;
  }

  var PEEK_FROM_ROUND = 2; // 1ラウンド目は透視できない
  function canPeek(s, p) {
    return !s.over && s.round >= PEEK_FROM_ROUND && p === follower(s) && s.skills[p].peek && !!s.play[s.leader] && !s.play[p] && s.peeked === null;
  }

  function hasCard(s, p, v) { return s.hands[p].indexOf(v) >= 0; }

  // 出す（ローカル・CPU用。value が分かっている）。正しくなければ理由の文字列を返す
  function place(s, p, value, opts) {
    opts = opts || {};
    if (toPlay(s) !== p) return '今は出せない';
    if (!hasCard(s, p, value)) return 'そのカードはない';
    if (opts.double && !s.skills[p].double) return '倍がけはもう使った';
    if (opts.guard && !s.skills[p].guard) return 'ガードはもう使った';
    if (opts.double && opts.guard) return '倍がけとガードは同時に使えない';
    s.play[p] = { value: value, double: !!opts.double, guard: !!opts.guard, hash: opts.hash || null, salt: opts.salt || null };
    if (opts.double) s.skills[p].double = false;
    if (opts.guard) s.skills[p].guard = false;
    return null;
  }

  // オンラインで相手が伏せた（数字も、倍がけ・ガードを使ったかも、まだ分からない）
  // hash = 数字の封筒、fhash = 特殊カードの封筒。めくるときに revealHidden で中身を確かめる
  function placeHidden(s, p, hash, fhash) {
    if (toPlay(s) !== p) return '今は出せない';
    s.play[p] = { value: null, double: false, guard: false, hash: hash, fhash: fhash || null, salt: null, hidden: true };
    return null;
  }
  // めくったとき: 数字と特殊カードの中身を封筒と照らし合わせ、正しければ場に反映する
  function revealHidden(s, p, value, salt, flags, fsalt) {
    var pp = s.play[p];
    if (!pp || pp.value !== null) return 'めくる順番がおかしい';
    if (!verify(pp.hash, value, salt)) return 'めくった数字が、伏せた札と合わない';
    if (!hasCard(s, p, value)) return 'もう使った札を出している';
    var d = !!(flags && flags.double), g = !!(flags && flags.guard);
    if (pp.fhash !== null && !verifyFlags(pp.fhash, d, g, fsalt)) return '特殊カードが、伏せたときと合わない';
    if (d && g) return '倍がけとガードは同時に使えない';
    if (d && !s.skills[p].double) return '倍がけはもう使った';
    if (g && !s.skills[p].guard) return 'ガードはもう使った';
    pp.value = value; pp.salt = salt; pp.double = d; pp.guard = g; pp.hidden = false;
    if (d) s.skills[p].double = false;
    if (g) s.skills[p].guard = false;
    return null;
  }

  function usePeek(s, p) {
    if (!canPeek(s, p)) return '透視は使えない';
    s.skills[p].peek = false;
    s.peekBy = p;
    s.peeked = 0; // 数字が届くまで 0（届いたら setPeeked）
    return null;
  }
  function setPeeked(s, value) { s.peeked = value; }

  // 両方の数字がそろったら勝敗を決める
  function canResolve(s) {
    return !s.over && s.play[0] && s.play[1] && s.play[0].value !== null && s.play[1].value !== null;
  }
  function judge(a, b, flags) {
    // flags: { double:[..], guard:[..] } → { winner, points }
    var w = a === b ? -1 : beats(a, b) ? 0 : 1;
    if (w !== -1 && flags.guard[1 - w]) w = -1;          // 負けた側がガード → 引き分け
    var pts = w === -1 ? 0 : ((flags.double[0] || flags.double[1]) ? 2 : 1);
    return { winner: w, points: pts };
  }
  function resolve(s) {
    if (!canResolve(s)) return null;
    var a = s.play[0].value, b = s.play[1].value;
    var flags = { double: [s.play[0].double, s.play[1].double], guard: [s.play[0].guard, s.play[1].guard] };
    var r = judge(a, b, flags);
    if (r.winner >= 0) s.score[r.winner] += r.points;
    [0, 1].forEach(function (p) { s.hands[p].splice(s.hands[p].indexOf(s.play[p].value), 1); });
    // guarded: ガードのおかげで引き分けになったか（試合後の発表用）
    var raw = a === b ? -1 : beats(a, b) ? 0 : 1;
    var rec = { round: s.round, leader: s.leader, cards: [a, b], winner: r.winner, points: r.points, guarded: raw !== -1 && r.winner === -1,
                double: flags.double, guard: flags.guard, peek: [s.peekBy === 0, s.peekBy === 1], gekokujo: (a === 1 && b === 9 && r.winner === 0) || (b === 1 && a === 9 && r.winner === 1) };
    s.history.push(rec);
    if (r.winner >= 0) s.leader = r.winner;
    s.play = [null, null];
    s.peeked = null;
    s.peekBy = -1;
    s.round++;
    if (s.round > ROUNDS) s.over = true;
    return rec;
  }

  function result(s) {
    if (!s.over) return null;
    return s.score[0] === s.score[1] ? -1 : s.score[0] > s.score[1] ? 0 : 1;
  }

  /* ---------------- CPU ---------------- */
  // level: 0 かんたん / 1 ふつう / 2 つよい。rnd: 0〜1 の乱数関数
  // 戻り値 { peek: true }（先に透視する）または { value, double, guard }
  // style（ライバルのクセ。なければいつもどおり）: dbl / grd / peek は使う確率の倍率、gk は下剋上ねらいの強さ、noise は迷いの大きさの倍率
  function cpuDecide(s, me, level, rnd, style) {
    rnd = rnd || Math.random;
    style = style || {};
    var mDbl = style.dbl || 1, mGrd = style.grd || 1, mPeek = style.peek || 1, gkBonus = style.gk || 0;
    var mNoise = style.noise === undefined ? 1 : style.noise;
    // 相手の残り札は見えないルールなので、CPU も知らないことにする（1〜9のどれでもありうるとして考える）
    var hand = s.hands[me].slice(), opp = other(me), oppHand = CARDS;
    var isLeader = s.leader === me, left = ROUNDS - s.round + 1;
    var sk = s.skills[me];
    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

    if (level === 0) {
      var v0 = pick(hand), o0 = {};
      if (!isLeader && sk.peek && s.round >= PEEK_FROM_ROUND && rnd() < 0.15 * mPeek) return { peek: true };
      if (sk.double && rnd() < 0.12 * mDbl) o0.double = true; else if (sk.guard && rnd() < 0.12 * mGrd) o0.guard = true;
      return { value: v0, double: !!o0.double, guard: !!o0.guard };
    }

    // 透視: 後手で、まだ見ていないとき。つよいは「大事なラウンド」（相手に高い札が残っている・終盤）で使う
    if (!isLeader && sk.peek && s.peeked === null && s.round >= PEEK_FROM_ROUND) {
      var want = level === 2 ? (left <= 5 || Math.max.apply(null, oppHand) >= 8 && rnd() < 0.35 * mPeek) : rnd() < 0.25 * mPeek;
      if (want) return { peek: true };
    }

    var opts = {}, value;
    if (!isLeader && typeof s.peeked === 'number' && s.peeked > 0) {
      // 相手の数字が分かっている: 勝てるいちばん小さい札、勝てなければいちばん小さい札を捨てる
      var t = s.peeked, winners = hand.filter(function (v) { return beats(v, t); }).sort(function (a, b) { return a - b; });
      if (winners.length) {
        value = winners[0];
        if (sk.double) opts.double = true; // 確実に勝てるので倍がけ
      } else {
        value = Math.min.apply(null, hand);
        if (sk.guard) opts.guard = level === 2 ? true : rnd() < 0.5;
      }
    } else {
      // 数字が分からない: 相手の残りの札に対して勝てる見込みが高い札を選ぶ（低い札を温存しすぎない）
      var best = null, bestScore = -1e9;
      hand.forEach(function (v) {
        var win = 0;
        oppHand.forEach(function (o) { if (beats(v, o)) win++; else if (v !== o) win -= 1; });
        var cost = v / 9 * (level === 2 ? 1.6 : 1.0) * (left > 3 ? 1 : 0.3); // 強い札を使う重さ（終盤ほど気にしない）
        var sc = win / oppHand.length - cost + (rnd() - 0.5) * (level === 2 ? 0.3 : 0.8) * mNoise;
        if (v === 1 && oppHand.indexOf(9) >= 0 && !isLeader) sc += (level === 2 ? 0.25 : 0.1) + gkBonus; // 下剋上ねらい
        else if (v === 1 && isLeader && gkBonus) sc += gkBonus * 0.5;
        if (sc > bestScore) { bestScore = sc; best = v; }
      });
      value = best;
      var strong = hand.filter(function (v) { return v >= 7; }).length;
      if (sk.double && value >= 8 && rnd() < (level === 2 ? 0.55 : 0.3) * mDbl) opts.double = true;
      else if (sk.guard && value <= 3 && rnd() < (level === 2 ? 0.45 : 0.25) * mGrd) opts.guard = true;
      // 相手が倍がけを使ったかは見えないルールなので、CPU もそれを見て決めたりしない
      if (strong === 0 && sk.guard && left <= 2) opts.guard = true;
    }
    if (opts.double && opts.guard) opts.guard = false;
    return { value: value, double: !!opts.double, guard: !!opts.guard };
  }

  /* ---------------- 読みのヒント（アプリの「💡ヒント」） ---------------- */
  // プレイヤー me に見えている情報だけから、相手の残り札と、このラウンドで自分の札それぞれが勝てる見込みを出す。
  // 使う情報: 自分が出した札・勝ち負け・自分のガード・自分が透視で見た数字（相手の札そのものは見ない）。
  // 相手のガードは見えないので、「勝つはずが引き分け」は相手のガード（1試合1回）だったとして数える。
  // 過去のラウンドの、ありうる相手の札の並びを全部数え、どれも同じくらいありうるとする。
  // このラウンドの相手の札は、残り札のどれでも同じくらいとする（CPU のクセや透視は考えない・目安）。
  // 戻り値 { have: {1..9: 残っている確率}, win: {自分の札: 勝つ確率}, draw: {...}, ways: 並びの数 }
  function readHint(s, me) {
    var op = other(me), hist = s.history, n = hist.length;
    var count = {}, ways = 0, used = {};
    CARDS.forEach(function (c) { count[c] = 0; });
    function dfs(i, guardUsed) {
      if (i === n) {
        ways++;
        CARDS.forEach(function (c) { if (!used[c]) count[c]++; });
        return;
      }
      var h = hist[i], mine = h.cards[me], w = h.winner;
      var known = h.peek && h.peek[me] ? h.cards[op] : null;   // 自分が透視で見た
      CARDS.forEach(function (c) {
        if (used[c] || (known !== null && c !== known)) return;
        var raw = c === mine ? -1 : beats(mine, c) ? me : op;
        var exp = raw === op && h.guard[me] ? -1 : raw;           // 自分のガードで負けが引き分け
        var g = guardUsed;
        if (exp !== w) {
          if (raw === me && w === -1 && !guardUsed) g = true;    // 相手のガードで勝ちが引き分け
          else return;
        }
        used[c] = true; dfs(i + 1, g); used[c] = false;
      });
    }
    dfs(0, false);
    var have = {}, left = s.hands[op].length, win = {}, draw = {};
    CARDS.forEach(function (c) { have[c] = ways ? count[c] / ways : 0; });
    s.hands[me].forEach(function (v) {
      var pw = 0;
      CARDS.forEach(function (c) { if (beats(v, c)) pw += have[c]; });
      win[v] = left ? pw / left : 0;
      draw[v] = left ? have[v] / left : 0;
    });
    return { have: have, win: win, draw: draw, ways: ways };
  }

  /* ---------------- SHA-256（crypto.subtle が使えない環境用） ---------------- */
  function sha256(str) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    // UTF-8 にする
    var bytes = [], i, j;
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        var cp = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
    for (i = 0; i < bytes.length; i += 64) {
      for (j = 0; j < 16; j++) W[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = rr(7, W[j - 15]) ^ rr(18, W[j - 15]) ^ (W[j - 15] >>> 3), s1 = rr(17, W[j - 2]) ^ rr(19, W[j - 2]) ^ (W[j - 2] >>> 10);
        W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c2 = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[j] + W[j]) | 0;
        var S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a), mj = (a & b) ^ (a & c2) ^ (b & c2), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c2; c2 = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c2) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  // 伏せた札の「封筒」: 数字とランダムな塩からハッシュを作る。めくるときに数字と塩を見せて、相手が確かめる
  function commit(value, salt) { return sha256(PROTOCOL + ':' + value + ':' + salt); }
  function verify(hash, value, salt) { return typeof hash === 'string' && commit(value, salt) === hash; }
  // 特殊カード（倍がけ・ガード）も別の封筒に入れて送る。透視で数字だけ見せても、特殊カードはばれない
  function commitFlags(double, guard, salt) { return sha256(PROTOCOL + ':flags:' + (double ? 1 : 0) + (guard ? 1 : 0) + ':' + salt); }
  function verifyFlags(hash, double, guard, salt) { return typeof hash === 'string' && commitFlags(double, guard, salt) === hash; }

  return {
    CARDS: CARDS, ROUNDS: ROUNDS, SKILLS: SKILLS, PROTOCOL: PROTOCOL, PEEK_FROM_ROUND: PEEK_FROM_ROUND,
    beats: beats, other: other, newMatch: newMatch, follower: follower, toPlay: toPlay, canPeek: canPeek, hasCard: hasCard,
    place: place, placeHidden: placeHidden, revealHidden: revealHidden, usePeek: usePeek, setPeeked: setPeeked, canResolve: canResolve, judge: judge,
    resolve: resolve, result: result, cpuDecide: cpuDecide, readHint: readHint, sha256: sha256, commit: commit, verify: verify, commitFlags: commitFlags, verifyFlags: verifyFlags
  };
})();
if (typeof window !== 'undefined') window.DuelCore = DuelCore;

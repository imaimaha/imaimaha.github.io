/* トランプ将棋 — カードの数字の「筋」にいる駒しか動かせない本将棋（ルールと CPU。DOM は使わない）
   カード: A(1)〜9 を4組（36枚）＋ジョーカー2枚（0 = 好きな筋）。筋は本将棋のよび方（1筋は先手から見て右はし）。
   手札の枚数 H（0〜3）はルール設定。
     H = 0: 自分の番のはじめに山から1枚めくり、その筋の駒を動かす（その筋に打ってもよい）
     H ≥ 1: 手札（おたがい見える）から1枚えらんで、その筋の駒を動かす。指したら1枚引いて H 枚にもどす
   例外（何をしてもいい）:
     ・王手をかけられているとき … カードに関係なく、どの合法手でも指せる。このときカードは使わない
       （手札は減らず、引きもしない。0枚モードでめくった札は使わずに残り、次に相手がその札をめくる）。手の card は -1
     ・カードの筋で指せる手が1つもないとき … どの合法手でも指せる（このときはえらんだカードを使う＝今までどおり）
   それ以外は本将棋と同じ（二歩・打ち歩詰め・行き所のない駒・王手放置は禁止）。詰み＝王手で、指せる手が1つもない
   状態 s は将棋の局面（b, hand, turn, ply, last, check）に、山札 deck・捨て札 disc・手札 cards[2]・めくった札 cur を足したもの */
(function (root) {
  'use strict';
  var HS = root.HS, R = HS.rules;
  var JOKER = 0;

  function fileOf(V, i) { return V.w - (i % V.w); }          // 1筋 = 盤の右はし（先手から見て右）
  function cardFile(c) { return c === JOKER ? 0 : c; }
  function cardName(c) { return c === JOKER ? 'JOKER' : c === 1 ? 'A' : String(c); }

  // 乱数: 局面に seed（整数）があれば、それで決まる乱数を使う（オンライン対戦で、おたがいの山札をそろえるため）
  function rnd(st) {
    if (!st || typeof st.seed !== 'number') return Math.random();
    var t = st.seed = (st.seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function newDeck(st) {
    var d = [];
    for (var s = 0; s < 4; s++) for (var n = 1; n <= 9; n++) d.push(n);
    d.push(JOKER, JOKER);
    return shuffle(d, st);
  }
  function shuffle(a, st) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd(st) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // 1枚引く（山がなくなったら捨て札をまぜて山にする）
  function draw(st) {
    if (!st.deck.length) { st.deck = shuffle(st.disc, st); st.disc = []; }
    return st.deck.pop();
  }

  // seed（なくてもよい）: 山札の並びとシャッフルを決める数
  function init(V, H, seed) {
    var s = R.init(V);
    if (typeof seed === 'number') s.seed = seed | 0;
    s.H = H; s.deck = newDeck(s); s.disc = []; s.cards = [[], []]; s.cur = null;
    for (var p = 0; p < 2; p++) for (var k = 0; k < H; k++) s.cards[p].push(draw(s));
    if (H === 0) s.cur = draw(s);
    return s;
  }
  // いまの手番がえらべるカード
  function options(s) { return s.H === 0 ? [s.cur] : s.cards[s.turn]; }

  // そのカードで指せる手（例外は呼ぶ側で）
  function onFile(V, m, f) { return f === 0 || fileOf(V, m.f >= 0 ? m.f : m.t) === f; }

  // 合法手（カード番号 card と、例外で自由に指した free をつける）
  function moves(V, s) {
    if (s.end) return [];
    var all = R.moves(V, s), opt = options(s), out = [], k, i;
    if (!all.length) return [];
    var check = R.inCheck(V, s, s.turn);
    // 王手のとき: カードを使わずに、どの合法手でも（同じ手を札の数だけ並べない）
    if (check) { for (i = 0; i < all.length; i++) { var cm = withCard(all[i], -1, true); cm.chk = true; out.push(cm); } return out; }
    var per = opt.map(function (c) { return all.filter(function (m) { return onFile(V, m, cardFile(c)); }); });
    var anyCard = per.some(function (l) { return l.length; });
    for (k = 0; k < opt.length; k++) {
      if (!anyCard) {
        for (i = 0; i < all.length; i++) out.push(withCard(all[i], k, true));
      } else {
        for (i = 0; i < per[k].length; i++) out.push(withCard(per[k][i], k, false));
      }
    }
    return out;
  }
  function withCard(m, k, free) { return { f: m.f, t: m.t, pr: m.pr, d: m.d, cap: m.cap, card: k, free: free }; }
  function same(a, b) { return R.same(a, b) && a.card === b.card; }

  function play(V, s, m) {
    var ok = moves(V, s).some(function (x) { return same(x, m); });
    if (!ok) throw new Error('illegal ' + JSON.stringify(m));
    var n = R.play(V, s, m);
    n.last = { f: m.f, t: m.t, pr: m.pr, d: m.d, cap: m.cap };
    n.H = s.H; n.deck = s.deck.slice(); n.disc = s.disc.slice(); n.cards = [s.cards[0].slice(), s.cards[1].slice()];
    if (typeof s.seed === 'number') n.seed = s.seed;
    var p = s.turn, used;
    if (m.card === -1) {                       // 王手で自由に指した: カードは使わない・引かない
      n.cur = s.H === 0 ? s.cur : null; used = null;
    } else if (s.H === 0) { used = s.cur; n.disc.push(used); n.cur = draw(n); }
    else { used = n.cards[p].splice(m.card, 1)[0]; n.disc.push(used); n.cards[p].push(draw(n)); n.cur = null; }
    n.usedCard = used; n.free = !!m.free; n.chk = m.card === -1;
    return n;
  }
  function over(V, s) { return R.over(V, s); }

  // ===================== CPU =====================
  // 相手（や先の自分）の次のカードはわからないので、残りの山の枚数で重みをつけた「期待値」で読む
  var WIN = 1000000;
  function deckDist(s) {
    var src = s.deck.length ? s.deck : s.disc, cnt = {}, n = src.length;
    for (var i = 0; i < src.length; i++) cnt[src[i]] = (cnt[src[i]] || 0) + 1;
    var out = [];
    for (var c in cnt) out.push({ c: +c, p: cnt[c] / n });
    return out;
  }
  // 手を指したあとの値打ち（指した側から見た値）。つよい CPU は、相手がすぐ取り返せる駒も見る（カードは気にせず1手だけ）
  function quick(V, s, ctx) {
    var stand = R.evaluate(V, s);
    if (ctx && ctx.strong) {
      var ps = R.pseudoMoves(V, s);
      for (var i = 0; i < ps.length; i++) {
        if (!ps[i].cap) continue;
        var v = -R.evaluate(V, R.apply(V, s, ps[i]));
        if (HS.DEF[R.kind(ps[i].cap)].royal) v = WIN;
        if (v > stand) stand = v;
      }
    }
    return -stand;
  }
  // 局面 s（s.turn が指す側）の値打ち。known: 手に持っているとわかっているカード、unknown: まだ引いていない札が1枚あるか
  function nodeValue(V, s, known, unknown, depth, ctx) {
    ctx.nodes++;
    var all = R.moves(V, s);
    if (!all.length) return R.inCheck(V, s, s.turn) ? -(WIN - s.ply) : 0;
    if (s.ply >= V.maxPly) return 0;
    // 各手の値打ち
    var vals = new Array(all.length);
    // 時間切れになったら、そこから先は浅く読む（持ち駒が多いと手がとても多くなるため）
    if (depth > 1 && Date.now() > ctx.deadline) depth = 1;
    for (var i = 0; i < all.length; i++) {
      var n = R.apply(V, s, all[i]);
      vals[i] = depth <= 1 ? quick(V, n, ctx) : -nodeValue(V, n, nextKnown(s, n, true), nextUnknown(s), depth - 1, ctx);
    }
    var maxAll = -Infinity;
    for (i = 0; i < all.length; i++) if (vals[i] > maxAll) maxAll = vals[i];
    if (R.inCheck(V, s, s.turn)) return maxAll;                       // 王手のときは何をしてもいい
    // 筋ごとのいちばんいい手
    var bf = {};
    for (i = 0; i < all.length; i++) {
      var f = fileOf(V, all[i].f >= 0 ? all[i].f : all[i].t);
      if (bf[f] === undefined || vals[i] > bf[f]) bf[f] = vals[i];
    }
    function cardVal(c) { var f = cardFile(c); if (f === 0) return maxAll; return bf[f] === undefined ? null : bf[f]; }
    // known のカードと、引くかもしれない1枚から、いちばんいいものをえらぶ（どれも指せなければ自由）
    function best(cards) {
      var b = null;
      for (var k = 0; k < cards.length; k++) { var v = cardVal(cards[k]); if (v !== null && (b === null || v > b)) b = v; }
      return b === null ? maxAll : b;
    }
    if (!unknown) return best(known);
    var dist = ctx.dist, ev = 0;                                      // 山の中身は根の局面から（先読み中は変わらないとみなす）
    for (var d = 0; d < dist.length; d++) ev += dist[d].p * best(known.concat([dist[d].c]));
    return ev;
  }
  // 子の局面で、相手が持っているとわかっているカード
  function nextKnown(s, n) { return s.H === 0 || !s.cards ? [] : s.cards[1 - s.turn]; }
  function nextUnknown(s) { return s.H === 0 || !s.cards ? 1 : 0; }

  // level 0 よわい / 1 ふつう / 2 つよい
  function ai(V, s, level, timeMs) {
    var ms = moves(V, s);
    if (ms.length === 1) return ms[0];
    var ctx = { nodes: 0, strong: level === 2, dist: deckDist(s), deadline: Date.now() + (timeMs || (level === 2 ? 1500 : 700)) };
    var depth = level === 0 ? 1 : level === 1 ? 2 : 3;
    var opp = 1 - s.turn;
    var oppKnown = s.H === 0 ? [] : s.cards[opp], oppUnknown = s.H === 0 ? 1 : 0;
    // 同じ手（カードちがい）はまとめて調べる
    var seen = {}, scored = [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], key = m.f + ',' + m.t + ',' + (m.pr ? 1 : 0) + ',' + (m.d || 0);
      var v = seen[key];
      if (v === undefined) {
        var n = R.apply(V, s, m);
        if (!R.moves(V, n).length && R.inCheck(V, n, n.turn)) v = WIN;                  // 詰み
        else v = depth <= 1 ? quick(V, n, ctx) : -nodeValue(V, n, oppKnown, oppUnknown, depth - 1, ctx);
        seen[key] = v;
      }
      var noise = level === 0 ? Math.random() * 500 : level === 1 ? Math.random() * 40 : 0;
      // 手札があるとき: 同じ手なら、あとで使いにくいカード（自由に使えるジョーカーは残す）を捨てる
      var keep = s.H === 0 ? 0 : (options(s)[m.card] === JOKER ? -30 : 0);
      scored.push({ m: m, v: v + noise + keep });
    }
    scored.sort(function (a, b) { return b.v - a.v; });
    return scored[0].m;
  }

  HS.trump = {
    JOKER: JOKER, init: init, moves: moves, play: play, over: over, ai: ai, options: options, fileOf: fileOf, cardFile: cardFile, cardName: cardName,
    same: same, onFile: onFile
  };
})(this);

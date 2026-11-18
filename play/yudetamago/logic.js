'use strict';
/* =========================================================================
 * ゆでたまご剥きシミュレーター  game.js
 * classic script（three.min.js r158 の後に読み込む）。ネットワーク通信なし。
 * ========================================================================= */

// ---------------------------------------------------------------------------
// 純粋ロジック（DOM / three に依存しない。jsc で単体テストできる）
// ---------------------------------------------------------------------------
var YudeLogic = (function () {
  var MODES = {
    normal: {
      key: 'normal', name: 'ふつう',
      tearSpeed: 6.0,      // 何「たまご半径/秒」より速く引くと白身が削れるか
      dmgMul: 1.0,         // ダメージ倍率
      pressureMax: 4.6,    // 「力み」がこれに達すると爆発
      pressureDecay: 2.0,  // 力みの減衰（1/秒、指数）
      crackR: 0.42,        // 1タップでヒビが入る半径
      par: 40,             // この秒数までは時間で減点しない
      gouge: 1.0,          // 削れ跡の大きさ
      yolk: false,         // 深く削れると黄身が見える
      rare: 1.0,           // レア出現倍率
      bigPeels: 2          // 「一気に剥く」の回数
    },
    hanjuku: {
      key: 'hanjuku', name: '半熟',
      tearSpeed: 4.3, dmgMul: 1.5, pressureMax: 3.7, pressureDecay: 2.0,
      crackR: 0.36, par: 50, gouge: 1.35, yolk: true, rare: 1.5, bigPeels: 2
    }
  };
  var RANKS = [['SSS', 96], ['SS', 90], ['S', 82], ['A', 72], ['B', 60], ['C', 45], ['D', 30], ['F', -Infinity]];
  var EGG = { W: 1.0, H: 1.32, K: 0.11 };   // 横半径・縦半径・上側のすぼまり

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mode(key) { return MODES[key] || MODES.normal; }

  // 0〜100点。白身ダメージと時間で減点、塩で最大+3点
  function computeScore(time, damage, salt, modeKey) {
    var m = mode(modeKey);
    var s = 100 - damage * 1.4 - Math.max(0, time - m.par) * 0.45 + Math.min(3, Math.max(0, salt || 0));
    return clamp(Math.round(s * 10) / 10, 0, 100);
  }
  function rankFromScore(s) {
    for (var i = 0; i < RANKS.length; i++) if (s >= RANKS[i][1]) return RANKS[i][0];
    return 'F';
  }
  function computeRank(time, damage, salt, modeKey) { return rankFromScore(computeScore(time, damage, salt, modeKey)); }
  function rankIndex(r) { for (var i = 0; i < RANKS.length; i++) if (RANKS[i][0] === r) return i; return RANKS.length; }

  // 力み: タップごとに +1、時間で指数減衰
  function pressureAfter(p, dt, decay) { return p * Math.exp(-decay * dt); }
  // 一定間隔で連打し続けたときの力みの上限値
  function pressureSteady(interval, decay) { return 1 / (1 - Math.exp(-decay * interval)); }

  // 引っ張りの負荷（1を超えると白身が削れる）
  function tearStress(speedR, turnRad, uncracked, tearSpeed) {
    var deg = turnRad * 180 / Math.PI;
    return speedR / tearSpeed + Math.max(0, (deg - 50) / 70) + (uncracked ? 0.35 : 0);
  }
  function tearDamage(stress, dmgMul) {
    if (stress <= 1) return 0;
    return Math.min(14, 3 + (stress - 1) * 8) * dmgMul;
  }
  function rollRare(r, modeKey) {
    var m = mode(modeKey);
    if (r < 0.03 * m.rare) return 'gold';
    if (r < 0.10 * m.rare) return 'oji';
    return 'none';
  }
  // 単位球の方向 d → たまご表面の点
  function eggPoint(dx, dy, dz, out) {
    var s = EGG.W * (1 - EGG.K * dy);
    out[0] = dx * s; out[1] = dy * EGG.H; out[2] = dz * s;
    return out;
  }
  // たまごの内側か（表面で f=1 になる陰関数）
  function insideEgg(x, y, z, margin) {
    var dy = y / EGG.H;
    if (dy <= -1 - margin || dy >= 1 + margin) return false;
    var s = EGG.W * (1 - EGG.K * clamp(dy, -1, 1));
    var f = (x * x + z * z) / (s * s) + dy * dy;
    return f <= (1 + margin) * (1 + margin);
  }
  // 表面付近の点 → 単位球の方向
  function dirFromPoint(x, y, z, out) {
    var dy = clamp(y / EGG.H, -1, 1), h = Math.hypot(x, z), r = Math.sqrt(Math.max(0, 1 - dy * dy));
    if (h < 1e-6) { out[0] = 0; out[1] = dy < 0 ? -1 : 1; out[2] = 0; return out; }
    out[0] = x / h * r; out[1] = dy; out[2] = z / h * r;
    return out;
  }

  // たまごの種類（図鑑）。tear: 削れにくさ倍率（大きいほど速く引いても平気）、crack: ヒビの広がり倍率、
  // press: 力みの上限倍率、frags: 殻のかけらの数、par: 基準タイム倍率
  var EGGS = [
    { id: 'white', name: '白たまご', rarity: 'N', shell: 0xf0e4d0, white: 0xfffcf6, pattern: 'plain', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: 'いちばんふつうの、まっ白なたまご。', unlock: { always: true } },
    { id: 'red', name: '赤たまご', rarity: 'N', shell: 0xd59c6c, white: 0xfffcf6, pattern: 'plain', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: '殻がちょっとだけ茶色い。中身は同じ。', unlock: { always: true } },
    { id: 'quail', name: 'うずらのたまご', rarity: 'R', shell: 0xe8dcc2, spot: 0x3b2a1a, white: 0xfffaf0, pattern: 'spots', tear: 0.9, crack: 0.8, press: 1, frags: 230, par: 1.1,
      desc: '小さなかけらがたくさん。薄皮がくっつきやすい。', unlock: { clears: 3 } },
    { id: 'ukokkei', name: '烏骨鶏のたまご', rarity: 'R', shell: 0xe9cdb6, white: 0xfffaf2, pattern: 'plain', tear: 1.05, crack: 0.9, press: 1, frags: 160, par: 1,
      desc: 'うっすら桜色の高級たまご。殻がかため。', unlock: { clears: 6 } },
    { id: 'sakura', name: '桜ぞめたまご', rarity: 'R', shell: 0xf2b6c4, white: 0xfffaf6, pattern: 'plain', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: 'お祝いの日に染めた、ピンクのたまご。', unlock: { clears: 10 } },
    { id: 'easter', name: 'イースターエッグ', rarity: 'SR', shell: 0xfde7a6, white: 0xfffcf6, pattern: 'easter', tear: 1, crack: 1, press: 1, frags: 180, par: 1,
      desc: 'しましまと水玉。春のお祭りのたまご。', unlock: { rank: 'S' } },
    { id: 'dino', name: '恐竜のたまご', rarity: 'SR', shell: 0xa9c08c, spot: 0x4c6338, white: 0xfffbf0, pattern: 'spots', tear: 1.1, crack: 0.7, press: 1.15, frags: 140, par: 1.2,
      desc: '殻が分厚くてヒビが広がりにくい。どこで見つけたの？', unlock: { clears: 20 } },
    { id: 'ostrich', name: 'ダチョウのたまご', rarity: 'SR', shell: 0xf4ead4, white: 0xfffcf4, pattern: 'pores', tear: 1.15, crack: 0.6, press: 1.2, frags: 260, par: 1.5,
      desc: 'かけらが多くて長期戦。ぽつぽつ穴模様。', unlock: { hanjuku: true } },
    { id: 'pidan', name: 'ピータン風たまご', rarity: 'SR', shell: 0x8c7a5c, spot: 0x5a4a34, white: 0xc98a3a, pattern: 'mottle', tear: 0.85, crack: 1, press: 1, frags: 170, par: 1,
      desc: '白身があめ色。やわらかくて削れやすい。', unlock: { found: 5 } },
    { id: 'gold', name: '金のたまご', rarity: 'SSR', shell: 0xd8aa3a, white: 0xfffcf6, pattern: 'metal', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: '殻がピカピカの金色。剥くのがもったいない。', unlock: { rank: 'SSS' } },
    { id: 'moon', name: '月のたまご', rarity: 'SSR', shell: 0xc9d2e2, white: 0xf6f8ff, pattern: 'moon', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: 'クレーター模様の、銀色のたまご。', unlock: { perfect: true } },
    { id: 'hiyoko', name: 'ひよこが出てくる珍卵', rarity: 'SSR', shell: 0xf3ead8, white: 0xfff2a8, pattern: 'plain', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: 'ゆでたはずなのに……中から何か出てくる！？', unlock: { found: 9 } },
    // 1.0.4 で追加（6種類）。今日のたまごには出ない（今日のたまごは前の12種類から。過去の日のたまごを変えないため）
    { id: 'ao', name: '青いたまご', rarity: 'R', shell: 0xa9cfc4, white: 0xfffcf6, pattern: 'plain', tear: 1, crack: 0.95, press: 1, frags: 170, par: 1,
      desc: 'うすい青緑の殻。アローカナという鶏のたまご。', unlock: { clears: 15 } },
    { id: 'ushi', name: 'うしがらたまご', rarity: 'R', shell: 0xf4f1ea, spot: 0x2a2a2a, white: 0xfffcf6, pattern: 'spots', tear: 1, crack: 0.9, press: 1, frags: 190, par: 1.05,
      desc: '白と黒のぶち模様。牧場で見つけた？', unlock: { clears: 25 } },
    { id: 'onsen', name: '温泉たまご', rarity: 'SR', shell: 0xe6d3b3, white: 0xfff3dc, pattern: 'pores', tear: 0.8, crack: 1.1, press: 0.95, frags: 170, par: 1.1,
      desc: '湯気ほかほか。白身がとろっとやわらかくて、削れやすい。', unlock: { clears: 40 } },
    { id: 'choco', name: 'チョコいろたまご', rarity: 'SR', shell: 0x8a5a36, spot: 0x4a2a16, white: 0xfffaf2, pattern: 'mottle', tear: 1, crack: 1.1, press: 1, frags: 150, par: 1,
      desc: 'チョコレート色のまだら模様。あまい香りはしない。', unlock: { rank: 'SS' } },
    { id: 'kuro', name: '黒たまご', rarity: 'SR', shell: 0x47403a, white: 0xfffcf6, pattern: 'pores', tear: 1.1, crack: 0.75, press: 1.1, frags: 200, par: 1.2,
      desc: '温泉の湯で黒くなった、かための殻。食べると長生きするとか。', unlock: { clears: 50 } },
    { id: 'koori', name: 'こおりのたまご', rarity: 'SSR', shell: 0xb8dcf0, white: 0xf4fbff, pattern: 'metal', tear: 0.9, crack: 1.3, press: 1, frags: 170, par: 1,
      desc: 'ひんやりつるつる。ヒビがよく広がる。', unlock: { found: 15 } },
    // 期間限定（毎年 12/1〜12/25 の今日のたまご）。一度むけば、期間のあとも図鑑に残り、自由に選べる
    { id: 'xmas', name: 'クリスマスのたまご', rarity: 'SR', shell: 0xc62a3a, white: 0xfffcf6, pattern: 'xmas', tear: 1, crack: 1, press: 1, frags: 170, par: 1,
      desc: 'オーナメントのような赤・緑・金のたまご。12月1日〜25日の今日のたまごで出会える。', unlock: { event: 'xmas' } }
  ];
  var DAILY_EGGS = EGGS.slice(0, 12);   // 今日のたまごの候補（1.0.3 までと同じ12種類。ふやすと過去の日のたまごがかわる）
  var RARITY_W = { N: 60, R: 25, SR: 11, SSR: 4 };
  // クリスマス期間の今日のたまご: 見た目と名前はクリスマスのたまご、かたさ・かけらの数などは その日の今日のたまご（問題はみんな同じ・期間外と同じ）
  //   id は 'xmas'（図鑑に入る）、ref = 'xmas:<もとのたまご>'（もう一度・はじめから で同じたまごにする）
  function xmasEgg(base) {
    var x = EGGS[EGGS.length - 1], o = {}, k;
    for (k in base) o[k] = base[k];
    o.id = x.id; o.name = x.name; o.rarity = x.rarity; o.shell = x.shell; o.white = x.white; o.pattern = x.pattern; o.spot = 0; o.desc = x.desc; o.unlock = x.unlock;
    o.baseId = base.id; o.ref = 'xmas:' + base.id;
    return o;
  }
  function eggById(id) { if (typeof id === 'string' && id.indexOf('xmas:') === 0) return xmasEgg(eggById(id.slice(5))); for (var i = 0; i < EGGS.length; i++) if (EGGS[i].id === id) return EGGS[i]; return EGGS[0]; }
  // 図鑑の記録 eggs = { id: { n: 剥いた回数, best: 'S', perfect: true } }、st = { clears, hanjukuClears, bestRank, perfect }
  function foundCount(eggs) { var n = 0; for (var i = 0; i < EGGS.length; i++) if (eggs && eggs[EGGS[i].id] && eggs[EGGS[i].id].n) n++; return n; }
  function isUnlocked(egg, eggs, st) {
    var u = egg.unlock || {};
    if (u.always) return true;
    if (eggs && eggs[egg.id] && eggs[egg.id].n) return true;   // 一度剥いたら自由に選べる
    st = st || {};
    if (u.clears) return (st.clears || 0) >= u.clears;
    if (u.rank) return st.bestRank != null && rankIndex(st.bestRank) <= rankIndex(u.rank);
    if (u.hanjuku) return (st.hanjukuClears || 0) >= 1;
    if (u.perfect) return !!st.perfect;
    if (u.found) return foundCount(eggs) >= u.found;
    return false;   // u.event: 期間限定（むいたことがあるときだけ）
  }
  function unlockHint(egg) {
    var u = egg.unlock || {};
    if (u.always) return '';
    if (u.clears) return u.clears + '個むくと出会える';
    if (u.rank) return 'ランク' + u.rank + 'を出すと出会える';
    if (u.hanjuku) return '半熟モードを1回クリアすると出会える';
    if (u.perfect) return '白身ダメージ0でむくと出会える';
    if (u.found) return u.found + '種類のたまごを見つけると出会える';
    if (u.event === 'xmas') return '12月1日〜25日の「今日のたまご」をむくと出会える（期間限定）';
    return '';
  }
  // 日付から決まる「今日のたまご」（ロック中のたまごも出る＝お試しで出会える）
  function dailyEgg(dateStr) {
    var h = 2166136261;
    for (var i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var total = 0, k; for (k = 0; k < DAILY_EGGS.length; k++) total += RARITY_W[DAILY_EGGS[k].rarity];
    var r = (h % 100000) / 100000 * total;
    for (k = 0; k < DAILY_EGGS.length; k++) { r -= RARITY_W[DAILY_EGGS[k].rarity]; if (r < 0) return DAILY_EGGS[k]; }
    return EGGS[0];
  }
  // おまかせ: 選べるたまごの中から、レア度の重みで抽選
  function randomEgg(r, eggs, st) {
    var pool = EGGS.filter(function (e) { return isUnlocked(e, eggs, st); }), total = 0, k;
    for (k = 0; k < pool.length; k++) total += RARITY_W[pool[k].rarity];
    var x = r * total;
    for (k = 0; k < pool.length; k++) { x -= RARITY_W[pool[k].rarity]; if (x < 0) return pool[k]; }
    return pool[0] || EGGS[0];
  }
  // モードの設定に、たまごの性質をかけ合わせる
  function applyEgg(m, egg) {
    var o = {}; for (var k in m) o[k] = m[k];
    o.tearSpeed = m.tearSpeed * egg.tear; o.crackR = m.crackR * egg.crack;
    o.pressureMax = m.pressureMax * egg.press; o.par = Math.round(m.par * egg.par);
    return o;
  }
  // 結果を図鑑に記録する。戻り値: 新しく見つけたたまごか
  function recordEgg(eggs, id, rank, damage) {
    var e = eggs[id] || (eggs[id] = { n: 0 }), isNew = !e.n;
    e.n++;
    if (!e.best || rankIndex(rank) < rankIndex(e.best)) e.best = rank;
    if (damage === 0) e.perfect = true;
    return isNew;
  }
  function isBetter(rec, old) {
    if (!old) return true;
    if (rec.score !== old.score) return rec.score > old.score;
    return rec.time < old.time;
  }
  var COMMENTS = {
    SSS: 'もはや工業製品。ツルッツルの神', SS: '旅館の朝食に出せる美しさ', S: 'ほぼ完璧。自慢していい',
    A: 'じゅうぶんキレイ。おいしそう', B: 'ところどころ削れたが、味は同じ', C: '白身がちょっと旅に出た',
    D: 'でこぼこ。それもまた個性', F: 'それはもう、たまごサラダ'
  };
  return {
    MODES: MODES, RANKS: RANKS, EGG: EGG, COMMENTS: COMMENTS, clamp: clamp,
    computeScore: computeScore, rankFromScore: rankFromScore, computeRank: computeRank, rankIndex: rankIndex,
    pressureAfter: pressureAfter, pressureSteady: pressureSteady, tearStress: tearStress, tearDamage: tearDamage,
    rollRare: rollRare, eggPoint: eggPoint, insideEgg: insideEgg, dirFromPoint: dirFromPoint, isBetter: isBetter,
    EGGS: EGGS, RARITY_W: RARITY_W, eggById: eggById, foundCount: foundCount, isUnlocked: isUnlocked, unlockHint: unlockHint,
    dailyEgg: dailyEgg, xmasEgg: xmasEgg, randomEgg: randomEgg, applyEgg: applyEgg, recordEgg: recordEgg
  };
})();

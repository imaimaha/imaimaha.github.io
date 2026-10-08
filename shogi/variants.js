/* 変則将棋 — ルールの一覧（盤の大きさ・初期配置・成れる段数・説明）
   rows は上（後手の陣）から順。v のついた駒が後手。「.」は空きマス */
(function (root) {
  'use strict';
  var HS = root.HS;
  var E9 = '. . . . . . . . .';
  var P9 = '歩 歩 歩 歩 歩 歩 歩 歩 歩', VP9 = 'v歩 v歩 v歩 v歩 v歩 v歩 v歩 v歩 v歩';
  var HONSHOGI_TOP = 'v香 v桂 v銀 v金 v王 v金 v銀 v桂 v香';
  var HONSHOGI_BOT = '香 桂 銀 金 玉 金 銀 桂 香';

  // 駒落ち: 上手（後手）から駒を抜く。上手が先に指す
  function handicapRows(remove) {
    var top = HONSHOGI_TOP.split(' '), second = '. v飛 . . . . . v角 .'.split(' ');
    remove.forEach(function (r) { if (r[0] === 0) top[r[1]] = '.'; else second[r[1]] = '.'; });
    return [top.join(' '), second.join(' '), VP9, E9, E9, E9, P9, '. 角 . . . . . 飛 .', HONSHOGI_BOT];
  }
  var HANDICAPS = [
    { id: 'kyo', label: '香落ち', remove: [[0, 8]] },
    { id: 'kaku', label: '角落ち', remove: [[1, 7]] },
    { id: 'hisha', label: '飛車落ち', remove: [[1, 1]] },
    { id: 'nimai', label: '二枚落ち', remove: [[1, 1], [1, 7]] },
    { id: 'yonmai', label: '四枚落ち', remove: [[1, 1], [1, 7], [0, 0], [0, 8]] },
    { id: 'rokumai', label: '六枚落ち', remove: [[1, 1], [1, 7], [0, 0], [0, 8], [0, 1], [0, 7]] }
  ];

  var LIST = [
    {
      id: 'go5', title: '5五将棋', emoji: '☗', tag: '定番', w: 5, h: 5, zone: 1, rep: 'sente',
      desc: '5×5 の小さな将棋。持ち駒も成りもある',
      rules: '5×5 の盤で、本将棋と同じ動きの駒（玉・金・銀・角・飛・歩）を使う。いちばん奥の1段が敵陣。<br>取った駒は持ち駒として打てる（二歩・打ち歩詰め・行き所のない歩は禁止）。<br>同じ局面が4回で千日手。先手の負け（連続王手なら王手をかけた側の負け）。',
      rows: ['v飛 v角 v銀 v金 v王', '. . . . v歩', '. . . . .', '歩 . . . .', '玉 金 銀 角 飛']
    },
    {
      id: 'komagoma', title: 'こまごま将棋', emoji: '🧩', tag: 'オリジナル', w: 5, h: 6, zone: 2,
      desc: '5×6 のたて長盤。歩が3枚ずつで、すぐぶつかる',
      rules: 'たて6段・よこ5筋のオリジナル盤。駒の動きは本将棋と同じ。<br>奥の2段が敵陣で、入るか出るときに成れる。持ち駒あり。<br>千日手は引き分け（連続王手は王手をかけた側の負け）。',
      rows: ['v飛 v銀 v王 v金 v角', '. v歩 v歩 v歩 .', '. . . . .', '. . . . .', '. 歩 歩 歩 .', '角 金 玉 銀 飛']
    },
    {
      id: 'ninja', title: '忍者将棋', emoji: '🥷', tag: 'オリジナル駒', w: 5, h: 5, zone: 1, rep: 'sente',
      desc: '5五将棋の銀が「忍者」に。8方向に跳ぶ',
      rules: '5五将棋の銀のかわりに「忍」（忍者）を使う。<br>忍は桂馬の跳び方を前後左右の8方向にできる（駒を跳びこえる）。成ると「影」になり、玉の動きも加わる。<br>ほかは 5五将棋と同じ（千日手は先手の負け）。',
      rows: ['v飛 v角 v忍 v金 v王', '. . . . v歩', '. . . . .', '歩 . . . .', '玉 金 忍 角 飛']
    },
    {
      id: 'kaeru', title: 'かえる将棋', emoji: '🐸', tag: 'オリジナル駒', w: 5, h: 5, zone: 1, rep: 'sente',
      desc: '角が「蛙」に。ぴょんと2マス跳ぶ',
      rules: '5五将棋の角のかわりに「蛙」を使う。<br>蛙は縦・横・ななめに、ちょうど2マス先へ跳ぶ（あいだの駒は跳びこえる）。成ると「跳」になり、玉の動きも加わる。<br>ほかは 5五将棋と同じ。',
      rows: ['v飛 v蛙 v銀 v金 v王', '. . . . v歩', '. . . . .', '歩 . . . .', '玉 金 銀 蛙 飛']
    },
    {
      id: 'taiho', title: '大砲将棋', emoji: '💥', tag: 'オリジナル駒', w: 6, h: 6, zone: 2,
      desc: '6×6 盤に「大砲」。1枚はさんで撃つ',
      rules: '6×6 の盤。「砲」（大砲）は縦横に何マスでも動けるが、駒を取るときだけ、あいだにちょうど1枚（敵でも味方でも）をはさんで、その向こうの敵を撃つ。<br>成ると「轟」になり、ななめ1マスも動ける。奥の2段が敵陣。千日手は引き分け。',
      rows: ['v角 v銀 v金 v王 v砲 v飛', '. v歩 v歩 v歩 v歩 .', '. . . . . .', '. . . . . .', '. 歩 歩 歩 歩 .', '飛 砲 玉 金 銀 角']
    },
    {
      id: 'sougyoku', title: '王様2枚将棋', emoji: '👑', tag: '変則', w: 7, h: 7, zone: 2, royal: 'capture',
      desc: '王様が2枚。両方取られたら負け',
      rules: '7×7 の盤で、王様が2枚ずつ。<br>この将棋には「王手」も「詰み」もない。相手の王様を2枚とも取ったら勝ち（1枚取られてもまだ続く）。<br>奥の2段が敵陣。持ち駒あり。',
      rows: ['v飛 v銀 v王 v金 v王 v銀 v角', 'v歩 v歩 v歩 v歩 v歩 v歩 v歩', '. . . . . . .', '. . . . . . .', '. . . . . . .', '歩 歩 歩 歩 歩 歩 歩', '角 銀 玉 金 玉 銀 飛']
    },
    {
      id: 'fudake', title: '歩だけ将棋', emoji: '🚶', tag: '変則', w: 9, h: 9, zone: 3,
      desc: '玉と金と歩だけ。と金をつくって攻めろ',
      rules: '本将棋の盤で、使う駒は玉・金2枚・歩9枚だけ。<br>歩は敵陣（奥の3段）に入ると「と」になれる。取った歩は打てる（二歩・打ち歩詰めは禁止）。<br>千日手は引き分け。',
      rows: ['. . . v金 v王 v金 . . .', E9, VP9, E9, E9, E9, P9, E9, '. . . 金 玉 金 . . .']
    },
    {
      id: 'honshogi', title: '本将棋', emoji: '🏯', tag: '定番', w: 9, h: 9, zone: 3,
      desc: '9×9 のふつうの将棋（CPU はゆっくり）',
      rules: 'ふつうの将棋。奥の3段が敵陣。持ち駒・成り・二歩・打ち歩詰め・行き所のない駒、すべて本将棋のルール。<br>千日手は引き分け（連続王手は王手をかけた側の負け）。<br>盤が大きいので、CPU は少し時間をかけて考える。',
      rows: [HONSHOGI_TOP, '. v飛 . . . . . v角 .', VP9, E9, E9, E9, P9, '. 角 . . . . . 飛 .', HONSHOGI_BOT]
    },
    {
      id: 'irekae', title: '飛車角入れ替え', emoji: '🔄', tag: '変則', w: 9, h: 9, zone: 3,
      desc: '飛車と角の位置が逆。いつもの定跡が通じない',
      rules: '本将棋と同じルールで、はじめの飛車と角の位置だけが左右入れ替わっている。<br>いつもの囲いや戦法がそのままでは使えない。',
      rows: [HONSHOGI_TOP, '. v角 . . . . . v飛 .', VP9, E9, E9, E9, P9, '. 飛 . . . . . 角 .', HONSHOGI_BOT]
    }
  ];
  HANDICAPS.forEach(function (hc) {
    LIST.push({
      id: 'ochi-' + hc.id, group: 'komaochi', title: '駒落ち（' + hc.label + '）', short: hc.label, emoji: '🎓', tag: '駒落ち', w: 9, h: 9, zone: 3, firstTurn: 1,
      desc: '上手（後手）が駒を落として先に指す',
      rules: '強い人（上手・後手）が駒を減らして戦う、昔からのハンデ戦。上手が先に指す。<br>' + hc.label + '：上手の盤から駒を抜いてはじめる。ほかは本将棋と同じルール。',
      rows: handicapRows(hc.remove)
    });
  });

  // 安南の仲間: となりの味方の駒の動きを借りる。向きは「その駒の持ち主から見て」
  var AN_DIRS = [
    { id: 'S', name: '安南', where: 'すぐうしろ', vec: [0, 1] },
    { id: 'N', name: '安北', where: 'すぐ前', vec: [0, -1] },
    { id: 'E', name: '安東', where: '右どなり', vec: [1, 0] },
    { id: 'W', name: '安西', where: '左どなり', vec: [-1, 0] }
  ];
  var AN_BOARDS = [
    { id: '9', label: '9×9（本将棋）', w: 9, h: 9, zone: 3, rep: 'draw', rows: [HONSHOGI_TOP, '. v飛 . . . . . v角 .', VP9, E9, E9, E9, P9, '. 角 . . . . . 飛 .', HONSHOGI_BOT] },
    { id: '5', label: '5×5（5五将棋）', w: 5, h: 5, zone: 1, rep: 'sente', rows: ['v飛 v角 v銀 v金 v王', '. . . . v歩', '. . . . .', '歩 . . . .', '玉 金 銀 角 飛'] }
  ];
  // 安南将棋（9×9）だけは、昔からの初期配置: 飛車と角の前の歩を1つ前に出しておく（先手 ２六歩・８六歩／後手 ８四歩・２四歩）。
  // ふつうの並びのままだと、飛車・角の前の歩がうしろの飛車・角の動きを借りて、1手目からいきなり敵陣に飛びこめてしまうため
  var AN_S9_ROWS = [HONSHOGI_TOP, '. v飛 . . . . . v角 .', 'v歩 . v歩 v歩 v歩 v歩 v歩 . v歩', '. v歩 . . . . . v歩 .', E9, '. 歩 . . . . . 歩 .', '歩 . 歩 歩 歩 歩 歩 . 歩', '. 角 . . . . . 飛 .', HONSHOGI_BOT];
  AN_DIRS.forEach(function (dd) {
    AN_BOARDS.forEach(function (bd) {
      var shifted = dd.id === 'S' && bd.id === '9';
      LIST.push({
        id: 'an-' + dd.id + '-' + bd.id, group: 'an', anDir: dd.id, anBoard: bd.id, an: dd.vec,
        title: dd.name + '将棋' + (bd.id === '5' ? '（5×5）' : ''), short: dd.name, emoji: '🧭', tag: '変則',
        w: bd.w, h: bd.h, zone: bd.zone, rep: bd.rep,
        desc: 'となりの味方の駒の動きを借りる',
        rules: '<b>' + dd.name + '将棋</b>：駒の' + dd.where + 'に<b>味方の駒</b>がいるとき、その駒は<b>' + dd.where + 'の駒と同じ動き</b>になる（いなければ、ふつうの動き）。' +
          '「うしろ・前・右・左」は、<b>その駒の持ち主から見た向き</b>（先手と後手で逆になる）。<br>' +
          '玉も借りる（玉の' + dd.where + 'に飛車がいれば、玉は飛車の動き）。王手・詰み・打ち歩詰めも、この借りた動きで決まる。<br>' +
          '成れるかどうか・成ったあとの駒は、その駒のもとの種類で決まる（借りた動きは関係ない）。二歩・打ち歩詰め・行き所のない駒（歩・香は奥1段、桂は奥2段）の禁止は本将棋と同じ。<br>' +
          (shifted ? '盤は本将棋。駒の並びは安南将棋の昔からの形で、<b>飛車と角の前の歩だけ1つ前</b>（先手 ２六歩・８六歩／後手 ８四歩・２四歩）。こうしないと、その歩が飛車・角の動きを借りて1手目から敵陣に飛びこめてしまう。奥3段が敵陣。千日手は引き分け。' :
            bd.id === '9' ? '盤と駒の並びは本将棋。奥3段が敵陣。千日手は引き分け。' : '盤と駒の並びは 5五将棋。奥1段が敵陣。千日手は先手の負け。') +
          '（連続王手の千日手は、王手をかけた側の負け）',
        rows: shifted ? AN_S9_ROWS : bd.rows
      });
    });
  });

  // トランプ将棋（カードのルールは trump.js。盤と駒は本将棋）
  LIST.push({
    id: 'trump', title: 'トランプ将棋', emoji: '🃏', tag: 'オリジナル', w: 9, h: 9, zone: 3, rep: 'draw',
    desc: 'めくったカードの数字の筋の駒しか動かせない',
    rules: '',
    rows: [HONSHOGI_TOP, '. v飛 . . . . . v角 .', VP9, E9, E9, E9, P9, '. 角 . . . . . 飛 .', HONSHOGI_BOT]
  });

  HS.VARIANTS = {};
  HS.VARIANT_ORDER = [];
  LIST.forEach(function (d) { var V = HS.makeVariant(d); HS.VARIANTS[d.id] = V; HS.VARIANT_ORDER.push(d.id); });
  HS.HANDICAPS = HANDICAPS;
  HS.AN_DIRS = AN_DIRS;
  HS.AN_BOARDS = AN_BOARDS;
})(this);

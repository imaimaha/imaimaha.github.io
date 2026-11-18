/* おかず詰めパズル — おかず・お弁当箱の絵（canvas）。画面の動きは game.js
 * おかずは 1 マスずつではなく「1 つのおかず」としてつながった形にかき、顔をつける（ブロックパズルっぽさを消すため）
 */
(function (root) {
  'use strict';
  var F = root.OB.FOODS;
  // お正月（12/29〜1/7 の今日のおべんとう。game.js が DR.skin = 'osechi' にする）: おかずの形・数はそのまま、絵と名前だけ おせちに
  var OSECHI = {
    ume:     { name: '黒豆',         color: '#2e2427', dark: '#120b0d', lightFace: true },
    edamame: { name: '数の子',       color: '#f6e08e', dark: '#c9a23a' },
    wiener:  { name: '昆布巻き',     color: '#4b4a2c', dark: '#25240f', lightFace: true },
    brocco:  { name: 'くりきんとん', color: '#f7c22c', dark: '#c68d0e' },
    tamago:  { name: 'だて巻き',     color: '#f4b733', dark: '#9a5e10' },
    karaage: { name: 'かまぼこ',     color: '#fff7f2', dark: '#d63a4c' },
    ebi:     { name: 'えび',         color: '#ef5b3c', dark: '#a8301c' },
    onigiri: { name: '紅白なます',   color: '#fbf7ee', dark: '#e0835a' },
    napo:    { name: 'たたきごぼう', color: '#8d5c36', dark: '#583418', lightFace: true },
    hamburg: { name: '鯛',           color: '#f2838a', dark: '#b9434f' },
    shake:   { name: 'お煮しめ',     color: '#cf9152', dark: '#8a5523' }
  };
  function look(k) { return (DR.skin === 'osechi' && OSECHI[k]) || F[k]; }

  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // つながった形をぬる。cells = [[行, 列]…]（同じおかずのマス）
  function blobPath(c, cells, ox, oy, s, pad) {
    var set = {}, m = pad == null ? Math.max(1.5, s * 0.06) : pad, rad = s * 0.26;
    cells.forEach(function (p) { set[p[0] + ',' + p[1]] = 1; });
    function hasC(r, cc) { return !!set[r + ',' + cc]; }
    c.beginPath();
    cells.forEach(function (p) {
      var x = ox + p[1] * s, y = oy + p[0] * s;
      var u = hasC(p[0] - 1, p[1]), d = hasC(p[0] + 1, p[1]), l = hasC(p[0], p[1] - 1), r = hasC(p[0], p[1] + 1);
      // 4すみの丸み: となりがあるほうは丸めない
      var x0 = l ? x : x + m, x1 = r ? x + s : x + s - m, y0 = u ? y : y + m, y1 = d ? y + s : y + s - m;
      var tl = (u || l) ? 0 : rad, tr = (u || r) ? 0 : rad, br = (d || r) ? 0 : rad, bl = (d || l) ? 0 : rad;
      c.moveTo(x0 + tl, y0);
      c.lineTo(x1 - tr, y0); if (tr) c.arcTo(x1, y0, x1, y0 + tr, tr);
      c.lineTo(x1, y1 - br); if (br) c.arcTo(x1, y1, x1 - br, y1, br);
      c.lineTo(x0 + bl, y1); if (bl) c.arcTo(x0, y1, x0, y1 - bl, bl);
      c.lineTo(x0, y0 + tl); if (tl) c.arcTo(x0, y0, x0 + tl, y0, tl);
      c.closePath();
    });
  }

  // 1 つのおかず（同じ pid のマス）をかく
  // o: { alpha, face: 'smile'|'wow'|'happy'|'sad'|'sleep'|null, faceCell: [行,列], lock: true, ice: true, shadow: true, t: 秒 }
  function food(c, k, cells, ox, oy, s, o) {
    o = o || {};
    var f = look(k); if (!F[k]) return;
    var fface = F[k].face;
    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    if (o.shadow) {
      c.save(); c.translate(s * 0.08, s * 0.16); c.fillStyle = 'rgba(70,35,10,.22)'; blobPath(c, cells, ox, oy, s); c.fill(); c.restore();
    }
    // ふち（こい色）→ なか
    c.fillStyle = f.dark; blobPath(c, cells, ox, oy, s); c.fill();
    c.fillStyle = f.color; blobPath(c, cells, ox, oy, s, Math.max(3, s * 0.11)); c.fill();
    // もよう
    c.save(); blobPath(c, cells, ox, oy, s, Math.max(3, s * 0.11)); c.clip();
    var set = {}; cells.forEach(function (p) { set[p[0] + ',' + p[1]] = 1; });
    cells.forEach(function (p, i) { if (f !== F[k]) decoOsechi(c, k, ox + p[1] * s, oy + p[0] * s, s, set, p, i); else deco(c, k, ox + p[1] * s, oy + p[0] * s, s, set, p, i); });
    // つや
    c.fillStyle = 'rgba(255,255,255,.28)';
    cells.forEach(function (p) {
      if (set[(p[0] - 1) + ',' + p[1]]) return;
      rr(c, ox + p[1] * s + s * 0.2, oy + p[0] * s + s * 0.14, s * 0.42, s * 0.13, s * 0.07); c.fill();
    });
    c.restore();
    if (o.ice) {
      c.fillStyle = 'rgba(190,230,255,.62)'; blobPath(c, cells, ox, oy, s); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(1.5, s * 0.05);
      cells.forEach(function (p) {
        var x = ox + p[1] * s, y = oy + p[0] * s;
        c.beginPath(); c.moveTo(x + s * 0.22, y + s * 0.62); c.lineTo(x + s * 0.42, y + s * 0.4); c.moveTo(x + s * 0.55, y + s * 0.8); c.lineTo(x + s * 0.8, y + s * 0.52); c.stroke();
      });
    }
    var fc = o.faceCell || cells[Math.min(fface, cells.length - 1)];
    if (o.face !== null && fc && cells.some(function (p) { return p[0] === fc[0] && p[1] === fc[1]; })) {
      face(c, ox + fc[1] * s, oy + fc[0] * s, s, o.ice ? 'cold' : (o.face || 'smile'), k, o.t || 0);
    }
    if (o.lock) {
      var lx = ox + cells[0][1] * s, ly = oy + cells[0][0] * s;
      c.font = Math.round(s * 0.36) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.beginPath(); c.arc(lx + s * 0.16, ly + s * 0.16, s * 0.2, 0, 7); c.fill();
      c.fillText('🔒', lx + s * 0.16, ly + s * 0.18);
    }
    c.restore();
  }

  function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  // マスごとのもよう
  function deco(c, k, x, y, s, set, p, i) {
    var u = set[(p[0] - 1) + ',' + p[1]], d = set[(p[0] + 1) + ',' + p[1]], l = set[p[0] + ',' + (p[1] - 1)], r = set[p[0] + ',' + (p[1] + 1)];
    c.lineWidth = Math.max(1.2, s * 0.05); c.lineCap = 'round';
    switch (k) {
      case 'ume':
        c.strokeStyle = 'rgba(120,10,30,.35)';
        c.beginPath(); c.arc(x + s * 0.5, y + s * 0.62, s * 0.22, 3.6, 5.6); c.stroke();
        c.fillStyle = '#7da640'; c.beginPath(); c.ellipse(x + s * 0.6, y + s * 0.14, s * 0.14, s * 0.06, -0.5, 0, 7); c.fill();
        break;
      case 'edamame':
        c.fillStyle = 'rgba(210,240,170,.75)';
        c.beginPath(); c.ellipse(x + s * 0.32, y + s * 0.62, s * 0.15, s * 0.13, 0, 0, 7); c.fill();
        c.beginPath(); c.ellipse(x + s * 0.68, y + s * 0.62, s * 0.15, s * 0.13, 0, 0, 7); c.fill();
        break;
      case 'wiener':
        c.strokeStyle = 'rgba(150,30,20,.45)';
        if (!l || !r || !u || !d) {
          // タコの足（はしのマス）
          if (!r && (l || u || d)) { for (var a = 0; a < 3; a++) { c.beginPath(); c.moveTo(x + s * 0.62, y + s * (0.3 + a * 0.2)); c.lineTo(x + s * 0.95, y + s * (0.3 + a * 0.2)); c.stroke(); } }
          else if (!d && (l || r || u)) { for (var b2 = 0; b2 < 3; b2++) { c.beginPath(); c.moveTo(x + s * (0.3 + b2 * 0.2), y + s * 0.62); c.lineTo(x + s * (0.3 + b2 * 0.2), y + s * 0.95); c.stroke(); } }
        }
        c.beginPath(); c.moveTo(x + s * 0.3, y + s * 0.35); c.lineTo(x + s * 0.45, y + s * 0.5); c.stroke();
        break;
      case 'brocco':
        c.fillStyle = 'rgba(30,100,40,.55)';
        dot(c, x + s * 0.3, y + s * 0.35, s * 0.14); dot(c, x + s * 0.68, y + s * 0.4, s * 0.15); dot(c, x + s * 0.48, y + s * 0.72, s * 0.15);
        c.fillStyle = 'rgba(160,230,130,.6)';
        dot(c, x + s * 0.35, y + s * 0.3, s * 0.06); dot(c, x + s * 0.7, y + s * 0.34, s * 0.06);
        break;
      case 'tamago':
        c.strokeStyle = 'rgba(200,140,20,.55)';
        c.beginPath(); c.moveTo(x, y + s * 0.4); c.quadraticCurveTo(x + s * 0.5, y + s * 0.28, x + s, y + s * 0.4); c.stroke();
        c.beginPath(); c.moveTo(x, y + s * 0.68); c.quadraticCurveTo(x + s * 0.5, y + s * 0.56, x + s, y + s * 0.68); c.stroke();
        break;
      case 'karaage':
        c.fillStyle = 'rgba(140,70,20,.4)';
        dot(c, x + s * 0.3, y + s * 0.3, s * 0.1); dot(c, x + s * 0.7, y + s * 0.55, s * 0.12); dot(c, x + s * 0.35, y + s * 0.75, s * 0.08);
        c.fillStyle = 'rgba(255,220,150,.4)'; dot(c, x + s * 0.6, y + s * 0.28, s * 0.07);
        break;
      case 'ebi':
        c.fillStyle = 'rgba(150,80,10,.45)';
        for (var e = 0; e < 7; e++) dot(c, x + s * (0.2 + ((e * 37) % 60) / 100), y + s * (0.2 + ((e * 53) % 60) / 100), s * 0.045);
        if (!d && !r && (u || l)) { c.fillStyle = '#e8463a'; c.beginPath(); c.moveTo(x + s * 0.4, y + s * 0.5); c.lineTo(x + s * 0.95, y + s * 0.2); c.lineTo(x + s * 0.95, y + s * 0.85); c.closePath(); c.fill(); }
        break;
      case 'onigiri':
        if (!d) { c.fillStyle = '#23402f'; c.fillRect(x, y + s * 0.55, s, s * 0.5); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x, y + s * 0.6, s, s * 0.06); }
        c.fillStyle = 'rgba(200,200,190,.6)'; dot(c, x + s * 0.3, y + s * 0.3, s * 0.035); dot(c, x + s * 0.62, y + s * 0.22, s * 0.035);
        break;
      case 'napo':
        c.strokeStyle = 'rgba(255,220,180,.7)';
        c.beginPath(); c.moveTo(x + s * 0.1, y + s * 0.4); c.bezierCurveTo(x + s * 0.4, y + s * 0.1, x + s * 0.6, y + s * 0.7, x + s * 0.9, y + s * 0.4); c.stroke();
        c.beginPath(); c.moveTo(x + s * 0.1, y + s * 0.7); c.bezierCurveTo(x + s * 0.4, y + s * 0.4, x + s * 0.6, y + s * 0.95, x + s * 0.9, y + s * 0.7); c.stroke();
        c.fillStyle = '#5aa04a'; dot(c, x + s * 0.7, y + s * 0.25, s * 0.06);
        break;
      case 'hamburg':
        c.fillStyle = 'rgba(90,20,10,.55)';
        c.beginPath(); c.ellipse(x + s * 0.5, y + s * 0.42, s * 0.36, s * 0.2, 0.2, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,200,160,.25)'; dot(c, x + s * 0.4, y + s * 0.36, s * 0.07);
        break;
      case 'shake':
        c.strokeStyle = 'rgba(255,240,230,.85)';
        c.beginPath(); c.moveTo(x + s * 0.1, y + s * 0.2); c.lineTo(x + s * 0.5, y + s * 0.9); c.stroke();
        c.beginPath(); c.moveTo(x + s * 0.55, y + s * 0.1); c.lineTo(x + s * 0.95, y + s * 0.8); c.stroke();
        if (!u) { c.fillStyle = 'rgba(150,150,160,.6)'; c.fillRect(x, y, s, s * 0.14); }
        break;
    }
  }

  // おせちのもよう（DR.skin = 'osechi' のとき）
  function decoOsechi(c, k, x, y, s, set, p, i) {
    var u = set[(p[0] - 1) + ',' + p[1]], d = set[(p[0] + 1) + ',' + p[1]], l = set[p[0] + ',' + (p[1] - 1)], r = set[p[0] + ',' + (p[1] + 1)];
    c.lineWidth = Math.max(1.2, s * 0.05); c.lineCap = 'round';
    switch (k) {
      case 'ume':   // 黒豆: つやつやの豆と金ぱく
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x + s * 0.36, y + s * 0.3, s * 0.12, s * 0.06, -0.6, 0, 7); c.fill();
        c.fillStyle = '#e8c45a'; c.fillRect(x + s * 0.66, y + s * 0.2, s * 0.1, s * 0.08); c.fillRect(x + s * 0.72, y + s * 0.3, s * 0.05, s * 0.05);
        break;
      case 'edamame':   // 数の子: こまかいつぶつぶ
        c.fillStyle = 'rgba(190,140,30,.45)';
        for (var a = 0; a < 4; a++) for (var b = 0; b < 3; b++) dot(c, x + s * (0.2 + a * 0.2 + (b % 2) * 0.1), y + s * (0.3 + b * 0.2), s * 0.04);
        break;
      case 'wiener':   // 昆布巻き: かんぴょうの帯・はしは うずまき
        c.fillStyle = '#d9b77a'; c.fillRect(x + s * 0.44, y, s * 0.13, s);
        if (!l || !r) { c.strokeStyle = 'rgba(160,150,90,.6)'; c.beginPath(); c.arc(x + s * 0.5, y + s * 0.5, s * 0.22, 0, 5.2); c.stroke(); c.beginPath(); c.arc(x + s * 0.5, y + s * 0.5, s * 0.1, 0, 5.2); c.stroke(); }
        break;
      case 'brocco':   // くりきんとん: くりと、なめらかなきんとん
        c.strokeStyle = 'rgba(200,130,10,.45)'; c.beginPath(); c.arc(x + s * 0.5, y + s * 0.55, s * 0.28, 3.4, 6.0); c.stroke();
        if (i === 0) { c.fillStyle = '#e8a91c'; c.beginPath(); c.ellipse(x + s * 0.5, y + s * 0.5, s * 0.22, s * 0.18, 0.3, 0, 7); c.fill(); c.fillStyle = 'rgba(255,240,180,.7)'; dot(c, x + s * 0.42, y + s * 0.44, s * 0.06); }
        break;
      case 'tamago':   // だて巻き: 黄色の うずまき
        c.strokeStyle = 'rgba(130,70,8,.8)'; c.lineWidth = Math.max(1.6, s * 0.07); c.beginPath();
        for (var q = 0; q < 14; q++) { var an = q * 0.75, rd = s * (0.04 + q * 0.022), px = x + s * 0.5 + Math.cos(an) * rd, py = y + s * 0.52 + Math.sin(an) * rd; if (q) c.lineTo(px, py); else c.moveTo(px, py); }
        c.stroke();
        c.strokeStyle = 'rgba(120,70,10,.35)'; c.beginPath(); c.moveTo(x, y + s * 0.12); c.lineTo(x + s, y + s * 0.12); c.moveTo(x, y + s * 0.9); c.lineTo(x + s, y + s * 0.9); c.stroke();
        break;
      case 'karaage':   // かまぼこ: 上が紅・下が白
        if (!u) { c.fillStyle = '#e04a5c'; c.fillRect(x, y, s, s * 0.34); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y + s * 0.3, s, s * 0.04); }
        break;
      case 'ebi':   // えび: しまもよう・はしに しっぽ
        c.strokeStyle = 'rgba(255,235,220,.75)';
        c.beginPath(); c.arc(x + s * 0.5, y + s * 1.05, s * 0.55, 3.6, 5.8); c.stroke();
        c.beginPath(); c.arc(x + s * 0.5, y + s * 1.35, s * 0.6, 3.7, 5.7); c.stroke();
        if (!d && !r && (u || l)) { c.fillStyle = '#c42c1a'; c.beginPath(); c.moveTo(x + s * 0.4, y + s * 0.5); c.lineTo(x + s * 0.95, y + s * 0.2); c.lineTo(x + s * 0.95, y + s * 0.85); c.closePath(); c.fill(); }
        break;
      case 'onigiri':   // 紅白なます: だいこん（白）と にんじん（だいだい）の せん切り
        c.strokeStyle = '#ec8a4c'; c.lineWidth = Math.max(1.2, s * 0.045);
        for (var n = 0; n < 4; n++) { c.beginPath(); c.moveTo(x + s * (0.12 + n * 0.22), y + s * 0.2); c.lineTo(x + s * (0.26 + n * 0.2), y + s * 0.82); c.stroke(); }
        break;
      case 'napo':   // たたきごぼう: ごま
        c.strokeStyle = 'rgba(60,30,10,.5)'; c.beginPath(); c.moveTo(x + s * 0.15, y + s * 0.5); c.lineTo(x + s * 0.85, y + s * 0.5); c.stroke();
        c.fillStyle = '#f4ead2'; [[0.3, 0.3], [0.62, 0.34], [0.46, 0.7], [0.75, 0.68], [0.22, 0.66]].forEach(function (m) { c.beginPath(); c.ellipse(x + s * m[0], y + s * m[1], s * 0.04, s * 0.022, 0.6, 0, 7); c.fill(); });
        break;
      case 'hamburg':   // 鯛: うろこ
        c.strokeStyle = 'rgba(255,230,230,.7)';
        for (var e2 = 0; e2 < 2; e2++) for (var f2 = 0; f2 < 2; f2++) { c.beginPath(); c.arc(x + s * (0.3 + f2 * 0.4), y + s * (0.32 + e2 * 0.36), s * 0.15, 0.2, Math.PI - 0.2); c.stroke(); }
        break;
      case 'shake':   // お煮しめ: れんこんと ねじり梅のにんじん
        if (i % 2 === 0) {
          c.fillStyle = '#efe0c0'; dot(c, x + s * 0.5, y + s * 0.5, s * 0.3);
          c.fillStyle = '#c99a62'; [[0, -0.15], [0.14, -0.05], [0.09, 0.12], [-0.09, 0.12], [-0.14, -0.05]].forEach(function (m) { dot(c, x + s * (0.5 + m[0]), y + s * (0.5 + m[1]), s * 0.05); });
        } else {
          c.fillStyle = '#ee7a32';
          for (var pt = 0; pt < 5; pt++) { var aa = pt * 1.2566 - 1.57; dot(c, x + s * 0.5 + Math.cos(aa) * s * 0.15, y + s * 0.5 + Math.sin(aa) * s * 0.15, s * 0.13); }
          c.fillStyle = '#f7a35c'; dot(c, x + s * 0.5, y + s * 0.5, s * 0.08);
        }
        break;
    }
  }

  // かお
  function face(c, x, y, s, mood, k, t) {
    var dark = k === 'onigiri' ? '#3a3a3a' : '#3b2216';
    if (DR.skin === 'osechi' && OSECHI[k] && OSECHI[k].lightFace) dark = '#fff1d6';
    var cx = x + s * 0.5, cy = y + s * (k === 'onigiri' ? 0.36 : 0.5), ex = s * 0.16, er = Math.max(1.6, s * 0.065);
    // まばたき（ときどき）
    var blink = mood === 'smile' && ((t * 1000 + x * 13 + y * 7) % 4200) < 110;
    c.fillStyle = dark; c.strokeStyle = dark; c.lineWidth = Math.max(1.4, s * 0.05); c.lineCap = 'round';
    if (mood === 'happy' || blink || mood === 'sleep') {
      c.beginPath(); c.arc(cx - ex, cy - s * 0.02, er * 1.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(cx + ex, cy - s * 0.02, er * 1.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (mood === 'cold') {
      c.beginPath(); c.moveTo(cx - ex - er, cy - er); c.lineTo(cx - ex + er, cy + er * 0.2); c.moveTo(cx + ex + er, cy - er); c.lineTo(cx + ex - er, cy + er * 0.2); c.stroke();
    } else {
      var big = mood === 'wow' ? 1.25 : 1;
      dot(c, cx - ex, cy - s * 0.04, er * big); dot(c, cx + ex, cy - s * 0.04, er * big);
      c.fillStyle = '#fff'; dot(c, cx - ex + er * 0.35, cy - s * 0.04 - er * 0.35, er * 0.4); dot(c, cx + ex + er * 0.35, cy - s * 0.04 - er * 0.35, er * 0.4);
      c.fillStyle = dark;
    }
    // くち
    c.beginPath();
    if (mood === 'wow') { c.ellipse(cx, cy + s * 0.14, s * 0.06, s * 0.075, 0, 0, 7); c.fill(); }
    else if (mood === 'sad' || mood === 'cold') { c.arc(cx, cy + s * 0.2, s * 0.08, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else if (mood === 'happy') { c.arc(cx, cy + s * 0.07, s * 0.1, 0.15, Math.PI - 0.15); c.fill(); }
    else { c.arc(cx, cy + s * 0.06, s * 0.08, 0.3, Math.PI - 0.3); c.stroke(); }
    // ほっぺ
    c.fillStyle = 'rgba(255,110,110,.38)';
    dot(c, cx - ex * 1.9, cy + s * 0.08, s * 0.07); dot(c, cx + ex * 1.9, cy + s * 0.08, s * 0.07);
  }

  // ごはん（最初から入っている）。となりのごはんとつなげる
  function rice(c, cells, ox, oy, s) {
    c.fillStyle = '#e9e1cf'; blobPath(c, cells, ox, oy, s); c.fill();
    c.fillStyle = '#fffdf6'; blobPath(c, cells, ox, oy, s, Math.max(2.5, s * 0.09)); c.fill();
    c.fillStyle = 'rgba(200,190,165,.55)';
    cells.forEach(function (p) {
      var x = ox + p[1] * s, y = oy + p[0] * s;
      [[0.28, 0.3, 0.6], [0.62, 0.26, -0.4], [0.44, 0.58, 0.2], [0.74, 0.66, 0.9], [0.24, 0.74, -0.8]].forEach(function (q) {
        c.beginPath(); c.ellipse(x + s * q[0], y + s * q[1], s * 0.075, s * 0.04, q[2], 0, 7); c.fill();
      });
    });
  }
  // ごま（ごはんの上の目印。ごはんの目標があるときに少しだけ）
  function balan(c, x, y, s) {
    c.fillStyle = '#e7f3dc'; c.fillRect(x, y, s, s);
    c.fillStyle = '#3f9a45';
    c.beginPath(); c.moveTo(x + s * 0.08, y + s * 0.92);
    var n = 4;
    for (var i = 0; i < n; i++) {
      c.lineTo(x + s * (0.08 + (i + 0.5) * 0.84 / n), y + s * 0.12);
      c.lineTo(x + s * (0.08 + (i + 1) * 0.84 / n), y + s * 0.5);
    }
    c.lineTo(x + s * 0.92, y + s * 0.92); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + s * 0.12, y + s * 0.55, s * 0.76, s * 0.06);
  }

  // お弁当箱（曲げわっぱ）。x,y はなかの左上
  function box(c, x, y, s, N) {
    if (DR.skin === 'osechi') return jubako(c, x, y, s, N);
    var w = s * N, b = Math.max(8, s * 0.26);
    c.save();
    c.fillStyle = 'rgba(90,45,10,.18)'; rr(c, x - b + 3, y - b + 8, w + b * 2, w + b * 2, b * 1.4); c.fill();
    var g = c.createLinearGradient(0, y - b, 0, y + w + b);
    g.addColorStop(0, '#d89a5c'); g.addColorStop(1, '#b8773c');
    c.fillStyle = g; rr(c, x - b, y - b, w + b * 2, w + b * 2, b * 1.4); c.fill();
    // 木目
    c.strokeStyle = 'rgba(120,60,20,.18)'; c.lineWidth = 1.5;
    for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x - b * 0.6, y - b * 0.55 + i * 3); c.lineTo(x + w + b * 0.6, y - b * 0.55 + i * 3 + 1); c.stroke(); }
    c.fillStyle = '#8f5627'; rr(c, x - 3, y - 3, w + 6, w + 6, s * 0.2); c.fill();
    c.fillStyle = '#fbefdc'; rr(c, x, y, w, w, s * 0.16); c.fill();
    // マスの目印（うすい点線）
    c.strokeStyle = 'rgba(180,120,60,.16)'; c.lineWidth = 1; c.setLineDash([3, 4]);
    for (var k = 1; k < N; k++) {
      c.beginPath(); c.moveTo(x + k * s, y + 4); c.lineTo(x + k * s, y + w - 4); c.moveTo(x + 4, y + k * s); c.lineTo(x + w - 4, y + k * s); c.stroke();
    }
    c.setLineDash([]);
    c.restore();
  }

  // 重箱（お正月）: 黒のうるし・ふちに金・なかは朱
  function jubako(c, x, y, s, N) {
    var w = s * N, b = Math.max(8, s * 0.26);
    c.save();
    c.fillStyle = 'rgba(40,10,10,.25)'; rr(c, x - b + 3, y - b + 8, w + b * 2, w + b * 2, b * 0.7); c.fill();
    var g = c.createLinearGradient(0, y - b, 0, y + w + b);
    g.addColorStop(0, '#3a2626'); g.addColorStop(0.5, '#1c1112'); g.addColorStop(1, '#2a1a1b');
    c.fillStyle = g; rr(c, x - b, y - b, w + b * 2, w + b * 2, b * 0.7); c.fill();
    c.strokeStyle = '#d9b44a'; c.lineWidth = Math.max(1.5, b * 0.14); rr(c, x - b * 0.62, y - b * 0.62, w + b * 1.24, w + b * 1.24, b * 0.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.10)'; rr(c, x - b * 0.8, y - b * 0.85, w + b * 1.6, b * 0.18, b * 0.09); c.fill();
    // すみに金の松葉もよう（小さく）
    c.strokeStyle = 'rgba(230,195,90,.8)'; c.lineWidth = Math.max(1, b * 0.08);
    [[x - b * 0.32, y - b * 0.32], [x + w + b * 0.32, y + w + b * 0.32]].forEach(function (q) {
      for (var a = -2; a <= 2; a++) { c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + Math.cos(a * 0.35 - 0.8) * b * 0.28, q[1] + Math.sin(a * 0.35 - 0.8) * b * 0.28); c.stroke(); }
    });
    c.fillStyle = '#d9b44a'; rr(c, x - 3, y - 3, w + 6, w + 6, s * 0.12); c.fill();
    var gi = c.createLinearGradient(0, y, 0, y + w);
    gi.addColorStop(0, '#a3222b'); gi.addColorStop(1, '#8a1a22');
    c.fillStyle = gi; rr(c, x, y, w, w, s * 0.1); c.fill();
    c.strokeStyle = 'rgba(240,200,110,.30)'; c.lineWidth = 1; c.setLineDash([3, 4]);
    for (var k = 1; k < N; k++) {
      c.beginPath(); c.moveTo(x + k * s, y + 4); c.lineTo(x + k * s, y + w - 4); c.moveTo(x + 4, y + k * s); c.lineTo(x + w - 4, y + k * s); c.stroke();
    }
    c.setLineDash([]);
    c.restore();
  }

  // 小皿・トレイ（丸いお皿）
  function plate(c, x, y, w, h, label, active) {
    c.save();
    c.fillStyle = 'rgba(90,45,10,.12)'; rr(c, x + 2, y + 5, w, h, 22); c.fill();
    c.fillStyle = active ? '#fffaf0' : '#ffffff'; rr(c, x, y, w, h, 22); c.fill();
    c.strokeStyle = active ? '#f2b8a8' : '#ecdcc8'; c.lineWidth = 3; rr(c, x + 5, y + 5, w - 10, h - 10, 18); c.stroke();
    if (label) {
      c.fillStyle = '#8a6a55'; c.font = '800 12px "Hiragino Maru Gothic ProN", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillText(label, x + 12, y + 9);
    }
    c.restore();
  }

  function dims(cells) { var h = 0, w = 0; cells.forEach(function (p) { h = Math.max(h, p[0] + 1); w = Math.max(w, p[1] + 1); }); return [h, w]; }

  // skin: null（ふつう）| 'osechi'（お正月の今日のおべんとう）。絵をかく前に game.js が毎回 決める
  var DR = { rr: rr, blobPath: blobPath, food: food, face: face, rice: rice, balan: balan, box: box, plate: plate, dims: dims, dot: dot,
    skin: null, OSECHI: OSECHI, look: look, nameOf: function (k) { return look(k).name; } };
  root.DR = DR;
})(this);

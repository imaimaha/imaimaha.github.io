/* おかず詰めパズル — おかず・お弁当箱の絵（canvas）。画面の動きは game.js
 * おかずは 1 マスずつではなく「1 つのおかず」としてつながった形にかき、顔をつける（ブロックパズルっぽさを消すため）
 */
(function (root) {
  'use strict';
  var F = root.OB.FOODS;

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
    var f = F[k]; if (!f) return;
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
    cells.forEach(function (p, i) { deco(c, k, ox + p[1] * s, oy + p[0] * s, s, set, p, i); });
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
    var fc = o.faceCell || cells[Math.min(f.face, cells.length - 1)];
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

  // かお
  function face(c, x, y, s, mood, k, t) {
    var dark = k === 'onigiri' ? '#3a3a3a' : '#3b2216';
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

  root.DR = { rr: rr, blobPath: blobPath, food: food, face: face, rice: rice, balan: balan, box: box, plate: plate, dims: dims, dot: dot };
})(this);

/* ひとふでいもむし — ブラウザ版「今日のいもむし」（/play/hitofude/）
 * 盤づくり・ルールはアプリと同じ logic.js（HF）。盤の絵はアプリの game.js からそのまま写したもの。
 * サーバーとは通信しない（ランキングなし）。今日クリアしたかだけ、この端末に保存（web.hitofude.）
 */
(function (root) {
  'use strict';
  var WP = root.WebPlay;
  var $ = function (id) { return document.getElementById(id); };
  var DAY = HF.dayKey();
  WP.init({ ns: 'hitofude', day: DAY, name: '今日のいもむし', tag: '今日のいもむし', emoji: '🦋', url: 'https://imaimaha.github.io/play/hitofude/',
    appId: '6823269398', appLabel: 'アプリなら 200ステージとランキングで勝負', landing: '../../hitofude/', landingName: 'ひとふでいもむし',
    today: function () { return HF.dayKey(); } });

  var COL = { bg: '#eef8e4', ink: '#2f3b22', accent: '#4fae3c', panel: '#d9ecc6', leaf: '#7ccf5b', leaf2: '#68bf48', eaten: '#f4ead2', rock: '#b9b2a6' };
  var PAIR = { w: '#9c5ad6', x: '#21a6a0', y: '#ef8a2a', z: '#e3528e' };
  var BERRY = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#00acc1', '#d81b60'];

  var TILES = [
    { key: 'rock', em: '🪨', short: '石＝通れない', text: '石の上は 通れない' },
    { key: 'free', em: '👆', short: 'どこからでも', text: 'いもむしがいない盤は、さいしょに さわった葉っぱから はじまる' },
    { key: 'goal', em: '🌿', short: '枝＝さいごに行く', text: '枝は さいごに行くところ（ほかを ぜんぶ食べてから）' },
    { key: 'arrow', em: '➡️', short: '矢印の向きへ出る', text: '矢印の葉からは、矢印の向きにしか 出られない（入るのは どこからでも）' },
    { key: 'big', em: '🍀', short: '大きな葉＝2回', text: '大きな葉は 2回通る。出てすぐ もどって入るのは だめ' },
    { key: 'warp', em: '🕳️', short: '同じ色の穴へ', text: '同じ色の穴は つながっている。入ると もう1つの穴から出る（指をはなして、出た穴から つづける）' },
    { key: 'mush', em: '🍄', short: 'キノコの次はまっすぐ', text: 'キノコを食べたら、次の1歩は まっすぐだけ' },
    { key: 'berry', em: '🍒', short: '1→2→3の順', text: '木の実は 1 → 2 → 3 の 番号の順に食べる' }
  ];
  var TILE_OF = {};
  TILE_OF[HF.K.ROCK] = 'rock'; TILE_OF[HF.K.GOAL] = 'goal'; TILE_OF[HF.K.ARROW] = 'arrow'; TILE_OF[HF.K.BIG] = 'big'; TILE_OF[HF.K.WARP] = 'warp'; TILE_OF[HF.K.MUSH] = 'mush'; TILE_OF[HF.K.BERRY] = 'berry';
  var WHY = {
    start: 'いもむしの頭から なぞってね', wall: 'そこは通れないよ', rock: '石の上は 通れないよ', full: 'そこはもう食べたよ',
    arrow: 'この矢印の葉からは、矢印の向きにしか 出られないよ', straight: 'キノコでしびれて、まっすぐしか進めない！', back: '大きな葉へ すぐ引き返すのはだめ。ほかを回ってからね',
    berry: '木の実は 番号の順に食べてね', goal: '枝は さいごに行くところ。ほかの葉っぱを ぜんぶ食べてからね'
  };

  // ---- 音（Web Audio でその場で作る。アプリと同じ）----
  var Snd = (function () {
    var ctx = null;
    function init() {
      if (ctx) { if (ctx.state !== 'running' && ctx.resume) { try { ctx.resume(); } catch (e) { /* */ } } return; }
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; }
    }
    function tone(f, dur, type, vol, delay, f2) {
      if (WP.muted() || !ctx || ctx.state !== 'running') return;
      try {
        var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gn); gn.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* 音が出なくても遊べる */ }
    }
    return {
      init: init,
      munch: function (p) { var f = 392 * Math.pow(2, p * 1.2); tone(f, 0.07, 'triangle', 0.11); tone(f * 1.5, 0.05, 'sine', 0.05, 0.03); },
      back: function () { tone(330, 0.06, 'sine', 0.08, 0, 260); },
      bad: function () { tone(180, 0.14, 'square', 0.05); },
      warp: function () { tone(300, 0.22, 'sine', 0.1, 0, 1200); },
      berry: function () { tone(988, 0.08, 'triangle', 0.1); tone(1319, 0.12, 'triangle', 0.08, 0.06); },
      clear: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.11, i * 0.1); }); },
      flutter: function () { for (var i = 0; i < 6; i++) tone(1400 + i * 120, 0.05, 'sine', 0.035, 0.05 * i); }
    };
  })();
  document.addEventListener('pointerdown', Snd.init, { capture: true });
  document.addEventListener('touchend', Snd.init, { capture: true });

  // ---------------------------------------------------------------------------
  // 盤をかく（アプリの game.js と同じ）
  // ---------------------------------------------------------------------------
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function cxy(b, i, s) { return [(i % b.W + 0.5) * s, (Math.floor(i / b.W) + 0.5) * s]; }

  function drawLeafVein(ctx, x, y, s, a) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (a || 0.5) + ')'; ctx.lineWidth = Math.max(1.2, s * 0.04); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * 0.28, y + s * 0.72); ctx.lineTo(x + s * 0.72, y + s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.45, y + s * 0.55); ctx.lineTo(x + s * 0.42, y + s * 0.37); ctx.moveTo(x + s * 0.55, y + s * 0.45); ctx.lineTo(x + s * 0.66, y + s * 0.5); ctx.stroke();
  }
  function drawArrow(ctx, cx, cy, s, d, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(d * Math.PI / 2);
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.24, -s * 0.04); ctx.lineTo(s * 0.09, -s * 0.04); ctx.lineTo(s * 0.09, s * 0.28);
    ctx.lineTo(-s * 0.09, s * 0.28); ctx.lineTo(-s * 0.09, -s * 0.04); ctx.lineTo(-s * 0.24, -s * 0.04); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawMush(ctx, cx, cy, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff3dc'; rr(ctx, cx - s * 0.09, cy - s * 0.02, s * 0.18, s * 0.27, s * 0.06); ctx.fill();
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.02, s * 0.3, s * 0.22, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; [[-0.14, -0.1, 0.05], [0.06, -0.15, 0.045], [0.16, -0.06, 0.035], [-0.02, -0.05, 0.03]].forEach(function (p) { ctx.beginPath(); ctx.arc(cx + p[0] * s, cy + p[1] * s, p[2] * s, 0, 7); ctx.fill(); });
    ctx.restore();
  }
  function drawBranch(ctx, x, y, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#8d6e4a'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.12;
    ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.3); ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.38, x + s * 0.9, y + s * 0.24); ctx.stroke();
    ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(x + s * 0.55, y + s * 0.35); ctx.lineTo(x + s * 0.7, y + s * 0.6); ctx.stroke();
    ctx.fillStyle = '#7ccf5b'; ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.2, s * 0.12, s * 0.06, -0.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  // お正月の盤（v.ny）: 葉っぱに 松・竹・梅、石は 鏡もち
  function drawShochikubai(ctx, x, y, s, kind) {
    ctx.save(); ctx.lineCap = 'round';
    if (kind === 0) {   // 松: 扇のような松葉 3つ
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1.2, s * 0.035);
      [[0.5, 0.5, 0.2], [0.32, 0.66, 0.15], [0.68, 0.66, 0.15]].forEach(function (f) {
        for (var a = -3; a <= 3; a++) { var an = -Math.PI / 2 + a * 0.32; ctx.beginPath(); ctx.moveTo(x + s * f[0], y + s * f[1]); ctx.lineTo(x + s * f[0] + Math.cos(an) * s * f[2], y + s * f[1] + Math.sin(an) * s * f[2]); ctx.stroke(); }
      });
    } else if (kind === 1) {   // 竹: ふしのある幹と葉
      ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(ctx, x + s * 0.3, y + s * 0.18, s * 0.11, s * 0.66, s * 0.05); ctx.fill();
      ctx.fillStyle = 'rgba(80,140,50,.6)'; ctx.fillRect(x + s * 0.3, y + s * 0.44, s * 0.11, s * 0.03);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.ellipse(x + s * 0.56, y + s * 0.4, s * 0.17, s * 0.05, -0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + s * 0.6, y + s * 0.58, s * 0.16, s * 0.05, 0.25, 0, 7); ctx.fill();
    } else {   // 梅: もも色の花
      var cx = x + s * 0.5, cy = y + s * 0.5;
      ctx.fillStyle = '#ff9fb4';
      for (var q = 0; q < 5; q++) { var an2 = q * 1.2566 - Math.PI / 2; ctx.beginPath(); ctx.arc(cx + Math.cos(an2) * s * 0.13, cy + Math.sin(an2) * s * 0.13, s * 0.12, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0a100'; for (q = 0; q < 5; q++) { var an3 = q * 1.2566 - Math.PI / 2; ctx.beginPath(); ctx.arc(cx + Math.cos(an3) * s * 0.05, cy + Math.sin(an3) * s * 0.05, s * 0.018, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function drawKagami(ctx, x, y, s, p) {
    ctx.fillStyle = '#efe3cc'; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.3); ctx.fill();
    // 三方（台）
    ctx.fillStyle = '#d9b36c'; rr(ctx, x + s * 0.16, y + s * 0.72, s * 0.68, s * 0.14, s * 0.03); ctx.fill();
    ctx.fillStyle = '#b8914c'; ctx.fillRect(x + s * 0.24, y + s * 0.84, s * 0.52, s * 0.05);
    // 紅白の紙
    ctx.fillStyle = '#e53950'; ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.72); ctx.lineTo(x + s * 0.5, y + s * 0.62); ctx.lineTo(x + s * 0.8, y + s * 0.72); ctx.closePath(); ctx.fill();
    // おもち 2だん
    ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = '#d8cdb8'; ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.6, s * 0.3, s * 0.13, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.45, s * 0.22, s * 0.11, 0, 0, 7); ctx.fill(); ctx.stroke();
    // だいだい
    ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.3, s * 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(x + s * 0.58, y + s * 0.2, s * 0.07, s * 0.03, -0.5, 0, 7); ctx.fill();
  }
  // いもむしの はちまき（紅白）
  function drawHachimaki(ctx, hc, hr, s) {
    ctx.save();
    ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, 0, 7); ctx.clip();
    var top = hc[1] - hr * 0.78, h = hr * 0.32;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(hc[0] - hr, top, hr * 2, h);
    ctx.fillStyle = '#e53935';
    for (var q = -4; q <= 4; q++) { ctx.beginPath(); var bx = hc[0] + q * hr * 0.28; ctx.moveTo(bx, top); ctx.lineTo(bx + hr * 0.12, top); ctx.lineTo(bx + hr * 0.26, top + h); ctx.lineTo(bx + hr * 0.14, top + h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // むすび目（右）
    var kx = hc[0] + hr * 0.86, ky = top + h / 2;
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.ellipse(kx + s * 0.06, ky - s * 0.04, s * 0.07, s * 0.035, -0.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(kx + s * 0.07, ky + s * 0.04, s * 0.07, s * 0.035, 0.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c62828'; ctx.lineWidth = Math.max(1, s * 0.015); ctx.stroke();
  }
  // ちょうちょのあとの帯「謹賀新年」
  function drawNewYear(ctx, W, H, s, a) {
    var w = Math.min(W * 0.78, s * 5.2), h = Math.max(30, Math.min(s * 0.95, w * 0.2)), x = (W - w) / 2, y = H * 0.66;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(60,20,10,.18)'; rr(ctx, x + 2, y + 4, w, h, h * 0.3); ctx.fill();
    ctx.fillStyle = '#b3202a'; rr(ctx, x, y, w, h, h * 0.3); ctx.fill();
    ctx.strokeStyle = '#e2b64a'; ctx.lineWidth = Math.max(1.5, h * 0.06); rr(ctx, x + h * 0.12, y + h * 0.12, w - h * 0.24, h - h * 0.24, h * 0.22); ctx.stroke();
    ctx.fillStyle = '#fff6dc'; ctx.font = '700 ' + Math.round(h * 0.52) + 'px "Hiragino Mincho ProN","Hiragino Sans",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('謹 賀 新 年', W / 2, y + h * 0.53);
    ctx.restore();
  }

  function drawCell(v, i) {
    var b = v.b, s = v.cell, ctx = v.ctx, k = b.kind[i], K = HF.K;
    if (k === K.VOID) return;
    var x = (i % b.W) * s, y = Math.floor(i / b.W) * s, p = Math.max(1, s * 0.05), cnt = v.s ? v.s.cnt[i] : 0;
    var c = cxy(b, i, s);
    if (k === K.ROCK && v.ny) { drawKagami(ctx, x, y, s, p); return; }
    if (k === K.ROCK) {
      ctx.fillStyle = COL.rock; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.3); ctx.fill();
      ctx.fillStyle = '#d6d0c6'; rr(ctx, x + p * 2.4, y + p * 2.2, s * 0.42, s * 0.28, s * 0.14); ctx.fill();
      ctx.fillStyle = '#a39b8e'; ctx.beginPath(); ctx.arc(x + s * 0.68, y + s * 0.7, s * 0.06, 0, 7); ctx.fill();
      return;
    }
    var eaten = cnt >= b.need[i];
    // 下地
    if (k === K.GOAL) {
      ctx.fillStyle = eaten ? COL.eaten : '#f1e3c4'; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.22); ctx.fill();
      // 枝は「さいご」の札つき（1.0.11 から。説明を見ていなくても分かるように）。のこりが枝だけになったら光る
      var tag = s >= 26 && !eaten;
      if (tag && v.s && v.s.path.length === b.total - 1) { var gp = 0.5 + 0.5 * Math.sin((v.t || 0) * 5); ctx.strokeStyle = 'rgba(255,190,0,' + (0.55 + 0.45 * gp) + ')'; ctx.lineWidth = s * 0.08; rr(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.2); ctx.stroke(); }
      if (tag) { ctx.save(); ctx.translate(0, -s * 0.08); drawBranch(ctx, x, y, s, 1); ctx.restore(); } else drawBranch(ctx, x, y, s, 1);
      if (tag) {
        ctx.fillStyle = '#8d6e4a'; rr(ctx, x + s * 0.12, y + s * 0.64, s * 0.76, s * 0.25, s * 0.12); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(s * 0.19) + 'px "Hiragino Maru Gothic ProN","Hiragino Sans",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('さいご', x + s * 0.5, y + s * 0.77);
      }
      return;
    }
    if (k === K.WARP) {
      ctx.fillStyle = eaten ? COL.eaten : '#cfe8b8'; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.22); ctx.fill();
      var col = PAIR[b.warpLetter[i]] || '#888';
      ctx.save(); ctx.globalAlpha = eaten ? 0.35 : 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.34, 0, 7); ctx.fill();
      var gr = ctx.createRadialGradient(c[0], c[1], s * 0.02, c[0], c[1], s * 0.27);
      gr.addColorStop(0, '#1d140c'); gr.addColorStop(1, '#5a4632');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.26, 0, 7); ctx.fill();
      if (!eaten) { // うずまき
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath();
        var rot = (v.t || 0) * 2;
        for (var a = 0; a < 9; a += 0.3) { var rad = s * 0.02 + a * s * 0.022; var px = c[0] + Math.cos(a + rot) * rad, py = c[1] + Math.sin(a + rot) * rad; if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (eaten) {
      ctx.fillStyle = COL.eaten; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.22); ctx.fill();
      // かじったあと
      ctx.fillStyle = COL.bg; ctx.beginPath(); ctx.arc(x + s - p * 1.2, y + p * 1.2, s * 0.13, 0, 7); ctx.arc(x + s - p * 1.2 - s * 0.16, y + p * 0.6, s * 0.08, 0, 7); ctx.fill();
      if (k === K.ARROW) drawArrow(ctx, c[0], c[1], s, b.arrow[i], 'rgba(150,120,80,.25)');
      if (k === K.MUSH) drawMush(ctx, c[0], c[1] + s * 0.06, s, 0.22);
      if (k === K.BERRY) { ctx.fillStyle = 'rgba(150,120,80,.25)'; ctx.font = '800 ' + Math.round(s * 0.34) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.berry[i], c[0], c[1]); }
      if (k === K.BIG) { ctx.strokeStyle = 'rgba(150,120,80,.25)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.3, 0, 7); ctx.stroke(); }
      return;
    }
    if (k === K.BIG) {
      ctx.fillStyle = cnt ? '#8fd96b' : '#3f9f3a'; rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.22); ctx.fill();
      ctx.fillStyle = cnt ? '#a8e486' : '#56b84a';
      ctx.beginPath(); ctx.ellipse(c[0], c[1], s * 0.36, s * 0.24, -Math.PI / 4, 0, 7); ctx.fill();
      drawLeafVein(ctx, x, y, s, 0.6);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * 0.76, y + s * 0.76, s * 0.17, 0, 7); ctx.fill();
      ctx.fillStyle = '#2f7d2a'; ctx.font = '800 ' + Math.round(s * 0.24) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(2 - cnt), x + s * 0.76, y + s * 0.775);
      return;
    }
    ctx.fillStyle = ((i % b.W) + Math.floor(i / b.W)) % 2 ? COL.leaf : COL.leaf2;
    rr(ctx, x + p, y + p, s - 2 * p, s - 2 * p, s * 0.22); ctx.fill();
    if (k === K.LEAF) { if (v.ny) drawShochikubai(ctx, x, y, s, ((i % b.W) + Math.floor(i / b.W) * 2) % 3); else drawLeafVein(ctx, x, y, s); }
    if (k === K.ARROW) drawArrow(ctx, c[0], c[1], s, b.arrow[i], '#fff');
    if (k === K.MUSH) drawMush(ctx, c[0], c[1] + s * 0.06, s, 1);
    if (k === K.BERRY) {
      var n = b.berry[i], next = v.s && v.s.next === n;
      if (next) { var pu = 0.5 + 0.5 * Math.sin((v.t || 0) * 6); ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.35 * pu) + ')'; ctx.beginPath(); ctx.arc(c[0], c[1], s * (0.36 + 0.04 * pu), 0, 7); ctx.fill(); }
      ctx.fillStyle = BERRY[(n - 1) % BERRY.length]; ctx.beginPath(); ctx.arc(c[0], c[1] + s * 0.03, s * 0.27, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(c[0] - s * 0.09, c[1] - s * 0.07, s * 0.07, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4e7d2f'; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c[0], c[1] - s * 0.22); ctx.lineTo(c[0] + s * 0.07, c[1] - s * 0.34); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(s * 0.3) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), c[0], c[1] + s * 0.05);
    }
  }

  // いもむし
  function drawWorm(v, upto) {
    var b = v.b, s = v.cell, ctx = v.ctx, st = v.s, path = st.path, n = path.length;
    if (!n) return;
    var from = upto || 0;
    var grow = 0.19 + 0.09 * Math.min(1, n / Math.max(1, b.total));
    var rb = s * grow;
    // からだ（ワープのところで切る）
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var runs = [], cur = [];
    for (var k = from; k < n; k++) { if (st.jump[k] && cur.length) { runs.push(cur); cur = []; } cur.push(path[k]); }
    if (cur.length) runs.push(cur);
    runs.forEach(function (run) {
      if (run.length < 2) return;
      ctx.strokeStyle = '#4f9e3a'; ctx.lineWidth = rb * 2.3; ctx.beginPath();
      run.forEach(function (j, q) { var c = cxy(b, j, s); if (q) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }); ctx.stroke();
      ctx.strokeStyle = '#8fd96b'; ctx.lineWidth = rb * 1.75; ctx.stroke();
    });
    for (k = from; k < n - 1; k++) {
      var c = cxy(b, path[k], s);
      ctx.fillStyle = k % 2 ? '#6cc04c' : '#a6e57f'; ctx.beginPath(); ctx.arc(c[0], c[1], rb * 0.95, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(c[0] - rb * 0.3, c[1] - rb * 0.3, rb * 0.28, 0, 7); ctx.fill();
    }
    // あたま
    var h = path[n - 1], hc = cxy(b, h, s), prev = n >= 2 && !st.jump[n - 1] ? path[n - 2] : -1;
    var dx = 0, dy = 1;
    if (prev >= 0) { var pc = cxy(b, prev, s); dx = (hc[0] - pc[0]) / s; dy = (hc[1] - pc[1]) / s; }
    var bounce = v.pop ? 1 + 0.18 * Math.max(0, 1 - ((v.now || 0) - v.pop) / 0.18) : 1;
    var hr = s * 0.33 * bounce;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d9822b'; ctx.lineWidth = s * 0.04; ctx.stroke();
    // しょっかく
    ctx.beginPath(); ctx.moveTo(hc[0] - s * 0.12, hc[1] - s * 0.27); ctx.lineTo(hc[0] - s * 0.19, hc[1] - s * 0.43); ctx.moveTo(hc[0] + s * 0.12, hc[1] - s * 0.27); ctx.lineTo(hc[0] + s * 0.19, hc[1] - s * 0.43); ctx.stroke();
    ctx.fillStyle = '#d9822b'; ctx.beginPath(); ctx.arc(hc[0] - s * 0.19, hc[1] - s * 0.43, s * 0.04, 0, 7); ctx.arc(hc[0] + s * 0.19, hc[1] - s * 0.43, s * 0.04, 0, 7); ctx.fill();
    // 目（進む向きを見る）
    var ex = dx * s * 0.04, ey = dy * s * 0.04;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hc[0] - s * 0.11, hc[1] - s * 0.05, s * 0.075, 0, 7); ctx.arc(hc[0] + s * 0.11, hc[1] - s * 0.05, s * 0.075, 0, 7); ctx.fill();
    ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(hc[0] - s * 0.11 + ex, hc[1] - s * 0.05 + ey, s * 0.042, 0, 7); ctx.arc(hc[0] + s * 0.11 + ex, hc[1] - s * 0.05 + ey, s * 0.042, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = s * 0.035; ctx.beginPath();
    if (v.stuck) ctx.arc(hc[0], hc[1] + s * 0.17, s * 0.08, 1.15 * Math.PI, 1.85 * Math.PI);
    else ctx.arc(hc[0], hc[1] + s * 0.06, s * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,120,.45)'; ctx.beginPath(); ctx.arc(hc[0] - s * 0.2, hc[1] + s * 0.07, s * 0.05, 0, 7); ctx.arc(hc[0] + s * 0.2, hc[1] + s * 0.07, s * 0.05, 0, 7); ctx.fill();
    if (v.ny) drawHachimaki(ctx, hc, hr, s);
    if (v.stuck) { ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.moveTo(hc[0] + s * 0.3, hc[1] - s * 0.3); ctx.quadraticCurveTo(hc[0] + s * 0.38, hc[1] - s * 0.16, hc[0] + s * 0.3, hc[1] - s * 0.13); ctx.quadraticCurveTo(hc[0] + s * 0.22, hc[1] - s * 0.16, hc[0] + s * 0.3, hc[1] - s * 0.3); ctx.fill(); }
  }

  function drawButterfly(ctx, x, y, size, flap, wing) {
    var o = Math.abs(Math.cos(flap)) * 0.75 + 0.25;
    ctx.save(); ctx.translate(x, y);
    [-1, 1].forEach(function (side) {
      ctx.save(); ctx.scale(side * o, 1);
      ctx.fillStyle = wing[0]; ctx.beginPath(); ctx.ellipse(size * 0.42, -size * 0.25, size * 0.42, size * 0.34, -0.5, 0, 7); ctx.fill();
      ctx.fillStyle = wing[1]; ctx.beginPath(); ctx.ellipse(size * 0.32, size * 0.24, size * 0.28, size * 0.24, 0.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.arc(size * 0.48, -size * 0.3, size * 0.1, 0, 7); ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = '#3b2a20'; rr(ctx, -size * 0.06, -size * 0.36, size * 0.12, size * 0.74, size * 0.06); ctx.fill();
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = size * 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -size * 0.34); ctx.quadraticCurveTo(-size * 0.12, -size * 0.6, -size * 0.22, -size * 0.62); ctx.moveTo(0, -size * 0.34); ctx.quadraticCurveTo(size * 0.12, -size * 0.6, size * 0.22, -size * 0.62); ctx.stroke();
    ctx.restore();
  }

  // 1回だけ通った大きな葉は、からだの上にも「あと1」を出す（2回目を忘れないように）
  function bigBadges(v) {
    var b = v.b, s = v.cell, ctx = v.ctx;
    var head = HF.head(v.s);
    // 通ったワープの穴: からだが穴にもぐって、もう片方から出てくるように見せる
    for (var w = 0; w < b.n; w++) if (b.kind[w] === HF.K.WARP && v.s.cnt[w] > 0 && w !== head) {
      var c = cxy(b, w, s);
      ctx.fillStyle = PAIR[b.warpLetter[w]] || '#888'; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1d12'; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.22, 0, 7); ctx.fill();
    }
    for (var i = 0; i < b.n; i++) if (b.kind[i] === HF.K.BIG && v.s.cnt[i] === 1) {
      var x = (i % b.W) * s, y = Math.floor(i / b.W) * s;
      ctx.fillStyle = '#2f7d2a'; ctx.beginPath(); ctx.arc(x + s * 0.8, y + s * 0.2, s * 0.17, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.04; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(s * 0.22) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('1', x + s * 0.8, y + s * 0.21);
    }
  }

  // キノコを食べた直後: 次に進める「まっすぐ先」のマスに 小さな矢印（1.0.11 から）
  function straightHint(v) {
    var st = v.s, b = v.b, s = v.cell, n = st.path.length;
    if (n < 2 || HF.done(st) || st.jump[n - 1] || s < 26) return;
    var h = st.path[n - 1], pv = st.path[n - 2];
    if (b.kind[h] !== HF.K.MUSH) return;
    var d = HF.dir(b, pv, h); if (d < 0) return;
    var nx = h + (h - pv);
    if (nx < 0 || nx >= b.n || HF.dir(b, h, nx) !== d || b.need[nx] === 0 || st.cnt[nx] >= b.need[nx]) return;
    var c = cxy(b, nx, s), pu = 0.6 + 0.4 * Math.sin((v.t || 0) * 6);
    drawArrow(v.ctx, c[0], c[1], s * 0.75, d, 'rgba(229,57,53,' + pu + ')');
  }
  function render(v) {
    var ctx = v.ctx, b = v.b, s = v.cell;
    ctx.clearRect(0, 0, b.W * s, b.H * s);
    for (var i = 0; i < b.n; i++) drawCell(v, i);
    // ヒント（次に進むマスを光らせる）
    if (v.hint && v.hint.length) {
      var pu = 0.5 + 0.5 * Math.sin((v.t || 0) * 7);
      v.hint.forEach(function (j, q) {
        var x = (j % b.W) * s, y = Math.floor(j / b.W) * s;
        ctx.strokeStyle = 'rgba(255,196,0,' + (0.6 + 0.4 * pu) + ')'; ctx.lineWidth = s * 0.09; rr(ctx, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.2); ctx.stroke();
        ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(x + s * 0.2, y + s * 0.2, s * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(s * 0.2) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(q + 1), x + s * 0.2, y + s * 0.21);
      });
    }
    // 好きな所からスタート: まだ始めていないとき、スタートできる葉っぱをほんのり光らせる
    if (v.s && !v.s.path.length && v.freePulse) {
      var a = 0.18 + 0.14 * Math.sin((v.t || 0) * 4);
      for (i = 0; i < b.n; i++) if (HF.canStart(v.s, i)) { var x = (i % b.W) * s, y = Math.floor(i / b.W) * s; ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; rr(ctx, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.2); ctx.fill(); }
    }
    // ルールのマスを光らせる（ルールにあわない所へ進もうとしたとき・見本をさわったとき。1.0.11 から）
    if (v.mark && v.now - v.mark.t0 < v.mark.dur) {
      var mp = 0.5 + 0.5 * Math.sin((v.now - v.mark.t0) * 9);
      v.mark.cells.forEach(function (j) { var mx = (j % b.W) * s, my = Math.floor(j / b.W) * s; ctx.strokeStyle = 'rgba(255,152,0,' + (0.55 + 0.45 * mp) + ')'; ctx.lineWidth = Math.max(3, s * 0.1); rr(ctx, mx + s * 0.05, my + s * 0.05, s * 0.9, s * 0.9, s * 0.22); ctx.stroke(); });
    }
    if (v.flash && v.now - v.flash.t0 < 0.45) {
      var f = v.flash.i, fx = (f % b.W) * s, fy = Math.floor(f / b.W) * s;
      ctx.fillStyle = 'rgba(229,72,59,' + (0.55 * (1 - (v.now - v.flash.t0) / 0.45)) + ')'; rr(ctx, fx + 2, fy + 2, s - 4, s - 4, s * 0.22); ctx.fill();
    }
    if (!v.s) return;
    var an = v.anim;
    if (!an) { drawWorm(v, 0); bigBadges(v); straightHint(v); return; }
    // クリアの演出: からだが頭にまるまる → さなぎ → ちょうちょ
    var e = v.now - an.t0, path = v.s.path, hc = cxy(b, path[path.length - 1], s);
    if (e < 0.75) { drawWorm(v, Math.floor(path.length * Math.min(1, e / 0.7))); return; }
    if (e < 1.45) {
      var w = Math.sin((e - 0.75) * 30) * 0.12 * (1 - (e - 0.75) / 0.7);
      ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(w);
      ctx.fillStyle = '#9ccc65'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.24, s * 0.4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7cb342'; ctx.lineWidth = s * 0.03; for (var q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(-s * 0.2, q * s * 0.11); ctx.quadraticCurveTo(0, q * s * 0.11 + s * 0.05, s * 0.2, q * s * 0.11); ctx.stroke(); }
      ctx.fillStyle = '#c5e1a5'; ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.18, s * 0.05, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    var k2 = Math.min(1, (e - 1.45) / 1.3), ease = 1 - Math.pow(1 - k2, 3);
    var W = b.W * s, H = b.H * s;
    var bx = hc[0] + (W / 2 - hc[0]) * ease + Math.sin(e * 3) * s * 0.3 * ease, by = hc[1] + (H * 0.32 - hc[1]) * ease;
    var size = s * (0.5 + 0.9 * ease);
    // きらきら
    for (var p = 0; p < 14; p++) {
      var ang = p * 2.4 + e * 1.5, rad = (0.4 + (p % 4) * 0.25) * s * (1 + ease * 2.2);
      ctx.fillStyle = p % 2 ? 'rgba(255,214,79,' + (1 - k2 * 0.6) + ')' : 'rgba(255,255,255,' + (1 - k2 * 0.5) + ')';
      ctx.beginPath(); ctx.arc(bx + Math.cos(ang) * rad, by + Math.sin(ang) * rad, s * 0.05 * (1 + (p % 3)), 0, 7); ctx.fill();
    }
    drawButterfly(ctx, bx, by, size, e * 14, an.wing);
    if (v.ny && e > 1.7) drawNewYear(ctx, W, H, s, reducedMotion() ? 1 : Math.min(1, (e - 1.7) / 0.5));
  }

  // ---------------------------------------------------------------------------
  // あそぶ
  // ---------------------------------------------------------------------------
  var PZ = HF.daily(DAY);
  // お正月（毎年 12/29〜1/7 日本時間。../oshogatsu.js。見た目だけ・盤はそのまま。アプリの 1.0.12 と同じ）
  function shogatsuOn() { return !!(root.Shogatsu && Shogatsu.active()); }
  function reducedMotion() { return !!(root.Shogatsu && Shogatsu.reduced()); }
  var NY = shogatsuOn();
  function shogatsuDeco() {
    document.body.classList.toggle('shogatsu', NY);
    if (!NY) return;
    Shogatsu.banner(document.querySelector('.wp-app'), document.querySelector('.wp-how'));
    var h = document.querySelector('.wp-head h1'); if (h && h.firstChild && h.firstChild.nodeType === 3) h.firstChild.nodeValue = '🎍 お正月のいもむし';
  }
  var g = null, raf = 0;
  function now() { return (root.performance && performance.now ? performance.now() : Date.now()) / 1000; }

  function begin() {
    var b = HF.parse(PZ.map);
    g = { b: b, s: HF.state(b), undos: 0, done: false, ny: NY, anim: null, flash: null, mark: null, pop: 0, dragging: false, backed: false, last: null };
    if (b.start >= 0) HF.push(g.s, b.start);
    var board = $('board'), old = board.querySelector('canvas'); if (old) old.remove();
    var cv = document.createElement('canvas'); board.insertBefore(cv, $('toast')); g.cv = cv;
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('touchstart', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
    WP.timer.reset();
    paintLegend(); layout(); info();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function layout() {
    if (!g) return;
    var r = $('board').getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
    var size = Math.floor(Math.min((r.width - 20) / g.b.W, (r.height - 12) / g.b.H, 76));
    g.cell = Math.max(20, size);
    var w = g.cell * g.b.W, h = g.cell * g.b.H;
    g.cv.width = Math.round(w * dpr); g.cv.height = Math.round(h * dpr); g.cv.style.width = w + 'px'; g.cv.style.height = h + 'px';
    g.ctx = g.cv.getContext('2d'); g.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  root.addEventListener('resize', layout);
  function frame() {
    raf = 0;
    if (!g) return;
    var t = now();
    render({ ctx: g.ctx, b: g.b, s: g.s, cell: g.cell, t: t, now: t, hint: [], flash: g.flash, mark: g.mark, anim: g.anim, stuck: isStuck(), pop: g.pop, freePulse: g.b.start < 0, ny: g.ny });
    raf = requestAnimationFrame(frame);
  }
  function isStuck() { return g && !g.done && g.s.path.length > 0 && !HF.done(g.s) && HF.moves(g.s).length === 0; }
  function info() {
    if (!g) return;
    var e = $('wp-left'); e.textContent = '';
    var a = document.createElement('span'); a.textContent = '🍃 のこり ' + (g.b.total - g.s.path.length); e.appendChild(a);
    if (isStuck() || !g.s.path.length) { var w = document.createElement('span'); w.className = 'warn'; w.textContent = isStuck() ? '　行きどまり！ もどってね' : '　好きな葉っぱをタッチ'; e.appendChild(w); }
  }

  function tilesIn(b) {
    var has = {};
    if (b.start < 0) has.free = 1;
    b.kind.forEach(function (k) { if (TILE_OF[k]) has[TILE_OF[k]] = 1; });
    return TILES.filter(function (t) { return has[t.key]; });
  }
  function tileOf(key) { for (var q = 0; q < TILES.length; q++) if (TILES[q].key === key) return TILES[q]; return null; }
  function paintLegend() {
    var lg = $('legend'); lg.textContent = '';
    tilesIn(g.b).forEach(function (t) {
      var sp = document.createElement('button'); sp.type = 'button'; sp.textContent = t.em + ' ' + t.short;
      sp.addEventListener('click', function () {
        var cells = [];
        for (var i = 0; i < g.b.n; i++) if (TILE_OF[g.b.kind[i]] === t.key || (t.key === 'free' && !g.s.path.length && HF.canStart(g.s, i))) cells.push(i);
        if (cells.length) mark(cells, 2.2);
        toastMsg(t.em + ' ' + t.text);
      });
      lg.appendChild(sp);
    });
    lg.hidden = !lg.children.length;
  }
  function mark(cells, dur) { if (g) g.mark = { cells: cells, t0: now(), dur: dur || 1.6 }; }
  function flash(i) { if (g) g.flash = { i: i, t0: now() }; }

  var toastTimer = 0;
  function toastMsg(text, o) {
    var t = $('toast'); if (!text) return;
    o = o || {};
    var long = text.length > 18, at = o.at != null && o.at >= 0 && g && g.cv;
    t.className = ''; t.textContent = text;
    t.style.left = ''; t.style.top = '';
    if (long) t.classList.add('long');
    if (at) {
      t.classList.add('at');
      var bw = $('board').clientWidth, cv = g.cv, s = g.cell, col = o.at % g.b.W, row = Math.floor(o.at / g.b.W);
      var cx = cv.offsetLeft + (col + 0.5) * s, top = cv.offsetTop + row * s, w = t.offsetWidth, h = t.offsetHeight;
      var y = top - h - 6;
      if (y < 0) y = top + s + 6;
      t.style.left = Math.round(Math.max(4, Math.min(bw - w - 4, cx - w / 2))) + 'px'; t.style.top = Math.round(y) + 'px';
    }
    t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, long ? 3200 : 1600);
  }
  function hideToast() { clearTimeout(toastTimer); $('toast').classList.remove('on'); }
  function ruleBad(w, i) {
    var s = g.s, h = HF.head(s), at = i, cells = [i], text = WHY[w] || '';
    if (w === 'arrow' || w === 'straight') { at = h; cells = [h]; }
    if (w === 'wall' && g.b.kind[i] === HF.K.ROCK) text = WHY.rock;
    if (w === 'berry') {
      text = '木の実は 番号の順。つぎは ' + s.next + ' だよ';
      for (var q = 0; q < g.b.n; q++) if (g.b.kind[q] === HF.K.BERRY && g.b.berry[q] === s.next) cells.push(q);
    }
    flash(i); mark(cells, 1.8); toastMsg(text, { at: at });
  }
  function cellTip(i) {
    var t = tileOf(TILE_OF[g.b.kind[i]]);
    if (!t) return false;
    mark([i], 1.6); toastMsg(t.em + ' ' + t.text, { at: i });
    return true;
  }

  // ---------- 指の操作（アプリと同じ）----------
  function cellAtXY(cx, cy, strict) {
    var r = g.cv.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    var c = Math.floor(x / g.cell), rw = Math.floor(y / g.cell);
    if (c < 0 || c >= g.b.W || rw < 0 || rw >= g.b.H) return -1;
    var fx = x / g.cell - c, fy = y / g.cell - rw;
    if (strict && (fx < 0.16 || fx > 0.84 || fy < 0.16 || fy > 0.84)) return -2;
    return rw * g.b.W + c;
  }
  function canPlay() { return g && !g.done && !WP.clearOpen(); }
  function down(e) {
    if (!canPlay()) return;
    e.preventDefault();
    try { g.cv.setPointerCapture(e.pointerId); } catch (err) { /* なし */ }
    g.backed = false; g.badShown = -1;
    g.last = [e.clientX, e.clientY];
    hideToast();
    var i = cellAtXY(e.clientX, e.clientY, false); if (i < 0) return;
    pressStart(i);
    var s = g.s, p = s.path;
    if (!p.length) {
      if (HF.canStart(s, i)) { WP.timer.start(); HF.push(s, i); g.dragging = true; ate(i); }
      else { flash(i); mark([i], 1.6); toastMsg(g.b.kind[i] === HF.K.BERRY ? '🍒 木の実は 1 から' : g.b.kind[i] === HF.K.GOAL ? '🌿 ' + WHY.goal : 'そこからは はじめられないよ', { at: i }); }
      return;
    }
    var h = HF.head(s);
    if (i === h) { g.dragging = true; WP.timer.start(); return; }
    var k = p.lastIndexOf(i);
    if (k >= 0) {
      while (p.length - 1 > k) HF.pop(s);
      g.undos++; g.backed = true; g.dragging = true; Snd.back(); info();
      return;
    }
    if (HF.dir(g.b, h, i) >= 0) { g.dragging = true; WP.timer.start(); tryStep(i); return; }
    if (p.length === 1 && g.b.start < 0 && HF.canStart(HF.state(g.b), i)) { HF.pop(s); HF.push(s, i); g.dragging = true; ate(i); return; }
    flash(i);
    if (!cellTip(i)) toastMsg(WHY.start, { at: HF.head(s) });
  }
  function move(e) {
    if (!g || !g.dragging || !canPlay()) return;
    e.preventDefault();
    var pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!pts || !pts.length) pts = [e];
    for (var q = 0; q < pts.length && g && g.dragging; q++) dragTo(pts[q].clientX, pts[q].clientY);
  }
  function dragTo(x, y) {
    var l = g.last || [x, y], dx = x - l[0], dy = y - l[1], dist = Math.sqrt(dx * dx + dy * dy);
    var n = Math.max(1, Math.ceil(dist / (g.cell / 4)));
    for (var k = 1; k <= n && g.dragging; k++) {
      var i = cellAtXY(l[0] + dx * k / n, l[1] + dy * k / n, true);
      if (g.press && i !== g.press.i && i !== -2) pressEnd();
      if (i >= 0) stepTo(i);
    }
    g.last = [x, y];
  }
  function up() { if (g) { g.dragging = false; g.last = null; pressEnd(); } }
  function pressStart(i) {
    pressEnd();
    if (!TILE_OF[g.b.kind[i]]) return;
    var gg = g;
    g.press = { i: i, timer: setTimeout(function () { if (g === gg && g.press && g.press.i === i && canPlay()) { g.press = null; cellTip(i); } }, 550) };
  }
  function pressEnd() { if (g && g.press) { clearTimeout(g.press.timer); g.press = null; } }
  function stepTo(i) {
    var s = g.s, h = HF.head(s);
    if (i === h) return;
    if (i === HF.prevCell(s)) {
      HF.pop(s);
      if (!g.backed) { g.undos++; g.backed = true; }
      Snd.back(); info();
      return;
    }
    if (HF.dir(g.b, h, i) < 0) return;
    tryStep(i);
  }
  function tryStep(i) {
    var s = g.s, w = HF.why(s, i);
    if (w) {
      if (w === 'full' && s.path.indexOf(i) >= 0) return;
      if (g.badShown !== i) { g.badShown = i; ruleBad(w, i); Snd.bad(); }
      return;
    }
    var warp = g.b.kind[i] === HF.K.WARP;
    HF.push(s, i);
    ate(i);
    if (warp && !g.done) { g.dragging = false; Snd.warp(); toastMsg('ワープ！ 出た穴から つづけてね'); }
  }
  function ate(i) {
    var s = g.s;
    g.pop = now();
    if (g.b.kind[i] === HF.K.BERRY) Snd.berry(); else Snd.munch(s.path.length / g.b.total);
    info();
    if (HF.done(s)) finish();
  }
  function resetPath() {
    if (!g || g.done) return;
    var s = g.s, min = g.b.start >= 0 ? 1 : 0;
    if (s.path.length <= min) return;
    while (s.path.length > min) HF.pop(s);
    g.undos++; Snd.back(); info();
  }
  $('bReset').addEventListener('click', resetPath);

  function finish() {
    g.done = true; g.dragging = false;
    var sec = WP.timer.stop(), prev = WP.record();
    WP.saveRecord(sec, { undos: g.undos });
    g.anim = { t0: now(), wing: g.ny ? ['#ff7a8a', '#e2b64a'] : ['#fff176', '#ffb300'] };
    Snd.clear(); setTimeout(Snd.flutter, 1500);
    info();
    var gg = g;
    setTimeout(function () { if (g === gg) result(true, sec, prev); }, root.__wpFast ? 0 : 2700);
  }
  function shareRow(sec) { return WP.tierRow(sec, [45, 90, 150, 240], '🍃', '🤍', '🐛', '🦋'); }
  function result(fresh, sec, prev) {
    var ny = [];
    if (NY) { var p = document.createElement('p'); p.className = 'hf-ny'; p.textContent = '謹賀新年　ことしも よろしくね'; ny.push(p); }
    WP.showClear({ sec: sec, fresh: fresh, head: 'ちょうちょになった！', emoji: '🦋', row: shareRow(sec), again: begin, extra: ny,
      note: prev ? '今日の記録（1回目）: ' + WP.fmt(prev.sec) : null });
  }

  // 自動テスト用（答えは盤からいつでも計算できるので、出してもこまらない）
  root.__webPlay = { puzzle: function () { return { map: PZ.map, sol: PZ.sol, day: DAY }; }, ny: function () { return NY; }, cell: function () { return g && g.cell; }, done: function () { return !!(g && g.done); }, len: function () { return g.s.path.length; }, head: function () { return HF.head(g.s); } };

  shogatsuDeco();
  begin();
  var rec = WP.record();
  if (rec) result(false, rec.sec);
})(window);

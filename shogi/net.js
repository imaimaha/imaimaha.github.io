/* 変則将棋 — オンライン対戦の約束ごと（通信そのものは外から send を渡す。DOM を使わないので jsc でテストできる）
   下剋上デュエル（GekokujoDuel/net.js）と同じ考え方: 送るメッセージに通し番号をつけ、届いた順がばらばらでも並べ直す。重複は捨てる。
   つなぎ直したとき（アプリを開き直したときも）は、手数が多いほうが「ここまでの全部の手」を送って、おたがいをそろえる。

   メッセージ（すべて { v, sid, seq, t, ... }。sid はつなぐたびに変わる送り手の番号）
     hello   { gid, len }                         … つながった・つなぎ直した。いまの対局の番号と手数
     start   { cfg, gid }                         … 部屋を作った側（host）が、ルールと先後を決めて送る
     state   { cfg, gid, moves, clk, end }        … ここまでの全部（つなぎ直したとき・食い違ったとき）
     need    { gid, len }                         … 手が合わないので、全部送ってほしい
     mv      { gid, n, m, clk }                   … n 手目（0から）に m を指した。clk は指した人の残り時間
     resign  { gid }                              … 投了
     flag    { gid }                              … 自分の時間が切れた（時間切れ負け）
     claim   { gid }                              … 相手の時間が切れているはず（相手に確かめてもらう）
     draw    { gid, a: 'offer' | 'yes' | 'no' }   … 引き分けの申し出
     again   { gid }                              … もう一局（host が受けたら、先後を入れかえて start）
     ping / pong { t }                            … 通信の遅れをはかる
   cfg = { menuId, rid, opt, seed, host: host の持つ側（0=先手 / 1=後手）, clock }

   時計 clock = { kind: 'none' | 'kire' | 'byo' | 'fischer', main: 秒, byo: 秒, inc: 秒 }
     kire     … 切れ負け（持ち時間 main 秒）
     byo      … 持ち時間 main 秒、なくなったら1手ごとに byo 秒（main = 0 なら最初から秒読み）
     fischer  … 持ち時間 main 秒、1手指すごとに inc 秒ふえる
   時計は「自分の時計は自分で数える」。相手の手を受け取った瞬間から自分の時計が動く（通信の遅れで自分が損をしない）。
   指したら残り時間を送り、相手はそれで表示をそろえる。時間切れは本人が flag を送る（届かないときは相手が claim で確かめる） */
var ShogiNet = (function () {
  'use strict';
  var PROTOCOL = 1;

  function rid() {
    var a = '', chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var cr = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (cr) { var b = new Uint8Array(12); cr.getRandomValues(b); for (var i = 0; i < 12; i++) a += chars[b[i] % chars.length]; }
    else for (var j = 0; j < 12; j++) a += chars[Math.floor(Math.random() * chars.length)];
    return a;
  }

  // ===================== 時計 =====================
  var Clock = {
    // 最初の状態（ミリ秒）
    init: function (c) {
      var one = function () { return { main: (c && c.main || 0) * 1000, byo: (c && c.byo || 0) * 1000, inByo: !!(c && c.kind === 'byo' && !c.main) }; };
      return [one(), one()];
    },
    // p の時計を ms だけ進めた結果（{ t: 残り, flag: 時間切れか }）。st は書きかえない
    run: function (c, st, ms) {
      var o = { main: st.main, byo: st.byo, inByo: st.inByo, flag: false };
      if (!c || c.kind === 'none') return o;
      if (o.inByo) { if (ms > c.byo * 1000) o.flag = true; o.byo = Math.max(0, c.byo * 1000 - ms); return o; }
      o.main -= ms;
      if (o.main <= 0) {
        if (c.kind === 'byo' && c.byo > 0) {
          var over = -o.main; o.main = 0; o.inByo = true;
          if (over > c.byo * 1000) o.flag = true; o.byo = Math.max(0, c.byo * 1000 - over);
        } else { o.main = 0; o.flag = true; }
      }
      return o;
    },
    // 指し終わったときの時計（考えた時間 ms を引いて、秒読みはもどし、フィッシャーは足す）
    afterMove: function (c, st, ms) {
      var o = Clock.run(c, st, ms);
      if (o.flag || !c || c.kind === 'none') return o;
      if (o.inByo) o.byo = c.byo * 1000;
      if (c.kind === 'fischer') o.main += (c.inc || 0) * 1000;
      return o;
    },
    // 表示用「12:34」「秒読み 25」
    text: function (c, st) {
      if (!c || c.kind === 'none') return '';
      if (st.inByo) return '秒読み ' + Math.ceil(st.byo / 1000);
      var s = Math.max(0, Math.ceil(st.main / 1000)), m = Math.floor(s / 60);
      return m + ':' + ('0' + (s % 60)).slice(-2);
    },
    // 残りが少ないか（10秒以下）
    low: function (c, st) { if (!c || c.kind === 'none') return false; return st.inByo ? st.byo <= Math.min(10000, c.byo * 500) : (st.main <= 10000 && !(c.kind === 'byo' && c.byo)); },
    // 部屋の設定の説明
    label: function (c) {
      if (!c || c.kind === 'none') return '時間なし';
      var mm = function (sec) { return sec % 60 ? (sec / 60).toFixed(1).replace(/\.0$/, '') + '分' : (sec / 60) + '分'; };
      if (c.kind === 'kire') return mm(c.main) + '切れ負け';
      if (c.kind === 'fischer') return 'フィッシャー ' + (c.main / 60) + '分＋' + c.inc + '秒';
      if (!c.main) return '1手' + c.byo + '秒の秒読み';
      return mm(c.main) + '＋秒読み' + c.byo + '秒';
    }
  };

  // ===================== 部屋のやりとり =====================
  // opt: { me: 0（部屋を作った側）| 1, send(msg), on(ev) }
  function create(opt) {
    var me = opt.me, send = opt.send, on = opt.on || function () {};
    var o = { me: me, sid: rid(), cfg: null, gid: null, moves: [], end: null, clk: null, lat: 0, started: false };
    var outSeq = 0, inSid = null, inSeq = 0, waiting = {}, gapTimer = null;

    function out(m) { m.v = PROTOCOL; m.sid = o.sid; m.seq = ++outSeq; send(m); }
    o.out = out;

    // host: ルールを決めて始める（rematch のときは先後を入れかえる）
    o.start = function (cfg) {
      o.cfg = cfg; o.gid = rid(); o.moves = []; o.end = null; o.clk = null; o.started = true;
      out({ t: 'start', cfg: cfg, gid: o.gid });
      on({ t: 'start', cfg: cfg });
    };
    o.hello = function () { out({ t: 'hello', gid: o.gid, len: o.moves.length, end: !!o.end }); out({ t: 'ping', at: Date.now() }); };
    // 自分の手（ゲームの側で合法かを確かめてから呼ぶ）
    o.move = function (m, clk) { o.moves.push(m); o.clk = clk || null; out({ t: 'mv', gid: o.gid, n: o.moves.length - 1, m: m, clk: clk || null }); };
    o.resign = function () { o.end = { t: 'resign', by: o.mySide() }; out({ t: 'resign', gid: o.gid }); };
    o.flag = function () { o.end = { t: 'flag', by: o.mySide() }; out({ t: 'flag', gid: o.gid }); };
    o.claim = function () { out({ t: 'claim', gid: o.gid }); };
    o.draw = function (a) { if (a === 'yes') o.end = { t: 'draw' }; out({ t: 'draw', gid: o.gid, a: a }); };
    o.again = function () { out({ t: 'again', gid: o.gid }); };
    o.sendState = function () { out({ t: 'state', cfg: o.cfg, gid: o.gid, moves: o.moves.slice(), clk: o.clk, end: o.end }); };
    o.mySide = function () { return o.cfg ? (me === 0 ? o.cfg.host : 1 - o.cfg.host) : me; };
    // 前の対局を引きつぐ（アプリを開き直したとき）
    o.restore = function (saved) { o.cfg = saved.cfg; o.gid = saved.gid; o.moves = saved.moves.slice(); o.end = saved.end || null; o.clk = saved.clk || null; o.started = true; };

    o.handle = function (m) {
      if (!m) return;
      if (m.v !== PROTOCOL) { on({ t: 'version', got: m.v }); return; }
      // 相手が（つなぎ直して）新しくなった: 相手がひとりで送っていた分は届いていないので、いま来た番号から数える
      if (m.sid !== inSid) { inSid = m.sid; inSeq = typeof m.seq === 'number' ? m.seq - 1 : 0; waiting = {}; }
      if (typeof m.seq !== 'number') { one(m); return; }
      if (m.seq <= inSeq || waiting[m.seq]) return;
      waiting[m.seq] = m;
      drain();
    };
    function drain() {
      while (waiting[inSeq + 1]) { var nx = waiting[inSeq + 1]; delete waiting[inSeq + 1]; inSeq++; one(nx); }
      // 抜けた番号が1.5秒たっても来ないときは、先へ進んで、局面をそろえ直してもらう
      if (Object.keys(waiting).length && !gapTimer) gapTimer = setTimeout(function () {
        gapTimer = null;
        var ks = Object.keys(waiting).map(Number); if (!ks.length) return;
        inSeq = Math.min.apply(null, ks) - 1; drain(); o.hello();
      }, 1500);
    }
    function one(m) {
      switch (m.t) {
        case 'ping': out({ t: 'pong', at: m.at }); return;
        case 'pong': o.lat = Math.min(1000, Math.max(0, (Date.now() - m.at) / 2)); on({ t: 'latency', ms: o.lat }); return;
        case 'hello':
          if (o.started && o.gid && (m.gid !== o.gid || m.len < o.moves.length || (o.end && !m.end && m.len === o.moves.length))) {
            // 相手のほうが遅れている（か、別の対局を持っている）: 全部送る。host でなくても、自分のほうが進んでいれば送る
            if (m.gid === o.gid || me === 0) o.sendState();
          } else if (o.started && o.gid && m.gid === o.gid && m.len > o.moves.length) out({ t: 'need', gid: o.gid, len: o.moves.length });
          on({ t: 'hello', gid: m.gid, len: m.len });
          return;
        case 'start':
          if (me === 0) return;                         // 決めるのは host だけ
          o.cfg = m.cfg; o.gid = m.gid; o.moves = []; o.end = null; o.clk = null; o.started = true;
          on({ t: 'start', cfg: m.cfg }); return;
        case 'state':
          if (o.started && m.gid === o.gid && m.moves.length < o.moves.length && !m.end) return;   // 自分のほうが進んでいる
          if (o.started && m.gid === o.gid && m.moves.length === o.moves.length && (o.end || !m.end)) return;   // 新しいことがない
          o.cfg = m.cfg; o.gid = m.gid; o.moves = m.moves.slice(); o.end = m.end || null; o.clk = m.clk || null; o.started = true;
          on({ t: 'state', cfg: m.cfg, moves: o.moves, clk: m.clk, end: o.end }); return;
        case 'need':
          if (m.gid === o.gid && o.moves.length > m.len) o.sendState(); return;
      }
      if (m.gid !== o.gid) return;                      // ほかの対局のメッセージ
      switch (m.t) {
        case 'mv':
          if (m.n !== o.moves.length) { if (m.n > o.moves.length) out({ t: 'need', gid: o.gid, len: o.moves.length }); return; }
          on({ t: 'move', m: m.m, n: m.n, clk: m.clk });   // ゲームの側で確かめて accept / reject を呼ぶ
          return;
        case 'resign': o.end = { t: 'resign', by: 1 - o.mySide() }; on({ t: 'resign' }); return;
        case 'flag': o.end = { t: 'flag', by: 1 - o.mySide() }; on({ t: 'flag' }); return;
        case 'claim': on({ t: 'claim' }); return;
        case 'draw': if (m.a === 'yes') o.end = { t: 'draw' }; on({ t: 'draw', a: m.a }); return;
        case 'again': on({ t: 'again' }); return;
      }
    }
    // 相手の手を、ゲームの側で確かめたあとで
    o.accept = function (mv, clk) { o.moves.push(mv); o.clk = clk || o.clk; };
    o.reject = function () { out({ t: 'need', gid: o.gid, len: o.moves.length }); };
    return o;
  }

  // 部屋のコード（まぎらわしい I O 0 1 は使わない）
  function newCode(len) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < (len || 6); i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function normCode(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }

  return { PROTOCOL: PROTOCOL, create: create, Clock: Clock, newCode: newCode, normCode: normCode, rid: rid };
})();
if (typeof window !== 'undefined') window.ShogiNet = ShogiNet;

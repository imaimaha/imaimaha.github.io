# /play/jimidrive/daily.js を、アプリ（~/Developer/apps/JimiDrive/game.js）の今日のドライブの関数から作りなおす（行の範囲はアプリが変わったら確かめる）
import os
src = open(os.path.expanduser('~/Developer/apps/JimiDrive/game.js'), encoding='utf-8').read().split('\n')
def L(a, b): return '\n'.join(src[a-1:b])  # 1-based inclusive
parts = [
 ('CONFIG（そのまま）', 9, 42),
 ('問題の種類・かな（そのまま）', 43, 57),
 ('ユーティリティ（そのまま。画面と保存の関数はのぞく）', 60, 60),
 ('', 63, 66),
 ('', 73, 80),
 ('今日のドライブ（そのまま）', 1165, 1190),
 ('ルート（そのまま）', 1151, 1151),
 ('', 1260, 1291),
 ('制限時間・問題・ナンバー（そのまま）', 1538, 1612),
 ('称号（そのまま）', 1800, 1817),
]
out = ['/* ナンバー暗算ドライブ — ブラウザ版「今日のドライブ」の きまりごと（/play/jimidrive/）',
       ' * アプリの game.js から、今日のドライブの作り方（dailySpec）・ナンバーの出し方（makePlate）・制限時間・点数・称号を そのまま写したもの。',
       ' * 写した関数は1文字もかえていない（だれの端末でも、アプリと同じナンバーが同じ順番で来る）。画面・音・通信はここにはない。',
       ' * solver.js（Make10）と data.js（JimiData）はアプリのファイルをそのまま。',
       ' */',
       'var JDDaily = (function () {',
       "  'use strict';"]
for title, a, b in parts:
    if title: out.append('\n  // ---- ' + title + ' ----')
    out.append(L(a, b))
out.append('''
  // ---- ここからブラウザ版だけ（アプリの startRun / startDaily と同じ順で、今日のドライブの道とナンバーを用意する） ----
  var S = { lastNum: -1, wpIndex: 0, km: 0, correct: 0, score: 0, misses: 0, goal: false };
  var sel = null, R = null;
  // 今日のドライブを1本はじめる（アプリの startDaily → startRun と同じ: 乱数は dailySpec の seed、lastNum は -1、wpIndex は 0）
  function start(day) {
    var sp = dailySpec(day);
    sel = { line: sp.line, from: sp.from, to: sp.to, mode: sp.mode, rule: sp.rule, miss: sp.miss };
    plateRng = mulberry32(sp.seed);
    S = { lastNum: -1, wpIndex: 0, km: 0, correct: 0, score: 0, misses: 0, goal: false };
    R = buildRoute();
    return { spec: sp, sel: sel, R: R, S: S };
  }
  // そのドライブの n 枚のナンバー（日付あわせのテスト用。アプリの __jd.plates(day, n) と同じ形の文字）
  function plates(day, n) {
    var keep = [plateRng, S, sel, R], o = start(day), out = [];
    for (var i = 0; i < n; i++) { S.wpIndex = 0; var pl = makePlate(); out.push(pl.num + pl.q[0] + (pl.rare ? 'R' : '')); }
    plateRng = keep[0]; S = keep[1]; sel = keep[2]; R = keep[3];
    return out.join(' ');
  }
  return {
    CONFIG: CONFIG, MODES: MODES, dayKey: dayKey, dailySpec: dailySpec, start: start, plates: plates,
    makePlate: function () { return makePlate(); }, timeLimit: function (q) { return timeLimit(q); }, truthOf: truthOf, isPrime: isPrime,
    factorText: factorText, primeHint: primeHint, rankTitle: function () { return rankTitle(); }, clamp: clamp
  };
})();''')
open(os.path.expanduser('~/Developer/imaimaha.github.io/play/jimidrive/daily.js'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')

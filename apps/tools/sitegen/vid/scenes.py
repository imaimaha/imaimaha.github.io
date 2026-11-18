SCENES = {}
SCENES['hitofude'] = dict(dir='Hitofude', setup='''
const T = window.__hfT; T.closeOv(); T.startStage(33); await sleep(300); T.closeOv(); T.resume(); await sleep(200);
''', py='''
info = pg.evaluate("""() => { const st = HF_STAGES.stages.find(s => s.id === 33); const cv = [...document.querySelectorAll('canvas')].filter(c => c.getBoundingClientRect().width > 100)[0]; const r = cv.getBoundingClientRect(); return { W: st.map[0].length, H: st.map.length, sol: st.sol, x: r.left, y: r.top, w: r.width, h: r.height }; }""")
cw = info['w'] / info['W']; ch = info['h'] / info['H']
def c(i): return (info['x'] + (i % info['W'] + 0.5) * cw, info['y'] + (i // info['W'] + 0.5) * ch)
m = pg.mouse; sol = info['sol']
x, y = c(sol[0]); m.move(x, y); pg.wait_for_timeout(250); m.down(); pg.wait_for_timeout(200)
for a, b in zip(sol, sol[1:]):
    (x0, y0), (x1, y1) = c(a), c(b)
    for k in range(1, 6):
        t = k / 5; m.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); pg.wait_for_timeout(36)
m.up()
''', tail=3300)
SCENES['suji'] = dict(dir='SujiNoHeya', setup="""
const T = window.__sj; T.unlockAll(); T.stage('a', 60); await sleep(400); return await dismiss(['▶ はじめる', 'はじめる', 'とばす', 'スキップ']);
""", play="""
const T = window.__sj; const n = T.state().sol.length;
for (let k = 1; k <= n; k++) { T.fill(k / n); await sleep(420); }
""", tail=3500)
SCENES['okazu'] = dict(dir='OkazuTsume', poster=0.93, setup='''
await dismiss(['とばす']); const T = window.__bento; T.unlockAll(); T.fakeStars(40); T.stage(10); await sleep(400); return await dismiss(['はじめる']);
''', play='''
const T = window.__bento; const n = (T.G().st.sol || []).length;
for (let k = 0; k < n; k++) {
  await sleep(350);
  await sleep(500); T.solve(1); await sleep(800);
}
''', tail=2600)
SCENES['kakezan'] = dict(dir='KakezanRunner', maxsec=10, bitrate=520000, setup="""
const T = window.__kz; T.unlockAll(); await dismiss(['とばす']); T.stage(30); await sleep(500); return await dismiss(['とばす', 'はじめる', 'スタート']);
""", play="""
const T = window.__kz; const t0 = performance.now();
while (performance.now() - t0 < 11000) { T.autopilot(false); await sleep(80); if (T.state().mode !== 'run') break; }
""", tail=2500)
SCENES['yudetamago'] = dict(dir='YudeTamago', load=2000, setup="""
const r = await dismiss(['とばす', 'スキップ', 'とじる']); const T = window.__yude; T.startGame('normal'); await sleep(800); r.push(...await dismiss(['とばす', 'はじめる', 'スタート', 'とじる'])); return [r, T.frags.length, T.state];
""", play="""
const T = window.__yude; const n = T.frags.length;
for (let i = 0; i < n; i += 4) { try { T.crackFrag(i); } catch (e) {} await sleep(45); }
await sleep(300);
const order = [...Array(n).keys()];
for (let i = 0; i < n; i++) { try { T.detach(order[i]); } catch (e) {} await sleep(Math.max(25, 3800 / n)); }
try { T.checkClear(); } catch (e) {}
""", tail=3500)
SCENES['nattofilm'] = dict(dir='NattoFilm', load=1500, setup="""
await dismiss(['とばす', 'スキップ', 'とじる']); const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes('1パック')); b.click(); await sleep(1200); return await dismiss(['とばす', 'はじめる', 'とじる']);
""", py='''
m = pg.mouse
m.move(283, 349); m.down()
for i in range(45):
    m.move(283 - 2.5 * i, 349 - 5 * i); pg.wait_for_timeout(28)
pg.wait_for_timeout(400)
cx, cy = 175, 140
for k in range(260):
    a = k * 0.21
    m.move(cx + 55 * math.cos(a), cy + 40 * math.sin(a)); pg.wait_for_timeout(22)
    if k % 20 == 0 and pg.evaluate("window.__natto.game.phase") != 'play': break
m.up()
''', tail=3500)
SCENES['madoshizuku'] = dict(dir='MadoShizuku', load=1500, maxsec=11, bitrate=600000, setup="""
await dismiss(['とばす', 'スキップ', 'とじる']); clickText(['🌧ざあざあ']); await sleep(300); clickText(['のんびりモード']); await sleep(2500); return await dismiss(['とばす', 'はじめる', 'とじる']);
""", py='''
m = pg.mouse
pts = []
for k in range(5):
    y0 = 220 + k * 90
    pts += [(60, y0), (330, y0 + 40)] if k % 2 == 0 else [(330, y0), (60, y0 + 40)]
m.move(*pts[0]); m.down()
for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
    for i in range(1, 31):
        t = i / 30; m.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); pg.wait_for_timeout(28)
for i in range(60):
    m.move(195 + 8 * math.sin(i / 5), 650 + i * 0.5); pg.wait_for_timeout(30)
m.up()
''', tail=2500)
SCENES['jimidrive'] = dict(dir='JimiDrive', load=1500, skip=40, pysetup='''
for i in range(3):
    if pg.locator('#g-sub').is_visible(): pg.locator('#g-sub').tap(); pg.wait_for_timeout(400)
''', maxsec=10, bitrate=650000, setup="""
const g = window.__jd.guide(); for (const k in g) if (typeof g[k] === 'number' || g[k] === 0) g[k] = 1; g.tut = 1; window.__jd.toTitle(); await sleep(300); window.__jd.run(); await sleep(3000); return Object.keys(g);
""", play="""
const can10 = (ds) => { const f = (a) => { if (a.length === 1) return Math.abs(a[0] - 10) < 1e-9; for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) { if (i === j) continue; const r = a.filter((_, k) => k !== i && k !== j), x = a[i], y = a[j]; const c = [x + y, x - y, x * y]; if (y !== 0) c.push(x / y); for (const v of c) if (f(r.concat([v]))) return true; } return false; }; return f(ds); };
const t0 = performance.now(); let last = null;
while (performance.now() - t0 < 12000) {
  const S = window.__jd.state().S;
  if (S.phase === 'question' && S.plate && S.plate !== last) { last = S.plate; await sleep(650);
    const ok = S.plate.q === 'make10' ? can10(S.plate.digits) : true;
    const key = ok ? 'f' : 'j';
    document.dispatchEvent(new KeyboardEvent('keydown', { key, code: ok ? 'KeyF' : 'KeyJ', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key, code: ok ? 'KeyF' : 'KeyJ', bubbles: true })); }
  await sleep(60);
}
""", tail=800)
SCENES['hensokushogi'] = dict(dir='HensokuShogi', load=1500, maxsec=11, setup="""
const r = await dismiss(['とばす', 'スキップ']); window.__hs.start('trump', 'local', 1, 0); await sleep(800); return r;
""", play="""
for (let k = 0; k < 16; k++) { window.__hs.auto(1, 1, 60); await sleep(650); }
""", tail=600)
SCENES['gekokujo'] = dict(dir='GekokujoDuel', load=1500, maxsec=12, setup="""
const r = await dismiss(['とばす', 'スキップ']); window.__duel.start('cpu'); await sleep(1200); return r;
""", play="""
const D = window.__duel, order = [1, 6, 9, 3, 7, 2, 8, 4, 5]; const t0 = performance.now();
while (performance.now() - t0 < 12000) {
  const A = D.A, h = A.s && A.s.hands && A.s.hands[0];
  if (!A.busy && h && h.length) { const v = order.find(x => h.includes(x)); await sleep(700); D.place(v); await sleep(2200); }
  await sleep(100);
}
""", tail=300)
SCENES['pokerstudy'] = dict(dir='PokerStudy', load=1500, maxsec=12, setup="""
const r = await dismiss(['とばす', 'スキップ']); clickText(['？ランダム出題']); await sleep(1000); return r;
""", play="""
const t0 = performance.now(); let k = 0;
while (performance.now() - t0 < 12000) {
  await sleep(1300);
  const opts = [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && /フォールド|コール|レイズ|オープン|チェック|ベット/.test(b.textContent); });
  if (opts.length) { opts[(k++ * 7) % opts.length].click(); await sleep(2600); }
  clickText(['次へ', 'つぎへ']); await sleep(300);
}
""", tail=300)

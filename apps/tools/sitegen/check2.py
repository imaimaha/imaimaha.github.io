import sys, json
from playwright.sync_api import sync_playwright
OUT = '/tmp/sitegen_shots/'
B = 'http://127.0.0.1:8790'
pages = sys.argv[1:] or ['/', '/apps/']
with sync_playwright() as p:
    b = p.webkit.launch()
    for path in pages:
        tag = 'root' if path == '/' else path.strip('/').replace('/', '_')
        for (w, h) in [(375, 812), (390, 844), (1280, 800)]:
            for rm in (['no-preference', 'reduce'] if w == 390 else ['no-preference']):
                ctx = b.new_context(viewport={'width': w, 'height': h}, reduced_motion=rm)
                pg = ctx.new_page()
                errs, bad, size = [], [], {'n': 0, 'b': 0}
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
                def resp(r):
                    if r.status >= 400: bad.append((r.status, r.url))
                    try:
                        size['b'] += len(r.body()); size['n'] += 1
                    except Exception: pass
                pg.on('response', resp)
                pg.goto(B + path + '?nocache=1', wait_until='load'); pg.wait_for_timeout(1200)
                first = dict(size)
                info = pg.evaluate("""() => {
                  const d=document.documentElement; const over=[];
                  document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.right>d.clientWidth+1 && !e.closest('.rail,.marquee,.glow,.hero')) over.push(e.className||e.tagName)});
                  const lds=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>{try{JSON.parse(s.textContent);return 'ok'}catch(e){return 'BAD'}});
                  const small=[...document.querySelectorAll('a,button')].filter(a=>{const r=a.getBoundingClientRect();return r.width>0&&(r.height<44)&&!a.classList.contains('stretch')&&!a.classList.contains('skip')}).map(a=>a.textContent.trim().slice(0,20));
                  return {sw:d.scrollWidth, cw:d.clientWidth, over:over.slice(0,8), lds, small:small.slice(0,8),
                    anim:getComputedStyle(document.querySelector('.track,.phone')||document.body).animationName,
                    cd:(document.getElementById('cd')||{}).textContent, today:(document.getElementById('today')||{}).textContent,
                    broken:[...document.images].filter(i=>i.complete&&i.loading!=='lazy'&&i.naturalWidth===0).map(i=>i.src)}
                }""")
                pg.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')"); pg.wait_for_timeout(800)
                broken2 = pg.evaluate("[...document.images].filter(i=>i.naturalWidth===0).map(i=>i.src)")
                pg.evaluate("(async()=>{for(let y=0;y<document.body.scrollHeight;y+=300){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}document.querySelectorAll('.rv').forEach(e=>e.classList.add('on'));scrollTo(0,0)})()"); pg.wait_for_timeout(900)
                if rm == 'no-preference':
                    pg.screenshot(path=f'{OUT}v2_{tag}_{w}.png', full_page=True)
                    pg.screenshot(path=f'{OUT}v2_{tag}_{w}_fold.png')
                print(path, w, rm, 'first-load', first, 'all', size, json.dumps(info, ensure_ascii=False), 'errs', errs, 'bad', bad, 'broken', broken2)
                ctx.close()
    b.close()

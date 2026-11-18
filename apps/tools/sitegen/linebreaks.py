# 段落ちを見つける: 折り返した文の「さいごの行が1〜2文字だけ」を、いろいろな幅で探す
# 使い方: python3 -m http.server 8790 をサイトのフォルダで動かしてから ~/Developer/asc-tools/pwvenv/bin/python linebreaks.py [ページ ...]
import sys, json
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8790'
PAGES = sys.argv[1:] or ['/', '/apps/', '/apps/puzzle/', '/apps/relax/', '/apps/versus/', '/apps/life/', '/apps/sitemap/', '/today/', '/ranking/', '/news/',
    '/note/', '/about/', '/now/', '/faq/', '/contact/'] + [f'/{d}/' for d in 'hitofude suji okazu kakezan jimidrive yudetamago nattofilm madoshizuku hensokushogi gekokujo pokerstudy sanpobingo tsundoku osouji notre-app'.split()]
JS = r"""() => {
  const out = [];
  const els = document.querySelectorAll('h1,h2,h3,p,li,dt,dd,summary,a,span.badge,span.tagd,.facts b,label');
  for (const el of els) {
    if (el.closest('.ft') && el.tagName === 'A') continue;
    const r0 = el.getBoundingClientRect(); if (!r0.width || !r0.height) continue;
    if ([...el.children].some(c => /^(P|LI|UL|OL|DIV|H2|H3)$/.test(c.tagName))) continue;
    const lines = []; let lastTop = null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      for (let i = 0; i < n.length; i++) {
        const ch = n.data[i]; if (/\s/.test(ch)) continue;
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const rs = rg.getClientRects(); if (!rs.length) continue;
        const t = Math.round(rs[0].top);
        if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push(''); lastTop = t; }
        lines[lines.length - 1] += ch;
      }
    }
    if (lines.length < 2) continue;
    const last = lines[lines.length - 1].replace(/[。、！？」）…・：\)\]]/g, '');
    if (last.length <= 2) out.push({ tag: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''), lines });
  }
  return out;
}"""
with sync_playwright() as p:
    b = p.webkit.launch()
    tot = 0
    for path in PAGES:
        for w in (375, 390, 430, 768, 1280):
            pg = b.new_page(viewport={'width': w, 'height': 900})
            pg.goto(B + path); pg.wait_for_timeout(1400)
            pg.evaluate("document.querySelectorAll('.rv').forEach(e=>e.classList.add('on')); document.querySelectorAll('details').forEach(d=>d.open=true)")
            res = pg.evaluate(JS)
            for r in res:
                tot += 1
                print(path, w, r['tag'], ' / '.join(r['lines'])[:140])
            pg.close()
    b.close()
    print('TOTAL', tot)

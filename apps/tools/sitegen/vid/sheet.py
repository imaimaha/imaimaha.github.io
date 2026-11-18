import sys, glob, os
from playwright.sync_api import sync_playwright
d = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 40; start = int(sys.argv[3]) if len(sys.argv) > 3 else 1
fs = sorted(glob.glob(f'{d}/fr/*.png'))[start - 1::step][:12]
h = '<body style="margin:0;display:flex;flex-wrap:wrap;width:1200px;font:12px sans-serif">' + ''.join(
    f'<div style="width:200px"><img src="fr/{os.path.basename(f)}" style="width:196px"><br>{os.path.basename(f)}</div>' for f in fs) + '</body>'
open(f'{d}/sheet.html', 'w').write(h)
with sync_playwright() as p:
    b = p.webkit.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 400})
    pg.goto('file://' + os.path.abspath(f'{d}/sheet.html')); pg.wait_for_timeout(600); pg.screenshot(path=f'{d}/sheet.png', full_page=True); b.close()

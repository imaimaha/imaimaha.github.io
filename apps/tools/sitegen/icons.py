# いまのアプリのアイコン（ファビコン・ホーム画面のアイコン）を作る
# 使い方: ~/Developer/asc-tools/pwvenv/bin/python icons.py
import os, struct
R = os.path.expanduser('~/Developer/imaimaha.github.io')

GRAD = ('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/>'
        '<stop offset="1" stop-color="#ff6a43"/></linearGradient></defs>')
def mark(full=False, small=False):
    # full: 角まで塗る（マスカブル・ホーム画面用）。small: 16〜32px 用に線を太く
    bg = '<rect width="64" height="64" fill="url(#g)"/>' if full else '<rect width="64" height="64" rx="18" fill="url(#g)"/>'
    s = 0.78 if full else 1.0                       # マスカブルは中央 80% に収める
    # 2026-11-21 ユーザーが案 E（パズルのマス＋時計）にきめた。白いマス2つ・うすいマス2つ、右下のマスに時計の針
    hw = 3.8 if small else 3.2
    face = (f'<g transform="translate(32 32) scale({s}) translate(-32 -32)">'
            '<rect x="11" y="11" width="19" height="19" rx="5" fill="#fff"/><rect x="34" y="11" width="19" height="19" rx="5" fill="#fff" opacity=".55"/>'
            '<rect x="11" y="34" width="19" height="19" rx="5" fill="#fff" opacity=".55"/><rect x="34" y="34" width="19" height="19" rx="5" fill="#fff"/>'
            f'<path d="M43.5 38.5v5l3.5 2.2" fill="none" stroke="#ff6a43" stroke-width="{hw}" stroke-linecap="round" stroke-linejoin="round"/></g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{GRAD}{bg}{face}</svg>'

def favicon_svg():
    # 暗いタブでも見やすいように、ダークモードでは少し明るい縁をつける
    s = mark(small=True)
    return s.replace('<defs>', '<style>@media (prefers-color-scheme: dark){.ring{stroke:#ffd9a8}}</style><defs>').replace(
        '</svg>', '<rect class="ring" x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="none" stroke-width="2"/></svg>')

def png(pg, svg, size, path, bg='transparent'):
    pg.set_viewport_size({'width': size, 'height': size})
    pg.set_content(f'<html><body style="margin:0;background:{bg}">' + svg.replace('<svg ', f'<svg width="{size}" height="{size}" ') + '</body></html>')
    pg.screenshot(path=path, omit_background=(bg == 'transparent'))
    return open(path, 'rb').read()

def ico(pngs, path):
    # PNG をそのまま入れた ICO（16・32・48）
    head = struct.pack('<HHH', 0, 1, len(pngs)); off = 6 + 16 * len(pngs); ents = b''; data = b''
    for size, b in pngs:
        ents += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(b), off + len(data)); data += b
    open(path, 'wb').write(head + ents + data)

if __name__ == '__main__':
    from playwright.sync_api import sync_playwright
    open(f'{R}/favicon.svg', 'w').write(favicon_svg())
    open(f'{R}/icon.svg', 'w').write(mark(full=True))
    open(f'{R}/apps/logo.svg', 'w').write(mark())   # サイトの上のロゴも案 E（2026-11-21 ユーザー「全部アイコンかえていいよ」）
    with sync_playwright() as p:
        b = p.webkit.launch(); pg = b.new_page()
        tmp = '/tmp/imaapp_icons'; os.makedirs(tmp, exist_ok=True)
        ico([(s, png(pg, mark(small=s <= 32), s, f'{tmp}/f{s}.png')) for s in (16, 32, 48)], f'{R}/favicon.ico')
        png(pg, mark(full=True), 180, f'{R}/apple-touch-icon.png', bg='#ff8a45')          # 角は iOS が丸める
        png(pg, mark(), 192, f'{R}/icon-192.png'); png(pg, mark(), 512, f'{R}/icon-512.png')
        png(pg, mark(), 192, f'{R}/apps/icon-192.png'); png(pg, mark(), 512, f'{R}/apps/icon-512.png')
        png(pg, mark(full=True), 512, f'{R}/apps/icon-maskable-512.png', bg='#ff8a45')
        png(pg, mark(), 180, f'{R}/apps/logo.png')
        b.close()
    print('ok')

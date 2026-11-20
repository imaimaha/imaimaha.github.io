# -*- coding: utf-8 -*-
# あそびかた図鑑（/zukan/）の中身と、小さな絵（SVG）。site2.py の page_zukan() が使う。
# 文はゲームのコード（logic.js / core.js / effects.js のコメントとチュートリアルの文）と App Store の説明から。まだ出していないものは書かない。
# いもむしの絵の盤と道は、/play/hitofude/logic.js の HF.solve で本当に解けるのを確かめたもの（2026-11-19）。
import html

def esc(s): return html.escape(s, quote=True)
def svg(w, h, inner, label):
    return f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}">{inner}</svg>'

# ---------------- ひとふでいもむし ----------------
LEAF, LEAF_D = '#8fd16a', '#5fa83e'
PAIR = {'w': '#9c5ad6', 'x': '#21a6a0', 'y': '#ef8a2a', 'z': '#e3528e'}
BERRY = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#00acc1', '#d81b60']

def hf_inner(m, path, C=34, G=4):
    W = max(len(r) for r in m); H = len(m)
    w = W * C + (W + 1) * G; h = H * C + (H + 1) * G
    def ch(i): r = m[i // W]; return r[i % W] if i % W < len(r) else ' '
    def xy(i): return (G + (i % W) * (C + G) + C / 2, G + (i // W) * (C + G) + C / 2)
    o = [f'<rect width="{w}" height="{h}" rx="9" fill="#eef8e4"/>']
    bg, o = o, []
    for i in range(W * H):
        c = ch(i); x, y = xy(i); x0, y0 = x - C / 2, y - C / 2
        if c == ' ': continue
        if c == '#':
            bg.append(f'<rect x="{x0}" y="{y0}" width="{C}" height="{C}" rx="8" fill="#ddd6ca"/>'
                     f'<path d="M{x - 11} {y + 8}l4 -13l8 -4l9 5l2 12z" fill="#8d857a"/><path d="M{x - 3} {y - 8}l6 1" stroke="#b9b2a6" stroke-width="2"/>')
            continue
        if c == 'G':
            bg.append(f'<rect x="{x0}" y="{y0}" width="{C}" height="{C}" rx="8" fill="#ead9b6"/>')
            o.append(f'<path d="M{x - 12} {y + 7}L{x + 12} {y - 6}M{x + 1} {y + 1}l3 -9" stroke="#7a5230" stroke-width="4" stroke-linecap="round"/>'
                     f'<ellipse cx="{x + 6}" cy="{y - 11}" rx="5" ry="3" fill="#5fa83e"/>')
            continue
        bg.append(f'<rect x="{x0}" y="{y0}" width="{C}" height="{C}" rx="8" fill="{LEAF_D if c == "B" else LEAF}"/>')
        if c == 'B':
            o.append(f'<text x="{x}" y="{y + 6}" font-size="17" text-anchor="middle" fill="#fff" font-weight="800">×2</text>')
        elif c in '^>v<':
            rot = {'^': -90, '>': 0, 'v': 90, '<': 180}[c]
            o.append(f'<path transform="rotate({rot} {x} {y})" d="M{x - 9} {y}h15m-6 -7l7 7l-7 7" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
        elif c in PAIR:
            o.append(f'<circle cx="{x}" cy="{y}" r="11" fill="{PAIR[c]}"/><circle cx="{x}" cy="{y}" r="6.5" fill="#24112f"/>')
        elif c == 'M':
            o.append(f'<path d="M{x - 11} {y + 1}a11 10 0 0 1 22 0z" fill="#e53935"/><circle cx="{x - 4}" cy="{y - 4}" r="2.4" fill="#fff"/><circle cx="{x + 5}" cy="{y - 3}" r="1.8" fill="#fff"/>'
                     f'<rect x="{x - 4}" y="{y + 1}" width="8" height="9" rx="3" fill="#fff3e0"/>')
        elif c.isdigit():
            o.append(f'<circle cx="{x}" cy="{y}" r="11" fill="{BERRY[int(c) - 1]}"/><text x="{x}" y="{y + 5}" font-size="14" text-anchor="middle" fill="#fff" font-weight="800">{c}</text>')
    # 道（ワープで飛んだところで線を切る）
    segs, jumped = [[path[0]]], [False]
    for k in range(1, len(path)):
        a, b = path[k - 1], path[k]
        j = ch(a) in PAIR and ch(b) == ch(a) and not jumped[-1]
        jumped.append(j)
        if j: segs.append([b])
        else: segs[-1].append(b)
    for sg in segs:
        if len(sg) > 1:
            bg.append('<polyline points="' + ' '.join(f'{xy(i)[0]},{xy(i)[1]}' for i in sg) + '" fill="none" stroke="#2e7d32" stroke-opacity=".38" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')
    o = bg + o
    sx, sy = xy(path[0])
    o.append(f'<circle cx="{sx}" cy="{sy}" r="12" fill="#ffd54f" stroke="#e08a00" stroke-width="2"/><circle cx="{sx - 4}" cy="{sy - 2}" r="2.2" fill="#3b2b1f"/><circle cx="{sx + 4}" cy="{sy - 2}" r="2.2" fill="#3b2b1f"/>'
             f'<path d="M{sx - 6} {sy - 11}l-3 -5M{sx + 6} {sy - 11}l3 -5" stroke="#3b2b1f" stroke-width="2" stroke-linecap="round"/>')
    ex, ey = xy(path[-1])
    o.append(f'<circle cx="{ex}" cy="{ey}" r="5" fill="#1b5e20"/>')
    return w, h, ''.join(o)

def hf(m, path, label):
    w, h, inner = hf_inner(m, path)
    return svg(w, h, inner, label)

# ---------------- すうじのへや ----------------
def grid_lines(n_r, n_c, C, x0=4, y0=4, col='#e6dccb'):
    o = []
    for r in range(n_r + 1): o.append(f'<path d="M{x0} {y0 + r * C}h{n_c * C}" stroke="{col}" stroke-width="1.5"/>')
    for c in range(n_c + 1): o.append(f'<path d="M{x0 + c * C} {y0}v{n_r * C}" stroke="{col}" stroke-width="1.5"/>')
    return ''.join(o)

def heya():
    C = 40; rooms = [((0, 0, 1, 3), '3', 1, '#ffe0b2'), ((1, 0, 2, 2), '4', 4, '#c8e6c9'), ((1, 2, 2, 1), '2', 5, '#bbdefb')]
    o = ['<rect width="128" height="128" rx="8" fill="#fff"/>']
    for (r, c, h, w), num, cell, col in rooms:
        o.append(f'<rect x="{4 + c * C + 2}" y="{4 + r * C + 2}" width="{w * C - 4}" height="{h * C - 4}" rx="8" fill="{col}" stroke="#3b2b1f" stroke-width="2"/>')
        rr, cc = divmod(cell, 3)
        o.append(f'<text x="{4 + cc * C + C / 2}" y="{4 + rr * C + C / 2 + 7}" font-size="20" text-anchor="middle" font-weight="700" fill="#3b2b1f">{num}</text>')
    return svg(128, 128, ''.join(o), 'へや割りの例：3×3 の盤を、3・4・2 のへやに分けたところ')

def heya_num():
    C = 34; o = ['<rect width="112" height="78" rx="8" fill="#fff"/>', f'<rect x="5" y="5" width="{3 * C}" height="{2 * C}" rx="8" fill="#c8e6c9" stroke="#3b2b1f" stroke-width="2"/>',
                 grid_lines(2, 3, C, 5, 5, '#9ccc9c')]
    for k in range(6):
        r, c = divmod(k, 3); x = 5 + c * C + C / 2; y = 5 + r * C + C / 2
        if k == 1: o.append(f'<text x="{x}" y="{y + 8}" font-size="22" text-anchor="middle" font-weight="800" fill="#3b2b1f">6</text>')
        else: o.append(f'<circle cx="{x}" cy="{y}" r="3.5" fill="#6b9e6b"/>')
    return svg(112, 78, ''.join(o), '数字の 6 のへやは、マスが6つ')

def person(x, y, col='#5560c8'):
    return f'<circle cx="{x}" cy="{y - 5}" r="5.5" fill="{col}"/><path d="M{x - 9} {y + 10}a9 9 0 0 1 18 0z" fill="{col}"/>'

def jyunin(lines=False):
    C = 28; x0 = y0 = 4
    rooms = [([(0, 0), (0, 1), (1, 0), (1, 1)], '#ffe0b2', '1'), ([(0, 2), (0, 3), (1, 2), (1, 3)], '#bbdefb', '1'), ([(r, c) for r in (2, 3) for c in range(4)], '#c8e6c9', '2')]
    o = [f'<rect width="{4 * C + 8}" height="{4 * C + 8}" rx="8" fill="#fff"/>']
    for cells, col, num in rooms:
        for r, c in cells: o.append(f'<rect x="{x0 + c * C}" y="{y0 + r * C}" width="{C}" height="{C}" fill="{col}"/>')
    o.append(grid_lines(4, 4, C, x0, y0, '#fff'))
    o.append(f'<path d="M{x0} {y0 + 2 * C}h{4 * C}M{x0 + 2 * C} {y0}v{2 * C}" stroke="#3b2b1f" stroke-width="2.5"/><rect x="{x0}" y="{y0}" width="{4 * C}" height="{4 * C}" fill="none" stroke="#3b2b1f" stroke-width="2.5" rx="3"/>')
    for (r, c), n in (((0, 0), '1'), ((0, 2), '1'), ((2, 0), '2')):
        o.append(f'<text x="{x0 + c * C + 5}" y="{y0 + r * C + 11}" font-size="10" font-weight="800" fill="#3b2b1f">{n}</text>')
    if lines:
        o.append(f'<rect x="{x0 + 1}" y="{y0 + C + 1}" width="{4 * C - 2}" height="{C - 2}" rx="5" fill="none" stroke="#e8604c" stroke-width="3"/>'
                 f'<rect x="{x0 + 2 * C + 1}" y="{y0 + 1}" width="{C - 2}" height="{4 * C - 2}" rx="5" fill="none" stroke="#e8604c" stroke-width="3" stroke-dasharray="5 3"/>')
    for r, c in ((0, 1), (1, 3), (2, 0), (3, 2)): o.append(person(x0 + c * C + C / 2 + 2, y0 + r * C + C / 2 + 1))
    w = 4 * C + 8
    if lines: return svg(w, w, ''.join(o), 'よこの列にも、たての列にも、住人は1人ずつ')
    return svg(w, w, ''.join(o), '住人さがしの例：1・1・2 のへやに、列に1人ずつ住人を入れたところ')

def tonari():
    C = 30; x0 = y0 = 4; o = [f'<rect width="{3 * C + 8}" height="{3 * C + 8}" rx="8" fill="#fff"/>', grid_lines(3, 3, C, x0, y0, '#d9cbb3')]
    for r in range(3):
        for c in range(3):
            x = x0 + c * C + C / 2; y = y0 + r * C + C / 2
            if (r, c) == (1, 1): o.append(person(x, y + 1))
            else: o.append(f'<path d="M{x - 6} {y - 6}l12 12m0 -12l-12 12" stroke="#e8604c" stroke-width="3" stroke-linecap="round"/>')
    w = 3 * C + 8
    return svg(w, w, ''.join(o), 'まん中の住人のまわり8マス（ななめも）には住めない')

def hint_svg():
    o = ['<rect x="4" y="8" width="104" height="58" rx="14" fill="#fff" stroke="#d9cbb3" stroke-width="2"/><path d="M24 66l-6 14l18 -14z" fill="#fff" stroke="#d9cbb3" stroke-width="2"/>'
         '<path d="M22 64h16" stroke="#fff" stroke-width="4"/>',
         '<circle cx="30" cy="34" r="12" fill="#ffd54f"/><rect x="25" y="45" width="10" height="7" rx="2" fill="#bba67f"/>',
         '<path d="M50 28h46M50 40h38M50 52h28" stroke="#c9b89c" stroke-width="5" stroke-linecap="round"/>']
    return svg(112, 84, ''.join(o), '理由つきのヒントの吹き出し')

# ---------------- おかず詰めパズル ----------------
FOOD = {'ebi': '#f3a24b', 'tamago': '#f8cf4a', 'karaage': '#cf8a3e', 'brocco': '#4fae55', 'wiener': '#f06a5d', 'ume': '#e0465c', 'edamame': '#8bc95b', 'shake': '#f6987f'}
def box_svg(N, cells, label, C=24, extra='', glow_row=None):
    w = N * C + 12
    o = [f'<rect width="{w}" height="{w}" rx="10" fill="#c8402f"/><rect x="4" y="4" width="{w - 8}" height="{w - 8}" rx="7" fill="#fdf3e1"/>']
    if glow_row is not None: o.append(f'<rect x="5" y="{6 + glow_row * C - 1}" width="{w - 10}" height="{C + 2}" rx="5" fill="#fff59d"/>')
    for (r, c), kind in cells.items():
        x = 6 + c * C; y = 6 + r * C
        if kind == 'rice':
            o.append(f'<rect x="{x + 1}" y="{y + 1}" width="{C - 2}" height="{C - 2}" rx="4" fill="#fff" stroke="#e6dccb"/>'
                     f'<ellipse cx="{x + 8}" cy="{y + 9}" rx="2.5" ry="1.6" fill="#e9e2d2"/><ellipse cx="{x + 15}" cy="{y + 14}" rx="2.5" ry="1.6" fill="#e9e2d2"/>')
        elif kind == 'balan':
            o.append(f'<path d="M{x + 1} {y + C - 2}l4 -{C - 4}l4 {C - 6}l4 -{C - 6}l4 {C - 6}l4 -{C - 6}v{C - 2}z" fill="#3fa34d"/>')
        elif kind == 'ice':
            o.append(f'<rect x="{x + 1}" y="{y + 1}" width="{C - 2}" height="{C - 2}" rx="4" fill="{FOOD["karaage"]}"/><rect x="{x + 1}" y="{y + 1}" width="{C - 2}" height="{C - 2}" rx="4" fill="#bfe8ff" fill-opacity=".75" stroke="#7cc8f0" stroke-width="2"/>'
                     f'<path d="M{x + 6} {y + 7}l5 -2" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>')
        else:
            o.append(f'<rect x="{x + 1}" y="{y + 1}" width="{C - 2}" height="{C - 2}" rx="5" fill="{FOOD[kind]}"/>')
    o.append(extra)
    return svg(w, w, ''.join(o), label)

def piece(shape, col, x, y, C=18, lock=False):
    o = [f'<rect x="{x + c * C + 1}" y="{y + r * C + 1}" width="{C - 2}" height="{C - 2}" rx="4" fill="{col}"/>' for r, c in shape]
    if lock:
        r, c = shape[0]; lx = x + c * C + C / 2; ly = y + r * C + C / 2
        o.append(f'<rect x="{lx - 5}" y="{ly - 2}" width="10" height="8" rx="2" fill="#3b2b1f"/><path d="M{lx - 3} {ly - 2}v-3a3 3 0 0 1 6 0v3" stroke="#3b2b1f" stroke-width="2" fill="none"/>')
    return ''.join(o)

EBI = [(0, 0), (1, 0), (2, 0), (2, 1)]
def ok_line():
    cells = {(2, 0): 'tamago', (2, 1): 'tamago', (2, 2): 'tamago', (2, 3): 'tamago', (0, 0): 'ume', (3, 2): 'brocco', (3, 3): 'brocco', (1, 3): 'brocco'}
    ex = '<text x="54" y="44" font-size="13" font-weight="800" fill="#c8402f" text-anchor="middle">ぱくっ！</text>'
    return box_svg(4, cells, 'よこの列がそろって、ぱくっと消えるところ', extra=ex, glow_row=2)
def ok_move():
    o = ['<rect x="2" y="40" width="64" height="40" rx="20" fill="#fff" stroke="#e6dccb" stroke-width="2"/>', piece(EBI, FOOD['ebi'], 16, 18, 16),
         '<path d="M78 26a16 16 0 1 1 -2 18" stroke="#e8604c" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M71 40l5 6l7 -4" stroke="#e8604c" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
         '<path d="M86 74l0 -12" stroke="#3b2b1f" stroke-width="2"/><circle cx="86" cy="76" r="5" fill="#ffccbc" stroke="#3b2b1f" stroke-width="1.5"/>']
    return svg(112, 86, ''.join(o), 'お皿のおかずを、タップでくるっと回す')
def ok_next():
    o = ['<rect x="2" y="16" width="108" height="50" rx="12" fill="#fff" stroke="#e6dccb" stroke-width="2"/>', piece([(0, 0), (0, 1), (1, 0), (1, 1)], FOOD['karaage'], 10, 24, 16),
         '<path d="M48 41h8m-3 -4l4 4l-4 4" stroke="#bba67f" stroke-width="2.5" fill="none" stroke-linecap="round"/>', piece([(0, 0), (0, 1), (0, 2)], FOOD['wiener'], 62, 34, 13),
         '<text x="56" y="80" font-size="11" text-anchor="middle" fill="#6b5848" font-weight="700">いま → つぎ</text>']
    return svg(112, 86, ''.join(o), 'いまのおかずと、つぎのおかず')
def ok_rice():
    cells = {(0, 1): 'rice', (1, 1): 'rice', (2, 1): 'rice', (1, 2): 'rice', (3, 1): 'ebi', (0, 3): 'ume'}
    return box_svg(4, cells, 'さいしょから入っている白いごはん')
def ok_balan():
    cells = {(1, 1): 'balan', (1, 2): 'balan', (1, 0): 'wiener', (1, 3): 'edamame', (3, 0): 'ume'}
    return box_svg(4, cells, 'みどりのバランのしきり')
def ok_ice():
    cells = {(1, 1): 'ice', (1, 2): 'ice', (2, 1): 'ice', (2, 2): 'ice', (0, 3): 'ume'}
    return box_svg(4, cells, 'こおったからあげ')
def ok_lock():
    o = ['<rect x="2" y="44" width="108" height="38" rx="19" fill="#fff" stroke="#e6dccb" stroke-width="2"/>', piece(EBI, FOOD['ebi'], 38, 14, 18, lock=True)]
    return svg(112, 86, ''.join(o), '🔒のついた、回せないおかず')
def ok_hold():
    o = ['<ellipse cx="56" cy="62" rx="48" ry="17" fill="#fff" stroke="#d9cbb3" stroke-width="2"/><ellipse cx="56" cy="60" rx="34" ry="10" fill="#f6efe2"/>',
         piece([(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)], FOOD['shake'], 29, 22, 18),
         '<text x="56" y="16" font-size="11" text-anchor="middle" fill="#6b5848" font-weight="800">小皿</text>']
    return svg(112, 86, ''.join(o), '小皿にとっておいた、しゃけ')
def ok_fill():
    cells = {(0, 0): 'tamago', (0, 1): 'tamago', (0, 2): 'tamago', (0, 3): 'tamago', (1, 0): 'karaage', (1, 1): 'karaage', (2, 0): 'karaage', (2, 1): 'karaage',
             (1, 2): 'balan', (1, 3): 'wiener', (2, 3): 'wiener', (3, 3): 'wiener', (2, 2): 'edamame', (3, 2): 'edamame', (3, 0): 'ume', (3, 1): 'brocco'}
    return box_svg(4, cells, 'すきまなく つめたお弁当箱')

# ---------------- 変則将棋 ----------------
def koma(x, y, t, s=26, col='#f5d79e', ink='#3b2b1f', rot=0):
    h = s; w = s * .84
    p = f'M{x} {y - h / 2}L{x + w / 2} {y - h / 2 + h * .22}L{x + w / 2 * .92} {y + h / 2}L{x - w / 2 * .92} {y + h / 2}L{x - w / 2} {y - h / 2 + h * .22}z'
    tr = f' transform="rotate({rot} {x} {y})"' if rot else ''
    return (f'<g{tr}><path d="{p}" fill="{col}" stroke="#a87b3d" stroke-width="1.5"/>'
            f'<text x="{x}" y="{y + s * .25}" font-size="{s * .56}" text-anchor="middle" font-weight="800" fill="{ink}">{t}</text></g>')

def ban(R, Cn, C=30):
    w = Cn * C + 8; h = R * C + 8
    return w, h, [f'<rect width="{w}" height="{h}" rx="6" fill="#f0c97a"/>', grid_lines(R, Cn, C, 4, 4, '#b8873e')]

def dot(r, c, C=30, col='#e8604c'): return f'<circle cx="{4 + c * C + C / 2}" cy="{4 + r * C + C / 2}" r="5.5" fill="{col}" fill-opacity=".85"/>'
def at(r, c, C=30): return 4 + c * C + C / 2, 4 + r * C + C / 2

def an(helper_rc, helper_t, dots, label):
    w, h, o = ban(3, 3)
    x, y = at(1, 1); o.append(koma(x, y, '歩'))
    hx, hy = at(*helper_rc); o.append(koma(hx, hy, helper_t, col='#ffe9b8'))
    o.append(f'<path d="M{hx} {hy}L{x} {y}" stroke="#2b7a1a" stroke-width="2" stroke-dasharray="3 3" opacity=".7"/>')
    for rc in dots: o.append(dot(*rc))
    return svg(w, h, ''.join(o), label)

def trump():
    C = 24; w = 5 * C + 8 + 44; h = 2 * C + 8 + 18
    o = [f'<rect x="44" y="18" width="{5 * C + 8}" height="{2 * C + 8}" rx="6" fill="#f0c97a"/>', grid_lines(2, 5, C, 48, 22, '#b8873e'),
         f'<rect x="{48 + 2 * C}" y="22" width="{C}" height="{2 * C}" fill="#fff59d" fill-opacity=".8"/>']
    for k in range(5): o.append(f'<text x="{48 + k * C + C / 2}" y="13" font-size="10" text-anchor="middle" fill="#6b5848" font-weight="700">{5 - k}</text>')
    o.append(koma(48 + 2 * C + C / 2, 22 + C * 1.5, '銀', 21)); o.append(koma(48 + 0 * C + C / 2, 22 + C * 1.5, '金', 21)); o.append(koma(48 + 4 * C + C / 2, 22 + C / 2 + C, '歩', 21))
    o.append('<rect x="3" y="18" width="34" height="48" rx="5" fill="#fff" stroke="#3b2b1f" stroke-width="1.5"/><text x="20" y="49" font-size="22" text-anchor="middle" font-weight="800" fill="#c62828">3</text><text x="10" y="30" font-size="9" fill="#c62828">♥</text>')
    return svg(w, h, ''.join(o), 'カードの 3 のとき、3筋の駒だけ動かせる')

def ote():
    w, h, o = ban(3, 3)
    x, y = at(0, 1); o.append(koma(x, y, '玉', rot=180))
    x2, y2 = at(2, 1); o.append(koma(x2, y2, '飛'))
    o.append(f'<path d="M{x2} {y2 - 14}V{y + 16}" stroke="#e8604c" stroke-width="3" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{at(1, 2)[0]}" y="{at(1, 2)[1] + 5}" font-size="12" text-anchor="middle" font-weight="800" fill="#c62828">王手!</text>')
    return svg(w, h, ''.join(o), '飛車で王手をかけたら、その場で勝ち')

def kage():
    w, h, o = ban(1, 3)
    for c, t in enumerate(('銀', '金', '桂')): o.append(koma(*at(0, c), t))
    x, y = at(0, 1); o.append(f'<circle cx="{x + 11}" cy="{y - 11}" r="8" fill="#3b2b1f"/><text x="{x + 11}" y="{y - 7.5}" font-size="11" text-anchor="middle" fill="#fff" font-weight="800">?</text>')
    return svg(w, h, ''.join(o), 'ひそかに決めた1枚が影武者')

def card(x, y, top, sub='', col='#3b2b1f', w=30, h=42, bg='#fff', fs=16):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{bg}" stroke="#3b2b1f" stroke-width="1.5"/>'
            f'<text x="{x + w / 2}" y="{y + h / 2 + fs * .36}" font-size="{fs}" text-anchor="middle" font-weight="800" fill="{col}">{top}</text>' +
            (f'<text x="{x + 5}" y="{y + 11}" font-size="9" fill="{col}">{sub}</text>' if sub else ''))

def fx_cards():
    o = [f'<g transform="rotate(-12 34 60)">{card(18, 22, "⏩", fs=15)}</g>', card(41, 16, '💣', fs=15), f'<g transform="rotate(12 80 60)">{card(64, 22, "🪞", fs=15)}</g>']
    return svg(112, 76, ''.join(o), '特殊効果のカード（二手指し・地雷・鏡など）')

def shibari():
    w, h, o = ban(3, 3)
    o.append(f'<rect x="4" y="4" width="{3 * 30}" height="30" fill="#e8604c" fill-opacity=".22"/><path d="M4 34h90" stroke="#c62828" stroke-width="2.5" stroke-dasharray="5 4"/>')
    x, y = at(1, 0); o.append(koma(x, y, '銀'))
    o.append(f'<path d="M{x} {y - 13}v-8" stroke="#c62828" stroke-width="2.5"/><path d="M{x - 6} {y - 27}l12 12m0 -12l-12 12" stroke="#c62828" stroke-width="3" stroke-linecap="round"/>')
    return svg(w, h, ''.join(o), '囲いができるまで敵陣に入れない')

# ---------------- ふたり大富豪 ----------------
RED = '#c62828'
def pc(x, y, r, s, w=26, h=36, fs=13):
    col = RED if s in '♥♦' else '#263238'
    return card(x, y, r, s, col, w, h, fs=fs)
def fan(cards, label, w=112, h=70, x0=6, dx=18, y=16):
    return svg(w, h, ''.join(pc(x0 + k * dx, y, r, s) for k, (r, s) in enumerate(cards)), label)
def df_deal():
    o = [pc(2 + k * 15, 20, r, s, 24, 34, 12) for k, (r, s) in enumerate([('A', '♥'), ('5', '♦'), ('K', '♥')])] + [pc(58 + k * 15, 20, r, s, 24, 34, 12) for k, (r, s) in enumerate([('A', '♠'), ('5', '♣'), ('K', '♠')])]
    o.append('<text x="56" y="14" font-size="10" text-anchor="middle" fill="#6b5848" font-weight="700">赤 26枚 ｜ 黒 26枚</text>')
    return svg(112, 64, ''.join(o), '赤（ハート・ダイヤ）と黒（スペード・クラブ）に分けて配る')
def df_order():
    cs = [('3', '♠'), ('4', '♦'), ('K', '♣'), ('A', '♥'), ('2', '♠')]
    o = [pc(2 + k * 22, 18, r, s, 20, 30, 11) for k, (r, s) in enumerate(cs)]
    o.append('<path d="M6 60h96m-6 -4l6 4l-6 4" stroke="#e8604c" stroke-width="2.5" fill="none" stroke-linecap="round"/><text x="56" y="12" font-size="10" text-anchor="middle" fill="#6b5848" font-weight="700">よわい → つよい</text>')
    return svg(112, 66, ''.join(o), '強さは 3 がいちばん弱く、2 がいちばん強い')
def df_same():
    o = [pc(4, 18, '5', '♥'), pc(16, 22, '5', '♦'), '<path d="M50 40h12m-4 -4l4 4l-4 4" stroke="#bba67f" stroke-width="2.5" fill="none"/>', pc(68, 18, '9', '♠'), pc(80, 22, '9', '♣')]
    return svg(112, 64, ''.join(o), '場の 5 の2枚に、9 の2枚を出す')
def df_one(r, s, mark, label, mcol='#e8604c'):
    o = [pc(14, 14, r, s, 32, 44, 18), f'<text x="80" y="46" font-size="26" text-anchor="middle" fill="{mcol}" font-weight="800">{mark}</text>']
    return svg(112, 64, ''.join(o), label)
def df_rev():
    o = [pc(2 + k * 16, 14 + (k % 2) * 3, '6', s, 24, 36, 12) for k, s in enumerate('♥♦♥♦')]
    o.append('<path d="M80 26a14 14 0 1 1 0 20" stroke="#e8604c" stroke-width="3" fill="none"/><path d="M76 42l4 5l6 -3" stroke="#e8604c" stroke-width="3" fill="none"/>')
    return svg(112, 64, ''.join(o), '同じ数字4枚で革命')
def df_ban():
    o = [pc(14, 14, '2', '♠', 32, 44, 18), '<circle cx="80" cy="36" r="15" fill="none" stroke="#c62828" stroke-width="3.5"/><path d="M70 46l20 -20" stroke="#c62828" stroke-width="3.5"/>']
    return svg(112, 64, ''.join(o), 'さいごの1手に出せないカード')

# ---------------- 下剋上デュエル ----------------
def gk(n, x, y, win=None, w=34, h=46):
    bg = '#2b2350' if win is None else ('#2b2350')
    o = card(x, y, str(n), '', '#ffd54f', w, h, bg=bg, fs=22)
    if win: o += f'<text x="{x + w / 2}" y="{y + h + 13}" font-size="11" text-anchor="middle" font-weight="800" fill="#c62828">{win}</text>'
    return o
def gk_vs(a, b, wa, wb, mid='vs', label=''):
    return svg(112, 76, gk(a, 10, 6, wa) + f'<text x="56" y="34" font-size="13" text-anchor="middle" font-weight="800" fill="#6b5848">{mid}</text>' + gk(b, 68, 6, wb), label)
def gk_hide():
    o = [gk(5, 10, 6), '<rect x="68" y="6" width="34" height="46" rx="5" fill="#5a4f8f" stroke="#3b2b1f" stroke-width="1.5"/><text x="85" y="36" font-size="20" text-anchor="middle" fill="#fff" font-weight="800">?</text>']
    return svg(112, 60, ''.join(o), '相手のカードは伏せたまま')
def gk_skill(mark, label):
    return svg(112, 60, card(36, 6, mark, '', '#3b2b1f', 40, 48, bg='#fff3d6', fs=20), label)

# ---------------- 図鑑の中身 ----------------
# (アプリ, 見出し, 説明, [(id, ことば, 文, 絵)])
def sections():
    return [
     ('hitofude', 'ひとふでいもむし', 'いもむしを指でなぞって、葉っぱを1回ずつぜんぶ食べる一筆書きパズル。今日のいもむしには、毎日いくつかのしかけがまざって出ます。', [
       ('hf-leaf', '葉っぱ', 'いもむしの頭から なぞって、葉っぱを1回ずつ ぜんぶ食べたらクリア。なぞった道をもどると、1つずつやり直せる。', hf(['S..', '...'], [0, 1, 2, 5, 4, 3], 'いもむしが葉っぱを1回ずつ食べる道')),
       ('hf-free', 'どこからでもスタート', 'いもむしがいない盤は、さいしょに さわった葉っぱから はじまる。', hf(['...', '...'], [1, 0, 3, 4, 5, 2], 'まん中の葉っぱからはじめた道')),
       ('hf-rock', '石', '灰色の石の上は通れない。石をよけて、葉っぱを ぜんぶ食べよう。', hf(['S#.', '...'], [0, 3, 4, 5, 2], '石をよけて進む道')),
       ('hf-goal', '枝', '枝は さいごに行くところ。ほかの葉っぱを ぜんぶ食べてから、枝で さなぎになる。', hf(['S..', '..G'], [0, 3, 4, 1, 2, 5], 'さいごに枝に着く道')),
       ('hf-arrow', '矢印の葉', '矢印の葉からは、矢印の向きにしか出られない。入るのは どこからでもいい。', hf(['S>.', '...'], [0, 1, 2, 5, 4, 3], '矢印の葉から右へ出る道')),
       ('hf-big', '大きな葉', '2回通って食べきる。出てすぐ もどって入るのは だめ（ほかを回ってから もう一度）。', hf(['.B.', 'S..'], [3, 0, 1, 2, 5, 4, 1], '大きな葉を2回通る道')),
       ('hf-warp', 'ワープの穴', '同じ色の穴は つながっている。穴に入ると、もう1つの穴から出てくる。', hf(['S.w', 'w..'], [0, 1, 2, 3, 4, 5], '右上の穴から左下の穴へワープする道')),
       ('hf-mush', 'しびれキノコ', 'キノコを食べると しびれて曲がれない。次の1歩は、来た向きのまま まっすぐ。', hf(['SM.', '...'], [0, 1, 2, 5, 4, 3], 'キノコのあと、まっすぐ進む道')),
       ('hf-berry', '木の実', '木の実は 1 → 2 → 3 と、番号の小さい順にしか食べられない。', hf(['S.2', '1..'], [0, 3, 4, 1, 2, 5], '木の実を1、2の順に食べる道')),
     ]),
     ('suji', 'すうじのへや', '数字をヒントに盤をへやに分ける「へや割り」と、へやに住人を入れる「住人さがし」。今日の問題は毎日1問ずつ。', [
       ('sj-heya', 'へや割り', '盤を、長方形（正方形も OK）のへやに分ける。指でなぞると へやができる。ぜんぶのマスが へやになったらクリア。', heya()),
       ('sj-num', 'へやの数字', 'どのへやにも、数字がちょうど1つ。数字は、そのへやのマスの数。', heya_num()),
       ('sj-jyunin', '住人さがし', '色でかこまれたところが1つのへや。へやの数字の人数だけ、住人を入れる（0 のへやには住まない）。', jyunin()),
       ('sj-line', '列の人数', 'どの たての列・よこの列にも、住人は同じ人数（今日の問題は1人ずつ）。', jyunin(True)),
       ('sj-tonari', 'となりは だめ', '住人どうしは、たて・よこ・ななめの どれでも となりあわない。', tonari()),
       ('sj-hint', '理由つきヒント', '「この6のへやになれる形は、これだけ！」のように、理由といっしょに教えてくれる。どの問題も答えは1つ。', hint_svg()),
     ]),
     ('okazu', 'おかず詰めパズル', '決まった順番で出てくるおかずを、お弁当箱につめるブロックパズル。', [
       ('ok-line', '列をそろえる', 'たてか よこが1列そろうと「ぱくっ！」と食べて消える。目標を ぜんぶできたら「いただきます！」。', ok_line()),
       ('ok-move', 'はこぶ・まわす', 'お皿のおかずを、ゆびで お弁当箱へ。タップすると くるっと回る。', ok_move()),
       ('ok-next', 'つぎのおかず', 'おかずは決まった順番で出てくる。「つぎ」で 先のおかずまで見える。', ok_next()),
       ('ok-rice', 'ごはん', 'さいしょから入っている白いマス。ごはんのある列をそろえると、ごはんも食べられる。', ok_rice()),
       ('ok-balan', 'バラン', 'みどりのしきり。おかずは置けないけど、列には かぞえる。バランは消えない。', ok_balan()),
       ('ok-ice', 'こおったおかず', 'こおった からあげは、1回目に列が消えると とけるだけ。2回目で食べられる。', ok_ice()),
       ('ok-lock', '回せないおかず', '🔒のついたおかずは、向きが決まっていて回せない。', ok_lock()),
       ('ok-hold', '小皿', 'おかずを1つ、小皿に とっておける。とっておいたおかずは、いつでも つめられる。', ok_hold()),
       ('ok-fill', '今日のおべんとう', '6×6 のお弁当箱に、すきまなく つめる。列は消えない。小皿も使える。', ok_fill()),
     ]),
     ('hensokushogi', '変則将棋対戦', 'いつもの将棋を少しずつ変えた変則将棋。友達とネットで、CPU と、2人で1台で遊べます。', [
       ('sg-annan', '安南将棋', 'すぐうしろに味方の駒がいると、その駒の動きになる。うしろが金なら、歩が金の動きに。', an((2, 1), '金', [(0, 0), (0, 1), (0, 2), (1, 0), (1, 2)], '歩のうしろに金。歩が金の動きになる')),
       ('sg-anpoku', '安北将棋', 'すぐ前に味方の駒がいると、その駒の動きになる。前が角なら、歩が角の動きに。', an((0, 1), '角', [(0, 0), (0, 2), (2, 0), (2, 2)], '歩の前に角。歩が角の動きになる')),
       ('sg-anto', '安東将棋', '右どなりに味方の駒がいると、その駒の動きになる。右が飛車なら、歩が飛車の動きに。', an((1, 2), '飛', [(0, 1), (2, 1), (1, 0)], '歩の右に飛車。歩が飛車の動きになる')),
       ('sg-anzai', '安西将棋', '左どなりに味方の駒がいると、その駒の動きになる。左が銀なら、歩が銀の動きに。', an((1, 0), '銀', [(0, 0), (0, 1), (0, 2), (2, 0), (2, 2)], '歩の左に銀。歩が銀の動きになる')),
       ('sg-trump', 'トランプ将棋', 'めくったカードの数字の「筋」にいる駒しか動かせない（右はしが1筋）。ジョーカーはどの筋でもいい。王手のときは自由に指せる。', trump()),
       ('sg-ote', '王手将棋', '先に王手をかけたほうが、その場で勝ち。詰ませなくていいので、玉のまわりの守りが大事。', ote()),
       ('sg-kage', '影武者将棋', '対局の前に、自分の駒を1枚ひそかに「影武者」に決める。相手の影武者を取ったら勝ち。', kage()),
       ('sg-fx', '特殊効果将棋', '二手指し・地雷・鏡など13種類のカードを、1局に1回ずつ使える（カードは下に）。', fx_cards()),
       ('sg-shibari', '縛り将棋', '「美濃囲いができるまで敵陣に入れない」のような縛りを1〜3つ選んで指す。王手をかけられたときは縛りなし。', shibari()),
     ]),
     ('futaridaifugo', 'ふたり大富豪', 'ジョーカーなしの52枚で、ふたりで遊ぶ大富豪。', [
       ('df-deal', '赤と黒で配る', '52枚を、赤（♥♦）26枚と 黒（♠♣）26枚に分けて、ひとりずつ持つ。どちらも同じ数字が2枚ずつで公平。', df_deal()),
       ('df-order', 'カードの強さ', '3 < 4 < … < K < A < 2。2 がいちばん強い。', df_order()),
       ('df-same', '同じ枚数で、もっと強く', '1枚か、同じ数字の2〜4枚をいっしょに出す。場と同じ枚数で、もっと強い数字を。出せないときはパス。', df_same()),
       ('df-5', '5スキップ', '5 を出すと、相手の番を とばして もう一度 自分の番。', df_one('5', '♣', '⏭', '5 を出すと相手の番をとばす')),
       ('df-7', '7わたし', '7 を出すと、出した枚数だけ 手札から相手にカードを わたす。', df_one('7', '♥', '🎁', '7 を出すと相手にカードをわたす')),
       ('df-8', '8切り', '8 を出すと 場が流れて、もう一度 自分から出せる。', df_one('8', '♠', '✂', '8 を出すと場が流れる')),
       ('df-10', '10すて', '10 を出すと、出した枚数だけ 手札からカードを すてられる。', df_one('10', '♦', '🗑', '10 を出すとカードをすてる')),
       ('df-11', 'イレブンバック', 'J を出すと、場が流れるまで 強さが逆になる。', df_one('J', '♠', '⇅', 'J を出すと強さが逆')),
       ('df-rev', '革命', '同じ数字を4枚いっしょに出すと、強さが逆になる（もう一度 革命で もどる）。', df_rev()),
       ('df-ban', 'あがれないカード', 'さいごの1手には、いちばん強い数字（ふだんは 2）・5・7・8・10・J・革命は出せない。', df_ban()),
     ]),
     ('gekokujo', '下剋上デュエル', '1〜9 の数字カードを1枚ずつ伏せて出す、読み合いのカードゲーム。', [
       ('gk-big', '大きいほうが勝ち', '2人とも 1〜9 のカードを1枚ずつ出す。7 と 4 なら 7 の勝ち。同じ数字なら引き分け。', gk_vs(7, 4, '勝ち', None, 'vs', '7 と 4 なら 7 の勝ち')),
       ('gk-1', '下剋上（1 は 9 に勝つ）', 'いちばん弱い 1 だけは、いちばん強い 9 に勝つ。', gk_vs(1, 9, '勝ち', None, '⚡', '1 が 9 に勝つ')),
       ('gk-hide', '見えない数字', '使ったカードは もどらない。相手の数字は見えず、わかるのは勝ち負けだけ。', gk_hide()),
       ('gk-peek', '透視', '後手のときに使うと、先手の伏せたカードの数字が見える（1ラウンド目は使えない）。', gk_skill('👁', '透視のカード')),
       ('gk-double', '勝負札', '出すときに こっそり使う。そのラウンドは、勝ったほうが2点。', gk_skill('×2', '勝負札のカード')),
       ('gk-guard', 'ガード', '出すときに こっそり使う。負けても引き分けになる。', gk_skill('🛡', 'ガードのカード')),
     ]),
    ]

# 特殊効果将棋のカード（effects.js の desc を短く）
FX = [('⏩', '二手指し', 'この番は2手つづけて指せる（別々の駒で、駒を取る手・王手はだめ）'),
      ('🔒', '封印', '相手は次の2回の番、持ち駒を打てない'),
      ('🪆', '身代わり', '相手の持ち駒の 歩・香 を1枚、自分の持ち駒にする'),
      ('🔁', '入れ替え', '自分の駒2枚（玉以外）の場所を入れ替える'),
      ('⭐', '成り込み', '敵陣にいる自分の駒1枚を、その場で成らせる'),
      ('💣', '地雷', '自分の陣地側の空きマスに地雷。入った相手の駒は自分の持ち駒に'),
      ('🛡', '鉄壁', '相手の次の1手は、王手になる手を指せない'),
      ('👁', '透視', '相手の手札（効果カード）を見る'),
      ('↩️', '一歩後退', '自分の駒1枚を、まっすぐ1マスうしろへ下げる'),
      ('🎌', '援軍', '駒箱から歩を1枚、自分の陣地の空きマスに打つ'),
      ('🪞', '鏡', '自分の駒1枚を、左右反対の筋の同じ段へ'),
      ('🪢', '足止め', '相手の駒1枚をえらぶ。相手は次の番、その駒を動かせない'),
      ('👑', '王の盾', '相手の次の1手は、自分の玉のとなりの駒を取れない')]

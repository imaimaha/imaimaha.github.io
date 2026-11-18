# -*- coding: utf-8 -*-
"""いまのアプリ — サイト全体を作る（トップ・/apps/・/today/・/ranking/・/news/・/note/・/about/・/faq/・/contact/・各アプリの紹介ページ）
使い方（このフォルダで）:
  python3 site2.py          … ぜんぶのページを作りなおす（アプリの紹介ページ・トップ・各ページ・llms.txt）
  ~/Developer/asc-tools/pwvenv/bin/python site2.py --og   … ページごとの OGP 画像も作る
  lookup.json は App Store の公開中の情報（curl "https://itunes.apple.com/lookup?id=...&country=jp" で取りなおす）
  文の中身は content.py（短いタイトル・説明・質問・ルール・いまやっていること）と apps_data.py
  確認: python3 -m http.server でサイトを出して crawl.py（リンク切れ・h1・タイトル長さ・JSON-LD）、check2.py（スクショ）
  プレイ動画: vid/rec.py <アプリ>（vid/enc.swift を swiftc でビルドしてから）
  招待ページ /<app>/join/?c=部屋コード（page_join。対戦アプリの「招待を送る」のリンク。ナビなし・noindex）
  サポートページ /<app>/support/（page_support。App Store の「サポート」とアプリの「お問い合わせ」から来る。ナビなし・noindex）も、ここで一緒に作る
  App Store のアプリがまだないもの（apps_data.py の NAMES の id が None。いまは ふたり大富豪）は、App Store のボタンのかわりに「近日公開」"""
import os, sys, json, html, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = HERE   # gen.py・apps_data.py・orig/・data/ も同じフォルダ
sys.path.insert(0, SITE)
import gen
from apps_data import APPS, NAMES, SHOTS, DAILY, DAILY_LINE, CATS, ADS
from gen import colors, mix

R = os.path.expanduser('~/Developer/imaimaha.github.io')
BASE = 'https://imaimaha.github.io'
NOTE = 'https://note.com/redemarrage22'
NOTE_ON = True   # 2026-11-19 ユーザー「いったん NOTE への遷移はきろう。後で復活させる」→ True にもどせば全部もどる
DEV = 'https://apps.apple.com/jp/developer/id6818812575'
MAIL = 'imaimaha.apps@gmail.com'
BRAND = 'いまのアプリ'
V = '20261122'
gen.CSSV = V

def esc(s): return html.escape(s, quote=True)
def store(i): return f'https://apps.apple.com/jp/app/id{i}'
def ld(obj): return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'

ORG = {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND, "alternateName": "imaimaha のアプリ", "url": BASE + "/",
       "logo": BASE + "/apps/logo.png", "email": MAIL, "sameAs": [DEV] + ([NOTE] if NOTE_ON else []),
       "description": "将棋・ポーカー・アプリ開発が好きな「いま」が、iPhone 向けの小さなアプリをひとりで作っています。"}
CAT_EMO = {'puzzle': '🧩', 'relax': '☕', 'versus': '⚔️', 'life': '📒'}
CAT_SUB = {'puzzle': '毎日の1問で勝負', 'relax': '指でのんびり', 'versus': '友達と読み合い', 'life': '毎日の記録に'}
ALL = [d for _, _, ds in CATS for d in ds]
PLAY = ['hitofude', 'suji', 'okazu', 'jimidrive', 'yudetamago', 'gekokujo']   # ブラウザで遊べるページ（/play/<app>/）。DAILY のアプリは「今日の1問」、ほかは CPU 対戦など
def play_label(d): return '▶ ブラウザで1問あそぶ' if d in DAILY else '▶ ブラウザで遊ぶ'
PLAY_NOTE = {'gekokujo': 'CPU と1試合・登録なし'}   # 今日の問題のないアプリの「ブラウザで遊ぶ」のよこの文
CAT_OF = {d: (cid, lb) for cid, lb, ds in CATS for d in ds}

def logo_svg(uid, size=34):
    from icons import mark
    return mark().replace('<svg xmlns="http://www.w3.org/2000/svg" ', f'<svg width="{size}" height="{size}" aria-hidden="true" ').replace('id="g"', f'id="{uid}"').replace('url(#g)', f'url(#{uid})')

NAV = [('/today/', '今日の問題', '📅'), ('/play/', 'ブラウザで遊ぶ', '🌐'), ('/apps/', 'アプリ一覧', '📱'), ('/ranking/', 'ランキング', '🏆'), ('/news/', 'お知らせ', '📣'),
       ] + ([('/note/', 'note', '📝')] if NOTE_ON else []) + [('/about/', '作っている人', '🙋')]
MENU = [('/', 'ホーム', '🏠')] + NAV + [('/now/', 'いま やっていること', '🛠️'), ('/faq/', 'よくある質問', '💬'), ('/contact/', 'お問い合わせ', '✉️'), ('/apps/sitemap/', 'サイトマップ', '🗺️')]

def header(cur):
    def a(u, t, e=None, with_e=False):
        ac = ' aria-current="page"' if u == cur else ''
        return f'<a href="{u}"{ac}>' + (f'<span aria-hidden="true">{e}</span>' if with_e else '') + f'{t}</a>'
    return ('<a class="skip" href="#main">本文へ</a>'
            f'<header class="hd"><div class="wrap"><a class="logo" href="/" aria-label="{BRAND} ホーム">{logo_svg("lg-h")}<span>いまの<i>アプリ</i></span></a>'
            '<nav class="gnav" aria-label="メインメニュー">' + ''.join(a(u, t) for u, t, e in NAV) + '</nav>'
            '<details class="mnav"><summary aria-label="メニューを開く"><span></span></summary><nav aria-label="メニュー">' +
            ''.join(a(u, t, e, True) for u, t, e in MENU) + '</nav></details></div></header>')

def footer(privacy=None):
    sup = [('/faq/', 'よくある質問'), ('/contact/', 'お問い合わせ')]
    sup += [(privacy, 'このアプリのプライバシーポリシー')] if privacy else []
    sup += [('/contact/#privacy', 'プライバシーポリシー'), ('/apps/sitemap/', 'サイトマップ')]
    cols = [('あそぶ', [('/', 'ホーム'), ('/today/', '今日の問題'), ('/play/', 'ブラウザで遊ぶ'), ('/apps/', 'アプリ一覧'), ('/ranking/', 'ランキングのしくみ'), ('/news/', 'お知らせ・更新情報')]),
            ('いまのこと', [('/about/', '作っている人'), ('/now/', 'いま やっていること')] + ([('/note/', 'note の記事'), (NOTE, 'note（いまのページ）')] if NOTE_ON else []) + [(DEV, 'App Store で全部のアプリを見る')]),
            ('サポート', sup)]
    def li(u, t):
        rel = ' rel="me noopener"' if u == NOTE else ''
        return f'<li><a href="{u}"{rel}>{t}</a></li>'
    body = ''.join(f'<div><h2>{h}</h2><ul>' + ''.join(li(u, t) for u, t in ls) + '</ul></div>' for h, ls in cols)
    return (f'<footer class="ft"><div class="wrap"><div><a class="logo" href="/">{logo_svg("lg-f")}<span>いまの<i>アプリ</i></span></a>'
            '<p class="tag">すきま時間に、ちょっとあそぼ。<br>iPhone 向けの小さなアプリを、ひとりで作っています。</p></div>'
            f'<div class="cols3">{body}</div><small>Apple、App Store、iPhone は Apple Inc. の商標です。</small></div></footer>')

def crumb(items):
    lis = ''.join((f'<li><a href="{u}">{esc(t)}</a></li>' if u else f'<li aria-current="page">{esc(t)}</li>') for u, t in items)
    return f'<nav class="crumb wrap" aria-label="パンくずリスト"><ol>{lis}</ol></nav>'

def crumb_ld(items, last_url):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": k + 1, "name": t, "item": BASE + (u or last_url)} for k, (u, t) in enumerate(items)]}

ICON_LINKS = ('<link rel="icon" href="/favicon.ico" sizes="32x32">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
              '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/apps/site.webmanifest">\n'
              '<meta name="apple-mobile-web-app-title" content="いまのアプリ">\n<meta name="color-scheme" content="light">\n<meta name="format-detection" content="telephone=no">')

def head(path, title, desc, extra_ld=(), og_img=None, preload=None):
    url = BASE + path
    og_img = og_img or f'{BASE}/apps/og.jpg'
    L = ['<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">',
         f'<title>{esc(title)}</title>', f'<meta name="description" content="{esc(desc)}">', f'<link rel="canonical" href="{url}">',
         '<meta name="theme-color" content="#fff7e8">',
         f'<meta property="og:type" content="website">\n<meta property="og:site_name" content="{BRAND}">\n<meta property="og:locale" content="ja_JP">',
         f'<meta property="og:title" content="{esc(title)}">\n<meta property="og:description" content="{esc(desc)}">\n<meta property="og:url" content="{url}">',
         f'<meta property="og:image" content="{og_img}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="{BRAND}のアイコン一覧">',
         f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{esc(title)}">\n<meta name="twitter:description" content="{esc(desc)}">\n<meta name="twitter:image" content="{og_img}">',
         ICON_LINKS]
    if preload: L.append(f'<link rel="preload" as="image" href="{preload}">')
    L.append(f'<link rel="stylesheet" href="/apps/site.css?v={V}">')
    if NOTE_ON: L.append(f'<link rel="me" href="{NOTE}">')
    for o in extra_ld: L.append(ld(o))
    L.append('</head>\n<body>')
    return '\n'.join(L)

def tail(privacy=None):
    return footer(privacy) + f'\n<script src="/apps/site.js?v={V}" defer></script>\n</body>\n</html>\n'

# 段落ち対策: 本文のテキストの中のアプリ名などを、途中で折り返さない <span class="nw"> でかこむ（空白のところでは折り返してよい）
NW_WORDS = None
def nowrap_text(out):
    global NW_WORDS
    if NW_WORDS is None:
        ws = {NAMES[d][0] for d in NAMES} | {'いまのアプリ', 'App Store', 'ニックネーム', 'ランキング', 'ブラウザ', 'iPhone アプリ', 'プライバシーポリシー', 'お問い合わせ'}
        NW_WORDS = sorted(ws, key=len, reverse=True)
    pat = re.compile('|'.join(re.escape(w) for w in NW_WORDS) + r'|[ァ-ヴー一-龥]{1,6}は？|[ぁ-ん]{1,4}ますか？')
    def wrap(m):
        w = m.group(0)
        if w in ('App Store', 'iPhone アプリ', 'Notre Endroit') or w.endswith('？'): return f'<span class="nw">{w}</span>'
        return ' '.join(f'<span class="nw">{x}</span>' for x in w.split(' '))
    i = out.index('<body')
    head, body = out[:i], out[i:]
    parts = re.split(r'(<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)', body, flags=re.S)
    for k in range(0, len(parts), 2):
        if parts[k]: parts[k] = pat.sub(wrap, parts[k])
    return head + ''.join(parts)

def write(path, out):
    out = nowrap_text(out)
    fn = R + path + 'index.html'
    os.makedirs(os.path.dirname(fn), exist_ok=True)
    open(fn, 'w', encoding='utf-8').write(out)

def cv(d):
    acc, soft, deep = colors(APPS[d]['accent'])
    return f'--a:{acc};--p:{mix(APPS[d]["accent"], "#ffffff", 0.8)};--d:{deep}'

def shot_for(d):
    for f, alt in SHOTS[d]:
        if 'daily' in f: return f, alt
    return SHOTS[d][0]

def scr(d, f, alt, lazy=True):
    lz = ' loading="lazy" decoding="async"' if lazy else ''
    return f'<div class="scr"><img src="/{d}/shots/{f}.webp" width="480" height="1043" alt="{esc(alt)}"{lz}></div>'

def daily_card(d):
    name, i, _ = NAMES[d]; k, w = DAILY_LINE[d].split('：', 1); f, alt = shot_for(d)
    return (f'<li class="dcard tilt rv" style="{cv(d)}"><div class="top"><img class="ic" src="/{d}/icon-256.webp" width="52" height="52" alt="" loading="lazy">'
            f'<h3><a class="stretch" href="/{d}/">{esc(name)}</a></h3></div><span class="badge">{esc(k)}</span><p class="what">{esc(w)}</p>'
            f'<div class="frame">' + (f'<video class="vclip" muted loop playsinline preload="none" poster="/{d}/clip.jpg" data-vsrc="/{d}/clip.mp4" data-card width="300" height="650" aria-label="{esc(name)} のプレイのようす"></video>'
                                      if os.path.exists(f'{R}/{d}/clip.mp4') else scr(d, f, alt)) + '</div>'
            '<div class="acts">' + (f'<a class="go sm2" href="/play/{d}/">▶ ブラウザで1問あそぶ</a>' if d in PLAY else '') +
            f'<a class="pill" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' +
            ('' if d in PLAY else '<span class="more" aria-hidden="true">くわしく →</span>') + '</div></li>')

def app_card(d, k=None):
    name, i, text = NAMES[d]; cid, lb = CAT_OF[d]
    tag = '<span class="tagd">毎日ランキング</span>' if d in DAILY else ''
    key = f' data-k="{esc(name + " " + text + " " + lb)}"' if k else ''
    return (f'<li class="acard tilt rv" style="{cv(d)}"{key}>{tag}<div class="top"><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div><span class="cat">{CAT_EMO[cid]} {esc(lb)}</span><h3><a class="stretch" href="/{d}/">{esc(name)}</a></h3></div></div>'
            f'<p>{esc(text)}</p><div class="acts">' + (f'<a class="go sm2" href="/play/{d}/">{play_label(d)}</a>' if d in PLAY and d not in DAILY else '<span class="more" aria-hidden="true">くわしく →</span>')
            + (f'<a class="pill" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' if i else '<span class="pill soon">近日公開</span>') + '</div></li>')

def calendar(big=False):
    return (f'<div class="cal{" big" if big else ""}" aria-label="今日の日付（日本時間）"><span class="cm" data-cal-m>今日</span>'
            '<time class="cd2" data-cal data-cal-d>今日</time><span class="cw" data-cal-w>の問題</span></div>')

def countdown():
    return ('<div class="count" role="timer" aria-label="次の問題まで"><p class="lbl">⏰ 次の問題まで</p><div class="digits" aria-hidden="false">'
            '<span><b id="cd-h">--</b><small>時間</small></span><i>:</i><span><b id="cd-m">--</b><small>分</small></span><i>:</i>'
            '<span><b id="cd-s">--</b><small>秒</small></span></div><p class="sub">毎日 0時（日本時間）に、新しい問題になります。</p></div>')

def rsample():
    return ('<div class="rsample rv"><h3>🏆 今日のランキング <small>例</small></h3><ol>'
            '<li><span class="md" aria-hidden="true">🥇</span><span class="nm">ねこまる</span><span class="tm">0:41</span></li>'
            '<li><span class="md" aria-hidden="true">🥈</span><span class="nm">たろう</span><span class="tm">0:47</span></li>'
            '<li class="you"><span class="md" aria-hidden="true">🥉</span><span class="nm">？？？？ あなた？</span><span class="tm">-:--</span></li></ol>'
            '<p class="cap">これは表示のイメージ（例）です。実際の順位はアプリの中で見られます。</p></div>')

def note_items():
    try: return json.load(open(f'{R}/apps/note.json', encoding='utf-8'))['items']
    except Exception: return []

def note_list(n=None, thumbs=False):
    its = note_items()[:n] if n else note_items()
    lis = ''
    for it in its:
        th = ''
        if thumbs:
            if it.get('thumb', '').startswith('https://assets.st-note.com/'):
                import re
                src = re.sub(r'width=\d+', 'width=480', it['thumb'])
                th = f'<img class="th" src="{esc(src)}" width="160" height="84" alt="" loading="lazy">'
            else:
                th = '<span class="th" aria-hidden="true">📝</span>'
        lis += (f'<li class="rv"><a href="{esc(it["url"])}" rel="noopener">{th}<time datetime="{esc(it["date"])}">{esc(it["date"].replace("-", "."))}</time>'
                f'<span class="nt">{esc(it["title"])}</span><span class="go2">note で読む →</span></a></li>')
    return f'<ul class="notes{" thumbs" if thumbs else ""}" id="notes"' + (f' data-max="{n}"' if n else '') + f'>{lis}</ul>'

def me_card(h='h3', full=False):
    btns = ((f'<a class="go sm" href="{NOTE}" rel="me noopener">📝 note を読む</a>' if NOTE_ON else '') +
            f'<a class="ghost" href="{DEV}">App Store で全部見る</a>' + '<a class="ghost" href="/now/">いま やっていること</a>' + ('' if full else '<a class="ghost" href="/about/">もっと見る</a>') +
            ('<a class="ghost" href="/contact/">お問い合わせ</a>' if full else ''))
    return (f'<div class="me rv"><div class="av" aria-hidden="true">🐛</div><div><{h}>作っている人：いま</{h}>'
            '<p>将棋・ポーカー・アプリ開発が好きな「いま」です。毎日ちょっと遊べる iPhone アプリを、ひとりで作っています。</p>'
            '<ul class="likes" aria-label="好きなもの"><li>♟️ 将棋</li><li>🃏 ポーカー</li><li>📱 アプリ開発</li></ul>'
            f'<div class="btns">{btns}</div></div></div>')

# ---------------- news ----------------
def jst_date(iso):
    t = datetime.datetime.strptime(iso, '%Y-%m-%dT%H:%M:%SZ') + datetime.timedelta(hours=9)
    return t.strftime('%Y-%m-%d')

ID2D = {NAMES[d][1]: d for d in NAMES}
LOOKUP_T = {ID2D[str(r['trackId'])]: r for r in json.load(open(f'{HERE}/lookup.json'))['results'] if str(r['trackId']) in ID2D}
RELEASE_FIX_N = {'jimidrive': '2026-10-07'}   # はじめてのアプリの公開日（作った人の記録）
SITE_NEWS = [('2026-11-19', 'サイトをリニューアルしました', ['サイトの名前を「いまのアプリ」にして、見た目を新しくしました。',
              '「今日の問題」「ランキングのしくみ」「お知らせ」「よくある質問」「お問い合わせ」「note の記事」のページを足しました。'])]

def news_items():
    lk = json.load(open(f'{HERE}/lookup.json'))['results']
    out = [dict(date=dt, kind='site', d=None, title=t, lines=ls) for dt, t, ls in SITE_NEWS]
    for r in lk:
        d = ID2D.get(str(r['trackId']))
        if not d: continue
        name = NAMES[d][0]
        notes = [x.strip().lstrip('・').strip() for x in (r.get('releaseNotes') or '').split('\n') if x.strip()]
        if r.get('version') and notes and jst_date(r['currentVersionReleaseDate']) != jst_date(r['releaseDate']):
            out.append(dict(date=jst_date(r['currentVersionReleaseDate']), kind='upd', d=d, title=f'{name} を {r["version"]} にアップデートしました', lines=notes))
        out.append(dict(date=RELEASE_FIX_N.get(d) or jst_date(r['releaseDate']), kind='rel', d=d, title=f'{name} をリリースしました', lines=[NAMES[d][2] + '。']))
    out.sort(key=lambda x: (x['date'], x['kind'] == 'site'), reverse=True)
    return out

def news_li(n, full=True):
    kind = {'site': ('site', 'サイト'), 'upd': ('', 'アップデート'), 'rel': ('rel', 'リリース')}[n['kind']]
    ic = (f'<img class="ic" src="/{n["d"]}/icon-256.webp" width="48" height="48" alt="" loading="lazy">' if n['d'] else '<span class="ic site" aria-hidden="true">📣</span>')
    t = f'<a href="/{n["d"]}/">{esc(n["title"])}</a>' if n['d'] else esc(n['title'])
    y, m, dd = n['date'].split('-')
    lines = n['lines']
    if not full:
        body = ''
    elif len(lines) <= 2:
        body = '<ul>' + ''.join(f'<li>{esc(x)}</li>' for x in lines) + '</ul>'
    else:
        body = ('<ul>' + ''.join(f'<li>{esc(x)}</li>' for x in lines[:2]) + '</ul><details><summary>ほかの変更（' + str(len(lines) - 2) + '）</summary><ul>' +
                ''.join(f'<li>{esc(x)}</li>' for x in lines[2:]) + '</ul></details>')
    nid = 'n-' + n['date'].replace('-', '') + '-' + (n['d'] or 'site') + '-' + n['kind']
    n['id'] = nid
    return (f'<li class="rv" id="{nid}">{ic}<div class="meta"><time datetime="{n["date"]}">{int(y)}年{int(m)}月{int(dd)}日</time><b class="{kind[0]}">{kind[1]}</b></div>'
            f'<h3>{t}</h3>{body}</li>')

# ---------------- pages ----------------
DESC_HOME = ('一筆書き・へや割り・お弁当パズル・暗算ゲームなど、毎日みんなと同じ問題でランキング勝負できるパズルや、'
             'のんびりゲーム、変則将棋の対戦、お散歩日記・積読記録などのiPhoneアプリ。どれも無料で使えます。')

def itemlist():
    items = []
    for k, d in enumerate(ALL):
        name, i, text = NAMES[d]; a = APPS[d]
        items.append({"@type": "ListItem", "position": k + 1, "item": {
            "@type": "SoftwareApplication", "name": name, "description": text, "url": f"{BASE}/{d}/",
            "image": f"{BASE}/{d}/icon-256.webp", "applicationCategory": a['cat'],
            "operatingSystem": f"iOS {a.get('minos', '18')}.0 以降", **({"downloadUrl": store(i)} if i else {}),
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"}}})
    return {"@type": "ItemList", "name": f"{BRAND}の一覧", "numberOfItems": len(items), "itemListElement": items}

HERO_SHOTS = [('suji', '4_daily', 'すうじのへやの「今日のへや割り」の画面'),
              ('hitofude', '5_daily', 'ひとふでいもむしの「今日のいもむし」の画面'),
              ('okazu', '5_daily', 'おかず詰めパズルの「今日のおべんとう」の画面')]

def page_home():
    g = {"@context": "https://schema.org", "@graph": [ORG,
         {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": BRAND, "alternateName": "imaimaha のアプリ", "inLanguage": "ja", "publisher": {"@id": BASE + "/#org"}},
         itemlist()]}
    L = [head('/', f'{BRAND}｜毎日1問のパズルで勝負できるiPhoneアプリ', DESC_HOME, [g], preload='/hitofude/shots/5_daily.webp'), header('/'), '<main id="main">']
    phones = ''.join(f'<div class="phone p{k}">{scr(d, f, alt, lazy=False)}</div>' for k, (d, f, alt) in enumerate(HERO_SHOTS))
    emo = ''.join(f'<span style="--d:{k * -0.6}s;--r:{r}deg">{e}</span>' for k, (e, r) in enumerate([('🐛', -8), ('🍱', 6), ('🥚', -4), ('🫘', 8), ('♟️', -6)]))
    L.append('<section class="hhero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span></div><div class="wrap"><div>'
             '<p class="kicker">📱 iPhone アプリ ・ どれも無料</p>'
             '<h1><span class="ln"><span class="w" style="--d:.05s">すきま</span><span class="w" style="--d:.15s">時間に、</span></span>'
             '<span class="ln"><span class="w mark" style="--d:.3s">ちょっと</span><span class="w" style="--d:.45s">あそぼ。</span></span></h1>'
             '<p class="lead">いもむし、お弁当、ゆでたまご、納豆……。毎日みんなと同じ1問で勝負できる、ちいさな iPhone アプリたちです。</p>'
             f'<div class="emo" aria-hidden="true">{emo}</div>'
             '<div class="ctas"><a class="go" href="/play/" data-confetti>▶ ブラウザで今すぐ遊ぶ</a><a class="ghost" href="/today/">今日の問題を見る</a><a class="ghost" href="/apps/">アプリを見る</a></div>'
             '<p class="ctanote">いもむし・すうじ・おかずの今日の1問は、アプリを入れなくてもブラウザで遊べます。</p>'
             f'<ul class="stats"><li><b data-n="{len(ALL)}">{len(ALL)}</b>本のアプリ</li><li><b data-n="{len(DAILY)}">{len(DAILY)}</b>本で毎日ランキング</li><li><b>全部</b>無料</li></ul></div>'
             f'<div class="stage" aria-label="アプリの画面"><span class="sticker s1" aria-hidden="true">今日の1問！</span>{phones}<span class="sticker s2" aria-hidden="true">みんな同じ問題</span></div>'
             '</div></section>')
    # today band
    L.append('<section class="sec white" id="ranking" aria-labelledby="h-today"><div class="wrap"><div class="sec-h rv"><h2 id="h-today">📅 今日の1問</h2>'
             '<a class="more-link" href="/today/">今日の問題をぜんぶ見る →</a><p>毎日、みんなに同じ問題。サインインなし、ニックネームを決めるだけでランキングに参加できます。</p></div>'
             f'<div class="today">{calendar()}{countdown()}{rsample()}</div></div></section>')
    # daily apps
    L.append('<section class="sec" aria-labelledby="h-daily"><div class="wrap"><div class="sec-h rv"><h2 id="h-daily">🏆 毎日、みんなで勝負</h2>'
             '<a class="more-link" href="/ranking/">ランキングのしくみ →</a></div>'
             f'<ul class="rail" aria-label="今日の問題で勝負できるアプリ">{"".join(daily_card(d) for d in DAILY)}</ul><p class="swipe" aria-hidden="true">← 横にスワイプ →</p></div></section>')
    L.append('<section class="sec maker" aria-labelledby="h-maker"><div class="wrap"><div class="makerbox rv"><span class="e" aria-hidden="true">🧑‍💻</span><div>'
             '<h2 id="h-maker">ひとりで作っています</h2><p>企画・デザイン・プログラム・App Store への申請まで、ひとりで作っています。'
             '毎日の1問は、だれでも同じ条件でくらべられるようにしています。</p>'
             '<p class="links2"><a class="more-link" href="/about/">作っている人 →</a><a class="more-link" href="/now/">いま やっていること →</a></p></div></div></div></section>')
    # genres + others
    tiles = ''.join(f'<li class="ctile tilt rv"><span class="e" aria-hidden="true">{CAT_EMO[cid]}</span><h3><a class="stretch" href="/apps/#{cid}">{esc(lb)}</a></h3>'
                    f'<p>{CAT_SUB[cid]}・{len(ds)}本</p><div class="ics" aria-hidden="true">' + ''.join(f'<img src="/{d}/icon-256.webp" width="28" height="28" alt="" loading="lazy">' for d in ds) + '</div></li>'
                    for cid, lb, ds in CATS)
    others = [d for d in ALL if d not in DAILY]
    L.append('<section class="sec tint" aria-labelledby="h-genre"><div class="wrap"><div class="sec-h rv"><h2 id="h-genre">🔎 ジャンルからさがす</h2>'
             f'<a class="more-link" href="/apps/">アプリ一覧 →</a></div><ul class="ctiles">{tiles}</ul>'
             '<div class="sec-h rv" style="margin-top:34px"><h2 id="h-more" style="font-size:22px">✨ ほかにも、こんなアプリ</h2></div>'
             f'<ul class="rail" aria-labelledby="h-more">{"".join(app_card(d) for d in others)}</ul><p class="swipe" aria-hidden="true">← 横にスワイプ →</p></div></section>')
    # news + note
    ns = news_items()[:4]
    L.append('<section class="sec" aria-labelledby="h-news"><div class="wrap"><div class="cols c2"><div>'
             '<div class="sec-h rv"><h2 id="h-news" style="font-size:24px">📣 お知らせ</h2><a class="more-link" href="/news/">ぜんぶ見る →</a></div>'
             f'<ul class="news">{"".join(news_li(n, full=False) for n in ns)}</ul></div><div>'
             + ('<div class="sec-h rv"><h2 id="h-note" style="font-size:24px">📝 note の最新記事</h2><a class="more-link" href="/note/">note の記事をぜんぶ見る →</a></div>'
             f'{note_list(4)}' if NOTE_ON else '') + '</div></div></div></section>')
    mc = me_card().replace('<h3>', '<h2 id="h-me">').replace('</h3>', '</h2>')
    L.append(f'<section class="sec white" id="profile" aria-labelledby="h-me"><div class="wrap">{mc}</div></section>')
    L.append('</main>'); L.append(tail())
    write('/', '\n'.join(L))

OG_PAGES = {}
def sub_page(path, title_short, title, desc, lead, body, extra_ld=(), crumbs=None, og=None):
    cr = crumbs or [('/', 'ホーム'), (None, re.sub('<[^>]+>', '', title_short))]
    og = og or path.strip('/').replace('/', '-')
    OG_PAGES[og] = (re.sub('^[^ぁ-んァ-ン一-龥A-Za-z]+ ', '', title_short), desc)
    L = [head(path, title, desc, [crumb_ld(cr, path)] + list(extra_ld), og_img=f'{BASE}/apps/og/{og}.jpg'), header(path), '<main id="main">',
         '<section class="phero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span></div>' + crumb(cr) +
         f'<div class="wrap"><h1>{title_short}</h1><p class="lead2">{lead}</p></div></section>', body, '</main>', tail()]
    write(path, '\n'.join(L))

def page_apps():
    chips = '<button type="button" data-f="all" aria-pressed="true">すべて</button>' + ''.join(
        f'<button type="button" data-f="{cid}" aria-pressed="false">{CAT_EMO[cid]} {esc(lb)}</button>' for cid, lb, _ in CATS)
    secs = ''.join(f'<section class="sec" id="{cid}" data-sec="{cid}" aria-labelledby="h-{cid}" style="padding:14px 0 26px"><div class="wrap">'
                   f'<div class="sec-h"><h2 id="h-{cid}" style="font-size:24px">{CAT_EMO[cid]} {esc(lb)}</h2><span class="n">{len(ds)}本</span></div>'
                   f'<ul class="grid">{"".join(app_card(d, k=True) for d in ds)}</ul></div></section>' for cid, lb, ds in CATS)
    body = ('<div class="wrap"><div class="filters" id="filters" role="group" aria-label="ジャンルで絞りこむ" hidden>' + chips + '</div>'
            '<label class="search" hidden><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="アプリの名前やことばでさがす" aria-label="アプリをさがす"></label>'
            '<p class="empty" id="empty" hidden>見つかりませんでした。ほかのことばでさがしてみてください。</p></div>' + secs)
    g = {"@context": "https://schema.org", "@graph": [ORG, itemlist()]}
    sub_page('/apps/', 'アプリ一覧', f'アプリ一覧｜{BRAND}（iPhone・無料）',
             'パズル・のんびりゲーム・対戦・くらしの記録。いまのアプリの iPhone アプリをジャンルごとにまとめました。どれも無料で使えます。',
             f'パズル・のんびり・対戦・くらしの記録。ぜんぶで {len(ALL)} 本、どれも無料で使えます。', body, [g])

def page_today():
    lis = ''
    for k, d in enumerate(DAILY):
        name, i, _ = NAMES[d]; t, w = DAILY_LINE[d].split('：', 1)
        lis += (f'<li class="rv" style="{cv(d)}"><span class="no">{k + 1:02d}</span><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
                f'<div><p class="nm">{esc(name)}</p><h3>{esc(t)}</h3><p class="w">{esc(w)}</p></div>'
                f'<div class="acts"><a class="go sm" href="{store(i)}">アプリで挑戦</a>' + (f'<a class="go sm" href="/play/{d}/">▶ ブラウザで1問あそぶ</a>' if d in PLAY else '') +
                f'<a class="ghost" href="/{d}/">くわしく</a></div></li>')
    body = (f'<section class="sec white" style="padding-top:30px"><div class="wrap"><div class="today">{calendar(big=True)}{countdown()}{rsample()}</div></div></section>'
            '<section class="sec"><div class="wrap"><div class="sec-h rv"><h2>今日の問題があるアプリ</h2>'
            '<p>どのアプリも、今日の問題はみんな同じ。アプリをひらいて「今日の〜」から挑戦できます。</p></div>'
            f'<ol class="dlist">{lis}</ol></div></section>'
            '<section class="sec white"><div class="wrap"><div class="sec-h rv"><h2>今日の問題のしくみ</h2></div><div class="cols c3">'
            '<div class="box rv"><span class="e" aria-hidden="true">🗓️</span><h3>日付で決まる1問</h3><p>問題は日本時間の日付から作られます。だれの iPhone でも、その日は同じ問題です。</p></div>'
            '<div class="box rv"><span class="e" aria-hidden="true">🕛</span><h3>0時に新しい問題</h3><p>毎日 0時（日本時間）に次の問題になります。ランキングも日ごとに新しくなります。</p></div>'
            '<div class="box rv"><span class="e" aria-hidden="true">🔔</span><h3>夜7時のお知らせ</h3><p>はじめて今日の問題を遊んだときに、毎日夜7時のお知らせを受け取るか聞きます。設定でいつでもオフにできます。</p></div>'
            '</div><p class="center" style="margin-top:18px"><a class="go sm" href="/ranking/">ランキングのしくみを見る →</a></p></div></section>')
    sub_page('/today/', '今日の問題', f'今日の問題｜毎日0時に新しい1問｜{BRAND}',
             '一筆書き・へや割り・お弁当パズル・暗算・ゆでたまご・納豆。今日の問題はだれでも同じで、タイムやスコアをランキングでくらべられます。次の問題までのカウントダウンつき。',
             '<time data-today>今日</time>の問題です。毎日、みんなに同じ1問。タイムやスコアでくらべよう。', body)

def page_ranking():
    apps = DAILY + ['madoshizuku']
    lis = ''.join(f'<li><a href="/{d}/#ranking"><img src="/{d}/icon-256.webp" width="36" height="36" alt="" loading="lazy">'
                  f'<span>{esc(NAMES[d][0])}<br><small style="color:var(--dim);font-weight:600">{esc(DAILY_LINE.get(d, "60秒チャレンジ：いちばん大きいしずく").split("：", 1)[1])}</small></span></a></li>' for d in apps)
    body = ('<section class="sec white" style="padding-top:30px"><div class="wrap"><div class="cols c3">'
            '<div class="box rv"><span class="e" aria-hidden="true">✍️</span><h2>名前を決めるだけ</h2><p>サインインやメールアドレスはいりません。1〜10文字のニックネームを決めるだけで参加できます。</p></div>'
            '<div class="box rv"><span class="e" aria-hidden="true">📮</span><h2>送るのは名前と記録だけ</h2><p>送るのは、ニックネームと記録、それに iPhone の中で作ったランダムな番号だけです。本名・連絡先・場所などは送りません。</p></div>'
            '<div class="box rv"><span class="e" aria-hidden="true">🧹</span><h2>いつでも消せる</h2><p>ランキングの画面のいちばん下「ランキングから自分の記録を消す」を押すと、名前と記録がすぐに消えます。</p></div>'
            '</div></div></section>'
            '<section class="sec"><div class="narrow">'
            '<div class="box rv"><h2>🏅 ランキングの種類</h2><ul><li><b>今日</b>：今日の問題の順位。毎日 0時（日本時間）に新しくなります。</li>'
            '<li><b>今週</b>：その週の記録の合計など（アプリによってちがいます）。</li><li><b>ぜんぶ</b>：星の合計や、いちばん良い記録など。</li></ul>'
            '<p>アプリによっては、ランキングに入るのは<b>その日の1回目の記録だけ</b>です（2回目からは練習）。くわしくは各アプリのページで。</p></div>'
            '<div class="box rv"><h2>🤝 みんなが気持ちよく遊べるように</h2><ul>'
            '<li><b>ヒントのしるし</b>：はじめて遊んだ日から7日間は、今日の問題でもヒントが使えるアプリがあります。ヒントを使った記録には、ランキングで 💡 のしるしがつきます。</li>'
            '<li><b>名前のチェック</b>：使えないことばが入った名前は決められません。記録を送るときに見つかったら「ななしさん」になります。</li>'
            '<li><b>通報</b>：ふさわしくない名前や記録は、その行の「…」から通報できます。ちがう3人から通報されると、その記録はかくれ、名前は「ななしさん」にもどります。</li>'
            '<li><b>ありえない記録</b>：とても速すぎる記録など、ふつうでは出ない記録は受け付けません。</li></ul></div>'
            '<div class="box rv"><h2>🗓️ 記録をのこす期間</h2><p>日ごとの記録は 40日、今週の記録は 9週たつと消えます。「ぜんぶ」の記録と名前は、自分で消すまでのこります。</p></div>'
            '<div class="box rv"><h2>📱 ランキングがあるアプリ</h2>'
            f'<ul class="linklist" style="padding:0">{lis}</ul></div>'
            '<p class="center"><a class="go sm" href="/today/" data-confetti>今日の問題であそぶ →</a></p></div></section>')
    sub_page('/ranking/', 'ランキングのしくみ', f'ランキングのしくみ｜名前だけで参加｜{BRAND}',
             'いまのアプリのランキングは、サインインなしでニックネームを決めるだけで参加できます。送るのは名前と記録だけで、いつでも消せます。ヒントのしるしや通報のしくみも。',
             'サインインなし、ニックネームを決めるだけ。みんなが気持ちよく遊べるしくみです。', body)

def page_news():
    ns = news_items()
    body = f'<section class="sec" style="padding-top:20px"><div class="narrow"><ul class="news">{"".join(news_li(n) for n in ns)}</ul></div></section>'
    arts = {"@context": "https://schema.org", "@type": "ItemList", "name": "お知らせ・更新情報", "itemListElement": [
        {"@type": "ListItem", "position": k + 1, "item": {"@type": "BlogPosting", "headline": n['title'], "datePublished": n['date'],
         "url": f"{BASE}/news/#{n['id']}", "author": {"@type": "Organization", "name": BRAND, "url": BASE + "/"},
         "publisher": {"@type": "Organization", "name": BRAND, "logo": {"@type": "ImageObject", "url": BASE + "/apps/logo.png"}},
         "image": f"{BASE}/{n['d']}/icon-256.webp" if n['d'] else BASE + "/apps/logo.png", "articleBody": ' '.join(n['lines'])}} for k, n in enumerate(ns)]}
    sub_page('/news/', 'お知らせ・更新情報', f'お知らせ・更新情報｜{BRAND}',
             'いまのアプリのお知らせと、各アプリのアップデート・リリースの情報です（App Store で公開中の版）。',
             'サイトのお知らせと、App Store で公開中の版のアップデート内容です。新しい順。', body, [arts])

def page_note():
    its = note_items()
    body = (f'<section class="sec" style="padding-top:20px"><div class="narrow">{note_list(None, thumbs=True)}'
            f'<p class="center" style="margin-top:22px"><a class="go sm" href="{NOTE}" rel="me noopener">note でフォローする →</a></p></div></section>')
    sub_page('/note/', 'note の記事', f'note の記事｜{BRAND}',
             '「いま」が note に書いている記事の一覧です。アプリを作っているときのことや、ふだん考えていること。',
             f'アプリを作っているときのことや、ふだん考えていることを note に書いています（{len(its)}本）。', body)

ORG_LD = dict(ORG, **{"@context": "https://schema.org"})

def timeline():
    rows = {}
    for d in ALL:
        r = LOOKUP_T.get(d)
        if not r: continue
        dt = RELEASE_FIX_N.get(d) or jst_date(r['releaseDate'])
        rows.setdefault(dt, []).append(d)
    lis = ''
    for k, dt in enumerate(sorted(rows)):
        y, m, dd = dt.split('-')
        apps = '・'.join(f'<a href="/{d}/">{esc(NAMES[d][0])}</a>' for d in rows[dt])
        txt = f'はじめてのアプリ {apps} を公開' if k == 0 else f'{apps} を公開'
        lis += f'<li class="rv"><time datetime="{dt}">{int(y)}年{int(m)}月{int(dd)}日</time><p>{txt}</p></li>'
    lis += '<li class="rv"><time datetime="2026-11-19">2026年11月19日</time><p>サイトを「いまのアプリ」にリニューアル（<a href="/news/">お知らせ</a>）</p></li>'
    return (f'<section class="sec white" aria-labelledby="h-tl"><div class="narrow"><h2 id="h-tl" class="h2s">🗓️ つくった記録</h2>'
            f'<ol class="tl">{lis}</ol><p><a class="more-link" href="/now/">いま やっていること →</a></p></div></section>')

def page_about():
    counts = ''.join(f'<li><a href="/apps/#{cid}"><span aria-hidden="true" style="font-size:24px">{CAT_EMO[cid]}</span><span>{esc(lb)}　{len(ds)}本</span></a></li>' for cid, lb, ds in CATS)
    body = (f'<section class="sec white" style="padding-top:28px"><div class="narrow">{me_card("h2", full=True)}</div></section>'
            '<section class="sec"><div class="narrow"><div class="box rv"><h2>🛠️ 作っているもの</h2>'
            '<p>すきま時間に1問だけ遊べるパズル、指を動かすだけのんびりできるゲーム、友達と遊べる対戦、毎日の記録に使うアプリ。'
            '毎日の問題は、だれでも同じ盤でくらべられるようにしています。</p>'
            f'<ul class="linklist" style="padding:0">{counts}</ul></div>'
            '<div class="box rv"><h2>🌱 たいせつにしていること</h2><ul><li>1回が短く、すきま時間に遊べること</li><li>サインインなしで、名前を決めるだけで参加できること</li>'
            '<li>集めるデータは少なく。記録はなるべく iPhone の中に</li></ul></div>'
            + ('<div class="sec-h rv" style="margin-top:26px"><h2 style="font-size:24px">📝 note の最新記事</h2><a class="more-link" href="/note/">ぜんぶ見る →</a></div>'
            f'{note_list(5)}' if NOTE_ON else '') + '</div></section>' + timeline())
    person_page = {"@context": "https://schema.org", "@type": "ProfilePage", "url": BASE + "/about/", "name": "作っている人：いま",
                   "mainEntity": {"@type": "Person", "@id": BASE + "/about/#ima", "name": "いま", "url": BASE + "/about/", "sameAs": [NOTE] if NOTE_ON else [],
                                  "knowsAbout": ["将棋", "ポーカー", "iPhone アプリ開発"], "worksFor": None}}
    del person_page['mainEntity']['worksFor']
    sub_page('/about/', '作っている人', f'作っている人：いま｜{BRAND}',
             '将棋・ポーカー・アプリ開発が好きな「いま」が、毎日ちょっと遊べる iPhone アプリをひとりで作っています。' + ('note の記事もこちらから。' if NOTE_ON else ''),
             'いまのアプリを作っている「いま」のページです。', body, [person_page, ORG_LD])

from content import GLOSS as GLOSS_ALL
FAQ = [
    ('無料ですか？', ['どのアプリも無料でダウンロードして遊べます。アプリ内課金はありません。']),
    ('広告は出ますか？', ['多くのアプリは広告で無料にしています。広告が出るところや、動画を見ると使える機能はアプリによってちがいます。広告のないアプリもあります（居候お掃除マン・Notre Endroit）。',
                      'くわしくは各アプリのページの「よくある質問」をごらんください。']),
    ('データはどこに保存されますか？', ['ゲームの記録や日記などは、基本的に iPhone の中に保存しています。アプリを削除すると記録も消えます。',
                                 'ランキングに参加したときは、ニックネームと記録だけを送ります。ふたりや家族で使うアプリ（Notre Endroit・居候お掃除マン）は、共有のためにデータをサーバーに保存します。']),
    ('通知は来ますか？', ['今日の問題があるアプリでは、はじめて今日の問題を遊んだときに、毎日夜7時のお知らせを受け取るか聞きます。iPhone の「設定」→「通知」や、アプリの設定でいつでもオフにできます。']),
    ('ランキングに参加するには？', ['ニックネームを決めるだけです。サインインやメールアドレスはいりません。名前と記録はいつでも消せます。<a href="/ranking/">ランキングのしくみ</a>もどうぞ。']),
    ('機種変更したら、記録は引き継げますか？', ['多くのアプリは、記録を iPhone の中にだけ保存しているため、ほかの端末への引き継ぎにはまだ対応していません。',
                                       '居候お掃除マンは、新しい iPhone でもう一度家のコードで入れます。Notre Endroit はアカウントで使います。']),
    ('Android 版はありますか？', ['いまは iPhone 版だけです。']),
    ('不具合を見つけた・要望がある', ['<a href="/contact/">お問い合わせ</a>のページから、メールでどうぞ。']),
]

def page_faq():
    qa = ''.join(f'<details class="qa rv"{" open" if k == 0 else ""}><summary>{esc(q)}</summary><div class="a">' + ''.join(f'<p>{a}</p>' for a in ans) + '</div></details>'
                 for k, (q, ans) in enumerate(FAQ))
    links = ''.join(f'<li><a href="/{d}/#faq"><img src="/{d}/icon-256.webp" width="36" height="36" alt="" loading="lazy"><span>{esc(NAMES[d][0])}</span></a></li>' for d in ALL)
    body = (f'<section class="sec" style="padding-top:20px"><div class="narrow">{qa}'
            f'<div class="box rv" style="margin-top:22px"><h2>📱 アプリごとのよくある質問</h2><p>遊び方や、そのアプリだけの質問は、各アプリのページにまとめています。</p><ul class="linklist" style="padding:0">{links}</ul></div>'
            '<div class="box rv" id="glossary"><h2>📖 ことばの説明</h2><dl class="gloss">' +
            ''.join(f'<div class="gl"><dt><dfn>{esc(t)}</dfn></dt><dd>{esc(x)} <a href="{u}">くわしく</a></dd></div>' for t, (x, u) in GLOSS_ALL.items()) +
            '</dl></div></div></section>')
    import re
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', ' '.join(ans))}} for q, ans in FAQ]}
    sub_page('/faq/', 'よくある質問', f'よくある質問｜{BRAND}',
             '無料？広告は？データは？通知は？ランキングは？機種変更は？ いまのアプリ全体のよくある質問と、アプリごとの質問へのリンク。',
             'どのアプリにも共通の質問をまとめました。アプリごとの質問は下のリンクから。', body, [faq_ld])

def page_contact():
    sup = ''.join(f'<li><a href="/{d}/#contact"><img src="/{d}/icon-256.webp" width="36" height="36" alt="" loading="lazy"><span>{esc(NAMES[d][0])}</span></a></li>' for d in ALL)
    priv = ''.join(f'<li><a href="/{d}/privacy.html"><img src="/{d}/icon-256.webp" width="36" height="36" alt="" loading="lazy"><span>{esc(NAMES[d][0])}</span></a></li>' for d in ALL)
    body = ('<section class="sec white" style="padding-top:28px"><div class="narrow"><div class="box rv center"><span class="e" aria-hidden="true">✉️</span>'
            '<h2>メールでどうぞ</h2><p>不具合・ご要望・ご質問は、こちらのメールアドレスへ。</p>'
            f'<p><a class="mailbig" href="mailto:{MAIL}">{MAIL}</a></p></div>'
            '<div class="box rv"><h2>📝 書いてもらえると助かること</h2><ul><li>アプリの名前</li><li>iPhone の機種と iOS のバージョン</li>'
            '<li>何をしたら、どうなったか（できれば画面のスクリーンショットも）</li></ul><p>ひとりで作っているので、お返事に少し時間がかかることがあります。</p></div></div></section>'
            '<section class="sec"><div class="narrow">'
            f'<div class="box rv"><h2>📱 アプリごとのサポート</h2><p>よくある質問や遊び方は、各アプリのページにもあります。</p><ul class="linklist" style="padding:0">{sup}</ul></div>'
            f'<div class="box rv" id="privacy"><h2>🔒 プライバシーポリシー</h2><p>アプリごとにまとめています。</p><ul class="linklist" style="padding:0">{priv}</ul></div></div></section>')
    sub_page('/contact/', 'お問い合わせ', f'お問い合わせ｜{BRAND}',
             'いまのアプリへの不具合・ご要望・ご質問はメールでどうぞ。アプリごとのサポートとプライバシーポリシーへのリンクもあります。',
             '不具合やご要望、ご質問はメールで受け付けています。', body)

# ---------------- landing pages (reuse gen.page with new header/footer) ----------------
# =====================================================================
# 追加: 各アプリのページを豊かに（動画・ルール・〇〇とは？・質問・ことば・更新）、新しいページ、SEO
# =====================================================================
import re
from content import SEO, AEO, GLOSS, GLOSS_OF, RULES, NOW_UPDATED, NOW_DOING, NOW_NEXT, RELEASE_FIX

LOOKUP = {ID2D[str(r['trackId'])]: r for r in json.load(open(f'{HERE}/lookup.json'))['results'] if str(r['trackId']) in ID2D}
VIDEO = [d for d in ALL if os.path.exists(f'{R}/{d}/play.mp4')]
CAT_INTRO = {
 'puzzle': ('パズル・脳トレのアプリ', '一筆書き・数字のへや割り・お弁当のブロックパズル・暗算。毎日みんなと同じ1問で、タイムやスコアをくらべられるアプリが中心です。'),
 'relax': ('のんびり遊べるアプリ', 'ゆでたまごの殻むき、納豆のフィルムはがし、雨の窓のしずく集め。指を動かすだけで、ひと息つけるゲームです。'),
 'versus': ('対戦・読み合いのアプリ', '安南将棋やトランプ将棋などの変則将棋、1が9に勝つ数字カード、ポーカーのプリフロップの練習。友達や CPU と遊べます。'),
 'life': ('くらし・記録のアプリ', 'お散歩の日記、積読のタワー、家のおそうじの分担、ふたりの交換日記。毎日の記録に使うアプリです。'),
}

def rel_date(d):
    r = LOOKUP.get(d)
    return RELEASE_FIX.get(d) or (jst_date(r['releaseDate']) if r else None)

def hf_svg(spec, label):
    m, path = spec['map'], spec['path']; W = len(m[0]); H = len(m); C = 34; G = 4
    w = W * C + (W + 1) * G; h = H * C + (H + 1) * G
    def xy(i): return (G + (i % W) * (C + G) + C / 2, G + (i // W) * (C + G) + C / 2)
    out = [f'<svg class="hfb" viewBox="0 0 {w} {h}" width="{w * 2}" height="{h * 2}" role="img" aria-label="{esc(label)}"><rect width="{w}" height="{h}" rx="8" fill="#f1f8e9"/>']
    wc = 0
    for i in range(W * H):
        ch = m[i // W][i % W]; x, y = xy(i); x0, y0 = x - C / 2, y - C / 2
        fill = {'#': '#b0b0a8', 'G': '#a1887f', 'B': '#43a047', 'w': '#7b1fa2'}.get(ch, '#9ccc65')
        out.append(f'<rect x="{x0}" y="{y0}" width="{C}" height="{C}" rx="7" fill="{fill}"/>')
        if ch == '>': out.append(f'<path d="M{x - 8} {y}h14m-6 -6l6 6l-6 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>')
        if ch == 'B': out.append(f'<text x="{x}" y="{y + 5}" font-size="15" text-anchor="middle" fill="#fff" font-weight="700">2</text>')
        if ch == 'w': out.append(f'<circle cx="{x}" cy="{y}" r="9" fill="#2a0b3d"/>')
        if ch == 'M': out.append(f'<circle cx="{x}" cy="{y - 2}" r="9" fill="#e53935"/><circle cx="{x - 3}" cy="{y - 4}" r="2" fill="#fff"/><rect x="{x - 3}" y="{y + 4}" width="6" height="7" fill="#fff3e0"/>')
        if ch in '123': out.append(f'<circle cx="{x}" cy="{y}" r="10" fill="#f4511e"/><text x="{x}" y="{y + 5}" font-size="13" text-anchor="middle" fill="#fff" font-weight="700">{ch}</text>')
        if ch == 'G': out.append(f'<path d="M{x - 10} {y + 6}l20 -12" stroke="#5d4037" stroke-width="4" stroke-linecap="round"/>')
    pts = ' '.join(f'{xy(i)[0]},{xy(i)[1]}' for i in path)
    out.append(f'<polyline points="{pts}" fill="none" stroke="#2e7d32" stroke-opacity=".55" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>')
    sx, sy = xy(path[0]); ex, ey = xy(path[-1])
    out.append(f'<circle cx="{sx}" cy="{sy}" r="11" fill="#ffb74d" stroke="#e65100" stroke-width="2"/><circle cx="{sx - 4}" cy="{sy - 2}" r="2" fill="#3b2b1f"/><circle cx="{sx + 4}" cy="{sy - 2}" r="2" fill="#3b2b1f"/>')
    out.append(f'<circle cx="{ex}" cy="{ey}" r="5" fill="#1b5e20"/></svg>')
    return ''.join(out)

def heya_svg():
    C = 40; rooms = [((0, 0, 1, 3), '3', 1, '#ffe0b2'), ((1, 0, 2, 2), '4', 4, '#c8e6c9'), ((1, 2, 2, 1), '2', 5, '#bbdefb')]
    out = ['<svg class="hfb" viewBox="0 0 128 128" width="256" height="256" role="img" aria-label="へや割りの例：3×3 の盤を、3・4・2 のへやに分けたところ"><rect width="128" height="128" rx="8" fill="#fff"/>']
    for (r, c, h, w), num, cell, col in rooms:
        out.append(f'<rect x="{4 + c * C + 2}" y="{4 + r * C + 2}" width="{w * C - 4}" height="{h * C - 4}" rx="8" fill="{col}" stroke="#3b2b1f" stroke-width="2"/>')
        rr, cc = divmod(cell, 3)
        out.append(f'<text x="{4 + cc * C + C / 2}" y="{4 + rr * C + C / 2 + 7}" font-size="20" text-anchor="middle" font-weight="700" fill="#3b2b1f">{num}</text>')
    out.append('</svg>')
    return ''.join(out)

def rules_section(d):
    rs = RULES.get(d)
    if not rs: return ''
    lis = ''
    for e, t, x, ill in rs:
        art = ''
        if isinstance(ill, dict): art = f'<div class="rart">{hf_svg(ill, t + "の例")}</div>'
        elif ill == 'heya': art = f'<div class="rart">{heya_svg()}</div>'
        lis += f'<li class="rule rv">{art}<span class="e" aria-hidden="true">{e}</span><h3>{esc(t)}</h3><p>{esc(x)}</p></li>'
    head_t = 'ルールとしかけ' if d in ('hitofude', 'okazu', 'kakezan') else ('ルール' if d not in ('pokerstudy',) else '練習のしかた')
    return (f'<section class="block rules" id="rules" aria-labelledby="h-rules"><div class="wrap"><h2 id="h-rules">📘 {head_t}</h2>'
            f'<ul class="rulelist">{lis}</ul></div></section>')

def demo_section(d):
    name = NAMES[d][0]; a = APPS[d]
    seo_t, seo_d = SEO[d]
    what = f'<p class="what-a"><b>{esc(name)}</b>は、{esc(a["desc"])}</p>'
    who = f'<p class="what-b">こんな人に：{esc(a["osusume"][0])}。</p>'
    if d in VIDEO:
        media = (f'<div class="vphone"><video muted loop playsinline preload="none" poster="play.jpg" width="390" height="844" data-vsrc="play.mp4" '
                 f'aria-label="{esc(name)} のプレイのようす（音なし）"></video></div><p class="vcap">▶ プレイのようす（音なし）</p>')
    else:
        imgs = ''.join(f'<div class="slide" style="--k:{k}">{scr(d, f, alt)}</div>' for k, (f, alt) in enumerate(SHOTS[d][:4]))
        media = f'<div class="vphone slides" aria-label="{esc(name)} の画面">{imgs}</div><p class="vcap">アプリの画面</p>'
    return (f'<section class="block demo" aria-labelledby="h-what"><div class="wrap demo-in"><div class="media rv">{media}</div>'
            f'<div class="whatbox rv"><h2 id="h-what">{esc(name)}とは？</h2>{what}{who}'
            f'<ul class="facts"><li><b>料金</b>{esc(a.get("ads", ADS))}</li><li><b>対応</b>iPhone（iOS {a.get("minos", "18")} 以降）</li>'
            f'<li><b>ジャンル</b><a href="/apps/{CAT_OF[d][0]}/">{CAT_EMO[CAT_OF[d][0]]} {esc(CAT_OF[d][1])}</a></li>' +
            (f'<li><b>今日の問題</b><a href="/today/">毎日0時（日本時間）にかわる</a></li>' if d in DAILY else '') +
            '</ul>' + (f'<p class="playbtn"><a class="go sm" href="/play/{d}/">{play_label(d)}</a>　<span>{esc(PLAY_NOTE.get(d, "登録なし"))}</span></p>' if d in PLAY and d not in DAILY else '') +
            '</div></div></section>')

def today_mini(d):
    if d not in DAILY: return ''
    name, i, _ = NAMES[d]; k, w = DAILY_LINE[d].split('：', 1)
    play = f'<a class="go sm" href="/play/{d}/">▶ ブラウザで1問あそぶ</a>' if d in PLAY else ''
    return (f'<section class="block todaymini" aria-labelledby="h-tm"><div class="wrap"><div class="today">{calendar()}{countdown()}'
            f'<div class="tmtext rv"><h2 id="h-tm">📅 {esc(k)}</h2><p>{esc(w)}。毎日0時（日本時間）に新しい問題になります。</p>'
            f'<div class="btns"><a class="go sm" href="{store(i)}" data-confetti>アプリで挑戦</a>{play}<a class="ghost" href="/today/">ほかの今日の問題</a></div></div></div></div></section>')

def updates_section(d):
    r = LOOKUP.get(d)
    if not r: return ''
    notes = [x.strip().lstrip('・').strip() for x in (r.get('releaseNotes') or '').split('\n') if x.strip()]
    if not notes: return ''
    dt = jst_date(r['currentVersionReleaseDate']); y, m, dd = dt.split('-')
    return (f'<section class="block" aria-labelledby="h-upd"><div class="narrow"><h2 id="h-upd">🆕 さいきんのアップデート</h2>'
            f'<div class="box rv"><p class="upd-h"><b>バージョン {esc(r["version"])}</b>（{int(y)}年{int(m)}月{int(dd)}日）</p><ul>' +
            ''.join(f'<li>{esc(x)}</li>' for x in notes) + '</ul><p><a class="more-link" href="/news/">ほかのお知らせ・更新情報 →</a></p></div></div></section>')

def aeo_section(d):
    qs = AEO.get(d, []); terms = GLOSS_OF.get(d, [])
    qa = ''.join(f'<details class="qa rv"><summary>{esc(q)}</summary><div class="a"><p>{esc(a)}</p></div></details>' for q, a in qs)
    gl = ''.join(f'<div class="gl rv"><dt><dfn>{esc(t)}</dfn></dt><dd>{esc(GLOSS[t][0])}' +
                 (f' <a href="{GLOSS[t][1]}">くわしく</a>' if GLOSS[t][1] != f'/{d}/' else '') + '</dd></div>' for t in terms)
    body = ''
    if qa: body += f'<h2 id="h-aeo">💬 よく聞かれること</h2>{qa}'
    if gl: body += f'<h2 id="h-gloss" style="margin-top:30px">📖 ことばの説明</h2><dl class="gloss">{gl}</dl>'
    return f'<section class="block" aria-label="よく聞かれること・ことばの説明"><div class="narrow">{body}</div></section>' if body else ''

def landing(d):
    name, i, _ = NAMES[d]; a = APPS[d]; cid, clb = CAT_OF[d]
    seo_t, seo_d = SEO[d]
    gen.topbar = lambda: header('/apps/')
    gen.footer = lambda extra=(): footer('privacy.html')
    out = gen.page(d)
    # タイトルと説明（短く）
    out = out.replace(esc(a['title']), esc(seo_t)).replace(esc(a['desc']), esc(seo_d))
    # 構造化データ
    def fix_ld(mo):
        obj = json.loads(mo.group(1).replace('<\\/', '</'))
        if obj.get('@type') == 'SoftwareApplication':
            r = LOOKUP.get(d)
            obj['@type'] = 'MobileApplication'
            obj['operatingSystem'] = f'iOS {a.get("minos", "18")}.0 以降'
            obj['description'] = seo_d
            obj['publisher'] = obj['author'] = {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND, "url": BASE + "/", "sameAs": [DEV] + ([NOTE] if NOTE_ON else [])}
            if r:
                obj['softwareVersion'] = r['version']
                obj['datePublished'] = rel_date(d)
                obj['dateModified'] = jst_date(r['currentVersionReleaseDate'])
                obj['genre'] = r.get('genres', [])
            if d in VIDEO:
                obj['video'] = {"@type": "VideoObject", "name": f"{name} のプレイのようす", "description": f"{name} を遊んでいるところ（音なし）",
                                "thumbnailUrl": f"{BASE}/{d}/play.jpg", "contentUrl": f"{BASE}/{d}/play.mp4", "uploadDate": "2026-11-19"}
        if obj.get('@type') == 'FAQPage':
            obj['mainEntity'] = [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": x}} for q, x in AEO.get(d, [])] + obj['mainEntity']
        return ld(obj)
    out = re.sub(r'<script type="application/ld\+json">(.*?)</script>', fix_ld, out, flags=re.S)
    cr = [('/', 'ホーム'), ('/apps/', 'アプリ一覧'), (f'/apps/{cid}/', clb), (None, name)]
    howto = {"@context": "https://schema.org", "@type": "HowTo", "name": f"{name} の遊び方", "step": [
        {"@type": "HowToStep", "position": k + 1, "name": t, "text": x} for k, (t, x) in enumerate(a['steps'])]}
    out = out.replace('</head>', ld(crumb_ld(cr, f'/{d}/')) + '\n' + ld(howto) + '\n</head>', 1)
    out = out.replace('<main>', '<main id="main">\n' + crumb(cr), 1)
    # 入れる場所
    k = out.index('<section class="shots"'); out = out[:k] + demo_section(d) + '\n' + out[k:]
    if d in DAILY:
        k = out.index('<section class="block rank"'); k = out.index('</section>', k) + len('</section>'); out = out[:k] + '\n' + today_mini(d) + out[k:]
    k = out.index('<h2>遊び方は3ステップ</h2>'); k = out.index('</section>', k) + len('</section>'); out = out[:k] + '\n' + rules_section(d) + out[k:]
    k = out.index('<section class="block support"'); out = out[:k] + updates_section(d) + '\n' + aeo_section(d) + '\n' + out[k:]
    out = out.replace('</body>', f'<script src="/apps/site.js?v={V}" defer></script>\n</body>', 1)
    out = out.replace('<link rel="icon" href="icon-256.webp" type="image/webp">\n<link rel="apple-touch-icon" href="icon.png">', ICON_LINKS, 1)
    assert ICON_LINKS in out
    out = nowrap_text(out)
    open(f'{R}/{d}/index.html', 'w', encoding='utf-8').write(out)

# ---------------- 新しいページ ----------------
def page_category(cid):
    lb = dict((c, l) for c, l, _ in CATS)[cid]; ds = dict((c, x) for c, _, x in CATS)[cid]
    h1, intro = CAT_INTRO[cid]
    items = [{"@type": "ListItem", "position": k + 1, "url": f"{BASE}/{d}/", "name": NAMES[d][0]} for k, d in enumerate(ds)]
    others = ''.join(f'<li><a href="/apps/{c}/"><span aria-hidden="true" style="font-size:24px">{CAT_EMO[c]}</span><span>{esc(l)}</span></a></li>' for c, l, _ in CATS if c != cid)
    body = (f'<section class="sec" style="padding-top:16px"><div class="wrap"><ul class="grid">{"".join(app_card(d) for d in ds)}</ul></div></section>'
            f'<section class="sec white"><div class="wrap"><div class="sec-h"><h2 style="font-size:22px">ほかのジャンル</h2></div><ul class="linklist">{others}'
            '<li><a href="/apps/"><span aria-hidden="true" style="font-size:24px">📱</span><span>すべてのアプリ</span></a></li></ul></div></section>')
    sub_page(f'/apps/{cid}/', f'{CAT_EMO[cid]} {h1}', f'{h1}｜{BRAND}', intro[:110], esc(intro), body,
             [{"@context": "https://schema.org", "@type": "ItemList", "name": h1, "numberOfItems": len(items), "itemListElement": items}],
             crumbs=[('/', 'ホーム'), ('/apps/', 'アプリ一覧'), (None, lb)], og=f'cat-{cid}')

def page_now():
    def lis(xs):
        return ''.join(f'<li class="rv"><span class="e" aria-hidden="true">{e}</span><div><h3>' + (f'<a href="{u}">{esc(t)}</a>' if u else esc(t)) + f'</h3><p>{esc(x)}</p></div></li>' for e, t, x, u in xs)
    recent = news_items()[:5]
    y, m, dd = NOW_UPDATED.split('-')
    body = (f'<section class="sec white" style="padding-top:26px"><div class="narrow"><p class="updated">更新日：<time datetime="{NOW_UPDATED}">{int(y)}年{int(m)}月{int(dd)}日</time></p>'
            f'<h2 class="h2s">🛠️ いま作っているもの</h2><ul class="nowlist">{lis(NOW_DOING)}</ul>'
            f'<h2 class="h2s">🔜 つぎにやること</h2><ul class="nowlist">{lis(NOW_NEXT)}</ul>'
            f'<h2 class="h2s">🆕 さいきんの更新</h2><ul class="news">{"".join(news_li(n, full=False) for n in recent)}</ul>'
            '<p><a class="more-link" href="/news/">お知らせをぜんぶ見る →</a></p>'
            '<p class="small">このページは「いま やっていること」をときどき書きかえる、Now ページです。</p></div></section>')
    sub_page('/now/', 'いま やっていること', f'いま やっていること｜{BRAND}',
             '「いま」がいま作っているもの・つぎにやること・さいきんの更新。縛り将棋の作りなおし、ポーカーのランキング、ブラウザで遊べる今日の1問など。',
             'いま作っているものと、つぎにやること。ときどき書きかえます。', body, og='now')

def page_sitemap():
    groups = [('あそぶ', [('/', 'ホーム'), ('/today/', '今日の問題'), ('/play/', 'ブラウザで遊ぶ'), ('/ranking/', 'ランキングのしくみ'), ('/news/', 'お知らせ・更新情報')]),
              ('アプリ', [('/apps/', 'アプリ一覧')] + [(f'/apps/{c}/', l) for c, l, _ in CATS]),
              ('いまのこと', [('/about/', '作っている人'), ('/now/', 'いま やっていること')] + ([('/note/', 'note の記事')] if NOTE_ON else [])),
              ('サポート', [('/faq/', 'よくある質問'), ('/contact/', 'お問い合わせ'), ('/apps/sitemap/', 'サイトマップ')])]
    body = '<section class="sec" style="padding-top:16px"><div class="narrow">'
    for h, ls in groups:
        body += f'<div class="box rv"><h2>{h}</h2><ul>' + ''.join(f'<li><a href="{u}">{t}</a></li>' for u, t in ls) + '</ul></div>'
    for c, l, ds in CATS:
        body += f'<div class="box rv"><h2>{CAT_EMO[c]} {esc(l)}</h2><ul>' + ''.join(
            f'<li><a href="/{d}/">{esc(NAMES[d][0])}</a>（<a href="/{d}/privacy.html">プライバシーポリシー</a>' + (f'・<a href="/play/{d}/">ブラウザで遊ぶ</a>' if d in PLAY else '') + '）</li>' for d in ds) + '</ul></div>'
    body += '</div></section>'
    sub_page('/apps/sitemap/', 'サイトマップ', f'サイトマップ｜{BRAND}', 'いまのアプリのすべてのページの一覧です。アプリの紹介・今日の問題・ランキング・お知らせ・よくある質問など。',
             'このサイトのページの一覧です。', body, crumbs=[('/', 'ホーム'), (None, 'サイトマップ')], og='sitemap')

# ---------------- アプリごとのサポートページ（/<app>/support/） ----------------
# App Store の「サポート」から来る人のためのページ。サイトのナビ・パンくず・フッター・note・ほかのアプリの紹介は出さない（2026-11-19 ユーザー「いい感じにして、まかせる」）。
# 中身は orig/<app>.html（よくある質問・そのアプリだけの説明）から作る。noindex（検索には出さない。sitemap.xml にも入れない）。
# いちばん下に小さく「アプリの紹介ページ」へのリンクだけ。各アプリの「お問い合わせ」もここを開く（アプリの中の SFSafariViewController）
SUPPORT_SKIP = ('遊び方', '使い方', 'どんなアプリ？', 'よくある質問', 'お問い合わせ')

def support_parts(d):
    src = open(f'{SITE}/orig/{d}.html', encoding='utf-8').read()
    body = src.split('</header>', 1)[1].split('</main>', 1)[0]
    tagline = re.search(r'<header>.*?<p>(.*?)</p>', src, re.S).group(1)
    secs = re.split(r'<h2>(.*?)</h2>', body)
    faqs, extra = [], []
    for k in range(1, len(secs), 2):
        h, x = secs[k], secs[k + 1]
        if h == 'よくある質問':
            card = x.split('<div class="card">', 1)[1].rsplit('</div>', 1)[0]
            for m in re.finditer(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', card, re.S):
                faqs.append((m.group(1).strip(), m.group(2).strip()))
        elif h not in SUPPORT_SKIP:
            x = re.sub(r'\s*<nav>.*?</nav>', '', x, flags=re.S).strip()
            extra.append((h, x))
    return tagline, faqs, extra

def page_support(d):
    import urllib.parse
    name, i, _ = NAMES[d]; acc, soft, deep = colors(APPS[d]['accent'])
    tagline, faqs, extra = support_parts(d)
    q = lambda t: urllib.parse.quote(t, safe='')
    body_t = ('（わかるところだけで大丈夫です）\n\n■ 端末（例: iPhone 15）：\n■ iOS のバージョン：\n■ アプリのバージョン：\n■ 困っていること：\n\n')
    mailto = f'mailto:{MAIL}?subject={q(name + " のお問い合わせ")}&body={q(body_t)}'
    qa = ''.join(f'<details class="qa"><summary>{q_}</summary><div class="a">{a_}</div></details>' for q_, a_ in faqs)
    ex = ''.join(f'<section class="card"><h2>{h}</h2>{x}</section>' for h, x in extra)
    url = f'{BASE}/{d}/support/'
    out = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(name)} サポート</title>
<meta name="description" content="{esc(name)}（iPhone アプリ）のサポートページ。よくある質問と、メールでのお問い合わせ。">
<meta name="robots" content="noindex">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="{soft}">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/{d}/icon-256.webp" type="image/webp">
<link rel="apple-touch-icon" href="/{d}/icon.png">
<style>
:root{{--a:{acc};--s:{soft};--d:{deep};--ink:#2a2019;--dim:#6b5848;--line:#eadfce}}
*{{box-sizing:border-box}}
html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:#fffaf2;color:var(--ink);line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;font-size:16px;line-break:strict;text-wrap:pretty}}
main{{max-width:680px;margin:0 auto;padding:22px 16px 40px}}
.hd{{display:flex;align-items:center;gap:14px;margin:4px 0 18px}}
.hd img{{width:64px;height:64px;border-radius:15px;flex:none;box-shadow:0 2px 8px rgba(0,0,0,.12)}}
h1{{margin:0;line-height:1.3;font-size:22px}}
h1 .sp{{display:block;font-size:15px;color:var(--d);margin-top:2px}}
.tag{{margin:2px 0 0;color:var(--dim);font-size:13px;line-height:1.5}}
h2{{font-size:18px;margin:0 0 8px;line-height:1.4;text-wrap:balance}}
.card{{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 18px 14px;margin:0 0 16px}}
.card p{{margin:0 0 10px}}
.contact{{border:2px solid var(--a);background:var(--s)}}
.mailbtn{{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:10px 18px;border-radius:14px;background:var(--d);color:#fff;font-weight:800;font-size:17px;text-decoration:none;margin:4px 0 10px}}
.mailbtn:active{{opacity:.85}}
.addr{{font-size:14px;color:var(--dim);margin:0 0 8px;overflow-wrap:anywhere}}
.addr b{{color:var(--ink);user-select:all;-webkit-user-select:all}}
.tpl{{margin:6px 0 8px;padding:10px 14px;border-radius:12px;background:#fff;font-size:14px;list-style:none}}
.tpl li{{margin:2px 0}}
.small{{font-size:13px;color:var(--dim)}}
.qa{{border-top:1px solid var(--line)}}
.qa:first-of-type{{border-top:0}}
.qa summary{{cursor:pointer;font-weight:700;padding:12px 28px 12px 0;min-height:44px;list-style:none;position:relative}}
.qa summary::-webkit-details-marker{{display:none}}
.qa summary::after{{content:"＋";position:absolute;right:2px;top:12px;color:var(--d)}}
.qa[open] summary::after{{content:"－"}}
.qa .a{{padding:0 0 10px;font-size:15px}}
.qa .a p{{margin:0 0 8px}}
a{{color:var(--d)}}
ul{{padding-left:22px}}
.links a{{display:inline-flex;align-items:center;min-height:44px;font-weight:700}}
.ft{{text-align:center;margin-top:26px;font-size:13px}}
.ft a{{color:var(--dim);display:inline-flex;align-items:center;min-height:44px}}
.nw{{white-space:nowrap}}
</style>
</head>
<body>
<main id="main">
<header class="hd"><img src="/{d}/icon-256.webp" width="64" height="64" alt=""><div><h1>{esc(name)}<span class="sp">サポート</span></h1><p class="tag">{tagline}</p></div></header>
<section class="card contact" aria-labelledby="h-contact"><h2 id="h-contact">✉️ お問い合わせ</h2>
<p>不具合やご要望・ご質問は、メールでどうぞ。下のボタンを押すと、メールのアプリが開きます。</p>
<a class="mailbtn" href="{esc(mailto)}">メールで問い合わせる</a>
<p class="addr">あて先：<b>{MAIL}</b></p>
<p class="small">メールには、次のことを書いてもらえると助かります（ボタンから開くと、はじめから入っています）。</p>
<ul class="tpl"><li>■ 端末（例: iPhone 15）</li><li>■ iOS のバージョン</li><li>■ アプリのバージョン</li><li>■ 困っていること（できれば画面のスクリーンショットも）</li></ul>
<p class="small">iOS のバージョンは「設定」→「一般」→「情報」、アプリのバージョンは「設定」→「一般」→「iPhone ストレージ」→「{esc(name)}」で見られます。ひとりで作っているので、お返事に少し時間がかかることがあります。</p>
</section>
<section class="card" aria-labelledby="h-faq"><h2 id="h-faq">💬 よくある質問</h2>{qa}</section>
{ex}<section class="card" aria-labelledby="h-priv"><h2 id="h-priv">🔒 プライバシー</h2>
<p>このアプリで扱う情報や、データの消し方は、プライバシーポリシーにまとめています。</p>
<p class="links"><a href="/{d}/privacy.html">{esc(name)} のプライバシーポリシー</a></p></section>
<p class="ft"><a href="/{d}/">アプリの紹介ページ</a></p>
</main>
</body>
</html>
"""
    out = re.sub(r'href="(?!https?:|mailto:|/|#)', f'href="/{d}/', out)   # orig の相対リンク（privacy.html など）
    write(f'/{d}/support/', out)

# ---------------- 友達の招待ページ（/<app>/join/?c=部屋のコード） ----------------
# 2026-11-20: 対戦アプリの「招待を送る」が送るリンク。アプリが入っていれば URL スキーム（<scheme>://join?c=…）でアプリを開き、
# アプリはオンライン対戦の画面にコードを入れる（入るかは本人が「入る」を押して決める）。入っていなければ App Store へ。
# サポートページと同じく、ナビなし・noindex・sitemap に入れない。コードは英大文字・数字だけ（アプリごとの文字数）。ほかのパラメータは見ない。
# 開くのは1回だけ（sessionStorage）。1.2 秒たってもページが見えたままなら「アプリが開かなかったら」の案内を出す
JOIN = {  # dir -> (URL スキーム, 部屋コードの文字数, App Store の id（NAMES にまだないとき）, アプリでコードを入れる場所)
    'hensokushogi': ('hensokushogi', 6, None, '「友達とネット対戦」の「コードで招待された人」'),
    'gekokujo': ('gekokujo', 5, None, '「オンライン」の「コード」'),
    'futaridaifugo': ('futaridaifugo', 5, '6836394499', '「オンライン対戦」の「コード」'),   # 審査中（id はもう決まっている。公開されればリンクが生きる）
}

def page_join(d):
    scheme, n, sid, where = JOIN[d]
    name = NAMES[d][0]; acc, soft, deep = colors(APPS[d]['accent'])
    st = store(NAMES[d][1] or sid)
    out = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(name)} 友達からの招待</title>
<meta name="description" content="{esc(name)}（iPhone アプリ）の対戦への招待です。">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="{soft}">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<meta property="og:title" content="{esc(name)} で対戦しよう！">
<meta property="og:description" content="友達からの招待です。アプリで同じ部屋に入れます。">
<meta property="og:image" content="{BASE}/{d}/og.jpg">
<link rel="icon" href="/{d}/icon-256.webp" type="image/webp">
<link rel="apple-touch-icon" href="/{d}/icon.png">
<style>
:root{{--a:{acc};--s:{soft};--d:{deep};--ink:#2a2019;--dim:#6b5848;--line:#eadfce}}
*{{box-sizing:border-box}}
html{{-webkit-text-size-adjust:100%}}
body{{margin:0;background:#fffaf2;color:var(--ink);line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;font-size:16px;line-break:strict;text-wrap:pretty}}
main{{max-width:520px;margin:0 auto;padding:26px 16px 40px;text-align:center}}
.ic{{width:88px;height:88px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.14)}}
h1{{font-size:22px;line-height:1.4;margin:12px 0 4px}}
.lead{{margin:0 0 16px;color:var(--dim)}}
.card{{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;margin:0 0 16px}}
.main{{border:2px solid var(--a);background:var(--s)}}
.lab{{font-size:14px;color:var(--dim);margin:0}}
.code{{font:800 44px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;margin:4px 0 12px;user-select:all;-webkit-user-select:all;overflow-wrap:anywhere}}
.btn{{display:flex;align-items:center;justify-content:center;min-height:56px;padding:10px 18px;border-radius:14px;background:var(--d);color:#fff;font-weight:800;font-size:18px;text-decoration:none}}
.btn:active{{opacity:.85}}
.btn.st{{background:#111;font-size:17px}}
.small{{font-size:13px;color:var(--dim);margin:10px 0 0}}
h2{{font-size:16px;margin:0 0 10px}}
.msg{{font-weight:700;color:var(--d);margin:0 0 10px}}
.bad{{color:#b3261e;font-weight:700}}
.ft{{font-size:13px;margin-top:22px}}
.ft a{{color:var(--dim);display:inline-flex;align-items:center;min-height:44px}}
.nw{{white-space:nowrap}}
[hidden]{{display:none!important}}
</style>
</head>
<body>
<main>
<img class="ic" src="/{d}/icon-256.webp" width="88" height="88" alt="">
<h1>{esc(name)}<br>友達からの招待</h1>
<p class="lead">アプリで、友達と同じ部屋に入れます。</p>
<section class="card main" id="ok" hidden>
<p class="lab">部屋コード</p>
<p class="code" id="code"></p>
<a class="btn" id="open" href="#">アプリで参加する</a>
<p class="small">アプリが開いたら、コードが入った画面になります。「入る」を押すと部屋に入ります。<br>開かないときは、アプリの{esc(where)}の欄に、このコードを入れてね。</p>
</section>
<section class="card main" id="ng">
<p class="bad">招待のリンクが正しくないようです。</p>
<p class="small">送ってくれた人に、部屋コード（英数字{n}文字）を教えてもらって、アプリの{esc(where)}の欄に入れてね。</p>
</section>
<section class="card" id="store">
<p class="msg" id="fb" hidden>アプリが開かなかったときは、まだ入っていないのかもしれません。</p>
<h2>アプリをまだ入れていない人は</h2>
<a class="btn st" href="{st}">App Store で入れる（無料）</a>
<p class="small">入れたら、もう一度このリンクを開いてね。</p>
</section>
<p class="ft"><a href="/{d}/">{esc(name)} の紹介ページ</a></p>
</main>
<script>
(function () {{
  var LEN = {n}, SCHEME = '{scheme}';
  var c = '';
  try {{ c = (new URLSearchParams(location.search).get('c') || '').toUpperCase(); }} catch (e) {{}}
  if (!/^[A-Z0-9]{{4,8}}$/.test(c) || c.length !== LEN) return;   // 形がちがうコードは使わない（アプリも開かない）
  var url = SCHEME + '://join?c=' + c;
  document.getElementById('code').textContent = c;
  document.getElementById('open').href = url;
  document.getElementById('ok').hidden = false;
  document.getElementById('ng').hidden = true;
  // 自動で開くのは、このコードで1回だけ（もどってきたときに何度も開かない）
  var key = 'join-tried-' + c, tried = false;
  try {{ tried = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); }} catch (e) {{ tried = true; }}
  var fb = document.getElementById('fb');
  if (tried) {{ fb.hidden = false; return; }}
  var timer = setTimeout(function () {{ if (!document.hidden) fb.hidden = false; }}, 1200);
  document.addEventListener('visibilitychange', function () {{ if (document.hidden) clearTimeout(timer); }});
  setTimeout(function () {{ location.href = url; }}, 60);
}})();
</script>
</body>
</html>
"""
    write(f'/{d}/join/', out)

def fix_privacy_nav(d):
    # プライバシーポリシーの下のリンク: 前は「サポート」→ 紹介ページ（./）。サポートページ（support/）と紹介ページの2つにする（ナビはもともとない）
    fn = f'{R}/{d}/privacy.html'
    if not os.path.exists(fn): return
    s = open(fn, encoding='utf-8').read()
    new = '<nav><a href="support/">サポート・お問い合わせ</a><a href="./">アプリの紹介ページ</a></nav>'
    s2 = re.sub(r'<nav>(?:(?!</nav>).)*</nav>', new, s, count=1, flags=re.S)
    if s2 != s: open(fn, 'w', encoding='utf-8').write(s2)

# ---------------- OG 画像・llms.txt ----------------
def make_og():
    from playwright.sync_api import sync_playwright
    os.makedirs(f'{R}/apps/og', exist_ok=True)
    icons = ''.join(f"<img src='file://{R}/{d}/icon-256.webp'>" for d in ALL[:10])
    with sync_playwright() as p:
        b = p.webkit.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for key, (t, desc) in OG_PAGES.items():
            h = (f"<html><head><meta charset='utf-8'><style>body{{margin:0;width:1200px;height:630px;background:#fff7e8;font-family:'Hiragino Maru Gothic ProN','Hiragino Sans',sans-serif;color:#3b2b1f;position:relative;overflow:hidden}}"
                 ".b1{position:absolute;width:520px;height:520px;border-radius:50%;background:#bde0fe;right:-160px;top:-200px}.b2{position:absolute;width:300px;height:300px;border-radius:50%;background:#caffbf;left:-100px;bottom:-120px}"
                 ".in{position:absolute;left:80px;top:90px;right:80px}.lg{font-size:34px;font-weight:800}.lg i{font-style:normal;color:#d9512b}"
                 "h1{font-size:74px;line-height:1.2;margin:34px 0 18px}p{font-size:28px;line-height:1.5;color:#6b5848;margin:0;max-width:960px}"
                 ".ic{position:absolute;left:80px;bottom:56px;display:flex;gap:16px}.ic img{width:70px;height:70px;border-radius:17px;box-shadow:0 4px 10px rgba(0,0,0,.15)}</style></head><body>"
                 f"<div class='b1'></div><div class='b2'></div><div class='in'><div class='lg'>いまの<i>アプリ</i></div><h1>{esc(t)}</h1><p>{esc(desc[:60])}{'…' if len(desc) > 60 else ''}</p></div><div class='ic'>{icons}</div></body></html>")
            open(f'{HERE}/og_tmp.html', 'w').write(h)
            pg.goto(f'file://{HERE}/og_tmp.html'); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{R}/apps/og/{key}.jpg', type='jpeg', quality=82)
        b.close()

def llms():
    L = [f'# {BRAND}', '', '> 「いま」がひとりで作っている iPhone アプリのサイト。毎日みんなと同じ1問でランキング勝負できるパズルや、のんびりゲーム、変則将棋などの対戦、くらしの記録アプリ。どれも無料。', '',
         '## ページ', f'- [ホーム]({BASE}/): サイトのトップ', f'- [今日の問題]({BASE}/today/): 毎日0時（日本時間）にかわる、みんな同じ1問',
         f'- [ランキングのしくみ]({BASE}/ranking/): サインインなし、ニックネームだけで参加', f'- [アプリ一覧]({BASE}/apps/): すべてのアプリ',
         f'- [お知らせ]({BASE}/news/): アップデートとリリース', f'- [よくある質問]({BASE}/faq/): 無料・広告・データ・通知・機種変更',
         f'- [作っている人]({BASE}/about/): いま（将棋・ポーカー・アプリ開発が好き）', f'- [いま やっていること]({BASE}/now/)', f'- [お問い合わせ]({BASE}/contact/)', '', '## アプリ']
    for cid, lb, ds in CATS:
        L.append(f'### {lb}')
        for d in ds:
            L.append(f'- [{NAMES[d][0]}]({BASE}/{d}/): {SEO[d][1]} ' + (f'App Store: {store(NAMES[d][1])}' if NAMES[d][1] else 'App Store: 近日公開'))
    L += ['', '## そのほか', f'- App Store の開発者ページ: {DEV}', f'- 連絡先: {MAIL}', '']
    for fn in (f'{R}/apps/llms.txt', f'{R}/llms.txt'):   # /llms.txt も同じ中身
        open(fn, 'w', encoding='utf-8').write('\n'.join(L))

if __name__ == '__main__':
    page_home(); page_apps(); page_today(); page_ranking(); page_news(); (page_note() if NOTE_ON else None); page_about(); page_faq(); page_contact()
    page_now(); page_sitemap()
    for c, _, _ in CATS: page_category(c)
    for d in ALL: landing(d); page_support(d); fix_privacy_nav(d)
    for d in JOIN: page_join(d)
    llms()
    if '--og' in sys.argv: make_og()
    print('ok', sorted(OG_PAGES))

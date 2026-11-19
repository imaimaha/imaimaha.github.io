# -*- coding: utf-8 -*-
"""いまのアプリ — サイト全体を作る（トップ・/apps/・/today/・/ranking/・/news/・/note/・/about/・/faq/・/contact/・各アプリの紹介ページ）
使い方（このフォルダで）:
  python3 site2.py          … ぜんぶのページを作りなおす（アプリの紹介ページ・トップ・各ページ・llms.txt）
  ~/Developer/asc-tools/pwvenv/bin/python site2.py --og   … ページごとの OGP 画像も作る
  ~/Developer/asc-tools/pwvenv/bin/python site2.py --og-en … 英語のページ（/en/）の OGP 画像（/apps/og/en-*.jpg）も作る
  lookup.json は App Store の公開中の情報（curl "https://itunes.apple.com/lookup?id=...&country=jp" で取りなおす）
  文の中身は content.py（短いタイトル・説明・質問・ルール・いまやっていること）と apps_data.py
  確認: python3 -m http.server でサイトを出して crawl.py（リンク切れ・h1・タイトル長さ・JSON-LD）、check2.py（スクショ）
  プレイ動画: vid/rec.py <アプリ>（vid/enc.swift を swiftc でビルドしてから）
  招待ページ /<app>/join/?c=部屋コード（page_join。対戦アプリの「招待を送る」のリンク。ナビなし・noindex）
  サポートページ /<app>/support/（page_support。App Store の「サポート」とアプリの「お問い合わせ」から来る。ナビなし・noindex）も、ここで一緒に作る
  App Store のアプリがまだないもの（apps_data.py の NAMES の id が None。いまはなし）は、App Store のボタンのかわりに「近日公開」
  英語のページ（/en/・/en/apps/・/en/apps/<app>/・/en/play/・/en/about/・/en/faq/）も、ここで一緒に作る（lang='en'。文は content_en.py）。
  日本語のページとは hreflang（ja・en・x-default=日本語）で結ぶ。対応は EN_ALT"""
import os, sys, json, html, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = HERE   # gen.py・apps_data.py・orig/・data/ も同じフォルダ
sys.path.insert(0, SITE)
import gen
from apps_data import APPS, NAMES, SHOTS, DAILY, DAILY_LINE, CATS, ADS
from gen import colors, mix

R = os.path.expanduser('~/Developer/imaimaha.github.io')
BASE = gen.BASE   # サイトの住所は gen.py の BASE 1か所だけ
NOTE = 'https://note.com/redemarrage22'
NOTE_ON = True   # 2026-11-19 ユーザー「いったん NOTE への遷移はきろう。後で復活させる」→ True にもどせば全部もどる
DEV = 'https://apps.apple.com/jp/developer/id6818812575'
MAIL = 'imaimaha.apps@gmail.com'
BRAND = 'いまのアプリ'
V = '20261129'
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
PLAY = ['hitofude', 'suji', 'okazu', 'jimidrive', 'yudetamago', 'kakezan', 'gekokujo']   # ブラウザで遊べるページ（/play/<app>/）。DAILY のアプリは「今日の1問」、ほかは CPU 対戦など
def play_label(d): return '▶ ブラウザで1問あそぶ' if d in DAILY else '▶ ブラウザで遊ぶ'
PLAY_NOTE = {'gekokujo': 'CPU と1試合・登録なし'}   # 今日の問題のないアプリの「ブラウザで遊ぶ」のよこの文
CAT_OF = {d: (cid, lb) for cid, lb, ds in CATS for d in ds}

# 英語のページ（/en/）。英語のページがあるのは、ゲーム12本（くらしのアプリ以外）とホーム・一覧・ブラウザで遊ぶ・作っている人・よくある質問
from content_en import BRAND_EN
EN_GAMES = [d for cid, _, ds in CATS if cid != 'life' for d in ds]
EN_ALT = {'/': '/en/', '/apps/': '/en/apps/', '/play/': '/en/play/', '/about/': '/en/about/', '/faq/': '/en/faq/', **{f'/{d}/': f'/en/apps/{d}/' for d in EN_GAMES}}
JA_ALT = {v: k for k, v in EN_ALT.items()}

def hreflang_links(path):   # 日本語と英語の両方のページに同じ3行（ja・en・x-default は日本語）
    ja = path if path in EN_ALT else JA_ALT.get(path)
    if not ja: return ''
    return (f'<link rel="alternate" hreflang="ja" href="{BASE}{ja}">\n<link rel="alternate" hreflang="en" href="{BASE}{EN_ALT[ja]}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{BASE}{ja}">')

def logo_svg(uid, size=34):
    from icons import mark
    return mark().replace('<svg xmlns="http://www.w3.org/2000/svg" ', f'<svg width="{size}" height="{size}" aria-hidden="true" ').replace('id="g"', f'id="{uid}"').replace('url(#g)', f'url(#{uid})')

NAV = [('/today/', '今日の問題', '📅'), ('/play/', 'ブラウザで遊ぶ', '🌐'), ('/apps/', 'アプリ一覧', '📱'), ('/guide/', '読み物', '📖'), ('/ranking/', 'ランキング', '🏆'), ('/news/', 'お知らせ', '📣'),
       ] + ([('/note/', 'note', '📝')] if NOTE_ON else []) + [('/about/', '作っている人', '🙋')]
MENU = [('/', 'ホーム', '🏠'), ('/start/', 'どれから遊ぶ？3問で診断', '🧭')] + NAV + [('/now/', 'いま やっていること', '🛠️'), ('/faq/', 'よくある質問', '💬'), ('/contact/', 'お問い合わせ', '✉️'), ('/apps/sitemap/', 'サイトマップ', '🗺️')]

def header(cur, alt=None):   # alt: 英語のページ（「English」のリンク先。なければ /en/）
    def a(u, t, e=None, with_e=False):
        ac = ' aria-current="page"' if u == cur else ''
        return f'<a href="{u}"{ac}>' + (f'<span aria-hidden="true">{e}</span>' if with_e else '') + f'{t}</a>'
    return ('<a class="skip" href="#main">本文へ</a>'
            f'<header class="hd"><div class="wrap"><a class="logo" href="/" aria-label="{BRAND} ホーム">{logo_svg("lg-h")}<span>いまの<i>アプリ</i></span></a>'
            '<nav class="gnav" aria-label="メインメニュー">' + ''.join(a(u, t) for u, t, e in NAV) + '</nav>'
            f'<a class="lang" href="{alt or EN_ALT.get(cur, "/en/")}" hreflang="en" lang="en">English</a>'
            '<details class="mnav"><summary aria-label="メニューを開く"><span></span></summary><nav aria-label="メニュー">' +
            ''.join(a(u, t, e, True) for u, t, e in MENU) + '</nav></details></div></header>')

def footer(privacy=None):
    sup = [('/faq/', 'よくある質問'), ('/contact/', 'お問い合わせ')]
    sup += [(privacy, 'このアプリのプライバシーポリシー')] if privacy else []
    sup += [('/contact/#privacy', 'プライバシーポリシー'), ('/apps/sitemap/', 'サイトマップ'), ('/en/', 'English')]
    cols = [('あそぶ', [('/', 'ホーム'), ('/start/', 'どれが合う？3問で診断'), ('/today/', '今日の問題'), ('/play/', 'ブラウザで遊ぶ'), ('/apps/', 'アプリ一覧'), ('/zukan/', 'あそびかた図鑑'), ('/ranking/', 'ランキングのしくみ'), ('/news/', 'お知らせ・更新情報')]),
            ('いまのこと', [('/about/', '作っている人'), ('/guide/', '読み物'), ('/now/', 'いま やっていること')] + ([('/note/', 'note の記事'), (NOTE, 'note（いまのページ）')] if NOTE_ON else []) + [(DEV, 'App Store で全部のアプリを見る')]),
            ('サポート', sup)]
    def li(u, t):
        rel = ' rel="me noopener"' if u == NOTE else (' hreflang="en" lang="en"' if u == '/en/' else '')
        return f'<li><a href="{u}"{rel}>{t}</a></li>'
    body = ''.join(f'<div><h2>{h}</h2><ul>' + ''.join(li(u, t) for u, t in ls) + '</ul></div>' for h, ls in cols)
    wall = ''.join(f'<li><a href="/{d}/" aria-label="{esc(NAMES[d][0])}"><img src="/{d}/icon-256.webp" width="48" height="48" alt="" loading="lazy"></a></li>' for d in ALL)
    bye = ('<div class="bye"><div class="crew" aria-hidden="true"><span>🐛</span><span>🍱</span><span>🥚</span><span>🫘</span><span>🚗</span><span>💧</span></div><div class="bye-in">'
           '<p class="bye-h">また あした。</p><p class="bye-s">次の1問まで <b class="bye-t" data-cdf>--:--:--</b></p>'
           '<div class="bye-go"><a class="go sm" href="/play/">▶ 今日の1問をあそぶ</a></div>'
           f'<ul class="wall" aria-label="ぜんぶのアプリ">{wall}</ul></div></div>')
    return (f'<footer class="ft">{bye}<div class="wrap"><div><a class="logo" href="/">{logo_svg("lg-f")}<span>いまの<i>アプリ</i></span></a>'
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

def head(path, title, desc, extra_ld=(), og_img=None, preload=None, lang='ja', og_alt=None, extra_head='', og_type='website'):
    url = BASE + path
    og_img = og_img or f'{BASE}/apps/og.jpg'
    en = lang == 'en'
    brand = BRAND_EN if en else BRAND
    og_alt = og_alt or (f'{BRAND_EN} app icons' if en else f'{BRAND}のアイコン一覧')
    loc = ('<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ja_JP">' if en else
           '<meta property="og:locale" content="ja_JP">' + ('\n<meta property="og:locale:alternate" content="en_US">' if path in EN_ALT else ''))
    L = [f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">',
         f'<title>{esc(title)}</title>', f'<meta name="description" content="{esc(desc)}">', f'<link rel="canonical" href="{url}">']
    if hreflang_links(path): L.append(hreflang_links(path))
    L += ['<meta name="theme-color" content="#fff7e8">',
         f'<meta property="og:type" content="{og_type}">\n<meta property="og:site_name" content="{brand}">\n{loc}',
         f'<meta property="og:title" content="{esc(title)}">\n<meta property="og:description" content="{esc(desc)}">\n<meta property="og:url" content="{url}">',
         f'<meta property="og:image" content="{og_img}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="{esc(og_alt)}">',
         f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{esc(title)}">\n<meta name="twitter:description" content="{esc(desc)}">\n<meta name="twitter:image" content="{og_img}">',
         ICON_LINKS.replace('content="いまのアプリ"', f'content="{BRAND_EN}"') if en else ICON_LINKS]
    if preload: L.append(f'<link rel="preload" as="image" href="{preload}" fetchpriority="high">')
    L.append(f'<link rel="stylesheet" href="/apps/site.css?v={V}">')
    if extra_head: L.append(extra_head)
    if NOTE_ON and not en: L.append(f'<link rel="me" href="{NOTE}">')
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
    body = ''.join(parts)
    # よくある質問の見出し（summary は flex）: 文字と <span class="nw"> がべつべつの列にならないよう、1つの span にまとめる
    body = re.sub(r'(<details class="qa[^"]*"[^>]*><summary>)(?!<span class="qt">)(.*?)(</summary>)', r'\1<span class="qt">\2</span>\3', body, flags=re.S)
    return head + body

def write(path, out):
    if '<html lang="en">' not in out[:200]: out = nowrap_text(out)   # 英語のページは日本語の折り返しの調整をしない
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
            '<div>' + ('' if k else f'<span class="cat">{CAT_EMO[cid]} {esc(lb)}</span>') + f'<h3><a class="stretch" href="/{d}/">{esc(name)}</a></h3></div></div>'
            f'<p>{esc(text)}</p><div class="acts">' + (f'<a class="go sm2" href="/play/{d}/">{play_label(d)}</a>' if d in PLAY and d not in DAILY else '<span class="more" aria-hidden="true">くわしく →</span>')
            + (f'<a class="pill" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' if i else '<span class="pill soon">近日公開</span>') + '</div></li>')

def calendar(big=False):
    return (f'<div class="cal{" big" if big else ""}" aria-label="今日の日付（日本時間）"><span class="cm" data-cal-m>今日</span>'
            '<time class="cd2" data-cal data-cal-d>今日</time><span class="cw" data-cal-w>の問題</span></div>')

def countdown():
    return ('<div class="count" role="timer" aria-label="次の問題まで"><p class="lbl">⏰ 次の問題まで</p><div class="digits" aria-hidden="false">'
            '<span><b id="cd-h">--</b><small>時間</small></span><i>:</i><span><b id="cd-m">--</b><small>分</small></span><i>:</i>'
            '<span><b id="cd-s">--</b><small>秒</small></span></div><p class="sub">毎日 0時（日本時間）に、新しい問題になります。</p></div>')

def rsample(h='h3'):   # /today/ は上に h2 がないので h2
    return (f'<div class="rsample rv"><{h}><span>🏆 今日のランキング</span> <small>例</small></{h}><ol>'
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
SITE_NEWS = [('2026-11-19', 'ブラウザで遊べる今日の1問を6つに', ['ひとふでいもむし・すうじのへや・おかず詰めパズル・ナンバー暗算ドライブ・ゆでたまごの今日の1問と、下剋上デュエルの CPU 対戦が、アプリを入れなくてもブラウザで遊べるようになりました。']),
             ('2026-11-19', '各アプリのサポートページを新しくしました', ['アプリごとのサポートページに、よくある質問と、お問い合わせのメールのボタンをまとめました。']),
             ('2026-11-19', 'サイトをリニューアルしました', ['サイトの名前を「いまのアプリ」にして、見た目を新しくしました。',
              '「今日の問題」「ランキングのしくみ」「お知らせ」「よくある質問」「お問い合わせ」「note の記事」のページを足しました。'])]

def news_items():
    lk = json.load(open(f'{HERE}/lookup.json'))['results']
    seen = {}
    out = []
    for dt, t, ls in SITE_NEWS:   # おなじ日のサイトのお知らせが2つ以上あるときは、id に -2, -3 … をつける
        seen[dt] = seen.get(dt, 0) + 1
        out.append(dict(date=dt, kind='site', d=None, title=t, lines=ls, sfx='' if seen[dt] == 1 else f'-{seen[dt]}'))
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
    nid = 'n-' + n['date'].replace('-', '') + '-' + (n['d'] or 'site') + '-' + n['kind'] + n.get('sfx', '')
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

# 期間限定（クリスマス 12/1–12/25・お正月 12/29–1/7、日本時間）。HTML には hidden で入れておき、期間中だけ site.js が出す（?xmasPreview=1 / ?shogatsuPreview=1 でためせる）
SEASONS = [('xmas', '🎄', 'クリスマスの今日の1問', 'クリスマスの期間（12/1〜12/25）は、アプリの「今日の1問」がクリスマスのかざりつけになります（12/1 からのアップデートのあと、アプリに出ます）。',
            [('yudetamago', 'クリスマスのたまご', '今日のたまごが、オーナメントのような赤・緑・金のたまごに。むくと図鑑に入ります。'),
             ('madoshizuku', '雪の窓', '今日の雨の景色が、雪の夜のイルミネーションの窓に。雨と目標はいつもと同じです。'),
             ('suji', 'サンタの住人', '住人がサンタの帽子をかぶり、盤のふちにも飾りがつきます。問題はいつもと同じです。')]),
           ('shogatsu', '🎍', 'お正月の今日の1問', 'お正月の期間（12/29〜1/7）は、アプリの「今日の1問」がお正月のかざりつけになります。',
            [('okazu', 'お正月のおべんとう', '今日のおべんとうが、おせちの重箱に。問題はいつもと同じです。'),
             ('hitofude', 'お正月のいもむし', '葉っぱは松・竹・梅、石は鏡もちに。盤はいつもと同じです。')])]

def season_card(d, label, text):
    name, i, _ = NAMES[d]
    return (f'<li class="acard tilt" style="{cv(d)}"><div class="top"><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div><span class="cat">{esc(label)}</span><h3><a class="stretch" href="/{d}/">{esc(name)}</a></h3></div></div>'
            f'<p>{esc(text)}</p><div class="acts">' + (f'<a class="go sm2" href="/play/{d}/">{play_label(d)}</a>' if d in PLAY else '<span class="more" aria-hidden="true">くわしく →</span>')
            + (f'<a class="pill" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' if i else '') + '</div></li>')

# 12/1〜12/25 のアドベントカレンダー（クリスマスの期間だけ出る section の中）。とびらは日がわりで、ブラウザで遊べる今日の1問（/play/<app>/）へ。
# 開くのは「今日」のとびらだけ（前の日の問題はブラウザ版にないので、すぎた日はリンクなし）。どの日がどのアプリかはここで決める（site.js が今日のとびらを開く）
ADVENT_ROT = ['yudetamago', 'suji', 'hitofude', 'okazu', 'jimidrive', 'kakezan']   # 12/1 と 12/25 は クリスマスのたまご
ADVENT_EMO = {'hitofude': '🐛', 'suji': '🏠', 'okazu': '🍱', 'jimidrive': '🚗', 'kakezan': '🏃', 'yudetamago': '🥚'}

def advent():
    assert all(d in PLAY and d in DAILY for d in ADVENT_ROT)
    lis = ''
    for k in range(1, 26):
        d = ADVENT_ROT[(k - 1) % len(ADVENT_ROT)]
        t = DAILY_LINE[d].split('：', 1)[0].split('・')[0]
        lis += (f'<li data-day="{k}" data-d="{d}" data-e="{ADVENT_EMO[d]}" data-t="{esc(t)}" data-n="{esc(NAMES[d][0])}">'
                f'<span class="dn" aria-label="12月{k}日">{k}</span></li>')
    return ('<div class="advent" data-advent><div class="snow" aria-hidden="true"></div><h3>まいにち1まい、とびらをあけよう</h3>'
            '<p class="s">アドベントカレンダーのとびらの中は、その日の「今日の1問」。あけるアプリは日がわりで、ブラウザでそのまま遊べます。</p>'
            f'<ol class="doors" aria-label="12月1日から25日のとびら">{lis}</ol>'
            '<p class="note2">とびらが開くのは その日だけです（日本時間）。開けた日は この端末に✓がつきます（どこにも送りません）。</p></div>')

def season_secs():
    out = []
    for k, e, t, lead, cards in SEASONS:
        if k == 'xmas':   # 見出しのすぐ下にアドベントカレンダー。アプリのクリスマスの見た目はその下
            top = (f'<div class="sec-h"><h2 id="h-{k}">{e} {esc(t)}</h2></div>{advent()}'
                   f'<div class="sec-h season-sub"><h3 id="h-{k}-apps">アプリの中も、クリスマス</h3><p>{esc(lead)}</p></div>')
            lab = f'h-{k}-apps'
        else:
            top = f'<div class="sec-h"><h2 id="h-{k}">{e} {esc(t)}</h2><p>{esc(lead)}</p></div>'
            lab = f'h-{k}'
        out.append(f'<section class="sec season {k}" data-season="{k}" aria-labelledby="h-{k}" hidden><div class="wrap">{top}'
                   f'<ul class="rail" aria-labelledby="{lab}">{"".join(season_card(*c) for c in cards)}</ul></div></section>')
    return out

HERO_SHOTS = [('suji', '4_daily', 'すうじのへやの「今日のへや割り」の画面'),
              ('hitofude', '5_daily', 'ひとふでいもむしの「今日のいもむし」の画面'),
              ('okazu', '5_daily', 'おかず詰めパズルの「今日のおべんとう」の画面')]

# 本当の数だけ（site_lab 10_real_facts）。どれもここで数える: 公開中のアプリ（App Store の id があるもの）・毎日の1問・ブラウザで遊べる今日の1問・
# 紹介文（content.py の SEO）に書いてあるステージ数と詰将棋の問題数・はじめてのアプリの公開日からの日数（site.js が表示の日に数えなおす）。人数・評価はのせない
SHORT = {'hitofude': 'いもむし', 'suji': 'すうじ', 'okazu': 'おかず'}

def facts():
    pub = [d for d in ALL if NAMES[d][1]]
    stages = {d: int(m.group(1)) for d in ALL for m in [re.search(r'全(\d+)ステージ', SEO[d][1])] if m}
    tsume = [int(m.group(1)) for d in ALL for m in [re.search(r'詰将棋(\d+)問', SEO[d][1])] if m]
    first = min(RELEASE_FIX_N.get(d) or jst_date(r['releaseDate']) for d, r in LOOKUP_T.items())
    y, m, dd = map(int, first.split('-'))
    days = (datetime.date.today() - datetime.date(y, m, dd)).days
    soon = len(ALL) - len(pub)
    lis = [(len(pub), '本', f'App Store で公開中の iPhone アプリ' + (f'（ほかに近日公開 {soon}本）' if soon else '')),
           (len(DAILY), '本', 'で、毎日みんな同じ1問'),
           (len([d for d in PLAY if d in DAILY]), 'つ', 'の今日の1問が、ブラウザでも遊べる（登録なし）'),
           (sum(stages.values()), 'ステージ', '・'.join(f'{SHORT.get(d, NAMES[d][0])} {n}' for d, n in stages.items()))]
    if tsume: lis.append((tsume[0], '問', '変則将棋対戦の変則詰将棋'))
    lis.append((days, '日', f'はじめてのアプリを公開してから（{NAMES[min(LOOKUP_T, key=lambda d: RELEASE_FIX_N.get(d) or jst_date(LOOKUP_T[d]["releaseDate"]))][0]}・{y}/{m}/{dd}）'))
    body = ''.join(f'<li><b' + (f' data-since="{first}"' if u == '日' else '') + f'>{n}</b><small>{u}</small><span>{esc(t)}</span></li>' for n, u, t in lis)
    return ('<section class="sec facts2" aria-labelledby="h-facts"><div class="wrap"><div class="sec-h"><h2 id="h-facts">🔢 数字で見る いまのアプリ</h2>'
            '<p>ぜんぶ本当の数です（遊んでいる人の数や評価の数はのせていません）。</p></div>'
            f'<ul class="fg">{body}</ul></div></section>')

# トップ（/）＝「いま」の個人のホームページ（2026-11-19 ユーザー承認: 根本の案・案A）。
# サイトの名前（WebSite・Organization）は「いまのアプリ」のまま。作っている人の名前は「いま」。
# 前のトップにしかなかったものの移り先: 「ここで1問」（今日のいもむし）→ /today/、「数字で見る」→ /apps/、カレンダー・カウントダウン・ランキングの例 → /today/（もとからある）
CREW = [('01_imomushi', 'いもむしのキャラクター'), ('02_bento', 'お弁当のキャラクター'), ('03_tamago', 'ゆでたまごのキャラクター'),
        ('04_natto', '納豆のキャラクター'), ('05_shogi', '将棋の駒のキャラクター')]   # /apps/home/*.webp（256px。元は zip の 04_images/characters_and_banners_v2）
GUIDE = [('hitofude-kotsu', '一筆書きパズルのコツ｜行き止まりを先に見つける考え方', '2026-11-19'),
         ('mainichi-1mon-puzzle', '毎日1問のパズルアプリの選び方｜5つの見るポイント', '2026-11-19'),
         ('make-10-anzan', '4つの数字で10を作る暗算のコツ｜5つの考え方', '2026-11-19')]   # /guide/ の読み物（手で書いたページ）。新しい順
DESC_TOP = ('将棋・ポーカー・アプリ開発が好きな「いま」のホームページ。毎日1問のパズルなど無料のiPhoneアプリ「いまのアプリ」と、'
            'パズルのコツの読み物、noteの記事をまとめています。')

def page_home():
    g = {"@context": "https://schema.org", "@graph": [ORG,
         {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": BRAND, "alternateName": "imaimaha のアプリ", "inLanguage": "ja", "publisher": {"@id": BASE + "/#org"}},
         itemlist()]}
    L = [head('/', f'{BRAND}｜「いま」が作る小さなiPhoneアプリと読み物', DESC_TOP, [g], preload='/apps/home/01_imomushi.webp'), header('/'), '<main id="main">']
    crew = ''.join(f'<img src="/apps/home/{f}.webp" width="110" height="110" alt="{esc(alt)}">' for f, alt in CREW)
    L.append('<section class="homehero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span></div><div class="wrap"><div>'
             '<h1><span class="nw">小さなアプリを</span><span class="nw">つくって、</span><br><span class="nw">ときどき書いて</span><span class="nw">います。</span></h1>'
             f'<p class="lead">「いま」のホームページです。毎日1問のパズルなど、無料の iPhone アプリ「{BRAND}」をひとりで作っています。アプリのことも、ふだんのことも、ここに書いていきます。</p>'
             '<div class="ctas"><a class="go" href="/play/" data-confetti>▶ 今日の1問をあそぶ</a><a class="ghost" href="/apps/">アプリ一覧</a></div></div>'
             f'<div class="crew" role="img" aria-label="アプリのキャラクターたち（いもむし・お弁当・ゆでたまご・納豆・将棋の駒）">{crew}</div></div></section>')
    L.extend(season_secs())
    L.append('<section class="sec white" aria-labelledby="h-daily"><div class="wrap"><div class="sec-h rv"><h2 id="h-daily">📅 今日の1問</h2>'
             '<a class="more-link" href="/today/">今日の問題をぜんぶ見る →</a><p>みんな同じ問題。サインインなし、ニックネームだけでランキングに参加できます。</p></div>'
             f'<ul class="rail" aria-label="今日の問題で勝負できるアプリ">{"".join(daily_card(d) for d in DAILY)}</ul></div></section>')
    reads = ''.join(f'<li><a href="/guide/{s}/">{gtitle(t)}</a></li>' for s, t, _ in GUIDE)
    L.append('<section class="sec" aria-labelledby="h-read"><div class="wrap"><div class="sec-h rv"><h2 id="h-read">📖 読み物</h2><a class="more-link" href="/guide/">ぜんぶ見る →</a></div>'
             f'<ul class="readlist rv">{reads}</ul></div></section>')
    tiles = ''.join(f'<li class="ctile tilt rv"><span class="e" aria-hidden="true">{CAT_EMO[cid]}</span><h3><a class="stretch" href="/apps/#{cid}">{esc(lb)}</a></h3>'
                    f'<p>{CAT_SUB[cid]}・{len(ds)}本</p><div class="ics" aria-hidden="true">' + ''.join(f'<img src="/{d}/icon-256.webp" width="28" height="28" alt="" loading="lazy">' for d in ds) + '</div></li>'
                    for cid, lb, ds in CATS)
    others = [d for d in ALL if d not in DAILY]
    L.append('<section class="sec tint" aria-labelledby="h-genre"><div class="wrap"><div class="sec-h rv"><h2 id="h-genre">🔎 ジャンルからさがす</h2>'
             f'<a class="more-link" href="/apps/">アプリ一覧 →</a></div><ul class="ctiles">{tiles}</ul>'
             '<div class="sec-h rv" style="margin-top:34px"><h2 id="h-more" style="font-size:22px">✨ ほかにも、こんなアプリ</h2></div>'
             f'<ul class="rail" aria-labelledby="h-more">{"".join(app_card(d) for d in others)}</ul></div></section>')
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

def here_play():   # 前のトップの「今日のいもむしを ここで1問」（/today/ に移した）。押したときだけ /play/hitofude/logic.js と /apps/hero-play.js を読む（site.js）
    return (f'<div class="hpm" id="hpm"><div class="hpm-hd"><p><b>🐛 今日のいもむしを ここで1問</b><small>アプリと同じ今日の盤・登録なし</small></p>'
            f'<button type="button" class="go sm" data-hp="{V}">▶ ここで遊ぶ</button></div><div id="hpm-body" hidden></div></div>')

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
    body = ('<div class="wrap"><p class="startbar"><a href="/start/"><span aria-hidden="true">🧭</span><span>どれが合うか迷ったら、<b>3問で診断</b> →</span></a></p>'
            '<div class="filters" id="filters" role="group" aria-label="ジャンルで絞りこむ" hidden>' + chips + '</div>'
            '<label class="search" hidden><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="アプリの名前やことばでさがす" aria-label="アプリをさがす"></label>'
            '<p class="empty" id="empty" hidden>見つかりませんでした。ほかのことばでさがしてみてください。</p></div>' + secs)
    g = {"@context": "https://schema.org", "@graph": [ORG, itemlist()]}
    body += facts()   # 前のトップの「数字で見る いまのアプリ」
    sub_page('/apps/', 'アプリ一覧', f'{BRAND}｜毎日1問のパズルなど無料のiPhoneアプリ一覧', DESC_HOME,
             f'ぜんぶで {len(ALL)} 本、どれも無料で使えます。', body, [g])

def page_today():
    lis = ''
    for k, d in enumerate(DAILY):
        name, i, _ = NAMES[d]; t, w = DAILY_LINE[d].split('：', 1)
        lis += (f'<li class="rv" style="{cv(d)}"><span class="no">{k + 1:02d}</span><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
                f'<div><p class="nm">{esc(name)}</p><h3>{esc(t)}</h3><p class="w">{esc(w)}</p></div>'
                f'<div class="acts"><a class="go sm" href="{store(i)}">アプリで挑戦</a>' + (f'<a class="go sm" href="/play/{d}/">▶ ブラウザで1問あそぶ</a>' if d in PLAY else '') +
                f'<a class="ghost" href="/{d}/">くわしく</a></div></li>')
    body = (f'<section class="sec white" style="padding-top:30px"><div class="wrap">{here_play()}<div class="today">{calendar(big=True)}{countdown()}{rsample("h2")}</div></div></section>'
            '<section class="sec"><div class="wrap"><div class="sec-h rv"><h2>今日の問題があるアプリ</h2>'
            '<p>どのアプリも、今日の問題はみんな同じ。アプリをひらいて「今日の〜」から挑戦できます。</p></div>'
            f'<ol class="dlist">{lis}</ol></div></section>'
            '<section class="sec tint" aria-labelledby="h-dg"><div class="wrap dgwrap"><div class="sec-h"><h2 id="h-dg">🧾 今日のまとめ</h2>'
            '<p>ブラウザで遊んだ今日の1問を、1まいにまとめます。✅ と ⬜ だけのシェアの文も作れます（答えはのせません）。</p></div>'
            '<div id="digest" class="digest"><p>ブラウザで遊んだ今日の1問が、ここにまとまります（記録はこの端末の中だけ）。'
            '<a href="/play/">ブラウザで遊ぶ →</a></p></div></div></section>'
            f'<script src="/play/digest.js?v={V}" defer></script>'
            '<section class="sec white"><div class="wrap"><div class="sec-h rv"><h2>今日の問題のしくみ</h2><div class="cols c3">'
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
            '毎日の問題は、だれでも同じ盤でくらべられるようにしています。企画・デザイン・プログラム・App Store への申請まで、ひとりで作っています。</p>'
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
             '「いま」は作っている人の名前、「いまのアプリ」は いまが作っているアプリのまとまりの名前です。', body, [person_page, ORG_LD])

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
            '<div class="box rv" id="glossary"><h2>📖 ことばの説明</h2><p>ゲームの中の しかけ（石・ワープ・バラン・安南将棋など）は、絵つきの あそびかた図鑑にまとめています。</p><p><a class="more-link" href="/zukan/">📖 あそびかた図鑑を見る →</a></p><dl class="gloss">' +
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

import zukan as ZK
def hf_svg(spec, label):   # 盤と道の絵（zukan.py と同じ絵）。ワープで飛んだところは線を切る
    w, h, inner = ZK.hf_inner(spec['map'], spec['path'])
    return f'<svg class="hfb" viewBox="0 0 {w} {h}" width="{w * 2}" height="{h * 2}" role="img" aria-label="{esc(label)}">{inner}</svg>'

def heya_svg():
    return ZK.heya().replace('<svg ', '<svg class="hfb" width="256" height="256" ', 1)

ZUKAN_APPS = [x[0] for x in ZK.sections()]
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
    zk = (f'<p class="zklink"><a class="more-link" href="/zukan/#{d}">📖 しかけを絵で見る（あそびかた図鑑） →</a></p>' if d in ZUKAN_APPS else '')
    return (f'<section class="block rules" id="rules" aria-labelledby="h-rules"><div class="wrap"><h2 id="h-rules">📘 {head_t}</h2>'
            f'<ul class="rulelist">{lis}</ul>{zk}</div></section>')

def demo_section(d):
    name = NAMES[d][0]; a = APPS[d]
    seo_t, seo_d = SEO[d]
    what = f'<p class="what-a"><b>{esc(name)}</b>は、{esc(a["desc"])}</p>'
    if d in VIDEO:
        media = (f'<div class="vphone"><video muted loop playsinline preload="none" poster="play.jpg" width="390" height="844" data-vsrc="play.mp4" '
                 f'aria-label="{esc(name)} のプレイのようす（音なし）"></video></div><p class="vcap">▶ プレイのようす（音なし）</p>')
    else:
        imgs = ''.join(f'<div class="slide" style="--k:{k}">{scr(d, f, alt)}</div>' for k, (f, alt) in enumerate(SHOTS[d][:4]))
        media = f'<div class="vphone slides" aria-label="{esc(name)} の画面">{imgs}</div><p class="vcap">アプリの画面</p>'
    return (f'<section class="block demo" aria-labelledby="h-what"><div class="wrap demo-in"><div class="media rv">{media}</div>'
            f'<div class="whatbox rv"><h2 id="h-what">{esc(name)}とは？</h2>{what}'
            f'<ul class="facts"><li><b>料金</b>{esc(a.get("ads", ADS))}</li><li><b>対応</b>iPhone（iOS {a.get("minos", "18")} 以降）</li>'
            f'<li><b>ジャンル</b><a href="/apps/{CAT_OF[d][0]}/">{CAT_EMO[CAT_OF[d][0]]} {esc(CAT_OF[d][1])}</a></li>' +
            (f'<li><b>今日の問題</b><a href="/today/">毎日0時（日本時間）にかわる</a></li>' if d in DAILY else '') +
            '</ul>' + (f'<p class="playbtn"><a class="go sm" href="/play/{d}/">{play_label(d)}</a>　<span>{esc(PLAY_NOTE.get(d, "登録なし"))}</span></p>' if d in PLAY and d not in DAILY else '') +
            '</div></div></section>')

# 見どころの短い動画（広告用に作った r2 のご褒美カードの 720x1280 版・本物の画面・音なし・約4秒のループ）。/<app>/media/midokoro.mp4 と .jpg（ポスター）。
# 元: ~/Developer/promo/ads/r2/reward/<key>_720.mp4（ポスターは同じ名前の .jpg を 360x640 に）。季節もの・英語・招待リンクのものは使わない。
# ふたり大富豪は r4 の futaridaifugo_r4a_kakumei_720.mp4（2026-11-19 公開後に追加）
MIDOKORO = {'hitofude': '一筆で ぜんぶ食べられる？', 'suji': 'このへや 何秒で分けられる？', 'okazu': '1列そろうと ぱくっ！',
            'kakezan': '+20 と ×2 どっちが大きい？', 'jimidrive': '作れる？ 無理？ 一瞬で判断', 'yudetamago': 'ゆっくり… ツルンッ',
            'nattofilm': 'クルクル… ねばーっ', 'madoshizuku': '雨の窓を なぞるだけ', 'hensokushogi': 'いつもの将棋が まるでちがう',
            'gekokujo': '次は 何を出す？', 'pokerstudy': 'この席なら どうする？', 'sanpobingo': 'いつもの道が ビンゴになる', 'tsundoku': '何冊 積んでる？',
            'futaridaifugo': '同じ数字4枚で 革命！'}
def midokoro_section(d):
    if d not in MIDOKORO or not NAMES[d][1] or not os.path.exists(f'{R}/{d}/media/midokoro.mp4'): return ''
    name = NAMES[d][0]; hook = MIDOKORO[d]
    return (f'<section class="block midokoro" aria-labelledby="h-mdk"><div class="wrap mdk-in"><div class="mdk-v rv">'
            f'<video muted loop playsinline preload="none" poster="media/midokoro.jpg" width="360" height="640" data-vsrc="media/midokoro.mp4" '
            f'aria-label="{esc(name)} の見どころ「{esc(hook)}」（音なし・約4秒）"></video></div>'
            f'<div class="mdk-t rv"><h2 id="h-mdk">✨ 見どころ</h2><p class="mdk-hook">{esc(hook)}</p>'
            f'<p><a class="more-link" href="{store(NAMES[d][1])}">App Store で見る →</a></p></div></div></section>')

def today_mini(d):
    if d not in DAILY: return ''
    name, i, _ = NAMES[d]; k, w = DAILY_LINE[d].split('：', 1)
    play = f'<a class="go sm" href="/play/{d}/">▶ ブラウザで1問あそぶ</a>' if d in PLAY else ''
    return (f'<section class="block todaymini" aria-labelledby="h-tm"><div class="wrap"><div class="today">{calendar()}{countdown()}'
            f'<div class="tmtext rv"><h2 id="h-tm">📅 {esc(k)}</h2><p>{esc(w)}。</p>'
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
    gen.topbar = lambda: header('/apps/', alt=EN_ALT.get(f'/{d}/'))
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
    if hreflang_links(f'/{d}/'):   # 英語のページがあるアプリ
        k = out.index('<link rel="canonical"'); k = out.index('\n', k) + 1
        out = out[:k] + hreflang_links(f'/{d}/') + '\n' + out[k:]
        out = out.replace('<meta property="og:locale" content="ja_JP">', '<meta property="og:locale" content="ja_JP">\n<meta property="og:locale:alternate" content="en_US">', 1)
    out = out.replace('<main>', '<main id="main">\n' + crumb(cr), 1)
    # 入れる場所
    k = out.index('<section class="shots"'); out = out[:k] + demo_section(d) + '\n' + midokoro_section(d) + '\n' + out[k:]
    if d in DAILY:
        k = out.index('<section class="block rank"'); k = out.index('</section>', k) + len('</section>'); out = out[:k] + '\n' + today_mini(d) + out[k:]
    k = out.index('<h2>遊び方は3ステップ</h2>'); k = out.index('</section>', k) + len('</section>'); out = out[:k] + '\n' + rules_section(d) + out[k:]
    k = out.index('<section class="block support"'); out = out[:k] + updates_section(d) + '\n' + aeo_section(d) + '\n' + out[k:]
    out = out.replace('</body>', f'<script src="/apps/site.js?v={V}" defer></script>\n</body>', 1)
    out = out.replace('<link rel="icon" href="icon-256.webp" type="image/webp">\n<link rel="apple-touch-icon" href="icon.png">', ICON_LINKS, 1)
    assert ICON_LINKS in out
    out = nowrap_text(out)
    open(f'{R}/{d}/index.html', 'w', encoding='utf-8').write(out)

# ---------------- 読み物（/guide/） ----------------
# 本文は guide/<slug>.html（1行目の <!-- {...} --> に title・short・desc・lead・published・modified）。このファイルが head・ヘッダー・フッター・JSON-LD をつける。
# よくある質問（<details class="qa">）は、本文から FAQPage の JSON-LD も作る。一覧（トップ・/guide/）の順は GUIDE（新しい順）
def gtitle(t):   # 「本題｜サブ」→ サブを2行目に（一覧で「｜」が行の頭に来ないように）
    a, _, b = t.partition('｜')
    return esc(a) + (f'<span class="st">{esc(b)}</span>' if b else '')

def guide_meta(slug):
    s = open(f'{HERE}/guide/{slug}.html', encoding='utf-8').read()
    m = re.match(r'<!-- (\{.*?\}) -->\n', s)
    return json.loads(m.group(1)), s[m.end():]

def jp_date(iso):
    y, m, d = map(int, iso.split('-')); return f'{y}年{m}月{d}日'

PERSON = {"@type": "Person", "@id": BASE + "/about/#ima", "name": "いま", "url": BASE + "/about/"}

def page_guide_article(slug):
    meta, body = guide_meta(slug)
    path = f'/guide/{slug}/'; og = 'guide-' + slug
    OG_PAGES[og] = (meta['short'], meta['desc'])
    cr = [('/', 'ホーム'), ('/guide/', '読み物'), (None, meta['short'])]
    art = {"@context": "https://schema.org", "@type": "Article", "headline": meta['title'], "description": meta['desc'],
           "datePublished": meta['published'], "dateModified": meta['modified'], "inLanguage": "ja", "mainEntityOfPage": BASE + path,
           "image": f'{BASE}/apps/og/{og}.jpg', "author": PERSON,
           "publisher": {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND, "logo": {"@type": "ImageObject", "url": BASE + "/apps/logo.png"}}}
    qa = re.findall(r'<details class="qa[^"]*"><summary>(.*?)</summary><div class="a">(.*?)</div></details>', body, re.S)
    lds = [crumb_ld(cr, path), art]
    if qa:
        lds.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": re.sub('<[^>]+>', '', q), "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a).strip()}} for q, a in qa]})
    dl = (f'<p class="rv dateline"><time datetime="{meta["published"]}">{jp_date(meta["published"])}</time> 公開' +
          (f'・<time datetime="{meta["modified"]}">{jp_date(meta["modified"])}</time> 更新' if meta['modified'] != meta['published'] else '') + '　')
    body = body.replace('<p class="rv dateline">', dl, 1)
    others = ''.join(f'<li><a href="/guide/{s}/">{gtitle(t)}</a></li>' for s, t, _ in GUIDE if s != slug)
    h = head(path, meta['title'], meta['desc'], lds, og_img=f'{BASE}/apps/og/{og}.jpg', og_type='article')
    h = h.replace('<meta property="og:type" content="article">', f'<meta property="og:type" content="article">\n<meta property="article:published_time" content="{meta["published"]}">', 1)
    L = [h, header('/guide/'), '<main id="main">',
         '<section class="phero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span></div>' + crumb(cr) +
         f'<div class="wrap"><h1>{esc(meta["title"])}</h1><p class="lead2">{meta["lead"]}</p></div></section>',
         f'<article class="sec" style="padding-top:20px"><div class="narrow">{body}'
         f'<div class="sec-h rv" style="margin-top:30px"><h2 style="font-size:22px">📖 ほかの読み物</h2><a class="more-link" href="/guide/">ぜんぶ見る →</a></div><ul class="readlist rv">{others}</ul>'
         '</div></article>', '</main>', tail()]
    write(path, '\n'.join(L))

def page_guide():
    for s, _, _ in GUIDE: page_guide_article(s)
    lis = ''
    for s, t, dt in GUIDE:
        meta, _ = guide_meta(s)
        lis += f'<li><a href="/guide/{s}/">{gtitle(t)}<small class="gd">{esc(meta["desc"])}</small></a></li>'
    items = {"@context": "https://schema.org", "@type": "ItemList", "name": "読み物", "itemListElement": [
        {"@type": "ListItem", "position": k + 1, "url": f'{BASE}/guide/{s}/', "name": t} for k, (s, t, _) in enumerate(GUIDE)]}
    body = (f'<section class="sec" style="padding-top:20px"><div class="narrow"><ul class="readlist">{lis}</ul>'
            '<p class="rv" style="margin-top:18px">パズルのコツや、作っていて気づいたことなどを、ゆっくり増やしていきます。</p></div></section>')
    sub_page('/guide/', '読み物', f'読み物｜パズルのコツと遊び方のメモ｜{BRAND}',
             'パズルのコツや遊び方のメモをまとめています。毎日1問のパズルアプリをつくる「いま」が書いています。',
             'パズルのコツや遊び方のメモです。', body, [items])

# ---------------- 新しいページ ----------------
def page_category(cid):
    lb = dict((c, l) for c, l, _ in CATS)[cid]; ds = dict((c, x) for c, _, x in CATS)[cid]
    h1, intro = CAT_INTRO[cid]
    items = [{"@type": "ListItem", "position": k + 1, "url": f"{BASE}/{d}/", "name": NAMES[d][0]} for k, d in enumerate(ds)]
    others = ''.join(f'<li><a href="/apps/{c}/"><span aria-hidden="true" style="font-size:24px">{CAT_EMO[c]}</span><span>{esc(l)}</span></a></li>' for c, l, _ in CATS if c != cid)
    body = (f'<section class="sec" style="padding-top:16px"><div class="wrap"><ul class="grid">{"".join(app_card(d, k=True) for d in ds)}</ul></div></section>'
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
             '「いま」がいま作っているもの・つぎにやること・さいきんの更新。ふたり大富豪の公開、クリスマスとお正月の期間限定、友達を招待するリンク、ブラウザで遊べる今日の1問など。',
             'いま作っているものと、つぎにやること。ときどき書きかえます。', body, og='now')

def page_sitemap():
    groups = [('あそぶ', [('/', 'ホーム'), ('/start/', 'どれが合う？3問で診断'), ('/today/', '今日の問題'), ('/play/', 'ブラウザで遊ぶ'), ('/zukan/', 'あそびかた図鑑（しかけとルール）'), ('/ranking/', 'ランキングのしくみ'), ('/news/', 'お知らせ・更新情報')]),
              ('アプリ', [('/apps/', 'アプリ一覧')] + [(f'/apps/{c}/', l) for c, l, _ in CATS]),
              ('いまのこと', [('/about/', '作っている人'), ('/guide/', '読み物'), ('/now/', 'いま やっていること')] + ([('/note/', 'note の記事')] if NOTE_ON else [])),
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
    'futaridaifugo': ('futaridaifugo', 5, '6836394499', '「オンライン対戦」の「コード」'),
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

# ---------------- /start/ どれが合う？（3つの質問で、さいしょの1本） ----------------
# 2026-11-20 site_lab の 09_start_chooser から。点数の計算は site.js（#chooser）。答えはこの画面の中だけ（どこにも送らない）
START_WHY = {
    'hitofude': 'なぞるのが気持ちいい一筆書き。毎日の盤でタイム勝負',
    'okazu': 'おかずをつめて列をそろえる、お弁当のブロックパズル',
    'suji': '数字をヒントに、じっくりへやを分ける数字パズル',
    'jimidrive': '車のナンバー4桁で10を作る、テンポのいい暗算',
    'kakezan': '計算ゲートをくぐって数をふやす、走る暗算',
    'yudetamago': '殻をツルッとむく手ざわり。毎日のたまごでスコア勝負',
    'nattofilm': '納豆のフィルムを、きれいにはがす。毎日の納豆でタイム勝負',
    'madoshizuku': '雨の窓でしずくを集める、ぼーっとできる時間',
    'hensokushogi': '安南将棋・トランプ将棋などを友達とオンライン対戦',
    'gekokujo': '1が9に勝つ、数字カードの読み合い。CPU とも',
    'pokerstudy': 'ポーカーのプリフロップを、クイズでおぼえる練習帳',
    'futaridaifugo': '赤と黒に分けて、1対1で遊ぶ大富豪。CPU とも',
}
START_QS = [
    ('Q1. どんなときに あそぶ？', [('⏱️', 'すきまの1分', {'jimidrive': 2, 'yudetamago': 2, 'nattofilm': 2, 'hitofude': 1, 'kakezan': 1}),
                                ('☕', 'のんびり10分', {'suji': 2, 'okazu': 2, 'madoshizuku': 2, 'pokerstudy': 1}),
                                ('👥', '友達と', {'hensokushogi': 3, 'gekokujo': 3, 'futaridaifugo': 3})]),
    ('Q2. すきなのは？', [('✍️', 'なぞる・つめる', {'hitofude': 3, 'okazu': 3}), ('🔢', '数字・計算', {'suji': 2, 'jimidrive': 3, 'kakezan': 3}),
                       ('🫧', 'さわって気持ちいい', {'yudetamago': 3, 'nattofilm': 3, 'madoshizuku': 3}), ('🧠', '読み合い', {'gekokujo': 3, 'hensokushogi': 2, 'pokerstudy': 3, 'futaridaifugo': 2})]),
    ('Q3. 勝負したい？', [('🏆', 'みんなとランキング', {d: 2 for d in DAILY}), ('🌿', '自分のペースで', {'madoshizuku': 2, 'pokerstudy': 2, 'suji': 1}),
                       ('⚔️', '1対1で', {'gekokujo': 2, 'hensokushogi': 2, 'futaridaifugo': 2})]),
]

def why_html(t):   # さいごの「、」「。」のあとは折り返さない（1〜2文字だけの行を作らない）
    k = max(t.rfind('、'), t.rfind('。')) + 1
    return esc(t[:k]) + f'<span class="nw">{esc(t[k:])}</span>' if 0 < k and len(t) - k <= 16 else esc(t)

def start_cand(d):
    name, i, _ = NAMES[d]
    acts = (f'<a class="go sm2" href="/play/{d}/">{play_label(d)}</a>' if d in PLAY else '') + \
           f'<a class="pill" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' + \
           f'<a class="ghost sm2" href="/{d}/">くわしく</a>'
    return (f'<li class="cand" data-app="{d}" style="{cv(d)}"><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div class="tx"><h3><a href="/{d}/">{esc(name)}</a></h3><p>{why_html(START_WHY[d])}</p>'
            + ('<p class="pl">ブラウザでも遊べます（登録なし）</p>' if d in PLAY else '') + f'<div class="acts">{acts}</div></div></li>')

def page_start():
    assert all(NAMES[d][1] for d in START_WHY)
    qh = ''
    for k, (q, opts) in enumerate(START_QS):
        btns = ''.join(f'<button type="button" data-w="{esc(json.dumps(w, separators=(",", ":")))}"><span aria-hidden="true">{e}</span>{esc(t)}</button>' for e, t, w in opts)
        qh += f'<div class="q" data-q="{k}"{"" if k == 0 else " hidden"}><h2 id="q{k}">{esc(q)}</h2><div class="opts" role="group" aria-labelledby="q{k}">{btns}</div></div>'
    steps = ''.join(f'<i{" class=on" if k == 0 else ""}></i>' for k in range(len(START_QS)))
    quiz = (f'<div class="qbox" id="chooser" hidden><div class="steps" aria-hidden="true">{steps}</div>{qh}'
            '<div class="res" id="res" hidden><p class="k" tabindex="-1" id="res-k">あなたに合いそうなのは</p><ul class="cands one" id="res-top"></ul>'
            '<p class="also-h">こっちも合いそう</p><ul class="also" id="res-also"></ul>'
            '<button class="again" id="res-again" type="button">↺ もう一度えらぶ</button></div></div>'
            '<p class="cap">答えはこの画面の中だけで決めています（どこにも送りません）。</p>')
    cands = ''.join(start_cand(d) for d in START_WHY)
    life = '・'.join(f'<a href="/{d}/">{esc(NAMES[d][0])}</a>' for d in dict(((c, x) for c, _, x in CATS))['life'])
    body = (f'<section class="sec white" style="padding-top:26px"><div class="narrow">{quiz}</div></section>'
            '<section class="sec" aria-labelledby="h-cands"><div class="wrap"><div class="sec-h"><h2 id="h-cands">🎮 えらべるアプリ</h2>'
            f'<p>診断にでてくる {len(START_WHY)} 本です。ブラウザで遊べるものは、アプリを入れなくても今日の1問へ。</p></div>'
            f'<ul class="cands" id="cands">{cands}</ul>'
            f'<p class="more-life">毎日の記録に使うアプリ（{life}）は、<a href="/apps/life/">くらし・記録のアプリ</a>へ。</p></div></section>')
    items = [{"@type": "ListItem", "position": k + 1, "url": f"{BASE}/{d}/", "name": NAMES[d][0]} for k, d in enumerate(START_WHY)]
    desc = ('パズル・のんびりゲーム・対戦。いまのアプリの iPhone アプリから、3つの質問に答えるだけで合いそうな1本をえらびます。ブラウザで遊べるものは、そのまま今日の1問へ。')
    wp = {"@context": "https://schema.org", "@type": "WebPage", "@id": BASE + "/start/#page", "url": BASE + "/start/", "name": "どれが合う？3問で診断",
          "description": desc, "inLanguage": "ja", "isPartOf": {"@type": "WebSite", "@id": BASE + "/#website", "name": BRAND, "url": BASE + "/"},
          "mainEntity": {"@type": "ItemList", "name": "診断にでてくるアプリ", "numberOfItems": len(items), "itemListElement": items}}
    sub_page('/start/', 'どれが合う？', f'どれが合う？3問で診断｜さいしょの1本をえらぶ｜{BRAND}', desc,
             f'アプリが {len(ALL)} 本あって迷ったら。3つの質問に答えると、合いそうな1本をえらびます。',
             body, [wp], crumbs=[('/', 'ホーム'), (None, 'どれが合う？')], og='start')

# ---------------- 404（GitHub Pages が、ないページのときに出す /404.html） ----------------
# ---------------- /zukan/ あそびかた図鑑（しかけ・ルールを絵でひとつずつ） ----------------
def tail_nw(t, n=6):   # さいごの数文字は折り返さない（1〜2文字だけの行を作らない）
    return esc(t) if len(t) <= n + 2 else esc(t[:-n]) + f'<span class="nw">{esc(t[-n:])}</span>'

def page_zukan():
    secs = ZK.sections()
    url = BASE + '/zukan/'
    terms = []; n = 0; body = ''
    jump = ''.join(f'<li><a href="#{d}"><img src="/{d}/icon-256.webp" width="28" height="28" alt="" loading="lazy"><span>{esc(t)}</span></a></li>' for d, t, _, _ in secs)
    for d, t, intro, items in secs:
        cards = ''
        for zid, term, text, art in items:
            n += 1
            cards += (f'<li class="zc rv" id="{zid}"><div class="zart">{art}</div><span class="no">No.{n:02d}</span>'
                      f'<h3><dfn>{tail_nw(term, 4)}</dfn></h3><p>{tail_nw(text)}</p></li>')
            terms.append({"@type": "DefinedTerm", "@id": f"{url}#{zid}", "name": term, "description": text, "url": f"{url}#{zid}", "inDefinedTermSet": {"@id": url + "#set"}})
        extra = ''
        if d == 'hensokushogi':
            extra = ('<h3 class="zsub" id="sg-cards">🃏 特殊効果将棋の13まいのカード</h3><ul class="zfx">' +
                     ''.join(f'<li id="sg-fx-{k + 1}"><span class="e" aria-hidden="true">{e}</span><div><b><dfn>{esc(nm)}</dfn></b><span>{tail_nw(x)}</span></div></li>' for k, (e, nm, x) in enumerate(ZK.FX)) + '</ul>')
            for k, (e, nm, x) in enumerate(ZK.FX):
                terms.append({"@type": "DefinedTerm", "@id": f"{url}#sg-fx-{k + 1}", "name": f"{nm}（特殊効果将棋）", "description": x, "url": f"{url}#sg-fx-{k + 1}", "inDefinedTermSet": {"@id": url + "#set"}})
        links = f'<a class="more-link" href="/{d}/">{esc(t)}のページ →</a>'
        if d in PLAY: links += f'<a class="more-link" href="/play/{d}/">{play_label(d)}</a>'
        body += (f'<section class="sec zsec" id="{d}" aria-labelledby="h-{d}" style="{cv(d)}"><div class="wrap"><div class="zh">'
                 f'<img src="/{d}/icon-256.webp" width="56" height="56" alt="" loading="lazy"><div><h2 id="h-{d}">{esc(t)}</h2><p>{tail_nw(intro, 8)}</p></div></div>'
                 f'<ul class="zg">{cards}</ul>{extra}<p class="zlinks">{links}</p></div></section>')
    body = (f'<section class="sec" style="padding:8px 0 0"><div class="wrap"><nav aria-label="アプリをえらぶ"><ul class="zjump">{jump}</ul></nav></div></section>' + body +
            '<section class="sec white"><div class="narrow"><div class="box rv"><h2>📖 ほかのことば</h2><p>「今日の問題」「ランキング」「テンパズル」などのことばは、'
            'よくある質問の「ことばの説明」にあります。遊び方の動画や画面は、各アプリのページでどうぞ。</p>'
            '<p><a class="more-link" href="/faq/#glossary">ことばの説明を見る →</a></p></div></div></section>')
    dts = {"@context": "https://schema.org", "@type": "DefinedTermSet", "@id": url + "#set", "name": "あそびかた図鑑", "url": url, "inLanguage": "ja",
           "description": "いまのアプリのゲームに出てくる しかけ・ルールの説明", "hasDefinedTerm": terms}
    sub_page('/zukan/', '📖 あそびかた図鑑', f'あそびかた図鑑｜パズルと変則将棋のしかけ｜{BRAND}',
             '石・矢印の葉・ワープ・キノコ・木の実（ひとふでいもむし）、へや割り・住人さがし、おかず詰めのごはん・バラン・こおり・小皿、安南・トランプ・王手・影武者・縛り将棋、ふたり大富豪のルールを絵でひとつずつ。',
             'アプリに出てくる しかけやルールを、小さな絵でひとつずつ。わからないマスや駒があったら、ここを見てね。', body, [dts],
             crumbs=[('/', 'ホーム'), (None, 'あそびかた図鑑')], og='zukan')

def page_404():
    out = head('/404.html', f'ページが見つかりません｜{BRAND}', 'お探しのページは見つかりませんでした。今日の問題・アプリ一覧・ブラウザで遊べる今日の1問へどうぞ。')
    out = re.sub(r'<link rel="canonical"[^>]*>\n', '', out)
    out = re.sub(r'<meta property="og:url"[^>]*>\n?', '', out)
    out = out.replace('<meta name="theme-color"', '<meta name="robots" content="noindex">\n<meta name="theme-color"', 1)
    links = [('/', '🏠', 'ホーム'), ('/today/', '📅', '今日の問題'), ('/play/', '🌐', 'ブラウザで遊ぶ'), ('/apps/', '📱', 'アプリ一覧'), ('/start/', '🧭', 'どれが合う？3問で診断')]
    lis = ''.join(f'<li><a href="{u}"><span aria-hidden="true" style="font-size:24px">{e}</span><span>{t}</span></a></li>' for u, e, t in links)
    body = ('<section class="phero nf"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span></div><div class="wrap">'
            '<p class="nf-e" aria-hidden="true">🐛❓</p><h1>ページが<span class="nw">見つかりません</span><span class="nw">でした</span></h1>'
            '<p class="lead2">URL がちがうか、ページが引っこしたのかもしれません。下のページからどうぞ。</p>'
            '<div class="ctas" style="margin-top:18px"><a class="go" href="/play/">▶ 今日の1問をブラウザで遊ぶ</a><a class="ghost" href="/">ホームへ</a></div></div></section>'
            f'<section class="sec white"><div class="narrow"><ul class="linklist" style="padding:0">{lis}</ul></div></section>')
    out = out + '\n' + header(None) + '\n<main id="main">\n' + body + '\n</main>\n' + tail()
    open(f'{R}/404.html', 'w', encoding='utf-8').write(nowrap_text(out))

# ---------------- OG 画像・llms.txt ----------------
def make_og(only=None):   # only: 作る画像の名前（OG_PAGES のキー）だけ。None なら全部
    from playwright.sync_api import sync_playwright
    os.makedirs(f'{R}/apps/og', exist_ok=True)
    icons = ''.join(f"<img src='file://{R}/{d}/icon-256.webp'>" for d in ALL[:10])
    with sync_playwright() as p:
        b = p.webkit.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for key, (t, desc) in OG_PAGES.items():
            if only is not None and key not in only: continue
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

def make_og_en():
    """英語のページの OGP 画像（1200x630）。日本語の make_og と同じ絵（クリーム色・青と緑の丸・ロゴ・見出し・説明・アイコン）を英語の文で。
    トップは /apps/og.jpg と同じ「アイコンのならび＋名前」の形。ゲームのページは右にそのアプリの大きいアイコン"""
    from playwright.sync_api import sync_playwright
    os.makedirs(f'{R}/apps/og', exist_ok=True)
    pub = [d for d in ALL if NAMES[d][1]]
    icons = ''.join(f"<img src='file://{R}/{d}/icon-256.webp'>" for d in ALL[:10])
    css = ("body{margin:0;width:1200px;height:630px;background:#fff7e8;font-family:'Hiragino Maru Gothic ProN','Hiragino Sans',sans-serif;color:#3b2b1f;position:relative;overflow:hidden}"
           ".b1{position:absolute;width:520px;height:520px;border-radius:50%;background:#bde0fe;right:-160px;top:-200px}.b2{position:absolute;width:300px;height:300px;border-radius:50%;background:#caffbf;left:-100px;bottom:-120px}"
           ".in{position:absolute;left:80px;top:90px;right:80px}.lg{font-size:34px;font-weight:800}.lg i{font-style:normal;color:#d9512b}"
           "h1{font-size:74px;line-height:1.15;margin:34px 0 18px}p{font-size:28px;line-height:1.5;color:#6b5848;margin:0;max-width:960px}"
           ".ic{position:absolute;left:80px;bottom:56px;display:flex;gap:16px}.ic img{width:70px;height:70px;border-radius:17px;box-shadow:0 4px 10px rgba(0,0,0,.15)}"
           ".app .in{right:440px}.app h1{font-size:60px}.app p{font-size:30px}.big{position:absolute;right:90px;top:150px;width:300px;height:300px;border-radius:68px;box-shadow:0 10px 30px rgba(0,0,0,.2)}"
           ".tag{position:absolute;left:80px;bottom:62px;font-size:26px;font-weight:800;color:#fff;background:var(--a);padding:12px 26px;border-radius:999px}"
           ".home{background:linear-gradient(135deg,#f4f6ff,#fff7ec)}.grid{position:absolute;left:0;right:0;top:100px;display:flex;flex-wrap:wrap;justify-content:center;gap:22px;padding:0 100px}"
           ".grid img{width:104px;height:104px;border-radius:24px;box-shadow:0 6px 14px rgba(0,0,0,.14)}.hn{position:absolute;left:0;right:0;top:380px;text-align:center}"
           ".hn h1{font-size:86px;color:#1f2d5c;margin:0}.hn p{max-width:none;font-size:32px;font-weight:800;color:#7a4a12;margin-top:22px}")
    def lg(): return f"<div class='lg'>Ima <i>Apps</i></div>"
    with sync_playwright() as p:
        b = p.webkit.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for key, (t, desc, d) in OG_EN.items():
            if key == 'home':
                grid = ''.join(f"<img src='file://{R}/{x}/icon-256.webp'>" for x in pub[:16])
                body = f"<body class='home'><div class='grid'>{grid}</div><div class='hn'><h1>{esc(BRAND_EN)}</h1><p>{esc(desc)} (iPhone · free)</p></div></body>"
            elif d:
                acc = APPS[d]['accent']; deep = colors(acc)[2]
                tag = 'Free iPhone game · App Store (Japan)' if NAMES[d][1] else 'Coming soon · App Store (Japan)'
                body = (f"<body class='app' style='--a:{deep}'><div class='b1'></div><div class='b2'></div><div class='in'>{lg()}<h1>{esc(t)}</h1><p>{esc(desc)}</p></div>"
                        f"<img class='big' src='file://{R}/{d}/icon-256.webp'><div class='tag'>{esc(tag)}</div></body>")
            else:
                short = desc if len(desc) <= 110 else desc[:desc.rfind(' ', 0, 108)] + '…'
                body = (f"<body><div class='b1'></div><div class='b2'></div><div class='in'>{lg()}<h1>{esc(t)}</h1><p>{esc(short)}</p></div><div class='ic'>{icons}</div></body>")
            open(f'{HERE}/og_tmp.html', 'w').write(f"<html lang='en'><head><meta charset='utf-8'><style>{css}</style></head>{body}</html>")
            pg.goto(f'file://{HERE}/og_tmp.html'); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{R}/apps/og/en-{key}.jpg', type='jpeg', quality=82)
        b.close()
    os.remove(f'{HERE}/og_tmp.html')

def llms():
    L = [f'# {BRAND}', '', '> 「いま」の個人のホームページ。いまがひとりで作っている iPhone アプリ（いまのアプリ）と読み物。アプリは、毎日みんなと同じ1問でランキング勝負できるパズルや、のんびりゲーム、変則将棋などの対戦、くらしの記録アプリ。どれも無料。', '',
         '## ページ', f'- [ホーム]({BASE}/): いまのホームページ（アプリ・読み物・note の記事）', f'- [今日の問題]({BASE}/today/): 毎日0時（日本時間）にかわる、みんな同じ1問',
         f'- [どれが合う？]({BASE}/start/): 3つの質問で、合いそうなアプリをえらぶ',
         f'- [あそびかた図鑑]({BASE}/zukan/): ゲームのしかけとルール（ひとふでいもむし・すうじのへや・おかず詰めパズル・変則将棋・ふたり大富豪・下剋上デュエル）を絵でひとつずつ',
         f'- [ランキングのしくみ]({BASE}/ranking/): サインインなし、ニックネームだけで参加', f'- [アプリ一覧]({BASE}/apps/): すべてのアプリ',
         f'- [読み物]({BASE}/guide/): パズルのコツと遊び方のメモ'] + [f'  - [{t}]({BASE}/guide/{s}/)' for s, t, _ in GUIDE] + [
         f'- [お知らせ]({BASE}/news/): アップデートとリリース', f'- [よくある質問]({BASE}/faq/): 無料・広告・データ・通知・機種変更',
         f'- [作っている人]({BASE}/about/): いま（将棋・ポーカー・アプリ開発が好き）', f'- [いま やっていること]({BASE}/now/)', f'- [お問い合わせ]({BASE}/contact/)', '', '## アプリ']
    for cid, lb, ds in CATS:
        L.append(f'### {lb}')
        for d in ds:
            L.append(f'- [{NAMES[d][0]}]({BASE}/{d}/): {SEO[d][1]} ' + (f'App Store: {store(NAMES[d][1])}' if NAMES[d][1] else 'App Store: 近日公開'))
    L += ['', '## そのほか', f'- App Store の開発者ページ: {DEV}', f'- 連絡先: {MAIL}', '']
    L += llms_en() + ['']   # 英語のページ（/en/）
    for fn in (f'{R}/apps/llms.txt', f'{R}/llms.txt'):   # /llms.txt も同じ中身
        open(fn, 'w', encoding='utf-8').write('\n'.join(L))

# =====================================================================
# 英語のページ（/en/）。文は content_en.py（アプリの名前・説明は App Store の英語の文）。
# App Store のリンクは国を入れない形（https://apps.apple.com/app/id…）。いまは日本の App Store だけで配信・アプリの中は日本語、を正直に書く。
# 日本語のページとは hreflang で結ぶ（EN_ALT）。英語のページがないもの（くらしのアプリ・ブラウザ版の画面）は日本語のページへリンク（hreflang="ja"）
# =====================================================================
import content_en as EN
DEV_EN = DEV.replace('/jp/', '/')
def store_en(i): return f'https://apps.apple.com/app/id{i}'
def en_name(d): return EN.STORE_EN[d]['name'] if d in EN.STORE_EN else EN.LIFE_EN[d][0]
def en_url(d): return f'/en/apps/{d}/' if d in EN_GAMES else f'/{d}/'
def ja_attr(u): return '' if u.startswith('/en/') or not u.startswith('/') else ' hreflang="ja"'
ORG_EN = {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND_EN, "alternateName": BRAND, "url": BASE + "/en/",
          "logo": BASE + "/apps/logo.png", "email": MAIL, "sameAs": [DEV_EN],
          "description": "Small iPhone games made by one person, Ima, who likes shogi, poker and making apps."}
JST_NOTE = 'midnight Japan time (15:00 UTC)'

def header_en(cur):
    ja = JA_ALT.get(cur, '/')
    def a(u, t):
        ac = ' aria-current="page"' if u == cur or u == '/en/apps/' and cur.startswith(u) else ''
        return f'<a href="{u}"{ac}>{esc(t)}</a>'
    return ('<a class="skip" href="#main">Skip to content</a>'
            f'<header class="hd"><div class="wrap"><a class="logo" href="/en/" aria-label="{BRAND_EN} home">{logo_svg("lg-h")}<span>Ima <i>Apps</i></span></a>'
            '<nav class="gnav" aria-label="Main menu">' + ''.join(a(u, t) for u, t in EN.NAV_EN) + '</nav>'
            f'<a class="lang" href="{ja}" hreflang="ja" lang="ja">日本語</a>'
            '<details class="mnav"><summary aria-label="Open menu"><span></span></summary><nav aria-label="Menu">' +
            ''.join(a(u, t) for u, t in EN.NAV_EN) + f'<a href="{ja}" hreflang="ja" lang="ja">日本語のサイト</a></nav></details></div></header>')

def footer_en():
    cols = [('Play', [('/en/', 'Home'), ('/en/play/', 'Play in your browser'), ('/en/apps/', 'All games')]),
            ('About', [('/en/about/', 'About the maker'), ('/en/faq/', 'FAQ'), (DEV_EN, 'All apps on the App Store')]),
            ('Support', [(f'mailto:{MAIL}', 'Contact (email)'), ('/contact/#privacy', 'Privacy policies (in Japanese)'), ('/', '日本語のサイト')])]
    def li(u, t):
        at = ' hreflang="ja" lang="ja"' if u == '/' else ja_attr(u)
        return f'<li><a href="{u}"{at}>{esc(t)}</a></li>'
    body = ''.join(f'<div><h2>{h}</h2><ul>' + ''.join(li(u, t) for u, t in ls) + '</ul></div>' for h, ls in cols)
    wall = ''.join(f'<li><a href="{en_url(d)}"{ja_attr(en_url(d))} aria-label="{esc(en_name(d))}"><img src="/{d}/icon-256.webp" width="48" height="48" alt="" loading="lazy"></a></li>' for d in ALL)
    bye = ('<div class="bye"><div class="crew" aria-hidden="true"><span>🐛</span><span>🍱</span><span>🥚</span><span>🫘</span><span>🚗</span><span>💧</span></div><div class="bye-in">'
           '<p class="bye-h">See you tomorrow.</p><p class="bye-s">Next puzzle in <b class="bye-t" data-cdf>--:--:--</b></p>'
           '<div class="bye-go"><a class="go sm" href="/en/play/">▶ Play today\'s puzzle</a></div>'
           f'<ul class="wall" aria-label="All apps">{wall}</ul></div></div>')
    return (f'<footer class="ft">{bye}<div class="wrap"><div><a class="logo" href="/en/">{logo_svg("lg-f")}<span>Ima <i>Apps</i></span></a>'
            f'<p class="tag">{EN.TAGLINE_EN}.<br>Small iPhone games, made by one person.</p></div>'
            f'<div class="cols3">{body}</div><small>Apple, the Apple logo, App Store and iPhone are trademarks of Apple Inc.</small></div></footer>')

def tail_en():
    return footer_en() + f'\n<script src="/apps/site.js?v={V}" defer></script>\n</body>\n</html>\n'

def crumb_en(items):
    lis = ''.join((f'<li><a href="{u}">{esc(t)}</a></li>' if u else f'<li aria-current="page">{esc(t)}</li>') for u, t in items)
    return f'<nav class="crumb wrap" aria-label="Breadcrumb"><ol>{lis}</ol></nav>'

def calendar_en(big=False):
    return (f'<div class="cal{" big" if big else ""}" aria-label="Today\'s date in Japan"><span class="cm" data-cal-m>Today</span>'
            '<time class="cd2" data-cal data-cal-d>–</time><span class="cw" data-cal-w>in Japan</span></div>')

def countdown_en():
    return ('<div class="count" role="timer" aria-label="Time until the next puzzle"><p class="lbl">⏰ Next puzzle in</p><div class="digits">'
            '<span><b id="cd-h">--</b><small>hours</small></span><i>:</i><span><b id="cd-m">--</b><small>min</small></span><i>:</i>'
            f'<span><b id="cd-s">--</b><small>sec</small></span></div><p class="sub">New puzzles every day at {JST_NOTE}.</p></div>')

OG_EN = {}   # 英語のページの OGP 画像: key -> (見出し, 説明, アプリ or None)。/apps/og/en-<key>.jpg（site2.py --og-en で作る）
def og_en(key):
    return f'{BASE}/apps/og/en-{key}.jpg' if os.path.exists(f'{R}/apps/og/en-{key}.jpg') else None

def sub_page_en(path, h1, title, desc, lead, body, extra_ld=(), crumbs=None, og_img=None):
    cr = crumbs or [('/en/', 'Home'), (None, h1)]
    key = path.strip('/').split('/')[-1]
    plain = re.sub(r'<[^>]+>', '', html.unescape(lead))
    OG_EN[key] = (h1, plain if len(plain) <= 120 else desc, None)   # 画像の説明は短い lead（長ければ description）
    L = [head(path, title, desc, [crumb_ld(cr, path)] + list(extra_ld), og_img=og_img or og_en(key), lang='en', og_alt=f'{h1} - {BRAND_EN}' if og_en(key) else None), header_en(path), '<main id="main">',
         '<section class="phero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span></div>' + crumb_en(cr) +
         f'<div class="wrap"><h1>{esc(h1)}</h1><p class="lead2">{lead}</p></div></section>', body, '</main>', tail_en()]
    write(path, '\n'.join(L))

def store_pill_en(d):
    i = NAMES[d][1]
    return (f'<a class="pill" href="{store_en(i)}" aria-label="{esc(en_name(d))} on the App Store">App Store</a>' if i else '<span class="pill soon">Coming soon</span>')

def en_card(d):
    st = EN.STORE_EN[d]; cid = CAT_OF[d][0]
    tag = '<span class="tagd">Daily puzzle</span>' if d in DAILY else ''
    pl = '▶ Play today\'s puzzle' if d in DAILY else '▶ Play in browser'
    acts = (f'<a class="go sm2" href="/play/{d}/" hreflang="ja">{pl}</a>' if d in PLAY else '<span class="more" aria-hidden="true">Details →</span>') + store_pill_en(d)
    return (f'<li class="acard tilt rv" style="{cv(d)}">{tag}<div class="top"><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div><span class="cat">{CAT_EMO[cid]} {EN.CAT_EN[cid]}</span><h3><a class="stretch" href="/en/apps/{d}/">{esc(st["name"])}</a></h3></div></div>'
            f'<p>{esc(st["sub"])}</p><div class="acts">{acts}</div></li>')

def en_life_card(d):
    nm, txt = EN.LIFE_EN[d]
    return (f'<li class="acard tilt rv" style="{cv(d)}"><div class="top"><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div><span class="cat">{CAT_EMO["life"]} In Japanese only</span><h3><a class="stretch" href="/{d}/" hreflang="ja">{esc(nm)}</a></h3></div></div>'
            f'<p>{esc(txt)} <span lang="ja">（{esc(NAMES[d][0])}）</span></p><div class="acts"><span class="more" aria-hidden="true">Page in Japanese →</span>{store_pill_en(d)}</div></li>')

def shot_alt_en(d, f):
    return EN.SHOT_ALT_EN[d].get(f, f'{en_name(d)} screen') + ' (the app is in Japanese)'

def en_daily_card(d):
    st = EN.STORE_EN[d]; k, w = EN.DAILY_EN[d]; f, _ = shot_for(d)
    media = (f'<video class="vclip" muted loop playsinline preload="none" poster="/{d}/clip.jpg" data-vsrc="/{d}/clip.mp4" data-card width="300" height="650" aria-label="{esc(st["name"])} gameplay"></video>'
             if os.path.exists(f'{R}/{d}/clip.mp4') else scr(d, f, shot_alt_en(d, f)))
    return (f'<li class="dcard tilt rv" style="{cv(d)}"><div class="top"><img class="ic" src="/{d}/icon-256.webp" width="52" height="52" alt="" loading="lazy">'
            f'<h3><a class="stretch" href="/en/apps/{d}/">{esc(st["name"])}</a></h3></div><span class="badge">{esc(k)}</span><p class="what">{esc(w)}</p>'
            f'<div class="frame">{media}</div><div class="acts">' + (f'<a class="go sm2" href="/play/{d}/" hreflang="ja">▶ Play in browser</a>' if d in PLAY else '') +
            store_pill_en(d) + ('' if d in PLAY else '<span class="more" aria-hidden="true">Details →</span>') + '</div></li>')

def itemlist_en():
    items = []
    for k, d in enumerate(EN_GAMES):
        st = EN.STORE_EN[d]; i = NAMES[d][1]; a = APPS[d]
        items.append({"@type": "ListItem", "position": k + 1, "item": {
            "@type": "MobileApplication", "name": st['name'], "alternateName": NAMES[d][0], "description": st['sub'], "url": f"{BASE}/en/apps/{d}/",
            "image": f"{BASE}/{d}/icon-256.webp", "applicationCategory": a['cat'], "operatingSystem": f"iOS {a.get('minos', '18')}.0 or later",
            **({"downloadUrl": store_en(i)} if i else {}), "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"}}})
    return {"@type": "ItemList", "name": f"Games by {BRAND_EN}", "numberOfItems": len(items), "itemListElement": items}

def notice_en(extra=''):
    return (f'<div class="box rv notice"><h2>🌏 Good to know</h2><ul><li>{esc(EN.AVAIL_EN)}</li><li>{esc(EN.LANG_EN)}</li>'
            f'<li>Daily puzzles change at {JST_NOTE}, the same for every player.</li>{extra}</ul></div>')

HERO_ALT_EN = {'suji': "Number Rooms' daily puzzle screen", 'hitofude': "Caterpillar's daily puzzle screen", 'okazu': "Bento Pack's daily bento screen"}

def page_en_home():
    n_browser = len([d for d in PLAY if d in DAILY])
    g = {"@context": "https://schema.org", "@graph": [ORG_EN,
         {"@type": "WebSite", "@id": BASE + "/en/#website", "url": BASE + "/en/", "name": BRAND_EN, "alternateName": BRAND, "inLanguage": "en", "publisher": {"@id": BASE + "/#org"}},
         itemlist_en()]}
    desc = ('Small, free iPhone games by one maker: a one-line puzzle, a bento block puzzle, egg peeling, make-10 math and shogi variants. New daily puzzles for everyone.')
    OG_EN['home'] = (BRAND_EN, EN.TAGLINE_EN, None)
    L = [head('/en/', f'{BRAND_EN} – {EN.TAGLINE_EN} | Free iPhone games', desc, [g], preload='/hitofude/shots/5_daily.webp', lang='en', og_img=og_en('home')), header_en('/en/'), '<main id="main">']
    phones = ''.join(f'<div class="phone p{k}">{scr(d, f, HERO_ALT_EN[d] + " (in Japanese)", lazy=False)}</div>' for k, (d, f, alt) in enumerate(HERO_SHOTS))
    emo = ''.join(f'<span style="--d:{k * -0.6}s;--r:{r}deg">{e}</span>' for k, (e, r) in enumerate([('🐛', -8), ('🍱', 6), ('🥚', -4), ('🫘', 8), ('♟️', -6)]))
    L.append('<section class="hhero"><div class="blobs" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span></div><div class="wrap"><div>'
             '<p class="kicker">📱 Free iPhone games</p>'
             '<h1><span class="ln"><span class="w" style="--d:.05s">One small</span> <span class="w" style="--d:.15s">puzzle</span></span>'
             '<span class="ln"><span class="w mark" style="--d:.3s">a day.</span></span></h1>'
             '<p class="lead">A caterpillar, a lunch box, a boiled egg, a pack of natto… Small iPhone games where everyone gets the same puzzle each day and compares results in a ranking.</p>'
             f'<div class="emo" aria-hidden="true">{emo}</div>'
             '<div class="ctas"><a class="go" href="/en/play/" data-confetti>▶ Play in your browser</a><a class="ghost" href="/en/apps/">See the games</a></div>'
             f'<p class="ctanote">{n_browser} daily puzzles can be played in your browser - no install, no sign-up. The game screens are in Japanese.</p>'
             f'<ul class="stats"><li><b data-n="{len(EN_GAMES)}">{len(EN_GAMES)}</b> games</li><li><b data-n="{len(DAILY)}">{len(DAILY)}</b> with a daily ranking</li><li><b>All</b> free</li></ul></div>'
             f'<div class="stage" aria-label="App screens"><span class="sticker s1" aria-hidden="true">Today\'s puzzle!</span>{phones}<span class="sticker s2" aria-hidden="true">Same for everyone</span></div>'
             '</div></section>')
    L.append(f'<section class="sec" style="padding-top:8px"><div class="narrow">{notice_en()}</div></section>')
    L.append('<section class="sec white" aria-labelledby="h-today"><div class="wrap"><div class="sec-h rv"><h2 id="h-today">📅 Today\'s puzzle</h2>'
             '<a class="more-link" href="/en/play/">Play in your browser →</a><p>One puzzle a day, the same for everyone. Join the ranking with just a nickname - no sign-in.</p></div>'
             f'<div class="today">{calendar_en()}{countdown_en()}</div></div></section>')
    L.append('<section class="sec" id="games" aria-labelledby="h-daily"><div class="wrap"><div class="sec-h rv"><h2 id="h-daily">🏆 A new puzzle every day</h2>'
             '<a class="more-link" href="/en/apps/">All games →</a></div>'
             f'<ul class="rail" aria-label="Games with a daily puzzle">{"".join(en_daily_card(d) for d in DAILY)}</ul><p class="swipe" aria-hidden="true">← Swipe →</p></div></section>')
    others = [d for d in EN_GAMES if d not in DAILY]
    life = [d for d in ALL if d not in EN_GAMES]
    L.append('<section class="sec tint" aria-labelledby="h-more"><div class="wrap"><div class="sec-h rv"><h2 id="h-more">✨ More games</h2><p>Relaxing games, shogi variants, card games and a poker study quiz.</p></div>'
             f'<ul class="grid">{"".join(en_card(d) for d in others)}</ul>'
             '<div class="sec-h rv" style="margin-top:34px"><h2 id="h-life" style="font-size:22px">📒 Also by Ima (in Japanese only)</h2><p>Everyday apps whose pages are in Japanese.</p></div>'
             f'<ul class="grid" aria-labelledby="h-life">{"".join(en_life_card(d) for d in life)}</ul></div></section>')
    L.append(f'<section class="sec white" aria-labelledby="h-me"><div class="wrap">{me_card_en("h2")}</div></section>')
    L.append('</main>'); L.append(tail_en())
    write('/en/', '\n'.join(L))

def me_card_en(h='h3', full=False):
    btns = (f'<a class="ghost" href="{DEV_EN}">All apps on the App Store</a>' + ('' if full else '<a class="ghost" href="/en/about/">More about me</a>') +
            f'<a class="ghost" href="mailto:{MAIL}">Email me</a>')
    likes = ''.join(f'<li>{e} {esc(t)}</li>' for e, t in EN.ABOUT_EN['likes'])
    hid = ' id="h-me"' if h == 'h2' else ''
    return (f'<div class="me rv"><div class="av" aria-hidden="true">🐛</div><div><{h}{hid}>The maker: Ima</{h}>'
            f'<p>{esc(EN.ABOUT_EN["lead"])} {esc(EN.ABOUT_EN["paras"][0])}</p>'
            f'<ul class="likes" aria-label="Things I like">{likes}</ul><div class="btns">{btns}</div></div></div>')

def page_en_apps():
    secs = ''
    for cid, lb, ds in CATS:
        if cid == 'life': continue
        secs += (f'<section class="sec" id="{cid}" aria-labelledby="h-{cid}" style="padding:14px 0 26px"><div class="wrap">'
                 f'<div class="sec-h"><h2 id="h-{cid}" style="font-size:24px">{CAT_EMO[cid]} {EN.CAT_EN[cid]}</h2><span class="n">{len(ds)}</span></div>'
                 f'<ul class="grid">{"".join(en_card(d) for d in ds)}</ul></div></section>')
    life = [d for d in ALL if d not in EN_GAMES]
    secs += ('<section class="sec white" id="life" aria-labelledby="h-life"><div class="wrap"><div class="sec-h"><h2 id="h-life" style="font-size:24px">📒 Everyday apps (in Japanese only)</h2>'
             f'<p>These apps and their pages are in Japanese.</p></div><ul class="grid">{"".join(en_life_card(d) for d in life)}</ul></div></section>')
    body = f'<section class="sec" style="padding:16px 0 0"><div class="narrow">{notice_en()}</div></section>' + secs
    sub_page_en('/en/apps/', 'All games', f'All games | {BRAND_EN} (free iPhone games)',
                f'{len(EN_GAMES)} free iPhone games: daily logic puzzles, mental math, relaxing peeling games, shogi variants, card games and a poker study quiz.',
                f'Puzzles, relaxing games and versus games - {len(EN_GAMES)} in all, every one free.', body,
                [{"@context": "https://schema.org", **itemlist_en()}], crumbs=[('/en/', 'Home'), (None, 'Games')])

def desc_parts(txt):   # App Store の説明文 → (はじめの段落, [(見出し, 中身)], LANGUAGE の文)
    def head_en(t): return EN.HEAD_EN.get(t) or (t[0] + t[1:].lower())
    def render(lines):
        out, ul = '', []
        for l in lines + ['']:
            l = l.strip()
            if l.startswith('• '): ul.append(l[2:]); continue
            if ul: out += '<ul>' + ''.join(f'<li>{esc(x)}</li>' for x in ul) + '</ul>'; ul = []
            if l: out += f'<p>{esc(l)}</p>'
        return out
    intro, secs, lang = '', [], ''
    for b in re.split(r'\n\s*\n', txt.strip()):
        lines = b.split('\n'); first = lines[0].strip()
        if first == first.upper() and re.search('[A-Z]', first) and len(first) < 50:
            if first == 'LANGUAGE': lang = ' '.join(x.strip() for x in lines[1:]); continue
            secs.append([head_en(first), render(lines[1:])])
        elif secs: secs[-1][1] += render(lines)
        else: intro += render(lines)
    return intro, secs, lang

def page_en_app(d):
    st = EN.STORE_EN[d]; name = st['name']; i = NAMES[d][1]; a = APPS[d]; cid = CAT_OF[d][0]
    acc, soft, deep = colors(a['accent'])
    intro, secs, lang = desc_parts(st['desc'])
    path = f'/en/apps/{d}/'
    OG_EN[d] = (name, st['sub'], d)
    t = f'{name} – {st["sub"]}'
    title = t if len(t) <= 60 else f'{name} | {BRAND_EN}'
    desc = ''
    for sent in re.split(r'(?<=[.!?])\s+', st['promo']):
        if len(desc) + len(sent) + 1 > 160: break
        desc = (desc + ' ' + sent).strip()
    r = LOOKUP.get(d)
    app_ld = {"@context": "https://schema.org", "@type": "MobileApplication", "name": name, "alternateName": NAMES[d][0], "description": st['promo'],
              "url": BASE + path, "image": f"{BASE}/{d}/icon-256.webp", "applicationCategory": a['cat'], "operatingSystem": f"iOS {a.get('minos', '18')}.0 or later",
              "inLanguage": "ja", "countriesSupported": "JP", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"},
              "screenshot": [f"{BASE}/{d}/shots/{f}.webp" for f, _ in SHOTS[d][:4]],
              "publisher": {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND_EN, "url": BASE + "/en/"}}
    if i: app_ld['downloadUrl'] = app_ld['installUrl'] = store_en(i)
    if r: app_ld['softwareVersion'] = r['version']; app_ld['datePublished'] = rel_date(d)
    cr = [('/en/', 'Home'), ('/en/apps/', 'Games'), (None, name)]
    chips = ['Free'] + (['Daily puzzle & ranking'] if d in DAILY else []) + (['Playable in your browser'] if d in PLAY else []) + ['Japanese UI']
    storebtn = (f'<a class="store" href="{store_en(i)}"><span class="s1">Download on the</span><span class="s2">App Store</span></a>' if i else
                '<span class="store soon"><span class="s2">Coming soon</span></span>')
    avail = 'Available on the App Store in Japan' if i else 'Coming soon to the App Store in Japan'
    playbtn = (f'<p class="playbtn" style="margin-top:14px"><a class="go sm" href="/play/{d}/" hreflang="ja">' + ("▶ Play today's puzzle in your browser" if d in DAILY else '▶ Play in your browser') +
               '</a></p>' if d in PLAY else '')
    L = [head(path, title, desc, [app_ld, crumb_ld(cr, path)], og_img=og_en(d) or (f'{BASE}/{d}/og.jpg' if os.path.exists(f'{R}/{d}/og.jpg') else None), lang='en',
              og_alt=f'{name} icon and title' if og_en(d) else f'{name} icon', extra_head=f'<style>:root{{--accent:{acc};--soft:{soft};--deep:{deep}}}</style>'),
         header_en(path), '<main id="main">', crumb_en(cr)]
    L.append(f'<section class="hero"><div class="wrap"><img class="icon" src="/{d}/icon-256.webp" width="120" height="120" alt="{esc(name)} icon">'
             f'<p class="eyebrow">{CAT_EMO[cid]} {EN.CAT_EN[cid]} · iPhone</p><h1>{esc(name)}</h1><p class="catch">{esc(st["sub"])}</p><p class="lead">{esc(st["promo"])}</p>'
             '<ul class="chips" aria-label="Features">' + ''.join(f'<li>{esc(c)}</li>' for c in chips) + f'</ul>{storebtn}'
             f'<p class="price">Free with ads · iPhone (iOS {a.get("minos", "18")} or later) · {avail}</p>{playbtn}</div></section>')
    extra = f'<li>{esc(lang)}</li>' if lang else ''
    L.append(f'<section class="block" style="padding-top:6px"><div class="narrow"><div class="box rv notice"><h2>🌏 Language &amp; availability</h2><ul>{extra}'
             f'<li>{esc(EN.AVAIL_EN)}</li></ul><p><a class="more-link" href="/{d}/" hreflang="ja" lang="ja">日本語のページ →</a></p></div></div></section>')
    shots = ''.join(f'<li><img src="/{d}/shots/{f}.webp" width="480" height="1043" alt="{esc(shot_alt_en(d, f))}"' + (' loading="lazy"' if k > 1 else '') + '></li>'
                    for k, (f, _) in enumerate(SHOTS[d]))
    L.append(f'<section class="shots" aria-label="Screenshots"><ul>{shots}</ul><p class="hint">← Scroll sideways →</p></section>')
    if d in DAILY:
        k, w = EN.DAILY_EN[d]
        pl = f'<a class="go sm" href="/play/{d}/" hreflang="ja">▶ Play in browser</a>' if d in PLAY else ''
        sb = f'<a class="go sm" href="{store_en(i)}">Play in the app</a>' if i else ''
        L.append(f'<section class="block todaymini" aria-labelledby="h-tm"><div class="wrap"><div class="today">{calendar_en()}{countdown_en()}'
                 f'<div class="tmtext rv"><h2 id="h-tm">📅 {esc(k)}</h2><p>{esc(w)}. A new puzzle every day at {JST_NOTE}.</p>'
                 f'<div class="btns">{sb}{pl}<a class="ghost" href="/en/play/">Other daily puzzles</a></div></div></div></div></section>')
    body = f'<div class="box rv"><h2>What is {esc(name)}?</h2>{intro}</div>' + ''.join(f'<div class="box rv"><h2>{esc(h)}</h2>{x}</div>' for h, x in secs)
    L.append(f'<section class="block" aria-label="About the game"><div class="narrow">{body}'
             f'<p class="small" style="color:var(--dim)">Text from the English App Store description. Questions? <a href="mailto:{MAIL}">{MAIL}</a> · '
             f'<a href="/{d}/privacy.html" hreflang="ja">Privacy policy (in Japanese)</a></p></div></section>')
    rel = [x for x in EN_GAMES if CAT_OF[x][0] == cid and x != d][:3]
    if len(rel) < 3: rel += [x for x in DAILY if x != d and x not in rel][:3 - len(rel)]
    L.append(f'<section class="sec tint" aria-labelledby="h-rel"><div class="wrap"><div class="sec-h"><h2 id="h-rel" style="font-size:22px">✨ More games</h2>'
             f'<a class="more-link" href="/en/apps/">All games →</a></div><ul class="grid">{"".join(en_card(x) for x in rel)}</ul></div></section>')
    L.append('</main>'); L.append(tail_en())
    write(path, '\n'.join(L))

def page_en_play():
    lis = ''
    for k, d in enumerate(PLAY):
        t, x = EN.PLAY_EN[d]
        lis += (f'<li class="rv" style="{cv(d)}"><span class="no">{k + 1:02d}</span><img class="ic" src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
                f'<div><p class="nm">{esc(en_name(d))}</p><h3>{esc(t)}</h3><p class="w">{esc(x)}</p></div>'
                f'<div class="acts"><a class="go sm" href="/play/{d}/" hreflang="ja">▶ Play</a><a class="ghost" href="/en/apps/{d}/">About the game</a></div></li>')
    howto = ('<div class="box rv"><h2>How it works</h2><ul><li>No install and no sign-up. Just open a game and play.</li>'
             '<li>The game screens are in Japanese. The one-line tips above each game are all you need to start.</li>'
             f'<li>The daily puzzles are the same as in the iPhone apps and change at {JST_NOTE}.</li>'
             '<li>Your results are kept in this browser on this device only.</li></ul></div>')
    body = (f'<section class="sec white" style="padding-top:26px"><div class="wrap"><div class="today">{calendar_en(big=True)}{countdown_en()}</div></div></section>'
            '<section class="sec"><div class="wrap"><div class="sec-h rv"><h2>Games you can play in your browser</h2>'
            '<p>Each "Play" button opens the game page (in Japanese).</p></div>'
            f'<ol class="dlist">{lis}</ol></div></section>'
            f'<section class="sec white"><div class="narrow">{howto}{notice_en()}</div></section>')
    items = [{"@type": "ListItem", "position": k + 1, "name": f'{en_name(d)}: {EN.PLAY_EN[d][0]}', "url": f"{BASE}/play/{d}/"} for k, d in enumerate(PLAY)]
    cp = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Play in your browser", "url": BASE + "/en/play/", "inLanguage": "en",
          "isAccessibleForFree": True, "mainEntity": {"@type": "ItemList", "numberOfItems": len(items), "itemListElement": items}}
    n = len([d for d in PLAY if d in DAILY])
    sub_page_en('/en/play/', 'Play in your browser', f'Play daily puzzles in your browser | {BRAND_EN}',
                f'{n} free daily puzzles from our iPhone games - one-line, room split, bento packing, make-10 and more - plus a card game vs CPU. No install, no sign-up.',
                f'{n} daily puzzles and a card game against the CPU. No install, no sign-up - the game screens are in Japanese.', body, [cp],
                crumbs=[('/en/', 'Home'), (None, 'Play in your browser')])

def page_en_about():
    A = EN.ABOUT_EN
    counts = ''.join(f'<li><a href="/en/apps/#{cid}"><span aria-hidden="true" style="font-size:24px">{CAT_EMO[cid]}</span><span>{EN.CAT_EN[cid]} · {len(ds)}</span></a></li>'
                     for cid, _, ds in CATS if cid != 'life')
    first_d = min(LOOKUP_T, key=lambda d: RELEASE_FIX_N.get(d) or jst_date(LOOKUP_T[d]['releaseDate']))
    fy, fm, fd = map(int, (RELEASE_FIX_N.get(first_d) or jst_date(LOOKUP_T[first_d]['releaseDate'])).split('-'))
    first = datetime.date(fy, fm, fd).strftime('%B %-d, %Y')
    pub = len([d for d in ALL if NAMES[d][1]])
    body = (f'<section class="sec white" style="padding-top:28px"><div class="narrow">{me_card_en("h2", full=True)}</div></section>'
            '<section class="sec"><div class="narrow">'
            f'<div class="box rv"><h2>👋 Hello</h2>' + ''.join(f'<p>{esc(p)}</p>' for p in A['paras'][1:]) +
            f'<p>My first app, <a href="{en_url(first_d)}">{esc(en_name(first_d))}</a>, came out on {first}. There are now {pub} apps on the App Store in Japan.</p></div>'
            f'<div class="box rv"><h2>🎮 Games</h2><p>Puzzles, relaxing games and versus games. The apps are in Japanese for now.</p><ul class="linklist" style="padding:0">{counts}</ul></div>'
            '<div class="box rv"><h2>🌱 What I care about</h2><ul>' + ''.join(f'<li>{esc(v)}</li>' for v in A['values']) + '</ul></div>'
            f'<div class="box rv"><h2>✉️ Contact</h2><p>Bug reports, ideas and questions are welcome by email: <a href="mailto:{MAIL}">{MAIL}</a>. English or Japanese is fine.</p></div>'
            '</div></section>')
    pp = {"@context": "https://schema.org", "@type": "ProfilePage", "url": BASE + "/en/about/", "name": "About the maker: Ima", "inLanguage": "en",
          "mainEntity": {"@type": "Person", "@id": BASE + "/about/#ima", "name": "Ima", "alternateName": "いま", "url": BASE + "/en/about/",
                         "knowsAbout": ["Shogi", "Poker", "iPhone app development"]}}
    sub_page_en('/en/about/', 'About the maker', f'About the maker: Ima | {BRAND_EN}',
                'Ima makes small iPhone games alone - daily puzzles, relaxing games and shogi variants. Likes shogi, poker and making apps.',
                'Hi, I\'m Ima - the person who makes these games.', body, [pp, dict(ORG_EN, **{"@context": "https://schema.org"})])

def page_en_faq():
    qa = ''.join(f'<details class="qa rv"{" open" if k == 0 else ""}><summary>{esc(q)}</summary><div class="a">' + ''.join(f'<p>{x}</p>' for x in ans) + '</div></details>'
                 for k, (q, ans) in enumerate(EN.FAQ_EN))
    links = ''.join(f'<li><a href="/en/apps/{d}/"><img src="/{d}/icon-256.webp" width="36" height="36" alt="" loading="lazy"><span>{esc(en_name(d))}</span></a></li>' for d in EN_GAMES)
    body = (f'<section class="sec" style="padding-top:20px"><div class="narrow">{qa}'
            f'<div class="box rv" style="margin-top:22px"><h2>📱 Game pages</h2><p>Rules and details for each game.</p><ul class="linklist" style="padding:0">{links}</ul></div></div></section>')
    fl = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', ' '.join(ans))}} for q, ans in EN.FAQ_EN]}
    sub_page_en('/en/faq/', 'FAQ', f'FAQ | {BRAND_EN}',
                'Free? Available outside Japan? In English? When does the daily puzzle change? Answers to common questions about our iPhone games.',
                'Common questions about the games, languages and availability.', body, [fl], crumbs=[('/en/', 'Home'), (None, 'FAQ')])

def llms_en():
    L = ['', '## English', '', f'> {BRAND_EN} (いまのアプリ): small, free iPhone games made by one person, Ima. Daily puzzles that are the same for every player, relaxing games, shogi variants and card games. '
         'The apps are available on the App Store in Japan only for now, and their menus are in Japanese.', '',
         '### Pages', f'- [Home]({BASE}/en/)', f'- [All games]({BASE}/en/apps/)', f'- [Play in your browser]({BASE}/en/play/): daily puzzles with no install (game screens in Japanese)',
         f'- [About the maker]({BASE}/en/about/)', f'- [FAQ]({BASE}/en/faq/)', '', '### Games']
    for d in EN_GAMES:
        st = EN.STORE_EN[d]; i = NAMES[d][1]
        L.append(f'- [{st["name"]}]({BASE}/en/apps/{d}/): {st["sub"]}. {st["promo"]} ' + (f'App Store (Japan): {store_en(i)}' if i else 'App Store: coming soon'))
    return L

def fix_play_hreflang():   # /play/ は手で書いたページ（生成しない）。hreflang だけ足す（何度やっても同じ）
    fn = f'{R}/play/index.html'
    s = open(fn, encoding='utf-8').read()
    s2 = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n', '', s)
    k = s2.index('<link rel="canonical"'); k = s2.index('\n', k) + 1
    s2 = s2[:k] + hreflang_links('/play/') + '\n' + s2[k:]
    if s2 != s: open(fn, 'w', encoding='utf-8').write(s2)

def build_en():
    page_en_home(); page_en_apps(); page_en_play(); page_en_about(); page_en_faq()
    for d in EN_GAMES: page_en_app(d)
    fix_play_hreflang()

if __name__ == '__main__':
    page_home(); page_apps(); page_today(); page_ranking(); page_news(); (page_note() if NOTE_ON else None); page_about(); page_faq(); page_contact()
    page_now(); page_sitemap(); page_start(); page_zukan(); page_404(); page_guide()
    for c, _, _ in CATS: page_category(c)
    for d in ALL: landing(d); page_support(d); fix_privacy_nav(d)
    for d in JOIN: page_join(d)
    build_en()
    llms()
    if '--og' in sys.argv: make_og()
    elif '--og-new' in sys.argv: make_og([k for k in OG_PAGES if not os.path.exists(f'{R}/apps/og/{k}.jpg')] + [a[10:] for a in sys.argv if a.startswith('--og-also=')])   # まだない画像だけ（--og-also=apps で作りなおすものを足せる）
    if '--og-en' in sys.argv: make_og_en(); build_en()   # 画像ができてから英語のページを作りなおす（og:image を画像に向ける）
    print('ok', sorted(OG_PAGES))

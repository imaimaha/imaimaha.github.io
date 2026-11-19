# -*- coding: utf-8 -*-
"""Generate landing pages into ~/Developer/imaimaha.github.io/<app>/index.html.
Support content (詳しい遊び方・FAQ・お問い合わせ) is taken from orig/<app>.html (the pre-landing support pages).
usage: python3 gen.py [app ...]   (no args = all apps)"""
import os, re, sys, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apps_data import APPS, NAMES, SHOTS, ADS, DAILY, DAILY_LINE, CATS

S = os.path.dirname(os.path.abspath(__file__))
R = os.path.expanduser('~/Developer/imaimaha.github.io')
BASE = 'https://imaimaha.github.io'   # サイトの住所はここ1か所だけ（site2.py・crawl.py・play_yudetamago.py もここを使う）。独自ドメインにしたらここを変える
NOTE = 'https://note.com/redemarrage22'
DEV = 'https://apps.apple.com/jp/developer/id6818812575'
BRAND = 'いまのアプリ'
MAIL = 'imaimaha.apps@gmail.com'
CSSV = '20261119'

def store(i): return f'https://apps.apple.com/jp/app/id{i}'

# ---------- colors ----------
def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)
def mix(h, w, t):  # t=0 -> h, t=1 -> w
    a = [int(h[i:i+2], 16) for i in (1, 3, 5)]; b = [int(w[i:i+2], 16) for i in (1, 3, 5)]
    return '#' + ''.join('%02x' % round(x + (y - x) * t) for x, y in zip(a, b))
def colors(acc):
    while contrast(acc, '#ffffff') < 4.6: acc = mix(acc, '#000000', 0.06)
    deep = mix(acc, '#000000', 0.22)
    soft = mix(acc, '#ffffff', 0.9)
    assert contrast(deep, soft) >= 4.5 and contrast('#ffffff', deep) >= 7
    return acc, soft, deep

LAZY = ' loading="lazy"'
def esc(s): return html.escape(s, quote=True)
def strip(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()

# ---------- support block from the original page ----------
def support_block(d, a):
    src = open(f'{S}/orig/{d}.html', encoding='utf-8').read()
    body = src.split('</header>', 1)[1].split('</main>', 1)[0]
    body = re.sub(r'\s*<p><b><a href="https://apps\.apple\.com[^"]*">[^<]*</a></b></p>', '', body)
    body = re.sub(r'<h2>(遊び方|使い方)</h2>', lambda m: f'<h2 id="howto">くわしい{m.group(1)}</h2>', body)
    body = body.replace('<h2>どんなアプリ？</h2>', '<h2 id="about">どんなアプリ？</h2>')
    body = body.replace('<h2>よくある質問</h2>', '<h2 id="faq">よくある質問</h2>')
    body = body.replace('<h2>お問い合わせ</h2>', '<h2 id="contact">お問い合わせ</h2>')
    if d == 'pokerstudy':
        old = '<p>お金・チップ・賭けは一切ありません。対戦や勝ち負けもなく、点数は「正解率」と「連続正解」だけの問題集です。</p>'
        assert old in body
        body = body.replace(old, '<p>アプリ内課金や景品はありません。トーナメントやリングゲームも CPU とだけ遊ぶ練習で、使うのは練習の中だけの点数です。</p>')
    # extra FAQ at the top of the FAQ card (also used for FAQPage JSON-LD)
    minos = a.get('minos', '18')
    price = a.get('ads', ADS)
    get = (f'<a href="{store(NAMES[d][1])}">App Store のページ</a>からどうぞ。' if NAMES[d][1] else 'App Store で近日公開です。')
    pre = (f'\n    <h3>無料ですか？</h3>\n    <p>はい、無料でダウンロードして遊べます（{price.replace("無料・", "")}）。{get}</p>'
           f'\n    <h3>どの端末で使えますか？</h3>\n    <p>iPhone（iOS {minos} 以降）で使えます。Android 版はありません。</p>')
    i = body.index('<h2 id="faq">')
    j = body.index('<div class="card">', i) + len('<div class="card">')
    body = body[:j] + pre + body[j:]
    body = body.replace('<nav><a href="privacy.html">プライバシーポリシー</a></nav>',
                        '<nav><a href="privacy.html">プライバシーポリシー</a><a href="/apps/">ほかのアプリ</a></nav>')
    # FAQ pairs
    k = body.index('<div class="card">', i)
    card = body[k:body.index('</div>', k)]
    faqs = []
    for m in re.finditer(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', card, re.S):
        q = strip(m.group(1)); ans = strip(m.group(2))
        if q and ans: faqs.append((q, ans))
    return body.strip('\n'), faqs

# ---------- pieces ----------
def store_btn(i, label='App Store で', big='無料ダウンロード', extra=''):
    if not i:   # App Store のアプリがまだない（NAMES の id が None）: ボタンのかわりに「近日公開」
        return '<span class="store soon" role="note"><span class="s1">App Store で</span><span class="s2">近日公開</span></span>'
    return (f'<a class="store" href="{store(i)}"{extra}><span class="s1">{label}</span>'
            f'<span class="s2">{big}</span></a>')

TROPHY = ('<svg class="trophy" viewBox="0 0 64 64" aria-hidden="true"><path fill="#ffd34d" d="M18 6h28v6h10v6c0 8-6 14-13 15-2 5-5 8-9 9v8h8v6H22v-6h8v-8c-4-1-7-4-9-9-7-1-13-7-13-15v-6h10V6zm-4 12c0 4 2 7 5 8-1-3-1-5-1-8h-4zm36 0h-4c0 3 0 5-1 8 3-1 5-4 5-8z"/></svg>')
VS = ('<svg class="trophy" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#ffd34d"/><text x="32" y="41" text-anchor="middle" font-size="24" font-weight="900" fill="#3a2a00" font-family="sans-serif">VS</text></svg>')

def topbar():
    return ('<header class="topbar"><div class="wrap"><a href="/">いまのアプリ</a>'
            f'<nav aria-label="サイト"><a href="/apps/">すべてのアプリ</a><a href="{NOTE}" rel="me noopener">note</a></nav></div></header>')

def footer(extra_links=()):
    links = list(extra_links) + [('/apps/', 'すべてのアプリ'), (DEV, 'App Store で全部のアプリを見る'), (NOTE, 'note（いまの記事）'), (f'mailto:{MAIL}', 'お問い合わせ')]
    RM = ' rel="me noopener"'
    lis = ''.join(f'<li><a href="{u}"{RM if u == NOTE else ""}>{t}</a></li>' for u, t in links)
    return (f'<footer class="foot"><div class="wrap"><ul>{lis}</ul>'
            '<small>Apple、App Store、iPhone は Apple Inc. の商標です。</small></div></footer>')

def app_card(d, daily=False, cls=''):
    name, i, text = NAMES[d]
    dl = f'<span class="daily">{esc(DAILY_LINE[d])}</span>' if daily and d in DAILY else ''
    return (f'<li class="card-app{cls}"><img src="/{d}/icon-256.webp" width="64" height="64" alt="" loading="lazy">'
            f'<div class="body"><a class="nm" href="/{d}/">{esc(name)}</a><span class="tx">{esc(text)}</span>{dl}'
            f'<div class="acts">' + (f'<a class="dl" href="{store(i)}" aria-label="{esc(name)} を App Store で見る">App Store</a>' if i else '<span class="pill soon">近日公開</span>') +
            f'<a href="/{d}/">くわしく見る</a></div></div></li>')

PERSON = {"@type": "Organization", "name": BRAND, "url": BASE + "/", "sameAs": [DEV, NOTE]}  # 個人名は出さない（ブランド名で）

def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'

# ---------- landing page ----------
def page(d):
    a = APPS[d]; name, i, _ = NAMES[d]
    acc, soft, deep = colors(a['accent'])
    url = f'{BASE}/{d}/'
    price = a.get('ads', ADS); minos = a.get('minos', '18')
    support, faqs = support_block(d, a)
    shots = SHOTS[d]
    og = f'{url}og.jpg'
    lines = []
    w = lines.append
    w('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">')
    if d == 'pokerstudy':
        w('<!-- このページでは「キャッシュ／お金／賭け／カジノ／ギャンブル／賞金／円／所持金／バイイン／レーキ／手数料」を使わない -->')
    w(f'<title>{esc(a["title"])}</title>')
    w(f'<meta name="description" content="{esc(a["desc"])}">')
    w(f'<link rel="canonical" href="{url}">')
    w(f'<meta name="theme-color" content="{soft}">')
    if i: w(f'<meta name="apple-itunes-app" content="app-id={i}">')
    w(f'<meta property="og:type" content="website">\n<meta property="og:site_name" content="いまのアプリ">\n<meta property="og:locale" content="ja_JP">')
    w(f'<meta property="og:title" content="{esc(a["title"])}">\n<meta property="og:description" content="{esc(a["desc"])}">')
    w(f'<meta property="og:url" content="{url}">\n<meta property="og:image" content="{og}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">')
    w(f'<meta property="og:image:alt" content="{esc(name)} のアイコン">')
    w(f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{esc(a["title"])}">\n<meta name="twitter:description" content="{esc(a["desc"])}">\n<meta name="twitter:image" content="{og}">')
    w(f'<link rel="icon" href="icon-256.webp" type="image/webp">\n<link rel="apple-touch-icon" href="icon.png">')
    w(f'<link rel="stylesheet" href="/apps/site.css?v={CSSV}">')
    w(f'<style>:root{{--accent:{acc};--soft:{soft};--deep:{deep}}}</style>')
    sw = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": name,
          "alternateName": None, "description": a['desc'], "operatingSystem": f"iOS {minos}.0 以降",
          "applicationCategory": a['cat'], "inLanguage": "ja", "url": url, "downloadUrl": store(i),
          "installUrl": store(i), "image": f"{url}icon-256.webp",
          "screenshot": [f"{url}shots/{f}.webp" for f, _ in shots],
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY", "url": store(i)},
          "author": PERSON, "publisher": PERSON}
    if not i:
        for k in ('downloadUrl', 'installUrl'): del sw[k]
        del sw['offers']['url']
    store_names = json.load(open(f'{S}/data/{i}.json'))['trackName'] if i else name
    if store_names != name: sw['alternateName'] = store_names
    else: del sw['alternateName']
    w(ld(sw))
    if faqs:
        w(ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in faqs]}))
    w('</head>\n<body>')
    w(topbar())
    w('<main>')
    # hero
    # a['chips'] は出さない（2026-11-19 補足を減らす: リード文・「とは？」・特徴と同じことの言いかえ）
    w(f'<section class="hero"><div class="wrap">'
      f'<img class="icon" src="icon-256.webp" width="120" height="120" alt="{esc(name)} のアイコン">'
      f'<p class="eyebrow">{esc(a["eyebrow"])}（iPhone）</p>'
      f'<h1>{esc(name)}</h1>'
      f'<p class="catch">{a["catch"]}</p>'
      f'<p class="lead">{esc(a["lead"])}</p>'
      f'{store_btn(i)}'
      f'<p class="price">{esc(price)}／iPhone（iOS {minos} 以降）</p>'
      f'</div></section>')
    # shots
    lis = ''.join(f'<li><img src="shots/{f}.webp" width="480" height="1043" alt="{esc(alt)}"{LAZY} decoding="async"></li>'
                  for k, (f, alt) in enumerate(shots))
    w(f'<section class="shots" aria-label="スクリーンショット"><ul>{lis}</ul></section>')
    # ranking / versus
    rk = a.get('rank')
    if rk:
        versus = d in ('hensokushogi', 'gekokujo', 'futaridaifugo')
        tag = 'ONLINE' if versus else 'RANKING'
        rcls = 'rgrid' if [f for f, _ in shots if 'daily' in f or 'online' in f] else 'rnone'
        rs = [(f, alt) for f, alt in shots if 'daily' in f or 'online' in f]
        rshot = (f'<img class="rshot" src="shots/{rs[0][0]}.webp" width="480" height="1043" alt="{esc(rs[0][1])}" loading="lazy">' if rs else '')
        pts = ''.join(f'<li><b>{esc(t)}</b><span>{esc(x)}</span></li>' for t, x in rk['points'])
        note = f'<p class="note">{esc(rk["note"])}</p>' if rk.get('note') else ''
        w(f'<section class="block rank" id="ranking"><div class="wrap">{VS if versus else TROPHY}'
          f'<h2>{esc(rk["h"])}</h2><div class="{rcls}">{rshot}<div><ol>{pts}</ol>{note}</div></div>'
          f'<div class="cta-in">{store_btn(i, "App Store（無料）で", "勝負してみる" if not versus else "対局してみる")}</div></div></section>')
    # osusume
    w('<section class="block"><div class="narrow"><h2>こんな人におすすめ</h2><ul class="reco">' +
      ''.join(f'<li>{esc(x)}</li>' for x in a['osusume']) + '</ul></div></section>')
    # steps
    w('<section class="block" style="background:var(--soft)"><div class="wrap"><h2>遊び方は3ステップ</h2><ol class="steps">' +
      ''.join(f'<li><b>{esc(t)}</b><span>{esc(x)}</span></li>' for t, x in a['steps']) + '</ol></div></section>')
    # features
    notice = f'<p class="notice">{esc(a["notice"])}</p>' if a.get('notice') else ''
    w('<section class="block"><div class="wrap"><h2>特徴</h2><ul class="feats">' +
      ''.join(f'<li><span class="big">{esc(b)}</span><span class="lbl">{esc(l)}</span><span class="sub">{esc(s)}</span></li>' for b, l, s in a['feats']) +
      f'</ul>{notice}</div></section>')
    # CTA
    w(f'<section class="block cta"><div class="wrap"><img class="icon-s" src="icon-256.webp" width="72" height="72" alt="" loading="lazy">'
      f'<p class="t">{esc(name)} を無料で遊んでみる</p>{store_btn(i)}<p class="price">{esc(price)}／iPhone（iOS {minos} 以降）</p></div></section>')
    # support (original content)
    w(f'<section class="block support" id="support" aria-label="サポート"><div class="narrow">\n  {support}\n</div></section>')
    # related
    w('<section class="block related" style="background:#f7f8fa"><div class="wrap"><h2>ほかのアプリ</h2><ul class="cards three">' +
      ''.join(app_card(r) for r in a['related']) + '</ul></div></section>')
    w('</main>')
    w(footer([('privacy.html', 'プライバシーポリシー')]))
    w('</body>\n</html>\n')
    out = '\n'.join(lines)
    open(f'{R}/{d}/index.html', 'w', encoding='utf-8').write(out)
    return out

if __name__ == '__main__':
    import shutil
    for d in (sys.argv[1:] or list(APPS)):
        page(d); print('wrote', d)

# ---------- portfolio (root / and /apps/) ----------
# note の最新記事: ページには生成時点の記事を書き込み、表示時に /apps/note.json（apps/tools/update_note.py が更新）で差しかえる
NOTE_JS = ("<script>(function(){var u=document.getElementById('notes');if(!u||!window.fetch)return;"
  "fetch('/apps/note.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).then(function(j){"
  "if(!j||!j.items||!j.items.length)return;u.textContent='';j.items.slice(0,5).forEach(function(it){"
  "if(!/^https:\\/\\/note\\.com\\//.test(it.url))return;var li=document.createElement('li'),a=document.createElement('a'),t=document.createElement('time'),s=document.createElement('span');"
  "a.href=it.url;a.rel='noopener';t.dateTime=it.date;t.textContent=String(it.date).replace(/-/g,'.');s.textContent=it.title;"
  "a.appendChild(t);a.appendChild(s);li.appendChild(a);u.appendChild(li)})}).catch(function(){})})();</script>")
def portfolio(root):
    url = BASE + ('/' if root else '/apps/')
    if root:
        title = 'いまのアプリ｜毎日1問のパズルでランキング勝負できる iPhone アプリ'
    else:
        title = 'すべてのアプリ一覧｜いまのアプリ（iPhone・無料）'
    desc = ('一筆書き・へや割り・お弁当パズル・暗算ゲームなど、毎日みんなと同じ問題でランキング勝負できるパズルや、'
            'のんびりゲーム、変則将棋の対戦、お散歩日記・積読記録などのiPhoneアプリ。どれも無料で使えます。')
    allapps = [d for _, _, ds in CATS for d in ds]
    L = []; w = L.append
    w('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">')
    w(f'<title>{esc(title)}</title>\n<meta name="description" content="{esc(desc)}">\n<link rel="canonical" href="{url}">')
    w('<meta name="theme-color" content="#f3f6ff">')
    w('<meta property="og:type" content="website">\n<meta property="og:site_name" content="いまのアプリ">\n<meta property="og:locale" content="ja_JP">')
    w(f'<meta property="og:title" content="{esc(title)}">\n<meta property="og:description" content="{esc(desc)}">\n<meta property="og:url" content="{url}">')
    w(f'<meta property="og:image" content="{BASE}/apps/og.jpg">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="いまのアプリのアイコン一覧">')
    w(f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{esc(title)}">\n<meta name="twitter:description" content="{esc(desc)}">\n<meta name="twitter:image" content="{BASE}/apps/og.jpg">')
    w('<link rel="icon" href="/hitofude/icon-256.webp" type="image/webp">')
    w(f'<link rel="stylesheet" href="/apps/site.css?v={CSSV}">')
    w(f'<link rel="me" href="{NOTE}">')
    items = []
    for k, d in enumerate(allapps):
        name, i, text = NAMES[d]
        a = APPS[d]
        items.append({"@type": "ListItem", "position": k + 1, "item": {
            "@type": "SoftwareApplication", "name": name, "description": text, "url": f"{BASE}/{d}/",
            "image": f"{BASE}/{d}/icon-256.webp", "applicationCategory": a['cat'],
            "operatingSystem": f"iOS {a.get('minos', '18')}.0 以降", "downloadUrl": store(i),
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"}}})
    w(ld({"@context": "https://schema.org", "@graph": [
        dict(PERSON, **{"@id": BASE + "/#org", "alternateName": "imaimaha のアプリ", "email": MAIL,
                        "description": "将棋・ポーカー・アプリ開発が好きな「いま」が、iPhone 向けの小さなアプリをひとりで作っています。"}),
        {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": BRAND, "alternateName": "imaimaha のアプリ", "inLanguage": "ja",
         "publisher": {"@id": BASE + "/#org"}},
        {"@type": "ItemList", "name": "いまのアプリの一覧", "numberOfItems": len(items), "itemListElement": items}]}))
    w('</head>\n<body>')
    w(topbar())
    w('<main>')
    icons = ''.join(f'<img src="/{d}/icon-256.webp" width="44" height="44" alt="">' for d in allapps)
    if root:
        h1 = '毎日ちょっと遊べるアプリを<br>作っています'
        p = ('iPhone 向けの小さなアプリを、ひとりで作っています。毎日みんなと同じ1問で勝負するパズル、'
             'のんびり指を動かすゲーム、友達との対戦、くらしの記録。どれも無料で使えます。')
    else:
        h1 = 'すべてのアプリ'
        p = 'パズル・のんびり・対戦・くらしの記録。iPhone 向けのアプリを、ジャンルごとにまとめました。どれも無料で使えます。'
    w(f'<section class="intro"><div class="wrap"><div class="icons" aria-hidden="true">{icons}</div><h1>{h1}</h1><p>{p}</p></div></section>')
    w('<section class="block featured" id="ranking"><div class="wrap">' + TROPHY.replace('class="trophy"', 'class="trophy" style="display:block;margin:0 auto 8px;width:52px;height:52px"') +
      '<h2>今日の問題で勝負できるアプリ</h2>'
      '<p class="lede">毎日、みんなに同じ問題。タイムやスコアをランキングでくらべよう。<br>サインインなし、ニックネームを決めるだけで参加できます。</p>'
      '<ul class="cards three">' + ''.join(app_card(d, daily=True) for d in DAILY) + '</ul></div></section>')
    for cid, label, ds in CATS:
        w(f'<section class="block cat" id="{cid}"><div class="wrap"><h2>{esc(label)}</h2><ul class="cards three">' +
          ''.join(app_card(d) for d in ds) + '</ul></div></section>')
    notes = ''
    if root:
        try: items = json.load(open(f'{R}/apps/note.json', encoding='utf-8'))['items'][:5]
        except Exception: items = []
        if items:
            lis = ''.join(f'<li><a href="{esc(it["url"])}" rel="noopener"><time datetime="{esc(it["date"])}">{esc(it["date"].replace("-", "."))}</time>'
                          f'<span>{esc(it["title"])}</span></a></li>' for it in items)
            notes = (f'<h3 id="note">note の最新記事</h3><ul class="notes" id="notes">{lis}</ul>'
                     f'<p class="more"><a href="{NOTE}" rel="me noopener">note の記事をもっと見る</a></p>')
    w('<section class="block profile" id="profile"><div class="narrow"><h2>作っている人：いま</h2>'
      '<p>将棋・ポーカー・アプリ開発が好きな「いま」です。毎日ちょっと遊べる iPhone アプリを、ひとりで作っています。'
      '作っているときのことや、ふだん考えていることは note に書いています。'
      '不具合やご要望は、各アプリのページの「お問い合わせ」か、メールでどうぞ。</p>'
      f'<p class="links"><a href="{NOTE}" rel="me noopener">note を読む</a><a href="{DEV}">App Store で全部のアプリを見る</a>'
      f'<a href="mailto:{MAIL}">お問い合わせ（{MAIL}）</a></p>{notes}</div></section>')
    w('</main>')
    w(footer())
    if root: w(NOTE_JS)
    w('</body>\n</html>\n')
    out = '\n'.join(L)
    open(f'{R}/{"index.html" if root else "apps/index.html"}', 'w', encoding='utf-8').write(out)

if __name__ == '__main__' and os.environ.get('PORTFOLIO'):
    portfolio(False)
    if os.environ.get('PORTFOLIO') == 'root': portfolio(True)
    print('portfolio written')

# ローカルのサーバーでサイトをたどって、リンク切れ・h1・タイトル・説明・canonical・JSON-LD・パンくずを確かめる
import re, json, html, urllib.request, urllib.parse, collections
import os
B = 'http://127.0.0.1:8790'; BASE = re.search(r"^BASE = '([^']+)'", open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen.py'), encoding='utf-8').read(), re.M).group(1)   # gen.py の BASE
seen, queue, bad, pages = set(), collections.deque(['/']), [], {}
def get(u):
    try:
        with urllib.request.urlopen(B + u, timeout=10) as r: return r.status, r.read(), r.headers.get('Content-Type', '')
    except urllib.error.HTTPError as e: return e.code, b'', ''
while queue:
    u = queue.popleft()
    if u in seen: continue
    seen.add(u)
    st, body, ct = get(u)
    if st != 200: bad.append((st, u)); continue
    if 'text/html' not in ct or u.startswith('/play/') and u != '/play/': continue
    if u.startswith('/play/'): continue
    s = body.decode('utf-8', 'replace'); pages[u] = s
    for m in re.finditer(r'(?:href|src|data-vsrc|poster)="([^"#]+)', s):
        v = html.unescape(m.group(1))
        if v.startswith('mailto:') or v.startswith('http') and not v.startswith(BASE): continue
        if v.startswith(BASE): v = v[len(BASE):]
        v = urllib.parse.urljoin(u, v).split('?')[0]
        if v not in seen: queue.append(v)
print('checked', len(seen), 'urls,', len(pages), 'html pages; broken:', bad)
probs = []
for u, s in sorted(pages.items()):
    t = html.unescape(re.search(r'<title>(.*?)</title>', s).group(1))
    dm = re.search(r'<meta name="description" content="([^"]*)"', s); d = html.unescape(dm.group(1)) if dm else ''
    can = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    h1 = len(re.findall(r'<h1[ >]', s))
    lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
    okld = all(json.loads(x.replace('<\\/', '</')) is not None for x in lds)
    crumb = 'class="crumb' in s
    ogi = re.search(r'<meta property="og:image" content="([^"]+)"', s)
    issues = []
    if u.endswith('/privacy.html') or u.endswith('/support/'):
        # ひとりで立つページ（App Store から来る。ナビ・パンくず・OGP なし）。サポートは noindex と canonical だけ確かめる
        if h1 != 1: issues.append(f'h1 x{h1}')
        if u.endswith('/support/'):
            if '<meta name="robots" content="noindex">' not in s: issues.append('no noindex')
            if not can or can.group(1) != BASE + u: issues.append('canonical')
            if '<nav' in s or 'class="crumb' in s: issues.append('nav')
        if issues: probs.append((u, issues))
        print(f'{u:28s} t{len(t):3d} standalone {"OK" if not issues else issues}')
        continue
    en = u.startswith('/en/')   # 英語のページは文字数の目安がちがう（title 65・description 160 まで）
    if len(t) > (65 if en else 32): issues.append(f'title {len(t)}')
    if not d or len(d) > (160 if en else 110): issues.append(f'desc {len(d)}')
    if en and '<html lang="en">' not in s: issues.append('lang')
    alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', s))
    if alts:   # hreflang: 自分が入っていて、相手のページにも同じ3行があること
        if BASE + u not in alts.values() or set(alts) != {'ja', 'en', 'x-default'}: issues.append(f'hreflang {alts}')
        for h in alts.values():
            st2, b2, _ = get(h[len(BASE):])
            if st2 != 200 or dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">', b2.decode('utf-8', 'replace'))) != alts: issues.append(f'hreflang pair {h}')
    elif en: issues.append('no hreflang')
    if not can or can.group(1) != BASE + u: issues.append(f'canonical {can.group(1) if can else None}')
    if h1 != 1: issues.append(f'h1 x{h1}')
    if not okld or not lds: issues.append('jsonld')
    if u not in ('/', '/en/') and not crumb: issues.append('no crumb')
    if not ogi or not ogi.group(1).startswith('https://'): issues.append('og:image')
    elif get(ogi.group(1)[len(BASE):].split('?')[0])[0] != 200: issues.append('og:image 404')
    if issues: probs.append((u, issues))
    print(f'{u:28s} t{len(t):3d} d{len(d):4d} ld{len(lds)} {"OK" if not issues else issues}')
print('PROBLEMS', probs)

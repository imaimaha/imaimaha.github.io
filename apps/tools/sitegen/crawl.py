# ローカルのサーバーでサイトをたどって、リンク切れ・h1・タイトル・説明・canonical・JSON-LD・パンくずを確かめる
import re, json, html, urllib.request, urllib.parse, collections
B = 'http://127.0.0.1:8790'; BASE = 'https://imaimaha.github.io'
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
    if len(t) > 32: issues.append(f'title {len(t)}')
    if not d or len(d) > 110: issues.append(f'desc {len(d)}')
    if not can or can.group(1) != BASE + u: issues.append(f'canonical {can.group(1) if can else None}')
    if h1 != 1: issues.append(f'h1 x{h1}')
    if not okld or not lds: issues.append('jsonld')
    if u != '/' and not crumb: issues.append('no crumb')
    if not ogi or not ogi.group(1).startswith('https://'): issues.append('og:image')
    elif get(ogi.group(1)[len(BASE):].split('?')[0])[0] != 200: issues.append('og:image 404')
    if issues: probs.append((u, issues))
    print(f'{u:28s} t{len(t):3d} d{len(d):4d} ld{len(lds)} {"OK" if not issues else issues}')
print('PROBLEMS', probs)

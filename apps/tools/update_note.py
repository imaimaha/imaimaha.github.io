#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""note の記事の一覧を /apps/note.json に書き出す（トップ・/about/・/note/ が読む）。
保存するのはタイトル・リンク・日付・見出し画像の URL だけ（本文は保存しない）。
まず note の公開 API（記事一覧）をページごとに読み（1ページごとに 2 秒あける）、だめなら RSS（最新 25 件くらい）を使う。
使い方: python3 apps/tools/update_note.py   （そのあと apps/note.json をコミットして push）"""
import json, os, time, urllib.request, xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

USER = 'redemarrage22'
PROFILE = f'https://note.com/{USER}'
API = f'https://note.com/api/v2/creators/{USER}/contents?kind=note&page='
RSS = f'https://note.com/{USER}/rss'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'note.json')
UA = {'User-Agent': 'imanoapp-site/1.0 (+https://imaimaha.github.io/)'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.read()

def from_api():
    items, page = [], 1
    while page <= 50:
        d = json.loads(get(API + str(page)))['data']
        for c in d.get('contents', []):
            url = c.get('noteUrl') or ''
            if not c.get('name') or not url.startswith('https://note.com/'):
                continue
            items.append({'title': c['name'].strip(), 'url': url, 'date': (c.get('publishAt') or '')[:10],
                          'thumb': c.get('eyecatch') or ''})
        if d.get('isLastPage', True):
            break
        page += 1
        time.sleep(2)
    return items

def from_rss():
    root = ET.fromstring(get(RSS))
    items = []
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip(); link = (it.findtext('link') or '').strip()
        if not title or not link.startswith('https://note.com/'):
            continue
        date = it.findtext('pubDate')
        th = it.find('{http://search.yahoo.com/mrss/}thumbnail')
        items.append({'title': title, 'url': link, 'date': parsedate_to_datetime(date).strftime('%Y-%m-%d') if date else '',
                      'thumb': (th.text or '').strip() if th is not None and th.text else ''})
    return items

def main():
    try:
        items, src = from_api(), 'api'
    except Exception as e:
        print('API failed:', e, '-> RSS')
        items, src = from_rss(), 'rss'
    if not items:
        raise SystemExit('no items found; note.json not changed')
    items.sort(key=lambda x: x['date'], reverse=True)
    data = {'profile': PROFILE, 'source': src, 'count': len(items), 'items': items}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', OUT, len(items), 'items from', src)

if __name__ == '__main__':
    main()

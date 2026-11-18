#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""note の最新記事を /apps/note.json に書き出す（トップページの「note の最新記事」が読む）。
タイトル・リンク・日付だけを保存し、本文は保存しない。
使い方: python3 apps/tools/update_note.py   （そのあと apps/note.json をコミットして push）"""
import json, os, urllib.request, xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

RSS = 'https://note.com/redemarrage22/rss'
PROFILE = 'https://note.com/redemarrage22'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'note.json')
N = 5

def main():
    req = urllib.request.Request(RSS, headers={'User-Agent': 'imanoapp-site/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        root = ET.fromstring(r.read())
    items = []
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        date = it.findtext('pubDate')
        if not title or not link.startswith('https://note.com/'):
            continue
        d = parsedate_to_datetime(date).strftime('%Y-%m-%d') if date else ''
        items.append({'title': title, 'url': link, 'date': d})
        if len(items) >= N:
            break
    if not items:
        raise SystemExit('no items found; note.json not changed')
    data = {'profile': PROFILE, 'items': items}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('wrote', OUT, len(items), 'items')

if __name__ == '__main__':
    main()

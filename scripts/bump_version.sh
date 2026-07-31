#!/usr/bin/env bash
# デプロイのたびに実行する: アセットのキャッシュバスター (?v=) と version.json を更新する。
#
# なぜ必要か: GitHub Pages は Cache-Control: max-age=600 を返すため、push 後10分ほど
# 端末が古い HTML/JS を掴み続ける。HTML と共通JS の版がずれると機能が無反応になる事故もある。
#   - version.json  … util.js の自動リロード判定が no-store で読む
#   - ?v=<version>  … 新しい HTML が必ず新しい JS/CSS を読むようにする
#
# 使い方:  bash scripts/bump_version.sh            (UTC の日時から自動生成)
#          bash scripts/bump_version.sh 202608011200
set -euo pipefail
cd "$(dirname "$0")/.."

V="${1:-$(date -u +%Y%m%d%H%M)}"

printf '{ "version": "%s" }\n' "$V" > version.json

# util.js が持つ自分のバージョン
sed -i -E "s/^const APP_VERSION = '[^']*'/const APP_VERSION = '$V'/" assets/js/util.js

# 各ページの assets 参照に ?v= を付け直す (既にあれば差し替え)
for f in *.html; do
  [ -e "$f" ] || continue
  sed -i -E "s@(assets/(js|css|data)/[A-Za-z0-9_.-]+\.(js|css))(\?v=[^\"']*)?@\1?v=$V@g" "$f"
done

echo "bumped to $V"
grep -m1 "^const APP_VERSION" assets/js/util.js

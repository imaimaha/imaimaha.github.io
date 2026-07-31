# 速度改善計画（写真の重さ対策）

**作成日**: 2026-08-01
**背景**: ユーザー体感「写真とかが重い」。原因調査 → 設計まで（実装は未着手）。

---

## 1. 診断結果（実測ベース）

### 犯人は写真。サーバーでも機能数でもない

| 疑い | 判定 | 根拠 |
|------|------|------|
| 写真が重い | ⭕ **主犯** | 下記の4重苦 |
| サーバー起因 | △ 一部 | Supabase REST の TTFB は温まって ~0.5s/クエリで正常。GitHub Pages も ~0.9s。ただし Free プランの帯域は細く、写真1枚(6MB)のDLに実測 4.7〜6.8秒かかる |
| 機能つけすぎ | ❌ 無関係 | MPA なので各ページ独立。index.html の ~15 クエリは並列発火で合計 ~1s。JS/CSS も最大258KB(ビンゴプール)で写真1枚より小さい |

### 写真の4重苦（2026-08-01 実測）

1. **無圧縮アップロード**: 5ページすべて（bingo / dates / color_hunting / memories / one_on_one）が `upload(path, file)` にカメラ原寸ファイルを直渡し。**実データ: 131枚で327MB、平均2.5MB、最大6MB**

   | フォルダ | 枚数 | 合計 | 平均 |
   |---|---|---|---|
   | color_hunts | 77 | 193.5MB | 2.5MB |
   | bingo | 28 | 72.6MB | 2.6MB |
   | date_photos | 19 | 34.6MB | 1.8MB |
   | 1on1 | 4 | 13.3MB | 3.3MB |

2. **サムネイル無し**: 一覧・グリッド表示でも原寸をそのまま `<img>` に入れている。カラーハント1画面 = 8枚×2.5MB ≈ **20MB**。memories.html は **limit 無しで全件** 一気読み（理論上300MB超）
3. **キャッシュ完全無効**: `createSignedUrl(path, 3600)` を開くたびに再発行 → トークンが毎回変わる → URL が毎回変わる → ブラウザ/CDN キャッシュのキーが一致せず**同じ写真を毎回フルDL**（`cf-cache-status: DYNAMIC` 確認済み）。egress（Free 5GB/月）も浪費する
4. **loading="lazy" ゼロ**: 画面外の写真も全部同時DL。sw.js は push 専用で fetch キャッシュ機能なし

体感の式: カラーハントを開く = 20MB ÷ 実測 ~1Mbps ≈ **数十秒**。これが「重い」の正体。

---

## 2. 設計（優先度順）

### ① アップロード時圧縮 【最優先・効果1/10】

- `util.js` に `compressImage(file, maxEdge=1600, quality=0.82)` を追加（createImageBitmap → canvas → toBlob('image/jpeg')）
- 5ページの upload 直前に1行差し込むだけ。2.5MB → **200〜400KB**
- iOS の HEIC は `<input accept="image/*">` 経由なら Safari が JPEG に変換して渡してくるので追加対応不要。念のため toBlob 失敗時は元ファイルにフォールバック
- アップロード時 `cacheControl: '31536000'` を指定（③の布石）

### ② サムネイル二段構え 【一覧表示 1/60】

- ①と同時に長辺400px（~40KB）のサムネも生成し `thumbs/<元と同じpath>` にアップ
- 一覧/グリッドは thumb、タップ（ライトボックス・詳細）で原寸
- thumb が無い旧写真は原寸にフォールバック（onerror で差し替え）
- ※ Supabase の Image Transformation は Pro プラン($25/月)専用なのでクライアント生成が正解

### ③ 署名URLキャッシュ 【再訪をゼロDLに】

**案A（推奨・簡単）**: 期限を7日（604800）にして `localStorage` に `{path: {url, exp}}` をキャッシュ。期限内は再発行しない → URL が不変になり、①の cacheControl と合わせてブラウザ HTTP キャッシュが効く
**案B（堅牢・工数中）**: sw.js に fetch ハンドラを追加し、storage ドメインの画像レスポンスを Cache API に **path をキー**に保存（トークン差を無視できる）。オフライン閲覧も可能になる
→ まず案Aで十分。案Bは将来のオフライン強化(PLAN_FUTURE_FEATURES D-3)と合流させる

### ④ 既存327MBの一括再圧縮（バックフィル）

- Node スクリプト `scripts/recompress_photos.js`（rasterize_icon.js と同じく Playwright chromium の canvas で圧縮）
- service_role で 全DL → 長辺1600圧縮 → 同 path に upsert 上書き + thumbs 生成
- 327MB → **~35MB** 見込み。DB の path は変わらないのでコード側の変更不要
- ⚠️ 実行前に元ファイルの退避（ローカルに一括DLしてから）。実データなので破壊注意

### ⑤ 小物（1時間）

- 写真 `<img>` に `loading="lazy"` + `width/height`（レイアウトシフトも減る）
- memories.html に limit + 「もっと見る」ページング（50件ずつ）

---

## 3. 効果見込み

| シーン | 現状 | 対策後 |
|---|---|---|
| カラーハント初回表示 | ~20MB / 数十秒 | thumb 8枚 ≈ 320KB / 1〜2秒 |
| カラーハント再訪 | 毎回20MB再DL | キャッシュヒットで **0B** |
| memories.html | 全件原寸(300MB級) | thumb×50件 ≈ 2MB |
| 新規アップロード | 2.5〜6MB送信 | 250〜450KB(本体+thumb) |
| Supabase egress | 浪費(5GB/月枠) | 1/50 以下 |

## 4. 工数

- ①+②+③案A: 半日（util.js 追加 + 5ページ改修 + 表示側 thumb 化）
- ④: 2〜3時間（スクリプト + 実行 + 検証）
- ⑤: 1時間
- 検証: Playwright で「アップ→一覧が thumb→タップで原寸」+ 実機で体感確認

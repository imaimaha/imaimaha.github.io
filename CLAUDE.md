# Notre Endroit — 開発ガイド

彼女と共有するプライベートサイト。2人だけのポータル。

## デプロイ

- **本番 URL**: https://imaimaha.github.io
- **リポジトリ**: https://github.com/imaimaha/imaimaha.github.io
- **方式**: GitHub Pages（`git push` → 自動デプロイ、1〜2分）
- **旧 URL** (使用停止): `redemarrage22.workers.dev` — Cloudflare Workers に残骸あり、無視してよい

## 技術スタック

| 項目 | 内容 |
|------|------|
| ホスティング | GitHub Pages（静的ファイルのみ） |
| 認証・DB | Supabase (Auth + PostgreSQL) |
| フロントエンド | バニラ HTML/CSS/JS（フレームワークなし） |
| Supabase URL | `https://qivnfiqyjfajlzbdqodd.supabase.co` |
| Supabase Key | `sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx`（publishable） |

## ページ一覧

| ファイル | タイトル | 概要 |
|----------|----------|------|
| `index.html` | Notre Endroit | トップページ |
| `login.html` | — | ログイン（未ログインなら全ページリダイレクト） |
| `closer.html` | One Step Closer | 絵文字ゲージ（メイン機能） |
| `status.html` | 今日の帰宅 | 退社時間共有 |
| `calendar.html` | ふたりの予定 | 共有カレンダー |
| `memories.html` | 思い出アルバム | 写真アルバム |
| `wishlist.html` | やりたいことリスト | Wishlist |

## Supabase テーブル

| テーブル | 主なカラム | 用途 |
|----------|-----------|------|
| `profiles` | id, name, emoji | ユーザープロフィール（fox=🦊 / hed=🦔） |
| `closer_gauge` | user_id PK, gauge int, updated_at | ゲージ値 |
| `status` | user_id, finish_time, note, updated_at | 退社予定 |
| `events` | — | カレンダーイベント |
| `memories` | — | 思い出テキスト |
| `photos` | — | 写真（未実装） |
| `wishes` | — | Wishlist |

### RLS ポリシー（重要）

- `profiles`: `profiles_read_all` — authenticated ユーザーは全員のプロフィールを読める
- `closer_gauge`: `all_authenticated` FOR ALL — 全操作許可
- これがないと相手のプロフィール/ゲージが取得できない

## closer.html の仕様

### ゲージロジック

- 自分の絵文字をタップ → 自分のゲージが +5（最大 100）
- 相手の絵文字をタップしても自分のゲージは増えない
- ゲージは Supabase の `closer_gauge` に upsert で保存
- **24時間線形減衰**: `effective = round(gauge * max(0, 1 - elapsed / 24h))`
- `effective()` が表示値、`raw` が DB 保存値

### 両方 MAX でくっつく条件

```js
bothMax = raw.fox.gauge >= 100 && raw.hed.gauge >= 100 && effective('fox') > 0 && effective('hed') > 0
```

`effective >= 100` では**ない**（7分後に 99% になって外れるバグがあったため）

### 浮遊アニメーション

- `requestAnimationFrame` ループで位置更新
- 移動範囲: `x: 18〜80vw`, `y: 20〜72vh`（トップバー・端に被らないよう制限）
- `bothMax` 時は中央ターゲットへ lerp（fox→30%, hed→52% / y: 40%）

### ゲージ表示

- `#fox-pct` / `#hed-pct` — トップバー直下の `.gauge-bar` に表示
- `.gauge-bar`: `position: fixed; top: 58px; z-index: 30`
- `updateDistance()` 内で毎回更新、`setInterval(updateDistance, 60000)` で1分毎にも更新

### デバッグ用グローバル

```js
window._closer = { foxUid, hedUid, myId, raw, effective }
```

## 星アニメーション（stars.js）

- `position: fixed` + `window.innerWidth/innerHeight` で px 指定
  - **注意**: `position: absolute` + `vw/vh` だと `position:fixed` の親コンテナ内でブラウザが正しく解決できず、全星が `left:0` に集まるバグがあった
- 左端 18% を除外して配置（左端グロー防止）
- 左上コーナー 25%×25% も除外
- 流れ星は左端 15% 除外
- キャッシュバスター: `stars.js?v=3`（変更時は v 番号を上げること）

## Playwright テスト

### セットアップ

```bash
npm install
npx playwright install chromium
```

### 実行

```bash
npm test                    # ヘッドレス
npm run test:headed         # ブラウザ表示あり
npm run test:ui             # UI モード
```

### テストアカウント

- メール: `claude@example.com`
- パスワード: `claude`
- ※ profiles テーブルにデータなし → myType が null になるテストは skip される

### 認証の仕組み

1. `tests/auth.setup.js` でログイン → `tests/storage/auth.json` に保存
2. `debug.spec.js` が `storageState: auth.json` を使って認証済み状態でテスト
3. `auth.json` は localhost:3000 用。**本番 URL には使えない**

### webServer

`playwright.config.js` が `npx serve . -p 3000` を自動起動する。`reuseExistingServer: true` なので手動起動済みなら再起動しない。

### テストファイル

| ファイル | 内容 |
|----------|------|
| `tests/debug.spec.js` | 全要件テスト（コンソールエラー、表示、ゲージ、merge、DB保存、減衰、ポップアップ） |
| `tests/state_check.spec.js` | raw/effective の現在値と merge 状態を出力する診断用 |

## 既知の注意点

- 403/406 エラー: テストアカウントに profiles データがないため発生。実ユーザーでは出ない
- `closer.html` の `_sb.auth.getSession()` チェックで未ログインなら `/login.html` にリダイレクト
- `status.html` の `makeCard()` は profile が null でも null guard 済み
- `memories.html` の写真アップロードは未実装（`photos` テーブルはある）

## これからつけたい機能（メモ）

- [ ] 写真アップロード（memories.html）
- [ ] LINE 通知（「行っていい？」ボタンから）
- [ ] カスタムドメイン設定
- [ ] プッシュ通知（ゲージが MAX になったとき相手に通知）

## 環境

- OS: Windows 11 + WSL2 (Ubuntu)
- 作業ディレクトリ: `/mnt/c/Users/redem/Documents/dev/imaimaha.github.io`
- Node: v18
- Playwright スクリーンショットはWSL2アーティファクトで左端に点が出ることがある（実ブラウザでは出ない）

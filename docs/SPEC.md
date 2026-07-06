# Notre Endroit 仕様書

> このドキュメントは Notre Endroit の**正式仕様**を集約したリファレンス。
> 実装が変わる度にここも更新すること。
> Claude が「notre」「imaimaha」等の呼称で参照する時は、まずこのファイルを読む。

**最終更新**: 2026-07-06

---

## 目次

1. [プロダクト概要](#1-プロダクト概要)
2. [ユーザーモデル](#2-ユーザーモデル)
3. [技術スタック](#3-技術スタック)
4. [ページ機能仕様](#4-ページ機能仕様)
5. [ポイントシステム](#5-ポイントシステム)
6. [通知システム](#6-通知システム)
7. [データモデル (Supabase)](#7-データモデル-supabase)
8. [ロールオーバー時刻表](#8-ロールオーバー時刻表)
9. [運用・デプロイ](#9-運用デプロイ)
10. [開発ルール](#10-開発ルール)

---

## 1. プロダクト概要

**Notre Endroit**（旧称 imaimaha HP）は、2人だけで使うプライベートポータル。彼氏（fox 🦊 / nick）と彼女（hed 🦔 / hedgehog）の共有スペース。

- **本番URL**: https://imaimaha.github.io
- **リポジトリ**: `imaimaha/imaimaha.github.io` (GitHub)
- **公開範囲**: 認証必須。robots.txt で crawler ブロック。**外部に見えないことが絶対条件**
- **デザイン方針**: モバイルファースト（PCは開発時のみ確認用）

### 設計哲学

- **プライベート**: URL を知られても Supabase Auth で拒否
- **軽量**: バニラ HTML/CSS/JS。フレームワーク無し
- **ゲーム性**: ポイント/ガチャ/ビンゴ等の遊び要素で日常を楽しく
- **相互性**: 2人がお互いのアクションを見られる（履歴共有）

---

## 2. ユーザーモデル

固定 2 ユーザー + テスト用 1 アカウント（計3）:

| 役割 | プロフィール | 絵文字 | 主な操作 |
|------|-------------|--------|----------|
| fox | nick | 🦊 | 全機能 |
| hed | hedgehog | 🦔 | 全機能 |
| test | claude@example.com / claude | 👤 | Playwright テスト用 |

- **識別**: `profiles.emoji` で判定（🦊 = fox, 🦔 = hed）
- **LINE連携**: 各ユーザーの `line_user_id` を profiles に登録済み
- **LINEグループ**: `settings.line_group_id` に登録済み

---

## 3. 技術スタック

| 項目 | 内容 |
|------|------|
| ホスティング | GitHub Pages（静的ファイル）。`git push` で自動デプロイ（1〜2分） |
| フロント | バニラ HTML/CSS/JS（フレームワークなし） |
| 認証・DB | Supabase (Auth + PostgreSQL) |
| Storage | Supabase Storage（`memories` bucket・private） |
| Edge Functions | Deno |
| プッシュ通知 | Web Push API + VAPID + Service Worker |
| LINE通知 | LINE Messaging API |
| スケジュール | pg_cron |

### Supabase

- URL: `https://qivnfiqyjfajlzbdqodd.supabase.co`
- ref: `qivnfiqyjfajlzbdqodd`
- 秘密情報は `.env` に格納（`.gitignore` 済）。Claude memory / CLAUDE.md / コミットには**絶対に書かない**

---

## 4. ページ機能仕様

### 4.1 トップ (`index.html` — Notre Endroit)

- Hero: ふたりのプロフィール絵文字、記念日カウンター（**JST 朝2時境界**でロールオーバー）
- セクション順: 今日の帰宅 → ゲージ → クイズ（未回答時強調） → タイムカプセル → ビンゴ → カラーハント → ガチャ → 思い出 → 予定 → やりたいこと
- タイムカプセル届き通知（開封時刻を過ぎた自分宛の未開封）
- プッシュ通知状態バッジ（`#push-status-badge`）
- 右上絵文字ボタン（共通ヘッダー）→ タップでログアウト確認

### 4.2 今日の帰宅 (`status.html`)

- ふたりの本日の帰宅予定時刻を共有
- `status` テーブルに保存
- **毎朝 6:00 JST に自動リセット**（pg_cron `daily-status-reset`）
- 「行っていい？」ボタン → **LINE Push通知（クイックリプライ付き）**
  - 選択肢: いいよ ✅ / きびしい 🚫 / 仕事の進み次第 🤔

### 4.3 One Step Closer (`closer.html`)

- 2匹のフローティング絵文字（🦊🦔）が画面内で動く
- 自分の絵文字をタップ → 自分のゲージ +5%（最大100）
  - **タップで％が増える時のみ +1pt**
- **24時間線形減衰**: `effective = round(gauge * max(0, 1 - elapsed/24h))`
- MAX到達（raw が 100 に初到達した瞬間） → **+5pt** + Push通知（相手へ）
- **両方MAX**（`raw.fox.gauge >= 100 && raw.hed.gauge >= 100 && effective両方>0`）で絵文字がくっつく
- Realtime channel で相手のゲージ変動を即時反映

### 4.4 今日のクイズ (`quiz.html`)

- 日替わり質問 30種（`QUESTIONS` 配列にハードコード）
- 選出: `parseInt(dateStr.replace(/-/g,'')) % 30`（JST 0時ロールオーバー）
- 回答で **+10pt**、相手にPush通知
- 履歴閲覧: 過去の質問と2人の回答を並べて表示
- 未回答時、トップページに強調バッジ表示

### 4.5 タイムカプセル (`time_capsule.html`)

- 未来の日時にメッセージを送信 → 開封時刻に届く
- **タブ**: 届いた / 送った / 作る
- **届いた** は共有ビュー：両者の間で開封済のカプセル全部見える。sender→recipient 方向表示
- **送信 +3pt / 開封 +3pt / 返信 +1pt**
- 開封タイミング3モード:
  - `exact`: 日時指定
  - `range`: 開始〜終了の範囲でランダム
  - `auto`: 3〜90日後ランダム
- **スレッド返信**: 開封済みカプセルに直接返信投稿（`replies` jsonb）。sender/recipient両方が投稿可
- 通知フロー:
  - `open_at <= now()` の未通知カプセルを **5分毎 pg_cron** が検出 → `notify-capsules` → `send-push`
  - 送信者側フォールバック: トップ画面で `is_opened=false && open_at<=now && line_notified=false` をチェックしてPush送信

### 4.6 お散歩ビンゴ (`bingo.html`)

- **今週のビンゴ**（毎週月曜切替、JST基準）+ カテゴリ別 + ランダム難易度3段階
- 5カテゴリ: 日常 / 気持ち / 都会 / 二人限定 / 沖縄
- グリッドサイズ 3×3 / 4×4 / 5×5
- カード**永続化**: 全モードで同じカードが返る（再生成ボタンで新規）
- 履歴閲覧: 2人のチェック付きカードを閲覧（読み込み専用）
- **マスチェック +1pt / ライン揃った +5pt / コンプ +20pt**
- ライン揃った/コンプ時に相手にPush通知
- シェア: `html2canvas` で PNG化 → Web Share API

### 4.7 カラーハンティング (`color_hunting.html`)

- 中央に色パッチ、周囲8マスに写真アップロードして色に合うものを集める
- **モード**:
  - **今週のテーマ色**: 週キー(月曜日付)からパレット決定
  - **単発**: 「色を指定」（パレット20色 + 自由）or 「ランダム」
  - **履歴**: 2人の過去のカラーハント一覧
- 単発モードは **localStorage に active hunt ID** を保持 → ページ再訪で同じセッションに戻る
- 再生成ボタンで初期画面（single-sub）へ、activeクリア
- **写真追加 +2pt / コンプ(8/8) +15pt**
- 4枚達成・コンプで相手にPush通知
- 写真は `memories` bucket の `color_hunts/<user_id>/` に保存、`createSignedUrl` で表示

### 4.8 ガチャ (`gacha.html`)

- **100pt消費**でN/R/SR抽選
- 景品13種（ハードコード）:
  - N (76%): ハグ券 / おやすみ電話券 / ごはん選択権 / 写真撮影券 / +50pt / スタンプ送信権
  - R (20%): デート行き先選択権 / 手料理券 / +200pt / サプライズ計画権
  - SR (4%): 一日デート券 / +500pt / 願いごと券
- **ポイント景品のボーナスは「使用済み」にした時に付与**（受け取り時ではない）
- 券のリスト表示: 相手の券は「相手の券」ラベル、自分のみ使用可
- ポイント履歴 (`points.html`) への導線あり

### 4.9 思い出アルバム (`memories.html`)

- 写真アップロード（複数選択・ドラッグ&ドロップ・メモ付き）
- Supabase Storage `memories` bucket（private）に保存
- `createSignedUrl` (1時間有効) で表示
- アップロード時、相手にPush通知

### 4.10 共有カレンダー (`calendar.html`)

- ふたりの予定を月表示
- 予定追加 → 相手にPush通知
- 記念日マーク（11/22）自動表示、今年/来年分挿入

### 4.11 やりたいこと (`wishlist.html`)

- 4ジャンル: 行きたい場所 / 食べたいもの / 見たいもの / ほしいもの
- タブ切替、追加・チェック・削除

### 4.12 ポイント履歴 (`points.html`)

- 自分のポイント履歴（獲得・消費）一覧・集計
- フィルタ: 全部 / 獲得 / 消費

### 4.13 共通コンポーネント

- `assets/js/header.js` — 全ページ右上に絵文字ボタン。タップでログアウト確認
- `assets/js/push.js` — Web Push 購読管理＋状態バッジ（`#push-status-badge` があるページのみ）
- `assets/js/stars.js` — 背景の星アニメーション

---

## 5. ポイントシステム

**残高計算**: `SELECT SUM(amount) FROM points WHERE user_id = ?`

### 獲得手段

| 動作 | pt | reason |
|------|----|----|
| ゲージタップ（％が増えた時のみ） | +1 | `gauge_tap` |
| ゲージMAX到達（自分が初めて100） | +5 | `gauge_max` |
| クイズ回答 | +10 | `quiz` |
| ビンゴ マスチェック（新規のみ） | +1 | `bingo_check` |
| ビンゴ 新規ライン1本 | +5 | `bingo_line` |
| ビンゴ 全マスコンプ | +20 | `bingo_complete` |
| タイムカプセル送信 | +3 | `capsule_send` |
| タイムカプセル開封 | +3 | `capsule_open` |
| タイムカプセル返信 | +1 | `capsule_reply` |
| カラーハント 写真追加 | +2 | `color_photo` |
| カラーハント コンプ(8/8) | +15 | `color_complete` |
| ガチャ景品ボーナス（使用時に付与） | +50/+200/+500 | `gacha_bonus` |

### 消費手段

| 動作 | pt | reason |
|------|-----|----|
| ガチャ回転 | -100 | `gacha` |

---

## 6. 通知システム

### 6.1 チャネル

| チャネル | 用途 |
|---------|------|
| **Push（Web Push）** | メイン。アプリ内アクション全般 |
| **LINE** | 限定的。「行っていい？」のクイックリプライのみ |

**方針**: 「基本すべて Push、LINE群通知は廃止」。LINEはチャットが埋まるため、クイックリプライが必要なケースのみ残す。

### 6.2 プッシュ通知の発火条件（instant）

| 発火元 | 条件 | 送信先 | body |
|--------|------|--------|------|
| `closer.html` | 自分のゲージ初MAX到達 | 相手 | 「ゲージMAX！ 会いたいシグナル💖」 |
| `closer.html` | ふたり同時MAX | 両者（sender以外） | 「ふたりMAX✨」（LINE群通知も併用） |
| `calendar.html` | 予定追加 | 相手 | 「📅 予定を追加したよ: {title}」 |
| `status.html` | 帰宅時間保存 | 相手 | 「🕐 {emoji} {name} の今日の帰宅: {time}」 |
| `status.html` | 「行っていい？」ボタン | 相手 | **LINE併用（クイックリプライ）** |
| `index.html` | 自分の送ったカプセル配達時（フォールバック） | 相手 | 「🎁 タイムカプセルが届きました」 |
| `notify-capsules` (pg_cron 5分毎) | サーバサイドで配達検知 | 相手 | 同上 |
| `time_capsule.html` | 返信投稿時 | もう一方 | 「↩️ タイムカプセルに返信」 |
| `memories.html` | 写真アップロード | 相手 | 「🌸 思い出が追加されたよ」 |
| `bingo.html` | ライン揃った/コンプ時 | 相手 | 「🎊 ビンゴX本目 / 🏆 完成」 |
| `color_hunting.html` | 4枚/8枚コンプ時 | 相手 | 「🎨 半分/コンプリート」 |
| `quiz.html` | 回答時 | 相手 | 「💬 クイズに回答したよ」 |

### 6.3 プッシュ通知の発火条件（scheduled / リマインダー）

`send-reminders` Edge Function + pg_cron で定期実行。`notifications_sent` テーブルで日次重複防止。

| ジョブ | JST時刻 | UTC | 条件 | 送信先 |
|--------|---------|-----|------|--------|
| `remind_status_1719` | 平日 17:19 | `19 8 * * 1-5` | 今日の`status`未登録 | 該当ユーザー |
| `remind_status_1901` | 平日 19:01 | `1 10 * * 1-5` | 同上 | 同上 |
| `remind_quiz_evening` | 毎日 22:00 | `0 13 * * *` | 今日の`quiz_answers`無し | 該当ユーザー |
| `remind_capsule_morn` | 毎朝 8:00 | `0 23 * * *` (前日UTC) | 自分宛の未開封カプセル有り | 該当ユーザー |
| `remind_bingo_sat` | 土 10:00 | `0 1 * * 6` | 今週のビンゴ<8マス | 該当ユーザー |
| `remind_color_sat` | 土 10:00 | `0 1 * * 6` | 今週のカラーハント<4枚 | 該当ユーザー |
| `remind_gauge_low` | 毎晩 21:00 | `0 12 * * *` | 自分の effective gauge <30 | 該当ユーザー |
| `remind_anniversary` | 毎朝 2:05 | `5 17 * * *` (前日UTC) | 1ヶ月前/1週間前/前日/当日/30日刻み | 両ユーザー |

### 6.4 通知タップ挙動

`payload.url` に指定されたパスへ遷移。既に開いてるウィンドウがあれば `navigate` してフォーカス、無ければ `openWindow`。（sw.js）

### 6.5 通知アーキテクチャ

```
[Client]
  └─ _sb.functions.invoke('send-push', { title, body, url, recipient_user_id or sender_user_id })
       └─ [Edge: send-push] JWT検証 → push_subscriptions 検索 → webpush.sendNotification
       
[pg_cron]
  └─ HTTP POST → [Edge: send-reminders] service_role JWT検証 → 各kind判定 → send-push
       
[LINE併用ケース]
  └─ _sb.functions.invoke('line-notify', { target, message, quick_reply? })
       └─ [Edge: line-notify] LINE Push API + 内部で send-push 呼び出し
```

**send-push** は認証ユーザーからも service_role からも呼べる。認証ユーザー経由の場合は JWT から sender uid を取得してなりすまし防止。

---

## 7. データモデル (Supabase)

### 7.1 テーブル一覧

| テーブル | 主なカラム | 用途 |
|----------|-----------|------|
| `profiles` | id, name, emoji, line_user_id | 2人のプロフィール |
| `closer_gauge` | user_id PK, gauge, updated_at | ゲージ値（24h線形減衰） |
| `status` | user_id, finish_time, note | 退勤予定（朝6時DELETE） |
| `events` | date, title, memo, user_id | カレンダーイベント |
| `memories` | (未使用) | — |
| `photos` | path, memo, user_id | 思い出アルバム写真 |
| `wishes` | genre, title, done, user_id | Wishlist |
| `bingo_sessions` | user_id, mode('weekly'\|'category'\|'random'), label, date_str(週の月曜), items, checks | ビンゴ進行状況 |
| `color_hunts` | user_id, mode('weekly'\|'single'), week_key, color_hex, color_name, photos(jsonb) | カラーハンティング |
| `time_capsules` | sender_id, recipient_id, message, open_at, is_opened, line_notified, opened_at, replies(jsonb) | タイムカプセル＋スレッド返信 |
| `points` | user_id, amount, reason | ポイント履歴（SUMで残高計算） |
| `quiz_answers` | user_id, question_id, answer, date_str | クイズ回答 |
| `gacha_results` | user_id, reward_id, reward_name, reward_emoji, rarity, used, bonus_points | ガチャ獲得券 |
| `push_subscriptions` | user_id, endpoint, subscription | Web Push 購読 |
| `notifications_sent` | user_id, kind, date_str | リマインダー重複防止 |
| `settings` | key, value | LINE group ID など汎用設定 |

### 7.2 RLS ポリシーの原則

- `profiles`: authenticated 全員 SELECT 可
- `closer_gauge`: 全操作許可
- `points`/`quiz_answers`/`gacha_results`: authenticated 全員 SELECT / 自分の分のみ INSERT・UPDATE
- `bingo_sessions`/`color_hunts`: authenticated 全員 SELECT（履歴共有）/ 自分の分のみ INSERT/UPDATE/DELETE
- `time_capsules`:
  - `sender_view`: 送信者は全部見える
  - `recipient_view`: 受信者は `open_at <= now()` の分だけ見える
  - `sender_insert`: 送信者として INSERT 可
  - `sender_update_notified`: 送信者は自分の分 UPDATE 可（`line_notified` 更新用）
  - `recipient_open`: 受信者は自分宛を UPDATE 可（`is_opened`）
  - `capsule_replies_update`: sender/recipient 両方が UPDATE 可（`replies` 追記）
- `push_subscriptions`: 自分の分のみ全操作
- `notifications_sent`: authenticated SELECT のみ（INSERTは service_role のみ）

### 7.3 GRANT 忘れずに

**RLS `CREATE POLICY` だけでは authenticated ロールが表を触れない**。必ず `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;` をセットで書く。過去にこれで permission denied が何度も出た。

---

## 8. ロールオーバー時刻表

各機能の「日付境界」まとめ:

| 機能 | 境界 | 実装 |
|------|------|------|
| 記念日カウンター | JST 02:00 | `new Date('2025-11-22T02:00:00+09:00')` |
| クイズ日付 | JST 00:00 | `new Date().toLocaleDateString('sv-SE')` |
| ビンゴ週次 | JST 月曜 00:00 | `getWeekStr()` で月曜YYYY-MM-DD |
| カラーハント週次 | JST 月曜 00:00 | 同上 |
| 帰宅ステータス | JST 06:00 リセット | pg_cron `daily-status-reset`（UTC 21:00 = JST 06:00） |
| タイムカプセル配達 | 5分粒度 | pg_cron `notify-capsules-5min` |

---

## 9. 運用・デプロイ

### 9.1 ローカル開発

- 作業ディレクトリ: `/mnt/c/Users/redem/Documents/dev/imaimaha.github.io`
- ローカルサーバ: `npx serve . -p 3000` （Playwright が自動起動）

### 9.2 デプロイ

- `git push` → GitHub Pages が自動デプロイ（1〜2分）
- たまに GitHub 側で `Deployment failed, try again later` が出る（既知の一時エラー）。**auto-retry コミットで再試行**

### 9.3 Supabase CLI

```bash
export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"
source .env
supabase login --token $SUPABASE_CLI_TOKEN
supabase db query --linked -f path/to/migration.sql
supabase functions deploy <name> --project-ref $SUPABASE_PROJECT_REF
```

### 9.4 pg_cron 管理

```bash
# 一覧
supabase db query --linked -o table "SELECT jobname, schedule FROM cron.job;"

# 実行履歴
supabase db query --linked -o table "SELECT jobid, status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"

# unschedule
supabase db query --linked "SELECT cron.unschedule('jobname');"
```

pg_cron の SQL に service_role JWT を直接埋め込む必要がある（`ALTER DATABASE SET` は superuser 権限が無く不可）。DB内なので許容範囲。

### 9.5 Playwright テスト

```bash
PW_EMAIL=claude@example.com PW_PASSWORD=claude npx playwright test --project=setup  # 初回のみ
npx playwright test <spec> --project=debug  # 個別実行
```

### 9.6 Management API

Service Role Key など秘密情報を取得可（CLIトークン認証）:

```bash
curl -s -H "Authorization: Bearer $SUPABASE_CLI_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys"
```

---

## 10. 開発ルール

### 10.1 秘密情報

- `.env`（`.gitignore` 済）に集約。Claude memory / CLAUDE.md / コミット履歴には**絶対に書かない**
- `.env.example` はコミット可

### 10.2 モバイルファースト

- スマホ最優先。PCは開発時のみ
- タップ領域を確保、フォントは 16px 以上、縦レイアウト重視

### 10.3 UI統一

- 全ページ右上に共通の絵文字ボタン（`assets/js/header.js` が挿入）
- タップで「ログアウトしますか？」ダイアログ
- `.top-bar` にはタイトル被り防止のため `padding-right: 66px`（header.js が自動注入）

### 10.4 コード規約

- バニラ HTML/CSS/JS（フレームワーク・トランスパイラなし）
- 各ページ独立（style は inline CSS で page-scoped）
- 共通ロジックは `assets/js/` に配置

### 10.5 通知の追加

新しい通知を追加する時は：

1. **instant** なら該当ページから `_sb.functions.invoke('send-push', {...})` を呼ぶ
2. **scheduled** なら `send-reminders` に `kind` を追加、pg_cron に schedule 登録、`notifications_sent` の `kind` 値を統一
3. `payload.url` を必ず設定（通知タップで飛ぶ先）
4. LINE併用が本当に必要かを検討。基本は Push のみ

### 10.6 マイグレーション

- SQL ファイルは `supabase/migrations/` に配置
- `CREATE POLICY IF NOT EXISTS` は PostgreSQL の構文に無い。`DO $$ BEGIN ... END $$` で判定するか、`DROP POLICY IF EXISTS` してから `CREATE POLICY`
- テーブル作成時は必ず `GRANT ... TO authenticated` を書く

---

## 付録: 主要 URL / ID

| 名前 | 値 |
|------|-----|
| 本番 URL | https://imaimaha.github.io |
| リポジトリ | https://github.com/imaimaha/imaimaha.github.io |
| Supabase Project | https://qivnfiqyjfajlzbdqodd.supabase.co |
| Supabase Ref | `qivnfiqyjfajlzbdqodd` |
| VAPID公開鍵 | `assets/js/push.js` の `_VAPID_PUB` |
| Storage bucket | `memories`（private） |
| テストアカウント | `claude@example.com` / `claude` |

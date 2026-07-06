# Notre Endroit — 開発ガイド

彼女と共有するプライベートサイト。2人だけのポータル（fox 🦊 / hed 🦔）。

## デプロイ

- **本番 URL**: https://imaimaha.github.io
- **リポジトリ**: https://github.com/imaimaha/imaimaha.github.io
- **方式**: GitHub Pages（`git push` → 自動デプロイ、1〜2分）
  - たまに GitHub 側で `deployment_queued` が10分以上ハマってタイムアウト失敗することあり。連続 push で再試行される
- **旧 URL** (停止): `redemarrage22.workers.dev`

## 技術スタック

| 項目 | 内容 |
|------|------|
| ホスティング | GitHub Pages（静的ファイルのみ） |
| 認証・DB | Supabase (Auth + PostgreSQL) |
| フロントエンド | バニラ HTML/CSS/JS（フレームワークなし） |
| Supabase URL | `https://qivnfiqyjfajlzbdqodd.supabase.co` |
| プロジェクト Ref | `qivnfiqyjfajlzbdqodd` |
| その他秘密情報 | プロジェクトルートの `.env` を参照（`.gitignore`済み） |

### 秘密情報の管理

- **`.env`** — プロジェクトルート、`.gitignore` 済み。以下を保管:
  - `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_CLI_TOKEN` (CLI login用)
  - `SUPABASE_SERVICE_ROLE_KEY` (JWT・pg_cron/管理系用)
- **`.env.example`** — テンプレート、コミット可
- Claude の memory / CLAUDE.md / コミット履歴には **絶対に書かない**
- 読み込み方: `source .env` or `export $(cat .env | grep -v '^#' | xargs)`

## ページ一覧

| ファイル | タイトル | 概要 |
|----------|----------|------|
| `index.html` | Notre Endroit | トップ。記念日カウンター(JST朝2時境界)・全機能への導線・クイズ未回答強調・タイムカプセル届き通知・プッシュ通知状態バッジ |
| `login.html` | — | ログイン。未ログインは全ページからリダイレクト |
| `closer.html` | One Step Closer | 絵文字ゲージ。タップで+5 & +1pt。MAX到達で+10pt・LINE通知 |
| `status.html` | 今日の帰宅 | 退勤時間共有。毎朝6時に自動リセット。「行っていい？」でクイックリプライ付きLINE |
| `calendar.html` | ふたりの予定 | 共有カレンダー |
| `memories.html` | 思い出アルバム | 写真アルバム |
| `wishlist.html` | やりたいこと | 4ジャンル |
| `bingo.html` | お散歩ビンゴ | 今週のビンゴ（月曜切替）・カテゴリ別・難易度別。カード永続化・履歴閲覧・シェア機能 |
| `color_hunting.html` | カラーハンティング | 中央の色に合う写真8枚を集めるゲーム。週次テーマ色モード＋単発モード＋履歴 |
| `time_capsule.html` | タイムカプセル | 未来へメッセージ。届いた/送ったは両者共有ビュー・開封後にスレッド返信可 |
| `quiz.html` | 今日のクイズ | 日替わり質問30種・+10pt |
| `gacha.html` | ガチャ | 100ptで抽選・N/R/SR・使用済みにした時にポイント券のボーナス付与。ポイント履歴への導線 |
| `points.html` | ポイント履歴 | 獲得・消費履歴の一覧、集計 |

### 共通コンポーネント

- `assets/js/header.js` — 全ページ右上に絵文字ボタン。タップでログアウト確認ダイアログ
- `assets/js/push.js` — Web Push 購読管理＋状態バッジ（`#push-status-badge` があるページのみ）
- `assets/js/stars.js` — 背景の星アニメーション

## Supabase テーブル

| テーブル | 主なカラム | 用途 |
|----------|-----------|------|
| `profiles` | id, name, emoji, line_user_id | 2人のプロフィール |
| `closer_gauge` | user_id PK, gauge, updated_at | ゲージ値（24h線形減衰） |
| `status` | user_id, finish_time, note | 退勤予定（朝6時DELETE） |
| `events` | — | カレンダーイベント |
| `memories` | — | 思い出テキスト |
| `photos` | path, memo, user_id | 思い出アルバム写真（Supabase Storage `memories` bucket） |
| `wishes` | — | Wishlist |
| `bingo_sessions` | user_id, mode('weekly'\|'category'\|'random'), label, date_str(週の月曜), items, checks | ビンゴ進行状況 |
| `color_hunts` | user_id, mode('weekly'\|'single'), week_key, color_hex, color_name, photos(jsonb) | カラーハンティング |
| `time_capsules` | sender_id, recipient_id, message, open_at, is_opened, line_notified, replies(jsonb) | タイムカプセル＋スレッド返信 |
| `points` | user_id, amount, reason | ポイント履歴（SUMで残高計算） |
| `quiz_answers` | user_id, question_id, answer, date_str | クイズ回答 |
| `gacha_results` | user_id, reward_id, reward_name, reward_emoji, rarity, used, bonus_points | ガチャ獲得券。bonus_pointsは使用時に加算 |
| `push_subscriptions` | user_id, endpoint, subscription | Web Push 購読 |
| `settings` | key, value | LINE group ID など汎用設定 |

### RLS ポリシーの原則

- `profiles`: 全 authenticated ユーザーが SELECT 可
- `closer_gauge`: 全操作許可
- `points/quiz_answers/gacha_results`: 認証済み全員 SELECT / 自分の分のみ INSERT・UPDATE
- `bingo_sessions`: 認証済み全員 SELECT（履歴共有のため）/ 自分の分のみ INSERT/UPDATE/DELETE
- `color_hunts`: 同上
- `time_capsules`:
  - `sender_view`: 送信者は全部見える
  - `recipient_view`: 受信者は `open_at <= now()` の分だけ見える
  - `sender_insert`: 送信者として INSERT 可
  - `sender_update_notified`: 送信者は自分の分 UPDATE 可（line_notified 更新用）
  - `recipient_open`: 受信者は自分宛を UPDATE 可（is_opened）
  - `capsule_replies_update`: sender/recipient両方が UPDATE 可（replies追記用）

### 重要な注意：GRANT忘れずに

Supabase で `CREATE TABLE` + `CREATE POLICY` しても、`authenticated` ロールに `GRANT SELECT, INSERT, UPDATE` しないと **permission denied** になる。必ずセットで書くこと。

## Edge Functions

| 関数 | 用途 | トリガー |
|------|------|----------|
| `line-notify` | LINE + Web Push 送信 | クライアント/他Functionから |
| `line-webhook` | LINE からのメッセージ受信 | LINE Platform |
| `send-push` | Web Push 送信のみ | 他Functionから |
| `notify-capsules` | 開封日時を過ぎた未通知カプセルの一括通知 | pg_cron 5分毎 |

### デプロイ

```bash
export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"
supabase login --token <CLIトークン>  # Claudeのmemory参照
supabase functions deploy <name> --project-ref qivnfiqyjfajlzbdqodd
```

## pg_cron スケジュール

| ジョブ名 | スケジュール | 内容 |
|---------|-------------|------|
| `daily-status-reset` | `0 21 * * *` (JST 6:00) | `status` テーブルを全DELETE |
| `notify-capsules-5min` | `*/5 * * * *` | `notify-capsules` Edge Function を呼び出し |

`notify-capsules-5min` は SQL 内に service_role JWT を直接埋め込んでいる（`ALTER DATABASE SET` は superuser 権限がなく不可）。DB内なので許容範囲。

### cron の管理

```bash
# 一覧
supabase db query --linked -o table "SELECT * FROM cron.job;"

# 実行履歴（失敗確認）
supabase db query --linked -o table "SELECT jobid, status, return_message, start_time FROM cron.job_run_details WHERE jobid = 1 ORDER BY start_time DESC LIMIT 5;"

# 削除
supabase db query --linked -o table "SELECT cron.unschedule('jobname');"
```

## SQL 実行の注意

### ローカルからのSQL実行

```bash
supabase db query --linked -o table "SQL文"
# or
supabase db query --linked -f path/to/file.sql -o table
```

### `CREATE POLICY IF NOT EXISTS` は使えない

PostgreSQLの構文にない。二重実行防止したいなら DO ブロックで判定：

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='foo' AND policyname='bar') THEN
    CREATE POLICY "bar" ON foo FOR SELECT USING (true);
  END IF;
END $$;
```

## ポイントシステム

- テーブル: `points` に `amount` を INSERT で記録（正=獲得、負=消費）
- 残高: `SELECT SUM(amount) FROM points WHERE user_id = ?`
- 獲得手段:
  - `gauge_tap`: ゲージタップで +1
  - `quiz`: クイズ回答で +10
- 消費手段:
  - `gacha`: ガチャ回転で -100
- ボーナス:
  - `gacha_bonus`: ポイント景品を引くと +50/+200/+500

## ガチャ景品

`gacha.html` の `PRIZES` 配列にハードコード（13種）。重み: N=5, R=2, SR=0.5（合計39.5）。

- **N (76%)**: ハグ券 / おやすみ電話券 / ごはん選択権 / 写真撮影券 / +50pt / スタンプ送信権
- **R (20%)**: デート行き先選択権 / 手料理券 / +200pt / サプライズ計画権
- **SR (4%)**: 一日デート券 / +500pt / 願いごと券

## クイズ質問

`quiz.html` の `QUESTIONS` 配列に30問ハードコード。カテゴリ: `today/partner/self/couple/fun`。
日替わり選出: `parseInt(dateStr.replace(/-/g,'')) % QUESTIONS.length`。

## タイムカプセル

- 開封タイミング3モード:
  - `exact`: 日時指定（datetime-local）
  - `range`: 開始〜終了の範囲でランダム
  - `auto`: 3〜90日後ランダム
- 通知フロー:
  - `open_at <= now()` の未通知カプセルを 5分毎 pg_cron が検出
  - `notify-capsules` → `line-notify` 経由で LINE+プッシュ通知
  - `line_notified = true` に更新して二重通知防止
- 受信者側: トップ画面を開くと「タイムカプセルが届きました」ポップアップ

## ビンゴ機能

- 5カテゴリ: 日常 / 気持ち / 都会 / 二人限定 / 沖縄
- 3グリッドサイズ: 3×3 / 4×4 / 5×5
- モード: 今日だけ（日付シード）/ カテゴリ選択 / ランダム難易度
- シェア: `html2canvas` でグリッドをPNG化 → Web Share APIでファイル添付共有（非対応はDL）

## Web Push 通知

- VAPID公開鍵: `assets/js/push.js` の `_VAPID_PUB`
- SW: `sw.js` が push イベント受信 → 通知表示 & アクション（絵文字5種）
- 購読情報は `push_subscriptions` テーブル

## LINE 通知

- Bot経由。`line_user_id` は `profiles` に登録済み前提
- グループ通知: `settings` テーブルの `line_group_id` 値を使用
- 呼び出し: `POST /functions/v1/line-notify` に `{ sender_id, target: 'partner'|'group', message }`

## closer.html の仕様（既存）

### ゲージロジック
- 自分の絵文字タップ → 自分のゲージ +5（最大100）+ **+1pt**
- 相手の絵文字タップ → 増えない
- 24時間線形減衰: `effective = round(gauge * max(0, 1 - elapsed / 24h))`

### 両方 MAX でくっつく条件
```js
bothMax = raw.fox.gauge >= 100 && raw.hed.gauge >= 100 && effective('fox') > 0 && effective('hed') > 0
```
`effective >= 100` では **ない**（減衰で外れるバグ回避）

### デバッグ
```js
window._closer = { foxUid, hedUid, myId, raw, effective }
```

## 星アニメーション (`stars.js`)

- `position: fixed` + `window.innerWidth/innerHeight` で px 指定
- 左端 18% 除外（グロー防止）、左上コーナー 25%×25% 除外
- キャッシュバスター: `stars.js?v=3`（変更時は v 番号上げる）

## Playwright テスト

```bash
npm install
npx playwright install chromium
npm test                    # ヘッドレス
npm run test:headed         # ブラウザ表示あり
```

- テストアカウント: `claude@example.com` / `claude`
- 認証: `tests/auth.setup.js` → `tests/storage/auth.json`（localhost:3000 用）
- テストサーバ: `npx serve . -p 3000` を自動起動

## 環境

- OS: Windows 11 + WSL2 (Ubuntu)
- 作業ディレクトリ: `/mnt/c/Users/redem/Documents/dev/imaimaha.github.io`
- Node: v18
- Supabase CLI: `~/.local/share/supabase/supabase`（PATH追加要）

## Management API

Service Role Key など秘密情報は Supabase Management API で取得可（CLIトークン認証）：

```bash
curl -s -H "Authorization: Bearer <CLIトークン>" \
  "https://api.supabase.com/v1/projects/qivnfiqyjfajlzbdqodd/api-keys"
```

## 通知フロー まとめ

### LINE通知の発火条件

すべて `line-notify` Edge Function経由。`_sb.functions.invoke('line-notify', {...})` で呼ぶ（apikey+Authorizationヘッダー自動付与）。

| 発火元 | 条件 | target | 送信先 |
|--------|------|--------|--------|
| `closer.html` | 自分のゲージが初めて100に到達 (`!rawWasMax && newGauge>=100`) | partner | 相手のLINE |
| `closer.html` | 2人ともゲージMAX (`sendLineMaxNotification`) | group | LINEグループ |
| `calendar.html` | 予定を追加した時 | group | LINEグループ |
| `status.html` | 退勤時間を保存した時 | group | LINEグループ |
| `status.html` | 「行っていい？」ボタン (quick_reply付き) | partner | 相手のLINE |
| `index.html` | 自分が送ったタイムカプセルの open_at が過去なのに未通知 | partner | 相手のLINE |
| `notify-capsules` (pg_cron 5分毎) | サーバ側で開封日時が来た未通知カプセル一括処理 | partner | 相手のLINE |

### プッシュ通知の発火条件

**LINE通知が飛ぶタイミングと完全に同じ**。`line-notify` は LINE 送信後に `send-push` を必ず呼ぶ（サブスクがあれば送信、なければ 0件で return）。

- `target === 'partner'` → 相手ユーザーの `push_subscriptions` にプッシュ
- `target === 'group'` → 送信者以外全員の `push_subscriptions` にプッシュ

**購読前提**: PWA としてホーム画面追加＋通知許可＋`push_subscriptions` に登録されていないと届かない。iOSは PWA 必須（Safari直接開きでは購読できない）。index.html下部の `#push-status-badge` に状態を表示。

### スレッド返信は通知しない

タイムカプセルの `replies` 追記は LINE/Push どちらも飛ばない（今のところ）。両者アプリを開いた時に見える。

## これからつけたい機能（TODO）

- [ ] カスタムドメイン設定
- [ ] ガチャ景品追加・レアリティ調整
- [ ] クイズ結果の集計ビュー（相性度など）
- [ ] タイムカプセル: 一覧画面でのカプセル削除機能
- [ ] タイムカプセル返信の通知 (欲しくなったら)
- [ ] ビンゴ: マスに写真アップロード
- [ ] カラーハンティング: 完成した週の集大成表示

## 完成済み（このセッションで対応）

- ガチャ・ポイント精査（ポイント合算バグ・相手券操作・使用時ボーナス付与）
- LINE通知バグ (verify_jwt=trueに認証ヘッダー無しで401サイレント失敗) → `_sb.functions.invoke()` に統一
- ビンゴ カテゴリ別・難易度別も再生成まで固定
- ビンゴ 今日→今週の切り替え
- ビンゴ 履歴閲覧（2人共有・チェック済のみ）
- 記念日カウンター JST朝2時境界
- 全ページ右上ヘッダー統一（絵文字だけ）
- 記念日横のポイント表示削除
- セクション並び替え + クイズ未回答強調
- タイムカプセル 届いた共有 + スレッド返信
- カラーハンティング たたき
- プッシュ通知 状態バッジ・エラー可視化・iOSガイダンス
- ポイント履歴ページ (points.html)

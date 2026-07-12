# 次回セッション用: TODO と背景

**最終更新**: 2026-07-13
**前回のまとめ**: 2〜3日ぶっ通しで UI 全面刷新 + 大型機能を4つ実装した長丁場。ここに現状と、次に着手する候補を整理。

---

## 0. 現状 (2026-07-13 時点)

### デザインシステム
- `assets/css/style.css` に v2 デザインシステム集約済み: CSSトークン、glassmorphism、ベントグリッド、`.tile`、共通ボタン、スケルトン、View Transitions、ボトムナビ用スタイル
- `assets/js/nav.js` が全ページに底部5タブナビ (ホーム/ふたり/遊ぶ/ショップ/もっと) を注入。「遊ぶ」「もっと」タップでサブシート
- `assets/js/header.js` は右上に🔔ベル(未読バッジ) + 👤設定ボタンを注入。iOS safe-area 対応済
- ダーク宇宙テーマで統一済のページ: index / status / thanks / calendar / gacha / shop / wishlist / expenses / notifications / bets
- **まだ元のライトテーマ寄りが残る可能性のあるページ**: quiz / time_capsule / color_hunting / one_on_one / location / points (次回巡回対象)

### 実装済の主要機能
- **通常機能** (先行実装): 帰宅ステータス・会いたいゲージ・クイズ・ありがとう・タイムカプセル・お散歩ビンゴ(10930お題)・カラーハント・ガチャ(10+1連)・販売所(買う/売る/券/リクエスト)・ポイント履歴・共有カレンダー・やりたいこと(FAB+セクション)・1on1・今ここにいるよ
- **新規4機能** (このセッションで追加):
  - **お知らせセンター** (`notifications.html` + `notifications_log` テーブル + send-push 改修)
  - **割り勘** (`expenses.html` + `expenses` / `settlements` テーブル)
  - **統合券インベントリ** (`shop.html` の「🎫 券」タブがガチャ+販売所を一元管理)
  - **賭け事** (`bets.html` + `bets` テーブル、VS レイアウト・エスクロー・取り消し申請)
- **status arrival 通知** (5分前 + 時刻ちょうど、`send-reminders` + pg_cron */5 * * * *)
- **status に「⏰ 遅れそう」ボタン**、19:00/22:00 定型・±30分微調整
- **ビンゴ 3新カテゴリ**: 💼 お仕事 (491) / 📖 読書 (155) / 🍚 ごはん (246)、週間ビンゴ再生成禁止、重複行防止

### 開発フロー確立
- Playwright audit spec (`tests/ui_audit.spec.js`) で全ページの横スクロール・タイトル切れ・JSエラー・ボトムナビ被りを検出
- `.claude/settings.json` に `Bash(git push:*)` 許可済 → 直接 main push OK
- git branch/tag による作業前バックアップ (`backup/pre-<change>-YYYY-MM-DD`) をとる習慣

---

## 1. すぐ着手できる小さめ改修 (優先度: 中)

### 1.1 残ページのダーク統一
以下のページはまだライトテーマの遺物が残っている可能性が高い。巡回して glass 化:
- `quiz.html` — カード・回答ボタン
- `time_capsule.html` — 送信フォーム・カプセルカード
- `color_hunting.html` — グリッド周りの色調
- `one_on_one.html` — 記録カード・フォーム
- `location.html` — Leaflet地図ラッパー・ボタン
- `points.html` — 履歴リスト

**やり方**: 各ページを1個ずつ Playwright audit のスクショで確認 → 白背景/茶字を発見したら status.html の変換パターン (glass card + ink-light color + accent) に沿って書き換え。

### 1.2 各ページの safe-area 適用チェック
`header.js` で挿入する🔔/👤ボタンと top-bar は safe-area 対応済だが、個別ページのカスタム top-bar (thanks/calendar) が `padding-top` で env(safe-area-inset-top) を吸収できているか確認。

### 1.3 通知履歴の削除 pg_cron (任意)
`notifications_log` は放置すると無制限に貯まる。数千行になっても実用上は困らないが、気になれば pg_cron で30日以上前の既読を削除するジョブを追加。

---

## 2. 未着手の機能候補 (優先度: 高〜中)

### 2.1 気分ピング (mood pings) — 実装工数 30分〜1時間 ⭐推し
**目的**: テキストを書くほどではないけど何かを伝えたい時のワンタップ表現。
- 🌤/☀️/🌥/🌧/⛈ の絵文字ボタンで気分を送る
- 履歴は残さない (瞬間共有)、通知は kind='mood'
- トップ画面のヒーロー付近に配置

### 2.2 カウントダウン tile — 30分〜1時間
- 次の記念日/誕生日/デート予定までの d/h/m を大きく表示
- カレンダーの events から次の予定を自動選択 or 手動ピン留め
- index.html Bento に組み込み

### 2.3 カスタムクイズ — 半日
- 既存30問ハードコード → ユーザーが自作質問を追加できるように
- `quiz_questions` テーブル追加、既存の日替わり選出ロジックを custom + builtin 統合

### 2.4 ゲージ履歴グラフ — 半日
- 過去7日 or 30日のゲージ推移を折れ線グラフに
- `closer.html` にモーダル or 別ページで
- SVG or Canvas で描画

### 2.5 デート記録 — 半日〜1日
- 1on1 より気軽な月別デート記録
- 場所・写真・楽しかった度 (5段階)
- `location_checkins` と紐付けても面白い

---

## 3. 大きめの候補 (優先度: 低〜検討)

- **音声メッセージ** — 30秒短尺、Supabase Storage 使用
- **フラッシュバック通知** — 1年前の今日の思い出を朝プッシュ
- **月次ハイライト自動生成** — 月末に自動で「今月の統計」を作る (獲得pt/ビンゴ完成/カプセル送信数 等)
- **習慣トラッカー** — 毎日の小さな習慣を可視化
- **今週のチャレンジ** — 週次でお題を1つ設定

詳しくは `docs/PLAN_FUTURE_FEATURES.md` を見る。

---

## 4. 気になる技術負債・改善ポイント

- **gacha.html にまだ `loadTickets`/`renderTickets` の残骸が残ってる** — インベントリは shop.html に移動済だが、gacha側の関数は no-op で残してある。完全除去してもいい (呼び出し元も 1〜2 箇所しかない)
- **thanks.html の投稿カードのソート順** — 相手↔自分の会話性を意識した並びを検討
- **Playwright audit** は網羅性を上げると価値が高まる。特に:
  - 各ページで tap 領域の可視性 (bottom-nav 被り)
  - モーダル open 中のスクロールロック
  - 主要フロー (ガチャを引く / 券を使う / 賭け事を作る〜精算) の E2E
- **View Transitions**: 実際にスマホで動作確認していない。特に iOS Safari で挙動が変な可能性

---

## 5. 直近の秘密情報など

- テストアカウント: `claude@example.com` / `claude`
- Supabase project ref: `qivnfiqyjfajlzbdqodd`
- 本番 URL: https://imaimaha.github.io
- `.env` にすべての秘密情報 (.gitignore済)

---

## 6. 進め方の好み (再確認)

- **抽象要求 (「もっといい感じに」等) → 議論より先にデプロイして実物で判断**
- 変更前に **git tag + backup ブランチ** をとる
- **モバイルファースト**: スマホ最優先、PC は開発時のみ
- **秘密情報は絶対にコミット/メモリに書かない**
- **git push はすでに許可されている** (`.claude/settings.json` に `Bash(git push:*)`)
- 大きめの依頼は着手前に **タスクリスト作って可視化** すると迷子にならない

# Notre Endroit 仕様書

> このドキュメントは Notre Endroit の**正式仕様**を集約したリファレンス。
> 実装が変わる度にここも更新すること。
> Claude が「notre」「imaimaha」等の呼称で参照する時は、まずこのファイルを読む。

**最終更新**: 2026-07-17

> 📌 **重要**: 機能追加・ルール変更時は必ず以下を同時に更新すること:
> - この SPEC.md（正式仕様）
> - `assets/js/header.js` の設定シート「ルール」パネル（ユーザーが目に触れる場所）

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
- **記念日直下**に「📍 今ここにいるよ」ボタン（トップからワンタップでチェックイン）
- セクション順: 今日の帰宅 → ゲージ → クイズ（未回答時強調） → タイムカプセル → ビンゴ → カラーハント → ガチャ → 予定 → やりたいこと → 1on1
- タイムカプセル届き通知（開封時刻を過ぎた自分宛の未開封）
- 右上絵文字ボタン（共通ヘッダー）→ タップで**設定シート**（プッシュ通知状態・ルール確認・ログアウト）

### 4.2 今日の帰宅 (`status.html`)

- ふたりの本日の帰宅予定時刻を共有
- `status` テーブルに保存
- **毎朝 6:00 JST に自動リセット**（pg_cron `daily-status-reset`）
- 「行っていい？」ボタン → **Push通知（3択ボタン付き）**
  - 選択肢: いいよ ✅ / きびしい 🚫 / 仕事の進み次第 🤔
- 「🏃 会社出た」「🏠 帰宅」「⏰ 遅れそう」ボタン → **Push通知**（2026-07: LINE無料枠節約のためLINEから変更）

### 4.3 One Step Closer (`closer.html`)

- 2匹のフローティング絵文字（🦊🦔）が画面内で動く
- 自分の絵文字をタップ → 自分のゲージ +5%（最大100）
  - **タップで％が増える時のみ +1pt**
- **24時間線形減衰**: `effective = round(gauge * max(0, 1 - elapsed/24h))`
- MAX到達（raw が 100 に初到達した瞬間） → **+5pt** + Push通知（相手へ）
- **両方MAX**（`raw.fox.gauge >= 100 && raw.hed.gauge >= 100 && effective両方>0`）で絵文字がくっつく
- Realtime channel で相手のゲージ変動を即時反映

### 4.4 今日のクイズ (`quiz.html`)

- 日替わり質問 **278種**（`QUESTIONS` 配列にハードコード。2026-07-17 に 30→278 へ増量。約9ヶ月周期）
- 選出: `parseInt(dateStr.replace(/-/g,'')) % QUESTIONS.length`（JST 0時ロールオーバー）
- **質問の識別は配列 index ではなく `q.id`**。増量時は既存 id を変えず末尾追加のみ（過去回答の `question_id` 整合性を守るため）
- カテゴリ: today / partner / self / couple / fun / memory / future / food / deep（各 `.cat-*` バッジ CSS + `CAT_LABEL`）
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
- 8カテゴリ: 日常 / 気持ち / 都会 / 二人限定 / 沖縄 / 💼 お仕事 / 📖 読書 / 🍚 ごはん（他に季節・平日/週末・ラッキー）
- **お題プール**: 現在 11604個 (2026-07-15 に 450個の「達成不可能系」を削除: 特定地域限定祭り・稀有天体現象・動物園前提・海外旅行前提・希少種観察・接近観察必要な項目など)
- **プールの置き場所**: `assets/data/bingo_pools.js`（2026-07-17 に bingo.html から分離。お題の追加・削除はこのファイルだけ編集する）
- **ラッキーマス**: 週間・ランダムは汎用ラッキープール (`POOLS.lucky`) から1マス挿入。**カテゴリ別はカテゴリ内のお題1マスをラッキー指定**（テーマを壊さないため。2026-07-17〜）
- **週間ビンゴでは「再生成」「過去から復元」ボタンは非表示** — 週次シード固定のため、書き換えると意味的に破綻するので UI 側で隠している
- **メタ駆動設計** (`POOL_META`): 新カテゴリ追加時は `POOL_META` にフラグを立てるだけで、週間/ランダム/カテゴリ別への出現を制御可能
  - `weekly: true` → 週間ビンゴに含める
  - `random: [1,2,3]` → ランダムの難易度を指定
  - `category: true` → カテゴリ別ビンゴのボタンとして表示
  - `seasonKey: true` → 月に応じて自動選択される季節枠
- **週のビンゴの対象**（`makeDailyItems`）: 日常 + 気持ち + 二人限定 + 平日 + 週末 + 今の季節 + ラッキー1マス確定
- **月ごとの季節割当** (`MONTH_SEASONS`): 1,2,12月=冬 / 3-5月=春 / 6-8月=夏 / 9-11月=秋（明示マップ）
- **ランダムの対象**（`makeRandomItems`）: `POOL_META.random` で管理
  - ★ (難易度1): 日常 + 気持ち + 季節の一部（6個）
  - ★★ (難易度2): 日常 + 気持ち + 都会 + 季節
  - ★★★ (難易度3): 都会 + 二人限定 + 季節
- **沖縄は週間・ランダム対象外**（カテゴリ別ビンゴのみ）
- グリッドサイズ 3×3 / 4×4 / 5×5
- カード**永続化**: 全モードで同じカードが返る（再生成ボタンで新規）
- 履歴閲覧: 2人のチェック付きカードを閲覧（読み込み専用）
  - ビンゴライン数（🎯 ビンゴN本）・コンプリート状態（🏆）を各カードに表示
  - コンプリートは金色の左ボーダー
- **再生成の横に「🔄 過去から復元」ボタン**: 自分の過去のカードから items を引き継いで新カード開始（間違えて再生成した時の救済）
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

**📌 券インベントリは販売所に統合**: 過去に引いたガチャ券は `shop.html` の「🎫 券」タブで管理する (販売所の券と同じ画面)。ガチャページは「回す」ことと「相手のガチャに景品を追加する」に集中。

- **100pt消費**でN/R/SR抽選
- **10+1連ガチャ**: **1000pt消費**で10連 + おまけ1回（**11回目はR以上確定**）。10連結果一覧のグリッドで表示、おまけは金枠 + ⭐ おまけバッジ
- **ビルトイン景品13種**（ハードコード）:
  - N (76%): ハグ券 / おやすみ電話券 / ごはん選択権 / 写真撮影券 / +50pt / スタンプ送信権
  - R (20%): デート行き先選択権 / 手料理券 / +200pt / サプライズ計画権
  - SR (4%): 一日デート券 / +500pt / 願いごと券
- **カスタム景品（相手のラインナップに追加）**:
  - 各ユーザーが**相手の**ガチャに独自景品を追加できる（`gacha_custom_prizes` テーブル）
  - フィールド: 名前・絵文字・レア度(N/R/SR)・説明・ボーナスpt・重み・active
  - 削除・停止・重み変更可能
  - **ラインナップ追加で +1pt**
- **カスタム/ビルトインの抽選割合**:
  - `profiles.gacha_custom_share` (0.0〜1.0, default 0.5) で自分のガチャがカスタムを引く確率を設定
  - スライダーで動的調整
  - draw ロジック: `Math.random() < custom_share` ならカスタムプールから、そうでなければビルトイン
- **ポイント景品のボーナスは「使用済み」にした時に付与**（受け取り時ではない）
- 券のリスト表示: 相手の券は「相手の券」ラベル、自分のみ使用可
- **券使用時に相手へPush通知**
- **取り消し申請フロー**: 使用済み券（ボーナスpt無しのみ）は使用者が「取り消し申請」→ 相手が承諾or却下 → 承諾時は `used=false` に戻る（`cancel_requested` boolean で管理）
- `gacha_results.reward_id` (int) は nullable。カスタムは `custom_prize_id` (uuid) を使う。説明は `reward_desc` にスナップショット保存
- ポイント履歴 (`points.html`) への導線あり

### 4.9 思い出アルバム (`memories.html`)

- **⚠️ 現在閉鎖中** (2026-07-12〜)。index.htmlのメニュー・セクションから削除済み。ファイル自体は残しているが導線なし。1on1側で写真機能があるので当面はそちらへ集約
- 元機能: 写真アップロード（複数選択・ドラッグ&ドロップ・メモ付き）、Supabase Storage `memories` bucket、`createSignedUrl` (1時間有効)

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

### 4.13 ありがとう (`thanks.html`)

- 相手に「ありがとう」メッセージを投稿。両者見えるフィード形式
- クイックタグ（いつもありがとう、ごはん、話、やさしさ、会えて）でひな形入力
- 投稿で **+1pt**、相手に Push 通知
- 自分の投稿のみ削除可
- **🎁 ポイントプレゼント（メッセージと同時送信）**:
  - 感謝の気持ちに応じて自分のptを消費して相手に送れる
  - 相手には**2倍**のptが入る（1pt消費 → 相手 +2pt）
  - `thanks_posts.gift_amount` に消費pt数を保存
  - フィード表示で 🎁 +Xpt プレゼント のバッジ表示

### 4.14 ポイント販売所 (`shop.html`)

**タブ構成**: 🛍 買う / 💼 売る / 🎫 券 / 📝 リクエスト

**売り切れの再販リクエスト (2026-07-18〜)**: 買うタブで在庫0の出品には「🔁 再販リクエスト」ボタンを表示。タップで出品者(相手)に Push (kind: `shop`)。ボタンは押下後「リクエスト済 ✓」に。

**🎫 券タブの同一券まとめ表示 (2026-07-18〜)**: 使える/相手が持ってるタブでは、同一(source+名前+絵文字+レア度+説明+ボーナス)の未使用券を1枚ずつでなく「×N」の数量バッジでまとめて表示。使用は1枚ずつ消費(「1枚使う」)。使用済みタブは履歴として個別表示のまま。

**🎫 券タブ (統合券インベントリ)**: ガチャ券（`gacha_results`）と販売所購入券（`shop_purchases`）を統合して1画面で管理。
- 内部フィルタ: 🎫 使える (自分の未使用) / 🎁 相手が持ってる (相手の未使用) / ✅ 使用済み
- カードごとに 🎰 ガチャ / 🛍 販売所 のソースバッジで区別
- アクション: 使用済にする・取り消し申請・（相手が申請してきた場合）承認/却下
- `markUsedTicket(source, id)` / `requestCancelTicket(source, id)` / `approveCancelTicket(source, id)` / `denyCancelTicket(source, id)` の統一関数が source ごとに `gacha_results` / `shop_purchases` を更新
- 通知は `kind: 'gacha'` or `'shop'` で送信

- 相手向けに商品を「出品」→相手が自分の pt で購入 → **pt が売り手に移動**
- タブ: 🛍 買う（相手の出品） / 💼 売る（自分の出品管理） / 📦 履歴（購入・販売）
- 出品項目: 商品名・絵文字・説明・価格・在庫(nullなら無限)・レア度(N/R/SR)・ボーナスpt
- 購入は Edge Function `purchase-shop-item` が原子的に処理:
  1. 商品存在・active・buyer一致・在庫チェック
  2. 買い手 balance チェック
  3. 在庫デクリメント (optimistic update)
  4. 買い手 -price / 売り手 +price
  5. `shop_purchases` にスナップショット記録
  6. 売り手に Push 通知
- 購入した券は「使用済」にすると bonus_points があれば加算 (shop_bonus)

### 4.15 割り勘 (`expenses.html`)

- 同棲・共同生活の支出（食費/光熱費/家賃/デート/交通/日用品/旅行/その他）を記録し、「今どちらが多く払ってるか」を可視化
- **サマリーカード**（画面上部）: 未精算バランス、今月総支出、未精算件数、精算ボタン
- **入力フォーム**（折りたたみ）: 金額・カテゴリ・メモ・支払者（自分/相手切替）・割合（折半/相手全額/自分全額）・日付
- **履歴タイムライン**: 全部 / 未精算のみ / 精算済のみ フィルタ
- **精算モーダル**: 未精算の合計を確定し、`expenses.settled_at` と `settlement_id` をまとめて記入
- **バランス計算**: `net = Σ(未精算 e).amount × split_ratio × (paid_by === me ? +1 : -1)` → 正なら相手が私に返す、負なら私が相手に返す
- 記録追加時 +1pt、精算実行時 +3pt。相手に Push (kind: `expense`)

### 4.16 賭け事 (`bets.html`)

2人でポイントを賭けてバトル。状態遷移で pt を制御:

**フロー**:
1. **起票** (`pending`): 起票者から -stake、相手にPush
2. **相手が承諾** (`active`): 相手からも -stake、両者に3ボタン表示
3. **相手が拒否** (`rejected`): 起票者に +stake 返却
4. **起票者が取下** (`cancelled`): 起票者に +stake 返却
5. **結果宣言** (`finished`): どちらかが「自分勝ち / 相手勝ち / 引き分け」をタップ
   - win: 勝者に +stake × 2
   - draw: 両者に +stake

**取り消し申請フロー**: `active` or `finished` 状態で結果宣言者/どちらかが取り消し申請 → 相手が承認/却下。承認で状態を巻き戻し (`finished` → `active` に戻る、`active` → `cancelled`)。

**アトミック化 (2026-07-17〜)**: 状態遷移とポイント移動は SECURITY DEFINER の RPC（`create_bet` / `accept_bet` / `reject_bet` / `cancel_bet` / `settle_bet` / `approve_bet_cancel`）で単一トランザクション実行。`UPDATE ... WHERE status='<期待状態>'` ガードにより、2人が同時操作しても片方は「すでに処理済み」エラーになり二重配当しない。残高チェックもサーバ側。定義: `supabase/migrations/20260717000000_bets_atomic_rpc.sql`

**通知**: 各遷移で相手に Push (kind: `bet`)。お知らせセンターの「⚔️ 賭け事」フィルタで絞れる。

### 4.17 お知らせセンター (`notifications.html`)

- send-push で受信した全通知の一覧・既読管理
- Edge Function `send-push` は subscription への push 送信と並列に `notifications_log` テーブルに insert する。recipient_user_id 指定時はその1人、未指定時は sender 以外の全プロフィールに記録
- **UI**: 一覧はカード形式、未読は左に青ドット＋薄青ハイライト、カテゴリ絵文字（thanks 🌸 / gacha 🎰 / shop 🛍 / capsule 🎁 / bingo 🎯 / color 🎨 / location 📍 / status 🕐 / expense 💰）
- **フィルタチップ**: すべて / 未読 / カテゴリ別
- **アクション**: 「すべて既読にする」、個別削除、タップで url に遷移し既読化
- **ヘッダーの🔔ベルボタン**: 全ページ右上の絵文字ボタンの左に常設。未読件数バッジ（99+ で丸め）、visibilitychange で復帰時に自動更新

### 4.18 設定 (`settings.html`)

- 全ページ右上の 👤 アイコン(header.js、歯車バッジ付き) から遷移。「もっと」シートの「⚙️ 設定」からも。
- **アカウント**: 自分の絵文字・名前を表示
- **プッシュ通知**: この端末の許可状態と有効化ボタン (push.js の `_diagnose`/`requestPush` を再利用)
- **受け取るプッシュ通知 (アカウント別)**: 14種の kind (closer/mood/status/quiz/thanks/capsule/bingo/color/gacha/shop/expense/bet/calendar/location) を iOS 風トグルで個別 ON/OFF。`notification_prefs` に保存 (opt-out: 行が無ければ受け取る)。「すべてオン/オフ」一括ボタンあり
- **ルール**: 通知・ポイントのルールを折りたたみで表示 (旧 header.js のボトムシートから移設)
- **ログアウト**
- **通知フィルタの仕組み**: `send-push` は `kind` 指定時、受信者の `notification_prefs` で `enabled=false` の kind をプッシュ対象から除外する。ただし `notifications_log`(お知らせセンター履歴) には設定に関わらず常に記録される

### 4.17 共通コンポーネント

- `assets/js/util.js` — 共通ユーティリティ: `escHtml` / `notify`（url 必須の send-push ラッパ）/ `addPoints` / `jstDateStr`。全ページ include 済み。各ページのローカル実装からの移行は `docs/PLAN_REFACTOR_UTILJS.md` 参照
- `assets/js/header.js` — 全ページ右上に 👤設定ボタン(→ settings.html) と🔔ベルボタン(お知らせ) を挿入
- `assets/js/nav.js` — 底部5タブ。「もっと」シートはセクション分け(ふたり/あそび/ポイント/きろく)、設定・お知らせ導線を含む
- `assets/js/nav.js` — 全ページ底部にタブナビ (ホーム/ふたり/遊ぶ/ショップ/もっと)。「遊ぶ」と「もっと」タップでシート表示
- `assets/js/push.js` — Web Push 購読管理＋状態バッジ
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
| 毎日ログインボーナス（初回ログイン時） | +5 | `login_bonus` |
| 記念日当日ボーナス | +100 | `anniversary_bonus` |
| 30日ごとの節目（60日/90日/…） | +30 | `monthly_milestone` |
| ありがとうポスト送信 | +1 | `thanks_send` |
| 割り勘 支出記録 | +1 | `expense_add` |
| 割り勘 精算実行 | +3 | `expense_settle` |
| 賭け事 勝利 (Pot 総取り) | +stake×2 | `bet_win` |
| 賭け事 引き分け 返却 | +stake | `bet_draw` |
| 賭け事 拒否/取下 返却 | +stake | `bet_return` |

### 消費手段

| 動作 | pt | reason |
|------|-----|----|
| ガチャ回転（1回） | -100 | `gacha` |
| **10連ガチャ** | -1000 | `gacha10` |
| 販売所で購入 | -price | `shop_buy` |
| 賭け事 掛け金 (エスクロー) | -stake | `bet_stake` |

### 相手↔自分の移動

| 動作 | 私 | 相手 | reason |
|------|-----|-----|----|
| 販売所で私が売った | +price | -price | `shop_earn` (私) / `shop_buy` (相手) |
| 販売所使用ボーナス | +bonus | — | `shop_bonus` |

---

## 6. 通知システム

### 6.1 チャネル

| チャネル | 送信先 | 用途 |
|---------|--------|------|
| **Push（Web Push）** | アプリ内通知 | メイン。アプリ内アクション全般 |
| **LINE個人** | 相手のLINE個人トーク | 帰宅時間設定・券使用のみ |
| **LINEグループ** | 共有グループ | （現在未使用。手動LINE返信の後方互換のみ） |

**方針**: 基本はPush通知。LINEは**無料枠（月200通）節約のため「帰宅時間設定」「券使用」の2つだけ**に限定（2026-07変更。以前は会社出た/帰宅/ゲージMAX/同時MAXもLINEだったが、月間上限超過が発生したため廃止しPushに移行）。

### 6.2 発火条件一覧

#### LINE個人（target: 'partner'）

| 発火元 | 条件 | メッセージ |
|--------|------|-----------|
| `status.html` | 帰宅時間保存 | `{emoji} {name} の今日の帰宅予定: {time}` |
| `shop.html` / `gacha.html` | 券使用（ガチャ・販売所） | `🎰/🎁 {name}` の使用を相手に確実に届ける |
| `status.html` | 画面からの手動LINE返信 | `{emoji} {name}: {text}` |

※ LINE失敗時はPush通知にフォールバック（`line-notify` 成功時も内部で Push を併送）

#### Pushのみ

| 発火元 | 条件 | 送信先 |
|--------|------|--------|
| `status.html` | 「行っていい？」ボタン | 相手（3択ボタン付き） |
| `status.html` | 「会社出た」「帰宅」「遅れそう」ボタン | 相手 |
| `closer.html` | 自分のゲージ初MAX | 相手 |
| `closer.html` | ふたり同時MAX | 相手（後にMAXになった側が送信） |
| `calendar.html` | 予定追加 | 相手 |
| `index.html` / `notify-capsules` | カプセル配達 | 相手 |
| `time_capsule.html` | 返信投稿 | もう一方 |
| `memories.html` | 写真アップロード | 相手 |
| `bingo.html` | ライン揃った/コンプ | 相手 |
| `color_hunting.html` | 4枚/8枚コンプ | 相手 |
| `quiz.html` | 回答時 | 相手 |
| `gacha.html` | 券使用時 | 相手 |
| `shop.html` | 券使用・取り消し申請/承認/却下 | 相手 |
| `expenses.html` | 支出記録追加 | 相手 (kind: `expense`) |
| `expenses.html` | 精算実行 | 相手 (kind: `expense`) |

**注**: `send-push` は全ての push 送信時に `notifications_log` テーブルにも受信者ごとに insert する。お知らせセンター (`notifications.html`) で一覧・既読管理される。呼び出し時に `kind` を指定するとカテゴリフィルタで絞れる。

### 6.3 プッシュ通知の発火条件（scheduled / リマインダー）

`send-reminders` Edge Function + pg_cron で定期実行。`notifications_sent` テーブルで日次重複防止。

| ジョブ | JST時刻 | UTC | 条件 | 送信先 |
|--------|---------|-----|------|--------|
| `remind_status_1719` | 平日 17:19 | `19 8 * * 1-5` | 今日の`status`未登録 | 該当ユーザー |
| `remind_status_1901` | 平日 19:01 | `1 10 * * 1-5` | 同上 | 同上 |
| `status_5min_before` | 5分毎 | `*/5 * * * *` | 自分の帰宅予定 -5分 | **自分のみ** |
| `status_arrival` | 5分毎 | `*/5 * * * *` | 自分の帰宅予定 ちょうど | **自分 + 相手** |
| `remind_quiz_evening` | 毎日 22:00 | `0 13 * * *` | 今日の`quiz_answers`無し | 該当ユーザー |
| `remind_capsule_morn` | 毎朝 8:00 | `0 23 * * *` (前日UTC) | 自分宛の未開封カプセル有り | 該当ユーザー |
| `remind_bingo_sat` | 土 10:00 | `0 1 * * 6` | 今週のビンゴ<8マス | 該当ユーザー |
| `remind_color_sat` | 土 10:00 | `0 1 * * 6` | 今週のカラーハント<4枚 | 該当ユーザー |
| `remind_gauge_low` | 毎晩 21:00 | `0 12 * * *` | 自分の effective gauge <30 | 該当ユーザー |
| `remind_anniversary` | 毎朝 2:05 | `5 17 * * *` (前日UTC) | 1ヶ月前/1週間前/前日/当日/30日刻み | 両ユーザー |

### 6.4 通知タップ挙動

`payload.url` に指定されたパスへ遷移。既に開いてるウィンドウがあれば `navigate` してフォーカス、無ければ `openWindow`。（sw.js）

**タップで自動既読化**: send-push は `notifications_log` insert で得た `id` を push payload の `notif_id` に載せる。sw.js は通知タップ時に `?notif_id=<id>` を URL に付与し、header.js が起動時に該当行を `read_at=now()` で更新して URL からクエリを剥がす。

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
| `gacha_results` | user_id, reward_id(nullable), custom_prize_id(nullable), reward_name, reward_emoji, reward_desc, rarity, used, bonus_points | ガチャ獲得券 |
| `gacha_custom_prizes` | added_by, target_user_id, name, emoji, rarity, description, bonus_points, weight, active | 相手ラインナップに追加する景品 |
| `push_subscriptions` | user_id, endpoint, subscription | Web Push 購読 |
| `notifications_sent` | user_id, kind, date_str | リマインダー重複防止・ログインボーナスの日次記録にも使用 |
| `thanks_posts` | from_user_id, to_user_id, message | 相手への「ありがとう」ポスト |
| `shop_items` | seller_id, buyer_id, name, emoji, description, price, stock, bonus_points, rarity, active | 販売所の商品 |
| `shop_purchases` | item_id, buyer_id, seller_id, price, name, emoji, description, bonus_points, rarity, used, purchased_at | 販売所の購入履歴 |
| `shop_requests` | requester_id, title, price, description, status('pending'\|'accepted'\|'rejected') | 販売所リクエスト |
| `expenses` | paid_by, amount, category, description, split_ratio, spent_at, settled_at, settlement_id | 割り勘の支出記録 |
| `settlements` | settled_by, net_amount, payer_id, receiver_id, period_from, period_to | 割り勘の精算履歴 |
| `notifications_log` | user_id, sender_id, title, body, url, kind, read_at | send-push で送信された通知の受信者記録（お知らせセンター用） |
| `bets` | created_by, opponent_id, title, description, stake, status, result, result_by, cancel_requested, cancel_by, proposed_at, accepted_at, finished_at, ended_at | 賭け事 |
| `settings` | key, value | LINE group ID など汎用設定 |

### 7.2 RLS ポリシーの原則

- `profiles`: authenticated 全員 SELECT 可
- `closer_gauge`: 全操作許可
- `points`: authenticated 全員 SELECT / **INSERT は authenticated なら誰の分でも可**（販売所の売上・ありがとうプレゼント等、相手へのポイント移動をクライアントから行うため。2人だけの信頼モデル前提）。賭け事の配当は RPC (SECURITY DEFINER) 経由
- `quiz_answers`/`gacha_results`: authenticated 全員 SELECT / 自分の分のみ INSERT・UPDATE
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

**追加の注意**: **bigint autoincrement 列を持つテーブル**は sequence への権限も必要。テーブルの GRANT だけでは INSERT 時に `permission denied for sequence xxx_id_seq` になる。

```sql
GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO authenticated;
```

`uuid` primary key (`gen_random_uuid()`) を使うテーブルは sequence を使わないので不要。

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
| タイムカプセル配達 | 1分粒度 | pg_cron `notify-capsules-5min` (schedule は `* * * * *`) |

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
- テーブル作成時は **`authenticated` と `service_role` の両方** に GRANT が必要:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role;
-- bigint autoincrement の場合は sequence にも必要:
GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO service_role;
```

`authenticated` だけだと Edge Functions (service_role) から `permission denied for table xxx` になる。
（`purchase-shop-item` で「ポイント不足 残高0pt」が出たのはこれが原因。）

既存テーブルの service_role GRANT 漏れ確認:

```bash
supabase db query --linked -o table "SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='service_role' AND table_schema='public' ORDER BY table_name;"
```

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

# 次回セッション用: TODO と背景

## 🔄 2026-07-19 作業中・引き継ぎ: デートUI改善 + pt表記サイレント化 (未コミット)

**ユーザー指示 (このまま従うこと)**
- デートのUIを実際の画面(スクショ)を見ながら「いい感じ」に修正する
- **ポイント付与はサイレント**: ログインボーナス以外、付与時の「+Xpt」トーストも画面上の獲得説明も出さない (メモリ `feedback_points_silent` 参照)。設定のルールパネル / points.html / ガチャ・販売所の価格表記(消費系)は残す
- **都度進捗を報告しながら進める**

**完了済み (作業ツリーに未コミットで存在。orgel.html と _orgel_audio.spec.js は別セッションの作業中ファイルなので触らない)**
- `dates.html`:
  - top-bar タイトル「💕 ふたりのデート」→「💕 デート」(2行折れ解消。一覧スクショで検証済み・良好)
  - 詳細ビュー再構成: 完了ボタン全幅化(`.done-btn`)・編集/削除はページ末尾 `.detail-footer` へ・ミッションカード見出し右に `N/M` バッジ(`.card-count`)・メモをカード化・done時「🎞 思い出」タグ・card-hint短縮(pt表記削除)
  - 付与トースト4箇所サイレント化 (計画/写真/コメント/ふり返り)
- `color_hunting.html`: コンプトーストの「+15pt」削除
- `quiz.html`: 「答える (+10pt)」ボタン×2 →「答える」、トースト「✨ +10pt 獲得！」→「✨ 回答したよ！」

**残作業 (次セッションはここから)**
1. **詳細画面の新レイアウトを実際に見て確認** — `tests/_ui_check2.spec.js` が失敗中(原因未特定・pageerrorは無し)。`.detail-title` の waitForSelector が効いてない可能性。スクショで見る→気になる所を直す→ユーザーに見せる
2. スクショOKなら「ジャンル（任意・フォトミッションのお題が変わるよ）」ラベルの長さも要検討
3. `tests/dates_countdown_smoke.spec.js` が新UIで通るか確認 (完了ボタンのclassが `.mini-btn.primary`→`.done-btn` に変更、編集/削除ボタンは `.detail-footer` に移動)
4. SPEC.md にサイレント方針を記載 (§5 ポイントか §10 開発ルール)
5. 全部OKならコミット & push (`git add dates.html color_hunting.html quiz.html docs/ tests/dates_countdown_smoke.spec.js` — orgel系を巻き込まない)
6. `tests/_ui_check.spec.js` / `_ui_check2.spec.js` は使い捨て診断用 → 終わったら削除
7. **テスト残骸**: 「水族館デート」が dates に残っている可能性 → 確認して削除 (storage `date_photos/` も)
8. 他ページの獲得pt表記の残りを grep で再確認 (`grep -n '+[0-9]*pt' *.html` で獲得系のみ削除。thanks のプレゼントptプレビューは機能なので残す)

**⚠️ 実データ注意**: dates テーブルに「幡ヶ谷夏祭り(7/19)」「家具お買い物(8/2)」= ユーザーの本物のデート予定あり。絶対に消さない

## 2026-07-19 追記2: ミッション拡充 + ポイント再付与バグ修正 (すべてデプロイ済み)

1. **デートのフォトミッション 18→約190種** (`6dde678`)
   - 計画時にジャンル選択(任意・11チップ): 選ぶと ジャンル1+季節1+汎用1、おまかせは 汎用2+季節1
   - 季節はデート**予定日**の月で自動判定 (ビンゴと同じ区分)。`dates.genre` カラム追加、一覧/詳細にバッジ
2. **ビンゴ/カラーハントのポイント再付与バグ修正** (`cddfc6f`) — ユーザー報告の不具合
   - チェック外し→付け直し / 写真削除→再アップで points が二重付与されていた
   - `bingo_sessions.awarded` {cells,lines,complete} / `color_hunts.awarded` {positions,complete,half} で一度きりに。通知/お祝いも新規付与時のみ
   - **既存 bingo 51件 / color 22件は SQL で一括初期化済み**(当時のチェック状態=付与済み)。再生成はリセット、復元は引き継ぎ
   - 回帰テスト `tests/award_once.spec.js` (points POST を傍受して回数検証) 2/2 green
   - 注意: 過去に「チェック→外した」状態のマスは記録が無いため、次の1回だけは付与される (以後は防止)

## 2026-07-19 新機能: ふたりのデート (dates.html) + カウントダウン (countdown.html)

**やったこと（DB適用済み・ローカルPlaywright green・push は要調整/下記注意）**
- **ふたりのデート** (`dates.html`): 計画(planned)→当日→思い出(done)。フォトミッション(お題18種からランダム3つ自動付与)/写真アップ(memories bucket `date_photos/`)/お互いコメント/星ふり返り/ベストショット。通知 kind `date`、`?date=<id>` ディープリンク
- **カウントダウン** (`countdown.html` + ホーム上部カード): 記念日auto+つきあってNヶ月auto+ユーザー登録(誕生日/旅行等)を近い順に集約。ホームカードは記念日/countdowns/デート予定トップ3
- DBテーブル: `countdowns` / `dates` / `date_photos` / `date_comments` / `date_reviews`（migration `20260718220000_dates_and_countdowns.sql`、適用済み）
- 導線: nav.js(ふたり:デート / きろく:カウントダウン)・notifications(💕date絵文字+フィルタ)・settings(date kind + ルール pt)・index(💕tile + ⏳カード)
- テスト: `tests/dates_countdown_smoke.spec.js` 2件 green（実DB往復）
- ポイント: デート作成+2 / 写真+2 / ミッション達成+3 / コメント+1 / ふり返り+3

**⚠️ push 時の注意（並行セッションと同居）**
- `index.html`/`nav.js`/`settings.html`/`notifications.html` は **オルゴール機能(別session)の変更と混在**。commit 時は両機能ぶんが入る
- `memories/one_on_one/wishlist.html` + song系テストは **util.js検証中の別session管轄。触らない/巻き込まない**
- 未実装の伸びしろ: デートの当日リマインダー(send-reminders連携) / ベストショットのポイント / デート予定→カレンダー相互連携

## 2026-07-19 新機能: ふたりのオルゴール (orgel.html)

- 穴あきカード式の作曲機能 (32步×11音, Cペンタトニック固定, Web Audio合成のオルゴール音)
- とどける→Push(kind:melody) / ギャラリー(💖・再編集・削除) / 通知の?id=ディープリンク
- DB: melodies / melody_reactions (RLS: select全員・自分のみ書込, FKはprofilesに張らない)
- E2E: tests/orgel_flow.spec.js 全パス (穴あけ→再生→とどける→DB→ギャラリー→ひらく→けす)
- 発展アイデア(未実装): 相手の曲に「続きを足して返す」/ 和音の同時数制限解除 / スケール切替 / 16分音符モード

## 2026-07-18 新機能: One Song a Day (今日の1曲)

- `one_song.html` 新設。毎日1曲(音楽/動画/ポッドキャスト)を相手にシェア
- メタ取得: Spotifyは本家oEmbed、他はnoembed.com (両方CORS `*`)。取得結果はDB保存
- DB: `daily_songs`(uuid PK, unique user_id+date_str, upsertで差し替え) / `song_reactions`(PK song_id+user_id, daily_songsへFK cascade)。RLS: select全員/自分のみ書込
- リアクション 💖🎧🔥🥰😭👍 (相手の曲に1つ, 再タップ解除)
- 投稿/リアクションで相手にPush (kind: `song`, 設定でON/OFF可)
- 導線: ホーム先頭tile / もっと(ふたり) / 設定kind / お知らせ絵文字・フィルタ
- **検証済**: Playwright で YouTube プレビュー→投稿→表示→DB(サムネ含む) / Spotifyメタ取得 / リアクション付与→解除。テスト `tests/song_flow.spec.js` (リアクションはRLSで他人の曲を作れないため、service_role で種まき→UI操作→掃除の手順で別途確認)
- **メモ**: 実ユーザーは既に使用開始(hedgehogが米津玄師をシェア済み)。noembed非対応サービスが出たら fetchMeta にプロバイダ追加で対応

---

## 2026-07-18 セッション追記 (後半: UI改善まとめ)

**このセッション後半でやったこと (すべてデプロイ済み)**
1. 帰宅ページ(status.html) 刷新:
   - 「行っていい？/来ていいよ」→「🐾行きたい / 🏠来てほしい / 👌いいよ」の3ボタン。各々相手へ個別Push(kind:status)。行きたいは3択返信(いいよ/きびしい/進み次第)を維持
   - 「💬LINE最新メッセージ」機能(一覧+返信+5秒ポーリング)を閉鎖・撤去
   - 操作の記録「🕘きろく」: `status_events` テーブル(uuid PK, FKなし)に 帰宅設定/late/left/home/want_go/want_come/ok を記録し時系列表示
2. ホーム: 上部hero間隔とフッターの余白を詰めた(ページscoped)
3. 販売所タブ: 「リクエスト→希望」に短縮 + 券タブを右端に(買う/売る/希望/券)。段落ち解消
4. 券インベントリUI改善: レア度順ソート(SR→R→N) / レア度チップ(N/R/SR) / 「使える」タブに合計サマリー(枚数+使うと合計+Xpt) / ボーナスpt金色強調 / 使うボタン明確化(🎫使う/🎫1枚使う)。同一未使用券の×N集約は前半で実装済
5. 販売所: 売り切れ品に「🔁再販リクエスト」ボタン(出品者へPush) — 前半で実装
6. カレンダー: 予定の**編集**機能。予定リストに ✎ ボタン→編集モードでタイトル/開始日/終了日/メモ更新→UPDATE+「📅予定を変更したよ」Push。記念日行(id無し)は対象外。events は authenticated_all で権限OK

**新規テーブル (このセッション)**
- `notification_prefs` (通知のアカウント別ON/OFF, opt-out, FKなし)
- `status_events` (帰宅ページの操作ログ, uuid PK)

**まだ拾えていない/保留**
- Push通知音は端末デフォルト(アプリ側未指定)。iOSはWebから音指定不可、Androidはチャンネルで変更可能だが未対応。要望あればAndroid向けチャンネル分けを検討
- send-push の kind フィルタは instant 通知のみ。scheduled(send-reminders)は kind 未設定で対象外
- 「やりたいこと(wishlist)」は既に編集可能(ユーザー確認済) → 対応不要

---

## 2026-07-18 セッション追記

**このセッションでやったこと (すべてデプロイ済み)**
1. ホーム: 絵文字の左右入れ替わりちらつき解消 (localStorage キャッシュ) / 今ここボタンを青紫グラデ pill + ピン演出
2. 記念日バッジの「237日」段落ち解消 (`.ann-main` で1行化)
3. ホームのレイアウト整理: 上部を 記念日→今ここ→今日の帰宅→今のきもち の縦積み、以降は均一2列グリッド (bento-wide/big-hero 撤廃)
4. 今ここボタン: 2タップ確定式 (誤タップ防止。1タップ目「もう一度タップで送信」緑パルス、4秒で自動キャンセル)
5. **通知のアカウント別ON/OFF設定** (メイン): `notification_prefs` テーブル(opt-out・FKなし) / send-push が kind ごとに受信者設定を尊重(履歴は残す) / `settings.html` 新規(14種トグル・プッシュ有効化・ルール・ログアウト) / 👤→設定ページ / もっとシートをセクション分け+設定導線
6. 販売所: 売り切れの「🔁再販リクエスト」 / 🎫券タブで同一未使用券を「×N」まとめ表示(使用は1枚ずつ)

**見つけた実バグ修正**: notification_prefs に profiles への FK を張ると profile行の無い認証ユーザーで保存不能 → FK 撤去

**検証**: Playwright — settings_flow 3件 / shop_features 2件 / quiz_history / home_layout すべてパス。設定保存は実DB往復でも確認。

**注意/申し送り**:
- settings.html のアカウント欄はテストアカウントだと profile 無しで「読み込み中」のまま。実ユーザー(fox/hed)では絵文字+名前が出る
- send-push の kind フィルタは instant 通知のみ。scheduled(send-reminders)は kind 未設定なので対象外。必要なら別途対応
- fox(nick)残高0pt の件は継続観察

---


**最終更新**: 2026-07-17
**前回のまとめ**: 設計改善リファクタ第1弾。賭け事の二重配当バグを RPC 化で修正、ビンゴプール分離 + カテゴリ別ラッキーマス修正、util.js 骨格導入。**残りは `docs/PLAN_REFACTOR_UTILJS.md` に引き継ぎ**。

---

## 0. 現状 (2026-07-17 時点)

### 直近のコミット (新しい順)
- `392a86e` 共通ユーティリティ assets/js/util.js を導入 (全ページに include のみ)
- `7704629` ビンゴ: お題プールを外部ファイルに分離 + カテゴリ別のラッキーマス修正
- `f7f6c5f` 賭け事のポイント移動を RPC でアトミック化 (二重配当バグ修正)
- `3f6f94e` LINE通知を月200通枠に収める + 既読化バグ修正 + 今のきもちラベル追加 (別セッション)

### このセッションでやったこと (設計レビュー → リファクタ)
1. **設計レビュー**: 5つの負債を特定（賭け事二重配当リスク / esc 16重複 / bingo.html 328K / クイズ30日周期 / エラー握りつぶし）
2. **賭け事 RPC 化**: create/accept/reject/cancel/settle/approve_cancel の6関数を SECURITY DEFINER で作成・**DB 適用済み**。status ガードで同時操作の二重配当を防止。ROLLBACK テストで台帳の整合を確認済み（fox -10 / hed -10 / 勝者 +20、二重確定は拒否）
3. **points RLS の実態判明**: SPEC の「自分の分のみ INSERT」は誤りで、実際は authenticated なら誰の分でも INSERT 可。SPEC を実態に合わせて修正済み。過去の配当に silent fail は無し
4. **ビンゴプール分離**: `assets/data/bingo_pools.js` (11604個、個数一致検証済み)。bingo.html 328K→76K
5. **カテゴリ別ラッキーマス修正**（ユーザー依頼）: 汎用ラッキープールでなくカテゴリ内の1マスをラッキー指定に
6. **util.js 骨格**: escHtml / notify / addPoints / jstDateStr を定義、全19ページに include 追加。**各ページの移行は未着手**
7. バックアップ: tag `backup/2026-07-16-pre-refactor` + branch `backup-2026-07-16-pre-refactor`

---

## 1. 次回の候補タスク

### 1.1 リファクタ残作業 → ✅ 2026-07-17 完了
- **util.js 全ページ移行 完了**（esc統一 / send-push→notify / points→addPoints）。詳細と例外は `docs/PLAN_REFACTOR_UTILJS.md`
- **クイズ 30→278問 完了**（カテゴリ4種追加）
- Playwright スモーク `tests/refactor_smoke.spec.js` 19/19 パス
- **未実施の実機確認（次回、実データを使うので手動推奨）**: 賭け事の起票〜確定を実UIで通す / クイズ回答で +10pt が入り相手に通知 / ビンゴのカテゴリ別ラッキーマスが⭐表示

### 1.2 ビンゴ精査 pass 2（優先度: 高、ユーザー明示希望）
サブエージェント出力 (everyday/city/couple 1610件 + seasonal他 470件) を再取得 → 過剰削除を精選 (1000件くらいに絞る) → 適用。**プールは `assets/data/bingo_pools.js` に移動済みなので diff がきれいに出る**。prune スクリプトは要再作成 (/tmp のものは揮発済み)

### 1.3 ビンゴ増量（優先度: 中）
少ないカテゴリ: reading 155 / food 246 / lucky 366。候補は前回メモ参照 (「章を読み切った」「新メニュー試した」等)

### 1.4 未着手機能（前回からの積み残し）
- カウントダウン tile (次の記念日/誕生日/デートまで)
- カスタムクイズ（クイズ増量と合流させると根本解になる）
- ゲージ履歴グラフ
- デート記録

### 1.5 残ページのダーク統一（優先度: 中）
quiz.html / time_capsule.html / color_hunting.html / one_on_one.html / points.html は未巡回

### 1.6 技術負債
- gacha.html の loadTickets/renderTickets 残骸除去
- Playwright E2E (ガチャを引く / 券を使う / 賭け事 RPC フロー)
- View Transitions の iOS Safari 実機確認

---

## 2. 気になる観察・仮説

- **fox (nick) の残高が 0pt** (641行の合計が丁度0)。ガチャ等の消費の結果なら正常だが、賭け事もガチャも起票できない状態。本人が気にしてたら履歴を見せてあげると良い
- **通知タップ既読化 / くっついてるLINE / ゲージMAX LINE個人** は前回実装済みでまだ動作報告なし（コンソールログ要確認）
- 別セッションで LINE 通知の月200通枠対応が入った (`3f6f94e`)。通知系を触る時はそちらの変更内容も先に確認すること

## 3. 開発ルール (再確認)

- **抽象要求 → 議論より先にデプロイして実物で判断**
- 変更前に **git tag + backup ブランチ**
- **モバイルファースト** / **秘密情報はコミット・メモリに書かない**
- **git push・DB操作・デプロイ含め自律的に進めてOK**
- 大きめの依頼は着手前にタスクリスト作成

## 4. 秘密情報の在処 (再掲)

- テストアカウント: `claude@example.com` / `claude`
- Supabase project ref: `qivnfiqyjfajlzbdqodd`
- 本番 URL: https://imaimaha.github.io
- `.env` にすべての秘密情報 (.gitignore済)

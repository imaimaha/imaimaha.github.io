# 次回セッション用: TODO と背景

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

# 次回セッション用: TODO と背景

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

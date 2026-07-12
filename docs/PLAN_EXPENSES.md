# 割り勘機能 計画書

**作成日**: 2026-07-12
**状態**: ✅ **実装済み** (2026-07-12)
**実装ファイル**: `expenses.html`
**DB**: `expenses`・`settlements` テーブル作成済み
**関連仕様**: `docs/SPEC.md`

---

## 1. 目的

同棲・共同生活で発生する費用（食費・光熱費・家賃・デート代など）を
気軽に記録して、「今どちらがどれだけ多く払っているか」を可視化する。
月末に精算 or いつでも手動精算。

- ふたりのお金の使い方が見える化される
- 「あの時払ってくれてありがとう」の起点になる
- 精算漏れ防止

## 2. 設計

### 2.1 テーブル

**`expenses`**

```sql
CREATE TABLE expenses (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paid_by      uuid REFERENCES auth.users NOT NULL,  -- 立て替えた人
  amount       integer NOT NULL,                      -- 総額 (円)
  category     text,                                  -- 食費/光熱費/家賃/デート/交通/日用品/その他
  description  text,                                  -- メモ (何を買った・行った)
  split_ratio  numeric DEFAULT 0.5,                   -- 相手が負担すべき割合 (0.5 = 折半 / 0.7 = 相手7割 / 1.0 = 全額相手負担)
  spent_at     date NOT NULL DEFAULT CURRENT_DATE,    -- 実際に支払った日
  settled_at   timestamptz,                           -- 精算済みならその時刻
  settlement_id bigint,                               -- 一括精算した場合のグループID
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_select ON expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (auth.uid() = paid_by);
CREATE POLICY expenses_update ON expenses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY expenses_delete ON expenses FOR DELETE USING (auth.uid() = paid_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE expenses_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE expenses_id_seq TO service_role;
```

**`settlements`** （精算履歴）

```sql
CREATE TABLE settlements (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settled_by     uuid REFERENCES auth.users NOT NULL,  -- 精算を実行した人
  net_amount     integer NOT NULL,                      -- 精算額 (正 = paid_by が受け取る / 負 = paid_by が支払う)
  payer_id       uuid REFERENCES auth.users NOT NULL,   -- 実際にお金を渡した人
  receiver_id    uuid REFERENCES auth.users NOT NULL,   -- 実際にお金を受け取った人
  period_from    date,                                  -- この精算がカバーする期間の開始
  period_to      date,                                  -- 期間の終了
  memo           text,
  created_at     timestamptz DEFAULT now()
);

-- RLS 省略（同上パターン）
```

### 2.2 計算ロジック

**未精算の貸し借り** = 「相手が私に払うべき額 - 私が相手に払うべき額」

- 私が立て替えた `expenses` で `settled_at IS NULL`:
  - 相手負担額 = amount × split_ratio → 相手が私に「未払い」
- 相手が立て替えた `expenses` で `settled_at IS NULL`:
  - 私の負担額 = amount × split_ratio → 私が相手に「未払い」
- 差引で「今、誰がどれだけ多く払ってる」

```js
function calculateBalance(expenses, myUserId) {
  let net = 0; // 正 = 相手が私に返すべき / 負 = 私が相手に返すべき
  for (const e of expenses.filter(x => !x.settled_at)) {
    const partnerShare = e.amount * e.split_ratio;
    if (e.paid_by === myUserId) {
      net += partnerShare; // 相手負担分を相手が私に返すべき
    } else {
      net -= partnerShare; // 私が相手に返すべき
    }
  }
  return net;
}
```

### 2.3 UI 設計

**expenses.html**

- **サマリーカード**（画面上部）
  - 現在の未精算バランス: 「🦊 が 🦔 に ¥3,200 貸してる」的な表示
  - 今月の総支出（両者合算）
  - 精算ボタン
- **入力フォーム**（折りたたみ）
  - 金額（円）
  - カテゴリ（プルダウン: 食費/光熱費/家賃/デート/交通/日用品/その他）
  - メモ
  - 支払者（デフォルト自分、切替可）
  - 割合（プリセット: 折半 / 相手全額 / 私全額 / カスタム）
  - 日付（デフォルト今日）
- **履歴タイムライン**
  - 日付降順
  - フィルタ: 全部 / 未精算 / 精算済 / カテゴリ別
  - 各行: 絵文字（誰が払った） 金額 カテゴリ メモ 割合
  - タップで編集・削除
- **精算モーダル**
  - 「今 ¥N の貸し借りがあります。精算しますか？」
  - 「はい」で全未精算をまとめて settled_at 記入 + settlements に記録
  - 部分精算（金額指定）オプション

### 2.4 導線

- トップ画面のセクション一覧に「💰 割り勘」タイル追加
- ヘッダーの右上には出さない（普段使う頻度と相談）

### 2.5 通知

- 記録追加時 → 相手にPush「🦊 が食費に ¥1,200 を記録しました」
- 精算完了時 → 相手にPush「精算しました。バランスが 0 になりました」
- 月末リマインダー（オプション、pg_cron）: 「未精算 ¥N あります」

### 2.6 ポイント連携

- 支出記録 → +1pt（reason: `expense_add`）
- 精算実行 → +3pt（reason: `expense_settle`）

## 3. 実装ステップ

### Step 1: DB
```bash
cd /mnt/c/Users/redem/Documents/dev/imaimaha.github.io
source .env
# expenses・settlements テーブル作成
npx supabase db query --linked -o table "..."
```

### Step 2: expenses.html 作成
- top-bar + サマリーカード + フォーム + 履歴リスト
- モバイルファースト、他ページと統一デザイン

### Step 3: index.html に導線追加
- メニューに「💰 割り勘」追加
- セクション「今の割り勘バランス」タイル

### Step 4: 通知・ポイント
- 記録追加時のPush連携
- 精算時のPush連携
- points への insert

### Step 5: SPEC.md 更新
- §4.16 として仕様追加
- §5 にポイントルール追加（+1pt / +3pt）
- §7 に expenses・settlements テーブル追加
- §6.2 の Push 発火条件表に追加

### Step 6: header.js のルール表更新
- ポイント付与に「💰 支出記録 +1pt / 精算 +3pt」を追加

## 4. 拡張候補（将来）

- **画像添付**: レシートの写真を保存（memories bucket 利用）
- **月次集計グラフ**: カテゴリ別内訳を円グラフ
- **予算設定**: カテゴリ別の月次予算を設定、超過時にアラート
- **共有口座管理**: 実際の口座残高との紐付け
- **繰り返し支出**: 家賃・光熱費など月次固定支出のテンプレート
- **通貨対応**: 旅行時の外貨対応（円換算）

## 5. 判断ポイント

実装前に決めておくべきこと:

- [ ] 支出カテゴリの初期セット（食費/光熱費/家賃/デート/交通/日用品/その他 でOK？）
- [ ] 割合のプリセット（折半 / 相手全額 / 私全額 でOK？ 他に必要？）
- [ ] 精算は「一括精算」のみ? 部分精算も対応?
- [ ] 精算方法は記録のみ? 実際の送金アプリ連携（LINE Pay / PayPay等）は将来?
- [ ] トップ画面のサマリータイルは必要? （導線のみで済ませる?）

## 6. 見積もり

**総工数**: 半日〜1日

- DB作成: 30分
- expenses.html 作成: 3〜4時間
- 通知・ポイント連携: 1時間
- SPEC.md 更新・header.js 更新: 30分
- テスト: 1時間

---

## 7. 実装後の TODO

- [ ] `docs/PLAN_EXPENSES.md` の判断ポイントを埋める
- [ ] DB作成
- [ ] expenses.html 作成
- [ ] index.html 導線追加
- [ ] 通知・ポイント連携
- [ ] SPEC.md 更新
- [ ] header.js ルール表更新
- [ ] commit + push
- [ ] `docs/PLAN_FUTURE_FEATURES.md` の該当エントリを完了に

# 設計改善リファクタ計画 (util.js 移行 + クイズ増量)

**作成**: 2026-07-17
**背景**: 設計レビューで見つかった負債の解消。5項目のうち 3 つは対応済み、残り 2 つ+検証をこの計画書で引き継ぐ。

---

## 1. 対応済み (2026-07-17 デプロイ済み)

| 項目 | コミット | 内容 |
|------|---------|------|
| 賭け事の二重配当バグ | `f7f6c5f` | 全ポイント移動を SECURITY DEFINER RPC 化。`supabase/migrations/20260717000000_bets_atomic_rpc.sql`。**DB 適用済み** |
| ビンゴプール分離 | `7704629` | POOLS 11604個 → `assets/data/bingo_pools.js` (bingo.html 328K→76K) |
| カテゴリ別ラッキーマス | `7704629` | 汎用ラッキープールではなくカテゴリ内の1マスをラッキー指定 |
| util.js 骨格 | `392a86e` | `assets/js/util.js` 作成、全19ページに include 済み (**中身の移行は未着手**) |

### 賭け事 RPC の仕様 (bets.html から `_sb.rpc()` で呼ぶ)

| 関数 | ガード | ポイント移動 |
|------|--------|------------|
| `create_bet(p_title, p_description, p_stake, p_opponent)` | 残高チェック | 起票者 -stake |
| `accept_bet(p_bet_id)` | `status='pending' AND opponent_id=uid` + 残高 | 受け手 -stake |
| `reject_bet(p_bet_id)` | `status='pending' AND opponent_id=uid` | 起票者 +stake |
| `cancel_bet(p_bet_id)` | `status='pending' AND created_by=uid` | 起票者 +stake |
| `settle_bet(p_bet_id, p_choice)` | `status='active'` (勝者は 'me'/'you'/'draw' から算出) | 勝者 +stake×2 or 両者 +stake |
| `approve_bet_cancel(p_bet_id)` | `cancel_requested AND cancel_by<>uid` | finished→配当巻き戻し / active→両者返却 |

同時操作は片方が「すでに処理済み/確定済み」エラーになる（クライアントは `error.message` を toast 表示して `loadBets()` で再描画済み）。

---

## 2. 残作業A: util.js への各ページ移行

`assets/js/util.js` のグローバル関数（全ページ include 済みなのでそのまま呼べる）:

- `escHtml(s)` — HTMLエスケープ。各ページのローカル実装の上位互換（`'` も追加でエスケープ）
- `notify({title, body, url, kind, recipient, sender, ...})` — send-push ラッパ。**url 必須**（無いと console.error して送らない）。`recipient`→`recipient_user_id`、`sender`→`sender_user_id` に変換、その他のフィールド（3択ボタン等）は透過。失敗は内部で catch して console.error（`.catch(()=>{})` 相当）
- `addPoints(userId, amount, reason)` — points INSERT + 失敗時 console.error。戻り値 boolean
- `jstDateStr(date?)` — JST の YYYY-MM-DD（新規コード用。既存の日付ロジックの置換はしない）

### 移行ルール

1. **ローカル `escHtml`/`escReq`/`escAttr` 定義を削除**し、呼び出しはすべてグローバル `escHtml` に（escReq/escAttr は実装が escHtml と同等なのでリネームでOK。ただし削除前に実装を目視確認）
2. **`_sb.functions.invoke('send-push', { body: {...} })` → `notify({...})`**
   - `recipient_user_id: X` → `recipient: X`、`sender_user_id: X` → `sender: X`、他キーはそのまま
   - 元コードの `.catch(() => {})` は notify 内蔵なので外す。`await` の有無は元のまま維持
3. **points の単一 INSERT → `addPoints(userId, amount, reason)`**
   - `await` は元のまま維持。配列 INSERT は addPoints 2回に分解してよい（独立insertなので等価）
   - **SELECT は対象外**（`from('points').select` は触らない）
   - bets.html は RPC 化済みなので points 移行は不要（残っているのは残高 SELECT のみ）
4. 日付ロジック（`getWeekStr` 等）と `line-notify` 呼び出しは**触らない**

### 対象ファイルと箇所数（2026-07-17 時点の grep）

| ファイル | esc定義 | send-push | points INSERT系 |
|---------|--------|-----------|----------------|
| bets.html | ✔ | 8 | — (RPC済) |
| shop.html | ✔ (escReq/escAttr含む) | 6 | 4 |
| gacha.html | ✔ | 4 | 6 |
| status.html | ✔ | 5 (3択ボタン付きあり) | — |
| index.html | — | 3 | 2 |
| closer.html | — | 2 | 2 |
| expenses.html | ✔ | 2 | 2 |
| bingo.html | ✔ | 1 | 3 |
| quiz.html | ✔ | 1 | 1 |
| thanks.html | ✔ | 1 | 2 |
| time_capsule.html | ✔ | 1 | 3 |
| calendar.html / color_hunting.html / location.html / memories.html | ✔ | 各1 | color_huntingのみ2 |
| notifications.html / one_on_one.html / wishlist.html / points.html | ✔ | — | — |

※ points 列は `from('points')` の出現数から SELECT を除いた概数。実施時に要再確認。

### 検証手順

```bash
# 1. 全ページの inline script 構文チェック
node -e "const fs=require('fs');fs.readdirSync('.').filter(f=>f.endsWith('.html')).forEach(f=>{[...fs.readFileSync(f,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((s,i)=>{try{new Function(s[1])}catch(e){console.log(f,i,e.message)}})});console.log('done')"
# 2. 残骸チェック (0件になるはず)
grep -rn "function escHtml\|function escReq\|function escAttr" *.html
grep -rn "invoke('send-push'" *.html
# 3. Playwright スモーク (quiz回答・thanks投稿あたりでポイント付与を実確認)
```

---

## 3. 残作業B: クイズ質問プール増量

- `quiz.html` の `QUESTIONS` 30問が `日付 % 30` 選出のため30日で一周している
- **既存30問の配列順は絶対に変えない**（`question_id` = 配列 index で過去回答と紐づくため末尾追加のみ）
- 90問以上に増量し、`% 30` の除数を `QUESTIONS.length` に変更
- 質問のトーンは既存に合わせる（カップル向け・軽い・答えやすい。例:「今いちばん行きたい場所は？」系）

---

## 4. デプロイ後の実機確認 (未実施)

- [ ] カテゴリ別ビンゴ新規作成 → ラッキーマス⭐がカテゴリのお題になっている
- [ ] 週間ビンゴ → 従来どおり汎用ラッキーが1マス入る（挙動不変）
- [ ] bingo_pools.js 分離後にカード表示・チェック・シェア画像が動く
- [ ] 賭け事: 起票→承諾→結果確定の一連 + 同時確定で片方エラーになること
- [ ] SPEC.md §7.2 の points RLS 記述は実態（authenticated は誰の分でも INSERT 可）に修正済み

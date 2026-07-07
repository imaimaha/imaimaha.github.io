# Notre Endroit — 開発ガイド

彼女と共有するプライベートサイト。2人だけのポータル（fox 🦊 / hed 🦔）。

## 📖 正式仕様書

**すべての機能・データモデル・通知フロー・運用手順は [docs/SPEC.md](docs/SPEC.md) に集約している。**

Notre / imaimaha 関連の作業を始める時は、必ず先に SPEC.md を読むこと。
機能追加・変更したら SPEC.md も更新すること（実装だけ変えて仕様書を放置しない）。

## クイックリファレンス

- 本番: https://imaimaha.github.io
- リポジトリ: `imaimaha/imaimaha.github.io`
- Supabase ref: `qivnfiqyjfajlzbdqodd`
- 秘密情報: `.env`（`.gitignore` 済）。**Claude memory / コミット履歴には絶対に書かない**
- 作業ディレクトリ: `/mnt/c/Users/redem/Documents/dev/imaimaha.github.io`
- テストアカウント: `claude@example.com` / `claude`

## デプロイの罠

- `git push` で GitHub Pages 自動デプロイ（1〜2分）
- たまに `Deployment failed, try again later` の一時エラー → auto-retry の空コミットで再試行

## SQL 実行の注意

- `CREATE POLICY IF NOT EXISTS` は PostgreSQL に無い → `DROP POLICY IF EXISTS` してから `CREATE POLICY`
- `CREATE TABLE` + `CREATE POLICY` の後は **`authenticated` と `service_role` の両方に GRANT が必要**:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO service_role;
```

  `authenticated` だけだと Edge Function (service_role) から `permission denied` になる。

- **bigint autoincrement な id を持つテーブルは sequence にも GRANT が必要**:

```sql
GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO service_role;
```

  忘れると INSERT 時に `permission denied for sequence` になる

- service_role GRANT 状況の確認:

```bash
supabase db query --linked -o table "SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='service_role' AND table_schema='public' ORDER BY table_name;"
```

- 詳細は [docs/SPEC.md § 10.6](docs/SPEC.md)

## プッシュ通知

- VAPID_MAILTO 環境変数は `mailto:` プレフィックスがなくても send-push が自動補完する
- iOS は PWA（ホーム画面に追加）として起動しないとプッシュが届かない
- push_subscriptions が空だと通知は一切届かない（購読登録が必要）
- 「行っていい？」は LINE ではなくプッシュ通知の3択ボタンで返答する仕組みに変更済み

## Supabase CLI

```bash
export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"
source .env
supabase login --token $SUPABASE_CLI_TOKEN

# SQL実行（インライン） ※ -o table を付けること
supabase db query --linked -o table "SELECT ..."

# SQL実行（ファイル）
supabase db query --linked -f path/to/migration.sql

# Edge Function デプロイ
supabase functions deploy <name> --project-ref $SUPABASE_PROJECT_REF
```

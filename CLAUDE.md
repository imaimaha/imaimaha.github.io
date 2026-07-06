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
- `CREATE TABLE` + `CREATE POLICY` の後は **必ず `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;`** を書く
- 詳細は [docs/SPEC.md § 10.6](docs/SPEC.md)

## Supabase CLI

```bash
export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"
source .env
supabase login --token $SUPABASE_CLI_TOKEN
supabase db query --linked -f path/to/migration.sql
supabase functions deploy <name> --project-ref $SUPABASE_PROJECT_REF
```

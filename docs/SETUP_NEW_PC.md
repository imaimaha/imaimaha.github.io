# 別のPCで開発を始める手順

新しいPC(または新しい人)が Notre Endroit を編集できるようになるまでのセットアップ。
所要 15〜30分。困ったら既存の開発PCの持ち主に聞くこと。

## 0. 前提

- **push できるのは GitHub でコラボレーターに招待された人だけ**。招待は
  リポジトリの Settings → Collaborators から(admin = imaimaha が行う)
- リポジトリ自体は公開なので clone は誰でもできるが、push は許可制
- **秘密情報(.env)は git に入っていない**。既存PCから安全な方法で受け取る(後述)

## 1. 必要なツール

| ツール | 用途 | 入れ方 |
|--------|------|--------|
| git | コード管理 | Windows なら WSL2 + Ubuntu 推奨(既存PCと同じ構成) |
| GitHub CLI (`gh`) | GitHub 認証・操作 | `sudo apt install gh` など |
| Node.js (LTS) | Supabase CLI / Playwright / スクリプト実行 | nvm 推奨 |
| Claude Code | 開発アシスタント(任意だが推奨) | https://claude.com/claude-code |

## 2. clone と認証

```bash
# GitHub にログイン(自分のアカウント。招待を受諾しておくこと)
gh auth login

# clone
git clone https://github.com/imaimaha/imaimaha.github.io.git
cd imaimaha.github.io

# コミットの名前を設定(まだなら)
git config user.name "自分の名前"
git config user.email "GitHubに登録したメール"
```

これだけで **HTML/CSS/JS の編集 → push → 自動デプロイ** はできる。
push 前に `bash scripts/bump_version.sh` を実行するのを忘れずに(キャッシュ対策。SPEC §9.2)。

## 3. .env を受け取る(DB操作・Edge Function デプロイをやる場合)

`.env` には Supabase の秘密鍵が入っている。**LINEやメールで平文で送らない**。
USBメモリ・AirDrop・パスワードマネージャーの共有機能など、安全な方法で受け取って
リポジトリ直下に `.env` として置く(`.gitignore` 済みなのでコミットされない)。

中身の項目は `.env.example` を参照。

```bash
# 動作確認(テーブル一覧が出ればOK)
source .env
npx supabase db query --linked -o table "SELECT 1"
```

## 4. Playwright(テストを回す場合)

```bash
npm install
npx playwright install chromium
# 初回のみ: テストアカウントでログイン状態を作る
PW_EMAIL=claude@example.com PW_PASSWORD=claude npx playwright test --project=setup
# 以後
npx playwright test tests/refactor_smoke.spec.js
```

## 5. Claude Code を使う場合

- 既存PCの `~/.claude/skills/notre/` (SKILL.md) をコピーすると、「/notre」で
  プロジェクトの前提知識を読み込んだ状態で作業を始められる
- 開発ルールは `docs/SPEC.md` §10 と `CLAUDE.md` を参照

## 6. 開発ルールの要点(必読)

1. **まず `docs/NEXT_SESSION.md` を読む**(前回の状況と注意点)
2. 機能追加・ルール変更をしたら **SPEC.md も更新**する
3. **秘密鍵・個人情報(実名メール・町名など)をコードや docs にベタ書きしない**
   (2026-09-12 に漏洩事故と後始末あり。経緯は NEXT_SESSION.md)
4. push 前に `bash scripts/bump_version.sh`
5. セッション終了時に `NEXT_SESSION.md` を更新

## 7. 注意: このPCにしか無いもの

- 過去写真の原寸バックアップは **既存PCの `~/notre_photo_backup_2026-08-01/` にしか無い**。
  新PCには無いので、Storage の写真を消す系の作業は既存PCの持ち主と相談してから

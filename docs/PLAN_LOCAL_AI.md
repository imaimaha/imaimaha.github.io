# ローカルAI連携 (実験機能・2026-09-28〜)

ユーザーの自宅PC(WSL/Linux, `hirotaka@imanishi`)でローカルLLM(Ollama)を動かし、Notreの日記機能に一言コメントさせる実験。

## 構成

```
Notre(diary.html)
  → Edge Function `diary-ai-comment` (Supabase, クラウド)
    → Cloudflare Tunnel (無料のquick tunnel, trycloudflare.com)
      → 認証プロキシ ~/ollama-proxy/proxy.py (自宅PC, :8787)
        → Ollama (自宅PC, :11434, qwen2.5-coder:7b)
```

- **なぜプロキシを挟むか**: Ollama自体には認証機能が無い。そのままトンネルで公開すると誰でも無料でAIを使い放題にできてしまうため、`~/ollama-proxy/proxy.py`(標準ライブラリのみ・依存なし)で `Authorization: Bearer <OLLAMA_PROXY_SECRET>` を検証してから転送する
- **秘密情報の置き場**:
  - `OLLAMA_PROXY_SECRET`: Supabase Edge Function Secrets(`supabase secrets set`で設定済み)。プロキシ側は `~/ollama-proxy/.secret`(自宅PCのみ、リポジトリ外)
  - トンネルURL: `settings`テーブルの `key='ollama_tunnel_url'`。**quick tunnelは再起動のたびにURLが変わる**ので、その都度ここを更新する必要がある

## 起動手順 (自宅PC再起動後など)

```bash
# 1. Ollamaサーバー
ollama serve &

# 2. 認証プロキシ
cd ~/ollama-proxy && OLLAMA_PROXY_SECRET=$(cat .secret) nohup python3 proxy.py > proxy.log 2>&1 & disown

# 3. Cloudflareトンネル (毎回新しいURLが発行される)
nohup /tmp/cloudflared tunnel --url http://localhost:8787 > ~/ollama-proxy/tunnel.log 2>&1 & disown
sleep 5 && cat ~/ollama-proxy/tunnel.log   # ここで発行されたURLを確認
```

新しいURLが出たら、Supabaseの `settings` テーブルを更新:
```sql
insert into settings (key, value) values ('ollama_tunnel_url', '<新URL>')
on conflict (key) do update set value = excluded.value;
```

## 既知の制約

- **自宅PCが起動していて、上記3プロセスが動いている時だけ**AIコメントが付く。落ちていても日記の保存自体には影響しない(`diary-ai-comment`はベストエフォートで、失敗しても静かに諦める設計)
- CPU推論のみ(GPU支援なし)。7Bモデルで1回の生成に数十秒かかることがある。`diary-ai-comment`のタイムアウトは45秒
- quick tunnelはCloudflareアカウント不要の無料機能だが、**再起動のたびにURLが変わる**。固定したい場合は独自ドメイン購入後、Named Tunnel(DNSルーティング付き)に切り替える

## 使ってるモデル

- `qwen2.5-coder:7b`(4.7GB)。コーディング特化モデルだが日本語の日記コメントにも十分使えている。トーンが合わなければ汎用モデル(`qwen2.5:7b`等)に差し替え検討

## 今後の広げ方(アイデアメモ)

- Macアプリ(ユーザーが別途開発中)からも、**Macに直接Ollamaを入れて**ローカルで呼ぶ方が速くて安全(トンネル不要)
- 常時稼働させたくなったら、自宅の低消費電力ミニPC or 格安VPSに本番トンネル(独自ドメイン)で移行
- 日記以外の機能(目標達成の「えらい！」コメント案、思い出の検索など)にも同じ仕組みを流用できる

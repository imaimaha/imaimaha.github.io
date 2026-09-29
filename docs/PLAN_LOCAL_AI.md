# ローカルAI連携 (実験機能・2026-09-28〜)

ユーザーの自宅PC(WSL/Linux, `hirotaka@imanishi`)でローカルLLM(Ollama)を動かし、Notreの日記機能に一言コメントさせる実験。

## 構成

```
Notre(diary.html)
  → Edge Function `diary-ai-comment` (Supabase, クラウド)
    → Cloudflare Tunnel (無料のquick tunnel, trycloudflare.com)
      → 認証プロキシ ~/ollama-proxy/proxy.py (自宅PC, :8787)
        → Ollama (自宅PC, :11434, qwen3:8b)
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
- CPU推論のみ(GPU支援なし)。`diary-ai-comment`のタイムアウトは45秒
- quick tunnelはCloudflareアカウント不要の無料機能だが、**再起動のたびにURLが変わる**上に、**数十分〜1時間程度で勝手に切断されて自己修復しないことがある**(ログに`Unauthorized: Tunnel not found`が出続ける)。気づいたら上記「起動手順」の3を再実行してURLを更新し直す。固定したい場合は独自ドメイン購入後、Named Tunnel(DNSルーティング付き)に切り替える

## 使ってるモデル

- `qwen3:8b`(5.2GB、2026-09-29〜)。**必ず `think: false` を付けること**(デフォルトのthinkingモードだと1回の生成に70秒以上かかる上、出力に余計な思考過程が混ざる)。think:false なら実測1〜30秒程度で、日本語の自然さもqwen2.5-coderより良い
- 旧: `qwen2.5-coder:7b`(4.7GB、コード特化モデル)。日記コメントには汎用モデルの方が向いていたため乗り換え済み

## 今後の広げ方(アイデアメモ)

- **Mac mini移行を検討中**(2026-09-29〜、ユーザーがMac miniを購入): 省電力で常時起動しやすく、Apple Siliconで推論も速くなる見込み。Macアプリ(別途開発中)からもトンネル不要でローカル呼び出しできる。手順は今のPCと同じ(Ollama+モデル+proxy.py+cloudflared)。**ユーザー判断で一旦保留中**、気が向いたら着手
- 常時稼働させたくなったら、格安VPSに本番トンネル(独自ドメイン)で移行という手もある
- 日記以外の機能(目標達成の「えらい！」コメント案、思い出の検索など)にも同じ仕組みを流用できる

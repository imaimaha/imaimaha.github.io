import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_TOKEN')!
const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const { sender_id, message } = await req.json()
  if (!sender_id || !message) {
    return json({ error: 'sender_id and message are required' }, 400)
  }

  const sb = createClient(SB_URL, SB_KEY)

  // 送信者以外のパートナーの line_user_id を取得
  const { data: partner } = await sb
    .from('profiles')
    .select('line_user_id, name')
    .neq('id', sender_id)
    .single()

  if (!partner?.line_user_id) {
    return json({ error: 'partner LINE User ID not registered' }, 404)
  }

  // LINE Push Message 送信
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: partner.line_user_id,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return json({ error: err }, 500)
  }

  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://imaimaha.github.io',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_TOKEN')!
const SB_URL     = Deno.env.get('SUPABASE_URL')!
const SB_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const { sender_id, message } = await req.json()
  if (!message) {
    return json({ error: 'message is required' }, 400)
  }

  const sb = createClient(SB_URL, SB_KEY)

  // グループ ID があればグループへ送信、なければ個人へ送信
  const { data: groupSetting } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'line_group_id')
    .single()

  let to: string | null = null

  if (groupSetting?.value) {
    to = groupSetting.value
  } else {
    if (!sender_id) {
      return json({ error: 'sender_id required when no group is configured' }, 400)
    }
    const { data: partner } = await sb
      .from('profiles')
      .select('line_user_id')
      .neq('id', sender_id)
      .single()

    if (!partner?.line_user_id) {
      return json({ error: 'partner LINE User ID not registered' }, 404)
    }
    to = partner.line_user_id
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to,
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

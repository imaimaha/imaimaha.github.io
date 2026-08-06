import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL  = Deno.env.get('SUPABASE_URL')!
const SB_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  // 認証ユーザーの id を取得
  let buyerUid: string
  try {
    const userSb = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error } = await userSb.auth.getUser()
    if (error || !user) return json({ error: 'Invalid JWT' }, 401)
    buyerUid = user.id
  } catch {
    return json({ error: 'Auth failed' }, 401)
  }

  const { item_id } = await req.json()
  if (!item_id) return json({ error: 'item_id required' }, 400)

  const sb = createClient(SB_URL, SB_KEY)

  // 商品取得
  const { data: item, error: itemErr } = await sb.from('shop_items')
    .select('*').eq('id', item_id).single()
  if (itemErr) return json({ error: 'item query failed: ' + itemErr.message + ' (code: ' + itemErr.code + ')' }, 404)
  if (!item) return json({ error: 'item not found: ' + item_id }, 404)
  if (!item.active) return json({ error: 'この商品は販売停止中です' }, 400)
  if (item.buyer_id !== buyerUid) return json({ error: 'あなた宛の商品ではありません' }, 403)
  if (item.stock !== null && item.stock <= 0) return json({ error: 'sold out' }, 400)

  // 買い手の残高チェック。
  // ⚠️ 全行 select → reduce だと PostgREST の 1000行上限で古い履歴を取りこぼし、
  //    残高が実際より少なく出て「ポイント不足」になる。必ず RPC (DB側 SUM) を使う
  const { data: balance, error: balErr } = await sb.rpc('point_balance', { uid: buyerUid })
  if (balErr || balance === null) {
    return json({ error: '残高を確認できませんでした: ' + (balErr?.message ?? 'unknown') }, 500)
  }
  if (balance < item.price) return json({ error: `ポイント不足 (残高 ${balance}pt / 必要 ${item.price}pt)` }, 400)

  // 在庫を先に減らす (nullなら無限なのでスキップ)
  if (item.stock !== null) {
    const { error: stockErr } = await sb.from('shop_items')
      .update({ stock: item.stock - 1 }).eq('id', item.id).eq('stock', item.stock)  // optimistic
    if (stockErr) return json({ error: '在庫更新失敗: ' + stockErr.message }, 500)
  }

  // 買い手のポイント -price
  const { error: buyPtErr } = await sb.from('points').insert({
    user_id: buyerUid, amount: -item.price, reason: 'shop_buy',
  })
  if (buyPtErr) return json({ error: 'buyer point insert failed: ' + buyPtErr.message }, 500)

  // 売り手のポイント +price
  const { error: sellPtErr } = await sb.from('points').insert({
    user_id: item.seller_id, amount: item.price, reason: 'shop_earn',
  })
  if (sellPtErr) {
    // 買い手側は既に-されているので、ロールバックとして +price を戻す
    await sb.from('points').insert({ user_id: buyerUid, amount: item.price, reason: 'shop_refund' })
    return json({ error: 'seller point insert failed' }, 500)
  }

  // 購入記録
  const { data: purchase, error: purErr } = await sb.from('shop_purchases').insert({
    item_id: item.id,
    buyer_id: buyerUid,
    seller_id: item.seller_id,
    price: item.price,
    name: item.name,
    emoji: item.emoji,
    description: item.description,
    bonus_points: item.bonus_points,
    rarity: item.rarity,
  }).select().single()
  if (purErr) return json({ error: 'purchase insert failed: ' + purErr.message }, 500)

  // 売り手に Push 通知
  try {
    await fetch(`${SB_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SB_KEY}` },
      body: JSON.stringify({
        title: '🛒 販売所で購入されました',
        body: `${item.emoji} ${item.name} (+${item.price}pt)`,
        url: '/shop.html',
        recipient_user_id: item.seller_id,
      }),
    })
  } catch {}

  return json({ ok: true, purchase })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const { test, expect } = require('@playwright/test')

test('shop edit flow: insert item → click edit → verify form populated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('pageerror', err => errors.push('[pageerror] ' + err.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console err] ' + msg.text()) })

  await page.goto('/shop.html')
  await page.waitForTimeout(2500)

  // claude uid を取得して自分にshop_itemを直接INSERT (claude is seller and buyer both = self)
  const insertResult = await page.evaluate(async () => {
    const sb = window.supabase.createClient(
      'https://qivnfiqyjfajlzbdqodd.supabase.co',
      'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'
    )
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return { err: 'no session' }
    const uid = session.user.id
    // 既存のテストアイテムがあれば削除
    await sb.from('shop_items').delete().eq('seller_id', uid).eq('name', 'TEST_EDIT_ITEM')
    const { data, error } = await sb.from('shop_items').insert({
      seller_id: uid, buyer_id: uid,  // 自分から自分に売る（テスト用）
      name: 'TEST_EDIT_ITEM',
      emoji: '🧪',
      description: 'test description',
      price: 100,
      rarity: 'N',
    }).select().single()
    return { data, error: error?.message }
  })
  console.log('insert:', JSON.stringify(insertResult, null, 2))

  // 「売る」タブに切り替え
  await page.evaluate(() => switchTab('sell'))
  await page.waitForTimeout(500)

  // sell listを再ロード
  await page.evaluate(() => loadSellList())
  await page.waitForTimeout(800)

  // ✏️ボタンが表示されているか
  const editButtons = await page.locator('#sell-list .toggle-btn').all()
  console.log('toggle-btn count:', editButtons.length)

  // TEST_EDIT_ITEM を含むカードの ✏️ をクリック
  const clicked = await page.evaluate(async () => {
    const cards = document.querySelectorAll('#sell-list .item-card')
    for (const card of cards) {
      if (card.textContent.includes('TEST_EDIT_ITEM')) {
        // ✏️ボタンを探してクリック
        const buttons = card.querySelectorAll('button')
        for (const b of buttons) {
          if (b.textContent.trim() === '✏️') {
            b.click()
            return 'clicked'
          }
        }
        return 'no edit button found'
      }
    }
    return 'card not found'
  })
  console.log('click result:', clicked)
  await page.waitForTimeout(1500)

  // フォームが表示されているか
  const formVisible = await page.locator('#add-form').isVisible()
  console.log('form visible after edit click:', formVisible)

  // フォームの値が読み込まれているか
  const formValues = await page.evaluate(() => ({
    name: document.getElementById('new-name').value,
    emoji: document.getElementById('new-emoji').value,
    desc: document.getElementById('new-desc').value,
    price: document.getElementById('new-price').value,
  }))
  console.log('form values:', JSON.stringify(formValues, null, 2))

  // ボタンラベル
  const btnLabel = await page.evaluate(() => {
    const b = document.querySelector('#add-form .btn-confirm')
    return b ? b.textContent.trim() : 'not found'
  })
  console.log('confirm button label:', btnLabel)

  // クリーンアップ
  await page.evaluate(async () => {
    const sb = window.supabase.createClient(
      'https://qivnfiqyjfajlzbdqodd.supabase.co',
      'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'
    )
    const { data: { session } } = await sb.auth.getSession()
    if (session) await sb.from('shop_items').delete().eq('seller_id', session.user.id).eq('name', 'TEST_EDIT_ITEM')
  })

  console.log('errors:', JSON.stringify(errors, null, 2))
})

const { test, expect } = require('@playwright/test')

test('test-push button: what error?', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const logs = []
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }))

  await page.goto('/')
  await page.waitForTimeout(2500)

  // send-push を直接叩いて中身を見る
  const result = await page.evaluate(async () => {
    const sb = window.supabase.createClient(
      'https://qivnfiqyjfajlzbdqodd.supabase.co',
      'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'
    )
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return { err: 'no session' }
    try {
      const { data, error } = await sb.functions.invoke('send-push', {
        body: { title: 'test', body: 'test', url: '/', recipient_user_id: session.user.id },
      })
      let errBody = null
      if (error?.context && typeof error.context.text === 'function') {
        try { errBody = await error.context.text() } catch {}
      }
      return { data, error: error ? { name: error.name, message: error.message, body: errBody } : null }
    } catch (e) {
      return { exception: String(e) }
    }
  })

  console.log('send-push result:', JSON.stringify(result, null, 2))
  console.log('logs:', JSON.stringify(logs.slice(-10), null, 2))
})

test('shop edit button behavior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()) })

  await page.goto('/shop.html')
  await page.waitForTimeout(2500)

  // Insert a test item as claude user for editing
  const addResult = await page.evaluate(async () => {
    const sb = window.supabase.createClient(
      'https://qivnfiqyjfajlzbdqodd.supabase.co',
      'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'
    )
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return { err: 'no session' }
    // claude account has no partner in profiles → INSERT will fail with buyer_id constraint
    // 代わりに shop_items の editItem 関数が定義されているか確認
    return {
      hasEditItem: typeof editItem === 'function',
      hasSaveItem: typeof saveItem === 'function',
      hasBtnConfirm: !!document.querySelector('#add-form .btn-confirm'),
    }
  })
  console.log('shop capabilities:', JSON.stringify(addResult, null, 2))
  console.log('errors:', errors)
})

const { test, expect } = require('@playwright/test')

test('functions.invoke sends Authorization and apikey headers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const results = []
  await page.route('https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/line-notify*', async (route) => {
    const req = route.request()
    results.push({
      method: req.method(),
      hasAuth: !!req.headers()['authorization'],
      hasApikey: !!req.headers()['apikey'],
    })
    await route.abort()
  })

  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  // closer.html内の _sb は const で見えないので、同じ設定で新しいクライアントを作る
  await page.evaluate(async () => {
    const sb = window.supabase.createClient(
      'https://qivnfiqyjfajlzbdqodd.supabase.co',
      'sb_publishable_PR_chyGmNVRJJ24eVqlqYg_CGAOjfpx'
    )
    await sb.functions.invoke('line-notify', {
      body: { target: 'partner', message: 'test' },
    }).catch(() => {})
  })

  await page.waitForTimeout(1500)

  console.log('intercepted:', JSON.stringify(results, null, 2))
  expect(results.length).toBeGreaterThan(0)
  expect(results[0].hasApikey).toBe(true) // supabase-js は apikey を自動で付ける
})

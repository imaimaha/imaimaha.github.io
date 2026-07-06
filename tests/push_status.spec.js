const { test, expect } = require('@playwright/test')

test('push status badge shows on index', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/')
  await page.waitForTimeout(2500)

  const badge = page.locator('#push-status-badge')
  await expect(badge).toBeVisible()
  const text = await badge.textContent()
  console.log('push badge:', text)
  expect(text.length).toBeGreaterThan(0)

  await page.screenshot({ path: 'tests/screenshots/push-badge.png', fullPage: true })

  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])
})

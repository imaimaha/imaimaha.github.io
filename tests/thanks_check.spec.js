const { test, expect } = require('@playwright/test')

test('thanks page loads without errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))

  await page.goto('/thanks.html')
  await page.waitForTimeout(2500)

  await expect(page.locator('#send-btn')).toBeVisible()
  await expect(page.locator('#user-menu-btn')).toBeVisible()
  await page.screenshot({ path: 'tests/screenshots/thanks.png', fullPage: true })

  if (errors.length > 0) console.log('⚠️ errors:', errors)
  expect(errors).toEqual([])
})

const { test, expect } = require('@playwright/test')

const PAGES = ['/', '/status.html', '/closer.html', '/quiz.html', '/gacha.html', '/memories.html', '/calendar.html', '/wishlist.html', '/bingo.html', '/time_capsule.html', '/points.html']

for (const path of PAGES) {
  test(`header emoji button on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
      }
    })
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(path)
    await page.waitForTimeout(2500)

    // 絵文字ボタンが右上に配置されている
    const btn = await page.locator('#user-menu-btn')
    await expect(btn).toBeVisible()

    // ログアウトボタンや旧user-badgeは残っていない
    const oldLogout = await page.locator('button.logout-btn').count()
    expect(oldLogout).toBe(0)

    // 絵文字1文字が表示されている (emoji)
    const text = (await btn.textContent()).trim()
    expect(text.length).toBeGreaterThan(0)
    expect(text.length).toBeLessThan(8) // 絵文字は数バイトだけど文字数少ないはず

    if (errors.length > 0) console.log(`⚠️ ${path} errors:`, errors)
  })
}

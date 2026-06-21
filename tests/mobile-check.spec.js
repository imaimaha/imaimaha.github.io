const { test, expect } = require('@playwright/test')

const PAGES = [
  { path: '/',             name: 'index' },
  { path: '/status.html',  name: 'status' },
  { path: '/wishlist.html',name: 'wishlist' },
  { path: '/closer.html',  name: 'closer' },
  { path: '/calendar.html',name: 'calendar' },
  { path: '/memories.html',name: 'memories' },
]

const MOBILE = { width: 390, height: 844 } // iPhone 14

for (const { path, name } of PAGES) {
  test(`mobile screenshot: ${name}`, async ({ page }) => {
    await page.setViewportSize(MOBILE)

    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!t.includes('403') && !t.includes('406') && !t.includes('401')) errors.push(t)
      }
    })
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(path)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `tests/screenshots/mobile-${name}.png`, fullPage: true })

    if (errors.length > 0) console.log(`⚠️ JS errors (${name}):`, errors)
    else console.log(`✅ no errors: ${name}`)
  })
}

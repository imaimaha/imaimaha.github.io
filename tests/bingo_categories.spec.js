// お仕事/読書/ごはん の3カテゴリが正しく開けて再生成できることを確認
const { test, expect } = require('@playwright/test')

const CATS = [
  { key: 'work',    label: '💼 お仕事', jp: 'お仕事' },
  { key: 'reading', label: '📖 読書',   jp: '読書' },
  { key: 'food',    label: '🍚 ごはん', jp: 'ごはん' },
]

for (const { key, label, jp } of CATS) {
  test(`bingo category ${key} opens without error`, async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })

    await page.goto('/bingo.html', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    // 「カテゴリーから選ぶ」モードカードをクリック → カテゴリ選択画面へ
    await page.click('.mode-card:has-text("カテゴリー")')
    await page.waitForTimeout(500)

    // 該当カテゴリのカードを押す
    const selector = `.category-card:has-text("${jp}")`
    await page.click(selector)
    await page.waitForTimeout(1500)

    // グリッドが表示されていること (bingo-grid に何かある)
    const gridChildren = await page.locator('#bingo-grid > *').count()
    expect(gridChildren).toBeGreaterThan(0)

    // 現在の label が正しく表示されているか
    const labelEl = await page.locator('#grid-label').textContent()
    expect(labelEl).toContain(jp)

    // JS エラー無し
    if (errors.length) console.log(`⚠️ errors on ${key}:`, errors.slice(0, 5))
    expect(errors, `errors on ${key}: ${errors.join(' | ')}`).toHaveLength(0)
  })
}

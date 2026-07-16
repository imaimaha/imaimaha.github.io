// util.js 移行 + クイズ増量後のスモークテスト
// 各ページをロードし、コンソールエラー/pageerror が出ないこと、
// util.js の関数がグローバルに存在することを確認する
const { test, expect } = require('@playwright/test')

const PAGES = [
  'index', 'quiz', 'closer', 'thanks', 'calendar', 'color_hunting',
  'bingo', 'location', 'status', 'expenses', 'gacha', 'shop',
  'time_capsule', 'bets', 'notifications', 'wishlist', 'points', 'one_on_one',
]

for (const p of PAGES) {
  test(`${p}.html: エラーなくロード & util.js 関数が存在`, async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push('pageerror: ' + e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })

    await page.goto(`/${p}.html`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)

    // util.js のグローバル関数が使える状態か
    const fns = await page.evaluate(() => ({
      notify: typeof notify,
      addPoints: typeof addPoints,
      escHtml: typeof escHtml,
      jstDateStr: typeof jstDateStr,
    }))
    expect(fns.notify, `${p}: notify`).toBe('function')
    expect(fns.addPoints, `${p}: addPoints`).toBe('function')
    expect(fns.escHtml, `${p}: escHtml`).toBe('function')

    // Supabase 401 等のネットワークエラーは除外し、JS 実行エラーだけ拾う
    const jsErrors = errors.filter(e =>
      !/Failed to load resource|401|403|net::|status of 4|status of 5/.test(e))
    expect(jsErrors, `${p} JS errors:\n${jsErrors.join('\n')}`).toEqual([])
  })
}

test('quiz: 278問ロード & escHtml が単一引用符もエスケープ', async ({ page }) => {
  await page.goto('/quiz.html', { waitUntil: 'networkidle' })
  const res = await page.evaluate(() => ({
    count: typeof QUESTIONS !== 'undefined' ? QUESTIONS.length : -1,
    escaped: escHtml(`<a href='x'>&"</a>`),
  }))
  expect(res.count).toBe(278)
  expect(res.escaped).toBe('&lt;a href=&#39;x&#39;&gt;&amp;&quot;&lt;/a&gt;')
})

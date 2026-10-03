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

test('quiz: 683問ロード & escHtml が単一引用符もエスケープ', async ({ page }) => {
  await page.goto('/quiz.html', { waitUntil: 'networkidle' })
  const res = await page.evaluate(() => ({
    count: typeof QUESTIONS !== 'undefined' ? QUESTIONS.length : -1,
    escaped: escHtml(`<a href='x'>&"</a>`),
  }))
  expect(res.count).toBe(683)
  expect(res.escaped).toBe('&lt;a href=&#39;x&#39;&gt;&amp;&quot;&lt;/a&gt;')
})

test('quiz: 2026-10-04 以降は全問1周するまで重複しない / id 重複なし / 過去出題済みは後回し', async ({ page }) => {
  await page.goto('/quiz.html', { waitUntil: 'networkidle' })
  const res = await page.evaluate(() => {
    const ids = QUESTIONS.map(q => q.id)
    const start = Date.UTC(2026, 9, 4)
    const seen = new Set(); let dup = 0; let legacyEarly = 0
    const fresh = QUESTIONS.length - LEGACY_USED_IDS.size
    for (let i = 0; i < QUESTIONS.length; i++) {
      const d = new Date(start + i * 86400000).toISOString().slice(0, 10)
      const q = getDailyQuestion(d)
      if (seen.has(q.id)) dup++
      seen.add(q.id)
      if (i < fresh && LEGACY_USED_IDS.has(q.id)) legacyEarly++
    }
    return { uniqueIds: new Set(ids).size, total: ids.length, dup, legacyEarly, covered: seen.size, fresh }
  })
  expect(res.uniqueIds).toBe(res.total)
  expect(res.dup).toBe(0)
  expect(res.legacyEarly).toBe(0)
  expect(res.covered).toBe(res.total)
})

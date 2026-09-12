// 今ここ: いまどこ / ふたりの距離 / 記録 / 街コレクション が実データで描画されること
// 読み取りのみ。チェックインはしない (実データを増やさない)
const { test, expect } = require('@playwright/test')

test('今ここ: 概要カードが実データで出る', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (!t.includes('403') && !t.includes('406') && !t.includes('401') && !t.includes('404')) errors.push(t)
  })

  await page.goto('/location.html')
  await page.waitForFunction(() => typeof allCheckins !== 'undefined' && allCheckins.length > 0, { timeout: 20000 })
  await page.waitForTimeout(800)

  // いま どこ？ (ふたりぶん) と 距離
  await expect(page.locator('#now-card')).toBeVisible()
  expect(await page.locator('.now-person').count()).toBeGreaterThanOrEqual(1)

  // 記録
  await expect(page.locator('#stats-card')).toBeVisible()
  expect(await page.locator('#stats-card .stat-box').count()).toBe(3)
  expect(await page.locator('#top-places .top-place').count()).toBeGreaterThan(0)

  // 街コレクション
  await expect(page.locator('#collection-card')).toBeVisible()
  const chips = await page.locator('.coll-chip').count()
  expect(chips).toBeGreaterThan(3)

  // 拠点は「おうち」「会社」として色分けされる
  expect(await page.locator('.coll-chip.home, .coll-chip.office').count()).toBeGreaterThan(0)

  // チップをタップすると地図が動く
  const before = await page.evaluate(() => map.getCenter())
  await page.locator('.coll-chip').last().click()
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => map.getCenter())
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before))

  await page.screenshot({ path: 'tests/screenshots/0802-location.png', fullPage: true })
  expect(errors).toEqual([])
})

test('placeLabelFor: 自分の家は「おうち」/ 相手の家は名前つき / 会社は会社', async ({ page }) => {
  // 町名はテストに書かない (公開リポジトリ)。DB から読み込まれた BASES を使う
  await page.goto('/location.html')
  await page.waitForFunction(() => typeof BASES !== 'undefined' && Object.keys(BASES).length > 0, { timeout: 20000 })
  const r = await page.evaluate(() => {
    const towns = Object.keys(BASES)
    const home   = towns.find(t => BASES[t].kind === 'home' && BASES[t].owner)
    const office = towns.find(t => BASES[t].kind === 'office')
    const owner  = BASES[home].owner
    const other  = owner === 'nick' ? 'hedgehog' : 'nick'
    return {
      owner,
      ownHome:     placeLabelFor(home, owner),
      partnerHome: placeLabelFor(home, other),
      office:      placeLabelFor(office, owner),
      outside:     placeLabelFor('存在しない町テスト', owner),
    }
  })
  expect(r.ownHome.text).toBe('おうち')
  expect(r.partnerHome.text).toContain(r.owner)
  expect(r.office.text).toBe('会社')
  expect(r.outside.out).toBe(true)
})

test('今ここ: 月のふりかえりが月送りできて地図にまとめて出せる', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/location.html')
  await page.waitForFunction(() => typeof allCheckins !== 'undefined' && allCheckins.length > 0, { timeout: 20000 })
  await page.waitForTimeout(800)

  await expect(page.locator('#month-card')).toBeVisible()
  const thisMonth = await page.locator('#month-label').textContent()
  expect(thisMonth).toMatch(/\d+年 \d+月のふりかえり/)
  // 今月より先には進めない
  await expect(page.locator('#month-next')).toBeDisabled()

  // 前の月へ (データがある 7月)
  await page.evaluate(() => changeMonth(-1))
  await page.waitForTimeout(300)
  expect(await page.locator('#month-label').textContent()).not.toBe(thisMonth)
  expect(await page.locator('#month-top .top-place').count()).toBeGreaterThan(0)
  await expect(page.locator('#month-next')).toBeEnabled()

  // 地図にまとめて表示
  await page.evaluate(() => showMonthOnMap())
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => markers.length)).toBeGreaterThan(3)

  await page.screenshot({ path: 'tests/screenshots/0802-location-month.png', fullPage: true })
  expect(errors).toEqual([])
})

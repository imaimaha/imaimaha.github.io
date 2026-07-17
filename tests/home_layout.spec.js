const { test, expect } = require('@playwright/test')

test('home layout: 上部順序 + 均一グリッド', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // スクショ
  await page.screenshot({ path: 'tests/screenshots/home-after.png', fullPage: true })

  // 上から: 記念日バッジ → 今ここボタン → 今日の帰宅カード → 今のきもち の順で y 座標が増える
  const y = async (sel) => {
    const box = await page.locator(sel).first().boundingBox()
    return box ? box.y : Infinity
  }
  const anniv = await y('#anniversary-badge')
  const loc   = await y('#loc-top-btn')
  const status = await y('.home-daily-card')
  const mood  = await y('#mood-tile')
  const bento = await y('.home-bento')

  console.log('y座標:', { anniv, loc, status, mood, bento })
  expect(loc).toBeGreaterThan(anniv)
  expect(status).toBeGreaterThan(loc)
  expect(mood).toBeGreaterThan(status)
  expect(bento).toBeGreaterThan(mood)

  // グリッド内タイルが全て同じ幅（均一）であること
  const widths = await page.locator('.home-bento > .tile').evaluateAll(els =>
    els.map(e => Math.round(e.getBoundingClientRect().width)))
  console.log('グリッドタイル幅:', [...new Set(widths)])
  // 2列なので幅は1種類（フル幅の混入がない）
  expect(new Set(widths).size).toBe(1)

  expect(errors.filter(e => !/401|403|net::/.test(e))).toEqual([])
})

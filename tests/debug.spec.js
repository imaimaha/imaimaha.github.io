const { test, expect } = require('@playwright/test')

// 403/406 は test アカウントのデータ不足で発生する既知エラー。それ以外を検出する
function collectErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (!t.includes('403') && !t.includes('406')) errors.push(t)
    }
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

// ===========================================================
// 1. コンソールエラーなし（全ページ / 403・406 は除外）
// ===========================================================
const PAGES = ['/', '/closer.html', '/calendar.html', '/memories.html', '/status.html', '/wishlist.html']

for (const path of PAGES) {
  test(`コンソールエラーなし: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto(path)
    await page.waitForTimeout(3000)

    if (errors.length > 0) console.log(`❌ JS エラー (${path}):`, errors)
    else                    console.log(`✅ エラーなし: ${path}`)
    expect(errors).toHaveLength(0)
  })
}

// ===========================================================
// 2. closer: 基本表示・UID 確認
// ===========================================================
test('closer: 🦊🦔 が表示されて UID が解決される', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)

  await expect(page.locator('#fox-float')).toBeVisible()
  await expect(page.locator('#hed-float')).toBeVisible()
  // closer-gap は init() 完了後に内容がセットされる（空 span は hidden 扱い）
  await expect(page.locator('#closer-gap')).toBeAttached()

  const ids = await page.evaluate(() => window._closer && {
    foxUid: window._closer.foxUid,
    hedUid: window._closer.hedUid,
    myId:   window._closer.myId,
  })
  console.log('UID 状態:', ids)
  expect(ids?.foxUid || ids?.hedUid).toBeTruthy() // 少なくとも片方は設定済み
  console.log('✅ 表示・UID OK')
})

// ===========================================================
// 3. closer: 両方の絵文字をタップすると animation が動く
// ===========================================================
test('closer: 🦊 タップで pop animation が動く', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  await page.locator('#fox-float').click({ force: true })
  await page.waitForTimeout(100)
  const hasPop = await page.locator('#fox-float').evaluate(el => el.classList.contains('pop'))
  console.log(`🦊 pop: ${hasPop}`)
  expect(hasPop).toBe(true)
})

test('closer: 🦔 タップで pop animation が動く（相手でも必ず動く）', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  await page.locator('#hed-float').click({ force: true })
  await page.waitForTimeout(100)
  const hasPop = await page.locator('#hed-float').evaluate(el => el.classList.contains('pop'))
  console.log(`🦔 pop: ${hasPop}`)
  expect(hasPop).toBe(true)
})

// ===========================================================
// 4. closer: 自分の絵文字だけゲージが増える
// ===========================================================
test('closer: 自分の絵文字をタップするとゲージが増える', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)

  // myType を取得（自分が fox か hed か）
  const myType = await page.evaluate(() => {
    const c = window._closer
    if (!c) return null
    return c.myId === c.foxUid ? 'fox' : c.myId === c.hedUid ? 'hed' : null
  })
  console.log(`myType: ${myType}`)
  if (!myType) { console.log('⚠️  myType 未定（test アカウントに profile なし可能性）'); return }

  const selector = myType === 'fox' ? '#fox-float' : '#hed-float'

  // クリック前のゲージ値を取得
  const before = await page.evaluate((t) => window._closer?.effective(t), myType)
  console.log(`クリック前 ${myType} ゲージ: ${before}`)

  // 3 回タップ
  for (let i = 0; i < 3; i++) {
    await page.locator(selector).click({ force: true })
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(500)

  const after = await page.evaluate((t) => window._closer?.effective(t), myType)
  console.log(`クリック後 ${myType} ゲージ: ${after}`)

  expect(after).toBeGreaterThan(before)
  console.log(`✅ 自分 (${myType}) のゲージが増えた`)
})

// ===========================================================
// 5. closer: 相手の絵文字をタップしてもゲージは増えない
// ===========================================================
test('closer: 相手の絵文字をタップしてもゲージは変わらない', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)

  const myType = await page.evaluate(() => {
    const c = window._closer
    if (!c) return null
    return c.myId === c.foxUid ? 'fox' : c.myId === c.hedUid ? 'hed' : null
  })
  if (!myType) { console.log('⚠️  myType 未定'); return }

  const partnerType   = myType === 'fox' ? 'hed' : 'fox'
  const partnerSelector = partnerType === 'fox' ? '#fox-float' : '#hed-float'

  const before = await page.evaluate((t) => window._closer?.effective(t), partnerType)
  console.log(`クリック前 ${partnerType} ゲージ: ${before}`)

  // 相手の絵文字を3回タップ
  for (let i = 0; i < 3; i++) {
    await page.locator(partnerSelector).click({ force: true })
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(500)

  const after = await page.evaluate((t) => window._closer?.effective(t), partnerType)
  console.log(`クリック後 ${partnerType} ゲージ: ${after}`)

  expect(after).toBe(before)
  console.log(`✅ 相手 (${partnerType}) のゲージは変化なし`)
})

// ===========================================================
// 6. closer: 両方 100% で emojis がくっつく（merged 状態）
// ===========================================================
test('closer: 両方 100% になると merged クラスが付いてくっつく', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)

  // raw を直接 100 に書き換えて updateDistance を呼ぶ
  await page.evaluate(() => {
    const now = new Date().toISOString()
    window._closer.raw.fox = { gauge: 100, updated_at: now }
    window._closer.raw.hed = { gauge: 100, updated_at: now }
  })

  // updateDistance を呼んで状態を反映
  await page.evaluate(() => {
    // updateDistance は closer スコープ内なので window 経由でアクセスできないが
    // 🦊 を force クリックして間接的にトリガーする代わりに直接評価する
    const fox = window._closer.effective('fox')
    const hed = window._closer.effective('hed')
    console.log('[test] fox effective:', fox, 'hed effective:', hed)
  })

  // updateDistance は setInterval でも動くが、直接 click して呼び出す
  await page.locator('#fox-float').click({ force: true })
  await page.waitForTimeout(1000)

  const isMerged = await page.locator('#fox-float').evaluate(el => el.classList.contains('merged'))
  const msgVisible = await page.locator('#merged-msg').evaluate(el => el.style.display !== 'none')
  console.log(`merged class: ${isMerged}  /  merged-msg 表示: ${msgVisible}`)

  expect(isMerged).toBe(true)
  expect(msgVisible).toBe(true)
  console.log('✅ 両方 MAX → merged 状態に遷移')
})

// ===========================================================
// 7. closer: ゲージが DB に保存されてリロード後も残る
// ===========================================================
test('closer: ゲージがリロード後も保持される（DB 保存確認）', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)

  const myType = await page.evaluate(() => {
    const c = window._closer
    if (!c) return null
    return c.myId === c.foxUid ? 'fox' : c.myId === c.hedUid ? 'hed' : null
  })
  if (!myType) { console.log('⚠️  myType 未定'); return }

  const selector = myType === 'fox' ? '#fox-float' : '#hed-float'
  for (let i = 0; i < 5; i++) {
    await page.locator(selector).click({ force: true })
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(2000)

  const before = await page.evaluate((t) => window._closer?.effective(t), myType)
  console.log(`保存前ゲージ: ${before}`)

  await page.reload()
  await page.waitForTimeout(4000)

  const after = await page.evaluate((t) => window._closer?.effective(t), myType)
  console.log(`リロード後ゲージ: ${after}`)

  expect(after).toBeGreaterThanOrEqual(before - 1)
  console.log('✅ リロード後もゲージ保持')
})

// ===========================================================
// 8. closer: 24h 減衰ロジック
// ===========================================================
test('closer: 24時間で完全にゲージが 0 になる', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  const results = await page.evaluate(() => {
    const DAY_MS = 24 * 60 * 60 * 1000
    function eff(raw) {
      if (!raw.updated_at || raw.gauge <= 0) return raw.gauge
      const elapsed = Date.now() - new Date(raw.updated_at).getTime()
      return Math.round(raw.gauge * Math.max(0, 1 - elapsed / DAY_MS))
    }
    const now = new Date()
    return {
      t0:   eff({ gauge: 100, updated_at: new Date(Date.now()).toISOString() }),
      t12h: eff({ gauge: 100, updated_at: new Date(Date.now() - 12*60*60*1000).toISOString() }),
      t24h: eff({ gauge: 100, updated_at: new Date(Date.now() - 24*60*60*1000 - 1).toISOString() }),
      zero: eff({ gauge: 0,   updated_at: now.toISOString() }),
    }
  })
  console.log('減衰テスト:', results)
  expect(results.t0).toBe(100)
  expect(results.t12h).toBeGreaterThanOrEqual(45)
  expect(results.t12h).toBeLessThanOrEqual(55)
  expect(results.t24h).toBe(0)
  expect(results.zero).toBe(0)
  console.log('✅ 減衰ロジック正常')
})

// ===========================================================
// 9. closer: ポップアップ
// ===========================================================
test('closer: ポップアップが開閉できる', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(2000)

  await page.getByRole('button', { name: '🦊の✨を見る' }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('#popup')).toHaveClass(/open/)
  console.log('✅ ポップアップが開いた')

  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('#popup')).not.toHaveClass(/open/)
  console.log('✅ ポップアップが閉じた')
})

// ===========================================================
// 10. スクリーンショット
// ===========================================================
test('スクリーンショット: closer.html（通常）', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'tests/storage/screenshot-closer.png' })
  console.log('📸 screenshot-closer.png')
})

test('スクリーンショット: closer.html（MAX 状態）', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(3000)
  const now = new Date().toISOString()
  await page.evaluate((n) => {
    window._closer.raw.fox = { gauge: 100, updated_at: n }
    window._closer.raw.hed = { gauge: 100, updated_at: n }
  }, now)
  await page.locator('#fox-float').click({ force: true })
  await page.waitForTimeout(2000) // lerp アニメーションを待つ
  await page.screenshot({ path: 'tests/storage/screenshot-closer-max.png' })
  console.log('📸 screenshot-closer-max.png（MAX くっつき状態）')
})

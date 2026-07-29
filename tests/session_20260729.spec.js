// 2026-07-29 セッションの変更点スモーク
// ビンゴのつづきから / 帰宅メモのはみ出し / 日記スタンプ / ホーム導線 / カレンダーの予定対象者
// 注意: 実データ(実ユーザーの日記・デート・予定)を触らないよう、書き込みを伴う操作はしない
const { test, expect } = require('@playwright/test')

function watchErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    if (t.includes('403') || t.includes('406') || t.includes('401') || t.includes('404')) return
    errors.push(t)
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

test('bingo: リロード後もカテゴリを選ぶと前回のカードが続く / つづからカードは無い', async ({ page }) => {
  const errors = watchErrors(page)

  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('reading'))
  await page.waitForTimeout(2500)

  await expect(page.locator('#screen-grid')).toHaveClass(/active/)
  const first = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(first.length).toBeGreaterThan(0)

  // リロード後はモード選択から始まる（自動復帰も「つづきから」カードも無い）
  await page.reload()
  await page.waitForTimeout(2500)
  await expect(page.locator('#screen-mode')).toHaveClass(/active/)
  expect(await page.locator('#resume-card').count()).toBe(0)

  // 同じカテゴリを選ぶと前回のカードが返る
  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('reading'))
  await page.waitForTimeout(2500)
  const second = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(second).toEqual(first)
  await page.screenshot({ path: 'tests/screenshots/0729-bingo-category-continue.png', fullPage: true })

  expect(errors).toEqual([])
})

test('bingo: 3×3 で作ったカードは再訪(既定5×5)でも捨てられない', async ({ page }) => {
  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  await page.evaluate(() => { setGridSize(3, true); showScreen('category') })
  await page.evaluate(() => selectCategory('food'))
  await page.waitForTimeout(2500)
  const first = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(first.length).toBe(9)

  // 同じカテゴリを、サイズを触らずに選び直す (リロードで state.gridSize は既定の5に戻っている)
  await page.reload()
  await page.waitForTimeout(2000)
  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('food'))
  await page.waitForTimeout(2500)

  const second = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(second).toEqual(first)   // 3×3 のカードがそのまま返る
})

test('status: メモ欄がカードからはみ出さない / 300字まで', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/status.html')
  await page.waitForTimeout(2500)

  // テストアカウントは profiles に行が無く「自分のカード」が出ないので、
  // makeCard で自分のカードを描いてレイアウトを計測する
  await page.evaluate(() => {
    const card = makeCard({ id: 'test', emoji: '🦊', name: 'テスト' }, { finish_time: '19:00', note: '' }, true)
    card.classList.add('mine')
    document.getElementById('status-cards').appendChild(card)
  })
  await page.waitForTimeout(200)

  await page.locator('.edit-btn').last().click()
  await page.waitForTimeout(400)

  const note = page.locator('#input-note')
  await expect(note).toBeVisible()
  expect(await note.getAttribute('maxlength')).toBe('300')

  const card = await page.locator('.status-card.mine').boundingBox()
  const box = await note.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(card.x - 1)
  expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 1)

  // 画面幅も超えない
  const vw = page.viewportSize().width
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1)

  await note.fill('長めのメモを入れてみる。'.repeat(6))
  await page.waitForTimeout(200)
  await expect(page.locator('#note-count')).toContainText('/ 300')
  const box2 = await note.boundingBox()
  expect(box2.x + box2.width).toBeLessThanOrEqual(vw + 1)
  await page.screenshot({ path: 'tests/screenshots/0729-status-note.png', fullPage: true })

  // 保存はしない (実データを汚さない)
  expect(errors).toEqual([])
})

test('diary: 相手の日記にスタンプ導線が出る (押さない)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/diary.html')
  // init() の profiles + entries + reactions 取得が終わるまで待つ
  await page.waitForFunction(() => typeof entries !== 'undefined' && entries.length > 0, { timeout: 15000 })
  await page.waitForTimeout(800)

  const hasPartnerEntry = await page.evaluate(() =>
    entries.some(e => e.user_id !== myId))
  if (hasPartnerEntry) {
    await expect(page.locator('.rx-add, .rx-chip.sel').first()).toBeVisible()
    // ピッカーの開閉だけ確認 (setReaction は呼ばない)
    const entryId = await page.evaluate(() => entries.find(e => e.user_id !== myId).id)
    await page.evaluate(id => toggleRxPicker(id), entryId)
    await page.waitForTimeout(200)
    await expect(page.locator(`#rx-picker-${entryId}`)).toBeVisible()
    expect(await page.locator(`#rx-picker-${entryId} .rx-chip`).count()).toBe(10)
  }
  await page.screenshot({ path: 'tests/screenshots/0729-diary-stamps.png', fullPage: true })
  expect(errors).toEqual([])
})

test('home: 今ここの地図導線 + 当日デートカードでJSエラーが出ない', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/index.html')
  await page.waitForTimeout(3500)

  const map = page.locator('.hero-map-link')
  await expect(map).toBeVisible()
  expect(await map.getAttribute('href')).toBe('/location.html')

  // 当日デートがある日だけ出るカード。出ている場合は href が詳細へのディープリンク
  const card = page.locator('#today-date-card')
  if (await card.isVisible()) {
    expect(await card.getAttribute('href')).toMatch(/\/dates\.html\?date=/)
  }
  await page.screenshot({ path: 'tests/screenshots/0729-home.png', fullPage: true })
  expect(errors).toEqual([])
})

test('calendar: 予定の対象者チップが出る / 既存の予定はふたりの予定', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/calendar.html')
  await page.waitForTimeout(3000)

  // owner_id は「NULL=ふたり」か「実在するプロフィールのid」のどちらかであること
  // (実データを assert しない: ユーザーが個人の予定を登録していても通る)
  const bad = await page.evaluate(() =>
    events.filter(e => e.owner_id && !profById[e.owner_id]).map(e => e.title))
  expect(bad).toEqual([])

  await page.evaluate(() => openModal('2030-01-01'))
  await page.waitForTimeout(400)
  const chips = page.locator('#owner-chips .owner-chip')
  expect(await chips.count()).toBeGreaterThanOrEqual(3)
  await expect(chips.first()).toHaveClass(/sel/)          // 既定は「ふたり」
  await expect(chips.first()).toContainText('ふたり')

  // 個人のみを選べる (保存はしない)
  await chips.nth(1).click()
  await page.waitForTimeout(200)
  await expect(chips.nth(1)).toHaveClass(/sel/)
  await page.screenshot({ path: 'tests/screenshots/0729-calendar-owner.png', fullPage: true })

  await page.evaluate(() => closeModal())
  expect(errors).toEqual([])
})

test('dates: 詳細にカレンダー登録ボタンがある (押さない)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/dates.html')
  await page.waitForTimeout(3000)

  const hasDate = await page.evaluate(() => Array.isArray(dates) && dates.length > 0)
  if (hasDate) {
    const id = await page.evaluate(() => dates[0].id)
    await page.evaluate(i => openDetail(i), id)
    await page.waitForTimeout(2500)
    await expect(page.locator('#cal-add-btn')).toBeVisible()
    await page.screenshot({ path: 'tests/screenshots/0729-dates-calbtn.png', fullPage: true })
  }
  expect(errors).toEqual([])
})

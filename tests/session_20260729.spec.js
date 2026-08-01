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

test('bingo: カテゴリを選び直すと前回のカードが続く / つづきからカードは無い', async ({ page }) => {
  const errors = watchErrors(page)

  await page.goto('/bingo.html')
  await page.waitForTimeout(2500)
  await page.evaluate(() => showScreen('mode'))   // 初期表示は「最後に触ったカード」

  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('reading'))
  await page.waitForTimeout(2500)

  await expect(page.locator('#screen-grid')).toHaveClass(/active/)
  const first = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(first.length).toBeGreaterThan(0)

  // リロード後、モード選択に戻して同じカテゴリを選ぶと前回のカードが返る
  await page.reload()
  await page.waitForTimeout(3000)
  expect(await page.locator('#resume-card').count()).toBe(0)   // 「つづきから」ボタンUIは足さない方針
  await page.evaluate(() => showScreen('mode'))
  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('reading'))
  await page.waitForTimeout(2500)
  const second = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(second).toEqual(first)
  await page.screenshot({ path: 'tests/screenshots/0729-bingo-category-continue.png', fullPage: true })

  expect(errors).toEqual([])
})

// カードの identity は「カテゴリ + サイズ」。同じサイズのカードが無い時だけ直近サイズに追従する
test('bingo: そのサイズのカードが無ければ直近サイズのカードに追従する', async ({ page }) => {
  await page.goto('/bingo.html')
  await page.waitForTimeout(2000)

  // 沖縄はこのアカウントで未プレイ (他サイズの行が無い) なので追従の検証に使える
  await page.evaluate(() => { setGridSize(3, true); showScreen('category') })
  await page.evaluate(() => selectCategory('okinawa'))
  await page.waitForTimeout(2500)
  const first = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(first.length).toBe(9)

  // サイズを触らずに選び直す (リロードで state.gridSize は既定の5に戻っている)
  await page.reload()
  await page.waitForTimeout(2000)
  await page.evaluate(() => showScreen('category'))
  await page.evaluate(() => selectCategory('okinawa'))
  await page.waitForTimeout(2500)

  const second = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(second).toEqual(first)   // 3×3 のカードがそのまま返る (捨てて新規生成しない)
  expect(await page.evaluate(() => state.gridSize)).toBe(3)
})

test('bingo: カテゴリは「最後に触ったカード」を返す (created_at順ではない)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/bingo.html')
  await page.waitForTimeout(2500)

  // 同じカテゴリ・同じサイズの行が複数あるとき、updated_at が最新のものが期待値
  const expected = await page.evaluate(async () => {
    const { data } = await _sb.from('bingo_sessions').select('*')
      .eq('user_id', state.userId).eq('mode', 'category').eq('label', '🍚 ごはん')
      .order('updated_at', { ascending: false, nullsFirst: false }).limit(20)
    const rows = (data || []).filter(r => Array.isArray(r.items) && r.items.length)
    const m = rows.find(r => Math.round(Math.sqrt(r.items.length)) === 5)
    return { rowCount: rows.length, items: m ? m.items.map(i => i.text) : null }
  })
  test.skip(!expected.items, '5×5 のごはんカードがまだ無い環境ではスキップ')

  await page.evaluate(() => { setGridSize(5, true); showScreen('category') })
  await page.evaluate(() => selectCategory('food'))
  await page.waitForTimeout(2500)

  const shown = await page.$$eval('#bingo-grid .bingo-cell .cell-text', els => els.map(e => e.textContent))
  expect(shown).toEqual(expected.items)
  expect(errors).toEqual([])
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

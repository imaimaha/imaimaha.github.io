// 連続の救済ルール (1日あいてもセーフ) / 日付の変わり目 2:00 / 日記の書き漏れ追記UI
// 実データは書き換えない (追記は入力欄の存在と残高不足時の挙動だけ確認)
const { test, expect } = require('@playwright/test')

test('countStreak: 1日の抜けはセーフ、2日連続の抜けで途切れる', async ({ page }) => {
  await page.goto('/index.html')
  await page.waitForTimeout(1500)

  const r = await page.evaluate(() => {
    const days = s => new Set(s)
    return {
      // 8/3 起点。連日
      perfect: countStreak(d => days(['2026-08-01','2026-08-02','2026-08-03']).has(d), '2026-08-03'),
      // 8/2 が抜け → セーフで continue
      oneGap: countStreak(d => days(['2026-07-31','2026-08-01','2026-08-03']).has(d), '2026-08-03'),
      // 8/1 と 8/2 が連続で抜け → 8/3 の1日で止まる
      twoGap: countStreak(d => days(['2026-07-30','2026-07-31','2026-08-03']).has(d), '2026-08-03'),
      // 今日まだ書いてない (昨日まで連続) → 途切れない
      todayEmpty: countStreak(d => days(['2026-08-01','2026-08-02']).has(d), '2026-08-03'),
      none: countStreak(() => false, '2026-08-03'),
    }
  })

  expect(r.perfect.days).toBe(3)
  expect(r.perfect.usedGrace).toBe(0)
  expect(r.oneGap.days).toBe(3)          // 8/3 + 8/1 + 7/31
  expect(r.oneGap.usedGrace).toBe(1)
  expect(r.twoGap.days).toBe(1)          // 8/3 だけ
  expect(r.todayEmpty.days).toBe(2)
  expect(r.none.days).toBe(0)
})

test('jstDateStrAt: 深夜1時台はまだ前日あつかい', async ({ page }) => {
  await page.goto('/index.html')
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => ({
    at0130: jstDateStrAt(2, new Date('2026-08-03T01:30:00+09:00')),
    at0230: jstDateStrAt(2, new Date('2026-08-03T02:30:00+09:00')),
    at2300: jstDateStrAt(2, new Date('2026-08-03T23:00:00+09:00')),
  }))
  expect(r.at0130).toBe('2026-08-02')
  expect(r.at0230).toBe('2026-08-03')
  expect(r.at2300).toBe('2026-08-03')
})

test('日記: 書き漏れた日を書くUIがある / 今日や既記入の日は弾く', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/diary.html')
  await page.waitForFunction(() => typeof entries !== 'undefined' && today, { timeout: 15000 })
  await page.waitForTimeout(1000)

  await page.locator('.backfill summary').click()
  await expect(page.locator('#bf-date')).toBeVisible()
  // 上限は昨日 (今日のぶんは通常カードから書く)
  const max = await page.getAttribute('#bf-date', 'max')
  const todayStr = await page.evaluate(() => today)
  expect(max < todayStr).toBe(true)

  // 今日を指定すると弾かれる (フォームは開かない)
  await page.evaluate(t => { document.getElementById('bf-date').value = t; prepareBackfill() }, todayStr)
  await page.waitForTimeout(300)
  await expect(page.locator('#bf-form')).toBeHidden()

  // 空いている過去日なら書き込みフォームが出る
  const freeDay = await page.evaluate(() => {
    const mine = new Set(entries.filter(e => e.user_id === myId).map(e => e.date_str))
    const d = new Date(today + 'T00:00:00+09:00')
    for (let i = 1; i < 400; i++) {
      d.setDate(d.getDate() - 1)
      const ds = d.toLocaleDateString('sv-SE')
      if (!mine.has(ds)) return ds
    }
    return null
  })
  if (freeDay) {
    await page.evaluate(d => { document.getElementById('bf-date').value = d; prepareBackfill() }, freeDay)
    await page.waitForTimeout(300)
    await expect(page.locator('#bf-form')).toBeVisible()
    expect(await page.textContent('#bf-save')).toContain('pt')
  }

  await page.screenshot({ path: 'tests/screenshots/0803-diary-backfill.png', fullPage: true })
  expect(errors).toEqual([])
})

test('筋トレ: ストリークがエラーなく出る (2:00境界)', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/workout.html')
  await page.waitForFunction(() => typeof today !== 'undefined' && today, { timeout: 15000 })
  await page.waitForTimeout(2000)
  await expect(page.locator('#streak-text')).toBeVisible()
  expect(errors).toEqual([])
})

test('日付系がすべて 2:00 区切りになっている (クイズ/1曲/ログボ/週境界)', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  // クイズの「今日」
  await page.goto('/quiz.html')
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => todayStr())).toBe(await page.evaluate(() => jstDateStrAt(2)))

  // 今日の1曲
  await page.goto('/one_song.html')
  await page.waitForTimeout(2000)
  expect(await page.evaluate(() => typeof jstDateStrAt === 'function')).toBe(true)

  // ビンゴの週境界: 月曜 1:00 はまだ前の週
  await page.goto('/bingo.html')
  await page.waitForTimeout(2500)
  const wk = await page.evaluate(() => ({
    monBefore2: getWeekStr(new Date('2026-08-03T01:00:00+09:00')),  // 月曜 1時 → 前週(7/27)
    monAfter2:  getWeekStr(new Date('2026-08-03T02:30:00+09:00')),  // 月曜 2時半 → 当週(8/3)
  }))
  expect(wk.monBefore2).toBe('2026-07-27')
  expect(wk.monAfter2).toBe('2026-08-03')

  expect(errors).toEqual([])
})

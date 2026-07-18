const { test, expect } = require('@playwright/test')

test('オルゴール: 穴あけ→再生→とどける→ギャラリー→ひらく→けす', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message))
  await page.goto('/orgel.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // グリッドが 32行 × 11列
  await expect(page.locator('.orgel-row')).toHaveCount(32)
  expect(await page.locator('.orgel-cell').count()).toBe(32 * 11)

  // 穴をいくつかあける (きらきら星の出だし風: ド ド ソ ソ ラ ラ ソ)
  const taps = ['0:0','2:0','4:3','6:3','8:4','10:4','12:3']
  for (const key of taps) {
    await page.locator(`.orgel-cell[data-key="${key}"]`).click()
    await page.waitForTimeout(60)
  }
  await expect(page.locator('.orgel-cell.on')).toHaveCount(7)

  // 再生開始 → ボタンが「とめる」になり playing 行が出る
  await page.locator('#play-btn').click()
  await page.waitForTimeout(700)
  await expect(page.locator('#play-btn')).toHaveText('■ とめる')
  const audioState = await page.evaluate(() => ctx && ctx.state)
  console.log('AudioContext state:', audioState)
  expect(audioState).toBe('running')
  await page.locator('#play-btn').click()   // 停止

  // タイトルを付けてとどける
  await page.locator('#mel-title').fill('E2Eテストのオルゴール')
  await page.locator('#send-btn').click()
  await page.waitForTimeout(1200)

  // DB反映
  const saved = await page.evaluate(async () => {
    const { data:{session} } = await _sb.auth.getSession()
    const { data } = await _sb.from('melodies').select('id,title,bpm,notes')
      .eq('user_id', session.user.id).eq('title','E2Eテストのオルゴール')
      .order('created_at',{ascending:false}).limit(1).single()
    return data
  })
  console.log('saved:', JSON.stringify({ id: saved.id, bpm: saved.bpm, notes: saved.notes.length }))
  expect(saved.notes.length).toBe(7)
  expect(saved.bpm).toBe(112)

  // ギャラリーに出る
  const card = page.locator('.mel-card', { hasText: 'E2Eテストのオルゴール' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('♪7')

  // ギャラリーから再生できる
  await card.locator('[data-mel-play]').click()
  await page.waitForTimeout(500)
  await expect(card.locator('[data-mel-play]')).toHaveText('■ とめる')
  await card.locator('[data-mel-play]').click()

  // ✎ひらく → エディタに読み戻される
  await card.locator('button', { hasText: 'ひらく' }).click()
  await page.waitForTimeout(400)
  await expect(page.locator('.orgel-cell.on')).toHaveCount(7)
  await expect(page.locator('#mel-title')).toHaveValue('E2Eテストのオルゴール')
  await expect(page.locator('#send-btn')).toHaveText('保存しなおす')

  // けす (confirm を自動OK)
  page.on('dialog', d => d.accept())
  await card.locator('button', { hasText: 'けす' }).click()
  await page.waitForTimeout(900)
  const remains = await page.evaluate(async (id) => {
    const { data } = await _sb.from('melodies').select('id').eq('id', id)
    return (data || []).length
  }, saved.id)
  expect(remains).toBe(0)

  expect(errs.filter(e=>!/401|403|net::/.test(e))).toEqual([])
})

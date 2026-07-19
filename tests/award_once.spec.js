const { test, expect } = require('@playwright/test')

// ポイント再付与バグ改修の検証:
// チェック外し→付け直し / 写真削除→再アップ で points への INSERT が再発しないこと。
// /rest/v1/points への POST を傍受して reason 別に数える。

function trackPoints(page) {
  const posts = []
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/rest/v1/points')) {
      try { posts.push(JSON.parse(req.postData() || '{}')) } catch {}
    }
  })
  return posts
}
const countBy = (posts, reason) => posts.filter(p => p.reason === reason).length

test('bingo: 同じマス・同じラインの再チェックでは再付与されない', async ({ page }) => {
  const posts = trackPoints(page)
  page.on('dialog', d => d.accept())

  await page.goto('/bingo.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.click('.mode-card:has-text("カテゴリー")')
  await page.click('.category-card:has-text("お仕事")')
  await page.waitForTimeout(1500)

  // 再生成して新カードに (awarded がまっさらの状態から検証)
  await page.click('#btn-regenerate')
  await page.waitForTimeout(1200)

  const cellCount = await page.locator('.bingo-cell').count()
  const size = Math.round(Math.sqrt(cellCount))
  expect(size).toBeGreaterThanOrEqual(3)

  const checkCell = async (i) => {
    await page.locator('.bingo-cell').nth(i).click()
    await page.click('.btn-check')
    await page.waitForTimeout(700)
  }
  const uncheckCell = async (i) => {
    await page.locator('.bingo-cell').nth(i).click()
    await page.click('.btn-uncheck')
    await page.waitForTimeout(700)
  }

  // 1. セル0をチェック → +1回
  await checkCell(0)
  expect(countBy(posts, 'bingo_check')).toBe(1)

  // 2. 外して付け直し → 増えない (バグっていたら2になる)
  await uncheckCell(0)
  await checkCell(0)
  expect(countBy(posts, 'bingo_check')).toBe(1)

  // 3. 1行目を完成させる → line +1回
  for (let c = 1; c < size; c++) await checkCell(c)
  expect(countBy(posts, 'bingo_check')).toBe(size)  // 新規マスは各1回
  expect(countBy(posts, 'bingo_line')).toBe(1)

  // お祝いモーダルが出ていたら閉じる (以降のセルクリックを遮るため)
  const celeb = page.locator('.celebration-btn')
  if (await celeb.isVisible()) await celeb.click()
  await page.waitForTimeout(400)

  // 4. ラインの1マスを外して同じラインを作り直し → line 再付与なし・check 再付与なし
  await uncheckCell(1)
  await checkCell(1)
  expect(countBy(posts, 'bingo_check')).toBe(size)
  expect(countBy(posts, 'bingo_line')).toBe(1)

  // 後始末: テストで作ったカードを削除
  await page.evaluate(async () => {
    if (state.card?.id) await _sb.from('bingo_sessions').delete().eq('id', state.card.id)
    Object.keys(localStorage).filter(k => k.startsWith('bingo_')).forEach(k => localStorage.removeItem(k))
  })
})

test('color hunt: 写真の削除→再アップでは再付与されない', async ({ page }) => {
  const posts = trackPoints(page)
  page.on('dialog', d => d.accept())

  await page.goto('/color_hunting.html', { waitUntil: 'networkidle' })
  // 前回の単発セッションを引きずらない (auth トークンは残すため color 関連キーのみ削除)
  // ※ openSingle() クリック時に参照されるだけなのでリロード不要
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.includes('color') || k.includes('hunt')).forEach(k => localStorage.removeItem(k))
  })
  await page.waitForTimeout(800)

  await page.click('.mode-card:has-text("単発")')
  await page.waitForTimeout(500)
  await page.click('#screen-single-sub .mode-card:has-text("ランダム")')
  await page.waitForTimeout(1500)

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const upload = async () => {
    // 空スロット(+)をクリック → file input
    await page.locator('.hunt-cell:not(.center):not(.filled)').first().click()
    await page.setInputFiles('#upload-input', { name: 't.png', mimeType: 'image/png', buffer: png })
    await page.waitForTimeout(1500)
  }

  // 1. スロットに写真 → +1回
  await upload()
  expect(countBy(posts, 'color_photo')).toBe(1)

  // 2. その写真を削除 (filled セルをクリック → confirm accept)
  await page.locator('.hunt-cell.filled').first().click()
  await page.waitForTimeout(1000)

  // 3. 同じスロットに再アップ → 増えない (バグっていたら2になる)
  await upload()
  expect(countBy(posts, 'color_photo')).toBe(1)

  // 後始末: テストで作ったハントと写真を削除
  await page.evaluate(async () => {
    const h = state.currentHunt
    if (h?.id) {
      const paths = (h.photos || []).map(p => p.path)
      if (paths.length) await _sb.storage.from('memories').remove(paths)
      await _sb.from('color_hunts').delete().eq('id', h.id)
    }
    Object.keys(localStorage).filter(k => k.includes('color') || k.includes('hunt')).forEach(k => localStorage.removeItem(k))
  })
})

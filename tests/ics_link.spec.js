// カレンダー: 「📤 iPhoneのカレンダーに追加」が about:blank にならないこと
// モーダルを開いた時点で署名付きURLが用意され、素のリンクとしてタップできる状態になる
const { test, expect } = require('@playwright/test')

test('予定の編集モーダルを開くと .ics のリンクが用意される', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/calendar.html')
  await page.waitForFunction(() => typeof events !== 'undefined', { timeout: 15000 })
  await page.waitForTimeout(1500)

  const id = await page.evaluate(() => {
    const today = new Date().toISOString().split('T')[0]
    const e = events.filter(x => x.id && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    return e ? e.id : null
  })
  test.skip(!id, '未来の予定が無い環境ではスキップ')

  await page.evaluate(i => openEditModal(i), id)

  // 準備完了まで待つ (アップロード + 署名付きURL)
  await page.waitForFunction(
    () => document.getElementById('modal-ics-link')?.dataset.state === 'ready',
    { timeout: 20000 })

  const href = await page.getAttribute('#modal-ics-link', 'href')
  expect(href).toContain('/storage/v1/object/sign/memories/ics/')
  expect(href).toContain('token=')

  // そのURLが text/calendar として取得できる (Safari が「カレンダーに追加」を出せる形)
  const res = await page.request.get(href)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/calendar')
  const body = await res.text()
  expect(body).toContain('BEGIN:VCALENDAR')
  expect(body).toContain('BEGIN:VEVENT')
  expect(body).toContain('DTSTART;VALUE=DATE:')

  await page.evaluate(() => closeModal())
  expect(errors).toEqual([])
})

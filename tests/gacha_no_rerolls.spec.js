// ガチャ: 回した瞬間に消費と景品が確定すること (結果を見てから閉じても引き直せない = リセマラ防止)
// テストアカウントのポイントを 100pt 使う。実ユーザーのデータには触らない
const { test, expect } = require('@playwright/test')

test('ガチャ: 「とじる」を押さずに離脱しても消費と景品が確定している', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/gacha.html')
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser, { timeout: 15000 })
  await page.waitForTimeout(1500)

  const before = await page.evaluate(async () => ({
    balance: await getBalance(currentUser.id),
    tickets: (await _sb.from('gacha_results').select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)).count,
  }))
  test.skip(before.balance === null || before.balance < 100, 'テストアカウントの残高が足りないのでスキップ')

  await page.evaluate(() => startGacha())
  // 演出の前に DB を確定させる実装。結果カードが出るまで待つ
  await page.waitForSelector('#result-overlay.open', { timeout: 15000 })

  // 「とじる」を押さずにページを離れる (= リセマラの操作)
  await page.reload()
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser, { timeout: 15000 })
  await page.waitForTimeout(1200)

  const after = await page.evaluate(async () => ({
    balance: await getBalance(currentUser.id),
    tickets: (await _sb.from('gacha_results').select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)).count,
  }))

  expect(after.balance).toBe(before.balance - 100)   // 消費は確定している
  expect(after.tickets).toBe(before.tickets + 1)     // 景品も確定している
  expect(errors).toEqual([])
})

test('ガチャ: 「とじる」は二重に消費しない', async ({ page }) => {
  await page.goto('/gacha.html')
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser, { timeout: 15000 })
  await page.waitForTimeout(1500)

  const balance = await page.evaluate(() => getBalance(currentUser.id))
  test.skip(balance === null || balance < 100, 'テストアカウントの残高が足りないのでスキップ')

  await page.evaluate(() => startGacha())
  await page.waitForSelector('#result-overlay.open', { timeout: 15000 })
  await page.click('#receive-btn')
  await page.waitForTimeout(1500)

  const after = await page.evaluate(() => getBalance(currentUser.id))
  expect(after).toBe(balance - 100)   // 「とじる」では引かれない (回した時の1回だけ)
})

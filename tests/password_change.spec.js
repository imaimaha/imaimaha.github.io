// 設定ページのパスワード変更 UI (実際の変更はしない。API 経路は手動 curl で検証済み 2026-09-12)
const { test, expect } = require('@playwright/test')

test('設定: パスワード変更フォームの表示とバリデーション', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/settings.html')
  await page.waitForTimeout(1200)

  // 折りたたみを開く
  const toggle = page.locator('#pw-card .rules-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('#pw-new')).toBeVisible()

  // 8文字未満は弾く
  await page.fill('#pw-new', 'short')
  await page.fill('#pw-new2', 'short')
  await page.click('#pw-btn')
  await expect(page.locator('#pw-status')).toContainText('8文字以上')

  // 不一致は弾く
  await page.fill('#pw-new', 'long-enough-pw1')
  await page.fill('#pw-new2', 'long-enough-pw2')
  await page.click('#pw-btn')
  await expect(page.locator('#pw-status')).toContainText('一致しない')

  expect(errors).toEqual([])
})

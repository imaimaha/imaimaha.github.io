const { test, expect } = require('@playwright/test')
const path = require('path')

const AUTH_FILE = path.join(__dirname, 'storage/auth.json')

test('login and save session', async ({ page }) => {
  // 環境変数 or デフォルト値
  const email    = process.env.PW_EMAIL    || 'hirotaka-imanishi@ielove-group.jp'
  const password = process.env.PW_PASSWORD || ''

  if (!password) {
    throw new Error(
      'パスワードが未設定です。\n' +
      '実行方法: PW_PASSWORD=あなたのパスワード npx playwright test'
    )
  }

  await page.goto('/login.html')
  await page.fill('#email',    email)
  await page.fill('#password', password)
  await page.click('button')

  // ログイン後トップページへリダイレクトされるまで待つ
  await page.waitForURL('**/index.html', { timeout: 10_000 })
    .catch(() => page.waitForURL('**/', { timeout: 5_000 }))

  // localStorage に Supabase トークンが入った状態で保存
  await page.context().storageState({ path: AUTH_FILE })
  console.log('✅ auth.json を保存しました')
})

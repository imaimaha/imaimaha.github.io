const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  timeout:        30_000,
  retries:        0,
  fullyParallel:  false,

  use: {
    baseURL:    'http://localhost:3000',
    headless:   true,
    viewport:   { width: 390, height: 844 }, // iPhone 14 Pro
    screenshot: 'on',
    video:      'retain-on-failure',
    locale:     'ja-JP',
  },

  projects: [
    // まずログイン → auth.json に保存
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    // auth.json を使って各テストを実行
    {
      name:         'debug',
      use:          { storageState: 'tests/storage/auth.json' },
      dependencies: [],
    },
  ],

  // npx serve でローカルサーバーを自動起動
  webServer: {
    command:              'npx serve . -p 3000 --no-clipboard',
    url:                  'http://localhost:3000',
    reuseExistingServer:  true,
    timeout:              10_000,
  },
})

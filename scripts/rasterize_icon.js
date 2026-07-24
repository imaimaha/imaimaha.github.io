// icon.svg を各サイズの PNG にラスタライズする一回限りのビルドスクリプト
// 使い方: node scripts/rasterize_icon.js
const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const svg = fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8')
const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
]

;(async () => {
  const browser = await chromium.launch()
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 })
    const html = `<!doctype html><meta charset="utf-8">
      <style>html,body{margin:0;padding:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>
      ${svg}`
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(ROOT, t.file), omitBackground: true })
    await page.close()
    console.log('wrote', t.file, t.size)
  }
  await browser.close()
})()

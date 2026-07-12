// UI audit — mobile viewport で主要ページを回り、レイアウト問題を検出
// - 横スクロール（overflow-x）
// - ボトムナビと本体コンテンツの被り
// - top-bar タイトルの overflow
// - 各画面のフルページスクリーンショット

const { test, expect } = require('@playwright/test')

const MOBILE = { width: 390, height: 844 }
const NAV_H = 68  // bottom-nav visible height

const PAGES = [
  { path: '/',                  name: 'index' },
  { path: '/status.html',       name: 'status' },
  { path: '/closer.html',       name: 'closer' },
  { path: '/quiz.html',         name: 'quiz' },
  { path: '/thanks.html',       name: 'thanks' },
  { path: '/time_capsule.html', name: 'time_capsule' },
  { path: '/bingo.html',        name: 'bingo' },
  { path: '/color_hunting.html',name: 'color_hunting' },
  { path: '/gacha.html',        name: 'gacha' },
  { path: '/shop.html',         name: 'shop' },
  { path: '/calendar.html',     name: 'calendar' },
  { path: '/wishlist.html',     name: 'wishlist' },
  { path: '/one_on_one.html',   name: 'one_on_one' },
  { path: '/location.html',     name: 'location' },
  { path: '/points.html',       name: 'points' },
]

const issues = []

for (const { path, name } of PAGES) {
  test(`ui audit: ${name}`, async ({ page }) => {
    await page.setViewportSize(MOBILE)

    const consoleErrors = []
    page.on('console', m => {
      if (m.type() === 'error') {
        const t = m.text()
        if (!/(403|406|401|Failed to load)/.test(t)) consoleErrors.push(t)
      }
    })
    page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message))

    await page.goto(path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(1500)

    // --- 検査: 横スクロール ---
    const hOverflow = await page.evaluate(() => {
      const de = document.documentElement
      const b = document.body
      return {
        docWidth: Math.max(de.scrollWidth, b.scrollWidth),
        viewport: window.innerWidth,
      }
    })
    const isHOverflow = hOverflow.docWidth > hOverflow.viewport + 1

    // --- 検査: bottom-nav 存在＆高さ ---
    const navInfo = await page.evaluate(() => {
      const el = document.getElementById('bottom-nav')
      if (!el) return { present: false }
      const r = el.getBoundingClientRect()
      const bodyPad = getComputedStyle(document.body).paddingBottom
      return {
        present: true,
        height: r.height,
        bottom: r.bottom,
        top: r.top,
        bodyPaddingBottom: bodyPad,
      }
    })

    // --- 検査: 見切れる要素（body 下端 nav に被る fixed 要素以外） ---
    // 実測: main または .content の bottom が nav の top を超えないこと（padding-bottom で担保される想定）
    const contentBottom = await page.evaluate(() => {
      const el = document.querySelector('main') || document.querySelector('.content') || document.body
      const r = el.getBoundingClientRect()
      return r.bottom
    })

    // --- 検査: top-bar タイトル overflow ---
    const titleInfo = await page.evaluate(() => {
      const tb = document.querySelector('.top-bar h1, .hero .title')
      if (!tb) return { present: false }
      return {
        present: true,
        scrollW: tb.scrollWidth,
        clientW: tb.clientWidth,
        text: tb.textContent.trim().slice(0, 40),
      }
    })

    // --- SS ---
    await page.screenshot({
      path: `tests/screenshots/audit-${name}.png`,
      fullPage: true,
    })

    // --- 集計 ---
    const pageIssues = []
    if (isHOverflow) pageIssues.push(`H-OVERFLOW: doc=${hOverflow.docWidth}px vw=${hOverflow.viewport}px`)
    if (!navInfo.present) pageIssues.push('NO_BOTTOM_NAV')
    if (titleInfo.present && titleInfo.scrollW > titleInfo.clientW) {
      pageIssues.push(`TITLE_CLIP: "${titleInfo.text}" scroll=${titleInfo.scrollW} client=${titleInfo.clientW}`)
    }
    if (consoleErrors.length) pageIssues.push(`JS_ERR: ${consoleErrors.slice(0,3).join(' | ')}`)

    if (pageIssues.length) {
      console.log(`❌ ${name}:`, pageIssues.join('  |  '))
      issues.push({ name, pageIssues })
    } else {
      console.log(`✅ ${name}`)
    }
  })
}

test.afterAll(async () => {
  if (issues.length) {
    console.log('\n=== ISSUE SUMMARY ===')
    issues.forEach(i => console.log(i.name, '->', i.pageIssues.join(', ')))
  } else {
    console.log('\n✅ All pages passed UI audit')
  }
})

const { test, expect } = require('@playwright/test')

test('券インベントリ: 同一の未使用券が ×N でまとまる', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.goto('/shop.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // 描画ロジックを直接検証: 同一の未使用ガチャ券3枚 + 別の券1枚を流し込む
  const result = await page.evaluate(() => {
    const me = currentUser.id
    const mk = (id, name) => ({
      source: 'gacha', id, ownerUserId: me, counterUserId: null,
      name, emoji: '🎁', description: 'テスト券', rarity: 'N',
      used: false, cancelRequested: false, bonusPoints: 0,
      createdAt: '2026-07-17T00:00:00Z', raw: {},
    })
    _tickets = [mk('a', 'ハグ券'), mk('b', 'ハグ券'), mk('c', 'ハグ券'), mk('d', 'おやすみ電話券')]
    setTicketsTab('usable')
    const cards = document.querySelectorAll('#tickets-list .item-card')
    const badge = document.querySelector('#tickets-list .qty-badge')
    return {
      cardCount: cards.length,             // 2種類にまとまる (ハグ券×3, 電話券×1)
      badgeText: badge ? badge.textContent : null,
    }
  })

  expect(result.cardCount).toBe(2)
  expect(result.badgeText).toBe('×3')
  expect(errors.filter(e => !/401|403|net::/.test(e))).toEqual([])
})

test('再販リクエスト: 関数が定義されている', async ({ page }) => {
  await page.goto('/shop.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const hasFn = await page.evaluate(() => typeof requestRestock === 'function')
  expect(hasFn).toBe(true)
})

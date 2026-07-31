// 写真の速度改善 (docs/PLAN_PERFORMANCE.md) のスモークテスト
// - 写真を扱う5ページが JS エラーなしで開ける (util.js ヘルパーの参照切れ検知)
// - compressImage が実際に縮む / 寸法が長辺1600以下になる
// - signedPhotoUrl が localStorage にキャッシュされ、2回目は同じ URL を返す
// - サムネが無い写真は原寸 URL にフォールバックする
// 実データは書き換えない (アップロードは _rehearsal/ 配下に作って必ず消す)
const { test, expect } = require('@playwright/test')

const PAGES = ['/bingo.html', '/dates.html', '/color_hunting.html', '/memories.html', '/one_on_one.html']

for (const p of PAGES) {
  test(`JSエラーなしで開ける: ${p}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(p)
    await page.waitForTimeout(2500)
    const fatal = errors.filter(e => /ReferenceError|SyntaxError|is not defined/.test(e))
    expect(fatal, `JSエラー: ${fatal.join(' / ')}`).toHaveLength(0)
  })
}

test('compressImage: 長辺1600以下に縮む', async ({ page }) => {
  await page.goto('/memories.html')
  await page.waitForTimeout(1500)
  const r = await page.evaluate(async () => {
    // 4000x3000 のダミー画像ファイルを作って圧縮にかける
    const c = document.createElement('canvas')
    c.width = 4000; c.height = 3000
    const g = c.getContext('2d')
    for (let i = 0; i < 200; i++) { g.fillStyle = `hsl(${i * 37 % 360},70%,50%)`; g.fillRect((i * 131) % 4000, (i * 97) % 3000, 500, 400) }
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.95))
    const file = new File([blob], 'big.jpg', { type: 'image/jpeg' })
    const out = await compressImage(file)
    const bmp = await createImageBitmap(out)
    return { inSize: file.size, outSize: out.size, w: bmp.width, h: bmp.height, type: out.type }
  })
  expect(r.outSize).toBeLessThan(r.inSize)
  expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(1600)
  expect(r.type).toBe('image/jpeg')
})

test('signedPhotoUrl: キャッシュ・thumbフォールバック・uploadPhotoのthumb生成', async ({ page }) => {
  await page.goto('/memories.html')
  await page.waitForTimeout(1500)
  const r = await page.evaluate(async () => {
    const path = `_rehearsal/pw_${Date.now()}.jpg`
    try {
      // 小さいダミー画像を uploadPhoto で上げる (thumbs/ も生成されるはず)
      const c = document.createElement('canvas')
      c.width = 800; c.height = 600
      c.getContext('2d').fillStyle = '#4a8'
      c.getContext('2d').fillRect(0, 0, 800, 600)
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9))
      const { error } = await uploadPhoto(path, new File([blob], 'pw.jpg', { type: 'image/jpeg' }))
      if (error) return { error: 'upload: ' + error.message }

      // 1回目と2回目で同じ URL (localStorage キャッシュ)
      const u1 = await signedPhotoUrl(path)
      const u2 = await signedPhotoUrl(path)
      const cached = !!localStorage.getItem(`su_${path}`)

      // thumb が生成されている (URL が thumbs/ を指す)
      const t = await signedPhotoUrl(path, { thumb: true })

      // thumb が無い path はフォールバックで原寸 URL が返る
      const fbPath = path.replace('.jpg', '_nothumb.jpg')
      await _sb.storage.from('memories').upload(fbPath, blob, { contentType: 'image/jpeg' })
      const fb = await signedPhotoUrl(fbPath, { thumb: true })
      const fbOk = !!fb && fb.includes(encodeURIComponent ? fbPath.split('/').pop() : fbPath)

      // 掃除
      await removeStoredPhoto(path)
      await removeStoredPhoto(fbPath)
      return { same: u1 === u2 && !!u1, cached, thumbOk: !!t && t.includes('thumbs/'), fbOk }
    } catch (e) {
      try { await removeStoredPhoto(path) } catch (_) {}
      return { error: String(e) }
    }
  })
  expect(r.error, r.error).toBeUndefined()
  expect(r.same).toBe(true)
  expect(r.cached).toBe(true)
  expect(r.thumbOk).toBe(true)
  expect(r.fbOk).toBe(true)
})

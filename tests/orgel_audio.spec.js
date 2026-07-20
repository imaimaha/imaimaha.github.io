const { test, expect } = require('@playwright/test')

test('新再生方式: WAVレンダリング→audio要素再生→波形に音が入っている', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message))
  await page.goto('/orgel.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 穴あけ (プレビューはWebAudio。エラーが出ないこと)
  await page.locator('.orgel-cell[data-key="0:0"]').click()
  await page.locator('.orgel-cell[data-key="4:4"]').click()
  await page.locator('.orgel-cell[data-key="8:8"]').click()

  // きく → レンダリング完了後 <audio> が再生中になる
  await page.locator('#play-btn').click()
  await page.waitForFunction(() => {
    const a = [...document.querySelectorAll('audio')].find(x => x.src.startsWith('blob:'))
    return a && !a.paused && a.currentTime > 0
  }, { timeout: 8000 })
  await expect(page.locator('#play-btn')).toHaveText('■ とめる')

  // ★核心: blob WAV をデコードして振幅を測る (実際に音が入っているか)
  const audio = await page.evaluate(async () => {
    const a = [...document.querySelectorAll('audio')].find(x => x.src.startsWith('blob:'))
    const buf = await (await fetch(a.src)).arrayBuffer()
    const v = new DataView(buf)
    const n = (buf.byteLength - 44) / 2
    let peak = 0, sumAbs = 0
    for (let i = 0; i < n; i++) {
      const s = Math.abs(v.getInt16(44 + i * 2, true)) / 32768
      if (s > peak) peak = s
      sumAbs += s
    }
    return { bytes: buf.byteLength, seconds: n / 44100, peak, mean: sumAbs / n,
             rate: v.getUint32(24, true), duration: a.duration, loop: a.loop, paused: a.paused }
  })
  console.log('WAV解析:', JSON.stringify(audio, (k,v)=>typeof v==='number'?+v.toFixed(4):v))
  expect(audio.peak).toBeGreaterThan(0.1)     // しっかり音が入っている
  expect(audio.rate).toBe(44100)
  expect(audio.loop).toBe(true)
  expect(audio.paused).toBe(false)

  // 再生中に currentTime が進む + プレイヘッド行が光る
  await page.waitForTimeout(900)
  const t1 = await page.evaluate(() => [...document.querySelectorAll('audio')].find(x=>x.src.startsWith('blob:')).currentTime)
  expect(t1).toBeGreaterThan(0.5)
  await expect(page.locator('.orgel-row.playing')).toHaveCount(1)

  // 勝手にスクロールしない
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeLessThan(5)

  // とめる
  await page.locator('#play-btn').click()
  await expect(page.locator('#play-btn')).toHaveText('▶ きく')
  const paused = await page.evaluate(() => [...document.querySelectorAll('audio')].find(x=>x.src.startsWith('blob:')).paused)
  expect(paused).toBe(true)

  expect(errs.filter(e=>!/401|403|net::/.test(e))).toEqual([])
})

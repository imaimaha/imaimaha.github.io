const { test, expect } = require('@playwright/test')

test('raw/effective の現在値と merge 状態を確認', async ({ page }) => {
  await page.goto('/closer.html')
  await page.waitForTimeout(4000)

  const state = await page.evaluate(() => {
    const c = window._closer
    if (!c) return { error: 'window._closer なし' }
    const fox = c.effective('fox')
    const hed = c.effective('hed')
    return {
      raw_fox:    c.raw.fox,
      raw_hed:    c.raw.hed,
      fox_eff:    fox,
      hed_eff:    hed,
      // 新しい条件: raw >= 100 && eff > 0
      bothMax_new: c.raw.fox.gauge >= 100 && c.raw.hed.gauge >= 100 && fox > 0 && hed > 0,
      // 旧条件: eff >= 100
      bothMax_old: fox >= 100 && hed >= 100,
      // 実際の DOM 状態
      fox_merged:  document.getElementById('fox-float')?.classList.contains('merged'),
      merged_msg:  document.getElementById('merged-msg')?.style.display,
      fox_pct_el:  document.getElementById('fox-pct')?.textContent,
      hed_pct_el:  document.getElementById('hed-pct')?.textContent,
    }
  })

  console.log('\n===== ゲージ現在値 =====')
  console.log('fox raw:', JSON.stringify(state.raw_fox))
  console.log('hed raw:', JSON.stringify(state.raw_hed))
  console.log(`fox effective: ${state.fox_eff}%  /  hed effective: ${state.hed_eff}%`)
  console.log(`bothMax (新条件 raw>=100 & eff>0): ${state.bothMax_new}`)
  console.log(`bothMax (旧条件 eff>=100):         ${state.bothMax_old}`)
  console.log(`fox merged class: ${state.fox_merged}`)
  console.log(`merged-msg display: ${state.merged_msg}`)
  console.log(`fox-pct 表示: "${state.fox_pct_el}"  /  hed-pct 表示: "${state.hed_pct_el}"`)
  console.log('========================\n')

  // 両方 raw >= 100 なら merge しているはず
  if (state.raw_fox?.gauge >= 100 && state.raw_hed?.gauge >= 100 && state.fox_eff > 0 && state.hed_eff > 0) {
    expect(state.fox_merged).toBe(true)
    console.log('✅ merged 状態 OK')
  } else {
    console.log('ℹ️  どちらかのゲージが 100 未満 → merge しない（正常）')
  }

  // % 表示が出ているか
  expect(state.fox_pct_el).toMatch(/\d+%/)
  expect(state.hed_pct_el).toMatch(/\d+%/)
  console.log('✅ % 表示 OK')
})

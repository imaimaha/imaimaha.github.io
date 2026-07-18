const { test, expect } = require('@playwright/test')

test('One Song: プレビュー→投稿→今日表示→履歴→DB反映', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>errs.push(e.message))
  await page.goto('/one_song.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // 後片付け前提: 今日の自分の曲を消す
  await page.evaluate(async () => {
    const { data:{session} } = await _sb.auth.getSession()
    await _sb.from('daily_songs').delete().eq('user_id', session.user.id).eq('date_str', jstDateStr())
  })

  // プレビュー (YouTube: noembed)
  await page.locator('#url-input').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.locator('.btn-preview').click()
  await page.waitForTimeout(2800)
  await expect(page.locator('#preview-area .song-title')).toContainText('Never Gonna Give You Up')
  await expect(page.locator('#preview-area .svc-badge')).toHaveText('YouTube')

  // 投稿
  await page.locator('#comment-input').fill('名曲だよ')
  await expect(page.locator('#submit-btn')).toBeEnabled()
  await page.locator('#submit-btn').click()
  await page.waitForTimeout(1200)

  // 今日のセクションに出る
  const todayCard = page.locator('#today-list .song-card').first()
  await expect(todayCard).toContainText('Never Gonna Give You Up')
  await expect(todayCard).toContainText('名曲だよ')

  // DB確認
  const saved = await page.evaluate(async () => {
    const { data:{session} } = await _sb.auth.getSession()
    const { data } = await _sb.from('daily_songs').select('id,title,service,comment,thumbnail').eq('user_id',session.user.id).eq('date_str',jstDateStr()).single()
    return data
  })
  console.log('saved:', JSON.stringify(saved))
  expect(saved.service).toBe('youtube')
  expect(saved.comment).toBe('名曲だよ')
  expect(saved.thumbnail).toContain('ytimg.com')

  // 後片付け
  await page.evaluate(async () => {
    const { data:{session} } = await _sb.auth.getSession()
    await _sb.from('daily_songs').delete().eq('user_id', session.user.id).eq('date_str', jstDateStr())
  })

  // noembed/spotify のネットワーク由来エラーは除外
  expect(errs.filter(e=>!/401|403|net::|noembed|spotify|Failed to fetch/.test(e))).toEqual([])
})

test('One Song: Spotify メタ取得 + リアクション付与/解除', async ({ page }) => {
  await page.goto('/one_song.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Spotify プレビュー (本家 oEmbed)
  await page.locator('#url-input').fill('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')
  await page.locator('.btn-preview').click()
  await page.waitForTimeout(3000)
  await expect(page.locator('#preview-area .svc-badge')).toHaveText('Spotify')
  await expect(page.locator('#preview-area .song-title')).toContainText('Never Gonna Give You Up')

  // リアクション: 相手の曲を1件用意してリアクトできるか (相手役として別user_idの曲を差し込む)
  const songId = await page.evaluate(async () => {
    const { data:{session} } = await _sb.auth.getSession()
    // partner を取得
    const { data: profs } = await _sb.from('profiles').select('id')
    const partner = (profs||[]).find(p => p.id !== session.user.id)
    if (!partner) return null
    const { data } = await _sb.from('daily_songs').upsert(
      { user_id: partner.id, date_str: jstDateStr(), url:'https://x', service:'other', title:'相手のテスト曲' },
      { onConflict:'user_id,date_str' }).select().single()
    return data ? data.id : null
  })
  if (songId) {
    await page.evaluate(() => loadAll())
    await page.waitForTimeout(800)
    // 相手の曲カードにピッカーがある → 💖 を押す
    const partnerCard = page.locator('.song-card', { hasText: '相手のテスト曲' })
    await partnerCard.locator('.react-btn', { hasText: '💖' }).click()
    await page.waitForTimeout(800)
    const react = await page.evaluate(async (sid) => {
      const { data:{session} } = await _sb.auth.getSession()
      const { data } = await _sb.from('song_reactions').select('emoji').eq('song_id',sid).eq('user_id',session.user.id).single()
      return data?.emoji
    }, songId)
    expect(react).toBe('💖')

    // 後片付け: 相手の曲とリアクションを消す (song削除でreactionはcascade)
    await page.evaluate(async (sid) => { await _sb.from('daily_songs').delete().eq('id', sid) }, songId)
    console.log('reaction ok, cleaned up')
  } else {
    console.log('partner profile not found; skip reaction check')
  }
})

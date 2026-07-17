// 全ページ共通の右上ボタン群。
// 👤 = 設定ページ (/settings.html) への導線 / 🔔 = お知らせセンター(未読バッジ付き)
(function () {
  const safety = document.createElement('style')
  safety.id = 'user-menu-safety'
  safety.textContent = `
    .top-bar {
      padding-right: 118px !important;
      padding-top: calc(14px + env(safe-area-inset-top, 0px)) !important;
    }
    .top-bar h1 { max-width: calc(100% - 112px); }
    /* hero も iOS ステータスバー分を吸収 */
    .hero { padding-top: calc(48px + env(safe-area-inset-top, 0px)) !important; }
    /* 右上ボタン群を safe-area の下に寄せる */
    #user-menu-btn, #notify-bell-btn {
      top: calc(14px + env(safe-area-inset-top, 0px)) !important;
    }
  `
  document.head.appendChild(safety)

  async function init() {
    if (typeof _sb === 'undefined') return
    let emoji = '👤'
    try {
      const { data: { session } } = await _sb.auth.getSession()
      if (session) {
        const { data: profile } = await _sb.from('profiles').select('emoji').eq('id', session.user.id).single()
        if (profile?.emoji) emoji = profile.emoji
      }
    } catch (_) {}

    document.getElementById('user-menu-btn')?.remove()

    // 👤 設定ボタン（設定ページへ遷移）
    const btn = document.createElement('a')
    btn.id = 'user-menu-btn'
    btn.href = '/settings.html'
    btn.setAttribute('aria-label', '設定')
    btn.textContent = emoji
    btn.style.cssText = [
      'position:fixed', 'top:14px', 'right:14px', 'z-index:1000',
      'width:44px', 'height:44px', 'border-radius:50%',
      'background:rgba(255,255,255,0.92)',
      'border:2px solid rgba(150,200,255,0.4)',
      'font-size:1.5rem', 'line-height:1', 'padding:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 2px 10px rgba(0,0,0,0.18)',
      'text-decoration:none', 'color:inherit',
      'cursor:pointer', 'transition:transform 0.12s',
    ].join(';')
    // 設定アイコンだと分かるよう、小さな歯車バッジを重ねる
    btn.innerHTML = `${emoji}<span aria-hidden="true" style="position:absolute;bottom:-3px;right:-3px;width:19px;height:19px;border-radius:50%;background:#1a3060;border:1.5px solid rgba(150,200,255,0.5);font-size:0.68rem;line-height:17px;text-align:center;color:#cfe4ff">⚙️</span>`
    btn.addEventListener('touchstart', () => { btn.style.transform = 'scale(0.92)' }, { passive: true })
    btn.addEventListener('touchend',   () => { btn.style.transform = '' })
    document.body.appendChild(btn)

    // 🔔 お知らせベル（設定ボタンの左側）
    document.getElementById('notify-bell-btn')?.remove()
    const bellBtn = document.createElement('a')
    bellBtn.id = 'notify-bell-btn'
    bellBtn.href = '/notifications.html'
    bellBtn.setAttribute('aria-label', 'お知らせ')
    bellBtn.style.cssText = [
      'position:fixed', 'top:14px', 'right:66px', 'z-index:1000',
      'width:44px', 'height:44px', 'border-radius:50%',
      'background:rgba(255,255,255,0.92)',
      'border:2px solid rgba(150,200,255,0.4)',
      'font-size:1.35rem', 'line-height:1',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 2px 10px rgba(0,0,0,0.18)',
      'text-decoration:none', 'color:inherit',
      'cursor:pointer', 'transition:transform 0.12s',
    ].join(';')
    bellBtn.innerHTML = '🔔<span id="notify-bell-badge" style="display:none;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;background:linear-gradient(135deg,#ff5252,#ff2d55);color:#fff;font-size:0.7rem;font-weight:bold;border-radius:9px;line-height:18px;text-align:center;box-shadow:0 2px 6px rgba(255,80,80,0.5)"></span>'
    bellBtn.addEventListener('touchstart', () => { bellBtn.style.transform = 'scale(0.92)' }, { passive: true })
    bellBtn.addEventListener('touchend',   () => { bellBtn.style.transform = '' })
    document.body.appendChild(bellBtn)

    // 通知タップで来た場合 (?notif_id=<id>) は該当行を既読化して URL を掃除
    markPushNotifRead().finally(() => updateNotifyBadge())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') updateNotifyBadge()
    })
  }

  async function markPushNotifRead() {
    try {
      const params = new URLSearchParams(window.location.search)
      const nid = params.get('notif_id')
      if (!nid) return
      if (typeof _sb === 'undefined') return
      const { data: { session } } = await _sb.auth.getSession()
      if (session) {
        const nidNum = Number(nid)
        const targetId = Number.isFinite(nidNum) ? nidNum : nid
        const { error } = await _sb.from('notifications_log')
          .update({ read_at: new Date().toISOString() })
          .eq('id', targetId)
          .eq('user_id', session.user.id)
          .is('read_at', null)
        if (error) console.error('[header] mark read failed:', error)
      }
      params.delete('notif_id')
      const qs = params.toString()
      const clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
      history.replaceState(null, '', clean)
    } catch (e) {
      console.error('[header] mark push notif read exception:', e)
    }
  }

  async function updateNotifyBadge() {
    try {
      if (typeof _sb === 'undefined') return
      const { data: { session } } = await _sb.auth.getSession()
      if (!session) return
      const { count } = await _sb
        .from('notifications_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .is('read_at', null)
      const badge = document.getElementById('notify-bell-badge')
      if (!badge) return
      if (count && count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count)
        badge.style.display = 'inline-block'
      } else {
        badge.style.display = 'none'
      }
    } catch (e) {
      console.debug('[header] notify badge update failed:', e)
    }
  }
  window.__updateNotifyBadge = updateNotifyBadge

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

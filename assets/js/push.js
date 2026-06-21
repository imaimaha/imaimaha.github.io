const _VAPID_PUB = 'BPiU1n7YLx_aazNZ1DtFKoxjg21_n6Yfi_jdPpR3ja2vpTQn8Kb5ukqCeDwIR94etciUSRgUPeCbhQxsX9Vy1d8'

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function _saveSub(sub) {
  if (typeof _sb === 'undefined') return
  const { data: { session } } = await _sb.auth.getSession()
  if (!session) return
  await _sb.from('push_subscriptions').upsert({
    user_id: session.user.id,
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
  }, { onConflict: 'user_id,endpoint', ignoreDuplicates: false })
}

async function requestPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('❌ 非対応ブラウザ\nSafariのホーム画面追加版で開いてください')
    return
  }
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.register('/sw.js'),
      new Promise((_, r) => setTimeout(() => r(new Error('SW登録タイムアウト')), 8000)),
    ])
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, r) => setTimeout(() => r(new Error('SW準備タイムアウト')), 8000)),
    ])

    const perm = await Notification.requestPermission()
    if (perm === 'denied')  { alert('🚫 通知が拒否されています\niOSの設定 → Safari → 通知 から許可してください'); return }
    if (perm !== 'granted') { alert('⚠️ 通知が許可されませんでした（' + perm + '）'); return }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
    }
    await _saveSub(sub)

    const banner = document.getElementById('push-banner')
    if (banner) banner.style.display = 'none'
    alert('✅ 通知が有効になりました！')
  } catch (e) {
    alert('❌ エラー: ' + (e?.message ?? String(e)))
  }
}

async function initPushUI() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const banner = document.getElementById('push-banner')
  const btn    = document.getElementById('push-allow-btn')
  if (!banner || !btn) return

  // すでに許可済みの場合は購読を更新するだけ（バナーは出さない）
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
        })
      }
      await _saveSub(sub)
    } catch (e) {
      console.debug('[push]', e?.message)
    }
    return
  }

  // 未許可の場合はバナーを表示
  if (Notification.permission === 'default') {
    banner.style.display = 'flex'
    btn.addEventListener('click', requestPush)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushUI)
} else {
  initPushUI()
}

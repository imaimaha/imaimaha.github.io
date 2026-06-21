const _VAPID_PUB = 'BPiU1n7YLx_aazNZ1DtFKoxjg21_n6Yfi_jdPpR3ja2vpTQn8Kb5ukqCeDwIR94etciUSRgUPeCbhQxsX9Vy1d8'

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
    }

    if (typeof _sb === 'undefined') return
    const { data: { session } } = await _sb.auth.getSession()
    if (!session) return

    await _sb.from('push_subscriptions').upsert({
      user_id: session.user.id,
      endpoint: sub.endpoint,
      subscription: sub.toJSON(),
    }, { onConflict: 'user_id,endpoint', ignoreDuplicates: false })
  } catch (e) {
    console.debug('[push] init error:', e?.message)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPush)
} else {
  initPush()
}

const _VAPID_PUB = 'BPiU1n7YLx_aazNZ1DtFKoxjg21_n6Yfi_jdPpR3ja2vpTQn8Kb5ukqCeDwIR94etciUSRgUPeCbhQxsX9Vy1d8'

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// iOSかつPWAとしてホーム画面から起動されているか
function _isIosStandalone() {
  const ua = navigator.userAgent
  const isIos = /iP(hone|ad|od)/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  const standalone = window.navigator.standalone === true
                   || window.matchMedia?.('(display-mode: standalone)').matches
  return { isIos, standalone }
}

// 現在の状態を診断
async function _diagnose() {
  const { isIos, standalone } = _isIosStandalone()
  const notifOk = 'Notification' in window
  const swOk    = 'serviceWorker' in navigator
  const pushOk  = 'PushManager' in window
  const perm    = notifOk ? Notification.permission : 'unsupported'

  let subExists = false
  let subError = null
  try {
    if (swOk && pushOk) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        subExists = !!sub
      }
    }
  } catch (e) { subError = e?.message ?? String(e) }

  return { isIos, standalone, notifOk, swOk, pushOk, perm, subExists, subError }
}

async function _saveSub(sub) {
  if (typeof _sb === 'undefined') throw new Error('Supabaseクライアント未初期化')
  const { data: { session } } = await _sb.auth.getSession()
  if (!session) throw new Error('未ログイン状態')
  const { error } = await _sb.from('push_subscriptions').upsert({
    user_id: session.user.id,
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
  }, { onConflict: 'user_id,endpoint', ignoreDuplicates: false })
  if (error) throw new Error('DB保存失敗: ' + error.message)
}

async function requestPush() {
  const d = await _diagnose()
  console.log('[push] diagnose:', d)

  if (!d.notifOk) {
    alert('❌ このブラウザは通知に対応してません。\nSafariでホーム画面に追加してから開いてください。')
    return
  }
  if (d.isIos && !d.standalone) {
    alert('📱 iOSは「ホーム画面に追加」してからでないと通知を受け取れません。\n\n手順:\n1. Safariで開く\n2. 共有ボタン → ホーム画面に追加\n3. ホーム画面のアイコンから起動して再度試す')
    return
  }
  if (!d.swOk || !d.pushOk) {
    alert('❌ Service Worker / Push API 非対応のブラウザです。')
    return
  }

  let perm = d.perm
  if (perm === 'default') perm = await Notification.requestPermission()
  if (perm === 'denied') {
    alert('🚫 通知が拒否されています。\n\niOS設定 → アプリ「Notre」→ 通知 をオンにしてください。')
    return
  }
  if (perm !== 'granted') { alert('⚠️ 通知が許可されませんでした。'); return }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, r) => setTimeout(() => r(new Error('Service Worker タイムアウト (8秒)')), 8000)),
    ])

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
    }
    await _saveSub(sub)

    alert('✅ 通知が有効になりました！')
    _updateStatusBadge()
  } catch (e) {
    console.error('[push] requestPush error:', e)
    alert('❌ ' + (e?.message ?? String(e)))
  }
}

// 状態バッジの更新
async function _updateStatusBadge() {
  const badge = document.getElementById('push-status-badge')
  if (!badge) return
  const d = await _diagnose()

  if (d.perm === 'granted' && d.subExists) {
    badge.innerHTML = '🔔 通知: 有効'
    badge.dataset.state = 'granted'
    badge.onclick = () => {
      if (confirm('通知設定を確認しますか？\n\n※本当にオフにしたい場合は端末の設定から')) {
        alert('現在の状態:\n' + JSON.stringify(d, null, 2))
      }
    }
  } else if (d.isIos && !d.standalone) {
    badge.innerHTML = '📱 ホーム画面に追加が必要'
    badge.dataset.state = 'need-pwa'
    badge.onclick = () => requestPush()
  } else if (d.perm === 'denied') {
    badge.innerHTML = '🚫 通知: 拒否 (端末設定で許可)'
    badge.dataset.state = 'denied'
    badge.onclick = () => alert('端末の設定 → Notre → 通知 で許可してください')
  } else {
    badge.innerHTML = '🔕 通知: 未設定 (タップで有効化)'
    badge.dataset.state = 'off'
    badge.onclick = () => requestPush()
  }
}

async function initPushUI() {
  const d = await _diagnose()
  console.log('[push] init:', d)

  // 許可済み＆SW/Push対応なら自動購読を試みる（サイレント失敗させない）
  if (d.notifOk && d.perm === 'granted' && d.swOk && d.pushOk && !d.subExists) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_VAPID_PUB),
      })
      await _saveSub(sub)
      console.log('[push] auto-resubscribed successfully')
    } catch (e) {
      console.error('[push] auto-resubscribe failed:', e?.message ?? e)
    }
  }

  _updateStatusBadge()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushUI)
} else {
  initPushUI()
}

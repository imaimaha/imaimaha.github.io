// 全ページ共通の右上ユーザーメニュー。絵文字だけ表示、タップでログアウト確認
(function () {
  // ボタンと重ならないための安全マージン
  const safety = document.createElement('style')
  safety.id = 'user-menu-safety'
  safety.textContent = `
    .top-bar { padding-right: 66px !important; }
    .top-bar h1 { max-width: calc(100% - 60px); }
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

    // 既存の user-menu-btn があれば削除（再挿入対策）
    const old = document.getElementById('user-menu-btn')
    if (old) old.remove()

    const btn = document.createElement('button')
    btn.id = 'user-menu-btn'
    btn.type = 'button'
    btn.setAttribute('aria-label', 'ユーザーメニュー')
    btn.textContent = emoji
    btn.style.cssText = [
      'position:fixed', 'top:14px', 'right:14px', 'z-index:1000',
      'width:44px', 'height:44px', 'border-radius:50%',
      'background:rgba(255,255,255,0.92)',
      'border:2px solid rgba(150,200,255,0.4)',
      'font-size:1.5rem', 'line-height:1', 'padding:0',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 2px 10px rgba(0,0,0,0.18)',
      'cursor:pointer', 'transition:transform 0.12s',
    ].join(';')
    btn.onmousedown = () => { btn.style.transform = 'scale(0.92)' }
    btn.onmouseup   = () => { btn.style.transform = '' }
    btn.onmouseleave = () => { btn.style.transform = '' }
    btn.ontouchstart = () => { btn.style.transform = 'scale(0.92)' }
    btn.ontouchend   = () => { btn.style.transform = '' }
    btn.onclick = () => {
      if (!confirm('ログアウトしますか？')) return
      _sb.auth.signOut().then(() => { location.href = '/login.html' })
    }
    document.body.appendChild(btn)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

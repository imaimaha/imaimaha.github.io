// 全ページ共通の右上ユーザーメニュー。タップで設定パネルを開く
(function () {
  const safety = document.createElement('style')
  safety.id = 'user-menu-safety'
  safety.textContent = `
    .top-bar { padding-right: 66px !important; }
    .top-bar h1 { max-width: calc(100% - 60px); }
  `
  document.head.appendChild(safety)

  const style = document.createElement('style')
  style.textContent = `
    #settings-overlay {
      display: none; position: fixed; inset: 0; z-index: 998;
      background: rgba(5,15,40,0.7); backdrop-filter: blur(4px);
    }
    #settings-overlay.open { display: block; }
    #settings-sheet {
      position: fixed; bottom: 0; left: 50%; z-index: 999;
      width: min(100%, 560px);
      transform: translateX(-50%) translateY(100%);
      transition: transform 0.3s cubic-bezier(0.32,0.72,0,1);
      background: linear-gradient(180deg, #0f1f48 0%, #0a1628 100%);
      border-top: 1.5px solid rgba(100,180,255,0.25);
      border-left: 1.5px solid rgba(100,180,255,0.12);
      border-right: 1.5px solid rgba(100,180,255,0.12);
      border-radius: 20px 20px 0 0;
      padding: 20px 20px 40px;
    }
    #settings-sheet.open { transform: translateX(-50%) translateY(0); }
    #settings-sheet h2 {
      font-size: 1rem; color: #c5ddf5; margin-bottom: 18px;
      text-align: center; font-family: 'Zen Kurenaido', sans-serif;
    }
    .s-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px;
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(100,180,255,0.15);
      border-radius: 12px; margin-bottom: 10px;
      gap: 12px;
    }
    .s-row-label { font-size: 0.95rem; color: #e8f4fd; }
    .s-row-sub { font-size: 0.75rem; color: #7aadcc; margin-top: 2px; }
    .s-push-btn {
      flex-shrink: 0; padding: 8px 16px; border-radius: 14px;
      font-family: inherit; font-size: 0.85rem; cursor: pointer;
      border: 1.5px solid; white-space: nowrap;
      background: rgba(80,220,120,0.18); border-color: rgba(80,220,120,0.45); color: #baffcc;
    }
    .s-push-btn.active { background: rgba(100,180,255,0.12); border-color: rgba(100,180,255,0.3); color: #98bedd; }
    .s-logout-btn {
      width: 100%; padding: 13px; border-radius: 12px; margin-top: 6px;
      font-family: inherit; font-size: 0.95rem; cursor: pointer;
      background: rgba(255,100,100,0.12); border: 1.5px solid rgba(255,100,100,0.4); color: #ff9d9d;
    }
    .s-rules-btn {
      width: 100%; padding: 12px; border-radius: 12px; margin-top: 6px; margin-bottom: 6px;
      font-family: inherit; font-size: 0.9rem; cursor: pointer;
      background: rgba(100,180,255,0.1); border: 1.5px solid rgba(100,180,255,0.3); color: #98bedd;
    }
    #settings-sheet.rules-open #settings-main { display: none; }
    #settings-sheet .rules-panel {
      display: none; max-height: 68vh; overflow-y: auto; padding-right: 4px;
    }
    #settings-sheet.rules-open .rules-panel { display: block; }
    .rules-group {
      margin-bottom: 16px; padding: 12px 14px;
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(100,180,255,0.15);
      border-radius: 12px;
    }
    .rules-group h3 {
      font-family: 'Zen Kurenaido', sans-serif;
      font-size: 0.95rem; color: #ffd97d;
      margin-bottom: 8px;
    }
    .rules-item {
      font-size: 0.82rem; color: #c5ddf5;
      padding: 5px 0; border-bottom: 1px solid rgba(100,180,255,0.08);
      display: flex; justify-content: space-between; gap: 12px;
    }
    .rules-item:last-child { border-bottom: none; }
    .rules-item .r-desc { flex: 1; }
    .rules-item .r-val {
      color: #ffd97d; font-weight: bold; flex-shrink: 0; white-space: nowrap;
    }
    .rules-back {
      display: inline-flex; align-items: center; gap: 4px;
      background: transparent; border: none; color: #7aadcc;
      font-size: 0.85rem; cursor: pointer; font-family: inherit;
      margin-bottom: 10px;
    }
  `
  document.head.appendChild(style)

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
    document.getElementById('settings-overlay')?.remove()
    document.getElementById('settings-sheet')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'settings-overlay'
    overlay.onclick = closeSettings
    document.body.appendChild(overlay)

    const sheet = document.createElement('div')
    sheet.id = 'settings-sheet'
    sheet.innerHTML = `
      <div id="settings-main">
        <h2>⚙️ 設定</h2>
        <div class="s-row">
          <div>
            <div class="s-row-label">🔔 プッシュ通知</div>
            <div class="s-row-sub" id="s-push-status">確認中...</div>
          </div>
          <button class="s-push-btn" id="s-push-btn" onclick="window.__settingsPushTap()">…</button>
        </div>
        <button class="s-rules-btn" onclick="window.__settingsOpenRules()">📖 通知・ポイントのルールを見る</button>
        <button class="s-logout-btn" onclick="window.__settingsLogout()">ログアウト</button>
      </div>
      <div class="rules-panel">
        <button class="rules-back" onclick="window.__settingsCloseRules()">← 設定に戻る</button>
        <h2 style="margin-bottom:14px">📖 通知・ポイントのルール</h2>

        <div class="rules-group">
          <h3>📱 LINE通知（個人）</h3>
          <div class="rules-item"><div class="r-desc">今日の帰宅時間を設定した</div><div class="r-val">→ 相手のLINE</div></div>
          <div class="rules-item"><div class="r-desc">「会社出た」ボタンを押した</div><div class="r-val">→ 相手のLINE</div></div>
          <div class="rules-item"><div class="r-desc">「帰宅」ボタンを押した</div><div class="r-val">→ 相手のLINE</div></div>
        </div>

        <div class="rules-group">
          <h3>👥 LINE通知（グループ）</h3>
          <div class="rules-item"><div class="r-desc">2人の会いたいゲージが同時にMAXになった</div><div class="r-val">→ グループ</div></div>
        </div>

        <div class="rules-group">
          <h3>🔔 Push通知（相手のみ）</h3>
          <div class="rules-item"><div class="r-desc">「今 家 行っていい？」ボタン</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">タイムカプセルが届いた</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">ビンゴでコンプ・ライン達成</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">ガチャ券・ショップの券を使った</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">券の取り消し申請・承諾・却下</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">ありがとうメッセージ・ポイントプレゼント</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">販売所リクエスト送信・返答</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">「今ここにいるよ」チェックイン</div><div class="r-val">→ 相手</div></div>
          <div class="rules-item"><div class="r-desc">クイズの回答</div><div class="r-val">→ 相手</div></div>
        </div>

        <div class="rules-group">
          <h3>✨ ポイント付与ルール</h3>
          <div class="rules-item"><div class="r-desc">毎日ログインボーナス</div><div class="r-val">+5pt</div></div>
          <div class="rules-item"><div class="r-desc">クイズの質問に答える</div><div class="r-val">+10pt</div></div>
          <div class="rules-item"><div class="r-desc">ビンゴのマスをチェック</div><div class="r-val">+1pt</div></div>
          <div class="rules-item"><div class="r-desc">ビンゴ 1ライン達成</div><div class="r-val">+5pt</div></div>
          <div class="rules-item"><div class="r-desc">ビンゴ コンプリート</div><div class="r-val">+20pt</div></div>
          <div class="rules-item"><div class="r-desc">ありがとう送信</div><div class="r-val">+1pt</div></div>
          <div class="rules-item"><div class="r-desc">販売所への出品追加</div><div class="r-val">+1pt</div></div>
          <div class="rules-item"><div class="r-desc">ガチャ賞品ラインナップ追加</div><div class="r-val">+1pt</div></div>
          <div class="rules-item"><div class="r-desc">思い出（メモリー）投稿</div><div class="r-val">+1pt</div></div>
        </div>

        <div class="rules-group">
          <h3>💸 ポイント消費ルール</h3>
          <div class="rules-item"><div class="r-desc">ガチャ 1回</div><div class="r-val">-100pt</div></div>
          <div class="rules-item"><div class="r-desc">ガチャ 10+1連（R以上確定）</div><div class="r-val">-1000pt</div></div>
          <div class="rules-item"><div class="r-desc">販売所で購入</div><div class="r-val">-商品価格</div></div>
          <div class="rules-item"><div class="r-desc">ポイントプレゼント（相手に2倍で送る）</div><div class="r-val">-任意pt</div></div>
        </div>
      </div>
    `
    document.body.appendChild(sheet)

    const btn = document.createElement('button')
    btn.id = 'user-menu-btn'
    btn.type = 'button'
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
      'cursor:pointer', 'transition:transform 0.12s',
    ].join(';')
    btn.onmousedown  = () => { btn.style.transform = 'scale(0.92)' }
    btn.onmouseup    = () => { btn.style.transform = '' }
    btn.onmouseleave = () => { btn.style.transform = '' }
    btn.ontouchstart = () => { btn.style.transform = 'scale(0.92)' }
    btn.ontouchend   = () => { btn.style.transform = '' }
    btn.onclick = openSettings
    document.body.appendChild(btn)

    window.__settingsLogout = async () => {
      closeSettings()
      if (!confirm('ログアウトしますか？')) return
      await _sb.auth.signOut()
      location.href = '/login.html'
    }
    window.__settingsPushTap = async () => {
      await ensurePushJs()
      if (typeof requestPush === 'function') await requestPush()
      await updatePushStatus()
    }
    window.__settingsOpenRules = () => {
      document.getElementById('settings-sheet').classList.add('rules-open')
    }
    window.__settingsCloseRules = () => {
      document.getElementById('settings-sheet').classList.remove('rules-open')
    }

    updatePushStatus()
  }

  function openSettings() {
    document.getElementById('settings-overlay').classList.add('open')
    document.getElementById('settings-sheet').classList.add('open')
    updatePushStatus()
  }

  function closeSettings() {
    const sheet = document.getElementById('settings-sheet')
    document.getElementById('settings-overlay').classList.remove('open')
    sheet.classList.remove('open')
    // 閉じるときはルールパネルも戻す
    setTimeout(() => sheet.classList.remove('rules-open'), 300)
  }

  async function ensurePushJs() {
    if (typeof _diagnose === 'function') return
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = '/assets/js/push.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }

  async function updatePushStatus() {
    const textEl = document.getElementById('s-push-status')
    const btnEl  = document.getElementById('s-push-btn')
    if (!textEl || !btnEl) return
    try {
      await ensurePushJs()
      if (typeof _diagnose !== 'function') { textEl.textContent = '未対応'; btnEl.textContent = '-'; return }
      const d = await _diagnose()
      if (d.perm === 'granted' && d.subExists) {
        textEl.textContent = '有効'
        btnEl.textContent = '確認'; btnEl.className = 's-push-btn active'
      } else if (d.perm === 'denied') {
        textEl.textContent = '拒否済み（端末設定で許可）'
        btnEl.textContent = '設定へ'; btnEl.className = 's-push-btn'
      } else if (d.isIos && !d.standalone) {
        textEl.textContent = 'ホーム画面追加が必要'
        btnEl.textContent = '手順を見る'; btnEl.className = 's-push-btn'
      } else {
        textEl.textContent = '未設定'
        btnEl.textContent = '有効化'; btnEl.className = 's-push-btn'
      }
    } catch (e) {
      textEl.textContent = 'エラー'
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

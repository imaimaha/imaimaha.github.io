// Bottom tab nav (auto-injected on every page)
// 6 tabs: ホーム / ふたり / ビンゴ / カラー / ショップ / もっと
// ビンゴとカラーハントは独立タブ (2026-08-01〜。以前は「遊ぶ」シート内だった)
// 「もっと」→ 全機能グリッド
(function () {
  if (document.getElementById('bottom-nav')) return

  const TABS = [
    { key:'home',  label:'ホーム',   icon:'🌙', href:'/',                   match:p => p === '/' || p === '/index.html' },
    { key:'us',    label:'ふたり',   icon:'💗', href:'/closer.html',        match:p => ['/closer.html','/thanks.html','/one_on_one.html','/time_capsule.html','/status.html','/dates.html','/one_song.html','/workout.html','/goals.html','/diary.html'].includes(p) },
    { key:'bingo', label:'ビンゴ',   icon:'🎯', href:'/bingo.html',         match:p => p === '/bingo.html' },
    { key:'color', label:'カラー',   icon:'🎨', href:'/color_hunting.html', match:p => p === '/color_hunting.html' },
    // ガチャはポイントを使う機能なのでショップ側 (2026-08-01〜)
    { key:'shop',  label:'ショップ', icon:'🛍', href:'/shop.html',          match:p => ['/shop.html','/points.html','/gacha.html'].includes(p) },
    { key:'more',  label:'もっと',   icon:'☰',  href:'#more',               match:() => false, sheet:'more' },
  ]

  // セクション分けして見やすく
  const MORE_SECTIONS = [
    { title:'ふたり', items:[
      { icon:'🕐', label:'今日の帰宅',      href:'/status.html' },
      { icon:'💗', label:'Gravity',         href:'/closer.html' },
      { icon:'📔', label:'ふたりの日記',    href:'/diary.html' },
      { icon:'🏋️', label:'筋トレしよ！',    href:'/workout.html' },
      { icon:'✊', label:'目標達成するよ～', href:'/goals.html' },
      { icon:'🎵', label:'今日の1曲',       href:'/one_song.html' },
      { icon:'🎼', label:'オルゴール',      href:'/orgel.html' },
      { icon:'💕', label:'デート',          href:'/dates.html' },
      { icon:'🌸', label:'ありがとう',      href:'/thanks.html' },
      { icon:'🎁', label:'タイムカプセル',  href:'/time_capsule.html' },
      { icon:'📍', label:'今ここ',          href:'/location.html' },
      { icon:'🤝', label:'1on1',            href:'/one_on_one.html' },
    ]},
    { title:'あそび', items:[
      { icon:'💬', label:'クイズ',          href:'/quiz.html' },
      { icon:'🎯', label:'ビンゴ',          href:'/bingo.html' },
      { icon:'🎨', label:'カラーハント',    href:'/color_hunting.html' },
    ]},
    { title:'ポイント', items:[
      { icon:'🎰', label:'ガチャ',          href:'/gacha.html' },
      { icon:'🛍', label:'販売所',          href:'/shop.html' },
      { icon:'✨', label:'ポイント履歴',    href:'/points.html' },
      { icon:'⚔️', label:'賭け事',          href:'/bets.html' },
      { icon:'💰', label:'割り勘',          href:'/expenses.html' },
    ]},
    { title:'きろく・その他', items:[
      { icon:'📅', label:'カレンダー',      href:'/calendar.html' },
      { icon:'⏳', label:'カウントダウン',  href:'/countdown.html' },
      { icon:'💫', label:'やりたいこと',    href:'/wishlist.html' },
      { icon:'🔔', label:'お知らせ',        href:'/notifications.html' },
      { icon:'⚙️', label:'設定',            href:'/settings.html' },
    ]},
  ]

  const path = location.pathname
  const activeIndex = TABS.findIndex(t => t.match(path))

  const style = document.createElement('style')
  style.textContent = `
    .nav-overlay {
      display: none; position: fixed; inset: 0; z-index: 200;
      background: rgba(5,15,40,0.72); backdrop-filter: blur(6px);
      opacity: 0; transition: opacity 0.28s;
    }
    .nav-overlay.open { display: block; opacity: 1; }
    .nav-sheet {
      position: fixed;
      left: 50%; bottom: 0;
      z-index: 201;
      width: min(100%, 560px);
      transform: translateX(-50%) translateY(102%);
      transition: transform 0.32s cubic-bezier(0.32,0.72,0,1);
      background: linear-gradient(180deg, #0f1f48 0%, #060e24 100%);
      border-top: 1.5px solid rgba(100,180,255,0.28);
      border-radius: 22px 22px 0 0;
      padding: 22px 20px calc(28px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
      max-height: 84vh;
      overflow-y: auto;
    }
    .nav-sheet.open { transform: translateX(-50%) translateY(0); }
    .nav-sheet .sheet-handle {
      width: 40px; height: 4px;
      background: rgba(200,220,255,0.3);
      border-radius: 4px;
      margin: 0 auto 18px;
    }
    .nav-sheet h3 {
      font-family: 'Zen Kurenaido', sans-serif;
      font-size: 1.15rem; color: #e8f4fd;
      text-align: center; letter-spacing: 0.08em;
      margin-bottom: 18px;
    }

    /* More sheet - compact grid */
    #more-sheet .more-section-title {
      font-size: 0.72rem; color: #8fb4d8; letter-spacing: 0.1em;
      font-weight: 700; margin: 4px 2px 8px; text-align: left;
    }
    #more-sheet .more-section + .more-section { margin-top: 16px; }
    #more-sheet .more-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    #more-sheet .more-item {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px;
      padding: 16px 8px;
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(150,200,255,0.15);
      border-radius: 14px;
      color: #e8f4fd;
      text-decoration: none;
      font-size: 0.78rem;
      text-align: center;
      transition: background 0.18s, transform 0.14s, border-color 0.18s;
    }
    #more-sheet .more-item:active { transform: scale(0.94); }
    #more-sheet .more-item .m-icon { font-size: 1.7rem; line-height: 1; }
    @media (min-width: 480px) {
      #more-sheet .more-grid { grid-template-columns: repeat(4, 1fr); }
    }

  `
  document.head.appendChild(style)

  // Nav element
  const nav = document.createElement('nav')
  nav.id = 'bottom-nav'
  nav.className = 'bottom-nav'
  nav.innerHTML = TABS.map((t, i) => `
    <a href="${t.href}"${t.sheet ? ` data-sheet="${t.sheet}"` : ''} class="${i === activeIndex ? 'active' : ''}">
      <span class="bn-icon">${t.icon}</span>
      <span>${t.label}</span>
    </a>
  `).join('')
  document.body.appendChild(nav)

  // Shared overlay
  const overlay = document.createElement('div')
  overlay.className = 'nav-overlay'
  overlay.id = 'nav-overlay'
  document.body.appendChild(overlay)

  // "もっと" sheet
  const moreSheet = document.createElement('div')
  moreSheet.className = 'nav-sheet'
  moreSheet.id = 'more-sheet'
  moreSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>✨ すべてのメニュー</h3>
    ${MORE_SECTIONS.map(sec => `
      <div class="more-section">
        <div class="more-section-title">${sec.title}</div>
        <div class="more-grid">
          ${sec.items.map(l => `
            <a href="${l.href}" class="more-item">
              <span class="m-icon">${l.icon}</span>
              <span>${l.label}</span>
            </a>`).join('')}
        </div>
      </div>`).join('')}
  `
  document.body.appendChild(moreSheet)

  const sheets = { more: moreSheet }

  function openSheet(name, e) {
    if (e) e.preventDefault()
    const sh = sheets[name]
    if (!sh) return
    overlay.classList.add('open')
    void sh.offsetWidth
    sh.classList.add('open')
    overlay.dataset.open = name
  }
  function closeSheet() {
    overlay.classList.remove('open')
    Object.values(sheets).forEach(s => s.classList.remove('open'))
    delete overlay.dataset.open
  }
  overlay.addEventListener('click', closeSheet)
  nav.querySelectorAll('[data-sheet]').forEach(a => {
    a.addEventListener('click', e => openSheet(a.dataset.sheet, e))
  })

  // Haptic feedback on tab tap
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('touchstart', () => {
      if (navigator.vibrate) navigator.vibrate(8)
    }, { passive: true })
  })
})()

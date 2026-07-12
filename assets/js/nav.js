// Bottom tab nav (auto-injected on every page)
// 5 tabs: ホーム / ふたり / 遊ぶ / ショップ / もっと
// 「遊ぶ」→ ゲーム4種のサブシート、「もっと」→ 全機能グリッド
(function () {
  if (document.getElementById('bottom-nav')) return

  const TABS = [
    { key:'home',  label:'ホーム',   icon:'🌙', href:'/',            match:p => p === '/' || p === '/index.html' },
    { key:'us',    label:'ふたり',   icon:'💗', href:'/closer.html', match:p => ['/closer.html','/thanks.html','/one_on_one.html','/time_capsule.html','/status.html'].includes(p) },
    { key:'play',  label:'遊ぶ',     icon:'🎯', href:'#play',        match:p => ['/quiz.html','/bingo.html','/color_hunting.html','/gacha.html'].includes(p), sheet:'play' },
    { key:'shop',  label:'ショップ', icon:'🛍', href:'/shop.html',   match:p => ['/shop.html','/points.html'].includes(p) },
    { key:'more',  label:'もっと',   icon:'☰',  href:'#more',        match:() => false, sheet:'more' },
  ]

  const PLAY_LINKS = [
    { icon:'🎯', label:'お散歩ビンゴ',   href:'/bingo.html',         desc:'今週の25マス' },
    { icon:'🎨', label:'カラーハント',   href:'/color_hunting.html', desc:'色を写真で集める' },
    { icon:'💬', label:'今日のクイズ',   href:'/quiz.html',          desc:'日替わり質問' },
    { icon:'🎰', label:'ガチャ',         href:'/gacha.html',         desc:'100pt / 10+1連' },
  ]

  const MORE_LINKS = [
    { icon:'🕐', label:'今日の帰宅',        href:'/status.html' },
    { icon:'💗', label:'ゲージ',             href:'/closer.html' },
    { icon:'💬', label:'クイズ',             href:'/quiz.html' },
    { icon:'🌸', label:'ありがとう',         href:'/thanks.html' },
    { icon:'🎁', label:'タイムカプセル',     href:'/time_capsule.html' },
    { icon:'🎯', label:'お散歩ビンゴ',       href:'/bingo.html' },
    { icon:'🎨', label:'カラーハント',       href:'/color_hunting.html' },
    { icon:'🎰', label:'ガチャ',             href:'/gacha.html' },
    { icon:'🛍', label:'ポイント販売所',     href:'/shop.html' },
    { icon:'💰', label:'割り勘',             href:'/expenses.html' },
    { icon:'✨', label:'ポイント履歴',       href:'/points.html' },
    { icon:'📅', label:'共有カレンダー',     href:'/calendar.html' },
    { icon:'💫', label:'やりたいこと',       href:'/wishlist.html' },
    { icon:'🤝', label:'1on1',               href:'/one_on_one.html' },
    { icon:'📍', label:'今ここにいるよ',     href:'/location.html' },
    { icon:'🔔', label:'お知らせ',           href:'/notifications.html' },
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

    /* Play sheet - richer tiles with descriptions */
    #play-sheet .play-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    #play-sheet .play-item {
      display: flex; flex-direction: column;
      gap: 4px;
      padding: 18px 16px;
      background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(150,200,255,0.18);
      border-radius: 16px;
      color: #e8f4fd;
      text-decoration: none;
      position: relative;
      overflow: hidden;
      transition: background 0.18s, transform 0.14s, border-color 0.18s;
    }
    #play-sheet .play-item:active { transform: scale(0.96); }
    #play-sheet .play-item::before {
      content: '';
      position: absolute;
      right: -20px; top: -20px;
      width: 70px; height: 70px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,215,100,0.35), transparent 70%);
      filter: blur(18px);
      opacity: 0.7;
      pointer-events: none;
    }
    #play-sheet .play-item[data-key="bingo"]::before { background: radial-gradient(circle, rgba(100,180,255,0.5), transparent 70%); }
    #play-sheet .play-item[data-key="color"]::before { background: radial-gradient(circle, rgba(255,150,200,0.5), transparent 70%); }
    #play-sheet .play-item[data-key="quiz"]::before  { background: radial-gradient(circle, rgba(200,120,255,0.5), transparent 70%); }
    #play-sheet .play-item[data-key="gacha"]::before { background: radial-gradient(circle, rgba(255,215,100,0.6), transparent 70%); }
    #play-sheet .play-icon {
      font-size: 2rem;
      line-height: 1;
      filter: drop-shadow(0 0 8px rgba(200,230,255,0.3));
    }
    #play-sheet .play-title {
      font-family: 'Zen Kurenaido', sans-serif;
      font-size: 1.05rem;
      color: #f0f6ff;
      margin-top: 6px;
    }
    #play-sheet .play-desc {
      font-size: 0.75rem;
      color: #98bedd;
      margin-top: 2px;
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
    <div class="more-grid">
      ${MORE_LINKS.map(l => `
        <a href="${l.href}" class="more-item">
          <span class="m-icon">${l.icon}</span>
          <span>${l.label}</span>
        </a>`).join('')}
    </div>
  `
  document.body.appendChild(moreSheet)

  // "遊ぶ" sheet
  const playSheet = document.createElement('div')
  playSheet.className = 'nav-sheet'
  playSheet.id = 'play-sheet'
  const playKeys = ['bingo','color','quiz','gacha']
  playSheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>🎯 遊ぶ</h3>
    <div class="play-grid">
      ${PLAY_LINKS.map((l, i) => `
        <a href="${l.href}" class="play-item" data-key="${playKeys[i]}">
          <span class="play-icon">${l.icon}</span>
          <span class="play-title">${l.label}</span>
          <span class="play-desc">${l.desc}</span>
        </a>`).join('')}
    </div>
  `
  document.body.appendChild(playSheet)

  const sheets = { more: moreSheet, play: playSheet }

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

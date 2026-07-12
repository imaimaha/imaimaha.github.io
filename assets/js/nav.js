// Bottom tab nav (auto-injected on every page)
// 5 tabs: ホーム / ふたり / 遊ぶ / ショップ / もっと
// The 5th tab opens a sheet with the remaining pages.
(function () {
  if (document.getElementById('bottom-nav')) return

  // Tab definitions — [label, icon, href, matcher]
  const TABS = [
    { label: 'ホーム',   icon: '🌙', href: '/',                match: p => p === '/' || p === '/index.html' },
    { label: 'ふたり',   icon: '💗', href: '/closer.html',     match: p => ['/closer.html','/thanks.html','/one_on_one.html','/time_capsule.html','/status.html'].includes(p) },
    { label: '遊ぶ',     icon: '🎯', href: '/bingo.html',      match: p => ['/quiz.html','/bingo.html','/color_hunting.html','/gacha.html'].includes(p) },
    { label: 'ショップ', icon: '🛍', href: '/shop.html',       match: p => ['/shop.html','/points.html'].includes(p) },
    { label: 'もっと',   icon: '☰',  href: '#more',            match: () => false, isMore: true },
  ]

  // Full menu shown in the "もっと" sheet
  const MORE_LINKS = [
    { icon: '🕐',  label: '今日の帰宅',        href: '/status.html' },
    { icon: '💗',  label: 'ゲージ',             href: '/closer.html' },
    { icon: '💬',  label: 'クイズ',             href: '/quiz.html' },
    { icon: '🌸',  label: 'ありがとう',         href: '/thanks.html' },
    { icon: '🎁',  label: 'タイムカプセル',     href: '/time_capsule.html' },
    { icon: '🎯',  label: 'お散歩ビンゴ',       href: '/bingo.html' },
    { icon: '🎨',  label: 'カラーハンティング', href: '/color_hunting.html' },
    { icon: '🎰',  label: 'ガチャ',             href: '/gacha.html' },
    { icon: '🛍',  label: 'ポイント販売所',     href: '/shop.html' },
    { icon: '✨',  label: 'ポイント履歴',       href: '/points.html' },
    { icon: '📅',  label: '共有カレンダー',     href: '/calendar.html' },
    { icon: '💫',  label: 'やりたいこと',       href: '/wishlist.html' },
    { icon: '🤝',  label: '1on1',               href: '/one_on_one.html' },
    { icon: '📍',  label: '今ここにいるよ',     href: '/location.html' },
  ]

  const path = location.pathname
  const activeIndex = TABS.findIndex(t => t.match(path))

  // Inject style
  const style = document.createElement('style')
  style.textContent = `
    #more-overlay {
      display: none; position: fixed; inset: 0; z-index: 200;
      background: rgba(5,15,40,0.72); backdrop-filter: blur(6px);
      opacity: 0; transition: opacity 0.28s;
    }
    #more-overlay.open { display: block; opacity: 1; }
    #more-sheet {
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
    #more-sheet.open { transform: translateX(-50%) translateY(0); }
    #more-sheet .sheet-handle {
      width: 40px; height: 4px;
      background: rgba(200,220,255,0.3);
      border-radius: 4px;
      margin: 0 auto 18px;
    }
    #more-sheet h3 {
      font-family: 'Zen Kurenaido', sans-serif;
      font-size: 1.15rem; color: #e8f4fd;
      text-align: center; letter-spacing: 0.08em;
      margin-bottom: 18px;
    }
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
    #more-sheet .more-item:hover { background: rgba(255,255,255,0.11); border-color: rgba(150,200,255,0.35); }
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
    <a href="${t.href}"${t.isMore ? ' data-more="1"' : ''} class="${i === activeIndex ? 'active' : ''}">
      <span class="bn-icon">${t.icon}</span>
      <span>${t.label}</span>
    </a>
  `).join('')
  document.body.appendChild(nav)

  // "もっと" sheet
  const overlay = document.createElement('div')
  overlay.id = 'more-overlay'
  document.body.appendChild(overlay)

  const sheet = document.createElement('div')
  sheet.id = 'more-sheet'
  sheet.innerHTML = `
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
  document.body.appendChild(sheet)

  function openMore(e) {
    if (e) e.preventDefault()
    overlay.classList.add('open')
    // Force reflow so the transition triggers
    void sheet.offsetWidth
    sheet.classList.add('open')
  }
  function closeMore() {
    overlay.classList.remove('open')
    sheet.classList.remove('open')
  }
  overlay.addEventListener('click', closeMore)
  nav.querySelector('[data-more="1"]').addEventListener('click', openMore)

  // Haptic feedback on tab tap
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('touchstart', () => {
      if (navigator.vibrate) navigator.vibrate(8)
    }, { passive: true })
  })
})()

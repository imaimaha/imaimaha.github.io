(function () {
  const container = document.querySelector('.clouds')
  if (!container) return

  // 降り星 60個
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div')
    s.className = 'star'
    const size = Math.random() * 2.5 + 0.5
    s.style.cssText = [
      `left:${(Math.random() * 110 - 5).toFixed(1)}%`,
      `top:${(Math.random() * 100).toFixed(1)}%`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${(Math.random() * 10).toFixed(2)}s`,
      `animation-duration:${(Math.random() * 6 + 6).toFixed(1)}s`,
      `opacity:${(Math.random() * 0.6 + 0.4).toFixed(2)}`,
    ].join(';')
    container.appendChild(s)
  }

  // 流れ星 7本
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('div')
    s.className = 'shooting-star'
    s.style.cssText = [
      `left:${(Math.random() * 75).toFixed(1)}%`,
      `top:${(Math.random() * 45).toFixed(1)}%`,
      `animation-delay:${(i * 3.5 + Math.random() * 4).toFixed(1)}s`,
      `animation-duration:${(Math.random() * 1.2 + 0.7).toFixed(2)}s`,
    ].join(';')
    container.appendChild(s)
  }
})()

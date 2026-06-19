(function () {
  const container = document.querySelector('.clouds')
  if (!container) return

  // きらめく固定星 55個（移動なし）
  for (let i = 0; i < 55; i++) {
    const s = document.createElement('div')
    s.className = 'star'
    const size = Math.random() * 3.5 + 0.5
    const isBright = Math.random() < 0.25
    s.style.cssText = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `top:${(Math.random() * 100).toFixed(1)}%`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${(Math.random() * 8).toFixed(2)}s`,
      `animation-duration:${(Math.random() * 3 + 2).toFixed(1)}s`,
      isBright
        ? `box-shadow:0 0 ${(size*3).toFixed(0)}px ${(size*2).toFixed(0)}px rgba(200,230,255,0.9)`
        : `box-shadow:0 0 ${(size*2).toFixed(0)}px rgba(180,220,255,0.5)`,
    ].join(';')
    container.appendChild(s)
  }

  // ランダムにきらめく固定星（背景） 50個
  for (let i = 0; i < 50; i++) {
    const s = document.createElement('div')
    s.className = 'star-twinkle'
    const size = Math.random() * 2.5 + 0.8
    s.style.cssText = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `top:${(Math.random() * 100).toFixed(1)}%`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${(Math.random() * 6).toFixed(2)}s`,
      `animation-duration:${(Math.random() * 3 + 2).toFixed(1)}s`,
      `box-shadow:0 0 ${(size*3).toFixed(0)}px rgba(200,230,255,0.7)`,
    ].join(';')
    container.appendChild(s)
  }

})()

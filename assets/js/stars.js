(function () {
  const container = document.querySelector('.clouds')
  if (!container) return

  const W = window.innerWidth
  const H = window.innerHeight

  // 左端 18% を除外、左上コーナー 25%×25% も除外
  function randPos() {
    let l, t
    do {
      l = Math.floor(W * 0.18 + Math.random() * W * 0.82)
      t = Math.floor(Math.random() * H)
    } while (l < W * 0.25 && t < H * 0.25)
    return { l, t }
  }

  // きらめく固定星 55個（position:fixed で確実に viewport 基準）
  for (let i = 0; i < 55; i++) {
    const s = document.createElement('div')
    s.className = 'star'
    const size = Math.random() * 3.5 + 0.5
    const isBright = Math.random() < 0.25
    const { l, t } = randPos()
    s.style.cssText = [
      `position:fixed`,
      `left:${l}px`,
      `top:${t}px`,
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
    const { l, t } = randPos()
    s.style.cssText = [
      `position:fixed`,
      `left:${l}px`,
      `top:${t}px`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${(Math.random() * 6).toFixed(2)}s`,
      `animation-duration:${(Math.random() * 3 + 2).toFixed(1)}s`,
      `box-shadow:0 0 ${(size*3).toFixed(0)}px rgba(200,230,255,0.7)`,
    ].join(';')
    container.appendChild(s)
  }

  // 流れ星 8本（左端 15% より右から開始）
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('div')
    s.className = 'shooting-star'
    s.style.cssText = [
      `position:fixed`,
      `left:${Math.floor(W * 0.15 + Math.random() * W * 0.60)}px`,
      `top:${Math.floor(H * 0.05 + Math.random() * H * 0.40)}px`,
      `animation-delay:${(i * 4 + Math.random() * 5).toFixed(1)}s`,
      `animation-duration:${(Math.random() * 1.0 + 5.6).toFixed(2)}s`,
    ].join(';')
    container.appendChild(s)
  }
})()

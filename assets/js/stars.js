(function () {
  const container = document.querySelector('.clouds')
  if (!container) return

  // 左上 25vw×25vh を避け、左端 12vw 以上でランダム位置を生成
  function randPos() {
    let l, t
    do {
      l = 12 + Math.random() * 88
      t = Math.random() * 100
    } while (l < 25 && t < 25)
    return { l, t }
  }

  // きらめく固定星 55個
  for (let i = 0; i < 55; i++) {
    const s = document.createElement('div')
    s.className = 'star'
    const size = Math.random() * 3.5 + 0.5
    const isBright = Math.random() < 0.25
    const { l, t } = randPos()
    s.style.cssText = [
      `left:${l.toFixed(1)}vw`,
      `top:${t.toFixed(1)}vh`,
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
      `left:${l.toFixed(1)}vw`,
      `top:${t.toFixed(1)}vh`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `animation-delay:${(Math.random() * 6).toFixed(2)}s`,
      `animation-duration:${(Math.random() * 3 + 2).toFixed(1)}s`,
      `box-shadow:0 0 ${(size*3).toFixed(0)}px rgba(200,230,255,0.7)`,
    ].join(';')
    container.appendChild(s)
  }

  // 流れ星 8本（左端 15vw より右から開始）
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('div')
    s.className = 'shooting-star'
    s.style.cssText = [
      `left:${(15 + Math.random() * 60).toFixed(1)}vw`,
      `top:${(5  + Math.random() * 40).toFixed(1)}vh`,
      `animation-delay:${(i * 4 + Math.random() * 5).toFixed(1)}s`,
      `animation-duration:${(Math.random() * 1.0 + 5.6).toFixed(2)}s`,
    ].join(';')
    container.appendChild(s)
  }
})()

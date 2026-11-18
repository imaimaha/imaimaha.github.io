PRE = '''const sleep = ms => new Promise(r => setTimeout(r, ms));
const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
const clickText = (words) => { const els = [...document.querySelectorAll('button, a, [role=button], .btn, div[onclick]')].filter(vis);
  for (const w of words) { const el = els.find(e => e.textContent.trim().replace(/\\s+/g, ' ') === w || e.textContent.trim().startsWith(w)); if (el) { el.click(); return w; } } return null; };
const dismiss = async (words) => { const W = words || ['とばす', 'スキップ', '▶ はじめる', 'はじめる', 'とじる', 'OK']; const done = []; for (let i = 0; i < 8; i++) { const w = clickText(W); if (!w) break; done.push(w); await sleep(350); } return done; };
'''

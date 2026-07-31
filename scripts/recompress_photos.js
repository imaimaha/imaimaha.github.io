// 既存写真の一括再圧縮 + サムネ生成 (docs/PLAN_PERFORMANCE.md ④)
//
// memories バケットの原寸写真 (平均2.5MB) を長辺1600px/JPEG q0.82 に再圧縮して上書きし、
// あわせて一覧用サムネ (長辺400px) を thumbs/<元と同じpath> に生成する。
// DB が持つ path は変わらないのでアプリ側の変更は不要。
//
// 使い方:
//   cd <repo> && set -a && source .env && set +a && node scripts/recompress_photos.js
//
// 安全策:
//   - 上書き前に元ファイルを ~/notre_photo_backup_<日付>/ へ退避 (path の / は __ に置換)
//   - 再圧縮して元より大きくなる場合は本体を触らない (thumb だけ作る)
//   - thumbs/ と ics/ は対象外
//
// 圧縮は rasterize_icon.js と同じく Playwright chromium の canvas で行う
// (この環境に sharp/imagemagick が無いため)

const fs = require('fs')
const path = require('path')
const os = require('os')
const { chromium } = require('playwright')

const BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!BASE || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です (set -a; source .env; set +a)')
  process.exit(1)
}

async function api(p, opts = {}) {
  const res = await fetch(`${BASE}/storage/v1${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

async function listDir(prefix) {
  const res = await api('/object/list/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000 }),
  })
  return res.json()
}

async function walk(prefix, acc) {
  for (const o of await listDir(prefix)) {
    const name = (prefix ? prefix + '/' : '') + o.name
    if (o.metadata && o.metadata.size != null) {
      acc.push({ path: name, size: o.metadata.size, mime: o.metadata.mimetype || '' })
    } else {
      await walk(name, acc)   // フォルダ
    }
  }
  return acc
}

function putObject(objPath, buf) {
  return api(`/object/memories/${objPath}`, {
    method: 'POST',
    body: buf,
    headers: {
      'Content-Type': 'image/jpeg',
      'cache-control': 'max-age=31536000',   // 1年 (URL は署名で守られ、内容は path 単位で不変運用)
      'x-upsert': 'true',
    },
  })
}

;(async () => {
  const all = await walk('', [])
  // thumbs/ が既にある写真は処理済みとしてスキップ (途中中断→再実行しても二重圧縮しない)
  const done = new Set(all.filter(f => f.path.startsWith('thumbs/')).map(f => f.path.slice('thumbs/'.length)))
  const targets = all.filter(f =>
    !f.path.startsWith('thumbs/') && !f.path.startsWith('ics/') && /^image\//.test(f.mime) && !done.has(f.path))
  const totalMB = targets.reduce((s, f) => s + f.size, 0) / 1e6
  console.log(`対象 ${targets.length} 件 (処理済みスキップ ${done.size} 件) / 合計 ${totalMB.toFixed(1)} MB`)
  if (!targets.length) { console.log('すべて処理済み'); return }

  const backupDir = path.join(os.homedir(), `notre_photo_backup_${new Date().toISOString().slice(0, 10)}`)
  fs.mkdirSync(backupDir, { recursive: true })
  console.log(`退避先: ${backupDir}`)

  const browser = await chromium.launch()
  const page = await browser.newPage()

  let before = 0, after = 0, mainSkipped = 0
  const failed = []
  for (let i = 0; i < targets.length; i++) {
    const f = targets[i]
    const tag = `[${i + 1}/${targets.length}]`
    try {
      const buf = Buffer.from(await (await api(`/object/memories/${f.path}`)).arrayBuffer())

      // 退避 (既にあれば再利用 = 再実行しても2重圧縮した原本で上書きしない)
      const bk = path.join(backupDir, f.path.replace(/\//g, '__'))
      if (!fs.existsSync(bk)) fs.writeFileSync(bk, buf)

      const dataUrl = `data:${f.mime};base64,${buf.toString('base64')}`
      const out = await page.evaluate(async (src) => {
        const img = new Image()
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode failed')); img.src = src })
        const enc = (maxEdge, q) => {
          const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
          const c = document.createElement('canvas')
          c.width = Math.max(1, Math.round(img.naturalWidth * scale))
          c.height = Math.max(1, Math.round(img.naturalHeight * scale))
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
          return c.toDataURL('image/jpeg', q).split(',')[1]
        }
        return { main: enc(1600, 0.82), thumb: enc(400, 0.75) }
      }, dataUrl)

      const mainBuf = Buffer.from(out.main, 'base64')
      const thumbBuf = Buffer.from(out.thumb, 'base64')

      before += f.size
      if (mainBuf.length < f.size) {
        await putObject(f.path, mainBuf)
        after += mainBuf.length
      } else {
        mainSkipped++          // 元から小さい → 本体そのまま
        after += f.size
      }
      await putObject(`thumbs/${f.path}`, thumbBuf)

      console.log(`${tag} ${f.path}  ${(f.size / 1e6).toFixed(2)}MB → ${(Math.min(mainBuf.length, f.size) / 1e6).toFixed(2)}MB (+thumb ${(thumbBuf.length / 1024).toFixed(0)}KB)`)
    } catch (e) {
      failed.push(f.path)
      console.error(`${tag} 失敗: ${f.path}: ${e.message}`)
    }
  }
  await browser.close()

  console.log(`\n== 完了 ==`)
  console.log(`本体: ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB (スキップ ${mainSkipped} 件)`)
  console.log(`失敗: ${failed.length} 件`)
  if (failed.length) { console.log(failed.join('\n')); process.exit(1) }
})()

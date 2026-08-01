// PC退避した原寸 (~/notre_photo_backup_2026-08-01/) から長辺2400pxで再生成して上書きする
// (最初のバックフィルは1600pxで実施 → ユーザー決定で2400pxに引き上げたため作り直し)
//
// 使い方:
//   cd <repo> && set -a && source .env && set +a && node scripts/upscale_from_backup.js
//
// - 退避ファイル名は path の / を __ に置換したもの (recompress_photos.js が作った形式)
// - 2400px 再圧縮が原寸より大きくなる場合はスキップ (元から小さい写真)
// - サムネ(400px)は画質に差が出ないため作り直さない
// - 読み取り元はPCのみ・書き込みは本体 path への上書きのみ (退避ファイルは変更しない)

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

const BACKUP_DIR = path.join(os.homedir(), 'notre_photo_backup_2026-08-01')
const MAX_EDGE = 2400

async function api(p, opts = {}) {
  const res = await fetch(`${BASE}/storage/v1${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

;(async () => {
  const files = fs.readdirSync(BACKUP_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  console.log(`退避原寸: ${files.length} 件 (${BACKUP_DIR})`)

  const browser = await chromium.launch()
  const page = await browser.newPage()

  let before = 0, after = 0, skipped = 0
  const failed = []
  for (let i = 0; i < files.length; i++) {
    const name = files[i]
    const objPath = name.replace(/__/g, '/')
    const tag = `[${i + 1}/${files.length}]`
    try {
      const buf = fs.readFileSync(path.join(BACKUP_DIR, name))
      const mime = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg'
      const out = await page.evaluate(async ({ src, maxEdge }) => {
        const img = new Image()
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('decode failed')); img.src = src })
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.naturalWidth * scale))
        c.height = Math.max(1, Math.round(img.naturalHeight * scale))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/jpeg', 0.82).split(',')[1]
      }, { src: `data:${mime};base64,${buf.toString('base64')}`, maxEdge: MAX_EDGE })

      const mainBuf = Buffer.from(out, 'base64')
      before += buf.length
      if (mainBuf.length < buf.length) {
        await api(`/object/memories/${objPath}`, {
          method: 'POST',
          body: mainBuf,
          headers: { 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'true' },
        })
        after += mainBuf.length
        console.log(`${tag} ${objPath}  原寸${(buf.length / 1e6).toFixed(2)}MB → ${(mainBuf.length / 1e6).toFixed(2)}MB`)
      } else {
        skipped++
        after += buf.length
        console.log(`${tag} ${objPath}  元から小さいのでスキップ`)
      }
    } catch (e) {
      failed.push(objPath)
      console.error(`${tag} 失敗: ${objPath}: ${e.message}`)
    }
  }
  await browser.close()

  console.log(`\n== 完了 ==`)
  console.log(`原寸 ${(before / 1e6).toFixed(1)}MB → 2400px版 ${(after / 1e6).toFixed(1)}MB (スキップ ${skipped} 件)`)
  console.log(`失敗: ${failed.length} 件`)
  if (failed.length) { console.log(failed.join('\n')); process.exit(1) }
})()

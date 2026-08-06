// 共通ユーティリティ (全ページで header.js 等と一緒に読み込む)
// 依存: 各ページで定義されるグローバルの Supabase クライアント `_sb`

// このファイルが属するデプロイのバージョン。`scripts/bump_version.sh` が書き換える
const APP_VERSION = '202608061558'

// ── デプロイ検知して自動リロード ──
// GitHub Pages は Cache-Control: max-age=600 を返すため、デプロイ後10分ほど端末が古い
// HTML/JS を表示し続ける。HTML と JS の版がずれると機能が無反応になることもある。
// version.json を no-store で読み、このファイルの APP_VERSION と違えば1回だけリロードする
// (リロードは HTTP キャッシュを検証し直すので、新しい HTML → 新しい ?v= → 新しい JS になる)
;(function () {
  const FLAG = 'app_reloaded_for'
  async function check() {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' })
      if (!res.ok) return
      const { version } = await res.json()
      if (!version || version === APP_VERSION) return
      if (sessionStorage.getItem(FLAG) === version) return   // 同じ版で繰り返さない
      sessionStorage.setItem(FLAG, version)
      console.info(`[update] 新しいバージョン ${version} を検知 (現在 ${APP_VERSION})。再読み込みします`)
      location.reload()
    } catch (_) {}
  }
  check()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
})()

// HTML エスケープ。textContent で済む場所では DOM API を優先すること
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// send-push の共通ラッパ。url は通知タップの遷移先で必須
// recipient を渡すとその1人へ、省略すると sender (自分) 以外の全員へ
// 失敗しても本体処理は止めない (console にだけ残す)
function notify({ recipient, sender, ...payload }) {
  if (!payload.url) {
    console.error('[notify] url は必須です:', payload.title)
    return Promise.resolve()
  }
  if (recipient) payload.recipient_user_id = recipient
  if (sender) payload.sender_user_id = sender
  return _sb.functions.invoke('send-push', { body: payload })
    .catch(e => console.error('[notify] 送信失敗:', payload.title, e))
}

// ポイント付与/消費。silent fail させず console に残す
// 戻り値: 成功したら true
async function addPoints(userId, amount, reason) {
  const { error } = await _sb.from('points').insert({ user_id: userId, amount, reason })
  if (error) {
    console.error(`[points] ${reason} (${amount > 0 ? '+' : ''}${amount}pt) 失敗:`, error.message)
    return false
  }
  return true
}

// ポイント残高。PostgREST の select はデフォルト最大1000行で、points が1000行を超えると
// クライアント側合計 (select amount → reduce) が取りこぼすため、必ずこの RPC 経由で取得する
// 戻り値: 残高 (integer)。失敗時は null (呼び出し側で消費系の処理を止めること)
async function getBalance(userId) {
  const { data, error } = await _sb.rpc('point_balance', { uid: userId })
  if (error) {
    console.error('[points] 残高取得失敗:', error.message)
    return null
  }
  return data
}

// ポイントの獲得/消費/合計の内訳 (points.html 用)。同じく DB 側で集計する
// 戻り値: { earned, spent, total }。失敗時は null
async function getPointSummary(userId) {
  const { data, error } = await _sb.rpc('point_summary', { uid: userId })
  if (error) {
    console.error('[points] 集計取得失敗:', error.message)
    return null
  }
  return Array.isArray(data) ? data[0] : data
}

// JST の今日 (YYYY-MM-DD)
function jstDateStr(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// 日付の変わり目を JST の指定時刻にした「今日」(YYYY-MM-DD)。
// 日記・筋トレは深夜まで起きている前提で 2:00 区切り (2026-08-03〜)。
// 例: 8/3 の 01:30 は「8/2」扱いになる
function jstDateStrAt(rolloverHour = 2, date = new Date()) {
  return new Date(date.getTime() - rolloverHour * 3600000)
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// 連続日数を数える。**1日の抜けはセーフ、2日続けて抜けたら途切れる**（救済ルール 2026-08-03〜）
//   hasDay(dateStr) … その日を達成しているか
//   todayStr        … 起点の日付 (2:00区切りの「今日」)
// 戻り値: { days, usedGrace } days=連続日数 / usedGrace=「おやすみ」を使った回数
function countStreak(hasDay, todayStr) {
  const cur = new Date(todayStr + 'T00:00:00+09:00')
  const at = () => cur.toLocaleDateString('sv-SE')
  // 今日がまだなら昨日から数える (今日の未達成で途切れさせない)
  if (!hasDay(at())) cur.setDate(cur.getDate() - 1)
  let days = 0, usedGrace = 0
  while (true) {
    if (hasDay(at())) { days++; cur.setDate(cur.getDate() - 1); continue }
    // 抜けた日: その前日が達成なら「1日おやすみ」として継続する
    const probe = new Date(cur)
    probe.setDate(probe.getDate() - 1)
    if (days > 0 && hasDay(probe.toLocaleDateString('sv-SE'))) {
      usedGrace++
      cur.setDate(cur.getDate() - 1)
      continue
    }
    break
  }
  return { days, usedGrace }
}

// ── 今ここ (チェックイン) ──

// その町が自分にとって初めてなら +5pt して true を返す。
// ⚠️ チェックインを insert した「あと」に呼ぶこと (今回の1件を含めて数えるため)
async function awardFirstVisit(userId, placeName) {
  if (!placeName) return false
  const { count, error } = await _sb.from('location_checkins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('place_name', placeName)
  if (error) { console.error('[location] 初訪問の判定に失敗:', error.message); return false }
  if ((count ?? 0) !== 1) return false
  await addPoints(userId, 5, 'location_first_visit')
  return true
}

// ── リンク (デート / やりたいこと / カレンダーの予定に貼る URL) ──

// 入力された URL を保存できる形に整える。スキーム省略時は https:// を補う。
// http(s) 以外 (javascript: など) は null を返して弾く
// 戻り値: 正規化した URL / 空・不正なら null
function safeUrl(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch (_) { return null }
}

// リンクの表示ラベル: ドメインだけの短い見た目 (長い URL でレイアウトが崩れないように)
function urlLabel(href) {
  try { return new URL(href).hostname.replace(/^www\./, '') } catch (_) { return String(href ?? '') }
}

// ── 端末のカレンダー (iPhone のカレンダー等) への書き出し ──
// .ics (iCalendar) を作り、共有シート or ダウンロードで端末に渡す。
// iOS は共有シートから「カレンダー」を選ぶと追加できる

function icsEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// YYYY-MM-DD → YYYYMMDD (addDays 日ずらせる)
function icsDate(dateStr, addDays = 0) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + addDays)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// 終日イベントの .ics を組み立てる (このアプリの予定・デートは時刻を持たないため)
// { uid, title, date, dateEnd, description, url }
function buildIcs({ uid, title, date, dateEnd, description, url }) {
  const start = icsDate(date)
  const end = icsDate(dateEnd && dateEnd !== date ? dateEnd : date, 1)   // DTEND は翌日 (iCalendar 仕様)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Notre Endroit//Calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(uid)}@imaimaha.github.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description || '')}`,
    url ? `URL:${icsEscape(url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

// .ics を Storage に置いて署名付きURLで直接開く。
// iOS Safari は text/calendar の URL を開くと「カレンダーに追加」ダイアログを直接出せる
// (共有シート経由のファイル受け渡しだと "保存 → ファイルアプリでタップ" の2手間になる)
// バケットは非公開の memories を使い、署名付きURL(1時間)なので予定の内容は外に漏れない。
// Content-Type が text/calendar で返ることは確認済み (Safari が「カレンダーに追加」を出せる)
//
// ⚠️ タップされた瞬間にこの関数を呼んではいけない。
//   iOS はユーザー操作の直後でない window.open / 遷移を無視する。
//   about:blank の子窓を先に開いて後から location を差し替える手も standalone PWA では効かず、
//   about:blank のまま残った (2026-08-01 実機で発生)。
//   → 画面を開いた時点でここで URL を用意し、素の <a href> にしてタップさせること
// 戻り値: 署名付きURL / 失敗したら null
async function createIcsUrl(event) {
  try {
    const { data: { session } } = await _sb.auth.getSession()
    if (!session) return null
    const ics = buildIcs(event)
    const safeName = String(event.uid || 'event').replace(/[^\w.-]/g, '_')
    const path = `ics/${session.user.id}/${safeName}.ics`
    const blob = new Blob([ics], { type: 'text/calendar' })

    const { error: upErr } = await _sb.storage.from('memories')
      .upload(path, blob, { contentType: 'text/calendar', upsert: true })
    if (upErr) { console.error('[ics] アップロード失敗:', upErr.message); return null }

    const { data, error } = await _sb.storage.from('memories').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) { console.error('[ics] 署名付きURL失敗:', error?.message); return null }
    return data.signedUrl
  } catch (e) {
    console.error('[ics] URL を作れませんでした:', e)
    return null
  }
}

// .ics を端末に渡す (フォールバック用)。共有シートが使えれば共有、無ければファイル保存
// 戻り値: 'shared' | 'downloaded' | 'cancelled' | 'failed'
async function shareIcs(event) {
  try {
    const ics = buildIcs(event)
    const fileName = `${String(event.title || 'event').replace(/[\\/:*?"<>|]/g, '_')}.ics`
    const file = new File([ics], fileName, { type: 'text/calendar' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: event.title })
      return 'shared'
    }
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 4000)
    return 'downloaded'
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled'   // 共有シートを閉じただけ
    console.error('[ics] 書き出し失敗:', e)
    return 'failed'
  }
}

// リンクチップの共通 HTML。href は safeUrl を通した値を渡すこと。
// カードごとタップできる UI の中でも使えるよう、クリックは伝播させない
function linkChipHtml(href, label) {
  if (!href) return ''
  return `<a class="link-chip" href="${escHtml(href)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">🔗 ${escHtml(label || urlLabel(href))}</a>`
}

// ── 写真 (memories バケット) ──
// カメラ原寸 (平均2.5MB) をそのまま上げ下げしていたのが「重い」の主因だったため、
// 写真は必ずこのセクションのヘルパー経由で扱う (docs/PLAN_PERFORMANCE.md 参照):
//   アップロード: uploadPhoto()  … 長辺2400pxに圧縮 + thumbs/ にサムネも同時アップ
//   表示:        signedPhotoUrl() … 署名URLを7日期限で localStorage にキャッシュ
//                (URL が変わらなければブラウザの HTTP キャッシュが効いて再DLゼロになる)

// 画像ファイルを長辺 maxEdge px の JPEG に圧縮する。失敗時・縮小の意味がない時は元ファイルを返す
// 既定 2400px はユーザー決定 (2026-08-01): アプリの「写真を撮る」経由はカメラロールに残らず
// この圧縮版が唯一のコピーになるため、2L〜A4 印刷に耐える画質と容量(残容量~8ヶ月)を両立させる値
async function compressImage(file, maxEdge = 2400, quality = 0.82) {
  try {
    if (!file || !/^image\//.test(file.type)) return file
    let src, w, h
    try {
      // EXIF の回転を反映してデコード (iPhone 縦写真対策)
      src = await createImageBitmap(file, { imageOrientation: 'from-image' })
      w = src.width; h = src.height
    } catch (_) {
      // createImageBitmap 非対応/失敗時は <img> でデコード
      src = await new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = URL.createObjectURL(file)
      })
      w = src.naturalWidth; h = src.naturalHeight
    }
    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw; canvas.height = ch
    canvas.getContext('2d').drawImage(src, 0, 0, cw, ch)
    if (src.close) src.close()
    else if (src.src) URL.revokeObjectURL(src.src)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) return file
    if (scale === 1 && blob.size >= file.size) return file   // 元から小さい画像はそのまま
    const name = String(file.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch (e) {
    console.warn('[photo] 圧縮に失敗したので元ファイルのまま上げます:', e)
    return file
  }
}

// 署名URLの localStorage キャッシュを消す (削除・上書きアップロード時に呼ぶ)
function clearPhotoUrlCache(path) {
  try {
    localStorage.removeItem(`su_${path}`)
    localStorage.removeItem(`su_thumbs/${path}`)
  } catch (_) {}
}

// 写真アップロードの共通経路: 本体(圧縮済み) + thumbs/<path> (一覧用サムネ) を上げる
// 戻り値は storage.upload と同じ { error } 形 (呼び出し側の変更を最小にするため)
// サムネは best-effort — 失敗しても本体が上がっていれば成功扱い (表示側が原寸にフォールバックする)
async function uploadPhoto(path, file, { upsert = false } = {}) {
  const main = await compressImage(file)
  const opts = { upsert, cacheControl: '31536000', contentType: main.type || 'image/jpeg' }
  const { error } = await _sb.storage.from('memories').upload(path, main, opts)
  if (error) return { error }
  clearPhotoUrlCache(path)   // 同じ path への上書きで古い署名URLを掴まないように
  try {
    const thumb = await compressImage(main, 400, 0.75)
    await _sb.storage.from('memories').upload(`thumbs/${path}`, thumb, { ...opts, upsert: true, contentType: 'image/jpeg' })
  } catch (e) { console.warn('[photo] サムネ生成失敗 (本体は成功):', e) }
  return { error: null }
}

// 写真の署名URL。7日期限で発行して localStorage に貯め、期限内は同じ URL を返す
// (createSignedUrl はトークンが毎回変わる = ブラウザキャッシュが毎回外れるため)
// thumb: true なら thumbs/ のサムネ URL。サムネが無い旧写真は自動で原寸にフォールバック
// 戻り値: URL 文字列 / 失敗時 null
const PHOTO_URL_TTL = 604800   // 7日
async function signedPhotoUrl(path, { thumb = false } = {}) {
  if (!path) return null
  const target = thumb ? `thumbs/${path}` : path
  const key = `su_${target}`
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null')
    if (c && c.exp - 3600 > Date.now() / 1000) return c.url   // 残り1時間を切ったら発行し直す
  } catch (_) {}
  const { data, error } = await _sb.storage.from('memories').createSignedUrl(target, PHOTO_URL_TTL)
  if (error || !data?.signedUrl) {
    if (thumb) return signedPhotoUrl(path)   // サムネ未生成 (旧写真) → 原寸で
    console.error('[photo] 署名URL失敗:', path, error?.message)
    return null
  }
  try {
    localStorage.setItem(key, JSON.stringify({ url: data.signedUrl, exp: Math.floor(Date.now() / 1000) + PHOTO_URL_TTL }))
  } catch (_) {}
  return data.signedUrl
}

// 写真の削除 (本体 + サムネ + URLキャッシュ)。戻り値: { error }
// ※ removePhoto という名前はページ内関数と衝突するため使わない (color_hunting.html)
async function removeStoredPhoto(path) {
  const { error } = await _sb.storage.from('memories').remove([path])
  await _sb.storage.from('memories').remove([`thumbs/${path}`]).catch(() => {})
  clearPhotoUrlCache(path)
  return { error }
}

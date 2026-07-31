// 共通ユーティリティ (全ページで header.js 等と一緒に読み込む)
// 依存: 各ページで定義されるグローバルの Supabase クライアント `_sb`

// このファイルが属するデプロイのバージョン。`scripts/bump_version.sh` が書き換える
const APP_VERSION = '202607311750'

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
// バケットは非公開の memories を使い、署名付きURL(1時間)なので予定の内容は外に漏れない
// targetWindow: タップ直後に window.open('', '_blank') で開いておいた窓を渡す。
//   await の後に window.open するとユーザー操作の文脈が切れて iOS/Safari にブロックされるため
// 戻り値: 'opened' | 'failed'
async function openIcsInCalendar(event, targetWindow) {
  try {
    const { data: { session } } = await _sb.auth.getSession()
    if (!session) return 'failed'
    const ics = buildIcs(event)
    const safeName = String(event.uid || 'event').replace(/[^\w.-]/g, '_')
    const path = `ics/${session.user.id}/${safeName}.ics`
    const blob = new Blob([ics], { type: 'text/calendar' })

    const { error: upErr } = await _sb.storage.from('memories')
      .upload(path, blob, { contentType: 'text/calendar', upsert: true })
    if (upErr) { console.error('[ics] アップロード失敗:', upErr.message); return 'failed' }

    const { data, error } = await _sb.storage.from('memories').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) { console.error('[ics] 署名付きURL失敗:', error?.message); return 'failed' }

    // 先に開いておいた窓があればそこへ、無ければ同じタブで開く
    if (targetWindow && !targetWindow.closed) targetWindow.location.href = data.signedUrl
    else location.href = data.signedUrl
    return 'opened'
  } catch (e) {
    console.error('[ics] カレンダーで開けませんでした:', e)
    return 'failed'
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

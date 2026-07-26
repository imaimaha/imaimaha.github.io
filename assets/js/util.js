// 共通ユーティリティ (全ページで header.js 等と一緒に読み込む)
// 依存: 各ページで定義されるグローバルの Supabase クライアント `_sb`

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

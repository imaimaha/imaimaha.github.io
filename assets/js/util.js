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

// JST の今日 (YYYY-MM-DD)
function jstDateStr(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

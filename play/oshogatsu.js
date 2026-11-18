// oshogatsu.js — お正月期間（毎年 12/29 0:00 〜 1/7 23:59 日本時間。年をまたぐ）の見た目だけを切りかえる小さな道具。
// 原本は _shared/oshogatsu.js。各ゲームのフォルダにコピーして使う（おかず・いもむし）。クリスマスは _shared/xmas.js（別のもの）
// - 問題（今日の問題のたね・盤面）は変えない。見た目・ことばだけ
// - 確認用: URL に ?shogatsuPreview=1（期間外でもお正月にする）／ ?shogatsuPreview=0（期間中でもふつう）。
//   または localStorage の shogatsuPreview = '1'。どちらもふつうに遊ぶ人はさわれない（アプリは URL を変えられない）
(function () {
  if (typeof window === 'undefined') return;
  var forced = null;
  try { var m = /[?&]shogatsuPreview=([01])\b/.exec(location.search || ''); if (m) forced = m[1] === '1'; } catch (e) { /* noop */ }
  if (forced === null) { try { if (localStorage.getItem('shogatsuPreview') === '1') forced = true; } catch (e) { /* noop */ } }
  function jst(t) { return new Date((t == null ? Date.now() : t) + 9 * 3600000); }
  function md(mo, d) { return (mo === 12 && d >= 29 && d <= 31) || (mo === 1 && d >= 1 && d <= 7); }
  // 日本時間で 12月29日〜1月7日か（年をまたぐ）
  function inPeriod(t) { var d = jst(t); return md(d.getUTCMonth() + 1, d.getUTCDate()); }
  // 'YYYY-MM-DD' / 'YYYY-M-D' の日が期間か（過去の問題の日など）
  function dayIn(day) { var p = String(day || '').split('-'); return md(+p[1], +p[2]); }
  function active() { return forced !== null ? forced : inPeriod(); }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  // タイトルの小さな帯「1/7 まで お正月」（動かない）
  function banner(parent, before) {
    if (!parent) return null;
    var b = parent.querySelector('.shogatsu-banner');
    if (b) return b;
    b = document.createElement('div');
    b.className = 'shogatsu-banner';
    b.textContent = '1/7 まで お正月';
    b.style.cssText = 'display:block;width:max-content;margin:6px auto;padding:4px 14px 5px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.06em;' +
      'color:#fff;background:linear-gradient(90deg,#c0262d,#d4462f);border:1.5px solid #e2b64a;box-shadow:0 2px 8px #0003;pointer-events:none;';
    if (before) parent.insertBefore(b, before); else parent.appendChild(b);
    return b;
  }

  window.Shogatsu = { active: active, inPeriod: inPeriod, dayIn: dayIn, reduced: reduced, banner: banner, preview: forced === true };
})();

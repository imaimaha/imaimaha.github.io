// 筋トレしよ！ 日替わりお題プール。
// 各日は3step: step1=ウォームアップ(軽め) / step2=メイン種目 / step3=ふたりチャレンジ(二人ともクリアで+pt)
// base は基準回数/秒数。表示時に各ユーザーの workout_level (デフォ1.0) を掛けて個人差を反映する
// fixed:true の種目 (動画系など) は体力差でスケーリングしない。二人とも同じ目安になる
// 選出は quiz.html と同じ日付ベース index (WORKOUT_POOL.length で割った余り)
//
// ⚠️ お題を追加/変更する時のルール:
//   - step3 (ふたりチャレンジ) は必ず「動画を一緒にやる」お題にする (2026-08-01〜のユーザー方針)。
//     ジャンルは筋トレ/ヨガ/ダンス/ピラティス/HIIT/ストレッチ等。全部 fixed:true (体力差でスケールしない)
//   - 同じ日の step2 と step3 に同じ種目を置かない (step2 が動画の日は step3 は別ジャンルの動画)
const WORKOUT_POOL = [
  { step1:{ex:'足踏み',            base:30,unit:'回'}, step2:{ex:'スクワット',           base:15,unit:'回'}, step3:{ex:'🔥 ふたりで 中山きんに君の筋トレ動画', base:1, unit:'本', fixed:true} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'腕立て伏せ(膝つきOK)', base:10,unit:'回'}, step3:{ex:'🧘 ふたりで ヨガ動画',               base:15,unit:'分', fixed:true} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'💃 ふたりで ダンス動画',             base:1, unit:'曲分', fixed:true} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:10,unit:'回ずつ'}, step3:{ex:'🤸 ふたりで ピラティス動画',       base:15,unit:'分', fixed:true} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'プランク',              base:20,unit:'秒キープ'}, step3:{ex:'🥊 ふたりで シャドーボクシング動画', base:10,unit:'分', fixed:true} },
  { step1:{ex:'かかと上げ',        base:20,unit:'回'}, step2:{ex:'もも上げ',              base:30,unit:'秒'}, step3:{ex:'🏃 ふたりで HIIT動画',               base:10,unit:'分', fixed:true} },
  { step1:{ex:'手首足首ぐるぐる',  base:10,unit:'回'}, step2:{ex:'ヒップリフト',          base:15,unit:'回'}, step3:{ex:'🕺 ふたりで K-POPダンス動画',        base:1, unit:'曲分', fixed:true} },
  { step1:{ex:'その場足踏み',      base:40,unit:'回'}, step2:{ex:'スクワット',            base:20,unit:'回'}, step3:{ex:'🧎 ふたりで ストレッチ動画',         base:10,unit:'分', fixed:true} },
  { step1:{ex:'肩甲骨寄せ',        base:10,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:12,unit:'回'}, step3:{ex:'🩰 ふたりで バレエワークアウト動画', base:10,unit:'分', fixed:true} },
  { step1:{ex:'軽くその場ジョグ',  base:30,unit:'秒'}, step2:{ex:'腹筋(クランチ)',        base:25,unit:'回'}, step3:{ex:'📻 ふたりで ラジオ体操 第一＋第二',  base:1, unit:'セット', fixed:true} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'サイドランジ左右',     base:8, unit:'回ずつ'}, step3:{ex:'🕴 ふたりで ズンバ動画',          base:1, unit:'曲分', fixed:true} },
  { step1:{ex:'腕ぶらぶら',        base:20,unit:'秒'}, step2:{ex:'プランク',              base:25,unit:'秒キープ'}, step3:{ex:'🌴 ふたりで フラダンス動画',       base:1, unit:'曲分', fixed:true} },
  { step1:{ex:'つま先立ち',        base:15,unit:'回'}, step2:{ex:'カーフレイズ',          base:25,unit:'回'}, step3:{ex:'☯️ ふたりで 太極拳動画',            base:10,unit:'分', fixed:true} },
  { step1:{ex:'軽くスクワット',    base:10,unit:'回'}, step2:{ex:'ウォールシット',        base:20,unit:'秒'}, step3:{ex:'🦵 ふたりで 下半身トレ動画',         base:10,unit:'分', fixed:true} },
  { step1:{ex:'腕回し前後',        base:10,unit:'回ずつ'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'💪 ふたりで 二の腕トレ動画',       base:10,unit:'分', fixed:true} },
  { step1:{ex:'その場足踏み',      base:30,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:10,unit:'回'}, step3:{ex:'🧡 ふたりで 腹筋トレ動画',           base:10,unit:'分', fixed:true} },
  { step1:{ex:'股関節ぐるぐる',    base:5, unit:'回ずつ'}, step2:{ex:'スクワット',            base:18,unit:'回'}, step3:{ex:'🌙 ふたりで 寝る前ストレッチ動画', base:10,unit:'分', fixed:true} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'ヒップリフト',          base:15,unit:'回'}, step3:{ex:'🌅 ふたりで 朝ヨガ動画',             base:10,unit:'分', fixed:true} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'マウンテンクライマー',  base:20,unit:'回'}, step3:{ex:'🔥 ふたりで 中山きんに君の筋トレ動画', base:2, unit:'本', fixed:true} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:12,unit:'回ずつ'}, step3:{ex:'🧘 ふたりで ヨガ動画',            base:20,unit:'分', fixed:true} },
  { step1:{ex:'軽くその場ジョグ',  base:30,unit:'秒'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:12,unit:'回'}, step3:{ex:'💃 ふたりで ダンス動画',             base:2, unit:'曲分', fixed:true} },
  { step1:{ex:'手首足首ぐるぐる',  base:10,unit:'回'}, step2:{ex:'プランク',              base:25,unit:'秒キープ'}, step3:{ex:'🤸 ふたりで ピラティス動画',       base:20,unit:'分', fixed:true} },
  { step1:{ex:'かかと上げ',        base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:25,unit:'回'}, step3:{ex:'🥊 ふたりで シャドーボクシング動画', base:15,unit:'分', fixed:true} },
  { step1:{ex:'その場足踏み',      base:30,unit:'回'}, step2:{ex:'スクワット',            base:20,unit:'回'}, step3:{ex:'🏃 ふたりで HIIT動画',               base:15,unit:'分', fixed:true} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'スーパーマン(背筋)',    base:15,unit:'回'}, step3:{ex:'🕺 ふたりで K-POPダンス動画',      base:2, unit:'曲分', fixed:true} },
  { step1:{ex:'肩甲骨寄せ',        base:10,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:10,unit:'回'}, step3:{ex:'🧎 ふたりで ストレッチ動画',         base:15,unit:'分', fixed:true} },
  { step1:{ex:'軽くスクワット',    base:10,unit:'回'}, step2:{ex:'サイドランジ左右',      base:10,unit:'回ずつ'}, step3:{ex:'🩰 ふたりで バレエワークアウト動画', base:15,unit:'分', fixed:true} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'ヒップリフト',          base:18,unit:'回'}, step3:{ex:'📻 ふたりで ラジオ体操 第一＋第二',  base:2, unit:'セット', fixed:true} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'🕴 ふたりで ズンバ動画',             base:2, unit:'曲分', fixed:true} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:10,unit:'回ずつ'}, step3:{ex:'🌴 ふたりで フラダンス動画',      base:2, unit:'曲分', fixed:true} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'中山きんに君の筋トレ動画', base:1, unit:'本', fixed:true}, step3:{ex:'☯️ ふたりで 太極拳動画',        base:15,unit:'分', fixed:true} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'ヨガ動画',              base:15,unit:'分', fixed:true}, step3:{ex:'🦵 ふたりで 下半身トレ動画',    base:15,unit:'分', fixed:true} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'ダンス動画',            base:1, unit:'曲分', fixed:true}, step3:{ex:'💪 ふたりで 二の腕トレ動画',      base:15,unit:'分', fixed:true} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'スクワット',           base:15,unit:'回'}, step3:{ex:'🧡 ふたりで 腹筋トレ動画',          base:15,unit:'分', fixed:true} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'ヨガ動画',              base:20,unit:'分', fixed:true}, step3:{ex:'🌙 ふたりで 寝る前ストレッチ動画', base:15,unit:'分', fixed:true} },
  { step1:{ex:'腕ぶらぶら',        base:20,unit:'秒'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'🌅 ふたりで 朝ヨガ動画',             base:15,unit:'分', fixed:true} },
]

// 筋トレしよ！ 日替わりお題プール。
// 各日は3step: step1=ウォームアップ(軽め) / step2=メイン種目 / step3=ふたりチャレンジ(少しキツめ・二人ともクリアで+pt)
// base は基準回数/秒数。表示時に各ユーザーの workout_level (デフォ1.0) を掛けて個人差を反映する
// fixed:true の種目 (動画系など) は体力差でスケーリングしない。二人とも同じ目安になる
// 選出は quiz.html と同じ日付ベース index (WORKOUT_POOL.length で割った余り)
//
// ⚠️ お題を追加/変更する時のルール: 同じ日の step2 と step3 に「同じ種目」を置かないこと
// (回数違いだけだと同じことを2回やる感じになるため。step3 は step2 と同系統の別バリエーションにする)
const WORKOUT_POOL = [
  { step1:{ex:'足踏み',            base:30,unit:'回'}, step2:{ex:'スクワット',           base:15,unit:'回'}, step3:{ex:'ブルガリアンスクワット左右',   base:8, unit:'回ずつ'} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'腕立て伏せ(膝つきOK)', base:10,unit:'回'}, step3:{ex:'ダイヤモンドプッシュアップ',   base:8, unit:'回'} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'シットアップ(上体起こし)',     base:20,unit:'回'} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:10,unit:'回ずつ'}, step3:{ex:'ウォーキングランジ',         base:20,unit:'歩'} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'プランク',              base:20,unit:'秒キープ'}, step3:{ex:'プランクアップダウン',       base:12,unit:'回'} },
  { step1:{ex:'かかと上げ',        base:20,unit:'回'}, step2:{ex:'もも上げ',              base:30,unit:'秒'}, step3:{ex:'スケータージャンプ左右',     base:30,unit:'回'} },
  { step1:{ex:'手首足首ぐるぐる',  base:10,unit:'回'}, step2:{ex:'ヒップリフト',          base:15,unit:'回'}, step3:{ex:'ドンキーキック左右',         base:15,unit:'回ずつ'} },
  { step1:{ex:'その場足踏み',      base:40,unit:'回'}, step2:{ex:'スクワット',            base:20,unit:'回'}, step3:{ex:'ジャンピングスクワット',     base:10,unit:'回'} },
  { step1:{ex:'肩甲骨寄せ',        base:10,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:12,unit:'回'}, step3:{ex:'デクラインプッシュアップ',   base:8, unit:'回'} },
  { step1:{ex:'軽くその場ジョグ',  base:30,unit:'秒'}, step2:{ex:'腹筋(クランチ)',        base:25,unit:'回'}, step3:{ex:'レッグレイズ',               base:15,unit:'回'} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'サイドランジ左右',     base:8, unit:'回ずつ'}, step3:{ex:'コサックスクワット左右',     base:8, unit:'回ずつ'} },
  { step1:{ex:'腕ぶらぶら',        base:20,unit:'秒'}, step2:{ex:'プランク',              base:25,unit:'秒キープ'}, step3:{ex:'サイドプランク左右',         base:20,unit:'秒ずつ'} },
  { step1:{ex:'つま先立ち',        base:15,unit:'回'}, step2:{ex:'カーフレイズ',          base:25,unit:'回'}, step3:{ex:'片脚カーフレイズ左右',       base:15,unit:'回ずつ'} },
  { step1:{ex:'軽くスクワット',    base:10,unit:'回'}, step2:{ex:'ウォールシット',        base:20,unit:'秒'}, step3:{ex:'パルススクワット',           base:20,unit:'回'} },
  { step1:{ex:'腕回し前後',        base:10,unit:'回ずつ'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'バイシクルクランチ',         base:20,unit:'回'} },
  { step1:{ex:'その場足踏み',      base:30,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:10,unit:'回'}, step3:{ex:'腕立て伏せ→腹筋 連続',       base:15,unit:'回ずつ'} },
  { step1:{ex:'股関節ぐるぐる',    base:5, unit:'回ずつ'}, step2:{ex:'スクワット',            base:18,unit:'回'}, step3:{ex:'スクワット(ボトム静止)',     base:10,unit:'秒キープ'} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'ヒップリフト',          base:15,unit:'回'}, step3:{ex:'片脚ヒップリフト左右',       base:8, unit:'回ずつ'} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'マウンテンクライマー',  base:20,unit:'回'}, step3:{ex:'スパイダープランク左右',     base:12,unit:'回ずつ'} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:12,unit:'回ずつ'}, step3:{ex:'ジャンピングランジ左右',     base:8, unit:'回ずつ'} },
  { step1:{ex:'軽くその場ジョグ',  base:30,unit:'秒'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:12,unit:'回'}, step3:{ex:'バーピー',                   base:5, unit:'回'} },
  { step1:{ex:'手首足首ぐるぐる',  base:10,unit:'回'}, step2:{ex:'プランク',              base:25,unit:'秒キープ'}, step3:{ex:'プランクで肩タッチ左右',     base:10,unit:'回ずつ'} },
  { step1:{ex:'かかと上げ',        base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:25,unit:'回'}, step3:{ex:'Vシット',                    base:10,unit:'回'} },
  { step1:{ex:'その場足踏み',      base:30,unit:'回'}, step2:{ex:'スクワット',            base:20,unit:'回'}, step3:{ex:'スモウスクワット',           base:20,unit:'回'} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'スーパーマン(背筋)',    base:15,unit:'回'}, step3:{ex:'スイマー(背筋バタ足)',       base:40,unit:'秒'} },
  { step1:{ex:'肩甲骨寄せ',        base:10,unit:'回'}, step2:{ex:'腕立て伏せ(膝つきOK)',  base:10,unit:'回'}, step3:{ex:'ワイドプッシュアップ',       base:10,unit:'回'} },
  { step1:{ex:'軽くスクワット',    base:10,unit:'回'}, step2:{ex:'サイドランジ左右',      base:10,unit:'回ずつ'}, step3:{ex:'カーフレイズ+スクワット',    base:20,unit:'回ずつ'} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'ヒップリフト',          base:18,unit:'回'}, step3:{ex:'プランク',                   base:35,unit:'秒キープ'} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'ロシアンツイスト',           base:20,unit:'回'} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'ランジ左右',           base:10,unit:'回ずつ'}, step3:{ex:'ランジ+スクワット',          base:15,unit:'回ずつ'} },
  { step1:{ex:'深呼吸ストレッチ',  base:30,unit:'秒'}, step2:{ex:'中山きんに君の筋トレ動画', base:1, unit:'本', fixed:true}, step3:{ex:'腹筋(クランチ)',             base:25,unit:'回'} },
  { step1:{ex:'肩まわし前後',      base:10,unit:'回ずつ'}, step2:{ex:'ヨガ動画',              base:15,unit:'分', fixed:true}, step3:{ex:'プランク',                   base:35,unit:'秒キープ'} },
  { step1:{ex:'その場ジャンプ',    base:20,unit:'回'}, step2:{ex:'ダンス動画',            base:1, unit:'曲分', fixed:true}, step3:{ex:'スクワット',                 base:20,unit:'回'} },
  { step1:{ex:'首まわし左右',      base:5, unit:'回ずつ'}, step2:{ex:'スクワット',           base:15,unit:'回'}, step3:{ex:'🔥 ふたりで中山きんに君の動画', base:1, unit:'本', fixed:true} },
  { step1:{ex:'体側伸ばし左右',    base:15,unit:'秒ずつ'}, step2:{ex:'ヨガ動画',              base:20,unit:'分', fixed:true}, step3:{ex:'ヒップリフト',               base:20,unit:'回'} },
  { step1:{ex:'腕ぶらぶら',        base:20,unit:'秒'}, step2:{ex:'腹筋(クランチ)',        base:20,unit:'回'}, step3:{ex:'🔥 ふたりでダンス動画',       base:1, unit:'曲分', fixed:true} },
]

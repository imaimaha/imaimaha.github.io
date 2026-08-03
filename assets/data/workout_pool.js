// 筋トレしよ！ 日替わりお題プール。
// 各日は3step: step1=ウォームアップ(軽め) / step2=メイン種目 / step3=ふたりチャレンジ(二人ともクリアで+pt)
// base は基準回数/秒数。表示時に各ユーザーの workout_level (デフォ1.0) を掛けて個人差を反映する
// fixed:true の種目 (動画系など) は体力差でスケーリングしない。二人とも同じ目安になる
// 選出は quiz.html と同じ日付ベース index (WORKOUT_POOL.length で割った余り)
//
// ⚠️ お題を追加/変更する時のルール:
//   - **area** … その日のテーマ部位。ユーザー要望 (2026-08-04) の6部位を順番に回す:
//     🦵脚 / 💪二の腕 / 🔙背中 / 🫃おなか / ⌛腰(くびれ) / 😊顔まわり
//     step1〜step3 はできるだけその部位に効くものを選ぶ
//   - **step3 は必ず「動画を一緒にやる」お題**にする (2026-08-01〜)。全部 fixed:true
//   - 同じ日の step2 と step3 に同じ種目を置かない
const AREAS = {
  legs:  { emoji: '🦵', label: '脚ほそく' },
  arms:  { emoji: '💪', label: '二の腕ほそく' },
  back:  { emoji: '🔙', label: '背中のお肉' },
  belly: { emoji: '🫃', label: 'おなか撲滅' },
  waist: { emoji: '⌛', label: '腰・くびれ' },
  face:  { emoji: '😊', label: '顔まわりすっきり' },
}

const WORKOUT_POOL = [
  // ── 1周目 ──
  { area:'legs',  step1:{ex:'足踏み',              base:30,unit:'回'},     step2:{ex:'ワイドスクワット（内もも）',   base:15,unit:'回'},     step3:{ex:'🦵 ふたりで 脚やせ動画',           base:10,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'腕を大きく回す',      base:10,unit:'回ずつ'}, step2:{ex:'二の腕ねじり（腕を後ろで）',   base:20,unit:'回'},     step3:{ex:'💪 ふたりで 二の腕やせ動画',       base:10,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'肩甲骨寄せ',          base:10,unit:'回'},     step2:{ex:'スーパーマン（背筋）',         base:15,unit:'回'},     step3:{ex:'🔙 ふたりで 背中やせ動画',         base:10,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'ドローイン（お腹をへこます）', base:30,unit:'秒'}, step2:{ex:'腹筋（クランチ）',        base:20,unit:'回'},     step3:{ex:'🫃 ふたりで 腹筋トレ動画',         base:10,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'腰まわし（フラフープの動き）', base:10,unit:'回ずつ'}, step2:{ex:'ツイストクランチ',      base:20,unit:'回'},     step3:{ex:'⌛ ふたりで くびれ作り動画',       base:10,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'首をゆっくり回す',    base:5, unit:'回ずつ'}, step2:{ex:'舌回し（口の中で大きく）',     base:10,unit:'回ずつ'}, step3:{ex:'😊 ふたりで 顔ヨガ動画',           base:8, unit:'分', fixed:true} },

  // ── 2周目 ──
  { area:'legs',  step1:{ex:'かかと上げ',          base:20,unit:'回'},     step2:{ex:'脚パカ（寝て開閉）',           base:20,unit:'回'},     step3:{ex:'🦵 ふたりで 内もも痩せ動画',       base:10,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'肩まわし前後',        base:10,unit:'回ずつ'}, step2:{ex:'リバースプッシュアップ（椅子）', base:10,unit:'回'},   step3:{ex:'💪 ふたりで 腕ほそく動画',         base:10,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'腕ぶらぶら',          base:20,unit:'秒'},     step2:{ex:'タオルラットプルダウン',       base:15,unit:'回'},     step3:{ex:'🔙 ふたりで 背中スッキリ動画',     base:12,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'深呼吸ストレッチ',    base:30,unit:'秒'},     step2:{ex:'レッグレイズ',                 base:15,unit:'回'},     step3:{ex:'🫃 ふたりで お腹まわり動画',       base:12,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'体側伸ばし左右',      base:15,unit:'秒ずつ'}, step2:{ex:'サイドベンド左右',             base:15,unit:'回ずつ'}, step3:{ex:'⌛ ふたりで ウエストひねり動画',   base:10,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'肩を上げて落とす',    base:10,unit:'回'},     step2:{ex:'あいうえお体操（大きく口を動かす）', base:2,unit:'セット'}, step3:{ex:'😊 ふたりで 小顔リンパ動画',    base:8, unit:'分', fixed:true} },

  // ── 3周目 ──
  { area:'legs',  step1:{ex:'その場足踏み',        base:40,unit:'回'},     step2:{ex:'スクワット',                   base:20,unit:'回'},     step3:{ex:'🦵 ふたりで 下半身トレ動画',       base:12,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'手首足首ぐるぐる',    base:10,unit:'回'},     step2:{ex:'腕立て伏せ（膝つきOK）',       base:10,unit:'回'},     step3:{ex:'💪 ふたりで 振袖しめる動画',       base:10,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'猫のポーズで背中丸める', base:20,unit:'秒'},  step2:{ex:'リバースフライ（腕を横に開く）', base:20,unit:'回'},   step3:{ex:'🔙 ふたりで 姿勢改善ヨガ動画',     base:12,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'その場ジャンプ',      base:20,unit:'回'},     step2:{ex:'プランク',                     base:30,unit:'秒キープ'}, step3:{ex:'🫃 ふたりで ぽっこりお腹動画',   base:10,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'股関節ぐるぐる',      base:5, unit:'回ずつ'}, step2:{ex:'ロシアンツイスト',             base:24,unit:'回'},     step3:{ex:'⌛ ふたりで 腰まわりスッキリ動画', base:10,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'耳をやさしく回す',    base:10,unit:'回'},     step2:{ex:'首すじリンパ流し（耳下→肩）',  base:20,unit:'回'},     step3:{ex:'😊 ふたりで フェイスライン動画',   base:8, unit:'分', fixed:true} },

  // ── 4周目 ──
  { area:'legs',  step1:{ex:'つま先立ち',          base:15,unit:'回'},     step2:{ex:'ヒップアブダクション（横に脚上げ）', base:15,unit:'回ずつ'}, step3:{ex:'🦵 ふたりで 太ももすきま動画', base:10,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'ペットボトル持って前ならえ', base:20,unit:'秒'}, step2:{ex:'フレンチプレス（ペットボトル）', base:15,unit:'回'},  step3:{ex:'💪 ふたりで 肩と腕やせ動画',       base:10,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'肩甲骨寄せ',          base:12,unit:'回'},     step2:{ex:'バックエクステンション',       base:20,unit:'回'},     step3:{ex:'🔙 ふたりで ブラのお肉動画',       base:10,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'軽くその場ジョグ',    base:30,unit:'秒'},     step2:{ex:'バイシクルクランチ',           base:24,unit:'回'},     step3:{ex:'🫃 ふたりで 腹筋わりたい動画',     base:12,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'腰を左右にスライド',  base:20,unit:'回'},     step2:{ex:'サイドプランク左右',           base:20,unit:'秒ずつ'}, step3:{ex:'⌛ ふたりで くびれHIIT動画',       base:10,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'目をぎゅっと開閉',    base:10,unit:'回'},     step2:{ex:'ほお（頬）を持ち上げるキープ', base:20,unit:'秒'},     step3:{ex:'😊 ふたりで 顔のむくみとり動画',   base:8, unit:'分', fixed:true} },

  // ── 5周目 ──
  { area:'legs',  step1:{ex:'軽くスクワット',      base:10,unit:'回'},     step2:{ex:'ブルガリアンスクワット左右',   base:8, unit:'回ずつ'}, step3:{ex:'🦵 ふたりで ふくらはぎ動画',       base:10,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'腕回し前後',          base:10,unit:'回ずつ'}, step2:{ex:'ナロープッシュアップ',         base:8, unit:'回'},     step3:{ex:'💪 ふたりで 上半身やせ動画',       base:12,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'体側伸ばし左右',      base:15,unit:'秒ずつ'}, step2:{ex:'スイマー（背筋バタ足）',       base:40,unit:'秒'},     step3:{ex:'🔙 ふたりで 背中の引き締め動画',   base:10,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'ドローイン',          base:30,unit:'秒'},     step2:{ex:'Vシット',                      base:10,unit:'回'},     step3:{ex:'🫃 ふたりで 下腹部トレ動画',       base:10,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'腰まわし',            base:10,unit:'回ずつ'}, step2:{ex:'ヒップリフト＋ひねり',         base:15,unit:'回'},     step3:{ex:'⌛ ふたりで ウエスト集中動画',     base:12,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'首を左右に倒す',      base:15,unit:'秒ずつ'}, step2:{ex:'舌を思いきり出してキープ',     base:15,unit:'秒'},     step3:{ex:'😊 ふたりで 二重あご解消動画',     base:8, unit:'分', fixed:true} },

  // ── 6周目 (少しキツめの日) ──
  { area:'legs',  step1:{ex:'その場ジャンプ',      base:20,unit:'回'},     step2:{ex:'ジャンピングスクワット',       base:12,unit:'回'},     step3:{ex:'🦵 ふたりで 脚やせHIIT動画',       base:12,unit:'分', fixed:true} },
  { area:'arms',  step1:{ex:'肩まわし前後',        base:10,unit:'回ずつ'}, step2:{ex:'ダイヤモンドプッシュアップ',   base:8, unit:'回'},     step3:{ex:'💪 ふたりで 腕トレ動画',           base:12,unit:'分', fixed:true} },
  { area:'back',  step1:{ex:'肩を回す',            base:12,unit:'回'},     step2:{ex:'タオルで背中プル（座って）',   base:20,unit:'回'},     step3:{ex:'🔙 ふたりで 背中痩せHIIT動画',     base:10,unit:'分', fixed:true} },
  { area:'belly', step1:{ex:'もも上げ',            base:30,unit:'秒'},     step2:{ex:'マウンテンクライマー',         base:24,unit:'回'},     step3:{ex:'🫃 ふたりで お腹HIIT動画',         base:10,unit:'分', fixed:true} },
  { area:'waist', step1:{ex:'体をひねる（立って）', base:20,unit:'回'},    step2:{ex:'ツイストランジ左右',           base:12,unit:'回ずつ'}, step3:{ex:'⌛ ふたりで 腰肉おさらば動画',     base:12,unit:'分', fixed:true} },
  { area:'face',  step1:{ex:'深呼吸ストレッチ',    base:30,unit:'秒'},     step2:{ex:'フェイスヨガ（あ・い・う・べ）', base:3, unit:'セット'}, step3:{ex:'😊 ふたりで 顔ヨガ＋首ストレッチ動画', base:8, unit:'分', fixed:true} },
]

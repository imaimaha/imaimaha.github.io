/*
 * オンライン対戦の設定（Supabase）。README の「オンライン対戦の設定」を見て入れる。
 * 空のあいだは、オンライン対戦のボタンが「準備中」になる（CPU 対戦と2人で1台はそのまま遊べる）。
 * ここに入れるのは公開してよい publishable（anon）キー。service_role キーは絶対に入れない。
 */
var DUEL_CONFIG = {
  SUPABASE_URL: 'https://yfkxdknkxpkxzybrgofc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_m1Mcfub-CFd6I9-OgQC9Rw_tm-I9x7s'
};

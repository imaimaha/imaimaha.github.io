-- ガチャのポイント付与券: bonus_points を券に記録して、使用済みにしたタイミングで points に加算する
alter table gacha_results add column if not exists bonus_points integer;

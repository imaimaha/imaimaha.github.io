-- 目標達成するよ〜: ステップの並び替え・達成取り消し(進捗編集)対応
-- awarded は「ポイントを付与済みか」を done とは別に管理し、チェックの付け外しで再付与されないようにする
ALTER TABLE goal_steps ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE goal_steps ADD COLUMN IF NOT EXISTS awarded boolean NOT NULL DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS awarded boolean NOT NULL DEFAULT false;

-- 既存行: 作成順を初期の並び順として採用、既にdone済みのものはpt付与済み扱いにする
UPDATE goal_steps SET sort_order = sub.rn
FROM (SELECT id, row_number() OVER (PARTITION BY goal_id ORDER BY created_at) AS rn FROM goal_steps) sub
WHERE goal_steps.id = sub.id AND goal_steps.sort_order = 0;
UPDATE goal_steps SET awarded = true WHERE done = true;
UPDATE goals SET awarded = true WHERE status = 'done';

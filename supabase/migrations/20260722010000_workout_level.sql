-- 筋トレしよ！: 二人の体力差を反映するための個人係数。お題の基準回数に掛けて表示する (デフォ1.0=等倍)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_level numeric NOT NULL DEFAULT 1.0;

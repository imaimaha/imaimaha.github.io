-- 予定の対象者: NULL = ふたりの予定 / user_id = その人だけの予定
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id uuid;

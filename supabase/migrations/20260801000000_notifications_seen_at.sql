-- 🔔ベルのバッジ用: 「お知らせセンターを最後に開いた時刻」
-- 各通知の既読 (notifications_log.read_at) とは別概念。
-- ベルのバッジ = この時刻より後に届いた通知の件数 → お知らせを開いた時点で0になる
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz;

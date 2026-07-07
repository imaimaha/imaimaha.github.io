-- Edge Functions (service_role) が全テーブルを操作できるよう一括 GRANT
-- send-reminders, notify-capsules 等が points/notifications_sent 等を読み書きするために必要
GRANT SELECT, INSERT, UPDATE, DELETE ON points TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications_sent TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON time_capsules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON bingo_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON closer_gauge TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON color_hunts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON gacha_custom_prizes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON gacha_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_answers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON thanks_posts TO service_role;

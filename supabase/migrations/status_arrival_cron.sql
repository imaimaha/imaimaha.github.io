-- 帰宅時間の 5分前 / 時間ちょうど にパートナーへ Push 通知
-- 5分毎に走らせ、send-reminders 内で対象時刻±3分の判定を行う
-- notifications_sent で owner-user × kind × 日付 で dedup

-- 既存の同名ジョブを先に unschedule
DO $$
BEGIN
  PERFORM cron.unschedule('remind_status_5min_before');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('remind_status_arrival');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'remind_status_5min_before',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdm5maXF5amZhamx6YmRxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxMjIzOSwiZXhwIjoyMDk2Mzg4MjM5fQ.OFPNvp36xRXGc_G6YSJCXYHQEn5TjjKK81t6LCbbdLQ"}'::jsonb,
      body := '{"kind": "status_5min_before"}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'remind_status_arrival',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdm5maXF5amZhamx6YmRxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxMjIzOSwiZXhwIjoyMDk2Mzg4MjM5fQ.OFPNvp36xRXGc_G6YSJCXYHQEn5TjjKK81t6LCbbdLQ"}'::jsonb,
      body := '{"kind": "status_arrival"}'::jsonb
    );
  $$
);

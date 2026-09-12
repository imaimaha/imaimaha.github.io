-- 1日の終わり (JST 23:00) にその日まだ日記を書いていない人へリマインド
DO $$
BEGIN
  PERFORM cron.unschedule('remind_diary_evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'remind_diary_evening',
  '0 14 * * *',
  $$
    SELECT net.http_post(
      url := 'https://qivnfiqyjfajlzbdqodd.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_KEY_PLACEHOLDER>"}'::jsonb,
      body := '{"kind": "diary_evening"}'::jsonb
    );
  $$
);

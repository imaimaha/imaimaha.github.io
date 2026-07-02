-- 毎朝6時JST（21:00 UTC）にstatusをクリアするpg_cron用関数
create or replace function daily_status_reset()
returns void
language plpgsql
security definer
as $$
begin
  delete from status;
end;
$$;

-- 既存のcronスケジュール（参考）: 0 21 * * * → JST 06:00

-- 日記に写真を1枚添付できるように
alter table diary_entries add column if not exists photo_path text;

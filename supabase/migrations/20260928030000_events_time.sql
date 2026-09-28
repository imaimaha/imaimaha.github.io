-- カレンダーの予定に時刻(任意)を登録できるように
alter table events add column if not exists time text;

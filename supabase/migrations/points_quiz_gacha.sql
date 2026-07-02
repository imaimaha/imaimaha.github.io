-- ポイント履歴
create table if not exists points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount int not null,
  reason text not null,
  created_at timestamptz default now()
);
alter table points enable row level security;
create policy "points_select" on points for select using (auth.uid() is not null);
create policy "points_insert" on points for insert with check (user_id = auth.uid());
grant select, insert on points to authenticated;

-- クイズ回答
create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id int not null,
  answer text not null,
  date_str text not null,
  answered_at timestamptz default now()
);
alter table quiz_answers enable row level security;
create policy "quiz_select" on quiz_answers for select using (auth.uid() is not null);
create policy "quiz_insert" on quiz_answers for insert with check (user_id = auth.uid());
grant select, insert on quiz_answers to authenticated;

-- ガチャ結果
create table if not exists gacha_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  reward_id int not null,
  reward_name text not null,
  reward_emoji text not null,
  rarity text not null,
  used boolean default false,
  created_at timestamptz default now()
);
alter table gacha_results enable row level security;
create policy "gacha_select" on gacha_results for select using (auth.uid() is not null);
create policy "gacha_insert" on gacha_results for insert with check (user_id = auth.uid());
create policy "gacha_update" on gacha_results for update using (user_id = auth.uid());
grant select, insert, update on gacha_results to authenticated;

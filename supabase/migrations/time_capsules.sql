create table if not exists time_capsules (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  message text not null,
  created_at timestamptz default now(),
  open_at timestamptz not null,
  opened_at timestamptz,
  is_opened boolean default false
);

alter table time_capsules enable row level security;

-- 送信者は自分が送ったカプセルを常に見られる
create policy "sender_view" on time_capsules for select
  using (sender_id = auth.uid());

-- 受信者は開封予定日を過ぎたもの（または開封済み）を見られる
create policy "recipient_view" on time_capsules for select
  using (recipient_id = auth.uid() and open_at <= now());

-- 送信者として登録できる
create policy "sender_insert" on time_capsules for insert
  with check (sender_id = auth.uid());

-- 受信者が開封できる（is_opened = true に更新）
create policy "recipient_open" on time_capsules for update
  using (recipient_id = auth.uid());

-- ログイン済みユーザーにテーブルアクセス権を付与（RLS で細かく制御）
grant select, insert, update on time_capsules to authenticated;

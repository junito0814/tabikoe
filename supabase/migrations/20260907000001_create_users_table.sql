-- F-AC-01 Task2: public.users テーブルの作成
-- 出典: docs/tasks/account/signup-login/02-users-table-migration.md
--
-- auth.users と同一IDで1対1対応させる。カラム構成・RLSポリシーは要件定義書5.3準拠。

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  idp_provider text not null,
  idp_subject text not null,
  email text not null,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  is_deleted boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  constraint users_idp_identity_unique unique (idp_provider, idp_subject)
);

alter table public.users enable row level security;

-- 本人のみ自分の行をSELECT/UPDATEできる。
-- Service Role Key（Route Handlers）はRLSを回避して全行にアクセスできるため、
-- 初回レコード作成（Task5）や管理者による操作はここにポリシーを追加しない。
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

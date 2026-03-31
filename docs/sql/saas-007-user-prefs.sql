-- SkillAtlas SaaS - 007
-- Persist global UI prefs in DB (per user).
--
-- Run this in Supabase SQL editor.
-- This keeps localStorage as an offline-first cache, but syncs when authenticated.

create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_prefs_set_updated_at on public.user_prefs;
create trigger user_prefs_set_updated_at
before update on public.user_prefs
for each row
execute function public.set_updated_at();

alter table public.user_prefs enable row level security;

drop policy if exists "user_prefs_select_own" on public.user_prefs;
create policy "user_prefs_select_own"
on public.user_prefs
for select
using (auth.uid() = user_id);

drop policy if exists "user_prefs_insert_own" on public.user_prefs;
create policy "user_prefs_insert_own"
on public.user_prefs
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_prefs_update_own" on public.user_prefs;
create policy "user_prefs_update_own"
on public.user_prefs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


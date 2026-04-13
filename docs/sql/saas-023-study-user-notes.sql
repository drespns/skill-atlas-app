-- saas-023: /study — notas persistentes por usuario (además de session_notes en study_workspaces)
-- Ejecutar en Supabase SQL Editor tras saas-020+.

create extension if not exists pgcrypto;

create table if not exists public.study_user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_user_notes_user_sort_idx on public.study_user_notes (user_id, sort_order asc, created_at desc);

drop trigger if exists study_user_notes_set_updated_at on public.study_user_notes;
create trigger study_user_notes_set_updated_at
before update on public.study_user_notes
for each row execute function public.set_updated_at();

alter table public.study_user_notes enable row level security;

drop policy if exists "study_user_notes_select_own" on public.study_user_notes;
create policy "study_user_notes_select_own"
on public.study_user_notes
for select
using (auth.uid() = user_id);

drop policy if exists "study_user_notes_insert_own" on public.study_user_notes;
create policy "study_user_notes_insert_own"
on public.study_user_notes
for insert
with check (auth.uid() = user_id);

drop policy if exists "study_user_notes_update_own" on public.study_user_notes;
create policy "study_user_notes_update_own"
on public.study_user_notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_user_notes_delete_own" on public.study_user_notes;
create policy "study_user_notes_delete_own"
on public.study_user_notes
for delete
using (auth.uid() = user_id);

-- saas-020: /study fase 1 (fuentes + workspace) con RLS
-- Objetivo: persistir fuentes (links/notas) y estado de workspace (activeIds + sessionNotes).

create extension if not exists pgcrypto;

-- Fuentes del usuario (links / notas)
create table if not exists public.study_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null,
  url text null,
  body text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_sources enable row level security;

alter table public.study_sources
  drop constraint if exists study_sources_kind_check;

alter table public.study_sources
  add constraint study_sources_kind_check
  check (kind in ('note','link'));

create index if not exists study_sources_user_created_idx on public.study_sources (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_sources_set_updated_at on public.study_sources;
create trigger study_sources_set_updated_at
before update on public.study_sources
for each row execute function public.set_updated_at();

-- Workspace (1 fila por usuario)
create table if not exists public.study_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_ids text[] not null default '{}',
  session_notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.study_workspaces enable row level security;

drop trigger if exists study_workspaces_set_updated_at on public.study_workspaces;
create trigger study_workspaces_set_updated_at
before update on public.study_workspaces
for each row execute function public.set_updated_at();

-- RLS policies
drop policy if exists "study_sources_select_own" on public.study_sources;
create policy "study_sources_select_own"
on public.study_sources
for select
using (auth.uid() = user_id);

drop policy if exists "study_sources_insert_own" on public.study_sources;
create policy "study_sources_insert_own"
on public.study_sources
for insert
with check (auth.uid() = user_id);

drop policy if exists "study_sources_update_own" on public.study_sources;
create policy "study_sources_update_own"
on public.study_sources
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_sources_delete_own" on public.study_sources;
create policy "study_sources_delete_own"
on public.study_sources
for delete
using (auth.uid() = user_id);

drop policy if exists "study_workspaces_select_own" on public.study_workspaces;
create policy "study_workspaces_select_own"
on public.study_workspaces
for select
using (auth.uid() = user_id);

drop policy if exists "study_workspaces_insert_own" on public.study_workspaces;
create policy "study_workspaces_insert_own"
on public.study_workspaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "study_workspaces_update_own" on public.study_workspaces;
create policy "study_workspaces_update_own"
on public.study_workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_workspaces_delete_own" on public.study_workspaces;
create policy "study_workspaces_delete_own"
on public.study_workspaces
for delete
using (auth.uid() = user_id);


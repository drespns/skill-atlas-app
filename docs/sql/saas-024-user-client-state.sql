-- saas-024-user-client-state.sql
--
-- Persistencia de estado "cliente" por usuario (UI/FAB/tools/study cache)
-- Source of truth: DB. El frontend puede mantener cache local para offline.

create table if not exists public.user_client_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create index if not exists user_client_state_user_id_idx on public.user_client_state (user_id);

alter table public.user_client_state enable row level security;

drop policy if exists "user_client_state_select_own" on public.user_client_state;
create policy "user_client_state_select_own"
on public.user_client_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_client_state_insert_own" on public.user_client_state;
create policy "user_client_state_insert_own"
on public.user_client_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_client_state_update_own" on public.user_client_state;
create policy "user_client_state_update_own"
on public.user_client_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_client_state_delete_own" on public.user_client_state;
create policy "user_client_state_delete_own"
on public.user_client_state
for delete
to authenticated
using (auth.uid() = user_id);


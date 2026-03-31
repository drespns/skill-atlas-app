-- SkillAtlas SaaS - 010
-- Admin allowlist + admin-only access to access_requests.
--
-- Goals:
-- - Keep /request-access public (anon INSERT).
-- - Allow only allowlisted admins (by auth.uid) to SELECT/UPDATE/DELETE requests.
-- - Add minimal workflow fields to access_requests: status + handled_*.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);

alter table public.admin_users enable row level security;

-- Allow an admin to check their own admin membership.
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

-- Enrich access_requests with simple handling state (idempotent).
alter table public.access_requests
  add column if not exists status text not null default 'pending',
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users (id);

create index if not exists access_requests_created_at_idx on public.access_requests (created_at desc);
create index if not exists access_requests_status_idx on public.access_requests (status, created_at desc);

-- Admin-only read/update/delete policies.
drop policy if exists "access_requests_select_admin" on public.access_requests;
create policy "access_requests_select_admin"
on public.access_requests
for select
to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

drop policy if exists "access_requests_update_admin" on public.access_requests;
create policy "access_requests_update_admin"
on public.access_requests
for update
to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
)
with check (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);

drop policy if exists "access_requests_delete_admin" on public.access_requests;
create policy "access_requests_delete_admin"
on public.access_requests
for delete
to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
);


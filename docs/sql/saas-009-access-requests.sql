-- SkillAtlas SaaS - 009
-- Public access requests (invite-only funnel).
--
-- Allows anonymous users to submit an access request.
-- Only service role/admin should read the table.

create table if not exists public.access_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  email text not null,
  full_name text,
  message text,
  linkedin_url text,
  github_url text,
  source text,
  user_agent text
);

alter table public.access_requests enable row level security;

-- Allow anyone (anon/auth) to INSERT. Do not allow SELECT/UPDATE/DELETE.
drop policy if exists "access_requests_insert_anyone" on public.access_requests;
create policy "access_requests_insert_anyone"
on public.access_requests
for insert
with check (true);


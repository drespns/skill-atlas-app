-- SkillAtlas SaaS - 008
-- Portfolio profile avatar image (Supabase Storage + profile column).
--
-- 1) Adds `avatar_url` column to `public.portfolio_profiles`
-- 2) Creates storage bucket `portfolio_avatars`
-- 3) RLS policies: user can manage only their own files in the bucket

alter table if exists public.portfolio_profiles
add column if not exists avatar_url text;

-- Storage bucket (private by default; we serve via signed URL)
insert into storage.buckets (id, name, public)
values ('portfolio_avatars', 'portfolio_avatars', false)
on conflict (id) do nothing;

-- Policies (Storage)
drop policy if exists "portfolio_avatars_select_own" on storage.objects;
create policy "portfolio_avatars_select_own"
on storage.objects
for select
using (
  bucket_id = 'portfolio_avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "portfolio_avatars_insert_own" on storage.objects;
create policy "portfolio_avatars_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'portfolio_avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "portfolio_avatars_update_own" on storage.objects;
create policy "portfolio_avatars_update_own"
on storage.objects
for update
using (
  bucket_id = 'portfolio_avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'portfolio_avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "portfolio_avatars_delete_own" on storage.objects;
create policy "portfolio_avatars_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'portfolio_avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);


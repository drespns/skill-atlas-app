-- saas-021: /study fase 2 — subida de archivos (Storage + fuente tipo file)
-- Requiere: saas-020 (study_sources / study_workspaces).

create extension if not exists pgcrypto;

-- 1) Storage bucket (privado)
insert into storage.buckets (id, name, public)
values ('study_files', 'study_files', false)
on conflict (id) do nothing;

-- 2) Extender study_sources para soportar archivos
alter table if exists public.study_sources
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_mime text,
  add column if not exists file_size bigint;

alter table public.study_sources
  drop constraint if exists study_sources_kind_check;

alter table public.study_sources
  add constraint study_sources_kind_check
  check (kind in ('note','link','file'));

-- 3) Policies Storage (solo propio userId en la ruta: study_files/<uid>/...)
-- Nota: object name (path) se guarda en storage.objects.name

drop policy if exists "study_files_read_own" on storage.objects;
create policy "study_files_read_own"
on storage.objects
for select
using (
  bucket_id = 'study_files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "study_files_insert_own" on storage.objects;
create policy "study_files_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'study_files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "study_files_update_own" on storage.objects;
create policy "study_files_update_own"
on storage.objects
for update
using (
  bucket_id = 'study_files'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'study_files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "study_files_delete_own" on storage.objects;
create policy "study_files_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'study_files'
  and auth.uid()::text = (storage.foldername(name))[1]
);


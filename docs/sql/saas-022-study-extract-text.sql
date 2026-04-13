-- saas-022: /study fase 1 (RAG) — chunking + búsqueda full-text
-- Requiere: saas-020 (study_sources / study_workspaces) y saas-021 (kind=file + metadata).
--
-- Objetivo:
-- - Guardar "chunks" (trozos de texto) por fuente para poder recuperar fragmentos relevantes.
-- - Habilitar búsqueda full-text (Postgres tsvector + GIN) por usuario y fuente.

create extension if not exists pgcrypto;

create table if not exists public.study_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.study_sources (id) on delete cascade,
  chunk_index integer not null,
  body text not null,
  -- Usamos 'simple' para no depender de idioma; podremos migrar a config por usuario en el futuro.
  tsv tsvector generated always as (to_tsvector('simple', body)) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists study_chunks_uq on public.study_chunks (user_id, source_id, chunk_index);
create index if not exists study_chunks_user_source_idx on public.study_chunks (user_id, source_id);
create index if not exists study_chunks_tsv_gin on public.study_chunks using gin (tsv);

alter table public.study_chunks enable row level security;

-- RLS: solo el propietario (por user_id)
drop policy if exists "study_chunks_select_own" on public.study_chunks;
create policy "study_chunks_select_own"
on public.study_chunks
for select
using (auth.uid() = user_id);

drop policy if exists "study_chunks_insert_own" on public.study_chunks;
create policy "study_chunks_insert_own"
on public.study_chunks
for insert
with check (auth.uid() = user_id);

drop policy if exists "study_chunks_update_own" on public.study_chunks;
create policy "study_chunks_update_own"
on public.study_chunks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_chunks_delete_own" on public.study_chunks;
create policy "study_chunks_delete_own"
on public.study_chunks
for delete
using (auth.uid() = user_id);


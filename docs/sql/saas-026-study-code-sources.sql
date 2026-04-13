-- saas-026: fuentes de estudio tipo "code" + lenguaje; notas de usuario con opción código
-- Requiere: saas-020 (study_sources), saas-021 (kinds note/link/file), saas-023 (study_user_notes).

-- 1) study_sources: metadatos para snippets de código indexables
alter table if exists public.study_sources
  add column if not exists code_language text;

alter table public.study_sources
  drop constraint if exists study_sources_kind_check;

alter table public.study_sources
  add constraint study_sources_kind_check
  check (kind in ('note', 'link', 'file', 'code'));

-- 2) study_user_notes: notas persistentes con modo código (lenguaje etiqueta / resaltado en UI)
alter table if exists public.study_user_notes
  add column if not exists code_language text;

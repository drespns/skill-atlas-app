-- saas-019: tecnologías con tipo (technology/framework/library/package)
-- Objetivo: persistir "subtecnologías" y tags de tipo en Supabase.

alter table if exists public.technologies
  add column if not exists kind text;

-- Valores sugeridos; no forzamos NOT NULL para mantener compatibilidad.
alter table if exists public.technologies
  drop constraint if exists technologies_kind_check;

alter table if exists public.technologies
  add constraint technologies_kind_check
  check (kind is null or kind in ('technology','framework','library','package'));

-- Índice opcional (no obligatorio para MVP)
create index if not exists technologies_user_kind_idx on public.technologies (user_id, kind);


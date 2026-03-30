-- SkillAtlas SaaS: quitar unicidad GLOBAL en slug (solo slug) si aun existe.
-- Con multi-tenant la unicidad correcta es (user_id, slug) — ver saas-001.
--
-- Sintoma en la app: otro usuario ya tiene slug "python" y tu cuenta no puede
-- crear "python" aunque tu lista no muestre esa fila (RLS oculta filas ajenas).
--
-- Ejecutar en Supabase SQL Editor. Si algun DROP falla por nombre distinto,
-- lista constraints e indices:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.technologies'::regclass;
--   SELECT indexname FROM pg_indexes WHERE tablename = 'technologies' AND schemaname = 'public';

-- technologies
ALTER TABLE public.technologies DROP CONSTRAINT IF EXISTS technologies_slug_key;
ALTER TABLE public.technologies DROP CONSTRAINT IF EXISTS technologies_slug_unique;

DROP INDEX IF EXISTS public.technologies_slug_key;
DROP INDEX IF EXISTS public.technologies_slug_idx;
DROP INDEX IF EXISTS public.technologies_slug_unique;

-- projects
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_slug_key;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_slug_unique;

DROP INDEX IF EXISTS public.projects_slug_key;
DROP INDEX IF EXISTS public.projects_slug_idx;
DROP INDEX IF EXISTS public.projects_slug_unique;

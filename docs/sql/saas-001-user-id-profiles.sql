-- SkillAtlas SaaS (fase 1): ownership por usuario + perfil / portfolio compartible.
-- Ejecutar en Supabase SQL Editor DESPUES de tener al menos un usuario en auth.users.
--
-- PASO MANUAL entre bloques si ya hay datos sin user_id:
--   1) Anadir columnas (nullable)
--   2) UPDATE technologies SET user_id = '<uuid-del-usuario-propietario>' WHERE user_id IS NULL;
--   3) UPDATE projects SET user_id = '<mismo-uuid>' WHERE user_id IS NULL;
--   4) Ejecutar el UPDATE de concepts abajo
--   5) NOT NULL + indices unicos

-- -----------------------------------------------------------------------------
-- 1) Columnas user_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.technologies
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

-- Heredar user_id del concepto desde su tecnologia (tras backfill de technologies.user_id)
UPDATE public.concepts c
SET user_id = t.user_id
FROM public.technologies t
WHERE c.technology_id = t.id
  AND c.user_id IS NULL
  AND t.user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Perfil + token de portfolio compartible
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  share_enabled BOOLEAN NOT NULL DEFAULT false,
  share_token UUID NOT NULL DEFAULT gen_random_uuid ()
);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_profiles_share_token_idx
  ON public.portfolio_profiles (share_token);

-- -----------------------------------------------------------------------------
-- 3) NOT NULL (ejecutar solo cuando no queden NULL)
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.technologies ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.concepts ALTER COLUMN user_id SET NOT NULL;

-- -----------------------------------------------------------------------------
-- 4) Unicidad de slug por usuario (sustituye unicidad global implicita)
-- -----------------------------------------------------------------------------
-- Si CREATE UNIQUE INDEX falla por duplicado de nombre: revisa constraints viejos
-- solo sobre `slug` (unicos globales) y eliminalos antes de este bloque.

CREATE UNIQUE INDEX IF NOT EXISTS technologies_user_slug_idx
  ON public.technologies (user_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_idx
  ON public.projects (user_id, slug);

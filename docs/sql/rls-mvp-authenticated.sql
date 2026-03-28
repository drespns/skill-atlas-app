-- SkillAtlas MVP: RLS para Supabase (single-account, sin multiusuario por fila).
--
-- IMPORTANTE (Astro build estatico + anon key en servidor):
-- Si bloqueas por completo el rol `anon`, el build que usa `getSupabaseClient()` con la anon key
-- sin JWT de usuario dejara de poder leer tablas. Por eso el modo RECOMENDADO aqui es:
--   - anon: solo SELECT (lectura publica para portfolio y SSG)
--   - authenticated: SELECT, INSERT, UPDATE, DELETE (CRUD con sesion magic link)
--
-- Las policies NO se crean "por cada cuenta nueva": se aplican una vez en la BD.
--
-- Ejecutar en Supabase SQL Editor (una vez por proyecto). Revisar errores si faltan tablas.

-- -----------------------------------------------------------------------------
-- 1) Quitar policies existentes en estas tablas (nombres desconocidos del MVP anterior)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (
        ARRAY[
          'technologies',
          'concepts',
          'projects',
          'project_technologies',
          'project_concepts',
          'project_embeds'
        ]
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Asegurar RLS activo
-- -----------------------------------------------------------------------------
ALTER TABLE public.technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_embeds ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3) Modo recomendado: authenticated = CRUD completo; anon = solo lectura
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_authenticated_all_technologies
  ON public.technologies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_technologies
  ON public.technologies
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY skillatlas_authenticated_all_concepts
  ON public.concepts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_concepts
  ON public.concepts
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY skillatlas_authenticated_all_projects
  ON public.projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_projects
  ON public.projects
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY skillatlas_authenticated_all_project_technologies
  ON public.project_technologies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_project_technologies
  ON public.project_technologies
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY skillatlas_authenticated_all_project_concepts
  ON public.project_concepts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_project_concepts
  ON public.project_concepts
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY skillatlas_authenticated_all_project_embeds
  ON public.project_embeds
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY skillatlas_anon_select_project_embeds
  ON public.project_embeds
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- 4) OPCIONAL (single-account estricto por email): NO ejecutar tal cual.
-- Sustituye 'tu-email@dominio.com' y, en Supabase, primero DROP las policies
-- skillatlas_authenticated_all_* de arriba, luego crea equivalentes con:
--
--   USING ((auth.jwt() ->> 'email') = 'tu-email@dominio.com')
--   WITH CHECK ((auth.jwt() ->> 'email') = 'tu-email@dominio.com')
--
-- Si ademas quitas los skillatlas_anon_select_*, el build estatico con anon key
-- necesitara leer con service role en CI o no podra generar paginas.
-- Ver comentario al inicio de este archivo.
-- -----------------------------------------------------------------------------

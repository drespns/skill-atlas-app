-- SkillAtlas SaaS: RLS por usuario (auth.uid() = user_id).
-- Ejecutar DESPUES de saas-001-user-id-profiles.sql y backfill de NOT NULL.
-- Tambien elimina el acceso anon directo a tablas de contenido (el portfolio publico
-- pasa por la funcion skillatlas_portfolio_by_share_token).

-- -----------------------------------------------------------------------------
-- 1) Eliminar policies existentes en tablas afectadas
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
          'project_embeds',
          'portfolio_profiles'
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
-- 2) RLS activo
-- -----------------------------------------------------------------------------
ALTER TABLE public.technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3) technologies
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_tech_select ON public.technologies
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY skillatlas_tech_insert ON public.technologies
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_tech_update ON public.technologies
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_tech_delete ON public.technologies
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4) concepts
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_concept_select ON public.concepts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY skillatlas_concept_insert ON public.concepts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_concept_update ON public.concepts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_concept_delete ON public.concepts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5) projects
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_project_select ON public.projects
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY skillatlas_project_insert ON public.projects
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_project_update ON public.projects
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_project_delete ON public.projects
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6) project_technologies (ownership via project)
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_pt_select ON public.project_technologies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_technologies.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pt_insert ON public.project_technologies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_technologies.project_id AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.technologies t
      WHERE t.id = project_technologies.technology_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pt_delete ON public.project_technologies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_technologies.project_id AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7) project_concepts
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_pc_select ON public.project_concepts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_concepts.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pc_insert ON public.project_concepts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_concepts.project_id AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.concepts c
      WHERE c.id = project_concepts.concept_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pc_delete ON public.project_concepts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_concepts.project_id AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 8) project_embeds
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_pe_select ON public.project_embeds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_embeds.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pe_insert ON public.project_embeds
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_embeds.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pe_update ON public.project_embeds
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_embeds.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_embeds.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY skillatlas_pe_delete ON public.project_embeds
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_embeds.project_id AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 9) portfolio_profiles
-- -----------------------------------------------------------------------------
CREATE POLICY skillatlas_pp_select ON public.portfolio_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY skillatlas_pp_insert ON public.portfolio_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_pp_update ON public.portfolio_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY skillatlas_pp_delete ON public.portfolio_profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

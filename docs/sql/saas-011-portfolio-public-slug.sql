-- SkillAtlas SaaS - 011
-- Public portfolio URL: /portfolio/<public_slug> (human-readable) + RPC for anon.
--
-- Prerequisites: saas-001 (portfolio_profiles), saas-003/006 (skillatlas_portfolio_by_share_token body pattern).
--
-- 1) Column public_slug (nullable; unique when set, case-insensitive)
-- 2) RPC skillatlas_portfolio_by_public_slug(text) — same JSON shape as token RPC + helpStack

ALTER TABLE public.portfolio_profiles
ADD COLUMN IF NOT EXISTS public_slug text;

COMMENT ON COLUMN public.portfolio_profiles.public_slug IS
'Segment for public URL /portfolio/<slug>. Lowercase recommended; uniqueness enforced on lower(trim(slug)).';

-- One row per slug (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_profiles_public_slug_lower_idx
  ON public.portfolio_profiles (lower(trim(public_slug)))
  WHERE public_slug IS NOT NULL
    AND length(trim(public_slug)) > 0;

-- ---------------------------------------------------------------------------
-- RPC: resolve slug when share_enabled; includes help_stack as helpStack JSON array
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skillatlas_portfolio_by_public_slug (p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_norm text;
BEGIN
  v_norm := lower(trim(p_slug));
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT pp.user_id
  INTO v_user
  FROM public.portfolio_profiles pp
  WHERE lower(trim(pp.public_slug)) = v_norm
    AND pp.share_enabled = true;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'displayName', pp.display_name,
      'bio', pp.bio,
      'helpStack', COALESCE(pp.help_stack, '[]'::jsonb),
      'projects', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'slug', p.slug,
              'title', p.title,
              'description', COALESCE(p.description, ''),
              'role', COALESCE(p.role, ''),
              'outcome', COALESCE(p.outcome, ''),
              'technologyNames', COALESCE(
                (
                  SELECT jsonb_agg(t.name ORDER BY t.name)
                  FROM public.project_technologies pt
                  JOIN public.technologies t ON t.id = pt.technology_id
                  WHERE pt.project_id = p.id
                ),
                '[]'::jsonb
              ),
              'primaryEmbed', (
                SELECT jsonb_build_object(
                  'kind', pe.kind,
                  'title', pe.title,
                  'url', pe.url
                )
                FROM public.project_embeds pe
                WHERE pe.project_id = p.id
                ORDER BY pe.sort_order ASC
                LIMIT 1
              )
            )
            ORDER BY p.title
          )
          FROM public.projects p
          WHERE p.user_id = v_user
        ),
        '[]'::jsonb
      )
    )
    FROM public.portfolio_profiles pp
    WHERE pp.user_id = v_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.skillatlas_portfolio_by_public_slug (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_public_slug (text) TO anon;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_public_slug (text) TO authenticated;

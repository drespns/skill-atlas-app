-- SkillAtlas SaaS - 013
-- Portfolio público: layout y límite de evidencias por proyecto; varias embeds en JSON;
-- CTA opcional en hero; paridad token/slug (helpStack en RPC por token).
--
-- Prerequisites: saas-001, saas-005 (help_stack), saas-006 (role/outcome en token RPC), saas-011 (slug RPC).

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS public_layout text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS public_embeds_limit smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS public_hero_cta_label text,
  ADD COLUMN IF NOT EXISTS public_hero_cta_url text;

COMMENT ON COLUMN public.portfolio_profiles.public_layout IS
'Vista por defecto del portfolio público: grid | list (la app valida y normaliza).';

COMMENT ON COLUMN public.portfolio_profiles.public_embeds_limit IS
'Cuántas evidencias (embeds) por proyecto expone el RPC público; entre 1 y 5.';

COMMENT ON COLUMN public.portfolio_profiles.public_hero_cta_label IS
'Texto opcional del botón CTA bajo la bio en el portfolio público.';

COMMENT ON COLUMN public.portfolio_profiles.public_hero_cta_url IS
'URL opcional del CTA (https recomendado).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_profiles_public_embeds_limit_range'
  ) THEN
    ALTER TABLE public.portfolio_profiles
      ADD CONSTRAINT portfolio_profiles_public_embeds_limit_range
      CHECK (public_embeds_limit >= 1 AND public_embeds_limit <= 5);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RPC slug: mismos campos raíz + embeds[] + primaryEmbed (primera embed)
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
  v_layout text;
  v_embed_limit int;
  v_cta_label text;
  v_cta_url text;
BEGIN
  v_norm := lower(trim(p_slug));
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT
    pp.user_id,
    CASE WHEN lower(trim(COALESCE(pp.public_layout, ''))) = 'list' THEN 'list' ELSE 'grid' END,
    LEAST(GREATEST(COALESCE(pp.public_embeds_limit, 3), 1), 5),
    NULLIF(trim(COALESCE(pp.public_hero_cta_label, '')), ''),
    NULLIF(trim(COALESCE(pp.public_hero_cta_url, '')), '')
  INTO v_user, v_layout, v_embed_limit, v_cta_label, v_cta_url
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
      'publicLayout', v_layout,
      'publicEmbedsLimit', v_embed_limit,
      'heroCtaLabel', v_cta_label,
      'heroCtaUrl', v_cta_url,
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
              'embeds', (
                SELECT COALESCE(jsonb_agg(sub.obj ORDER BY sub.ord), '[]'::jsonb)
                FROM (
                  SELECT
                    jsonb_build_object(
                      'kind', pe.kind,
                      'title', pe.title,
                      'url', pe.url
                    ) AS obj,
                    pe.sort_order AS ord
                  FROM public.project_embeds pe
                  WHERE pe.project_id = p.id
                  ORDER BY pe.sort_order ASC
                  LIMIT v_embed_limit
                ) sub
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

-- ---------------------------------------------------------------------------
-- RPC token: alinear con slug (role, outcome, helpStack, embeds, CTA, layout)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skillatlas_portfolio_by_share_token (p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_layout text;
  v_embed_limit int;
  v_cta_label text;
  v_cta_url text;
BEGIN
  SELECT
    pp.user_id,
    CASE WHEN lower(trim(COALESCE(pp.public_layout, ''))) = 'list' THEN 'list' ELSE 'grid' END,
    LEAST(GREATEST(COALESCE(pp.public_embeds_limit, 3), 1), 5),
    NULLIF(trim(COALESCE(pp.public_hero_cta_label, '')), ''),
    NULLIF(trim(COALESCE(pp.public_hero_cta_url, '')), '')
  INTO v_user, v_layout, v_embed_limit, v_cta_label, v_cta_url
  FROM public.portfolio_profiles pp
  WHERE pp.share_token = p_token
    AND pp.share_enabled = true;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'displayName', pp.display_name,
      'bio', pp.bio,
      'helpStack', COALESCE(pp.help_stack, '[]'::jsonb),
      'publicLayout', v_layout,
      'publicEmbedsLimit', v_embed_limit,
      'heroCtaLabel', v_cta_label,
      'heroCtaUrl', v_cta_url,
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
              'embeds', (
                SELECT COALESCE(jsonb_agg(sub.obj ORDER BY sub.ord), '[]'::jsonb)
                FROM (
                  SELECT
                    jsonb_build_object(
                      'kind', pe.kind,
                      'title', pe.title,
                      'url', pe.url
                    ) AS obj,
                    pe.sort_order AS ord
                  FROM public.project_embeds pe
                  WHERE pe.project_id = p.id
                  ORDER BY pe.sort_order ASC
                  LIMIT v_embed_limit
                ) sub
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

REVOKE ALL ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) TO authenticated;

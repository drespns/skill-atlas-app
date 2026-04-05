-- SkillAtlas SaaS - 014
-- Presentación del portfolio público: tema visual, densidad, acento, cabecera, orden por destacados.
-- Amplía RPC slug + token (misma forma JSON).
--
-- Prerequisites: saas-013 (o al menos columnas de layout/embeds/CTA coherentes con las RPC actuales).

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS public_theme text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS public_density text NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS public_accent_hex text,
  ADD COLUMN IF NOT EXISTS public_header_style text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS featured_project_slugs jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.portfolio_profiles.public_theme IS
'Look del portfolio público: classic | minimal | contrast | reader.';

COMMENT ON COLUMN public.portfolio_profiles.public_density IS
'Espaciado de tarjetas: comfortable | compact.';

COMMENT ON COLUMN public.portfolio_profiles.public_accent_hex IS
'Color de acento opcional, 6 hex sin # (p. ej. 22C55E).';

COMMENT ON COLUMN public.portfolio_profiles.public_header_style IS
'Cabecera: default | cta_prominent.';

COMMENT ON COLUMN public.portfolio_profiles.featured_project_slugs IS
'JSON array de slugs de proyecto en orden; salen primero en el RPC público.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_profiles_public_theme_chk'
  ) THEN
    ALTER TABLE public.portfolio_profiles
      ADD CONSTRAINT portfolio_profiles_public_theme_chk
      CHECK (lower(trim(public_theme)) IN ('classic', 'minimal', 'contrast', 'reader'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_profiles_public_density_chk'
  ) THEN
    ALTER TABLE public.portfolio_profiles
      ADD CONSTRAINT portfolio_profiles_public_density_chk
      CHECK (lower(trim(public_density)) IN ('comfortable', 'compact'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_profiles_public_header_style_chk'
  ) THEN
    ALTER TABLE public.portfolio_profiles
      ADD CONSTRAINT portfolio_profiles_public_header_style_chk
      CHECK (lower(trim(public_header_style)) IN ('default', 'cta_prominent'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  v_theme text;
  v_density text;
  v_accent text;
  v_header text;
  v_featured jsonb;
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
    NULLIF(trim(COALESCE(pp.public_hero_cta_url, '')), ''),
    CASE lower(trim(COALESCE(pp.public_theme, '')))
      WHEN 'minimal' THEN 'minimal'
      WHEN 'contrast' THEN 'contrast'
      WHEN 'reader' THEN 'reader'
      ELSE 'classic'
    END,
    CASE lower(trim(COALESCE(pp.public_density, '')))
      WHEN 'compact' THEN 'compact'
      ELSE 'comfortable'
    END,
    CASE
      WHEN pp.public_accent_hex IS NOT NULL
        AND length(trim(pp.public_accent_hex)) = 6
        AND trim(pp.public_accent_hex) ~ '^[0-9A-Fa-f]{6}$'
      THEN upper(trim(pp.public_accent_hex))
      ELSE NULL
    END,
    CASE lower(trim(COALESCE(pp.public_header_style, '')))
      WHEN 'cta_prominent' THEN 'cta_prominent'
      ELSE 'default'
    END,
    COALESCE(pp.featured_project_slugs, '[]'::jsonb)
  INTO v_user, v_layout, v_embed_limit, v_cta_label, v_cta_url, v_theme, v_density, v_accent, v_header, v_featured
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
      'publicTheme', v_theme,
      'publicDensity', v_density,
      'publicAccentHex', v_accent,
      'publicHeaderStyle', v_header,
      'featuredProjectSlugs', COALESCE(v_featured, '[]'::jsonb),
      'projects', COALESCE(
        (
          SELECT jsonb_agg(sub.obj)
          FROM (
            SELECT pj.obj
            FROM (
              SELECT
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
                    SELECT COALESCE(jsonb_agg(s2.obj ORDER BY s2.ord), '[]'::jsonb)
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
                    ) s2
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
                ) AS obj,
                COALESCE(
                  (
                    SELECT e.ord::int
                    FROM jsonb_array_elements_text(COALESCE(v_featured, '[]'::jsonb)) WITH ORDINALITY AS e(slug, ord)
                    WHERE e.slug = p.slug
                    LIMIT 1
                  ),
                  1000000
                ) AS sort_feat,
                p.title AS sort_title
              FROM public.projects p
              WHERE p.user_id = v_user
            ) pj
            ORDER BY pj.sort_feat, pj.sort_title
          ) sub
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
  v_theme text;
  v_density text;
  v_accent text;
  v_header text;
  v_featured jsonb;
BEGIN
  SELECT
    pp.user_id,
    CASE WHEN lower(trim(COALESCE(pp.public_layout, ''))) = 'list' THEN 'list' ELSE 'grid' END,
    LEAST(GREATEST(COALESCE(pp.public_embeds_limit, 3), 1), 5),
    NULLIF(trim(COALESCE(pp.public_hero_cta_label, '')), ''),
    NULLIF(trim(COALESCE(pp.public_hero_cta_url, '')), ''),
    CASE lower(trim(COALESCE(pp.public_theme, '')))
      WHEN 'minimal' THEN 'minimal'
      WHEN 'contrast' THEN 'contrast'
      WHEN 'reader' THEN 'reader'
      ELSE 'classic'
    END,
    CASE lower(trim(COALESCE(pp.public_density, '')))
      WHEN 'compact' THEN 'compact'
      ELSE 'comfortable'
    END,
    CASE
      WHEN pp.public_accent_hex IS NOT NULL
        AND length(trim(pp.public_accent_hex)) = 6
        AND trim(pp.public_accent_hex) ~ '^[0-9A-Fa-f]{6}$'
      THEN upper(trim(pp.public_accent_hex))
      ELSE NULL
    END,
    CASE lower(trim(COALESCE(pp.public_header_style, '')))
      WHEN 'cta_prominent' THEN 'cta_prominent'
      ELSE 'default'
    END,
    COALESCE(pp.featured_project_slugs, '[]'::jsonb)
  INTO v_user, v_layout, v_embed_limit, v_cta_label, v_cta_url, v_theme, v_density, v_accent, v_header, v_featured
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
      'publicTheme', v_theme,
      'publicDensity', v_density,
      'publicAccentHex', v_accent,
      'publicHeaderStyle', v_header,
      'featuredProjectSlugs', COALESCE(v_featured, '[]'::jsonb),
      'projects', COALESCE(
        (
          SELECT jsonb_agg(sub.obj)
          FROM (
            SELECT pj.obj
            FROM (
              SELECT
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
                    SELECT COALESCE(jsonb_agg(s2.obj ORDER BY s2.ord), '[]'::jsonb)
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
                    ) s2
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
                ) AS obj,
                COALESCE(
                  (
                    SELECT e.ord::int
                    FROM jsonb_array_elements_text(COALESCE(v_featured, '[]'::jsonb)) WITH ORDINALITY AS e(slug, ord)
                    WHERE e.slug = p.slug
                    LIMIT 1
                  ),
                  1000000
                ) AS sort_feat,
                p.title AS sort_title
              FROM public.projects p
              WHERE p.user_id = v_user
            ) pj
            ORDER BY pj.sort_feat, pj.sort_title
          ) sub
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

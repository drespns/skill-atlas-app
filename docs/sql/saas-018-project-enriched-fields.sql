-- SkillAtlas SaaS - 018
-- Proyectos enriquecidos: estado, tags (JSONB), fechas inicio/fin.
-- RPCs portfolio + CV incluyen status, tags, dateStart, dateEnd; borradores (draft) no salen en público.
--
-- Prerequisites: saas-016 aplicado (misma base de RPCs).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check CHECK (
    status IN ('draft', 'in_progress', 'portfolio_visible', 'archived')
  );

COMMENT ON COLUMN public.projects.status IS
'Estado de negocio: draft | in_progress | portfolio_visible | archived. Los draft no se exponen en RPC públicas de portfolio/CV.';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.tags IS
'Array JSON de strings (p. ej. ["master","trabajo"]).';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS date_start date;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS date_end date;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_dates_order_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_dates_order_check CHECK (
    date_start IS NULL OR date_end IS NULL OR date_end >= date_start
  );

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
                  'coverImagePath', p.cover_image_path,
                  'status', p.status,
                  'tags', COALESCE(p.tags, '[]'::jsonb),
                  'dateStart', CASE WHEN p.date_start IS NULL THEN NULL ELSE to_char(p.date_start, 'YYYY-MM-DD') END,
                  'dateEnd', CASE WHEN p.date_end IS NULL THEN NULL ELSE to_char(p.date_end, 'YYYY-MM-DD') END,
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
                          'url', pe.url,
                          'thumbnailUrl', pe.thumbnail_url
                        ) AS obj,
                        pe.sort_order AS ord
                      FROM public.project_embeds pe
                      WHERE pe.project_id = p.id
                        AND COALESCE(pe.show_in_public, true) = true
                      ORDER BY pe.sort_order ASC
                      LIMIT v_embed_limit
                    ) s2
                  ),
                  'primaryEmbed', (
                    SELECT jsonb_build_object(
                      'kind', pe.kind,
                      'title', pe.title,
                      'url', pe.url,
                      'thumbnailUrl', pe.thumbnail_url
                    )
                    FROM public.project_embeds pe
                    WHERE pe.project_id = p.id
                      AND COALESCE(pe.show_in_public, true) = true
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
                AND p.status <> 'draft'
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
                  'coverImagePath', p.cover_image_path,
                  'status', p.status,
                  'tags', COALESCE(p.tags, '[]'::jsonb),
                  'dateStart', CASE WHEN p.date_start IS NULL THEN NULL ELSE to_char(p.date_start, 'YYYY-MM-DD') END,
                  'dateEnd', CASE WHEN p.date_end IS NULL THEN NULL ELSE to_char(p.date_end, 'YYYY-MM-DD') END,
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
                          'url', pe.url,
                          'thumbnailUrl', pe.thumbnail_url
                        ) AS obj,
                        pe.sort_order AS ord
                      FROM public.project_embeds pe
                      WHERE pe.project_id = p.id
                        AND COALESCE(pe.show_in_public, true) = true
                      ORDER BY pe.sort_order ASC
                      LIMIT v_embed_limit
                    ) s2
                  ),
                  'primaryEmbed', (
                    SELECT jsonb_build_object(
                      'kind', pe.kind,
                      'title', pe.title,
                      'url', pe.url,
                      'thumbnailUrl', pe.thumbnail_url
                    )
                    FROM public.project_embeds pe
                    WHERE pe.project_id = p.id
                      AND COALESCE(pe.show_in_public, true) = true
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
                AND p.status <> 'draft'
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

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skillatlas_cv_by_share_token (p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_prefs jsonb;
  v_cv_profile jsonb;
  v_slugs_json jsonb;
  v_slug_arr text[];
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pp.user_id
  INTO v_user
  FROM public.portfolio_profiles pp
  WHERE pp.cv_share_token = p_token
    AND pp.cv_share_enabled = true;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT up.prefs
  INTO v_prefs
  FROM public.user_prefs up
  WHERE up.user_id = v_user;

  v_cv_profile := COALESCE(v_prefs->'cvProfile', '{}'::jsonb);
  v_slugs_json := v_prefs->'cvProjectSlugs';

  IF v_slugs_json IS NOT NULL AND jsonb_typeof(v_slugs_json) = 'array' THEN
    SELECT array_agg(x.value ORDER BY x.ord)
    INTO v_slug_arr
    FROM jsonb_array_elements_text(v_slugs_json) WITH ORDINALITY AS x(value, ord);
  ELSE
    v_slug_arr := NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'displayName', pp.display_name,
      'bio', pp.bio,
      'helpStack', COALESCE(pp.help_stack, '[]'::jsonb),
      'cvProfile', v_cv_profile,
      'projects', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'slug', p.slug,
              'title', p.title,
              'description', COALESCE(p.description, ''),
              'role', COALESCE(p.role, ''),
              'outcome', COALESCE(p.outcome, ''),
              'coverImagePath', p.cover_image_path,
              'status', p.status,
              'tags', COALESCE(p.tags, '[]'::jsonb),
              'dateStart', CASE WHEN p.date_start IS NULL THEN NULL ELSE to_char(p.date_start, 'YYYY-MM-DD') END,
              'dateEnd', CASE WHEN p.date_end IS NULL THEN NULL ELSE to_char(p.date_end, 'YYYY-MM-DD') END,
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
                  'url', pe.url,
                  'thumbnailUrl', pe.thumbnail_url
                )
                FROM public.project_embeds pe
                WHERE pe.project_id = p.id
                  AND COALESCE(pe.show_in_public, true) = true
                ORDER BY pe.sort_order ASC
                LIMIT 1
              )
            )
            ORDER BY
              CASE
                WHEN v_slug_arr IS NULL THEN 0
                ELSE COALESCE(array_position(v_slug_arr, p.slug), 100000)
              END,
              p.title
          )
          FROM public.projects p
          WHERE p.user_id = v_user
            AND p.status <> 'draft'
            AND (
              v_slug_arr IS NULL
              OR array_length(v_slug_arr, 1) IS NULL
              OR p.slug = ANY (v_slug_arr)
            )
        ),
        '[]'::jsonb
      )
    )
    FROM public.portfolio_profiles pp
    WHERE pp.user_id = v_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.skillatlas_cv_by_share_token (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skillatlas_cv_by_share_token (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.skillatlas_cv_by_share_token (uuid) TO authenticated;

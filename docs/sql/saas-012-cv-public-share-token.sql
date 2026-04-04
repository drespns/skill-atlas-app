-- SkillAtlas SaaS - 012
-- Public CV link (revocable) via token: /cv/p/<token>
--
-- Adds:
-- - portfolio_profiles.cv_share_enabled (bool)
-- - portfolio_profiles.cv_share_token (uuid, unique)
-- - RPC public.skillatlas_cv_by_share_token(uuid) (SECURITY DEFINER) for anon/auth
--
-- Notes:
-- - The CV data lives in user_prefs.prefs (cvProfile + cvProjectSlugs).
-- - This RPC intentionally returns ONLY the data needed to render the CV.

ALTER TABLE public.portfolio_profiles
ADD COLUMN IF NOT EXISTS cv_share_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.portfolio_profiles
ADD COLUMN IF NOT EXISTS cv_share_token uuid DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.portfolio_profiles.cv_share_enabled IS
'Whether a public CV link is enabled for this user.';

COMMENT ON COLUMN public.portfolio_profiles.cv_share_token IS
'Token used for public CV link: /cv/p/<token>. Can be rotated to revoke the previous link.';

-- Ensure every row has a token
UPDATE public.portfolio_profiles
SET cv_share_token = gen_random_uuid()
WHERE cv_share_token IS NULL;

-- Unique token across profiles
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_profiles_cv_share_token_idx
  ON public.portfolio_profiles (cv_share_token)
  WHERE cv_share_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RPC: resolve token when cv_share_enabled; returns JSON for public CV rendering
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
            ORDER BY
              CASE
                WHEN v_slug_arr IS NULL THEN 0
                ELSE COALESCE(array_position(v_slug_arr, p.slug), 100000)
              END,
              p.title
          )
          FROM public.projects p
          WHERE p.user_id = v_user
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


-- SkillAtlas: lectura de portfolio publico solo por token (anon + authenticated).
-- Ejecutar despues de saas-001 y saas-002.
-- La app debe crear fila en portfolio_profiles al registrar usuario (o primer login).

CREATE OR REPLACE FUNCTION public.skillatlas_portfolio_by_share_token (p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT pp.user_id
  INTO v_user
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
      'projects', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'slug', p.slug,
              'title', p.title,
              'description', COALESCE(p.description, ''),
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

REVOKE ALL ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.skillatlas_portfolio_by_share_token (uuid) TO authenticated;

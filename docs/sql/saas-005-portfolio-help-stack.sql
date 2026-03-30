-- SkillAtlas: herramientas de productividad / "stack de ayuda" en el perfil.
-- Ejecutar tras saas-001 (tabla portfolio_profiles ya existe).

ALTER TABLE public.portfolio_profiles
  ADD COLUMN IF NOT EXISTS help_stack JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.portfolio_profiles.help_stack IS
  'Array JSON de claves (strings), p. ej. ["notion","openai","cursor"] — ver src/config/help-stack.ts';

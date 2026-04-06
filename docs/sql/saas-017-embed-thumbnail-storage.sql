-- SkillAtlas SaaS - 017
-- Bucket público para miniaturas de evidencias subidas por el usuario (comprimidas en cliente).
-- La app guarda la URL pública en project_embeds.thumbnail_url (misma columna que URLs manuales).
--
-- Prerequisites: saas-015 aplicado (thumbnail_url en project_embeds).

INSERT INTO storage.buckets (id, name, public)
VALUES ('embed_thumbnails', 'embed_thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "embed_thumbnails_select_public" ON storage.objects;
CREATE POLICY "embed_thumbnails_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'embed_thumbnails');

DROP POLICY IF EXISTS "embed_thumbnails_insert_own" ON storage.objects;
CREATE POLICY "embed_thumbnails_insert_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'embed_thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "embed_thumbnails_update_own" ON storage.objects;
CREATE POLICY "embed_thumbnails_update_own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'embed_thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'embed_thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "embed_thumbnails_delete_own" ON storage.objects;
CREATE POLICY "embed_thumbnails_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'embed_thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

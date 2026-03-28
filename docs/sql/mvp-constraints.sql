-- SkillAtlas MVP: constraints recomendados en Supabase (PostgreSQL).
-- Ejecutar en el SQL editor solo despues de revisar datos existentes:
-- si hay titulos duplicados por tecnologia o sort_order duplicados por proyecto,
-- la creacion del indice fallara hasta limpiar filas conflictivas.

-- 1) Conceptos unicos por tecnologia (titulo case-insensitive, sin espacios extremos)
CREATE UNIQUE INDEX IF NOT EXISTS concepts_technology_id_lower_trim_title_idx
  ON concepts (technology_id, lower(trim(title)));

-- 2) Orden de embeds sin colisiones dentro del mismo proyecto
CREATE UNIQUE INDEX IF NOT EXISTS project_embeds_project_id_sort_order_idx
  ON project_embeds (project_id, sort_order);

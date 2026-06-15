# Spike: modelo de bloques CV (Canva-lite, futuro)

Referencia rápida para una posible segunda fase donde el CV no sea solo “un `<article>` con secciones fijas”, sino un **árbol de bloques serializable**.

## Objetivo

Permitir más libertad tipográfica y de orden sin multiplicar plantillas CSS a mano: cada bloque tiene `type`, `props` y opcionalmente `layout hints` consumidos por un motor de tema.

## Esquema JSON orientativo

```json
{
  "v": 1,
  "themeId": "classic",
  "blocks": [
    {
      "id": "hero-1",
      "type": "Hero",
      "props": { "showPhoto": true, "density": "comfortable" }
    },
    {
      "id": "skills-1",
      "type": "SkillTags",
      "props": { "source": "fromCvProjects", "manualIds": [] }
    },
    {
      "id": "exp-1",
      "type": "ExperienceList",
      "props": { "showLocation": true, "dateMode": "full" }
    }
  ]
}
```

## Migración desde el modelo actual

- `CvProfileV1` + `cvDocumentSectionOrder` cubren hoy el 90% de casos estructurados.
- Una migración podría **normalizar** `CvProfileV1` → bloques por defecto en primera carga del “modo estudio”, guardando el JSON junto al slot de documento.
- Impresión/PDF debe seguir siendo **HTML + CSS** imprimible; evitar canvas como única fuente de verdad.

## Riesgos

- Duplicar estado (bloques vs perfil legado).
- ATS: bloques libres pueden empeorar lectura si no hay contrato de semántica.

Este archivo es solo spike de diseño; no hay código activo que lo consuma.

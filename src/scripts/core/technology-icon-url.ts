import { encodePublicIconPath, getTechnologyIconSrc } from "@config/icons";
import { getCatalogEntryForTech } from "@scripts/technologies/technology-detail/concept-seeds";

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Misma lógica que el listado /technologies: catálogo SVG, mapa por slug/nombre, fallback por slug del nombre y URL segura. */
export function technologyDisplayIconUrl(slug: string, name: string): string {
  let raw = getCatalogEntryForTech(slug, name)?.iconPath ?? getTechnologyIconSrc({ id: slug, name });
  if (!raw && name.trim()) {
    const ns = toSlug(name);
    if (ns) raw = getTechnologyIconSrc({ id: ns, name });
  }
  return raw ? encodePublicIconPath(raw) : "";
}

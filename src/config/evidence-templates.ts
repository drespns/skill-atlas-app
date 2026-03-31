/**
 * Plantillas para el campo rápido de evidencias: rellenan una URL de ejemplo
 * (segmentos en MAYÚSCULAS) para que la detección muestre el hint correcto.
 */

export type EvidenceQuickTemplate = {
  id: string;
  label: string;
  starterUrl: string;
};

export const EVIDENCE_QUICK_TEMPLATES: EvidenceQuickTemplate[] = [
  { id: "tableau", label: "Tableau", starterUrl: "https://public.tableau.com/views/TU_LIBRO/TU_VISTA" },
  { id: "github", label: "GitHub", starterUrl: "https://github.com/USUARIO/REPOSITORIO" },
  { id: "powerbi", label: "Power BI", starterUrl: "https://app.powerbi.com/view?r=TU_ENLACE_INCORPORADO" },
  { id: "looker", label: "Looker Studio", starterUrl: "https://lookerstudio.google.com/reporting/TU_INFORME/page/TU_PAGINA" },
  { id: "youtube", label: "YouTube", starterUrl: "https://www.youtube.com/watch?v=VIDEO_ID" },
  { id: "notion", label: "Notion", starterUrl: "https://www.notion.so/TU-PAGINA-1234567890abcdef" },
  { id: "observable", label: "Observable", starterUrl: "https://observablehq.com/@usuario/slug-del-notebook" },
];

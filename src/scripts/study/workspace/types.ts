export type Source = {
  id: string;
  title: string;
  kind: "note" | "link" | "file" | "code";
  url?: string;
  body?: string;
  codeLanguage?: string;
  filePath?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  createdAt: string;
};

export type State = {
  sources: Source[];
  activeIds: string[];
  sessionNotes: string;
  linkedProjectId: string | null;
  linkedTechnologyIds: string[];
  /** Fuente de código abierta en el panel central (solo local). */
  focusedCodeSourceId?: string | null;
  /**
   * Carpeta por fuente: `technology_id` entre las tecnologías vinculadas al estudio, o "" = General.
   * Solo cliente / localStorage (no columna en Supabase todavía).
   */
  sourceFolderById: Record<string, string>;
  /**
   * Carpetas definidas por el usuario (ids opacos, p. ej. `cf_…`). Solo local / caché; no en Supabase aún.
   */
  customStudyFolders: Array<{ id: string; label: string }>;
};

export type SupabaseLike = any;

export type StudyChunkRow = {
  user_id: string;
  source_id: string;
  chunk_index: number;
  body: string;
  study_space_id?: string;
};

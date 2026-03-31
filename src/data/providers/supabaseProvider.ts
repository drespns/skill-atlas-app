import { getSupabaseClient } from "../../lib/supabase";
import type { Concept, Project, ProjectEmbed, Technology } from "./mockProvider";

type DbTechnology = {
  id: string;
  slug: string;
  name: string;
};

type DbConcept = {
  id: string;
  technology_id: string;
  title: string;
  progress: "aprendido" | "practicado" | "mastered";
  notes: string | null;
};

type DbProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role: string | null;
  outcome: string | null;
};

type DbProjectEmbed = {
  id: string;
  project_id: string;
  kind: "iframe" | "link";
  title: string;
  url: string;
  sort_order: number;
};

async function loadTechnologiesRows(): Promise<DbTechnology[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("technologies").select("id, slug, name");
    if (error) return [];
    return (data ?? []) as DbTechnology[];
  } catch {
    return [];
  }
}

async function loadConceptRows(): Promise<DbConcept[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("concepts")
      .select("id, technology_id, title, progress, notes");
    if (error) return [];
    return (data ?? []) as DbConcept[];
  } catch {
    return [];
  }
}

async function loadProjectRows(): Promise<DbProject[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("projects").select("id, slug, title, description, role, outcome");
    if (error) return [];
    return (data ?? []) as DbProject[];
  } catch {
    return [];
  }
}

async function loadProjectTechnologyRows() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("project_technologies")
      .select("project_id, technology_id");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

async function loadProjectConceptRows() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("project_concepts").select("project_id, concept_id");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

async function loadProjectEmbedsRows(): Promise<DbProjectEmbed[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("project_embeds")
      .select("id, project_id, kind, title, url, sort_order")
      .order("sort_order", { ascending: true });
    if (error) return [];
    return (data ?? []) as DbProjectEmbed[];
  } catch {
    return [];
  }
}

export async function getTechnologies(): Promise<Technology[]> {
  const rows = await loadTechnologiesRows();
  return rows.map((t) => ({ id: t.slug, name: t.name }));
}

export async function getConcepts(): Promise<Concept[]> {
  const [technologyRows, conceptRows] = await Promise.all([loadTechnologiesRows(), loadConceptRows()]);
  const slugByTechnologyDbId = new Map(technologyRows.map((t) => [t.id, t.slug]));

  return conceptRows.map((c) => ({
    id: c.id,
    technologyId: slugByTechnologyDbId.get(c.technology_id) ?? c.technology_id,
    title: c.title,
    progress: c.progress,
    notes: c.notes ?? "",
  }));
}

export async function getProjects(): Promise<Project[]> {
  const [technologyRows, projectRows, projectTechnologyRows, projectConceptRows, embedRows] =
    await Promise.all([
      loadTechnologiesRows(),
      loadProjectRows(),
      loadProjectTechnologyRows(),
      loadProjectConceptRows(),
      loadProjectEmbedsRows(),
    ]);

  const technologySlugByDbId = new Map(technologyRows.map((t) => [t.id, t.slug]));
  const projectSlugByDbId = new Map(projectRows.map((p) => [p.id, p.slug]));

  const technologyIdsByProjectSlug = new Map<string, string[]>();
  for (const row of projectTechnologyRows) {
    const projectSlug = projectSlugByDbId.get(row.project_id);
    const technologySlug = technologySlugByDbId.get(row.technology_id);
    if (!projectSlug || !technologySlug) continue;
    const current = technologyIdsByProjectSlug.get(projectSlug) ?? [];
    current.push(technologySlug);
    technologyIdsByProjectSlug.set(projectSlug, current);
  }

  const conceptIdsByProjectSlug = new Map<string, string[]>();
  for (const row of projectConceptRows) {
    const projectSlug = projectSlugByDbId.get(row.project_id);
    if (!projectSlug) continue;
    const current = conceptIdsByProjectSlug.get(projectSlug) ?? [];
    current.push(row.concept_id);
    conceptIdsByProjectSlug.set(projectSlug, current);
  }

  const embedsByProjectSlug = new Map<string, ProjectEmbed[]>();
  for (const row of embedRows) {
    const projectSlug = projectSlugByDbId.get(row.project_id);
    if (!projectSlug) continue;
    const current = embedsByProjectSlug.get(projectSlug) ?? [];
    current.push({
      id: row.id,
      kind: row.kind,
      title: row.title,
      url: row.url,
    });
    embedsByProjectSlug.set(projectSlug, current);
  }

  return projectRows.map((p) => ({
    id: p.slug,
    title: p.title,
    description: p.description ?? "",
    role: p.role ?? "",
    outcome: p.outcome ?? "",
    technologyIds: technologyIdsByProjectSlug.get(p.slug) ?? [],
    conceptIds: conceptIdsByProjectSlug.get(p.slug) ?? [],
    embeds: embedsByProjectSlug.get(p.slug) ?? [],
    updatedAtISO: new Date().toISOString(),
  }));
}

export async function getTechnologyById(id: string): Promise<Technology | undefined> {
  const rows = await getTechnologies();
  return rows.find((t) => t.id === id);
}

export async function getConceptsByTechnology(technologyId: string): Promise<Concept[]> {
  const rows = await getConcepts();
  return rows.filter((c) => c.technologyId === technologyId);
}

export async function getProjectsByTechnology(technologyId: string): Promise<Project[]> {
  const rows = await getProjects();
  return rows.filter((p) => p.technologyIds.includes(technologyId));
}

export async function getConceptById(id: string): Promise<Concept | undefined> {
  const rows = await getConcepts();
  return rows.find((c) => c.id === id);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const rows = await getProjects();
  return rows.find((p) => p.id === id);
}


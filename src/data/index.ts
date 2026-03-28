import * as mock from "./mock";
import * as mockProvider from "./providers/mockProvider";
import * as supabaseProvider from "./providers/supabaseProvider";

/**
 * This file is the ONLY public entry point for app data.
 *
 * Why this matters:
 * - Pages/components import from `src/data` (this file)
 * - They do NOT need to know if data comes from mock or Supabase
 * - When we migrate backend, we swap implementation here
 */

export type ProgressState = mockProvider.ProgressState;
export type Technology = mockProvider.Technology;
export type Concept = mockProvider.Concept;
export type Project = mockProvider.Project;
export type ProjectEmbed = mockProvider.ProjectEmbed;

/**
 * Data facade for the app.
 *
 * Today: uses local mock data.
 * Next step: swap to a Supabase-backed implementation with the same API.
 */
export const dataSource: "mock" | "supabase" =
  import.meta.env.PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "mock";

const provider = dataSource === "supabase" ? supabaseProvider : mockProvider;

// Global app metadata
export const profile = mock.profile;
export const repoUrl = mock.repoUrl;

// Query helpers (now async to support real database providers)
export const getTechnologies = provider.getTechnologies;
export const getConcepts = provider.getConcepts;
export const getProjects = provider.getProjects;
export const getTechnologyById = provider.getTechnologyById;
export const getConceptsByTechnology = provider.getConceptsByTechnology;
export const getProjectsByTechnology = provider.getProjectsByTechnology;
export const getConceptById = provider.getConceptById;
export const getProjectById = provider.getProjectById;


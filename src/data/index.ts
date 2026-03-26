import * as mock from "./mock";

/**
 * This file is the ONLY public entry point for app data.
 *
 * Why this matters:
 * - Pages/components import from `src/data` (this file)
 * - They do NOT need to know if data comes from mock or Supabase
 * - When we migrate backend, we swap implementation here
 */

export type ProgressState = mock.ProgressState;
export type Technology = mock.Technology;
export type Concept = mock.Concept;
export type Project = mock.Project;
export type ProjectEmbed = mock.ProjectEmbed;

/**
 * Data facade for the app.
 *
 * Today: uses local mock data.
 * Next step: swap to a Supabase-backed implementation with the same API.
 */
export const dataSource: "mock" | "supabase" = "mock";

// Global app metadata
export const profile = mock.profile;
export const repoUrl = mock.repoUrl;

// Collections used by current pages
export const technologies = mock.technologies;
export const concepts = mock.concepts;
export const projects = mock.projects;

// Query helpers (replaceable with DB queries later)
export const getTechnologyById = mock.getTechnologyById;
export const getConceptsByTechnology = mock.getConceptsByTechnology;
export const getProjectsByTechnology = mock.getProjectsByTechnology;
export const getConceptById = mock.getConceptById;
export const getProjectById = mock.getProjectById;


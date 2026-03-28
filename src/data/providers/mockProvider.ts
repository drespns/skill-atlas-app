import * as mock from "../mock";

export type ProgressState = mock.ProgressState;
export type Technology = mock.Technology;
export type Concept = mock.Concept;
export type Project = mock.Project;
export type ProjectEmbed = mock.ProjectEmbed;

export async function getTechnologies() {
  return mock.technologies;
}

export async function getConcepts() {
  return mock.concepts;
}

export async function getProjects() {
  return mock.projects;
}

export async function getTechnologyById(id: string) {
  return mock.getTechnologyById(id);
}

export async function getConceptsByTechnology(technologyId: string) {
  return mock.getConceptsByTechnology(technologyId);
}

export async function getProjectsByTechnology(technologyId: string) {
  return mock.getProjectsByTechnology(technologyId);
}

export async function getConceptById(id: string) {
  return mock.getConceptById(id);
}

export async function getProjectById(id: string) {
  return mock.getProjectById(id);
}


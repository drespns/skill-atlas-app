/** Cliente para POST /api/tech-registry-lookup (requiere sesión Supabase). */

export type TechRegistryLookupOk = {
  ok: true;
  registry: "npm" | "pypi";
  packageName: string;
  displayName: string;
  description: string;
  homepage: string;
  suggestedSlug: string;
  suggestedKind: "library" | "package";
};

export type TechRegistryLookupResponse = TechRegistryLookupOk | { ok?: false; error?: string };

export async function fetchTechRegistryLookup(accessToken: string, query: string): Promise<TechRegistryLookupResponse> {
  const res = await fetch("/api/tech-registry-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: query.trim() }),
  });
  try {
    return (await res.json()) as TechRegistryLookupResponse;
  } catch {
    return { error: "Invalid JSON response." };
  }
}

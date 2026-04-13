/** Server-side metadata fetch for npm and PyPI (used by /api/tech-registry-lookup). */

export type RegistryLookupResult = {
  registry: "npm" | "pypi";
  packageName: string;
  displayName: string;
  description: string;
  homepage: string;
  suggestedSlug: string;
  suggestedKind: "library" | "package";
};

function toSlug(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseRegistryQuery(raw: string): { registry: "npm" | "pypi"; packageName: string } | null {
  const q = raw.trim();
  if (!q) return null;
  if (/^pypi\//i.test(q)) {
    const name = q.replace(/^pypi\//i, "").trim();
    return name ? { registry: "pypi", packageName: name } : null;
  }
  if (/^npm\//i.test(q)) {
    const name = q.replace(/^npm\//i, "").trim();
    return name ? { registry: "npm", packageName: name } : null;
  }
  try {
    const u = new URL(q.startsWith("http") ? q : `https://${q}`);
    const h = u.hostname.replace(/^www\./, "");
    if ((h === "npmjs.com" || h === "www.npmjs.com") && u.pathname.includes("/package/")) {
      const rest = u.pathname.split("/package/")[1] ?? "";
      const name = decodeURIComponent(rest.split("/")[0] ?? "").trim();
      return name ? { registry: "npm", packageName: name } : null;
    }
    if (h === "pypi.org" && u.pathname.startsWith("/project/")) {
      const rest = u.pathname.replace(/^\/project\//, "");
      const name = decodeURIComponent(rest.split("/")[0] ?? "").trim();
      return name ? { registry: "pypi", packageName: name } : null;
    }
  } catch {
    // not a URL
  }
  // Heuristic: scoped npm package or single-token → npm; else PyPI (many python packages use hyphens)
  if (q.includes("/") && !q.includes("://")) {
    if (/^@[^/]+\/.+/.test(q)) return { registry: "npm", packageName: q };
  }
  if (/^@[^/]+\/[^/]+$/.test(q)) return { registry: "npm", packageName: q };
  // short lowercase alphanum + hyphen → often npm; multi-word could be pypi — default npm for @ and single segment
  if (/^[a-z0-9@._-]+$/i.test(q) && !q.includes("_")) {
    return { registry: "npm", packageName: q };
  }
  return { registry: "pypi", packageName: q };
}

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 12000;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  const { timeoutMs: _t, ...rest } = init;
  return fetch(url, { ...rest, signal: c.signal }).finally(() => clearTimeout(t));
}

async function lookupNpm(packageName: string): Promise<RegistryLookupResult | { error: string }> {
  const enc = encodeURIComponent(packageName).replace(/%40/g, "@");
  const url = `https://registry.npmjs.org/${enc}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return { error: res.status === 404 ? "npm: paquete no encontrado." : `npm: error HTTP ${res.status}` };
  const data = (await res.json()) as {
    name?: string;
    description?: string;
    "dist-tags"?: { latest?: string };
    versions?: Record<string, { description?: string; homepage?: string; repository?: { url?: string } }>;
  };
  const latest = data["dist-tags"]?.latest;
  const ver = latest && data.versions?.[latest] ? data.versions[latest] : null;
  const name = typeof data.name === "string" ? data.name : packageName;
  const description =
    (typeof ver?.description === "string" && ver.description) ||
    (typeof data.description === "string" && data.description) ||
    "";
  let homepage = typeof ver?.homepage === "string" ? ver.homepage : "";
  const repo = ver?.repository?.url;
  if (!homepage && typeof repo === "string") {
    homepage = repo.replace(/^git\+/, "").replace(/\.git$/, "");
  }
  const suggestedSlug = toSlug(name.replace(/^@.+\//, ""));
  return {
    registry: "npm",
    packageName: name,
    displayName: name,
    description: description.slice(0, 2000),
    homepage: homepage.slice(0, 500),
    suggestedSlug: suggestedSlug || toSlug(packageName),
    suggestedKind: name.startsWith("@") ? "package" : "library",
  };
}

async function lookupPypi(packageName: string): Promise<RegistryLookupResult | { error: string }> {
  const enc = encodeURIComponent(packageName);
  const url = `https://pypi.org/pypi/${enc}/json`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return { error: res.status === 404 ? "PyPI: proyecto no encontrado." : `PyPI: error HTTP ${res.status}` };
  const data = (await res.json()) as {
    info?: { name?: string; summary?: string; home_page?: string; project_url?: string; package_url?: string };
  };
  const info = data.info ?? {};
  const name = typeof info.name === "string" ? info.name : packageName;
  const description = typeof info.summary === "string" ? info.summary : "";
  const homepage =
    (typeof info.home_page === "string" && info.home_page) ||
    (typeof info.package_url === "string" && info.package_url) ||
    "";
  const suggestedSlug = toSlug(name);
  return {
    registry: "pypi",
    packageName: name,
    displayName: name,
    description: description.slice(0, 2000),
    homepage: homepage.slice(0, 500),
    suggestedSlug: suggestedSlug || toSlug(packageName),
    suggestedKind: "library",
  };
}

export async function lookupRegistryPackage(rawQuery: string): Promise<RegistryLookupResult | { error: string }> {
  const parsed = parseRegistryQuery(rawQuery);
  if (!parsed) return { error: "Consulta vacía o no reconocida." };
  const { registry, packageName } = parsed;
  if (!packageName.trim()) return { error: "Nombre de paquete vacío." };
  if (registry === "npm") return lookupNpm(packageName.trim());
  return lookupPypi(packageName.trim());
}

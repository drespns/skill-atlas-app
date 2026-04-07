export type GitHubRepoRef = {
  owner: string;
  repo: string;
  /** optional branch/tag/sha */
  ref?: string;
};

export type GitHubLanguageBreakdown = {
  /** raw bytes from GitHub languages API */
  bytesByLanguage: Record<string, number>;
  /** 0..1 */
  pctByLanguage: Record<string, number>;
};

export type DetectedTechnology = {
  slug: string;
  name: string;
  /** 0..1 heuristic confidence */
  confidence: number;
  reasons: string[];
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseGitHubRepoUrl(raw: string): GitHubRepoRef | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname.toLowerCase() !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/, "");
    if (!owner || !repo) return null;
    // Optional /tree/<ref>/...
    let ref: string | undefined;
    if (parts[2] === "tree" && parts[3]) ref = parts[3];
    return { owner, repo, ref };
  } catch {
    return null;
  }
}

function base64Decode(b64: string): string {
  try {
    // GitHub content API includes newlines; atob handles them poorly sometimes
    const cleaned = b64.replace(/\s+/g, "");
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(cleaned), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    try {
      return atob(b64.replace(/\s+/g, ""));
    } catch {
      return "";
    }
  }
}

async function ghJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return await res.json();
}

type GhRepoMeta = { default_branch: string };

async function fetchRepoMeta(ref: GitHubRepoRef): Promise<GhRepoMeta> {
  return await ghJson(`https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`);
}

type GhTreeItem = { path: string; type: "blob" | "tree" };

async function fetchRepoTree(ref: GitHubRepoRef, resolvedRef: string): Promise<GhTreeItem[]> {
  const j = await ghJson(
    `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/git/trees/${encodeURIComponent(resolvedRef)}?recursive=1`,
  );
  const tree = Array.isArray(j?.tree) ? (j.tree as GhTreeItem[]) : [];
  return tree.filter((x) => x && typeof x.path === "string" && x.type === "blob");
}

async function fetchFileContent(ref: GitHubRepoRef, path: string, resolvedRef: string): Promise<string> {
  const j = await ghJson(
    `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(resolvedRef)}`,
  );
  const content = typeof j?.content === "string" ? j.content : "";
  return base64Decode(content);
}

function scoreAdd(
  map: Map<string, DetectedTechnology>,
  name: string,
  confidence: number,
  reason: string,
  slugOverride?: string,
) {
  const slug = slugOverride ?? toSlug(name);
  const prev = map.get(slug);
  if (!prev) {
    map.set(slug, { slug, name, confidence, reasons: [reason] });
    return;
  }
  prev.confidence = Math.min(1, Math.max(prev.confidence, confidence));
  prev.reasons = uniq([...prev.reasons, reason]);
}

function detectFromPackageJson(raw: string, out: Map<string, DetectedTechnology>) {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return;
  }
  const deps = { ...(j?.dependencies ?? {}), ...(j?.devDependencies ?? {}) } as Record<string, string>;
  const keys = Object.keys(deps);
  const has = (k: string) => keys.includes(k);

  if (has("astro")) scoreAdd(out, "Astro", 0.95, "package.json: astro");
  if (has("react") || has("react-dom")) scoreAdd(out, "React", 0.9, "package.json: react");
  if (has("next")) scoreAdd(out, "Next.js", 0.92, "package.json: next", "nextjs");
  if (has("vue")) scoreAdd(out, "Vue", 0.9, "package.json: vue");
  if (has("svelte")) scoreAdd(out, "Svelte", 0.9, "package.json: svelte");
  if (has("tailwindcss")) scoreAdd(out, "Tailwind CSS", 0.9, "package.json: tailwindcss", "tailwindcss");
  if (has("@supabase/supabase-js") || has("supabase")) scoreAdd(out, "Supabase", 0.9, "package.json: supabase", "supabase");
  if (has("vite")) scoreAdd(out, "Vite", 0.75, "package.json: vite");
  if (has("typescript")) scoreAdd(out, "TypeScript", 0.8, "package.json: typescript", "typescript");
  if (has("three")) scoreAdd(out, "Three.js", 0.8, "package.json: three", "threejs");
  if (has("@react-three/fiber")) scoreAdd(out, "React Three Fiber", 0.65, "package.json: @react-three/fiber", "react-three-fiber");
  if (has("d3")) scoreAdd(out, "D3.js", 0.7, "package.json: d3", "d3");
  if (has("echarts")) scoreAdd(out, "Apache ECharts", 0.7, "package.json: echarts", "echarts");
  if (has("eslint")) scoreAdd(out, "ESLint", 0.5, "package.json: eslint", "eslint");
  if (has("prettier")) scoreAdd(out, "Prettier", 0.5, "package.json: prettier", "prettier");
  if (has("prisma")) scoreAdd(out, "Prisma", 0.75, "package.json: prisma", "prisma");
  if (has("drizzle-orm")) scoreAdd(out, "Drizzle ORM", 0.7, "package.json: drizzle-orm", "drizzle");
  if (has("express")) scoreAdd(out, "Express", 0.65, "package.json: express", "express");
  if (has("fastify")) scoreAdd(out, "Fastify", 0.65, "package.json: fastify", "fastify");
  if (has("@nestjs/core")) scoreAdd(out, "NestJS", 0.7, "package.json: @nestjs/core", "nestjs");
}

function detectFromRequirementsTxt(raw: string, out: Map<string, DetectedTechnology>) {
  const lines = raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const pkgs = lines.map((l) => l.split(/[<=>\[]/)[0]!.trim().toLowerCase());
  const has = (k: string) => pkgs.includes(k.toLowerCase());
  if (has("django")) scoreAdd(out, "Django", 0.85, "requirements.txt: django");
  if (has("flask")) scoreAdd(out, "Flask", 0.8, "requirements.txt: flask");
  if (has("fastapi")) scoreAdd(out, "FastAPI", 0.85, "requirements.txt: fastapi");
  if (has("pandas")) scoreAdd(out, "Pandas", 0.65, "requirements.txt: pandas");
  if (has("numpy")) scoreAdd(out, "NumPy", 0.55, "requirements.txt: numpy");
  if (has("scipy")) scoreAdd(out, "SciPy", 0.55, "requirements.txt: scipy", "scipy");
  if (has("matplotlib")) scoreAdd(out, "Matplotlib", 0.55, "requirements.txt: matplotlib", "matplotlib");
  if (has("seaborn")) scoreAdd(out, "Seaborn", 0.55, "requirements.txt: seaborn", "seaborn");
  if (has("scikit-learn")) scoreAdd(out, "scikit-learn", 0.65, "requirements.txt: scikit-learn", "scikit-learn");
  if (has("tensorflow")) scoreAdd(out, "TensorFlow", 0.75, "requirements.txt: tensorflow", "tensorflow");
  if (has("torch") || has("pytorch")) scoreAdd(out, "PyTorch", 0.75, "requirements.txt: torch", "pytorch");
}

function detectFromGoMod(raw: string, out: Map<string, DetectedTechnology>) {
  const low = raw.toLowerCase();
  scoreAdd(out, "Go", 0.8, "go.mod", "go");
  if (low.includes("github.com/gin-gonic/gin")) scoreAdd(out, "Gin", 0.65, "go.mod: gin", "gin");
  if (low.includes("gorm.io/gorm")) scoreAdd(out, "GORM", 0.6, "go.mod: gorm", "gorm");
}

function detectFromDockerfile(raw: string, out: Map<string, DetectedTechnology>) {
  if (!raw.trim()) return;
  scoreAdd(out, "Docker", 0.7, "Dockerfile", "docker");
}

function detectFromPyProject(raw: string, out: Map<string, DetectedTechnology>) {
  const low = raw.toLowerCase();
  if (low.includes("[tool.poetry]") || low.includes("[project]")) scoreAdd(out, "Python", 0.55, "pyproject.toml", "python");
  if (low.includes("fastapi")) scoreAdd(out, "FastAPI", 0.7, "pyproject.toml: fastapi");
  if (low.includes("django")) scoreAdd(out, "Django", 0.7, "pyproject.toml: django");
}

function detectFromPomXml(raw: string, out: Map<string, DetectedTechnology>) {
  const low = raw.toLowerCase();
  if (!low.includes("<project")) return;
  scoreAdd(out, "Java", 0.55, "pom.xml", "java");
  if (low.includes("spring-boot")) scoreAdd(out, "Spring Boot", 0.75, "pom.xml: spring-boot", "spring-boot");
}

const INTERESTING_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "Pipfile",
  "go.mod",
  "Dockerfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
];

function isInterestingPath(p: string): boolean {
  const base = p.split("/").pop() ?? "";
  if (INTERESTING_FILES.includes(base)) return true;
  return false;
}

export async function analyzeGitHubRepoTechnologies(repo: GitHubRepoRef): Promise<DetectedTechnology[]> {
  const meta = await fetchRepoMeta(repo);
  const resolvedRef = repo.ref || meta.default_branch || "main";
  const tree = await fetchRepoTree(repo, resolvedRef);
  const hits = tree.map((t) => t.path).filter(isInterestingPath);

  // Prefer root-level manifests; also allow a few nested ones for monorepos.
  const ranked = hits
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, 16);

  const out = new Map<string, DetectedTechnology>();
  for (const path of ranked) {
    const base = path.split("/").pop() ?? path;
    const content = await fetchFileContent(repo, path, resolvedRef);
    if (!content) continue;
    if (base === "package.json") detectFromPackageJson(content, out);
    else if (base === "requirements.txt") detectFromRequirementsTxt(content, out);
    else if (base === "pyproject.toml") detectFromPyProject(content, out);
    else if (base === "go.mod") detectFromGoMod(content, out);
    else if (base === "Dockerfile") detectFromDockerfile(content, out);
    else if (base === "pom.xml") detectFromPomXml(content, out);
    else if (base === "pnpm-lock.yaml" || base === "yarn.lock" || base === "package-lock.json") {
      scoreAdd(out, "JavaScript", 0.4, `${base}`, "javascript");
    }
  }

  return [...out.values()].sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name, "es"));
}

export async function fetchGitHubRepoLanguages(repo: GitHubRepoRef): Promise<GitHubLanguageBreakdown> {
  const meta = await fetchRepoMeta(repo);
  const resolvedRef = repo.ref || meta.default_branch || "main";
  // Languages endpoint ignores ref; still useful as repo-level weights.
  const j = await ghJson(
    `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/languages`,
  );
  const bytesByLanguage: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(j ?? {})) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    bytesByLanguage[k] = n;
    total += n;
  }
  const pctByLanguage: Record<string, number> = {};
  for (const [k, n] of Object.entries(bytesByLanguage)) {
    pctByLanguage[k] = total > 0 ? n / total : 0;
  }
  // keep resolvedRef referenced so eslint/ts doesn't complain in some bundlers
  void resolvedRef;
  return { bytesByLanguage, pctByLanguage };
}

export function mapGitHubLanguagesToTechSlugs(pctByLanguage: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (slug: string, pct: number) => {
    if (!pct || pct <= 0) return;
    out[slug] = (out[slug] ?? 0) + pct;
  };
  for (const [lang, pct] of Object.entries(pctByLanguage)) {
    const k = lang.trim().toLowerCase();
    if (k === "astro") add("astro", pct);
    else if (k === "typescript") add("typescript", pct);
    else if (k === "javascript") add("javascript", pct);
    else if (k === "python") add("python", pct);
    else if (k === "go") add("go", pct);
    else if (k === "rust") add("rust", pct);
    else if (k === "java") add("java", pct);
    else if (k === "html") add("html", pct);
    else if (k === "css") add("css", pct);
    else if (k === "r") add("r-lang", pct);
    else if (k === "scala") add("scala", pct);
    else if (k === "c#") add("csharp", pct);
    else if (k === "c++") add("cpp", pct);
    else if (k === "c") add("c", pct);
  }
  return out;
}


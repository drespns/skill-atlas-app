/** Fragmentos para el generador de .gitignore (SkillAtlas tools). */

export type GitignorePart = { id: string; label: string; body: string };

export const GITIGNORE_PARTS: GitignorePart[] = [
  {
    id: "node",
    label: "Node / npm / pnpm / Yarn",
    body: `# Dependencies
node_modules/

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Optional caches
.npm
.eslintcache
`,
  },
  {
    id: "astro",
    label: "Astro",
    body: `# Astro
dist/
.astro/
`,
  },
  {
    id: "vercel",
    label: "Vercel",
    body: `.vercel
`,
  },
  {
    id: "env",
    label: "Variables de entorno",
    body: `.env
.env.*
!.env.example
`,
  },
  {
    id: "os",
    label: "macOS / Windows / Linux",
    body: `.DS_Store
Thumbs.db
Desktop.ini
`,
  },
  {
    id: "editor",
    label: "VS Code / JetBrains",
    body: `.vscode/*
!.vscode/extensions.json
.idea/
*.swp
*.swo
`,
  },
  {
    id: "python",
    label: "Python",
    body: `__pycache__/
*.py[cod]
*$py.class
.Python
venv/
.venv/
*.egg-info/
.pytest_cache/
.mypy_cache/
`,
  },
  {
    id: "java",
    label: "Java / Gradle / Maven",
    body: `*.class
target/
build/
.gradle/
*.jar
!gradle-wrapper.jar
`,
  },
  {
    id: "dotnet",
    label: ".NET",
    body: `bin/
obj/
*.user
*.suo
`,
  },
  {
    id: "go",
    label: "Go",
    body: `bin/
vendor/
*.exe
*.test
`,
  },
  {
    id: "rust",
    label: "Rust",
    body: `target/
**/*.rs.bk
`,
  },
  {
    id: "terraform",
    label: "Terraform",
    body: `.terraform/
*.tfstate
*.tfstate.*
.terraform.lock.hcl
`,
  },
  {
    id: "docker",
    label: "Docker (volúmenes locales)",
    body: `# Descomenta si guardas dumps locales
# *.sql
# data/
`,
  },
];

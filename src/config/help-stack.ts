/**
 * Herramientas de productividad / "stack de ayuda" (no entran en catálogo de conceptos).
 * Claves estables para guardar en localStorage + columna `help_stack` (JSONB) en Supabase.
 */
export type HelpStackItem = {
  key: string;
  label: string;
  /** Ruta bajo `public/` */
  icon: string;
};

export const HELP_STACK_ITEMS: HelpStackItem[] = [
  { key: "cursor", label: "Cursor", icon: "/icons/tools/cursor.svg" },
  { key: "opencode", label: "OpenCode", icon: "/icons/tools/opencode.svg" },
  { key: "github_copilot", label: "GitHub Copilot", icon: "/icons/tools/githubcopilot.svg" },
  { key: "openai", label: "ChatGPT / OpenAI", icon: "/icons/tools/openai.svg" },
  { key: "claude", label: "Claude", icon: "/icons/tools/claude-color.svg" },
  { key: "anthropic", label: "Anthropic", icon: "/icons/tools/anthropic.svg" },
  { key: "gemini", label: "Gemini", icon: "/icons/tools/gemini-color.svg" },
  { key: "perplexity", label: "Perplexity", icon: "/icons/tools/perplexity-color.svg" },
  { key: "notion", label: "Notion", icon: "/icons/tools/notion.svg" },
  { key: "figma", label: "Figma", icon: "/icons/tools/figma-color.svg" },
  { key: "mcp", label: "MCP", icon: "/icons/tools/mcp.svg" },
  { key: "ollama", label: "Ollama", icon: "/icons/tools/ollama.svg" },
  { key: "lmstudio", label: "LM Studio", icon: "/icons/tools/lmstudio.svg" },
  { key: "colab", label: "Google Colab", icon: "/icons/tools/colab-color.svg" },
  { key: "deepl", label: "DeepL", icon: "/icons/tools/deepl-color.svg" },
  { key: "midjourney", label: "Midjourney", icon: "/icons/tools/midjourney.svg" },
  { key: "codex", label: "Codex", icon: "/icons/tools/codex-color.svg" },
  { key: "railway", label: "Railway", icon: "/icons/tools/railway.svg" },
];

const BY_KEY = new Map(HELP_STACK_ITEMS.map((i) => [i.key, i]));

export function getHelpStackItem(key: string): HelpStackItem | undefined {
  return BY_KEY.get(key);
}

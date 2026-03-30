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
  { key: "cursor", label: "Cursor", icon: "/icons/cursor.svg" },
  { key: "opencode", label: "OpenCode", icon: "/icons/opencode.svg" },
  { key: "github_copilot", label: "GitHub Copilot", icon: "/icons/githubcopilot.svg" },
  { key: "openai", label: "ChatGPT / OpenAI", icon: "/icons/openai.svg" },
  { key: "claude", label: "Claude", icon: "/icons/claude-color.svg" },
  { key: "anthropic", label: "Anthropic", icon: "/icons/anthropic.svg" },
  { key: "gemini", label: "Gemini", icon: "/icons/gemini-color.svg" },
  { key: "perplexity", label: "Perplexity", icon: "/icons/perplexity-color.svg" },
  { key: "notion", label: "Notion", icon: "/icons/notion.svg" },
  { key: "figma", label: "Figma", icon: "/icons/figma-color.svg" },
  { key: "mcp", label: "MCP", icon: "/icons/mcp.svg" },
  { key: "ollama", label: "Ollama", icon: "/icons/ollama.svg" },
  { key: "lmstudio", label: "LM Studio", icon: "/icons/lmstudio.svg" },
  { key: "colab", label: "Google Colab", icon: "/icons/colab-color.svg" },
  { key: "deepl", label: "DeepL", icon: "/icons/deepl-color.svg" },
  { key: "midjourney", label: "Midjourney", icon: "/icons/midjourney.svg" },
  { key: "codex", label: "Codex", icon: "/icons/codex-color.svg" },
  { key: "railway", label: "Railway", icon: "/icons/railway.svg" },
];

const BY_KEY = new Map(HELP_STACK_ITEMS.map((i) => [i.key, i]));

export function getHelpStackItem(key: string): HelpStackItem | undefined {
  return BY_KEY.get(key);
}

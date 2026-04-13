import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";

function languageExtensions(lang: string): Extension[] {
  switch (lang) {
    case "typescript":
      return [javascript({ typescript: true })];
    case "javascript":
      return [javascript()];
    case "python":
      return [python()];
    case "sql":
      return [sql()];
    case "json":
      return [json()];
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "go":
      return [go()];
    case "rust":
      return [rust()];
    case "java":
      return [java()];
    case "cpp":
      return [cpp()];
    case "csharp":
      return [java()];
    case "bash":
      return [];
    case "plaintext":
    default:
      return [];
  }
}

function themeExtension(): Extension {
  const dark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  if (dark) return oneDark;
  return EditorView.theme(
    {
      "&": { height: "100%", backgroundColor: "rgb(255 255 255)", color: "rgb(17 24 39)" },
      ".cm-scroller": {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: "13px",
        lineHeight: "1.45",
      },
      ".cm-content": { caretColor: "rgb(17 24 39)" },
      ".cm-gutters": {
        backgroundColor: "rgb(249 250 251)",
        color: "rgb(156 163 175)",
        borderColor: "rgb(229 231 235)",
      },
      ".cm-activeLineGutter": { backgroundColor: "rgb(243 244 246)" },
    },
    { dark: false },
  );
}

export type StudyCodeEditorHandle = {
  view: EditorView;
  getDoc: () => string;
  destroy: () => void;
};

export function mountStudyCodeEditor(
  host: HTMLElement,
  options: {
    doc: string;
    language: string;
    readOnly?: boolean;
    placeholder?: string;
    minHeight?: string;
  },
): StudyCodeEditorHandle {
  const exts: Extension[] = [
    basicSetup,
    themeExtension(),
    ...languageExtensions((options.language || "plaintext").trim() || "plaintext"),
    EditorState.tabSize.of(2),
    EditorView.lineWrapping,
  ];
  if (options.readOnly) exts.push(EditorState.readOnly.of(true));
  if (options.placeholder?.trim()) exts.push(placeholder(options.placeholder.trim()));
  if (options.minHeight) {
    const h = options.minHeight;
    exts.push(
      EditorView.theme({
        "&": { minHeight: h },
        ".cm-scroller": { minHeight: h },
      }),
    );
  }

  const state = EditorState.create({ doc: options.doc, extensions: exts });
  const view = new EditorView({ state, parent: host });
  return {
    view,
    getDoc: () => view.state.doc.toString(),
    destroy: () => {
      view.destroy();
    },
  };
}

const LS = "skillatlas_tools_interview_v1";

type Item = { id: string; label: string; done: boolean };

type State = {
  company: string;
  role: string;
  items: Item[];
};

const DEFAULT_ITEMS: string[] = [
  "He leído la descripción del puesto",
  "He revisado la web / producto de la empresa",
  "Tengo 3–5 preguntas preparadas para ellos",
  "Sé cómo explicar mi rol en 60 segundos",
  "Tengo ejemplos STAR (situación, tarea, acción, resultado)",
  "He probado la videollamada (audio, cámara, fondo)",
  "Llego 5 minutos antes",
];

function load(): State {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) {
      const p = JSON.parse(raw) as State;
      if (p && Array.isArray(p.items)) {
        return {
          company: typeof p.company === "string" ? p.company : "",
          role: typeof p.role === "string" ? p.role : "",
          items: p.items.filter((x) => x && typeof x.label === "string"),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    company: "",
    role: "",
    items: DEFAULT_ITEMS.map((label, i) => ({
      id: `d-${i}`,
      label,
      done: false,
    })),
  };
}

function save(s: State) {
  localStorage.setItem(LS, JSON.stringify(s));
}

function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-interview-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  let state = load();
  const company = root.querySelector<HTMLInputElement>("[data-int-company]");
  const role = root.querySelector<HTMLInputElement>("[data-int-role]");
  const list = root.querySelector<HTMLElement>("[data-int-list]");
  const newIn = root.querySelector<HTMLInputElement>("[data-int-new]");
  const addBtn = root.querySelector<HTMLButtonElement>("[data-int-add]");
  const exportBtn = root.querySelector<HTMLButtonElement>("[data-int-export]");
  const importIn = root.querySelector<HTMLInputElement>("[data-int-import]");

  const render = () => {
    if (company) company.value = state.company;
    if (role) role.value = state.role;
    if (!list) return;
    list.replaceChildren();
    for (const it of state.items) {
      const row = document.createElement("label");
      row.className = "flex items-start gap-2 rounded-lg border border-gray-200/80 dark:border-gray-800 bg-white/80 dark:bg-gray-950/50 px-3 py-2";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "mt-1 accent-indigo-600";
      cb.checked = it.done;
      cb.addEventListener("change", () => {
        it.done = cb.checked;
        save(state);
      });
      const span = document.createElement("span");
      span.className = "flex-1 text-sm text-gray-800 dark:text-gray-200";
      span.textContent = it.label;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline shrink-0";
      del.textContent = "×";
      del.addEventListener("click", () => {
        state.items = state.items.filter((x) => x.id !== it.id);
        save(state);
        render();
      });
      row.append(cb, span, del);
      list.appendChild(row);
    }
  };

  company?.addEventListener("input", () => {
    state.company = company.value;
    save(state);
  });
  role?.addEventListener("input", () => {
    state.role = role.value;
    save(state);
  });

  addBtn?.addEventListener("click", () => {
    const t = (newIn?.value ?? "").trim();
    if (!t) return;
    state.items.push({ id: `u-${Date.now()}`, label: t, done: false });
    if (newIn) newIn.value = "";
    save(state);
    render();
  });

  exportBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `skillatlas-entrevista-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importIn?.addEventListener("change", async () => {
    const f = importIn.files?.[0];
    importIn.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const p = JSON.parse(text) as State;
      if (p && Array.isArray(p.items)) {
        state = load();
        state.company = typeof p.company === "string" ? p.company : state.company;
        state.role = typeof p.role === "string" ? p.role : state.role;
        state.items = p.items
          .filter((x) => x && typeof x.label === "string")
          .map((x) => ({
            id: typeof x.id === "string" ? x.id : `i-${Math.random().toString(36).slice(2)}`,
            label: x.label,
            done: Boolean(x.done),
          }));
        save(state);
        render();
      }
    } catch {
      /* ignore */
    }
  });

  render();
}

init();

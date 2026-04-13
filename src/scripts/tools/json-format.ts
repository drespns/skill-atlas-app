function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-json-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const inp = root.querySelector<HTMLTextAreaElement>("[data-json-in]");
  const err = root.querySelector<HTMLElement>("[data-json-err]");
  const btnPretty = root.querySelector<HTMLButtonElement>("[data-json-pretty]");
  const btnMini = root.querySelector<HTMLButtonElement>("[data-json-mini]");
  const btnCopy = root.querySelector<HTMLButtonElement>("[data-json-copy]");

  const parse = (): unknown => {
    const raw = (inp?.value ?? "").trim();
    if (!raw) throw new Error("Vacío");
    return JSON.parse(raw);
  };

  const showErr = (msg: string) => {
    if (err) {
      err.textContent = msg;
      err.classList.remove("hidden");
    }
  };

  const clearErr = () => {
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }
  };

  btnPretty?.addEventListener("click", () => {
    clearErr();
    try {
      const v = parse();
      if (inp) inp.value = `${JSON.stringify(v, null, 2)}\n`;
    } catch (e) {
      showErr(e instanceof Error ? e.message : "JSON inválido");
    }
  });

  btnMini?.addEventListener("click", () => {
    clearErr();
    try {
      const v = parse();
      if (inp) inp.value = `${JSON.stringify(v)}\n`;
    } catch (e) {
      showErr(e instanceof Error ? e.message : "JSON inválido");
    }
  });

  btnCopy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(inp?.value ?? "");
    } catch {
      /* ignore */
    }
  });
}

init();

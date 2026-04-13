function init() {
  const root = document.querySelector<HTMLElement>("[data-tools-bio-page]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const role = root.querySelector<HTMLInputElement>("[data-bio-role]");
  const years = root.querySelector<HTMLInputElement>("[data-bio-years]");
  const stack = root.querySelector<HTMLTextAreaElement>("[data-bio-stack]");
  const focus = root.querySelector<HTMLInputElement>("[data-bio-focus]");
  const tone = root.querySelector<HTMLSelectElement>("[data-bio-tone]");
  const lang = root.querySelector<HTMLSelectElement>("[data-bio-lang]");
  const out1 = root.querySelector<HTMLTextAreaElement>("[data-bio-out1]");
  const out2 = root.querySelector<HTMLTextAreaElement>("[data-bio-out2]");
  const out3 = root.querySelector<HTMLTextAreaElement>("[data-bio-out3]");
  const btn = root.querySelector<HTMLButtonElement>("[data-bio-gen]");

  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;

  btn?.addEventListener("click", () => {
    const r = (role?.value ?? "").trim() || "desarrollador";
    const y = (years?.value ?? "").trim();
    const st = (stack?.value ?? "")
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const fc = (focus?.value ?? "").trim();
    const es = lang?.value === "es";

    const toneVal = tone?.value ?? "neutral";
    const formal = toneVal === "formal";
    const casual = toneVal === "casual";

    const stackPhrase = st.length ? (es ? st.join(", ") : st.join(", ")) : es ? "stack moderno" : "a modern stack";

    const expBit =
      y && /^\d+$/.test(y)
        ? es
          ? `+${y} años de experiencia`
          : `+${y} years of experience`
        : es
          ? "experiencia en producto"
          : "product-focused experience";

    const focusBit = fc ? (es ? `Enfoque en ${fc}.` : `Focus on ${fc}.`) : "";

    const v1 = es
      ? formal
        ? `${r} con ${expBit}. Dominio de ${stackPhrase}. ${focusBit}`.trim()
        : casual
          ? `${r} — ${expBit}, me muevo bien con ${stackPhrase}. ${focusBit}`.trim()
          : `${r} · ${expBit} · ${stackPhrase}. ${focusBit}`.trim()
      : formal
        ? `${r} with ${expBit}. Strong with ${stackPhrase}. ${focusBit}`.trim()
        : casual
          ? `${r} — ${expBit}; comfortable with ${stackPhrase}. ${focusBit}`.trim()
        : `${r} · ${expBit} · ${stackPhrase}. ${focusBit}`.trim();

    const openersEs = ["Me gusta", "Disfruto", "Me interesa"];
    const openersEn = ["I enjoy", "I like", "I care about"];
    const openers = es ? openersEs : openersEn;
    const v2 = es
      ? `${pick(openers)} construir productos útiles con ${stackPhrase || "buenas prácticas"}. ${r}, ${expBit}.`
      : `${pick(openers)} building useful products with ${stackPhrase || "solid engineering practices"}. ${r}, ${expBit}.`;

    const v3 = es
      ? `${r} (${expBit}). Stack: ${stackPhrase}. ${fc ? `Interés: ${fc}.` : "Abierto a nuevos retos."}`
      : `${r} (${expBit}). Stack: ${stackPhrase}. ${fc ? `Interested in ${fc}.` : "Open to new challenges."}`;

    if (out1) out1.value = v1.replace(/\s+/g, " ").trim();
    if (out2) out2.value = v2.replace(/\s+/g, " ").trim();
    if (out3) out3.value = v3.replace(/\s+/g, " ").trim();
  });
}

init();

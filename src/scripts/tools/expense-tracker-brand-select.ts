/** Combobox de marcas con logo (financiación, bancos…). */

export type BrandCatalogEntry = {
  key: string;
  label: string;
};

export type BrandComboboxOptions = {
  value?: string;
  autoLabel?: string;
  onChange?: (key: string) => void;
  logoPath: (key: string, ext: "svg" | "png") => string;
};

function brandInitials(label: string): string {
  return label.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?";
}

function appendBrandLogo(
  parent: HTMLElement,
  key: string,
  label: string,
  logoPath: BrandComboboxOptions["logoPath"],
  sizeClass = "h-5 w-5",
) {
  if (!key) {
    parent.textContent = label;
    return;
  }
  const img = document.createElement("img");
  img.src = logoPath(key, "svg");
  img.alt = "";
  img.className = `${sizeClass} object-contain shrink-0`;
  img.addEventListener("error", () => {
    if (!img.dataset.fallback) {
      img.dataset.fallback = "1";
      img.src = logoPath(key, "png");
      return;
    }
    img.replaceWith(document.createTextNode(brandInitials(label)));
  });
  parent.appendChild(img);
}

export function renderBrandCombobox(
  host: HTMLElement,
  catalog: BrandCatalogEntry[],
  opts: BrandComboboxOptions,
) {
  const selected = opts.value?.trim() ?? "";
  host.innerHTML = "";
  host.className = "et-brand-combobox relative";

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.value = selected;
  if (host.dataset.brandHidden) hidden.dataset.brandHidden = host.dataset.brandHidden;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "et-brand-combobox__trigger et-field w-full flex items-center gap-2 text-sm py-2 text-left";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const triggerLabel = document.createElement("span");
  triggerLabel.className = "flex items-center gap-2 min-w-0 flex-1";
  const triggerText = document.createElement("span");
  triggerText.className = "truncate text-gray-800 dark:text-gray-100";

  const selBrand = catalog.find((b) => b.key === selected);
  if (selBrand) {
    appendBrandLogo(triggerLabel, selBrand.key, selBrand.label, opts.logoPath);
    triggerText.textContent = selBrand.label;
  } else {
    triggerText.textContent = opts.autoLabel ?? "Auto / sin marca";
  }
  triggerLabel.append(triggerText);

  const chevron = document.createElement("span");
  chevron.className = "text-gray-400 shrink-0 text-xs";
  chevron.textContent = "▾";
  trigger.append(triggerLabel, chevron);

  const panel = document.createElement("div");
  panel.className = "et-brand-combobox__panel hidden absolute left-0 right-0 top-full z-30 mt-1";
  panel.setAttribute("role", "listbox");

  function setValue(key: string) {
    hidden.value = key;
    triggerLabel.innerHTML = "";
    const brand = catalog.find((b) => b.key === key);
    if (brand) {
      appendBrandLogo(triggerLabel, brand.key, brand.label, opts.logoPath);
      const t = document.createElement("span");
      t.className = "truncate text-gray-800 dark:text-gray-100";
      t.textContent = brand.label;
      triggerLabel.appendChild(t);
    } else {
      const t = document.createElement("span");
      t.className = "truncate text-gray-800 dark:text-gray-100";
      t.textContent = opts.autoLabel ?? "Auto / sin marca";
      triggerLabel.appendChild(t);
    }
    panel.querySelectorAll(".et-brand-combobox__option").forEach((el) => {
      el.classList.toggle("et-brand-combobox__option--on", (el as HTMLElement).dataset.brandKey === key);
    });
    opts.onChange?.(key);
  }

  function addOption(key: string, label: string) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "et-brand-combobox__option flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm" +
      (key === selected ? " et-brand-combobox__option--on" : "");
    btn.dataset.brandKey = key;
    btn.setAttribute("role", "option");
    const logoWrap = document.createElement("span");
    logoWrap.className = "flex h-6 w-6 shrink-0 items-center justify-center";
    if (key) appendBrandLogo(logoWrap, key, label, opts.logoPath, "h-5 w-5");
    const lab = document.createElement("span");
    lab.textContent = label;
    btn.append(logoWrap, lab);
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setValue(key);
      panel.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
    });
    panel.appendChild(btn);
  }

  addOption("", opts.autoLabel ?? "Auto / sin marca");
  for (const brand of catalog) addOption(brand.key, brand.label);

  trigger.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const open = panel.classList.toggle("hidden");
    trigger.setAttribute("aria-expanded", open ? "false" : "true");
  });

  document.addEventListener("click", (ev) => {
    if (!host.contains(ev.target as Node)) {
      panel.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  host.append(hidden, trigger, panel);
  return { hidden, setValue };
}

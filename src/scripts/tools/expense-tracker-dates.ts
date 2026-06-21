import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

type FpInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

const FP_Z_INDEX = 100_001;
const MONTHS_ES = Spanish.months.longhand;

function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

/** Dentro de `<dialog>` el calendario debe colgar del propio modal (top layer), no de body. */
function flatpickrAppendTarget(input: HTMLInputElement): HTMLElement {
  return input.closest("dialog") ?? document.body;
}

function syncCalendarTheme(inst: flatpickr.Instance) {
  const cal = inst.calendarContainer;
  cal.classList.add("et-fp-calendar");
  const dark = isDarkTheme();
  cal.classList.toggle("et-fp-dark", dark);
  cal.classList.toggle("et-fp-light", !dark);
  cal.style.zIndex = String(FP_Z_INDEX);
}

function hideNativeMonthSelect(inst: flatpickr.Instance) {
  const nativeSelect = inst.calendarContainer.querySelector<HTMLSelectElement>(
    ".flatpickr-monthDropdown-months",
  );
  if (!nativeSelect || nativeSelect.dataset.etHidden === "1") return;
  nativeSelect.dataset.etHidden = "1";
  nativeSelect.style.display = "none";
  nativeSelect.setAttribute("aria-hidden", "true");
  nativeSelect.tabIndex = -1;
}

function closeMonthGrid(cal: HTMLElement) {
  const panel = cal.querySelector<HTMLElement>(".et-fp-month-grid");
  const trigger = cal.querySelector<HTMLButtonElement>(".et-fp-month-trigger");
  if (panel) panel.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  cal.classList.remove("et-fp-month-grid-open");
}

function syncMonthTriggerLabel(inst: flatpickr.Instance) {
  const cal = inst.calendarContainer;
  const btn = cal.querySelector<HTMLButtonElement>(".et-fp-month-trigger");
  if (!btn) return;
  btn.textContent = MONTHS_ES[inst.currentMonth] ?? "";
}

function enhanceMonthNavigation(inst: flatpickr.Instance) {
  const cal = inst.calendarContainer;
  if (cal.dataset.etMonthGridEnhanced === "1") return;
  cal.dataset.etMonthGridEnhanced = "1";

  const currentMonth = cal.querySelector(".flatpickr-current-month");
  const nativeSelect = cal.querySelector<HTMLSelectElement>(".flatpickr-monthDropdown-months");
  const rContainer = cal.querySelector(".flatpickr-rContainer");
  if (!currentMonth || !rContainer) return;

  hideNativeMonthSelect(inst);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "et-fp-month-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.textContent = MONTHS_ES[inst.currentMonth] ?? "";

  const panel = document.createElement("div");
  panel.className = "et-fp-month-grid";
  panel.hidden = true;
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "Seleccionar mes");

  MONTHS_ES.forEach((label, monthIdx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "et-fp-month-grid-item";
    btn.textContent = label;
    btn.dataset.monthIndex = String(monthIdx);
    btn.setAttribute("role", "option");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      inst.changeMonth(monthIdx, false);
      syncMonthTriggerLabel(inst);
      closeMonthGrid(cal);
      panel.querySelectorAll(".et-fp-month-grid-item").forEach((el) => {
        el.classList.toggle("et-fp-month-grid-item--active", el === btn);
      });
    });
    panel.appendChild(btn);
  });

  trigger.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    cal.classList.toggle("et-fp-month-grid-open", open);
    if (open) {
      panel.querySelectorAll(".et-fp-month-grid-item").forEach((el) => {
        el.classList.toggle(
          "et-fp-month-grid-item--active",
          Number((el as HTMLElement).dataset.monthIndex) === inst.currentMonth,
        );
      });
    }
  });

  if (nativeSelect?.parentElement) {
    nativeSelect.parentElement.insertBefore(trigger, nativeSelect);
  } else {
    currentMonth.insertBefore(trigger, currentMonth.firstChild);
  }
  rContainer.appendChild(panel);

  cal.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest(".et-fp-month-trigger") || t.closest(".et-fp-month-grid")) return;
    closeMonthGrid(cal);
  });
}

function baseOptions(input: HTMLInputElement): Partial<flatpickr.Options.Options> {
  const appendTo = flatpickrAppendTarget(input);
  return {
    locale: Spanish,
    allowInput: true,
    disableMobile: true,
    appendTo,
    onReady(_d, _s, inst) {
      syncCalendarTheme(inst);
      enhanceMonthNavigation(inst);
      syncMonthTriggerLabel(inst);
    },
    onOpen(_d, _s, inst) {
      syncCalendarTheme(inst);
      hideNativeMonthSelect(inst);
      syncMonthTriggerLabel(inst);
      closeMonthGrid(inst.calendarContainer);
    },
    onMonthChange(_d, _s, inst) {
      hideNativeMonthSelect(inst);
      syncMonthTriggerLabel(inst);
    },
    onYearChange(_d, _s, inst) {
      hideNativeMonthSelect(inst);
      syncMonthTriggerLabel(inst);
    },
    onClose(_d, _s, inst) {
      closeMonthGrid(inst.calendarContainer);
    },
  };
}

function fpOnChange(input: HTMLInputElement) {
  return () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
}

function bindFlatpickr(input: HTMLInputElement, extra?: Partial<flatpickr.Options.Options>) {
  flatpickr(input, {
    ...baseOptions(input),
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    onChange: fpOnChange(input),
    ...extra,
  });
}

function polishFlatpickrInstance(inst: flatpickr.Instance) {
  syncCalendarTheme(inst);
  hideNativeMonthSelect(inst);
  enhanceMonthNavigation(inst);
  syncMonthTriggerLabel(inst);
}

/** Idempotente: crea o repone flatpickr en un campo fecha. */
export function ensureExpenseDatePicker(input: HTMLInputElement | null | undefined, iso?: string) {
  if (!input) return;
  const val = (iso ?? input.value).slice(0, 10);
  if (val.length === 10) input.value = val;
  const wantAppend = flatpickrAppendTarget(input);
  const fp = (input as FpInput)._flatpickr;
  if (fp && fp.calendarContainer.parentElement !== wantAppend) {
    fp.destroy();
  }
  const fpLive = (input as FpInput)._flatpickr;
  if (fpLive) {
    if (val.length === 10) fpLive.setDate(val, false);
    polishFlatpickrInstance(fpLive);
    return;
  }
  bindFlatpickr(input);
  const fpNew = (input as FpInput)._flatpickr;
  if (fpNew) {
    if (val.length === 10) fpNew.setDate(val, false);
    polishFlatpickrInstance(fpNew);
  }
}

function bindMonthPicker(input: HTMLInputElement) {
  if (input.type === "month") {
    const v = input.value;
    input.type = "text";
    input.readOnly = true;
    input.classList.add("cursor-pointer");
    if (v) input.value = v;
  }
  flatpickr(input, {
    ...baseOptions(input),
    dateFormat: "Y-m",
    altInput: true,
    altFormat: "F \\de Y",
    defaultDate: /^\d{4}-\d{2}$/.test(input.value) ? `${input.value}-01` : undefined,
    onChange: fpOnChange(input),
  });
}

export function initExpenseDatePickers(root: HTMLElement) {
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
    ensureExpenseDatePicker(input);
  }
  initExpenseMonthPickers(root);
}

export function initExpenseMonthPickers(root: HTMLElement) {
  for (const input of root.querySelectorAll<HTMLInputElement>("[data-et-month-picker]")) {
    if ((input as FpInput)._flatpickr) continue;
    bindMonthPicker(input);
  }
}

/** Sincroniza valor y asegura flatpickr en un campo concreto (p. ej. al abrir un modal). */
export function refreshExpenseDatePicker(input: HTMLInputElement | null | undefined, iso?: string) {
  ensureExpenseDatePicker(input, iso);
}

export function readDateFieldValue(input: HTMLInputElement | null | undefined): string {
  if (!input) return "";
  const fp = (input as FpInput)._flatpickr;
  if (fp?.selectedDates?.[0]) return fp.formatDate(fp.selectedDates[0], "Y-m-d");
  return input.value.trim().slice(0, 10);
}

export function readMonthFieldValue(input: HTMLInputElement | null | undefined): string {
  if (!input) return "";
  const fp = (input as FpInput)._flatpickr;
  if (fp?.selectedDates?.[0]) return fp.formatDate(fp.selectedDates[0], "Y-m");
  const v = input.value.trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(v) ? v : "";
}

/** Abre un dialog nativo e inicializa flatpickr en sus campos fecha. */
export function showExpenseDialog(dlg: HTMLDialogElement | null | undefined) {
  if (!dlg) return;
  dlg.showModal();
  queueMicrotask(() => initExpenseDatePickers(dlg));
}

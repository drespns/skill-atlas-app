import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

type FpInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

const FP_Z_INDEX = 100_001;

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

function baseOptions(input: HTMLInputElement): Partial<flatpickr.Options.Options> {
  const appendTo = flatpickrAppendTarget(input);
  return {
    locale: Spanish,
    allowInput: true,
    disableMobile: true,
    appendTo,
    onReady(_d, _s, inst) {
      syncCalendarTheme(inst);
      hideNativeMonthSelect(inst);
    },
    onOpen(_d, _s, inst) {
      syncCalendarTheme(inst);
      hideNativeMonthSelect(inst);
    },
    onMonthChange(_d, _s, inst) {
      hideNativeMonthSelect(inst);
    },
    onYearChange(_d, _s, inst) {
      hideNativeMonthSelect(inst);
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
    if ((input as FpInput)._flatpickr) continue;
    bindFlatpickr(input);
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
    syncCalendarTheme(fpLive);
    hideNativeMonthSelect(fpLive);
    return;
  }
  bindFlatpickr(input);
  const fpNew = (input as FpInput)._flatpickr;
  if (fpNew && val.length === 10) fpNew.setDate(val, false);
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

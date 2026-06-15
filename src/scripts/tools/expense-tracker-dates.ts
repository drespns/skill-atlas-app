import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

type FpInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

const FP_Z_INDEX = 100_001;

function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

function syncCalendarTheme(inst: flatpickr.Instance) {
  inst.calendarContainer.classList.toggle("et-fp-dark", isDarkTheme());
  inst.calendarContainer.style.zIndex = String(FP_Z_INDEX);
}

function baseOptions(): Partial<flatpickr.Options.Options> {
  return {
    locale: Spanish,
    allowInput: true,
    disableMobile: true,
    appendTo: document.body,
    onReady(_d, _s, inst) {
      syncCalendarTheme(inst);
    },
    onOpen(_d, _s, inst) {
      syncCalendarTheme(inst);
    },
  };
}

function bindFlatpickr(input: HTMLInputElement, extra?: Partial<flatpickr.Options.Options>) {
  flatpickr(input, {
    ...baseOptions(),
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
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
    ...baseOptions(),
    dateFormat: "Y-m",
    altInput: true,
    altFormat: "F \\de Y",
    defaultDate: /^\d{4}-\d{2}$/.test(input.value) ? `${input.value}-01` : undefined,
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
  const fp = (input as FpInput)._flatpickr;
  if (fp) {
    if (val.length === 10) fp.setDate(val, false);
    syncCalendarTheme(fp);
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

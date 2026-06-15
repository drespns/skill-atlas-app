import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

type FpInput = HTMLInputElement & { _flatpickr?: flatpickr.Instance };

function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

function syncCalendarTheme(inst: flatpickr.Instance) {
  inst.calendarContainer.classList.toggle("et-fp-dark", isDarkTheme());
}

function bindFlatpickr(input: HTMLInputElement) {
  flatpickr(input, {
    locale: Spanish,
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    allowInput: true,
    disableMobile: true,
    onReady(_d, _s, inst) {
      syncCalendarTheme(inst);
    },
    onOpen(_d, _s, inst) {
      syncCalendarTheme(inst);
    },
  });
}

export function initExpenseDatePickers(root: HTMLElement) {
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
    if ((input as FpInput)._flatpickr) continue;
    bindFlatpickr(input);
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

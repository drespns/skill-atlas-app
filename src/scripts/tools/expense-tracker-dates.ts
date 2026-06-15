import flatpickr from "flatpickr";
import { Spanish } from "flatpickr/dist/l10n/es.js";

function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

function syncCalendarTheme(inst: flatpickr.Instance) {
  inst.calendarContainer.classList.toggle("et-fp-dark", isDarkTheme());
}

export function initExpenseDatePickers(root: HTMLElement) {
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
    if ((input as HTMLInputElement & { _flatpickr?: flatpickr.Instance })._flatpickr) continue;
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
}

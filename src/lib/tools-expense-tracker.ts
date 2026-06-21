/** Re-export dominio compartido web + móvil. Persistencia web en tools-expense-tracker-browser. */
export * from "@skill-atlas/expense-core";
export {
  loadExpenseTrackerFromStorage,
  saveExpenseTrackerToStorage,
  downloadTextFile,
  downloadBlobFile,
} from "./tools-expense-tracker-browser";

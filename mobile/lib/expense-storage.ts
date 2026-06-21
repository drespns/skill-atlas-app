import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EXPENSE_TRACKER_STORAGE_KEY,
  normalizeExpenseTrackerState,
  type ExpenseTrackerState,
} from "@skill-atlas/expense-core";

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadExpenseLocal(): Promise<ExpenseTrackerState> {
  const raw = await AsyncStorage.getItem(EXPENSE_TRACKER_STORAGE_KEY);
  return normalizeExpenseTrackerState(safeParse(raw));
}

export async function saveExpenseLocal(state: ExpenseTrackerState): Promise<void> {
  await AsyncStorage.setItem(EXPENSE_TRACKER_STORAGE_KEY, JSON.stringify(state));
}

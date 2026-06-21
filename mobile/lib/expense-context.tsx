import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addQuickExpense,
  addQuickIncome,
  defaultExpenseTrackerState,
  type ExpenseTrackerState,
} from "@skill-atlas/expense-core";
import { useAuth } from "./auth-context";
import { hydrateExpenseState, persistExpenseState, type SyncStatus } from "./expense-sync";

type ExpenseContextValue = {
  state: ExpenseTrackerState;
  loading: boolean;
  syncStatus: SyncStatus;
  needsUnlock: boolean;
  e2ePassphrase: string | null;
  setE2ePassphrase: (p: string | null) => void;
  refresh: () => Promise<void>;
  updateState: (next: ExpenseTrackerState) => Promise<void>;
  addExpense: (input: {
    label: string;
    amount: number;
    categoryId: string;
    date?: string;
    notes?: string;
  }) => Promise<void>;
  addIncome: (input: {
    label: string;
    amount: number;
    categoryId: string;
    date?: string;
    notes?: string;
  }) => Promise<void>;
  setSyncToAccount: (on: boolean) => Promise<void>;
  unlockE2e: (passphrase: string) => Promise<{ ok: boolean; error?: string }>;
};

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

function makeId() {
  return `mob_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<ExpenseTrackerState>(defaultExpenseTrackerState());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [e2ePassphrase, setE2ePassphrase] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await hydrateExpenseState(e2ePassphrase);
    setState(result.state);
    setSyncStatus(result.status);
    setNeedsUnlock(result.needsUnlock);
    setLoading(false);
  }, [e2ePassphrase]);

  useEffect(() => {
    if (!session) {
      setState(defaultExpenseTrackerState());
      setLoading(false);
      return;
    }
    void refresh();
  }, [session, refresh]);

  const updateState = useCallback(
    async (next: ExpenseTrackerState) => {
      setState(next);
      await persistExpenseState(next, e2ePassphrase, setSyncStatus);
    },
    [e2ePassphrase],
  );

  const addExpense = useCallback(
    async (input: Parameters<ExpenseContextValue["addExpense"]>[0]) => {
      const next = addQuickExpense(state, { ...input, id: makeId() });
      await updateState({ ...next, syncToAccount: state.syncToAccount || Boolean(session) });
    },
    [state, session, updateState],
  );

  const addIncome = useCallback(
    async (input: Parameters<ExpenseContextValue["addIncome"]>[0]) => {
      const next = addQuickIncome(state, { ...input, id: makeId() });
      await updateState({ ...next, syncToAccount: state.syncToAccount || Boolean(session) });
    },
    [state, session, updateState],
  );

  const setSyncToAccount = useCallback(
    async (on: boolean) => {
      await updateState({ ...state, syncToAccount: on });
    },
    [state, updateState],
  );

  const unlockE2e = useCallback(async (passphrase: string) => {
    setE2ePassphrase(passphrase);
    setLoading(true);
    const result = await hydrateExpenseState(passphrase);
    if (result.needsUnlock) {
      setLoading(false);
      return { ok: false, error: "Frase incorrecta" };
    }
    setState(result.state);
    setSyncStatus(result.status);
    setNeedsUnlock(false);
    setLoading(false);
    return { ok: true };
  }, []);

  const value = useMemo(
    () => ({
      state,
      loading,
      syncStatus,
      needsUnlock,
      e2ePassphrase,
      setE2ePassphrase,
      refresh,
      updateState,
      addExpense,
      addIncome,
      setSyncToAccount,
      unlockE2e,
    }),
    [
      state,
      loading,
      syncStatus,
      needsUnlock,
      e2ePassphrase,
      refresh,
      updateState,
      addExpense,
      addIncome,
      setSyncToAccount,
      unlockE2e,
    ],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpense() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpense outside ExpenseProvider");
  return ctx;
}

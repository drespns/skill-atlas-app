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
  resolveSubscriptionBrandKey,
  scheduleSubscriptionCancel,
  type BillingCycle,
  type ExpenseCurrency,
  type ExpenseTrackerState,
  type SubscriptionRow,
} from "@skill-atlas/expense-core";
import { useAuth } from "./auth-context";
import { hydrateExpenseState, persistExpenseState, type SyncStatus } from "./expense-sync";

type TxInput = {
  label: string;
  amount: number;
  categoryId: string;
  date?: string;
  notes?: string;
  wealthAccountId?: string;
};

type ExpenseContextValue = {
  state: ExpenseTrackerState;
  loading: boolean;
  syncStatus: SyncStatus;
  needsUnlock: boolean;
  e2ePassphrase: string | null;
  setE2ePassphrase: (p: string | null) => void;
  refresh: () => Promise<void>;
  updateState: (next: ExpenseTrackerState) => Promise<void>;
  addExpense: (input: TxInput) => Promise<void>;
  addIncome: (input: TxInput) => Promise<void>;
  setDefaultWealthAccount: (
    accountId: string,
    role: "expense" | "income" | "investment",
  ) => Promise<void>;
  cancelSubscription: (id: string) => Promise<void>;
  addSubscription: (input: {
    name: string;
    amount: number;
    cycle: BillingCycle;
    categoryId: string;
    currency?: ExpenseCurrency;
    nextBilling?: string;
  }) => Promise<void>;
  setSyncToAccount: (on: boolean) => Promise<void>;
  unlockE2e: (passphrase: string) => Promise<{ ok: boolean; error?: string }>;
};

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

function makeId(prefix = "mob") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

  const withSyncFlag = useCallback(
    (next: ExpenseTrackerState) => ({
      ...next,
      syncToAccount: next.syncToAccount || Boolean(session),
    }),
    [session],
  );

  const addExpense = useCallback(
    async (input: TxInput) => {
      const next = addQuickExpense(state, { ...input, id: makeId("exp") });
      await updateState(withSyncFlag(next));
    },
    [state, updateState, withSyncFlag],
  );

  const addIncome = useCallback(
    async (input: TxInput) => {
      const next = addQuickIncome(state, { ...input, id: makeId("inc") });
      await updateState(withSyncFlag(next));
    },
    [state, updateState, withSyncFlag],
  );

  const setDefaultWealthAccount = useCallback(
    async (accountId: string, role: "expense" | "income" | "investment") => {
      const flag =
        role === "expense"
          ? "isDefaultExpense"
          : role === "income"
            ? "isDefaultIncome"
            : "isDefaultInvestment";
      const wealthAccounts = (state.wealthAccounts ?? []).map((a) => ({
        ...a,
        [flag]: a.id === accountId,
      }));
      await updateState(withSyncFlag({ ...state, wealthAccounts }));
    },
    [state, updateState, withSyncFlag],
  );

  const cancelSubscription = useCallback(
    async (id: string) => {
      const subscriptions = (state.subscriptions ?? []).map((s) =>
        s.id === id ? scheduleSubscriptionCancel(s) : s,
      );
      await updateState(withSyncFlag({ ...state, subscriptions }));
    },
    [state, updateState, withSyncFlag],
  );

  const addSubscription = useCallback(
    async (input: {
      name: string;
      amount: number;
      cycle: BillingCycle;
      categoryId: string;
      currency?: ExpenseCurrency;
      nextBilling?: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      const name = input.name.trim() || "Suscripción";
      const row: SubscriptionRow = {
        id: makeId("sub"),
        name,
        amount: Math.max(0, input.amount),
        currency: input.currency ?? "EUR",
        cycle: input.cycle,
        categoryId: input.categoryId,
        nextBilling: (input.nextBilling ?? today).slice(0, 10),
        billingStartDate: (input.nextBilling ?? today).slice(0, 10),
        active: true,
        notes: "",
        tags: [],
        brandKey: resolveSubscriptionBrandKey(name),
      };
      await updateState(
        withSyncFlag({ ...state, subscriptions: [...(state.subscriptions ?? []), row] }),
      );
    },
    [state, updateState, withSyncFlag],
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
      setDefaultWealthAccount,
      cancelSubscription,
      addSubscription,
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
      setDefaultWealthAccount,
      cancelSubscription,
      addSubscription,
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

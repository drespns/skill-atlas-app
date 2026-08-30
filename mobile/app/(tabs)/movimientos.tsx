import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  currentMonthKey,
  formatEurEs,
  groupTransactionsByDay,
  listTransactionsForMonth,
  monthExpenseIncomeTotals,
} from "@skill-atlas/expense-core";
import { TransactionList } from "@/components/TransactionList";
import { useExpense } from "@/lib/expense-context";

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function formatDayHeader(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MovimientosScreen() {
  const router = useRouter();
  const { state, loading } = useExpense();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const isCurrentMonth = monthKey === currentMonthKey();

  const totals = useMemo(() => monthExpenseIncomeTotals(state, monthKey), [state, monthKey]);
  const txs = useMemo(() => listTransactionsForMonth(state, monthKey), [state, monthKey]);
  const grouped = useMemo(() => groupTransactionsByDay(txs), [txs]);
  const sections = useMemo(
    () => [...grouped.entries()].map(([date, data]) => ({ title: formatDayHeader(date), data })),
    [grouped],
  );

  const accountName = (id?: string) =>
    id ? (state.wealthAccounts ?? []).find((a) => a.id === id)?.name : undefined;
  const categoryName = (id: string) => state.categories.find((c) => c.id === id)?.name ?? "Otros";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setMonthKey((k) => shiftMonthKey(k, -1))}
            style={styles.monthNavBtn}
            accessibilityLabel="Mes anterior"
          >
            <Text style={styles.monthNavText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonthTitle(monthKey)}</Text>
          <Pressable
            onPress={() => setMonthKey((k) => shiftMonthKey(k, 1))}
            style={[styles.monthNavBtn, isCurrentMonth && styles.monthNavBtnDisabled]}
            disabled={isCurrentMonth}
            accessibilityLabel="Mes siguiente"
          >
            <Text style={[styles.monthNavText, isCurrentMonth && styles.monthNavTextDisabled]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, styles.kpiExpense]}>
            <Text style={styles.kpiLabel}>Gastos</Text>
            <Text style={styles.kpiValue}>{formatEurEs(totals.expenses)}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiIncome]}>
            <Text style={styles.kpiLabel}>Ingresos</Text>
            <Text style={styles.kpiValue}>{formatEurEs(totals.income)}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiBalance]}>
            <Text style={styles.kpiLabel}>Balance</Text>
            <Text style={styles.kpiValue}>{formatEurEs(totals.balance)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TransactionList
            sections={sections}
            categoryName={categoryName}
            accountName={accountName}
          />
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push("/add-transaction")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 88 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 4 },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
  },
  monthNavBtnDisabled: { opacity: 0.35 },
  monthNavText: { fontSize: 22, fontWeight: "700", color: "#0f172a", lineHeight: 24 },
  monthNavTextDisabled: { color: "#94a3b8" },
  monthTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textTransform: "capitalize",
    textAlign: "center",
  },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  kpi: { flex: 1, borderRadius: 14, padding: 12 },
  kpiExpense: { backgroundColor: "#ffe4e6" },
  kpiIncome: { backgroundColor: "#d1fae5" },
  kpiBalance: { backgroundColor: "#e0e7ff" },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  kpiValue: { marginTop: 4, fontSize: 13, fontWeight: "800", color: "#0f172a" },
  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#312e81",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: "#fff", fontSize: 32, fontWeight: "400", lineHeight: 34, marginTop: -2 },
});

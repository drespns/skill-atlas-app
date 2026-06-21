import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  currentMonthKey,
  expenseCategoryBreakdown,
  formatEurEs,
  groupTransactionsByDay,
  listTransactionsForMonth,
  monthExpenseIncomeTotals,
} from "@skill-atlas/expense-core";
import { DonutChart } from "@/components/DonutChart";
import { SyncBadge } from "@/components/SyncBadge";
import { TransactionList } from "@/components/TransactionList";
import { useExpense } from "@/lib/expense-context";

function formatDayHeader(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export default function HomeScreen() {
  const router = useRouter();
  const { state, loading, syncStatus, needsUnlock, refresh } = useExpense();
  const monthKey = currentMonthKey();

  const totals = useMemo(() => monthExpenseIncomeTotals(state, monthKey), [state, monthKey]);
  const slices = useMemo(() => expenseCategoryBreakdown(state, monthKey), [state, monthKey]);
  const txs = useMemo(() => listTransactionsForMonth(state, monthKey), [state, monthKey]);
  const grouped = useMemo(() => groupTransactionsByDay(txs), [txs]);

  const sections = useMemo(
    () =>
      [...grouped.entries()].map(([date, data]) => ({
        title: formatDayHeader(date),
        data,
      })),
    [grouped],
  );

  const categoryName = (id: string) => state.categories.find((c) => c.id === id)?.name ?? "Otros";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.monthTitle}>
            {new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </Text>
          <SyncBadge status={syncStatus} />
        </View>
        <Pressable onPress={() => void refresh()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Actualizar</Text>
        </Pressable>
      </View>

      {needsUnlock ? (
        <Pressable style={styles.unlockBanner} onPress={() => router.push("/unlock-e2e")}>
          <Text style={styles.unlockTitle}>Cuaderno cifrado en la nube</Text>
          <Text style={styles.unlockSub}>Toca para desbloquear con tu frase del cuaderno</Text>
        </Pressable>
      ) : null}

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
        <Text style={styles.cardTitle}>Gastos por categoría</Text>
        <DonutChart
          slices={slices}
          centerLabel="Gastos mes"
          centerValue={formatEurEs(totals.expenses, true)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Movimientos</Text>
        <TransactionList sections={sections} categoryName={categoryName} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  monthTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", textTransform: "capitalize" },
  refreshBtn: { padding: 8 },
  refreshText: { color: "#4f46e5", fontWeight: "600", fontSize: 13 },
  unlockBanner: {
    marginTop: 12,
    backgroundColor: "#ede9fe",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#c4b5fd",
  },
  unlockTitle: { fontWeight: "700", color: "#5b21b6" },
  unlockSub: { marginTop: 4, fontSize: 12, color: "#6d28d9" },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  kpi: { flex: 1, borderRadius: 14, padding: 12 },
  kpiExpense: { backgroundColor: "#ffe4e6" },
  kpiIncome: { backgroundColor: "#d1fae5" },
  kpiBalance: { backgroundColor: "#e0e7ff" },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  kpiValue: { marginTop: 4, fontSize: 14, fontWeight: "800", color: "#0f172a" },
  card: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
});

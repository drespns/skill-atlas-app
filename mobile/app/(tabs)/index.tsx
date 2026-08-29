import { useMemo, useState } from "react";
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

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, (m! - 1) + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, m! - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function formatDayHeader(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export default function HomeScreen() {
  const router = useRouter();
  const { state, loading, syncStatus, needsUnlock, refresh } = useExpense();
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const isCurrentMonth = monthKey === currentMonthKey();

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
        <View style={styles.headerLeft}>
          <Text style={styles.brandKicker}>Finanzas · Cuaderno</Text>
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
          <SyncBadge status={syncStatus} />
        </View>
        <Pressable onPress={() => void refresh()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Actualizar</Text>
        </Pressable>
      </View>

      {needsUnlock ? (
        <Pressable style={styles.unlockBanner} onPress={() => router.push("/unlock-e2e")}>
          <Text style={styles.unlockTitle}>Cuaderno cifrado en la nube</Text>
          <Text style={styles.unlockSub}>
            Toca para desbloquear con la misma frase que usas en Finanzas web
          </Text>
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

      <Text style={styles.txCount}>
        {txs.length === 0
          ? "Ningún movimiento"
          : txs.length === 1
            ? "1 movimiento"
            : `${txs.length} movimientos`}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gastos por categoría</Text>
        {slices.length === 0 ? (
          <Text style={styles.cardEmpty}>Sin gastos categorizados este mes</Text>
        ) : (
          <DonutChart
            slices={slices}
            centerLabel="Gastos mes"
            centerValue={formatEurEs(totals.expenses, true)}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Movimientos</Text>
        <TransactionList sections={sections} categoryName={categoryName} />
      </View>

      <Text style={styles.footerHint}>
        Suscripciones, patrimonio e inversiones se gestionan en la web. Aquí: captura rápida y resumen del mes.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1, marginRight: 8 },
  brandKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6366f1",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  monthNav: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  monthNavBtn: {
    width: 32,
    height: 32,
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
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    textTransform: "capitalize",
    textAlign: "center",
  },
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
  unlockSub: { marginTop: 4, fontSize: 12, color: "#6d28d9", lineHeight: 17 },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  kpi: { flex: 1, borderRadius: 14, padding: 12 },
  kpiExpense: { backgroundColor: "#ffe4e6" },
  kpiIncome: { backgroundColor: "#d1fae5" },
  kpiBalance: { backgroundColor: "#e0e7ff" },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  kpiValue: { marginTop: 4, fontSize: 14, fontWeight: "800", color: "#0f172a" },
  txCount: { marginTop: 10, fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  cardEmpty: { fontSize: 13, color: "#94a3b8", paddingVertical: 12 },
  footerHint: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    color: "#94a3b8",
    textAlign: "center",
  },
});

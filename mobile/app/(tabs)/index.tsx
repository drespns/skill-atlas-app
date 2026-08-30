import { useMemo } from "react";
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
  buildMonthlyCashflowProjection,
  computeCashAvailableTotal,
  computePatrimonioSnapshot,
  formatEurEs,
} from "@skill-atlas/expense-core";
import { MonthLineChart, type MonthSeriesPoint } from "@/components/MonthLineChart";
import { SyncBadge } from "@/components/SyncBadge";
import { useExpense } from "@/lib/expense-context";

function yearMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y!, m! - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

export default function InicioScreen() {
  const router = useRouter();
  const { state, loading, syncStatus, needsUnlock, refresh } = useExpense();

  const year = new Date().getFullYear();
  const months = useMemo(() => yearMonthKeys(year), [year]);

  const cash = useMemo(
    () => computeCashAvailableTotal(state.wealthAccounts ?? []),
    [state.wealthAccounts],
  );
  const patrimonio = useMemo(() => computePatrimonioSnapshot(state), [state]);

  const chartPoints: MonthSeriesPoint[] = useMemo(() => {
    const proj = buildMonthlyCashflowProjection(state, months, {
      horizon: "projected",
      mode: "unify_eur",
    });
    return months.map((mk, i) => ({
      monthKey: mk,
      label: `${monthShortLabel(mk)} ${String(year).slice(2)}`,
      expenses: proj.outUnified[i] ?? 0,
      income: proj.inUnified[i] ?? 0,
    }));
  }, [state, months, year]);

  const accounts = state.wealthAccounts ?? [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <SyncBadge status={syncStatus} />
        <Pressable onPress={() => void refresh()} hitSlop={8}>
          <Text style={styles.refresh}>Actualizar</Text>
        </Pressable>
      </View>

      {needsUnlock ? (
        <Pressable style={styles.unlockBanner} onPress={() => router.push("/unlock-e2e")}>
          <Text style={styles.unlockTitle}>Cuaderno cifrado</Text>
          <Text style={styles.unlockSub}>Toca para desbloquear con tu frase</Text>
        </Pressable>
      ) : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Efectivo disponible</Text>
        <Text style={styles.heroValue}>{formatEurEs(cash)}</Text>
        <View style={styles.heroSplit}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Patrimonio</Text>
            <Text style={styles.heroStatValue}>{formatEurEs(patrimonio.total)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Inversiones</Text>
            <Text style={styles.heroStatValue}>{formatEurEs(patrimonio.investmentsPart)}</Text>
          </View>
        </View>
      </View>

      {accounts.length > 0 ? (
        <View style={styles.accountsBlock}>
          {accounts.slice(0, 4).map((a) => (
            <View key={a.id} style={styles.accountRow}>
              <Text style={styles.accountName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.accountBal}>{formatEurEs(a.balance)}</Text>
            </View>
          ))}
          {accounts.length > 4 ? (
            <Text style={styles.moreAccounts}>+{accounts.length - 4} cuentas más</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.hint}>
          Sin cuentas aún. Sincroniza con la web o añade patrimonio allí.
        </Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Proyección {year}</Text>
        <Text style={styles.cardSub}>Gastos e ingresos previstos por mes</Text>
        <MonthLineChart points={chartPoints} />
      </View>

      <Pressable style={styles.cta} onPress={() => router.push("/add-transaction")}>
        <Text style={styles.ctaText}>Añadir gasto o ingreso</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  refresh: { color: "#4f46e5", fontWeight: "600", fontSize: 13 },
  unlockBanner: {
    marginBottom: 12,
    backgroundColor: "#ede9fe",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#c4b5fd",
  },
  unlockTitle: { fontWeight: "700", color: "#5b21b6" },
  unlockSub: { marginTop: 4, fontSize: 12, color: "#6d28d9" },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroValue: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  heroSplit: { flexDirection: "row", gap: 16, marginTop: 18 },
  heroStat: { flex: 1 },
  heroStatLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  heroStatValue: { marginTop: 4, fontSize: 16, fontWeight: "700", color: "#e2e8f0" },
  accountsBlock: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  accountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountName: { flex: 1, fontSize: 13, fontWeight: "600", color: "#334155", marginRight: 8 },
  accountBal: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  moreAccounts: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  hint: { marginTop: 12, fontSize: 12, color: "#94a3b8", lineHeight: 18 },
  card: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardSub: { marginTop: 2, marginBottom: 12, fontSize: 12, color: "#94a3b8" },
  cta: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  formatEurEs,
  investmentCurrentValue,
  investmentGainLossAmount,
  investmentPortfolioTotals,
  investmentTypeLabel,
} from "@skill-atlas/expense-core";
import { useExpense } from "@/lib/expense-context";

export default function InvestmentsScreen() {
  const { state, loading } = useExpense();
  const holdings = state.investments ?? [];
  const totals = useMemo(() => investmentPortfolioTotals(holdings), [holdings]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Valor actual</Text>
        <Text style={styles.heroValue}>{formatEurEs(totals.current)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Invertido</Text>
            <Text style={styles.heroStatValue}>{formatEurEs(totals.invested)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>G/P</Text>
            <Text
              style={[
                styles.heroStatValue,
                totals.gainLoss >= 0 ? styles.gain : styles.loss,
              ]}
            >
              {totals.gainLoss >= 0 ? "+" : ""}
              {formatEurEs(totals.gainLoss)}
            </Text>
          </View>
        </View>
      </View>

      {holdings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sin posiciones</Text>
          <Text style={styles.emptyText}>
            Las inversiones se gestionan en la web (compras, % y brokers). Aquí ves el resumen
            sincronizado.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {holdings.map((h) => {
            const current = investmentCurrentValue(h);
            const gl = investmentGainLossAmount(h);
            return (
              <View key={h.id} style={styles.card}>
                <View style={styles.cardMain}>
                  <Text style={styles.name} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {investmentTypeLabel(h.type)}
                    {h.platform ? ` · ${h.platform}` : ""}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amount}>{formatEurEs(current)}</Text>
                  <Text style={[styles.gl, gl >= 0 ? styles.gain : styles.loss]}>
                    {gl >= 0 ? "+" : ""}
                    {formatEurEs(gl)}
                    {Number.isFinite(h.gainLossPct) ? ` (${h.gainLossPct.toFixed(1)}%)` : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroValue: { marginTop: 4, fontSize: 28, fontWeight: "800", color: "#f8fafc" },
  heroRow: { flexDirection: "row", gap: 16, marginTop: 14 },
  heroStat: { flex: 1 },
  heroStatLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  heroStatValue: { marginTop: 4, fontSize: 15, fontWeight: "700", color: "#e2e8f0" },
  list: { gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minHeight: 64,
  },
  cardMain: { flex: 1, marginRight: 8 },
  name: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, fontSize: 11, color: "#64748b" },
  cardRight: { alignItems: "flex-end" },
  amount: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  gl: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  gain: { color: "#059669" },
  loss: { color: "#e11d48" },
  empty: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  emptyText: { marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 19 },
});

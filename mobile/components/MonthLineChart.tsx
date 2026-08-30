import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatEurEs } from "@skill-atlas/expense-core";

export type MonthSeriesPoint = {
  monthKey: string;
  label: string;
  expenses: number;
  income: number;
};

type Props = {
  points: MonthSeriesPoint[];
};

const CHART_H = 140;

/**
 * Gráfico simple sin react-native-gifted-charts (falla en Expo web).
 * Detalle del mes seleccionado SIEMPRE debajo, dentro del viewport.
 */
export function MonthLineChart({ points }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const maxY = useMemo(
    () => Math.max(1, ...points.flatMap((p) => [p.expenses, p.income])),
    [points],
  );

  if (!points.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin datos para el gráfico</Text>
      </View>
    );
  }

  const sel = selected != null ? points[selected] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        {points.map((p, i) => {
          const expH = Math.max(2, (p.expenses / maxY) * CHART_H);
          const incH = Math.max(2, (p.income / maxY) * CHART_H);
          const active = selected === i;
          return (
            <Pressable
              key={p.monthKey}
              style={[styles.col, active && styles.colActive]}
              onPress={() => setSelected(i === selected ? null : i)}
              accessibilityLabel={`${p.label}: gastos ${p.expenses}, ingresos ${p.income}`}
            >
              <View style={styles.bars}>
                <View style={[styles.bar, styles.barExpense, { height: expH }]} />
                <View style={[styles.bar, styles.barIncome, { height: incH }]} />
              </View>
              <Text style={styles.tick} numberOfLines={1}>
                {p.label.slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#e11d48" }]} />
          <Text style={styles.legendText}>Gastos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#059669" }]} />
          <Text style={styles.legendText}>Ingresos</Text>
        </View>
      </View>

      <View style={styles.tooltip}>
        {sel ? (
          <>
            <Text style={styles.tooltipTitle}>{sel.label}</Text>
            <Text style={styles.tooltipLine}>
              Gastos {formatEurEs(sel.expenses)} · Ingresos {formatEurEs(sel.income)}
            </Text>
          </>
        ) : (
          <Text style={styles.tooltipIdle}>Toca un mes para ver el detalle</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  empty: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
  },
  emptyText: { color: "#94a3b8", fontSize: 13 },
  chart: {
    height: CHART_H + 28,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 8,
  },
  col: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  colActive: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
  },
  bars: {
    height: CHART_H,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  bar: {
    width: 5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barExpense: { backgroundColor: "#e11d48" },
  barIncome: { backgroundColor: "#059669" },
  tick: {
    marginTop: 4,
    fontSize: 9,
    color: "#94a3b8",
    textTransform: "capitalize",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  tooltip: {
    marginTop: 12,
    width: "100%",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textTransform: "capitalize",
  },
  tooltipLine: { marginTop: 4, fontSize: 12, color: "#334155", lineHeight: 18 },
  tooltipIdle: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
});

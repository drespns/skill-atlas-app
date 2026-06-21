import { PieChart } from "react-native-gifted-charts";
import { StyleSheet, Text, View } from "react-native";
import type { CategorySlice } from "@skill-atlas/expense-core";
import { formatEurEs } from "@skill-atlas/expense-core";

type Props = {
  slices: CategorySlice[];
  centerLabel: string;
  centerValue: string;
};

export function DonutChart({ slices, centerLabel, centerValue }: Props) {
  if (!slices.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin gastos confirmados este mes</Text>
      </View>
    );
  }

  const data = slices.slice(0, 8).map((s) => ({
    value: s.amount,
    color: s.color,
    text: s.name,
  }));

  return (
    <View style={styles.wrap}>
      <PieChart
        data={data}
        donut
        radius={92}
        innerRadius={58}
        innerCircleColor="#ffffff"
        centerLabelComponent={() => (
          <View style={styles.center}>
            <Text style={styles.centerValue}>{centerValue}</Text>
            <Text style={styles.centerLabel}>{centerLabel}</Text>
          </View>
        )}
      />
      <View style={styles.legend}>
        {slices.slice(0, 5).map((s) => (
          <View key={s.categoryId} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={styles.legendAmt}>{formatEurEs(s.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 16 },
  center: { alignItems: "center", maxWidth: 100 },
  centerValue: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  centerLabel: { fontSize: 10, color: "#64748b", marginTop: 2, textAlign: "center" },
  legend: { width: "100%", gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 12, color: "#334155" },
  legendAmt: { fontSize: 12, fontWeight: "600", color: "#0f172a" },
  empty: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  emptyText: { color: "#64748b", fontSize: 13 },
});

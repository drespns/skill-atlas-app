import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExpenseCategory } from "@skill-atlas/expense-core";

type Props = {
  categories: ExpenseCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function CategoryPicker({ categories, selectedId, onSelect }: Props) {
  const roots = categories.filter((c) => !c.parentId);
  const rows: ExpenseCategory[][] = [];
  for (let i = 0; i < roots.length; i += 3) {
    rows.push(roots.slice(i, i + 3));
  }

  return (
    <View style={styles.list}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((item) => {
            const active = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.chip,
                  { borderColor: item.color, backgroundColor: active ? `${item.color}22` : "#f8fafc" },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.pad} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingVertical: 4 },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    minHeight: 64,
    borderWidth: 2,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pad: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  label: { fontSize: 11, textAlign: "center", color: "#334155", fontWeight: "500" },
  labelActive: { fontWeight: "700", color: "#0f172a" },
});

import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { ExpenseCategory } from "@skill-atlas/expense-core";

type Props = {
  categories: ExpenseCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function CategoryPicker({ categories, selectedId, onSelect }: Props) {
  const roots = categories.filter((c) => !c.parentId);
  return (
    <FlatList
      data={roots}
      keyExtractor={(c) => c.id}
      numColumns={3}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const active = item.id === selectedId;
        return (
          <Pressable
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
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingVertical: 4 },
  row: { gap: 8, marginBottom: 8 },
  chip: {
    flex: 1,
    minHeight: 72,
    borderWidth: 2,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  label: { fontSize: 11, textAlign: "center", color: "#334155", fontWeight: "500" },
  labelActive: { fontWeight: "700", color: "#0f172a" },
});

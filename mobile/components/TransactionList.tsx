import { SectionList, StyleSheet, Text, View } from "react-native";
import type { MobileTransaction } from "@skill-atlas/expense-core";
import { formatEurEs } from "@skill-atlas/expense-core";

type Props = {
  sections: { title: string; data: MobileTransaction[] }[];
  categoryName: (id: string) => string;
};

export function TransactionList({ sections, categoryName }: Props) {
  if (!sections.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aún no hay movimientos este mes</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.meta}>{categoryName(item.categoryId)}</Text>
          </View>
          <Text style={[styles.amount, item.kind === "income" ? styles.income : styles.expense]}>
            {item.kind === "income" ? "+" : "−"}
            {formatEurEs(item.amount)}
          </Text>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowMain: { flex: 1, marginRight: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "700" },
  expense: { color: "#e11d48" },
  income: { color: "#059669" },
  sep: { height: 8 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: "#64748b" },
});

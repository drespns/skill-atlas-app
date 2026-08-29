import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { MobileTransaction } from "@skill-atlas/expense-core";
import { formatEurEs } from "@skill-atlas/expense-core";

type Props = {
  sections: { title: string; data: MobileTransaction[] }[];
  categoryName: (id: string) => string;
};

/** Lista plana (sin SectionList) para poder embeberla en ScrollView del home. */
export function TransactionList({ sections, categoryName }: Props) {
  const router = useRouter();

  if (!sections.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Sin movimientos este mes</Text>
        <Text style={styles.emptyText}>Añade un gasto o ingreso con el botón +</Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.push("/add-transaction")}>
          <Text style={styles.emptyBtnText}>Añadir movimiento</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.data.map((item, idx) => (
            <View key={item.id}>
              {idx > 0 ? <View style={styles.sep} /> : null}
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
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 8 },
  section: { marginBottom: 4 },
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
    backgroundColor: "#f8fafc",
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
  empty: { paddingVertical: 28, paddingHorizontal: 12, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  emptyText: { marginTop: 6, color: "#64748b", fontSize: 13, textAlign: "center" },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

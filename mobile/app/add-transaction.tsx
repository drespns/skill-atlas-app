import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useExpense } from "@/lib/expense-context";

type Kind = "expense" | "income";

export default function AddTransactionScreen() {
  const router = useRouter();
  const { state, addExpense, addIncome } = useExpense();
  const [kind, setKind] = useState<Kind>("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function onSave() {
    const n = Number(amount.replace(",", "."));
    if (!(n > 0) || !categoryId) return;
    setLoading(true);
    const payload = {
      label: label.trim() || (kind === "expense" ? "Gasto" : "Ingreso"),
      amount: n,
      categoryId,
      notes: notes.trim() || undefined,
    };
    if (kind === "expense") await addExpense(payload);
    else await addIncome(payload);
    setLoading(false);
    router.back();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.kindRow}>
        <Pressable
          style={[styles.kindBtn, kind === "expense" && styles.kindExpense]}
          onPress={() => setKind("expense")}
        >
          <Text style={[styles.kindText, kind === "expense" && styles.kindTextActive]}>Gasto</Text>
        </Pressable>
        <Pressable
          style={[styles.kindBtn, kind === "income" && styles.kindIncome]}
          onPress={() => setKind("income")}
        >
          <Text style={[styles.kindText, kind === "income" && styles.kindTextActive]}>Ingreso</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Importe (€)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
        placeholder="0,00"
      />

      <Text style={styles.label}>Concepto</Text>
      <TextInput value={label} onChangeText={setLabel} style={styles.input} placeholder="Café, nómina…" />

      <Text style={styles.label}>Categoría</Text>
      <CategoryPicker categories={state.categories} selectedId={categoryId} onSelect={setCategoryId} />

      <Text style={styles.label}>Nota (opc.)</Text>
      <TextInput value={notes} onChangeText={setNotes} style={styles.input} placeholder="Opcional" />

      <Pressable style={styles.saveBtn} onPress={() => void onSave()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Guardar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  kindRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kindBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  kindExpense: { backgroundColor: "#ffe4e6" },
  kindIncome: { backgroundColor: "#d1fae5" },
  kindText: { fontWeight: "600", color: "#64748b" },
  kindTextActive: { color: "#0f172a" },
  label: { marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: "600", color: "#475569" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f8fafc",
  },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

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
import type { BillingCycle } from "@skill-atlas/expense-core";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useExpense } from "@/lib/expense-context";

const CYCLES: { id: BillingCycle; label: string }[] = [
  { id: "monthly", label: "Mensual" },
  { id: "yearly", label: "Anual" },
  { id: "weekly", label: "Semanal" },
  { id: "quarterly", label: "Trimestral" },
];

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { state, addSubscription } = useExpense();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function onSave() {
    const n = Number(amount.replace(",", "."));
    if (!(n >= 0) || !categoryId || !name.trim()) return;
    setLoading(true);
    await addSubscription({
      name: name.trim(),
      amount: n,
      cycle,
      categoryId,
    });
    setLoading(false);
    router.back();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholder="Netflix, Spotify…"
        placeholderTextColor="#94a3b8"
        autoFocus
      />

      <Text style={styles.label}>Importe (€)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={styles.input}
        placeholder="9,99"
        placeholderTextColor="#94a3b8"
      />

      <Text style={styles.label}>Ciclo</Text>
      <View style={styles.cycleRow}>
        {CYCLES.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.cycleChip, cycle === c.id && styles.cycleActive]}
            onPress={() => setCycle(c.id)}
          >
            <Text style={[styles.cycleText, cycle === c.id && styles.cycleTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Categoría</Text>
      <CategoryPicker categories={state.categories} selectedId={categoryId} onSelect={setCategoryId} />

      <Pressable
        style={[styles.saveBtn, loading && styles.saveDisabled]}
        onPress={() => void onSave()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Guardar suscripción</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#0f172a",
  },
  cycleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cycleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  cycleActive: { backgroundColor: "#4f46e5" },
  cycleText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  cycleTextActive: { color: "#fff" },
  saveBtn: {
    marginTop: 24,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

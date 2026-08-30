import { useMemo, useState } from "react";
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
import { defaultWealthAccountId } from "@skill-atlas/expense-core";
import { AccountPicker } from "@/components/AccountPicker";
import { CategoryPicker } from "@/components/CategoryPicker";
import { useExpense } from "@/lib/expense-context";

type Kind = "expense" | "income";

export default function AddTransactionScreen() {
  const router = useRouter();
  const { state, addExpense, addIncome } = useExpense();
  const accounts = state.wealthAccounts ?? [];

  const [kind, setKind] = useState<Kind>("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? "");
  const [wealthAccountId, setWealthAccountId] = useState<string | undefined>(() =>
    defaultWealthAccountId(accounts, "expense"),
  );
  const [loading, setLoading] = useState(false);

  const defaultForKind = useMemo(
    () => defaultWealthAccountId(accounts, kind === "expense" ? "expense" : "income"),
    [accounts, kind],
  );

  function onKindChange(next: Kind) {
    setKind(next);
    setWealthAccountId(defaultWealthAccountId(accounts, next === "expense" ? "expense" : "income"));
  }

  async function onSave() {
    const n = Number(amount.replace(",", "."));
    if (!(n > 0) || !categoryId) return;
    setLoading(true);
    const payload = {
      label: label.trim() || (kind === "expense" ? "Gasto" : "Ingreso"),
      amount: n,
      categoryId,
      notes: notes.trim() || undefined,
      wealthAccountId: wealthAccountId ?? defaultForKind,
    };
    if (kind === "expense") await addExpense(payload);
    else await addIncome(payload);
    setLoading(false);
    router.back();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.kindRow}>
        <Pressable
          style={[styles.kindBtn, kind === "expense" && styles.kindExpense]}
          onPress={() => onKindChange("expense")}
        >
          <Text style={[styles.kindText, kind === "expense" && styles.kindTextActive]}>Gasto</Text>
        </Pressable>
        <Pressable
          style={[styles.kindBtn, kind === "income" && styles.kindIncome]}
          onPress={() => onKindChange("income")}
        >
          <Text style={[styles.kindText, kind === "income" && styles.kindTextActive]}>Ingreso</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Importe (€)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        style={styles.amountInput}
        placeholder="0,00"
        placeholderTextColor="#94a3b8"
        autoFocus
      />

      <Text style={styles.label}>Concepto</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        style={styles.input}
        placeholder="Café, juego, nómina…"
        placeholderTextColor="#94a3b8"
      />

      <Text style={styles.label}>Cuenta</Text>
      <AccountPicker
        accounts={accounts}
        selectedId={wealthAccountId ?? defaultForKind}
        onSelect={setWealthAccountId}
      />

      <Text style={styles.label}>Categoría</Text>
      <CategoryPicker categories={state.categories} selectedId={categoryId} onSelect={setCategoryId} />

      <Text style={styles.label}>Nota (opc.)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        style={styles.input}
        placeholder="Opcional"
        placeholderTextColor="#94a3b8"
      />

      <Pressable
        style={[styles.saveBtn, loading && styles.saveDisabled]}
        onPress={() => void onSave()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{kind === "expense" ? "Guardar gasto" : "Guardar ingreso"}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40 },
  kindRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kindBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#e2e8f0",
  },
  kindExpense: { backgroundColor: "#ffe4e6" },
  kindIncome: { backgroundColor: "#d1fae5" },
  kindText: { fontWeight: "700", color: "#64748b" },
  kindTextActive: { color: "#0f172a" },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  amountInput: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0f172a",
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#c7d2fe",
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

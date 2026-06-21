import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useExpense } from "@/lib/expense-context";

export default function UnlockE2eScreen() {
  const router = useRouter();
  const { unlockE2e } = useExpense();
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUnlock() {
    if (!passphrase.trim()) return;
    setLoading(true);
    setError(null);
    const res = await unlockE2e(passphrase.trim());
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Frase incorrecta");
      return;
    }
    router.back();
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Frase del cuaderno</Text>
      <Text style={styles.sub}>
        Tu copia en la nube está cifrada. Introduce la misma frase que usas en SkillAtlas web. No se
        guarda en el servidor.
      </Text>
      <TextInput
        secureTextEntry
        value={passphrase}
        onChangeText={setPassphrase}
        style={styles.input}
        placeholder="Frase secreta"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={() => void onUnlock()} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Desbloquear</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "800", color: "#312e81" },
  sub: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#64748b" },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#f8fafc",
  },
  error: { marginTop: 8, color: "#dc2626" },
  btn: {
    marginTop: 20,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});

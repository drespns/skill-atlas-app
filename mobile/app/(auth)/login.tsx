import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) setError(res.error);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>SkillAtlas Gastos</Text>
        <Text style={styles.sub}>
          Inicia sesión con tu cuenta SkillAtlas para sincronizar tu cuaderno de gastos con la web.
        </Text>

        {!configured ? (
          <Text style={styles.warn}>
            Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en mobile/.env
          </Text>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="tu@email.com"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="••••••••"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.btn} onPress={onSubmit} disabled={loading || !configured}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#4f46e5",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  brand: { fontSize: 26, fontWeight: "800", color: "#312e81" },
  sub: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#64748b" },
  warn: { marginTop: 12, color: "#b45309", fontSize: 12, lineHeight: 18 },
  label: { marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: "600", color: "#475569" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#f8fafc",
  },
  error: { marginTop: 10, color: "#dc2626", fontSize: 13 },
  btn: {
    marginTop: 20,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

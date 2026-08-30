import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import type { OAuthProvider } from "@/lib/oauth";
import { getOAuthRedirectHint } from "@/lib/oauth";

export default function LoginScreen() {
  const { signIn, signInWithOAuth, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);

  const busy = loading || oauthBusy !== null;

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) setError(res.error);
  }

  async function onOAuth(provider: OAuthProvider) {
    setError(null);
    setOauthBusy(provider);
    const res = await signInWithOAuth(provider);
    setOauthBusy(null);
    if (res.error) setError(res.error);
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0f172a", "#1e1b4b", "#312e81"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.brand}>Finanzas</Text>
            <Text style={styles.headline}>Tu cuaderno,{"\n"}donde estés</Text>
            <Text style={styles.sub}>
              Misma cuenta que en la web. Entra con GitHub o LinkedIn para sincronizar tu
              cuaderno.
            </Text>
          </View>

          <View style={styles.panel}>
            {!configured ? (
              <View style={styles.warnBox}>
                <Text style={styles.warn}>
                  Falta configurar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en
                  mobile/.env
                </Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.oauthGithub,
                (busy || !configured) && styles.btnDisabled,
                pressed && !busy && configured && styles.oauthPressed,
              ]}
              onPress={() => void onOAuth("github")}
              disabled={busy || !configured}
            >
              {oauthBusy === "github" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome name="github" size={20} color="#fff" />
                  <Text style={styles.oauthTextLight}>Continuar con GitHub</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.oauthLinkedin,
                (busy || !configured) && styles.btnDisabled,
                pressed && !busy && configured && styles.oauthLinkedinPressed,
              ]}
              onPress={() => void onOAuth("linkedin_oidc")}
              disabled={busy || !configured}
            >
              {oauthBusy === "linkedin_oidc" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome name="linkedin-square" size={20} color="#fff" />
                  <Text style={styles.oauthTextLight}>Continuar con LinkedIn</Text>
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o con correo</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Correo</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="tu@email.com"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.labelRow}>
              <Text style={styles.labelInRow}>Contraseña</Text>
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.toggle}>{showPassword ? "Ocultar" : "Mostrar"}</Text>
              </Pressable>
            </View>
            <TextInput
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={[styles.input, passwordFocused && styles.inputFocused]}
              placeholder="Tu contraseña"
              placeholderTextColor="#94a3b8"
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                (busy || !configured) && styles.btnDisabled,
                pressed && !busy && configured && styles.btnPressed,
              ]}
              onPress={onSubmit}
              disabled={busy || !configured}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Entrar</Text>
              )}
            </Pressable>

            <Text style={styles.footnote}>
              Acceso por invitación o cuenta ya activada. Usa el mismo proveedor que en la web.
            </Text>
            {__DEV__ ? (
              <Text style={styles.devHint} selectable>
                Dev OAuth redirect: {getOAuthRedirectHint()}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  blobTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(99, 102, 241, 0.35)",
  },
  blobBottom: {
    position: "absolute",
    bottom: -40,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
  },
  hero: { marginBottom: 28 },
  brand: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "#a5b4fc",
    marginBottom: 14,
  },
  headline: {
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    color: "#f8fafc",
    letterSpacing: -0.6,
  },
  sub: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#94a3b8",
    maxWidth: 340,
  },
  panel: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  warnBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  warn: { color: "#9a3412", fontSize: 12, lineHeight: 18 },
  oauthBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  oauthGithub: { backgroundColor: "#111827", marginTop: 0 },
  oauthLinkedin: { backgroundColor: "#0a66c2" },
  oauthPressed: { backgroundColor: "#030712" },
  oauthLinkedinPressed: { backgroundColor: "#004182" },
  oauthTextLight: { color: "#fff", fontWeight: "700", fontSize: 15 },
  dividerRow: {
    marginTop: 20,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#cbd5e1" },
  dividerText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  labelRow: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelInRow: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  toggle: { fontSize: 13, fontWeight: "600", color: "#4f46e5" },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "web" ? 14 : 13,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  inputFocused: {
    borderColor: "#6366f1",
    backgroundColor: "#fff",
  },
  error: {
    marginTop: 12,
    color: "#dc2626",
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    marginTop: 22,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnPressed: { backgroundColor: "#4338ca" },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  footnote: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
    textAlign: "center",
  },
  devHint: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
});

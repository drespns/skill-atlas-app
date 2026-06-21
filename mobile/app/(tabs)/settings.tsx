import * as WebBrowser from "expo-web-browser";
import { Switch, StyleSheet, Text, View, Pressable } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useExpense } from "@/lib/expense-context";

const WEB_URL = process.env.EXPO_PUBLIC_SKILLATLAS_WEB_URL ?? "https://skillatlas.app";

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { state, setSyncToAccount, syncStatus } = useExpense();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.section}>Cuenta</Text>
        <Text style={styles.email}>{session?.user?.email ?? "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Sincronización</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Copia en SkillAtlas</Text>
            <Text style={styles.rowSub}>Estado: {syncStatus}</Text>
          </View>
          <Switch
            value={state.syncToAccount}
            onValueChange={(v) => void setSyncToAccount(v)}
            trackColor={{ true: "#818cf8" }}
          />
        </View>
        <Text style={styles.hint}>
          Mismo cuaderno que en /tools/expense-tracker. Los cambios se fusionan por id al sincronizar.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Web</Text>
        <Pressable
          style={styles.linkBtn}
          onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/tools/expense-tracker`)}
        >
          <Text style={styles.linkText}>Abrir cuaderno en SkillAtlas web</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9", padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  section: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  email: { marginTop: 8, fontSize: 16, fontWeight: "600", color: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  rowSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 18, color: "#64748b" },
  linkBtn: {
    marginTop: 10,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 14,
  },
  linkText: { color: "#4338ca", fontWeight: "600", textAlign: "center" },
  signOut: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  signOutText: { color: "#dc2626", fontWeight: "700", textAlign: "center" },
});

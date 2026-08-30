import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  defaultWealthAccountId,
  formatEurEs,
  formatIbanDisplay,
} from "@skill-atlas/expense-core";
import { SYNC_STATUS_LABELS } from "@/components/SyncBadge";
import { useAuth } from "@/lib/auth-context";
import { useExpense } from "@/lib/expense-context";

const WEB_URL =
  process.env.EXPO_PUBLIC_FINANZAS_WEB_URL ??
  process.env.EXPO_PUBLIC_SKILLATLAS_WEB_URL ??
  "https://skillatlas.app";

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { state, setSyncToAccount, setDefaultWealthAccount, syncStatus, needsUnlock } =
    useExpense();
  const appVersion = Constants.expoConfig?.version ?? "—";
  const accounts = state.wealthAccounts ?? [];
  const defaultExpense = defaultWealthAccountId(accounts, "expense");
  const defaultIncome = defaultWealthAccountId(accounts, "income");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.section}>Cuenta</Text>
        <Text style={styles.email}>{session?.user?.email ?? "—"}</Text>
        <Text style={styles.version}>Finanzas móvil · v{appVersion}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Cuaderno en la nube</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Copia en tu cuenta</Text>
            <Text style={styles.rowSub}>{SYNC_STATUS_LABELS[syncStatus]}</Text>
          </View>
          <Switch
            value={state.syncToAccount}
            onValueChange={(v) => void setSyncToAccount(v)}
            trackColor={{ true: "#818cf8" }}
          />
        </View>
        {needsUnlock ? (
          <Pressable style={styles.unlockBtn} onPress={() => router.push("/unlock-e2e")}>
            <Text style={styles.unlockBtnText}>Desbloquear cifrado E2E</Text>
          </Pressable>
        ) : null}
        <Text style={styles.hint}>
          Con la copia activa, este móvil y la web comparten el mismo cuaderno.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Cuenta por defecto · gastos</Text>
        <Text style={styles.hintTop}>
          Al añadir un gasto (p. ej. un juego de 45 €) se preselecciona esta cuenta.
        </Text>
        {accounts.length === 0 ? (
          <Text style={styles.hint}>Sin cuentas. Créalas en el patrimonio de la web.</Text>
        ) : (
          accounts.map((a) => {
            const active = a.id === defaultExpense;
            return (
              <Pressable
                key={`exp-${a.id}`}
                style={[styles.accountRow, active && styles.accountRowActive]}
                onPress={() => void setDefaultWealthAccount(a.id, "expense")}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{a.name}</Text>
                  <Text style={styles.rowSub}>
                    {formatEurEs(a.balance)}
                    {a.ibanPrefix ? ` · ${formatIbanDisplay(a.ibanPrefix)}` : ""}
                  </Text>
                </View>
                <Text style={styles.check}>{active ? "✓" : ""}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Cuenta por defecto · ingresos</Text>
        {accounts.map((a) => {
          const active = a.id === defaultIncome;
          return (
            <Pressable
              key={`inc-${a.id}`}
              style={[styles.accountRow, active && styles.accountRowActive]}
              onPress={() => void setDefaultWealthAccount(a.id, "income")}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{a.name}</Text>
                <Text style={styles.rowSub}>{formatEurEs(a.balance)}</Text>
              </View>
              <Text style={styles.check}>{active ? "✓" : ""}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Web</Text>
        <Text style={styles.hintTop}>
          La web sigue siendo el sitio para análisis avanzado, transferencias y escenarios.
        </Text>
        <Pressable
          style={styles.linkBtn}
          onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/tools/expense-tracker`)}
        >
          <Text style={styles.linkText}>Abrir cuaderno en la web</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  email: { marginTop: 8, fontSize: 16, fontWeight: "600", color: "#0f172a" },
  version: { marginTop: 6, fontSize: 12, color: "#94a3b8" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  rowSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  hint: { marginTop: 10, fontSize: 12, lineHeight: 18, color: "#64748b" },
  hintTop: { marginTop: 8, marginBottom: 8, fontSize: 12, lineHeight: 18, color: "#64748b" },
  unlockBtn: {
    marginTop: 12,
    backgroundColor: "#ede9fe",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  unlockBtnText: { color: "#5b21b6", fontWeight: "700", fontSize: 13 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  accountRowActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  check: { fontSize: 16, fontWeight: "800", color: "#4f46e5", width: 20, textAlign: "center" },
  linkBtn: {
    marginTop: 4,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  linkText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  signOut: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  signOutText: { color: "#dc2626", fontWeight: "700" },
});

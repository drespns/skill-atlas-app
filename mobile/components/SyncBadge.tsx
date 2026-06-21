import { StyleSheet, Text, View } from "react-native";
import type { SyncStatus } from "@/lib/expense-sync";

const LABELS: Record<SyncStatus, string> = {
  idle: "Solo local",
  syncing: "Sincronizando…",
  synced: "Sincronizado",
  offline: "Sin conexión",
  locked: "Cifrado — desbloquear",
  error: "Error de sync",
};

const COLORS: Record<SyncStatus, string> = {
  idle: "#64748b",
  syncing: "#6366f1",
  synced: "#059669",
  offline: "#d97706",
  locked: "#7c3aed",
  error: "#dc2626",
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${COLORS[status]}22` }]}>
      <View style={[styles.dot, { backgroundColor: COLORS[status] }]} />
      <Text style={[styles.text, { color: COLORS[status] }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 11, fontWeight: "600" },
});

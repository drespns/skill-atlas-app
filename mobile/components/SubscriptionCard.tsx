import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatEurEs,
  resolveSubscriptionBrandKey,
  subscriptionBillingSnapshot,
  subscriptionBrandAccent,
  subscriptionCountsInTotals,
  type SubscriptionRow,
} from "@skill-atlas/expense-core";

type Props = {
  subscription: SubscriptionRow;
  onCancel?: () => void;
};

const CYCLE_LABEL: Record<SubscriptionRow["cycle"], string> = {
  weekly: "/sem",
  monthly: "/mes",
  quarterly: "/trim",
  yearly: "/año",
};

export function SubscriptionCard({ subscription: s, onCancel }: Props) {
  const brandKey = resolveSubscriptionBrandKey(s.name, s.brandKey);
  const accent = subscriptionBrandAccent(brandKey, s.cardColor ?? "#6366f1");
  const snap = subscriptionBillingSnapshot(s);
  const counts = subscriptionCountsInTotals(s);
  const cancelled = Boolean(s.cancelEffectiveDate);
  const initial = (s.name.trim()[0] ?? "?").toUpperCase();

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={[styles.avatar, { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.avatarText, { color: accent }]}>{initial}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {s.name}
          </Text>
          {snap.phase === "trial" ? (
            <View style={styles.chipTrial}>
              <Text style={styles.chipTrialText}>Prueba</Text>
            </View>
          ) : null}
          {cancelled ? (
            <View style={styles.chipCancel}>
              <Text style={styles.chipCancelText}>Cancela</Text>
            </View>
          ) : null}
          {!counts && !cancelled ? (
            <View style={styles.chipOff}>
              <Text style={styles.chipOffText}>Inactiva</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          Próx. {formatShortDate(snap.nextChargeIso)} · {formatEurEs(snap.cycleAmount)}
          {CYCLE_LABEL[s.cycle]}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatEurEs(snap.cycleAmount)}</Text>
        {onCancel && s.active && !cancelled ? (
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelLink}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "800" },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 2, fontSize: 11, color: "#64748b" },
  right: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  cancelLink: { fontSize: 11, fontWeight: "600", color: "#dc2626" },
  chipTrial: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
  },
  chipTrialText: { fontSize: 9, fontWeight: "700", color: "#059669" },
  chipCancel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#fff7ed",
  },
  chipCancelText: { fontSize: 9, fontWeight: "700", color: "#c2410c" },
  chipOff: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  chipOffText: { fontSize: 9, fontWeight: "700", color: "#64748b" },
});

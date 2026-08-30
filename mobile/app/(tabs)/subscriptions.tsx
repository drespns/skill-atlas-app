import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  formatEurEs,
  subscriptionCountsInTotals,
  subscriptionToMonthlyAmount,
} from "@skill-atlas/expense-core";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useExpense } from "@/lib/expense-context";

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { state, loading, cancelSubscription } = useExpense();

  const subs = useMemo(() => {
    const list = [...(state.subscriptions ?? [])];
    list.sort((a, b) => {
      const aOn = subscriptionCountsInTotals(a) ? 0 : 1;
      const bOn = subscriptionCountsInTotals(b) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return a.name.localeCompare(b.name, "es");
    });
    return list;
  }, [state.subscriptions]);

  const monthlyBurn = useMemo(
    () =>
      (state.subscriptions ?? []).reduce((s, row) => s + subscriptionToMonthlyAmount(row), 0),
    [state.subscriptions],
  );

  const activeCount = useMemo(
    () => (state.subscriptions ?? []).filter((s) => subscriptionCountsInTotals(s)).length,
    [state.subscriptions],
  );

  function confirmCancel(id: string, name: string) {
    Alert.alert(
      "Cancelar suscripción",
      `¿Programar la cancelación de «${name}»? Dejará de contar desde el próximo cobro.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () => void cancelSubscription(id),
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Activas</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Gasto / mes</Text>
          <Text style={styles.summaryValue}>{formatEurEs(monthlyBurn)}</Text>
        </View>
      </View>

      {subs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sin suscripciones</Text>
          <Text style={styles.emptyText}>Añade Netflix, Spotify u otra cuota recurrente.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/add-subscription")}>
            <Text style={styles.emptyBtnText}>Nueva suscripción</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {subs.map((s) => (
            <SubscriptionCard
              key={s.id}
              subscription={s}
              onCancel={() => confirmCancel(s.id, s.name)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryLabel: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  summaryValue: { marginTop: 4, fontSize: 18, fontWeight: "800", color: "#0f172a" },
  list: { gap: 8 },
  empty: {
    marginTop: 24,
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  emptyText: { marginTop: 6, fontSize: 13, color: "#64748b", textAlign: "center" },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
});

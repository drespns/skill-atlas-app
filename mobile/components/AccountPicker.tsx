import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { WealthAccount } from "@skill-atlas/expense-core";
import { formatEurEs, formatIbanDisplay } from "@skill-atlas/expense-core";

type Props = {
  accounts: WealthAccount[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function AccountPicker({ accounts, selectedId, onSelect }: Props) {
  if (!accounts.length) {
    return (
      <Text style={styles.empty}>
        Sin cuentas de patrimonio. Créalas en la web o sincroniza el cuaderno.
      </Text>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {accounts.map((a) => {
        const active = a.id === selectedId;
        return (
          <Pressable
            key={a.id}
            onPress={() => onSelect(a.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
              {a.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatEurEs(a.balance)}
            </Text>
            {a.ibanPrefix ? (
              <Text style={styles.iban} numberOfLines={1}>
                {formatIbanDisplay(a.ibanPrefix)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  empty: { fontSize: 12, color: "#94a3b8", lineHeight: 18 },
  chip: {
    minWidth: 120,
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  name: { fontSize: 13, fontWeight: "600", color: "#334155" },
  nameActive: { color: "#312e81" },
  meta: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#0f172a" },
  iban: { marginTop: 2, fontSize: 10, color: "#94a3b8" },
});

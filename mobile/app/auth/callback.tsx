import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { createSessionFromUrl } from "@/lib/oauth";

/**
 * Llegada vía deep link exp://…/auth/callback?code=… (o scheme nativo).
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const inbound = Linking.useURL();
  const [msg, setMsg] = useState("Completando acceso…");

  useEffect(() => {
    let cancelled = false;

    async function run(url: string | null) {
      if (!url) return;
      try {
        const session = await createSessionFromUrl(url);
        if (cancelled) return;
        if (session) {
          router.replace("/(tabs)");
          return;
        }
        setMsg("No se pudo crear la sesión. Vuelve a intentar el login.");
        setTimeout(() => router.replace("/(auth)/login"), 2500);
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "Error OAuth");
          setTimeout(() => router.replace("/(auth)/login"), 2500);
        }
      }
    }

    const href =
      inbound ??
      (typeof window !== "undefined" ? window.location.href : null);

    if (href) {
      void run(href);
    } else {
      void Linking.getInitialURL().then((u) => {
        if (u) void run(u);
        else if (!cancelled) {
          setMsg("Esperando datos OAuth…");
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [inbound, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color="#4f46e5" />
      <Text style={styles.text}>{msg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0f172a",
    gap: 16,
  },
  text: { color: "#e2e8f0", textAlign: "center", fontSize: 14, lineHeight: 20 },
});

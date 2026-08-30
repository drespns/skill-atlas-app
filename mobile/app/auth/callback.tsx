import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { createSessionFromUrl, getOAuthRedirectHint } from "@/lib/oauth";

/**
 * Destino OAuth tras GitHub/LinkedIn.
 * Debe coincidir con getOAuthRedirectTo() y estar en Supabase Redirect URLs.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [msg, setMsg] = useState("Completando acceso…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = typeof window !== "undefined" ? window.location.href : await Linking.getInitialURL();
        if (!url) {
          if (!cancelled) {
            setMsg("No hay datos OAuth. Vuelve al login.");
            setTimeout(() => router.replace("/(auth)/login"), 1500);
          }
          return;
        }
        const session = await createSessionFromUrl(url);
        if (cancelled) return;
        if (session) {
          router.replace("/(tabs)");
          return;
        }
        setMsg(
          `Sin sesión. Añade en Supabase Redirect URLs:\n${getOAuthRedirectHint()}`,
        );
        setTimeout(() => router.replace("/(auth)/login"), 4000);
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "Error OAuth");
          setTimeout(() => router.replace("/(auth)/login"), 2500);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

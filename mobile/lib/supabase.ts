import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Web: tokens/code llegan en la URL tras OAuth. Native: los aplicamos a mano.
        detectSessionInUrl: Platform.OS === "web",
        flowType: "pkce",
      },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

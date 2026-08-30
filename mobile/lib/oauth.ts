import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Provider, Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "github" | "linkedin_oidc";

const WEB_ORIGIN = (
  process.env.EXPO_PUBLIC_FINANZAS_WEB_URL ??
  process.env.EXPO_PUBLIC_SKILLATLAS_WEB_URL ??
  "https://skillatlas.app"
).replace(/\/$/, "");

/**
 * Callback HTTPS estable en el dominio de producción.
 * Las IPs LAN (192.168.*) / exp:// las rechaza o ignora Supabase → cae al Site URL (login web).
 * openAuthSessionAsync captura esta URL con los tokens y la sesión queda EN LA APP.
 */
function getNativeOAuthRedirectTo(): string {
  return `${WEB_ORIGIN}/auth/expo-callback`;
}

export function getOAuthRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Expo web en el PC
    return `${window.location.origin}/auth/callback`;
  }
  return getNativeOAuthRedirectTo();
}

export function getOAuthRedirectHint(): string {
  return getOAuthRedirectTo();
}

function hasAuthPayload(url: string): boolean {
  return (
    url.includes("access_token=") ||
    url.includes("refresh_token=") ||
    /[?&#]code=/.test(url)
  );
}

export async function createSessionFromUrl(url: string): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  let params: Record<string, string> = {};
  let errorCode: string | null = null;
  try {
    const parsed = QueryParams.getQueryParams(url);
    params = parsed.params ?? {};
    errorCode = parsed.errorCode ?? null;
  } catch {
    // ignore
  }
  if ((!params.access_token && !params.code) && url.includes("#")) {
    const hash = url.split("#")[1] ?? "";
    for (const part of hash.split("&")) {
      const [k, v] = part.split("=");
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  if (!params.code && !params.access_token && url.includes("?")) {
    try {
      const q = new URL(url).searchParams;
      q.forEach((v, k) => {
        params[k] = v;
      });
    } catch {
      // ignore
    }
  }
  if (errorCode) throw new Error(errorCode);

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  const code = params.code;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (!access_token) return null;
  if (!refresh_token) throw new Error("Falta refresh_token en el callback OAuth");

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

function redirectHelp(redirectTo: string): string {
  return (
    `No se pudo cerrar el login en la app.\n\n` +
    `En Supabase → Authentication → URL Configuration → Redirect URLs añade:\n` +
    `${redirectTo}\n` +
    `${WEB_ORIGIN}/**\n` +
    `http://localhost:8081/**`
  );
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase no configurado" };

  const redirectTo = getOAuthRedirectTo();

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[oauth]", provider, "redirectTo=", redirectTo, "ownership=", Constants.appOwnership);
  }

  // Expo web (navegador del PC): redirect completo a localhost.
  if (Platform.OS === "web") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo,
        skipBrowserRedirect: false,
        ...(provider === "github" ? { queryParams: { prompt: "consent" } } : {}),
      },
    });
    if (error) return { error: error.message };
    if (data.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return {};
  }

  // Nativo / Expo Go: Custom Tab. redirectTo = HTTPS en skillatlas.app (permitido).
  // Al volver a esa URL con ?code= / #access_token=, openAuthSessionAsync nos la entrega.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      ...(provider === "github" ? { queryParams: { prompt: "consent" } } : {}),
    },
  });
  if (error) return { error: error.message };
  if (!data.url) return { error: "No se pudo abrir el proveedor OAuth" };

  if (__DEV__) {
    try {
      const u = new URL(data.url);
      // eslint-disable-next-line no-console
      console.log("[oauth] authorize redirect_to=", u.searchParams.get("redirect_to"));
    } catch {
      // ignore
    }
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success" && result.url) {
    if (!hasAuthPayload(result.url)) {
      return { error: redirectHelp(redirectTo) };
    }
    try {
      const session = await createSessionFromUrl(result.url);
      if (!session) return { error: redirectHelp(redirectTo) };
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo completar OAuth" };
    }
  }

  if (result.type === "cancel" || result.type === "dismiss") {
    return {};
  }

  return { error: redirectHelp(redirectTo) };
}

export function subscribeOAuthRedirect(onSession: (session: Session | null) => void): () => void {
  const handle = async (url: string | null) => {
    if (!url) return;
    const isCallback =
      url.includes("auth/callback") ||
      url.includes("expo-callback") ||
      url.includes("access_token=") ||
      /[?&#]code=/.test(url);
    if (!isCallback) return;
    try {
      const session = await createSessionFromUrl(url);
      if (session) onSession(session);
    } catch {
      // ignore
    }
  };

  if (Platform.OS === "web" && typeof window !== "undefined") {
    void handle(window.location.href);
    return () => {};
  }

  void Linking.getInitialURL().then((url) => void handle(url));
  const sub = Linking.addEventListener("url", ({ url }) => void handle(url));
  return () => sub.remove();
}

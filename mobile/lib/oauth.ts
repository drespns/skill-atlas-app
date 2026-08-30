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

/** Prefijo HTTPS del puente (para dismiss de Custom Tab + allow list). */
export function getOAuthBridgePrefix(): string {
  return `${WEB_ORIGIN}/auth/expo-callback`;
}

/** Deep link de vuelta a Expo (exp://… en Expo Go, scheme en build). */
export function getAppAuthReturnUrl(): string {
  return Linking.createURL("auth/callback");
}

/**
 * Redirect que se registra en Supabase.
 * Incluye ?return=exp://… para que la página puente abra Expo Go
 * (skillatlas-gastos:// no funciona dentro de Expo Go).
 */
export function getOAuthRedirectTo(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  const ret = encodeURIComponent(getAppAuthReturnUrl());
  return `${getOAuthBridgePrefix()}?return=${ret}`;
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
  if (!params.code && !params.access_token) {
    const codeMatch = url.match(/[?&]code=([^&#]+)/);
    if (codeMatch?.[1]) params.code = decodeURIComponent(codeMatch[1]);
    const atMatch = url.match(/[#&?]access_token=([^&]+)/);
    if (atMatch?.[1]) params.access_token = decodeURIComponent(atMatch[1]);
    const rtMatch = url.match(/[#&?]refresh_token=([^&]+)/);
    if (rtMatch?.[1]) params.refresh_token = decodeURIComponent(rtMatch[1]);
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

function redirectHelp(): string {
  return (
    `No se pudo volver a la app.\n\n` +
    `En Supabase → Redirect URLs:\n` +
    `${getOAuthBridgePrefix()}\n` +
    `${WEB_ORIGIN}/**\n\n` +
    `Si ves “Acceso listo”, toca Abrir app (debe ser exp://… en Expo Go).`
  );
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase no configurado" };

  const redirectTo = getOAuthRedirectTo();
  const dismissPrefix = Platform.OS === "web" ? redirectTo : getOAuthBridgePrefix();

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      "[oauth]",
      provider,
      "redirectTo=",
      redirectTo,
      "appReturn=",
      Platform.OS !== "web" ? getAppAuthReturnUrl() : "(web)",
      "ownership=",
      Constants.appOwnership,
    );
  }

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

  // Prefijo sin query: Custom Tab cierra al llegar a /auth/expo-callback?...
  const result = await WebBrowser.openAuthSessionAsync(data.url, dismissPrefix);

  if (result.type === "success" && result.url) {
    if (!hasAuthPayload(result.url)) {
      return { error: redirectHelp() };
    }
    try {
      const session = await createSessionFromUrl(result.url);
      if (!session) return { error: redirectHelp() };
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo completar OAuth" };
    }
  }

  // dismiss: a menudo la página puente ya hizo deep link a exp://; la sesión llega por Linking
  if (result.type === "cancel" || result.type === "dismiss") {
    return {};
  }

  return { error: redirectHelp() };
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

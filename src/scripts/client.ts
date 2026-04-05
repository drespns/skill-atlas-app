/**
 * Punto de entrada del cliente global (AppShell).
 * La lógica está modularizada en `client-shell/*`; este archivo solo orquesta el boot y tipos globales.
 */
import "@scripts/shell/command-palette";
import { syncGlobalBannerFromStorage, initGlobalBannerCloseDelegationOnce } from "@scripts/client-shell/global-banner";
import { initLayoutVars } from "@scripts/client-shell/layout-vars";
import { initPrefs } from "@scripts/client-shell/prefs-bootstrap";
import { initHeaderIconVisibility } from "@scripts/client-shell/header-icons";
import { syncHeaderNavActive, initHeaderNavIndicator } from "@scripts/client-shell/header-nav";
import { initCommandPaletteTrigger } from "@scripts/client-shell/command-palette-trigger";
import { initI18n } from "@scripts/client-shell/i18n-bootstrap";
import { initAuthHeader } from "@scripts/client-shell/auth-header-bootstrap";
import { initLandingCtas } from "@scripts/client-shell/landing-ctas";
import { initAuthGuard } from "@scripts/client-shell/auth-guard";

declare global {
  interface Window {
    skillatlas?: {
      bootstrapProjectsList?: () => Promise<void>;
      bootstrapProjectDetailPage?: () => Promise<void>;
      bootstrapTechnologyDetailPage?: () => Promise<void>;
      clearProjectsCache?: () => void;
      setUiLang?: (lng: "es" | "en") => Promise<void>;
      refreshI18nDom?: () => void;
      refreshAuthHeader?: () => Promise<void>;
    };
  }
}

document.addEventListener("astro:after-swap", () => syncGlobalBannerFromStorage(), { capture: true });

async function bootClient() {
  syncGlobalBannerFromStorage();
  initGlobalBannerCloseDelegationOnce();
  initLayoutVars();
  await initPrefs();
  initHeaderIconVisibility();
  syncHeaderNavActive();
  initHeaderNavIndicator();
  initCommandPaletteTrigger();
  await initI18n();
  await initAuthHeader();
  await initLandingCtas();
  await initAuthGuard();
}

const boot = () => void bootClient();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

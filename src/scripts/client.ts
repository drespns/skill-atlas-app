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
import { initLangPickerPopover } from "@scripts/client-shell/lang-picker-popover";
import { initAuthHeader } from "@scripts/client-shell/auth-header-bootstrap";
import { syncRecentActivityWithRemote } from "@scripts/app/recent-activity";
import { initLandingCtas } from "@scripts/client-shell/landing-ctas";
import { initAuthGuard } from "@scripts/client-shell/auth-guard";
import { initHeaderScrollAutoHideDelegation } from "@scripts/client-shell/header-scroll-hide";
import "@scripts/client-shell/select-popover";

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

function cleanupZombieOverlays() {
  // With Astro View Transitions, DOM from the previous page can linger briefly.
  // If a <dialog> remains open, its backdrop can block clicks/hover on the next page.
  try {
    document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((d) => {
      try {
        d.close();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  // Also clear our shared modal root (core/ui-feedback.ts); it is a <dialog>.
  try {
    const root = document.querySelector<HTMLDialogElement>("dialog[data-modal-root]");
    if (root) {
      try {
        if (root.open) root.close();
      } catch {
        /* ignore */
      }
      root.innerHTML = "";
    }
  } catch {
    // ignore
  }
}

document.addEventListener("astro:before-swap", cleanupZombieOverlays as any, { capture: true });

async function bootClient() {
  syncGlobalBannerFromStorage();
  initGlobalBannerCloseDelegationOnce();
  initLayoutVars();
  await initPrefs();
  initHeaderScrollAutoHideDelegation();
  initHeaderIconVisibility();
  syncHeaderNavActive();
  initHeaderNavIndicator();
  initCommandPaletteTrigger();
  await initI18n();
  initLangPickerPopover();
  await initAuthHeader();
  void syncRecentActivityWithRemote();
  await initLandingCtas();
  await initAuthGuard();
}

const boot = () => void bootClient();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot as any);
document.addEventListener("astro:after-swap", boot as any);

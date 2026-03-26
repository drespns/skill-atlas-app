import i18next from "i18next";

/**
 * Client bootstrap script.
 *
 * Responsibilities:
 * 1) Theme toggle (light/dark) + persistence
 * 2) ES/EN language switch + text replacement using data-i18n attributes
 */

function initTheme() {
  // Key used in localStorage to remember user preference.
  const themeKey = "theme";

  // Button is rendered in AppShell header.
  const themeBtn = document.querySelector<HTMLElement>("[data-theme-toggle]");

  /**
   * Applies visual theme to the root document.
   *
   * We use:
   * - `.dark` class for Tailwind dark variants
   * - `data-theme` for debugging/inspection
   * - `colorScheme` so native controls follow the selected theme
   */
  const applyTheme = (isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    themeBtn?.setAttribute("aria-pressed", String(isDark));
  };

  // Toggle theme on button click and persist selection.
  themeBtn?.addEventListener("click", () => {
    const isDark = !document.documentElement.classList.contains("dark");
    applyTheme(isDark);
    localStorage.setItem(themeKey, isDark ? "dark" : "light");
  });

  // Sync button state with initial theme set in <head>
  applyTheme(document.documentElement.classList.contains("dark"));
}

async function initI18n() {
  // Key used in localStorage for current language.
  const langKey = "lang";
  const langSelect = document.querySelector<HTMLSelectElement>("[data-lang-select]");

  /**
   * i18next setup.
   * For MVP we keep translations inline to avoid extra files.
   */
  await i18next.init({
    lng: localStorage.getItem(langKey) || "es",
    fallbackLng: "es",
    resources: {
      es: {
        translation: {
          common: {
            view: "Ver",
            backToProjects: "Volver a Proyectos",
            embeds: "Embeds",
            relatedConcepts: "Conceptos relacionados",
            viewProject: "Ver proyecto",
            viewDetail: "Ver detalle",
            newTechnology: "Nueva tecnología",
            openApp: "Abrir app",
            viewPortfolio: "Ver portfolio",
            publicPortfolio: "Ver portfolio público",
          },
          nav: {
            technologies: "Tecnologías",
            projects: "Proyectos",
            portfolio: "Portfolio",
            settings: "Ajustes",
          },
          landing: {
            title: "SkillAtlas",
            subtitle:
              "Gestiona tu conocimiento técnico: tecnologías, conceptos, progreso y proyectos que se convierten en tu portfolio.",
            step1Title: "1. Tecnologías",
            step1Body: "Crea categorías como SQL, PySpark o DAX.",
            step2Title: "2. Conceptos",
            step2Body: "Registra conceptos dentro de cada tecnología.",
            step3Title: "3. Proyectos",
            step3Body: "Relaciona conceptos y publica tu portfolio.",
          },
          dashboard: {
            title: "Dashboard",
            subtitle: "Tu flujo principal: tecnologías → conceptos → proyectos → portfolio.",
            goTechnologies: "Ir a Tecnologías",
            goTechnologiesBody: "Crea conceptos dentro de cada tecnología.",
            goProjects: "Ir a Proyectos",
            goProjectsBody: "Relaciona conceptos y publica tu portfolio.",
          },
          technologies: {
            title: "Tecnologías",
            concepts: "conceptos",
          },
          projects: {
            title: "Proyectos",
            subtitle: "Proyectos conectados con tecnologías y conceptos.",
            emptyTitle: "Aún no tienes proyectos.",
            emptyBody: "En el MVP puedes empezar desde aquí.",
          },
          settings: {
            title: "Ajustes",
            subtitle: "En el MVP, estos datos son de ejemplo (read-only).",
            publicName: "Nombre público",
            publicBio: "Bio pública",
          },
        },
      },
      en: {
        translation: {
          common: {
            view: "View",
            backToProjects: "Back to Projects",
            embeds: "Embeds",
            relatedConcepts: "Related concepts",
            viewProject: "View project",
            viewDetail: "View details",
            newTechnology: "New technology",
            openApp: "Open app",
            viewPortfolio: "View portfolio",
            publicPortfolio: "View public portfolio",
          },
          nav: {
            technologies: "Technologies",
            projects: "Projects",
            portfolio: "Portfolio",
            settings: "Settings",
          },
          landing: {
            title: "SkillAtlas",
            subtitle:
              "Manage your technical knowledge: technologies, concepts, progress and projects that become your portfolio.",
            step1Title: "1. Technologies",
            step1Body: "Create categories like SQL, PySpark or DAX.",
            step2Title: "2. Concepts",
            step2Body: "Register concepts inside each technology.",
            step3Title: "3. Projects",
            step3Body: "Link concepts and publish your portfolio.",
          },
          dashboard: {
            title: "Dashboard",
            subtitle: "Main flow: technologies → concepts → projects → portfolio.",
            goTechnologies: "Go to Technologies",
            goTechnologiesBody: "Create concepts inside each technology.",
            goProjects: "Go to Projects",
            goProjectsBody: "Link concepts and publish your portfolio.",
          },
          technologies: {
            title: "Technologies",
            concepts: "concepts",
          },
          projects: {
            title: "Projects",
            subtitle: "Projects connected to technologies and concepts.",
            emptyTitle: "You don't have any projects yet.",
            emptyBody: "In the MVP you can start from here.",
          },
          settings: {
            title: "Settings",
            subtitle: "In the MVP, this data is example (read-only).",
            publicName: "Public name",
            publicBio: "Public bio",
          },
        },
      },
    },
  });

  const setLangAttr = (lng: string) => {
    document.documentElement.lang = lng?.startsWith("en") ? "en" : "es";
  };

  /**
   * Re-renders all translatable nodes.
   *
   * Convention:
   * Any element with `data-i18n="some.key"` gets replaced with i18next text.
   */
  const render = () => {
    setLangAttr(i18next.language);
    if (langSelect) langSelect.value = i18next.language.startsWith("en") ? "en" : "es";
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = i18next.t(key);
    });
  };

  render();

  // Handle language changes from the ES/EN selector.
  langSelect?.addEventListener("change", async (e) => {
    const next = (e.target as HTMLSelectElement).value === "en" ? "en" : "es";
    await i18next.changeLanguage(next);
    localStorage.setItem(langKey, next);
    render();
  });
}

// Ensure header elements are available before initialization.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    void initI18n();
  });
} else {
  initTheme();
  void initI18n();
}


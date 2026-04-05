import { initPublicPortfolioPage } from "./public-portfolio-public-page";

async function run() {
  const root = document.querySelector<HTMLElement>("[data-public-portfolio-page]");
  const slug = root?.dataset.publicPortfolioSlug?.trim() ?? "";
  await initPublicPortfolioPage({ mode: "slug", slug });
}

function boot() {
  void run();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);

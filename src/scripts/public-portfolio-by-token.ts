import { initPublicPortfolioPage } from "./public-portfolio-public-page";

async function run() {
  const root = document.querySelector<HTMLElement>("[data-public-portfolio-page]");
  const token = root?.dataset.publicPortfolioToken?.trim() ?? "";
  await initPublicPortfolioPage({ mode: "token", token });
}

function boot() {
  void run();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:after-swap", boot);

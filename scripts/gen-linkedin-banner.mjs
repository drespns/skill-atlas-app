import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const OUT_DIR = path.join(ROOT, "public", "brand");
const OUT_SVG = path.join(OUT_DIR, "skillatlas-linkedin-banner-1584x396.svg");
const OUT_PNG = path.join(OUT_DIR, "skillatlas-linkedin-banner-1584x396.png");

const W = 1584;
const H = 396;

function toDataUri(svgText) {
  const base64 = Buffer.from(svgText, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function buildBannerSvg({ markDataUri }) {
  // Palette aligned with `public/favicon.svg` and app accent.
  const BG_1 = "#0F172A";
  const BG_2 = "#1E1B4B";
  const ACCENT_1 = "#C4B5FD";
  const ACCENT_2 = "#93C5FD";
  const ACCENT_3 = "#A78BFA";
  const ACCENT_4 = "#60A5FA";

  // Layout (safe area so LinkedIn crop doesn't kill key elements).
  // Keep left side clean (profile photo + UI overlays on LinkedIn).
  const padX = 96;
  const markSize = 200;
  const markY = Math.round(H / 2 - markSize / 2);
  const groupRightMargin = 104;
  const groupGap = 46;
  const titleSize = 86;
  const titleY = Math.round(H / 2 + 18);
  const titleApproxW = 540; // close enough for safe layout
  const groupW = markSize + groupGap + titleApproxW;
  const groupX = W - groupRightMargin - groupW;
  const markX = Math.round(groupX);
  const titleX = Math.round(markX + markSize + groupGap);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}">
      <stop stop-color="${BG_1}"/>
      <stop offset="1" stop-color="${BG_2}"/>
    </linearGradient>

    <linearGradient id="titleGrad" x1="${titleX}" y1="${titleY - 64}" x2="${titleX + 720}" y2="${titleY + 64}">
      <stop stop-color="${ACCENT_1}"/>
      <stop offset="0.55" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="${ACCENT_2}"/>
    </linearGradient>

    <radialGradient id="markGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      transform="translate(${markX + markSize * 0.55} ${markY + markSize * 0.55}) rotate(90) scale(${markSize * 0.95})">
      <stop stop-color="${ACCENT_3}" stop-opacity="0.32"/>
      <stop offset="0.55" stop-color="${ACCENT_4}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${ACCENT_4}" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="orbA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      transform="translate(${Math.round(W * 0.28)} ${Math.round(H * 0.36)}) rotate(90) scale(${Math.round(H * 0.92)})">
      <stop stop-color="${ACCENT_4}" stop-opacity="0.22"/>
      <stop offset="0.45" stop-color="${ACCENT_3}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${ACCENT_3}" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="orbB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      transform="translate(${Math.round(W * 0.44)} ${Math.round(H * 0.72)}) rotate(90) scale(${Math.round(H * 0.78)})">
      <stop stop-color="${ACCENT_1}" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="${ACCENT_2}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${ACCENT_2}" stop-opacity="0"/>
    </radialGradient>

    <filter id="softBlur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14" />
    </filter>

    <filter id="titleShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>

    <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${ACCENT_3}" flood-opacity="0.18"/>
    </filter>

    <pattern id="microGrid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1"/>
      <circle cx="0" cy="0" r="1.25" fill="${ACCENT_2}" opacity="0.10"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Depth layers -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#orbA)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#orbB)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#microGrid)" opacity="0.35"/>

  <!-- Orbits / connections -->
  <g opacity="0.30" filter="url(#lineGlow)">
    <path d="M${Math.round(W * 0.10)} ${Math.round(H * 0.18)} C ${Math.round(W * 0.26)} ${Math.round(H * 0.05)}, ${Math.round(W * 0.40)} ${Math.round(H * 0.08)}, ${Math.round(W * 0.56)} ${Math.round(H * 0.20)}" stroke="${ACCENT_2}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${Math.round(W * 0.14)} ${Math.round(H * 0.80)} C ${Math.round(W * 0.32)} ${Math.round(H * 0.66)}, ${Math.round(W * 0.48)} ${Math.round(H * 0.60)}, ${Math.round(W * 0.68)} ${Math.round(H * 0.52)}" stroke="${ACCENT_1}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${Math.round(W * 0.32)} ${Math.round(H * 0.10)} C ${Math.round(W * 0.38)} ${Math.round(H * 0.26)}, ${Math.round(W * 0.46)} ${Math.round(H * 0.44)}, ${Math.round(W * 0.58)} ${Math.round(H * 0.62)}" stroke="${ACCENT_3}" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>
    <path d="M${Math.round(W * 0.44)} ${Math.round(H * 0.16)} C ${Math.round(W * 0.56)} ${Math.round(H * 0.28)}, ${Math.round(W * 0.68)} ${Math.round(H * 0.38)}, ${Math.round(W * 0.84)} ${Math.round(H * 0.44)}" stroke="${ACCENT_4}" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>
    <path d="M${Math.round(W * 0.58)} ${Math.round(H * 0.06)} C ${Math.round(W * 0.74)} ${Math.round(H * 0.20)}, ${Math.round(W * 0.86)} ${Math.round(H * 0.36)}, ${Math.round(W * 0.96)} ${Math.round(H * 0.56)}" stroke="${ACCENT_2}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
    <path d="M${Math.round(W * 0.52)} ${Math.round(H * 0.90)} C ${Math.round(W * 0.72)} ${Math.round(H * 0.74)}, ${Math.round(W * 0.86)} ${Math.round(H * 0.60)}, ${Math.round(W * 0.98)} ${Math.round(H * 0.44)}" stroke="${ACCENT_1}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>

    <!-- nodes -->
    <circle cx="${Math.round(W * 0.10)}" cy="${Math.round(H * 0.18)}" r="3.5" fill="${ACCENT_2}" opacity="0.95"/>
    <circle cx="${Math.round(W * 0.56)}" cy="${Math.round(H * 0.20)}" r="4" fill="${ACCENT_2}"/>
    <circle cx="${Math.round(W * 0.14)}" cy="${Math.round(H * 0.80)}" r="3.5" fill="${ACCENT_1}" opacity="0.95"/>
    <circle cx="${Math.round(W * 0.68)}" cy="${Math.round(H * 0.52)}" r="4" fill="${ACCENT_1}"/>
    <circle cx="${Math.round(W * 0.58)}" cy="${Math.round(H * 0.62)}" r="3.25" fill="${ACCENT_3}" opacity="0.95"/>
    <circle cx="${Math.round(W * 0.84)}" cy="${Math.round(H * 0.44)}" r="3.25" fill="${ACCENT_4}" opacity="0.95"/>
    <circle cx="${Math.round(W * 0.96)}" cy="${Math.round(H * 0.56)}" r="3.75" fill="${ACCENT_2}" opacity="0.9"/>
    <circle cx="${Math.round(W * 0.98)}" cy="${Math.round(H * 0.44)}" r="3.75" fill="${ACCENT_1}" opacity="0.9"/>
  </g>

  <!-- Mark glow -->
  <circle cx="${markX + markSize * 0.56}" cy="${markY + markSize * 0.54}" r="${Math.round(markSize * 0.72)}" fill="url(#markGlow)" filter="url(#softBlur)"/>

  <!-- Brand mark (favicon) -->
  <image href="${markDataUri}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" />

  <!-- Title -->
  <text x="${titleX}" y="${titleY}"
    font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
    font-size="${titleSize}"
    font-weight="800"
    letter-spacing="-1.2"
    fill="url(#titleGrad)"
    filter="url(#titleShadow)"
  >SkillAtlas</text>

  <!-- Slight vignette to add depth -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="black" opacity="0.10"/>
</svg>`;
}

async function main() {
  const faviconPath = path.join(ROOT, "public", "favicon.svg");
  const faviconSvg = await fs.readFile(faviconPath, "utf8");

  await fs.mkdir(OUT_DIR, { recursive: true });

  const markDataUri = toDataUri(faviconSvg);
  const bannerSvg = buildBannerSvg({ markDataUri });

  await fs.writeFile(OUT_SVG, bannerSvg, "utf8");

  const resvg = new Resvg(bannerSvg, {
    fitTo: { mode: "width", value: W },
    background: "transparent",
    font: {
      // Let it fall back to system fonts; keeps the script self-contained.
      loadSystemFonts: true,
    },
  });

  const pngData = resvg.render().asPng();
  await fs.writeFile(OUT_PNG, pngData);

  // eslint-disable-next-line no-console
  console.log(`Generated:\n- ${path.relative(ROOT, OUT_SVG)}\n- ${path.relative(ROOT, OUT_PNG)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});


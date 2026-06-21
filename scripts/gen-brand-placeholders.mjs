import fs from "node:fs";
import path from "node:path";

const financing = [
  ["klarna", "KL", "#FFB3C7"],
  ["sequra", "SQ", "#00D4AA"],
  ["paypal", "PP", "#003087"],
];

const banks = [
  ["bitvavo", "BV", "#0051FF"],
  ["santander", "SA", "#EC0000"],
  ["imagin", "IM", "#019DF4"],
  ["caixabank", "CX", "#007EAE"],
  ["ing", "IN", "#FF6200"],
  ["traderepublic", "TR", "#111111"],
  ["revolut", "RE", "#0075EB"],
  ["bbva", "BB", "#004481"],
  ["sabadell", "SB", "#006CB5"],
  ["openbank", "OB", "#002855"],
  ["n26", "N26", "#36A18B"],
  ["wise", "WI", "#9FE870"],
  ["degiro", "DG", "#009FDF"],
  ["ibkr", "IB", "#D81E05"],
  ["unicaja", "UN", "#008752"],
  ["bankinter", "BI", "#FF6600"],
  ["kutxabank", "KU", "#009639"],
  ["abanca", "AB", "#005596"],
  ["cajamar", "CJ", "#008265"],
];

function svg(label, color) {
  const text = label.slice(0, 3);
  const fg = ["#111111", "#002855", "#003087"].includes(color) ? "#ffffff" : "#111827";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-hidden="true">
  <rect width="32" height="32" rx="6" fill="${color}"/>
  <text x="16" y="19" text-anchor="middle" fill="${fg}" font-size="9" font-family="system-ui,sans-serif" font-weight="700">${text}</text>
</svg>
`;
}

for (const [key, label, color] of financing) {
  const dir = path.join("public/static/financing-brands");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.svg`), svg(label, color));
}

for (const [key, label, color] of banks) {
  const dir = path.join("public/static/bank-brands");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.svg`), svg(label, color));
}

console.log("SVG placeholders created");

import {
  TrendingUp,
  CreditCard,
  Wallet,
  FlaskConical,
  Users,
  type IconNode,
} from "lucide";

export type ExpenseSectionIconKey =
  | "investments"
  | "financing"
  | "paychecks"
  | "scenarios"
  | "debts";

const ICON_MAP: Record<ExpenseSectionIconKey, IconNode> = {
  investments: TrendingUp,
  financing: CreditCard,
  paychecks: Wallet,
  scenarios: FlaskConical,
  debts: Users,
};

function iconNodeToSvg(iconNode: IconNode, size = 16): string {
  const inner = iconNode
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(" ");
      return `<${tag} ${attrStr}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** SVG inline para secciones del expense-tracker (SSR-safe, sin DOM). */
export function expenseSectionIconSvg(key: ExpenseSectionIconKey, size = 16): string {
  return iconNodeToSvg(ICON_MAP[key], size);
}

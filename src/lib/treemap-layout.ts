/** Layout treemap (slice-and-dice recursivo) para tiles proporcionales al valor. */

export type TreemapItem = { id: string; value: number };

export type TreemapRect = TreemapItem & { x: number; y: number; w: number; h: number };

function itemValue(v: number) {
  return Number.isFinite(v) && v > 0 ? v : 0.01;
}

function layoutSlice(
  items: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: TreemapRect[],
) {
  if (!items.length || w <= 0 || h <= 0) return;
  if (items.length === 1) {
    out.push({ ...items[0]!, x, y, w, h });
    return;
  }
  const sorted = [...items].sort((a, b) => itemValue(b.value) - itemValue(a.value));
  const mid = Math.ceil(sorted.length / 2);
  const a = sorted.slice(0, mid);
  const b = sorted.slice(mid);
  const sumA = a.reduce((s, i) => s + itemValue(i.value), 0);
  const sumB = b.reduce((s, i) => s + itemValue(i.value), 0);
  const sum = sumA + sumB;
  const ratio = sum > 0 ? sumA / sum : 0.5;
  const horizontal = w >= h;
  if (horizontal) {
    const wA = w * ratio;
    layoutSlice(a, x, y, wA, h, out);
    layoutSlice(b, x + wA, y, w - wA, h, out);
  } else {
    const hA = h * ratio;
    layoutSlice(a, x, y, w, hA, out);
    layoutSlice(b, x, y + hA, w, h - hA, out);
  }
}

export function layoutTreemap(items: TreemapItem[], width: number, height: number): TreemapRect[] {
  if (!items.length || width <= 0 || height <= 0) return [];
  const out: TreemapRect[] = [];
  layoutSlice(items, 0, 0, width, height, out);
  return out;
}

/** SVG creado en DOM: trazo “a mano” encima de la celda (habit paint). */

const SVG_NS = "http://www.w3.org/2000/svg";

/** viewBox 0..36 para celdas ~28px; trazos con sensación de creyón + zigzag. */
const BORDER_D =
  "M7.2 8.1 C8.4 5.6 10.8 5.2 14 6.2 C17 5 21.5 5.5 25 6.8 C28.5 6 31.2 7.6 31.6 10.8 L32 25.8 C31.4 29.6 28.8 31.4 24.8 31.3 L11.6 31.4 C7 31.2 4.6 29 4.4 24.6 L4.6 11.2 C4.8 9 5.6 8.4 7.2 8.1 Z";

/** Serpentinas horizontales + refuerzo (un solo path para un solo dash animation). */
const SCRIBBLE_D =
  "M3.5 13.5 L7 11.2 L11.5 14.8 L15.8 10.5 L20.5 15.2 L24.5 11 L29 15.5 L32.5 12" +
  " M3.8 19 L8.2 21 L13.6 17.2 L18.8 21.5 L24 17.8 L28.8 22 L32.2 19.2" +
  " M5.2 24.8 L10 26.5 L15.2 23.5 L21.2 27.2 L26.5 24 L32 26.5";

const FILL_D =
  "M10 15.5 Q18 11.5 26 15.2 Q27.5 21.5 18.5 26.8 Q9.5 23.5 10 15.5 Z";

export function appendPaintSvgLayer(btn: HTMLButtonElement) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "habit-paint-svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "habit-paint-g");
  g.setAttribute("filter", "url(#skillatlas-habit-crayon)");

  const fill = document.createElementNS(SVG_NS, "path");
  fill.setAttribute("class", "habit-paint-fill");
  fill.setAttribute("d", FILL_D);

  const border = document.createElementNS(SVG_NS, "path");
  border.setAttribute("class", "habit-paint-border");
  border.setAttribute("d", BORDER_D);
  border.setAttribute("fill", "none");
  border.setAttribute("stroke", "currentColor");
  border.setAttribute("stroke-width", "2.05");
  border.setAttribute("stroke-linejoin", "round");
  border.setAttribute("stroke-linecap", "round");
  border.setAttribute("pathLength", "100");

  const scribble = document.createElementNS(SVG_NS, "path");
  scribble.setAttribute("class", "habit-paint-scribble");
  scribble.setAttribute("d", SCRIBBLE_D);
  scribble.setAttribute("fill", "none");
  scribble.setAttribute("stroke", "currentColor");
  scribble.setAttribute("stroke-width", "1.55");
  scribble.setAttribute("stroke-linejoin", "round");
  scribble.setAttribute("stroke-linecap", "round");
  scribble.setAttribute("pathLength", "100");

  g.append(fill, border, scribble);
  svg.appendChild(g);
  btn.appendChild(svg);
}

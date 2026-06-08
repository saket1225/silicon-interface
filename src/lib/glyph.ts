// Deterministic MarkSystem generator for Carbon, Silicon, and Team marks.
// Ported from /Users/codanium/Downloads/MarkSystem.jsx.

const BG = "#EAE6DD";
const FG = "#111111";
const VB = 100;

type Family = "carbon" | "silicon" | "team";
type CellType = 0 | 1 | 2 | 3 | 4 | 5;
type Transform = [(r: number, c: number, n: number) => [number, number], (t: CellType) => CellType];

function remapCell(t: CellType, map: Partial<Record<CellType, CellType>>): CellType {
  return map[t] ?? t;
}

const flipH = (t: CellType): CellType => remapCell(t, { 2: 3, 3: 2, 4: 5, 5: 4 });
const flipV = (t: CellType): CellType => remapCell(t, { 2: 5, 5: 2, 3: 4, 4: 3 });
const flipD = (t: CellType): CellType => remapCell(t, { 3: 5, 5: 3 });
const flipA = (t: CellType): CellType => remapCell(t, { 2: 4, 4: 2 });
const rot90 = (t: CellType): CellType => remapCell(t, { 2: 3, 3: 4, 4: 5, 5: 2 });
const rot270 = (t: CellType): CellType => remapCell(t, { 2: 5, 5: 4, 4: 3, 3: 2 });
const rot180 = (t: CellType): CellType => remapCell(t, { 2: 4, 4: 2, 3: 5, 5: 3 });

const T = {
  id: [(r: number, c: number) => [r, c] as [number, number], (t: CellType) => t] as Transform,
  mH: [(r: number, c: number, n: number) => [r, n - 1 - c] as [number, number], flipH] as Transform,
  mV: [(r: number, c: number, n: number) => [n - 1 - r, c] as [number, number], flipV] as Transform,
  r180: [(r: number, c: number, n: number) => [n - 1 - r, n - 1 - c] as [number, number], rot180] as Transform,
  mD: [(r: number, c: number) => [c, r] as [number, number], flipD] as Transform,
  mA: [(r: number, c: number, n: number) => [n - 1 - c, n - 1 - r] as [number, number], flipA] as Transform,
  r90: [(r: number, c: number, n: number) => [c, n - 1 - r] as [number, number], rot90] as Transform,
  r270: [(r: number, c: number, n: number) => [n - 1 - c, r] as [number, number], rot270] as Transform,
};

const ORTHO = [T.id, T.mH, T.mV, T.r180];
const DIAG = [T.id, T.mD, T.mA, T.r180];
const FULL8 = [T.id, T.mH, T.mV, T.r180, T.mD, T.mA, T.r90, T.r270];

interface DomainCell {
  r: number;
  c: number;
  rad: number;
  ang: number;
}

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function charRng(ch: string, i: number, seed: number) {
  return mulberry32((Math.imul((ch.codePointAt(0) ?? 0) + 7, 2654435761) ^ Math.imul(i + 1, 40503) ^ seed) >>> 0);
}

function buildDomain(n: number, pred: (r: number, c: number, cen: number, n: number) => boolean): DomainCell[] {
  const cen = (n - 1) / 2;
  const out: DomainCell[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (pred(r, c, cen, n)) out.push({ r, c, rad: Math.hypot(r - cen, c - cen), ang: Math.atan2(r - cen, c - cen) });
    }
  }
  out.sort((a, b) => a.rad - b.rad || a.ang - b.ang || a.r - b.r);
  return out;
}

function tCarbon(rng: () => number, cell: DomainCell): CellType {
  const r = rng();
  if (cell.rad < 0.1) return r < 0.7 ? 1 : 4;
  if (cell.rad < 1.6) {
    if (r < 0.4) return 4;
    if (r < 0.7) return 2;
    return 1;
  }
  if (r < 0.5) return 1;
  if (r < 0.74) return 0;
  if (r < 0.87) return 4;
  return 2;
}

function tSilicon(rng: () => number, cell: DomainCell, cen: number): CellType {
  const r = rng();
  const dr = Math.abs(cell.r - cen);
  const dc = Math.abs(cell.c - cen);
  const onDiag = Math.abs(dr - dc) < 0.01;
  const onAxis = dr === 0 || dc === 0;
  if (cell.rad < 0.1) return 1;
  if (cell.rad < 1.6) return r < 0.5 ? 1 : 4;
  if (onDiag) return r < 0.85 ? 1 : 4;
  if (onAxis) return r < 0.75 ? 0 : 1;
  return r < 0.6 ? 0 : r < 0.82 ? 2 : 4;
}

function tTeam(rng: () => number, cell: DomainCell): CellType {
  const r = rng();
  if (cell.rad < 0.1) return 1;
  if (cell.rad < 1.6) {
    if (r < 0.45) return 4;
    if (r < 0.75) return 2;
    return 1;
  }
  if (r < 0.4) return 1;
  if (r < 0.58) return 0;
  if (r < 0.8) return 4;
  return 2;
}

const FAM = {
  carbon: {
    n: 7,
    group: ORTHO,
    pick: tCarbon,
    theme: "light",
    domain: buildDomain(7, (r, c, cen) => r <= cen && c <= cen),
  },
  silicon: {
    n: 7,
    group: DIAG,
    pick: tSilicon,
    theme: "dark",
    domain: buildDomain(7, (r, c, cen, n) => r <= c && r <= n - 1 - c),
  },
  team: {
    n: 9,
    group: FULL8,
    pick: tTeam,
    theme: "split",
    domain: buildDomain(9, (r, c, cen) => r <= cen && c <= cen && r <= c),
  },
} satisfies Record<Family, {
  n: number;
  group: Transform[];
  pick: (rng: () => number, cell: DomainCell, cen: number) => CellType;
  theme: "light" | "dark" | "split";
  domain: DomainCell[];
}>;

function buildGrid(text: string, fam: Family): CellType[][] {
  const config = FAM[fam];
  const cen = (config.n - 1) / 2;
  const grid: CellType[][] = Array.from({ length: config.n }, () => Array<CellType>(config.n).fill(0));
  const source = (text || "?").slice(0, 28);
  const seed = fnv(source);
  [...source].forEach((ch, i) => {
    const rng = charRng(ch, i, seed);
    const cell = config.domain[i < config.domain.length ? i : Math.floor(rng() * config.domain.length)];
    const t = config.pick(rng, cell, cen);
    config.group.forEach(([fn, tt]) => {
      const [r2, c2] = fn(cell.r, cell.c, config.n);
      grid[r2][c2] = tt(t);
    });
  });
  return grid;
}

function cellMarkup(grid: CellType[][], n: number, fill: string): string {
  const pad = 8;
  const s = (VB - pad * 2) / n;
  const e = 0.4;
  let out = "";
  grid.forEach((row, r) => row.forEach((t, c) => {
    if (!t) return;
    const x0 = pad + c * s - e;
    const y0 = pad + r * s - e;
    const x1 = pad + c * s + s + e;
    const y1 = pad + r * s + s + e;
    if (t === 1) {
      out += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fill}"/>`;
      return;
    }
    let points = "";
    if (t === 2) points = `${x0},${y0} ${x1},${y0} ${x0},${y1}`;
    else if (t === 3) points = `${x0},${y0} ${x1},${y0} ${x1},${y1}`;
    else if (t === 4) points = `${x1},${y1} ${x0},${y1} ${x1},${y0}`;
    else points = `${x0},${y1} ${x0},${y0} ${x1},${y1}`;
    out += `<polygon points="${points}" fill="${fill}"/>`;
  }));
  return out;
}

export interface GlyphOptions {
  size?: number;
  family?: Family;
}

export function glyphSvg(text: string, opts: GlyphOptions = {}): string {
  const family = opts.family ?? "carbon";
  const size = opts.size ?? 256;
  const config = FAM[family];
  const grid = buildGrid(text || "?", family);
  const id = `ms-${family}-${fnv(`${family}:${text || "?"}`).toString(36)}`;

  let body = "";
  if (config.theme === "split") {
    const h = VB / 2;
    body = [
      `<defs><clipPath id="${id}-lh"><rect x="0" y="0" width="${h}" height="${VB}"/></clipPath><clipPath id="${id}-rh"><rect x="${h}" y="0" width="${h}" height="${VB}"/></clipPath></defs>`,
      `<rect x="0" y="0" width="${h}" height="${VB}" fill="${BG}"/>`,
      `<rect x="${h}" y="0" width="${h}" height="${VB}" fill="${FG}"/>`,
      `<g clip-path="url(#${id}-lh)">${cellMarkup(grid, config.n, FG)}</g>`,
      `<g clip-path="url(#${id}-rh)">${cellMarkup(grid, config.n, BG)}</g>`,
    ].join("");
  } else {
    const dark = config.theme === "dark";
    body = `<rect width="${VB}" height="${VB}" fill="${dark ? FG : BG}"/>${cellMarkup(grid, config.n, dark ? BG : FG)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px">${body}</svg>`;
}

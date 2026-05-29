// Silicon GlyphGenerator — direct port of Downloads/GlyphGenerator.jsx.
//
// Deterministic 7×7 grid of triangles/full/empty cells, ordered radially
// from the center. Each input character writes one symmetric cell (mirrored
// into the other 3 quadrants), so the mark grows progressively as you type
// and is fully reproducible from the seed string. Used to brand a Carbon
// the first time they sign up so their identicon feels like a piece of
// Silicon Interface, not a hashed blob.

const BG = "#EAE6DD";
const FG = "#111111";

const N = 7;
const C = (N - 1) / 2;

const EMPTY = 0;
const FULL = 1;
const TRI_TL = 2;
const TRI_TR = 3;
const TRI_BR = 4;
const TRI_BL = 5;
type CellType = typeof EMPTY | typeof FULL | typeof TRI_TL | typeof TRI_TR | typeof TRI_BR | typeof TRI_BL;

function flipH(t: CellType): CellType {
  switch (t) {
    case TRI_TL: return TRI_TR;
    case TRI_TR: return TRI_TL;
    case TRI_BL: return TRI_BR;
    case TRI_BR: return TRI_BL;
    default: return t;
  }
}
function flipV(t: CellType): CellType {
  switch (t) {
    case TRI_TL: return TRI_BL;
    case TRI_BL: return TRI_TL;
    case TRI_TR: return TRI_BR;
    case TRI_BR: return TRI_TR;
    default: return t;
  }
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface Group { rr: number; cc: number; rad: number; ang: number; }
const GROUPS: Group[] = (() => {
  const g: Group[] = [];
  for (let rr = 0; rr <= C; rr++) {
    for (let cc = 0; cc <= C; cc++) {
      const dr = C - rr, dc = C - cc;
      g.push({ rr, cc, rad: Math.hypot(dr, dc), ang: Math.atan2(dr, dc) });
    }
  }
  g.sort((a, b) => a.rad - b.rad || a.ang - b.ang || a.rr - b.rr);
  return g;
})();

function pickType(v: number, rad: number): CellType {
  const r = (v % 1000) / 1000;
  if (rad < 0.1) {
    return r < 0.7 ? FULL : TRI_BR;
  }
  if (rad < 1.6) {
    if (r < 0.4) return TRI_BR;
    if (r < 0.7) return TRI_TL;
    return FULL;
  }
  if (r < 0.5) return FULL;
  if (r < 0.74) return EMPTY;
  if (r < 0.87) return TRI_BR;
  return TRI_TL;
}

function buildGrid(text: string): CellType[][] {
  const grid: CellType[][] = Array.from({ length: N }, () => Array<CellType>(N).fill(EMPTY));
  // Cap at 28 like the reference — beyond that adds nothing visually.
  const source = (text || "").slice(0, 28).toUpperCase();
  const chars = [...source];
  const seed = hashStr(source);

  const place = (rr: number, cc: number, repType: CellType) => {
    grid[rr][cc] = repType;
    grid[rr][N - 1 - cc] = flipH(repType);
    grid[N - 1 - rr][cc] = flipV(repType);
    grid[N - 1 - rr][N - 1 - cc] = flipV(flipH(repType));
  };

  chars.forEach((ch, i) => {
    const cv = ch.codePointAt(0) ?? 0;
    const v = (Math.imul(cv + 7, 2654435761) ^ Math.imul(i + 1, 40503) ^ seed) >>> 0;
    const groupIdx = i < GROUPS.length ? i : (v % GROUPS.length);
    const g = GROUPS[groupIdx];
    const t = pickType(v, g.rad);
    place(g.rr, g.cc, t);
  });

  return grid;
}

interface GlyphOptions {
  size?: number;
  /** Background color. Set to "transparent" to skip the background rect. */
  bg?: string;
  /** Foreground color for the shapes. */
  fg?: string;
}

/**
 * Build the SVG markup for a glyph derived from `text`. Same input → same
 * output (deterministic).
 */
export function glyphSvg(text: string, opts: GlyphOptions = {}): string {
  const size = opts.size ?? 256;
  const fg = opts.fg ?? FG;
  const bg = opts.bg ?? BG;

  const grid = buildGrid(text || "?");
  const pad = size * 0.07;
  const inner = size - pad * 2;
  const s = inner / N;
  const e = 0.5; // overdraw guard against seams

  let body = "";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const t = grid[r][c];
      if (t === EMPTY) continue;
      const x = c * s, y = r * s;
      const x0 = x - e, y0 = y - e, x1 = x + s + e, y1 = y + s + e;
      if (t === FULL) {
        body += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${fg}"/>`;
        continue;
      }
      let pts: string;
      if (t === TRI_TL) pts = `${x0},${y0} ${x1},${y0} ${x0},${y1}`;
      else if (t === TRI_TR) pts = `${x0},${y0} ${x1},${y0} ${x1},${y1}`;
      else if (t === TRI_BR) pts = `${x1},${y1} ${x0},${y1} ${x1},${y0}`;
      else /* TRI_BL */ pts = `${x0},${y1} ${x0},${y0} ${x1},${y1}`;
      body += `<polygon points="${pts}" fill="${fg}"/>`;
    }
  }

  const bgRect =
    bg === "transparent"
      ? ""
      : `<rect width="${size}" height="${size}" fill="${bg}"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    bgRect +
    `<g transform="translate(${pad} ${pad})">${body}</g>` +
    `</svg>`
  );
}

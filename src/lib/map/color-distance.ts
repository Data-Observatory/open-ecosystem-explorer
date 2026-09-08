// Colour-distance utilities for the map2 palette regression test (Opus
// evaluation report §B4/§C — "the ad-hoc 'checked within same-shape groups'
// method is what let these collisions through; replace it with a CI test
// that computes ΔE2000 all-pairs plus CVD sims and fails below thresholds").
// Pure, deterministic, unit-tested on its own — no dependency on any colour
// library; sRGB -> Lab -> CIEDE2000 (Sharma et al. 2005) implemented directly,
// and protanopia/deuteranopia simulated via the commonly-used Viénot (1999)
// linear-RGB confusion matrices. These CVD matrices are a standard, widely
// used APPROXIMATION (not a clinical model) — good enough to catch a same-hue
// collision, not a substitute for real assistive-tech testing.
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Lab {
  L: number;
  a: number;
  b: number;
}
export type CvdKind = 'normal' | 'protanopia' | 'deuteranopia';

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// Viénot/Brettel-style linear-RGB confusion matrices (row-major, applied to
// [Rlin, Glin, Blin]) — a standard approximation for dichromatic simulation.
const CVD_MATRIX: Record<Exclude<CvdKind, 'normal'>, number[][]> = {
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
};

export function simulateCvd(rgb: Rgb, kind: CvdKind): Rgb {
  if (kind === 'normal') return rgb;
  const lin = [srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b)];
  const m = CVD_MATRIX[kind];
  const out = m.map((row) => row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!);
  return { r: linearToSrgb(out[0]!), g: linearToSrgb(out[1]!), b: linearToSrgb(out[2]!) };
}

// sRGB -> XYZ (D65) -> CIELAB.
function rgbToXyz(rgb: Rgb): [number, number, number] {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;
  return [x, y, z];
}

function fXyz(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

export function rgbToLab(rgb: Rgb): Lab {
  const [x, y, z] = rgbToXyz(rgb);
  // D65 reference white.
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  const fx = fXyz(x / xn);
  const fy = fXyz(y / yn);
  const fz = fXyz(z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005). */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const hRad = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    let h = (Math.atan2(b, a) * 180) / Math.PI;
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hRad(a1p, b1);
  const h2p = hRad(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(((dhp / 2) * Math.PI) / 180);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hbarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin((2 * dTheta * Math.PI) / 180) * Rc;

  const termL = dLp / (kL * Sl);
  const termC = dCp / (kC * Sc);
  const termH = dHp / (kH * Sh);

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + Rt * termC * termH);
}

/** ΔE2000 between two hex colours under a given (possibly CVD-simulated) vision. */
export function hexDeltaE(hexA: string, hexB: string, vision: CvdKind = 'normal'): number {
  const rgbA = simulateCvd(hexToRgb(hexA), vision);
  const rgbB = simulateCvd(hexToRgb(hexB), vision);
  return ciede2000(rgbToLab(rgbA), rgbToLab(rgbB));
}

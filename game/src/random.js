// random.js — deterministic seeded randomness for MARISOL BAY.
//
// The whole city is generated from one seed so every run (and every
// screenshot) builds the identical Marisol Bay: same buildings, same palms,
// same traffic colours. mulberry32 is tiny, fast and good enough for
// scattering props and picking paint.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  /** float in [0, 1) */
  f() {
    return this.next();
  }
  /** float in [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }
  /** integer in [min, max] inclusive */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** true with probability p */
  chance(p) {
    return this.next() < p;
  }
  /** one element of arr */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** a fresh independent stream derived from this one */
  fork() {
    return new Rng(Math.floor(this.next() * 0xffffffff));
  }
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** shortest signed angular difference a-b, in radians */
export function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

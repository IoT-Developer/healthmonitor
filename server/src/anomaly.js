// anomaly.js — Tier-2 statistical anomaly detection.
//
// We keep a fixed-size rolling window per (patientId, metric) in memory.
// A z-score of |z| > 3 means the current reading is more than 3 stddevs from
// the recent mean — flag it. This is intentionally simple, deterministic,
// and fast; an ML model can replace `score()` in Phase 2 with no API change.

const WINDOW = 100; // ~5 minutes at 3s tick
const Z_THRESHOLD = 3;

const buffers = new Map(); // key: `${patientId}:${metric}` → number[]

function push(key, value) {
  let buf = buffers.get(key);
  if (!buf) {
    buf = [];
    buffers.set(key, buf);
  }
  buf.push(value);
  if (buf.length > WINDOW) buf.shift();
  return buf;
}

function stats(buf) {
  const n = buf.length;
  if (n < 10) return null; // not enough data yet
  const mean = buf.reduce((a, b) => a + b, 0) / n;
  const variance = buf.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { mean, std };
}

function zFor(patientId, metric, value) {
  const key = `${patientId}:${metric}`;
  const buf = push(key, value);
  const s = stats(buf);
  if (!s || s.std < 1e-6) return 0;
  return (value - s.mean) / s.std;
}

/**
 * Return the worst (largest |z|) score across HR / SpO2 / Temp.
 * Positive or negative; caller can threshold on Math.abs(score).
 */
export function score(reading) {
  const zHr   = zFor(reading.patientId, "hr",    reading.hr);
  const zSpo2 = zFor(reading.patientId, "spo2",  reading.spo2);
  const zTemp = zFor(reading.patientId, "tempC", reading.tempC);
  const candidates = [zHr, zSpo2, zTemp];
  // pick the one with the largest absolute value
  return candidates.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
}

export function isAnomaly(z) {
  return Math.abs(z) > Z_THRESHOLD;
}

export const ANOMALY_CONFIG = { WINDOW, Z_THRESHOLD };

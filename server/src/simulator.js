// simulator.js — AI-driven vitals generator.
//
// Replaces ESP32 hardware. Produces a reading per active patient every
// SIMULATOR_TICK_MS milliseconds. Output payload exactly matches what a real
// ESP32→MQTT bridge would publish, so swapping the producer later is trivial.
//
// Generation model:
//   • Mean-reverting random walk:  x_{t+1} = x_t + k(target - x_t) + noise
//   • Persona profiles bias the target ranges + spike probability
//   • Light circadian modulation on HR target (lower at night, in UTC for now)

import { query } from "./db.js";
import { logger } from "./logger.js";

const personas = {
  healthy:  { hr: [60, 90],   spo2: [97, 100], temp: [36.5, 37.2], spikeP: 0.001 },
  at_risk:  { hr: [55, 105],  spo2: [94, 99],  temp: [36.3, 37.6], spikeP: 0.010 },
  critical: { hr: [50, 130],  spo2: [88, 98],  temp: [36.0, 39.0], spikeP: 0.050 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Mean-reverting step. k = pull strength toward target; noise = stddev-ish.
function meanRevert(cur, target, k, noise) {
  return cur + k * (target - cur) + (Math.random() - 0.5) * 2 * noise;
}

// Returns the circadian offset for HR target. Crude but gives the chart life.
function circadianHrOffset(date = new Date()) {
  const hour = date.getUTCHours();
  // Lowest around 04:00 UTC, highest around 16:00 UTC. Range ±5 bpm.
  return -5 * Math.cos(((hour - 4) / 24) * 2 * Math.PI);
}

async function loadActivePatients() {
  return query("SELECT id, persona, baseline FROM patients");
}

/**
 * Start the simulator. `onReading(reading)` is called for each tick per patient.
 * Returns a stop() function.
 */
export async function startSimulator(onReading) {
  const tickMs = Number(process.env.SIMULATOR_TICK_MS) || 3000;
  const patients = await loadActivePatients();

  if (patients.length === 0) {
    logger.warn("Simulator: no patients found. Run `node seed.js` to populate demo data.");
  }

  // Per-patient state. baseline guides the starting point so charts don't jump.
  const state = new Map(
    patients.map((p) => {
      const baseline = p.baseline || {};
      return [
        p.id,
        {
          hr: baseline.hr ?? 75,
          spo2: baseline.spo2 ?? 98,
          tempC: baseline.tempC ?? 36.8,
          persona: p.persona || "healthy",
        },
      ];
    })
  );

  logger.info({ tickMs, patients: patients.length }, "Simulator started");

  const handle = setInterval(() => {
    const now = Date.now();
    const hrCircadian = circadianHrOffset();

    for (const [pid, s] of state) {
      const cfg = personas[s.persona] || personas.healthy;
      const targetHr   = (cfg.hr[0]   + cfg.hr[1])   / 2 + hrCircadian;
      const targetSpo2 = (cfg.spo2[0] + cfg.spo2[1]) / 2;
      const targetTemp = (cfg.temp[0] + cfg.temp[1]) / 2;

      s.hr    = Math.round(meanRevert(s.hr,    targetHr,   0.1,  1.5));
      s.spo2  = Math.round(meanRevert(s.spo2,  targetSpo2, 0.2,  0.6));
      s.tempC = +meanRevert(s.tempC, targetTemp, 0.05, 0.1).toFixed(2);

      // Occasional anomaly spikes drive the alert UX.
      if (Math.random() < cfg.spikeP) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        s.hr += dir * 30;
        s.spo2 -= 6;
      }

      // Hard physiological clamps so we never emit nonsense.
      s.hr   = clamp(s.hr,   30, 220);
      s.spo2 = clamp(s.spo2, 70, 100);
      s.tempC = clamp(s.tempC, 33, 42);

      Promise.resolve(
        onReading({
          patientId: pid,
          ts: now,
          hr: s.hr,
          spo2: s.spo2,
          tempC: s.tempC,
          source: "simulator",
        })
      ).catch((err) => logger.error({ err, pid }, "ingest failed"));
    }
  }, tickMs);

  return () => clearInterval(handle);
}

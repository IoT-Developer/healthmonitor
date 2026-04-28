// ingest.js — single funnel for incoming vitals (simulator OR future ESP32).
// Side effects: persist reading, check thresholds + anomaly, persist alert,
// roll up patient.status. Returns what to broadcast.

import { query, queryOne } from "./db.js";
import { score, isAnomaly } from "./anomaly.js";
import { logger } from "./logger.js";

// Simple in-memory cache of patient configs. Invalidated when patients are
// updated through the REST API (see routes/patients.js). For MVP scale this
// is fine; for horizontal scale, swap for Redis pub/sub invalidation.
const patientCache = new Map();

export function invalidatePatient(patientId) {
  patientCache.delete(Number(patientId));
}

async function getPatient(patientId) {
  const cached = patientCache.get(Number(patientId));
  if (cached) return cached;
  const p = await queryOne(
    "SELECT id, name, persona, thresholds, status FROM patients WHERE id = ?",
    [patientId]
  );
  if (p) patientCache.set(Number(patientId), p);
  return p;
}

function checkThresholds(reading, thresholds) {
  const t = thresholds || {};
  if (reading.hr   != null && t.hrMax    != null && reading.hr   > t.hrMax)
    return { type: "hr_high",  severity: "warning",  value: reading.hr,    threshold: t.hrMax };
  if (reading.hr   != null && t.hrMin    != null && reading.hr   < t.hrMin)
    return { type: "hr_low",   severity: "warning",  value: reading.hr,    threshold: t.hrMin };
  if (reading.spo2 != null && t.spo2Min  != null && reading.spo2 < t.spo2Min)
    return { type: "spo2_low", severity: "critical", value: reading.spo2,  threshold: t.spo2Min };
  if (reading.tempC != null && t.tempMax != null && reading.tempC > t.tempMax)
    return { type: "fever",    severity: "warning",  value: reading.tempC, threshold: t.tempMax };
  return null;
}

/**
 * Process a single reading.
 *   reading: { patientId, ts, hr, spo2, tempC, source }
 * Returns: { saved, alert?, statusChanged? }
 */
export async function handleReading(reading) {
  const patient = await getPatient(reading.patientId);
  if (!patient) {
    logger.warn({ patientId: reading.patientId }, "ingest: unknown patient, skipping");
    return { saved: null };
  }

  // Tier 2: rolling z-score
  const anomalyScore = score(reading);

  // Tier 1: hard thresholds (preferred — clearer to clinicians)
  let alertSpec = checkThresholds(reading, patient.thresholds);

  // Fall back to anomaly if no threshold tripped
  if (!alertSpec && isAnomaly(anomalyScore)) {
    alertSpec = {
      type: "anomaly",
      severity: "warning",
      value: Number(anomalyScore.toFixed(2)),
      threshold: 3,
    };
  }

  // Persist reading
  const tsDate = new Date(reading.ts);
  const tsSql  = tsDate.toISOString().slice(0, 23).replace("T", " ");
  const result = await query(
    `INSERT INTO sensor_readings (patient_id, ts, hr, spo2, temp_c, source, anomaly_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reading.patientId, tsSql, reading.hr, reading.spo2, reading.tempC, reading.source || "simulator", anomalyScore]
  );

  const saved = {
    id: result.insertId,
    patientId: reading.patientId,
    ts: reading.ts,
    hr: reading.hr,
    spo2: reading.spo2,
    tempC: reading.tempC,
    anomalyScore: Number(anomalyScore.toFixed(3)),
    source: reading.source || "simulator",
  };

  let savedAlert = null;
  let statusChanged = null;

  if (alertSpec) {
    const alertResult = await query(
      `INSERT INTO alerts (patient_id, type, severity, triggered_at, value, threshold_val, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [reading.patientId, alertSpec.type, alertSpec.severity, tsSql, alertSpec.value, alertSpec.threshold]
    );

    savedAlert = {
      id: alertResult.insertId,
      patientId: reading.patientId,
      type: alertSpec.type,
      severity: alertSpec.severity,
      value: alertSpec.value,
      threshold: alertSpec.threshold,
      status: "open",
      triggeredAt: reading.ts,
    };

    // Roll up patient status. Critical alerts override warnings.
    const newStatus =
      alertSpec.severity === "critical" ? "critical" :
      patient.status === "critical" ? "critical" :
      "warning";

    if (newStatus !== patient.status) {
      await query("UPDATE patients SET status = ? WHERE id = ?", [newStatus, reading.patientId]);
      patient.status = newStatus;
      statusChanged = { patientId: reading.patientId, status: newStatus };
    }
  }

  return { saved, alert: savedAlert, statusChanged };
}

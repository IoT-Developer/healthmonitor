// routes/patients.js
import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { invalidatePatient } from "../ingest.js";

const router = Router();
router.use(requireAuth);

// ---- list ---------------------------------------------------------------
router.get("/", async (req, res) => {
  const search = (req.query.search || "").toString().trim();
  const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;

  const where = search ? "WHERE name LIKE ? OR mrn LIKE ?" : "";
  const params = search ? [`%${search}%`, `%${search}%`] : [];

  const rows = await query(
    `SELECT id, mrn, name, dob, sex, persona, baseline, thresholds, status, updated_at
       FROM patients
       ${where}
       ORDER BY
         FIELD(status, 'critical', 'warning', 'stable'),
         name ASC
       LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const totalRow = await queryOne(`SELECT COUNT(*) AS c FROM patients ${where}`, params);
  res.json({ items: rows, page, limit, total: totalRow?.c ?? 0 });
});

// ---- get one ------------------------------------------------------------
router.get("/:id", async (req, res) => {
  const p = await queryOne(
    `SELECT id, mrn, name, dob, sex, persona, baseline, thresholds, status,
            created_at, updated_at
       FROM patients WHERE id = ?`,
    [req.params.id]
  );
  if (!p) return res.status(404).json({ error: "not_found" });
  res.json(p);
});

// ---- recent readings ----------------------------------------------------
router.get("/:id/readings", async (req, res) => {
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 200));
  const from = req.query.from ? new Date(parseInt(req.query.from, 10)) : null;

  const rows = from
    ? await query(
        `SELECT id, ts, hr, spo2, temp_c AS tempC, anomaly_score AS anomalyScore
           FROM sensor_readings
           WHERE patient_id = ? AND ts >= ?
           ORDER BY ts DESC
           LIMIT ${limit}`,
        [req.params.id, from]
      )
    : await query(
        `SELECT id, ts, hr, spo2, temp_c AS tempC, anomaly_score AS anomalyScore
           FROM sensor_readings
           WHERE patient_id = ?
           ORDER BY ts DESC
           LIMIT ${limit}`,
        [req.params.id]
      );
  // Return chronologically for the chart.
  res.json(rows.reverse());
});

// ---- alerts for patient -------------------------------------------------
router.get("/:id/alerts", async (req, res) => {
  const status = req.query.status;
  const where = status ? "AND status = ?" : "";
  const params = status ? [req.params.id, status] : [req.params.id];
  const rows = await query(
    `SELECT id, patient_id AS patientId, type, severity, triggered_at AS triggeredAt,
            value, threshold_val AS threshold, status, ack_by AS ackBy,
            ack_at AS ackAt, note
       FROM alerts
       WHERE patient_id = ? ${where}
       ORDER BY triggered_at DESC
       LIMIT 200`,
    params
  );
  res.json(rows);
});

// ---- create (admin) -----------------------------------------------------
const patientSchema = z.object({
  mrn: z.string().min(1),
  name: z.string().min(1),
  dob: z.string().optional().nullable(),
  sex: z.enum(["M", "F", "O"]).optional().nullable(),
  persona: z.enum(["healthy", "at_risk", "critical"]).default("healthy"),
  baseline: z.object({
    hr: z.number().int().min(30).max(220).default(75),
    spo2: z.number().int().min(70).max(100).default(98),
    tempC: z.number().min(33).max(42).default(36.8),
  }).default({ hr: 75, spo2: 98, tempC: 36.8 }),
  thresholds: z.object({
    hrMin: z.number().int().default(40),
    hrMax: z.number().int().default(120),
    spo2Min: z.number().int().default(92),
    tempMax: z.number().default(38.5),
  }).default({ hrMin: 40, hrMax: 120, spo2Min: 92, tempMax: 38.5 }),
});

router.post("/", requireRole("admin"), async (req, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const p = parsed.data;
  const result = await query(
    `INSERT INTO patients (mrn, name, dob, sex, persona, baseline, thresholds)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.mrn, p.name, p.dob || null, p.sex || null, p.persona, JSON.stringify(p.baseline), JSON.stringify(p.thresholds)]
  );
  res.status(201).json({ id: result.insertId });
});

// ---- update (admin) -----------------------------------------------------
const patchSchema = patientSchema.partial();

router.patch("/:id", requireRole("admin"), async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });

  const p = parsed.data;
  const sets = [];
  const params = [];

  for (const [col, val] of [
    ["name", p.name],
    ["mrn", p.mrn],
    ["dob", p.dob],
    ["sex", p.sex],
    ["persona", p.persona],
  ]) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (p.baseline   !== undefined) { sets.push("baseline = ?");   params.push(JSON.stringify(p.baseline)); }
  if (p.thresholds !== undefined) { sets.push("thresholds = ?"); params.push(JSON.stringify(p.thresholds)); }

  if (sets.length === 0) return res.json({ ok: true });

  params.push(req.params.id);
  await query(`UPDATE patients SET ${sets.join(", ")} WHERE id = ?`, params);
  invalidatePatient(req.params.id);
  res.json({ ok: true });
});

export default router;

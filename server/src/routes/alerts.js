// routes/alerts.js
import { Router } from "express";
import { query, queryOne } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

// ---- list (global feed) -------------------------------------------------
router.get("/", async (req, res) => {
  const status = req.query.status;
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const where = status ? "WHERE a.status = ?" : "";
  const params = status ? [status] : [];

  const rows = await query(
    `SELECT a.id, a.patient_id AS patientId, p.name AS patientName,
            a.type, a.severity, a.triggered_at AS triggeredAt,
            a.value, a.threshold_val AS threshold, a.status,
            a.ack_by AS ackBy, a.ack_at AS ackAt, a.note
       FROM alerts a
       JOIN patients p ON p.id = a.patient_id
       ${where}
       ORDER BY a.triggered_at DESC
       LIMIT ${limit}`,
    params
  );
  res.json(rows);
});

// ---- ack ----------------------------------------------------------------
router.post("/:id/ack", async (req, res) => {
  const userId = req.user.sub;
  const note = (req.body?.note || "").toString().slice(0, 500) || null;
  await query(
    `UPDATE alerts
        SET status = 'ack', ack_by = ?, ack_at = NOW(3), note = ?
      WHERE id = ?`,
    [userId, note, req.params.id]
  );
  const row = await queryOne(
    `SELECT id, patient_id AS patientId, status, ack_by AS ackBy, ack_at AS ackAt, note
       FROM alerts WHERE id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: "not_found" });

  // Broadcast through Socket.IO if available (set by index.js)
  const live = req.app.get("liveNs");
  if (live) {
    live.to(`patient:${row.patientId}`).emit("alert:update", row);
    live.to("alerts:global").emit("alert:update", row);
  }
  res.json(row);
});

// ---- resolve ------------------------------------------------------------
router.post("/:id/resolve", async (req, res) => {
  const userId = req.user.sub;
  await query(
    `UPDATE alerts
        SET status = 'resolved', ack_by = COALESCE(ack_by, ?), ack_at = COALESCE(ack_at, NOW(3))
      WHERE id = ?`,
    [userId, req.params.id]
  );
  const row = await queryOne(
    `SELECT id, patient_id AS patientId, status, ack_by AS ackBy, ack_at AS ackAt, note
       FROM alerts WHERE id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: "not_found" });

  const live = req.app.get("liveNs");
  if (live) {
    live.to(`patient:${row.patientId}`).emit("alert:update", row);
    live.to("alerts:global").emit("alert:update", row);
  }

  // If no other open alerts, drop patient back to stable.
  const stillOpen = await queryOne(
    `SELECT COUNT(*) AS c FROM alerts WHERE patient_id = ? AND status = 'open'`,
    [row.patientId]
  );
  if ((stillOpen?.c ?? 0) === 0) {
    await query(`UPDATE patients SET status = 'stable' WHERE id = ?`, [row.patientId]);
    if (live) live.to("alerts:global").emit("patient:status", { patientId: row.patientId, status: "stable" });
  }

  res.json(row);
});

export default router;

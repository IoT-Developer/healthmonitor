// sockets.js — /live namespace: JWT auth, room subscriptions, alert ack.
import { Server } from "socket.io";
import { verifyAccess } from "./auth.js";
import { query } from "./db.js";
import { logger } from "./logger.js";

export function attachSockets(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  const live = io.of("/live");

  live.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      socket.data.user = verifyAccess(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  live.on("connection", (socket) => {
    const userId = socket.data.user?.sub;
    logger.debug({ userId }, "socket connected");

    // Everyone gets the global alerts feed.
    socket.join("alerts:global");

    socket.on("subscribe:patient", ({ patientId } = {}) => {
      if (!patientId) return;
      socket.join(`patient:${patientId}`);
    });

    socket.on("unsubscribe:patient", ({ patientId } = {}) => {
      if (!patientId) return;
      socket.leave(`patient:${patientId}`);
    });

    socket.on("alert:ack", async ({ alertId, note } = {}, ack) => {
      if (!alertId) return ack?.({ ok: false, error: "missing_alert_id" });
      try {
        await query(
          `UPDATE alerts
              SET status = 'ack', ack_by = ?, ack_at = NOW(3), note = ?
            WHERE id = ?`,
          [userId, note || null, alertId]
        );
        const updated = await query(
          `SELECT id, patient_id AS patientId, status, ack_by AS ackBy, ack_at AS ackAt, note
             FROM alerts WHERE id = ?`,
          [alertId]
        );
        const row = updated[0];
        if (row) {
          live.to(`patient:${row.patientId}`).emit("alert:update", row);
          live.to("alerts:global").emit("alert:update", row);
        }
        ack?.({ ok: true });
      } catch (err) {
        logger.error({ err, alertId }, "alert ack failed");
        ack?.({ ok: false, error: "internal" });
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ userId }, "socket disconnected");
    });
  });

  return { io, live };
}

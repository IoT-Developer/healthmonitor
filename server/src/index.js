// index.js — Express + Socket.IO bootstrap + simulator wiring.
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { logger } from "./logger.js";
import { ping } from "./db.js";
import { cookieParser } from "./cookies.js";

import authRoutes     from "./routes/auth.js";
import patientRoutes  from "./routes/patients.js";
import alertRoutes    from "./routes/alerts.js";

import { attachSockets } from "./sockets.js";
import { handleReading } from "./ingest.js";
import { startSimulator } from "./simulator.js";

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser);

// Global rate limit (auth route has its own stricter one).
app.use(
  "/api/",
  rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false })
);

// --- routes --------------------------------------------------------------
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: String(err) });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/alerts", alertRoutes);

// --- error handler -------------------------------------------------------
app.use((err, _req, res, _next) => {
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
});

// --- boot ----------------------------------------------------------------
const server = http.createServer(app);
const { live } = attachSockets(server, CORS_ORIGIN);
app.set("liveNs", live);

server.listen(PORT, async () => {
  logger.info(`HTTP + Socket.IO listening on :${PORT}`);
  try {
    await ping();
    logger.info("MySQL: connected");
  } catch (err) {
    logger.error({ err }, "MySQL: connection failed — fix MYSQL_URL in .env");
    return;
  }

  if (process.env.SIMULATOR_ENABLED !== "false") {
    try {
      await startSimulator(async (reading) => {
        const { saved, alert, statusChanged } = await handleReading(reading);
        if (!saved) return;
        live.to(`patient:${reading.patientId}`).emit("vitals", saved);
        if (alert) {
          live.to(`patient:${reading.patientId}`).emit("alert:new", alert);
          live.to("alerts:global").emit("alert:new", alert);
        }
        if (statusChanged) {
          live.to("alerts:global").emit("patient:status", statusChanged);
        }
      });
    } catch (err) {
      logger.error({ err }, "simulator failed to start");
    }
  } else {
    logger.warn("Simulator disabled (SIMULATOR_ENABLED=false)");
  }
});

// --- graceful shutdown ---------------------------------------------------
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

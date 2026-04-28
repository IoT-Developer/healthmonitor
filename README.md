# HealthMonitor — AIoT Real-Time Health Monitoring System

A clinician-facing dashboard that streams live patient vitals (HR, SpO₂, body temp) over Socket.IO, runs threshold + statistical anomaly detection, and surfaces alerts in real time.

**Stack**
- **Backend:** Node.js, Express, Socket.IO, MySQL (`mysql2`), JWT auth, bcrypt, Pino logs.
- **Frontend:** React 18 + Vite + TypeScript, TailwindCSS, Recharts, Zustand, socket.io-client.
- **Vitals source:** AI simulator (mean-reverting random walk + persona profiles + circadian drift). Hardware-agnostic ingest contract — swap to ESP32/MQTT later without changing consumer code.

---

## 1. Prerequisites

- Node.js **18+** (recommend 20)
- MySQL **8.0+** running locally (or Docker)
- npm

---

## 2. One-time setup

### 2a. Create the database

```sql
CREATE DATABASE healthmonitor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2b. Apply schema

```bash
mysql -u root -p healthmonitor < server/migrations/001_init.sql
```

### 2c. Configure backend env

```bash
cd server
cp .env.example .env
# edit .env — set MYSQL_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
node seed.js          # creates a clinician + 5 demo patients
```

### 2d. Configure frontend env

```bash
cd ../client
cp .env.example .env  # default points to http://localhost:4000
npm install
```

---

## 3. Run it

Open two terminals.

```bash
# terminal 1 — backend (Express + Socket.IO + simulator)
cd server
npm run dev

# terminal 2 — frontend
cd client
npm run dev
```

Open http://localhost:5173. Log in with the seeded credentials printed by `seed.js` (default: `clinician@example.com` / `password123`).

You should see live tiles updating every 3 seconds and alerts firing when the simulator drives a `critical` persona patient out of range.

---

## 4. How it works

### Real-time data flow

```
Simulator ──▶ ingest.handleReading() ──▶ MySQL
                       │
                       ├──▶ Socket.IO room patient:{id}   (event: vitals)
                       └──▶ if alert → patient:{id} + alerts:global  (event: alert:new)
```

### Anomaly detection (two tiers, ML-ready)

1. **Hard thresholds** per patient (`patient.thresholds` JSON column) → instant alert.
2. **Rolling z-score** over the last ~5 min per metric; `|z| > 3` flags an anomaly. Implemented in-memory in `src/anomaly.js` so it survives even if the DB is slow.
3. *(Phase 2)* Drop in an ONNX Isolation Forest behind the same `score()` function — Tier 2 stays as the safety fallback.

### Forward-compat with real ESP32

Both the simulator and (future) MQTT bridge publish the **same JSON payload** to the same in-process bus:

```json
{ "patientId": 1, "ts": 1719876543210, "hr": 78, "spo2": 98, "tempC": 36.8, "source": "simulator" }
```

Swapping = changing the producer. Consumer code doesn't move.

---

## 5. Project layout

```
healthmonitor/
├── server/
│   ├── src/
│   │   ├── index.js             # Express + Socket.IO bootstrap
│   │   ├── db.js                # mysql2 pool
│   │   ├── auth.js              # JWT issue/verify + middleware
│   │   ├── sockets.js           # /live namespace + room logic
│   │   ├── ingest.js            # reading → DB + threshold + alert + broadcast
│   │   ├── anomaly.js           # rolling z-score (per patient, per metric)
│   │   ├── simulator.js         # mean-revert RNG + personas
│   │   └── routes/
│   │       ├── auth.js          # /api/auth/*
│   │       ├── patients.js      # /api/patients/*
│   │       └── alerts.js        # /api/alerts/*
│   ├── migrations/001_init.sql  # schema (users, patients, sensor_readings, alerts)
│   ├── seed.js                  # demo clinician + patients
│   └── package.json
└── client/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx              # router
    │   ├── lib/{api,socket,auth}.ts
    │   ├── store/index.ts       # Zustand auth store
    │   ├── components/          # VitalTile, VitalsChart, AlertsPanel, …
    │   └── pages/               # Login, PatientList, PatientDashboard
    ├── tailwind.config.js
    ├── vite.config.ts
    └── package.json
```

---

## 6. Useful commands

| | |
|--|--|
| `npm run dev` (server) | nodemon-watched API + simulator |
| `npm run start` (server) | production mode |
| `node seed.js` | re-seed demo data (drops & reinserts patients) |
| `npm run dev` (client) | Vite dev server with HMR |
| `npm run build` (client) | production bundle to `dist/` |

---

## 7. API quick reference

```
POST   /api/auth/login              → { accessToken }
GET    /api/me                      → current user
GET    /api/patients                → list (search, page)
GET    /api/patients/:id            → single
POST   /api/patients                → create (admin)
PATCH  /api/patients/:id            → update thresholds/persona
GET    /api/patients/:id/readings   → recent readings (?limit=, ?from=)
GET    /api/patients/:id/alerts     → alerts for patient
POST   /api/alerts/:id/ack          → acknowledge
POST   /api/alerts/:id/resolve      → resolve
```

Socket.IO namespace: **`/live`** (auth via `auth.token` in handshake).

| Direction | Event | Payload |
|--|--|--|
| C → S | `subscribe:patient`   | `{ patientId }` |
| C → S | `unsubscribe:patient` | `{ patientId }` |
| S → C | `vitals`              | `{ patientId, ts, hr, spo2, tempC, anomalyScore }` |
| S → C | `alert:new`           | `{ alertId, patientId, type, severity, value, threshold, ts }` |
| S → C | `alert:update`        | `{ alertId, status, ackBy, ackAt }` |
| S → C | `patient:status`      | `{ patientId, status }` |

---

## 8. Roadmap (Phase 2+)

- ML anomaly model (Isolation Forest → ONNX → `onnxruntime-node`)
- CSV/PDF historical export
- RBAC + audit log + multi-tenant orgs
- MQTT bridge for real ESP32 ingestion
- React Native companion app

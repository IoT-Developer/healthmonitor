// seed.js — populate demo clinician + patients. Safe to re-run; clears patients.
import "dotenv/config";
import bcrypt from "bcrypt";
import { query, queryOne, pool } from "./src/db.js";

const DEFAULT_THRESHOLDS = { hrMin: 40, hrMax: 120, spo2Min: 92, tempMax: 38.5 };

const PATIENTS = [
  { mrn: "MRN-1001", name: "Aarav Sharma",   dob: "1985-04-12", sex: "M", persona: "healthy",
    baseline: { hr: 72, spo2: 98, tempC: 36.7 } },
  { mrn: "MRN-1002", name: "Priya Iyer",     dob: "1992-09-03", sex: "F", persona: "healthy",
    baseline: { hr: 68, spo2: 99, tempC: 36.6 } },
  { mrn: "MRN-1003", name: "Rohit Menon",    dob: "1971-01-22", sex: "M", persona: "at_risk",
    baseline: { hr: 84, spo2: 96, tempC: 36.9 } },
  { mrn: "MRN-1004", name: "Lakshmi Rao",    dob: "1958-07-18", sex: "F", persona: "at_risk",
    baseline: { hr: 88, spo2: 95, tempC: 37.0 } },
  { mrn: "MRN-1005", name: "Devansh Gupta",  dob: "1949-11-30", sex: "M", persona: "critical",
    baseline: { hr: 102, spo2: 93, tempC: 37.4 },
    // Tighter thresholds so this patient trips alerts more often.
    thresholds: { hrMin: 50, hrMax: 115, spo2Min: 94, tempMax: 38.0 } },
];

async function upsertClinician() {
  const email = "clinician@example.com";
  const password = "password123";
  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    console.log(`✓ Clinician already exists: ${email} (id=${existing.id})`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')`,
    [email, hash, "Demo Clinician"]
  );
  console.log("✓ Created clinician account");
  console.log(`     email:    ${email}`);
  console.log(`     password: ${password}`);
}

async function reseedPatients() {
  // Delete (cascades to readings + alerts).
  await query("DELETE FROM patients");
  for (const p of PATIENTS) {
    const thresholds = p.thresholds || DEFAULT_THRESHOLDS;
    await query(
      `INSERT INTO patients (mrn, name, dob, sex, persona, baseline, thresholds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.mrn, p.name, p.dob, p.sex, p.persona,
       JSON.stringify(p.baseline), JSON.stringify(thresholds)]
    );
  }
  console.log(`✓ Inserted ${PATIENTS.length} patients`);
}

(async () => {
  try {
    await upsertClinician();
    await reseedPatients();
    console.log("\nSeed complete. Start the server with `npm run dev`.\n");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

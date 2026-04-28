// PatientDashboard — live tiles + chart + alerts for a single patient.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Patient, Reading } from "../lib/types";
import { VitalTile } from "../components/VitalTile";
import { VitalsChart } from "../components/VitalsChart";
import { AlertsPanel } from "../components/AlertsPanel";
import { StatusBadge } from "../components/StatusBadge";

export default function PatientDashboard() {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [latest, setLatest] = useState<Reading | null>(null);

  // initial load
  useEffect(() => {
    if (!patientId) return;
    let alive = true;
    Promise.all([
      api<Patient>(`/api/patients/${patientId}`),
      api<Reading[]>(`/api/patients/${patientId}/readings?limit=200`),
    ])
      .then(([p, r]) => {
        if (!alive) return;
        setPatient(p);
        // server returns chronological asc
        setHistory(r);
        setLatest(r[r.length - 1] ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [patientId]);

  // subscribe to room + capture latest
  useEffect(() => {
    if (!patientId) return;
    const socket = getSocket();

    const subscribe = () => socket.emit("subscribe:patient", { patientId });
    if (socket.connected) subscribe();
    socket.on("connect", subscribe);

    const onVitals = (r: Reading) => {
      if (Number(r.patientId) !== patientId) return;
      setLatest(r);
    };
    socket.on("vitals", onVitals);

    return () => {
      socket.off("connect", subscribe);
      socket.off("vitals", onVitals);
      socket.emit("unsubscribe:patient", { patientId });
    };
  }, [patientId]);

  if (!patient) {
    return <div className="text-muted text-sm py-12">Loading patient…</div>;
  }

  const t = patient.thresholds;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-muted hover:text-accent transition">
            ← All patients
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-display text-3xl font-bold tracking-tight">{patient.name}</h1>
            <StatusBadge status={patient.status} />
          </div>
          <div className="text-xs text-muted font-mono mt-1">
            MRN {patient.mrn} · {patient.sex || "—"}
            {patient.dob ? ` · ${new Date(patient.dob).toLocaleDateString()}` : ""}
            {" · persona "}{patient.persona.replace("_", " ")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Thresholds</div>
          <div className="font-mono text-xs text-muted mt-1">
            HR {t.hrMin}–{t.hrMax} · SpO₂ ≥{t.spo2Min} · Temp ≤{t.tempMax}°C
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <VitalTile
          patientId={patientId}
          metric="hr"
          label="Heart rate"
          unit="bpm"
          warnRange={[t.hrMin, t.hrMax]}
          initial={latest}
        />
        <VitalTile
          patientId={patientId}
          metric="spo2"
          label="SpO₂"
          unit="%"
          warnRange={[t.spo2Min, null]}
          initial={latest}
        />
        <VitalTile
          patientId={patientId}
          metric="tempC"
          label="Body temp"
          unit="°C"
          warnRange={[null, t.tempMax]}
          initial={latest}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <VitalsChart patientId={patientId} initial={history} />
        <AlertsPanel patientId={patientId} />
      </div>
    </div>
  );
}

// PatientList — searchable patient cards with live status updates.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Patient, PatientStatus } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";
import { AlertsPanel } from "../components/AlertsPanel";

export default function PatientList() {
  const [items, setItems] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = search ? `?search=${encodeURIComponent(search)}` : "";
        const data = await api<{ items: Patient[] }>(`/api/patients${q}`);
        if (alive) setItems(data.items);
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  useEffect(() => {
    const socket = getSocket();
    const onStatus = ({ patientId, status }: { patientId: number; status: PatientStatus }) => {
      setItems((prev) =>
        prev.map((p) => (Number(p.id) === Number(patientId) ? { ...p, status } : p))
      );
    };

    socket.on("patient:status", onStatus);
    return () => {
      socket.off("patient:status", onStatus);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-6">
      <section>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Patients</h1>
            <p className="text-sm text-muted">Real-time status across the ward</p>
          </div>

          <input
            type="search"
            placeholder="Search patient or MRN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-panel/70 border border-border rounded-xl px-4 py-2.5 text-sm w-full md:w-72 focus:outline-none focus:border-accent/60"
          />
        </div>

        {loading && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-panel/50 px-5 py-10 text-sm text-muted">
            Loading patients…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-panel/50 px-5 py-10 text-sm text-muted">
            No patients found. Run <code className="font-mono text-text">node seed.js</code> on the server.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <Link
              key={p.id}
              to={`/patients/${p.id}`}
              className="group rounded-2xl border border-border bg-panel/60 p-4 shadow-glow hover:border-accent/50 hover:bg-panel/80 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold truncate">{p.name}</h2>
                  <p className="text-xs text-muted mt-1">
                    {p.sex || "—"}{p.dob ? ` · ${new Date(p.dob).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <Info label="MRN" value={p.mrn} mono />
                <Info label="Persona" value={p.persona.replace("_", " ")} />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span>View patient dashboard</span>
                <span className="text-accent group-hover:translate-x-1 transition">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <aside className="xl:sticky xl:top-6 self-start">
        <AlertsPanel />
      </aside>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-bg/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={mono ? "font-mono text-text mt-1" : "capitalize text-text mt-1"}>{value}</div>
    </div>
  );
}

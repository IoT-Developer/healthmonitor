// AlertsPanel — compact live alerts list with ack / resolve actions.
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Alert } from "../lib/types";

const TYPE_LABEL: Record<Alert["type"], string> = {
  hr_high: "HR High",
  hr_low: "HR Low",
  spo2_low: "SpO₂ Low",
  fever: "Fever",
  anomaly: "Anomaly",
};

type Props = { patientId?: number };

export function AlertsPanel({ patientId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let alive = true;
    const path = patientId
      ? `/api/patients/${patientId}/alerts?status=open`
      : `/api/alerts?status=open`;

    api<Alert[]>(path)
      .then((data) => {
        if (alive) setAlerts(data.slice(0, 20));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [patientId]);

  useEffect(() => {
    const socket = getSocket();

    const onNew = (a: Alert) => {
      if (patientId && Number(a.patientId) !== patientId) return;
      setAlerts((prev) => [a, ...prev].slice(0, 20));
    };

    const onUpdate = (a: Partial<Alert> & { id: number; status: Alert["status"] }) => {
      setAlerts((prev) =>
        a.status === "open" ? prev : prev.filter((x) => x.id !== a.id)
      );
    };

    socket.on("alert:new", onNew);
    socket.on("alert:update", onUpdate);

    return () => {
      socket.off("alert:new", onNew);
      socket.off("alert:update", onUpdate);
    };
  }, [patientId]);

  async function ack(id: number) {
    try {
      await api(`/api/alerts/${id}/ack`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {}
  }

  async function resolve(id: number) {
    try {
      await api(`/api/alerts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-border bg-panel/70 p-4 shadow-glow h-fit">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">Active alerts</h3>
          <p className="text-xs text-muted">Latest 20 alerts only</p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted font-mono">
          {alerts.length} open
        </span>
      </div>

      {alerts.length === 0 && (
        <div className="text-sm text-muted py-8 text-center">
          No active alerts. All vitals are normal.
        </div>
      )}

      <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={clsx(
              "rounded-xl border p-3",
              a.severity === "critical" && "border-critical/40 bg-critical/5",
              a.severity === "warning" && "border-warn/30 bg-warn/5",
              a.severity === "info" && "border-border bg-bg/30"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      "w-2 h-2 rounded-full",
                      a.severity === "critical"
                        ? "bg-critical animate-pulseDot"
                        : a.severity === "warning"
                        ? "bg-warn"
                        : "bg-accent"
                    )}
                  />
                  <span className="font-medium text-sm">{TYPE_LABEL[a.type]}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    {a.severity}
                  </span>
                </div>

                {a.patientName && !patientId && (
                  <div className="text-xs text-muted mt-1 truncate">
                    Patient: {a.patientName}
                  </div>
                )}

                <div className="text-xs text-muted font-mono mt-1">
                  {a.value} / limit {a.threshold} · {new Date(Number(a.triggeredAt) || (a.triggeredAt as any)).toLocaleTimeString()}
                </div>
              </div>

              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => ack(a.id)}
                  className="text-[11px] px-2 py-1 rounded-md border border-border text-muted hover:text-text hover:border-accent/40 transition"
                >
                  Ack
                </button>
                <button
                  onClick={() => resolve(a.id)}
                  className="text-[11px] px-2 py-1 rounded-md border border-ok/40 text-ok hover:bg-ok/10 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// VitalTile — single metric tile. Subscribes to live vitals, fades when stale.
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { getSocket } from "../lib/socket";
import type { Reading } from "../lib/types";

type MetricKey = "hr" | "spo2" | "tempC";

type Props = {
  patientId: number;
  metric: MetricKey;
  label: string;
  unit: string;
  /** [warnMin, warnMax] for color coding. Anything outside warns; null disables. */
  warnRange?: [number | null, number | null];
  initial?: Reading | null;
};

const STALE_AFTER_MS = 8000;

export function VitalTile({ patientId, metric, label, unit, warnRange, initial }: Props) {
  const [reading, setReading] = useState<Reading | null>(initial ?? null);
  const [stale, setStale] = useState(false);
  const lastTsRef = useRef<number>(initial ? Number(initial.ts) : 0);

  // Subscribe to live updates
  useEffect(() => {
    const socket = getSocket();
    const onVitals = (r: Reading) => {
      if (Number(r.patientId) !== patientId) return;
      lastTsRef.current = Number(r.ts);
      setReading(r);
      setStale(false);
    };
    socket.on("vitals", onVitals);
    return () => { socket.off("vitals", onVitals); };
  }, [patientId]);

  // Stale detector
  useEffect(() => {
    const id = setInterval(() => {
      if (!lastTsRef.current) return;
      setStale(Date.now() - lastTsRef.current > STALE_AFTER_MS);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const value = reading ? formatValue(metric, reading) : "—";

  const inWarn = (() => {
    if (!reading || !warnRange) return false;
    const v = readMetric(reading, metric);
    const [lo, hi] = warnRange;
    return (lo != null && v < lo) || (hi != null && v > hi);
  })();

  return (
    <div
      className={clsx(
        "relative rounded-2xl border border-border bg-panel/60 backdrop-blur p-5",
        "shadow-glow transition-opacity",
        stale && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted font-medium">
          {label}
        </span>
        <span
          className={clsx(
            "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
            inWarn ? "bg-critical/20 text-critical" : "bg-ok/15 text-ok"
          )}
        >
          {inWarn ? "Out of range" : "In range"}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={clsx("font-display text-5xl font-bold tabular-nums",
          inWarn ? "text-critical" : "text-text")}>
          {value}
        </span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
      <div className="mt-2 text-[11px] text-muted font-mono">
        {reading
          ? new Date(Number(reading.ts)).toLocaleTimeString()
          : "Awaiting first reading…"}
      </div>
      {stale && (
        <div className="absolute top-3 right-3 text-[10px] text-warn uppercase tracking-wider">
          Stale
        </div>
      )}
    </div>
  );
}

function readMetric(r: Reading, m: MetricKey): number {
  if (m === "hr") return r.hr;
  if (m === "spo2") return r.spo2;
  return Number(r.tempC);
}

function formatValue(m: MetricKey, r: Reading): string {
  if (m === "hr") return String(r.hr);
  if (m === "spo2") return String(r.spo2);
  return Number(r.tempC).toFixed(1);
}

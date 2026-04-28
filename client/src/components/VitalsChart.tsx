// VitalsChart — last-N-readings line chart for HR / SpO₂ / Temp.
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getSocket } from "../lib/socket";
import type { Reading } from "../lib/types";

type Props = {
  patientId: number;
  initial: Reading[];
  /** Hold this many recent samples in memory. Default 200 (≈10 min @ 3s tick). */
  window?: number;
};

export function VitalsChart({ patientId, initial, window = 200 }: Props) {
  const [data, setData] = useState<Reading[]>(initial);

  useEffect(() => { setData(initial); }, [initial]);

  useEffect(() => {
    const socket = getSocket();
    const onVitals = (r: Reading) => {
      if (Number(r.patientId) !== patientId) return;
      setData((prev) => {
        const next = [...prev, r];
        return next.length > window ? next.slice(-window) : next;
      });
    };
    socket.on("vitals", onVitals);
    return () => { socket.off("vitals", onVitals); };
  }, [patientId, window]);

  const formatted = data.map((r) => ({
    t: new Date(Number(r.ts)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    hr: r.hr,
    spo2: r.spo2,
    tempC: Number(r.tempC),
  }));

  return (
    <div className="rounded-2xl border border-border bg-panel/60 p-5 shadow-glow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">Trend (last {data.length} readings)</h3>
        <div className="flex gap-3 text-[11px] text-muted">
          <Legend2 color="#7dd3fc" label="HR (bpm)" />
          <Legend2 color="#34d399" label="SpO₂ (%)" />
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 5, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#22304f" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="#7d8aa6" fontSize={11} minTickGap={32} />
            <YAxis yAxisId="left"  stroke="#7dd3fc" fontSize={11} domain={[30, 160]} />
            <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={11} domain={[80, 100]} />
            <Tooltip
              contentStyle={{ background: "#152038", border: "1px solid #22304f", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "#7d8aa6" }}
            />
            <Line yAxisId="left"  type="monotone" dataKey="hr"    stroke="#7dd3fc" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="spo2"  stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[11px] text-muted mt-2">
        Body temperature is shown on the tile above (different scale).
      </div>
    </div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-3 h-0.5" style={{ background: color }} />
      {label}
    </span>
  );
}

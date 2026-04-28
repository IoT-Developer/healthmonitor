// lib/types.ts
export type PatientStatus = "stable" | "warning" | "critical";

export type Patient = {
  id: number;
  mrn: string;
  name: string;
  dob: string | null;
  sex: "M" | "F" | "O" | null;
  persona: "healthy" | "at_risk" | "critical";
  baseline: { hr: number; spo2: number; tempC: number };
  thresholds: { hrMin: number; hrMax: number; spo2Min: number; tempMax: number };
  status: PatientStatus;
};

export type Reading = {
  id?: number;
  patientId: number;
  ts: number | string;
  hr: number;
  spo2: number;
  tempC: number;
  anomalyScore?: number;
};

export type Alert = {
  id: number;
  patientId: number;
  patientName?: string;
  type: "hr_high" | "hr_low" | "spo2_low" | "fever" | "anomaly";
  severity: "info" | "warning" | "critical";
  triggeredAt: string | number;
  value: number;
  threshold: number;
  status: "open" | "ack" | "resolved";
  ackBy?: number | null;
  ackAt?: string | null;
  note?: string | null;
};

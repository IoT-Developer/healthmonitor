import clsx from "clsx";
import type { PatientStatus } from "../lib/types";

const ICON: Record<PatientStatus, string> = {
  stable: "●",
  warning: "▲",
  critical: "■",
};

const LABEL: Record<PatientStatus, string> = {
  stable: "Stable",
  warning: "Warning",
  critical: "Critical",
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
        status === "stable" &&
          "bg-ok/10 text-ok border-ok/30",
        status === "warning" &&
          "bg-warn/10 text-warn border-warn/40",
        status === "critical" &&
          "bg-critical/10 text-critical border-critical/40 animate-pulseDot"
      )}
    >
      <span aria-hidden className="text-[10px] leading-none">{ICON[status]}</span>
      <span>{LABEL[status]}</span>
    </span>
  );
}

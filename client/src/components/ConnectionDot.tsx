import { useEffect, useState } from "react";
import clsx from "clsx";
import { getSocket } from "../lib/socket";

type State = "connecting" | "live" | "reconnecting" | "offline";

export function ConnectionDot() {
  const [state, setState] = useState<State>("connecting");

  useEffect(() => {
    const s = getSocket();
    const onConnect    = () => setState("live");
    const onDisconnect = () => setState("reconnecting");
    const onError      = () => setState("offline");

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    if (s.connected) setState("live");

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
    };
  }, []);

  const color =
    state === "live"          ? "bg-ok"       :
    state === "reconnecting"  ? "bg-warn"     :
    state === "offline"       ? "bg-critical" :
                                "bg-muted";

  const label =
    state === "live"          ? "Live" :
    state === "reconnecting"  ? "Reconnecting…" :
    state === "offline"       ? "Offline" :
                                "Connecting…";

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={clsx("w-2 h-2 rounded-full", color, state === "live" && "animate-pulseDot")} />
      <span>{label}</span>
    </div>
  );
}

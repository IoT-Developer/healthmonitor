import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store";

export default function Login() {
  const [email, setEmail] = useState("clinician@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const resp = await api<{ accessToken: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(resp.accessToken, resp.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message === "invalid_credentials" ? "Invalid email or password." : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 py-8 overflow-hidden">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2 rounded-full border border-border bg-panel/50 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulseDot" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted">AIoT Live Vitals</span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight">
            Health<span className="text-accent">Monitor</span>
          </h1>
          <p className="text-muted text-sm mt-2">Secure clinician dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-panel/70 backdrop-blur p-6 space-y-4 shadow-glow"
        >
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <div className="text-sm text-critical bg-critical/10 border border-critical/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-ink font-semibold rounded-lg py-2.5 hover:brightness-110 transition disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgba(11,18,32,.6);
          border: 1px solid #22304f;
          border-radius: 10px;
          padding: 10px 12px;
          color: #e6ecf6;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 14px;
          outline: none;
        }
        .input:focus {
          border-color: #7dd3fc;
          box-shadow: 0 0 0 3px rgba(125,211,252,.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

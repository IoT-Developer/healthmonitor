// AppShell — top bar + main content. Shared chrome for authenticated routes.
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import { ConnectionDot } from "./ConnectionDot";
import { disconnectSocket } from "../lib/socket";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    disconnectSocket();
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight">
                <span className="text-accent">·</span> Health<span className="text-accent">Monitor</span>
              </span>
            </Link>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted ml-2 hidden sm:block">
              AIoT · Live Vitals
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionDot />
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted hidden sm:block">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-text hover:border-accent/40 transition"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
    </div>
  );
}

// lib/api.ts — thin fetch wrapper that injects the access token.
import { useAuth } from "../store";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = useAuth.getState().accessToken;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    useAuth.getState().logout();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {}
    throw new Error(detail?.error || `http_${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const API_BASE = BASE;

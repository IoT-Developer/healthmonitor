// lib/socket.ts — singleton Socket.IO client to /live namespace.
import { io, Socket } from "socket.io-client";
import { API_BASE } from "./api";
import { useAuth } from "../store";

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = useAuth.getState().accessToken;
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(`${API_BASE}/live`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

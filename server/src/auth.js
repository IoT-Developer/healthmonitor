// auth.js — JWT issue/verify + Express + Socket.IO middleware.
import jwt from "jsonwebtoken";
import "dotenv/config";

const ACCESS_SECRET  = process.env.JWT_SECRET         || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const ACCESS_TTL     = process.env.JWT_ACCESS_TTL     || "15m";
const REFRESH_TTL    = process.env.JWT_REFRESH_TTL    || "7d";

export function signAccess(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function signRefresh(user) {
  return jwt.sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// ----- Express middleware -----
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_token" });
  }
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

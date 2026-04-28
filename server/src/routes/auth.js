// routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { queryOne } from "../db.js";
import { signAccess, signRefresh, verifyRefresh, requireAuth } from "../auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload" });

  const { email, password } = parsed.data;
  const user = await queryOne(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
    [email]
  );
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const accessToken  = signAccess(user);
  const refreshToken = signRefresh(user);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: "missing_refresh" });

  try {
    const payload = verifyRefresh(token);
    const user = await queryOne(
      "SELECT id, email, name, role FROM users WHERE id = ?",
      [payload.sub]
    );
    if (!user) return res.status(401).json({ error: "user_not_found" });
    return res.json({ accessToken: signAccess(user) });
  } catch {
    return res.status(401).json({ error: "invalid_refresh" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("refresh_token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.sub,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
  });
});

export default router;

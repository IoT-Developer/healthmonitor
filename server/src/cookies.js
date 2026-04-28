// cookies.js — minimal cookie parser so we don't pull in cookie-parser.
export function cookieParser(req, _res, next) {
  const header = req.headers.cookie;
  req.cookies = {};
  if (!header) return next();
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) req.cookies[k] = v;
  }
  next();
}

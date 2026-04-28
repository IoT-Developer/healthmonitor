// db.js — single mysql2 pool, parameterised queries everywhere.
import mysql from "mysql2/promise";
import "dotenv/config";

if (!process.env.MYSQL_URL) {
  throw new Error("MYSQL_URL is not set. Copy .env.example to .env and configure it.");
}

export const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // mysql2 returns DECIMAL as string by default; cast to Number on read so the
  // JSON we ship over the wire is numeric. We still write through prepared
  // statements, so there's no injection risk in this setting.
  decimalNumbers: true,
  // JSON columns: mysql2 already auto-parses on read.
  dateStrings: false,
  timezone: "Z",
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

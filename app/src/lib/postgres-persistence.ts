import { Pool } from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

let pool: Pool | undefined;
function database() {
  if (pool) return pool;
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) throw new Error("SUPABASE_DATABASE_URL não configurada.");
  const url = new URL(connectionString);
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error("A URL do banco deve ser PostgreSQL.");
  if (url.searchParams.has("sslmode") || url.searchParams.has("sslrootcert")) throw new Error("Remova parâmetros SSL da URL; o aplicativo exige TLS com verificação de certificado.");
  const caFile = process.env.SUPABASE_DB_CA_FILE;
  const caBase64 = process.env.SUPABASE_DB_CA_BASE64;
  const ca = caBase64 ? Buffer.from(caBase64, "base64").toString("utf8") : caFile ? readFileSync(path.resolve(caFile), "utf8") : undefined;
  if (caBase64 && !ca?.includes("BEGIN CERTIFICATE")) throw new Error("SUPABASE_DB_CA_BASE64 inválida.");
  pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000, allowExitOnIdle: true, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  return pool;
}

type DocumentRow = { value: unknown; version: string };
export async function readPostgresDocument<T>(key: string, fallback: () => T): Promise<{ value: T; version: number }> {
  const result = await database().query<DocumentRow>("SELECT value, version FROM fisioapp.documents WHERE key = $1", [key]);
  const row = result.rows[0];
  return row ? { value: row.value as T, version: Number(row.version) } : { value: fallback(), version: -1 };
}

export async function writePostgresDocument<T>(key: string, version: number, value: T): Promise<boolean> {
  if (version === -1) {
    const result = await database().query("INSERT INTO fisioapp.documents (key, value, version) VALUES ($1, $2::jsonb, 0) ON CONFLICT DO NOTHING", [key, JSON.stringify(value)]);
    return result.rowCount === 1;
  }
  const result = await database().query("UPDATE fisioapp.documents SET value = $1::jsonb, version = version + 1, updated_at = now() WHERE key = $2 AND version = $3", [JSON.stringify(value), key, version]);
  return result.rowCount === 1;
}

const loginKey = (email: string) => createHash("sha256").update(email).digest("hex");
export async function postgresLoginBlocked(email: string) {
  const result = await database().query<{ failures: number; window_start: string }>("SELECT failures, window_start FROM fisioapp.login_attempts WHERE key = $1", [loginKey(email)]);
  const row = result.rows[0];
  return !!row && row.failures >= 10 && Date.now() - Number(row.window_start) < 15 * 60_000;
}
export async function postgresRecordLoginFailure(email: string) {
  const now = Date.now();
  await database().query("INSERT INTO fisioapp.login_attempts (key, failures, window_start) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET failures = CASE WHEN $2 - fisioapp.login_attempts.window_start >= 900000 THEN 1 ELSE fisioapp.login_attempts.failures + 1 END, window_start = CASE WHEN $2 - fisioapp.login_attempts.window_start >= 900000 THEN $2 ELSE fisioapp.login_attempts.window_start END", [loginKey(email), now]);
}
export async function postgresClearLoginFailures(email: string) {
  await database().query("DELETE FROM fisioapp.login_attempts WHERE key = $1", [loginKey(email)]);
}

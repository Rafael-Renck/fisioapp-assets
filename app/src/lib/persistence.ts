import Database from "better-sqlite3";
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { postgresClearLoginFailures, postgresLoginBlocked, postgresRecordLoginFailure, readPostgresDocument, writePostgresDocument } from "./postgres-persistence";

const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
const databaseFile = path.join(dataDir, "fisioapp.sqlite");
let connection: Database.Database | undefined;

function db() {
  if (connection) return connection;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  connection = new Database(databaseFile);
  chmodSync(databaseFile, 0o600);
  connection.pragma("journal_mode = WAL");
  connection.pragma("busy_timeout = 5000");
  connection.exec("CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)");
  connection.exec("CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL)");
  const insert = connection.prepare("INSERT OR IGNORE INTO documents (key, value, version, updated_at) VALUES (?, ?, 0, ?)");
  const migrate = (key: string, file: string) => {
    if (!existsSync(file)) return;
    const saved = readFileSync(file, "utf8");
    JSON.parse(saved);
    insert.run(key, saved, new Date().toISOString());
  };
  connection.transaction(() => {
    migrate("platform", path.join(dataDir, "platform.json"));
    migrate("space:legacy", path.join(dataDir, "fisioapp.json"));
    const folder = path.join(dataDir, "spaces");
    if (existsSync(folder)) for (const name of readdirSync(folder)) {
      if (/^[a-f0-9]{32}\.json$/.test(name)) migrate(`space:${name.slice(0, -5)}`, path.join(folder, name));
    }
  })();
  return connection;
}

type Row = { value: string; version: number };

export async function readDocument<T>(key: string, legacyFile: string, fallback: () => T): Promise<{ value: T; version: number }> {
  if (process.env.SUPABASE_DATABASE_URL) return readPostgresDocument(key, fallback);
  const database = db();
  let row = database.prepare("SELECT value, version FROM documents WHERE key = ?").get(key) as Row | undefined;
  if (!row && existsSync(legacyFile)) {
    // Keep the source file untouched so migration can be checked or reversed.
    const saved = readFileSync(legacyFile, "utf8");
    JSON.parse(saved);
    database.prepare("INSERT OR IGNORE INTO documents (key, value, version, updated_at) VALUES (?, ?, 0, ?)")
      .run(key, saved, new Date().toISOString());
    row = database.prepare("SELECT value, version FROM documents WHERE key = ?").get(key) as Row;
  }
  return row ? { value: JSON.parse(row.value) as T, version: row.version } : { value: fallback(), version: -1 };
}

export async function writeDocument<T>(key: string, version: number, value: T): Promise<boolean> {
  if (process.env.SUPABASE_DATABASE_URL) return writePostgresDocument(key, version, value);
  const database = db();
  const serialized = JSON.stringify(value);
  const now = new Date().toISOString();
  if (version === -1) {
    return database.prepare("INSERT OR IGNORE INTO documents (key, value, version, updated_at) VALUES (?, ?, 0, ?)")
      .run(key, serialized, now).changes === 1;
  }
  return database.prepare("UPDATE documents SET value = ?, version = version + 1, updated_at = ? WHERE key = ? AND version = ?")
    .run(serialized, now, key, version).changes === 1;
}

export function databasePath() { return databaseFile; }
export function backupDatabase(destination: string) { return db().backup(destination); }

function loginKey(email: string) { return createHash("sha256").update(email).digest("hex"); }
export async function loginBlocked(email: string) {
  if (process.env.SUPABASE_DATABASE_URL) return postgresLoginBlocked(email);
  const row = db().prepare("SELECT failures, window_start FROM login_attempts WHERE key = ?").get(loginKey(email)) as { failures: number; window_start: number } | undefined;
  return !!row && row.failures >= 10 && Date.now() - row.window_start < 15 * 60_000;
}
export async function recordLoginFailure(email: string) {
  if (process.env.SUPABASE_DATABASE_URL) return postgresRecordLoginFailure(email);
  const key = loginKey(email);
  const now = Date.now();
  db().prepare("INSERT INTO login_attempts (key, failures, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET failures = CASE WHEN ? - window_start >= 900000 THEN 1 ELSE failures + 1 END, window_start = CASE WHEN ? - window_start >= 900000 THEN ? ELSE window_start END")
    .run(key, now, now, now, now);
}
export async function clearLoginFailures(email: string) {
  if (process.env.SUPABASE_DATABASE_URL) return postgresClearLoginFailures(email);
  db().prepare("DELETE FROM login_attempts WHERE key = ?").run(loginKey(email));
}

export async function ensureDailyBackup() {
  if (process.env.SUPABASE_DATABASE_URL) return;
  const folder = path.join(dataDir, "backups");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const today = new Date().toISOString().slice(0, 10);
  const destination = path.join(folder, `fisioapp-${today}.sqlite`);
  if (existsSync(destination)) return;
  const lock = `${destination}.lock`;
  let descriptor: number;
  try { descriptor = openSync(lock, "wx", 0o600); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return; throw error; }
  try {
    if (!existsSync(destination)) {
      await db().backup(destination);
      chmodSync(destination, 0o600);
    }
    const old = readdirSync(folder).filter(name => /^fisioapp-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort().slice(0, -14);
    for (const name of old) unlinkSync(path.join(folder, name));
  } finally {
    closeSync(descriptor);
    unlinkSync(lock);
  }
}

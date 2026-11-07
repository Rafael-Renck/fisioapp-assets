import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, readFileSync, chmodSync } from "node:fs";
import path from "node:path";

if (process.env.SUPABASE_DATABASE_URL) throw new Error("Este comando copia somente o SQLite local. Consulte os backups do projeto Supabase para o PostgreSQL.");

const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
const source = path.join(dataDir, "fisioapp.sqlite");
const backupsDir = path.join(dataDir, "backups");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
const db = new Database(source);
chmodSync(source, 0o600);
db.pragma("journal_mode = WAL");
db.exec("CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)");
const insert = db.prepare("INSERT OR IGNORE INTO documents (key, value, version, updated_at) VALUES (?, ?, 0, ?)");
function importFile(key, file) {
  if (!existsSync(file)) return;
  const contents = readFileSync(file, "utf8");
  JSON.parse(contents);
  insert.run(key, contents, new Date().toISOString());
}
db.transaction(() => {
  importFile("platform", path.join(dataDir, "platform.json"));
  importFile("space:legacy", path.join(dataDir, "fisioapp.json"));
  const spacesDir = path.join(dataDir, "spaces");
  if (existsSync(spacesDir)) for (const name of readdirSync(spacesDir)) {
    if (/^[a-f0-9]{32}\.json$/.test(name)) importFile(`space:${name.slice(0, -5)}`, path.join(spacesDir, name));
  }
})();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupsDir, `fisioapp-${stamp}.sqlite`);
await db.backup(destination);
chmodSync(destination, 0o600);
const check = new Database(destination, { readonly: true });
const result = check.pragma("integrity_check", { simple: true });
const count = check.prepare("SELECT count(*) AS count FROM documents").get().count;
check.close();
db.close();
if (result !== "ok") throw new Error("Falha na verificação da cópia.");
console.log(`Backup verificado: ${destination} (${count} documentos)`);

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) throw new Error("Configure SUPABASE_DATABASE_URL no ambiente do servidor antes da migração.");
const url = new URL(connectionString);
if (!/^postgres(ql)?:$/.test(url.protocol) || url.searchParams.has("sslmode") || url.searchParams.has("sslrootcert")) throw new Error("Use uma URL PostgreSQL sem parâmetros SSL; o aplicativo verifica o certificado TLS.");
const dataDir = process.env.FISIOAPP_DATA_DIR || path.join(process.cwd(), ".data");
const source = path.join(dataDir, "fisioapp.sqlite");
const documents = new Map();
if (existsSync(source)) {
  const sqlite = new Database(source, { readonly: true, fileMustExist: true });
  for (const row of sqlite.prepare("SELECT key, value, version FROM documents").all()) documents.set(row.key, { value: JSON.parse(row.value), version: row.version });
  sqlite.close();
}
function legacy(key, file) {
  if (documents.has(key) || !existsSync(file)) return;
  documents.set(key, { value: JSON.parse(readFileSync(file, "utf8")), version: 0 });
}
legacy("platform", path.join(dataDir, "platform.json"));
legacy("space:legacy", path.join(dataDir, "fisioapp.json"));
const spacesDir = path.join(dataDir, "spaces");
if (existsSync(spacesDir)) for (const name of readdirSync(spacesDir)) {
  if (/^[a-f0-9]{32}\.json$/.test(name)) legacy(`space:${name.slice(0, -5)}`, path.join(spacesDir, name));
}
if (!documents.size) throw new Error("Nenhum documento local encontrado. A migração foi interrompida.");
const caFile = process.env.SUPABASE_DB_CA_FILE;
const ca = caFile ? readFileSync(path.resolve(caFile), "utf8") : undefined;
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(readFileSync(new URL("./supabase-schema.sql", import.meta.url), "utf8"));
  const existing = await client.query("SELECT key, value, version FROM fisioapp.documents");
  for (const row of existing.rows) {
    const local = documents.get(row.key);
    if (!local) throw new Error(`O destino contém dados desconhecidos (${row.key}); migração interrompida.`);
    assert.deepStrictEqual(row.value, local.value, `O documento ${row.key} difere do destino.`);
    if (Number(row.version) !== local.version) throw new Error(`A versão do documento ${row.key} difere do destino.`);
  }
  for (const [key, document] of documents) {
    await client.query("INSERT INTO fisioapp.documents (key, value, version) VALUES ($1, $2::jsonb, $3) ON CONFLICT (key) DO NOTHING", [key, JSON.stringify(document.value), document.version]);
  }
  const count = await client.query("SELECT count(*)::integer AS count FROM fisioapp.documents");
  if (count.rows[0].count !== documents.size) throw new Error("A quantidade importada não corresponde à origem.");
  await client.query("COMMIT");
  console.log(`Migração concluída e conferida: ${documents.size} documento(s).`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { initialFestival, proposedSegments } from "../catalog";
import type { Application, Audit } from "../types";
const globalDb = globalThis as unknown as { semcDb?: DatabaseSync };
export function db() {
  if (globalDb.semcDb) return globalDb.semcDb;
  mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
  const d = new DatabaseSync(
    path.join(process.cwd(), ".data", "demonstration.sqlite"),
  );
  d.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS documents(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,reference TEXT UNIQUE,token_hash TEXT NOT NULL,idempotency_key TEXT UNIQUE,request_hash TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(transaction_id TEXT PRIMARY KEY,application_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,application_id TEXT,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS secrets(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  globalDb.semcDb = d;
  if (!d.prepare("SELECT id FROM documents WHERE kind='festival'").get()) {
    d.prepare("INSERT INTO documents VALUES(?,?,?)").run(
      "festival",
      "2026",
      JSON.stringify(initialFestival),
    );
    for (const s of proposedSegments)
      d.prepare("INSERT INTO documents VALUES(?,?,?)").run(
        "segment",
        s.id,
        JSON.stringify(s),
      );

  }
  return d;
}
export function readDoc<T>(kind: string, id: string): T | null {
  const r = db()
    .prepare("SELECT data FROM documents WHERE kind=? AND id=?")
    .get(kind, id) as { data: string } | undefined;
  return r ? JSON.parse(r.data) : null;
}
export function docs<T>(kind: string): T[] {
  return (
    db()
      .prepare("SELECT data FROM documents WHERE kind=? ORDER BY rowid")
      .all(kind) as { data: string }[]
  ).map((r) => JSON.parse(r.data));
}
export function saveDoc(kind: string, id: string, data: unknown) {
  db()
    .prepare(
      "INSERT INTO documents VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
    )
    .run(kind, id, JSON.stringify(data));
}
export function transaction<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    d.exec("COMMIT");
    return value;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
export function audit(
  actor: string,
  action: string,
  applicationId: string | null,
  before: unknown,
  after: unknown,
) {
  const row: Audit = {
    id: randomUUID(),
    actor,
    action,
    applicationId,
    before,
    after,
    at: new Date().toISOString(),
  };
  db()
    .prepare("INSERT INTO audit VALUES(?,?,?)")
    .run(row.id, applicationId, JSON.stringify(row));
}

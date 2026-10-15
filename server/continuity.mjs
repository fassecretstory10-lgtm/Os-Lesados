// Continuidade seletiva (Fase 6): notas curtas e explícitas, nada automático.
// Só entra aqui o que o autor registar. A Sala lê as ativas; episódios não
// escrevem aqui sozinhos. Ficheiro versionado como o resto do contexto.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "context", "continuity.json");

function readAll() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (Array.isArray(d.notes)) return d;
  } catch {}
  return { notes: [] };
}

function writeAll(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

export function listNotes(status) {
  const { notes } = readAll();
  return status ? notes.filter((n) => n.status === status) : notes;
}

export function addNote({ text, episode, kind }) {
  const clean = String(text || "").trim().slice(0, 280);
  if (!clean) {
    const err = new Error("Nota vazia.");
    err.httpStatus = 400;
    throw err;
  }
  const d = readAll();
  const note = {
    id: `n${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    episode: String(episode || ""),
    kind: ["gancho", "rivalidade", "promessa", "piada"].includes(kind) ? kind : "gancho",
    status: "active",
    text: clean,
  };
  d.notes.push(note);
  writeAll(d);
  return note;
}

export function resolveNote(id) {
  const d = readAll();
  const n = d.notes.find((x) => x.id === id);
  if (!n) {
    const err = new Error("Nota inexistente.");
    err.httpStatus = 404;
    throw err;
  }
  n.status = "resolved";
  writeAll(d);
  return n;
}

// Texto compacto para injetar nos prompts (só notas ativas, máx 5).
export function continuityBrief() {
  const act = listNotes("active").slice(-5);
  if (!act.length) return "";
  return "CONTINUIDADE ATIVA (respeitar, não contradizer):\n" +
    act.map((n) => `- [${n.kind}] ${n.text}`).join("\n");
}

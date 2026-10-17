#!/usr/bin/env node
// OS LESADOS — regenera o snapshot embebido REPO_EPISODES no index.html.
//
// O index.html guarda uma cópia do arquivo (guiões + decupagens) para continuar
// a funcionar quando é aberto diretamente (file://), sem backend. Essa cópia é
// uma cache: se ficar desatualizada, os guiões revistos (ex.: Episódio 1) não
// aparecem no Arquivo. Este script mantém-na em sincronia com o manifesto.
//
// Uso: node scripts/embed-archive.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "Temporadas", "Temporada-1", "manifest.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

const episodes = (manifest.episodes || []).map((episode) => {
  const relative = String(episode.path || "");
  if (!relative.startsWith("Temporadas/Temporada-1/") || !relative.endsWith(".md")) {
    throw new Error("Caminho de episódio inválido no manifest: " + relative);
  }
  const content = fs.readFileSync(path.join(ROOT, relative), "utf8");

  let decoupageContent = null;
  const decoupagePath = String(episode.decoupagePath || "");
  if (decoupagePath) {
    if (!decoupagePath.startsWith("docs/episodios/") || !decoupagePath.endsWith(".md") || decoupagePath.includes("..")) {
      throw new Error("Caminho de decupagem inválido no manifest: " + decoupagePath);
    }
    const absolute = path.join(ROOT, decoupagePath);
    if (fs.existsSync(absolute)) decoupageContent = fs.readFileSync(absolute, "utf8");
  }

  return { ...episode, content, decoupageContent };
});

// Escapa "</" para nunca fechar o <script> onde o snapshot vive.
const serialized = JSON.stringify(episodes).replace(/<\//g, "<\\/");

const html = fs.readFileSync(INDEX_PATH, "utf8");
const pattern = /^([ \t]*let REPO_EPISODES = )\[[^\n]*\];$/m;
if (!pattern.test(html)) {
  throw new Error("Não encontrei o snapshot REPO_EPISODES no index.html.");
}

const next = html.replace(pattern, (_match, prefix) => prefix + serialized + ";");

if (next === html) {
  console.log(`Snapshot REPO_EPISODES já sincronizado (${episodes.length} episódios).`);
} else {
  fs.writeFileSync(INDEX_PATH, next);
  console.log(`Snapshot REPO_EPISODES atualizado: ${episodes.length} episódios (${serialized.length} bytes).`);
}

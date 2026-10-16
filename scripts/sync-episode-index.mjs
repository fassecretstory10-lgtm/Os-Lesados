#!/usr/bin/env node
/**
 * Sincroniza fichas e decupagens completas com o índice da Temporada 1.
 *
 * Um documento só fica disponível como decupagem concluída quando:
 * 1. contém o marcador COMPLETE;
 * 2. contém pelo menos três cenas;
 * 3. contém prompts de imagem e animação;
 * 4. contém controlo de continuidade.
 *
 * Uso: node scripts/sync-episode-index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEASON_DIR = path.join(ROOT, "Temporadas", "Temporada-1");
const DOCS_DIR = path.join(ROOT, "docs", "episodios");
const MANIFEST_PATH = path.join(SEASON_DIR, "manifest.json");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function episodeNumber(file) {
  const match = path.basename(file).match(/(?:episodio-|T1E)(\d{2})/i);
  return match ? Number(match[1]) : null;
}

function extractTitle(content, fallback) {
  const match = content.match(/^#\s*(?:Epis[oó]dio\s*\d+\s*[—:-]\s*)?(.+)$/mi);
  return match ? match[1].trim() : fallback;
}

function extractStatus(content) {
  const match = content.match(/^\*\*Estado:\*\*\s*(.+)$/mi);
  return match ? match[1].trim() : "Em desenvolvimento";
}

function validateDecoupage(file) {
  const content = read(file);
  const sceneCount = (content.match(/^##\s+CENA\s+\d+/gmi) || []).length;
  const checks = {
    marker: /<!--\s*OS_LESADOS_DECOUPAGE_STATUS:\s*COMPLETE\s*-->/.test(content),
    scenes: sceneCount >= 3,
    imagePrompts: /prompt de imagem/i.test(content),
    animationPrompts: /prompt de anima[cç][aã]o/i.test(content),
    continuity: /CONTROLO DE CONTINUIDADE/i.test(content)
  };
  return { complete: Object.values(checks).every(Boolean), checks, sceneCount };
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error("Manifesto não encontrado: " + MANIFEST_PATH);
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const manifest = JSON.parse(read(MANIFEST_PATH));
  const ficheFiles = fs.readdirSync(SEASON_DIR)
    .filter(name => /^episodio-\d{2}-.+\.md$/i.test(name))
    .map(name => path.join(SEASON_DIR, name));
  const decoupageFiles = fs.readdirSync(DOCS_DIR)
    .filter(name => /^T1E\d{2}-.+-decupagem\.md$/i.test(name))
    .map(name => path.join(DOCS_DIR, name));

  const byNumber = new Map();
  for (const file of decoupageFiles) {
    const number = episodeNumber(file);
    if (number !== null) byNumber.set(number, file);
  }

  const entries = new Map((manifest.episodes || []).map(ep => [Number(ep.number), ep]));
  for (const file of ficheFiles) {
    const number = episodeNumber(file);
    if (number === null) continue;
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    const content = read(file);
    const existing = entries.get(number) || {};
    entries.set(number, {
      ...existing,
      number,
      title: existing.title || extractTitle(content, path.basename(file, ".md").replace(/^episodio-\d{2}-/, "").replace(/-/g, " ")),
      status: existing.status || extractStatus(content),
      path: relative,
      kind: existing.kind || "guião"
    });
  }

  for (const [number, entry] of entries) {
    const decoupage = byNumber.get(number);
    if (!decoupage) {
      delete entry.decoupagePath;
      delete entry.decoupageStatus;
      continue;
    }
    const validation = validateDecoupage(decoupage);
    if (validation.complete) {
      entry.decoupagePath = path.relative(ROOT, decoupage).split(path.sep).join("/");
      entry.decoupageStatus = "Completa";
      entry.status = "Decupagem completa para produção";
    } else {
      delete entry.decoupagePath;
      entry.decoupageStatus = "Por concluir";
      console.warn(`Episódio ${number}: decupagem não publicada no índice; validação falhou: ${JSON.stringify(validation.checks)}`);
    }
  }

  manifest.episodes = [...entries.values()].sort((a, b) => Number(a.number) - Number(b.number));
  const next = JSON.stringify(manifest, null, 2) + "\n";
  const previous = read(MANIFEST_PATH);
  if (next === previous) {
    console.log("Índice já sincronizado. Sem alterações.");
    return;
  }
  fs.writeFileSync(MANIFEST_PATH, next, "utf8");
  console.log(`Índice sincronizado: ${manifest.episodes.length} episódios na Temporada ${manifest.season}.`);
}

try {
  main();
} catch (error) {
  console.error("[sync-episode-index]", error.message);
  process.exitCode = 1;
}

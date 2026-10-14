// OS LESADOS — contexto visual partilhado (manifests, skills, estilo, refs de disco).
// Sem segredos aqui: só leitura de ficheiros locais.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, "..");

export function readManifest(subdir) {
  const p = path.join(ROOT, "context", subdir, "manifest.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.warn(`[context] manifest em falta ou inválido: ${p} (${e.message})`);
    return {};
  }
}

export function guessMime(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export const SKILL_FILES = ["camera-rules.md", "lighting-rules.md", "framing-guide.md"];

/** Lê as skills técnicas de filmagem (lidas por pedido para apanhar edições sem restart). */
export function loadTechnicalSkills() {
  const blocks = [];
  const missing = [];
  for (const file of SKILL_FILES) {
    const full = path.join(ROOT, "context", "skills", file);
    try {
      const text = fs.readFileSync(full, "utf8").trim();
      if (text) blocks.push(text);
    } catch {
      missing.push(file);
    }
  }
  if (missing.length) {
    console.warn(`[skills] ficheiros em falta em context/skills/: ${missing.join(", ")}`);
  }
  return { blocks, missing };
}

/** Lê a análise dinâmica de estilo (gerada pelo agente YouTube; opcional). */
export function loadDynamicStyle() {
  const full = path.join(ROOT, "context", "style", "dynamic-rm-analysis.md");
  try {
    const text = fs.readFileSync(full, "utf8").trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Monta o prompt final: prompt base + regras de produção + estilo. Igual para todos os fornecedores. */
export function buildFullPrompt(basePrompt) {
  const { blocks: skillBlocks } = loadTechnicalSkills();
  const skillsText = skillBlocks.length
    ? `\n\nTECHNICAL PRODUCTION RULES (mandatory, apply to this frame):\n${skillBlocks.join("\n\n---\n\n")}`
    : "";
  const dynamicStyle = loadDynamicStyle();
  const styleText = dynamicStyle
    ? `\n\nSTYLE REFERENCE (Rick & Morty analysis, apply stylistically; character identity still comes from attached images):\n${dynamicStyle}`
    : "";
  return (
    `${basePrompt}\n\nUse the attached images strictly for character identity and background continuity. ` +
    `Do not copy text from references. Keep 16:9 TV cartoon framing, thick black outlines, vibrant colors.` +
    skillsText +
    styleText
  );
}

/** Lê referências do disco a partir do sceneContext. Retorna { refs, warnings }. */
export function loadDiskRefs(sceneContext = {}) {
  const refs = [];
  const warnings = [];
  const charIds = Array.isArray(sceneContext.characters) ? sceneContext.characters : [];
  const location = String(sceneContext.location || "");

  const charManifest = readManifest("characters");
  for (const id of charIds) {
    const filename = charManifest[id];
    if (!filename) {
      console.warn(`[context] personagem sem entrada no manifest: ${id}`);
      continue;
    }
    const full = path.join(ROOT, "context", "characters", filename);
    if (!fs.existsSync(full)) {
      const msg = `referência em falta no disco: context/characters/${filename} (id: ${id})`;
      console.warn(`[context] ${msg}`);
      warnings.push(msg);
      continue;
    }
    try {
      const buf = fs.readFileSync(full);
      refs.push({ label: `character:${id}`, mimeType: guessMime(filename), base64: buf.toString("base64") });
      console.log(`Loaded reference for character: ${id} (${filename})`);
    } catch (e) {
      console.warn(`[context] falha a ler ${full}: ${e.message}`);
    }
  }

  if (location) {
    const bgManifest = readManifest("backgrounds");
    const filename = bgManifest[location];
    if (!filename) {
      console.warn(`[context] local sem entrada no manifest: ${location}`);
    } else {
      const full = path.join(ROOT, "context", "backgrounds", filename);
      if (!fs.existsSync(full)) {
        const msg = `referência em falta no disco: context/backgrounds/${filename} (local: ${location})`;
        console.warn(`[context] ${msg}`);
        warnings.push(msg);
      } else {
        try {
          const buf = fs.readFileSync(full);
          refs.push({ label: `background:${location}`, mimeType: guessMime(filename), base64: buf.toString("base64") });
          console.log(`Loaded reference for background: ${location} (${filename})`);
        } catch (e) {
          console.warn(`[context] falha a ler ${full}: ${e.message}`);
        }
      }
    }
  }

  return { refs, warnings };
}

/** Estado do contexto: { id/local: boolean(existe no disco) } */
export function contextStatus() {
  const characters = {};
  const backgrounds = {};
  const charManifest = readManifest("characters");
  for (const [id, filename] of Object.entries(charManifest)) {
    characters[id] = fs.existsSync(path.join(ROOT, "context", "characters", String(filename)));
  }
  const bgManifest = readManifest("backgrounds");
  for (const [loc, filename] of Object.entries(bgManifest)) {
    backgrounds[loc] = fs.existsSync(path.join(ROOT, "context", "backgrounds", String(filename)));
  }
  const skills = {};
  for (const file of SKILL_FILES) {
    skills[file] = fs.existsSync(path.join(ROOT, "context", "skills", file));
  }
  const style = {
    "dynamic-rm-analysis.md": fs.existsSync(path.join(ROOT, "context", "style", "dynamic-rm-analysis.md")),
  };
  return { characters, backgrounds, skills, style };
}

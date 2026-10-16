// OS LESADOS — servidor Express (rotas + ficheiros estáticos).
// A geração de imagem vive em server/image-pipeline.mjs (fornecedor configurável).
// Serve index.html em / e expõe /api/* para o frontend.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, contextStatus } from "./context.mjs";
import { runImagePipeline, runTestPipeline } from "./image-pipeline.mjs";
import { PROVIDER_IDS, activeProviderName, providerStatus, resolveProvider } from "./providers/index.mjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  const providers = providerStatus();
  const anyKey = Object.values(providers).some((p) => p.keyConfigured);
  res.json({
    ok: true,
    provider: activeProviderName(),
    providers: PROVIDER_IDS,
    keyConfigured: anyKey, // compat: frontend antigo lê este campo
    keys: Object.fromEntries(Object.entries(providers).map(([k, v]) => [k, v.keyConfigured])),
  });
});

// Alias sem prefixo, caso o frontend use backendUrl=""
app.get("/health", (_req, res) => {
  const providers = providerStatus();
  res.json({
    ok: true,
    provider: activeProviderName(),
    keyConfigured: Object.values(providers).some((p) => p.keyConfigured),
  });
});

app.get("/api/context/status", (_req, res) => {
  try {
    const { characters, backgrounds, skills, style } = contextStatus();
    res.json({ ok: true, characters, backgrounds, skills, style });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Bíblia narrativa (fichas de personagem para o motor de história).
app.get("/api/canon/bible", async (_req, res) => {
  try {
    const { default: fs } = await import("node:fs");
    const raw = fs.readFileSync(path.join(ROOT, "context", "canon", "personagens.json"), "utf8");
    const bible = JSON.parse(raw);
    res.json({ ok: true, source: "context/canon/personagens.json", characters: bible.characters || [] });
  } catch (e) {
    res.status(404).json({ ok: false, error: "Bíblia narrativa indisponível: " + e.message });
  }
});

// Geração narrativa por IA (texto estruturado). Sem fallback silencioso:
// qualquer falha devolve erro explícito para o frontend decidir.
app.post("/api/story/generate", async (req, res) => {
  try {
    const { premise, castIds } = req.body || {};
    if (!premise || !String(premise).trim()) {
      return res.status(400).json({ ok: false, error: "Campo 'premise' é obrigatório." });
    }
    const textRouter = await import("./text-providers/index.mjs");
    const { validateStory } = await import("./text-providers/gemini-text.mjs");
    if (!textRouter.isConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Geração narrativa por IA indisponível: sem chaves de texto no .env. Usa o modo local (sem IA).",
      });
    }
    const { default: fs } = await import("node:fs");
    const bible = JSON.parse(fs.readFileSync(path.join(ROOT, "context", "canon", "personagens.json"), "utf8"));
    const byId = Object.fromEntries((bible.characters || []).map((c) => [c.id, c]));
    const blocked = (Array.isArray(castIds) ? castIds : []).filter((id) => byId[id] && byId[id].status !== "ativa");
    if (blocked.length) {
      return res.status(400).json({ ok: false, error: `Elenco indisponível (em desenvolvimento/pausa): ${blocked.join(", ")}. Escolhe personagens ativas.` });
    }
    const wanted = Array.isArray(castIds) && castIds.length ? castIds : null;
    const cards = (bible.characters || []).filter((c) => !wanted || wanted.includes(c.id));
    if (!cards.length) {
      return res.status(400).json({ ok: false, error: "Elenco vazio: castIds desconhecidos." });
    }
    const { storySystemPrompt } = await import("./text-providers/gemini-text.mjs");
    const target = Number(req.body?.targetDuration) || 75;
    const nBeats = Math.min(9, Math.max(4, Math.round(target / 10)));
    const out = await textRouter.generateJSON({
      system: storySystemPrompt(cards),
      user: `Premissa do episódio (PT-PT): ${String(premise).slice(0, 800)}\nElenco obrigatório (usa estes IDs): ${cards.map((c) => c.id).join(", ")}. Escreve ${nBeats} beats causais com diálogos curtos na voz de cada um (cada beat ≈10s: ação + fala + reação). Duração total alvo: ~${target}s (diálogos + ações + pausas + tag).\n\nFORMATO JSON OBRIGATÓRIO (todas as chaves, sem exceção):\n{"comicIdea": "frase (10+ chars)", "protagonist": "nome", "protagonistGoal": "objetivo (10+)", "incident": "incidente (10+)", "conflict": "conflito (10+)", "climax": "clímax (10+)", "resolution": "resolução decorrente (10+)", "punchline": "remate (10+)", "beats": [{"who": "id do elenco", "want": "quer", "does": "faz", "obstacle": "obstáculo", "result": "resultado", "change": "mudança de estado", "link": "ligação ao próximo", "comic": "piada", "dialogue": "NOME: fala curta"}]}`,
      validate: (parsed) => validateStory(parsed, target),
    });
    const { estimateDuration } = await import("./text-providers/gemini-text.mjs");
    res.json({ ok: true, provider: out.provider, model: out.model, story: out.data, targetDuration: target, estimatedDuration: estimateDuration(out.data) });
  } catch (e) {
    console.error("[story/generate]", e.message);
    res.status(e?.httpStatus || 500).json({ ok: false, error: e.message || "Falha na geração narrativa." });
  }
});

function providerErrorMessage(providerId, e) {
  if (providerId === "gemini" && (e?.status === 429 || /quota|rate limit|429/i.test(e?.message || ""))) {
    return "Rate limit / quota da Google (o Free Tier tem limite 0/dia para imagem). Vê https://ai.dev/rate-limit e ativa billing.";
  }
  return e.message || "Falha na geração.";
}

app.post("/api/test", async (req, res) => {
  try {
    const provider = resolveProvider(req.body?.provider);
    const out = await runTestPipeline({ provider: provider.id, model: req.body?.model });
    res.json(out);
  } catch (e) {
    if (e?.httpStatus === 400) return res.status(400).json({ ok: false, error: e.message });
    if (e?.httpStatus === 503) return res.status(503).json({ ok: false, error: e.message });
    const providerId = String(req.body?.provider || activeProviderName()).toLowerCase();
    if (e?.httpStatus === 429 || providerId === "gemini") {
      const status = e?.httpStatus === 429 ? 429 : 500;
      if (status === 429 || /quota|rate limit|429/i.test(e?.message || "")) {
        return res.status(429).json({ ok: false, error: providerErrorMessage(providerId, e) });
      }
    }
    console.error("[test]", e);
    res.status(e?.httpStatus || 500).json({ ok: false, error: e.message || "Falha no teste." });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, model, sceneContext = {}, references = [], provider } = req.body || {};
    const out = await runImagePipeline({ provider, model, prompt, sceneContext, references });
    res.json(out);
  } catch (e) {
    if (e?.httpStatus) return res.status(e.httpStatus).json({ ok: false, error: e.message });
    const providerId = String(req.body?.provider || activeProviderName()).toLowerCase();
    if (/quota|rate limit|429/i.test(e?.message || "")) {
      return res.status(429).json({ ok: false, error: providerErrorMessage(providerId, e) });
    }
    console.error("[generate-image]", e);
    res.status(500).json({ ok: false, error: e.message || "Falha na geração." });
  }
});

// Servir o frontend (index.html já existe na raiz — não tocar)
app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

// Retratos do canon (fotos das personagens, fundo branco via CSS no frontend).
app.use("/characters", express.static(path.join(ROOT, "context", "characters")));

app.listen(PORT, "0.0.0.0", () => {
  const providers = providerStatus();
  console.log(`\n✅ Backend OS LESADOS a correr em http://localhost:${PORT}`);
  console.log(`   Index servido: ${path.join(ROOT, "index.html")}`);
  console.log(`   Contexto: ${path.join(ROOT, "context")}`);
  console.log(`   Fornecedor ativo (IMAGE_PROVIDER): ${activeProviderName()} [${PROVIDER_IDS.join(", ")}]`);
  for (const [name, p] of Object.entries(providers)) {
    console.log(`   ${p.label}: ${p.keyConfigured ? "chave configurada" : "SEM CHAVE"}`);
  }
  console.log("");
});

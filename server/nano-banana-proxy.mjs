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
    const wanted = Array.isArray(castIds) && castIds.length ? castIds : null;
    const cards = (bible.characters || []).filter((c) => !wanted || wanted.includes(c.id));
    if (!cards.length) {
      return res.status(400).json({ ok: false, error: "Elenco vazio: castIds desconhecidos." });
    }
    const { storySystemPrompt } = await import("./text-providers/gemini-text.mjs");
    const out = await textRouter.generateJSON({
      system: storySystemPrompt(cards),
      user: `Premissa do episódio (PT-PT): ${String(premise).slice(0, 800)}\nElenco obrigatório (usa estes IDs): ${cards.map((c) => c.id).join(", ")}. Escreve ${Math.min(7, Math.max(4, cards.length + 2))} beats causais com diálogos curtos na voz de cada um.`,
      validate: validateStory,
    });
    res.json({ ok: true, provider: out.provider, model: out.model, story: out.data });
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

// Sala dos Argumentistas (multiagente). Sessões correm em background;
// o frontend faz polling. Nada é simulado: cada etapa persiste no disco.
app.post("/api/writers/start", async (req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    const geminiText = await import("./text-providers/index.mjs"); // router texto (openai->gemini)
    if (!geminiText.isConfigured()) {
      return res.status(503).json({ ok: false, error: "Sala indisponível: GEMINI_API_KEY em falta no .env." });
    }
    const s = wr.newSession(req.body?.topic);
    res.json({ ok: true, id: s.id, status: s.status });
    wr.run(s, { root: ROOT, geminiText }).catch(() => {});
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/writers/sessions", async (_req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    res.json({ ok: true, sessions: wr.list() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/writers/session/:id", async (req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    const s = wr.load(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Sessão inexistente." });
    // Sessões presas em "running" há +15min (ex. restart do servidor) = interrompidas.
    if (s.status === "running" && Date.now() - new Date(s.updatedAt).getTime() > 15 * 60 * 1000) {
      s.status = "interrupted";
    }
    res.json({ ok: true, session: s, agents: (await import("./writers-room/agents.mjs")).AGENTS });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/writers/session/:id/stop", async (req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    const s = wr.load(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Sessão inexistente." });
    s.stopped = true;
    if (s.status === "running") s.status = "stopped";
    const fs = (await import("node:fs")).default;
    fs.writeFileSync(path.join(ROOT, "server", "writers-room", "sessions", `${s.id}.json`), JSON.stringify(s, null, 1));
    res.json({ ok: true, status: s.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/writers/session/:id/continue", async (req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    const geminiText = await import("./text-providers/index.mjs"); // router texto (openai->gemini)
    const s = wr.load(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Sessão inexistente." });
    if (s.status === "done") return res.json({ ok: true, id: s.id, status: "done" });
    s.stopped = false;
    s.status = "running";
    s.errors.push("retomada pelo utilizador");
    res.json({ ok: true, id: s.id, status: "running" });
    wr.run(s, { root: ROOT, geminiText }).catch(() => {});
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/writers/session/:id/approve", async (req, res) => {
  try {
    const wr = await import("./writers-room/orchestrator.mjs");
    const s = wr.load(req.params.id);
    if (!s) return res.status(404).json({ ok: false, error: "Sessão inexistente." });
    const p = wr.approveProposal(s, req.body?.proposalId, req.body?.verdict === "reject" ? "reject" : "approve");
    res.json({ ok: true, proposal: p, shortlist: s.shortlist });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
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

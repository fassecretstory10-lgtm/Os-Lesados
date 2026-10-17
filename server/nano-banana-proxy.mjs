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
// Sem cache para o index.html e a API: o arquivo deve refletir sempre o repositório.
// Sem isto, o browser serve a versão antiga da página (e do guião) após um pull/commit.
app.set("etag", false);
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/index.html" || req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

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

// Decupagem audiovisual a partir do guião aprovado. Não gera takes genéricos a partir de uma contagem fixa.
app.post("/api/decoupage/generate", async (req, res) => {
  try {
    const { episodeName, sourceScript, castIds = [], targetDuration = 150 } = req.body || {};
    const script = String(sourceScript || "").trim();
    if (script.length < 300) {
      return res.status(400).json({ ok: false, error: "O guião de origem está vazio ou demasiado curto. Abre o guião completo antes de decupar." });
    }
    const textRouter = await import("./text-providers/index.mjs");
    if (!textRouter.isConfigured()) {
      return res.status(503).json({ ok: false, error: "A geração da decupagem por IA está indisponível: não há provider de texto configurado no .env." });
    }
    const { default: fs } = await import("node:fs");
    const bible = JSON.parse(fs.readFileSync(path.join(ROOT, "context", "canon", "personagens.json"), "utf8"));
    const allowed = new Set((Array.isArray(castIds) ? castIds : []).map(String));
    const characters = (bible.characters || []).filter(c => !allowed.size || allowed.has(c.id));
    const castText = characters.map(c => `- ID: ${c.id}; nome: ${c.name}; papel: ${c.role}; humor: ${c.humor}; limites: ${(c.limits || []).join("; ")}`).join("\n");
    const schema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        scenes: {
          type: "array", minItems: 5, maxItems: 30,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              sceneId: { type: "string" },
              title: { type: "string" },
              type: { type: "string", enum: ["MASTER FRAME", "REFRAME", "ACTION SHOT", "INSERT"] },
              location: { type: "string" },
              duration: { type: "integer", minimum: 1, maximum: 8 },
              shot: { type: "string" },
              camera: { type: "string" },
              characters: { type: "array", items: { type: "string" } },
              action: { type: "string" },
              dialogueChar: { type: "string" },
              dialogueLine: { type: "string" },
              dialogueIntent: { type: "string" },
              reframeOf: { type: "string" },
              imagePrompt: { type: "string" },
              animationPrompt: { type: "string" }
            },
            required: ["id","sceneId","title","type","location","duration","shot","camera","characters","action","dialogueChar","dialogueLine","dialogueIntent","reframeOf","imagePrompt","animationPrompt"]
          }
        }
      },
      required: ["summary","scenes"]
    };
    const system = `És realizador/a e supervisor/a de storyboard de OS LESADOS, sitcom animada satírica portuguesa. A tua tarefa é transformar um GUIÃO DE ORIGEM numa decupagem filmável para animação 2D, não resumir a história nem preencher campos com frases vagas.
ELENCO CANÓNICO DISPONÍVEL:
${castText}
REGRAS OBRIGATÓRIAS:
- Responde em português europeu (PT-PT), incluindo falas e instruções. Mantém nomes e diálogos do guião exatamente como estão; nunca inventes nem reescrevas falas aprovadas.
- Preserva a ordem causal, todas as cenas importantes, ações, entradas, saídas, gags, revelações e o final do guião. Não mudes a história.
- Divide em cenas identificadas por sceneId e planos individualizados. Cada plano deve ter ação específica, enquadramento e prompt de animação concreto. Não devolvas três blocos genéricos para uma história completa.
- Usa um MASTER FRAME para estabelecer cada espaço e posições. Depois cria reframes apenas para cobrir falas, reações ou ações que realmente precisem de enquadramento próprio. Não inventes reframes decorativos.
- Se houver diálogo, dá cobertura filmável: quem fala, reação de quem ouve quando narrativamente necessária, eixo de câmara e eyelines consistentes. Não repitas a mesma fala em vários planos.
- Mantém planos curtos (1–8 segundos), com duração coerente com ação e diálogo. A soma deve aproximar-se da duração-alvo sem acelerar falas impossivelmente.
- imagePrompt deve ser um prompt de imagem autónomo, específico à composição e ao cenário; animationPrompt deve descrever movimento, acting, timing, diálogo exato e som. Nunca escrevas apenas “imagem por gerar”.
- Em reframes, reframeOf deve apontar para o id do respetivo master; characters contém IDs canónicos quando conhecidos. Para extras sem ID canónico, dialogueChar pode ser o nome do papel.
- Não adiciones narradores, personagens, falas, figurinos, objetos ou piadas que não existam no guião.
- Usa um número de planos adequado à complexidade e duração; não há contagem fixa. Uma sequência de diálogo pode reutilizar o master e ter closes seletivos; uma ação física que exige composição própria pode justificar um plano adicional.
- A primeira cena deve começar exatamente onde o guião começa e o último plano deve respeitar exatamente o final escrito.`;
    const user = `EPISÓDIO: ${String(episodeName || "Sem título").slice(0,160)}
DURAÇÃO-ALVO: aproximadamente ${Math.max(30, Math.min(300, Number(targetDuration) || 150))} segundos.
GUIÃO DE ORIGEM (fonte de verdade; não inventar nem corrigir silenciosamente):
--- INÍCIO DO GUIÃO ---
${script.slice(0, 26000)}
--- FIM DO GUIÃO ---

Cria a decupagem completa. Inclui cada beat narrativo do texto, com os diálogos intactos e prompts úteis para produção. Se o documento de origem já contiver uma decupagem, usa-a como referência, mas faz uma revisão crítica: elimina reframes redundantes e mantém apenas os que acrescentam cobertura necessária a uma fala, reação ou ação. Não cries um reframe para cada fala por sistema. Preserva a história, os diálogos e os detalhes visuais importantes; não copies mecanicamente uma contagem excessiva de planos.`;
    const result = await textRouter.generateJSON({ system, user, schema, schemaName: "decoupage" });
    const raw = result.data;
    if (!raw || !Array.isArray(raw.scenes) || raw.scenes.length < 5) {
      return res.status(502).json({ ok: false, error: "A IA devolveu uma decupagem incompleta (menos de 5 planos). Tenta novamente." });
    }
    const validIds = new Set(characters.map(c => c.id));
    const scenes = raw.scenes.map((s, i) => {
      const id = String(s.id || `p${i+1}`);
      const dialogue = String(s.dialogueLine || "").trim()
        ? { char: String(s.dialogueChar || "").trim(), line: String(s.dialogueLine).trim(), paren: String(s.dialogueIntent || "").trim() }
        : null;
      return {
        id,
        sceneId: String(s.sceneId || `cena-${i+1}`),
        title: String(s.title || `Plano ${i+1}`).trim(),
        type: ["MASTER FRAME","REFRAME","ACTION SHOT","INSERT"].includes(s.type) ? s.type : "MASTER FRAME",
        location: String(s.location || "").trim(),
        duration: Math.max(1, Math.min(8, Math.round(Number(s.duration) || 5))),
        shot: String(s.shot || "").trim(),
        camera: String(s.camera || "").trim(),
        characters: (Array.isArray(s.characters) ? s.characters : []).map(String).filter(id2 => validIds.has(id2)),
        action: String(s.action || "").trim(),
        dialogue,
        reframeOf: String(s.reframeOf || "").trim() || null,
        imagePrompt: String(s.imagePrompt || "").trim(),
        animationPrompt: String(s.animationPrompt || "").trim(),
        imageUrl: null, model: null, variant: 0, approved: false, referenceCount: 0,
        clipApproved: false, prompt: null
      };
    });
    const incomplete = scenes.findIndex(s => !s.location || !s.shot || !s.camera || !s.action || !s.imagePrompt || !s.animationPrompt);
    if (incomplete >= 0) {
      return res.status(502).json({ ok: false, error: `A decupagem gerada tem campos de produção em falta no plano ${incomplete+1}. Tenta novamente para evitar aprovar planos vazios.` });
    }
    res.json({ ok: true, summary: String(raw.summary || ""), scenes, provider: result.provider, model: result.model });
  } catch (e) {
    console.error("[decoupage/generate]", e);
    res.status(e?.httpStatus || 500).json({ ok: false, error: e.message || "Não foi possível gerar a decupagem." });
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

// Arquivo editorial da Temporada 1. As fichas e decupagens são ficheiros versionados.
app.get("/api/episodes", async (_req, res) => {
  try {
    const { default: fs } = await import("node:fs");
    const manifestPath = path.join(ROOT, "Temporadas", "Temporada-1", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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
        const absoluteDecoupagePath = path.join(ROOT, decoupagePath);
        if (fs.existsSync(absoluteDecoupagePath)) decoupageContent = fs.readFileSync(absoluteDecoupagePath, "utf8");
      }
      return { ...episode, content, decoupageContent };
    });
    res.json({ ok: true, season: manifest.season, episodes });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Não foi possível carregar os guiões da Temporada 1: " + e.message });
  }
});

// Servir o frontend (index.html já existe na raiz — não tocar)
app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"), { etag: false, lastModified: false });
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

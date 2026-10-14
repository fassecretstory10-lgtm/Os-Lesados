// Testes do backend — determinísticos, sem rede, sem quota.
// Uso: node --test tools/test-backend.mjs
// Isola process.env para não depender das chaves reais da máquina.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SAVED = {};
for (const k of Object.keys(process.env)) {
  if (/^(GEMINI|OPENAI|ANTHROPIC|HF_|CF_|TEXT_|IMAGE_)/.test(k)) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
}

const providers = await import("../server/providers/index.mjs");
const textRouter = await import("../server/text-providers/index.mjs");
const geminiText = await import("../server/text-providers/gemini-text.mjs");
const wr = await import("../server/writers-room/orchestrator.mjs");

test("providers: registry resolve e rejeita desconhecidos", () => {
  assert.deepEqual(providers.PROVIDER_IDS, ["gemini", "openai", "huggingface", "cloudflare"]);
  assert.equal(providers.resolveProvider("GEMINI").id, "gemini");
  assert.equal(providers.resolveProvider("").id, "gemini"); // default
  assert.throws(() => providers.resolveProvider("midjourney"), /Fornecedor desconhecido/);
  try { providers.resolveProvider("midjourney"); } catch (e) { assert.equal(e.httpStatus, 400); }
});

test("providers: sem chaves, nenhum configurado (apenas HF, que é anónimo)", () => {
  const st = providers.providerStatus();
  assert.equal(st.gemini.keyConfigured, false);
  assert.equal(st.openai.keyConfigured, false);
  assert.equal(st.cloudflare.keyConfigured, false);
  assert.equal(st.huggingface.keyConfigured, true); // anónimo por design
});

test("texto: sem chaves, erro 503 explícito sem rede", async () => {
  assert.equal(textRouter.isConfigured(), false);
  await assert.rejects(
    textRouter.generateJSON({ system: "s", user: "u" }),
    (e) => e.httpStatus === 503 && /sem chaves/i.test(e.message)
  );
});

test("validateStory aceita história válida e rejeita vazia/duplicada", () => {
  const beat = (who, line) => ({ who, want: "querer algo", does: "faz algo", obstacle: "trava", result: "muda", change: "a>b", link: "depois", comic: "piada", dialogue: line });
  const good = {
    comicIdea: "ideia com mais de dez caracteres aqui",
    protagonist: "Capitão Gancho", protagonistGoal: "manter a ordem na estação",
    incident: "o direto cai em pleno horário nobre", conflict: "capitão vs caos",
    beats: [beat("capitao", "Está decidido."), beat("tininha", "Claro que sim."), beat("capitao", "Não.")],
    climax: "decisão final no estudio central", resolution: "ordem reposta no direto",
    punchline: "a culpa foi do direto",
  };
  assert.deepEqual(geminiText.validateStory(good), []);
  assert.ok(geminiText.validateStory(null).length > 0);
  const dup = { ...good, beats: [beat("capitao", "Xyz mesma fala aqui"), beat("capitao", "Xyz mesma fala aqui"), beat("tininha", "Outra fala diferente")] };
  assert.match(geminiText.validateStory(dup).join(" "), /repetido/);
  assert.match(geminiText.validateStory({ ...good, beats: [] }).join(" "), /beats/);
});

test("showrunner: ordena, bónus absurdo, corte e teto", async () => {
  const agents = await import("../server/writers-room/agents.mjs");
  const proposals = [
    { id: "p1", payoff: "fim", absurdo: false },
    { id: "p2", payoff: "fim", absurdo: true },
    { id: "p3", payoff: "", absurdo: false },
  ];
  const critiques = [
    { proposalId: "p1", score: 7, flaw: "f", fix: "x" },
    { proposalId: "p2", score: 7, flaw: "f", fix: "x" },
    { proposalId: "p3", score: 9, flaw: "f", fix: "x" },
  ];
  const { ranking, shortlist } = agents.runShowrunner({ proposals, critiques });
  assert.equal(ranking[0].id, "p2"); // 7+1 bónus > 7
  assert.deepEqual(shortlist, ["p2", "p1", "p3"]); // p3: 9-2=7 entra; teto 5 não corta 3
  assert.ok(shortlist.length <= 5);
});

test("orchestrator: approveProposal muta shortlist e valida ids", () => {
  const s = wr.newSession("teste");
  try {
    s.proposals = [{ id: "p1", state: "proposta" }];
    s.shortlist = [];
    wr.approveProposal(s, "p1", "approve");
    assert.equal(s.proposals[0].state, "aprovada");
    assert.deepEqual(s.shortlist, ["p1"]);
    wr.approveProposal(s, "p1", "reject");
    assert.equal(s.proposals[0].state, "rejeitada");
    assert.deepEqual(s.shortlist, []);
    assert.throws(() => wr.approveProposal(s, "zzz", "approve"), /inexistente/);
  } finally {
    try { fs.unlinkSync(path.join(ROOT, "server", "writers-room", "sessions", `${s.id}.json`)); } catch {}
  }
});

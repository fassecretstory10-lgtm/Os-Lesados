// Testes do backend — determinísticos, sem rede, sem quota.
// Uso: node --test tools/test-backend.mjs
// Isola process.env para não depender das chaves reais da máquina.

import test from "node:test";
import assert from "node:assert/strict";

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
  assert.deepEqual(geminiText.validateStory(good, 15), []);
  assert.ok(geminiText.validateStory(null).length > 0);
  const dup = { ...good, beats: [beat("capitao", "Xyz mesma fala aqui"), beat("capitao", "Xyz mesma fala aqui"), beat("tininha", "Outra fala diferente")] };
  assert.match(geminiText.validateStory(dup, 15).join(" "), /repetido/);
  assert.match(geminiText.validateStory({ ...good, beats: [] }, 15).join(" "), /beats/);
});

test("Roda Capitão: entradas tardias e duração são validadas", () => {
  const beat = (who, line) => ({ who, want: "querer algo", does: "faz algo", obstacle: "trava", result: "muda", change: "a>b", link: "depois", comic: "piada", dialogue: line });
  const base = {
    comicIdea: "a roda da sorte falha em pleno direto da gala",
    protagonist: "Capitão Gancho", protagonistGoal: "salvar a gala sem gastar mais",
    incident: "a roda da sorte encrava em direto", conflict: "capitão vs tininha",
    climax: "decisão final no palco", resolution: "roda desligada, gala salva",
    punchline: "a culpa foi do direto",
  };
  const badPresence = {
    ...base,
    lateEntries: [{ who: "teresa", fromBeat: 5, where: "esconderijo" }],
    beats: [beat("capitao", "Fala um dois três"), beat("teresa", "Eu apareço cedo demais aqui"), beat("capitao", "Volta para o teu lugar")],
  };
  assert.match(geminiText.validateStory(badPresence, 15).join(" "), /lateEntries/);
  const badDuration = { ...base, beats: [beat("capitao", "Oi"), beat("tininha", "Olá"), beat("capitao", "Adeus")] };
  assert.match(geminiText.validateStory(badDuration, 75).join(" "), /duração/);
  const goodLate = {
    ...base,
    lateEntries: [{ who: "teresa", fromBeat: 3, where: "esconderijo" }],
    beats: [beat("capitao", "Fala um dois três quatro"), beat("tininha", "Outra fala aqui também"), beat("teresa", "Só agora apareço aqui")],
  };
  assert.deepEqual(geminiText.validateStory(goodLate, geminiText.estimateDuration(goodLate)), []);
});

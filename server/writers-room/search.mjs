// Sala dos Argumentistas — pesquisa factual real (sem chaves).
// Fontes: Wikipedia API (estável, com datas) + DuckDuckGo HTML (melhor esforço).
// Tudo o que não se conseguir consultar é reportado como falha explícita,
// nunca inventado.

const WIKI = "https://pt.wikipedia.org/w/api.php";
const DDG = "https://html.duckduckgo.com/html/";

async function fetchTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Pesquisa Wikipedia PT: devolve [{title, url, snippet, date:null, level:'documentado'}]. */
export async function searchWikipedia(query, limit = 5) {
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*",
    generator: "search", gsrsearch: query, gsrlimit: String(limit),
    prop: "extracts", exintro: "1", explaintext: "1", exchars: "300",
  });
  const res = await fetchTimeout(`${WIKI}?${params}`, { headers: { "User-Agent": "os-lesados-writers-room/1.0" } });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages.map((p) => ({
    title: p.title,
    url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    snippet: (p.extract || "").slice(0, 300),
    date: null,
    level: "documentado",
    source: "wikipedia",
  }));
}

/** Pesquisa DuckDuckGo HTML (melhor esforço; falha abertamente se bloqueado). */
export async function searchDDG(query, limit = 5) {
  const body = new URLSearchParams({ q: `${query} televisão portuguesa`, kl: "pt-pt" });
  const res = await fetchTimeout(DDG, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "os-lesados-writers-room/1.0" },
    body,
  }, 20000);
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
  const html = await res.text();
  const out = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,600}?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim().slice(0, 280);
    let url = m[1];
    const ud = url.match(/uddg=([^&]+)/);
    if (ud) { try { url = decodeURIComponent(ud[1]); } catch {} }
    if (!/^https?:\/\//.test(url)) continue;
    out.push({ title: clean(m[2]), url, snippet: clean(m[3]), date: null, level: "documentado", source: "ddg" });
  }
  if (!out.length) throw new Error("DuckDuckGo sem resultados parseáveis (layout ou bloqueio).");
  return out;
}

/**
 * Investigação orientada: corre N pesquisas e agrega fontes com proveniência.
 * @returns {Promise<{sources, errors, queries}>}
 */
export async function research(queries) {
  const sources = [];
  const errors = [];
  const seen = new Set();
  for (const q of queries) {
    try {
      const wiki = await searchWikipedia(q.query.replace(/^site:\S+\s*/, ""), 3).catch((e) => { errors.push(`wikipedia[${q.query}]: ${e.message}`); return []; });
      let ddg = [];
      try { ddg = await searchDDG(q.query, 3); }
      catch (e) { errors.push(`ddg[${q.query}]: ${e.message}`); }
      for (const s of [...wiki, ...ddg]) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        sources.push({ ...s, topic: q.topic, kind: q.kind || "facto" });
      }
    } catch (e) {
      errors.push(`query[${q.query}]: ${e.message}`);
    }
  }
  return { sources, errors, queries: queries.map((q) => q.query) };
}

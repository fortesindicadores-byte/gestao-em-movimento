// ═══════════════════════════════════════════════════════════════════════════
// Assistente do portal Gestão em Movimento (Edge Function do Supabase)
// Usado na página /assistente/ e na visão Assistente do painel Remuneração.
//
// O painel /remuneracao/ manda a pergunta com o login do hub. A função:
//   1. confere o login e se o e-mail é de quem pode usar (ASSISTENTE_DONOS);
//   2. conversa com o Claude, que pesquisa na web e consulta o banco pela porta
//      public.assistente_sql (só SELECT, só as tabelas liberadas,
//      transação somente leitura — scripts/assistente-ft.sql);
//   3. devolve o andamento em NDJSON, uma linha por evento:
//        {"t":"txt","d":"…"}            trecho da resposta
//        {"t":"sql","sql":"…","motivo":"…"}  consulta que vai rodar
//        {"t":"res","linhas":N,"truncado":bool} | {"t":"res","erro":"…"}
//        {"t":"web","q":"…"}            pesquisa na web
//        {"t":"fim","consultas":N,"web":N,"custo":0.12,"seg":31}
//        {"t":"erro","msg":"…"}
//   4. grava a pergunta em assistente_log (tokens, custo, consultas).
//
// Segredos da função (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   obrigatório
//   ASSISTENTE_DONOS    opcional, e-mails separados por vírgula (padrão: o dono do portal)
//   ASSISTENTE_MODELO   opcional (padrão claude-opus-5-5)
// SUPABASE_URL e as chaves do projeto o Supabase já põe (as novas, SUPABASE_PUBLISHABLE_KEYS
// e SUPABASE_SECRET_KEYS, ou as antigas, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY).
// ═══════════════════════════════════════════════════════════════════════════
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
// chaves novas (sb_publishable_/sb_secret_, em JSON) ou as antigas (anon/service_role, JWT)
function chaveDe(json: string, antiga: string) {
  try { const d = JSON.parse(Deno.env.get(json) ?? "{}"); const v = d.default ?? Object.values(d)[0]; if (v) return String(v); } catch (_) { /* sem a variável nova */ }
  return Deno.env.get(antiga) ?? "";
}
const SB_ANON = chaveDe("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const SB_SERVICE = chaveDe("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
// chave sb_secret_ não é JWT: vai só no apikey; a antiga (JWT) vai também no Authorization
const CAB_SERVICE: Record<string, string> = SB_SERVICE.startsWith("sb_")
  ? { apikey: SB_SERVICE } : { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` };
const DONOS = (Deno.env.get("ASSISTENTE_DONOS") ?? "fortesindicadores@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const MODELO = Deno.env.get("ASSISTENTE_MODELO") ?? "claude-opus-5-5";
const MAX_CONSULTAS = 25;
const MAX_RESULTADO = 60000; // caracteres do resultado de uma consulta que voltam ao modelo
// US$ por milhão de tokens do modelo padrão: entrada, gravação de cache, leitura de cache, saída
const PRECO = { in: 4, cacheW: 5, cacheR: 0.2, out: 20, busca: 0.01 }; // busca na web: US$ 10 por mil

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SISTEMA = `Você é o analista do portal Gestão em Movimento, o BI da frota da Conlog (transportadora que opera para a Ambev e para a Seara). Quem pergunta é o Renan, gestor de indicadores da frota. Você enxerga o banco inteiro do portal (só leitura) e pode pesquisar na web.

Como responder
- Português do Brasil, direto e executivo. Comece pela resposta e pelo número; depois o porquê, em poucas linhas ou numa tabela curta em Markdown.
- Números no formato brasileiro (R$ 1.234.567; 3,21 km/L; 12,5%). Diga sempre o período e o recorte (unidade, projeto, operação) de cada número.
- Só afirme o que as consultas ou as fontes da web mostraram. Se o dado não existe no banco, diga isso e o que faltaria. Não invente valor, regra nem explicação.
- Quando cruzar duas fontes, diga quais foram. Diferença entre o previsto do Freightech e o remunerado da DRE fica "a confirmar" (imposto, regime tributário ou composição do planejamento); nunca a chame de erro.
- Dado externo (inflação, diesel da ANP, juros, câmbio, clima, notícia): pesquise na web, cite a fonte e o período, e deixe claro o que é do portal e o que é de fora. O foco é o dado do portal; o externo serve de contexto e comparação.
- Não exponha SQL na resposta, a menos que ele peça.

Como consultar o banco
- Ferramenta consultar_banco: só SELECT/WITH, uma consulta por vez, até 2.000 linhas. Agregue no SQL (sum, avg, group by) em vez de trazer linhas cruas.
- Você só enxerga o que tem permissão de ler; para descobrir o que existe: select table_name from information_schema.tables where table_schema = 'public' order by 1, e as colunas em information_schema.columns. Descubra colunas antes de supor.
- Tabelas sh_<slug> são abas do Google Sheets copiadas para o banco, com colunas de nome técnico; os rótulos originais estão em sh_base (slug, colunas jsonb com label e nome da coluna). Leia sh_base antes de usar uma sh_.
- Despesa na DRE (sh_dre_frota) vem NEGATIVA. Placa: compare sempre em Mercosul (o 5º caractere dígito vira letra: 0=A … 9=J). Unidades do portal: BLC Camboriú, CBA Cuiabá (T1 Empurrada, T1 WH Armazém, T2 CDD), CGR Rio de Janeiro, FLP Florianópolis, GRL Guarulhos, MCC Macacu (T1 Empurrada, T2 CDI), NFR Nova Friburgo, PIR Piraí, PLT Pelotas, RON Rondonópolis, ANG Anhanguera (Seara), GNA Goiânia.

Mapa do banco (o que cada painel lê)
- Remuneração Freightech: ft_rem_mes (operacao × unidade × vigência AAAA-MM; previsto pelo FT, não a fatura; colunas ativos, parados, km_teto, comb, manut, carroc, pneu, variavel, fixo_ativo, fixo_parado, equipe, total…); ft_layout + ft_linha (o FT cru desde 2022; leia por ft_obj(canal, tabela, ano, mes) → r jsonb, use (r->>'Coluna')::numeric); ft_book e ft_book_anexo (Book do Operador, regras oficiais; busque com ilike em texto).
- Financeiro: sh_dre_frota (orçado, remunerado e realizado por conta, unidade, nível 3, vigência), sh_dre_receita, sh_dre_ebitda.
- Km: sh_dispersao_km (km remunerado × rodado por projeto até ago/26), dispersao_km (set/26 em diante), dispersao_placa, dispersao_placa_viagem, balanco_massa, sh_dispersao_abertura.
- Combustível: ca_consumo_km_litro, ca_consumo_rs_litro, ca_consumo_rem_modelo (Km/L e R$/L remunerado × realizado, automáticos do ERP + FT), erp_abastecimentos (ERP), abast_api (Pró-Frotas, SUMA, Gasola), comb_anomalia, comb_correcao, seara_param, sh_seara_*.
- Manutenção, contratos e custos: carta_custos (Carta de Custos), vw_contrato_km (nota da VW por placa e faixa), custo_vigencia_mv, sh_manutencao, contratos_placa, locacao_* (Conferência de Locação Vamos).
- Operação e indicadores: elite_snapshot (Frota de Elite: indicadores do Ginfo por filial, vigência e escopo mes/ano), ginfo_snapshot (exports do Ginfo em JSON: ativos, preventivas, OS em aberto, checklist, blitz, documentos), indisponibilidade e indisp_snapshot/disp_snapshot (disponibilidade), snapshot (pneus do Prolog), pneu_pedido, sh_rpm_*, sh_term_* (Termômetro), sh_dpo, sh_demarco (auditorias), sh_metas, sh_mtdir_* (metas do diretor).
- Processos: fca (FCA: fato, causa, ação, responsável, prazo, status por unidade e vigência), planner (Planner Corporativo).
- Condução econômica (DriverPro): ce_scores_mensais, ce_diario (motorista identificado só por chave, sem nome nem CPF).
- Saúde dos robôs: saude_wf, saude_dia, saude_base.`;

const FERRAMENTAS = [
  {
    name: "consultar_banco",
    description:
      "Roda UMA consulta SELECT (ou WITH … SELECT) somente leitura no banco do portal e devolve as linhas em JSON (até 2.000). Use para todo número da resposta.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A consulta. Sem ponto e vírgula no meio." },
        motivo: { type: "string", description: "Em poucas palavras, o que esta consulta responde (aparece para o usuário)." },
      },
      required: ["sql", "motivo"],
      additionalProperties: false,
    },
    strict: true,
  },
  // pesquisa na web (servidor da Anthropic): inflação, ANP, juros, notícias…
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
];

async function usuarioDe(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON || SB_SERVICE, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.email ? String(u.email).toLowerCase() : null;
}

async function consultar(sql: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/assistente_sql`, {
    method: "POST",
    headers: { ...CAB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ p_sql: sql, p_max: 2000 }),
    signal: AbortSignal.timeout(60000),
  });
  const txt = await r.text();
  if (!r.ok) {
    let msg = txt;
    try { const j = JSON.parse(txt); msg = [j.message, j.details, j.hint].filter(Boolean).join(" · "); } catch (_) { /* texto cru */ }
    return { erro: msg.slice(0, 2000) };
  }
  return JSON.parse(txt);
}

async function registra(linha: Record<string, unknown>) {
  try {
    await fetch(`${SB_URL}/rest/v1/assistente_log`, {
      method: "POST",
      headers: { ...CAB_SERVICE, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(linha),
    });
  } catch (_) { /* o registro não pode derrubar a resposta */ }
}

function historicoDe(corpo: { mensagens?: unknown }) {
  const lista = Array.isArray(corpo.mensagens) ? corpo.mensagens : [];
  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of lista.slice(-20)) {
    const role = m && (m as { role?: string }).role;
    const content = m && (m as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      msgs.push({ role, content: content.slice(0, 20000) });
    }
  }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("método não aceito", { status: 405, headers: CORS });

  const email = await usuarioDe(req);
  if (!email) return new Response(JSON.stringify({ erro: "login inválido ou vencido" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  if (!DONOS.includes(email)) return new Response(JSON.stringify({ erro: "assistente restrito ao dono do portal" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });

  let corpo: { mensagens?: unknown; contexto?: unknown } = {};
  try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }
  const historico = historicoDe(corpo);
  if (!historico.length || historico[historico.length - 1].role !== "user") {
    return new Response(JSON.stringify({ erro: "sem pergunta" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return new Response(JSON.stringify({ erro: "falta o segredo ANTHROPIC_API_KEY na função" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const pergunta = historico[historico.length - 1].content;
  const contexto = typeof corpo.contexto === "string" ? corpo.contexto.slice(0, 2000) : "";
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // a data e o que está na tela vão como mensagem de sistema no fim, para não mexer no prefixo em cache
  // deno-lint-ignore no-explicit-any
  const messages: any[] = [...historico];
  messages.push({ role: "system", content: `Hoje é ${hoje}.${contexto ? " Na tela do painel: " + contexto : ""}` });

  const cliente = new Anthropic();
  const t0 = Date.now();
  const uso = { in: 0, cacheW: 0, cacheR: 0, out: 0, web: 0 };
  let consultas = 0;
  const enc = new TextEncoder();

  const corpoResposta = new ReadableStream({
    async start(ctrl) {
      const envia = (o: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch (_) { /* conexão fechada */ } };
      const vivo = setInterval(() => envia({ t: "ping" }), 15000);
      let erro: string | null = null;
      try {
        for (let volta = 0; volta < MAX_CONSULTAS + 2; volta++) {
          const stream = cliente.beta.messages.stream({
            model: MODELO,
            max_tokens: 32000,
            thinking: { type: "adaptive" },
            output_config: { effort: "high" },
            system: SISTEMA,
            tools: FERRAMENTAS,
            messages,
            cache_control: { type: "ephemeral" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            // deno-lint-ignore no-explicit-any
          } as any);
          stream.on("text", (d: string) => envia({ t: "txt", d }));
          // deno-lint-ignore no-explicit-any
          const msg: any = await stream.finalMessage();
          const u = msg.usage ?? {};
          uso.in += u.input_tokens ?? 0; uso.out += u.output_tokens ?? 0;
          uso.cacheW += u.cache_creation_input_tokens ?? 0; uso.cacheR += u.cache_read_input_tokens ?? 0;
          uso.web += (u.server_tool_use && u.server_tool_use.web_search_requests) ?? 0;
          // deno-lint-ignore no-explicit-any
          for (const b of msg.content as any[]) {
            if (b.type === "server_tool_use" && b.name === "web_search") envia({ t: "web", q: b.input && b.input.query ? String(b.input.query) : "" });
          }

          if (msg.stop_reason === "refusal") { envia({ t: "txt", d: "\n\n(O modelo não respondeu a esta pergunta.)" }); break; }
          if (msg.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: msg.content }); continue; }
          // deno-lint-ignore no-explicit-any
          const chamadas = msg.content.filter((b: any) => b.type === "tool_use");
          if (!chamadas.length) break;
          if (msg.stop_reason === "max_tokens") { envia({ t: "txt", d: "\n\n(A resposta passou do tamanho máximo.)" }); break; }

          messages.push({ role: "assistant", content: msg.content });
          // deno-lint-ignore no-explicit-any
          const resultados: any[] = [];
          for (const c of chamadas) {
            const sql = c.input && typeof c.input.sql === "string" ? c.input.sql : "";
            const motivo = c.input && typeof c.input.motivo === "string" ? c.input.motivo : "";
            if (c.name !== "consultar_banco" || !sql.trim()) {
              resultados.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "entrada inválida: mande { sql, motivo }" });
              continue;
            }
            if (consultas >= MAX_CONSULTAS) {
              resultados.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: `limite de ${MAX_CONSULTAS} consultas nesta pergunta: responda com o que já tem` });
              continue;
            }
            consultas++;
            envia({ t: "sql", sql, motivo });
            let r;
            try { r = await consultar(sql); } catch (e) { r = { erro: String((e as Error).message ?? e) }; }
            if (r.erro) {
              envia({ t: "res", erro: r.erro });
              resultados.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: r.erro });
            } else {
              envia({ t: "res", linhas: r.linhas, truncado: r.truncado });
              let txt = JSON.stringify(r);
              if (txt.length > MAX_RESULTADO) txt = txt.slice(0, MAX_RESULTADO) + `… [cortado: ${r.linhas} linhas; agregue mais no SQL]`;
              resultados.push({ type: "tool_result", tool_use_id: c.id, content: txt });
            }
          }
          messages.push({ role: "user", content: resultados });
        }
      } catch (e) {
        erro = String((e as Error).message ?? e).slice(0, 1000);
        envia({ t: "erro", msg: erro });
      } finally {
        clearInterval(vivo);
        const custo = (uso.in * PRECO.in + uso.cacheW * PRECO.cacheW + uso.cacheR * PRECO.cacheR + uso.out * PRECO.out) / 1e6 + uso.web * PRECO.busca;
        const seg = Math.round((Date.now() - t0) / 1000);
        if (!erro) envia({ t: "fim", consultas, web: uso.web, custo: Math.round(custo * 1000) / 1000, seg });
        await registra({
          email, pergunta: pergunta.slice(0, 4000), consultas, modelo: MODELO,
          tok_in: uso.in, tok_out: uso.out, tok_cache: uso.cacheR, custo_usd: Math.round(custo * 10000) / 10000, segundos: seg, erro,
        });
        ctrl.close();
      }
    },
  });

  return new Response(corpoResposta, { headers: { ...CORS, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
});

// ============================================================
// SAÚDE DO ECOSSISTEMA — coletor (Renan, 11/09/2026)
//
// "Uma visão geral dos painéis, robôs, etc., focada em como está rodando o
//  ecossistema: taxa de falha geral, por robô, por painel."
//
// Junta em quatro tabelas do Supabase o que hoje está espalhado:
//   1) as EXECUÇÕES dos workflows (API do GitHub Actions) → saude_wf + saude_dia
//   2) a IDADE de cada base de dados (sh_base, gviz/ginfo/elite_snapshot,
//      tabelas dos aplicativos)                            → saude_base
//   3) o INVENTÁRIO dos painéis (varredura dos index.html) → saude_painel
//
// Por que agregar aqui e não no painel: o HTML é público e não pode guardar
// token do GitHub, e o PostgREST não soma — o painel precisa receber pronto.
// Por dia, e não execução a execução, porque o Sheets Pedido roda a cada 5
// minutos (288 linhas/dia) e estouraria o limite de 1.000 linhas da leitura.
//
// Uso:  GEM_SUPABASE_SERVICE_KEY=... [GITHUB_TOKEN=...] [SAUDE_DIAS=3]
//       [SAUDE_SECO=1] node scripts/saude-robot.mjs
// ============================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const OWNER = 'fortesindicadores-byte', REPO = 'gestao-em-movimento';
const RAIZ = new URL('..', import.meta.url).pathname;
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const SECO = process.env.SAUDE_SECO === '1';          // não grava, só imprime
const DIAS = Math.max(1, +(process.env.SAUDE_DIAS || 3));
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
if (!KEY && !SECO) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }

const H = KEY ? { apikey: KEY, Authorization: 'Bearer ' + KEY } : {};
const HJ = { ...H, 'Content-Type': 'application/json' };
const AGORA = new Date().toISOString();
const br = n => (+n || 0).toLocaleString('pt-BR');

// ─────────────────────────────────────────────────────────────
// Robôs de CARGA: gravam em produção (Supabase ou commit no repo).
// A heurística "usa a service key" erra — auditorias como o Carta RLS Check
// também usam, só para ler. Por isso a lista é explícita; o que não está
// aqui é auditoria/inspeção, e o pages-build-deployment é o deploy do Pages.
const CARGA = new Set([
  'abastecimentos-robot.yml', 'ce-coletor.yml', 'conducao-robot.yml', 'conf-detalhe.yml',
  'conformidade-termometro.yml', 'contratos-robot.yml', 'disp-migracao.yml', 'elite-robot.yml',
  'ginfo-robot.yml', 'gviz-robot.yml', 'locacao-modelos-backfill.yml', 'pneus-loader.yml',
  'pneus-unifica-migra.yml', 'profrotas-robot.yml', 'qlik-robot.yml', 'ramos-build.yml',
  'saude-robot.yml', 'sheets-pedido.yml', 'sheets-robot.yml',
]);

// ─────────────────────────────────────────────────────────────
// 1. O que o REPOSITÓRIO declara (cron, dispatch, concorrência, alerta)
// ─────────────────────────────────────────────────────────────
function lerWorkflowsDoDisco() {
  const dir = join(RAIZ, '.github', 'workflows');
  const out = {};
  for (const arq of readdirSync(dir).filter(n => /\.ya?ml$/.test(n))) {
    const y = readFileSync(join(dir, arq), 'utf8');
    const linhas = y.split('\n');
    const crons = [], cronsOff = [];
    linhas.forEach(l => {
      const m = l.match(/^(\s*)(#\s*)?-\s*cron:\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/);
      if (!m) return;
      (m[2] ? cronsOff : crons).push(m[3].trim());
    });
    const nome = (y.match(/^name:\s*(.+)$/m) || [, arq])[1].trim().replace(/^['"]|['"]$/g, '');
    out[arq] = {
      wf: arq, nome,
      cron: crons.join(', ') || null,
      cron_off: cronsOff.join(', ') || null,
      dispatch: /workflow_dispatch:/.test(y),
      concorrencia: (y.match(/concurrency:[\s\S]{0,120}?group:\s*([^\n#]+)/) || [, ''])[1].trim() || null,
      alerta_email: /avisa-falha\.sh|RESEND_API_KEY/.test(y) && /if:\s*failure\(\)/.test(y),
      tipo: CARGA.has(arq) ? 'carga' : 'auditoria',
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 2. GitHub Actions
// ─────────────────────────────────────────────────────────────
const GH_BASE = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'gem-saude-robot',
};
let usaToken = !!GH_TOKEN;                 // 401 com token: o repo é público, tenta sem
async function gh(caminho) {
  for (const comToken of usaToken ? [true, false] : [false]) {
    const r = await fetch(`https://api.github.com${caminho}`, {
      headers: comToken ? { ...GH_BASE, Authorization: 'Bearer ' + GH_TOKEN } : GH_BASE,
    });
    if (r.ok) return r.json();
    const msg = (await r.text().catch(() => '')).slice(0, 200);
    if (comToken && (r.status === 401 || r.status === 403)) {
      console.warn(`token recusado (${r.status}) — seguindo sem autenticação: ${msg.slice(0, 90)}`);
      usaToken = false;
      continue;
    }
    throw new Error(`GitHub ${r.status} em ${caminho.split('?')[0]} — ${msg}`);
  }
  throw new Error('GitHub inacessível: ' + caminho.split('?')[0]);
}

// dia em horário de Brasília (o Renan olha o painel em BRT, não em UTC)
const diaBR = iso => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const segundos = (a, b) => {
  const s = (new Date(b) - new Date(a)) / 1000;
  return isFinite(s) && s >= 0 && s < 86400 * 2 ? Math.round(s) : 0;
};
const classe = r => {                         // como esta execução terminou
  if (r.status !== 'completed') return 'outros';
  if (r.conclusion === 'success') return 'ok';
  if (r.conclusion === 'failure' || r.conclusion === 'timed_out') return 'falha';
  if (r.conclusion === 'cancelled') return 'cancel';
  return 'outros';
};

// A API do Actions entrega no MÁXIMO 1.000 execuções por consulta, por mais
// páginas que se peça — e sem erro nenhum: a página 11 volta vazia. Com ~70
// execuções por dia, uma janela de 30 dias estoura o teto e os dias mais
// antigos sumiriam calados, fazendo a taxa de falha valer só as duas últimas
// semanas. Por isso a leitura é POR FATIA DE DATA: a fatia que bate no teto é
// partida ao meio e relida, até caber.
const dataISO = d => new Date(d).toISOString().slice(0, 10);

async function fatia(ini, fim) {                       // [ini, fim], datas YYYY-MM-DD
  const runs = [];
  for (let page = 1; page <= 10; page++) {
    const j = await gh(`/repos/${OWNER}/${REPO}/actions/runs`
      + `?per_page=100&page=${page}&created=${encodeURIComponent(ini + '..' + fim)}`);
    const lote = j.workflow_runs || [];
    runs.push(...lote);
    if (lote.length < 100) return { runs, cheio: false };
  }
  return { runs, cheio: true };                        // bateu no teto de 1.000
}

async function baixaIntervalo(ini, fim) {
  const { runs, cheio } = await fatia(ini, fim);
  const umDia = dataISO(ini) === dataISO(fim);
  if (!cheio || umDia) return runs;                    // coube (ou não dá para partir mais)
  const meio = dataISO(new Date((new Date(ini).getTime() + new Date(fim).getTime()) / 2));
  const esq = await baixaIntervalo(ini, meio);
  const dir = await baixaIntervalo(dataISO(new Date(new Date(meio).getTime() + 86400e3)), fim);
  return [...esq, ...dir];
}

async function baixaRuns(dias) {
  const desde = dataISO(Date.now() - dias * 86400e3);
  const ate = dataISO(Date.now() + 86400e3);           // hoje inteiro, em qualquer fuso
  const brutas = await baixaIntervalo(desde, ate);
  const vistas = new Set(), runs = [];                 // fatias vizinhas podem repetir
  for (const r of brutas) if (!vistas.has(r.id)) { vistas.add(r.id); runs.push(r); }
  return runs;
}

// ─────────────────────────────────────────────────────────────
// 3. Bases de dados monitoradas
// ─────────────────────────────────────────────────────────────
// Tabelas dos aplicativos: contagem + a coluna de data que existir.
const APPS = [
  { t: 'fca', r: 'FCA — fatos e ações', d: ['updated_at', 'created_at'], wf: null },
  { t: 'planner', r: 'Planner Corporativo', d: ['updated_at', 'created_at'], wf: null },
  { t: 'carta_custos', r: 'Carta de Custos', d: ['updated_at', 'created_at'], wf: 'contratos-robot.yml' },
  { t: 'indisponibilidade', r: 'Indisponibilidade (eventos)', d: ['updated_at', 'created_at'], wf: null },
  { t: 'disp_snapshot', r: 'Disponibilidade (foto diária)', d: ['dia'], wf: null },
  { t: 'ce_scores_mensais', r: 'Condução Econômica (mensal)', d: ['updated_at', 'created_at'], wf: 'conducao-robot.yml' },
  { t: 'ce_diario', r: 'Condução Econômica (diário)', d: ['dia'], wf: 'conducao-robot.yml' },
  { t: 'ce_app_log', r: 'DriverPro — acessos', d: ['criado_em', 'created_at'], wf: null },
  { t: 'hodometro_leitura', r: 'Hodômetro (Pró-Frotas)', d: ['created_at'], wf: 'profrotas-robot.yml' },
  { t: 'abastecimentos', r: 'Abastecimentos (ERP)', d: ['created_at', 'data'], wf: 'abastecimentos-robot.yml' },
  { t: 'locacao_benner', r: 'Locação (Benner)', d: ['updated_at', 'created_at'], wf: null },
  { t: 'access_log', r: 'Acessos ao portal', d: ['created_at'], wf: null },
];

async function conta(tabela) {
  const r = await fetch(`${SUPA}/rest/v1/${tabela}?select=*&limit=1`,
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) return { erro: `HTTP ${r.status}` };
  const n = +String(r.headers.get('content-range') || '').split('/')[1];
  return { n: isFinite(n) ? n : null };
}
async function ultimaData(tabela, colunas) {
  for (const c of colunas) {
    const r = await fetch(`${SUPA}/rest/v1/${tabela}?select=${c}&order=${c}.desc&limit=1`, { headers: H });
    if (!r.ok) continue;
    const j = await r.json().catch(() => []);
    if (Array.isArray(j) && j[0] && j[0][c]) {
      const v = String(j[0][c]);
      return v.length === 10 ? v + 'T12:00:00Z' : v;     // coluna `date` vira meio-dia
    }
  }
  return null;
}

async function coletaBases() {
  const out = [];
  // 3.1 bases manuais do Sheets (tabelas tipadas sh_*)
  try {
    const j = await (await fetch(`${SUPA}/rest/v1/sh_base?select=slug,nome,linhas,carregado_em,erro`, { headers: H })).json();
    (Array.isArray(j) ? j : []).forEach(b => out.push({
      chave: 'sh:' + b.slug, rotulo: b.nome || b.slug, grupo: 'Sheets · tabela', fonte: 'sh',
      linhas: b.linhas ?? null, atualizado_em: b.carregado_em || null, erro: b.erro || null,
      wf: 'sheets-robot.yml', visto_em: AGORA,
    }));
  } catch (e) { console.warn('sh_base:', e.message); }

  // 3.2 foto crua do gviz (é o que a maioria dos painéis ainda lê)
  try {
    const j = await (await fetch(`${SUPA}/rest/v1/gviz_snapshot?select=key,bytes,updated_at`, { headers: H })).json();
    (Array.isArray(j) ? j : []).forEach(b => {
      const k = String(b.key || '');
      const aba = (k.match(/\|s=([^|]*)/) || [, ''])[1] || (k.match(/\|g=([^|]*)/) || [, ''])[1] || k.slice(0, 12);
      out.push({
        chave: 'gviz:' + k.slice(0, 120), rotulo: aba || '(sem aba)', grupo: 'Sheets · foto gviz', fonte: 'gviz',
        linhas: null, atualizado_em: b.updated_at || null, erro: null, wf: 'gviz-robot.yml', visto_em: AGORA,
      });
    });
  } catch (e) { console.warn('gviz_snapshot:', e.message); }

  // 3.3 exports do Ginfo (Power BI)
  try {
    const j = await (await fetch(`${SUPA}/rest/v1/ginfo_snapshot?select=chave,updated_at`, { headers: H })).json();
    (Array.isArray(j) ? j : []).forEach(b => out.push({
      chave: 'ginfo:' + b.chave, rotulo: b.chave, grupo: 'Ginfo · Power BI', fonte: 'ginfo',
      linhas: null, atualizado_em: b.updated_at || null, erro: null, wf: 'ginfo-robot.yml', visto_em: AGORA,
    }));
  } catch (e) { console.warn('ginfo_snapshot:', e.message); }

  // 3.4 Frota de Elite / Gerot — uma linha por indicador (a mais recente)
  try {
    const j = await (await fetch(`${SUPA}/rest/v1/elite_snapshot?select=indicador,vigencia,escopo,updated_at&escopo=eq.mes`, { headers: H })).json();
    const porInd = {};
    (Array.isArray(j) ? j : []).forEach(r => {
      const a = porInd[r.indicador] || (porInd[r.indicador] = { vig: '', em: '', n: 0 });
      a.n++;
      const ord = String(r.vigencia || '').split('/').reverse().join('');
      if (ord > a.vig) a.vig = ord;
      if ((r.updated_at || '') > a.em) a.em = r.updated_at;
    });
    Object.entries(porInd).forEach(([ind, a]) => out.push({
      chave: 'elite:' + ind, rotulo: ind + (a.vig ? ` · até ${a.vig.slice(4)}/${a.vig.slice(0, 4)}` : ''),
      grupo: 'Frota de Elite · Gerot', fonte: 'elite', linhas: a.n,
      atualizado_em: a.em || null, erro: null,
      wf: ind === 'conformidade-detalhe' ? 'conf-detalhe.yml' : 'elite-robot.yml', visto_em: AGORA,
    }));
  } catch (e) { console.warn('elite_snapshot:', e.message); }

  // 3.5 tabelas dos aplicativos do portal
  for (const a of APPS) {
    const c = await conta(a.t);
    if (c.erro) { out.push({ chave: 'app:' + a.t, rotulo: a.r, grupo: 'Aplicativos do portal', fonte: 'app',
      linhas: null, atualizado_em: null, erro: c.erro, wf: a.wf, visto_em: AGORA }); continue; }
    out.push({ chave: 'app:' + a.t, rotulo: a.r, grupo: 'Aplicativos do portal', fonte: 'app',
      linhas: c.n, atualizado_em: await ultimaData(a.t, a.d), erro: null, wf: a.wf, visto_em: AGORA });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// 4. Painéis: varredura dos index.html + uso nos últimos 30 dias
// ─────────────────────────────────────────────────────────────
const WB = {
  '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8': 'DRE',
  '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM': 'Dispersão',
  '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A': 'Consumo',
  '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o': 'Termômetro',
  '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY': 'RPM',
  '10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac': 'Termômetro-tiers',
  '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE': 'Seara',
  '1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M': 'Frota de Elite',
  '1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k': 'Manutenção',
  '1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0': 'Tendência',
  '1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8': 'Metas Diretor',
  '1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY': 'Farol Semanal',
};
function achaPaineis(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.') || n === 'node_modules' || n === 'assets' || n === 'docs' || n === 'scripts' || n === 'etl') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) achaPaineis(p, out);
    else if (n === 'index.html') out.push(p);
  }
  return out;
}
const uniq = a => [...new Set(a)];
function inventarioPaineis() {
  const linhas = [];
  for (const f of achaPaineis(RAIZ).sort()) {
    const h = readFileSync(f, 'utf8');
    const pasta = relative(RAIZ, f).replace(/index\.html$/, '') || '/';
    const titulo = (h.match(/<title>([^<]*)/) || [, ''])[1].replace(/&amp;/g, '&').trim();
    const casca = /class="app"/.test(h) && /class="(side|board)/.test(h) ? 'padrão'
      : /class="app"/.test(h) ? 'app próprio'
        : (/class="header"/.test(h) ? 'antiga' : '—');
    const sheets = uniq((h.match(/[A-Za-z0-9_-]{44}/g) || []).filter(id => WB[id]).map(id => WB[id]));
    const sb = uniq((h.match(/\.from\('([a-z_]+)'\)/g) || []).map(s => s.replace(/\.from\('|'\)/g, '')))
      .filter(t => t !== 'fca_profiles');
    const rpc = uniq((h.match(/\.rpc\('([a-z_]+)'/g) || []).map(s => s.replace(/\.rpc\('|'/g, '')));
    const ginfo = uniq((h.match(/'(ativos|stress-test-frota|stress-test-empilhadeira|civf|preventivas|alinhamentos|os-em-aberto|checklist-031120|blitz-seguranca)'/g) || []).map(s => s.replace(/'/g, '')));
    const charts = uniq((h.match(/type:\s*'(bar|line|doughnut|pie|scatter)'/g) || []).map(s => s.replace(/type:\s*'|'/g, '')));
    linhas.push({
      pasta, titulo, casca,
      tema: /body\.claro|'claro'/.test(h) ? 'claro' : (/light-mode/.test(h) ? 'light-mode' : '—'),
      fontes: [...sheets.map(s => 'Sheets:' + s), ...sb.map(t => 'sb:' + t), ...rpc.map(r => 'rpc:' + r), ...ginfo.map(g => 'ginfo:' + g)],
      filtros: (h.match(/class="ms-wrap"/g) || []).length,
      graficos: charts.join('+') || '—',
      tabela: /table\.dre|class="dre/.test(h) ? 'dre' : (/tbl-section/.test(h) ? 'tbl-section' : '—'),
      exporta: [/excel-export\.js/.test(h) ? 'Excel/PNG' : '', /pdf-export\.js/.test(h) ? 'PDF' : '',
        /sortable-table\.js/.test(h) ? 'ordenação' : ''].filter(Boolean).join(' · ') || '—',
      build: (h.match(/name="build" content="(\d+)"/) || [, null])[1],
      acessos30: 0, visto_em: AGORA,
    });
  }
  return linhas;
}

// acessos por painel nos últimos 30 dias (só a contagem — nada de e-mail no log)
async function acessos30() {
  const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
  const por = {};
  for (let off = 0; off < 40000; off += 1000) {
    const r = await fetch(`${SUPA}/rest/v1/access_log?select=painel&created_at=gte.${desde}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) break;
    const j = await r.json().catch(() => []);
    if (!Array.isArray(j) || !j.length) break;
    j.forEach(x => { const k = String(x.painel || 'hub'); por[k] = (por[k] || 0) + 1; });
    if (j.length < 1000) break;
  }
  return por;
}

// ─────────────────────────────────────────────────────────────
// 5. Gravação
// ─────────────────────────────────────────────────────────────
async function grava(tabela, linhas, conflito) {
  if (SECO) { console.log(`  [seco] ${tabela}: ${linhas.length} linha(s)`); return; }
  for (let i = 0; i < linhas.length; i += 400) {
    const lote = linhas.slice(i, i + 400);
    const r = await fetch(`${SUPA}/rest/v1/${tabela}?on_conflict=${conflito}`, {
      method: 'POST',
      headers: { ...HJ, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote),
    });
    if (!r.ok) throw new Error(`${tabela}: HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);
  }
}
async function limpa(tabela, coluna, marca) {
  if (SECO) return;
  const r = await fetch(`${SUPA}/rest/v1/${tabela}?${coluna}=lt.${marca}`, {
    method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' },
  });
  if (!r.ok) console.warn(`limpeza de ${tabela}: HTTP ${r.status}`);
}

// ═════════════════════════════════════════════════════════════
console.log(`SAÚDE DO ECOSSISTEMA · janela de ${DIAS} dia(s)${SECO ? ' · MODO SECO' : ''}`);
console.log(`token do GitHub: ${GH_TOKEN ? 'sim' : 'NÃO (limite de 60 req/h por IP)'}\n`);

const disco = lerWorkflowsDoDisco();
console.log(`workflows no repositório: ${Object.keys(disco).length}`);

const wfApi = await gh(`/repos/${OWNER}/${REPO}/actions/workflows?per_page=100`).then(j => j.workflows || []);
const porPath = {};                                   // path → {id, name, state}
wfApi.forEach(w => { porPath[w.path] = w; });
console.log(`workflows no Actions:    ${wfApi.length}`);

const runs = await baixaRuns(DIAS);
const diasVistos = uniq(runs.map(r => diaBR(r.run_started_at || r.created_at))).sort();
console.log(`execuções lidas:         ${br(runs.length)}`);
console.log(`cobertura:               ${diasVistos[0] || '—'} → ${diasVistos[diasVistos.length - 1] || '—'}`
  + ` (${diasVistos.length} dia(s) com execução)\n`);

// ── agregação por workflow e por dia ──
const dias = {}, porWf = {};
for (const r of runs) {
  const wf = (r.path || '').replace('.github/workflows/', '') || r.name || 'desconhecido';
  const ini = r.run_started_at || r.created_at;
  const k = wf + '|' + diaBR(ini);
  const d = dias[k] || (dias[k] = { wf, dia: diaBR(ini), runs: 0, ok: 0, falha: 0, cancel: 0, outros: 0, dur_s: 0, dur_max: 0 });
  const c = classe(r), dur = segundos(ini, r.updated_at);
  d.runs++; d[c]++; d.dur_s += dur; d.dur_max = Math.max(d.dur_max, dur);
  (porWf[wf] || (porWf[wf] = [])).push(r);
}
Object.values(porWf).forEach(l => l.sort((a, b) => new Date(b.run_started_at || b.created_at) - new Date(a.run_started_at || a.created_at)));

// ── uma linha por workflow ──
const todosWf = uniq([...Object.keys(disco), ...wfApi.map(w => w.path.replace('.github/workflows/', '')), ...Object.keys(porWf)]);
const linhasWf = [];
for (const wf of todosWf) {
  const d = disco[wf] || {};
  const api = porPath['.github/workflows/' + wf] || wfApi.find(w => w.path === wf);
  let lista = porWf[wf] || [];
  // sem execução na janela: busca a última no histórico (poucos workflows caem aqui)
  if (!lista.length && api) {
    try { lista = (await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${api.id}/runs?per_page=5`)).workflow_runs || []; }
    catch (e) { /* workflow sem histórico */ }
  }
  const ult = lista[0] || null;
  // falhas seguidas e último sucesso — se a janela toda falhou, olha mais fundo
  let falhasSeq = 0, okEm = null;
  for (const r of lista) { if (classe(r) === 'ok') { okEm = r.run_started_at || r.created_at; break; } if (classe(r) === 'falha') falhasSeq++; }
  if (!okEm && falhasSeq > 0 && api) {
    try {
      const j = await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${api.id}/runs?per_page=30&status=success`);
      const s = (j.workflow_runs || [])[0];
      if (s) okEm = s.run_started_at || s.created_at;
    } catch (e) { /* segue sem o último sucesso */ }
  }
  linhasWf.push({
    wf, nome: d.nome || (api && api.name) || wf,
    estado: (api && api.state) || (disco[wf] ? 'active' : 'deleted'),
    tipo: wf === 'dynamic/pages/pages-build-deployment' || /pages-build/.test(wf) ? 'deploy' : (d.tipo || 'auditoria'),
    cron: d.cron || null, cron_off: d.cron_off || null,
    dispatch: !!d.dispatch, concorrencia: d.concorrencia || null, alerta_email: !!d.alerta_email,
    ult_id: ult ? ult.id : null,
    ult_status: ult ? ult.status : null,
    ult_conclusao: ult ? (ult.conclusion || null) : null,
    ult_em: ult ? (ult.run_started_at || ult.created_at) : null,
    ult_dur_s: ult ? segundos(ult.run_started_at || ult.created_at, ult.updated_at) : null,
    ult_url: ult ? ult.html_url : null,
    ok_em: okEm, falhas_seq: falhasSeq,
    atualizado_em: AGORA,
  });
}

// o deploy do Pages não tem arquivo no repositório — entra pelo que a API devolve
linhasWf.filter(l => /pages-build-deployment/.test(l.wf)).forEach(l => { l.tipo = 'deploy'; l.nome = l.nome || 'Deploy do GitHub Pages'; });

const cargas = linhasWf.filter(l => l.tipo === 'carga');
const semAlerta = cargas.filter(l => l.cron && !l.alerta_email);
const falhando = linhasWf.filter(l => l.falhas_seq > 0);
console.log(`robôs de carga: ${cargas.length} · com cron: ${cargas.filter(l => l.cron).length} · sem alerta de falha: ${semAlerta.length}`);
console.log(`falhando agora: ${falhando.length}${falhando.length ? ' → ' + falhando.map(l => `${l.wf} (${l.falhas_seq})`).join(', ') : ''}\n`);

const linhasDia = Object.values(dias);
const tot = linhasDia.reduce((a, d) => ({ runs: a.runs + d.runs, ok: a.ok + d.ok, falha: a.falha + d.falha }), { runs: 0, ok: 0, falha: 0 });
console.log(`na janela: ${br(tot.runs)} execuções · ${br(tot.ok)} ok · ${br(tot.falha)} falhas`
  + ` · taxa de sucesso ${tot.runs ? (tot.ok / tot.runs * 100).toFixed(1) : '—'}%\n`);

const bases = await coletaBases();
const velhas = bases.filter(b => b.atualizado_em && (Date.now() - new Date(b.atualizado_em)) > 48 * 3600e3);
console.log(`bases monitoradas: ${bases.length} · com mais de 48h: ${velhas.length} · com erro registrado: ${bases.filter(b => b.erro).length}`);

const paineis = inventarioPaineis();
const ac = await acessos30().catch(() => ({}));
paineis.forEach(p => {
  const pasta = p.pasta === '/' ? 'hub' : p.pasta.replace(/\/$/, '');
  p.acessos30 = ac[pasta] || ac[p.pasta] || ac[pasta + '/'] || 0;
});
console.log(`painéis inventariados: ${paineis.length} · na casca padrão: ${paineis.filter(p => p.casca === 'padrão').length}`);

// ── grava ──
console.log('\ngravando…');
await grava('saude_dia', linhasDia, 'wf,dia');
await grava('saude_wf', linhasWf, 'wf');
await grava('saude_base', bases, 'chave');
await grava('saude_painel', paineis, 'pasta');
await limpa('saude_wf', 'atualizado_em', AGORA);
await limpa('saude_base', 'visto_em', AGORA);
await limpa('saude_painel', 'visto_em', AGORA);
await limpa('saude_dia', 'dia', new Date(Date.now() - 120 * 86400e3).toISOString().slice(0, 10));
if (!SECO) {
  const r = await fetch(`${SUPA}/rest/v1/saude_coleta?on_conflict=id`, {
    method: 'POST', headers: { ...HJ, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: 1, coletado_em: AGORA, janela_dias: DIAS, runs_lidos: runs.length,
      obs: `${linhasWf.length} workflows · ${bases.length} bases · ${paineis.length} painéis` }]),
  });
  if (!r.ok) console.warn('saude_coleta: HTTP ' + r.status);
}
console.log('pronto.');

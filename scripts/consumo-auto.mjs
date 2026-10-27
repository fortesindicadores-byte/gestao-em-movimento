// ============================================================
// Consumo automático — Km/L · R$/L · Base Remunerado Modelo · Seara
// (Renan, 27/10/2026: "o consumo km/L e o R$/L agora, não poderíamos
//  automatizar, e ter ele em tempo real?" → "Pode ser D-1 · Seara o consumo
//  remunerado é sempre o mesmo · O preço a princípio também, mas pode criar um
//  campo de parâmetros seara … com vigência e campos · O km também tem rodado.
//  Subimos apenas o remunerado via import · Automatiza tudo daí")
//
// As abas que hoje são coladas à mão no workbook Consumo (Km/L, R$/L, Base
// Remunerado Modelo) e no da Seara (Combustível, Base Remunerado) nascem aqui,
// a partir do que já está no banco:
//
//   REALIZADO   erp_abastecimentos (o PowerShell do Renan, todo dia 05:00):
//               só diesel, por placa × mês × projeto — km rodado, litros, R$.
//   REMUNERADO  ft_linha (Freightech Robot, todo dia 05:00): consumo das placas
//               ativas (Caminhão/Van/CaminhãoAS; Cavalo da Empurrada e Insumos)
//               e as tabelas Combustível (preços ANP, operadora, crédito).
//   SEARA       realizado do ERP (Anhanguera); remunerado de seara_param (um
//               valor por modelo e vigência, que o Renan edita em
//               /parametros-seara/). O km remunerado por placa continua vindo
//               da importação das planilhas (aba Remunerado) — não entra aqui.
//
// AS REGRAS SÃO EXPLÍCITAS, NÃO UMA CÓPIA DA PLANILHA. Medido antes (27/10):
//   · litros e R$ da aba Km/L = ERP diesel por placa × mês (84–90% iguais ao
//     centavo; o resto é OS que mudou depois da colagem);
//   · Km/L Rem Médio da aba = média simples do "Consumo KM/L" das placas ATIVAS
//     do projeto no mês, no FT (59% iguais a ±0,01, 71% a ±0,05: a diferença é o
//     conjunto de placas do dia da colagem). Na Empurrada e nos Insumos é a média
//     do combustivelConsumoNeg dos cavalos ATIVO (bate em 25 de 27 meses; os dois
//     que não batem são abril, quando o FT zerou placas e a aba ignorou os zeros);
//   · Km/L Rem Modelo = média do consumo das placas ativas do MESMO modelo no
//     mesmo projeto e mês (o "cluster 1" do Book do Operador);
//   · R$/L Rem da aba Km/L não se reproduz de nenhum preço do FT (a aba ficou
//     em 6,0788 de mar a mai/26 em todas as unidades). Aqui vale a regra do Book:
//     menor entre ANP e operadora do DIESEL S10 + 5% do preço do ARLA, média das
//     quinzenas do mês; VAN usa o ROTA da unidade;
//   · a aba R$/L É o export Combustível do FT — vai como cópia, com as três
//     colunas que a planilha acrescenta (Unidade Benner, Concat, Vigência Data).
//
// Modos: ensaio (padrão: só lê e imprime a comparação aba × automático) e
// gravar (escreve em ca_<slug> e no registro consumo_auto_base). A CHAVE
// portal_flags.consumo_auto decide se os painéis leem as ca_* — o robô grava
// todo dia mesmo com ela desligada, para a comparação ficar no log.
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
const MODO = process.env.CONSUMO_MODO || 'ensaio';
const DESDE = process.env.CONSUMO_DESDE || '2026-01';         // 1º mês montado
const ENCERRADA = process.env.CONSUMO_ENCERRADA || '';       // 'S' = só OS encerradas
const SEMEAR = process.env.CONSUMO_SEMEAR !== '0';           // seara_param vazia ⇒ semente da aba
const GRAVA = MODO === 'gravar';
if (!KEY) { console.error('::error::GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const log = (...a) => console.log(...a);
const hoje = new Date();
const MES_ATUAL = hoje.toISOString().slice(0, 7);

async function api(path, init = {}) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
    if (r.ok) return r.status === 204 ? null : r.json().catch(() => null);
    const txt = (await r.text()).slice(0, 300);
    if (r.status < 500 || t >= 4) throw new Error(`HTTP ${r.status} ${path.slice(0, 80)} ${txt}`);
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}
// tudo, em páginas de 1.000 (o teto do PostgREST), por offset
async function tudo(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const p = await api(`${path}${path.includes('?') ? '&' : '?'}limit=1000&offset=${off}`);
    out.push(...(p || []));
    if (!p || p.length < 1000) break;
  }
  return out;
}
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
const r4 = v => v == null ? null : Math.round(v * 10000) / 10000;
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const norm = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const MERC = 'ABCDEFGHIJ';
const placaKey = s => { const p = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 4) + MERC[+p[4]] + p.slice(5) : p; };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mmaaaa = ym => ym.slice(5, 7) + '/' + ym.slice(0, 4);
// chave do modelo = o número (11.180, 2651, 17.190); sem número, o texto sem a marca
function chaveModelo(s) {
  const t = norm(s); const m = t.match(/(\d{1,2})[.,]?(\d{3})\b/);
  if (m) return m[1] + m[2];
  const m2 = t.match(/\b(\d{4})\b/); if (m2) return m2[1];
  return t.replace(/^(VW|VOLKSWAGEN|M\.?BENZ|MERCEDES[- ]BENZ|MB|SCANIA|VOLVO|IVECO|MAN|FORD|RENAULT|DAF)\b[\/\s-]*/, '').slice(0, 20);
}

// ── de-para de unidades ──────────────────────────────────────────────────
// UDC GUARULHOS fica FORA: é outra unidade do FT (preço e placas próprios) e o
// projeto UDC está inativo no ERP; somá-la ao ROTA - GRL puxava o preço de GRL
// para 5,49 (medido no 1º ensaio, 27/10/2026).
const FT_UNI = { 'CDD CAMBORIU': 'BLC', 'CDD CUIABA': 'CBA', 'CDD FLORIANOPOLIS': 'FLP', 'CDD GUARULHOS': 'GRL',
  'CDD NOVA FRIBURGO': 'NFR', 'CDD PELOTAS': 'PLT', 'CDD RIO DE JANEIRO': 'CGR', 'CDD RONDONOPOLIS': 'RON', 'MACACU': 'MCC',
  'CDD GOIANIA': 'GNA', 'CUIABA': 'CBA', 'PIRAI': 'PIR', 'LATA PIRAI': 'PIR' };
// como a aba Km/L escreve a unidade e o sufixo do projeto (GOI, não GNA)
const NOME_ABA = { BLC: 'BALNEARIO CAMBORIU', CBA: 'CUIABÁ', CGR: 'CAMPO GRANDE', FLP: 'FLORIANOPOLIS', GNA: 'GOIÂNIA', GOI: 'GOIÂNIA',
  MCC: 'CACHOEIRAS DE MACACU', PIR: 'PIRAÍ', GRL: 'GUARULHOS', NFR: 'NOVA FRIBURGO', PLT: 'PELOTAS', RON: 'RONDONOPOLIS' };
const SUF_ABA = c => c === 'GNA' ? 'GOI' : c;
const PREF_CANAL = { ROTA: 'ROTA', AS: 'AUTO SERVIÇO', EMPURRADA: 'EMPURRADA', INSUMOS: 'INSUMOS' };
const FT = {
  ROTA: { frota: ['Caminhao'], van: 'Van', comb: 'CombustivelRota' },
  AS: { frota: ['CaminhaoAS'], comb: 'CombustivelListaAS' },
  EMPURRADA: { frota: ['CavaloEmpurrada'], comb: 'CombustivelEmpurrada' },
  INSUMOS: { frota: ['CavaloInsumos'], comb: 'CombustivelInsumos' },
};
const OPERACAO = 'OPERAÇÕES DEDICADAS AMBEV', EMPRESA = 'Concórdia Logistica S/A';
const ANG = r => /ANHANGUERA/.test(norm(r.filial)) || /- ANG\b/.test(norm(r.projeto_os));

// ── 1) o que já está no banco ─────────────────────────────────────────────
const ALVOS = ['consumo_km_litro', 'consumo_rs_litro', 'consumo_rem_modelo', 'seara_combustivel', 'seara_remunerado', 'seara_comb_vig'];
log(`Consumo automático · modo ${MODO} · desde ${DESDE} · hoje ${MES_ATUAL}${ENCERRADA ? ' · só OS encerradas' : ''}\n`);
const shBase = Object.fromEntries((await api('sh_base?select=slug,colunas,linhas,erro,carregado_em&slug=in.(' + ALVOS.join(',') + ')')).map(b => [b.slug, b]));
for (const s of ALVOS) if (!shBase[s]) log(`::warning::sh_base sem a base ${s} — o layout dela vem do sheets-bases.mjs`);
const colsDe = s => (shBase[s]?.colunas || []).slice().sort((a, b) => a.i - b.i);
const colPorLabel = (s, ...labels) => { const cs = colsDe(s); for (const l of labels) { const c = cs.find(c => norm(c.label) === norm(l)); if (c) return c.col; } return null; };
const aba = {};
for (const s of ALVOS) aba[s] = shBase[s] ? await tudo(`sh_${s}?select=*&order=linha.asc`) : [];
log('abas no banco: ' + ALVOS.map(s => `${s} ${aba[s].length}`).join(' · '));

// ERP: só o que vira consumo
const ini = DESDE + '-01';
let erp = await tudo(`erp_abastecimentos?select=ordem_servico,data,placa,placa_origem,filial,projeto_os,modelo,hodometro,km_rodado,litros,media_km_l,valor,tipo_combustivel,encerrada&data=gte.${ini}&data=lte.${hoje.toISOString().slice(0, 10)}&order=data.asc`);
log(`ERP: ${erp.length} abastecimentos desde ${ini}`);
const semTipo = erp.filter(r => !r.tipo_combustivel).length;
if (semTipo) log(`  ${semTipo} sem tipo de combustível (entram como diesel)`);
if (ENCERRADA) { const n = erp.length; erp = erp.filter(r => r.encerrada === ENCERRADA); log(`  só encerradas: ${erp.length} de ${n}`); }
const diesel = erp.filter(r => !r.tipo_combustivel || (/DIESEL/.test(norm(r.tipo_combustivel)) && !/ARLA/.test(norm(r.tipo_combustivel))));
log(`  diesel: ${diesel.length} (fora: ${erp.length - diesel.length} de Arla/gasolina/outros)`);
const tipoAba = t => { const n = norm(t); if (!n) return 'DIESEL S10'; if (/ADIT/.test(n)) return 'DIESEL ADITIVADO'; if (/S10/.test(n)) return 'DIESEL S10'; return 'DIESEL'; };

// ativos manuais da Seara (modelo por placa) e a frota do Ginfo (tipo de veículo e modelo por placa)
const ativosManual = Object.fromEntries((await tudo('ativos_manual?select=placa,modelo,filial,projeto,tipo_veiculo')).map(a => [placaKey(a.placa), a]));
const ginfo = {};
try {
  const g = await api('ginfo_snapshot?chave=eq.ativos&select=data');
  ((g && g[0] && g[0].data) || []).forEach(a => { const k = placaKey(a.Placa || a.placa); if (k) ginfo[k] = { tipo: a['Tipo Veículo'] || a['Tipo Veiculo'] || null, modelo: a.Modelo || null, marca: a.Marca || null }; });
} catch (e) { log('::warning::ginfo_snapshot ativos: ' + e.message); }
log(`ativos: Ginfo ${Object.keys(ginfo).length} placas · manuais (Seara) ${Object.keys(ativosManual).length}`);

// ── 2) Freightech ─────────────────────────────────────────────────────────
const anoDesde = +DESDE.slice(0, 4);
async function ftTabela(canal, tabela) {
  const lay = await tudo(`ft_layout?select=vigencia,ano,mes,quinzena,colunas&canal=eq.${canal}&tabela=eq.${tabela}&ano=gte.${anoDesde}`);
  if (!lay.length) { log(`::warning::FT ${canal}/${tabela}: sem vigência em ft_layout`); return []; }
  const idx = {}; lay.forEach(l => { const m = {}; (l.colunas || []).forEach((c, i) => { m[norm(c)] = i; }); idx[l.vigencia] = m; });
  const rows = await tudo(`ft_linha?select=vigencia,ano,mes,quinzena,unidade,placa,dados&canal=eq.${canal}&tabela=eq.${tabela}&ano=gte.${anoDesde}&order=vigencia,linha`);
  return rows.map(r => {
    const m = idx[r.vigencia] || {};
    const g = (...labels) => { for (const l of labels) { const i = m[norm(l)]; if (i != null) return r.dados[i]; } return undefined; };
    return { ...r, ym: `${r.ano}-${String(r.mes).padStart(2, '0')}`, g, cols: lay.find(l => l.vigencia === r.vigencia)?.colunas || [] };
  });
}
const ativoFT = v => /^(TRUE|ATIVO|SIM|VERDADEIRO|1)$/.test(norm(v));
// frota: uma linha por placa × quinzena, com projeto da aba, consumo e modelo
const frota = [];      // {ym, q, canal, proj, uni(cod), placa, consumo, modelo, ativo, bench}
const vanPlacas = new Set();
for (const [canal, cfg] of Object.entries(FT)) {
  for (const tab of cfg.frota) {
    const rows = await ftTabela(canal, tab);
    let semUni = 0;
    rows.forEach(r => {
      const cod = FT_UNI[norm(r.unidade)]; if (!cod) { semUni++; return; }
      frota.push({ ym: r.ym, q: r.quinzena, canal, proj: `${PREF_CANAL[canal]} - ${SUF_ABA(cod)}`, uni: cod,
        placa: placaKey(r.placa || r.g('Placa', 'placa')), consumo: num(r.g('Consumo KM/L', 'consumoKMPorLitro', 'combustivelConsumoNeg')),
        modelo: r.g('Modelo', 'modelo', 'modeloEmpurrada') || '', ativo: ativoFT(r.g('Ativo', 'ativo')),
        bench: num(r.g('Benchmark Consumo', 'bmConsumo', 'combustivelConsumoBenchmark')) });
    });
    log(`FT ${canal}/${tab}: ${rows.length} linhas${semUni ? ` · ${semUni} de unidade fora do de-para` : ''}`);
  }
  if (cfg.van) {
    const rows = await ftTabela(canal, cfg.van);
    rows.forEach(r => {
      const cod = FT_UNI[norm(r.unidade)]; if (!cod) return;
      const placa = placaKey(r.placa || r.g('placa', 'Placa')); vanPlacas.add(placa);
      frota.push({ ym: r.ym, q: r.quinzena, canal: 'VAN', proj: `VAN - ${SUF_ABA(cod)}`, uni: cod, placa,
        consumo: num(r.g('consumoKMPorLitro', 'Consumo KM/L')), modelo: r.g('modelo', 'Modelo') || '', ativo: ativoFT(r.g('ativo', 'Ativo')), bench: num(r.g('bmConsumo')) });
    });
    log(`FT ${canal}/${cfg.van}: ${rows.length} linhas · ${vanPlacas.size} placas de van`);
  }
}
// preços: uma linha por unidade × quinzena × tipo
const precos = [];     // {ym, q, canal, uni, proj, tipo, anp, op, cred, row}
for (const [canal, cfg] of Object.entries(FT)) {
  const rows = await ftTabela(canal, cfg.comb);
  rows.forEach(r => {
    const cod = FT_UNI[norm(r.unidade)]; if (!cod) return;
    const tipo = norm(String(r.g('tipoCombustivelShared', 'descricao') || '').replace(/^.*?:/, ''));
    precos.push({ ym: r.ym, q: r.quinzena, canal, uni: cod, proj: `${PREF_CANAL[canal]} - ${SUF_ABA(cod)}`, tipo,
      anp: num(r.g('precoAnp')), op: num(r.g('precoOperadora')), cred: num(r.g('precoCreditoImpostos')), row: r });
  });
  log(`FT ${canal}/${cfg.comb}: ${rows.length} linhas`);
}

// ── 3) o remunerado por projeto × mês, placa × mês e modelo ───────────────
const porProjMes = new Map();     // proj|ym → {consumos[], placas:Map(placa→{consumos[], ativo, modelo})}
frota.forEach(f => {
  const k = f.proj + '|' + f.ym;
  if (!porProjMes.has(k)) porProjMes.set(k, { consumos: [], placas: new Map() });
  const g = porProjMes.get(k);
  let p = g.placas.get(f.placa); if (!p) { p = { consumos: [], ativo: false, modelo: f.modelo, bench: f.bench }; g.placas.set(f.placa, p); }
  if (f.ativo) { p.ativo = true; if (f.consumo > 0) { p.consumos.push(f.consumo); g.consumos.push(f.consumo); } }
  if (!p.modelo && f.modelo) p.modelo = f.modelo;
});
// Km/L Rem Médio do projeto no mês: média simples das placas ATIVAS com consumo > 0 (VAN: a própria placa)
const remMedio = (proj, ym, placa) => {
  const g = porProjMes.get(proj + '|' + ym); if (!g) return null;
  if (proj.startsWith('VAN')) { const p = g.placas.get(placa); return p && p.consumos.length ? r2(media(p.consumos)) : null; }
  return g.consumos.length ? r2(media(g.consumos)) : null;
};
// Km/L Rem Modelo: média das placas ativas do mesmo modelo no CANAL × mês, em todas
// as unidades (é assim que a aba Base Remunerado Modelo faz: "Projeto c/ Van" é o
// canal — AS, ROTA, VAN, EMPURRADA, INSUMOS — e a média do ATEGO em BLC é a mesma de CGR).
// Medido no 1º ensaio: por projeto a média saía 2,93 onde a aba diz 3,32.
const porCanalMes = new Map();    // canal|ym → Map(chaveModelo → [médias das placas])
porProjMes.forEach((g, k) => {
  const [proj, ym] = k.split('|'); const canal = proj.split(' - ')[0]; const kk = canal + '|' + ym;
  if (!porCanalMes.has(kk)) porCanalMes.set(kk, new Map());
  const m = porCanalMes.get(kk);
  g.placas.forEach(x => { if (!x.consumos.length) return; const ch = chaveModelo(x.modelo); if (!ch) return; if (!m.has(ch)) m.set(ch, []); m.get(ch).push(media(x.consumos)); });
});
const remModelo = (proj, ym, placa, modeloErp) => {
  const g = porProjMes.get(proj + '|' + ym); const p = g && g.placas.get(placa);
  const ch = chaveModelo(p ? p.modelo : modeloErp); if (!ch) return null;
  const m = porCanalMes.get(proj.split(' - ')[0] + '|' + ym); const vals = m && m.get(ch);
  return vals && vals.length ? r2(media(vals)) : null;
};
const ativoAba = (proj, ym, placa) => {
  const g = porProjMes.get(proj + '|' + ym); const p = g && g.placas.get(placa);
  if (!p) return 'Fora FT';
  return p.ativo ? 'VERDADEIRO' : 'FALSO';
};
// R$/L remunerado da aba Km/L = precoOperadora do DIESEL S10, média das quinzenas do
// mês (é a MESMA coluna W que o painel R$/L lê na aba R$/L como preço remunerado — assim
// Km/L e R$/L falam o mesmo número). VAN = ROTA da unidade. A regra do Book (min(ANP,
// operadora) + 5% de Arla) foi testada e fica mais longe da aba do que a operadora pura.
const precoProjMes = new Map();
{
  const acc = new Map();
  precos.forEach(p => { if (!/S10/.test(p.tipo)) return; const v = p.op ?? p.anp; if (v == null) return; const k = p.proj + '|' + p.ym; if (!acc.has(k)) acc.set(k, []); acc.get(k).push(v); });
  acc.forEach((v, k) => precoProjMes.set(k, r4(media(v))));
}
const precoRem = (proj, ym) => precoProjMes.get(proj + '|' + ym) ?? (proj.startsWith('VAN') ? precoProjMes.get(proj.replace(/^VAN/, 'ROTA') + '|' + ym) : null) ?? null;

// ── 4) o realizado: ERP por placa × mês × projeto ─────────────────────────
function projetoAba(r) {
  let p = norm(r.projeto_os).replace(/\s*\(INATIVO\)\s*$/, '');
  p = p.replace(/^ROTA \(VAN\) - /, 'VAN - ').replace(/^UDC - /, 'ROTA - ');
  const m = p.match(/^(ROTA|AUTO SERVICO|VAN|EMPURRADA|INSUMOS) - ([A-Z]{3})$/); if (!m) return null;
  const pref = m[1] === 'AUTO SERVICO' ? 'AUTO SERVIÇO' : m[1]; const cod = m[2];
  if (!NOME_ABA[cod]) return null;
  if (pref === 'ROTA' && vanPlacas.has(placaKey(r.placa))) return { proj: 'VAN - ' + cod, cod };
  return { proj: pref + ' - ' + cod, cod };
}
// ── KM RODADO: três candidatos, porque o ERP não tem um só ──────────────
//   soma   Σ km_rodado (mf.DESGASTE de cada abastecimento; um hodômetro digitado
//          errado vira 2 milhões de km num mês — GOI set/26 no 1º ensaio);
//   hodo   hodômetro máximo − mínimo do mês;
//   media  Σ (litros × media_km_l do abastecimento).
//   todos  Σ km_rodado de TODOS os abastecimentos da placa (diesel + Arla + outros).
// O ensaio imprime quanto cada um bate com a aba. Medido em 27/10/2026 (4.525
// placa-mês): todos 56% iguais / 61% a ±2%; soma do diesel 48% / 52%; Σ litros×média
// 47%; hodômetro 3%. CONSUMO_KM escolhe (padrão: todos, com guarda — abastecimento com
// km_rodado acima de KM_MAX_FILL ou negativo fica fora).
const KM_MODO = process.env.CONSUMO_KM || 'todos';
const KM_MAX_FILL = +(process.env.CONSUMO_KM_MAX || 3000);
function somaKm(a, r) {
  const kr = num(r.km_rodado); const mk = num(r.media_km_l); const lt = num(r.litros) || 0;
  a.kmSoma = (a.kmSoma || 0) + (kr || 0);
  if (kr != null && kr >= 0 && kr <= KM_MAX_FILL) a.kmGuard = (a.kmGuard || 0) + kr; else if (kr) a.kmFora = (a.kmFora || 0) + 1;
  if (mk != null && mk > 0 && mk < 30) a.kmMedia = (a.kmMedia || 0) + lt * mk;
}
function kmDe(a) {
  const hodo = (a.hodoMax != null && a.hodoMin != null) ? a.hodoMax - a.hodoMin : null;
  a.kmHodo = hodo;
  if (KM_MODO === 'hodo') return hodo ?? a.kmGuard ?? 0;
  if (KM_MODO === 'media') return a.kmMedia ?? a.kmGuard ?? 0;
  if (KM_MODO === 'soma-crua') return a.kmSoma || 0;
  if (KM_MODO === 'todos') return a.kmTodos ?? a.kmGuard ?? 0;
  return a.kmGuard || 0;
}
const real = new Map();           // proj|ym|placa → agregado
const foraProj = new Map();
const angRows = [];
const dieselSet = new Set(diesel);
// o laço passa por TODOS os abastecimentos: litros e R$ só do diesel; o km de todos
// (candidato "todos": o Arla abastecido junto repete o desgaste do mesmo hodômetro)
erp.forEach(r => {
  const ym = String(r.data).slice(0, 7); if (ym < DESDE) return;
  const ehDiesel = dieselSet.has(r);
  if (ANG(r)) { angRows.push(r); return; }
  const pj = projetoAba(r); if (!pj) { if (ehDiesel) { const k = norm(r.projeto_os) || '(vazio)'; foraProj.set(k, (foraProj.get(k) || 0) + 1); } return; }
  const placa = placaKey(r.placa); const k = pj.proj + '|' + ym + '|' + placa;
  if (!real.has(k)) real.set(k, { proj: pj.proj, cod: pj.cod, ym, placa, placaOrig: r.placa_origem || r.placa, litros: 0, valor: 0, n: 0, tipos: {}, modelos: {}, hodoMin: null, hodoMax: null });
  const a = real.get(k);
  const kr = num(r.km_rodado); if (kr != null && kr >= 0 && kr <= KM_MAX_FILL) a.kmTodos = (a.kmTodos || 0) + kr;
  const h = num(r.hodometro); if (h != null && h > 0) { a.hodoMin = a.hodoMin == null ? h : Math.min(a.hodoMin, h); a.hodoMax = a.hodoMax == null ? h : Math.max(a.hodoMax, h); }
  if (!ehDiesel) return;
  somaKm(a, r); a.litros += num(r.litros) || 0; a.valor += num(r.valor) || 0; a.n++;
  const t = tipoAba(r.tipo_combustivel); a.tipos[t] = (a.tipos[t] || 0) + (num(r.litros) || 0);
  if (r.modelo) a.modelos[r.modelo] = (a.modelos[r.modelo] || 0) + 1;
});
[...real.keys()].forEach(k => { if (!real.get(k).n) real.delete(k); });   // só Arla no mês: não é linha da aba
real.forEach(a => { a.km = kmDe(a); });
log(`realizado Ambev: ${real.size} placa-mês em ${new Set([...real.values()].map(a => a.proj)).size} projetos · Seara (ANG): ${angRows.length} abastecimentos · km pelo modo "${KM_MODO}"`);
if (foraProj.size) log('  fora da Km/L (projeto sem lugar na aba): ' + [...foraProj.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '));
const maisFreq = o => { let b = null, bn = -1; Object.entries(o).forEach(([k, n]) => { if (n > bn) { b = k; bn = n; } }); return b; };

// ── 5) as abas montadas ───────────────────────────────────────────────────
const nova = {};
// 5a) Km/L (layout de sh_consumo_km_litro)
{
  const L = colsDe('consumo_km_litro'); const linhas = [];
  [...real.values()].sort((a, b) => (a.ym + a.proj + a.placa).localeCompare(b.ym + b.proj + b.placa)).forEach(a => {
    const modeloErp = maisFreq(a.modelos) || ''; const g = porProjMes.get(a.proj + '|' + a.ym); const pf = g && g.placas.get(a.placa);
    const kmlRem = remMedio(a.proj, a.ym, a.placa), kmlMod = remModelo(a.proj, a.ym, a.placa, modeloErp), rslRem = precoRem(a.proj, a.ym);
    const kmlReal = a.litros > 0 ? a.km / a.litros : null, rslReal = a.litros > 0 ? a.valor / a.litros : null, rskmReal = a.km > 0 ? a.valor / a.km : null;
    const rskmRem = (rslRem != null && kmlRem > 0) ? rslRem / kmlRem : null;
    const [y, m] = a.ym.split('-');
    const o = {
      vigencia: mmaaaa(a.ym), vigencia_orig: `${a.ym}-01`,
      rs_km_rem: r4(rskmRem), rs_km_real: r4(rskmReal), d_rs_km: (rskmRem != null && rskmReal != null) ? r4(rskmReal - rskmRem) : null,
      km_l_rem_medio: kmlRem, km_l_rem_modelo: kmlMod, km_l_real: r4(kmlReal), d_km_l: (kmlRem != null && kmlReal != null) ? r4(kmlReal - kmlRem) : null,
      rs_l_rem: rslRem, rs_l_real: r4(rslReal), d_rs_l: (rslRem != null && rslReal != null) ? r4(rslReal - rslRem) : null,
      ativo: ativoAba(a.proj, a.ym, a.placa), operacao: OPERACAO, empresa: EMPRESA, projeto: a.proj, unidade: NOME_ABA[a.cod] || a.cod,
      placa: a.placaOrig, mes_inicio_os: MESES[+m - 1], ano_inicio_os: +y, modelo: modeloErp || (pf && pf.modelo) || (ginfo[a.placa] && ginfo[a.placa].modelo) || null,
      tipo_combustivel: maisFreq(a.tipos), tipo_veiculo: (ginfo[a.placa] && ginfo[a.placa].tipo) || null,
      km_rodado_horas_trabalhadas: r2(a.km), qtd_total_de_litros: r2(a.litros), valor_medio_litro: r4(rslReal), totas_rs: r2(a.valor),
    };
    linhas.push(o);
  });
  nova.consumo_km_litro = soColunas(linhas, L);
}
// 5b) R$/L = cópia do export Combustível do FT (+ Unidade Benner, Concat, Vigência Data),
// SÓ as linhas de DIESEL S10 — a aba tem 2 linhas por unidade × mês (as duas quinzenas),
// e o painel R$/L tira a média do precoOperadora delas
{
  const L = colsDe('consumo_rs_litro'); const linhas = [];
  precos.filter(p => /S10/.test(p.tipo)).sort((a, b) => (a.ym + a.q + a.proj + a.tipo).localeCompare(b.ym + b.q + b.proj + b.tipo)).forEach(p => {
    const r = p.row; const o = { vigencia: mmaaaa(p.ym), unidade_benner: p.proj, concat: p.proj + '|' + mmaaaa(p.ym), vigencia_data: mmaaaa(p.ym), vigencia_data_3: `${p.ym}-01`, vigencia_orig: r.vigencia };
    // as demais colunas pelo rótulo do próprio FT (as sh_ foram geradas do export dele)
    L.forEach(c => { if (o[c.col] !== undefined) return; const v = r.g(c.label); if (v !== undefined) o[c.col] = c.tipo === 'number' ? num(v) : (v == null ? null : String(v)); });
    if (o.tipocombustivelshared != null && !/:/.test(o.tipocombustivelshared)) o.tipocombustivelshared = 'Descrição: ' + o.tipocombustivelshared;
    if (o.tipocombustivelshared == null && r.g('descricao') != null) o.tipocombustivelshared = 'Descrição: ' + r.g('descricao');
    if (o.creditosobreativos == null && r.g('creditoImposto') != null) o.creditosobreativos = String(r.g('creditoImposto'));
    linhas.push(o);
  });
  nova.consumo_rs_litro = soColunas(linhas, L);
}
// 5c) Base Remunerado Modelo: uma linha por placa × quinzena com a média do modelo no
// canal ("Projeto c/ Van" = AS, ROTA, VAN, EMPURRADA, INSUMOS, como na aba)
{
  const L = colsDe('consumo_rem_modelo'); const linhas = [];
  frota.slice().sort((a, b) => (a.ym + a.q + a.proj + a.placa).localeCompare(b.ym + b.q + b.proj + b.placa)).forEach(f => {
    linhas.push({ vigencia: mmaaaa(f.ym), projeto_c_van: f.canal, unidade_benner: f.proj, concat: f.proj + '|' + mmaaaa(f.ym), vigencia_data: mmaaaa(f.ym), vigencia_data_4: `${f.ym}-01`,
      modelo: f.modelo || null, vigencia_orig: `${f.canal === 'VAN' ? 'ROTA' : f.canal}_${f.q}_${+f.ym.slice(5, 7)}_${f.ym.slice(0, 4)}`, unidade_cnpj: null, unidade_nome: null, placa: f.placa,
      media_modelo: remModelo(f.proj, f.ym, f.placa, f.modelo) });
  });
  nova.consumo_rem_modelo = soColunas(linhas, L);
}
// 5d) Seara · Combustível (realizado da Anhanguera no ERP)
const searaCombAba = aba.seara_combustivel;
const ultimaDaPlaca = new Map(); searaCombAba.forEach(r => { const k = placaKey(r.placa); if (!ultimaDaPlaca.has(k) || (r.vigencia_orig || r.vigencia || '') >= (ultimaDaPlaca.get(k).vigencia_orig || '')) ultimaDaPlaca.set(k, r); });
const moda = (rows, col) => maisFreq(rows.reduce((o, r) => { if (r[col] != null && r[col] !== '') o[r[col]] = (o[r[col]] || 0) + 1; return o; }, {}));
const mesLongo = searaCombAba.some(r => /^[a-zç]{5,}$/i.test(String(r.mes_inicio_os || '')));
const defSeara = { empresa: moda(searaCombAba, 'empresa') || 'SEARA', projeto: moda(searaCombAba, 'projeto') || 'DISTRIBUIÇÃO URBANA - ANG', unidade: moda(searaCombAba, 'unidade') || 'ANHANGUERA', pode_comeca: moda(searaCombAba, 'pode_comeca') };
const searaReal = new Map(); let searaSemModelo = 0;
angRows.forEach(r => {
  const ym = String(r.data).slice(0, 7); const placa = placaKey(r.placa); const k = ym + '|' + placa; const ehDiesel = dieselSet.has(r);
  if (!searaReal.has(k)) searaReal.set(k, { ym, placa, placaOrig: r.placa_origem || r.placa, litros: 0, valor: 0, n: 0, tipos: {}, modelos: {}, hodoMin: null, hodoMax: null });
  const a = searaReal.get(k);
  const kr = num(r.km_rodado); if (kr != null && kr >= 0 && kr <= KM_MAX_FILL) a.kmTodos = (a.kmTodos || 0) + kr;
  const h = num(r.hodometro); if (h != null && h > 0) { a.hodoMin = a.hodoMin == null ? h : Math.min(a.hodoMin, h); a.hodoMax = a.hodoMax == null ? h : Math.max(a.hodoMax, h); }
  if (!ehDiesel) return;
  somaKm(a, r); a.litros += num(r.litros) || 0; a.valor += num(r.valor) || 0; a.n++;
  const t = tipoAba(r.tipo_combustivel); a.tipos[t] = (a.tipos[t] || 0) + (num(r.litros) || 0); if (r.modelo) a.modelos[r.modelo] = (a.modelos[r.modelo] || 0) + 1;
});
[...searaReal.keys()].forEach(k => { if (!searaReal.get(k).n) searaReal.delete(k); });
searaReal.forEach(a => { a.km = kmDe(a); });
const modeloSeara = a => (ativosManual[a.placa] && ativosManual[a.placa].modelo) || (ultimaDaPlaca.get(a.placa) || {}).modelo || maisFreq(a.modelos) || null;
{
  const L = colsDe('seara_combustivel'); const linhas = [];
  [...searaReal.values()].sort((a, b) => (a.ym + a.placa).localeCompare(b.ym + b.placa)).forEach(a => {
    const u = ultimaDaPlaca.get(a.placa) || {}; const am = ativosManual[a.placa] || {}; const [y, m] = a.ym.split('-');
    const modelo = modeloSeara(a); if (!modelo) searaSemModelo++;
    linhas.push({ vigencia: mmaaaa(a.ym), pode_comeca: u.pode_comeca ?? defSeara.pode_comeca, empresa: u.empresa || defSeara.empresa, projeto: u.projeto || am.projeto || defSeara.projeto,
      unidade: u.unidade || defSeara.unidade, placa: u.placa || a.placaOrig, mes_inicio_os: mesLongo ? MESES_LONGO[+m - 1] : MESES[+m - 1], ano_inicio_os: +y, modelo,
      tipo_combustivel: u.tipo_combustivel || maisFreq(a.tipos), tipo_veiculo: u.tipo_veiculo || am.tipo_veiculo || null,
      km_rodado_horas_trabalhadas: r2(a.km), qtd_total_de_litros: r2(a.litros), valor_medio_litro: a.litros > 0 ? r4(a.valor / a.litros) : null, totas_rs: r2(a.valor) });
  });
  nova.seara_combustivel = soColunas(linhas, L);
}
// 5e) Seara · Base Remunerado = parâmetros por modelo × vigência (seara_param), uma linha por placa que abasteceu no mês
let params = [];
let temParam = true;
try { params = await tudo('seara_param?select=*&order=modelo,vigencia_inicio'); }
catch (e) { temParam = false; log('::warning::seara_param não existe no banco (rodar scripts/consumo-auto.sql): ' + e.message.slice(0, 80)); }
const searaRemAba = aba.seara_remunerado;
if (!params.length && SEMEAR && searaRemAba.length) {
  // SEMENTE: a última vigência de cada modelo da aba, inteira, em `campos`
  const ultVig = searaRemAba.reduce((m, r) => (String(r.vigencia_orig || '') > m ? String(r.vigencia_orig) : m), '');
  const porModelo = new Map();
  searaRemAba.filter(r => String(r.vigencia_orig || '') === ultVig && r.modeloveiculo).forEach(r => {
    const mk = r.modeloveiculo; if (!porModelo.has(mk)) porModelo.set(mk, []); porModelo.get(mk).push(r);
  });
  const semente = [];
  porModelo.forEach((rows, modelo) => {
    const campos = {};
    colsDe('seara_remunerado').forEach(c => { if (['vigencia_orig', 'placa', 'chassi'].includes(c.col)) return; const vals = rows.map(r => r[c.col]).filter(v => v != null && v !== ''); if (!vals.length) return; campos[c.col] = c.tipo === 'number' ? r4(media(vals.map(num).filter(v => v != null))) : maisFreq(vals.reduce((o, v) => { o[v] = (o[v] || 0) + 1; return o; }, {})); });
    semente.push({ modelo, vigencia_inicio: ultVig.slice(0, 7), kmporlitro: campos.kmporlitro ?? null, precodiesel: campos.precodiesel ?? null, precoarla: campos.precoarla ?? null,
      reaisporkm: campos.reaisporkm ?? null, totalreaisporkm: campos.totalreaisporkm ?? null, campos, obs: `semente: aba Base Remunerado de ${ultVig.slice(0, 7)} (${rows.length} placas)` });
  });
  log(`\nseara_param vazia: semente com ${semente.length} modelo(s) da aba de ${ultVig.slice(0, 7)}: ` + semente.map(s => `${s.modelo} ${s.kmporlitro} km/L · R$ ${s.precodiesel}/L · R$ ${s.reaisporkm}/km`).join(' · '));
  if (GRAVA && temParam && semente.length) { await api('seara_param', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(semente) }); params = await tudo('seara_param?select=*&order=modelo,vigencia_inicio'); log('  gravada'); }
  else params = semente;
}
// vale a vigência mais recente que não passa do mês; mês ANTERIOR à 1ª vigência do
// modelo usa a 1ª (a semente nasce do último mês da aba e tem de cobrir o histórico)
const paramDe = (modelo, ym) => {
  const ch = chaveModelo(modelo); let best = null, primeira = null;
  params.forEach(p => { if (p.ativo === false || chaveModelo(p.modelo) !== ch) return;
    if (!primeira || p.vigencia_inicio < primeira.vigencia_inicio) primeira = p;
    if (p.vigencia_inicio > ym) return; if (!best || p.vigencia_inicio > best.vigencia_inicio) best = p; });
  return best || primeira;
};
{
  const L = colsDe('seara_remunerado'); const linhas = []; const semParam = new Map();
  const ultRem = new Map(); searaRemAba.forEach(r => { const k = placaKey(r.placa); if (!ultRem.has(k) || String(r.vigencia_orig || '') >= String(ultRem.get(k).vigencia_orig || '')) ultRem.set(k, r); });
  const defRem = { nomeunidade: moda(searaRemAba, 'nomeunidade'), cnpjunidade: moda(searaRemAba, 'cnpjunidade') };
  [...searaReal.values()].sort((a, b) => (a.ym + a.placa).localeCompare(b.ym + b.placa)).forEach(a => {
    const modelo = modeloSeara(a); const p = modelo && paramDe(modelo, a.ym);
    if (!p) { const k = modelo || '(sem modelo)'; semParam.set(k, (semParam.get(k) || 0) + 1); return; }
    const u = ultRem.get(a.placa) || {};
    const o = { vigencia: mmaaaa(a.ym), vigencia_orig: `${a.ym}-01`, placa: u.placa || a.placaOrig, chassi: u.chassi || null, modeloveiculo: p.modelo,
      nomeunidade: u.nomeunidade || defRem.nomeunidade, cnpjunidade: u.cnpjunidade || defRem.cnpjunidade, ...(p.campos || {}) };
    ['kmporlitro', 'precodiesel', 'precoarla', 'reaisporkm', 'totalreaisporkm'].forEach(c => { if (p[c] != null) o[c] = num(p[c]); });
    if (o.precodiesel != null && o.kmporlitro > 0) o.reaisporkmdiesel = r4(o.precodiesel / o.kmporlitro);
    linhas.push(o);
  });
  if (semParam.size) log('  Seara: placas SEM parâmetro (modelo fora da seara_param): ' + [...semParam.entries()].map(([k, n]) => `${k} ${n}`).join(' · '));
  if (searaSemModelo) log(`  Seara: ${searaSemModelo} placa-mês sem modelo (nem ativos_manual, nem aba, nem ERP)`);
  nova.seara_remunerado = soColunas(linhas, L);
}
// 5f) Seara · Σkm por mês e ano (a consulta agregada `select F, G, sum(K) group by F, G`)
{
  const L = colsDe('seara_comb_vig'); const linhas = []; const acc = new Map();
  nova.seara_combustivel.forEach(r => { const k = r.mes_inicio_os + '|' + r.ano_inicio_os; if (!acc.has(k)) acc.set(k, { mes: r.mes_inicio_os, ano: r.ano_inicio_os, km: 0, vig: r.vigencia }); acc.get(k).km += r.km_rodado_horas_trabalhadas || 0; });
  [...acc.values()].sort((a, b) => (a.ano * 100 + MESES.indexOf(String(a.mes).slice(0, 3))) - (b.ano * 100 + MESES.indexOf(String(b.mes).slice(0, 3)))).forEach(a => {
    const o = { vigencia: a.vig }; if (L[0]) o[L[0].col] = a.mes; if (L[1]) o[L[1].col] = a.ano; if (L[2]) o[L[2].col] = r2(a.km); linhas.push(o);
  });
  nova.seara_comb_vig = soColunas(linhas, L);
}
function soColunas(linhas, L) {
  const ok = new Set(['vigencia', ...L.map(c => c.col)]);
  return linhas.map((o, i) => { const r = { linha: i + 1, atualizado_em: new Date().toISOString() }; Object.keys(o).forEach(k => { if (ok.has(k)) r[k] = o[k]; }); return r; });
}

// ── 6) comparação aba × automático ────────────────────────────────────────
const resumo = {};
const fmt = (v, d = 2) => v == null ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
function comparaKml() {
  const g = rows => { const m = new Map(); rows.forEach(r => { const k = r.projeto + '|' + (r.vigencia_orig || '').slice(0, 7); if (!m.has(k)) m.set(k, { n: 0, km: 0, lit: 0, rs: 0, rem: [], mod: [], rsl: [] }); const a = m.get(k); a.n++; a.km += num(r.km_rodado_horas_trabalhadas) || 0; a.lit += num(r.qtd_total_de_litros) || 0; a.rs += num(r.totas_rs) || 0; if (num(r.km_l_rem_medio)) a.rem.push(num(r.km_l_rem_medio)); if (num(r.km_l_rem_modelo)) a.mod.push(num(r.km_l_rem_modelo)); if (num(r.rs_l_rem)) a.rsl.push(num(r.rs_l_rem)); }); return m; };
  const A = g(aba.consumo_km_litro), N = g(nova.consumo_km_litro);
  const meses = [...new Set([...A.keys(), ...N.keys()].map(k => k.split('|')[1]))].sort(); const ult = meses.slice(-3);
  log(`\n── Km/L: aba × automático (projeto × mês, últimos ${ult.length} meses) ──`);
  log('projeto'.padEnd(20) + 'mês     ' + 'placas'.padStart(11) + 'km'.padStart(21) + 'litros'.padStart(19) + 'rem médio'.padStart(14) + 'rem modelo'.padStart(14) + 'R$/L rem'.padStart(14));
  const chaves = [...new Set([...A.keys(), ...N.keys()])].filter(k => ult.includes(k.split('|')[1])).sort();
  chaves.forEach(k => { const a = A.get(k) || {}, n = N.get(k) || {}; const [proj, ym] = k.split('|');
    log(proj.padEnd(20) + ym + ' ' + `${a.n ?? '—'}×${n.n ?? '—'}`.padStart(11) + `${fmt(a.km, 0)}×${fmt(n.km, 0)}`.padStart(21) + `${fmt(a.lit, 0)}×${fmt(n.lit, 0)}`.padStart(19)
      + `${fmt(a.rem && media(a.rem))}×${fmt(n.rem && media(n.rem))}`.padStart(14) + `${fmt(a.mod && media(a.mod))}×${fmt(n.mod && media(n.mod))}`.padStart(14) + `${fmt(a.rsl && media(a.rsl), 4)}×${fmt(n.rsl && media(n.rsl), 4)}`.padStart(14)); });
  // placa × mês: quantas batem em litros e km
  const pa = new Map(); aba.consumo_km_litro.forEach(r => pa.set(placaKey(r.placa) + '|' + (r.vigencia_orig || '').slice(0, 7), r));
  let comum = 0, litOk = 0, kmOk = 0, rsOk = 0, soAuto = 0; const soAba = new Set(pa.keys());
  nova.consumo_km_litro.forEach(r => { const k = placaKey(r.placa) + '|' + r.vigencia_orig.slice(0, 7); const a = pa.get(k); if (!a) { soAuto++; return; } soAba.delete(k); comum++;
    if (Math.abs((num(a.qtd_total_de_litros) || 0) - (r.qtd_total_de_litros || 0)) < 0.5) litOk++;
    if (Math.abs((num(a.km_rodado_horas_trabalhadas) || 0) - (r.km_rodado_horas_trabalhadas || 0)) < 1) kmOk++;
    if (Math.abs((num(a.totas_rs) || 0) - (r.totas_rs || 0)) < 1) rsOk++; });
  const pct = (x, n) => n ? (100 * x / n).toFixed(1) + '%' : '—';
  log(`placa-mês em comum ${comum}: litros iguais ${pct(litOk, comum)} · km iguais ${pct(kmOk, comum)} · R$ iguais ${pct(rsOk, comum)} · só no automático ${soAuto} · só na aba ${soAba.size}`);
  // os candidatos de km, placa a placa contra a aba (dentro de 1 km e de 2%)
  const cand = { soma: 0, guard: 0, hodo: 0, media: 0, todos: 0 }, cand2 = { soma: 0, guard: 0, hodo: 0, media: 0, todos: 0 }; let nk = 0, fora = 0;
  real.forEach(a => { const r = pa.get(a.placa + '|' + a.ym); if (!r) return; const alvo = num(r.km_rodado_horas_trabalhadas); if (alvo == null) return; nk++; fora += a.kmFora || 0;
    const c = { soma: a.kmSoma, guard: a.kmGuard, hodo: a.kmHodo, media: a.kmMedia, todos: a.kmTodos };
    Object.keys(c).forEach(k => { if (c[k] == null) return; if (Math.abs(c[k] - alvo) < 1) cand[k]++; if (Math.abs(c[k] - alvo) <= 0.02 * Math.max(alvo, 1)) cand2[k]++; }); });
  log(`km da aba × candidatos (${nk} placa-mês): iguais — soma ${pct(cand.soma, nk)} · soma com guarda ${pct(cand.guard, nk)} · hodômetro máx−mín ${pct(cand.hodo, nk)} · Σ litros×média ${pct(cand.media, nk)} · Σ km de todos os abastecimentos ${pct(cand.todos, nk)}`
    + ` | a ±2% — soma ${pct(cand2.soma, nk)} · guarda ${pct(cand2.guard, nk)} · hodo ${pct(cand2.hodo, nk)} · média ${pct(cand2.media, nk)} · todos ${pct(cand2.todos, nk)} · abastecimentos fora da guarda ${fora}`);
  // onde a aba fica acima/abaixo da soma do diesel: um exemplo por sinal
  const ex = []; real.forEach(a => { const r = pa.get(a.placa + '|' + a.ym); if (!r || ex.length > 5) return; const alvo = num(r.km_rodado_horas_trabalhadas); if (alvo == null || Math.abs(alvo - (a.kmGuard || 0)) < 1) return; ex.push(`${a.placa} ${a.ym}: aba ${fmt(alvo, 0)} · diesel ${fmt(a.kmGuard, 0)} · todos ${fmt(a.kmTodos, 0)} · hodo ${fmt(a.kmHodo, 0)} · média ${fmt(a.kmMedia, 0)} (${a.n} abast.)`); });
  if (ex.length) log('  exemplos que não batem: ' + ex.join(' | '));
  resumo.consumo_km_litro = { comum, litOk, kmOk, rsOk, soAuto, soAba: soAba.size, meses: ult, km: { modo: KM_MODO, nk, iguais: cand, a2pct: cand2 } };
}
function comparaSimples(slug, chaveFn, valFn, rot) {
  const g = rows => { const m = new Map(); rows.forEach(r => { const k = chaveFn(r); if (!k) return; if (!m.has(k)) m.set(k, { n: 0, v: [] }); const a = m.get(k); a.n++; const v = valFn(r); if (v != null) a.v.push(v); }); return m; };
  const A = g(aba[slug] || []), N = g(nova[slug] || []);
  const meses = [...new Set([...A.keys(), ...N.keys()].map(k => k.split('|').pop()))].sort(); const ult = meses.slice(-3);
  log(`\n── ${slug}: aba × automático (${rot}, últimos ${ult.length} meses) ──`);
  const chaves = [...new Set([...A.keys(), ...N.keys()])].filter(k => ult.includes(k.split('|').pop())).sort();
  chaves.slice(0, 60).forEach(k => { const a = A.get(k) || {}, n = N.get(k) || {}; log(k.padEnd(34) + `${a.n ?? '—'}×${n.n ?? '—'}`.padStart(10) + `${fmt(a.v && media(a.v), 3)}×${fmt(n.v && media(n.v), 3)}`.padStart(18)); });
  if (chaves.length > 60) log(`  … +${chaves.length - 60} chaves`);
  resumo[slug] = { aba: (aba[slug] || []).length, auto: (nova[slug] || []).length, meses: ult };
}
comparaKml();
comparaSimples('consumo_rs_litro', r => r.unidade_benner + '|' + (r.vigencia_data_3 || '').slice(0, 7), r => num(r.precooperadora), 'linhas e preço operadora médio');
comparaSimples('consumo_rem_modelo', r => (r.projeto_c_van || r.unidade_benner) + '|' + (r.vigencia_data_4 || '').slice(0, 7), r => num(r.media_modelo), 'linhas e média do modelo');
// a aba Combustível da Seara não tem coluna de data: o mês sai do texto (set) + ano
const ymSeara = r => { const m = String(r.mes_inicio_os || '').toLowerCase().slice(0, 3); const i = MESES.indexOf(m); const y = num(r.ano_inicio_os); return (i >= 0 && y) ? `${y}-${String(i + 1).padStart(2, '0')}` : (r.vigencia ? r.vigencia.slice(3) + '-' + r.vigencia.slice(0, 2) : ''); };
comparaSimples('seara_combustivel', r => 'ANG|' + ymSeara(r), r => num(r.km_rodado_horas_trabalhadas), 'placas e km médio');
log('  projeto_c_van na aba Base Remunerado Modelo: ' + [...new Set(aba.consumo_rem_modelo.map(r => r.projeto_c_van))].join(' · ') + ' | unidade_benner (3): ' + [...new Set(aba.consumo_rem_modelo.map(r => r.unidade_benner))].slice(0, 3).join(' · '));
log('  Seara Combustível: empresa/projeto/unidade/mês da aba: ' + ['empresa', 'projeto', 'unidade', 'mes_inicio_os'].map(c => [...new Set(aba.seara_combustivel.map(r => r[c]))].slice(0, 3).join('/')).join(' · '));
comparaSimples('seara_remunerado', r => 'ANG|' + String(r.vigencia_orig || '').slice(0, 7), r => num(r.kmporlitro), 'placas e Km/L médio');
comparaSimples('seara_comb_vig', r => { const L = colsDe('seara_comb_vig'); const m = MESES.indexOf(String(r[(L[0] || {}).col] || '').toLowerCase().slice(0, 3)); const y = num(r[(L[1] || {}).col]); return m >= 0 && y ? `${y}-${String(m + 1).padStart(2, '0')}` : String(r.vigencia || ''); }, r => num(r[(colsDe('seara_comb_vig')[2] || {}).col]), 'Σkm');
log('\nlinhas montadas: ' + ALVOS.map(s => `${s} ${nova[s].length}`).join(' · '));

// ── 7) grava ──────────────────────────────────────────────────────────────
if (!GRAVA) { log('\nmodo ensaio: nada gravado'); process.exit(0); }
let falhas = 0;
for (const s of ALVOS) {
  const t = `ca_${s}`, linhas = nova[s];
  try {
    if (!shBase[s]) throw new Error('sem layout em sh_base');
    if (!linhas.length) throw new Error('nenhuma linha montada');
    for (let i = 0; i < linhas.length; i += 500) {
      await api(`${t}?on_conflict=linha`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(linhas.slice(i, i + 500)) });
    }
    await api(`${t}?linha=gt.${linhas.length}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    await api('consumo_auto_base?on_conflict=slug', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ slug: s, tabela: t, colunas: shBase[s].colunas, linhas: linhas.length, carregado_em: new Date().toISOString(), erro: null, resumo: resumo[s] || null }]) });
    log(`ok  ${t.padEnd(26)} ${linhas.length} linha(s)`);
  } catch (e) {
    falhas++; console.error(`::error::${t}: ${e.message}`);
    try { await api('consumo_auto_base?on_conflict=slug', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ slug: s, tabela: t, erro: 'FALHOU: ' + e.message.slice(0, 300), carregado_em: new Date().toISOString() }]) }); } catch (_) { /* nada */ }
  }
}
let flag = null; try { flag = await api('portal_flags?chave=eq.consumo_auto&select=ligado'); } catch (_) { /* sem a tabela */ }
log(`\nchave consumo_auto: ${flag && flag[0] ? (flag[0].ligado ? 'LIGADA — os painéis leem as ca_*' : 'desligada — os painéis seguem no Sheets') : 'não existe (rodar scripts/consumo-auto.sql)'}`);
if (falhas) process.exit(1);

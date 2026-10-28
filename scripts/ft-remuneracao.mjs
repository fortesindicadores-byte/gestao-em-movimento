// ============================================================
// Remuneração do Freightech por mês — a base do painel /remuneracao/
// (Renan, 28/10/2026: "Vamos ao painel remuneração").
//
// Lê as tabelas que o freightech-robot grava (ft_linha + ft_layout) e monta UMA
// linha por operação × unidade × mês em ft_rem_mes, com as peças da remuneração:
// frota ativa e parada, km, o variável por componente (combustível, manutenção,
// carroceria, pneu), o fixo da frota (ativo, parado e as peças: seguro, FINAME,
// IPVA, lavagem, rastreador), equipe, QLP administrativo e outras despesas.
//
// Regras (as mesmas dos materiais, docs/analise-freightech/completa.py):
//  · ROTA, VAN e UDC: tabela Resumo / Resumo Van. Cada quinzena repete o mês, então
//    o mês = média das quinzenas. Variável = R$/km × KM Remunerado × ativos (o TETO
//    do mês: 25 mapas por ativo; o pago depende dos mapas rodados, que estão na
//    Dispersão de km, não no FT).
//  · AS: não tem Resumo; sai placa a placa do Caminhão AS (ativas): variável =
//    R$/km de cada peça × KM Mês Roadshow (a lavagem por km é variável no AS:
//    Total Custo Variável = consumo + manutenção + carroceria + pneu + lavagem),
//    fixo = Total Custo Fixo da placa.
//  · Rota, Van e UDC: a lavagem é fixa por caminhão ativo e no Resumo entra em
//    Outras Despesas (não no Total Frota Ativa); vai em `lavagem` só como peça.
//  · EMPURRADA e INSUMOS: variável = R$/km de cada componente do trecho × km
//    previsto (kmRodado × previsaoViagens); fixo, equipe, QLP e outras despesas
//    vêm do Faturamento (frete líquido de cada bloco).
//  · ARMAZÉM: Fechamento (mensal): empilhadeira = fixo, custo variável + gás =
//    variável, operador + ajudante + amarrador = equipe, gestão = QLP; total =
//    valorTotal (que é a soma dos líquidos).
//  · Seguro de caminhão acima de R$ 5.000/mês no Resumo é erro de cadastro do FT
//    (UDC5B42, 2ª nov/25 em Cuiabá, R$ 5,96 mi) e é trocado pela mediana da unidade.
//
// Uso:
//   node scripts/ft-remuneracao.mjs                 → recalcula os 4 últimos meses e grava
//   FT_REM_DESDE=2022-01 node scripts/…             → recalcula desde o mês (histórico)
//   FT_REM_SECO=1                                   → não grava, só imprime o resumo
//   FT_DUMP=<pasta com ft-*.ndjson.gz>              → lê o dump local (teste), não o banco
// Log: só totais por mês e por operação (o log do Actions é público).
// ============================================================
import fs from 'node:fs';
import zlib from 'node:zlib';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
const DUMP = process.env.FT_DUMP || '';
const SECO = /^(1|true|sim|s)$/i.test(String(process.env.FT_REM_SECO || '').trim()) || !!DUMP && !KEY;
if (!DUMP && !KEY) { console.error('::error::GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const log = (...a) => console.log(...a);

const hoje = new Date(Date.now() - 3 * 3600e3);
const ymDe = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
const DESDE = process.env.FT_REM_DESDE || (() => { const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 3, 1)); return ymDe(d.getUTCFullYear(), d.getUTCMonth() + 1); })();
const ANO0 = +DESDE.slice(0, 4);

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(String(v).replace(/^[^:]*:\s*/, '').replace(',', '.')); return isFinite(n) ? n : null; };
const z = v => num(v) || 0;
const ativoFT = v => /^(TRUE|ATIVO|SIM|VERDADEIRO|1)$/.test(norm(v));

// unidade do FT → sigla do portal
const UNI = { 'CDD CAMBORIU': 'BLC', 'CDD CUIABA': 'CBA', 'CDD FLORIANOPOLIS': 'FLP', 'CDD GUARULHOS': 'GRL', 'UDC GUARULHOS': 'GRL',
  'CDD NOVA FRIBURGO': 'NFR', 'CDD PELOTAS': 'PLT', 'CDD RIO DE JANEIRO': 'CGR', 'CDD RONDONOPOLIS': 'RON', 'MACACU': 'MCC',
  'CDD GOIANIA': 'GNA', 'CUIABA': 'CBA', 'CUIABA INTEGRALIZACAO': 'CBA', 'PIRAI': 'PIR', 'LATA PIRAI': 'PIR' };

// ── leitura: banco ou dump ────────────────────────────────────────────────
async function api(path, opt = {}) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
    if (r.ok) { const s = await r.text(); return s ? JSON.parse(s) : null; }
    const body = await r.text();
    if (r.status < 500 || t >= 4) throw new Error(`HTTP ${r.status} ${path.slice(0, 70)} ${body.slice(0, 200)}`);
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}
async function tudo(path) {
  const out = [];
  for (let off = 0; ; off += 1000) { const p = await api(`${path}&limit=1000&offset=${off}`); out.push(...p); if (p.length < 1000) break; }
  return out;
}
const dumpCache = {};
function dumpDe(f) { if (!dumpCache[f]) dumpCache[f] = zlib.gunzipSync(fs.readFileSync(`${DUMP}/${f}`)).toString().split('\n').filter(Boolean).map(l => JSON.parse(l)); return dumpCache[f]; }
const vigParte = v => { const m = String(v).match(/_(\d)_(\d{1,2})_(\d{4})$/); return m ? { quinzena: +m[1], mes: +m[2], ano: +m[3] } : null; };

// devolve as linhas de uma tabela com um leitor por rótulo: r.g('Total Viagens')
async function tabela(canal, tab) {
  let lay, rows;
  if (DUMP) {
    lay = dumpDe('ft-layout.ndjson.gz').filter(l => l.canal === canal && l.tabela === tab && l.ano >= ANO0);
    const vigs = new Set(lay.map(l => l.vigencia));
    rows = dumpDe(`ft-${canal}.ndjson.gz`).filter(r => r.t === tab && vigs.has(r.v)).map(r => ({ vigencia: r.v, unidade: r.u, placa: r.p, dados: r.d, ...vigParte(r.v) }));
  } else {
    lay = await tudo(`ft_layout?select=vigencia,ano,mes,quinzena,colunas&canal=eq.${canal}&tabela=eq.${tab}&ano=gte.${ANO0}`);
    rows = lay.length ? await tudo(`ft_linha?select=vigencia,ano,mes,quinzena,unidade,placa,dados&canal=eq.${canal}&tabela=eq.${tab}&ano=gte.${ANO0}&order=vigencia,linha`) : [];
  }
  const idx = {}; lay.forEach(l => { const m = {}; (l.colunas || []).forEach((c, i) => { const k = norm(c); if (!(k in m)) m[k] = i; }); idx[l.vigencia] = m; });
  return rows.filter(r => ymDe(r.ano, r.mes) >= DESDE).map(r => {
    const m = idx[r.vigencia] || {};
    return { ...r, ym: ymDe(r.ano, r.mes), g: (...labels) => { for (const l of labels) { const i = m[norm(l)]; if (i != null) return r.dados[i]; } return undefined; } };
  });
}

// ── acumulador: operação × unidade × mês × quinzena ───────────────────────
const CAMPOS = ['ativos', 'parados', 'km_teto', 'comb', 'manut', 'carroc', 'pneu', 'lavagem_var', 'outros_var', 'variavel',
  'fixo_ativo', 'fixo_parado', 'seguro', 'finame', 'ipva', 'lavagem', 'rastreador', 'equipe', 'qlp_adm', 'outras', 'total',
  // peças a mais (scripts/ft-remuneracao.sql, 2ª parte): faixa refletiva, depreciação e remuneração K do fixo;
  // pedágio, seguro, salário e lucro variáveis do trecho do T1 (estavam juntos em outros_var)
  'faixa', 'deprec', 'rem_k', 'pedagio', 'seguro_var', 'salario_var', 'lucro_var'];
const NOVOS = ['faixa', 'deprec', 'rem_k', 'pedagio', 'seguro_var', 'salario_var', 'lucro_var'];
const Q = new Map();   // op|cod|ym|q → {campos}
function acc(op, cod, uni, ym, q) {
  const k = `${op}|${cod}|${ym}|${q}`;
  if (!Q.has(k)) Q.set(k, { op, cod, uni, ym, q, ...Object.fromEntries(CAMPOS.map(c => [c, 0])) });
  return Q.get(k);
}
const semUni = new Map();
const codDe = u => { const c = UNI[norm(u)]; if (!c) semUni.set(norm(u), (semUni.get(norm(u)) || 0) + 1); return c; };

// 1) ROTA, VAN, UDC — Resumo e Resumo Van
for (const [tab, van] of [['Resumo', false], ['ResumoVan', true]]) {
  const rows = await tabela('ROTA', tab);
  // seguro por caminhão: mediana da unidade (para trocar o erro de cadastro)
  const segs = {}; rows.forEach(r => { const s = num(r.g('Seguro', 'seguro')); if (s != null && s < 5000) (segs[r.unidade] = segs[r.unidade] || []).push(s); });
  const med = a => { const s = (a || []).slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  let corrigidos = 0;
  rows.forEach(r => {
    const cod = codDe(r.unidade); if (!cod) return;
    const op = van ? 'VAN' : (norm(r.unidade) === 'UDC GUARULHOS' ? 'UDC' : 'ROTA');
    const a = acc(op, cod, r.unidade, r.ym, r.quinzena);
    const n = z(r.g('Total Caminhão Ativo', 'totalCaminhaoAtivo')), np = z(r.g('Total Caminhão Parado', 'totalCaminhaoParado'));
    const km = z(r.g('KM Remunerado', 'kmRemunerado'));
    let seguro = z(r.g('Seguro', 'seguro')), fixoAt = z(r.g('Total Frota Ativa', 'totalFrotaAtiva'));
    if (seguro > 5000) { const m = med(segs[r.unidade]); fixoAt -= (seguro - m) * n; seguro = m; corrigidos++; }
    a.ativos += n; a.parados += np; a.km_teto += km * n;
    a.comb += z(r.g('Combustível R$/KM', 'combustivelReaisKm')) * km * n;
    a.manut += z(r.g('Manutenção Caminhão R$/KM', 'manutencaoCaminhaoReaisKm')) * km * n;
    a.carroc += z(r.g('Manutenção Carroceria R$/KM', 'manutencaoCarroceriaReaisKm')) * km * n;
    a.pneu += z(r.g('Pneu R$/KM', 'pneuReaisKm')) * km * n;
    a.variavel += z(r.g('Total Viagens', 'totalViagens'));
    a.fixo_ativo += fixoAt; a.fixo_parado += z(r.g('Total Frota Parada', 'totalFrotaParada'));
    a.seguro += seguro * n + z(r.g('Seguro Parado', 'seguroParado')) * np;
    a.finame += z(r.g('FINAME Modelo Novo', 'finameModeloNovo')) * n + z(r.g('FINAME Modelo Novo Parado', 'finameModeloNovoParado')) * np;
    a.ipva += z(r.g('IPVA Licen. Mensal', 'ipvaLicencMensal')) * n + z(r.g('IPVA Licenc. Mensal Parado', 'ipvaLicencMensalParado')) * np;
    a.lavagem += z(r.g('Lavagem', 'lavagem')) * n;
    a.rastreador += z(r.g('Rastreador', 'rastreador')) * n + z(r.g('Rastreador Parado', 'rastreadorParado')) * np;
    a.faixa += z(r.g('Faixa Reflexiva', 'faixaReflexiva')) * n + z(r.g('Faixa Reflexiva Parado', 'faixaRefletivaParado', 'faixaReflexivaParado')) * np;
    a.deprec += (z(r.g('Depreciação Caminhão', 'depreciacaoCaminhao')) + z(r.g('Depreciação Carroceria', 'depreciacaoCarroceria'))) * n
      + (z(r.g('Depreciação Caminhão Parado', 'depreciacaoCaminhaoParado')) + z(r.g('Depreciação Carroceria Parado', 'depreciacaoCarroceriaParado'))) * np;
    a.rem_k += (z(r.g('Remuneração K', 'remuneracaoK')) + z(r.g('Remuneração K Impostos', 'remuneracaoKImpostos'))) * n
      + (z(r.g('Remuneração K Parado', 'remuneracaoKParado')) + z(r.g('Remuneração K Impostos Parado', 'remuneracaoKImpostosParado'))) * np;
    a.equipe += z(r.g('Total Equipe Entrega', 'totalEquipeEntrega'));
    a.qlp_adm += z(r.g('Total QLP ADM', 'totalQlpAdm'));
    a.outras += z(r.g('Total Outras Despesas', 'totalOutrasDespesas'));
  });
  log(`ROTA/${tab}: ${rows.length} linhas${corrigidos ? ` · ${corrigidos} seguro(s) acima de R$ 5.000 trocados pela mediana da unidade` : ''}`);
}

// 2) AS — Caminhão AS, placa a placa
{
  const rows = await tabela('AS', 'CaminhaoAS');
  rows.forEach(r => {
    const cod = codDe(r.unidade); if (!cod) return;
    const a = acc('AS', cod, r.unidade, r.ym, r.quinzena);
    if (!ativoFT(r.g('Ativo'))) { a.parados += 1; return; }
    const km = z(r.g('KM Mês Roadshow'));
    a.ativos += 1; a.km_teto += km;
    // Total Custo Variável da placa AS = consumo + manutenção + carroceria + pneu + lavagem por km (conferido no FT)
    const c = z(r.g('Consumo R$/KM')) * km, m = z(r.g('Manutenção R$/KM')) * km, cr = z(r.g('Manutenção Carroceria R$/KM')) * km, p = z(r.g('Pneu por KM')) * km;
    const lv = z(r.g('Lavagem por KM')) * km;
    a.comb += c; a.manut += m; a.carroc += cr; a.pneu += p; a.lavagem_var += lv; a.variavel += c + m + cr + p + lv;
    a.faixa += z(r.g('Faixa Reflexiva'));
    a.deprec += z(r.g('Depreciação Cavalo')) + z(r.g('Depreciação Carroceria'));
    a.rem_k += z(r.g('Remuneração K')) + z(r.g('Remuneração K Impostos'));
    a.fixo_ativo += z(r.g('Total Custo Fixo'));
    a.seguro += z(r.g('Seguro')); a.finame += z(r.g('FINAME Modelo Novo')); a.ipva += z(r.g('IPVA Licenciamento')); a.rastreador += z(r.g('Rastreador'));
  });
  log(`AS/CaminhaoAS: ${rows.length} linhas`);
}

// 3) EMPURRADA e INSUMOS — trecho (variável) + Faturamento (fixo, equipe, QLP, outras)
const TC_FROTA = { comb: ['freteReaisKMDiesel'], manut: ['freteReaisKMManutencaoCavalo'], carroc: ['freteReaisKMManutencaoCarreta'], pneu: ['freteReaisKMPneu'], lavagem_var: ['freteReaisKMLavagem'] };
const TC_OUTROS = { pedagio: 'freteReaisKMPedagio', seguro_var: 'freteReaisKMSeguro', salario_var: 'freteReaisKMSalarioVariavel', lucro_var: 'freteReaisKMLucroVariavel' };
for (const [canal, trecho, fat] of [['EMPURRADA', 'TrechoEmpurrada', 'FaturamentoEmpurrada'], ['INSUMOS', 'TrechoInsumos', 'FaturamentoInsumos']]) {
  const tr = await tabela(canal, trecho);
  tr.forEach(r => {
    const prev = z(r.g('previsaoViagens')); if (prev <= 0) return;
    const cod = codDe(r.unidade); if (!cod) return;
    const a = acc(canal, cod, r.unidade, r.ym, r.quinzena);
    const w = z(r.g('kmRodado')) * prev;
    a.km_teto += w;
    for (const [campo, cols] of Object.entries(TC_FROTA)) a[campo] += cols.reduce((s, c) => s + z(r.g(c)), 0) * w;
    for (const [campo, col] of Object.entries(TC_OUTROS)) { const v = z(r.g(col)) * w; a[campo] += v; a.outros_var += v; }
  });
  const fa = await tabela(canal, fat);
  fa.forEach(r => {
    const cod = codDe(r.unidade); if (!cod) return;
    const a = acc(canal, cod, r.unidade, r.ym, r.quinzena);
    a.ativos += z(r.g('equipamentoAtivoQuantidade')); a.parados += z(r.g('equipamentoParadoQuantidade'));
    a.fixo_ativo += z(r.g('equipamentoAtivoFreteLiquido')); a.fixo_parado += z(r.g('equipamentoParadoFreteLiquido'));
    a.equipe += z(r.g('equipeAtivaFreteLiquido')); a.qlp_adm += z(r.g('qlpAdmFreteLiquido'));
    a.outras += z(r.g('outraDespesaFreteLiquido')) + z(r.g('estacionariaAtivoFreteLiquido'));
  });
  log(`${canal}: ${tr.length} trechos · ${fa.length} linhas de faturamento`);
}
// variável do T1 = peças de frota + outros componentes do trecho (pedágio, seguro, salário e lucro variáveis)
Q.forEach(a => { if (a.op === 'EMPURRADA' || a.op === 'INSUMOS') a.variavel = a.comb + a.manut + a.carroc + a.pneu + a.lavagem_var + a.outros_var; });

// 4) ARMAZÉM — Fechamento (mensal)
{
  const rows = await tabela('ARMAZEM', 'FechamentoApoio');
  rows.forEach(r => {
    const cod = codDe(r.unidade); if (!cod) return;
    const a = acc('ARMAZEM', cod, r.unidade, r.ym, r.quinzena);
    a.ativos += z(r.g('parametrosEmpilhadeiraQtde'));
    a.fixo_ativo += z(r.g('valorLiquidoEmpilhadeira'));
    a.comb += z(r.g('valorLiquidoGas'));
    a.outros_var += z(r.g('valorLiquidoCustoVariavel')) + z(r.g('valorLiquidoVariavel'));
    a.variavel += z(r.g('valorLiquidoGas')) + z(r.g('valorLiquidoCustoVariavel')) + z(r.g('valorLiquidoVariavel'));
    a.equipe += z(r.g('valorLiquidoOperador')) + z(r.g('valorLiquidoAjudante')) + z(r.g('valorLiquidoAmarrador'));
    a.qlp_adm += z(r.g('valorLiquidoGestao'));
    a.total += z(r.g('valorTotal'));
  });
  log(`ARMAZEM/FechamentoApoio: ${rows.length} linhas`);
}
if (semUni.size) log('unidades do FT fora do de-para (ficam fora): ' + [...semUni.entries()].map(([u, n]) => `${u} ${n}`).join(' · '));

// ── mês = média das quinzenas ─────────────────────────────────────────────
const M = new Map();
Q.forEach(a => { const k = `${a.op}|${a.cod}|${a.ym}`; if (!M.has(k)) M.set(k, []); M.get(k).push(a); });
const r2 = v => Math.round(v * 100) / 100;
const linhas = [...M.values()].map(qs => {
  const o = { operacao: qs[0].op, unidade: qs[0].cod, unidade_ft: qs[0].uni, ano: +qs[0].ym.slice(0, 4), mes: +qs[0].ym.slice(5), vigencia: qs[0].ym, quinzenas: qs.length };
  CAMPOS.forEach(c => { o[c] = r2(qs.reduce((s, a) => s + a[c], 0) / qs.length); });
  if (o.operacao !== 'ARMAZEM') o.total = r2(o.variavel + o.fixo_ativo + o.fixo_parado + o.equipe + o.qlp_adm + o.outras);
  o.ativos = Math.round(o.ativos * 10) / 10; o.parados = Math.round(o.parados * 10) / 10;
  o.km_teto = Math.round(o.km_teto);
  return o;
}).filter(o => o.total || o.ativos || o.variavel);
linhas.sort((a, b) => a.vigencia.localeCompare(b.vigencia) || a.operacao.localeCompare(b.operacao) || a.unidade.localeCompare(b.unidade));

// resumo no log: total por mês e por operação (milhares)
{
  const ops = [...new Set(linhas.map(l => l.operacao))];
  const meses = [...new Set(linhas.map(l => l.vigencia))];
  const k = v => Math.round(v / 1000).toLocaleString('pt-BR');
  log(`\nremuneração por mês (R$ mil) · ${linhas.length} linhas · ${DESDE} em diante`);
  log(['mês', ...ops, 'total'].join(' | '));
  meses.forEach(m => { const t = ops.map(o => linhas.filter(l => l.vigencia === m && l.operacao === o).reduce((s, l) => s + l.total, 0)); log([m, ...t.map(k), k(t.reduce((s, x) => s + x, 0))].join(' | ')); });
}

if (SECO) { if (process.env.FT_REM_OUT) fs.writeFileSync(process.env.FT_REM_OUT, JSON.stringify(linhas)); log('\n(seco: nada gravado)'); process.exit(0); }

// ── grava: apaga os meses recalculados e insere ───────────────────────────
// sem as colunas novas no banco (SQL da 2ª parte ainda não rodado), grava sem elas e avisa
let semNovos = false;
try { await api('ft_rem_mes?select=faixa,pedagio,salario_var&limit=1'); }
catch (e) { semNovos = true; console.log('::warning::ft_rem_mes sem as colunas novas (faixa, deprec, rem_k, pedagio, seguro_var, salario_var, lucro_var): rode a 2ª parte do scripts/ft-remuneracao.sql. Gravando sem elas.'); }
await api(`ft_rem_mes?vigencia=gte.${DESDE}`, { method: 'DELETE' });
const gravavel = l => { const o = { ...l, atualizado_em: new Date().toISOString() }; if (semNovos) NOVOS.forEach(c => delete o[c]); return o; };
for (let i = 0; i < linhas.length; i += 500) await api('ft_rem_mes', { method: 'POST', body: JSON.stringify(linhas.slice(i, i + 500).map(gravavel)), headers: { Prefer: 'return=minimal' } });
log(`\nft_rem_mes: ${linhas.length} linha(s) gravada(s) de ${DESDE} em diante`);

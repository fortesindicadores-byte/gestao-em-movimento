// ============================================================================
// Teste do /fca-automatico/ no Chromium, com TODAS as fontes dubladas (o
// sandbox não alcança o Supabase nem o Google). Respostas conhecidas:
//
//  1. FATO = pacote que estourou no DRE, a mesma regra do FCA: CGR · ROTA ·
//     ago/26 · Combustíveis com R$ 31.000 (conta Combustíveis 30 mil + Arla 1 mil);
//  2. a PONTE da conta Combustíveis fecha no Δ do custo, como a Árvore:
//     Volume 10.000 (5.000 km × R$ 2,00/km rem) · Eficiência 11.600 (2.000 L a
//     mais × R$ 5,80) · Preço 4.800 · Diferença DRE × bases 3.600, e o Arla
//     1.000 à parte → 100% do desvio explicado em R$;
//  3. o OFENSOR de eficiência é a placa que gastou acima da régua (CGR0A01,
//     2.000 L), as de preço vêm na ordem do R$ pago acima;
//  4. a aba Km/L SEM CABEÇALHO (como chega do Google) cai nas posições padrão;
//     VAN do DRE ("ROTA (VAN) - GRL") casa com a Km/L ("VAN - GRL") e usa o
//     preço do ROTA da unidade;
//  5. MANUTENÇÕES: a Carta diz onde o dinheiro foi (grupo, placa, fornecedor);
//     o SLA fora da meta vira causa "rede" porque a relação SLA × desvio foi
//     PLANTADA nas 10 unidades × 8 meses; as preventivas vencidas e as OS em
//     aberto do Ginfo de hoje viram ação com placa;
//  6. APRENDIZADO: o FCA de jul/26 do GRL (tema Oficina / SLA) é "melhorou",
//     porque o desvio caiu de 30 mil para 15 mil em ago/26; a ação de SLA do
//     fato de ago/26 traz essa taxa (1 de 1);
//  7. PNEUS: Prolog (pressão fora, 3–4 mm) e alinhamento vencido viram ação;
//  8. condução: os motoristas de pior nota da unidade (PIR) entram na ação;
//  9. o que a unidade escreveu no FCA do mês aparece ao lado, no modal;
// 10. sem admin cai no gate; telas sem rolagem da página em 1366 e 1920, nos
//     dois temas.
// Uso: node scripts/fca-automatico-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures ── */
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const VIGS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const U = { CGR: ['CAMPO GRANDE', 'ROTA - CGR', 'CDD RIO DE JANEIRO'], GRL: ['GUARULHOS', 'ROTA - GRL', 'CDD GUARULHOS'], PIR: ['PIRAÍ', 'EMPURRADA - PIR', 'PIRAI EMPURRADA'],
  'CBA T2': ['CUIABÁ', 'ROTA - CBA', 'CDD CUIABA'], FLP: ['FLORIANÓPOLIS', 'ROTA - FLP', 'CDD FLORIANOPOLIS'], NFR: ['NOVA FRIBURGO', 'ROTA - NFR', 'CDD NOVA FRIBURGO'],
  PLT: ['PELOTAS', 'ROTA - PLT', 'CDD PELOTAS'], RON: ['RONDONÓPOLIS', 'ROTA - RON', 'CDD RONDONOPOLIS'], BLC: ['BALNEÁRIO CAMBORIÚ', 'ROTA - BLC', 'CDD CAMBORIU'], 'MCC T2': ['CACHOEIRAS DE MACACU', 'ROTA - MCC', 'CDI MACACU'] };
const G = [];   // uma linha por unidade × mês, com as relações PLANTADAS
Object.keys(U).forEach(u => VIGS.forEach(v => {
  const sla = 55 + rnd() * 40;                                  // SLA de manutenção
  const dm = (75 - sla) / 100 * 0.8 + (rnd() - 0.5) * 0.02;     // PLANTADO: SLA pior → desvio de Manutenções maior
  const disp = (rnd() - 0.4) * 0.2, dc = disp * 0.9 + (rnd() - 0.5) * 0.02;
  G.push({ u, v, sla, prev: 85 + rnd() * 15, manRem: 100000, manReal: 100000 * (1 + dm), combRem: 100000, combReal: 100000 * (1 + dc), arlaRem: 5000, arlaReal: 5000,
    kmRem: 50000, kmReal: 50000 * (1 + disp), pnRem: 30000, pnReal: 30000 * (1 + (rnd() - 0.5) * 0.1) });
}));
const g = (u, v) => G.find(x => x.u === u && x.v === v);
// CGR ago/26: a ponte conhecida
Object.assign(g('CGR', '2026-08'), { combRem: 100000, combReal: 130000, arlaRem: 5000, arlaReal: 6000, kmRem: 50000, kmReal: 55000 });
// GRL: Manutenções jul 30 mil → ago 15 mil (o FCA de jul "melhorou"); SLA ago 50
Object.assign(g('GRL', '2026-07'), { manRem: 100000, manReal: 130000, sla: 45 });
Object.assign(g('GRL', '2026-08'), { manRem: 100000, manReal: 115000, sla: 50, prev: 80 });
// PIR ago/26: combustível com eficiência ruim, sem volume e sem preço
Object.assign(g('PIR', '2026-08'), { combRem: 100000, combReal: 120000, arlaReal: 5000, kmRem: 50000, kmReal: 50000, pnRem: 30000, pnReal: 40000 });

const DATE = v => `Date(${v.slice(0, 4)},${+v.slice(5, 7) - 1},1)`;
const FROTA_COLS = ['VIGÊNCIA', 'Δ ORÇ (BRL)', 'Δ REM (BRL)', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'];
const lin = (v, cid, n3, cta, rem, real) => ({ c: [{ v: DATE(v) }, { v: 0 }, { v: 0 }, { v: cid }, { v: n3 }, { v: cta }, { v: 'x' }, { v: 2026 }, { v: -rem }, { v: -rem }, { v: -real }] });
const gvizFrota = () => ({ status: 'ok', table: { cols: FROTA_COLS.map(l => ({ label: l })), rows: G.flatMap(x => { const [cid, n3] = U[x.u]; return [
  lin(x.v, cid, n3, 'Combustíveis Veiculos e Equipamentos', x.combRem, x.combReal), lin(x.v, cid, n3, 'Fluídos (Arla)', x.arlaRem, x.arlaReal),
  lin(x.v, cid, n3, 'Manutenção de Veículos e Equipamentos', x.manRem, x.manReal), lin(x.v, cid, n3, 'Pneus Novos', x.pnRem, x.pnReal),
  lin(x.v, cid, n3, 'Seguro de Veículos e Equipamentos', 5000, 9000), lin(x.v, cid, n3, 'IPVA e Licenciamento de Veículos', 1000, 9000), lin(x.v, cid, n3, 'Depreciação', 2000, 2500)]; })
  // VAN do GRL em ago/26: o DRE escreve "ROTA (VAN) - GRL"
  .concat([lin('2026-08', 'GUARULHOS', 'ROTA (VAN) - GRL', 'Combustíveis Veiculos e Equipamentos', 20000, 22000)])
  // mês só orçado (set/26 sem realizado) não pode virar fato
  .concat([lin('2026-09', 'CAMPO GRANDE', 'ROTA - CGR', 'Combustíveis Veiculos e Equipamentos', 100000, 0)]) } });
const gvizReceita = () => ({ status: 'ok', table: { cols: FROTA_COLS.map(l => ({ label: l })), rows: [] } });
const gvizDisp = () => { const rows = G.map(x => { const c = new Array(40).fill(null).map(() => ({ v: null }));
  c[0] = { v: DATE(x.v) }; c[13] = { v: x.u.split(' ')[0] }; c[14] = { v: U[x.u][1] }; c[22] = { v: 400 }; c[25] = { v: 12 }; c[28] = { v: 8 }; c[38] = { v: 5 }; c[31] = { v: x.kmRem }; c[32] = { v: x.kmReal }; return { c }; });
  return { status: 'ok', table: { cols: new Array(40).fill(0).map((_, i) => ({ label: 'c' + i })), rows } }; };
// aba Km/L SEM cabeçalho: rótulos A, B, C… e a 1ª linha com os títulos só nas colunas de texto
const L = n => n < 26 ? String.fromCharCode(65 + n) : 'A' + String.fromCharCode(65 + n - 26);
const kmlLin = (vig, proj, placa, modelo, km, lit, tot, rem) => { const c = new Array(27).fill(null).map(() => ({ v: null }));
  c[0] = { v: DATE(vig) }; c[4] = { v: rem }; c[5] = { v: rem }; c[6] = { v: km / lit }; c[9] = { v: tot / lit }; c[14] = { v: proj }; c[15] = { v: 'x' }; c[16] = { v: placa }; c[19] = { v: modelo };
  c[22] = { v: km }; c[23] = { v: lit }; c[25] = { v: tot }; return { c }; };
const gvizKml = () => { const head = new Array(27).fill(null).map(() => ({ v: null })); head[0] = { v: 'Vigência' }; head[14] = { v: 'Projeto-Unidade' }; head[15] = { v: 'Unidade' }; head[16] = { v: 'Placa' }; head[19] = { v: 'Modelo' };
  return { status: 'ok', table: { cols: new Array(27).fill(0).map((_, i) => ({ id: L(i), label: '' })), rows: [{ c: head },
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0A01', 'VW 13.180', 20000, 10000, 60000, 2.5),
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0B02', 'VW 13.180', 20000, 8000, 48000, 2.5),
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0C03', 'VW 9.170', 15000, 6000, 36000, 2.5),
    kmlLin('2026-08', 'EMPURRADA - PIR', 'PIR1A11', 'MB ACTROS', 50000, 21000, 21000 * 5.8, 2.5),
    kmlLin('2026-08', 'VAN - GRL', 'GRL9V99', 'RENAULT MASTER', 8000, 1200, 1200 * 6.2, 7) ] } }; };
const gvizRsl = () => ({ status: 'ok', table: { cols: ['Unidade Benner', 'TipoCombustivel', 'x', 'Vigência', 'PrecoOperadora'].map(l => ({ label: l })), rows: [
  { c: [{ v: 'ROTA - CGR' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 5.8 }] },
  { c: [{ v: 'EMPURRADA - PIR' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 5.8 }] },
  { c: [{ v: 'ROTA - GRL' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 6.0 }] } ] } });
// Gerot: o contrato que o CorrDados usa (records com o NOME da unidade)
const RECS = G.flatMap(x => [{ field: 'sla', unit: U[x.u][2], vig: x.v, real: x.sla }, { field: 'prev', unit: U[x.u][2], vig: x.v, real: x.prev }, { field: 'disp', unit: U[x.u][2], vig: x.v, real: 96 }]);
const FIL2COD = Object.fromEntries(Object.entries(U).map(([c, a]) => [a[2], c]));
const STUB_GEROT = `window.GerotBase={load:async()=>${JSON.stringify(RECS)},FIL2COD:${JSON.stringify(FIL2COD)},METAS:{}};`;
const hoje = new Date(); const ha = d => { const x = new Date(hoje); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const T = {
  fca_profiles: [{ is_admin: true }],
  fca: [
    { id: 'h1', unidade: 'GRL', vigencia: 'jul/26', origem: 'Custos', fato: 'Manutenções', projeto: 'ROTA - GRL', causa: 'SLA da oficina credenciada estourado, OS paradas', acao: 'Cobrar a oficina e priorizar as OS antigas', status: 'Concluída' },
    { id: 'h2', unidade: 'CGR', vigencia: 'ago/26', origem: 'Custos', fato: 'Combustíveis', projeto: 'ROTA - CGR', causa: 'Rodamos mais km por causa da rota nova', acao: 'Rever roteirização', status: 'Em andamento' },
    { id: 'h3', unidade: 'PIR', vigencia: 'ago/26', origem: 'RPM', fato: 'SLA Man.', projeto: 'EMPURRADA', causa: 'x', acao: 'y' } ],
  carta_custos: [
    { id: 1, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Freios', equipamento: 'GRL1A11', fornecedor: 'Oficina Alfa', valor: 18000, nf: '10', projeto: 'ROTA' },
    { id: 2, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Freios', equipamento: 'GRL2B22', fornecedor: 'Oficina Alfa', valor: 12000, nf: '11', projeto: 'ROTA' },
    { id: 3, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Motor', equipamento: 'GRL3C33', fornecedor: 'Retífica Beta', valor: 10000, nf: '12', projeto: 'ROTA' },
    { id: 4, unidade: 'PIR', vigencia: '2026-08', pacote: 'Pneus', conta: 'Pneus Novos', grupo: 'Pneus Novos', equipamento: 'PIR1A11', fornecedor: 'Pneus Gama', valor: 9000, nf: '13', projeto: 'EMPURRADA' } ],
  ginfo_snapshot: [
    { chave: 'ativos', data: [{ Placa: 'GRL1A11', Projeto: 'ROTA', 'Ano Fabricação': 2020 }, { Placa: 'PIR1A11', Projeto: 'EMPURRADA', 'Ano Fabricação': 2024 }] },
    { chave: 'preventivas', data: [{ Placa: 'GRL4D44', Status: 'Vencido', 'Dias Próxima': -12, Filial: 'CDD GUARULHOS' }, { Placa: 'GRL5E55', Status: 'No Prazo', 'Dias Próxima': 20, Filial: 'CDD GUARULHOS' }] },
    { chave: 'os-em-aberto', data: [{ 'Nº OS': 777, Data: ha(30), Status: 'Aberta', Filial: 'CDD GUARULHOS', Criticidade: 'Alta', Placa: 'GRL6F66' }, { 'Nº OS': 778, Data: ha(2), Status: 'Aberta', Filial: 'CDD GUARULHOS', Criticidade: 'Baixa', Placa: 'GRL7G77' }] },
    { chave: 'alinhamentos', data: [{ Placa: 'PIR2B22', Status: 'Vencido', Filial: 'PIRAI EMPURRADA' }] } ],
  snapshot: [{ endpoint: 'tires', branch_id: 38, data: [
    { status: 'INSTALLED', placa: 'PIR1A11', menorMM: 3.5, amplitude: 1, pressaoNOK: true }, { status: 'INSTALLED', placa: 'PIR1A11', menorMM: 8, amplitude: 6, pressaoNOK: true },
    { status: 'INSTALLED', placa: 'PIR3C33', menorMM: 2.5, amplitude: 1, pressaoNOK: false }, { status: 'INSTALLED', placa: 'PIR3C33', menorMM: 9, amplitude: 1, pressaoNOK: false },
    { status: 'INVENTORY', placa: '', menorMM: 12 } ] }],
  custo_vigencia_mv: [], disp_resumo: [], indisponibilidade: [],
  ce_scores_mensais: [
    { competencia: '2026-08-01', chave: 'gt:1', motorista: 'JOAO RUIM', unidade: 'EMP PIRAI', km: 3000, dias: 20, pontuacao: 52, rpm_pontos: 40, idle_pontos: 60, acel_pontos: 80, vel_pontos: 90, viagens: 30, vel_excessos: 1, litros: 1300, km_litros: 3000 },
    { competencia: '2026-08-01', chave: 'gt:2', motorista: 'ANA BOA', unidade: 'EMP PIRAI', km: 3500, dias: 20, pontuacao: 91, rpm_pontos: 90, idle_pontos: 90, acel_pontos: 95, vel_pontos: 95, viagens: 30, vel_excessos: 0, litros: 1250, km_litros: 3500 } ],
};
const CE_UNI = { CGR: 'CDD CAMPO GRANDE', GRL: 'CDD GUARULHOS', PIR: 'EMP PIRAI', 'CBA T2': 'CDD CUIABA', FLP: 'CDD FLORIANOPOLIS', NFR: 'CDD NOVA FRIBURGO', PLT: 'CDD PELOTAS', RON: 'CDD RONDONOPOLIS', BLC: 'CDD BALNEARIO', 'MCC T2': 'CDI MACACU' };
G.forEach((x, i) => { const dc = x.combReal / x.combRem - 1; const nota = Math.max(5, Math.min(99, 80 - dc * 150 + (rnd() - 0.5) * 2));
  T.ce_scores_mensais.push({ competencia: x.v + '-01', chave: 'gt:p' + i, motorista: 'MOT ' + x.u + ' ' + x.v, unidade: CE_UNI[x.u], km: 2000, dias: 20, pontuacao: nota, rpm_pontos: nota, idle_pontos: 70, acel_pontos: 80, vel_pontos: 90, viagens: 30, vel_excessos: 0, litros: 800, km_litros: 2000 }); });
const SHIM_SB = admin => `window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'renan@x.com'}}}})},
  from:(tabela)=>{const T=${JSON.stringify(T)};let rows=(T[tabela]||[]).slice();
    const q={select(){return q;},order(){return q;},eq(c,v){if(tabela==='fca_profiles')rows=[{is_admin:${admin},nome:'Renan Teste'}];else rows=rows.filter(r=>r[c]===v);return q;},
      in(c,vs){rows=rows.filter(r=>!(c in r)||vs.includes(r[c]));return q;},gte(){return q;},lt(){return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      range:async(a,b)=>({data:rows.slice(a,b+1),error:null,count:rows.length}),
      then(res,rej){return Promise.resolve({data:rows,error:null}).then(res,rej);}};
    return q;}})};`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre({ admin = true, w = 1600, h = 900, tema = 'dark' } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gerot-base.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_GEROT }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('supabase') ? SHIM_SB(admin) : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");' : '' }); });
  await ctx.route('**/docs.google.com/**', r => { const u = r.request().url(); const aba = decodeURIComponent((u.match(/sheet=([^&]+)/) || [])[1] || '');
    const j = aba === 'Frota' ? gvizFrota() : aba === 'Receita Líquida' ? gvizReceita() : aba === 'Dispersão de km' ? gvizDisp() : aba === 'Km/L' ? gvizKml() : aba === 'R$/L' ? gvizRsl() : { status: 'error', errors: [{ message: 'aba desconhecida ' + aba }] };
    r.fulfill({ status: 200, contentType: 'text/plain', body: '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(j) + ');' }); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(t => { try { localStorage.setItem('bi_theme', t); localStorage.removeItem('fcaauto_mini'); } catch (e) {} }, tema);
  await pg.goto(BASE + '/fca-automatico/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.gate') || (typeof CTX !== 'undefined' && CTX && typeof PROLOG_ESTADO !== 'undefined' && PROLOG_ESTADO !== 'lendo'), { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return { pg, ctx, errs };
}
const rola = pg => pg.evaluate(() => ({ doc: document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
  main: (() => { const m = document.getElementById('mainBox'); return m.scrollHeight > m.clientHeight + 1; })() }));

/* ══ 1 · motor ══ */
{
  console.log('\n══ 1 · fatos, ponte, ofensores, rede, aprendizado');
  const { pg, ctx, errs } = await abre();
  af('sem erro de página', errs.length === 0, errs.join(' | '));
  const r = await pg.evaluate(() => {
    const f = id => FATOS.find(x => x.id === id);
    const cgr = f('CGR|ROTA|Combustíveis|2026-08'), grl = f('GRL|ROTA|Manutenções|2026-08'), pir = f('PIR|EMPURRADA|Pneus|2026-08'), pirc = f('PIR|EMPURRADA|Combustíveis|2026-08'), van = f('GRL|VAN|Combustíveis|2026-08');
    const d = cgr && diag(cgr), dg = grl && diag(grl), dp = pir && diag(pir), dpc = pirc && diag(pirc), dv = van && diag(van);
    const seg = f('CGR|ROTA|Seguros e licenças|2026-08'), outros = f('CGR|ROTA|Outros|2026-08');
    return { n: FATOS.length, maxVig: CTX.maxVig, setembro: FATOS.some(x => x.vig === '2026-09'), seguro: FATOS.some(x => x.pac === 'Seguros e licenças'),
      seg: seg && { over: seg.over, dpct: seg.dpct, txt: FcaAuto.desvioTxt(seg) }, outros: outros && { over: outros.over }, segD: seg && { causas: diag(seg).causas.map(c => c.txt), acoes: diag(seg).acoes.map(a => a.txt) },
      cgr: cgr && { over: cgr.over, contas: cgr.contas.map(c => [c.conta, Math.round(c.ov)]), txt: FcaAuto.desvioTxt(cgr) },
      ponte: d && { dCusto: d.blocos.ponte.dCusto, vol: d.blocos.ponte.vol, efic: d.blocos.ponte.efic, preco: d.blocos.ponte.preco, dif: d.blocos.ponte.dif, expl: d.explicado,
        kmL: [d.blocos.comb.kmLReal, d.blocos.comb.kmLRem], causas: d.causas.map(c => [c.tema, Math.round(c.rs || 0), c.txt.slice(0, 60)]), acoes: d.acoes.map(a => [a.tema, a.ofens]) },
      grl: dg && { causas: dg.causas.map(c => [c.tema, !!c.rede, c.txt]), acoes: dg.acoes.map(a => [a.tema, a.txt, a.ofens, a.taxa && a.taxa.txt]), hist: dg.historico.daUni.map(c => [c.vig, c.res, c.over, c.overProx]) },
      pir: dp && { causas: dp.causas.map(c => c.txt), acoes: dp.acoes.map(a => [a.txt, a.ofens]) },
      pirc: dpc && { acoes: dpc.acoes.map(a => [a.tema, a.ofens]), efic: dpc.blocos.comb && dpc.blocos.comb.efic, sinais: dpc.sinais.map(s => s.txt), avisos: dpc.avisos },
      van: dv && { comb: dv.blocos.comb && { lit: dv.blocos.comb.lit, rsLRem: dv.blocos.comb.rsLRem } },
      redeManut: (CTX.rede['Manutenções'] || []).filter(e => e.x === 'sla').map(e => ({ r0: +e.r0.toFixed(2), n0: e.n0, sust: e.sust, q0: e.q0 })),
      aprend: CTX.aprend.temas.map(t => [t.pac, t.tema, t.aval, t.melhor]), casos: CTX.aprend.casos.map(c => [c.uni, c.vig, c.res]),
      extra: { cat: Object.keys(CTX.cat), nRede: (CTX.rede['Manutenções'] || []).length, pir: CTX.fatoUni['PIR|2026-08'], grl: CTX.fatoUni['GRL|2026-08'], grlJul: CTX.fatoUni['GRL|2026-07'], cgr: CTX.fatoUni['CGR|2026-08'],
        redeNota: (CTX.rede['Combustíveis'] || []).find(e => e.x === 'cond_nota'),
        cgrCausas: d && d.causas.map(c => [c.ind || c.tema, !!c.rede]), cgrCausa: !!(d && d.causas.some(c => c.rede && c.ind === 'cond_nota') && !d.sinais.some(x => x.ind === 'cond_nota')) } };
  });
  af('fatos: a regra do FCA — todo pacote que estourou, inclusive Seguros e licenças e Outros; set/26 (só orçado) fora', r.n > 0 && !r.setembro && r.seguro && r.maxVig === '2026-08', `${r.n} fatos · DRE até ${r.maxVig}`);
  af('Seguro vira fato "Seguros e licenças" de R$ 4.000 (+80%); IPVA (excluído no FCA) não entra; Depreciação cai em "Outros"', r.seg && Math.round(r.seg.over) === 4000 && Math.round(r.seg.dpct) === 80 && !r.seg.txt.includes('IPVA') && r.outros && Math.round(r.outros.over) === 500, JSON.stringify([r.seg, r.outros]));
  af('…com a conta como causa e a conferência do lançamento como ação', r.segD && r.segD.causas[0] && /Seguro de Veículos e Equipamentos: R\$ 4,0 mil acima do remunerado \(▲ 80%\)/.test(r.segD.causas[0]) && r.segD.acoes.some(a => /apólice/.test(a)), JSON.stringify(r.segD));
  af('CGR · ROTA · ago/26 · Combustíveis = R$ 31.000 (30 mil da conta + 1 mil do Arla)', r.cgr && Math.round(r.cgr.over) === 31000, JSON.stringify(r.cgr && r.cgr.contas));
  af('o fato tem o MESMO texto do FCA (Desvio + Contas)', r.cgr && /^Desvio: ▲ R\$ 31\.000 · ▲ -30%\nContas:\n- Combustíveis Veiculos e Equipamentos: ▲ 30K \| ▲ 30%\n- Fluídos \(Arla\): ▲ 1K \| ▲ 20%$/.test(r.cgr.txt), r.cgr && JSON.stringify(r.cgr.txt));
  const P = r.ponte || {};
  af('ponte: Δ custo 30.000 = Volume 10.000 + Eficiência 11.600 + Preço 4.800 + Diferença 3.600', Math.round(P.dCusto) === 30000 && Math.round(P.vol) === 10000 && Math.round(P.efic) === 11600 && Math.round(P.preco) === 4800 && Math.round(P.dif) === 3600, JSON.stringify([P.dCusto, P.vol, P.efic, P.preco, P.dif]));
  af('aba Km/L sem cabeçalho: Km/L real 2,29 × rem 2,50 pelas posições padrão', P.kmL && Math.abs(P.kmL[0] - 55000 / 24000) < 1e-9 && P.kmL[1] === 2.5, JSON.stringify(P.kmL));
  af('100% do desvio explicado em R$ (ponte + Arla)', Math.abs(P.expl - 1) < 1e-9, String(P.expl));
  af('causas na ordem do R$: Eficiência, Volume, Preço, Diferença, Arla (as da rede vêm depois)', P.causas && P.causas.slice(0, 5).map(c => c[1]).join(',') === '11600,10000,4800,3600,1000', JSON.stringify(P.causas));
  const ofE = (P.acoes || []).find(a => a[0] === 'Condução'), ofP = (P.acoes || []).find(a => a[0] === 'Abastecimento / preço');
  af('ofensor de eficiência: só a placa que gastou acima da régua (CGR0A01, 2.000 L)', ofE && ofE[1].length === 1 && /^CGR0A01 \(VW 13\.180\) 2,00 km\/L, 2\.000 L, R\$ 11,6 mil$/.test(ofE[1][0]), JSON.stringify(ofE));
  af('ofensores de preço na ordem do R$ pago acima (A 2.000, B 1.600, C 1.200)', ofP && ofP[1].map(x => x.slice(0, 7)).join(',') === 'CGR0A01,CGR0B02,CGR0C03', JSON.stringify(ofP));
  af('VAN: "ROTA (VAN) - GRL" do DRE casa com "VAN - GRL" da Km/L e usa o preço do ROTA (6,00)', r.van && r.van.comb && r.van.comb.lit === 1200 && r.van.comb.rsLRem === 6, JSON.stringify(r.van));
  const G1 = r.grl || { causas: [], acoes: [] };
  af('Manutenções: a Carta diz onde o dinheiro foi (Freios R$ 30 mil, 75% de R$ 40 mil)', G1.causas.some(c => /Freios R\$ 30,0 mil \(75% do lançado de R\$ 40,0 mil\)/.test(c[2])), JSON.stringify(G1.causas.map(c => c[2].slice(0, 90))));
  af('rede: SLA × desvio de Manutenções plantado sai forte, sentido certo e sustentado', r.redeManut[0] && r.redeManut[0].r0 < -0.8 && r.redeManut[0].sust, JSON.stringify(r.redeManut));
  af('SLA 50% (meta 75%) vira causa "rede" no GRL', G1.causas.some(c => c[1] && /SLA de manutenção 50,0% \(meta 75,0%\); na rede, ligação forte/.test(c[2])), JSON.stringify(G1.causas.filter(c => c[1])));
  const aPrev = G1.acoes.find(a => a[0] === 'Preventiva'), aSla = G1.acoes.find(a => a[0] === 'Oficina / SLA'), aRaiz = G1.acoes.find(a => /causa raiz/.test(a[1])), aFor = G1.acoes.find(a => a[0] === 'Peças / fornecedor');
  af('ação: preventivas vencidas do Ginfo de hoje com a placa (GRL4D44, 12d)', aPrev && aPrev[2].join() === 'GRL4D44 (12d)', JSON.stringify(aPrev));
  af('ação: OS em aberto, da mais velha (OS 777 há 30 dias, Alta)', aSla && aSla[2][0] === 'OS 777 GRL6F66 30d (Alta)', JSON.stringify(aSla));
  af('ação: causa raiz nas placas que mais custaram (GRL1A11 R$ 18,0 mil primeiro)', aRaiz && aRaiz[2][0] === 'GRL1A11 R$ 18,0 mil', JSON.stringify(aRaiz));
  af('ação: fornecedor que concentra o gasto (Oficina Alfa 75%)', aFor && /^Oficina Alfa R\$ 30,0 mil \(75%\)$/.test(aFor[2][0]), JSON.stringify(aFor));
  af('aprendizado: FCA de jul/26 do GRL "melhorou" (30 mil → 15 mil no mês seguinte)', G1.hist.length === 1 && G1.hist[0][1] === 'melhorou' && Math.round(G1.hist[0][2]) === 30000 && Math.round(G1.hist[0][3]) === 15000, JSON.stringify(G1.hist));
  af('…e a ação de SLA traz a taxa do tema na rede (1 de 1)', aSla && /FCAs de oficina \/ sla em Manutenções melhoraram o mês seguinte em 1 de 1/.test(aSla[3] || ''), JSON.stringify(aSla && aSla[3]));
  af('FCA de RPM fica fora do aprendizado de Custos; o de ago/26 fica "aguardando"', !r.casos.some(c => c[0] === 'PIR') && r.casos.some(c => c[0] === 'CGR' && c[2] === 'aguardando'), JSON.stringify(r.casos));
  const Pn = r.pir || { causas: [], acoes: [] };
  af('Pneus: Prolog (2 de 4 com pressão fora; 1 com ≤ 3 mm) e alinhamento vencido viram causa', Pn.causas.some(c => /2 de 4 pneus instalados com pressão fora/.test(c)) && Pn.causas.some(c => /1 pneu\(s\) instalados com 3 mm ou menos/.test(c)) && Pn.causas.some(c => /1 placa\(s\) com alinhamento vencido/.test(c)), JSON.stringify(Pn.causas));
  af('Pneus: ações com placa (calibrar PIR1A11; recape 3–4 mm; alinhar PIR2B22)', Pn.acoes.some(a => /Calibrar/.test(a[0]) && a[1][0] === 'PIR1A11 2 pneu(s)') && Pn.acoes.some(a => /recape/.test(a[0])) && Pn.acoes.some(a => /Alinhar/.test(a[0]) && a[1][0] === 'PIR2B22'), JSON.stringify(Pn.acoes));
  const Pc = r.pirc || { acoes: [], sinais: [] };
  af('condução: o motorista de pior nota de PIR entra na ação de eficiência', Pc.acoes.some(a => a[0] === 'Condução' && a[1].some(x => /^JOAO RUIM 52 pts/.test(x))) && !Pc.acoes.some(a => a[1].some(x => /ANA BOA/.test(x))), JSON.stringify(Pc.acoes));
  const X = r.extra || {};
  af('catálogo: as variáveis novas entram na rede (condução, frota, Carta, FCA, bases de combustível)', ['cond_nota', 'cond_baixo', 'carta_n', 'carta_forn', 'fca_preench', 'kml_gap', 'preco_gap'].every(k => X.cat.includes(k)) && X.cat.length >= 40 && X.nRede >= 15, `${X.cat.length} no catálogo · ${X.nRede} com dado em Manutenções`);
  af('condução de PIR ago/26: inclui o motorista plantado (≥ 500 km) e pesa pelo km', X.pir && X.pir.cond_nota > 0 && X.pir.cond_nota < 91 && X.pir.cond_baixo > 0, JSON.stringify(X.pir));
  af('Carta do GRL ago/26: 3 lançamentos, ticket R$ 13.333, maior fornecedor 75%', X.grl && X.grl.carta_n === 3 && Math.round(X.grl.carta_ticket) === 13333 && Math.round(X.grl.carta_forn) === 75, JSON.stringify(X.grl));
  af('Carta de PIR ago/26: 100% de pneus novos; FCA do GRL jul/26: 100% com ação', X.pir && Math.round(X.pir.carta_novos) === 100 && X.grlJul && X.grlJul.fca_preench === 100, JSON.stringify([X.pir && X.pir.carta_novos, X.grlJul]));
  af('bases de combustível do CGR ago/26: Km/L −8,3% e R$/L +3,4% contra o remunerado', X.cgr && Math.abs(X.cgr.kml_gap - (22000 / 24000 - 1) * 100) < 1e-9 && Math.abs(X.cgr.preco_gap - (144000 / 139200 - 1) * 100) < 1e-9, JSON.stringify(X.cgr));
  af('a nota de condução PLANTADA sai sustentada pela rede no Combustíveis', X.redeNota && X.redeNota.sust && X.redeNota.r0 < -0.8, JSON.stringify(X.redeNota));
  af('…e vira causa "rede" no CGR ago/26, sem entrar como sinal duplicado', X.cgrCausa, JSON.stringify(X.cgrCausas));
  af('empurrada sem Dispersão maior: sem causa de volume; aviso nenhum de base faltando', Pc.efic > 0 && !Pc.avisos.length, JSON.stringify(Pc.avisos));
  await ctx.close();
}

/* ══ 2 · telas ══ */
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  console.log(`\n══ 2 · telas ${w}×${h} ${tema}`);
  const { pg, ctx, errs } = await abre({ w, h, tema });
  af('sem erro de página', errs.length === 0, errs.join(' | '));
  for (const v of ['resumo', 'kanban', 'tabela', 'rede', 'historico', 'fontes']) {
    await pg.click(`.s-item[data-v="${v}"]`); await pg.waitForTimeout(120);
    const s = await rola(pg);
    af(`${v}: a página não rola${v === 'resumo' || v === 'rede' || v === 'fontes' ? ' e o miolo também não' : ''}`, !s.doc && (v === 'kanban' || v === 'tabela' || v === 'historico' || !s.main), JSON.stringify(s));
    if (SHOT && w === 1366) await pg.screenshot({ path: path.join(SHOT, `fa-${v}-${tema}.png`) });
  }
  if (w === 1366 && tema === 'dark') {
    await pg.click('.s-item[data-v="resumo"]'); await pg.waitForTimeout(100);
    const res = await pg.evaluate(() => ({ hn: document.querySelector('.hn').textContent, sub: document.getElementById('subVista').textContent, kpis: [...document.querySelectorAll('.fa-kpis .kpi .kl')].map(x => x.textContent) }));
    af('resumo abre em ago/26 (último mês com realizado) com o desvio total', /AGO\/26/.test(res.sub) && /^R\$/.test(res.hn), JSON.stringify(res));
    await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(100);
    await pg.click('tr[data-id="CGR|ROTA|Combustíveis|2026-08"]'); await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({ vis: getComputedStyle(document.getElementById('fm-ov')).display, tit: document.getElementById('fm-tit').textContent, txt: document.getElementById('fm-corpo').textContent }));
    af('clique na linha abre o diagnóstico (ponte, causas, ações)', m.vis === 'flex' && /Combustíveis · R\$ 31,0 mil/.test(m.tit) && /Ponte da conta Combustíveis/.test(m.txt) && /Vistoria de consumo/.test(m.txt), m.tit);
    af('…com o que a unidade escreveu no FCA do mês', /Rodamos mais km por causa da rota nova/.test(m.txt), '');
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'fa-modal.png') });
  }
  await ctx.close();
}

/* ══ 3 · sem admin ══ */
{
  console.log('\n══ 3 · sem admin');
  const { pg, ctx } = await abre({ admin: false });
  const gt = await pg.evaluate(() => (document.querySelector('.gate h2') || {}).textContent || '');
  af('cai no gate de admin', /somente admin/.test(gt), gt);
  await ctx.close();
}
await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

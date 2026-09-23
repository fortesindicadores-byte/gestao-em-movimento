// ============================================================================
// Teste do painel /correlacoes/ no Chromium, com TODAS as fontes dubladas
// (o sandbox não alcança o Supabase nem o Google). O que se prova aqui:
//
//  1. a tabela-fato nasce das mesmas leituras dos painéis: DRE Frota por
//     RÓTULO (com a cidade acentuada e o tier pelo Nível 3), Dispersão de km
//     por índice, Gerot pelo gerot-base, fca/disp_resumo/custo_vigencia_mv/
//     ce_scores_mensais pelo supabase-js — cada uma virando a variável certa;
//  2. a matriz acha a relação plantada nos dados (desvio de Combustíveis ×
//     dispersão de km, r ≈ 0,95) e a marca como forte e significativa; o par
//     com menos de 8 pontos aparece como "·" e não entra nos achados;
//  3. a regressão dá β significativo à variável que explica e não à que é
//     ruído; a defasagem acha k = 1 quando a causa foi plantada um mês antes;
//  4. os dois lados de cada guarda: fonte com erro NÃO derruba as outras (a
//     tela avisa e segue); filtro de unidade estreito vira "Poucos pontos";
//     usuário sem admin cai no gate;
//  5. os gráficos são de verdade (Chart.js real quando CDN_DIR aponta para
//     ele; sem isso, um dublê que grava o config) e as barras seguem o padrão
//     do Painel KM.
//
// Uso: CDN_DIR=<pasta com chart.umd.js e chartjs-plugin-datalabels.js> node scripts/correlacoes-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const CDN = process.env.CDN_DIR || '';
const SHOT = process.env.SHOT_DIR || '';   // pasta para os prints de cada visão (opcional)
const shot = (pg, nome) => SHOT ? pg.screenshot({ path: path.join(SHOT, nome + '.png') }) : Promise.resolve();
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures: 13 unidades × 8 meses, com relações PLANTADAS ─────────────── */
const UNIS = ['CGR', 'BLC', 'CBA T1', 'CBA T1 WH', 'CBA T2', 'FLP', 'GRL', 'NFR', 'PLT', 'RON', 'MCC T1', 'MCC T2', 'PIR'];
const VIGS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
// cidade acentuada + Nível 3 como a aba Frota escreve
const DRE_UNI = { CGR: ['CAMPO GRANDE', 'ROTA - CGR'], BLC: ['BALNEÁRIO CAMBORIÚ', 'ROTA - BLC'], 'CBA T1': ['CUIABÁ', 'EMPURRADA - CBA'], 'CBA T1 WH': ['CUIABÁ', 'APOIO - CBA'],
  'CBA T2': ['CUIABÁ', 'ROTA - CBA'], FLP: ['FLORIANÓPOLIS', 'ROTA - FLP'], GRL: ['GUARULHOS', 'ROTA - GRL'], NFR: ['NOVA FRIBURGO', 'ROTA - NFR'], PLT: ['PELOTAS', 'ROTA - PLT'],
  RON: ['RONDONÓPOLIS', 'ROTA - RON'], 'MCC T1': ['CACHOEIRAS DE MACACU', 'EMPURRADA - MCC'], 'MCC T2': ['CACHOEIRAS DE MACACU', 'ROTA - MCC'], PIR: ['PIRAÍ', 'EMPURRADA - PIR'] };
const GEROT_UNI = { CGR: 'CDD RIO DE JANEIRO', BLC: 'CDD CAMBORIU', 'CBA T1': 'CUIABA EMPURRADA', 'CBA T1 WH': 'CUIABA', 'CBA T2': 'CDD CUIABA', FLP: 'CDD FLORIANOPOLIS', GRL: 'CDD GUARULHOS',
  NFR: 'CDD NOVA FRIBURGO', PLT: 'CDD PELOTAS', RON: 'CDD RONDONOPOLIS', 'MCC T1': 'MACACU EMPURRADA', 'MCC T2': 'CDI MACACU', PIR: 'PIRAI EMPURRADA' };
// gerador determinístico (LCG) para o teste ser reproduzível
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const FATO = [];
UNIS.forEach((u, ui) => VIGS.forEach((v, vi) => {
  const kmRem = 80000 + ui * 9000 + vi * 1500;
  const disp = (rnd() - 0.3) * 0.3;                       // dispersão de km: −9%…+21%
  const kmReal = kmRem * (1 + disp);
  const dcomb = disp * 0.9 + (rnd() - 0.5) * 0.02;         // PLANTADO: desvio de comb ≈ dispersão (r ≈ 0,95)
  const combRem = kmRem * 1.8, combReal = combRem * (1 + dcomb);
  const prev = 70 + rnd() * 30;                            // preventivas (Ginfo)
  FATO.push({ u, v, ui, vi, kmRem, kmReal, disp, dcomb, combRem, combReal, prev,
    mttr: 2 + rnd() * 6, ruido: rnd() * 100 });
}));
// PLANTADO: desvio de Manutenções em t = −(prev em t−1 − 85)/100 + ruído pequeno
FATO.forEach(f => { const ant = FATO.find(g => g.u === f.u && g.vi === f.vi - 1); f.dmanut = ant ? -(ant.prev - 85) / 100 + (rnd() - 0.5) * 0.01 : (rnd() - 0.5) * 0.2; });
// PLANTADO: disponibilidade (Ginfo) cai com o MTTR (r negativo forte)
FATO.forEach(f => { f.dispG = 98 - f.mttr * 0.8 + (rnd() - 0.5) * 0.4; });

const DATE = v => `Date(${v.slice(0, 4)},${+v.slice(5, 7) - 1},1)`;
const gvizFrota = () => ({ status: 'ok', table: {
  cols: ['VIGÊNCIA', 'Δ ORÇ (BRL)', 'Δ REM (BRL)', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'].map(l => ({ label: l })),
  rows: FATO.flatMap(f => {
    const [cid, n3] = DRE_UNI[f.u];
    // a aba Frota guarda DESPESA COM SINAL NEGATIVO — o painel tem de inverter
    const lin = (cta, rem, real) => ({ c: [{ v: DATE(f.v) }, { v: 0 }, { v: 0 }, { v: cid }, { v: n3 }, { v: cta }, { v: 'x' }, { v: 2026 }, { v: -rem }, { v: -rem }, { v: -real }] });
    return [lin('Combustíveis Veiculos e Equipamentos', f.combRem, f.combReal),
      lin('Manutenção de Veículos e Equipamentos', f.kmRem * 0.9, f.kmRem * 0.9 * (1 + f.dmanut)),
      lin('Pneus Novos', f.kmRem * 0.3, f.kmRem * 0.3 * (1 + (rnd() - 0.5) * 0.1)),
      lin('Seguro de Veículos e Equipamentos', 5000, 5000)];
  }).concat([{ c: [{ v: DATE('2026-08') }, { v: 0 }, { v: 0 }, { v: 'GOIÂNIA' }, { v: 'MOBILIZAÇÃO - GNA' }, { v: 'Pneus Novos' }, { v: 'x' }, { v: 2026 }, { v: -100 }, { v: -100 }, { v: -120 }] }]),
} });
const gvizDisp = () => { const rows = FATO.map(f => { const c = new Array(40).fill(null).map(() => ({ v: null }));
  c[0] = { v: DATE(f.v) }; c[13] = { v: f.u.split(' ')[0] }; c[14] = { v: DRE_UNI[f.u][1] }; c[22] = { v: 300 + f.ui * 10 }; c[31] = { v: f.kmRem }; c[32] = { v: f.kmReal }; return { c }; });
  return { status: 'ok', table: { cols: new Array(40).fill(0).map((_, i) => ({ label: 'c' + i })), rows } }; };
// Gerot dublado: só o contrato que o painel usa (load → records; FIL2COD)
const GEROT_RECS = FATO.flatMap(f => [
  { field: 'disp', unit: GEROT_UNI[f.u], vig: f.v, real: f.dispG },
  { field: 'prev', unit: GEROT_UNI[f.u], vig: f.v, real: f.prev },
  { field: 'mttr', unit: GEROT_UNI[f.u], vig: f.v, real: f.mttr },
  { field: 'sla', unit: GEROT_UNI[f.u], vig: f.v, real: f.ruido },
  { field: 'pneuAmp', unit: GEROT_UNI[f.u], vig: f.v, real: 3, snapshot: true },      // amplitude: fica de fora (só a última vigência)
]).concat(VIGS.slice(0, 3).map(v => ({ field: 'blitz', unit: 'CDD PELOTAS', vig: v, real: 90 })));   // 3 pontos: abaixo do mínimo
const FIL2COD = Object.fromEntries(Object.entries(GEROT_UNI).map(([c, n]) => [n, c]));
const STUB_GEROT = `window.GerotBase={load:async()=>${JSON.stringify(GEROT_RECS)},FIL2COD:${JSON.stringify(FIL2COD)}};`;
// tabelas do Supabase
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago'];
const T = {
  fca_profiles: [{ is_admin: true }],
  fca: FATO.flatMap(f => Array.from({ length: 1 + (f.ui % 3) }, (_, i) => ({ unidade: f.u, vigencia: `${MESES[f.vi]}/26`, origem: i ? 'RPM' : 'Custos', status: i ? 'Concluída' : 'Em andamento', prazo: '2026-01-15' }))),
  disp_resumo: FATO.flatMap(f => [1, 15].map(d => ({ data: `${f.v}-${String(d).padStart(2, '0')}`, unidade: f.u, ativos: 100, indisponiveis: Math.round(f.mttr) }))),
  custo_vigencia_mv: Array.from({ length: 60 }, (_, i) => { const vig = VIGS[i % 8], placa = 'ABC' + String(1000 + (i % 15)); const km = 1000 + (i % 15) * 300 + (i % 8) * 50;
    return { vig_km: vig, placa, unidade: UNIS[i % 13], projeto: 'ROTA', tipo: i % 5 ? 'variavel' : 'fixo', taxa_km: 0.35, km_vig: km, custo_vig: km * 0.35, litros: km / 2.4, valor_diesel: km / 2.4 * 6.1, abastecimentos: 4, modelo: 'VW', valor_vw: i % 4 ? km * 0.36 : null, faixas_vw: 1, previa: false }; }),
  ginfo_snapshot: [{ chave: 'ativos', data: Array.from({ length: 15 }, (_, i) => ({ Placa: 'ABC' + String(1000 + i), 'Ano Fabricação': 2016 + (i % 8) })) }],
  indisponibilidade: [{ placa: 'ABC1002', data_parada: '2026-03-02', data_retorno: '2026-03-11', unidade: 'CBA T1' }, { placa: 'ABC1001', data_parada: '2026-05-20', data_retorno: null, unidade: 'BLC' }],
  ce_scores_mensais: Array.from({ length: 80 }, (_, i) => { const nota = 40 + (i % 20) * 3; const km = 1200 + (i % 7) * 100; const kml = 1.8 + nota / 100 + (i % 3) * 0.05;
    return { competencia: `${VIGS[Math.floor(i / 10) % 8]}-01`, chave: 'gt:' + (i % 10), motorista: 'M' + (i % 10), unidade: 'EMP PIRAI', km, dias: 20, rpm_pontos: nota, idle_pontos: 50, acel_pontos: 60, vel_pontos: 70, pontuacao: nota, viagens: 30, vel_excessos: 2, litros: km / kml, km_litros: km }; }),
};

const SHIM_SB = (admin, erroEm) => `window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com',user_metadata:{name:'Renan Teste'}}}}})},
  from:(tabela)=>{const T=${JSON.stringify(T)};const ERRO=${JSON.stringify(erroEm || [])};let rows=(T[tabela]||[]).slice();let single=false;
    const q={select(){return q;},order(){return q;},eq(c,v){if(tabela==='fca_profiles')rows=[{is_admin:${admin}}];else rows=rows.filter(r=>r[c]===v);return q;},in(){return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      range:async(a,b)=>ERRO.includes(tabela)?{data:null,error:{message:'relation "'+tabela+'" does not exist'}}:{data:rows.slice(a,b+1),error:null},
      then(res,rej){return (ERRO.includes(tabela)?Promise.resolve({data:null,error:{message:'relation does not exist'}}):Promise.resolve({data:rows,error:null})).then(res,rej);}};
    return q;}})};`;
const SHIM_CHART = `window.__charts=[];(function(){function Chart(ctx,cfg){this.config=cfg;this.data=cfg.data;this.options=cfg.options||{};this.canvas=ctx;window.__charts.push({cfg,id:ctx&&ctx.id});this.destroy=function(){};this.update=function(){};this.resize=function(){};}
  Chart.getChart=function(id){const c=[...window.__charts].reverse().find(x=>x.id===id);return c?{config:c.cfg,data:c.cfg.data}:null;};Chart.register=function(){};Chart.defaults={font:{}};window.Chart=Chart;})();`;
const REAL_CHART = CDN && fs.existsSync(path.join(CDN, 'chart.umd.js')) ? fs.readFileSync(path.join(CDN, 'chart.umd.js'), 'utf8') : null;
const REAL_DL = CDN && fs.existsSync(path.join(CDN, 'chartjs-plugin-datalabels.js')) ? fs.readFileSync(path.join(CDN, 'chartjs-plugin-datalabels.js'), 'utf8') : null;
console.log(REAL_CHART ? 'Chart.js REAL do CDN_DIR' : 'Chart.js dublado (defina CDN_DIR para usar o real)');

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre({ admin = true, erroEm = [], grao = 'uni' } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gerot-base.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_GEROT }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    const body = u.includes('supabase') ? SHIM_SB(admin, erroEm)
      : u.includes('datalabels') ? (REAL_DL || 'window.ChartDataLabels={id:"datalabels"};')
      : u.includes('chart') ? (REAL_CHART || SHIM_CHART)
      : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");'
      : u.includes('jspdf') ? 'window.jspdf={jsPDF:function(){}};' : '/* nada */';
    r.fulfill({ status: 200, contentType: 'application/javascript', body }); });
  await ctx.route('**/docs.google.com/**', r => { const u = r.request().url(); const aba = decodeURIComponent((u.match(/sheet=([^&]+)/) || [])[1] || '');
    const j = aba === 'Frota' ? gvizFrota() : aba === 'Dispersão de km' ? gvizDisp() : { status: 'error', errors: [{ message: 'aba desconhecida ' + aba }] };
    r.fulfill({ status: 200, contentType: 'text/plain', body: '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(j) + ');' }); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const logs = []; pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 160)); });
  await pg.addInitScript(g => { try { localStorage.setItem('corr_grao', g); localStorage.removeItem('corr_mini'); } catch (e) {} }, grao);
  await pg.goto(BASE + '/correlacoes/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('titSub'); return s && !/Carregando|Lendo/.test(s.textContent); }, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(400);
  return { pg, ctx, errs, logs };
}
const estado = pg => pg.evaluate(() => { const t = id => ((document.getElementById(id) || {}).textContent || ''); const ms = id => ((document.getElementById(id) || {})._itens || []); return ({
  sub: t('titSub'), tit: t('tit'),
  gate: !!document.querySelector('.gate'), gateTit: (document.querySelector('.gate h2') || {}).textContent || '',
  aviso: document.getElementById('aviso-slot') ? document.getElementById('aviso-slot').textContent.trim() : '',
  hPares: t('h-pares'), hFortes: t('h-fortes'), hVars: t('h-vars'), hPontos: t('h-pontos'),
  kFontes: t('k-fontes'), kTop: t('k-top-m'),
  unis: ms('ms-uni'), vigs: ms('ms-vig'),
  fatoUni: FATO.uni.length, fatoPlaca: FATO.placa.length, fatoMot: FATO.mot.length,
  vars: MX ? MX.vars.map(v => v.id) : [],
  cel: MX ? Object.fromEntries(['desvio_comb|dispersao', 'disp|mttr', 'blitz|sla', 'sla|desvio_comb', 'custo_real|km_real'].map(k => [k, MX.cel[k] ? { r: +MX.cel[k].r.toFixed(3), n: MX.cel[k].n, q: MX.cel[k].q } : null])) : {},
  achados: achados().slice(0, 8).map(a => [a.x.id, a.y.id, +a.r.toFixed(2), a.n]),
  fontes: FONTES.map(f => [f.nome.split(' (')[0], f.estado, f.linhas]),
  amostra: FATO.uni.filter(r => r.uni === 'CBA T1' && r.vig === '2026-03').map(r => r.v)[0] || null,
  gna: FATO.uni.filter(r => r.uni === 'GNA').map(r => [r.vig, r.v.pneus_real]),
  mxCells: document.querySelectorAll('table.mx td').length, mxNs: document.querySelectorAll('table.mx td.ns').length,
  achadosTr: document.querySelectorAll('#t-achados tbody tr[data-x]').length,
}); }).catch(e => ({ erro: String(e) }));

/* ══ 1 · unidade × mês, tudo respondendo ══ */
{
  console.log('\n══ 1 · grão unidade × mês, todas as fontes');
  const { pg, ctx, errs, logs } = await abre();
  const e = await estado(pg);
  af('sem erro de página', errs.length === 0, errs[0] || '');
  af('sem gate (admin logado)', !e.gate, e.gateTit);
  af('as 5 fontes do grão lidas', e.kFontes === '5/5', e.kFontes + ' · ' + JSON.stringify(e.fontes));
  af('13 unidades × 8 vigências = 104 pontos', e.fatoUni === 105 && e.hPontos === '105', `${e.fatoUni} (13×8 + a linha de GNA em ago)`);
  af('GNA entrou pelo DRE (GOIÂNIA + MOBILIZAÇÃO - GNA)', e.gna.length === 1 && e.gna[0][0] === '2026-08' && e.gna[0][1] === 120, JSON.stringify(e.gna));
  af('tier pelo Nível 3: CUIABÁ + EMPURRADA vira CBA T1', e.unis.includes('CBA T1') && e.unis.includes('CBA T1 WH') && e.unis.includes('CBA T2'), e.unis.join(','));
  const a = e.amostra || {};
  af('DRE: desvio de Combustíveis = real ÷ rem − 1', Math.abs(a.desvio_comb - FATO.find(f => f.u === 'CBA T1' && f.v === '2026-03').dcomb * 100) < 1e-6, String(a.desvio_comb));
  af('DRE: o custo vira POSITIVO (a aba guarda despesa negativa)', a.custo_real > 0 && a.comb_real > 0 && a.custo_rem > 0, JSON.stringify([a.custo_real, a.comb_real]));
  af('…e custo sobe com km (r > 0), não o contrário', e.cel['custo_real|km_real'] && e.cel['custo_real|km_real'].r > 0.9, JSON.stringify(e.cel['custo_real|km_real'] || e.achados));
  af('Dispersão: km rem/real e dispersão %', a.km_rem > 0 && a.km_real > 0 && Math.abs(a.dispersao - FATO.find(f => f.u === 'CBA T1' && f.v === '2026-03').disp * 100) < 1e-6, JSON.stringify([a.km_rem, a.km_real, a.dispersao]));
  af('R$/km de Combustíveis = comb_real ÷ km_real', Math.abs(a.comb_rskm - a.comb_real / a.km_real) < 1e-9, String(a.comb_rskm));
  af('Gerot: disp, prev, mttr entraram pelo FIL2COD; amplitude (snapshot) ficou fora', a.disp > 0 && a.prev > 0 && a.mttr > 0 && !('pneuAmp' in a), JSON.stringify([a.disp, a.prev, a.mttr]));
  af('FCA: contagens por unidade × mês', a.fca_total === 3 && a.fca_custos === 1 && a.fca_rpm === 2 && a.fca_atras === 1 && Math.abs(a.fca_concl - 200 / 3) < 1e-6, JSON.stringify([a.fca_total, a.fca_custos, a.fca_rpm, a.fca_atras, a.fca_concl]));
  af('disp_resumo: média do mês', a.disp_app > 90 && a.disp_app < 100 && a.indisp_med > 0, JSON.stringify([a.disp_app, a.indisp_med]));
  af('a relação plantada aparece: r(Δ Comb, dispersão) ≥ 0,9 com n = 104', e.cel['desvio_comb|dispersao'] && e.cel['desvio_comb|dispersao'].r >= 0.9 && e.cel['desvio_comb|dispersao'].n === 104, JSON.stringify(e.cel['desvio_comb|dispersao']));
  af('…e a negativa: r(disp, MTTR) ≤ −0,9', e.cel['disp|mttr'] && e.cel['disp|mttr'].r <= -0.9, JSON.stringify(e.cel['disp|mttr']));
  af('ruído × sinal fica com q alto (não é achado)', e.cel['sla|desvio_comb'] && !(e.cel['sla|desvio_comb'].q < 0.05), JSON.stringify(e.cel['sla|desvio_comb']));
  af('variável com 3 pontos (blitz) NÃO entra nas variáveis com dado', !e.vars.includes('blitz'), e.vars.join(','));
  const par = (a, x, y) => (a[0] === x && a[1] === y) || (a[0] === y && a[1] === x);
  af('os dois pares plantados estão entre os oito primeiros achados, com |r| ≥ 0,95', e.achados.some(a => par(a, 'desvio_comb', 'dispersao') && a[2] >= 0.95) && e.achados.some(a => par(a, 'disp', 'mttr') && a[2] <= -0.95), JSON.stringify(e.achados));
  af('hero: fortes ≥ 2 (os dois plantados)', +e.hFortes >= 2, e.hFortes + ' · top: ' + e.kTop);
  af('matriz desenhada: vars² células', e.mxCells === e.vars.length * e.vars.length && e.vars.length >= 10, `${e.mxCells} células · ${e.vars.length} vars`);
  af('achados clicáveis na tabela', e.achadosTr >= 2, String(e.achadosTr));
  await shot(pg, 'corr-resumo');

  // ── matriz → clique → dispersão ──
  await pg.click('.s-item[data-vw="matriz"]'); await pg.waitForTimeout(150);
  const cel = await pg.evaluate(() => { const td = document.querySelector('table.mx td[data-x="dispersao"][data-y="desvio_comb"]'); return td ? { txt: td.textContent, ns: td.classList.contains('ns'), bg: td.style.background } : null; });
  af('célula Δ Comb × dispersão: número cheio (significativa) e laranja', cel && !cel.ns && /249, ?115, ?22/.test(cel.bg), JSON.stringify(cel));
  await shot(pg, 'corr-matriz');
  await pg.click('table.mx td[data-x="dispersao"][data-y="desvio_comb"]'); await pg.waitForTimeout(300);
  const d = await pg.evaluate(() => ({ vw: VW, x: document.getElementById('sel-x').value, y: document.getElementById('sel-y').value,
    leitura: document.getElementById('disp-leitura').textContent, stats: document.getElementById('disp-stats').textContent,
    ch: (() => { const c = Chart.getChart('ch-disp'); return c ? { n: c.data.datasets.length, pts: c.data.datasets[0].data.length, tipo: c.config.type, cor: c.data.datasets[0].backgroundColor } : null; })() }));
  af('clique na célula abre a Dispersão com X = dispersão e Y = Δ Comb', d.vw === 'dispersao' && d.x === 'dispersao' && d.y === 'desvio_comb', JSON.stringify([d.vw, d.x, d.y]));
  af('gráfico de dispersão: pontos + reta + faixa (4 datasets), 104 pontos, laranja', d.ch && d.ch.n === 4 && d.ch.pts === 104 && d.ch.tipo === 'scatter' && d.ch.cor === '#F97316A6', JSON.stringify(d.ch));
  af('leitura fala em subir/descer, força e significância', /tende a subir/.test(d.leitura) && /forte/.test(d.leitura) && /significativa/.test(d.leitura) && /não é causa/i.test(d.leitura), d.leitura.slice(0, 120));
  af('cards: r, R², Spearman, n, p', /r de Pearson/.test(d.stats) && /Spearman/.test(d.stats) && /104/.test(d.stats), d.stats.slice(0, 80));
  await shot(pg, 'corr-dispersao');

  // ── regressão: Y = Δ Comb, X = dispersão (sinal) + sla (ruído) ──
  await pg.click('.s-item[data-vw="regressao"]'); await pg.waitForTimeout(150);
  await pg.selectOption('#sel-ry', 'desvio_comb');
  await pg.evaluate(() => { document.querySelectorAll('#rx-list input').forEach(i => { i.checked = ['dispersao', 'sla'].includes(i.value); }); document.getElementById('rx-list').dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(300);
  const rg = await pg.evaluate(() => ({ linhas: [...document.querySelectorAll('#t-reg tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim().replace(/\s+/g, ' '))),
    stats: document.getElementById('reg-stats').textContent, leitura: document.getElementById('reg-leitura').textContent,
    ch: (() => { const c = Chart.getChart('ch-reg'); if (!c) return null; const ds = c.data.datasets[0], o = c.config.options; return { n: ds.data.length, raio: ds.borderRadius, borda: ds.borderWidth, y: o.scales.y.display, dl: o.plugins.datalabels.font.size + '/' + o.plugins.datalabels.font.weight, topo: o.layout.padding.top, cores: ds.borderColor }; })() }));
  const lDisp = rg.linhas.find(l => /Dispersão de km/.test(l[0])), lSla = rg.linhas.find(l => /SLA/.test(l[0]));
  af('regressão: dispersão sustenta (p < 5%), SLA pode ser acaso', lDisp && /sustenta/.test(lDisp[5]) && lSla && /acaso/.test(lSla[5]), JSON.stringify([lDisp, lSla]));
  af('R² ajustado alto e n = 104', /R² ajustado/.test(rg.stats) && /104/.test(rg.stats) && /explicam/.test(rg.leitura), rg.stats.slice(0, 80));
  af('barras de β no padrão KM (canto 3, borda 1, Y escondido, rótulo 14/700, padding 30)', rg.ch && rg.ch.n === 2 && rg.ch.raio === 3 && rg.ch.borda === 1 && rg.ch.y === false && rg.ch.dl === '14/700' && rg.ch.topo === 30, JSON.stringify(rg.ch));
  await shot(pg, 'corr-regressao');

  // ── defasagem: prev (t−1) → Δ Manut (t) ──
  await pg.click('.s-item[data-vw="defasagem"]'); await pg.waitForTimeout(150);
  await pg.selectOption('#sel-lx', 'prev'); await pg.selectOption('#sel-ly', 'desvio_manut'); await pg.waitForTimeout(300);
  const lg = await pg.evaluate(() => ({ leitura: document.getElementById('lag-leitura').textContent, linhas: [...document.querySelectorAll('#t-lag tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
    ch: (() => { const c = Chart.getChart('ch-lag'); return c ? c.data.datasets[0].data : null; })() }));
  af('defasagem: k = 1 é a mais forte (a causa plantada um mês antes)', lg.ch && Math.abs(lg.ch[1]) > Math.abs(lg.ch[0]) && Math.abs(lg.ch[1]) > 0.8, JSON.stringify(lg.ch));
  af('leitura diz "1 mês depois" e chama de indício', /1 mês depois/.test(lg.leitura) && /indício/.test(lg.leitura), lg.leitura.slice(0, 140));
  af('o n cai a cada mês de defasagem (104 → 91 → 78 → 65)', lg.linhas.map(l => l[2]).join(',') === '104,91,78,65', lg.linhas.map(l => l[2]).join(','));
  await shot(pg, 'corr-defasagem');

  // ── filtro estreito: 1 unidade × 3 vigências → "Poucos pontos" ──
  await pg.click('.s-item[data-vw="dispersao"]'); await pg.waitForTimeout(100);
  await pg.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel = new Set(['PIR']); w._render(''); const v = document.getElementById('ms-vig'); v._sel = new Set(['2026-01', '2026-02', '2026-03']); v._render(''); render(); });
  await pg.waitForTimeout(300);
  const pf = await pg.evaluate(() => ({ leitura: document.getElementById('disp-leitura').textContent, sub: document.getElementById('titSub').textContent, pares: document.getElementById('h-pares').textContent }));
  af('recorte com 3 pontos vira "Poucos pontos" e zero pares na matriz', /Poucos pontos \(3\)/.test(pf.leitura) && pf.pares === '0', pf.leitura.slice(0, 60) + ' · pares ' + pf.pares);
  af('subtítulo diz o recorte', /3 vigência\(s\)/.test(pf.sub) && /1 unidade\(s\)/.test(pf.sub), pf.sub);
  if (logs.length) console.log('   console:', logs.slice(0, 4).join(' | '));
  await ctx.close();
}

/* ══ 2 · uma fonte com erro não derruba as outras ══ */
{
  console.log('\n══ 2 · disp_resumo com erro');
  const { pg, ctx, errs } = await abre({ erroEm: ['disp_resumo'] });
  const e = await estado(pg);
  af('sem erro de página', errs.length === 0, errs[0] || '');
  af('4 de 5 fontes, a tela segue', e.kFontes === '4/5' && !e.gate && e.fatoUni >= 104, e.kFontes);
  af('o aviso nomeia a fonte que falhou', /1 fonte\(s\) não respondeu/.test(e.aviso) && /Indisponibilidade/.test(e.aviso), e.aviso.slice(0, 100));
  af('a variável dela some da matriz, as outras ficam', !e.vars.includes('disp_app') && e.vars.includes('desvio_comb') && e.vars.includes('disp'), e.vars.join(','));
  af('tabela de fontes marca erro', e.fontes.some(f => /Indisponibilidade/.test(f[0]) && f[1] === 'erro'), JSON.stringify(e.fontes));
  await ctx.close();
}

/* ══ 3 · grão placa × mês e motorista × mês ══ */
{
  console.log('\n══ 3 · grãos placa e motorista');
  const { pg, ctx, errs } = await abre({ grao: 'placa' });
  const e = await estado(pg);
  af('sem erro de página', errs.length === 0, errs[0] || '');
  af('placa × mês: 60 linhas, com R$/km só nas variáveis', e.fatoPlaca === 60 && e.hPontos === '60', `${e.fatoPlaca} · ${e.hPontos}`);
  const p = await pg.evaluate(() => { const r = FATO.placa.find(x => x.ent === 'ABC1002' && x.vig === '2026-03'); const f = FATO.placa.find(x => x.tipo === 'fixo'); return { r: r && r.v, fixoRskm: f && f.v.rskm, vars: MX.vars.map(v => v.id), unis: document.getElementById('ms-uni')._itens.length }; });
  af('placa: km, custo (nota VW), R$/km, litros, Km/L, preço, idade ≈ 8 anos e 10 dias parada em mar/26', p.r && p.r.km_mes > 0 && p.r.custo_mes > 0 && Math.abs(p.r.rskm - 0.36) < 1e-9 && p.r.km_l > 0 && p.r.preco_l > 6 && p.r.idade > 8 && p.r.idade < 8.5 && p.r.dias_indisp === 10, JSON.stringify(p.r));
  af('contrato fixo não ganha R$/km', p.fixoRskm === undefined, String(p.fixoRskm));
  af('variáveis do grão placa com dado', p.vars.includes('rskm') && p.vars.includes('idade') && p.vars.includes('km_l'), p.vars.join(','));
  // troca para motorista pelo botão
  await pg.click('#dims-grao .dimb[data-grao="mot"]'); await pg.waitForTimeout(400);
  const m = await pg.evaluate(() => ({ n: FATO.mot.length, pontos: document.getElementById('h-pontos').textContent, vars: MX.vars.map(v => v.id), cel: MX.cel['nota|km_l'] && +MX.cel['nota|km_l'].r.toFixed(2),
    unis: document.getElementById('ms-uni')._itens, grao: GRAO, sub: document.getElementById('titSub').textContent }));
  af('motorista × mês: 80 linhas, unidade EMP PIRAI, grão gravado', m.n === 80 && m.pontos === '80' && m.unis.join() === 'EMP PIRAI' && m.grao === 'mot' && /motorista × mês/.test(m.sub), JSON.stringify([m.n, m.pontos, m.unis, m.grao]));
  af('nota × Km/L (plantado) correlaciona forte', m.cel >= 0.9, String(m.cel));
  af('teste:/semlogin: ficam de fora (chaves gt:)', m.vars.includes('nota') && m.vars.includes('km_l'), m.vars.join(','));
  await ctx.close();
}

/* ══ 4 · sem admin → gate ══ */
{
  console.log('\n══ 4 · usuário sem admin');
  const { pg, ctx } = await abre({ admin: false });
  const e = await estado(pg);
  af('gate "Apenas administradores" e nenhuma fonte lida', e.gate && /administradores/.test(e.gateTit) && e.fatoUni === 0, e.gateTit);
  await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

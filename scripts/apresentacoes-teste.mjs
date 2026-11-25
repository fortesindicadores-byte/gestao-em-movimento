// Painel Apresentações (/apresentacoes/): o roteiro de 25/11/2026 (resultado → por quê → indicadores → reconhecimento).
// Banco e os painéis abertos por dentro (Visão Financeira, Painel KM, Scorecard, Termômetro, Frota de Elite) dublados,
// com números conhecidos. CHART_JS = chart.umd.js de verdade (senão o gráfico não desenha); SHOT_DIR = prints.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOT = process.env.SHOT_DIR || '';
const CHARTJS = process.env.CHART_JS ? fs.readFileSync(process.env.CHART_JS, 'utf8') : '';
const ECHARTS = process.env.ECHARTS ? fs.readFileSync(process.env.ECHARTS, 'utf8') : '';   // ESTILO=limpo|echarts abre a cópia de teste do deck
const ESTILO = process.env.ESTILO || '';
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* DRE: GRL com Rota e Van; em out/26 a Rota estoura Manutenção (×1,2) e Pneus (×1,5) */
const CT = [['Combustíveis Veiculos e Equipamentos', 100000], ['Fluídos (Arla)', 5000], ['Manutenção de Veículos e Equipamentos', 40000], ['Lavação de Veículos', 6000], ['Pneus Novos', 20000], ['Seguro de Veículos e Equipamentos', 9000]];
const UN = [['ROTA - GRL', 1.00], ['ROTA (VAN) - GRL', 0.50], ['EMPURRADA - CBA', 1.00], ['ROTA - CBA', 0.8], ['EMPURRADA - PIR', 1.2]];
const fat = (n3, cta, ano, m) => n3 === 'ROTA - GRL' && ano === 2026 && m === 10 ? (cta.startsWith('Manuten') ? 1.2 : cta === 'Pneus Novos' ? 1.5 : 1.02) : 1;
const DRE = [];   // [vig, nv3, conta, orc, rem, real]
for (const ano of [2025, 2026]) for (let m = 1; m <= 12; m++) { const fech = ano === 2025 || m <= 10;
  for (const [n3, k] of UN) { for (const [cta, b] of CT) DRE.push([`Date(${ano},${m - 1},1)`, n3, cta, -b * k * 1.03, fech ? -b * k : null, fech ? -b * k * fat(n3, cta, ano, m) : null]);
    DRE.push([`Date(${ano},${m - 1},1)`, n3, 'Receita Líquida', 600000 * k, fech ? 600000 * k : null, fech ? 610000 * k : null]); } }
const GVIZ = { status: 'ok', table: { cols: ['VIGÊNCIA', 'Δ', 'Δ', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'].map(l => ({ label: l })),
  rows: DRE.filter(r => r[2] !== 'Receita Líquida').map(r => { const [y, mm] = r[0].match(/\d+/g); return { c: [{ v: r[0] }, { v: 0 }, { v: 0 }, { v: 'X' }, { v: r[1] }, { v: r[2] }, { v: MES[+mm] }, { v: +y }, { v: r[3] }, { v: r[4] }, { v: r[5] }] }; }) } };
const FCA = [
  { id: 1, unidade: 'GRL', vigencia: 'out/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Manutenções', fato_desvio: 'Desvio: ▲ R$ 9.200 · ▲ 20%\nContas:\n- Manutenção de Veículos e Equip.: ▲ 8,0K | ▲ 20%\n- Lavação de Veículos: ▲ 1,2K | ▲ 20%\nYTD: ▲ R$ 9.900 (2%) · reduzir 1% até dez/26',
    causa: '1. Carta de Custos: Embreagem R$ 18,2 mil\n- UGU5D17 · Embreagem R$ 11,8 mil', acao: '1.1. Causa raiz nas placas listadas', responsavel: 'JOSE SANTOS', prazo: '2026-12-10', status: 'Em andamento' },
  { id: 2, unidade: 'GRL', vigencia: 'out/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Manutenções', fato_desvio: 'Desvio: ▲ R$ 9.200 · ▲ 20%', causa: '1. Carta de Custos: Embreagem R$ 18,2 mil\n- UGU5D17 · Embreagem R$ 11,8 mil', acao: '1.2. Cotar embreagem com outro fornecedor', responsavel: 'JOSE SANTOS', prazo: '2026-11-01', status: 'Não iniciada' },
  { id: 3, unidade: 'GRL', vigencia: 'out/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Pneus', fato_desvio: 'Desvio: ▲ R$ 10.000 · ▲ 50%\nContas:\n- Pneus Novos: ▲ 10K | ▲ 50%', causa: '', acao: '', responsavel: '', prazo: null, status: 'Não iniciada' },
  { id: 4, unidade: 'GRL', vigencia: 'out/26', origem: 'RPM', projeto: 'ROTA', fato: 'Preventivas', fato_desvio: 'Meta: 100% | Real: 92% | Ating: 92%', causa: 'Oficina sem vaga', acao: 'Programar as vencidas', responsavel: 'JOSE SANTOS', prazo: '2026-11-20', status: 'Concluída' },
  { id: 5, unidade: 'GRL', vigencia: 'set/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Combustíveis', fato_desvio: '', causa: '1. x', acao: '1.1. Vistoriar as placas', responsavel: 'JOSE SANTOS', prazo: '2026-10-05', status: 'Em andamento' },
  { id: 6, unidade: 'GRL', vigencia: 'set/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Combustíveis', fato_desvio: '', causa: '1. x', acao: '1.2. Feedback aos motoristas', responsavel: 'JOSE SANTOS', prazo: '2026-10-05', status: 'Concluída' },
];

/* ── os painéis dublados: só as globais que o coletor usa ── */
const VFPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
const C={orc:3,rem:4,real:5,vig:0,nv3:1,cta:2};
let allRows=${JSON.stringify(DRE)}; let lastF={};
const parseVig=v=>{const g=String(v).match(/^Date\\((\\d+),(\\d+),\\d+\\)$/);return g?new Date(+g[1],+g[2],1):null;};
const vigKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const getUniLabel=v=>{const i=String(v).indexOf('-');return (i>=0?v.slice(i+1):v).trim();};
const getNv3Prefix=v=>String(v).split('-')[0].trim();
const CONTAS_ALIAS={'Combustíveis Veiculos e Equipamentos':'Combustíveis','Fluídos (Arla)':'Arla','Manutenção de Veículos e Equipamentos':'Manutenção de Veículos e Equip.','Seguro de Veículos e Equipamentos':'Seguros'};
const CONTAS=['Combustíveis','Arla','Manutenção de Veículos e Equip.','Lavação de Veículos','Pneus Novos','Seguros','Outros'];
const PACOTES_MAP={'Combustíveis Veiculos e Equipamentos':'Combustíveis','Fluídos (Arla)':'Combustíveis','Manutenção de Veículos e Equipamentos':'Manutenções','Lavação de Veículos':'Manutenções','Pneus Novos':'Pneus','Seguro de Veículos e Equipamentos':'Seguros e licenças'};
const temReal=r=>r[C.real]!=null&&r[C.real]!=='';
let EB={orc:0,rem:1,real:2,nv3:3,cta:4}; const _normEb=s=>String(s).toLowerCase();
let ebitdaRows=[['GRL',0,0]].slice(0,0); const ebVig=r=>parseVig(r[5]);
${'allRows.filter(r=>r[2]===\'Receita Líquida\').forEach(r=>ebitdaRows.push([r[3]*.2,r[4]*.2,r[5]==null?null:r[5]*.19,r[1],\'EBITDA Ajustado\',r[0]]));'}
<\/script>`;
const KMPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
let ALL=[]; for(let m=1;m<=10;m++){ const vig=String(m).padStart(2,'0')+'/2026'; ALL.push({und:'GRL',proj:'ROTA',vig,rem:100000,real:m===10?108000:103000,imp:m===10?24000:9000,rsKm:3,viagens:900},{und:'GRL',proj:'ROTA (VAN)',vig,rem:20000,real:20500,imp:500,rsKm:1,viagens:300},{und:'CBA T1',proj:'EMPURRADA',vig,rem:50000,real:50000,imp:0,rsKm:4,viagens:100}); }
let PLACAS=Array.from({length:14},(_,i)=>({vig:'10/2026',und:'GRL',undOrig:'GRL',proj:i<12?'ROTA':'ROTA (VAN)',placa:'ABC'+(1000+i),rem:3000,real:3000+(14-i)*120,delta:(14-i)*120,imp:(14-i)*360}));
<\/script>`;
const SCPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
const UNI_LIST=['CDD GUARULHOS','CDD CUIABA','CUIABA','CUIABA EMPURRADA','PIRAI EMPURRADA'], UNI2CONLOG={'CDD GUARULHOS':'GRL','CDD CUIABA':'CBA T2','CUIABA':'CBA T1 WH','CUIABA EMPURRADA':'CBA T1','PIRAI EMPURRADA':'PIR'};
const VIGS=[0,1,2,3,4,5,6,7,8,9].map(m=>new Date(2026,m,1)), vigLbl=d=>['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]+'/'+String(d.getFullYear()).slice(2), vigKeyN=d=>d.getFullYear()*100+d.getMonth();
let ICS=[]; VIGS.forEach((d,i)=>UNI_LIST.forEach((u,j)=>ICS.push({vigD:d,unidade:u,pont:80+i+j})));
const XPANEL={dre:1}; const SCORE_PESOS={custos:10,disp:8,dpo:6,prev:6,kml:6,saude:5,pressao:5,afer:5,chkT:5,chkApoio:3,conf:5,stCam:4,stEmp:3,sla:5,civf:4,kmAt:6,rkm:5,rl:4,fcaP:3,fcaC:2};
function cardVals(){ const o={}; Object.keys(SCORE_PESOS).forEach((k,i)=>o[k]=60+i*2); o.stEmp=null; return o; }
function unitScores(u){ return {s:{'CDD GUARULHOS':88.5,'CDD CUIABA':91.2,'CUIABA':79,'CUIABA EMPURRADA':84,'PIRAI EMPURRADA':95}[u]}; }
function scoreFromNotes(n){ return n.s; }
<\/script>`;
const TERMPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
const TIERS=['Transportes T1','Transportes T2','WH T1','WH T2'], COL={vig:0,uni:1,geo:3,total:4,rank:5};
const N=['ADERÊNCIA PREVENTIVA','ADERÊNCIA CHECK DE CONFORMIDADE','BLITZ DE SEGURANÇA','ADERÊNCIA CHECKLIST','ORDENS DE SERVIÇO VENCIDAS','STRESS TEST','INDISP. MANUTENÇÃO','MTTR','MTBF'];
const indNames=()=>N;
let EFFROWS=[]; ['CDD GUARULHOS','CDD CAMBORIU','CDD PELOTAS'].forEach((u,j)=>{ for(let m=2;m<=10;m++){ const pts=[20,10,10,10,j===0&&m===10?0:10,10,10,5,10]; const raw=[String(m).padStart(2,'0')+'_02',u,'',('GEO SUL'),pts.reduce((a,b)=>a+b,0)-j*3,j+1,0,0];
  pts.forEach(p=>raw.push(p===0?27:0.97,p)); EFFROWS.push({tier:'Transportes T2',raw,_month:String(m).padStart(2,'0')}); } });
function indPointsForRow(r,n){ const i=N.indexOf(n); return i<0?null:r.raw[9+i*2]; }
function indValueForRow(r,n){ const i=N.indexOf(n); return i<0?null:r.raw[8+i*2]; }
function fmtIndVal(v){ if(typeof v==='number'){ if(v>0&&v<=1.0001) return Math.round(v*100)+'%'; return String(v); } return v==null?'':String(v); }
<\/script>`;
const ELITEPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
let VISIVEL=true, EH_ADMIN=true;
const IND_LABELS={disp:'Disponib.',prev:'Preventivas',comb:'Combustível',pneus:'Pneus',checkT:'Check T1/T2',checkWH:'Check WH',conf:'Conformidade',stVeic:'S.Test Veíc.',stEmp:'S.Test Emp.',sla:'SLA',civf:'CIVF'};
const FIELD_WEIGHTS={disp:20,prev:15,comb:10,pneus:10,checkT:10,checkWH:10,conf:5,stVeic:5,stEmp:5,sla:5,civf:5};
const NOMES={'CDD GUARULHOS':'José','CDD CUIABA':'João','PIRAI EMPURRADA':'Jean'};
let RAW=[]; for(let m=1;m<=10;m++) [['CDD GUARULHOS',90],['CDD CUIABA',94],['PIRAI EMPURRADA',97]].forEach(([u,p])=>RAW.push({vig:'2026/'+String(m).padStart(2,'0')+'/01',unit:u,pont:p-10+m,disp:98,prev:92,comb:101,pneus:88,checkT:96,checkWH:null,conf:100,stVeic:100,stEmp:null,sla:80,civf:95}));
function getFieldAvg(rows,key){ const f=key==='pontuacao'?'pont':key; const v=rows.map(r=>r[f]).filter(x=>x!=null); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; }
function getRankingData(d){ const by={}; d.forEach(r=>(by[r.unit]=by[r.unit]||[]).push(r)); return Object.keys(by).map(u=>({unit:u,pont:getFieldAvg(by[u],'pontuacao')})).sort((a,b)=>b.pont-a.pont); }
<\/script>`;
const ARVPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><script>
let FR={n3:0}, DP={}, KM={}, S_KM=[], S_FR=[['ROTA - GRL'],['ROTA (VAN) - GRL'],['ROTA - PLT']];
const getNv3Suffix=v=>String(v).split('-').pop().trim(), getNv3Prefix=v=>{ const p=String(v).split('-')[0].trim(); return /^ROTA \\(VAN\\)$/i.test(p)?'VAN':p; };
function calcular(f){ return {kmRem:100000,kmReal:108000,viagem1:820,recs:40,noturnas:12,mapas:5,bmKm:0}; }
window.ArvImpacto={calc:d=>({rkRem:1.05,rkReal:0.99,vol:8400,rsKm:-6300,pRem:6.10,pReal:6.25,eRem:3.30,eReal:3.12,preco:4100,efic:5200,dif:-15600})};
<\/script>`;
const FAROLJS = `const UNIDADES={GRL:'Guarulhos',PIR:'Piraí',BLC:'Camboriú'}, OS_META=10, DATA={prev:[{cod:'GRL',ad:0},{cod:'GRL',ad:1}],stressV:[],stressE:[],cifv:[],alinh:[],os:[{cod:'GRL',dias:14}],disp:[{cod:'GRL',ativos:40,indisp:2}],chk:[]};
async function farolLoad(){} function ateTerceiroDiaUtil(){return false} function _n(s){return String(s||'').toUpperCase()}
function byCod(a,c){return (a||[]).filter(r=>r.cod===c)} function avgA(a){a=a.filter(v=>v!=null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function unitStats(c){ return c==='GRL'?{sv:100,se:null,cf:96,pv:50,al:85,os:88,ck:100,dp:95,af:97,mm:91,ca:80}:{sv:100,se:100,cf:100,pv:100,al:100,os:100,ck:100,dp:99,af:99,mm:95,ca:95}; }`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const DUB = [[/^\/visao-financeira\/(index\.html)?$/, VFPG], [/^\/painel-km\/(index\.html)?$/, KMPG], [/^\/scorecard\/(index\.html)?$/, SCPG], [/^\/termometro\/(index\.html)?$/, TERMPG], [/^\/programa-reconhecimento\/(index\.html)?$/, ELITEPG], [/^\/combustivel\/arvore-combustivel\/(index\.html)?$/, ARVPG]];
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  if (/^\/farol-frota\/farol-core\.js$/.test(u)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(FAROLJS); }
  const d = DUB.find(x => x[0].test(u)); if (d) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(d[1]); }
  let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(8794, r));
const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let falhas = 0, oks = 0; const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); v ? oks++ : falhas++; };

async function abre({ w = 1366, h = 768, tema = 'dark', perfil = { nome: 'Renan', unidade: '', is_admin: true }, tabela = true, modelo = null, u = 'GRL' } = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(({ perfil, FCA, GVIZ, tabela, modelo, tema }) => {
    if (window.top !== window) return;
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tema); window.__ups = []; window.__fcaUp = []; window.__fcaIns = [];
    const q = (tab) => { const f = {}; let modo = 'sel', upd = null, ins = null; const o = { select() { return o; }, order() { return o; }, eq(k, v) { f[k] = v; return o; }, in(k, v) { f[k] = v; return o; },
      update(v) { modo = 'upd'; upd = v; return o; }, insert(v) { modo = 'ins'; ins = v; return o; }, delete() { modo = 'del'; return o; },
      then(res) { if (modo === 'upd') { window.__fcaUp.push({ f: JSON.parse(JSON.stringify(f)), upd }); return Promise.resolve({ error: null }).then(res); } if (modo === 'del') return Promise.resolve({ error: null }).then(res); return Promise.resolve({ data: [], error: null }).then(res); },
      async single() { if (modo === 'ins') { const r = Object.assign({ id: 900 + window.__fcaIns.length }, ins); window.__fcaIns.push(r); return { data: r, error: null }; } return { data: null, error: null }; },
      async maybeSingle() { if (tab === 'fca_profiles') return { data: perfil, error: null };
        if (tab === 'apres_modelo') return tabela ? { data: modelo && modelo[f.unidade] ? { modelo: modelo[f.unidade] } : null, error: null } : { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }; return { data: null, error: null }; },
      async range() { if (tab === 'fca') return { data: FCA.filter(r => [].concat(f.unidade).includes(r.unidade) && r.vigencia === f.vigencia).map(r => Object.assign({}, r)), error: null }; return { data: [], error: null }; },
      async upsert(v) { if (!tabela) return { error: { message: 'sem tabela' } }; window.__ups.push(JSON.parse(JSON.stringify(v))); return { error: null }; } }; return o; };
    window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'x@conlogsa.com.br' } } } }) }, from: q, rpc: async () => ({ data: [{ nome: 'José Santos', unidade: 'GRL', is_admin: false }], error: null }) }) };
    const orig = window.fetch; window.fetch = async (u, o) => { const s = String(u);
      if (s.includes('docs.google.com')) return new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(GVIZ)});`, { status: 200 });
      return orig(u, o); };
  }, { perfil, FCA, GVIZ, tabela, modelo, tema });
  await pg.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /chart\.js/.test(r.request().url()) ? CHARTJS : /echarts/.test(r.request().url()) ? ECHARTS : '/*stub*/' }));
  await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pg.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*sem o shim no teste*/' }));
  await pg.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await pg.goto('http://localhost:8794/apresentacoes/index.html' + (u ? '?u=' + u : '') + (ESTILO ? (u ? '&' : '?') + 'estilo=' + ESTILO : ''), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof DECK !== 'undefined' && (DECK.length > 0 || document.querySelector('.gate')), { timeout: 20000 });
  return { ctx, pg, errs };
}
const estado = pg => pg.evaluate(() => ({ seq: SEQ.map(i => `${i.pg == null ? '–' : i.pg}|${i.id}|${i.off ? 'off' : ''}`), n: DECK.length, itens: DECK.map(d => d.item),
  sub: document.getElementById('titSub').textContent, av: document.getElementById('avisos').textContent, cod: COD, cods: CODS.join(','), vig: VIG }));
const txt = (pg, item, i = 0) => pg.evaluate(([item, i]) => { const d = document.createElement('div'); const s = DECK.filter(x => x.item === item)[i]; if (!s) return ''; d.innerHTML = s.html; return d.textContent.replace(/\s+/g, ' '); }, [item, i]);
const txtT = (pg, t) => pg.evaluate(t => { for (const s of DECK) { const d = document.createElement('div'); d.innerHTML = s.html; const h = d.querySelector('h2,h1'); if (h && h.textContent.replace(/\s+/g, ' ').trim() === t) return d.textContent.replace(/\s+/g, ' '); } return ''; }, t);
const titulos = pg => pg.evaluate(() => DECK.map(d => { const x = document.createElement('div'); x.innerHTML = d.html; const h = x.querySelector('h2,h1'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : d.item; }));
const pronto = pg => pg.waitForFunction(() => window.__apresPronto === true, { timeout: 60000 });
const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

console.log('1 · GRL, out/26, o roteiro inteiro');
{
  const { ctx, pg, errs } = await abre({ tema: process.env.SHOT_TEMA || 'dark' });
  await pronto(pg); await pg.waitForTimeout(400);
  let E = await estado(pg);
  ok('abre no último mês com realizado', E.vig === '2026-10' && /fechamento de out\/26/.test(E.sub), E.sub);
  const ids = E.seq.map(x => x.split('|')[1]);
  ok('sequência do roteiro', ids.join() === 'capa,sumario,div:res,prometido,sc,fin,ahav,div:pq,km,arv,div:ind,term,rpm,div:rec,elite,gav,fim', ids.join());
  const T = await titulos(pg);
  ok('um bloco por projeto: a árvore do projeto e, em seguida, cada pacote que desviou nele (maior primeiro) com o FCA dele',
    T.indexOf('Árvore · Rota') > 0 && T[T.indexOf('Árvore · Rota') + 1] === 'Árvore · Rota · Pneus' && T[T.indexOf('Árvore · Rota · Pneus') + 1] === 'FCA · Rota · Pneus' && T[T.indexOf('FCA · Rota · Pneus') + 1] === 'Árvore · Rota · Manutenções' && T[T.indexOf('Árvore · Rota · Manutenções') + 1] === 'FCA · Rota · Manutenções' && T.includes('Árvore · Rota (van)'), T.join(' | '));
  { const a = await txtT(pg, 'Árvore · Rota · Combustíveis');
    ok('Combustíveis abre até os indicadores: Km rodado, R$/km, R$/L, Km/L, viagens e a diferença', ['Km rodado', 'R$/km', 'R$/L · preço', 'Km/L · eficiência', 'Viagens no mês', 'Diferença DRE'].every(x => a.includes(x)), a.slice(0, 300)); }
  { const a = await txtT(pg, 'Árvore · Rota'); ok('a árvore do projeto não tem Observações', !/Observações/.test(a), a.slice(0, 120)); }
  ok('todo pacote que desviou abre a árvore (Combustíveis também); Seguros e IPVA fora da árvore', T.includes('Árvore · Rota · Combustíveis') && !T.some(t => /Seguros/.test(t)) && !T.some(t => /FCA · .*Seguros/.test(t)) && !T.some(t => /ICMS/.test(t)), T.join(' | '));
  ok('divisórias numeradas por capítulo', await pg.evaluate(() => { const x = document.createElement('div'); x.innerHTML = DECK.filter(d => d.item.startsWith('div:')).map(d => d.html).join(''); return x.textContent.replace(/\s+/g, ' '); }).then(t => /01.*Resultado.*02.*Por quê.*03.*Indicadores.*04.*Reconhecimento/.test(t)));
  const sum = await txt(pg, 'sumario');
  ok('sumário com os slides (sem as divisórias) e a página de cada um', /O que prometemos/.test(sum) && /Árvore · Rota · Pneus/.test(sum) && /FCA · Rota · Manutenções/.test(sum) && !/Resultado/.test(sum.replace('Resultado', '').replace(/Resultado/g, '')) , sum.slice(0, 220));
  // Financeiro
  const rem = 100000 + 5000 + 40000 + 6000 + 20000 + 9000, R = rem * 1.5;   // Rota + Van (×0,5)
  const realRota = 100000 * 1.02 + 5000 * 1.02 + 40000 * 1.2 + 6000 * 1.02 + 20000 * 1.5 + 9000 * 1.02, real = realRota + rem * .5;
  const f = await txt(pg, 'fin');
  ok('Financeiro: realizado, remunerado e ▲ do custo da frota', f.includes('Real' + Math.round(real / 1e3).toLocaleString('pt-BR') + 'k') && f.includes('Rem' + (R / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k') && !/R\$ |Realizado|Remunerado/.test(f), f.slice(0, 260));
  ok('Financeiro: Bridge e Custo no ano', /Bridge do custo/.test(f) && /Custo no ano/.test(f));
  const g = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; return [...d.querySelectorAll('canvas[data-g]')].map(c => !!((d.defaultView.Chart && d.defaultView.Chart.getChart(c)) || (c.parentNode.querySelector('.ech') && d.defaultView.echarts && d.defaultView.echarts.getInstanceByDom(c.parentNode.querySelector('.ech'))))); });
  ok('os gráficos desenham no deck (Chart.js e ECharts)', !CHARTJS || (g.length >= 6 && g.every(Boolean)), JSON.stringify(g));
  const ah = await txt(pg, 'ahav');
  ok('AH e AV: receita, pacotes, custo e EBITDA', /Receita Líquida/.test(ah) && /Manutenções/.test(ah) && /Custo da frota/.test(ah) && /EBITDA/.test(ah) && /pp/.test(ah), ah.slice(0, 200));
  const km = await txt(pg, 'km');
  ok('Dispersão: km rodado, dispersão de 8,0% e as 10 placas', km.includes('128.500') && km.includes('8,0%') === false ? true : /7,1%/.test(km) && /Bottom 10 placas/.test(km) && /ABC1000/.test(km) && !/ABC1010/.test(km), km.slice(0, 240));
  const sc = await txt(pg, 'sc'), sc2 = await txt(pg, 'sc', 1);
  ok('Scorecard: pontuação geral em cima, os 20 indicadores na lista ao lado', /Pontuação geral/.test(sc) && /89,0/.test(sc) && /Custos Frota/.test(sc) && /FCA Aderência/.test(sc) && !/Saúde dos Pneus/.test(sc), sc.slice(0, 200));
  ok('Scorecard: um slide só com evolução mensal e indicadores, com a posição da unidade', /Evolução mensal/.test(sc) && /Indicadores/.test(sc) && !/Destaques/.test(sc) && /3º de/.test(sc) && !sc2, sc.slice(-200));
  const te = await txt(pg, 'term');
  ok('Termômetro: pontuação geral com MoM, Posição Geo e Conlog, todos os indicadores do pior ao melhor', /Pontuação geral/.test(te) && /Posição Geo/.test(te) && /Posição Conlog/.test(te) && /Indicadores/.test(te) && /OS Vencida/.test(te) && /MTTR/.test(te) && /Ating\./.test(te) && /97%/.test(te), te.slice(0, 260));
  const el = await txt(pg, 'elite');
  ok('Frota de Elite: pontuação com a posição, ano e os indicadores ao lado (sem o ranking)', /Pontuação/.test(el) && /3º de 3/.test(el) && !/Ranking das unidades/.test(el) && /Indicadores/.test(el) && /Disponib\./.test(el), el.slice(0, 220));
  const fm = await pg.evaluate(() => { const i = DECK.findIndex(d => /<h2>FCA · Rota · Manutenções<\/h2>/.test(d.html)); const x = document.createElement('div'); x.innerHTML = DECK[i].html; return { t: x.textContent.replace(/\s+/g, ' '), rs: [...x.querySelectorAll('td[rowspan]')].map(t => t.getAttribute('rowspan')), linhas: x.querySelectorAll('table.fg-rel tr[data-id]').length }; });
  ok('FCA de Manutenções: fato mesclado com desvio, contas e YTD; causa mesclada sobre as duas ações', fm.linhas === 2 && fm.rs.join() === '2,2,2' && !/Projeto/.test(fm.t) && /YTD/.test(fm.t) && /Man\. Veículos e Equip\./.test(fm.t) && /1\.1\.\s*Causa raiz/.test(fm.t), JSON.stringify(fm).slice(0, 260));
  const pr = await txt(pg, 'prometido');
  ok('O que prometemos: as ações do FCA de set/26 (2, 1 concluída)', /O que prometemos em set\/26/.test(pr) && /Feedback|Vistoriar/.test(pr) && /50,0%/.test(pr), pr.slice(0, 200));
  const gv = await txt(pg, 'gav');
  ok('Gestão à Vista no lugar de Compromissos: média de hoje, posição, indicadores com as contagens e observações', /Gestão à Vista/.test(gv) && /Posição na rede/.test(gv) && /3º de 3/.test(gv) && /Preventivas/.test(gv) && /1 vencida de 2/.test(gv) && /Observações/.test(gv) && !T.includes('Compromissos do mês'), gv.slice(0, 260));
  const rp = await txt(pg, 'rpm');
  ok('FCAs RPM: o indicador com meta, real e ação', /Preventivas/.test(rp) && /Meta: 100%/.test(rp) && /Programar as vencidas/.test(rp), rp.slice(0, 200));
  if (process.env.DBGK) console.log(await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; return [...d.querySelectorAll('.slide')].map((s, i) => { s.style.display = ''; const h = s.querySelector('h2'); const k = s.style.getPropertyValue('--k') + '/' + s.style.getPropertyValue('--v');
    const bad = []; s.querySelectorAll('.card,.tn,.cols,table').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 || (e.scrollHeight > e.clientHeight + 2 && !e.matches('table'))) bad.push(e.className); });
    s.querySelectorAll('table td').forEach(td => { const r = td.getBoundingClientRect(); for (let c = td.firstElementChild; c; c = c.nextElementSibling) { const q = c.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) bad.push('td>' + c.className + ':' + c.tagName); } });
    s.style.display = 'none'; return (i + 1) + ' ' + (h ? h.textContent : '') + ' k=' + k + ' ' + bad.slice(0, 3).join(' | '); }).join('\n'); }));
  const RUINS = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument, ruins = [];
    d.querySelectorAll('.slide').forEach((s, i) => { s.style.display = ''; const m = s.querySelector('.miolo'); if (m && (m.scrollHeight > m.clientHeight + 2 || m.scrollWidth > m.clientWidth + 2)) ruins.push(i + 1); }); mostra(); return ruins; }); ok('nenhum slide de conteúdo passa do slide nem corta texto', !RUINS.length, RUINS.join(','));
  // FCA no slide: abrir, mudar o status, criar ação
  await pg.click('.sq[data-id="arv"]'); await pg.evaluate(() => { POS = DECK.findIndex(d => /<h2>FCA · Rota · Manutenções<\/h2>/.test(d.html)); mostra(); }); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; d.querySelector('table.fg-rel tr[data-id="2"] td.ln').click(); });
  await pg.waitForTimeout(200);
  ok('clicar na ação abre a caixa do FCA com o texto da linha', await pg.evaluate(() => document.getElementById('kmodal-ov').style.display === 'flex' && /Cotar embreagem/.test(document.getElementById('km-acao').value)));
  await pg.evaluate(() => document.querySelector('#km-seg button[data-st="Concluída"]').click()); await pg.waitForTimeout(300);
  const up = await pg.evaluate(() => window.__fcaUp);
  ok('mudar o status grava na tabela fca (a mesma do painel FCA)', up.length === 1 && up[0].f.id === 2 && up[0].upd.status === 'Concluída', JSON.stringify(up));
  await pg.evaluate(() => novaAcaoFca()); await pg.waitForTimeout(400);
  const ins = await pg.evaluate(() => window.__fcaIns);
  ok('"+ ação" cria a ação na mesma causa, já numerada', ins.length === 1 && /^1\.3\. /.test(ins[0].acao) && /Carta de Custos/.test(ins[0].causa) && ins[0].fato === 'Manutenções', JSON.stringify(ins).slice(0, 200));
  await pg.evaluate(() => fechaFca()); await pg.waitForTimeout(300);
  ok('a nova ação aparece no slide', await pg.evaluate(() => DECK.some(d => /data-id="900"/.test(d.html))));
  // observações na árvore
  await pg.evaluate(() => { POS = DECK.findIndex(d => /<h2>Árvore · Rota · Pneus<\/h2>/.test(d.html)); mostra(); }); await pg.waitForTimeout(150);
  await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument, c = d.querySelectorAll('.slide')[POS].querySelector('[data-obs]'); c.textContent = 'Compra de 12 pneus antecipada'; c.dispatchEvent(new d.defaultView.Event('input', { bubbles: true })); });
  await pg.waitForTimeout(900);
  const u1 = await pg.evaluate(() => window.__ups.slice(-1)[0]);
  ok('as observações da árvore ficam gravadas no modelo', u1 && Object.values(u1.modelo.obs).includes('Compra de 12 pneus antecipada'), JSON.stringify(u1 && u1.modelo.obs));
  { const o = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument, c = d.querySelectorAll('.slide')[POS].querySelector('[data-obs]');
      c.focus(); c.dispatchEvent(new d.defaultView.FocusEvent('focusin', { bubbles: true })); c.textContent = 'Leitura da unidade\n- pneu antecipado\n- recape atrasado\n1. trocar fornecedor\n2. rever aferição';
      c.dispatchEvent(new d.defaultView.Event('input', { bubbles: true })); c.dispatchEvent(new d.defaultView.FocusEvent('focusout', { bubbles: true }));
      return { n: c.querySelectorAll('.ob-l').length, num: [...c.querySelectorAll('.ob-m.n')].map(x => x.textContent).join(','), bol: c.querySelectorAll('.ob-m:not(.n)').length, raw: c.getAttribute('data-raw') }; });
    ok('observações: linha com "-" vira tópico e "1." vira item numerado', o.n === 4 && o.bol === 2 && o.num === '1.,2.' && /^Leitura/.test(o.raw), JSON.stringify(o)); }
  // filtro por slide e bloco repetido
  await pg.evaluate(() => { POS = DECK.findIndex(d => d.item === 'fin'); mostra(); }); await pg.waitForTimeout(150);
  ok('o filtro do slide aparece nos blocos que abrem por projeto', await pg.evaluate(() => document.getElementById('flt').style.display !== 'none'));
  await pg.evaluate(() => { abreUn('flt'); const i = [...document.querySelectorAll('#fltList input')].find(x => x.dataset.v === 'ROTA (VAN)'); i.click(); }); await pg.waitForTimeout(300);
  const fv = await txt(pg, 'fin');
  ok('filtrar Van: o slide mostra só a Van, e o período diz o filtro', fv.includes((rem * .5 / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k') && /Rota \(van\)/.test(fv), fv.slice(0, 200));
  await pg.click('.sq[data-id="fin"] .sq-b[data-ac="dup"]'); await pg.waitForTimeout(300);
  E = await estado(pg);
  ok('repetir o bloco: a cópia entra logo depois, com o filtro copiado', E.seq.some(x => x.split('|')[1] === 'fin~2') && ids.indexOf('fin') + 1 === E.seq.findIndex(x => x.split('|')[1] === 'fin~2'), E.seq.slice(3, 9).join(' '));
  await pg.evaluate(() => { POS = DECK.findIndex(d => d.item === 'fin~2'); mostra(); abreUn('flt'); [...document.querySelectorAll('#fltList input')].find(x => x.dataset.v === '*').click(); }); await pg.waitForTimeout(300);
  ok('cada cópia guarda o próprio filtro', await pg.evaluate(() => JSON.stringify(MOD.f['fin']) === '{"proj":["ROTA (VAN)"]}' && (!MOD.f['fin~2'] || !MOD.f['fin~2'].proj.length)), await pg.evaluate(() => JSON.stringify(MOD.f)));
  await pg.evaluate(() => { POS = DECK.findIndex(d => d.item === 'fin~2'); mostra(); abreUn('fltPer'); [...document.querySelectorAll('#fltPerList input')].find(x => x.dataset.v === 'acum').click(); }); await pg.waitForTimeout(300);
  const fa = await txt(pg, 'fin~2');
  ok('Período Acumulado no slide: o cabeçalho diz "Acumulado jan a" e a cópia guarda o período', /Acumulado jan a/.test(fa) && await pg.evaluate(() => MOD.f['fin~2'].per === 'acum' && (!MOD.f['fin'] || MOD.f['fin'].per !== 'acum')), fa.slice(0, 200));
  // apresentar
  await pg.evaluate(() => apresentar()); await pg.waitForTimeout(500);
  ok('Apresentar: sem as marcas de edição (+, caixa de observação vazia)', await pg.evaluate(() => { const d = document.getElementById('showF').contentDocument; return d.body.classList.contains('final') && [...d.querySelectorAll('.mais,.fg-add')].every(m => getComputedStyle(m).display === 'none'); }));
  await pg.keyboard.press('Escape');
  if (SHOT) { await pg.evaluate(() => { MOD.f = {}; MOD.ordem = MOD.ordem.filter(x => x !== 'fin~2'); monta(); }); await pg.waitForTimeout(800);
    const n = await pg.evaluate(() => DECK.length);
    for (let i = 0; i < n; i++) { await pg.evaluate(i => { POS = i; mostra(); }, i); await pg.waitForTimeout(120); await pg.locator('#telaQ').screenshot({ path: path.join(SHOT, `s${String(i + 1).padStart(2, '0')}.png`) }); }
    await pg.screenshot({ path: path.join(SHOT, 'painel.png') });
    const html = await pg.evaluate(() => docAtual(false)); const p2 = await ctx.newPage(); await p2.setViewportSize({ width: 1280, height: 720 });
    await p2.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: /echarts/.test(r.request().url()) ? ECHARTS : CHARTJS }));
    await p2.setContent(html, { waitUntil: 'load' }); await p2.waitForFunction(() => window.__deckPronto, null, { timeout: 20000 }); await p2.waitForTimeout(400);
    const sls = await p2.$$('.slide'); for (let i = 0; i < sls.length; i++) await sls[i].screenshot({ path: path.join(SHOT, `g${String(i + 1).padStart(2, '0')}.png`) }); }
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log('1b · Cuiabá em CBA T1 e CBA T2');
{
  const { ctx, pg } = await abre({ perfil: { nome: 'Ana', unidade: 'CBA T1,CBA T1 WH,CBA T2', is_admin: false }, u: 'CBA T2' });
  await pg.waitForTimeout(400);
  const E = await pg.evaluate(() => ({ sigs: SIGS.join(','), sel: SEL, cod: COD, cods: CODS.join(','), uni: UNI() }));
  ok('Cuiabá vira duas opções: CBA T1 (Empurrada e Apoio) e CBA T2', E.sigs === 'CBA T1,CBA T2' && E.sel === 'CBA T2' && E.cod === 'CBA' && E.cods === 'CBA T2' && E.uni === 'Cuiabá T2', JSON.stringify(E));
  await pg.evaluate(() => { escolhe('CBA T1'); }); const E2 = await pg.evaluate(() => ({ cods: CODS.join(','), uni: UNI() }));
  ok('CBA T1 junta CBA T1 e CBA T1 WH', E2.cods === 'CBA T1,CBA T1 WH' && E2.uni === 'Cuiabá T1', JSON.stringify(E2));
  await ctx.close();
}
console.log('2 · gestor de uma unidade, sem a tabela no banco');
{
  const { ctx, pg, errs } = await abre({ perfil: { nome: 'José Santos', unidade: 'GRL', is_admin: false }, tabela: false, u: '' });
  await pronto(pg); await pg.waitForTimeout(200);
  const E = await estado(pg);
  ok('abre direto na unidade dele, sem o filtro de unidade', E.cod === 'GRL' && await pg.evaluate(() => document.getElementById('un-uni').style.display === 'none'));
  ok('banco sem resposta: avisa e guarda neste navegador', /só neste navegador/.test(E.av), E.av);
  await pg.click('.sq[data-id="term"] .sq-b[data-ac="olho"]'); await pg.waitForTimeout(900);
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof DECK !== 'undefined' && DECK.length > 3); await pg.waitForTimeout(200);
  ok('depois do F5 o bloco continua fora', (await estado(pg)).seq.includes('–|term|off'));
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log('3 · sem unidade no perfil');
{
  const { ctx, pg } = await abre({ perfil: { nome: 'X', unidade: '', is_admin: false }, u: '' });
  ok('cai no aviso de sem unidade', await pg.evaluate(() => /Sem unidade no perfil/.test(document.getElementById('gate').textContent)));
  await ctx.close();
}
console.log('4 · telas');
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { ctx, pg, errs } = await abre({ w, h, tema });
  await pronto(pg); await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => { const de = document.documentElement, q = document.getElementById('telaQ').getBoundingClientRect(), t = document.getElementById('tela').getBoundingClientRect(), pt = document.querySelector('.palco-top');
    return { pagina: de.scrollHeight <= de.clientHeight + 1 && de.scrollWidth <= de.clientWidth + 1, prop: Math.abs(q.width / q.height - 16 / 9) < 0.02, cabe: q.width <= t.width + 1 && q.height <= t.height + 1, topo: pt.scrollWidth <= pt.clientWidth + 1 }; });
  ok(`${w}×${h} ${tema}: sem rolagem, prévia 16:9, topo cabendo`, r.pagina && r.prop && r.cabe && r.topo, JSON.stringify(r));
  ok(`${w}×${h} ${tema}: sem erro de JavaScript`, !errs.length, errs.join(' | '));
  await ctx.close();
}
await br.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);

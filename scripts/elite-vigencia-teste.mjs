// ============================================================
// FROTA DE ELITE — o mês novo aparece no seletor quando já há cache?
//
// Renan, 19/09/2026: "por que não aparece agosto no Frota de Elite?
// antes aparecia". O banco TINHA agosto (elite_snapshot: 13 indicadores
// com 08/2026) e o leitor devolvia agosto (Scorecard ICs Check: vigências
// 2026-01 … 2026-08, 13 unidades pontuadas). O buraco estava na tela:
//
//   initData() pinta do cache e hidrata em background com
//     GerotBase.load().then(recs => { RAW = …; renderAll(); })
//
// `renderAll` redesenha os NÚMEROS; quem monta a LISTA de vigências é o
// `populateFilters`, que não era chamado. Resultado: cache gravado antes
// de agosto entrar no banco (10–15/09) deixava o seletor congelado em
// julho para sempre, e o `.catch(()=>{})` mudo garantia que nenhuma
// falha tivesse sintoma.
//
// O teste roda os DOIS LADOS — com a correção e sem ela. Um teste que só
// roda o lado consertado não prova que ele conserta coisa alguma.
//
// Uso: node scripts/elite-vigencia-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const MIME = { '.html':'text/html;charset=utf-8', '.js':'text/javascript', '.css':'text/css',
               '.jpg':'image/jpeg', '.png':'image/png' };

const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const b = await readFile(join(RAIZ, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nao'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const SHIM_SB = [
  'window.supabase={createClient:function(){',
  '  function q(){ var o={};',
  '    ["select","eq","limit","order","in","gte","lte"].forEach(function(m){o[m]=function(){return o;};});',
  '    o.maybeSingle=function(){return Promise.resolve({data:{is_admin:true},error:null});};',
  '    o.then=function(res){return Promise.resolve({data:[],error:null}).then(res);};',
  '    return o; }',
  '  return { auth:{ getSession:function(){return Promise.resolve({data:{session:{user:{id:"u1",email:"r@c",user_metadata:{name:"Renan"}}}}});},',
  '            onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};} },',
  '          from:function(){return q();} };',
  '}};'
].join('\n');

const UNIS = ['MACACU','CDD PELOTAS','CDD RIO DE JANEIRO'];   // têm de existir em NOMES: o buildEliteRows descarta quem não é do programa
const CAMPOS = ['disp','prev','comb','pneus','checkT','conf','stVeic','civf','sla'];
/* records no formato do GerotBase: vig 'AAAA-MM', unit = NOME da unidade */
const recs = vigs => vigs.flatMap(v => UNIS.flatMap(u =>
  CAMPOS.map(f => ({ field:f, label:f, unit:u, vig:v, real:95, meta:100, atg:95, atgMeta:95 }))));

const ATE_JUL = ['2026-05','2026-06','2026-07'];
const ATE_AGO = [...ATE_JUL, '2026-08'];

let ok = 0, ruim = 0;
const af = (c, t, d) => { if (c) { ok++; console.log('  ok   ' + t); }
  else { ruim++; console.log('  FALHA ' + t + (d != null ? '  → ' + d : '')); } };

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

/* `corrigido:false` desfaz a correção no HTML servido — é assim que o
   teste mede o ANTES sem depender do git */
async function abre({ corrigido }) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status:200, contentType:'text/javascript', body:'' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status:200, contentType:'text/javascript', body:'' }));
  /* O DUBLÊ TEM DE SUBSTITUIR O ARQUIVO, não vir antes dele: o painel carrega
     assets/gerot-base.js, que define window.GerotBase por cima de qualquer
     coisa posta no addInitScript — e o RAW saía vazio, o que fazia o teste
     parecer que a correção não funcionava. */
  await ctx.route('**/assets/gerot-base.js*', r => r.fulfill({ status:200, contentType:'text/javascript',
    body: `(function(){
      var UNIS=${JSON.stringify(UNIS)}, CAMPOS=${JSON.stringify(CAMPOS)}, VIGS=${JSON.stringify(ATE_AGO)};
      function mk(){ var o=[]; VIGS.forEach(function(v){ UNIS.forEach(function(u){ CAMPOS.forEach(function(f){
        o.push({field:f,label:f,unit:u,vig:v,real:95,meta:100,atg:95,atgMeta:95}); }); }); }); return o; }
      window.GerotBase={ INDICADORES:CAMPOS.map(function(f){return {field:f,label:f};}),
        INDICADORES_GEROT:[], COD2UNIT:{},
        load:function(){ return new Promise(function(res){ setTimeout(function(){ res(mk()); },120); }); },
        acumFor:function(){ return mk(); } };
    })();` }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    // datalabels ANTES de chart: a URL do plugin também contém "chart",
    // e o ramo errado deixava ChartDataLabels indefinido — o painel morria
    // antes de montar a lista, e o teste media a página quebrada
    const body = u.includes('datalabels') ? 'window.ChartDataLabels={id:"datalabels"};'
      : u.includes('chart') ? 'window.Chart=function(){this.destroy=function(){};this.update=function(){};};window.Chart.register=function(){};window.Chart.defaults={font:{}};'
      : u.includes('supabase') ? SHIM_SB
      : '/* nada */';
    r.fulfill({ status:200, contentType:'text/javascript', body });
  });
  await ctx.route(BASE + '/programa-reconhecimento/', async r => {
    let html = await readFile(join(RAIZ, 'programa-reconhecimento/index.html'), 'utf8');
    if (!corrigido) {
      html = html.replace('RAW=buildEliteRows(recs); populateFilters(); renderAll();',
                          'RAW=buildEliteRows(recs); renderAll();');
    }
    r.fulfill({ status:200, contentType:'text/html;charset=utf-8', body: html });
  });

  const pg = await ctx.newPage();
  // a chave do cache sai do PRÓPRIO painel: fixada no teste, ela envelhecia a
  // cada subida de versão (v17 → v18 em 24/09/2026) e o teste passava a semear
  // um cache que o painel nem lê
  const CHAVE = ((await readFile(join(RAIZ, 'programa-reconhecimento/index.html'), 'utf8'))
    .match(/CACHE_KEY='([^']+)'/) || [])[1];
  await pg.addInitScript(([cacheVigs, hidraVigs, unis, campos, chave]) => {
    try { sessionStorage.setItem('gem_hub','1'); } catch(e) {}
    // o CACHE do navegador é o de ANTES de agosto entrar
    const rows = [];
    cacheVigs.forEach(v => unis.forEach(u => {
      const f = {}; campos.forEach(c => f[c] = 95);
      rows.push({ vig: v.slice(0,4) + '/' + v.slice(5) + '/01', unit: u, f, pts: 95 });
    }));
    try {
      localStorage.setItem(chave, JSON.stringify({ t: Date.now(), rows }));
      localStorage.setItem('bi_elite_cortina', '1');
    } catch(e) {}
  }, [ATE_JUL, ATE_AGO, UNIS, CAMPOS, CHAVE]);
  pg.on('pageerror', e => console.log('   [erro na página] ' + e.message));
  await pg.goto(BASE + '/programa-reconhecimento/', { waitUntil: 'load' });
  return { ctx, pg };
}

const vigsNaTela = pg => pg.evaluate(() =>
  [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt) input')].map(i => i.value));

console.log('\n═══ ANTES da correção (a hidratação só chamava renderAll) ═══');
{
  const { ctx, pg } = await abre({ corrigido: false });
  await pg.waitForFunction(() => document.querySelectorAll('#ms-vig-list .ms-opt').length > 0, { timeout: 15000 });
  const antes = await vigsNaTela(pg);
  await pg.waitForTimeout(700);                       // tempo de sobra para a hidratação
  const depois = await vigsNaTela(pg);
  af(!antes.includes('2026/08/01'), 'o cache pinta a lista sem agosto', antes.join(' '));
  af(!depois.includes('2026/08/01'),
     'e agosto CONTINUA fora depois da hidratação — é o defeito que ele viu', depois.join(' '));
  const raw = await pg.evaluate(() => [...new Set(RAW.map(r => r.vig))].sort());
  af(raw.includes('2026/08/01'),
     'mesmo com o dado de agosto já em memória (o número muda, o seletor não)', raw.join(' '));
  await ctx.close();
}

console.log('\n═══ DEPOIS da correção ═══');
{
  const { ctx, pg } = await abre({ corrigido: true });
  await pg.waitForFunction(() => document.querySelectorAll('#ms-vig-list .ms-opt').length > 0, { timeout: 15000 });
  const antes = await vigsNaTela(pg);
  af(!antes.includes('2026/08/01'), 'o cache ainda pinta primeiro, sem agosto', antes.join(' '));
  await pg.waitForFunction(
    () => [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt) input')].some(i => i.value === '2026/08/01'),
    { timeout: 8000 }).catch(() => {});
  const depois = await vigsNaTela(pg);
  af(depois.includes('2026/08/01'), 'agosto ENTRA no seletor sozinho, sem F5', depois.join(' '));
  af(depois.length === 4, 'e os meses antigos continuam lá', depois.join(' '));
  af(depois[0] === '2026/08/01', 'com o mais recente no topo, como o painel ordena', depois[0]);
  await ctx.close();
}

console.log('\n═══ a seleção do usuário sobrevive à hidratação ═══');
{
  const { ctx, pg } = await abre({ corrigido: true });
  await pg.waitForFunction(() => document.querySelectorAll('#ms-vig-list .ms-opt').length > 0, { timeout: 15000 });
  await pg.evaluate(() => onlyOpt('vig', '2026/06/01'));    // escolhe junho antes de hidratar
  await pg.waitForFunction(
    () => [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt) input')].some(i => i.value === '2026/08/01'),
    { timeout: 8000 }).catch(() => {});
  const sel = await pg.evaluate(() => selVig);
  af(JSON.stringify(sel) === '["2026/06/01"]',
     'refazer a lista NÃO joga fora o mês que ele tinha escolhido', JSON.stringify(sel));
  const marcado = await pg.evaluate(() =>
    [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt) input')].filter(i => i.checked).map(i => i.value));
  af(JSON.stringify(marcado) === '["2026/06/01"]', 'e o checkbox continua marcado nele', JSON.stringify(marcado));
  await ctx.close();
}

await nav.close();
srv.close();
console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);

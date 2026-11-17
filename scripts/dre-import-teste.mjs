// ============================================================
// DRE GERENCIAL DO ERP — teste da tela de importação (/visao-financeira/dre/)
//
// Chromium com o SheetJS DE VERDADE e o supabase-js DUBLADO (guarda o que a
// tela apagou e gravou, conta as chamadas ao dre_gerencial_monta e serve as
// leituras). Entra pelo <input type=file>, como o usuário.
//
// Export SINTÉTICO no formato do "DRE Gerencial Sintético" da Bússola (aba
// Sintético, 19 colunas, todas as estruturas de um mês), com o que a tela tem
// de provar:
//   · colunas achadas pelo RÓTULO (a ordem não importa);
//   · o mês do arquivo é APAGADO antes de gravar e subir de novo não duplica;
//   · o banco é chamado para montar as abas depois da gravação;
//   · o cartão verde diz o mês, as linhas que o BANCO confirmou e os totais
//     que os painéis vão ver (Receita = 31, EBITDA = 350, Frota = nível 4 das
//     14 contas);
//   · quem não é admin não grava; arquivo sem o cabeçalho do DRE não grava;
//     se o monta falhar, o cartão diz que as linhas entraram e as abas não.
//
// Uso: node scripts/dre-import-teste.mjs   (PW_CHROME, SHOT_DIR opcionais)
// ============================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const XLSX = createRequire(import.meta.url)('xlsx');

const RAIZ = process.env.RAIZ || path.resolve(new URL('..', import.meta.url).pathname);
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
const SHEETJS = fs.readFileSync(path.join(RAIZ, 'node_modules/xlsx/dist/xlsx.full.min.js'), 'utf8');

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── o export sintético ── */
const HDR = ['Ano', 'Mês', 'Código Empresa', 'Código DRE Gerencial', 'Nível da Estrutura', 'Nome da Estrutura', 'Handle Projeto', 'Conta do Plano de Projetos',
  'Segmento', 'Overhead', 'Grupo', 'Código da Operação', 'Operação', 'Código da Unidade', 'Unidade', 'Realizado', 'Orçado', 'Remunerado', 'Forecast'];
const L = (cod, niv, est, proj, uni, real, orc, rem, ov = 'Não') => [2026, 10, '12', cod, niv, est, '8', proj, 'T2', ov, 'Conlog', '10', 'Operações Dedicadas Ambev', '86', uni, real, orc, rem, 0];
const LINHAS = [
  L('1', 1, 'Receita Operacional Bruta', 'Rota - BLC', 'Balneario Camboriu', 1200000, 1250000, 1230000),   // nível 1: entra no banco, fora dos totais
  L('31', 1, '( = ) Receita Líquida', 'Rota - BLC', 'Balneario Camboriu', 1000000, 1100000, 1050000),
  L('31', 1, '( = ) Receita Líquida', 'Rota - RON', 'Rondonopolis', 500000, 520000, 510000),
  L('350', 1, '( = ) EBITDA AJUSTADO', 'Rota - BLC', 'Balneario Camboriu', 200000, 230000, 220000),
  L('170', 4, 'Combustíveis Veiculos e Equipamentos', 'Rota - BLC', 'Balneario Camboriu', -150000, -140000, -145000, 'Sim'),
  L('173', 4, 'Pneus Novos', 'Rota - RON', 'Rondonopolis', -30000, -28000, -29000),
  L('170', 3, 'Combustíveis (nível 3)', 'Rota - BLC', 'Balneario Camboriu', -150000, -140000, -145000),  // mesmo código em nível 3: fora da Frota
  L('999', 4, 'Outra conta qualquer', 'Rota - BLC', 'Balneario Camboriu', -1000, -1000, -1000),             // nível 4 fora das 14 contas
];
const RESUMO = [['Sintético do DRE Gerencial', null], ['Período e filtros', 'Out · 2026 · Grupo: Conlog'], ['Linhas', LINHAS.length]];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dre-'));
function xlsx(nome, folhas) {
  const wb = XLSX.utils.book_new();
  for (const [n, aoa] of folhas) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), n);
  const f = path.join(tmp, nome); XLSX.writeFile(wb, f); return f;
}
// as colunas em OUTRA ordem, para provar que a leitura é pelo rótulo
const emb = i => [i[1], i[0], ...i.slice(2)];
const ARQ = xlsx('dre_gerencial_sintetico_2026-11-17.xlsx', [['Sintético', [emb(HDR), ...LINHAS.map(emb)]], ['Resumo', RESUMO]]);
const ARQ_ERRADO = xlsx('outra_planilha.xlsx', [['Plan1', [['Placa', 'Km'], ['ABC1D23', 100]]]]);

/* ── dublê do supabase-js ── */
const SHIM_SB = (perfil, montaFalha) => `(function(){
const PERFIL=${JSON.stringify(perfil)}; const MONTA_FALHA=${montaFalha ? 'true' : 'false'};
const DB={ dre_gerencial:[], consumo_auto_base:[],
  ca_dre_frota:[], ca_dre_receita:[], ca_dre_ebitda:[],
  sh_dre_frota:[{vigencia:'10/2026',orcado:-280000,remunerado:-168000,realizado:-170000},{vigencia:'09/2026',orcado:-1,remunerado:-1,realizado:-1}],
  sh_dre_receita:[{vigencia:'10/2026',orcado:3240000,remunerado:1560000,realizado:1600000}],
  sh_dre_ebitda:[{vigencia:'10/2026',orcado:460000,remunerado:220000,realizado:230000}] };
window.__log={del:[],ins:0,rpc:[]}; window.__db=DB; let seq=0;
// o que o dre_gerencial_monta() de verdade faria com as três abas (só para a tela ter o que ler)
function monta(){
  const g=DB.dre_gerencial; const F=['170','171','173','174','176','177','178','180','181','183','185','186','398','572'];
  const vig=r=>String(r.mes).padStart(2,'0')+'/'+r.ano;
  const mk=(rows)=>rows.map(r=>({vigencia:vig(r),orcado:r.orcado,remunerado:r.remunerado,realizado:r.realizado}));
  DB.ca_dre_frota=mk(g.filter(r=>r.nivel===4&&F.includes(r.cod_dre))); DB.ca_dre_receita=mk(g.filter(r=>r.cod_dre==='31')); DB.ca_dre_ebitda=mk(g.filter(r=>r.cod_dre==='350'));
  const meses=[...new Set(g.map(vig))];
  const out={meses};
  for(const [s,t] of [['dre_frota',DB.ca_dre_frota],['dre_receita',DB.ca_dre_receita],['dre_ebitda',DB.ca_dre_ebitda]]){
    const i=DB.consumo_auto_base.findIndex(b=>b.slug===s); const b={slug:s,tabela:'ca_'+s,linhas:t.length+5,carregado_em:new Date().toISOString(),erro:null,resumo:{fonte:'dre_gerencial',meses_erp:meses,linhas_erp:t.length,linhas_aba:5}};
    if(i>=0) DB.consumo_auto_base[i]=b; else DB.consumo_auto_base.push(b); out[s]={erp:t.length,aba:5};
  }
  return out;
}
function q(t){ let op='select', val=null, f=[], fin=null, rg=null, one=false;
  const b={ select(){ return b; }, order(){ return b; }, eq(c,v){ f.push([c,v]); return b; }, in(c,v){ fin=[c,v]; return b; },
    range(a,z){ rg=[a,z]; return b; }, insert(o){ op='insert'; val=o; return b; }, delete(){ op='delete'; return b; },
    maybeSingle(){ one=true; return b; }, then(res,rej){ return Promise.resolve().then(run).then(res,rej); } };
  const casa=r=>f.every(([c,v])=>r[c]===v)&&(!fin||fin[1].includes(r[fin[0]]));
  function run(){
    if(t==='fca_profiles') return {data:one?PERFIL:[PERFIL],error:null};
    const tab=DB[t]; if(!tab) return {data:null,error:{message:'relation "public.'+t+'" does not exist'}};
    if(!PERFIL.is_admin && op!=='select') return {data:null,error:{message:'new row violates row-level security policy'}};
    if(op==='select'){ let rows=tab.filter(casa); if(one) return {data:rows[0]||null,error:null}; if(rg) rows=rows.slice(rg[0],rg[1]+1); return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
    if(op==='delete'){ const rows=tab.filter(casa); rows.forEach(r=>tab.splice(tab.indexOf(r),1)); window.__log.del.push([t,f]); return {data:rows,error:null}; }
    if(op==='insert'){ const arr=Array.isArray(val)?val:[val]; window.__log.ins+=arr.length;
      arr.forEach(o=>tab.push({...o,id:++seq,updated_at:new Date().toISOString()})); return {data:arr.map(()=>({id:seq})),error:null}; }
  }
  return b; }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com'}}}})},from:q,
  rpc:async(fn)=>{ window.__log.rpc.push(fn); if(!PERFIL.is_admin) return {data:null,error:{message:'só administradores montam as abas do DRE'}};
    if(MONTA_FALHA) return {data:null,error:{message:'function public.dre_gerencial_monta() does not exist'}}; return {data:monta(),error:null}; }})};
})();`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(perfil, { montaFalha = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { sessionStorage.setItem('gem_hub', '1'); });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SHEETJS }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: r.request().url().includes('supabase') ? SHIM_SB(perfil, montaFalha) : '' }));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(BASE + '/visao-financeira/dre/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof XLSX !== 'undefined' && document.getElementById('miolo').style.display !== 'none', null, { timeout: 15000 });
  await pg.waitForTimeout(300);
  return { ctx, pg, erros };
}
async function sobe(pg, arq) {
  await pg.setInputFiles('#fileInput', arq);
  await pg.waitForFunction(() => document.querySelectorAll('#res .item').length > 0, null, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return pg.evaluate(() => ({ cls: document.querySelector('#res .item').className, txt: document.querySelector('#res .item').innerText.replace(/\s+/g, ' ') }));
}
const foto = async (pg, n) => { if (SHOT) await pg.screenshot({ path: path.join(SHOT, n + '.png'), fullPage: true }); };

/* ── 1) admin sobe outubro ── */
{
  console.log('\n══ 1 · admin sobe o export de outubro');
  const { ctx, pg, erros } = await abre({ is_admin: true });
  const c = await sobe(pg, ARQ); await foto(pg, 'dre-import-ok');
  const log = await pg.evaluate(() => ({ del: window.__log.del, ins: window.__log.ins, rpc: window.__log.rpc, n: window.__db.dre_gerencial.length, l0: window.__db.dre_gerencial[0], bases: window.__db.consumo_auto_base.map(b => b.slug + ':' + b.linhas) }));
  console.log('   cartão:', c.cls, '·', c.txt.slice(0, 260));
  af('sem erro de página', erros.length === 0, erros[0] || '');
  af('cartão verde', /\bok\b/.test(c.cls), c.cls);
  af('apagou 10/2026 antes de gravar (ano e mês)', log.del.length === 1 && JSON.stringify(log.del[0][1]) === '[["ano",2026],["mes",10]]', JSON.stringify(log.del));
  af('gravou as 8 linhas do export (todas as estruturas)', log.ins === 8 && log.n === 8, `${log.ins} / ${log.n}`);
  af('chamou o dre_gerencial_monta uma vez', JSON.stringify(log.rpc) === '["dre_gerencial_monta"]', JSON.stringify(log.rpc));
  af('colunas pelo rótulo: Ano/Mês trocados de lugar e mesmo assim certos', log.l0.ano === 2026 && log.l0.mes === 10 && log.l0.cod_dre === '1' && log.l0.estrutura === 'Receita Operacional Bruta', JSON.stringify([log.l0.ano, log.l0.mes, log.l0.cod_dre]));
  af('overhead vira boolean, números crus, arquivo e autor gravados', log.l0.overhead === false && log.l0.realizado === 1200000 && /xlsx$/.test(log.l0.arquivo) && log.l0.updated_by === 'r@x.com', JSON.stringify([log.l0.overhead, log.l0.realizado, log.l0.arquivo, log.l0.updated_by]));
  af('o cartão diz o mês e as linhas confirmadas pelo banco', /8 linha\(s\) gravadas/.test(c.txt) && /out\/26/.test(c.txt), c.txt.slice(0, 80));
  af('totais do que os painéis vão ver: Receita 1,5 mi · EBITDA 200 mil · Frota −180 mil', /Receita Líquida real R\$ 1\.500\.000/.test(c.txt) && /EBITDA real R\$ 200\.000/.test(c.txt) && /Frota real -R\$ 180\.000/.test(c.txt), c.txt);
  af('abas montadas: Frota 2 · Receita 2 · EBITDA 1 linhas do ERP', /Frota 2 · Receita Líquida 2 · EBITDA 1/.test(c.txt), c.txt);
  const tela = await pg.evaluate(() => ({
    meses: document.getElementById('tabMeses').innerText.replace(/\s+/g, ' '),
    bases: [...document.querySelectorAll('#tabBases tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')),
    conf: [...document.querySelectorAll('#tabConf tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')),
  }));
  af('a tabela de meses lista out/26 com 8 linhas e os totais', /out\/26 8 R\$ 1\.500\.000 R\$ 200\.000 -R\$ 180\.000/.test(tela.meses), tela.meses.slice(0, 120));
  af('as três abas aparecem como "ERP + aba" com out/26', tela.bases.length === 3 && tela.bases.every(t => /ERP \+ aba/i.test(t) && /out\/26/.test(t)), tela.bases.join(' | '));
  af('a conferência ERP × aba tem as três abas de out/26, com o orçado da aba em dobro', tela.conf.length === 3 && /out\/26 Frota 2 \/ 1 -R\$ 180\.000 aba -R\$ 170\.000 -R\$ 168\.000 aba -R\$ 280\.000/.test(tela.conf[0]), tela.conf.join(' | '));

  // sobe de novo: substitui, não duplica
  await pg.evaluate(() => { document.getElementById('res').innerHTML = ''; });
  const c2 = await sobe(pg, ARQ);
  const log2 = await pg.evaluate(() => ({ del: window.__log.del.length, ins: window.__log.ins, n: window.__db.dre_gerencial.length, rpc: window.__log.rpc.length }));
  af('subir de novo apaga o mês e grava por cima: continuam 8 linhas', /\bok\b/.test(c2.cls) && log2.del === 2 && log2.ins === 16 && log2.n === 8 && log2.rpc === 2, JSON.stringify(log2));
  await ctx.close();
}

/* ── 2) arquivo que não é o export ── */
{
  console.log('\n══ 2 · arquivo sem o cabeçalho do DRE');
  const { ctx, pg } = await abre({ is_admin: true });
  const c = await sobe(pg, ARQ_ERRADO);
  const log = await pg.evaluate(() => ({ del: window.__log.del.length, ins: window.__log.ins, rpc: window.__log.rpc.length }));
  console.log('   cartão:', c.cls, '·', c.txt.slice(0, 200));
  af('cartão vermelho dizendo que nada foi gravado', /erro/.test(c.cls) && /nada foi gravado/.test(c.txt) && /Código DRE Gerencial/.test(c.txt), c.txt.slice(0, 160));
  af('nenhuma escrita e nenhuma chamada ao monta', log.del === 0 && log.ins === 0 && log.rpc === 0, JSON.stringify(log));
  await ctx.close();
}

/* ── 3) quem não é admin ── */
{
  console.log('\n══ 3 · usuário sem admin');
  const { ctx, pg } = await abre({ is_admin: false });
  const aviso = await pg.evaluate(() => document.getElementById('gate').innerText);
  const c = await sobe(pg, ARQ);
  const log = await pg.evaluate(() => ({ del: window.__log.del.length, ins: window.__log.ins, rpc: window.__log.rpc.length }));
  af('aviso de que só vê', /só para administradores/.test(aviso), aviso.slice(0, 80));
  af('cartão vermelho sem gravar', /erro/.test(c.cls) && /Sem permissão/.test(c.txt) && log.del === 0 && log.ins === 0 && log.rpc === 0, c.txt.slice(0, 80) + ' ' + JSON.stringify(log));
  await ctx.close();
}

/* ── 4) o monta falha (SQL não rodado) ── */
{
  console.log('\n══ 4 · dre_gerencial_monta ausente no banco');
  const { ctx, pg } = await abre({ is_admin: true }, { montaFalha: true });
  const c = await sobe(pg, ARQ);
  const log = await pg.evaluate(() => ({ ins: window.__log.ins, rpc: window.__log.rpc.length, bases: window.__db.consumo_auto_base.length }));
  const bases = await pg.evaluate(() => [...document.querySelectorAll('#tabBases tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')));
  console.log('   cartão:', c.cls, '·', c.txt.slice(0, 220));
  af('cartão âmbar dizendo que as linhas entraram e as abas não', /aviso/.test(c.cls) && /8 linha\(s\) gravadas em dre_gerencial, mas as abas não foram montadas/.test(c.txt) && /dre-gerencial\.sql/.test(c.txt) && !/nada foi gravado/.test(c.txt), c.txt.slice(0, 200));
  af('as linhas ficaram gravadas (o monta é só o passo seguinte)', log.ins === 8 && log.rpc === 1 && log.bases === 0, JSON.stringify(log));
  af('as três abas aparecem como "aba do Sheets (ainda não montada)"', bases.length === 3 && bases.every(t => /aba do Sheets/i.test(t) && /ainda não montada/.test(t)), bases.join(' | '));
  await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${falhas ? '✗' : '✓'} ${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

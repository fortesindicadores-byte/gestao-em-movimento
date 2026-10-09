// ============================================================
// BALANÇO DE MASSA — teste da tela de importação (/painel-km/balanco-massa/)
// e fumaça do Painel KM e da Árvore com o motor carregado.
//
// Chromium com o SheetJS DE VERDADE (node_modules/xlsx) e o supabase-js
// DUBLADO: o dublê guarda o que a tela mandou apagar e gravar, e serve a
// leitura do resumo. Entra pelo <input type=file>, como o usuário.
//
// Arquivo: um xlsx SINTÉTICO no formato do export do DRE (gerado aqui) e, se
// BM_XLSX apontar para o export real, ele também — com o total conferido
// contra a soma independente das linhas lidas pelo Node.
//
// Uso: NODE_PATH=$(npm root -g) node scripts/balanco-massa-import-teste.mjs
//   PW_CHROME=/caminho/chromium · BM_XLSX=/caminho/export.xlsx · SHOT_DIR=…
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
const perto = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

/* ── xlsx sintético no formato do export (cabeçalho real, DATA em serial) ── */
const HDR = ['EMPRESA', 'NÍVEL 1', 'NÍVEL 2', 'CÓD. RED PROJETO', 'NÍVEL 3', 'CONTA GERENCIAL', 'CÓD. RED. CONTA CONTÁBIL', 'CONTA CONTÁBIL', 'FORNECEDOR', 'HISTÓRICO', 'DATA', 'NATUREZA', 'DOCUMENTO', 'CÓD. CC', 'DESC. CC', 'REALIZADO', 'REMUNERADO'];
const serial = (y, m) => Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000);
const L = (n3, conta, hist, y, m, rem, nat = 'D') => ['CONCORDIA LOGISTICA S/A', '1.3.1. OPERAÇÕES DEDICADAS AMBEV', 'X', 1, n3, conta, 1, conta.toUpperCase(), '-', hist, serial(y, m), nat, `REMUN${String(m).padStart(2, '0')}${String(y).slice(2)}`, 3, 'DISTRIBUICAO', 0, rem];
const SINT = [HDR,
  L('EMPURRADA - PIR', 'Combustíveis', 'AJUSTES CONTÁBEIS - BALANÇO DE MASSA', 2026, 8, -100000),
  L('EMPURRADA - PIR', 'Combustíveis', 'AJUSTES CONTÁBEIS - BM', 2026, 8, -20000),          // mesma chave: soma
  L('EMPURRADA - PIR', 'Combustíveis', 'AJUSTES CONTÁBEIS - BM - RETROATIVO', 2026, 9, -300000),
  L('EMPURRADA - PIR', 'Arla', 'AJUSTES CONTÁBEIS - BM DESCONTO X PROVISÃO', 2026, 9, 5000, 'C'),   // crédito → valor negativo
  L('EMPURRADA - CBA', 'Pneus Novos', 'AJUSTES CONTÁBEIS - BALANÇO DE MASSA', 2026, 8, -7000),
  L('ROTA - CGR', 'Combustíveis', 'ABASTECIMENTO POSTO X', 2026, 8, -999),                 // fora do balanço: ignorada
  L('EMPURRADA - MCC', 'Lavação de Veículos', 'AJUSTES CONTÁBEIS - BM', 2026, 9, 0),         // remunerado zero: ignorada
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
const SINT_XLSX = path.join(TMP, 'export-dre-balanco.xlsx');
{ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SINT), 'Sheet1'); XLSX.writeFile(wb, SINT_XLSX); }
const FORA_XLSX = path.join(TMP, 'export-sem-balanco.xlsx');
{ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HDR, L('ROTA - CGR', 'Combustíveis', 'ABASTECIMENTO', 2026, 8, -10)]), 'Sheet1'); XLSX.writeFile(wb, FORA_XLSX); }

/* ── dublê do supabase-js: delete().eq()×3, upsert().select(), select().order().range() ── */
const SHIM_SB = (perfil) => `(function(){
const PERFIL=${JSON.stringify(perfil)}; const DB={balanco_massa:[]};
window.__log={del:[],ups:[]}; window.__db=DB;
function q(t){ let op='select', val=null, f=[], rg=null, one=false;
  const b={ select(){ return b; }, order(){ return b; }, eq(c,v){ f.push([c,v]); return b; }, range(a,z){ rg=[a,z]; return b; },
    upsert(o){ op='upsert'; val=o; return b; }, delete(){ op='delete'; return b; }, maybeSingle(){ one=true; return b; },
    then(res,rej){ return Promise.resolve().then(run).then(res,rej); } };
  const casa=r=>f.every(([c,v])=>r[c]===v);
  function run(){
    if(t==='fca_profiles') return {data:one?PERFIL:[PERFIL],error:null};
    const tab=DB[t]; if(!tab) return {data:null,error:{message:'relation "public.'+t+'" does not exist'}};
    if(!PERFIL.is_admin && op!=='select') return {data:null,error:{message:'new row violates row-level security policy'}};
    if(op==='select'){ let rows=tab.slice(); if(rg) rows=rows.slice(rg[0],rg[1]+1); return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
    if(op==='delete'){ const rows=tab.filter(casa); rows.forEach(r=>tab.splice(tab.indexOf(r),1)); window.__log.del.push(f.slice()); return {data:rows,error:null}; }
    if(op==='upsert'){ const arr=Array.isArray(val)?val:[val]; window.__log.ups.push(...arr.map(o=>({...o})));
      arr.forEach(o=>{ const i=tab.findIndex(r=>r.unidade===o.unidade&&r.projeto===o.projeto&&r.vigencia===o.vigencia&&r.conta===o.conta);
        const row={...o, updated_at:new Date().toISOString()}; if(i>=0) tab[i]=row; else tab.push(row); });
      return {data:arr.map(o=>({conta:o.conta})),error:null}; }
  }
  return b; }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com'}}}})},from:q})};
})();`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(perfil) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SHEETJS }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: r.request().url().includes('supabase') ? SHIM_SB(perfil) : '' }));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { sessionStorage.setItem('gem_hub', '1'); } catch (e) {} });
  await pg.goto(BASE + '/painel-km/balanco-massa/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof XLSX !== 'undefined' && document.getElementById('miolo').style.display !== 'none', { timeout: 15000 });
  await pg.waitForTimeout(300);
  return { ctx, pg, errs };
}
async function sobe(pg, arquivo) {
  await pg.setInputFiles('#fileInput', arquivo);
  await pg.waitForFunction(() => document.querySelectorAll('#res .item').length > 0, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return pg.evaluate(() => ({
    cartoes: [...document.querySelectorAll('#res .item')].map(d => ({ classe: d.className.replace('item', '').trim(), texto: d.textContent.replace(/\s+/g, ' ').trim() })),
    log: window.__log, db: window.__db.balanco_massa,
    tabela: [...document.querySelectorAll('#tab tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
  }));
}

/* ── 1) admin sobe o sintético ── */
console.log('1) admin · export sintético');
{
  const { ctx, pg, errs } = await abre({ is_admin: true });
  const r = await sobe(pg, SINT_XLSX);
  af('cartão amarelo (gravou, com linhas ignoradas listadas)', r.cartoes.length === 1 && r.cartoes[0].classe === 'aviso', JSON.stringify(r.cartoes));
  af('cartão diz 4 linhas gravadas a partir de 5 lançamentos', /4 linha\(s\) gravada\(s\).*5 lançamento/.test(r.cartoes[0].texto), r.cartoes[0].texto);
  af('cartão lista as ignoradas: 1 fora do balanço · 1 com remunerado zero', /1 fora do balanço/.test(r.cartoes[0].texto) && /1 com remunerado zero/.test(r.cartoes[0].texto), r.cartoes[0].texto);
  const pir8 = r.log.ups.find(o => o.unidade === 'PIR' && o.vigencia === '2026-08' && o.conta === 'Combustíveis');
  af('PIR ago Combustíveis soma os dois lançamentos: +120.000 (custo positivo)', pir8 && perto(pir8.valor, 120000), JSON.stringify(pir8));
  af('…com 2 linhas e os dois históricos abertos', pir8 && pir8.linhas === 2 && Object.keys(pir8.historicos).length === 2, pir8 && JSON.stringify(pir8.historicos));
  const pir9 = r.log.ups.find(o => o.unidade === 'PIR' && o.vigencia === '2026-09' && o.conta === 'Combustíveis');
  af('RETROATIVO de setembro fica em setembro (mês da DATA)', pir9 && perto(pir9.valor, 300000), JSON.stringify(pir9));
  const arla = r.log.ups.find(o => o.unidade === 'PIR' && o.vigencia === '2026-09' && o.conta === 'Arla');
  af('crédito (remunerado +5.000) vira valor −5.000', arla && perto(arla.valor, -5000), JSON.stringify(arla));
  af('projeto e unidade saem do NÍVEL 3', r.log.ups.every(o => o.projeto === 'EMPURRADA' && ['PIR', 'CBA'].includes(o.unidade) && o.nivel3.startsWith('EMPURRADA - ')), JSON.stringify(r.log.ups.map(o => [o.projeto, o.unidade])));
  af('a linha fora do balanço (ROTA - CGR) NÃO foi gravada', !r.log.ups.some(o => o.unidade === 'CGR'));
  af('apagou antes de gravar: um delete por (unidade, projeto, mês) = 3', r.log.del.length === 3, JSON.stringify(r.log.del));
  af('banco ficou com as 4 linhas', r.db.length === 4, r.db.length);
  af('a tabela de baixo releu o banco: 3 linhas (unidade × mês)', r.tabela.length === 3, JSON.stringify(r.tabela));
  const lin = r.tabela.find(t => t[0] === 'PIR' && t[2] === '2026-09');
  af('PIR 2026-09 mostra 2 contas e R$ 295.000,00 (300.000 − 5.000 de crédito)', lin && lin[3] === '2' && /295\.000,00/.test(lin[5]), JSON.stringify(lin));
  af('sem erro de página', errs.length === 0, errs.join(' | '));
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'bm-import-admin.png'), fullPage: true });

  // subir de novo substitui, não duplica
  const r2 = await sobe(pg, SINT_XLSX);
  af('subir de novo: banco continua com 4 linhas (substitui, não duplica)', r2.db.length === 4, r2.db.length);
  await ctx.close();
}

/* ── 2) arquivo sem lançamento de balanço: erro visível, nada gravado ── */
console.log('2) admin · export sem balanço de massa');
{
  const { ctx, pg } = await abre({ is_admin: true });
  const r = await sobe(pg, FORA_XLSX);
  af('cartão vermelho', r.cartoes[0].classe === 'erro', JSON.stringify(r.cartoes));
  af('diz que nada foi gravado e por quê', /nenhum lançamento de balanço de massa/.test(r.cartoes[0].texto) && /nada foi gravado/.test(r.cartoes[0].texto), r.cartoes[0].texto);
  af('zero deletes e zero upserts', r.log.del.length === 0 && r.log.ups.length === 0);
  await ctx.close();
}

/* ── 3) quem não é admin vê, mas não grava ── */
console.log('3) usuário sem admin');
{
  const { ctx, pg } = await abre({ is_admin: false });
  const aviso = await pg.evaluate(() => document.querySelector('#gate .aviso-topo')?.textContent || '');
  af('aviso de que a gravação é só para administradores', /administradores/.test(aviso), aviso);
  const r = await sobe(pg, SINT_XLSX);
  af('cartão de erro "Sem permissão"', r.cartoes[0].classe === 'erro' && /Sem permissão/.test(r.cartoes[0].texto), JSON.stringify(r.cartoes));
  af('nada foi ao banco', r.log.del.length === 0 && r.log.ups.length === 0);
  await ctx.close();
}

/* ── 4) o export REAL, quando disponível ── */
if (process.env.BM_XLSX && fs.existsSync(process.env.BM_XLSX)) {
  console.log('4) admin · export real (' + path.basename(process.env.BM_XLSX) + ')');
  const wb = XLSX.read(fs.readFileSync(process.env.BM_XLSX), { type: 'buffer' });
  const g = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false, raw: true });
  const h = g[0].map(s => String(s)); const iRem = h.indexOf('REMUNERADO'), iN3 = h.indexOf('NÍVEL 3'), iC = h.indexOf('CONTA GERENCIAL'), iD = h.indexOf('DATA'), iH = h.indexOf('HISTÓRICO');
  const dados = g.slice(1).filter(l => l[iN3] && /BALAN|BM/i.test(String(l[iH])) && +l[iRem]);
  const somaRem = dados.reduce((s, l) => s + (+l[iRem] || 0), 0);
  const chaves = new Set(dados.map(l => { const d = new Date(Date.UTC(1899, 11, 30) + l[iD] * 86400000); return `${l[iN3]}|${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}|${l[iC]}`; }));
  const { ctx, pg } = await abre({ is_admin: true });
  const r = await sobe(pg, process.env.BM_XLSX);
  af('cartão verde (nenhuma linha ignorada)', r.cartoes[0].classe === 'ok', JSON.stringify(r.cartoes));
  af(`gravou ${chaves.size} linha(s) = chaves distintas (unidade × mês × conta) do arquivo`, r.log.ups.length === chaves.size, r.log.ups.length);
  af(`Σ lançamentos = ${dados.length}`, r.log.ups.reduce((s, o) => s + o.linhas, 0) === dados.length, r.log.ups.reduce((s, o) => s + o.linhas, 0));
  const somaValor = r.log.ups.reduce((s, o) => s + o.valor, 0);
  af(`Σ valor gravado = −Σ REMUNERADO do arquivo (${somaValor.toFixed(2)})`, perto(somaValor, -somaRem, 1), -somaRem);
  af('três empurradas: CBA · MCC · PIR', JSON.stringify([...new Set(r.log.ups.map(o => o.unidade))].sort()) === '["CBA","MCC","PIR"]');
  const pirSet = r.log.ups.filter(o => o.unidade === 'PIR' && o.vigencia === '2026-09');
  af('PIR set/26 tem o RETROATIVO dentro do histórico das contas', pirSet.some(o => Object.keys(o.historicos).some(k => /RETROATIVO/.test(k))), JSON.stringify(pirSet.map(o => Object.keys(o.historicos))));
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'bm-import-real.png'), fullPage: true });
  await ctx.close();
} else console.log('4) export real: BM_XLSX não informado — pulado');

/* ── 5) fumaça: Painel KM e Árvore carregam o motor e não quebram com Google e banco mudos ── */
console.log('5) fumaça · Painel KM e Árvore com o motor');
{
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  const gviz = { status: 'ok', table: { cols: [], rows: [] } };
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('chart.js') ? 'window.Chart=class{static register(){}constructor(){}destroy(){}update(){}};' : u.includes('datalabels') ? 'window.ChartDataLabels={};' : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");' : u.includes('jspdf') ? 'window.jspdf={jsPDF:function(){}};' : '' }); });
  await ctx.route('**/docs.google.com/**', r => { const u = r.request().url(); const m = u.match(/responseHandler:([^&;]+)/);
    r.fulfill({ status: 200, contentType: 'application/javascript', body: m ? `${m[1]}(${JSON.stringify(gviz)})` : `google.visualization.Query.setResponse(${JSON.stringify(gviz)})` }); });
  const rest = []; await ctx.route('**/*.supabase.co/**', r => { rest.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  for (const [nome, url] of [['Painel KM', '/painel-km/index.html'], ['Árvore de Combustível', '/combustivel/arvore-combustivel/index.html']]) {
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { sessionStorage.setItem('gem_hub', '1'); } catch (e) {} });
    await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    const tem = await pg.evaluate(() => typeof window.BalancoMassa === 'object' && typeof BalancoMassa.recompoe === 'function');
    af(`${nome}: motor carregado`, tem);
    af(`${nome}: pediu a tabela balanco_massa ao banco`, rest.some(u => /balanco_massa/.test(u)), rest.filter(u => /balanco_massa/.test(u)).length);
    af(`${nome}: sem erro de página`, errs.length === 0, errs.join(' | '));
    await pg.close();
  }
  await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

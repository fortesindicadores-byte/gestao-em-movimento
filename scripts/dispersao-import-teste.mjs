// ============================================================
// DISPERSÃO DE KM — teste da tela de importação (/painel-km/dispersao/)
//
// Chromium com o SheetJS DE VERDADE e o supabase-js DUBLADO (guarda o que a
// tela apagou e gravou e serve as leituras, inclusive a aba Km/L do banco).
// Entra pelo <input type=file>, como o usuário.
//
// Planilha SINTÉTICA no formato da "Dispersão de KM - Consolidado" (01-BD com o
// Mês como DATA, 02-ABERT. PLACA, 02-Dinamica. Placa), com as regras plantadas:
//   · só set/26 em diante entra (agosto fica de fora);
//   · "Van - UDC" entra em Van;
//   · linha com km rodado na planilha fica com ele; sem, completa pela Km/L;
//   · Mercosul: CUC9514 (planilha) = CUC9F14 (Km/L), e a tela mostra CUC9514;
//   · Pelotas: placa AS + Rota na planilha vai para AS;
//   · Van vem da Km/L, mesmo a planilha dizendo Rota;
//   · placa repetida na Km/L conta uma vez; placa fora da planilha fica com o
//     projeto da Km/L.
// Com DISP_XLSX (a planilha real) e KML_LOG (saída do Dispersao KmL Placas),
// confere também o total de setembro.
//
// Uso: node scripts/dispersao-import-teste.mjs   (PW_CHROME, SHOT_DIR opcionais)
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

/* ── planilha sintética ── */
const serial = (y, m) => Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000);
const H01 = ['', '', 'Mês', '[Mês]', 'Unidade', '[Correção] - Unidade', '[Correção] - Projeto2', 'Projeto', 'Frota Ativa',
  '[Roteirizado]Quantidade de viagens realizadas', '[Roteirizado]Km renumerado por viagem', '[Roteirizado] Km remunerado por mês',
  '[Recarga]Quantidade de viagens realizadas', '[Recarga]Km renumerado por viagem', '[Recarga]Km remunerado por mês',
  '[Noturna] Quantidade de viagens realizadas', '[Noturna] Km renumerado por viagem', '[Noturna] Km remunerado por mês',
  '[Consolidado]Km remunerado por mês', '[Consolidado]Km rodado por mês', '[Consolidado]Dispersão (Km)', '[Consolidado]Dispersão (%)',
  '[Consolidado] Fator de remuneração (R$/Km)', '[Consolidado]Dispersão (R$)', '[Custo Per capita p/Veículo]', 'Viagens Mapa Aberto'];
const B = (m, uni, proj, kmRem, kmReal, fator = 2) => [null, null, serial(2026, m), m === 8 ? 'ago' : 'set', uni, uni, proj, proj, 3, 10, kmRem / 10, kmRem, 0, 0, 0, 0, 0, 0, kmRem, kmReal, null, null, fator, null, null, null];
const BD = [['', '', 'Dispersão de Km Remunerado X Rodado'], [], ['', '', 'Período'], H01,
  B(8, 'Pelotas-RS', 'Rota', 5000, 6000),                 // agosto: fica de fora
  B(9, 'Pelotas-RS', 'Rota', 4000, null),                 // set sem km rodado → Km/L
  B(9, 'Pelotas-RS', 'Auto Serviço', 500, null),
  B(9, 'Guarulhos-SP', 'Van', 1000, null),
  B(9, 'Guarulhos-SP', 'Van - UDC', 300, null),          // UDC → Van
  B(9, 'Guarulhos-SP', 'Rota', 2000, null),
  B(9, 'Campo Grande-RJ', 'Rota', 3000, 3500),           // com km rodado na planilha: fica
  B(9, 'Campo Grande-RJ', 'Auto Serviço', 1000, null),
  B(9, 'Piraí -RJ', 'Empurrada - 28 Palets', 9000, null),
];
const HAB = [null, 'UNIDADE', 'Entrega', 'OPERAÇÃO', 'Placa', 'Roteriz', 'Extra  ', 'Recolha', 'MKT    ', 'Recarga', 'Noturna', 'MÊS', 'UNIDADE2',
  '[Roteirizado]Km renumerado por viagem', 'Km Remuunerado [PRIM VIAGEM]', '[Recarga]Km renumerado por viagem', 'Km Remuunerado [RECARGA]',
  '[Noturna] Km renumerado por viagem', 'Km Remuunerado [NOTURNA]', '[Consolidado]Km remunerado por mês'];
const P = (mes, filial, uni, op, placa, km) => [null, filial, op === 'Auto Serviço' ? 'AS' : 'RT', op, placa, 1, null, null, null, null, null, mes, uni, 0, 0, 0, 0, 0, 0, km];
const AB = [[], HAB,
  P('AGOSTO', 'CDD PELOTAS', 'Pelotas-RS', 'ROTA', 'PLT1A11', 900),
  P('SETEMBRO', 'CDD PELOTAS', 'Pelotas-RS', 'ROTA', 'PLT1A11', 900),
  P('SETEMBRO', 'CDD PELOTAS', 'Pelotas-RS', 'Auto Serviço', 'CUC9514', 100),   // AS + Rota em Pelotas → AS
  P('SETEMBRO', 'CDD PELOTAS', 'Pelotas-RS', 'ROTA', 'CUC9514', 300),
  P('SETEMBRO', 'CDD GUARULHOS', 'Guarulhos-SP', 'ROTA', 'GRL2B22', 800),
  P('SETEMBRO', 'CDD GUARULHOS', 'Guarulhos-SP', 'ROTA', 'GRL3C33', 500),         // Km/L diz VAN → Van
  P('SETEMBRO', 'CDD GUARULHOS', 'Guarulhos-SP', 'UDC', 'GRL4D44', 300),
  P('SETEMBRO', 'CDD RIO DE JANEIRO', 'Campo Grande-RJ', 'Auto Serviço', 'CGR5E55', 600),  // AS + Rota no CGR → mais km rem (AS)
  P('SETEMBRO', 'CDD RIO DE JANEIRO', 'Campo Grande-RJ', 'ROTA', 'CGR5E55', 100),
];
const DIN = [[], [null, 'DISPERSÃO DE KM PLACA - T2', null, null, null, null, null, null, null, null, null, null, 'DISPERSÃO DE KM PLACA - T1'], [],
  [null, 'UNIDADE', 'UNIDADE2', 'MÊS', 'OPERAÇÃO', 'Placa', 'Total', 'Km rodado no mês (abastc)', '', '', '', null, 'UNIDADE', 'MÊS', 'PROJETO', 'Placa', 'KM Total  (REM)', 'KM RODADO'],
  [null, null, null, null, null, null, null, null, null, null, null, null, 'Piraí -RJ', 'SETEMBRO', 'Empurrada - 28 Palets', 'PIR6F66', 9000, null],
];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'disp-'));
const ARQ = path.join(TMP, 'Dispersao de KM - Consolidado 2026 (SET).xlsx');
{ const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(DIN), '02-Dinamica. Placa');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(AB), '02-ABERT. PLACA');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(BD), '01-BD');
  XLSX.writeFile(wb, ARQ); }
const ARQ_AGO = path.join(TMP, 'Dispersao de KM - Consolidado 2026 (AGO).xlsx');
{ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[], [], [], H01, B(8, 'Pelotas-RS', 'Rota', 5000, 6000)]), '01-BD'); XLSX.writeFile(wb, ARQ_AGO); }

/* aba Km/L no banco (sh_consumo_km_litro), vigência 'MM/AAAA' */
const K = (v, proj, placa, km) => ({ vigencia: v, projeto: proj, placa, km_rodado_horas_trabalhadas: km });
const KML = [
  K('09/2026', 'ROTA - PLT', 'PLT1A11', 4100),
  K('09/2026', 'ROTA - PLT', 'CUC9F14', 568),        // Mercosul da CUC9514
  K('09/2026', 'ROTA - GRL', 'GRL2B22', 2200),
  K('09/2026', 'VAN - GRL', 'GRL3C33', 1100),        // Van pela Km/L
  K('09/2026', 'VAN - GRL', 'GRL4D44', 400),         // UDC
  K('09/2026', 'VAN - GRL', 'GRL4D44', 400),         // repetida: conta uma vez
  K('09/2026', 'AUTO SERVIÇO - CGR', 'CGR5E55', 1300),
  K('09/2026', 'EMPURRADA - PIR', 'PIR6F66', 9500),
  K('09/2026', 'ROTA - CGR', 'CGR9Z99', 700),        // fora da planilha → Rota CGR, mas CGR Rota tem km na planilha
  K('08/2026', 'ROTA - PLT', 'PLT1A11', 5900),       // agosto não entra
];

/* ── dublê do supabase-js ── */
const SHIM_SB = (perfil) => `(function(){
const PERFIL=${JSON.stringify(perfil)}; const DB={dispersao_km:[],dispersao_placa:[],sh_consumo_km_litro:${JSON.stringify(KML)},
  sh_base:[{slug:'consumo_km_litro',carregado_em:'2026-10-14T13:49:00Z',erro:null}]};
window.__log={del:[],ins:{}}; window.__db=DB;
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
    if(op==='delete'){ const rows=tab.filter(casa); rows.forEach(r=>tab.splice(tab.indexOf(r),1)); window.__log.del.push([t,fin]); return {data:rows,error:null}; }
    if(op==='insert'){ const arr=Array.isArray(val)?val:[val]; (window.__log.ins[t]=window.__log.ins[t]||[]).push(...arr);
      arr.forEach(o=>tab.push({...o,updated_at:new Date().toISOString()})); return {data:arr.map(o=>({vigencia:o.vigencia,placa:o.placa})),error:null}; }
  }
  return b; }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com'}}}})},from:q})};
})();`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(perfil, tam = { width: 1400, height: 900 }, claro = false) {
  const ctx = await nav.newContext({ viewport: tam });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SHEETJS }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: r.request().url().includes('supabase') ? SHIM_SB(perfil) : '' }));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => { errs.push(e.message); if (process.env.DEBUG) console.log('PAGEERR', e.message); }); if (process.env.DEBUG) pg.on('console', m => console.log('CONSOLE', m.text()));
  await pg.addInitScript(c => { try { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', c ? 'light' : 'dark'); } catch (e) {} }, claro);
  await pg.goto(BASE + '/painel-km/dispersao/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof XLSX !== 'undefined' && document.getElementById('miolo').style.display !== 'none', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg, errs };
}
async function sobe(pg, arq) {
  await pg.setInputFiles('#fileInput', arq);
  await pg.waitForFunction(() => document.querySelectorAll('#res .item').length > 0, { timeout: 15000 });
  await pg.waitForTimeout(600);
  return pg.evaluate(() => ({
    cartoes: [...document.querySelectorAll('#res .item')].map(d => ({ classe: d.className.replace('item', '').trim(), texto: d.textContent.replace(/\s+/g, ' ').trim() })),
    log: window.__log, db: { km: window.__db.dispersao_km, pl: window.__db.dispersao_placa },
    tab: [...document.querySelectorAll('#tab tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
    pl: [...document.querySelectorAll('#tabPl tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
  }));
}
const linha = (tab, uni, proj) => tab.find(r => r[0] === uni && r[1] === proj);

console.log('1) admin · planilha sintética');
{
  const { ctx, pg, errs } = await abre({ is_admin: true });
  const r = await sobe(pg, ARQ);
  af('cartão gravou (ago fica de fora e é avisado)', r.cartoes.length === 1 && r.cartoes[0].classe === 'aviso' && /ficaram de fora.*ago\/26/.test(r.cartoes[0].texto), JSON.stringify(r.cartoes));
  af('só set/26 no banco', r.db.km.length > 0 && r.db.km.every(l => l.vigencia === '2026-09') && r.db.pl.every(p => p.vigencia === '2026-09'), [...new Set(r.db.km.map(l => l.vigencia))].join(','));
  const vanGrl = r.db.km.filter(l => l.unidade === 'GRL' && l.projeto === 'Van');
  af('"Van - UDC" entra em Van: uma linha GRL Van com 1.300 km rem', vanGrl.length === 1 && vanGrl[0].km_rem === 1300 && /UDC/.test(vanGrl[0].projetos_orig), JSON.stringify(vanGrl));
  af('placa gravada em Mercosul, com a de origem guardada', r.db.pl.some(p => p.placa === 'CUC9F14' && p.placa_origem === 'CUC9514'));
  af('set sem km rodado fica nulo no banco', r.db.km.find(l => l.unidade === 'PLT' && l.projeto === 'Rota').km_real === null);
  const plR = linha(r.tab, 'PLT', 'Rota'), plA = linha(r.tab, 'PLT', 'Auto Serviço');
  af('Pelotas Rota completada pela Km/L: só a PLT1A11 (4.100)', plR && plR[3] === '4.100' && /Km\/L/.test(plR[4]), JSON.stringify(plR));
  af('Pelotas AS = CUC9514 (Mercosul CUC9F14) com 568 km: AS vence em Pelotas', plA && plA[3] === '568', JSON.stringify(plA));
  const gV = linha(r.tab, 'GRL', 'Van'), gR = linha(r.tab, 'GRL', 'Rota');
  af('GRL Van = GRL3C33 (Rota na planilha, Van na Km/L) + UDC uma vez = 1.500', gV && gV[3] === '1.500', JSON.stringify(gV));
  af('GRL Rota = 2.200', gR && gR[3] === '2.200', JSON.stringify(gR));
  const cR = linha(r.tab, 'CGR', 'Rota'), cA = linha(r.tab, 'CGR', 'Auto Serviço');
  af('CGR Rota tem km rodado na planilha: fica 3.500 (fonte planilha)', cR && cR[3] === '3.500' && /planilha/.test(cR[4]), JSON.stringify(cR));
  af('CGR AS = CGR5E55 (AS + Rota, mais km rem no AS) = 1.300', cA && cA[3] === '1.300', JSON.stringify(cA));
  af('dispersão em km e % na linha (PLT Rota +100, +2,5%)', plR && plR[5] === '100' && plR[6] === '+2,5%', JSON.stringify(plR));
  af('linha Total soma o km rodado', /Total/.test((r.tab.at(-1) || [])[0]) && (r.tab.at(-1)[3] === (4100 + 568 + 1500 + 2200 + 3500 + 1300 + 9500).toLocaleString('pt-BR')), JSON.stringify(r.tab.at(-1)));
  const cuc = r.pl.find(l => l[0] === 'CUC9514');
  af('tabela de placas mostra a placa como está na planilha (CUC9514)', !!cuc && cuc[2] === 'Auto Serviço', JSON.stringify(cuc));
  af('placa fora da planilha aparece com o projeto da Km/L', r.pl.some(l => l[0] === 'CGR9Z99' && l[2] === 'Rota' && /^Km\/L$/.test(l[3])));
  af('Van marcada como "Van pela Km/L"', r.pl.some(l => l[0] === 'GRL3C33' && /Van pela Km\/L/.test(l[3])));
  // subir de novo substitui
  const r2 = await sobe(pg, ARQ);
  af('subir de novo substitui (mesmo nº de linhas no banco)', r2.db.km.length === r.db.km.length && r2.db.pl.length === r.db.pl.length, r2.db.km.length + ' / ' + r2.db.pl.length);
  // arquivo só com agosto: nada grava
  const r3 = await sobe(pg, ARQ_AGO);
  af('arquivo só com agosto: cartão vermelho e nada gravado', r3.cartoes[0].classe === 'erro' && /nada foi gravado/.test(r3.cartoes[0].texto), r3.cartoes[0].texto);
  for (const [w, h] of [[1366, 768], [1920, 1080]]) {
    await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(150);
    const lado = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    af(`sem barra lateral na página em ${w}px`, !lado);
  }
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'disp-import.png'), fullPage: true });
  af('sem erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
}

console.log('2) sem ser admin');
{
  const { ctx, pg } = await abre({ is_admin: false }, undefined, true);
  const r = await sobe(pg, ARQ);
  af('cartão de sem permissão e nada gravado', r.cartoes[0].classe === 'erro' && /permiss/i.test(r.cartoes[0].texto) && !r.db.km.length);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'disp-import-claro.png'), fullPage: true });
  await ctx.close();
}

/* ── 4) Painel KM: jan a ago iguais ao de antes, set/26 entra do banco ── */
console.log('4) Painel KM · antigo × novo com os mesmos dados');
{
  const { execSync } = await import('node:child_process');
  const ANTIGO = execSync(`git -C ${RAIZ} show ${process.env.ANTIGO || 'bd38bb7'}:painel-km/index.html`, { maxBuffer: 1 << 26 }).toString();
  // aba Dispersão de km (gviz): jan e ago, as colunas que o parseRow lê
  const linhaAba = (y, m, pc, kmFrota, viagens, rem, real) => { const c = Array.from({ length: 33 }, () => null);
    c[0] = { v: `Date(${y},${m - 1},1)` }; c[5] = { v: kmFrota }; c[14] = { v: pc }; c[22] = { v: viagens }; c[31] = { v: rem }; c[32] = { v: real }; return { c }; };
  const ABA = { status: 'ok', table: { cols: Array.from({ length: 33 }, (_, i) => ({ id: 'c' + i, label: '' })), rows: [
    linhaAba(2026, 1, 'ROTA - PLT', 2000, 300, 50000, 52000), linhaAba(2026, 1, 'EMPURRADA - PIR', 6000, 1400, 300000, 360000), linhaAba(2026, 8, 'ROTA - PLT', 1900, 280, 48000, 51000),
    linhaAba(2026, 8, 'ROTA (VAN) - GRL', 800, 40, 8000, 9000), linhaAba(2026, 8, 'EMPURRADA - PIR', 7000, 1500, 330000, 430000)] } };
  const VAZIO = { status: 'ok', table: { cols: [], rows: [] } };
  // aba Frota do DRE (o R$/km das chaves e o remunerado por conta do balanço de massa)
  const fr = (m, n3, conta, rem) => ({ c: [{ v: `Date(2026,${m - 1},1)` }, { v: n3 }, { v: conta }, { v: rem }] });
  const FROTA = { status: 'ok', table: { cols: [{ label: 'Vigência' }, { label: 'NÍVEL 3' }, { label: 'CONTA GERENCIAL' }, { label: 'REMUNERADO' }], rows: [
    fr(1, 'EMPURRADA - PIR', 'Combustíveis', -900000), fr(8, 'EMPURRADA - PIR', 'Combustíveis', -1000000), fr(9, 'EMPURRADA - PIR', 'Combustíveis', -950000),
    fr(8, 'ROTA - PLT', 'Combustíveis', -90000), fr(9, 'ROTA - PLT', 'Combustíveis', -80000)] } };
  const BANCO = {
    dispersao_km: [{ vigencia: '2026-09', unidade: 'PLT', projeto: 'Rota', km_rem: 4000, km_real: null, frota_ativa: 2, viagens_prim: 50, fator_rskm: 2 },
                   { vigencia: '2026-09', unidade: 'GRL', projeto: 'Van', km_rem: 1300, km_real: null, frota_ativa: 3, viagens_prim: 20, fator_rskm: 2 },
                   { vigencia: '2026-09', unidade: 'PIR', projeto: 'Empurrada - 28 Palets', km_rem: 9000, km_real: 9500, frota_ativa: 5, viagens_prim: 90, fator_rskm: 3 },
                   { vigencia: '2026-08', unidade: 'PLT', projeto: 'Rota', km_rem: 1, km_real: 1, frota_ativa: 1, viagens_prim: 1 }],   // ago no banco NÃO entra (a aba tem ago)
    dispersao_placa: [{ vigencia: '2026-09', unidade: 'PLT', projeto: 'Rota', placa: 'CUC9F14', placa_origem: 'CUC9514', km_rem: 4000 },
                      { vigencia: '2026-09', unidade: 'GRL', projeto: 'Van', placa: 'GRL4D44', placa_origem: 'GRL4D44', km_rem: 1300 }],
    sh_consumo_km_litro: [{ vigencia: '09/2026', projeto: 'ROTA - PLT', placa: 'CUC9F14', km_rodado_horas_trabalhadas: 4300 },
                          { vigencia: '09/2026', projeto: 'VAN - GRL', placa: 'GRL4D44', km_rodado_horas_trabalhadas: 1400 }],
    // balanço de massa por conta (banco): ago e set. O de set NÃO pode mexer em jan a ago.
    balanco_massa: [{ unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-08', conta: 'Combustíveis', valor: 200000 },
                    { unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-09', conta: 'Combustíveis', valor: 300000 }],
  };
  const roda = async (html, ligado = true) => {
    const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
      r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('chart.js') ? 'window.Chart=class{static register(){}constructor(){}destroy(){}update(){}};' : u.includes('datalabels') ? 'window.ChartDataLabels={};' : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");' : u.includes('jspdf') ? 'window.jspdf={jsPDF:function(){}};' : '' }); });
    await ctx.route('**/docs.google.com/**', r => { const u = decodeURIComponent(r.request().url()); const corpo = /sheet=Dispersão de km/.test(u) ? ABA : /sheet=Frota/.test(u) ? FROTA : VAZIO;
      r.fulfill({ status: 200, contentType: 'application/javascript', body: `google.visualization.Query.setResponse(${JSON.stringify(corpo)})` }); });
    await ctx.route('**/*.supabase.co/rest/v1/**', r => { const u = r.request().url(); const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1];
      const off = +((u.match(/offset=(\d+)/) || [])[1] || 0);
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(off ? [] : (BANCO[t] || [])) }); });
    await ctx.route('**/painel-km/__antigo.html', r => r.fulfill({ status: 200, contentType: 'text/html', body: ANTIGO }));
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { sessionStorage.setItem('gem_hub', '1'); localStorage.clear(); } catch (e) {} });
    if (ligado) await pg.addInitScript(() => { window.__dispBanco = true; });
    await pg.goto(BASE + html, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => { try { return ALL.length > 0; } catch (e) { return false; } }, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const kh = await pg.evaluate(() => { const k = document.querySelector('#vw-resumo .kpis.k4'); return k ? Math.round(k.getBoundingClientRect().height) : 0; });
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'painel-km-' + (ligado ? 'com' : 'sem') + '-set.png') });
    const out = await pg.evaluate(() => ({ kh: 0, all: ALL.map(r => ({ vig: r.vig, und: r.und, proj: r.proj, rem: r.rem, real: r.real, viagens: r.viagens, kmFrota: r.kmFrota, rsKm: r.rsKm, imp: r.imp })),
      placas: PLACAS.map(p => ({ vig: p.vig, und: p.und, proj: p.proj, placa: p.placa, rem: p.rem, real: p.real })) }));
    await ctx.close(); return { ...out, kh, errs };
  };
  const A = await roda('/painel-km/__antigo.html'), N = await roda('/painel-km/index.html');
  const ate = rs => JSON.stringify(rs.filter(r => r.vig !== '09/2026'));
  af('o balanço de massa entrou nos dois (PIR com km recomposto)', A.all.some(r => r.und === 'PIR' && r.vig !== '09/2026' && r.rem > (r.vig === '01/2026' ? 300000 : 330000)), JSON.stringify(A.all.filter(r => r.und === 'PIR').map(r => [r.vig, Math.round(r.rem)])));
  af('jan a ago idênticos ao painel de antes (linha a linha)', A.all.length > 0 && ate(A.all) === ate(N.all), A.all.length + ' × ' + N.all.length);
  af('o painel de antes não tinha set/26', !A.all.some(r => r.vig === '09/2026'));
  const s9 = N.all.filter(r => r.vig === '09/2026');
  af('set/26 entra do banco: 3 linhas', s9.length === 3, JSON.stringify(s9));
  const plt = s9.find(r => r.und === 'PLT'), grl = s9.find(r => r.und === 'GRL'), pir = s9.find(r => r.und === 'PIR');
  af('PLT ROTA: km rodado completado pela Km/L (CUC9F14 = 4.300)', plt && plt.proj === 'ROTA' && plt.real === 4300 && plt.rem === 4000, JSON.stringify(plt));
  af('GRL Van vira ROTA (VAN), como a aba usa', grl && grl.proj === 'ROTA (VAN)' && grl.real === 1400, JSON.stringify(grl));
  af('PIR Empurrada com km rodado da planilha (9.500) em EMPURRADA', pir && pir.proj === 'EMPURRADA' && pir.real === 9500, JSON.stringify(pir));
  af('agosto do banco não entra (a aba já tem agosto)', N.all.filter(r => r.vig === '08/2026' && r.und === 'PLT').length === 1 && N.all.find(r => r.vig === '08/2026' && r.und === 'PLT').rem === 48000);
  const pl = N.placas.find(p => p.vig === '09/2026' && p.und === 'PLT');
  af('visão Placas de set/26 mostra CUC9514 (como está na planilha) com 4.300 km', pl && pl.placa === 'CUC9514' && pl.real === 4300 && pl.rem === 4000, JSON.stringify(pl));
  const D = await roda('/painel-km/index.html', false);
  af('desligado (padrão hoje): set/26 fora e jan a ago iguais', !D.all.some(r => r.vig === '09/2026') && !D.placas.some(p => p.vig === '09/2026') && ate(D.all) === ate(A.all), D.all.length);
  af('cards do Resumo com a altura do padrão (≤ 170px)', N.kh > 0 && N.kh <= 170 && D.kh <= 170, N.kh + ' · ' + D.kh);
  af('sem erro de página nos dois', !A.errs.length && !N.errs.length, [...A.errs, ...N.errs].join(' | '));
}

if (process.env.DISP_XLSX && process.env.KML_LOG) {
  console.log('3) planilha real + aba Km/L real');
  createRequire(import.meta.url)(path.join(RAIZ, 'assets/dispersao-km.js'));
  const D = globalThis.DispersaoKm;
  const p = D.lePlanilha(XLSX, XLSX.read(fs.readFileSync(process.env.DISP_XLSX), { type: 'buffer' }), path.basename(process.env.DISP_XLSX));
  const kml = fs.readFileSync(process.env.KML_LOG, 'utf8').split('\n').filter(l => l.startsWith('KML|')).map(l => { const [, v, o, , pl, , , k] = l.split('|'); return { vigencia: v, projeto: o, placa: pl, km: +k || 0 }; });
  const t = D.monta(p.linhas, D.kmRodado(p.placas, kml.filter(r => r.vigencia >= D.INICIO)));
  const tot = Math.round(t.filter(r => r.vigencia === '2026-09').reduce((s, r) => s + (r.km_rodado || 0), 0));
  af('só set/26 da planilha real', p.linhas.every(l => l.vigencia >= '2026-09') && p.antes.length > 0, p.antes.join(','));
  af('set/26 completado: 1.332.673 km (a conta validada)', tot === 1332673, tot);
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

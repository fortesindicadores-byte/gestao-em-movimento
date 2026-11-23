// ============================================================
// REMUNERADO POR VIAGEM — teste da importação do 2artd e da base de CT-e
// em /painel-km/dispersao/ (Renan, 18/11/2026).
//
// Chromium com o SheetJS de verdade e o supabase-js DUBLADO (guarda o que a
// tela apagou e gravou; serve o Freightech de out/26 em ft_layout/ft_linha).
// Planilhas SINTÉTICAS (o repositório é público), com as regras plantadas:
//   · só frota própria (Padrão e Fixo): Spot e Espec. ficam fora;
//   · Roteriz, Extra e Recolha = 1ª viagem; Recarga com o km da recarga;
//   · o km de cada mapa é o do FT da QUINZENA dele (1ª 100 km, 2ª 110 km);
//   · placa da tabela Van do FT = Van; Entrega AS = Auto Serviço;
//   · virado = entrega num dia depois da saída;
//   · mapa sem valor conta e vira aviso; mapa pago diferente do FT também;
//   · CT-e: cancelado e setembro ficam fora; 28 e 42 pallets separados, com a
//     frota de cada um pela FT_CAVALO;
//   · subir de novo substitui (não duplica) e não mexe em outra unidade;
//   · 2artd de setembro e usuário sem admin não gravam.
// Uso: node scripts/remun-import-teste.mjs   (PW_CHROME, SHOT_DIR opcionais)
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

/* ── Freightech de out/26 (ft_layout + ft_linha) ── */
const FT = [];
const ft = (canal, tabela, vig, linhas) => { const cols = [...new Set(linhas.flatMap(o => Object.keys(o)))];
  FT.push({ canal, tabela, vigencia: vig, colunas: cols, linhas: linhas.map(o => cols.map(c => o[c] ?? null)) }); };
for (const q of [1, 2]) {
  const v = 'ROTA_' + q + '_10_2026', va = 'AS_' + q + '_10_2026';
  ft('ROTA', 'ParametrosGeraisRota', v, [{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', 'KM Mensal Primeira Viagem': q === 1 ? 2500 : 2750, 'KM Recarga por Viagem': q === 1 ? 40 : 50, 'KM Mensal Noturna': 0, kmMensalRemuneradoVan: 2000 }]);
  ft('ROTA', 'RecargaVan', v, [{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', kmPorViagem: 30 }]);
  ft('ROTA', 'ResumoSrtrans', v, [{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', 'Custo Variável Padrão': q === 1 ? 6250 : 7500, 'Custo Variável Marketing': q === 1 ? 6250 : 7500, 'Custo Variável Recarga': q === 1 ? 120 : 150, 'Custo Variável Noturna': 0 }]);
  ft('ROTA', 'ResumoSrtransVan', v, [{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', custoVariavelPadrao: 2000, custoVariavelRecarga: 60, custoVariavelNoturna: 0 }]);
  ft('ROTA', 'Van', v, [{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', placa: 'VAN1A11', ativo: true }]);
  ft('ROTA', 'Caminhao', v, [1, 2, 3].map(i => ({ 'Unidade - Nome': 'CDD NOVA FRIBURGO', Placa: 'NFR' + i + 'A11', Ativo: true })).concat([{ 'Unidade - Nome': 'CDD NOVA FRIBURGO', Placa: 'NFR9Z99', Ativo: false }]));
  ft('AS', 'ParametrosGeraisAS', va, [{ 'Unidade - Nome': 'CDD RIO DE JANEIRO', kmMensalPrimeiraViagem: 2000, kmRecargaPorViagem: 50, kmMensalNoturna: 0 }]);
  ft('AS', 'ResumoSrtransAS', va, [{ 'Unidade - Nome': 'CDD RIO DE JANEIRO', custoVariavelPadrao: 5000, custoVariavelMkt: 5000, custoVariavelRecarga: 100 }]);
  ft('AS', 'CaminhaoAS', va, [{ 'Unidade - Nome': 'CDD RIO DE JANEIRO', Placa: 'CGR1A11', Ativo: true }, { 'Unidade - Nome': 'CDD RIO DE JANEIRO', Placa: 'CGR2B22', Ativo: true }]);
}
const ft_layout = FT.map(t => ({ canal: t.canal, tabela: t.tabela, vigencia: t.vigencia, colunas: t.colunas }));
const ft_linha = FT.flatMap(t => t.linhas.map((d, i) => ({ canal: t.canal, tabela: t.tabela, vigencia: t.vigencia, linha: i,
  unidade: d[t.colunas.indexOf('Unidade - Nome')], placa: d[t.colunas.indexOf('Placa')] ?? d[t.colunas.indexOf('placa')] ?? null, dados: d })));

/* ── 2artd sintético ── */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'remun-'));
const ser = (d, h = 8) => Math.round((Date.UTC(2026, 9, d) - Date.UTC(1899, 11, 30)) / 86400000) + h / 24;
const H2 = ['Vigência', 'Entrega ', 'Carga Atual', 'Frota ', 'VBZ', 'Projeto', 'Nome - Unidade', 'Placa', 'Mapa', 'HrSai', 'HrEntr', 'CustoVariavel', 'PercImposto', 'ValorFaturado', 'KmSai', 'KmEntr', 'KmPrevistoRoad', 'KmLaco', 'KmDeslocamento', 'CPFMotorista'];
const M = (vig, ent, carga, frota, proj, placa, valor, d, dEnt = d) => [vig, ent, carga, frota, 5, proj, 'X', placa, Math.floor(Math.random() * 1e6), ser(d, 7), ser(dEnt, 17), valor, 13.15, valor / (1 - 0.1315), 1, 1, carga === 'Recarga' ? 15 : 90, carga === 'Recarga' ? 10 : 70, carga === 'Recarga' ? 5 : 20, '00000000000'];
const ART = [H2,
  ...Array(3).fill(0).map(() => M('ROTA_1_10_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - NFR', 'NFR1A11', 250, 5)),
  M('ROTA_1_10_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - NFR', 'NFR2A11', 250, 6, 7),        // virado
  M('ROTA_1_10_2026', 'Rota', 'Recarga', 'Padrao', 'ROTA - NFR', 'NFR2A11', 120, 6),
  M('ROTA_1_10_2026', 'Rota', 'Recolha', 'Padrao', 'TERCEIROS - NFR', 'REC0001', 250, 8),       // paga como 1ª, placa fictícia
  ...Array(3).fill(0).map(() => M('ROTA_2_10_2026', 'Rota', 'Extra', 'Padrao', 'ROTA - NFR', 'NFR3A11', 300, 20)),
  M('ROTA_2_10_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - NFR', 'NFR3A11', 0, 21),             // sem valor
  M('ROTA_2_10_2026', 'Rota', 'Roteriz', 'Fixo', 'ROTA - NFR', 'VAN1A11', 88, 22),               // Van, pago 88 (FT 80)
  M('ROTA_2_10_2026', 'Rota', 'Roteriz', 'Fixo', 'ROTA - NFR', 'VAN1A11', 88, 23),
  M('ROTA_2_10_2026', 'Rota', 'Extra', 'Spot', 'TERCEIROS - NFR', 'SPO1A00', 700, 23),          // freteiro: fora
  M('ROTA_2_10_2026', 'Rota', 'MKT', 'Espec.', 'TERCEIROS - NFR', 'REC0002', 0, 23),            // Espec.: fora
  M('AS_1_10_2026', 'AS', 'Roteriz', 'Padrao', 'AUTO SERVIÇO - CGR', 'CGR1A11', 200, 9),
  M('AS_1_10_2026', 'AS', 'Roteriz', 'Padrao', 'AUTO SERVIÇO - CGR', 'CGR2B22', 200, 9),
];
const ARQ_ART = path.join(TMP, '2artd_REM_10_2026.xlsx');
{ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ano:', 2026], ['Mês:', 10]]), 'Filtro');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ART), '2artd'); XLSX.writeFile(wb, ARQ_ART); }
const ARQ_ART9 = path.join(TMP, '2artd_REM_09_2026.xlsx');
{ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H2, M('ROTA_1_9_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - NFR', 'NFR1A11', 250, 5)]), '2artd'); XLSX.writeFile(wb, ARQ_ART9); }

/* ── base de CT-e sintética (Empurrada Piraí) ── */
const HC = ['Número CTe', 'Data  de Emissão', 'Situação', 'Placa', 'Capacidade', 'nome_projeto', 'Vl. Frete Liquido', 'KM Total', 'KM Total da perna'];
const C = (n, data, sit, placa, cap, km, v) => [n, data, sit, placa, 'Pallets: ' + cap, 'EMPURRADA - PIR', v, km * 2, km];
const ARQ_CTE = path.join(TMP, 'EMPURRADA_PIR.xlsx');
{ const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Canal/Segmento', 'EMPURRADA']]), 'Menu');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HC,
    C(1, '05/10/2026', 'Autorizado', 'PIR1A11', 28, 100, 500), C(2, '20/10/2026', 'Autorizado', 'PIR1A11', 28, 100, 500),
    C(3, '21/10/2026', 'Autorizado', 'PIR4D44', 42, 150, 600), C(4, '22/10/2026', 'Cancelado', 'PIR1A11', 28, 100, 500),
    C(5, '30/09/2026', 'Autorizado', 'PIR1A11', 28, 100, 500)]), 'Base_CT-es_T1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Vigencia', 'placa', 'ativo', 'combustivelCapacidade'],
    ['EMPURRADA_2_10_2026', 'PIR1A11', 'ATIVO', '28'], ['EMPURRADA_2_10_2026', 'PIR2B22', 'ATIVO', '28'],
    ['EMPURRADA_2_10_2026', 'PIR4D44', 'ATIVO', '42'], ['EMPURRADA_2_10_2026', 'PIR5E55', 'PARADO', '28'],
    ['EMPURRADA_1_10_2026', 'PIR1A11', 'ATIVO', '28']]), 'FT_CAVALO');
  XLSX.writeFile(wb, ARQ_CTE); }

/* ── dublê do supabase-js ── */
const SHIM_SB = (perfil, semRemun) => `(function(){
const PERFIL=${JSON.stringify(perfil)};
const DB={dispersao_km:[{vigencia:'2026-10',unidade:'CBA',projeto:'Rota',km_rem:999,viagens_prim:9,frota_ativa:1,arquivo:'outra'}],dispersao_placa:[],dispersao_placa_viagem:[],
  ${semRemun ? '' : 'remun_viagem:[],remun_mapa:[],'}sh_consumo_km_litro:[{vigencia:'10/2026',projeto:'ROTA - NFR',placa:'NFR1A11',km_rodado_horas_trabalhadas:1000}],
  sh_base:[{slug:'consumo_km_litro',carregado_em:'2026-11-18T09:00:00Z',erro:null}],
  ft_layout:${JSON.stringify(ft_layout)}, ft_linha:${JSON.stringify(ft_linha)}};
window.__db=DB;
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
    if(op==='delete'){ const rows=tab.filter(casa); rows.forEach(r=>tab.splice(tab.indexOf(r),1)); return {data:rows,error:null}; }
    if(op==='insert'){ const arr=Array.isArray(val)?val:[val]; arr.forEach(o=>tab.push({...o,updated_at:new Date().toISOString()}));
      return {data:arr.map(o=>({vigencia:o.vigencia,placa:o.placa,tipo:o.tipo})),error:null}; }
  }
  return b; }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com'}}}})},from:q})};
})();`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(perfil, semRemun = false, tam = { width: 1400, height: 900 }) {
  const ctx = await nav.newContext({ viewport: tam });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SHEETJS }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}})' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: r.request().url().includes('supabase') ? SHIM_SB(perfil, semRemun) : '' }));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { sessionStorage.setItem('gem_hub', '1'); } catch (e) {} });
  await pg.goto(BASE + '/painel-km/dispersao/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof XLSX !== 'undefined' && document.getElementById('miolo').style.display !== 'none', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg, errs };
}
async function sobe(pg, arqs) {
  await pg.evaluate(() => { document.getElementById('res').innerHTML = ''; });
  await pg.setInputFiles('#fileInput', arqs);
  await pg.waitForFunction(n => document.querySelectorAll('#res .item').length >= n, Array.isArray(arqs) ? arqs.length : 1, { timeout: 20000 });
  await pg.waitForTimeout(700);
  return pg.evaluate(() => ({
    cartoes: [...document.querySelectorAll('#res .item')].map(d => ({ classe: d.className.replace('item', '').trim(), texto: d.textContent.replace(/\s+/g, ' ').trim() })),
    db: JSON.parse(JSON.stringify({ km: window.__db.dispersao_km, pl: window.__db.dispersao_placa, pv: window.__db.dispersao_placa_viagem, rv: window.__db.remun_viagem || null, rm: window.__db.remun_mapa || null })),
    conf: [...document.querySelectorAll('#tabConf tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())),
  }));
}
const L = (db, u, p) => db.km.find(l => l.vigencia === '2026-10' && l.unidade === u && l.projeto === p);

console.log('1) admin · 2artd + base de CT-e juntos');
{
  const { ctx, pg, errs } = await abre({ is_admin: true });
  const r = await sobe(pg, [ARQ_ART, ARQ_CTE]);
  af('2artd verde e CT-e com aviso do cancelado', r.cartoes.length === 2 && r.cartoes[0].classe === 'ok' && r.cartoes[1].classe === 'aviso' && /CANCELADO 1/.test(r.cartoes[1].texto), JSON.stringify(r.cartoes));
  const nr = L(r.db, 'NFR', 'Rota');
  af('NFR Rota: 9 viagens de 1ª (Roteriz + Extra + Recolha, com o mapa sem valor)', nr && nr.viagens_prim === 9, JSON.stringify(nr));
  af('NFR Rota: km por quinzena do FT = 5×100 + 1×40 + 4×110 = 980', nr && nr.km_rem === 980 && nr.km_rem_rec === 40 && nr.viagens_rec === 1, nr && nr.km_rem);
  af('NFR Rota: 1 mapa virado e frota ativa 3 (do FT, a inativa fora)', nr && nr.viagens_mapa_aberto === 1 && nr.frota_ativa === 3, nr && [nr.viagens_mapa_aberto, nr.frota_ativa].join(','));
  af('NFR Rota: km rodado nulo (o painel completa pela Km/L)', nr && nr.km_real === null);
  const nv = L(r.db, 'NFR', 'Van');
  af('Van pela placa do FT: 2 viagens × 80 km = 160, frota 1', nv && nv.viagens_prim === 2 && nv.km_rem === 160 && nv.frota_ativa === 1, JSON.stringify(nv));
  const as = L(r.db, 'CGR', 'Auto Serviço');
  af('CGR Auto Serviço: 2 × 80 = 160, frota 2', as && as.km_rem === 160 && as.frota_ativa === 2, JSON.stringify(as));
  af('Spot e Espec. fora (nenhuma placa SPO/REC0002)', !r.db.pl.some(p => /SPO|REC0002/.test(p.placa)) && !r.db.pv.some(p => /SPO/.test(p.placa)));
  af('placa fictícia (REC0001) conta no total mas não vira placa', !r.db.pl.some(p => /^REC/.test(p.placa)));
  af('km por placa: NFR2A11 com 140 km (1ª viagem 100 + recarga 40)', (() => { const p = r.db.pl.find(x => x.placa === 'NFR2A11'); return p && p.km_rem === 140; })(), JSON.stringify(r.db.pl.find(x => x.placa === 'NFR2A11')));
  const p28 = L(r.db, 'PIR', 'Empurrada - 28 Palets'), p42 = L(r.db, 'PIR', 'Empurrada - 42 Palets');
  af('CT-e 28 pallets: 2 viagens, 200 km, frota 2 (cancelado e setembro fora)', p28 && p28.viagens_prim === 2 && p28.km_rem === 200 && p28.frota_ativa === 2, JSON.stringify(p28));
  af('CT-e 42 pallets: 1 viagem, 150 km, frota 1', p42 && p42.viagens_prim === 1 && p42.km_rem === 150 && p42.frota_ativa === 1, JSON.stringify(p42));
  af('outra unidade (CBA Rota) intacta', !!L(r.db, 'CBA', 'Rota') && L(r.db, 'CBA', 'Rota').km_rem === 999);
  const rvNfr = (r.db.rv || []).filter(c => c.unidade === 'NFR' && c.projeto === 'Rota');
  af('detalhe: mapa sem valor e mapa virado contados', rvNfr.reduce((a, c) => a + c.sem_valor, 0) === 1 && rvNfr.reduce((a, c) => a + c.virados, 0) === 1);
  const rvVan = (r.db.rv || []).find(c => c.unidade === 'NFR' && c.projeto === 'Van');
  af('detalhe: Van paga 88 contra 80 do FT → 2 mapas, +R$ 16', rvVan && rvVan.pago_diferente === 2 && rvVan.dif_valor === 16, JSON.stringify(rvVan));
  af('tabela de conferência na tela', r.conf.some(t => t[0] === 'NFR' && t[1] === 'Rota') && r.conf.some(t => t[0] === 'Total'), JSON.stringify(r.conf.slice(0, 2)));
  // cada mapa gravado (remun_mapa)
  const rm = r.db.rm || [], rec = rm.find(m => m.tipo === 'rec');
  af('mapas um a um: 14 da frota própria (Spot e Espec. fora), sem CPF', rm.length === 14 && !rm.some(m => Object.keys(m).some(k => /cpf|motorista/i.test(k))) && /14 mapas gravados um a um/.test(r.cartoes[0].texto), rm.length + ' · ' + r.cartoes[0].texto.slice(0, 200));
  af('mapa de recarga: previsto 15 km, FT paga 40, saída 06/10 07:00', rec && rec.km_previsto === 15 && rec.km_ft === 40 && rec.hr_sai === '2026-10-06T07:00:00' && rec.hr_entr === '2026-10-06T17:00:00' && rec.placa === 'NFR2A11' && rec.quinzena === 1, JSON.stringify(rec));
  af('mapa da Van vai no projeto Van com o km do FT (80)', rm.filter(m => m.projeto === 'Van').length === 2 && rm.find(m => m.projeto === 'Van').km_ft === 80);
  const r2 = await sobe(pg, [ARQ_ART]);
  af('subir de novo não duplica os mapas', (r2.db.rm || []).length === 14, (r2.db.rm || []).length);
  af('subir de novo substitui, sem duplicar', r2.db.km.filter(l => l.vigencia === '2026-10' && l.unidade === 'NFR' && l.projeto === 'Rota').length === 1
    && r2.db.pl.filter(p => p.placa === 'NFR1A11').length === 1);
  af('sem erro na página', errs.length === 0, errs.join(' | '));
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'remun-import.png'), fullPage: true });
  await ctx.close();
}

console.log('2) 2artd de setembro (antes de out/26)');
{
  const { ctx, pg } = await abre({ is_admin: true });
  const r = await sobe(pg, [ARQ_ART9]);
  af('cartão vermelho, nada gravado', r.cartoes[0].classe === 'erro' && !r.db.km.some(l => l.vigencia === '2026-09'), r.cartoes[0].texto);
  await ctx.close();
}

console.log('3) sem a tabela remun_viagem no banco');
{
  const { ctx, pg } = await abre({ is_admin: true }, true);
  const r = await sobe(pg, [ARQ_ART]);
  af('grava a dispersão e avisa para rodar o SQL', r.cartoes[0].classe === 'aviso' && /remun-viagem\.sql/.test(r.cartoes[0].texto) && /remun-mapa\.sql/.test(r.cartoes[0].texto) && !!L(r.db, 'NFR', 'Rota'), r.cartoes[0].texto);
  await ctx.close();
}

console.log('4) usuário sem admin');
{
  const { ctx, pg } = await abre({ is_admin: false });
  const r = await sobe(pg, [ARQ_ART]);
  af('recusado, nada gravado', r.cartoes[0].classe === 'erro' && !L(r.db, 'NFR', 'Rota'), r.cartoes[0].texto);
  await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

// Integração Abastecimentos → Preço e Km/L: os painéis do ERP abertos dentro dela
// com ?fonte=api&embed=1. Chromium com o banco e o gviz dublados: o realizado tem de
// sair das APIs (3,00 km/L e R$ 6,50/L) e o remunerado da aba (2,50 km/L, R$ 6,20/L).
// Uso: SBJS=<supabase UMD> CHART_JS=<chart.umd.js> DATALABELS=<…> [SHOT_DIR=…] node scripts/integracao-emb-teste.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import http from 'node:http';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (n, c, x = '') => { c ? ok++ : falha++; console.log(`${c ? 'ok ' : 'FALHA'} ${n}${x ? ' — ' + x : ''}`); };
// 6 placas, metade ROTA - CBA, metade EMPURRADA - PIR; 1 abastecimento a cada 3 dias de set e out
const PL = ['AAA1A11', 'AAA1A12', 'AAA1A13', 'BBB2B21', 'BBB2B22', 'BBB2B23'];
const projDe = p => p.startsWith('AAA') ? 'ROTA - CBA' : 'EMPURRADA - PIR';
const A = []; const HOD = {};
for (const ym of ['2026-09', '2026-10']) for (let d = 1; d <= 28; d += 3) PL.forEach((p, i) => {
  HOD[p] = (HOD[p] || 50000) + 300;
  A.push({ sistema: i % 2 ? 'GASOLA' : 'PROFROTAS', id_origem: `${p}${ym}${d}`, item: 1, dia: `${ym}-${String(d).padStart(2, '0')}`, unidade: p.startsWith('AAA') ? 'CBA' : 'PIR',
    placa: p, placa_origem: p, produto: 'DIESEL S10', litros: 100, valor: 650, posto: 'POSTO X', cnpj_posto: '11111111000101', hodometro: HOD[p], valido: true });
});
// aba Km/L do consumo automático (a do ERP), com o realizado do ERP diferente de propósito
const KML = []; let ln = 1;
for (const ym of ['2026-09', '2026-10']) PL.forEach(p => KML.push({ linha: ln++, vigencia_orig: ym + '-01', km_l_rem_medio: 2.5, km_l_rem_modelo: 2.6, km_l_real: 9.9, rs_l_rem: 6.2, rs_l_real: 9.9,
  ativo: 'VERDADEIRO', projeto: projDe(p), unidade: p.startsWith('AAA') ? 'CUIABA' : 'PIRAI', placa: p, modelo: 'ACTROS 2651', tipo_combustivel: 'DIESEL S10', tipo_veiculo: 'CAVALO',
  km_rodado_horas_trabalhadas: 99999, qtd_total_de_litros: 1, valor_medio_litro: 9.9, totas_rs: 9.9 }));
const LBL = ['Vigência', 'R$/km Rem', 'R$/km Real', 'Δ R$/km', 'KM/l Rem Médio', 'Km/l Rem Modelo', 'Km/L Real', 'Δ Km/l', 'R$/L Rem', 'R$/L/Real', 'Δ R$/L', 'Ativo', 'Operação', 'Empresa', 'Projeto', 'Unidade', 'Placa', 'Mês Inicio OS', 'Ano Inicio OS', 'Modelo', 'Tipo Combustivel', 'Tipo Veiculo', 'KM Rodado / Horas trabalhadas', 'QTD Total de Litros', 'Valor Médio Litro', 'TOTAS R$'];
const COL = ['vigencia_orig', 'rs_km_rem', 'rs_km_real', 'd_rs_km', 'km_l_rem_medio', 'km_l_rem_modelo', 'km_l_real', 'd_km_l', 'rs_l_rem', 'rs_l_real', 'd_rs_l', 'ativo', 'operacao', 'empresa', 'projeto', 'unidade', 'placa', 'mes_inicio_os', 'ano_inicio_os', 'modelo', 'tipo_combustivel', 'tipo_veiculo', 'km_rodado_horas_trabalhadas', 'qtd_total_de_litros', 'valor_medio_litro', 'totas_rs'];
const gvKml = () => ({ cols: LBL.map(l => ({ label: l })), rows: KML.map(r => ({ c: COL.map(c => c === 'vigencia_orig' ? { v: `Date(${r[c].slice(0, 4)},${+r[c].slice(5, 7) - 1},1)` } : { v: r[c] ?? null }) })) });
const gvRsl = () => ({ cols: ['Unidade Benner', 'Vigência', 'Vigência Data', 'Vigência Data', 'TipoCombustivelShared', 'precoOperadora'].map(l => ({ label: l })),
  rows: ['2026-09', '2026-10'].flatMap(ym => ['ROTA - CBA', 'EMPURRADA - PIR'].map(p => ({ c: [{ v: p }, { v: null }, { v: null }, { v: `Date(${ym.slice(0, 4)},${+ym.slice(5) - 1},1)` }, { v: 'Descrição: DIESEL S10' }, { v: 6.2 }] }))) });

// servidor local: o iframe precisa ser da mesma origem (em file:// a origem é nula e o Chromium isola)
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let f = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (f.endsWith('/')) f += 'index.html';
  try { const b = readFileSync(join(RAIZ, f)); r.writeHead(200, { 'Content-Type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(b); } catch (e) { r.writeHead(404); r.end(); } });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h, tema] of [[1366, 768, 'dark'], [1920, 1080, 'light']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' });
  await ctx.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await ctx.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await ctx.route(/chart\.js@4|chart\.umd/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){},resize(){}}};', contentType: 'application/javascript' }));
  await ctx.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await ctx.route(/html2canvas|jspdf|xlsx|sheetjs/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await ctx.route(/docs\.google\.com/, r => { const u = decodeURIComponent(r.request().url()); const fn = (u.match(/responseHandler:([\w$]+)/) || [])[1] || 'x';
    const tab = (u.match(/sheet=([^&]+)/) || [])[1] || ''; const table = /Km\/L/.test(tab) ? gvKml() : /R\$\/L/.test(tab) ? gvRsl() : { cols: [], rows: [] };
    r.fulfill({ status: 200, contentType: 'application/javascript', body: `${fn}(${JSON.stringify({ status: 'ok', table })})` }); });
  await ctx.route(/supabase\.co/, r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method();
    const hd = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range' };
    const js = (o, st = 200) => r.fulfill({ status: st, body: JSON.stringify(o), contentType: 'application/json', headers: hd });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...hd, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return js({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/fca_profiles')) return js({ is_admin: true });
    if (p.includes('/abast_api_base')) return js([{ sistema: 'PROFROTAS', carregado_em: '2026-10-31T09:10:00Z', erro: null }]);
    if (p.includes('/abast_api')) { const off = +(u.searchParams.get('offset') || 0), lim = Math.min(+(u.searchParams.get('limit') || 1000), 1000);
      const rg = r.request().headers()['range']; let o = off, l = lim; if (rg) { const mm = rg.match(/(\d+)-(\d+)/); o = +mm[1]; l = Math.min(+mm[2] - o + 1, 1000); }
      const cols = (u.searchParams.get('select') || '').split(','); const f = A.slice(o, o + l).map(x => Object.fromEntries(cols.map(c => [c, x[c] ?? null])));
      return r.fulfill({ status: 200, body: JSON.stringify(f), contentType: 'application/json', headers: { ...hd, 'Content-Range': `${o}-${o + f.length - 1}/${A.length}` } }); }
    if (p.includes('/consumo_auto_base')) return js({ tabela: 'ca_consumo_km_litro', linhas: KML.length, erro: null, carregado_em: '2026-10-31T09:00:00Z', resumo: { dados_ate: '2026-10-20' } });
    if (p.includes('/ca_consumo_km_litro')) { const off = +(u.searchParams.get('offset') || 0); return js(off ? [] : KML); }
    return js([]);
  });
  await ctx.addInitScript(tm => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tm); localStorage.setItem('bi_user_name', 'x');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, tema);
  const pg = await ctx.newPage(); const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(BASE + '/combustivel/postos/', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => /APIs/.test(document.getElementById('titSub').textContent), null, { timeout: 15000 });
  const itens = await pg.locator('.side .s-item[data-vw]').allTextContents();
  t(`${w}: menu com Preço e Km/L do padrão`, ['Preço', 'R$/L Detalhado', 'Preço por Veículo', 'Km/L', 'Km/L Detalhado', 'Consumo por Veículo'].every(x => itens.some(i => i.trim() === x)), itens.map(s => s.trim()).join(' · '));
  // Preço
  await pg.evaluate(() => setVw('p-resumo'));
  const fp = pg.frameLocator('#fr-preco');
  const fr = () => pg.frames().find(f => /preco-litro/.test(f.url()));
  await pg.waitForFunction(() => { const f = document.getElementById('fr-preco'); try { const d = f.contentDocument; return d && /\d/.test(d.getElementById('h-real').textContent); } catch (e) { return false; } }, null, { timeout: 20000 });
  t(`${w}: iframe do Preço com ?fonte=api&embed=1`, /preco-litro\/\?fonte=api&embed=1$/.test(await pg.getAttribute('#fr-preco', 'src')));
  const pReal = await fp.locator('#h-real').textContent(), pRem = await fp.locator('#h-rem').textContent();
  t(`${w}: Preço realizado das APIs (6,50) e remunerado da aba (6,20)`, /6,50/.test(pReal) && /6,20/.test(pRem), `${pReal} · ${pRem}`);
  t(`${w}: Preço sem a lateral e sem a moldura do painel`, await fp.locator('.side').evaluate(e => getComputedStyle(e).display === 'none') && await fp.locator('html').evaluate(e => e.classList.contains('embed')));
  t(`${w}: topo desta página escondido no Preço`, await pg.locator('.board>.top').evaluate(e => getComputedStyle(e).display === 'none'));
  t(`${w}: título do Preço diz APIs`, /APIs/.test(await fp.locator('#titSub').textContent()), await fp.locator('#titSub').textContent());
  await pg.evaluate(() => setVw('p-veiculo')); await pg.waitForTimeout(400);
  t(`${w}: Preço por Veículo abre a visão do painel`, await fp.locator('#vw-veiculo').evaluate(e => e.classList.contains('on')) && await fp.locator('#body-vei tr').count() >= 6);
  if (SHOT) { await pg.evaluate(() => setVw('p-resumo')); await pg.waitForTimeout(1200); await pg.screenshot({ path: join(SHOT, `emb-preco-${w}-${tema}.png`) }); }
  // Km/L
  await pg.evaluate(() => setVw('k-resumo'));
  await pg.waitForFunction(() => { const f = document.getElementById('fr-kml'); try { const d = f.contentDocument; return d && /\d/.test(d.getElementById('h-real').textContent); } catch (e) { return false; } }, null, { timeout: 20000 });
  const fk = pg.frameLocator('#fr-kml');
  const kReal = await fk.locator('#h-real').textContent(), kRem = await fk.locator('#h-rem').textContent();
  t(`${w}: Km/L realizado das APIs (3,00) e remunerado da aba (2,50)`, /3,00/.test(kReal) && /2,50/.test(kRem), `${kReal} · ${kRem}`);
  t(`${w}: Km/L com impacto calculado`, /\d/.test(await fk.locator('#h-imp').textContent()), await fk.locator('#h-imp').textContent());
  t(`${w}: só um iframe à vista`, await pg.locator('#fr-preco').evaluate(e => getComputedStyle(e).display === 'none'));
  const med = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, fh: Math.round(document.getElementById('fr-kml').getBoundingClientRect().height) }));
  t(`${w}: sem rolagem de página, iframe na altura toda`, !med.pag && med.fh > h - 120, JSON.stringify(med));
  if (SHOT) { await pg.waitForTimeout(1200); await pg.screenshot({ path: join(SHOT, `emb-kml-${w}-${tema}.png`) }); }
  await pg.evaluate(() => setVw('resumo'));
  t(`${w}: voltar ao Resumo devolve o topo`, await pg.locator('.board>.top').evaluate(e => getComputedStyle(e).display !== 'none'));
  t(`${w}: sem erro de página`, !erros.length, erros.join(' | '));
  await ctx.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);

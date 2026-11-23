// Rem Meta × Rem DRE: (1) a conta de assets/rem-meta.js em node:vm, com números conhecidos;
// (2) a visão da Visão Financeira no Chromium, com o banco e o gviz dublados.
// Uso: node scripts/rem-meta-teste.mjs        (SHOT_DIR=… salva os prints)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOT = process.env.SHOT_DIR || '';
let okN = 0, falhas = 0;
const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); v ? okN++ : falhas++; };
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

// ── dados: out/26 veio do banco (Insumos em linha própria); set/26 é da aba (Insumos dentro da Empurrada) ──
const FT = [
  { operacao: 'ROTA', unidade: 'CGR', vigencia: '2026-10', km_teto: 25000, comb: 32500, manut: 10000, pneu: 2500, carroc: 1250, seguro: 900, ipva: 300, lavagem: 450 },
  { operacao: 'VAN', unidade: 'CGR', vigencia: '2026-10', km_teto: 5000, comb: 4000 },
  { operacao: 'EMPURRADA', unidade: 'PIR', vigencia: '2026-10', km_teto: 300000, comb: 420000 },
  { operacao: 'INSUMOS', unidade: 'PIR', vigencia: '2026-10', km_teto: 15000, comb: 18000 },
  { operacao: 'ROTA', unidade: 'CGR', vigencia: '2026-09', km_teto: 25000, comb: 30000 },
  { operacao: 'EMPURRADA', unidade: 'PIR', vigencia: '2026-09', km_teto: 300000, comb: 420000 },
  { operacao: 'INSUMOS', unidade: 'PIR', vigencia: '2026-09', km_teto: 15000, comb: 18000 },
  { operacao: 'ARMAZEM', unidade: 'CBA', vigencia: '2026-10', km_teto: 0, comb: 7000 },
];
const kmLinha = (vig, projCod, projeto, rem, real) => { const c = Array(40).fill(null); c[0] = { v: `Date(${vig.slice(0, 4)},${+vig.slice(5) - 1},1)` }; c[14] = { v: projCod }; c[19] = { v: projeto }; c[31] = { v: rem }; c[32] = { v: real }; return { c }; };
const GVIZ_KM = { status: 'ok', table: { cols: Array.from({ length: 40 }, (_, i) => ({ label: i === 19 ? 'Projeto' : i === 14 ? 'PROJ.' : 'c' + i })), rows: [
  kmLinha('2026-10', 'ROTA - CGR', 'Rota', 20000, 22000), kmLinha('2026-10', 'ROTA (VAN) - CGR', 'Van', 4000, 4500),
  kmLinha('2026-10', 'EMPURRADA - PIR', 'Empurrada - 28 Palets', 280000, 300000), kmLinha('2026-10', 'EMPURRADA - PIR', 'Insumos', 12000, 13000),
  kmLinha('2026-09', 'ROTA - CGR', 'Rota', 21000, 22000), kmLinha('2026-09', 'EMPURRADA - PIR', 'Empurrada', 290000, 310000),
] } };

// ══ 1 · a conta (node:vm) ══
console.log('══ 1 · assets/rem-meta.js (a conta)');
const w = {}; vm.runInContext(fs.readFileSync(path.join(RAIZ, 'assets/rem-meta.js'), 'utf8'), vm.createContext({ window: w, console }));
const R = w.RemMeta;
{
  const ft = R.indexaFT(FT), km = R.indexaKm(GVIZ_KM, ['2026-10']);
  ok('km: out/26 do banco separa Insumos; set/26 da aba fica na Empurrada', km.filter(r => r.op === 'INS').length === 1 && km.find(r => r.op === 'INS').vig === '2026-10' && km.length === 6, km.map(r => r.vig.slice(5) + r.op + r.rem).join(' '));
  const c = R.calcula({ ft, km, bm: {} });
  ok('variável = R$/km do FT × km remunerado (1,30 × 20.000)', perto(c.meta['2026-10|ROTA|CGR'].comb, 26000), c.meta['2026-10|ROTA|CGR'].comb);
  ok('manutenção 0,40 × 20.000 e pneu 0,10 × 20.000', perto(c.meta['2026-10|ROTA|CGR'].manut, 8000) && perto(c.meta['2026-10|ROTA|CGR'].pneu, 2000));
  ok('fixo (seguro, IPVA, lavação fixa) = o valor do mês no FT', c.meta['2026-10|ROTA|CGR'].seguro === 900 && c.meta['2026-10|ROTA|CGR'].ipva === 300 && c.meta['2026-10|ROTA|CGR'].lav === 450);
  ok('Insumos com km próprio (mês do banco): 1,20 × 12.000', perto(c.meta['2026-10|INS|PIR'].comb, 14400) && perto(c.meta['2026-10|EMP|PIR'].comb, 392000));
  const e = c.meta['2026-09|EMP|PIR'].comb, i = c.meta['2026-09|INS|PIR'].comb, junto = (420000 + 18000) / 315000 * 290000;
  ok('Insumos dentro da Empurrada (mês da aba): as duas pagas juntas, sem contar Insumos duas vezes', perto(e + i, junto) && perto(e, junto * 420000 / 438000) && perto(i, junto * 18000 / 438000), `${e.toFixed(2)} + ${i.toFixed(2)} = ${junto.toFixed(2)}`);
  ok('sem km (Armazém): o próprio componente', c.meta['2026-10|ARM|CBA'].comb === 7000);
  const b = R.calcula({ ft, km, bm: { '2026-10|PIR': { km: 10000, valor: 1 } } });
  ok('o km do balanço de massa entra no km remunerado da Empurrada', perto(b.meta['2026-10|EMP|PIR'].comb, 1.4 * 290000), b.meta['2026-10|EMP|PIR'].comb);
  ok('meses com km e com FT', [...c.vigsKm].sort().join() === '2026-09,2026-10' && c.vigsFT.has('2026-09'));
  ok('opUni: projeto e unidade do DRE; Seara, Terceiros e Corporativo fora', R.opUni('Auto Serviço - GOI').uni === 'GNA' && R.opUni('ROTA (VAN) - BLC').op === 'VAN' && R.opUni('UDC - GRL').op === 'ROTA' && R.opUni('EMPURRADA BITREM - PIR (INATIVO)').op === 'EMP' && !R.opUni('TERCEIROS - BLC') && !R.opUni('DISTRIBUIÇÃO URBANA - ANG'));
  ok('contas do DRE por componente', R.compDe('Fluídos (Arla)') === 'comb' && R.compDe('Contratos de Manutenção Fabricante') === 'manut' && R.compDe('Recapagens e Outros Serviços') === 'pneu' && R.compDe('IPVA e Licenciamento de Veículos') === 'ipva' && R.compDe('Materiais e Ferramentas de Oficina') === null && R.compDe('ICMS Crédito Presumido') === null);
  // balanço de massa: as chaves que vão ao motor (assets/balanco-massa.js dublado)
  let visto = null;
  const B = { inicioDoBanco: () => '08/2026', comRealizado: bal => ({ bal }), recompoe: o => { visto = o; return { porChave: { '10/2026|EMPURRADA - PIR': { km: 5000, valor: 20000 } } }; }, porAno: p => ({ porChave: p[0] }) };
  const bm = R.bmKm(B, [{ unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-10', conta: 'Combustíveis Veiculos e Equipamentos', valor: 20000 }], km, { '10/2026|EMPURRADA - PIR': { COMBUSTIVEIS: 400000 } });
  ok('balanço de massa: chave MM/AAAA|EMPURRADA - UNI, conta normalizada e km de Empurrada + Insumos', visto && visto.bal['10/2026|EMPURRADA - PIR'].COMBUSTIVEIS === 20000 && visto.km0['10/2026|EMPURRADA - PIR'] === 292000 && bm['2026-10|PIR'].km === 5000, JSON.stringify(bm));
}

// ══ 2 · a visão no Chromium ══
const dre = (vig, nv3, conta, rem, real) => ({ vigencia_orig: vig + '-01', d_orc_brl: 0, d_rem_brl: 0, unidade: 'X', nivel_3: nv3, conta_gerencial: conta, mes: ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+vig.slice(5)], ano: +vig.slice(0, 4), orcado: rem, remunerado: rem, realizado: real == null ? rem : real });
const FROTA = [
  dre('2026-10', 'ROTA - CGR', 'Combustíveis Veiculos e Equipamentos', -30000), dre('2026-10', 'ROTA - CGR', 'Fluídos (Arla)', -1000),
  dre('2026-10', 'ROTA - CGR', 'Manutenção de Veículos e Equipamentos', -10000), dre('2026-10', 'ROTA - CGR', 'Pneus Novos', -2000),
  dre('2026-10', 'ROTA - CGR', 'Seguro de Veículos e Equipamentos', -1000), dre('2026-10', 'ROTA - CGR', 'Lavação de Veículos', -500),
  dre('2026-10', 'ROTA - CGR', 'Materiais e Ferramentas de Oficina', -700),
  dre('2026-10', 'EMPURRADA - PIR', 'Combustíveis Veiculos e Equipamentos', -400000), dre('2026-10', 'INSUMOS - PIR', 'Combustíveis Veiculos e Equipamentos', -20000),
  dre('2026-10', 'TERCEIROS - BLC', 'Combustíveis Veiculos e Equipamentos', -5000),
  dre('2026-09', 'ROTA - CGR', 'Combustíveis Veiculos e Equipamentos', -28000),
  dre('2026-11', 'ROTA - CGR', 'Combustíveis Veiculos e Equipamentos', -9000),   // mês sem Freightech e sem km
].map((l, i) => ({ ...l, linha: i }));
const RECEITA = [dre('2026-10', 'ROTA - CGR', 'Receita Líquida', 900000), dre('2026-09', 'ROTA - CGR', 'Receita Líquida', 880000)].map((l, i) => ({ ...l, linha: i }));
const EBITDA = [dre('2026-10', 'ROTA - CGR', 'EBITDA', 200000), dre('2026-09', 'ROTA - CGR', 'EBITDA', 190000)].map((l, i) => ({ ...l, linha: i }));

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});

async function abre({ admin = true, ft = FT, larg = 1366, alt = 768, claro = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: larg, height: alt }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ T, GVIZ_KM, admin, claro }) => {
    sessionStorage.setItem('gem_hub', '1');
    try { localStorage.removeItem('bi_cache_vf_v9'); localStorage.setItem('bi_theme', claro ? 'light' : 'dark');
      localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ user: { id: 'u1' } }));
      localStorage.setItem('gem_perfil_u1', JSON.stringify({ is_admin: admin })); } catch (e) {}
    window.__pedidos = [];
    const cli = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      from: tabela => { const q = { select() { return q; }, order() { return q; }, eq() { return q; }, gte() { return q; },
        async range(a) { window.__pedidos.push(tabela); const rows = T[String(tabela).replace(/^(sh|ca)_/, '')] || []; return { data: a > 0 ? [] : rows, error: null }; } }; return q; } };
    Object.defineProperty(window, 'supabase', { get: () => ({ createClient: () => cli }), set() {}, configurable: true });
    const orig = window.fetch;
    window.fetch = async (u, o) => { const s = String(u);
      if (s.includes('consumo_auto_base')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      if (s.includes('docs.google.com')) { const aba = decodeURIComponent((s.match(/sheet=([^&]+)/) || [])[1] || '');
        return new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(/Dispers/.test(aba) ? GVIZ_KM : { status: 'error' })});`, { status: 200 }); }
      if (s.includes('supabase.co')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      return orig(u, o); };
  }, { T: { dre_frota: FROTA, dre_receita: RECEITA, dre_ebitda: EBITDA, ft_rem_mes: ft, balanco_massa: [] }, GVIZ_KM, admin, claro });
  const SHIM_CHART = `window.ChartDataLabels={id:'datalabels'};(function(){function Chart(c,cfg){this.config=cfg;this.data=cfg.data;this.options=cfg.options||{};this.destroy=function(){};this.update=function(){};this.resize=function(){};}
    Chart.getChart=function(){return null;};Chart.register=function(){};Chart.defaults={font:{}};window.Chart=Chart;})();`;
  await page.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/javascript', body: /chart\.umd/.test(u) ? SHIM_CHART : '/*stub*/' }); });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(BASE + '/visao-financeira/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof allRows !== 'undefined' && allRows.length > 0 && !/Carregando/.test(document.getElementById('titSub').textContent), { timeout: 20000 });
  await page.waitForTimeout(300);
  return { page, ctx, errs };
}
const tabela = page => page.evaluate(() => ({
  th: [...document.querySelectorAll('#head-rm th')].map(t => t.textContent.trim()),
  tr: [...document.querySelectorAll('#body-rm tr')].map(r => [...r.children].map(c => c.textContent.trim())),
  cls: [...document.querySelectorAll('#body-rm tr')].map(r => [...r.children].map(c => c.className)),
  pe: document.getElementById('pe-rm').textContent, tit: document.getElementById('tit').textContent,
}));
const abreVisao = async page => { await page.evaluate(() => { window.GvizCache = window.GvizCache || {}; window.GvizCache.dispBanco = { vigs: ['2026-10'] }; setVw('remmeta'); });
  await page.waitForFunction(() => !/Carregando/.test(document.getElementById('body-rm').textContent), { timeout: 15000 }); await page.waitForTimeout(150); };
const F = (page, v) => page.evaluate(x => [fmt(x), fmtD(x)], v);

console.log('══ 2 · Visão Financeira · Rem Meta × Rem DRE (admin, out/26)');
{
  const { page, ctx, errs } = await abre();
  const item = await page.evaluate(() => { const b = document.getElementById('it-remmeta'); return b && getComputedStyle(b).display !== 'none'; });
  ok('o item aparece no menu para admin', item);
  await page.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); if (w._render) w._render(''); atualizar(); });
  await abreVisao(page);
  let t = await tabela(page);
  ok('título da visão e cabeçalho com mês e YTD', t.tit === 'Rem Meta × Rem DRE' && t.th.join('|') === 'COMPONENTE|REM META|REM DRE|▲|▲ %|REM META YTD|REM DRE YTD|▲ YTD|▲ YTD %', t.th.join('|'));
  const linha = n => t.tr.find(r => r[0] === n) || [];
  const [m1] = await F(page, 442600), [d1, dd1] = await F(page, 451000), [, g1] = await F(page, 8400), [y1] = await F(page, 442600 + 25200 + 438000 / 315000 * 290000), [yd1] = await F(page, 479000);
  const comb = linha('Combustível e Arla');
  ok('Combustível e Arla: Rem Meta = Rota + Van + Empurrada + Insumos + Armazém; Rem DRE = diesel + Arla', comb[1] === m1 && comb[2] === d1 && comb[3] === g1 && comb[4] === '+2%', comb.join(' · '));
  ok('YTD soma set/26 (Insumos dentro da Empurrada) e out/26', comb[5] === y1 && comb[6] === yd1, comb.slice(5).join(' · '));
  const man = linha('Manutenção de veículos e contrato'), [mm] = await F(page, 8000), [md] = await F(page, 10000);
  ok('Manutenção: 0,40 × 20.000 contra o remunerado do DRE', man[1] === mm && man[2] === md && man[4] === '+25%', man.join(' · '));
  ok('componente sem conta no DRE aparece (carroceria, IPVA) e conta sem componente fica fora', !!linha('Manutenção de carrocerias')[1] && !!linha('IPVA e licenciamento')[1] && !t.tr.some(r => /Materiais/.test(r[0])));
  const tot = t.tr[t.tr.length - 1], somaM = 442600 + 8000 + 1000 + 450 + 2000 + 900 + 300, somaD = 451000 + 10000 + 500 + 2000 + 1000;
  const [tm] = await F(page, somaM), [td] = await F(page, somaD);
  ok('linha Total = soma dos componentes; Terceiros fora', tot[0] === 'Total' && tot[1] === tm && tot[2] === td, tot.join(' · '));
  const iC = t.tr.findIndex(r => r[0] === 'Combustível e Arla'), iS = t.tr.findIndex(r => r[0] === 'Seguro');
  const iM = t.tr.findIndex(r => r[0] === 'Manutenção de carrocerias');
  ok('DRE acima da meta em verde, abaixo em vermelho', /cg/.test(t.cls[iC][3]) && /cg-t/.test(t.cls[iC][4]) && /cr/.test(t.cls[iM][3]) && /cr-t/.test(t.cls[iM][4]), t.cls[iC][3] + ' · ' + t.cls[iM][3]);
  ok('seguro: DRE 1.000 contra meta 900 (verde); lavação 500 contra 450', /cg/.test(t.cls[iS][3]) && linha('Lavação')[4] === '+11%', linha('Seguro').join(' · '));
  ok('a nota fica embaixo, diz o mês, o YTD, que é reconstruído e avisa do balanço e da Van', /Mês: out\/26 · YTD: set\/26, out\/26\./.test(t.pe) && /não é a fatura/.test(t.pe) && /Balanço de massa sem leitura/.test(t.pe) && /Van que o DRE lança dentro da Rota/.test(t.pe), t.pe.slice(0, 60));
  // dimensões
  await page.evaluate(() => setRmDim('uni')); t = await tabela(page);
  const [cgr] = await F(page, 29200 + 8000 + 1000 + 450 + 2000 + 900 + 300), [pir] = await F(page, 392000 + 14400);
  ok('por Unidade: CGR e PIR (o Armazém de Cuiabá só tem meta)', t.th[0] === 'UNIDADE' && (t.tr.find(r => r[0] === 'CGR') || [])[1] === cgr && (t.tr.find(r => r[0] === 'PIR') || [])[1] === pir, t.tr.map(r => r[0] + ' ' + r[1]).join(' · '));
  await page.evaluate(() => setRmDim('proj')); t = await tabela(page);
  ok('por Projeto: a Van sem linha no DRE entra na Rota; Insumos separado no mês do banco', t.tr.some(r => r[0] === 'ROTA') && !t.tr.some(r => r[0] === 'ROTA (VAN)') && t.tr.some(r => r[0] === 'INSUMOS') && t.tr.some(r => r[0] === 'EMPURRADA'), t.tr.map(r => r[0]).join(' · '));
  await page.evaluate(() => setRmDim('uniproj')); t = await tabela(page);
  ok('Unidade - Projeto em DUAS colunas', t.th[0] === 'UNIDADE' && t.th[1] === 'PROJETO' && t.tr.some(r => r[0] === 'PIR' && r[1] === 'INSUMOS') && t.tr[t.tr.length - 1][0] === 'Total', t.tr.map(r => r[0] + '/' + r[1]).join(' · '));
  // filtros do topo
  await page.evaluate(() => { setRmDim('comp'); const w = document.getElementById('ms-uni'); w._sel = new Set(['PIR']); if (w._render) w._render(''); atualizar(); });
  t = await tabela(page); const [mp] = await F(page, 406400), [dp] = await F(page, 420000);
  ok('filtro Unidade = PIR vale nos dois lados', (t.tr.find(r => r[0] === 'Combustível e Arla') || [])[1] === mp && (t.tr.find(r => r[0] === 'Combustível e Arla') || [])[2] === dp && t.tr.length === 2, t.tr.map(r => r.slice(0, 3).join(' ')).join(' · '));
  await page.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel = new Set(); if (w._render) w._render(''); const p = document.getElementById('ms-pac'); p._sel = new Set(['Pneus']); if (p._render) p._render(''); atualizar(); });
  t = await tabela(page);
  ok('filtro Pacote = Pneus deixa só o componente de pneus', t.tr.length === 2 && t.tr[0][0] === 'Pneus e recapagens', t.tr.map(r => r[0]).join(' · '));
  await page.evaluate(() => { const p = document.getElementById('ms-pac'); p._sel = new Set(); if (p._render) p._render(''); const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-11']); if (w._render) w._render(''); atualizar(); });
  t = await tabela(page);
  { const c = t.tr.find(r => r[0] === 'Combustível e Arla') || [];
    ok('mês sem Freightech e sem km não é comparado: colunas do mês zeradas, YTD até o último mês comparável e a nota avisa', c[1] === '0' && c[2] === '0' && c[5] === y1 && /Mês: sem mês/.test(t.pe) && /nov\/26/.test(t.pe), c.join(' · ')); }
  await page.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10', '2026-11']); if (w._render) w._render(''); atualizar(); });
  t = await tabela(page);
  ok('com out e nov marcados entra só outubro e a nota diz o que ficou fora', (t.tr.find(r => r[0] === 'Combustível e Arla') || [])[1] === m1 && /Fora por falta de Freightech ou de km remunerado: nov\/26\./.test(t.pe), t.pe.slice(-140));
  ok('nenhum erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log('══ 3 · tela: sem rolagem e sem barra na tabela');
for (const [larg, alt, claro] of [[1366, 768, false], [1600, 900, true], [1920, 1080, false]]) {
  const { page, ctx, errs } = await abre({ larg, alt, claro });
  await page.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); atualizar(); });
  await abreVisao(page); await page.evaluate(() => setRmDim('uniproj'));
  const m = await page.evaluate(() => { const w = document.querySelector('#vw-remmeta .twrap'), a = document.querySelector('.app').getBoundingClientRect(), c = document.querySelector('#vw-remmeta .card').getBoundingClientRect();
    return { doc: document.documentElement.scrollHeight <= innerHeight + 1, lateral: w.scrollWidth <= w.clientWidth + 1, dentro: c.bottom <= a.bottom + 1 && c.right <= a.right + 1, on: document.getElementById('vw-remmeta').classList.contains('on') }; });
  ok(`${larg}×${alt} ${claro ? 'claro' : 'escuro'}: página sem rolagem, tabela sem barra lateral, card dentro da moldura`, m.doc && m.lateral && m.dentro && m.on && !errs.length, JSON.stringify(m));
  if (SHOT) await page.screenshot({ path: path.join(SHOT, `rem-meta-${larg}${claro ? '-claro' : ''}.png`) });
  await ctx.close();
}
console.log('══ 4 · quem não é admin e Freightech sem leitura');
{
  const a = await abre({ admin: false });
  const some = await a.page.evaluate(() => getComputedStyle(document.getElementById('it-remmeta')).display === 'none');
  ok('sem admin o item não aparece e nada do Freightech é pedido', some && !(await a.page.evaluate(() => window.__pedidos.includes('ft_rem_mes'))));
  await a.ctx.close();
  const b = await abre({ ft: [] });
  await b.page.evaluate(() => setVw('remmeta')); await b.page.waitForFunction(() => !/Carregando/.test(document.getElementById('body-rm').textContent), { timeout: 15000 });
  const txt = await b.page.evaluate(() => document.getElementById('body-rm').textContent);
  ok('Freightech vazio vira mensagem, não tabela zerada', /Não deu para montar o Rem Meta/.test(txt) && /Freightech/.test(txt), txt.slice(0, 90));
  ok('sem erro de página', !b.errs.length, b.errs.join(' | '));
  await b.ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${okN} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

// KM · Seara — o mês EM ABERTO fica fora do painel (Renan, 17/11/2026, vendo
// nov/26 em −78%: "Ainda essa merda?" → "acho que tire novembro").
//
// Abre o /seara-km/ com o gviz e o banco dublados, em cinco cenários:
//  1. sem consumo automático → o mês sem a aba Remunerado usa o mês anterior INTEIRO (como era);
//  2. consumo automático com corte em 10/10 e a aba sem outubro → outubro não entra
//     (nem nas linhas, nem no filtro de vigência) e o painel abre em setembro;
//  3. o mesmo, mas a aba Remunerado JÁ tem outubro → outubro entra com a aba;
//  4. segunda carga (cache) continua sem outubro;
//  5. o corte do ERP passou para novembro → outubro (fechado) entra com o mês
//     anterior inteiro e novembro fica fora.
// Uso: RAIZ=<repo> node scripts/seara-km-mes-aberto-teste.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || process.cwd();
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

const COLS_BREM = ['Vigencia','CnpjUnidade','NomeUnidade','Placa','Chassi','ModeloVeiculo','CapacidadeCarga','TipoEquipamento','EmpresaLocadora','Aluguel','Ravex','Manobrista','Custo Fixo','TotalReaisPorKm','ReaisPorKm','KmPorLitro','TipoCombustivel','PrecoDiesel'];
const brem = (vig, placa, rsKm) => { const r = Array(COLS_BREM.length).fill(null); r[0] = vig; r[3] = placa; r[5] = 'VW/11.180 DRC 4X2'; r[14] = rsKm; return r; };
const BREM = ['09/2026', '10/2026'].flatMap(v => [brem(v, 'SAA1A11', 2.0), brem(v, 'SAB1A12', 2.0)]);
const COLS_COMB = ['Pode começa','Empresa','Projeto','Unidade','Placa','Mês Inicio OS','Ano Inicio OS','Modelo','Tipo Combustivel','Tipo Veiculo','KM Rodado','QTD Total de Litros','Valor Médio Litro','TOTAS R$'];
const comb = (placa, mes, km) => [null, 'SEARA', 'ROTA', 'ANHANGUERA', placa, mes, 2026, 'VW/11.180 DRC 4X2', 'DIESEL S10', 'CAMINHAO BAU', km, km / 4, null, km * 2];
const COMB = [comb('SAA1A11', 'set', 3000), comb('SAB1A12', 'set', 2000), comb('SAA1A11', 'out', 1000), comb('SAB1A12', 'out', 700)];
const COMB_NOV = [...COMB, comb('SAA1A11', 'nov', 300)];
const REMU_SET = [['09/2026', 'SAA1A11', 2800], ['09/2026', 'SAB1A12', 1900]];
const REMU_OUT = [...REMU_SET, ['10/2026', 'SAA1A11', 900], ['10/2026', 'SAB1A12', 800]];
const AUTO = [{ linhas: 4, erro: null, carregado_em: '2026-10-12T09:00:00Z', resumo: { dados_ate: '2026-10-10' } }];
const AUTO_NOV = [{ linhas: 5, erro: null, carregado_em: '2026-11-05T09:00:00Z', resumo: { dados_ate: '2026-11-03' } }];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
async function abre({ remu, auto, limpa = true, combs = COMB }) {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ COMB, BREM, COLS_COMB, COLS_BREM, remu, auto, limpa }) => {
    if (limpa) localStorage.clear();
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_user_name', 'Teste');
    const corpo = u => /gid=1982300845/.test(u) ? { rows: COMB, cols: COLS_COMB }
      : /gid=0\b/.test(u) ? { rows: BREM, cols: COLS_BREM }
      : /sheet=Remunerado/.test(u) ? { rows: remu, cols: ['Vigência', 'Placa', 'KM'] } : { rows: [], cols: ['A'] };
    window.__respGviz = u => { const { rows, cols } = corpo(u);
      return JSON.stringify({ status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => (v == null ? null : { v })) })) } }); };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com')) return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${window.__respGviz(s)});`, { status: 200 }));
      if (s.includes('/rest/v1/consumo_auto_base') && /slug=eq\.seara_combustivel/.test(s) && /resumo/.test(s)) return Promise.resolve(new Response(JSON.stringify(auto || []), { status: 200 }));
      if (s.startsWith(location.origin)) return real(u, i);
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = window.__respGviz(n.src);
        setTimeout(() => { if (fn && window[fn]) window[fn](JSON.parse(body)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
    window.prompt = () => 'Teste';
  }, { COMB: combs, BREM, COLS_COMB, COLS_BREM, remu, auto, limpa });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=window.Chart||function(){return{destroy(){},update(){},data:{datasets:[]}}};Chart.register=()=>{};Chart.defaults={font:{},plugins:{legend:{},tooltip:{}}};window.ChartDataLabels={};' }));
  await page.goto(BASE + '/seara-km/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { page, errs };
}
const le = page => page.evaluate(() => ({
  m: Object.fromEntries(ALL.map(r => [r.placa + '|' + r.vig, { rem: r.rem, imp: r.imp, fb: !!r.remFb }])),
  vigs: [...new Set(ALL.map(r => r.vig))].sort(),
  opts: [...document.querySelectorAll('#ms-vig .ms-opt:not(.all-opt) input')].map(i => i.value || i.dataset.v || ''),
  txtOpts: document.getElementById('ms-vig').textContent,
  aviso: document.getElementById('k-rem-m').textContent, vig: [...document.getElementById('ms-vig')._sel] }));

console.log('\n══ 1 · sem consumo automático: mês anterior inteiro');
{ const { page, errs } = await abre({ remu: REMU_SET, auto: [] }); const r = await le(page);
  af('out/26 usa o remunerado de set/26 inteiro', near(r.m['SAA1A11|10/2026'].rem, 2800) && near(r.m['SAB1A12|10/2026'].rem, 1900), JSON.stringify(r.m['SAA1A11|10/2026']));
  af('aviso do mês anterior', /out\/26 sem a aba Remunerado/.test(r.aviso), r.aviso);
  af('sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

console.log('\n══ 2 · consumo automático, corte em 10/10, aba sem outubro: outubro fora');
{ const { page, errs } = await abre({ remu: REMU_SET, auto: AUTO }); const r = await le(page);
  af('nenhuma linha de out/26', !r.vigs.includes('10/2026') && r.vigs.includes('09/2026'), r.vigs.join(' '));
  af('o filtro de vigência não lista outubro', !/out\/?\s*(20)?26|10\/2026/i.test(r.txtOpts), r.txtOpts.replace(/\s+/g, ' ').slice(0, 80));
  af('o painel abre em set/26', r.vig.length === 1 && r.vig[0] === '09/2026', r.vig.join(' '));
  af('setembro (com a aba) não muda', near(r.m['SAA1A11|09/2026'].rem, 2800) && !r.m['SAA1A11|09/2026'].fb, JSON.stringify(r.m['SAA1A11|09/2026']));
  af('sem aviso de mês emprestado', /total do período filtrado/.test(r.aviso), r.aviso);
  af('sem erro de página', errs.length === 0, errs[0] || '');
  console.log('\n══ 4 · segunda carga, do cache');
  await page.close();
  const b = await abre({ remu: REMU_SET, auto: AUTO, limpa: false }); const r2 = await le(b.page);
  af('cache continua sem outubro', !r2.vigs.includes('10/2026') && r2.vig[0] === '09/2026', r2.vigs.join(' '));
  await b.page.close(); }

console.log('\n══ 3 · a aba Remunerado já tem outubro: outubro entra com a aba');
{ const { page, errs } = await abre({ remu: REMU_OUT, auto: AUTO }); const r = await le(page);
  af('out/26 = o que está na aba', r.m['SAA1A11|10/2026'] && near(r.m['SAA1A11|10/2026'].rem, 900) && !r.m['SAA1A11|10/2026'].fb, JSON.stringify(r.m['SAA1A11|10/2026']));
  af('o painel abre em out/26', r.vig[0] === '10/2026', r.vig.join(' '));
  af('sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

console.log('\n══ 5 · o corte passou para novembro: outubro entra, novembro fica fora');
{ const { page, errs } = await abre({ remu: REMU_SET, auto: AUTO_NOV, combs: COMB_NOV }); const r = await le(page);
  af('out/26 (fechado) entra com o mês anterior inteiro', r.m['SAA1A11|10/2026'] && near(r.m['SAA1A11|10/2026'].rem, 2800) && r.m['SAA1A11|10/2026'].fb, JSON.stringify(r.m['SAA1A11|10/2026']));
  af('nov/26 (em aberto) fica fora', !r.vigs.includes('11/2026'), r.vigs.join(' '));
  af('o painel abre em out/26, com o aviso do mês anterior', r.vig[0] === '10/2026' && /out\/26 sem a aba Remunerado/.test(r.aviso), r.vig.join(' ') + ' · ' + r.aviso);
  af('sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

await browser.close(); srv.close();
console.log(`\n${falhas ? '✗' : '✓'} ${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

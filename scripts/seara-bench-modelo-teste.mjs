// Seara — placa fora da Base Remunerado recebe o remunerado MÉDIO DO MODELO
// (Renan, 13/10/2026: "use a base de preventivas para pegar modelo e trazer").
//
// Abre os quatro painéis que leem a Base Remunerado (Km/L Seara, R$/L Seara,
// Árvore Seara e Painel KM · Seara) com o gviz e o banco dublados:
//  · NOVA1 (VW 11.180, fora da Base Remunerado, fora da base das preventivas)
//    → modelo pela aba Combustível → média das 11.180 da vigência;
//  · NOVA2 (na base das preventivas como 17.190, mas a Combustível diz 11.180)
//    → vale a base das preventivas → média das 17.190;
//  · NOVA3 (modelo que ninguém tem) → continua sem remunerado (0);
//  · placa que ESTÁ na Base Remunerado → o valor dela, sem mexer.
// Uso: RAIZ=<repo> node scripts/seara-bench-modelo-teste.mjs
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

// Base Remunerado com as colunas reais (A vigência, D placa, F modelo, O R$/km, P Km/L, R preço)
const COLS_BREM = ['Vigencia','CnpjUnidade','NomeUnidade','Placa','Chassi','ModeloVeiculo','CapacidadeCarga','TipoEquipamento','EmpresaLocadora','Aluguel','Ravex','Manobrista','Custo Fixo','TotalReaisPorKm','ReaisPorKm','KmPorLitro','TipoCombustivel','PrecoDiesel'];
const brem = (vig, placa, mod, rsKm, kml, pr) => { const r = Array(COLS_BREM.length).fill(null); r[0] = vig; r[3] = placa; r[5] = mod; r[14] = rsKm; r[15] = kml; r[17] = pr; return r; };
const BREM = [];
for (const v of ['08/2026', '09/2026']) {
  BREM.push(brem(v, 'SAA1A11', 'VW/11.180 DRC 4X2', 2.0, 4.0, 7.5));
  BREM.push(brem(v, 'SAB1A12', 'VW/11.180 DRC 4X2', 2.2, 4.2, 7.7));   // média 11.180: R$/km 2,1 · Km/L 4,1 · R$/L 7,6
  BREM.push(brem(v, 'SCC3C33', '17.190 CRM 4X2', 3.0, 2.99, 7.4));      // 17.190: R$/km 3 · Km/L 2,99 · R$/L 7,4
}
const COLS_COMB = ['Pode começa','Empresa','Projeto','Unidade','Placa','Mês Inicio OS','Ano Inicio OS','Modelo','Tipo Combustivel','Tipo Veiculo','KM Rodado','QTD Total de Litros','Valor Médio Litro','TOTAS R$'];
const comb = (placa, mod, km, lit) => [null, 'SEARA', 'ROTA', 'ANHANGUERA', placa, 'set', 2026, mod, 'DIESEL S10', 'CAMINHAO BAU', km, lit, null, lit * 7];
const COMB = [comb('SAA1A11', 'VW/11.180 DRC 4X2', 3000, 750), comb('SAB1A12', 'VW/11.180 DRC 4X2', 2000, 500), comb('SCC3C33', 'VW 17.190', 2500, 900),
  comb('NOVA111', 'VW 11.180', 1500, 400), comb('NOVA222', 'VW 11.180', 1200, 300), comb('NOVA333', 'IVECO DAILY', 900, 120)];
const REMU = [['09/2026', 'SAA1A11', 2800], ['09/2026', 'SAB1A12', 1900], ['09/2026', 'SCC3C33', 2400], ['09/2026', 'NOVA111', 1000], ['09/2026', 'NOVA222', 1000], ['09/2026', 'NOVA333', 800]];
const PREV = [{ placa: 'SAA1A11', modelo: 'VW/11.180 DRC 4X2' }, { placa: 'SAB1A12', modelo: 'VW/11.180 DRC 4X2' },
  { placa: 'SCC3C33', modelo: '17.190 CRM 4X2' }, { placa: 'NOVA222', modelo: '17.190 CRM 4X2' }];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
async function abre(url, banco = true) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ COMB, BREM, COLS_COMB, COLS_BREM, REMU, PREV, banco }) => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_user_name', 'Teste');
    const corpo = u => /gid=1982300845/.test(u) ? { rows: COMB, cols: COLS_COMB }
      : /gid=0\b/.test(u) ? { rows: BREM, cols: COLS_BREM }
      : /sheet=Remunerado/.test(u) ? { rows: REMU, cols: ['Vigência', 'Placa', 'KM'] } : { rows: [], cols: ['A'] };
    window.__respGviz = u => { const { rows, cols } = corpo(u);
      return JSON.stringify({ status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => (v == null ? null : { v })) })) } }); };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com')) return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${window.__respGviz(s)});`, { status: 200 }));
      if (s.includes('/rest/v1/ativos_manual')) return Promise.resolve(banco ? new Response(JSON.stringify(PREV), { status: 200 }) : new Response('erro', { status: 500 }));
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
  }, { COMB, BREM, COLS_COMB, COLS_BREM, REMU, PREV, banco });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=window.Chart||function(){return{destroy(){},update(){},data:{datasets:[]}}};Chart.register=()=>{};Chart.defaults={font:{},plugins:{legend:{},tooltip:{}}};window.ChartDataLabels={};' }));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { page, errs };
}
const near = (a, b) => Math.abs(a - b) < 1e-6;

for (const banco of [true, false]) {
  console.log(`\n══ base das preventivas ${banco ? 'respondendo' : 'FORA (vale o modelo da Combustível)'}`);
  // NOVA222: com o banco é 17.190 (preventivas); sem banco, 11.180 (Combustível)
  const n2 = banco ? { kml: 2.99, pr: 7.4, rk: 3.0 } : { kml: 4.1, pr: 7.6, rk: 2.1 };

  { const { page, errs } = await abre('/combustivel/seara/eficiencia/index.html', banco);
    const m = await page.evaluate(() => Object.fromEntries(allRows.map(r => [r[CL.placa], r[CL.rem]])));
    af('Km/L: placa da base fica com o próprio valor', near(m.SAA1A11, 4.0) && near(m.SCC3C33, 2.99), JSON.stringify(m));
    af('Km/L: NOVA111 (fora das duas bases) = média 11.180 pela Combustível', near(m.NOVA111, 4.1), m.NOVA111);
    af(`Km/L: NOVA222 = ${banco ? 'média 17.190 (base das preventivas vence)' : 'média 11.180 (Combustível)'}`, near(m.NOVA222, n2.kml), m.NOVA222);
    af('Km/L: modelo que ninguém tem segue sem remunerado', m.NOVA333 === 0, m.NOVA333);
    const mk = await page.evaluate(() => [...new Set(allRows.map(r => r[CL.modelo]))].sort());
    af('Km/L: um nome por modelo', mk.join('|') === 'IVECO DAILY|VW 17.190|VW/11.180 DRC 4X2', mk.join(' | '));
    af('Km/L: sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

  { const { page, errs } = await abre('/combustivel/seara/preco-litro/index.html', banco);
    const m = await page.evaluate(() => Object.fromEntries(allRows.map(r => [r[CL.placa], r[CL.preco]])));
    af('R$/L: placa da base com o próprio valor; NOVA111 = média 11.180', near(m.SAA1A11, 7.5) && near(m.NOVA111, 7.6), JSON.stringify(m));
    af('R$/L: NOVA222 pela regra do modelo; NOVA333 sem remunerado', near(m.NOVA222, n2.pr) && m.NOVA333 === 0);
    af('R$/L: sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

  { const { page, errs } = await abre('/combustivel/seara/arvore/index.html', banco);
    const m = await page.evaluate(() => Object.fromEntries(ALL.map(r => [r.placa, [r.kmL, r.preco]])));
    af('Árvore: NOVA111 = média 11.180 (Km/L e R$/L)', m.NOVA111 && near(m.NOVA111[0], 4.1) && near(m.NOVA111[1], 7.6), JSON.stringify(m));
    af('Árvore: NOVA222 pela regra do modelo; NOVA333 sem remunerado; base intacta', near(m.NOVA222[0], n2.kml) && m.NOVA333[0] === 0 && near(m.SCC3C33[0], 2.99));
    af('Árvore: sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }

  { const { page, errs } = await abre('/seara-km/index.html', banco);
    const m = await page.evaluate(() => Object.fromEntries(ALL.map(r => [r.placa, r.imp])));
    // impacto = (real − rem) × R$/km
    af('KM Seara: placa da base com o próprio R$/km', near(m.SAA1A11, (3000 - 2800) * 2.0), JSON.stringify(m));
    af('KM Seara: NOVA111 = (1500 − 1000) × R$/km médio 11.180', near(m.NOVA111, 500 * 2.1), m.NOVA111);
    af('KM Seara: NOVA222 pela regra do modelo; NOVA333 com impacto 0', near(m.NOVA222, 200 * n2.rk) && m.NOVA333 === 0, `${m.NOVA222} · ${m.NOVA333}`);
    const mods = await page.evaluate(() => [...new Set(ALL.map(r => r.proj))].sort());
    af('KM Seara: "VW/11.180 DRC 4X2" e "VW 11.180" viram um modelo só', mods.join('|') === 'IVECO DAILY|VW 17.190|VW/11.180 DRC 4X2', mods.join(' | '));
    const th = await page.evaluate(() => [...document.querySelectorAll('#tbl-km thead th')].map(t => t.classList.contains('sep-imp')));
    af('KM Seara: filete separa o mês do YTD (antes do Δ YTD)', th.indexOf(true) === 6 && th.filter(Boolean).length === 1, JSON.stringify(th));
    af('KM Seara: sem erro de página', errs.length === 0, errs[0] || ''); await page.close(); }
}
await browser.close(); srv.close();
console.log(`\n${falhas ? '✗' : '✓'} ${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

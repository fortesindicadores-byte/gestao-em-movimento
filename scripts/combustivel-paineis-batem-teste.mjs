// Os números BATEM entre os painéis de combustível da Ambev (Renan, 13/10/2026:
// "os valores precisam bater entre os painéis (R$/L, Km/L e Árvore)").
//
// Abre o Eficiência Km/L, o Preço R$/L e a Árvore de Combustível com a MESMA aba
// Km/L e a MESMA aba R$/L (gviz dublado) e, para cada recorte, compara:
//  · Km/L rem e real da Árvore = os do painel Km/L (aggRows de lá);
//  · R$/L rem e real da Árvore = os do painel R$/L;
//  · Impacto Preço · R$/L da Árvore = o Impacto do painel R$/L;
//  · Impacto Km/L da Árvore = o Impacto do painel Km/L (sinal trocado: na árvore
//    positivo = custou a mais).
// Em dois cenários: SEM a Dispersão de km do mês (o caso do print de set/26) e COM.
// Uso: RAIZ=<repo> node scripts/combustivel-paineis-batem-teste.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || process.cwd();
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── aba Km/L com os rótulos reais, placa a placa ── */
const COLS = ['Vigência','R$/km Rem','R$/km Real','Δ R$/km','KM/l Rem Médio','Km/l Rem Modelo','Km/L Real','Δ Km/l',
  'R$/L Rem','R$/L/Real','Δ R$/L','Ativo','Operação','Empresa','Projeto','Unidade','Placa','Mês Inicio OS','Ano Inicio OS',
  'Modelo','Tipo Combustivel','Tipo Veiculo','KM Rodado / Horas trabalhadas','QTD Total de Litros','Valor Médio Litro','TOTAS R$'];
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BASEK = { ROTA: 3.0, VAN: 7.0, EMPURRADA: 2.1 };
const UNIS = { GRL: ['ROTA', 'VAN'], PIR: ['EMPURRADA', 'ROTA'], CBA: ['EMPURRADA', 'ROTA', 'VAN'], MCC: ['ROTA'] };
const FROTA = []; let np = 1000;
for (const [uni, projs] of Object.entries(UNIS)) for (const proj of projs) for (let i = 0; i < 6; i++)
  FROTA.push({ uni, proj, placa: 'R' + String.fromCharCode(65 + (np % 26)) + 'X' + (np++), base: BASEK[proj], ativo: i === 5 ? 'FALSO' : 'VERDADEIRO' });
const D = (y, m) => `Date(${y},${m - 1},1)`;
const KML = { cols: COLS, rows: [] };
for (let m = 7; m <= 9; m++) for (const v of FROTA) {
  const km = Math.round(2500 + rnd() * 6000), real = +(v.base * (0.85 + rnd() * 0.3)).toFixed(2);
  const rem = +(v.base * (0.97 + rnd() * 0.06)).toFixed(2), lit = Math.round(km / real), rsL = +(5.6 + rnd() * 0.6).toFixed(3);
  KML.rows.push([D(2026, m), 0, 0, 0, rem, rem, real, 0, 0, rsL, 0, v.ativo, 'AMBEV', 'CONLOG', `${v.proj} - ${v.uni}`, v.uni, v.placa, '', '',
    'VW 17.190', 'DIESEL S10', 'CAMINHAO', km, lit, rsL, +(lit * rsL).toFixed(2)]);
}
// R$/L remunerado por projeto/vigência — sem VAN (cai no ROTA da unidade)
const RSL = { cols: ['Unidade Benner', 'Vigência', 'PrecoOperadora', 'TipoCombustivel'], rows: [] };
for (let m = 7; m <= 9; m++) for (const [uni, projs] of Object.entries(UNIS)) for (const p of projs) if (p !== 'VAN')
  RSL.rows.push([`${p} - ${uni}`, D(2026, m), +(5.7 + (m % 3) * 0.05 + (p === 'EMPURRADA' ? 0.04 : 0)).toFixed(3), 'DIESEL S10']);
// DRE (Frota) e Dispersão de km: com e sem setembro
function dre(comSet) {
  const FR = { cols: ['Vigência', 'Orçado', 'Remunerado', 'Realizado', 'Nível 3', 'Conta Gerencial'], rows: [] };
  const DP = { cols: ['Vigência', 'Unidade', 'PROJ. - COD', 'Km Rem. TT', 'Km Rodado TT', 'Viagens - Real', 'Viagens Rec. Real', 'Viagens Noturnas Real', 'Viagens Mapa Aberto'], rows: [] };
  for (let m = 7; m <= 9; m++) for (const [uni, projs] of Object.entries(UNIS)) for (const p of projs) {
    const n3 = (p === 'VAN' ? 'ROTA (VAN)' : p) + ' - ' + uni;
    FR.rows.push([D(2026, m), -100000, -90000 - m * 1000, -97000 - m * 900, n3, 'Combustíveis Veiculos e Equipamentos']);
    if (m < 9 || comSet) DP.rows.push([D(2026, m), uni, n3, 30000 + m * 100, 32000 + m * 150, 150, 10, 5, 3]);
  }
  return { FR, DP };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
async function abre(url, abas) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ abas }) => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_user_name', 'Teste');
    // sem banco: o painel Km/L cai na planilha (o mesmo dado das outras abas)
    window.supabase = { createClient: () => ({ from: () => { const q = { select() { return q; }, order() { return q; }, range() { return q; }, eq() { return q; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); }, then(r, j) { return Promise.resolve({ data: [], error: null }).then(r, j); } }; return q; } }) };
    const corpo = u => { const s = decodeURIComponent(u).replace(/\+/g, ' '); const m = s.match(/sheet=([^&]+)/); const nome = m ? m[1] : '';
      return abas[nome] || { cols: ['A'], rows: [] }; };
    const resp = u => { const { cols, rows } = corpo(u); return { status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => ({ v })) })) } }; };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => { const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com')) return Promise.resolve(new Response(`google.visualization.Query.setResponse(${JSON.stringify(resp(s))});`, { status: 200 }));
      if (s.startsWith(location.origin)) return real(u, i);
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })); };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        setTimeout(() => { if (fn && window[fn]) window[fn](resp(n.src)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { abas });
  await page.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=window.Chart||function(){return{destroy(){},update(){},data:{datasets:[]},options:{}}};Chart.register=()=>{};Chart.defaults={font:{},plugins:{legend:{},tooltip:{}}};window.ChartDataLabels={};' }));
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { page, errs };
}

const RECORTES = [['GRL · set/26', ['GRL'], [9]], ['todas as unidades · set/26', [], [9]], ['PIR · jul a set/26', ['PIR'], [7, 8, 9]], ['CBA + MCC · ago/26', ['CBA', 'MCC'], [8]]];
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

for (const comSet of [false, true]) {
  console.log(`\n══ ${comSet ? 'COM' : 'SEM'} a Dispersão de km de set/26`);
  const { FR, DP } = dre(comSet);
  const abas = { 'Km/L': KML, 'R$/L': RSL, 'Frota': FR, 'Dispersão de km': DP, 'Balanço de Massa': { cols: ['Unidade', 'Vigência', 'Valor', 'Valor 85%'], rows: [] } };
  const K = await abre('/combustivel/eficiencia-kml/index.html', abas);
  const R = await abre('/combustivel/preco-litro/index.html', abas);
  const A = await abre('/combustivel/arvore-combustivel/index.html', abas);
  for (const [nome, unis, meses] of RECORTES) {
    const k = await K.page.evaluate(({ unis, meses }) => {
      const rows = allRows.filter(r => { const d = _pvK(r[CL.vig]); return d && meses.includes(d.getMonth() + 1) && (!unis.length || unis.includes(getUni(r))); });
      const a = aggRows(rows); return { rem: a.remAvg, real: a.realWt, imp: impactoSomaUni(rows), n: rows.length };
    }, { unis, meses });
    const r = await R.page.evaluate(({ unis, meses }) => {
      const rows = allRows.filter(x => { const d = parseVig(x[CL.vig]); return d && meses.includes(d.getMonth() + 1) && (!unis.length || unis.includes(getUni(x))); });
      const a = aggRows(rows); return { rem: a.remAvg, real: a.realWt, imp: calcImpacto(a), n: rows.length };
    }, { unis, meses });
    const t = await A.page.evaluate(({ unis, meses }) => {
      const d = calcular({ ano: [], vigencia: meses.map(m => String(m).padStart(2, '0') + '/2026'), unidade: unis, nivel3: [] });
      const b = ArvImpacto.calc(d);
      return { kmLRem: d.kmLRem, kmLReal: d.kmLReal, rsLRem: d.rsLRem, rsLReal: d.rsLReal, preco: b.preco, efic: b.efic, semDisp: !!b.semDisp, dif: b.dif, rsKm: b.rsKm };
    }, { unis, meses });
    const semDispEsperado = !comSet && meses.length === 1 && meses[0] === 9;
    af(`${nome}: Km/L rem e real iguais ao painel Km/L (${k.rem?.toFixed(3)} · ${k.real?.toFixed(3)})`, near(t.kmLRem, k.rem, 1e-9) && near(t.kmLReal, k.real, 1e-9), `${t.kmLRem} · ${t.kmLReal}`);
    af(`${nome}: R$/L rem e real iguais ao painel R$/L (${r.rem?.toFixed(3)} · ${r.real?.toFixed(3)})`, near(t.rsLRem, r.rem, 1e-9) && near(t.rsLReal, r.real, 1e-9), `${t.rsLRem} · ${t.rsLReal}`);
    af(`${nome}: Impacto Preço · R$/L = o do painel R$/L (${Math.round(r.imp)})`, near(t.preco, r.imp, 0.01), t.preco);
    af(`${nome}: Impacto Km/L = o do painel Km/L com o sinal da árvore (${Math.round(-k.imp)})`, near(t.efic, -k.imp, 0.01), t.efic);
    if (semDispEsperado) af(`${nome}: sem Dispersão → impactos calculados mesmo assim, volume/R$/km vazios`, t.semDisp && t.rsKm == null);
    else af(`${nome}: com Dispersão → a ponte fecha (Preço + Eficiência + Diferença = R$/km)`, !t.semDisp && near(t.preco + t.efic + t.dif, t.rsKm, 0.01));
  }
  // o que a TELA da árvore mostra no recorte padrão (última vigência, todas as unidades)
  const tela = await A.page.evaluate(() => ({ rsl: document.getElementById('v-impRsL').textContent, kml: document.getElementById('v-impKmL').textContent,
    rk: document.getElementById('v-impPreco').textContent, vol: document.getElementById('v-impVolume').textContent, diag: document.getElementById('arvDiag').textContent }));
  af(`tela: caixas de Preço e Km/L preenchidas (${tela.rsl} · ${tela.kml})`, /\d/.test(tela.rsl) && /\d/.test(tela.kml));
  if (!comSet) af('tela: sem Dispersão, R$/km e Volume ficam "—" e o diagnóstico diz o que falta', tela.rk === '—' && tela.vol === '—' && /Dispersão de km ainda não tem km/.test(tela.diag), `${tela.rk} · ${tela.vol}`);
  else af('tela: com Dispersão, R$/km e Volume com número', /\d/.test(tela.rk) && /\d/.test(tela.vol));
  for (const [n, p] of [['Km/L', K], ['R$/L', R], ['Árvore', A]]) { af(`${n}: sem erro de página`, p.errs.length === 0, p.errs[0] || ''); await p.page.close(); }
}
await browser.close(); srv.close();
console.log(`\n${falhas ? '✗' : '✓'} ${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

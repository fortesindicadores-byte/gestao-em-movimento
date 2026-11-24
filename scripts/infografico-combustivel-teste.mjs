// ============================================================================
// Combustível · Infográfico (/infografico/combustivel/) — conferência no Chromium.
// A página nova tem de mostrar os MESMOS números dos painéis oficiais com as
// mesmas fontes dubladas: Km/L realizado do Eficiência Km/L e R$/L do Preço R$/L.
// Padrão visual: docs/DESIGN-ECHARTS.md (tema oficial assets/gem-theme.css).
// Também: os gráficos do ECharts desenhados, rodapé de fonte em todo card,
// filtros, troca de tema e nada vazando para o lado em 1366/1600/1920 e no celular.
// Uso: RAIZ=<repo> ECHARTS=<echarts.min.js> LIQUID=<echarts-liquidfill.min.js>
//      [CHART_JS=<chart.umd.js>] [SHOT_DIR=<pasta>] node infografico-combustivel-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || path.resolve(new URL('..', import.meta.url).pathname);
const ECHARTS = process.env.ECHARTS || '', LIQUID = process.env.LIQUID || '', CHART_JS = process.env.CHART_JS || '';
const SHOT = process.env.SHOT_DIR || '';
if (!ECHARTS || !LIQUID) { console.error('ECHARTS e LIQUID são obrigatórios (o sandbox não alcança o CDN)'); process.exit(2); }
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); let f = path.join(RAIZ, p); if (p.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures: a aba Km/L no layout do banco e a aba R$/L ── */
const DB = ['vigencia_orig','rs_km_rem','rs_km_real','d_rs_km','km_l_rem_medio','km_l_rem_modelo','km_l_real','d_km_l',
  'rs_l_rem','rs_l_real','d_rs_l','ativo','operacao','empresa','projeto','unidade','placa','mes_inicio_os','ano_inicio_os',
  'modelo','tipo_combustivel','tipo_veiculo','km_rodado_horas_trabalhadas','qtd_total_de_litros','valor_medio_litro','totas_rs'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const MODELOS = { ROTA: [['VW 17.190 CRM 4X2 CONSTELLATION ROBUST', 'CAMINHAO BAU', 3.0], ['M.BENZ/ATEGO 1719', 'CAMINHAO BAU', 3.3]],
  VAN: [['RENAULT MASTER FURGAO L3H2', 'FURGAO', 7.0]], EMPURRADA: [['SCANIA R450 A6X2', 'CAVALO', 2.1], ['M BENZ ACTROS 2548S', 'CAVALO', 2.2]],
  'AUTO SERVIÇO': [['VW 11.180 DRC 4X2', 'CAMINHAO BAU', 3.6]] };
const UNIS = { GRL: ['ROTA', 'VAN'], PIR: ['EMPURRADA', 'ROTA'], CBA: ['EMPURRADA', 'ROTA', 'VAN'], MCC: ['ROTA', 'EMPURRADA'], CGR: ['ROTA', 'AUTO SERVIÇO'],
  BLC: ['ROTA', 'AUTO SERVIÇO'], FLP: ['ROTA'], NFR: ['ROTA'], PLT: ['ROTA'], RON: ['ROTA'], GOI: ['AUTO SERVIÇO'], ANG: ['ROTA'] };
const FROTA = []; let np = 1000;
for (const [uni, projs] of Object.entries(UNIS)) for (const proj of projs) { const q = 4 + Math.floor(rnd() * 22);
  for (let i = 0; i < q; i++) { const [modelo, tipo, base] = MODELOS[proj][i % MODELOS[proj].length];
    FROTA.push({ uni, proj, placa: 'R' + String.fromCharCode(65 + (np % 26)) + 'X' + (np % 10) + String.fromCharCode(65 + (np % 7)) + String(10 + (np++ % 89)), modelo, tipo, base }); } }
const KML_DB = []; let li = 2;
for (let m = 1; m <= 10; m++) for (const v of FROTA) {
  const km = Math.round(2500 + rnd() * 6000), real = +(v.base * (0.86 + rnd() * 0.24)).toFixed(2), rem = +(v.base * (0.97 + rnd() * 0.06)).toFixed(2);
  const lit = Math.round(km / real), rsL = +(5.6 + rnd() * 0.6).toFixed(3);
  const vals = [`2026-${String(m).padStart(2, '0')}-01`, 0, 0, 0, rem, rem, real, +(real - rem).toFixed(2), 0, rsL, 0, 'VERDADEIRO', 'AMBEV', 'CONLOG',
    `${v.proj} - ${v.uni}`, v.uni, v.placa, '', '', v.modelo, 'DIESEL S10', v.tipo, km, lit, rsL, +(lit * rsL).toFixed(2)];
  const o = { linha: li++, vigencia: null }; DB.forEach((c, j) => { o[c] = vals[j]; }); KML_DB.push(o);
}
const RSL = { cols: ['Unidade Benner', 'Vigência', 'PrecoOperadora', 'TipoCombustivel'], rows: [] };
for (let m = 1; m <= 10; m++) for (const [uni, projs] of Object.entries(UNIS)) for (const p of projs) if (p !== 'VAN')
  RSL.rows.push([`${p} - ${uni}`, `Date(2026,${m - 1},1)`, +(5.82 + (m % 3) * 0.05).toFixed(3), 'DIESEL S10']);

async function abre(browser, url, { vp = { width: 1600, height: 900 }, tema = 'dark', pronto } = {}) {
  const page = await browser.newPage({ viewport: vp });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ KML_DB, RSL, tema }) => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tema); localStorage.setItem('bi_user_name', 'Teste');
    window.__dispBanco = false; window.__gvizDispBanco = false;
    window.supabase = { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }) }, from: (t) => {
      let de = 0, ate = 999;
      const q = { select() { return q; }, order() { return q; }, range(a, b) { de = a; ate = b; return q; }, eq() { return q; }, in() { return q; }, limit() { return q; },
        maybeSingle() { return Promise.resolve({ data: t === 'consumo_auto_base' ? { tabela: 'ca_consumo_km_litro', linhas: KML_DB.length, erro: null, carregado_em: '2026-11-24T09:05:00Z', resumo: { dados_ate: '2026-10-31' } } : null, error: null }); },
        then(r, j) { return Promise.resolve({ data: t === 'ca_consumo_km_litro' ? KML_DB.slice(de, ate + 1) : [], error: null }).then(r, j); } };
      return q; } }) };
    const KML_GVIZ = { cols: ['Vigência','R$/km Rem','R$/km Real','Δ R$/km','KM/l Rem Médio','Km/l Rem Modelo','Km/L Real','Δ Km/l','R$/L Rem','R$/L/Real','Δ R$/L','Ativo','Operação','Empresa','Projeto','Unidade','Placa','Mês Inicio OS','Ano Inicio OS','Modelo','Tipo Combustivel','Tipo Veiculo','KM Rodado / Horas trabalhadas','QTD Total de Litros','Valor Médio Litro','TOTAS R$'],
      rows: KML_DB.map(o => { const r = Object.keys(o).filter(k => k !== 'linha' && k !== 'vigencia').map(k => o[k]); const m = r[0].match(/^(\d+)-(\d+)/); r[0] = `Date(${+m[1]},${+m[2] - 1},1)`; return r; }) };
    const corpo = u => { const s = decodeURIComponent(u);
      if (/sheet=Km\/L(&|$)/.test(s)) return KML_GVIZ;
      if (/sheet=R\$\/L(&|$)/.test(s)) return RSL;
      return { cols: ['A'], rows: [] }; };
    const resp = u => { const { cols, rows } = corpo(u); return { status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => ({ v })) })) } }; };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => { const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com')) return Promise.resolve(new Response(`google.visualization.Query.setResponse(${JSON.stringify(resp(s))});`, { status: 200 }));
      if (s.includes('supabase.co')) return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
      return real(u, i); };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        setTimeout(() => { if (fn && window[fn]) window[fn](resp(n.src)); }, 5); return n; }
      return ap.call(this, n); };
  }, { KML_DB, RSL, tema });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url(); const js = b => r.fulfill({ status: 200, contentType: 'application/javascript', body: b });
    if (/echarts-liquidfill/.test(u)) return js(fs.readFileSync(LIQUID, 'utf8'));
    if (/echarts@/.test(u)) return js(fs.readFileSync(ECHARTS, 'utf8'));
    if (CHART_JS && /chart\.js@4\.4\.0/.test(u)) return js(fs.readFileSync(CHART_JS, 'utf8'));
    return js('/*stub*/'); });
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(pronto || (() => { const e = document.getElementById('h-real'); return e && e.textContent.trim() && e.textContent.trim() !== '—'; }), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { page, errs };
}
const txt = (page, id) => page.evaluate(i => { const e = document.getElementById(i); return e ? e.textContent.trim() : null; }, id);

const browser = await chromium.launch();
const num = t => { const m = String(t || '').replace(/\./g, '').replace('−', '-').match(/-?\d+(,\d+)?/); return m ? +m[0].replace(',', '.') : null; };
console.log('\n1 · números iguais aos dos painéis oficiais (mesmas fontes)');
const of = await abre(browser, '/combustivel/eficiencia-kml/index.html');
const OF = await of.page.evaluate(() => { const act = filterRows(allRows, getF()), ytd = filterRows(allRows, { ...getF(), vig: getYtdVigs(getF()) }), a = aggRows(act);
  const t = id => document.getElementById(id).textContent.trim();
  return { real: t('h-real'), rem: t('h-rem'), imp: impactoSomaUni(act), impY: impactoSomaUni(ytd), km: a.sumKm, lit: a.sumLitros, mel: document.querySelector('#k-mel .kn').textContent.trim(), pio: document.querySelector('#k-pio .kn').textContent.trim(),
    proj: aggByKey(act, r => getProj(r)).map(({ k, agg }) => [k, Math.round(calcImpacto(agg) || 0)]).sort((x, y) => y[1] - x[1]), linhasTab: document.querySelectorAll('#body-kml tr').length }; });
await of.page.close();
const pr = await abre(browser, '/combustivel/preco-litro/index.html');
const PR = await pr.page.evaluate(() => { const a = aggRows(filterRows(allRows, getF())); const t = id => document.getElementById(id).textContent.trim();
  return { real: t('h-real'), rem: t('h-rem'), gasto: a.sumTotalRS, imp: calcImpacto(a) }; });
await pr.page.close();
const nv = await abre(browser, '/infografico/combustivel/index.html');
const R = await nv.page.evaluate(() => { const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  return { real: t('h-real'), rem: t('h-rem'), preco: t('p-real'), precoRem: t('p-rem'), sub: t('sub'), cv: document.querySelectorAll('.gem-card canvas').length, kn: t('k-n'), kpl: t('k-pl'),
    imp: __R.impKml, impY: __R.impKmlY, km: __R.kml.km, lit: __R.kml.lit, gasto: __R.preco.gasto, impP: __R.preco.imp, mel: document.querySelector('#k-mel .nm').textContent.trim(), pio: document.querySelector('#k-pio .nm').textContent.trim(),
    proj: __R.projKml.map(x => [x.k, Math.round(x.v)]), tab: document.querySelectorAll('#tab tbody tr').length, tot: document.querySelector('#tab tr.total').textContent,
    fontes: [...document.querySelectorAll('[data-fonte]')].map(e => e.textContent), cards: document.querySelectorAll('.gem-card').length, vig: ST.vig, tema: document.documentElement.getAttribute('data-theme'),
    fonteCss: getComputedStyle(document.body).fontFamily, bg: getComputedStyle(document.body).backgroundColor, himp: t('h-imp'), kgasto: t('k-gasto') }; });
const perto = (a, b) => a != null && b != null && Math.abs(a - b) < 0.01;
af('abre no último mês com realizado', R.vig === '2026-10', R.vig);
af('Km/L realizado e remunerado iguais aos do Eficiência Km/L', R.real === OF.real && R.rem === OF.rem, `${R.real} · ${R.rem} × ${OF.real} · ${OF.rem}`);
af('impacto do Km/L do mês e do ano iguais', perto(R.imp, OF.imp) && perto(R.impY, OF.impY), `${Math.round(R.imp)} · ${Math.round(R.impY)} × ${Math.round(OF.imp)} · ${Math.round(OF.impY)} · tela ${R.himp}`);
af('km rodado e litros iguais', perto(R.km, OF.km) && perto(R.lit, OF.lit), `${R.km} · ${R.lit}`);
af('melhor e pior unidade iguais', R.mel === OF.mel && R.pio === OF.pio, `${R.mel} · ${R.pio} × ${OF.mel} · ${OF.pio}`);
af('impacto por projeto igual', JSON.stringify(R.proj) === JSON.stringify(OF.proj.filter(x => x[1] !== 0)), JSON.stringify(R.proj));
af('R$/L pago e remunerado iguais aos do Preço R$/L', R.preco === 'R$ ' + PR.real && R.precoRem === 'R$ ' + PR.rem, `${R.preco} · ${R.precoRem} × ${PR.real} · ${PR.rem}`);
af('gasto e impacto do preço iguais', perto(R.gasto, PR.gasto) && perto(R.impP, PR.imp), `${R.kgasto} · ${Math.round(R.impP)} × ${Math.round(PR.gasto)} · ${Math.round(PR.imp)}`);
af('tabela com as unidades do painel e a linha Total', R.tab === OF.linhasTab && /^Total/.test(R.tot), `${R.tab} × ${OF.linhasTab}`);
af('sete gráficos do ECharts desenhados', R.cv >= 7, R.cv);
af('pictograma com N de 0 a 10 e a escala escrita', /^\d+$/.test(R.kn) && +R.kn <= 10 && /cada caminhão = 10% da frota/.test(R.kpl), `${R.kn} · ${R.kpl}`);
af('todo card tem rodapé com fonte e data', R.fontes.length === R.cards && R.fontes.every(f => /^Fonte: .*\d{2}\/\d{2}\/\d{4}$/.test(f)), `${R.fontes.length}/${R.cards} · ${R.fontes[0]}`);
af('tema oficial: Inter, fundo #0F172A, data-theme', /Inter/.test(R.fonteCss) && R.bg === 'rgb(15, 23, 42)' && R.tema === 'dark', `${R.fonteCss.slice(0, 20)} · ${R.bg} · ${R.tema}`);
af('subtítulo com o mês e a data', /Resumo de out\/2026/.test(R.sub) && /atualizado em \d{2}\/\d{2}\/\d{4}/.test(R.sub) && /dados até 31\/10\/2026/.test(R.sub), R.sub);
af('sem erro de página', nv.errs.length === 0, nv.errs.join(' | '));

console.log('\n2 · filtros e tema');
await nv.page.click('#f-uni .gem-chip'); await nv.page.click('#f-uni .opt[data-v="PIR"]'); await nv.page.waitForTimeout(500);
const U = await nv.page.evaluate(() => ({ sub: document.getElementById('sub').textContent, real: document.getElementById('h-real').textContent.trim(), rot: document.querySelector('#f-uni .rot').textContent, mel: document.getElementById('k-mel-l').textContent, tab: document.getElementById('t-tab').textContent }));
af('filial filtrada muda o número e o subtítulo', U.real !== R.real && /· PIR/.test(U.sub) && U.rot === 'PIR', `${U.real} · ${U.sub}`);
af('com uma filial, melhor/pior por modelo e tabela por projeto', /modelo/.test(U.mel) && /por projeto/.test(U.tab), `${U.mel} · ${U.tab}`);
await nv.page.click('#f-vig .gem-chip'); await nv.page.click('#f-vig .opt[data-v="2026-03"]'); await nv.page.waitForTimeout(500);
const V = await nv.page.evaluate(() => ({ sub: document.getElementById('sub').textContent, ytd: document.getElementById('h-ytd').textContent }));
af('vigência trocada e acumulado de jan ao mês', /mar\/2026/.test(V.sub) && /jan a mar/.test(V.ytd), `${V.sub} · ${V.ytd}`);
await nv.page.click('#btTema'); await nv.page.waitForTimeout(500);
const T = await nv.page.evaluate(() => ({ tema: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, cv: document.querySelectorAll('.gem-card canvas').length, salvo: localStorage.getItem('bi_theme') }));
af('botão troca para o claro e os gráficos se redesenham', T.tema === 'light' && T.bg === 'rgb(241, 245, 249)' && T.cv >= 7 && T.salvo === 'light', JSON.stringify(T));
af('sem erro depois dos filtros', nv.errs.length === 0, nv.errs.join(' | '));
await nv.page.close();

console.log('\n3 · nada vaza para o lado, nos dois temas');
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 }]) for (const tema of ['dark', 'light']) {
  const t = await abre(browser, '/infografico/combustivel/index.html', { vp, tema });
  const m = await t.page.evaluate(() => { const d = document.documentElement; const fora = [...document.querySelectorAll('.gem-card')].filter(c => c.scrollWidth > c.clientWidth + 2).length;
    const corta = [...document.querySelectorAll('.gem-value,.cena-valor,.gem-title')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').length;
    return { lado: d.scrollWidth > innerWidth + 1, fora, corta, tema: d.getAttribute('data-theme'), cv: document.querySelectorAll('.gem-card canvas').length, alt: d.scrollHeight }; });
  af(`${vp.width}×${vp.height} ${tema}: sem rolagem lateral, nada vazando dos cards`, !m.lado && !m.fora && !m.corta && m.cv >= 7 && m.tema === tema && !t.errs.length, JSON.stringify(m) + t.errs.join('|'));
  if (SHOT) await t.page.screenshot({ path: path.join(SHOT, `inf-${vp.width}-${tema}.png`), fullPage: true });
  await t.page.close();
}
const mb = await abre(browser, '/infografico/combustivel/index.html', { vp: { width: 390, height: 844 } });
const mm = await mb.page.evaluate(() => ({ larg: document.documentElement.scrollWidth <= innerWidth + 1, cv: document.querySelectorAll('.gem-card canvas').length }));
af('celular: sem rolagem lateral e os gráficos desenhados', mm.larg && mm.cv >= 7 && !mb.errs.length, JSON.stringify(mm) + mb.errs.join('|'));
if (SHOT) await mb.page.screenshot({ path: path.join(SHOT, 'inf-390.png'), fullPage: true });
await mb.page.close();

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

// ============================================================================
// Migração dos dois painéis de Km/L para o layout padrão — conferência no
// Chromium, rodando os DOIS lados (HTML antigo do git — ANTIGO_REF — × HTML novo) com as
// MESMAS fontes dubladas:
//   · combustivel/eficiencia-kml  (lê sh_consumo_km_litro do banco, cai para a
//     aba Km/L da planilha; aba Base Remunerado Modelo e R$/L pelo gviz)
//   · consumo-kml-analise         (só gviz)
// O que se prova:
//   1. os números (hero, totais das tabelas, contagem de placas/divergências)
//      saem IGUAIS no antigo e no novo — no padrão, com filtro de unidade e no
//      benchmark Rem modelo;
//   2. o selo de fonte continua ("· banco" e, com o banco vazio, "· planilha");
//   3. no novo: zero erro de página; a página não rola e nenhuma tabela tem
//      barra horizontal em 1366×768 e 1600×900; cada visão abre; o tema claro
//      troca a classe body.claro e redesenha; PDF na lateral e o exportador de
//      Excel carregado; o contrato de filtros (wrap._sel / _render / atualizar)
//      do check-metas continua.
// Uso (de uma pasta onde o playwright resolve):
//   RAIZ=<repo> CHART_JS=<chart.umd.js> SHOT_DIR=<pasta> [ANTIGO_REF=f736f61] node kml-casca-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || path.resolve(new URL('..', import.meta.url).pathname);
const CHART_JS = process.env.CHART_JS || '';
const SHOT = process.env.SHOT_DIR || '';
// o HTML antigo: último commit ANTES da migração (o WIP 6979003 já levou o novo para o HEAD)
const ANTIGO = process.env.ANTIGO_REF || 'f736f61';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
// o HTML antigo é servido NA MESMA PASTA (os caminhos relativos dos assets valem)
const srv = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/__antigo.html')) {
    const pasta = p.slice(1, -'/__antigo.html'.length);
    const b = execSync(`git -C ${RAIZ} show ${ANTIGO}:${pasta}/index.html`, { maxBuffer: 1 << 26 });
    res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(b); return;
  }
  const f = path.join(RAIZ, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures: aba Km/L (rótulos e ordem do MAPA_KML do painel) ── */
const COLS = ['Vigência','R$/km Rem','R$/km Real','Δ R$/km','KM/l Rem Médio','Km/l Rem Modelo','Km/L Real','Δ Km/l',
  'R$/L Rem','R$/L/Real','Δ R$/L','Ativo','Operação','Empresa','Projeto','Unidade','Placa','Mês Inicio OS','Ano Inicio OS',
  'Modelo','Tipo Combustivel','Tipo Veiculo','KM Rodado / Horas trabalhadas','QTD Total de Litros','Valor Médio Litro','TOTAS R$'];
const DB = ['vigencia_orig','rs_km_rem','rs_km_real','d_rs_km','km_l_rem_medio','km_l_rem_modelo','km_l_real','d_km_l',
  'rs_l_rem','rs_l_real','d_rs_l','ativo','operacao','empresa','projeto','unidade','placa','mes_inicio_os','ano_inicio_os',
  'modelo','tipo_combustivel','tipo_veiculo','km_rodado_horas_trabalhadas','qtd_total_de_litros','valor_medio_litro','totas_rs'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FROTA = [];
const MODELOS = { ROTA: [['VW 17.190 CRM 4X2 CONSTELLATION ROBUST', 'CAMINHAO BAU ROLL UP 10 PALLETS', 3.0], ['M.BENZ/ATEGO 1719', 'CAMINHAO BAU ROLL UP 8 PALLETS', 3.3]],
  VAN: [['RENAULT MASTER FURGAO L3H2', 'CAMINHONETE FURGAO', 7.0]], EMPURRADA: [['SCANIA R450 A6X2', 'CAVALO MECANICO', 2.1], ['M BENZ ACTROS 2548S', 'CAVALO MECANICO', 2.2]] };
const UNIS = { GRL: ['ROTA', 'VAN'], PIR: ['EMPURRADA', 'ROTA'], CBA: ['EMPURRADA', 'ROTA', 'VAN'], MCC: ['ROTA'] };
let np = 1000;
for (const [uni, projs] of Object.entries(UNIS)) for (const proj of projs) for (let i = 0; i < 6; i++) {
  const [modelo, tipo, base] = MODELOS[proj][i % MODELOS[proj].length];
  FROTA.push({ uni, proj, placa: 'R' + String.fromCharCode(65 + (np % 26)) + 'X' + (np++), modelo, tipo, base, ativo: i === 5 ? 'FALSO' : 'VERDADEIRO' });
}
const LINHAS = [];
for (let m = 1; m <= 9; m++) for (const v of FROTA) {
  const km = Math.round(2500 + rnd() * 6000);
  const real = +(v.base * (0.85 + rnd() * 0.3)).toFixed(2);
  const rem = +(v.base * (0.97 + rnd() * 0.06)).toFixed(2);
  const remMod = +(v.base * (0.95 + rnd() * 0.1)).toFixed(2);
  const lit = Math.round(km / real), rsL = +(5.6 + rnd() * 0.6).toFixed(3);
  const vig = new Date(2026, m - 1, 1);
  LINHAS.push({ m, vals: [vig, 0, 0, 0, rem, remMod, real, +(real - rem).toFixed(2), 0, rsL, 0, v.ativo, 'AMBEV', 'CONLOG',
    `${v.proj} - ${v.uni}`, v.uni, v.placa, '', '', v.modelo, 'DIESEL S10', v.tipo, km, lit, rsL, lit * rsL] });
}
const gvizDate = d => `Date(${d.getFullYear()},${d.getMonth()},1)`;
const KML_GVIZ = { cols: COLS, rows: LINHAS.map(l => l.vals.map((x, i) => i === 0 ? gvizDate(x) : x)) };
const KML_DB = LINHAS.map((l, i) => { const o = { linha: i + 2 }; DB.forEach((c, j) => { o[c] = j === 0 ? `${l.vals[0].getFullYear()}-${String(l.vals[0].getMonth() + 1).padStart(2, '0')}-01` : l.vals[j]; }); o.vigencia = null; return o; });
// Base Remunerado Modelo: Vigência Data · Unidade Benner · Placa · Média (algumas 0 = inativa → cai na média do modelo)
const BRM = { cols: ['Vigência Data', 'Unidade Benner', 'Placa', 'Média'], rows: [] };
for (let m = 1; m <= 9; m++) FROTA.forEach((v, i) => BRM.rows.push([gvizDate(new Date(2026, m - 1, 1)), `${v.proj} - ${v.uni}`, v.placa, i % 7 === 3 ? 0 : +(v.base * (i % 4 === 1 ? 1.08 : 1)).toFixed(2)]));
// R$/L (preço remunerado por projeto/vigência) — sem VAN de propósito (cai no ROTA da unidade)
const RSL = { cols: ['Unidade Benner', 'Vigência', 'PrecoOperadora', 'TipoCombustivel'], rows: [] };
for (let m = 1; m <= 9; m++) for (const [uni, projs] of Object.entries(UNIS)) for (const p of projs) if (p !== 'VAN')
  RSL.rows.push([`${p} - ${uni}`, gvizDate(new Date(2026, m - 1, 1)), +(5.7 + (m % 3) * 0.05).toFixed(3), 'DIESEL S10']);

async function abre(browser, url, { vp = { width: 1600, height: 900 }, banco = true, tema = 'dark' } = {}) {
  const page = await browser.newPage({ viewport: vp });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ KML_GVIZ, KML_DB, BRM, RSL, banco, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.removeItem('kml_mini'); localStorage.removeItem('kml_analise_mini');
    window.__GOOGLE = [];
    // dublê do supabase-js (o CDN é bloqueado no teste): o PostgREST paginado
    window.supabase = { createClient: () => ({ from: (t) => {
      let de = 0, ate = 999;
      const q = { select() { return q; }, order() { return q; }, range(a, b) { de = a; ate = b; return q; },
        then(r, j) { const data = (banco && t === 'sh_consumo_km_litro') ? KML_DB.slice(de, ate + 1) : [];
          return Promise.resolve({ data, error: null }).then(r, j); } };
      return q; } }) };
    const corpo = u => { const s = decodeURIComponent(u);
      if (/sheet=Km\/L(&|$)/.test(s)) return KML_GVIZ;
      if (/sheet=Base Remunerado Modelo/.test(s)) return BRM;
      if (/sheet=R\$\/L(&|$)/.test(s)) return RSL;
      return { cols: ['A'], rows: [] }; };
    const resp = u => { const { cols, rows } = corpo(u); return { status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => ({ v })) })) } }; };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => { const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com')) { window.__GOOGLE.push(s); return Promise.resolve(new Response(`google.visualization.Query.setResponse(${JSON.stringify(resp(s))});`, { status: 200 })); }
      if (s.includes('supabase.co')) return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
      return real(u, i); };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        window.__GOOGLE.push(n.src);
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        setTimeout(() => { if (fn && window[fn]) window[fn](resp(n.src)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { KML_GVIZ, KML_DB, BRM, RSL, banco, tema });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => {
    if (CHART_JS && /chart\.js@4\.4\.0/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS, 'utf8') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('h-real'); return e && e.textContent.trim() && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { page, errs };
}

// números que a tela mostra (mesmos ids no antigo e no novo)
const NUMS = () => {
  const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  const tot = id => { const b = document.getElementById(id); if (!b) return null; const tr = b.querySelector('tr.total'); return tr ? [...tr.cells].map(c => c.textContent.trim()).join('|') : null; };
  const nlin = id => { const b = document.getElementById(id); return b ? b.querySelectorAll('tr').length : null; };
  return { real: t('h-real'), rem: t('h-rem'), dv: t('h-drem-v'), dp: t('h-drem-p'), imp: t('h-imp'), yv: t('h-ytd-v'), yp: t('h-ytd-p'), yimp: t('h-ytd-imp'),
    kml: tot('body-kml'), uni: tot('body-uni'), proj: tot('body-proj'), vei: nlin('body-vei'), div: nlin('body-diverg'), subDiv: t('sub-diverg'),
    vei1: (() => { const b = document.getElementById('body-vei'); const r = b && b.querySelector('tr'); return r ? [...r.cells].map(c => c.textContent.trim()).join('|') : null; })() };
};
// aplica o filtro como o check-metas: wrap._sel + _render + atualizar
const FILTRA_UNI = () => { const w = document.getElementById('ms-uni'); w._sel.clear(); w._sel.add('GRL'); w._render(''); atualizar(); };
const MODO_MODELO = () => setRemMode('modelo');

const PAINEIS = [
  { pasta: 'combustivel/eficiencia-kml', nome: 'Eficiência Km/L', banco: true, totId: 'kml' },
  { pasta: 'consumo-kml-analise', nome: 'Análise do Impacto', banco: false, totId: 'uni' },
];
const VIEWS = ['resumo', 'detalhado', 'veiculo', 'diverg'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
console.log(CHART_JS ? 'Chart.js REAL (' + CHART_JS + ')' : 'Chart.js dublado (vazio)');

for (const P of PAINEIS) {
  console.log(`\n══ ${P.pasta} — ${P.nome}`);
  // ── 1. antigo × novo: os mesmos números ──
  const lados = {};
  for (const lado of ['antigo', 'novo']) {
    const url = `/${P.pasta}/${lado === 'antigo' ? '__antigo.html' : 'index.html'}`;
    const { page, errs } = await abre(browser, url);
    const a = await page.evaluate(NUMS);
    await page.evaluate(FILTRA_UNI); await page.waitForTimeout(300);
    const b = await page.evaluate(NUMS);
    await page.evaluate(MODO_MODELO); await page.waitForTimeout(300);
    const c = await page.evaluate(NUMS);
    lados[lado] = { a, b, c, errs };
    await page.close();
  }
  const A = lados.antigo, N = lados.novo;
  console.log('   antigo · padrão:', JSON.stringify({ real: A.a.real, rem: A.a.rem, imp: A.a.imp, yimp: A.a.yimp, tot: A.a[P.totId], vei: A.a.vei, div: A.a.div }));
  console.log('   novo   · padrão:', JSON.stringify({ real: N.a.real, rem: N.a.rem, imp: N.a.imp, yimp: N.a.yimp, tot: N.a[P.totId], vei: N.a.vei, div: N.a.div }));
  af('antigo sem erro de página', A.errs.length === 0, A.errs[0] || '');
  af('novo sem erro de página', N.errs.length === 0, N.errs[0] || '');
  af('hero preenchido (não é "—")', N.a.real && N.a.real !== '—' && N.a.imp !== '—', N.a.real);
  af('números iguais no padrão (hero + totais + tabelas)', JSON.stringify(A.a) === JSON.stringify(N.a), JSON.stringify(N.a).slice(0, 160));
  af('números iguais com Unidade = GRL', JSON.stringify(A.b) === JSON.stringify(N.b));
  af('números iguais no benchmark Rem modelo', JSON.stringify(A.c) === JSON.stringify(N.c));
  af('filtro de unidade muda os números', N.a.real !== N.b.real || N.a.imp !== N.b.imp);
  af('Rem modelo muda o remunerado', N.b.rem !== N.c.rem);

  // ── 2. selo de fonte ──
  if (P.banco) {
    for (const banco of [true, false]) {
      const { page } = await abre(browser, `/${P.pasta}/index.html`, { banco });
      const sub = await page.evaluate(() => document.getElementById('titSub').textContent);
      const nums = await page.evaluate(NUMS);
      af(`selo no subtítulo com o banco ${banco ? 'respondendo' : 'vazio'}: "· ${banco ? 'banco' : 'planilha'}"`, sub.endsWith('· ' + (banco ? 'banco' : 'planilha')), sub);
      if (!banco) af('planilha (reserva) dá o mesmo número do banco', nums.real === N.a.real && nums.imp === N.a.imp, nums.real + ' · ' + nums.imp);
      await page.close();
    }
  }

  // ── 3. o novo, visão a visão, nas duas telas e nos dois temas ──
  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
    for (const tema of ['dark', 'light']) {
      const { page, errs } = await abre(browser, `/${P.pasta}/index.html`, { vp, tema });
      const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
      const claro = await page.evaluate(() => document.body.classList.contains('claro'));
      af(`[${tag}] tema aplicado (body.claro = ${tema === 'light'})`, claro === (tema === 'light'));
      for (const v of VIEWS) {
        await page.evaluate(v => setVw(v), v); await page.waitForTimeout(250);
        const m = await page.evaluate(v => {
          const vw = document.getElementById('vw-' + v), de = document.documentElement;
          const twraps = [...vw.querySelectorAll('.twrap')].map(w => ({ sw: w.scrollWidth, cw: w.clientWidth, sh: w.scrollHeight, ch: w.clientHeight }));
          const cards = [...vw.querySelectorAll('.card')].map(c => c.getBoundingClientRect().height);
          const cv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
          const charts = window.Chart && Chart.getChart ? [...vw.querySelectorAll('canvas')].filter(c => Chart.getChart(c)).length : -1;
          const top = document.querySelector('.top').getBoundingClientRect();
          return { on: vw.classList.contains('on'), tit: document.getElementById('tit').textContent,
            pagina: de.scrollHeight - de.clientHeight, pagX: de.scrollWidth - de.clientWidth, vwRola: vw.scrollHeight - vw.clientHeight, twraps, cards, cv, charts, topH: top.height };
        }, v);
        const horiz = m.twraps.filter(w => w.sw > w.cw + 1).length;
        af(`[${tag}] ${v}: abre (${m.tit}), página não rola, visão não rola, sem barra horizontal`,
          m.on && m.pagina <= 0 && m.pagX <= 0 && m.vwRola <= 1 && horiz === 0,
          `pág ${m.pagina}/${m.pagX} · visão ${m.vwRola} · horiz ${horiz} · topo ${Math.round(m.topH)}px`);
        if (v === 'resumo') af(`[${tag}] resumo: dois gráficos com altura (${m.cv.map(Math.round).join(', ')} px)`, m.cv.length === 2 && m.cv.every(h => h > 120) && (!CHART_JS || m.charts === 2));
        if (SHOT && vp.width === 1600) {
          const dir = path.join(SHOT, P.pasta.replace(/\//g, '-')); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
        }
      }
      if (vp.width === 1600 && tema === 'dark') {
        // troca de tema redesenha os gráficos (o canvas é recriado)
        await page.evaluate(() => setVw('resumo')); await page.waitForTimeout(200);
        const antes = await page.evaluate(() => window.Chart && Chart.getChart ? Chart.getChart(document.getElementById('ch-kml'))?.id : null);
        await page.evaluate(() => trocaTema()); await page.waitForTimeout(250);
        const depois = await page.evaluate(() => ({ claro: document.body.classList.contains('claro'), id: window.Chart && Chart.getChart ? Chart.getChart(document.getElementById('ch-kml'))?.id : null, tema: localStorage.getItem('bi_theme') }));
        af('trocaTema: body.claro + bi_theme=light + gráfico redesenhado', depois.claro && depois.tema === 'light' && (!CHART_JS || (antes != null && depois.id !== antes)), JSON.stringify({ antes, ...depois }));
        // lateral: PDF em Atalhos, Excel carregado, menu recolhe
        const lat = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'), xls: !!window.H2CPrep,
          atalhos: [...document.querySelectorAll('.side .s-item')].map(b => b.textContent.trim()) }));
        af('Gerar PDF dentro de Atalhos e exportador de Excel/PNG carregado', lat.pdf && lat.xls, lat.atalhos.join(' · '));
        await page.evaluate(() => trocaMini()); await page.waitForTimeout(300);
        const mini = await page.evaluate(() => ({ mini: document.querySelector('.side').classList.contains('mini'), k: localStorage.getItem(document.querySelector('.s-top b').textContent.includes('Análise') ? 'kml_analise_mini' : 'kml_mini') }));
        af('menu lateral recolhe e lembra (chave <painel>_mini)', mini.mini && mini.k === '1');
        // ordenação da tabela de veículos e seletor Unidade/Projeto
        await page.evaluate(() => setVw('veiculo'));
        const ord = await page.evaluate(() => { sortVei('km'); const a = [...document.querySelectorAll('#body-vei tr')].slice(0, 3).map(r => r.cells[5].textContent); sortVei('km'); const b = [...document.querySelectorAll('#body-vei tr')].slice(0, 3).map(r => r.cells[5].textContent); return { a, b, seta: document.getElementById('sort-km').textContent }; });
        af('ordenação de Consumo por Veículo continua (clique inverte)', JSON.stringify(ord.a) !== JSON.stringify(ord.b) && /▼|▲/.test(ord.seta), JSON.stringify(ord));
        if (P.totId === 'kml') {
          const dim = await page.evaluate(() => { setDim('proj'); const th = document.getElementById('th-dim').textContent; const n = document.querySelectorAll('#body-kml tr').length;
            const remOn = document.querySelector('.dimb[data-remmode].on')?.dataset.remmode; setDim('uni'); return { th, n, remOn }; });
          af('Km/L Detalhado alterna Unidade ⇄ Projeto (e não apaga o destaque do benchmark)', dim.th === 'PROJETO' && dim.n > 1 && dim.remOn === 'medio', JSON.stringify(dim));
        }
      }
      af(`[${tag}] sem erro de página`, errs.length === 0, errs[0] || '');
      await page.close();
    }
  }
  // ── 4. celular: a página rola, a lateral vira fileira, gráfico com altura ──
  {
    const { page, errs } = await abre(browser, `/${P.pasta}/index.html`, { vp: { width: 390, height: 844 } });
    const m = await page.evaluate(() => ({ rola: getComputedStyle(document.body).overflowY === 'auto' && document.body.scrollHeight > document.body.clientHeight + 50, lado: getComputedStyle(document.querySelector('.side')).flexDirection,
      cv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => Math.round(c.getBoundingClientRect().height)) }));
    af('celular: página rola, lateral em fileira, gráficos com altura', m.rola && m.lado === 'row' && m.cv.every(h => h > 150), JSON.stringify(m));
    af('celular: sem erro de página', errs.length === 0, errs[0] || '');
    if (SHOT) { const dir = path.join(SHOT, P.pasta.replace(/\//g, '-')); await page.screenshot({ path: path.join(dir, 'celular.png'), fullPage: false }); }
    await page.close();
  }
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

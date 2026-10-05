// ============================================================================
// Árvore de Combustível na casca padrão — teste no Chromium, com o gviz dublado
// (o sandbox não alcança o Google). Roda o HTML ANTIGO e o NOVO com as MESMAS
// abas sintéticas (Frota do DRE, Dispersão de km, Km/L, R$/L, Balanço de Massa)
// e confere:
//   1. os números da árvore saem IGUAIS nos dois lados, em seis recortes de
//      filtro aplicados pelo contrato do /check-metas/ (wrap._sel + _render +
//      onFilterChange);
//   2. no novo: zero erro de página, sem rolagem da página, a árvore dentro da
//      área da visão (escala), conectores desenhados, cards no vidro do padrão
//      (--side), cores de resultado, Excel/PDF na lateral, tema claro/escuro;
//   3. o /check-metas/ de verdade: o CM_HELPER do próprio check-metas, os
//      filtros do slide do MCC T2 (unidade com tier, vigência em cinco grafias)
//      e a foto do .tree-wrap pelo html2canvas + H2CPrep, na janela do iframe.
//
// Uso (de uma pasta onde o playwright resolve):
//   RAIZ=<repo> ANTIGO=<html antigo> H2C=<html2canvas.min.js> SHOT_DIR=<pasta> node teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO || '';
const H2C = process.env.H2C || '';
const SHOT = process.env.SHOT_DIR || '';
const PASTA = '/combustivel/arvore-combustivel/';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u === PASTA + 'antigo.html' ? ANTIGO : path.join(RAIZ, u);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── abas sintéticas, no formato que o parse do painel lê (rótulos) ── */
const D = (y, m) => `Date(${y},${m - 1},1)`;
const FROTA = { cols: ['Vigência', 'Orçado', 'Remunerado', 'Realizado', 'Nível 3', 'Conta Gerencial'], rows: [] };
const DISP = { cols: ['Vigência', 'Unidade', 'PROJ. - COD', 'Km Rem. TT', 'Km Rodado TT', 'Viagens - Real', 'Viagens Rec. Real', 'Viagens Noturnas Real', 'Viagens Mapa Aberto'], rows: [] };
const KML = { cols: ['Vigência', 'Operação', 'Projeto', 'KM/l Rem Médio', 'KM/l Real', 'Km Rodado', 'Qtd Total de Litros', 'Total R$', 'Tipo Combustível'], rows: [] };
const RSL = { cols: ['Unidade Benner', 'Vigência', 'PrecoOperadora', 'TipoCombustivel'], rows: [] };
const BM = { cols: ['Unidade', 'Vigência', 'Valor', 'Valor 85%'], rows: [] };
const RECS = [
  // n3 Frota/Dispersão · n3 Km/L · km rem · km real · rem km/L · litros · R$/L real · R$/L rem
  ['ROTA - GRL', 'ROTA - GRL', 61000, 63500, 3.05, 19800, 6.21, 6.05],
  ['ROTA (VAN) - GRL', 'VAN - GRL', 9000, 8700, 7.10, 1150, 6.40, null],   // VAN sem preço → usa o do ROTA
  ['EMPURRADA - PIR', 'EMPURRADA - PIR', 152000, 171000, 2.01, 86000, 5.98, 5.92],
  ['ROTA - MCC', 'ROTA - MCC', 58000, 63000, 3.12, 20500, 6.33, 6.10],
  ['EMPURRADA - MCC', 'EMPURRADA - MCC', 98000, 104000, 1.97, 52000, 6.02, 5.95],
  ['ROTA - CBA', 'ROTA - CBA', 41000, 39500, 3.30, 11800, 6.55, 6.48],
];
[[2026, 7, 1.0], [2026, 8, 1.07]].forEach(([y, m, k]) => {
  RECS.forEach(([n3, n3k, kmRem, kmReal, remKml, lit, rslReal, rslRem], i) => {
    kmRem = Math.round(kmRem * k); kmReal = Math.round(kmReal * (k + .01 * i)); lit = Math.round(lit * k);
    const rem = -Math.round(kmRem / remKml * (rslRem || 6)), real = -Math.round(lit * rslReal);
    FROTA.rows.push([D(y, m), rem * 1.02, rem, real, n3, 'Combustíveis Veiculos e Equipamentos']);
    FROTA.rows.push([D(y, m), -5000, -4800, -5100, n3, 'Fluídos (Arla)']);
    FROTA.rows.push([D(y, m), -30000, -28000 - i * 900, -31000, n3, 'Manutenção de Veículos e Equipamentos']);
    FROTA.rows.push([D(y, m), -12000, -11500, -12500, n3, 'Pneus Novos']);
    const vg = Math.round(kmReal / 180);
    DISP.rows.push([D(y, m), n3.split(' - ')[1], n3, kmRem, kmReal, vg, Math.round(vg * .08), Math.round(vg * .05), Math.round(vg * .03)]);
    KML.rows.push([D(y, m), 'AMBEV', n3k, remKml, kmReal / lit, kmReal, lit, lit * rslReal, 'DIESEL S10']);
    if (rslRem) RSL.rows.push([n3k, D(y, m), rslRem, 'DIESEL S10']);
  });
  BM.rows.push(['PIRAI EMPURRADA', `${String(m).padStart(2, '0')}/${y}`, 300000 * k, 255000 * k]);
  BM.rows.push(['MACACU EMPURRADA', `${String(m).padStart(2, '0')}/${y}`, 120000 * k, 102000 * k]);
});
// mês orçado futuro, sem dado (não pode aparecer no filtro de vigência)
FROTA.rows.push([D(2026, 12), -50000, 0, 0, 'ROTA - GRL', 'Combustíveis Veiculos e Equipamentos']);
const ABAS = { 'Frota': FROTA, 'Dispersão de km': DISP, 'Km/L': KML, 'R$/L': RSL, 'Balanço de Massa': BM };

const CMH = (() => { const s = fs.readFileSync(RAIZ + '/check-metas/index.html', 'utf8');
  const i = s.indexOf('const CM_HELPER=`') + 'const CM_HELPER=`'.length, j = s.indexOf('};`;', i) + 2;
  return eval('`' + s.slice(i, j) + '`'); })();
const H2C_SRC = H2C && fs.existsSync(H2C) ? fs.readFileSync(H2C, 'utf8') : null;

async function abre(browser, pagina, { w = 1600, h = 900, tema = 'dark', mini = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ ABAS, tema, mini }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_last_access', '2026-10-01T10:00:00Z');
    if (mini) localStorage.setItem('arvcomb_mini', '1'); else localStorage.removeItem('arvcomb_mini');
    window.__GV = [];
    const resp = u => {
      const s = decodeURIComponent(u); const m = s.match(/sheet=([^&]+)/); const nome = m ? m[1].replace(/\+/g, ' ') : '';
      window.__GV.push(nome);
      const a = ABAS[nome];
      if (!a) return { status: 'error', errors: [{ message: 'aba ' + nome }] };
      return { status: 'ok', table: { cols: a.cols.map(c => ({ label: c, id: c })), rows: a.rows.map(r => ({ c: r.map(v => ({ v })) })) } };
    };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = resp(n.src);
        setTimeout(() => { if (fn && window[fn]) window[fn](body); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { ABAS, tema, mini });
  await page.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*gviz-cache fora do teste*/' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => {
    if (/html2canvas/.test(r.request().url()) && H2C_SRC) return r.fulfill({ status: 200, contentType: 'application/javascript', body: H2C_SRC });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.goto(BASE + PASTA + pagina, { waitUntil: 'load' });
  await page.waitForFunction(() => { const e = document.getElementById('titSub') || document.getElementById('status-badge');
    return e && /Atualizado|Erro/.test(e.textContent); }, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

const VALS = () => { const o = {}; document.querySelectorAll('[id^="v-"]').forEach(e => { o[e.id] = e.textContent.trim() + '|' + (e.className || ''); }); return o; };
// o contrato do /check-metas/: _sel (Set) + _render + onFilterChange
const SEL = ({ id, v }) => { const w = document.getElementById(id); w._sel.clear(); v.forEach(x => w._sel.add(x)); w._render(''); onFilterChange(); };
const RECORTES = [
  ['padrão (última vigência)', []],
  ['Unidade PIR', [{ id: 'ms-uni', v: ['PIR'] }]],
  ['Unidade GRL · Projeto VAN', [{ id: 'ms-uni', v: ['GRL'] }, { id: 'ms-nv3', v: ['VAN'] }]],
  ['Vigência 07/2026 · MCC · EMPURRADA', [{ id: 'ms-uni', v: [] }, { id: 'ms-nv3', v: [] }, { id: 'ms-vig', v: ['07/2026'] }, { id: 'ms-uni', v: ['MCC'] }, { id: 'ms-nv3', v: ['EMPURRADA'] }]],
  ['Ano 2026, todas as vigências', [{ id: 'ms-uni', v: [] }, { id: 'ms-nv3', v: [] }, { id: 'ms-vig', v: [] }, { id: 'ms-ano', v: ['2026'] }]],
  ['Projeto ROTA, 2 vigências', [{ id: 'ms-ano', v: [] }, { id: 'ms-vig', v: ['07/2026', '08/2026'] }, { id: 'ms-nv3', v: ['ROTA'] }]],
];
async function percorre(page) {
  const out = [];
  for (const [nome, passos] of RECORTES) {
    for (const p of passos) await page.evaluate(SEL, p);
    await page.waitForTimeout(150);
    out.push([nome, await page.evaluate(VALS)]);
  }
  return out;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* ── 1. antigo × novo: os mesmos números ── */
console.log('\n══ 1 · números: antigo × novo (1600×900)');
let A = null;
if (ANTIGO) {
  const a = await abre(browser, 'antigo.html');
  A = { r: await percorre(a.page), errs: a.errs, gv: await a.page.evaluate(() => window.__GV) };
  await a.ctx.close();
}
const n = await abre(browser, 'index.html');
const N = { r: await percorre(n.page), errs: n.errs, gv: await n.page.evaluate(() => window.__GV) };
af('novo: zero erro de página', N.errs.length === 0, N.errs[0] || '');
af('novo: leu as cinco abas', ['Frota', 'Dispersão de km', 'Km/L', 'R$/L', 'Balanço de Massa'].every(x => N.gv.includes(x)), N.gv.join(' · '));
const num = s => s.split('|')[0];
const cls = s => (s.split('|')[1] || '').replace(/^cr-t$/, 'cr').replace(/^cg-t$/, 'cg');
if (A) {
  af('antigo: zero erro de página', A.errs.length === 0, A.errs[0] || '');
  for (let i = 0; i < RECORTES.length; i++) {
    const [nome, va] = A.r[i], vn = N.r[i][1];
    const ks = Object.keys(va);
    const difN = ks.filter(k => num(va[k]) !== num(vn[k]));
    const difC = ks.filter(k => cls(va[k]) !== cls(vn[k]));
    af(`${nome}: ${ks.length} valores iguais`, ks.length >= 25 && difN.length === 0, difN.map(k => `${k} ${num(va[k])}≠${num(vn[k])}`).join(', ') || `custo ${num(vn['v-custoReal'])} · km ${num(vn['v-kmReal'])} · km/L ${num(vn['v-kmLReal'])} · imp ${num(vn['v-impPreco'])}`);
    af(`${nome}: mesma cor de resultado (verde/vermelho)`, difC.length === 0, difC.map(k => `${k} ${cls(va[k])}≠${cls(vn[k])}`).join(', '));
  }
  const pir = N.r[1][1];
  af('Balanço de Massa entra no recorte PIR', num(pir['v-bmKm']).startsWith('+') && num(pir['v-bmValor']) !== '—', num(pir['v-bmValor']) + ' · ' + num(pir['v-bmKm']));
  af('VAN tem R$/L remunerado (o do ROTA da unidade)', +num(N.r[2][1]['v-rsLRem']).replace(',', '.') > 0, num(N.r[2][1]['v-rsLRem']));
}
await n.ctx.close();

/* ── 2. a casca nova ── */
const medeCasca = () => {
  const area = document.getElementById('arvArea'), wrap = document.getElementById('treeWrap');
  const ra = area.getBoundingClientRect(), rw = wrap.getBoundingClientRect();
  const vw = document.querySelector('.vw.on');
  const de = document.documentElement;
  const card = getComputedStyle(document.querySelector('#card-custo'));
  const side = getComputedStyle(document.body).getPropertyValue('--side').trim();
  const verm = getComputedStyle(document.body).getPropertyValue('--vermelho').trim();
  const tmp = document.createElement('i'); tmp.style.color = verm; document.body.appendChild(tmp); const vermRgb = getComputedStyle(tmp).color; tmp.remove();
  const tmp2 = document.createElement('i'); tmp2.style.background = side; document.body.appendChild(tmp2); const sideRgb = getComputedStyle(tmp2).backgroundColor; tmp2.remove();
  const tdCr = document.querySelector('.kpi-table td.cr,.kpi-table td.cr-t');
  return {
    pagRola: de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1 || document.body.scrollHeight > innerHeight + 1,
    vwRola: vw.scrollHeight > vw.clientHeight + 1 || vw.scrollWidth > vw.clientWidth + 1,
    dentro: rw.left >= ra.left - 1 && rw.right <= ra.right + 1 && rw.top >= ra.top - 1 && rw.bottom <= ra.bottom + 1,
    escala: (wrap.style.transform.match(/scale\(([\d.]+)\)/) || [, '1'])[1],
    linhas: document.querySelectorAll('#treeSvg line').length,
    cardBg: card.backgroundColor, sideRgb,
    crCor: tdCr ? getComputedStyle(tdCr).color : null, vermRgb,
    claro: document.body.classList.contains('claro'),
    pdf: !!document.querySelector('#pdf-slot button, #pdf-slot .s-item'),
    h2cprep: !!window.H2CPrep,
    tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
    itens: [...document.querySelectorAll('.s-item[data-vw]')].map(b => b.textContent.trim()),
    ids: ['ms-ano', 'ms-vig', 'ms-uni', 'ms-nv3'].every(i => document.getElementById(i) && document.getElementById(i)._sel instanceof Set && typeof document.getElementById(i)._render === 'function'),
  };
};
for (const [w, h] of [[1600, 900], [1366, 768]]) for (const tema of ['dark', 'light']) {
  console.log(`\n══ 2 · casca ${w}×${h} · ${tema === 'light' ? 'claro' : 'escuro'}`);
  const s = await abre(browser, 'index.html', { w, h, tema });
  const m = await s.page.evaluate(medeCasca);
  af('zero erro de página', s.errs.length === 0, s.errs[0] || '');
  af('a página não rola', !m.pagRola);
  af('a visão não rola (sem barra vertical/horizontal)', !m.vwRola);
  af('a árvore inteira dentro da área da visão', m.dentro, 'escala ' + m.escala);
  af('conectores desenhados', m.linhas >= 12, m.linhas + ' linhas');
  af('card no vidro do padrão (fundo = --side)', m.cardBg === m.sideRgb, m.cardBg);
  af('Δ desfavorável em --vermelho', m.crCor === m.vermRgb, m.crCor);
  af('tema ' + (tema === 'light' ? 'claro = body.claro' : 'escuro sem body.claro'), m.claro === (tema === 'light'));
  if (w === 1600 && tema === 'dark') {
    af('1ª visão "Resumo Gerencial" e título no topo', m.itens[0] === 'Resumo Gerencial' && m.tit === 'Resumo Gerencial', m.itens.join(','));
    af('subtítulo com recorte + carga', /^08\/2026 · Atualizado/.test(m.sub), m.sub);
    af('Gerar PDF na lateral (Atalhos)', m.pdf);
    af('excel-export carregado (H2CPrep)', m.h2cprep);
    af('filtros com _sel (Set) e _render', m.ids);
    // trocar o tema redesenha (conectores na cor do tema)
    const c0 = await s.page.evaluate(() => document.querySelector('#treeSvg line').getAttribute('stroke'));
    await s.page.evaluate(() => trocaTema()); await s.page.waitForTimeout(200);
    const c1 = await s.page.evaluate(() => document.querySelector('#treeSvg line').getAttribute('stroke'));
    af('trocar o tema redesenha os conectores', c0 !== c1 && (await s.page.evaluate(() => document.body.classList.contains('claro'))), c0 + ' → ' + c1);
    await s.page.evaluate(() => trocaTema()); await s.page.waitForTimeout(200);
    // lateral recolhida: a árvore se reajusta e continua dentro
    const e0 = m.escala;
    await s.page.evaluate(() => trocaMini()); await s.page.waitForTimeout(700);
    const m2 = await s.page.evaluate(medeCasca);
    af('lateral recolhida: árvore reescalada e dentro da área', m2.dentro && !m2.pagRola && +m2.escala >= +e0, e0 + ' → ' + m2.escala);
    await s.page.evaluate(() => trocaMini()); await s.page.waitForTimeout(500);
    // menu do filtro abre por cima e é opaco
    await s.page.click('#ms-uni .ms-btn'); await s.page.waitForTimeout(100);
    const pop = await s.page.evaluate(() => { const p = document.querySelector('#ms-uni .ms-panel'); return { aberto: p.classList.contains('open'), bg: getComputedStyle(p).backgroundColor, n: p.querySelectorAll('input[data-v]').length }; });
    af('filtro Unidade abre opaco com as unidades', pop.aberto && /rgb\(38, 38, 43\)/.test(pop.bg) && pop.n >= 4, pop.bg + ' · ' + pop.n);
    // filtro pelo clique de verdade muda os números
    const antes = await s.page.evaluate(() => document.getElementById('v-kmReal').textContent);
    await s.page.click('#ms-uni .ms-opt:has(input[data-v="CBA"]) .ms-only', { force: true }); await s.page.waitForTimeout(250);
    const depois = await s.page.evaluate(() => document.getElementById('v-kmReal').textContent);
    af('clicar "only" em CBA muda o Km Rodado', antes !== depois, antes + ' → ' + depois);
    await s.page.mouse.click(5, 5);
  }
  if (SHOT && w === 1600) {
    fs.mkdirSync(SHOT, { recursive: true });
    await s.page.screenshot({ path: path.join(SHOT, `resumo-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
  }
  if (SHOT && w === 1366 && tema === 'dark') await s.page.screenshot({ path: path.join(SHOT, 'resumo-1366-escuro.png') });
  await s.ctx.close();
}

/* ── celular ── */
{
  console.log('\n══ 2b · celular 390×844');
  const s = await abre(browser, 'index.html', { w: 390, h: 844 });
  const m = await s.page.evaluate(() => {
    const wrap = document.getElementById('treeWrap'), cards = [...document.querySelectorAll('.tree > div')];
    return { trans: getComputedStyle(wrap).transform, larg: Math.max(...cards.map(c => c.getBoundingClientRect().right)),
      rola: getComputedStyle(document.body).overflowY, svg: getComputedStyle(document.getElementById('treeSvg')).display };
  });
  af('zero erro de página', s.errs.length === 0, s.errs[0] || '');
  af('árvore empilhada, sem escala e sem conectores', m.trans === 'none' && m.svg === 'none');
  af('cards cabem na largura do celular', m.larg <= 390, Math.round(m.larg) + 'px');
  af('a página volta a rolar no celular', m.rola === 'auto');
  if (SHOT) await s.page.screenshot({ path: path.join(SHOT, 'celular.png'), fullPage: true });
  await s.ctx.close();
}

/* ── 3. o /check-metas/: slide da árvore do MCC T2 (ROTA), janela do iframe ── */
{
  console.log('\n══ 3 · /check-metas/ (iframe 1760×990, tema claro)');
  const s = await abre(browser, 'index.html', { w: 1760, h: 990, tema: 'light' });
  // o /check-metas/ injeta o html2canvas no iframe quando o painel ainda não o carregou (garanteH2C)
  if (H2C_SRC) await s.page.addScriptTag({ content: H2C_SRC });
  const r = await s.page.evaluate(async (CMH) => {
    eval(CMH);
    const V = '08/2026';
    const gra = ['ago/26', '2026-08', 'AGO/26', 'ago/2026', '08/2026'].join('|');
    __cm.faltou = [];
    __cm.sel('ms-vig', [gra]); __cm.sel('ms-uni', ['MCC T2|MCC']); __cm.sel('ms-nv3', ['ROTA']);
    const red = __cm.redesenha('onFilterChange');
    var _tw = document.querySelector('.tree-wrap'); if (_tw) { _tw.style.minWidth = '0'; _tw.style.width = 'max-content'; }
    await new Promise(r => setTimeout(r, 400));
    const el = document.querySelector('.tree-wrap') || document.querySelector('.tree');
    const sel = id => [...document.getElementById(id)._sel];
    const out = { faltou: __cm.faltou.slice(), red, vig: sel('ms-vig'), uni: sel('ms-uni'), nv3: sel('ms-nv3'),
      km: document.getElementById('v-kmReal').textContent, transf: el.style.transform || '' };
    __cm.topo(el); const h = __cm.abre(el);
    out.h = Math.round(h);
    if (window.html2canvas && window.H2CPrep) {
      const nodes = H2CPrep.preparar(el, true);
      try {
        const c = await html2canvas(el, { scale: 1, backgroundColor: '#F0F0F0', logging: false, onclone: H2CPrep.onclone });
        const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let dif = 0; for (let i = 0; i < px.length; i += 4 * 97) if (Math.abs(px[i] - 240) > 25) dif++;
        out.foto = { w: c.width, h: c.height, dif };
      } catch (e) { out.foto = { erro: e.message }; } finally { H2CPrep.limpar(nodes); }
    } else out.foto = { erro: 'sem html2canvas (' + typeof window.html2canvas + ')' };
    __cm.fecha();
    return out;
  }, CMH);
  // o número esperado: mesma conta no recorte MCC · ROTA · 08/2026, pelo próprio painel
  const esperado = await s.page.evaluate(() => { const f = { ano: [], vigencia: ['08/2026'], unidade: ['MCC'], nivel3: ['ROTA'] };
    return fmt(calcular(f).kmReal); });
  af('nenhum filtro faltou (vig em 5 grafias, MCC T2→MCC, ROTA)', r.faltou.length === 0, r.faltou.join(' | '));
  af('redesenho pelo onFilterChange', r.red === 'onFilterChange', r.red);
  af('filtros aplicados: 08/2026 · MCC · ROTA', JSON.stringify([r.vig, r.uni, r.nv3]) === JSON.stringify([['08/2026'], ['MCC'], ['ROTA']]), JSON.stringify([r.vig, r.uni, r.nv3]));
  af('a árvore mostra o recorte (Km Rodado real)', r.km === esperado, r.km + ' = ' + esperado);
  af('na janela do iframe a árvore não é escalada', r.transf === '', r.transf);
  af('foto do .tree-wrap sai com conteúdo', r.foto && r.foto.w > 1000 && r.foto.dif > 50, JSON.stringify(r.foto));
  af('zero erro de página', s.errs.length === 0, s.errs[0] || '');
  await s.ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

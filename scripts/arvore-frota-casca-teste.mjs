// ============================================================================
// Árvore de Custo da Frota na casca padrão — teste no Chromium, com o gviz
// dublado (o sandbox não alcança o Google). Roda o HTML ANTIGO e o NOVO com as
// MESMAS abas sintéticas (Frota e Receita Líquida do DRE, Dispersão de km e as
// três consultas da Seara) e confere:
//   1. cada card da árvore (raiz, pacotes, contas e as três leituras de cada
//      conta) sai com os MESMOS números e a MESMA cor de resultado nos dois
//      lados, em seis recortes aplicados pelo contrato dos filtros
//      (wrap._sel + _render + onFilterChange);
//   2. no novo: zero erro de página, sem rolagem da página nem da visão, a
//      árvore inteira dentro da área de cada visão (escala), conectores, cards
//      no vidro do padrão, texto das células sem estourar, cores de resultado,
//      PDF na lateral (um slide por visão), tema claro/escuro, lateral recolhida;
//   3. celular: árvore empilhada, página rolando.
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
// pasta com os .woff2 da Montserrat (fontsource): sem ela o Chromium mede o texto
// com a fonte de reserva e a régua de "rótulo cortado" não vale
const FONTE = process.env.FONTE_DIR || '';
const PASTA = '/arvore-frota/';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u === PASTA + 'antigo.html' ? ANTIGO : u.startsWith('/__fonte/') ? path.join(FONTE, path.basename(u)) : path.join(RAIZ, u);
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
const REC = { cols: ['Vigência', 'Orçado', 'Remunerado', 'Realizado', 'Nível 3'], rows: [] };
const DISP = { cols: ['Vigência', 'Dias Úteis', 'Unidade', 'PROJ. - COD', 'Km Rem. TT', 'Km Rodado TT', 'Frota Ativa', 'Km/Frota Ativa Rem.', 'Viagens - Real'], rows: [] };
const CONTAS = [
  // conta · custo remunerado base (por projeto e mês) · fator do realizado
  ['Consertos e Recapagens de Pneus', -18000, 1.08],
  ['Pneus e Camaras', -9000, 0.93],
  ['Pneus Novos', -26000, 1.12],
  ['Manutenção de Veículos e Equipamentos', -95000, 1.06],
  ['Materiais e Ferramentas de Oficina', -6500, 0.88],
  ['Lavação de Veículos', -4200, 1.02],
  ['Manutenção de Carrocerias', -12500, 1.21],
  ['Personalização/Padronização de Veículos', -2100, 0.71],
  ['Contratos de Manutenção Fabricante', -31000, 0.97],
  ['Combustíveis Veiculos e Equipamentos', -210000, 1.09],
  ['Fluídos (Arla)', -7800, 1.04],
  ['ICMS Crédito Presumido', 18000, 1],          // fora da árvore (EXCLUDE_CONTAS)
  ['Estorno de ICMS não Aproveitado', -3000, 1],  // fora da árvore (EXCLUDE_CONTAS)
  ['IPVA e Licenciamento de Veículos', -5000, 1], // Seguros e licenças: não está no PAC_ORDER
];
const PROJ = [
  // n3 · peso do custo · km rem · km real · frota ativa · viagens
  ['ROTA - GRL', 1.0, 61000, 63500, 22, 610],
  ['ROTA (VAN) - GRL', 0.25, 9000, 8700, 6, 210],
  ['EMPURRADA - PIR', 2.1, 152000, 171000, 18, 980],
  ['ROTA - MCC', 0.9, 58000, 63000, 20, 590],
  ['EMPURRADA - MCC', 1.4, 98000, 104000, 12, 640],
  ['ROTA - CBA', 0.7, 41000, 39500, 15, 420],
  ['APOIO - CBA', 0.3, 0, 0, 9, 0],               // Apoio: fora do escopo (só Transportes)
  ['DISTRIBUIÇÃO URBANA - ANG', 0.8, 0, 0, 0, 0], // Seara: km e frota da fonte própria
];
[[2026, 6, 0.97], [2026, 7, 1.0], [2026, 8, 1.07]].forEach(([y, m, k]) => {
  PROJ.forEach(([n3, peso, kmRem, kmReal, ativa, viag], i) => {
    CONTAS.forEach(([cta, base, fr], j) => {
      if (n3.startsWith('APOIO') && j > 3) return;
      const rem = Math.round(base * peso * k * (1 + .013 * i)), real = Math.round(rem * fr * (1 + .02 * ((i + j + m) % 4 - 1.5)));
      FROTA.rows.push([D(y, m), Math.round(rem * 1.03), rem, real, n3, cta]);
    });
    REC.rows.push([D(y, m), 0, Math.round(1450000 * peso * k), Math.round(1450000 * peso * k * (0.97 + .015 * i)), n3]);
    if (kmRem || ativa) DISP.rows.push([D(y, m), 22, n3.split(' - ')[1], n3, Math.round(kmRem * k), Math.round(kmReal * k * (1 + .01 * i)), ativa, Math.round(kmRem / (ativa || 1)), Math.round(viag * k)]);
  });
});
// mês orçado futuro, sem remunerado nem realizado (não pode aparecer no filtro de vigência)
FROTA.rows.push([D(2026, 12), -50000, 0, 0, 'ROTA - GRL', 'Pneus Novos']);
const SEARA = {
  ctes: { cols: ['B', 'year(D)', 'month(D)', 'count(A)'], rows: [] },
  rem: { cols: ['Vigência', 'sum KM'], rows: [['06/2026', 84100], ['07/2026', 87057], ['08/2026', 88070]] },
  comb: { cols: ['Mês', 'Ano', 'sum KM'], rows: [['junho', 2026, 86200], ['julho', 2026, 90110], ['agosto', 2026, 91950]] },
};
[[5, 610], [6, 640], [7, 655]].forEach(([mo, n]) => { for (let v = 0; v < n; v++) SEARA.ctes.rows.push(['V' + mo + '-' + v, 2026, mo, 2 + (v % 3)]); });
const ABAS = { 'Frota': FROTA, 'Receita Líquida': REC, 'Dispersão de km': DISP, 'Remunerado': SEARA.rem, 'g1672208132': SEARA.ctes, 'g1982300845': SEARA.comb };

const H2C_SRC = H2C && fs.existsSync(H2C) ? fs.readFileSync(H2C, 'utf8') : null;
// jsPDF dublado: conta as páginas e o nome do arquivo (a montagem é do pdf-export.js de verdade)
const JSPDF_STUB = `window.jspdf={jsPDF:function(){window.__PDF={paginas:1,imgs:0};this.addPage=function(){window.__PDF.paginas++;};
  this.addImage=function(d){window.__PDF.imgs++;window.__PDF.ultimo=String(d).slice(0,22);};this.save=function(f){window.__PDF.salvo=f;};}};`;

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
    if (mini) localStorage.setItem('arvfrota_mini', '1'); else localStorage.removeItem('arvfrota_mini');
    window.__GV = [];
    const resp = u => {
      const s = decodeURIComponent(u);
      const m = s.match(/sheet=([^&]+)/), g = s.match(/gid=(\d+)/);
      const nome = m ? m[1].replace(/\+/g, ' ') : g ? 'g' + g[1] : '';
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
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: !FONTE ? '' :
    [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Montserrat';font-style:normal;font-weight:${w};src:url(${BASE}/__fonte/montserrat-latin-${w}-normal.woff2) format('woff2');}`).join('\n') }));
  await page.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    if (/html2canvas/.test(u) && H2C_SRC) return r.fulfill({ status: 200, contentType: 'application/javascript', body: H2C_SRC });
    if (/jspdf/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: JSPDF_STUB });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  // o service worker do build-check recarrega a página na 1ª visita; fora do teste
  await page.route('**/sw.js', r => r.fulfill({ status: 404, body: '' }));
  await page.goto(BASE + PASTA + pagina, { waitUntil: 'load' });
  await page.waitForFunction(() => { const e = document.getElementById('titSub') || document.getElementById('status-badge');
    return e && /Atualizado|Erro/.test(e.textContent); }, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

// todos os cards da árvore, por caminho (raiz / pacote / pacote›conta / pacote›conta›leitura),
// com o texto e a classe de cada célula. Lê as visões escondidas também (textContent).
const VALS = () => {
  const o = {}, rep = [];
  const lab = c => c ? c.querySelector('.card-label').textContent.trim() : '?';
  document.querySelectorAll('.kpi-card').forEach(c => {
    let k;
    if (c.classList.contains('root-card')) k = 'raiz:' + lab(c);
    else if (c.classList.contains('pac-card')) k = 'pac:' + lab(c);
    else {
      const pac = lab(c.closest('.pac-block') && c.closest('.pac-block').querySelector('.pac-card'));
      if (c.classList.contains('conta-card')) k = 'conta:' + pac + '›' + lab(c);
      else k = 'leitura:' + pac + '›' + lab(c.closest('.conta-block').querySelector('.conta-card')) + '›' + lab(c);
    }
    const v = [...c.querySelectorAll('td')].map(td => td.textContent.trim() + '|' + (td.className || '').replace(/^cr-t$/, 'cr').replace(/^cg-t$/, 'cg')).join(' ; ');
    if (k in o) { if (o[k] !== v) rep.push(k); } else o[k] = v;
  });
  return { o, rep };
};
// o contrato dos filtros: _sel (Set) + _render + onFilterChange
const SEL = ({ id, v }) => { const w = document.getElementById(id); w._sel.clear(); v.forEach(x => w._sel.add(x)); w._render(''); onFilterChange(); };
const RECORTES = [
  ['padrão (última vigência)', []],
  ['Unidade PIR', [{ id: 'ms-uni', v: ['PIR'] }]],
  ['Projeto ROTA · 2 vigências', [{ id: 'ms-uni', v: [] }, { id: 'ms-vig', v: ['07/2026', '08/2026'] }, { id: 'ms-nv3', v: ['ROTA'] }]],
  ['Projeto DISTRIBUIÇÃO URBANA (Seara)', [{ id: 'ms-nv3', v: ['DISTRIBUIÇÃO URBANA'] }]],
  ['Ano 2026, todas as vigências', [{ id: 'ms-nv3', v: [] }, { id: 'ms-vig', v: [] }, { id: 'ms-ano', v: ['2026'] }]],
  ['Pacote Pneus + Combustíveis · MCC', [{ id: 'ms-ano', v: [] }, { id: 'ms-pac', v: ['Pneus', 'Combustíveis'] }, { id: 'ms-uni', v: ['MCC'] }]],
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
// rótulos de card cortados com reticências (o nome inteiro fica na dica), medidos na fonte real
const CORTADOS = () => [...document.querySelectorAll('.card-label')].filter(l => l.offsetWidth && l.scrollWidth > l.clientWidth + 1).map(l => l.textContent);
let A = null, cortA = null;
if (ANTIGO) {
  const a = await abre(browser, 'antigo.html');
  cortA = await a.page.evaluate(CORTADOS);
  A = { r: await percorre(a.page), errs: a.errs };
  await a.ctx.close();
}
const n = await abre(browser, 'index.html');
const cortN = [];
for (const v of ['resumo', 'pneus', 'manut', 'comb']) { await n.page.evaluate(v => setVw(v), v); await n.page.waitForTimeout(120); cortN.push(...await n.page.evaluate(CORTADOS)); }
await n.page.evaluate(() => setVw('resumo'));
const N = { r: await percorre(n.page), errs: n.errs, gv: await n.page.evaluate(() => window.__GV) };
af('novo: zero erro de página', N.errs.length === 0, N.errs[0] || '');
af('novo: leu as seis fontes (3 abas + 3 da Seara)', ['Frota', 'Receita Líquida', 'Dispersão de km', 'Remunerado', 'g1672208132', 'g1982300845'].every(x => N.gv.includes(x)), N.gv.join(' · '));
const num = s => s.split(' ; ').map(x => x.split('|')[0]).join(' ; ');
if (A) {
  af('antigo: zero erro de página', A.errs.length === 0, A.errs[0] || '');
  for (let i = 0; i < RECORTES.length; i++) {
    const [nome, va] = A.r[i], vn = N.r[i][1];
    const ka = Object.keys(va.o), kn = Object.keys(vn.o);
    const faltam = ka.filter(k => !(k in vn.o)), sobram = kn.filter(k => !(k in va.o));
    const difN = ka.filter(k => k in vn.o && num(va.o[k]) !== num(vn.o[k]));
    const difC = ka.filter(k => k in vn.o && va.o[k] !== vn.o[k] && !difN.includes(k));
    af(`${nome}: os mesmos ${ka.length} cards nos dois lados`, ka.length >= 7 && !faltam.length && !sobram.length, (faltam.concat(sobram)).join(', '));
    af(`${nome}: números iguais`, difN.length === 0, difN.map(k => `${k} ${num(va.o[k])} ≠ ${num(vn.o[k])}`).join(' | ') || num(vn.o['raiz:Custo Pacote Frota']));
    af(`${nome}: mesma cor de resultado (verde/vermelho)`, difC.length === 0, difC.join(', '));
    af(`${nome}: o pacote do Resumo = o da visão do pacote`, vn.rep.length === 0, vn.rep.join(', '));
  }
  af('rótulos cortados: o novo não corta mais que o antigo', cortN.length <= cortA.length, `antigo ${cortA.length} [${cortA.join(' · ')}] · novo ${cortN.length} [${cortN.join(' · ')}]`);
  const pad = N.r[0][1].o;
  af('Apoio e as contas de ICMS ficam fora (só Transportes)', !Object.keys(pad).some(k => /ICMS|IPVA|APOIO/i.test(k)), Object.keys(pad).filter(k => k.startsWith('conta:')).length + ' contas');
  af('Seara entra no Km Rodado com o projeto Distribuição Urbana', num(N.r[3][1].o['raiz:Km Rodado']).split(' ; ')[0] !== '0', num(N.r[3][1].o['raiz:Km Rodado']));
  af('filtro Pacote poda os pacotes', !Object.keys(N.r[5][1].o).some(k => k === 'pac:Manutenções') && 'pac:Pneus' in N.r[5][1].o);
}
await n.ctx.close();

/* ── 2. a casca nova ── */
const medeCasca = () => {
  const vw = document.querySelector('.vw.on');
  const area = vw.querySelector('.arv-area'), wrap = vw.querySelector('.tree-wrap');
  const ra = area.getBoundingClientRect(), rw = wrap.getBoundingClientRect();
  const de = document.documentElement;
  const card = vw.querySelector('.kpi-card');
  const side = getComputedStyle(document.body).getPropertyValue('--side').trim();
  const verm = getComputedStyle(document.body).getPropertyValue('--vermelho').trim();
  const tmp = document.createElement('i'); tmp.style.color = verm; document.body.appendChild(tmp); const vermRgb = getComputedStyle(tmp).color; tmp.remove();
  const tmp2 = document.createElement('i'); tmp2.style.background = side; document.body.appendChild(tmp2); const sideRgb = getComputedStyle(tmp2).backgroundColor; tmp2.remove();
  const tdCr = vw.querySelector('.kpi-table td.cr,.kpi-table td.cr-t');
  const estouro = [...vw.querySelectorAll('.kpi-table td,.kpi-table th')].filter(td => td.scrollWidth > td.clientWidth + 1).map(td => td.textContent);
  const lbl = [...vw.querySelectorAll('.card-label')].filter(l => l.scrollWidth > l.clientWidth + 1).map(l => l.textContent);
  return {
    pagRola: de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1 || document.body.scrollHeight > innerHeight + 1,
    vwRola: vw.scrollHeight > vw.clientHeight + 1 || vw.scrollWidth > vw.clientWidth + 1,
    dentro: rw.left >= ra.left - 1 && rw.right <= ra.right + 1 && rw.top >= ra.top - 1 && rw.bottom <= ra.bottom + 1,
    escala: (wrap.style.transform.match(/scale\(([\d.]+)\)/) || [, '1'])[1],
    linhas: vw.querySelectorAll('.tree-svg line').length, cards: vw.querySelectorAll('.kpi-card').length,
    cardBg: card ? getComputedStyle(card).backgroundColor : null, sideRgb,
    crCor: tdCr ? getComputedStyle(tdCr).color : null, vermRgb, temCr: !!tdCr,
    estouro, lbl,
    claro: document.body.classList.contains('claro'),
    pdf: !!document.querySelector('#pdf-slot button, #pdf-slot .s-item'),
    h2cprep: !!window.H2CPrep,
    tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
    itens: [...document.querySelectorAll('.s-item[data-vw]')].map(b => b.textContent.trim()),
    ids: ['ms-ano', 'ms-vig', 'ms-uni', 'ms-nv3', 'ms-pac'].every(i => document.getElementById(i) && document.getElementById(i)._sel instanceof Set && typeof document.getElementById(i)._render === 'function'),
  };
};
const VISOES = [['resumo', 'Resumo Gerencial'], ['pneus', 'Pneus'], ['manut', 'Manutenções'], ['comb', 'Combustíveis']];
for (const [w, h] of [[1600, 900], [1366, 768]]) for (const tema of ['dark', 'light']) {
  console.log(`\n══ 2 · casca ${w}×${h} · ${tema === 'light' ? 'claro' : 'escuro'}`);
  const s = await abre(browser, 'index.html', { w, h, tema });
  af('zero erro de página', s.errs.length === 0, s.errs[0] || '');
  af('tema ' + (tema === 'light' ? 'claro = body.claro' : 'escuro sem body.claro'), (await s.page.evaluate(() => document.body.classList.contains('claro'))) === (tema === 'light'));
  for (const [v, rot] of VISOES) {
    await s.page.evaluate(v => setVw(v), v); await s.page.waitForTimeout(250);
    const m = await s.page.evaluate(medeCasca);
    af(`${rot}: título, página e visão sem rolar`, m.tit === rot && !m.pagRola && !m.vwRola, m.tit);
    af(`${rot}: árvore inteira dentro da área (escala ${m.escala})`, m.dentro && +m.escala >= 0.55, `${m.cards} cards`);
    af(`${rot}: conectores desenhados`, m.linhas >= (v === 'resumo' ? 5 : 6), m.linhas + ' linhas');
    af(`${rot}: célula nenhuma estourando a largura`, !m.estouro.length, m.estouro.slice(0, 4).join(' · ') + (m.lbl.length ? ' | rótulo com reticências: ' + m.lbl.join(' · ') : ''));
    if (w === 1600 && tema === 'dark' && v === 'resumo') {
      af('card no vidro do padrão (fundo = --side)', m.cardBg === m.sideRgb, m.cardBg);
      af('Δ desfavorável em --vermelho', m.temCr && m.crCor === m.vermRgb, m.crCor);
      af('1ª visão "Resumo Gerencial" e as quatro visões no menu', m.itens.join(',') === VISOES.map(x => x[1]).join(','), m.itens.join(','));
      af('subtítulo com recorte + carga', /^08\/2026 · Atualizado/.test(m.sub), m.sub);
      af('Gerar PDF na lateral (Atalhos)', m.pdf);
      af('excel-export carregado (H2CPrep)', m.h2cprep);
      af('filtros com _sel (Set) e _render', m.ids);
    }
    if (SHOT && w === 1600) { fs.mkdirSync(SHOT, { recursive: true }); await s.page.screenshot({ path: path.join(SHOT, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) }); }
    if (SHOT && w === 1366 && tema === 'dark') await s.page.screenshot({ path: path.join(SHOT, `${v}-1366-escuro.png`) });
  }
  if (w === 1600 && tema === 'dark') {
    await s.page.evaluate(() => setVw('manut')); await s.page.waitForTimeout(250);
    // trocar o tema redesenha (conectores na cor do tema)
    const c0 = await s.page.evaluate(() => document.querySelector('.vw.on .tree-svg line').getAttribute('stroke'));
    await s.page.evaluate(() => trocaTema()); await s.page.waitForTimeout(200);
    const c1 = await s.page.evaluate(() => document.querySelector('.vw.on .tree-svg line').getAttribute('stroke'));
    af('trocar o tema redesenha os conectores', c0 !== c1 && (await s.page.evaluate(() => document.body.classList.contains('claro'))), c0 + ' → ' + c1);
    await s.page.evaluate(() => trocaTema()); await s.page.waitForTimeout(200);
    // lateral recolhida: a árvore se reajusta e continua dentro
    const e0 = (await s.page.evaluate(medeCasca)).escala;
    await s.page.evaluate(() => trocaMini()); await s.page.waitForTimeout(700);
    const m2 = await s.page.evaluate(medeCasca);
    af('lateral recolhida: árvore reescalada e dentro da área', m2.dentro && !m2.pagRola && +m2.escala >= +e0, e0 + ' → ' + m2.escala);
    if (SHOT) await s.page.screenshot({ path: path.join(SHOT, 'manut-mini-escuro.png') });
    await s.page.evaluate(() => trocaMini()); await s.page.waitForTimeout(500);
    // menu do filtro abre por cima e é opaco; contagem laranja aparece
    await s.page.click('#ms-uni .ms-btn'); await s.page.waitForTimeout(100);
    const pop = await s.page.evaluate(() => { const p = document.querySelector('#ms-uni .ms-panel'); return { aberto: p.classList.contains('open'), bg: getComputedStyle(p).backgroundColor, n: p.querySelectorAll('input[data-v]').length }; });
    af('filtro Unidade abre opaco com as unidades', pop.aberto && /rgb\(38, 38, 43\)/.test(pop.bg) && pop.n >= 4, pop.bg + ' · ' + pop.n);
    // filtro pelo clique de verdade muda os números
    const antes = await s.page.evaluate(() => document.querySelector('#manut-conta-0 td').textContent);
    await s.page.click('#ms-uni .ms-opt:has(input[data-v="CBA"]) .ms-only', { force: true }); await s.page.waitForTimeout(250);
    const depois = await s.page.evaluate(() => document.querySelector('#manut-conta-0 td').textContent);
    const cnt = await s.page.evaluate(() => { const c = document.querySelector('#ms-uni .ms-cnt'); return c.style.display + ' ' + (c.offsetWidth > 0) + ' ' + c.textContent; });
    af('clicar "only" em CBA muda a conta e mostra a contagem no filtro', antes !== depois && cnt === 'inline-block true 1', antes + ' → ' + depois + ' · ' + cnt);
    await s.page.mouse.click(5, 5);
    // Pacote = Pneus: a visão Manutenções diz que não há custo no filtro
    await s.page.evaluate(SEL, { id: 'ms-uni', v: [] });
    await s.page.evaluate(SEL, { id: 'ms-pac', v: ['Pneus'] }); await s.page.waitForTimeout(200);
    const vazio = await s.page.evaluate(() => document.querySelector('#vw-manut .arv-vazio')?.textContent || '');
    af('Pacote = Pneus: a visão Manutenções fica vazia com aviso', /Sem custos/.test(vazio), vazio);
    await s.page.evaluate(SEL, { id: 'ms-pac', v: [] }); await s.page.waitForTimeout(200);
    // PDF de verdade (pdf-export.js + html2canvas; jsPDF dublado): capa + um slide por visão
    if (H2C_SRC) {
      await s.page.click('#pdfBtn'); await s.page.waitForTimeout(150);
      await s.page.click('#pdfMenu button[data-mode="dark"]');
      await s.page.waitForFunction(() => window.__PDF && window.__PDF.salvo, null, { timeout: 60000 }).catch(() => {});
      const pdf = await s.page.evaluate(() => ({ ...(window.__PDF || {}), vw: VW, mini: document.querySelector('.side').classList.contains('mini') }));
      af('PDF: capa + 4 visões, nome arvore-frota, volta à visão e à lateral de antes', pdf.salvo && /^arvore-frota_escuro/.test(pdf.salvo) && pdf.paginas === 5 && pdf.vw === 'manut' && !pdf.mini, JSON.stringify(pdf));
    }
    af('zero erro de página depois de tudo', s.errs.length === 0, s.errs[0] || '');
  }
  await s.ctx.close();
}

/* ── celular ── */
{
  console.log('\n══ 2b · celular 390×844');
  const s = await abre(browser, 'index.html', { w: 390, h: 844 });
  await s.page.evaluate(() => setVw('manut')); await s.page.waitForTimeout(250);
  const m = await s.page.evaluate(() => {
    const vw = document.querySelector('.vw.on'), wrap = vw.querySelector('.tree-wrap'), cards = [...vw.querySelectorAll('.kpi-card')];
    return { trans: getComputedStyle(wrap).transform, larg: Math.max(...cards.map(c => c.getBoundingClientRect().right)),
      rola: getComputedStyle(document.body).overflowY, svg: getComputedStyle(vw.querySelector('.tree-svg')).display, n: cards.length };
  });
  af('zero erro de página', s.errs.length === 0, s.errs[0] || '');
  af('árvore empilhada, sem escala e sem conectores', m.trans === 'none' && m.svg === 'none', m.n + ' cards');
  af('cards cabem na largura do celular', m.larg <= 390, Math.round(m.larg) + 'px');
  af('a página volta a rolar no celular', m.rola === 'auto');
  if (SHOT) await s.page.screenshot({ path: path.join(SHOT, 'celular-manut.png'), fullPage: true });
  await s.ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

// Árvore de Combustível · Seara — migração para o layout padrão.
// Roda o painel ANTIGO (git show HEAD, salvo ao lado como _antigo_tmp.html) e o
// NOVO no Chromium, com o gviz dublado (fetch e JSONP) por abas sintéticas no
// formato das reais, e confere: os números da árvore saem IGUAIS nos dois lados
// (vigência padrão, um mês e todas); zero erro de página; a página não rola e a
// árvore cabe inteira em 1366×768 e 1600×900 (menu aberto e recolhido); tema
// claro/escuro; PDF na lateral; e o contrato do /check-metas/ (ms-vig + _sel +
// _render + onFilterChange + .tree-wrap encolhido) com foto real do html2canvas.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   cp scripts/combustivel-seara-arvore-casca-teste.mjs docs/driverpro-apresentacao/_arvseara.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento node _arvseara.mjs
// Variáveis: H2C (html2canvas.min.js local) · SHOT_DIR (prints) · ANTIGO (html antigo).
import { chromium } from 'playwright';
import fs from 'node:fs';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const PASTA = 'combustivel/seara/arvore';
const H2C = process.env.H2C || '';
const SHOT = process.env.SHOT_DIR || '';
const ANTIGO = process.env.ANTIGO || '';

// ── abas sintéticas ──────────────────────────────────────────────────────
const PLACAS = ['GAU6B24', 'STR4G70', 'RTX2C11', 'QWE1A23', 'ABC1234'];   // a última no formato antigo
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago'];
// Frota (DRE): A=0 vigência · E=4 nível 3 · F=5 conta · J=9 rem · K=10 real (custo negativo)
const FROTA = [];
for (let m = 0; m < 8; m++) {
  const vig = `Date(2026,${m},1)`;
  FROTA.push([vig,null,null,null,'ROTA - ANG','COMBUSTIVEIS VEICULOS E EQUIPAMENTOS',null,null,null,-(52000+m*900),-(55500+m*1300)]);
  FROTA.push([vig,null,null,null,'ROTA - ANG','ARLA',null,null,null,-3000,-3100]);                 // fora do pacote
  FROTA.push([vig,null,null,null,'ROTA - PIR','COMBUSTIVEIS VEICULOS E EQUIPAMENTOS',null,null,null,-90000,-95000]); // outra unidade
}
// Combustível: E=4 placa · F=5 mês · G=6 ano · H=7 modelo · K=10 km · L=11 litros · N=13 total R$
const COMB = [];
PLACAS.forEach((p, i) => { for (let m = 0; m < 8; m++) {
  const km = 4200 + i*530 + m*97, kmL = 3.1 + i*.07 - m*.01, lit = Math.round(km/kmL);
  COMB.push([null,null,null,null,p,MES[m],2026,'VW 24.280','','CAMINHÃO',km,lit,null,+(lit*(6.05+m*.03)).toFixed(2)]);
}});
// Remunerado (select A, B, D): vigência texto MM/AAAA · placa · km
const REM = [];
PLACAS.forEach((p, i) => { for (let m = 0; m < 8; m++)
  REM.push([`${String(m+1).padStart(2,'0')}/2026`, p === 'ABC1234' ? 'ABC1C34' : p, 4000 + i*480 + m*91]); });
// Base Remunerado (gid 0): colunas pelo nome — Vigência · … · Placa · … · KmPorLitro · … · PrecoDiesel
const BCOL = ['Vigência','x1','x2','Placa','x4','KmPorLitro','x6','PrecoDiesel'];
const BREM = [];
PLACAS.forEach((p, i) => { for (let m = 0; m < 7; m++)          // agosto sem base → cai no mês anterior
  BREM.push([`Date(2026,${m},1)`, null, null, p, null, 3.25 + i*.05, null, 5.9 + m*.02]); });

async function abre(browser, arquivo, { w = 1600, h = 900, tema = 'dark', mini = false } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ FROTA, COMB, REM, BREM, BCOL, tema, mini }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    if (mini) localStorage.setItem('arvseara_mini', '1'); else localStorage.removeItem('arvseara_mini');
    window.__PED = [];
    const corpo = u => {
      const d = decodeURIComponent(u);
      if (/1qcTy2pp/.test(u) && /sheet=Frota/.test(d)) return { rows: FROTA, cols: FROTA[0].map((_, i) => 'c' + i) };
      if (/sheet=Remunerado/.test(d)) return { rows: REM, cols: ['Vigência', 'Placa', 'KM'] };
      if (/gid=1982300845/.test(u)) return { rows: COMB, cols: COMB[0].map((_, i) => 'c' + i) };
      if (/gid=0(\b|&)/.test(u)) return { rows: BREM, cols: BCOL };
      return { rows: [], cols: ['A'] };
    };
    window.__resp = u => { window.__PED.push(u); const { rows, cols } = corpo(u);
      return JSON.stringify({ status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })),
        rows: rows.map(r => ({ c: r.map(v => (v == null ? null : { v })) })) } }); };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com'))
        return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${window.__resp(s)});`, { status: 200 }));
      if (s.startsWith('file:')) return real(u, i);
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = window.__resp(n.src);
        setTimeout(() => { if (fn && window[fn]) window[fn](JSON.parse(body)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { FROTA, COMB, REM, BREM, BCOL, tema, mini });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => {
    if (H2C && /html2canvas/.test(r.request().url()))
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(H2C, 'utf8') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.route('**/cdn.sheetjs.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.goto(`file://${RAIZ}/${PASTA}/${arquivo}`, { waitUntil: 'load' });
  await page.waitForFunction(() => { const e = document.getElementById('v-custoRem'); return e && e.textContent !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, errs };
}

const IDS = ['custoRem','custoReal','custoDelta','custoPct','rsKmRem','rsKmReal','rsKmDelta','rsKmPct','kmRem','kmReal','kmDelta','kmPct',
  'rsLRem','rsLReal','rsLDelta','rsLPct','kmLRem','kmLReal','kmLDelta','kmLPct','impPreco','impVolume'];
const leNumeros = page => page.evaluate(IDS => Object.fromEntries(IDS.map(k => {
  const e = document.getElementById('v-' + k); return [k, e ? e.textContent + '|' + e.className : null]; })), IDS);
// o MESMO caminho do /check-metas/: _render(''), mexe no _sel, chama onFilterChange
const filtraVig = (page, vigs) => page.evaluate(vigs => {
  const w = document.getElementById('ms-vig'); w._render('');
  w._sel.clear(); vigs.forEach(v => w._sel.add(v)); w._render(''); onFilterChange();
}, vigs).then(() => page.waitForTimeout(250));

let ok = 0, falha = 0;
const chk = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? ok++ : falha++; };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

// ── 1 · números: antigo × novo ───────────────────────────────────────────
console.log('\n══ números antigo × novo');
const lados = {};
for (const [nome, arq] of [['antigo', ANTIGO], ['novo', 'index.html']]) {
  if (!arq) { console.log('  (sem ANTIGO — pulando o lado antigo)'); continue; }
  const { page, errs } = await abre(browser, arq);
  const r = { padrao: await leNumeros(page) };
  await filtraVig(page, ['07/2026']); r.jul = await leNumeros(page);
  await filtraVig(page, []); r.todas = await leNumeros(page);
  await page.evaluate(() => { const w = document.getElementById('ms-ano'); w._sel.clear(); w._sel.add('2026'); w._render(''); onFilterChange(); });
  await page.waitForTimeout(200); r.ano = await leNumeros(page);
  r.errs = errs; lados[nome] = r;
  await page.close();
}
const n = lados.novo;
chk('novo: zero erro de página', n.errs.length === 0, n.errs.join(' | '));
console.log('   padrão (novo):', Object.entries(n.padrao).map(([k, v]) => k + '=' + v.split('|')[0]).join(' · '));
chk('novo: árvore preenchida (custo, km, km/L, impactos)', ['custoRem','kmReal','kmLRem','impPreco','impVolume'].every(k => !/^—|^0$/.test(n.padrao[k].split('|')[0])));
chk('novo: filtro de vigência muda os números', n.jul.custoReal !== n.todas.custoReal && n.jul.kmReal !== n.padrao.kmReal);
if (lados.antigo) {
  chk('antigo: zero erro de página', lados.antigo.errs.length === 0, lados.antigo.errs.join(' | '));
  for (const rec of ['padrao', 'jul', 'todas', 'ano']) {
    const dif = IDS.filter(k => lados.antigo[rec][k].split('|')[0] !== n[rec][k].split('|')[0]);
    chk(`valores iguais ao antigo (${rec})`, dif.length === 0, dif.map(k => `${k}: ${lados.antigo[rec][k]} × ${n[rec][k]}`).join(' ; '));
    // a cor do resultado (cr/cg) é a mesma regra
    const cor = IDS.filter(k => lados.antigo[rec][k].split('|')[1] !== n[rec][k].split('|')[1]);
    chk(`classes de cor iguais ao antigo (${rec})`, cor.length === 0, cor.join(','));
  }
}

// ── 2 · casca: sem rolagem, árvore inteira, temas ────────────────────────
for (const [w, h] of [[1366, 768], [1600, 900]]) for (const mini of [false, true]) for (const tema of ['dark', 'light']) {
  const { page, errs } = await abre(browser, 'index.html', { w, h, tema, mini });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const se = document.scrollingElement, pal = document.getElementById('arvPalco').getBoundingClientRect();
    const tr = document.getElementById('treeWrap').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.kpi-card,.impact-box')].map(c => c.getBoundingClientRect());
    const dentro = cards.every(c => c.left >= pal.left - 1 && c.right <= pal.right + 1 && c.top >= pal.top - 1 && c.bottom <= pal.bottom + 1);
    const tabs = [...document.querySelectorAll('.kpi-table')].every(t => t.scrollWidth <= t.clientWidth + 1);
    const vw = document.querySelector('.vw.on');
    return { rolaPag: se.scrollHeight > innerHeight + 1 || se.scrollWidth > innerWidth + 1, rolaVw: vw.scrollHeight > vw.clientHeight + 1,
      dentro, tabs, escala: (document.getElementById('treeWrap').style.transform || 'scale(1)'),
      claro: document.body.classList.contains('claro'), linhas: document.querySelectorAll('#treeSvg line').length,
      pdf: !!document.querySelector('#pdf-slot .s-item,#pdf-slot button'), tit: document.getElementById('tit').textContent,
      sub: document.getElementById('titSub').textContent, mini: document.querySelector('.side').classList.contains('mini'),
      larg: Math.round(tr.width), alt: Math.round(tr.height) };
  });
  const tag = `${w}×${h} ${mini ? 'mini' : 'menu'} ${tema}`;
  chk(`${tag}: sem erro · sem rolagem (página e visão) · árvore inteira no palco`,
    errs.length === 0 && !m.rolaPag && !m.rolaVw && m.dentro && m.tabs, JSON.stringify({ ...m, errs }));
  if (w === 1600 && !mini) {
    chk(`${tag}: tema ${tema === 'light' ? 'claro = body.claro' : 'escuro'} · conectores · PDF na lateral · título "Resumo Gerencial"`,
      m.claro === (tema === 'light') && m.linhas >= 10 && m.pdf && m.tit === 'Resumo Gerencial', `${m.linhas} linhas · sub "${m.sub}"`);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: `${SHOT}/resumo-${tema}.png` }); }
  }
  if (w === 1366 && mini && tema === 'dark' && SHOT) await page.screenshot({ path: `${SHOT}/resumo-1366-mini.png` });
  // trocar o tema pelo botão redesenha (conectores ficam) e grava bi_theme
  if (w === 1600 && !mini && tema === 'dark') {
    await page.click('#btTema'); await page.waitForTimeout(150);
    const t = await page.evaluate(() => ({ c: document.body.classList.contains('claro'), k: localStorage.getItem('bi_theme'), l: document.querySelectorAll('#treeSvg line').length }));
    chk('botão de tema: claro + bi_theme=light + conectores redesenhados', t.c && t.k === 'light' && t.l >= 10, JSON.stringify(t));
    await page.click('#btMini'); await page.waitForTimeout(400);
    const mm = await page.evaluate(() => ({ mini: document.querySelector('.side').classList.contains('mini'), k: localStorage.getItem('arvseara_mini') }));
    chk('recolher o menu grava arvseara_mini', mm.mini && mm.k === '1');
  }
  await page.close();
}

// ── 3 · celular: a árvore empilha e a página rola ────────────────────────
{
  const { page, errs } = await abre(browser, 'index.html', { w: 390, h: 844 });
  const m = await page.evaluate(() => {
    const cs = ['pos-custo','pos-rskm','pos-rsl','pos-kml','pos-kmrod','pos-preco','pos-volume'].map(i => document.getElementById(i).getBoundingClientRect());   // a ordem do painel antigo
    return { empilha: cs.every((c, i) => i === 0 || c.top >= cs[i - 1].bottom - 1), cabe: cs.every(c => c.right <= innerWidth + 1 && c.width > 300),
      horiz: document.scrollingElement.scrollWidth > innerWidth + 1, svg: getComputedStyle(document.getElementById('treeSvg')).display };
  });
  chk('celular 390px: nós empilhados na ordem, largura cheia, sem rolagem lateral, conectores ocultos',
    errs.length === 0 && m.empilha && m.cabe && !m.horiz && m.svg === 'none', JSON.stringify(m));
  if (SHOT) await page.screenshot({ path: `${SHOT}/celular.png`, fullPage: true });
  await page.close();
}

// ── 4 · contrato do /check-metas/ (Árvore Seara = unidade ANG) ───────────
{
  const { page, errs } = await abre(browser, 'index.html', { w: 1760, h: 990, tema: 'light' });
  const r = await page.evaluate(() => {
    // o check-metas chama aplicaTema('light') / applyTheme('light') e põe as classes
    ['aplicaTema', 'applyTheme', 'setTema'].forEach(f => { try { if (typeof window[f] === 'function') window[f]('light'); } catch (e) {} });
    document.body.classList.add('claro', 'light-mode');
    const w = document.getElementById('ms-vig');
    const temContrato = w && w._sel instanceof Set && typeof w._render === 'function' && typeof onFilterChange === 'function';
    w._render('');
    const opts = [...w.querySelectorAll('.ms-opt input[data-v]')].map(i => i.dataset.v);
    w._sel.clear(); w._sel.add('07/2026'); w._render(''); onFilterChange();
    const antes = document.getElementById('card-custo').getBoundingClientRect().left;
    const tw = document.querySelector('.tree-wrap'); tw.style.minWidth = '0'; tw.style.width = 'max-content';
    const depois = document.getElementById('card-custo').getBoundingClientRect().left;
    return { temContrato, opts, desloc: Math.abs(antes - depois), custo: document.getElementById('v-custoReal').textContent,
      alvo: !!(document.querySelector('.tree-wrap') || document.querySelector('.tree')), h2c: typeof window.H2CPrep };
  });
  chk('check-metas: ms-vig com _sel/_render + onFilterChange; vigência "07/2026" na lista', r.temContrato && r.opts.includes('07/2026'), r.opts.join(','));
  chk('check-metas: encolher o .tree-wrap não desloca os nós (conectores ficam no lugar)', r.desloc < 1, 'Δ ' + r.desloc + 'px');
  chk('check-metas: H2CPrep do excel-export disponível', r.h2c === 'object' || r.h2c === 'function', r.h2c);
  if (H2C) {
    await page.waitForTimeout(200);
    await page.addScriptTag({ path: H2C });
    const foto = await page.evaluate(async () => {
      const el = document.querySelector('.tree-wrap'); const prep = window.H2CPrep;
      const nodes = prep ? prep.preparar(el, true) : null;
      try {
        const c = await html2canvas(el, { scale: 2, backgroundColor: '#F0F0F0', useCORS: true, logging: false,
          onclone: d => { try { prep && prep.onclone && prep.onclone(d); } catch (e) {} } });
        return { w: c.width, h: c.height, png: c.toDataURL('image/png') };
      } finally { if (prep && prep.limpar) prep.limpar(nodes); }
    });
    chk('check-metas: foto da árvore pelo html2canvas (largura ≈ 2 × a grade)', foto.w > 2400 && foto.h > 400, `${foto.w}×${foto.h}`);
    if (SHOT) fs.writeFileSync(`${SHOT}/check-metas-foto.png`, Buffer.from(foto.png.split(',')[1], 'base64'));
  }
  chk('check-metas: zero erro de página', errs.length === 0, errs.join(' | '));
  await page.close();
}

await browser.close();
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

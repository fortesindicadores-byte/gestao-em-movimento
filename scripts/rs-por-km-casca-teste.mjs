// Migração do R$/KM (rs-por-km) para a casca padrão do portal — conferida no
// Chromium, nos DOIS lados.
//
// O gviz é dublado por FETCH (é o que o painel usa: fetchSheet para a aba Frota
// do DRE e a Dispersão de km, _gvizSeara para as abas Remunerado e Combustível
// da Seara). O shim gviz-cache.js fica no caminho, com o Supabase respondendo
// vazio, e cai no Google dublado. As abas saem de dados sintéticos no formato
// real (índices que o próprio painel lê: Frota vig=0 nv3=4 conta=5 orç=8 rem=9
// real=10, custo NEGATIVO como na aba; Dispersão vig=0 nv3=14 kmRem=31 kmReal=32).
// O MESMO roteiro roda no HTML antigo (git show HEAD:…) e no novo, e os números
// (hero, as quatro aberturas da tabela, os dois gráficos) têm de sair IGUAIS —
// antes e depois de filtrar, e no roteiro do /check-metas/ (vigência + setDim).
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:rs-por-km/index.html > /tmp/rskm-antigo.html
//   cp scripts/rs-por-km-casca-teste.mjs docs/driverpro-apresentacao/_rskm-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=/tmp/rskm-antigo.html CHART_JS=<chart.umd.js> SHOTS=<pasta> \
//     node _rskm-casca.mjs ; rm _rskm-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const CHART_JS = process.env.CHART_JS || '';
const SHOTS = process.env.SHOTS || '';
const ANTIGO = process.env.ANTIGO;
const ORIG = 'http://gem.teste';
const PASTA = 'rs-por-km';

// ── dados sintéticos ─────────────────────────────────────────────────────────
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const VIGS = [[2025, 10], [2025, 11]]; for (let m = 0; m <= 8; m++) VIGS.push([2026, m]);   // nov/25 → set/26
const FUT = [[2026, 9], [2026, 10]];                                                     // out–nov/26: só orçado
const NV3 = ['ROTA - PIR', 'EMPURRADA - PIR', 'ROTA - CBA', 'AS - CBA', 'ROTA - GRL', 'ROTA (VAN) - GRL',
             'Apoio - CBA', 'ROTA - FLP (INATIVO)', 'DISTRIBUIÇÃO URBANA - ANG'];
const CONTAS = { 'Combustíveis Veiculos e Equipamentos': 60000, 'Fluídos (Arla)': 3000, 'Manutenção de Veículos e Equipamentos': 25000,
  'Pneus e Camaras': 9000, 'Consertos e Recapagens de Pneus': 4000, 'Lavação de Veículos': 1500,
  'Contratos de Manutenção Fabricante': 7000, 'Manutenção de Carrocerias': 2500, 'Materiais e Ferramentas de Oficina': 1200,
  'Personalização/Padronização de Veículos': 600, 'IPVA e Licenciamento de Veículos': 5000, 'Seguro de Veículos e Equipamentos': 4000,
  'Estorno de ICMS não Aproveitado': -2000, 'Despesas Diversas de Frota': 800 };
const FROTA = [['VIGÊNCIA', 'c1', 'c2', 'c3', 'NÍVEL 3', 'CONTA GERENCIAL', 'c6', 'c7', 'ORÇADO', 'REMUNERADO', 'REALIZADO']];
VIGS.forEach(([y, m]) => NV3.forEach((nv, i) => Object.entries(CONTAS).forEach(([c, base]) => {
  if (nv.startsWith('DISTRIBUIÇÃO') && (y < 2026 || m < 3)) return;
  const esc = 0.6 + i * 0.15;
  const rem = -base * esc * (0.9 + rnd() * 0.2);
  const real = rem * (0.82 + rnd() * 0.36);
  const orc = rem * (0.95 + rnd() * 0.1);
  FROTA.push([`Date(${y},${m},1)`, null, null, null, nv, c, null, null, +orc.toFixed(2), +rem.toFixed(2), +real.toFixed(2)]);
})));
FUT.forEach(([y, m]) => NV3.slice(0, 3).forEach(nv => FROTA.push([`Date(${y},${m},1)`, null, null, null, nv, 'Combustíveis Veiculos e Equipamentos', null, null, -50000, 0, 0])));
const DISP = [];
VIGS.forEach(([y, m]) => NV3.filter(n => !n.startsWith('DISTRIBUIÇÃO')).forEach((nv, i) => {
  const r = Array(33).fill(null);
  r[0] = `Date(${y},${m},1)`; r[14] = nv;
  r[31] = Math.round(40000 + i * 9000 + rnd() * 20000);
  r[32] = Math.round(r[31] * (0.88 + rnd() * 0.24));
  DISP.push(r);
}));
// Seara: aba Remunerado (select A, sum(D) group by A) e aba Combustível (gid) — F mês · G ano · K km
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro'];
const SREM = [], SCOMB = [];
for (let m = 0; m <= 8; m++) {
  SREM.push([`${String(m + 1).padStart(2, '0')}/2026`, Math.round(70000 + rnd() * 20000)]);
  for (let p = 0; p < 6; p++) { const r = Array(11).fill(null); r[4] = 'RUR' + p; r[5] = MES[m]; r[6] = 2026; r[10] = Math.round(11000 + rnd() * 5000); SCOMB.push(r); }
}
const pack = (cols, rows) => ({ status: 'ok', table: { cols: cols.map(c => ({ id: c, label: c })),
  rows: rows.map(r => ({ c: r.map(v => v == null ? null : { v }) })) } });
const GVIZ = {
  'Frota': pack(FROTA[0].map((_, i) => 'c' + i), FROTA),          // 1ª linha = cabeçalho em texto (o useData a tira)
  'Dispersão de km': pack(DISP[0].map((_, i) => 'c' + i), DISP),
  'Remunerado': pack(['Vigência', 'sum KM'], SREM),
  'gid:1982300845': pack(['c0', 'c1', 'c2', 'c3', 'Placa', 'Mês', 'Ano', 'c7', 'c8', 'c9', 'Km Rodado'], SCOMB),
};

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(({ GVIZ, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_theme', tema);
    window.__gviz = [];
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(u && u.url || u);
      if (s.includes('docs.google.com')) {
        window.__gviz.push(s);
        const aba = decodeURIComponent((s.match(/sheet=([^&]+)/) || [])[1] || '');
        const gid = (s.match(/gid=(\d+)/) || [])[1];
        const body = GVIZ[aba] || GVIZ['gid:' + gid] || { status: 'ok', table: { cols: [], rows: [] } };
        return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(body)});`, { status: 200 }));
      }
      return real(u, i);
    };
  }, { GVIZ, tema });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('h-rsreal'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

const HERO = ['h-rsreal', 'h-rsrem', 'h-drem-v', 'h-drem-p', 'h-imp', 'h-ytd-v', 'h-ytd-p', 'h-ytd-imp'];
const leNumeros = (HERO) => {
  const t = id => (document.getElementById(id) || {}).textContent?.trim();
  const out = {}; HERO.forEach(id => out[id] = t(id));
  out.tabela = [...document.querySelectorAll('#body-rskm tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | '));
  out.cor = [...document.querySelectorAll('#body-rskm tr.total td')].map(c => c.className.replace(/\s+/g, ' ').trim()).join(',');
  out.sub = t('sub-rskm');
  out.grafRs = chRsKm ? JSON.stringify(chRsKm.data.datasets.map(d => d.data)) : null;
  out.grafImp = chImp ? JSON.stringify(chImp.data.datasets.map(d => d.data)) : null;
  return out;
};
const comparar = (rotulo, a, b) => {
  for (const k of Object.keys(a))
    ok(`igual antes × depois ${rotulo}: ${k}`, JSON.stringify(a[k]) === JSON.stringify(b[k]),
       `${JSON.stringify(a[k])} × ${JSON.stringify(b[k])}`.slice(0, 200));
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo — padrão, as 4 dimensões, filtro de unidade, roteiro do check-metas
console.log(`\n══ ${PASTA} · números ══`);
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  const r = { errs };
  r.base = await page.evaluate(leNumeros, HERO);
  for (const d of ['conta', 'uni', 'proj', 'pacote']) { await page.evaluate(d => setDim(d), d); r['dim-' + d] = await page.evaluate(leNumeros, HERO); }
  // filtro pelo contrato do check-metas (wrap._sel + _render + atualizar)
  await page.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel.clear(); w._sel.add('PIR'); w._render(''); atualizar(); });
  r.pir = await page.evaluate(leNumeros, HERO);
  r.pirCnt = await page.evaluate(() => { const c = document.querySelector('#ms-uni .ms-cnt'); return [c.textContent, getComputedStyle(c).display]; });
  // roteiro do /check-metas/: __cm.sel('ms-vig',[V]); atualizar(); setDim('conta'); alvo .tbl-section
  await page.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel.clear(); w._render(''); atualizar(); });
  await page.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel.clear(); w._sel.add('2026-08');
    if (typeof w._render === 'function') w._render(''); atualizar(); setDim('conta'); });
  r.cm = await page.evaluate(leNumeros, HERO);
  r.cmAlvo = await page.evaluate(() => { const el = document.querySelector('.tbl-section'); const t = el && el.querySelector('table');
    return t ? [...t.querySelectorAll('tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | ')) : null; });
  res[lado] = r;
  await ctx.close();
}
console.log('  antigo:', JSON.stringify({ ...res.antigo.base, grafRs: undefined, grafImp: undefined }));
console.log('  novo  :', JSON.stringify({ ...res.novo.base, grafRs: undefined, grafImp: undefined }));
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
ok('hero carregou com número', res.novo.base['h-rsreal'] && res.novo.base['h-rsreal'] !== '—', res.novo.base['h-rsreal']);
ok('tabela com linhas e total', res.novo.base.tabela.length > 2 && /^Total/.test(res.novo.base.tabela.at(-1)), res.novo.base.tabela.length + ' linhas');
comparar('(padrão)', res.antigo.base, res.novo.base);
for (const d of ['conta', 'uni', 'proj', 'pacote']) comparar(`(dim ${d})`, { tabela: res.antigo['dim-' + d].tabela }, { tabela: res.novo['dim-' + d].tabela });
comparar('(filtro PIR)', res.antigo.pir, res.novo.pir);
comparar('(check-metas ago/26 + Conta)', res.antigo.cm, res.novo.cm);
ok('check-metas: .tbl-section acha a MESMA tabela', JSON.stringify(res.antigo.cmAlvo) === JSON.stringify(res.novo.cmAlvo), (res.novo.cmAlvo || []).length + ' linhas');
ok('check-metas: tabela por Conta', res.novo.cmAlvo && /^CONTA/.test(res.novo.cmAlvo[0]), (res.novo.cmAlvo || [''])[0].slice(0, 40));
ok('check-metas: subtítulo AGO/26', res.novo.cm.sub === 'AGO/26', res.novo.cm.sub);
ok('filtro muda os números', res.novo.pir['h-rsreal'] !== res.novo.base['h-rsreal']);
ok('contagem laranja do filtro aparece', res.novo.pirCnt[0] === '1' && res.novo.pirCnt[1] !== 'none', JSON.stringify(res.novo.pirCnt));

// 2 · cards do Resumo: componentes do hero + melhor/pior unidade, pela mesma conta do hero
{
  const { ctx, page } = await abre(browser, null, { width: 1600, height: 900 }, 'dark');
  const c = await page.evaluate(() => {
    const t = id => document.getElementById(id).textContent.trim();
    const f = lastF, ar = filterMes(allRows, f), ak = filterKmRows(allKmRows, f);
    const km = sumKm(ak), cu = sumCusto(agg(ar, f.cta));
    // refaz o hero por unidade com as funções do painel e confere o ranking
    const unis = [...new Set(ak.map(r => r.uni))];
    const lst = unis.map(u => { const k = sumKm(ak.filter(r => r.uni === u)), x = sumCusto(agg(ar.filter(r => getUniLabel(r[C.nv3]) === u), f.cta));
      const re = x.real / k.real, rm = x.rem / k.rem; return { u, d: (rm - re) / Math.abs(rm) * 100 }; }).sort((a, b) => a.d - b.d);
    const out = { custo: t('k-custo'), custoEsp: fmtBrl(cu.real), km: t('k-km'), kmEsp: fmtBrl(km.real),
      rsHero: t('h-rsreal'), rsConta: rsKm(cu.real / km.real),
      mel: document.querySelector('#k-mel .kn')?.textContent, melEsp: lst[0].u,
      pio: document.querySelector('#k-pio .kn')?.textContent, pioEsp: lst.at(-1).u,
      melL: t('k-mel-l') };
    // uma unidade só → desce para projeto
    const w = document.getElementById('ms-uni'); w._sel.clear(); w._sel.add('PIR'); w._render(''); atualizar();
    out.melL1 = t('k-mel-l'); out.mel1 = document.querySelector('#k-mel .kn')?.textContent;
    return out;
  });
  console.log('  cards:', JSON.stringify(c));
  ok('card Custo realizado = componente do hero', c.custo === c.custoEsp && c.custo !== '—', c.custo);
  ok('card Km realizado = componente do hero', c.km === c.kmEsp && c.km !== '—', c.km);
  ok('custo ÷ km = R$/KM do hero', c.rsHero === c.rsConta, `${c.rsHero} × ${c.rsConta}`);
  ok('melhor unidade vs remunerado', c.mel === c.melEsp, `${c.mel} × ${c.melEsp}`);
  ok('pior unidade vs remunerado', c.pio === c.pioEsp && c.pio !== c.mel, `${c.pio} × ${c.pioEsp}`);
  ok('uma unidade só → compara projetos', /projeto/.test(c.melL1) && ['ROTA', 'EMPURRADA'].includes(c.mel1), `${c.melL1}: ${c.mel1}`);
  await ctx.close();
}

// 3 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    for (const v of ['resumo', 'detalhado']) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(350);
      for (const d of (v === 'detalhado' ? ['pacote', 'conta'] : [null])) {
        if (d) { await page.evaluate(d => setDim(d), d); await page.waitForTimeout(100); }
        const m = await page.evaluate(() => {
          const se = document.scrollingElement, vw = document.querySelector('.vw.on');
          const tw = [...vw.querySelectorAll('.twrap')];
          const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
          const blocos = [...vw.querySelectorAll('.gcard,.tsec,.kpi')].map(c => c.getBoundingClientRect());
          const kpis = [...vw.querySelectorAll('.kpi')].map(c => Math.round(c.getBoundingClientRect().height));
          return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
                   vwRola: vw.scrollHeight > vw.clientHeight + 1,
                   horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
                   tabRola: tw.some(t => t.scrollHeight > t.clientHeight + 1),
                   canv, kpis, foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
                   thAlto: [...vw.querySelectorAll('thead tr')].map(tr => Math.round(tr.getBoundingClientRect().height)).filter(h => h > 70),
                   thAlin: [...vw.querySelectorAll('thead th')].map(th => getComputedStyle(th).textAlign).join(','),
                   totBg: (() => { const td = vw.querySelector('tr.total td'); return td ? getComputedStyle(td).backgroundColor : null; })(),
                   cabBg: (() => { const th = vw.querySelector('thead th'); return th ? getComputedStyle(th).backgroundColor : null; })(),
                   tit: document.getElementById('tit').textContent };
        });
        const vt = v + (d ? '/' + d : '');
        ok(`${tag} · ${vt}: visão abre (${m.tit})`, m.id === 'vw-' + v);
        ok(`${tag} · ${vt}: página não rola`, !m.pagRola);
        ok(`${tag} · ${vt}: a visão não transborda`, !m.vwRola);
        ok(`${tag} · ${vt}: tabela sem barra horizontal`, !m.horiz);
        ok(`${tag} · ${vt}: nada fora da tela`, !m.foraTela);
        ok(`${tag} · ${vt}: cabeçalho de tabela numa linha só`, !m.thAlto.length, m.thAlto.join(','));
        if (m.canv.length) ok(`${tag} · ${vt}: gráficos com altura`, m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
        if (m.kpis.length) ok(`${tag} · ${vt}: cards com altura (≥ 104px)`, m.kpis.every(h => h >= 104), m.kpis.join(','));
        if (d) {
          ok(`${tag} · ${vt}: cabeçalho alinhado (texto à esq., números à dir.)`, m.thAlin === 'left' + ',right'.repeat(8), m.thAlin);
          ok(`${tag} · ${vt}: total no tom do cabeçalho`, m.totBg && m.totBg === m.cabBg, `${m.totBg} × ${m.cabBg}`);
        }
        if (SHOTS && vp.width === 1600) {
          const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${v}${d && d !== 'pacote' ? '-' + d : ''}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
        }
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="resumo"]');
      const antes = await page.evaluate(() => [document.body.classList.contains('claro'), chRsKm && chRsKm.options.scales.x.ticks.color]);
      await page.click('#btTema'); await page.waitForTimeout(250);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), chRsKm && chRsKm.options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
      ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
      await page.click('#btTema'); await page.waitForTimeout(150);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG no botão direito)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(() => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === '202610062300' && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }));
      // botão direito na tabela abre o menu com Excel
      await page.click('.s-item[data-vw="detalhado"]'); await page.waitForTimeout(200);
      await page.click('#body-rskm tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => /Exportar Excel/i.test(e.textContent) && e.children.length === 0 && e.offsetParent).length);
      ok('botão direito na tabela: menu "Exportar Excel"', menu > 0);
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // ordenação da tabela (sortable-table.js) — clicar no cabeçalho reordena
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#body-rskm tr:not(.total)')].map(tr => tr.cells[0].textContent).join(','));
      await page.click('#tbl-rskm thead th:nth-child(3)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#body-rskm tr:not(.total)')].map(tr => tr.cells[0].textContent).join(','));
      ok('ordenação pelo cabeçalho continua', s1 !== s2, `${s1} → ${s2}`.slice(0, 160));
      // atualizar dados (recarregar) refaz a leitura
      const n0 = await page.evaluate(() => window.__gviz.length);
      await page.click('.side .s-item[onclick="recarregar()"]'); await page.waitForTimeout(600);
      const n1 = await page.evaluate(() => [window.__gviz.length, document.getElementById('titSub').textContent]);
      ok('"Atualizar dados" relê as abas e escreve no subtítulo', n1[0] > n0 && /Atualizado/.test(n1[1]), `${n0} → ${n1[0]} · ${n1[1]}`);
      // lateral recolhida + dica
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe (chave rskm_mini)', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('rskm_mini') === '1'));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      ok('dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Resumo Gerencial'; }));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}
// 4 · celular: a página volta a rolar, gráficos com altura, tabela compacta com "+ Ver detalhes"
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: document.scrollingElement.scrollHeight > innerHeight,
    canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
  ok('celular: página rola e gráficos com altura', m.rola && m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  await page.click('.s-item[data-vw="detalhado"]'); await page.waitForTimeout(200);
  const t = await page.evaluate(() => ({ btn: getComputedStyle(document.getElementById('tbl-detail-toggle')).display,
    cols: [...document.querySelectorAll('#tbl-rskm thead th')].filter(th => getComputedStyle(th).display !== 'none').length }));
  await page.click('#tbl-detail-toggle'); await page.waitForTimeout(100);
  const t2 = await page.evaluate(() => [...document.querySelectorAll('#tbl-rskm thead th')].filter(th => getComputedStyle(th).display !== 'none').length);
  ok('celular: tabela compacta (4 colunas) e "+ Ver detalhes" mostra as 9', t.btn !== 'none' && t.cols === 4 && t2 === 9, `${t.btn} · ${t.cols} → ${t2}`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-detalhado.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

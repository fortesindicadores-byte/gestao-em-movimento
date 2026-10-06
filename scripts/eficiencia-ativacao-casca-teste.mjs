// Migração da Ativação de Frota (eficiencia-ativacao) para a casca padrão do
// portal — conferida no Chromium, nos DOIS lados.
//
// O painel lê UMA aba por gviz/FETCH: a `Dispersão de km` (vig=0, unidade
// reserva=13, "PROJETO - UNIDADE"=14, frota ativa=21, viagens=22, km rem=31,
// km real=32). A frota realizada é viagens ÷ dias úteis (seg–sáb), e na
// EMPURRADA ÷ 2. O shim gviz-cache.js fica no caminho, com o Supabase
// respondendo vazio, e cai no Google dublado. Os dados são sintéticos no
// formato real, com 2025 inteiro (para o YoY) e 2026 até setembro.
// O MESMO roteiro roda no HTML antigo (git show HEAD:…) e no novo, e os números
// (hero, tabela por Unidade e por Projeto, os quatro gráficos) têm de sair
// IGUAIS — no padrão, filtrando unidade, vigência e ano.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:eficiencia-ativacao/index.html > /tmp/ativ-antigo.html
//   cp scripts/eficiencia-ativacao-casca-teste.mjs docs/driverpro-apresentacao/_ativ-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=/tmp/ativ-antigo.html CHART_JS=<chart.umd.js> DL_JS=<chartjs-plugin-datalabels.min.js> \
//     SHOTS=<pasta> node _ativ-casca.mjs ; rm _ativ-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const CHART_JS = process.env.CHART_JS || '';
const DL_JS = process.env.DL_JS || '';
const SHOTS = process.env.SHOTS || '';
const ANTIGO = process.env.ANTIGO;
const ORIG = 'http://gem.teste';
const PASTA = 'eficiencia-ativacao';
const BUILD = '202610070020';

// ── dados sintéticos: Dispersão de km ────────────────────────────────────────
let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const VIGS = []; for (let m = 0; m < 12; m++) VIGS.push([2025, m]); for (let m = 0; m <= 8; m++) VIGS.push([2026, m]);
const PU = ['ROTA - PIR', 'EMPURRADA - PIR', 'ROTA - CBA', 'AS - CBA', 'EMPURRADA - CBA', 'ROTA - GRL', 'ROTA (VAN) - GRL',
            'ROTA - CGR', 'AS - MCC', 'ROTA - MCC', 'ROTA - FLP', 'ROTA - NFR', 'ROTA - PLT', 'ROTA - BLC', 'ROTA - RON'];   // as 10 unidades reais
const du = (y, m) => { let n = 0; const d = new Date(y, m, 1); while (d.getMonth() === m) { if (d.getDay() !== 0) n++; d.setDate(d.getDate() + 1); } return n; };
const DISP = [];
VIGS.forEach(([y, m]) => PU.forEach((pu, i) => {
  const r = Array(33).fill(null);
  const ativa = 6 + i * 3 + Math.round(rnd() * 4);
  const fator = 0.82 + rnd() * 0.24;
  const emp = pu.startsWith('EMPURRADA');
  r[0] = `Date(${y},${m},1)`; r[13] = pu.split('-')[1].trim(); r[14] = pu;
  r[21] = ativa;
  r[22] = Math.round(ativa * fator * du(y, m) * (emp ? 2 : 1));
  r[31] = Math.round(40000 + i * 9000 + rnd() * 20000);
  r[32] = Math.round(r[31] * (0.88 + rnd() * 0.24));
  DISP.push(r);
}));
// linha sem km (o parse descarta: rem = real = 0)
{ const r = Array(33).fill(null); r[0] = 'Date(2026,8,1)'; r[14] = 'ROTA - XXX'; r[21] = 10; r[22] = 200; DISP.push(r); }
const pack = (cols, rows) => ({ status: 'ok', table: { cols: cols.map(c => ({ id: c, label: c })),
  rows: rows.map(r => ({ c: r.map(v => v == null ? null : { v }) })) } });
const GVIZ = { 'Dispersão de km': pack(DISP[0].map((_, i) => 'c' + i), DISP) };

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
        const body = GVIZ[aba] || { status: 'ok', table: { cols: [], rows: [] } };
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
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('datalabels') && DL_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(DL_JS) });
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('hero-atvc'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

const HERO = ['hero-atvc', 'hero-val', 'hero-ativo', 'd-abs', 'd-pct', 'd-yoy', 'd-ytd-abs', 'd-ytd-pct', 'd-ytd-yoy'];
const leNumeros = (HERO) => {
  const t = id => (document.getElementById(id) || {}).textContent?.trim();
  const out = {}; HERO.forEach(id => out[id] = t(id));
  out.corHero = (document.getElementById('hero-atvc') || {}).className;
  out.tabela = [...document.querySelectorAll('#tbl-body tr, #tbl-foot tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | '));
  out.corTab = [...document.querySelectorAll('#tbl-body td, #tbl-foot td')].map(c => (c.className.match(/\bc[rgy]\b/) || [''])[0]).join(',');
  const ds = c => c ? JSON.stringify({ l: c.data.labels, d: c.data.datasets.map(d => d.data) }) : null;
  out.gDisp = ds(chDisp); out.gMes = ds(chAtvcMes); out.gProj = ds(chProj); out.gUnd = ds(chUnd);
  return out;
};
const comparar = (rotulo, a, b) => {
  for (const k of Object.keys(a))
    ok(`igual antes × depois ${rotulo}: ${k}`, JSON.stringify(a[k]) === JSON.stringify(b[k]),
       `${JSON.stringify(a[k])} × ${JSON.stringify(b[k])}`.slice(0, 200));
};
// contrato de filtro (o mesmo que o /check-metas/ usa): wrap._sel + _render + redesenho
const filtra = (page, id, vals) => page.evaluate(([id, vals]) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); w._render(''); render(); }, [id, vals]);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo
console.log(`\n══ ${PASTA} · números ══`);
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  const r = { errs };
  r.base = await page.evaluate(leNumeros, HERO);
  r.vigPadrao = await page.evaluate(() => [...document.getElementById('ms-vig')._sel]);
  await page.evaluate(() => setDrill('proj')); r.proj = await page.evaluate(leNumeros, HERO);
  await page.evaluate(() => setDrill('und'));
  await filtra(page, 'ms-und', ['PIR']); r.pir = await page.evaluate(leNumeros, HERO);
  r.pirCnt = await page.evaluate(() => { const c = document.querySelector('#ms-und .ms-cnt'); return [c.textContent, getComputedStyle(c).display]; });
  await filtra(page, 'ms-und', []);
  await filtra(page, 'ms-vig', ['06/2026', '07/2026', '08/2026']); r.tri = await page.evaluate(leNumeros, HERO);
  await filtra(page, 'ms-proj', ['EMPURRADA']); r.emp = await page.evaluate(leNumeros, HERO);
  await filtra(page, 'ms-proj', []); await filtra(page, 'ms-vig', []);
  await filtra(page, 'ms-ano', ['2025']); r.ano = await page.evaluate(leNumeros, HERO);
  res[lado] = r;
  await ctx.close();
}
console.log('  antigo:', JSON.stringify({ ...res.antigo.base, tabela: undefined, gDisp: undefined, gMes: undefined, gProj: undefined, gUnd: undefined, corTab: undefined }));
console.log('  novo  :', JSON.stringify({ ...res.novo.base, tabela: undefined, gDisp: undefined, gMes: undefined, gProj: undefined, gUnd: undefined, corTab: undefined }));
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
ok('hero carregou com número', res.novo.base['hero-atvc'] && res.novo.base['hero-atvc'] !== '—', res.novo.base['hero-atvc']);
ok('vigência padrão = mês anterior (set/26)', JSON.stringify(res.novo.vigPadrao) === '["09/2026"]', JSON.stringify(res.novo.vigPadrao));
ok('tabela com linhas e total', res.novo.base.tabela.length > 5 && /^TOTAL UNIDADES/.test(res.novo.base.tabela.at(-1)), res.novo.base.tabela.length + ' linhas');
ok('tabela com cores de faixa (cg/cy/cr)', /cg/.test(res.novo.base.corTab) && /cr/.test(res.novo.base.corTab), res.novo.base.corTab.slice(0, 80));
comparar('(padrão)', res.antigo.base, res.novo.base);
comparar('(drill Projeto)', { tabela: res.antigo.proj.tabela }, { tabela: res.novo.proj.tabela });
comparar('(filtro PIR)', res.antigo.pir, res.novo.pir);
comparar('(jun→ago/26)', res.antigo.tri, res.novo.tri);
comparar('(jun→ago/26 + EMPURRADA)', res.antigo.emp, res.novo.emp);
comparar('(ano 2025)', res.antigo.ano, res.novo.ano);
ok('filtro muda os números', res.novo.pir['hero-atvc'] !== res.novo.base['hero-atvc'] || res.novo.pir['hero-val'] !== res.novo.base['hero-val']);
ok('contagem laranja do filtro aparece', res.novo.pirCnt[0] === '1' && res.novo.pirCnt[1] !== 'none', JSON.stringify(res.novo.pirCnt));

// 2 · cards do Resumo: componentes do hero + melhor/pior unidade, pela mesma conta do hero
{
  const { ctx, page } = await abre(browser, null, { width: 1600, height: 900 }, 'dark');
  const c = await page.evaluate(() => {
    const t = id => document.getElementById(id).textContent.trim();
    const F = getFiltered();
    const real = avgMonthly(F, 'frota_real'), ativo = avgMonthly(F, 'frota_ativa');
    const unis = [...new Set(F.map(r => r.und))];
    const lst = unis.map(u => { const g = F.filter(r => r.und === u); const re = avgMonthly(g, 'frota_real'), at = avgMonthly(g, 'frota_ativa');
      return { u, d: (re - at) / at * 100 }; }).sort((a, b) => b.d - a.d);
    const out = { real: t('hero-val'), realEsp: numFmt(real), ativo: t('hero-ativo'), ativoEsp: numFmt(ativo),
      atvc: t('hero-atvc'), atvcConta: pctFmt0(real / ativo * 100),
      mel: document.querySelector('#k-mel .kn')?.textContent, melEsp: lst[0].u,
      pio: document.querySelector('#k-pio .kn')?.textContent, pioEsp: lst.at(-1).u, melL: t('k-mel-l'),
      tab1: document.querySelector('#tbl-body tr td')?.textContent };
    const w = document.getElementById('ms-und'); w._sel.clear(); w._sel.add('CBA'); w._render(''); render();
    out.melL1 = t('k-mel-l'); out.mel1 = document.querySelector('#k-mel .kn')?.textContent;
    out.sub = t('titSub');
    return out;
  });
  console.log('  cards:', JSON.stringify(c));
  ok('card Frota realizada = componente do hero', c.real === c.realEsp && c.real !== '—', c.real);
  ok('card Frota ativa = componente do hero', c.ativo === c.ativoEsp && c.ativo !== '—', c.ativo);
  ok('realizada ÷ ativa = Ativação % do hero', c.atvc === c.atvcConta, `${c.atvc} × ${c.atvcConta}`);
  ok('melhor unidade vs ativo (= 1ª da tabela, que é ranqueada pelo Δ)', c.mel === c.melEsp, `${c.mel} × ${c.melEsp} · tabela ${c.tab1}`);
  ok('pior unidade vs ativo', c.pio === c.pioEsp && c.pio !== c.mel, `${c.pio} × ${c.pioEsp}`);
  ok('uma unidade só → compara projetos', /projeto/.test(c.melL1) && ['ROTA', 'AS', 'EMPURRADA'].includes(c.mel1), `${c.melL1}: ${c.mel1}`);
  ok('subtítulo com recorte e carga', /^SET\/2026 · Atualizado/.test(c.sub), c.sub);
  await ctx.close();
}

// 3 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    for (const v of ['resumo', 'projetos']) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(400);
      for (const d of (v === 'projetos' ? ['und', 'proj'] : [null])) {
        if (d) { await page.evaluate(d => setDrill(d), d); await page.waitForTimeout(100); }
        const m = await page.evaluate(() => {
          const se = document.scrollingElement, vw = document.querySelector('.vw.on');
          const tw = [...vw.querySelectorAll('.twrap')];
          const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
          const blocos = [...vw.querySelectorAll('.gcard,.tsec,.kpi')].map(c => c.getBoundingClientRect());
          const kpis = [...vw.querySelectorAll('.kpi')].map(c => Math.round(c.getBoundingClientRect().height));
          return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
                   vwRola: vw.scrollHeight > vw.clientHeight + 1,
                   horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
                   vert: tw.some(t => t.scrollHeight > t.clientHeight + 1),
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
        if (v === 'projetos') ok(`${tag} · ${vt}: todas as linhas da tabela à vista, sem barra vertical`, !m.vert);
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
          await page.screenshot({ path: path.join(dir, `${v}${d && d !== 'und' ? '-' + d : ''}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
        }
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      const antes = await page.evaluate(() => [document.body.classList.contains('claro'), chDisp && chDisp.options.scales.x.ticks.color]);
      await page.click('#btTema'); await page.waitForTimeout(250);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), chDisp && chDisp.options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
      ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
      await page.click('#btTema'); await page.waitForTimeout(150);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG no botão direito)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('filters-toggle.js saiu, ctrlk.js e gviz-cache.js ficaram', !exp.srcs.some(s => s.includes('filters-toggle')) && exp.srcs.some(s => s.includes('ctrlk.js')) && exp.srcs.some(s => s.includes('gviz-cache.js')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(b => { const m = (document.querySelector('meta[name=build]') || {}).content; return !!m && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + (document.querySelector('meta[name=build]') || {}).content)); }, BUILD));
      // botão direito na tabela abre o menu com Excel
      await page.click('.s-item[data-vw="projetos"]'); await page.waitForTimeout(200);
      await page.click('#tbl-body tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent : ''; });
      ok('botão direito na tabela: menu "Exportar Excel"', /Exportar Excel/.test(menu), menu.trim().slice(0, 80));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // ordenação da tabela (sortable-table.js) — clicar no cabeçalho reordena
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#tbl-body tr')].map(tr => tr.cells[0].textContent).join(','));
      await page.click('#tbl-ativ thead th:nth-child(2)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#tbl-body tr')].map(tr => tr.cells[0].textContent).join(','));
      ok('ordenação pelo cabeçalho continua', s1 !== s2, `${s1} → ${s2}`.slice(0, 160));
      // atualizar dados refaz a leitura
      const n0 = await page.evaluate(() => window.__gviz.length);
      await page.click('.side .s-item[onclick="atualizar()"]'); await page.waitForTimeout(700);
      const n1 = await page.evaluate(() => [window.__gviz.length, document.getElementById('titSub').textContent]);
      ok('"Atualizar dados" relê a aba e escreve no subtítulo', n1[0] > n0 && /Atualizado/.test(n1[1]), `${n0} → ${n1[0]} · ${n1[1]}`);
      // lateral recolhida + dica
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe (chave ativacao_mini)', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('ativacao_mini') === '1'));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      ok('dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Resumo Gerencial'; }));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}
// 4 · celular: a página volta a rolar, gráficos com altura, tabela compacta com "+ Detalhar"
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: document.scrollingElement.scrollHeight > innerHeight || document.body.scrollHeight > document.body.clientHeight + 1,
    canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
  ok('celular: página rola e gráficos com altura', m.rola && m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  await page.click('.s-item[data-vw="projetos"]'); await page.waitForTimeout(700);
  const vis = () => [...document.querySelectorAll('#tbl-ativ thead th')].filter(th => getComputedStyle(th).display !== 'none').length;
  const t = await page.evaluate(vis => ({ cols: eval(vis)(), mt: !!document.querySelector('#vw-projetos .mt-detail-btn'), pg: !!document.querySelector('#tbl-det-toggle') }), vis.toString());
  if (t.mt) await page.click('#vw-projetos .mt-detail-btn'); else await page.click('#tbl-det-toggle');
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(vis => eval(vis)(), vis.toString());
  ok('celular: tabela compacta e o "+ detalhes" abre a completa', t.cols < 9 && t2 === 9, `${t.cols} → ${t2} (${t.mt ? 'mobile.js' : 'botão da página'})`);
  const lin = await page.evaluate(() => document.querySelectorAll('#tbl-body tr').length);
  ok('celular: tabela com linhas', lin > 2, String(lin));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-projetos.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

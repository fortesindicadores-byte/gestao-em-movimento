// Migração da Manutenção (manutencao/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// Dublês: o gviz da aba de NFs (JSONP; o shim gviz-cache.js fica no caminho,
// com o Supabase respondendo vazio para as sh_*/gviz_snapshot, e cai no Google
// dublado), o ramos.json é o de verdade (servido do repositório), e a base de
// ativos (ginfo_snapshot['ativos'] + ativos_manual) vem do Supabase dublado,
// lida pelo supabase-js real (SBJS). Chart.js real via CHART_JS + DATALABELS.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 42239fd:manutencao/index.html > /tmp/.../mnt-antigo.html   (o último antes da casca)
//   cp scripts/manutencao-casca-teste.mjs docs/driverpro-apresentacao/_mnt-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<html antigo> CHART_JS=<chart.umd.js> DATALABELS=<datalabels.min.js> \
//     SBJS=<supabase umd> SHOTS=<pasta> node _mnt-casca.mjs ; rm _mnt-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const CHART_JS = process.env.CHART_JS || '';
const DATALABELS = process.env.DATALABELS || '';
const SBJS = process.env.SBJS || '';
const SHOTS = process.env.SHOTS || '';
const ORIG = 'http://gem.teste';
const PASTA = 'manutencao';

// ── dados sintéticos no formato da aba (rótulos que o idxDe do painel acha) ──
const RAMOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manutencao/ramos.json'), 'utf8'));
const porRamo = {}; for (const [f, r] of Object.entries(RAMOS)) (porRamo[r] = porRamo[r] || []).push(f);
const FORNS = Object.values(porRamo).flatMap(a => a.slice(0, 3)).concat(['FORNECEDOR SEM CADASTRO LTDA']);
const COLS = ['Vigência', 'Data', 'Nível 3', 'DESC. CC', 'Conta Gerencial', 'Fornecedor', 'Histórico', 'Natureza', 'Documento', 'Realizado'];
const N3 = ['ROTA - PIR', 'EMPURRADA - PIR', 'AUTO SERVIÇO - CBA', 'APOIO - CBA', 'ROTA - GRL', 'ROTA (VAN) - GRL', 'INSUMOS - PIR (INATIVO)'];
const CONTAS = ['Manutenção Veículos', 'Peças e Acessórios', 'Serviços de Terceiros', 'Lavagem de Veículos'];
const CCS = ['MANUT FROTA PIR', 'MANUT FROTA CBA', 'OFICINA GRL', 'MANUT EMPILHADEIRAS'];
const NATS = ['SERVIÇO', 'MATERIAL'];
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ROWS = [];
for (const [m, y] of [[6, 2026], [7, 2026], [8, 2026]]) {
  for (let k = 0; k < 220; k++) {
    const dia = 1 + Math.floor(rnd() * 28);
    const f = FORNS[Math.floor(rnd() * FORNS.length)];
    ROWS.push([String(m).padStart(2, '0') + '/' + y, `Date(${y},${m - 1},${dia})`, N3[Math.floor(rnd() * N3.length)],
      CCS[Math.floor(rnd() * CCS.length)], CONTAS[Math.floor(rnd() * CONTAS.length)], f,
      'NF de ' + (rnd() > .5 ? 'serviço de reparo no sistema de freio, troca de lonas e regulagem, placa ABC1D23 — ordem de serviço aberta pela oficina' : 'peças'),
      NATS[Math.floor(rnd() * 2)], 'NF' + (10000 + ROWS.length), -Math.round((80 + rnd() * 9000) * 100) / 100]);
  }
}
const GVIZ = { status: 'ok', table: { cols: COLS.map(c => ({ id: c, label: c })), rows: ROWS.map(r => ({ c: r.map(v => v == null ? null : { v }) })) } };
// frota (formato do export do Ginfo) + ativos manuais da ANG
const ATIV = [];
[['PIRAI EMPURRADA', 'EMPURRADA', 14], ['CDD CUIABA', 'AS', 9], ['CDD CUIABA', 'ARMAZEM', 5], ['CDD GUARULHOS', 'ROTA', 20],
 ['CDD GUARULHOS', 'VANS', 4], ['CDD GUARULHOS', 'FRETEIRO', 3], ['PIRAI EMPURRADA', 'LATA', 6]]
  .forEach(([fil, pj, n]) => { for (let i = 0; i < n; i++) ATIV.push({ Filial: fil, Projeto: pj, Placa: `${fil.slice(0, 3)}${pj.slice(0, 1)}${1000 + i}` }); });
const MANUAL = [{ placa: 'ANG0001', unidade: 'ANG', projeto: 'ROTA' }, { placa: 'ANG0002', unidade: 'ANG', projeto: 'ROTA' }];

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
    localStorage.setItem('bi_theme', tema);
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = JSON.parse(JSON.stringify(GVIZ));
        setTimeout(() => { if (fn && window[fn]) window[fn](body); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { GVIZ, tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net') {
      if (u.pathname.includes('chart.js') && CHART_JS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
      if (u.pathname.includes('datalabels') && DATALABELS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(DATALABELS) });
      if (u.pathname.includes('supabase-js') && SBJS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    }
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      const json = b => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (u.pathname.endsWith('/ginfo_snapshot')) {
        const obj = { data: ATIV };
        return json((req.headers()['accept'] || '').includes('object') ? obj : [obj]);
      }
      if (u.pathname.endsWith('/ativos_manual')) return json(MANUAL);
      return json([]);
    }
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('hero-nfs'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}

// números da tela, lidos pelos ids (iguais nos dois lados) e pelas tabelas
const leNumeros = () => {
  const t = id => (document.getElementById(id) || {}).textContent?.trim();
  const out = {}; ['hero-nfs', 'hero-real', 'hero-forn', 'hero-cc', 'hero-ativos', 'hero-cma'].forEach(id => out[id] = t(id));
  const novo = !!document.querySelector('.app');
  const secs = [...document.querySelectorAll('#content .tbl-section')];
  const tGrp = novo ? document.getElementById('tbl-grp') : secs[1]?.querySelector('table');
  const tDet = novo ? document.getElementById('tbl-det') : secs[2]?.querySelector('table');
  const tDia = novo ? document.getElementById('tbl-diag') : secs[3]?.querySelector('table');
  const linhas = (tb, n) => [...(tb ? tb.querySelectorAll('tbody tr') : [])].slice(0, n).map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  const cab = tb => tb ? [...tb.querySelectorAll('thead th')].map(c => c.textContent.trim()).join(' | ') : null;
  out.grpCab = cab(tGrp); out.grp = linhas(tGrp, 999).join(' ;; ');
  out.detCab = cab(tDet); out.detN = tDet ? tDet.querySelectorAll('tbody tr').length : 0; out.det = linhas(tDet, 25).join(' ;; ');
  out.detSub = novo ? t('det-sub') : secs[2]?.querySelector('.tbl-sub')?.textContent.trim();
  out.diagWarn = (novo ? document.getElementById('diag-warn') : secs[3]?.querySelector('.warn-box'))?.textContent.replace(/\s+/g, ' ').trim();
  out.diag = linhas(tDia, 99).join(' ;; ');
  const ch = id => { const c = document.getElementById(id); const k = c && window.Chart && Chart.getChart(c); return k ? JSON.stringify([k.data.labels, k.data.datasets[0].data]) : null; };
  out.chVal = ch('ch-val'); out.chPct = ch('ch-pct');
  out.filtros = [...document.querySelectorAll('.ms-wrap')].map(w => w.id + ':' + (w._items || []).length).join(',');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base e depois de filtros/dimensão/ordenação
console.log('\n══ números: antigo × novo ══');
const passos = {
  base: null,
  'filtro Unidade=PIR': () => { const w = document.getElementById('ms-uni'); w._sel.clear(); w._sel.add('PIR'); render(); },
  'dimensão Ramo': () => setDim('ramo'),
  'ordena Fornecedor (detalhe) e nome (grupo)': () => { setDSort('forn'); setGSort('nome'); },
  'filtro Vigência=08/2026 + Projeto=ROTA': () => { const w = document.getElementById('ms-vig'); w._sel.clear(); w._sel.add('08/2026');
    const p = document.getElementById('ms-proj'); p._sel.clear(); p._sel.add('ROTA'); render(); },
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  res[lado] = { errs };
  for (const [nome, fn] of Object.entries(passos)) {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(200); }
    res[lado][nome] = await page.evaluate(leNumeros);
  }
  await ctx.close();
}
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
const b = res.novo.base;
console.log('  novo base:', JSON.stringify({ nfs: b['hero-nfs'], real: b['hero-real'], forn: b['hero-forn'], cc: b['hero-cc'], ativos: b['hero-ativos'], cma: b['hero-cma'], detN: b.detN, filtros: b.filtros }));
ok('hero carregou com número', b['hero-nfs'] && b['hero-nfs'] !== '—', b['hero-nfs']);
ok('ativos lidos do Supabase dublado', b['hero-ativos'] && b['hero-ativos'] !== '—', b['hero-ativos']);
ok('gráficos com dados', !!b.chVal && !!b.chPct);
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) ok(`igual antes × depois [${nome}]: ${k}`, JSON.stringify(A[k]) === JSON.stringify(N[k]),
    JSON.stringify(A[k]) === JSON.stringify(N[k]) ? '' : `${String(A[k]).slice(0, 90)} × ${String(N[k]).slice(0, 90)}`);
}
ok('filtro muda os números', res.novo['filtro Unidade=PIR']['hero-nfs'] !== b['hero-nfs'] && res.novo['filtro Unidade=PIR']['hero-ativos'] !== b['hero-ativos'],
  `${b['hero-nfs']} → ${res.novo['filtro Unidade=PIR']['hero-nfs']} · ativos ${b['hero-ativos']} → ${res.novo['filtro Unidade=PIR']['hero-ativos']}`);

// 2 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
const VISOES = ['resumo', 'grupo', 'detalhe', 'diag'];
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    for (const v of VISOES) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const se = document.scrollingElement, vw = document.querySelector('.vw.on');
        const tw = [...vw.querySelectorAll('.twrap')];
        const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
        const blocos = [...vw.querySelectorAll('.gcard,.tsec,.kpi,.fin-hero,.dist-head,.mapfoot')].map(c => c.getBoundingClientRect());
        const kpi = [...vw.querySelectorAll('.kpis .kpi')].map(k => k.getBoundingClientRect().height);
        const top = document.querySelector('.top').getBoundingClientRect();
        return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
          vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
          canv, kpi, foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
          sobra: (() => { const last = blocos.reduce((a, r) => Math.max(a, r.bottom), 0); return Math.round(document.querySelector('.cols').getBoundingClientRect().bottom - 24 - last); })(),
          topH: Math.round(top.height), tit: document.getElementById('tit').textContent };
      });
      ok(`${tag} · ${v}: visão abre (${m.tit})`, m.id === 'vw-' + v);
      ok(`${tag} · ${v}: página não rola`, !m.pagRola);
      ok(`${tag} · ${v}: a visão não transborda`, !m.vwRola);
      ok(`${tag} · ${v}: tabela sem barra horizontal`, !m.horiz);
      ok(`${tag} · ${v}: nada fora da tela`, !m.foraTela);
      if (m.canv.length) ok(`${tag} · ${v}: gráficos com altura`, m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
      if (m.kpi.length) ok(`${tag} · ${v}: cards com altura (≥ 100px)`, m.kpi.every(h => h >= 100), m.kpi.map(Math.round).join(','));
      if (v === 'resumo') ok(`${tag} · resumo: sem faixa vazia embaixo (≤ 40px)`, m.sobra <= 40, m.sobra + 'px · topo ' + m.topH + 'px');
      if (SHOTS && vp.width === 1600) {
        const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      const antes = await page.evaluate(() => [document.body.classList.contains('claro'), chQ && chQ.options.scales.x.ticks.color]);
      await page.click('#btTema'); await page.waitForTimeout(300);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), chQ && chQ.options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
      ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js continua', exp.srcs.some(s => s.includes('ctrlk.js')));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(() => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === '202610070015' && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }));
      // menu do Excel/PNG abre no clique direito da tabela
      await page.click('.s-item[data-vw="grupo"]'); await page.waitForTimeout(200);
      await page.click('#tbl-grp tbody td', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // contagem laranja do filtro aparece e o filtro pelo painel (clique "só") funciona
      await page.click('#ms-uni .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-uni .ms-only[data-v="CBA"]').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-uni .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('hero-nfs').textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      // ordenação pelo cabeçalho do detalhe
      await page.click('.s-item[data-vw="detalhe"]'); await page.waitForTimeout(200);
      await page.click('#tbl-det thead th:nth-child(3)'); await page.waitForTimeout(200);
      ok('ordenação pelo cabeçalho (Fornecedor ▲)', await page.evaluate(() => /▲|▼/.test(document.querySelector('#tbl-det thead th:nth-child(3)').textContent)));
      // lateral recolhida
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda manutencao_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('manutencao_mini') === '1'));
      ok('contrato do check-metas: wrap._sel (Set) + wrap._render', await page.evaluate(() => { const w = document.getElementById('ms-vig'); return w._sel instanceof Set && typeof w._render === 'function'; }));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · erro de leitura: a mensagem aparece no lugar das visões
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { sessionStorage.setItem('gem_hub', '1');
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) { if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) { setTimeout(() => n.onerror && n.onerror(), 5); return n; } return ap.call(this, n); }; });
  await page.route('**/*', r => { const u = new URL(r.request().url());
    if (u.origin === ORIG) { const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' }); }
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
  await page.goto(`${ORIG}/${PASTA}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('titSub').textContent === 'Erro ao carregar', null, { timeout: 20000 }).catch(() => {});
  const m = await page.evaluate(() => [document.getElementById('titSub').textContent, getComputedStyle(document.getElementById('gate')).display]);
  ok('erro de leitura: mensagem no lugar das visões', m[0] === 'Erro ao carregar' && m[1] === 'block', m.join(' · '));
  await ctx.close();
}

// 4 · celular: a página volta a rolar e o gráfico tem altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: document.scrollingElement.scrollHeight > innerHeight || document.body.scrollHeight > document.body.clientHeight + 1,
    canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
  ok('celular: página rola e gráficos com altura', m.rola && m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

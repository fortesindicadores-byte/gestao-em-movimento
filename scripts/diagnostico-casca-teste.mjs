// Migração do Diagnóstico (diagnostico/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// O painel lê:
//   · GerotBase.load() (ICs do elite_snapshot) — DUBLADO: o arquivo assets/gerot-base.js
//     é servido como um stub que devolve registros prontos {unit, vig, field, atg};
//   · reserva: aba Base RPM por /export?format=csv (quando o elite vem vazio);
//   · gviz JSONP: aba DPO (sheet=DPO) e FCA Total (gid=216663799).
// O shim gviz-cache.js fica no caminho, com as tabelas sh_*/gviz_snapshot vazias,
// e cai no "Google" dublado. O SwrCache (IndexedDB) nasce vazio a cada contexto.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 179afa3:diagnostico/index.html > <scratch>/antigo.html   (o último antes da casca)
//   cp scripts/diagnostico-casca-teste.mjs docs/driverpro-apresentacao/_diag-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGO=<html antigo> \
//     SBJS=<supabase.js umd> FONT_DIR=<@fontsource/montserrat/files> SHOTS=<pasta> \
//     node _diag-casca-x1.mjs ; rm _diag-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const SBJS = process.env.SBJS;
const FONT_DIR = process.env.FONT_DIR || '';
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070300';
const ORIG = 'http://gem.teste';
const PASTA = 'diagnostico';

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r1 = v => Math.round(v * 10) / 10;

// ── ICs (GerotBase): 13 unidades × jan→ago/2026, cada uma com o seu "nível" e uma tendência ──
const NOMES = ['CDD CAMBORIU', 'CDD CUIABA', 'CDD FLORIANOPOLIS', 'CDD GUARULHOS', 'CDD NOVA FRIBURGO', 'CDD PELOTAS', 'CDD RIO DE JANEIRO', 'CDD RONDONOPOLIS', 'CDI MACACU', 'CUIABA', 'CUIABA EMPURRADA', 'MACACU EMPURRADA', 'PIRAI EMPURRADA'];
const CAMPOS = ['disp', 'prev', 'comb', 'pneus', 'checkT', 'checkWH', 'conf', 'stVeic', 'stEmp', 'sla', 'civf'];
const ELITE = [];
NOMES.forEach((u, iu) => {
  const base = 62 + (iu * 37 % 13) * 3;                 // 62 … 98: espalha as unidades pelas quatro faixas
  const queda = iu % 4 === 1;                            // algumas caem mês a mês (streak)
  for (let m = 1; m <= 8; m++) for (const f of CAMPOS) {
    if (f === 'checkWH' && !/RIO|PELOTAS|^CUIABA$/.test(u)) continue;
    if (f === 'stEmp' && /EMPURRADA/.test(u)) continue;
    const v = base + (rnd() - .5) * 14 + (queda ? (8 - m) * 2.2 : 0) + (f === 'comb' ? 6 : 0);
    ELITE.push({ unit: u, vig: `2026-${String(m).padStart(2, '0')}`, field: f, atg: r1(Math.max(35, v)) });
  }
});
ELITE.push({ unit: 'CDD PELOTAS', vig: '2026-08', field: 'mttr', atg: 10, soGerot: true });   // adicional do Gerot: não pontua
ELITE.push({ unit: 'UNIDADE FORA', vig: '2026-03', field: 'disp', atg: 10 });                 // fora do UNI_SET
const COD2UNIT = { CBA: 'CDD CUIABA', PEL: 'CDD PELOTAS' };
const gerotStub = recs => `window.GerotBase={COD2UNIT:${JSON.stringify(COD2UNIT)},load:function(){return new Promise(function(ok){setTimeout(function(){ok(${JSON.stringify(recs)});},20);});}};`;

// ── Base RPM (CSV, reserva): Unidade · Vigência · KPI · % de Ating. ──
const KPIS = ['IC: % de Disponibilidade Equipamentos', 'IC: % de Aderência às Preventivas', 'IC: Consumo Km/l', 'IC: % de Aderência às Aferições', 'IC: Aderência ao Checklist - T1 e T2', 'IC: % de conformidade da Frota', 'IC: SLA de atendimento'];
let CSV = 'Unidade,Vigência,KPI,% de Ating.\n';
NOMES.forEach((u, iu) => { for (let m = 1; m <= 6; m++) for (const k of KPIS) CSV += `${u},01/${String(m).padStart(2, '0')}/2026,${k},"${(70 + ((iu * 7 + m * 3 + k.length) % 30)).toFixed(1).replace('.', ',')}%"\n`; });

// ── DPO: 1ª linha = cabeçalho; código = 1º token; o pior nível entre tiers vale ──
const DPO = [['Unidade', '1H25', '2H25', '1H26'],
  ['CBA T1', 'Nível 3', 'Nível 3', 'Nível 4'], ['CBA T2', 'Nível 2', 'Nível 3', 'Nível 4'],
  ['PEL', 'Nível 3', 'Nível 4', 'Nível 4'], ['GRL', 'Nível 2', 'Nível 2', 'Nível 2'],
  ['MCC T1', 'Nível 3', 'Nível 3', 'Nível 3'], ['MCC T2', 'Nível 3', 'Nível 3', 'Nível 4'],
  ['NFR', 'Nível 2', 'Nível 3', 'Nível 3'], ['CGR', 'Nível 1', 'Nível 2', 'Nível 2'], ['PIR', 'Nível 4', 'Nível 4', 'Nível 5']];
// ── FCA Total: 1 data · 2 código · 7 prazo · 8 status ──
const CODS = ['BLC', 'CBA', 'FLP', 'GRL', 'NFR', 'PEL', 'CGR', 'RON', 'MCC', 'PIR'];
const STS = ['Concluída', 'Em andamento', 'Não iniciada'];
const FCA = [];
CODS.forEach((c, ic) => { for (let m = 0; m < 8; m++) for (let i = 0; i < 3; i++) {
  const r = Array(10).fill(null); r[1] = `Date(2026,${m},${5 + i})`; r[2] = c + (i === 1 ? ' (T2)' : '');
  r[7] = `Date(2026,${m + (ic % 3)},20)`; r[8] = STS[(ic + i + m) % 3 === 0 || ic % 5 === 0 ? 0 : (ic + i) % 3]; FCA.push(r);
} });
const ABAS = { 'sheet=DPO': DPO, 'gid=216663799': FCA };

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema, eliteVazio = false) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const google = [];
  await page.addInitScript(({ ABAS, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.removeItem('diagnostico_mini');
    const gv = rows => ({ status: 'ok', table: { cols: (rows[0] || []).map(() => ({ id: 'A', label: '' })),
      rows: rows.map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const src = decodeURIComponent(n.src);
        const k = Object.keys(ABAS).find(k => src.includes(k));
        setTimeout(() => { if (fn && window[fn]) window[fn](k ? gv(JSON.parse(JSON.stringify(ABAS[k]))) : { status: 'error' }); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { ABAS, tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      if (u.pathname.endsWith('/assets/gerot-base.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: gerotStub(eliteVazio ? [] : ELITE) });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'docs.google.com') {   // a Base RPM em CSV (reserva)
      google.push(u.pathname + u.search);
      if (u.pathname.includes('/export')) return r.fulfill({ status: 200, contentType: 'text/csv', body: CSV });
      return r.fulfill({ status: 200, contentType: 'text/plain', body: 'google.visualization.Query.setResponse({"status":"error"});' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('supabase-js'))
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '[]' });
    }
    if (u.hostname === 'fonts.googleapis.com') {
      const css = FONT_DIR ? [400, 500, 600, 700, 800].flatMap(w => ['latin', 'latin-ext'].map(sub =>
        `@font-face{font-family:'Montserrat';font-style:normal;font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/m/montserrat-${sub}-${w}-normal.woff2) format('woff2');}`)).join('\n') : '';
      return r.fulfill({ status: 200, contentType: 'text/css', body: css });
    }
    if (u.hostname === 'fonts.gstatic.com') {
      const f = FONT_DIR && path.join(FONT_DIR, path.basename(u.pathname));
      if (f && fs.existsSync(f)) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#grid .uc').length >= 3, null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, errs, google };
}

// contagens + cards, lidos igual nos dois lados
const leNumeros = () => {
  const out = {};
  out.resumo = [...document.querySelectorAll('#resumo > div')].map(d => [...d.children].map(c => c.textContent.trim()).join(' = '));
  out.cards = [...document.querySelectorAll('#grid .uc')].map(c => ({
    faixa: [...c.classList].filter(x => x !== 'uc').join(''),
    nome: c.querySelector('.uc-name').textContent, cod: c.querySelector('.uc-code').textContent,
    pont: c.querySelector('.uc-score').textContent, n4: (c.querySelector('.n4') || {}).textContent || '',
    diag: [...c.querySelectorAll('.diag > *')].map(e => e.textContent.trim()),
    chips: [...c.querySelectorAll('.chip')].map(e => e.className + ':' + e.textContent.trim()) }));
  out.vigs = [...document.querySelectorAll('#ms-vig .ms-opt input[data-v]')].map(i => i.dataset.v + (i.checked ? '*' : '')).join(',');
  out.unis = [...document.querySelectorAll('#ms-uni .ms-opt input[data-v]')].map(i => i.dataset.v).join(',');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); if (w._render) w._render(''); atualizar(); };
const passos = {
  base: null,
  'Vigência mar/26': `(${sel})('ms-vig',['mar/26'])`,
  'Vigência jan→jun (média)': `(${sel})('ms-vig',['jan/26','fev/26','mar/26','abr/26','mai/26','jun/26'])`,
  'Unidade PELOTAS + MACACU (ago/26)': `(${sel})('ms-vig',['ago/26']);(${sel})('ms-uni',['CDD PELOTAS','CDI MACACU'])`,
  'Todas as vigências e unidades': `(${sel})('ms-uni',[]);(${sel})('ms-vig',[])`,
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  res[lado] = { errs };
  for (const [nome, fn] of Object.entries(passos)) {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(250); }
    res[lado][nome] = await page.evaluate(leNumeros);
  }
  await ctx.close();
}
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
const b = res.novo.base;
console.log('  novo base: ' + b.resumo.join(' · ') + '\n    ' + b.cards.map(c => `${c.nome} ${c.pont} [${c.faixa}] ${c.diag.length} linhas`).join('\n    '));
ok('13 unidades com card, piores primeiro', b.cards.length === 13 && b.cards.every((c, i, a) => i === 0 || parseFloat(a[i - 1].pont.replace(',', '.')) <= parseFloat(c.pont.replace(',', '.'))));
ok('as quatro faixas aparecem no recorte', ['g', 'y', 'o', 'r'].every(f => b.cards.some(c => c.faixa === f)), b.cards.map(c => c.faixa).join(''));
ok('cruzamentos DPO e FCA aparecem nos cards', b.cards.some(c => /DPO/.test(c.diag.join(' ') + c.n4)) && b.cards.some(c => /FCA/.test(c.diag.join(' '))));
ok('a última vigência com dado vem marcada', /ago\/26\*$/.test(b.vigs), b.vigs);
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    const igual = JSON.stringify(A[k]) === JSON.stringify(N[k]);
    ok(`igual antes × depois [${nome}]: ${k}`, igual, igual ? '' : `${JSON.stringify(A[k]).slice(0, 300)} × ${JSON.stringify(N[k]).slice(0, 300)}`);
  }
}
ok('filtro de vigência muda os números', JSON.stringify(res.novo['Vigência mar/26'].cards) !== JSON.stringify(b.cards));
ok('filtro de unidade deixa só as duas', res.novo['Unidade PELOTAS + MACACU (ago/26)'].cards.map(c => c.nome).sort().join(',') === 'CDD PELOTAS,CDI MACACU');

// reserva: elite_snapshot vazio → Base RPM (CSV), nos dois lados
{
  const r = {};
  for (const lado of ['antigo', 'novo']) {
    const { ctx, page, errs, google } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1366, height: 768 }, 'dark', true);
    r[lado] = { n: await page.evaluate(leNumeros), errs, csv: google.some(g => /export\?format=csv/.test(g)) };
    await ctx.close();
  }
  ok('elite vazio: os dois lados caem na Base RPM (CSV)', r.antigo.csv && r.novo.csv);
  ok('elite vazio: mesmos números antes × depois', JSON.stringify(r.antigo.n) === JSON.stringify(r.novo.n) && r.novo.n.cards.length === 13, r.novo.n.resumo.join(' · '));
  ok('elite vazio: zero erro de página', !r.novo.errs.length, r.novo.errs.join(' / '));
}

// casca: sem rolagem, visão, tema, exportação — 1366×768 e 1600×900
const mede = () => {
  const se = document.scrollingElement, vw = document.querySelector('.vw.on'), g = document.getElementById('grid');
  const r = { id: vw.id, tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
    pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
    vwRola: vw.scrollHeight > vw.clientHeight + 1, gHoriz: g.scrollWidth > g.clientWidth + 1,
    gRolaV: g.scrollHeight > g.clientHeight + 1 };
  const kp = [...document.querySelectorAll('#resumo .kpi')].map(e => Math.round(e.getBoundingClientRect().height));
  r.kpiH = kp;
  r.sobra = Math.round(vw.getBoundingClientRect().bottom - g.getBoundingClientRect().bottom);
  r.gH = Math.round(g.getBoundingClientRect().height);
  r.cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
  r.cortados = [...g.querySelectorAll('.uc-name,.uc-score,.chip')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent).slice(0, 5);
  r.foraTela = [...vw.querySelectorAll('.kpi')].filter(e => e.getBoundingClientRect().bottom > innerHeight - 15 || e.getBoundingClientRect().right > innerWidth - 15).length;
  r.kvCorte = [...document.querySelectorAll('#resumo .kv')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
  return r;
};
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(300);
    const m = await page.evaluate(mede);
    ok(`${tag} · Resumo Gerencial: visão abre com o título`, m.id === 'vw-resumo' && m.tit === 'Resumo Gerencial', m.id + ' / ' + m.tit);
    ok(`${tag} · Resumo: página não rola`, !m.pagRola);
    ok(`${tag} · Resumo: a visão não transborda (os cards rolam dentro da área deles)`, !m.vwRola);
    ok(`${tag} · Resumo: cards das unidades sem barra horizontal`, !m.gHoriz);
    ok(`${tag} · Resumo: fileira de contagens com altura do padrão (≥ 112px)`, m.kpiH.length === 5 && m.kpiH.every(h => h >= 111), m.kpiH.join('/'));
    ok(`${tag} · Resumo: área dos cards ocupa o resto da tela (sem faixa vazia embaixo)`, m.sobra <= 4 && m.gH > vp.height * .5, `sobra ${m.sobra}px · ${m.gH}px · ${m.cols} colunas · rola ${m.gRolaV}`);
    ok(`${tag} · Resumo: nada cortado (nome, pontuação, chips, contagens)`, !m.cortados.length && !m.kvCorte.length && !m.foraTela, m.cortados.concat(m.kvCorte).join(' / '));
    ok(`${tag} · Resumo: subtítulo do topo = vigência · carga`, /^[A-Z]{3}\/26 · \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(m.sub), m.sub);
    if (SHOTS && vp.width === 1600) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
    }
    if (SHOTS && vp.width === 1366) await page.screenshot({ path: path.join(SHOTS, PASTA, `resumo-${tema === 'light' ? 'claro' : 'escuro'}-1366.png`) });
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('#btTema'); await page.waitForTimeout(300);
      ok('troca de tema: body.claro + bi_theme', await page.evaluate(() => document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light'));
      ok('troca de tema: os cards continuam lá', await page.evaluate(() => document.querySelectorAll('#grid .uc').length === 13));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('supabase-js, gerot-base.js, swr-cache.js, gviz-cache.js e ctrlk.js continuam', ['supabase-js', 'gerot-base.js', 'swr-cache.js', 'gviz-cache.js', 'ctrlk.js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === B && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      await page.click('#resumo .kpi:nth-child(1)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito nas contagens abre o menu Excel (cards)/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent) && /PNG/.test(m.textContent); }));
      await page.mouse.click(5, 5);
      await page.click('#grid .uc:nth-child(1)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito num card de unidade abre o menu PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /PNG/.test(m.textContent); }));
      await page.mouse.click(5, 5);
      await page.click('#ms-vig .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-vig .ms-only[data-v="abr/26"]').click());
      await page.waitForTimeout(250);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-vig .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('titSub').textContent, document.querySelector('#resumo .kpi:last-child .kv').textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      ok('a vigência escolhida vai para o card Vigência e para o subtítulo', cnt[3] === 'ABR/26' && /^ABR\/26 · /.test(cnt[2]), cnt[2]);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-filtro-abr.png') });
      await page.mouse.click(5, 5);
      ok('contrato: ms-vig/ms-uni com wrap._sel (Set) + wrap._render, atualizar/carregar/setVw', await page.evaluate(() => ['ms-vig', 'ms-uni'].every(id => { const w = document.getElementById(id); return w._sel instanceof Set && typeof w._render === 'function'; }) && typeof atualizar === 'function' && typeof carregar === 'function' && typeof setVw === 'function'));
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda diagnostico_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('diagnostico_mini') === '1'));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(150);
      ok('lateral recolhida: dica ao passar o mouse', await page.evaluate(() => { const d = document.querySelector('.dica'); return d.classList.contains('on') && d.textContent === 'Resumo Gerencial'; }));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini.png') });
      await page.evaluate(() => { localStorage.setItem('diagnostico_mini', '0'); setCarga('x'); });
      await page.evaluate(() => carregar()); await page.waitForTimeout(900);
      ok('Atualizar dados: subtítulo com a hora da carga', await page.evaluate(() => / \d{2}:\d{2}$/.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// celular: a página volta a rolar, cards em uma coluna
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    cols: getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length,
    horiz: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1,
    alto: Math.max(document.body.scrollHeight, document.scrollingElement.scrollHeight) }));
  ok('celular: página livre para rolar, cards em 1 coluna, sem barra de lado', m.rola && m.cols === 1 && !m.horiz && m.alto > 2000, JSON.stringify(m));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

// Migração das Auditorias (Demarco & DPO/VPO) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados.
//
// O painel lê DUAS abas do Consolidado Geral por gviz/JSONP (<script src=…
// &tqx=out:json;responseHandler:fn>): `Demarco` e `DPO`. A 1ª linha da aba é o
// cabeçalho (UNIDADE | 1H25 | 2H25 | 1H26 | 2H26) e cada célula de período traz
// o texto do nível ("Nível 3"), pintado pelo mapa CORES de cada aba. Período sem
// nenhum dado some da tabela; valor fora do mapa vira chip cinza (empty-niv).
// O shim gviz-cache.js fica no caminho, com o Supabase respondendo vazio, e cai
// no Google — que aqui é dublado pela rota do Playwright.
// O MESMO roteiro roda no HTML antigo (git show HEAD:…) e no novo, e as duas
// tabelas têm de sair IGUAIS célula a célula: texto, classe e cor do chip.
// Também confere o contrato do /check-metas/: `#tbl-demarco table` e
// `#tbl-dpo table` existem na visão que abre primeiro (o prep é vazio).
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:auditorias/index.html > /tmp/aud-antigo.html
//   cp scripts/auditorias-casca-teste.mjs docs/driverpro-apresentacao/_aud-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=/tmp/aud-antigo.html SHOTS=<pasta> node _aud-casca-x1.mjs ; rm _aud-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const SHOTS = process.env.SHOTS || '';
const ANTIGO = process.env.ANTIGO;
const ORIG = 'http://gem.teste';
const PASTA = 'auditorias';
const BUILD = '202610070100';

// ── dados sintéticos no formato das abas ─────────────────────────────────────
const UNIS = ['CDD CUIABA', 'CUIABA EMPURRADA', 'CDD RIO DE JANEIRO', 'CDI MACACU', 'MACACU EMPURRADA', 'PIRAI EMPURRADA',
  'CDD GOIANIA', 'CDD GRAVATAI', 'CDD FLORIANOPOLIS', 'CDD NOVA FRIBURGO', 'CDD PELOTAS', 'CDD BALNEARIO CAMBORIU', 'CDD RONDONOPOLIS'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const aba = (niveis) => {
  const rows = [['UNIDADE', '1H25', '2H25', '1H26', '2H26']];          // 2H26 vazio em toda linha → some
  UNIS.forEach((u, i) => {
    const r = [u];
    for (let p = 0; p < 3; p++) {
      const x = rnd();
      r.push(x < .06 ? '' : x < .1 ? '—' : x < .13 ? 'N/A' : niveis[Math.floor(rnd() * niveis.length)]);
    }
    r.push('');
    rows.push(r);
  });
  rows.push(['', 'Nível 1', '', '', '']);                                // linha sem unidade → descartada
  return rows;
};
const DEM = aba(['Nível 1', 'Nível 2', 'Nível 3', 'Nível 4', 'Nível 5']);
const DPO = aba(['Nível 0', 'Nível 1', 'Nível 2', 'Nível 3', 'Nível 4']);
const pack = rows => ({ version: '0.6', status: 'ok', table: { cols: rows[0].map((_, i) => ({ id: String.fromCharCode(65 + i), label: '', type: 'string' })),
  rows: rows.map(r => ({ c: r.map(v => v === '' ? null : { v }) })) } });
const GVIZ = { Demarco: pack(DEM), DPO: pack(DPO) };

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  const gviz = [];
  await page.addInitScript(({ tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_theme', tema);
  }, { tema });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'docs.google.com') {
      const sheet = u.searchParams.get('sheet') || '';
      const fn = ((u.searchParams.get('tqx') || '').match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1] || 'google.visualization.Query.setResponse';
      gviz.push(sheet);
      const body = GVIZ[sheet] || { status: 'error', errors: [{ message: 'aba inexistente' }] };
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: `/*O_o*/\n${fn}(${JSON.stringify(body)});` });
    }
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#tbl-demarco table') && document.querySelector('#tbl-dpo table'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs, gviz };
}

// cada tabela: cabeçalho + célula a célula (texto, classe, cor do chip inline e computada)
const leTabelas = () => {
  const t = id => {
    const tb = document.querySelector(`#${id} table`); if (!tb) return null;
    return {
      head: [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim()),
      cels: [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => {
        const s = td.querySelector('span');
        const cs = s ? getComputedStyle(s) : null;
        return [td.textContent.trim(), s ? s.className : '', s ? s.getAttribute('style') || '' : '',
          s && /niv/.test(s.className) && !/empty/.test(s.className) ? cs.backgroundColor + '/' + cs.color : ''].join(' ¦ ');
      })),
    };
  };
  return { demarco: t('tbl-demarco'), dpo: t('tbl-dpo') };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números (níveis e cores): antigo × novo, nos dois temas
console.log(`\n══ ${PASTA} · tabelas ══`);
const res = {};
for (const lado of ['antigo', 'novo']) {
  res[lado] = {};
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs, gviz } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, tema);
    res[lado][tema] = { errs, gviz: [...gviz], t: await page.evaluate(leTabelas) };
    await ctx.close();
  }
}
const A = res.antigo.dark.t, N = res.novo.dark.t;
console.log('  antigo demarco:', JSON.stringify(A.demarco && A.demarco.head), (A.demarco && A.demarco.cels.length) + ' linhas');
console.log('  novo   demarco:', JSON.stringify(N.demarco && N.demarco.head), (N.demarco && N.demarco.cels.length) + ' linhas');
console.log('  ex. linha:', N.demarco && N.demarco.cels[0].join(' ║ ').slice(0, 260));
ok('antigo abre sem erro de página', !res.antigo.dark.errs.length && !res.antigo.light.errs.length, [...res.antigo.dark.errs, ...res.antigo.light.errs].join(' / '));
ok('novo abre sem erro de página', !res.novo.dark.errs.length && !res.novo.light.errs.length, [...res.novo.dark.errs, ...res.novo.light.errs].join(' / '));
ok('novo leu as duas abas (Demarco e DPO)', ['Demarco', 'DPO'].every(a => res.novo.dark.gviz.includes(a)), res.novo.dark.gviz.join(','));
ok('Demarco com as 13 unidades', N.demarco && N.demarco.cels.length === 13, String(N.demarco && N.demarco.cels.length));
ok('DPO/VPO com as 13 unidades', N.dpo && N.dpo.cels.length === 13, String(N.dpo && N.dpo.cels.length));
ok('período sem dado (2H26) some do cabeçalho', N.demarco && JSON.stringify(N.demarco.head) === '["UNIDADE","1H25","2H25","1H26"]', JSON.stringify(N.demarco && N.demarco.head));
{
  const todas = [...N.demarco.cels, ...N.dpo.cels].flat();
  ok('células de nível pintadas pelo mapa (chip com fundo inline)', todas.filter(c => /background:/.test(c)).length > 40, String(todas.filter(c => /background:/.test(c)).length));
  ok('valor fora do mapa / vazio vira chip cinza (empty-niv)', todas.some(c => /^N\/A ¦ niv empty-niv/.test(c)) && todas.some(c => /^— ¦ niv empty-niv/.test(c)));
  ok('Demarco Nível 1 = azul #1565C0 e DPO Nível 0 = #404040', todas.some(c => /^Nível 1 ¦ niv ¦ background:#1565C0/.test(c)) && N.dpo.cels.flat().some(c => /^Nível 0 ¦ niv ¦ background:#404040/.test(c)));
}
for (const tema of ['dark', 'light']) for (const tb of ['demarco', 'dpo']) {
  const a = res.antigo[tema].t[tb], b = res.novo[tema].t[tb];
  ok(`igual antes × depois (${tema === 'light' ? 'claro' : 'escuro'}) · ${tb}: cabeçalho`, JSON.stringify(a.head) === JSON.stringify(b.head));
  const dif = [];
  a.cels.forEach((r, i) => r.forEach((c, j) => { if (c !== (b.cels[i] || [])[j]) dif.push(`${i},${j}: ${c} × ${(b.cels[i] || [])[j]}`); }));
  ok(`igual antes × depois (${tema === 'light' ? 'claro' : 'escuro'}) · ${tb}: ${a.cels.length}×${a.cels[0].length} células (texto, classe e cor do chip)`,
    a.cels.length === b.cels.length && !dif.length, dif.slice(0, 2).join(' / '));
}

// 2 · casca: sem rolagem, visão, tema, exportação — 1366×768 e 1600×900
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const se = document.scrollingElement, vw = document.querySelector('.vw.on');
      const tw = [...vw.querySelectorAll('.twrap')];
      const blocos = [...vw.querySelectorAll('.tsec,.twrap')].map(c => c.getBoundingClientRect());
      const card = document.querySelector('#tbl-demarco').closest('.card');
      const cs = getComputedStyle(card);
      return { id: vw.id, tit: document.getElementById('tit').textContent,
        pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
        vwRola: vw.scrollHeight > vw.clientHeight + 1,
        horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
        vert: tw.some(t => t.scrollHeight > t.clientHeight + 1),
        foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
        lado: (() => { const a = document.querySelector('#tbl-demarco').getBoundingClientRect(), b = document.querySelector('#tbl-dpo').getBoundingClientRect(); return Math.abs(a.top - b.top) < 2 && b.left > a.right; })(),
        thAlto: [...vw.querySelectorAll('thead tr')].map(tr => Math.round(tr.getBoundingClientRect().height)).filter(h => h > 60),
        thAlin: [...document.querySelectorAll('#tbl-demarco thead th')].map(th => getComputedStyle(th).textAlign).join(','),
        cabBg: getComputedStyle(document.querySelector('#tbl-demarco thead th')).backgroundColor,
        cabSticky: getComputedStyle(document.querySelector('#tbl-demarco thead th')).position,
        moldura: [cs.borderTopWidth, cs.backgroundColor, cs.boxShadow].join(' | '),
        twBorda: getComputedStyle(document.querySelector('#tbl-demarco')).borderTopWidth,
        ttits: [...vw.querySelectorAll('.ttit')].map(e => e.textContent + (getComputedStyle(e).display === 'none' ? '(oculto)' : '')),
        sub: document.getElementById('titSub').textContent };
    });
    ok(`${tag}: visão abre (${m.tit})`, m.id === 'vw-resumo' && m.tit === 'Resumo Gerencial');
    ok(`${tag}: página não rola`, !m.pagRola);
    ok(`${tag}: a visão não transborda`, !m.vwRola);
    ok(`${tag}: tabela sem barra horizontal`, !m.horiz);
    ok(`${tag}: todas as unidades à vista, sem barra vertical`, !m.vert);
    ok(`${tag}: nada fora da tela`, !m.foraTela);
    ok(`${tag}: Demarco e DPO/VPO lado a lado`, m.lado);
    ok(`${tag}: cabeçalho numa linha só`, !m.thAlto.length, m.thAlto.join(','));
    ok(`${tag}: cabeçalho alinhado ao conteúdo (unidade à esq., chips centralizados)`, m.thAlin === 'left,center,center,center', m.thAlin);
    ok(`${tag}: cabeçalho sticky no tom --cabec`, m.cabSticky === 'sticky' && m.cabBg !== 'rgba(0, 0, 0, 0)', `${m.cabSticky} ${m.cabBg}`);
    ok(`${tag}: sem moldura dupla (card sem borda/fundo/sombra, só o .twrap)`, m.moldura === '0px | rgba(0, 0, 0, 0) | none' && m.twBorda === '1px', `${m.moldura} · twrap ${m.twBorda}`);
    ok(`${tag}: títulos das tabelas (não repetem a visão) visíveis`, JSON.stringify(m.ttits) === '["Demarco","DPO/VPO"]', JSON.stringify(m.ttits));
    ok(`${tag}: subtítulo com a fonte e a hora da carga`, /^Consolidado Geral — Demarco & DPO\/VPO · Atualizado \d\d\/\d\d\/\d{4} \d\d:\d\d$/.test(m.sub), m.sub);
    if (SHOTS && vp.width === 1600) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
    }
    if (SHOTS && vp.width === 1366) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-1366-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
    }
    if (vp.width === 1600 && tema === 'dark') {
      // contrato do /check-metas/: prep vazio, alvo = a tabela de cada aba, chips com cor
      const cm = await page.evaluate(() => ['#tbl-demarco table', '#tbl-dpo table'].map(s => { const t = document.querySelector(s);
        return t ? t.querySelectorAll('tbody tr').length + ':' + t.querySelectorAll('.niv[style*="background"]').length : null; }));
      ok('check-metas: #tbl-demarco table e #tbl-dpo table na 1ª visão, com chips pintados', cm.every(x => x && +x.split(':')[0] === 13 && +x.split(':')[1] > 20), cm.join(' / '));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'), document.getElementById('btTema').innerHTML.includes('M21 12.79')]);
      ok('troca de tema: body.claro + bi_theme + ícone', depois[0] && depois[1] === 'light' && depois[2], JSON.stringify(depois));
      await page.click('#btTema'); await page.waitForTimeout(150);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        pdfAtalho: (() => { const s = document.getElementById('pdf-slot'); let p = s.previousElementSibling; while (p && !p.classList.contains('s-sec')) p = p.previousElementSibling; return p && p.textContent.trim(); })(),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf && exp.pdfAtalho === 'Atalhos', exp.pdfAtalho);
      ok('excel-export carregado (menu Excel/PNG no botão direito)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js e gviz-cache.js ficaram', exp.srcs.some(s => s.includes('ctrlk.js')) && exp.srcs.some(s => s.includes('gviz-cache.js')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(b => { const m = (document.querySelector('meta[name=build]') || {}).content; return m === b && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      await page.click('#tbl-demarco tbody tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent : ''; });
      ok('botão direito na tabela: menu "Exportar Excel"', /Exportar Excel/.test(menu), menu.trim().slice(0, 80));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#tbl-demarco tbody tr')].map(tr => tr.cells[0].textContent).join(','));
      await page.click('#tbl-demarco thead th:nth-child(1)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#tbl-demarco tbody tr')].map(tr => tr.cells[0].textContent).join(','));
      ok('ordenação pelo cabeçalho continua', s1 !== s2, `${s1.slice(0, 60)} → ${s2.slice(0, 60)}`);
      const n0 = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('docs.google.com')).length);
      await page.click('.side .s-item[onclick="carregar()"]'); await page.waitForTimeout(700);
      const n1 = await page.evaluate(() => [performance.getEntriesByType('resource').filter(e => e.name.includes('docs.google.com')).length, document.getElementById('titSub').textContent]);
      ok('"Atualizar dados" relê as abas e escreve no subtítulo', n1[0] >= n0 + 2 && /Atualizado/.test(n1[1]), `${n0} → ${n1[0]} · ${n1[1]}`);
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe (chave auditorias_mini)', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('auditorias_mini') === '1'));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      ok('dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Resumo Gerencial'; }));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini-escuro.png') });
      const mini = await page.evaluate(() => { const tw = [...document.querySelectorAll('.twrap')]; return tw.some(t => t.scrollWidth > t.clientWidth + 1); });
      ok('lateral recolhida: tabela sem barra horizontal', !mini);
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}
// 3 · celular: a página volta a rolar e as tabelas empilham
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => {
    const a = document.querySelector('#tbl-demarco').getBoundingClientRect(), b = document.querySelector('#tbl-dpo').getBoundingClientRect();
    return { rola: document.scrollingElement.scrollHeight > innerHeight || document.body.scrollHeight > document.body.clientHeight + 1,
      empilha: b.top >= a.bottom - 1, alt: [Math.round(a.height), Math.round(b.height)],
      larg: document.scrollingElement.scrollWidth <= innerWidth + 1 };
  });
  ok('celular: página rola e as tabelas empilham, com altura', m.rola && m.empilha && m.alt.every(h => h > 200), JSON.stringify(m));
  ok('celular: página sem rolagem lateral', m.larg);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

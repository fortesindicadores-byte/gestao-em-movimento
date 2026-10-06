// Migração do MPR (mpr/) para a casca padrão do portal — conferida no Chromium,
// nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// Dublês: as 4 abas de tier do workbook do termômetro e as 4 abas "<tier> - Acum"
// chegam por gviz JSONP (interceptado no appendChild do <script>); o shim
// gviz-cache.js fica no caminho com o Supabase respondendo vazio e cai no Google
// dublado. O supabase-js do CDN vira stub (SB=null), então os campos Causa/Ação/
// Responsável/Prazo vêm do localStorage — semeado igual nos dois lados.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:mpr/index.html > /tmp/.../mpr-antigo.html      (o último antes da casca)
//   cp scripts/mpr-casca-teste.mjs docs/driverpro-apresentacao/_mpr-casca-<id>.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<html antigo> FONT_DIR=<@fontsource/montserrat/files> SHOTS=<pasta> node _mpr-casca-<id>.mjs ; rm _mpr-casca-<id>.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const SHOTS = process.env.SHOTS || '';
// Montserrat de verdade (@fontsource, pasta files/), senão o navegador mede com a fonte de
// reserva, mais estreita, e a conferência de "nada cortado" passa por engano
const FONT_DIR = process.env.FONT_DIR || '';
const BUILD = '202610070100';
const ORIG = 'http://gem.teste';
const PASTA = 'mpr';

// ── dados sintéticos no layout das abas (índices 0-based do painel) ──
// 0 Vigência(M_Q) · 1 Unidade · 2 TP · 3 GEO · 4 Total Pontos · 5 Ranking · 6,7 livres
// 8..25 = 9 pares (valor, pontos)
const UNIS = {
  'Transportes T1': [['MACACU EMPURRADA', 'GEO SUDESTE'], ['CUIABA EMPURRADA', 'GEO CENTRO-OESTE'], ['PIRAI EMPURRADA', 'GEO SUDESTE']],
  'Transportes T2': [['CDD RIO DE JANEIRO', 'GEO SUDESTE'], ['CDD GUARULHOS', 'SUDESTE'], ['CDD PELOTAS', 'GEO SUL'],
    ['CDD FLORIANOPOLIS', 'GEO SUL'], ['CDD NOVA FRIBURGO', 'GEO SUDESTE'], ['CDD CAMBORIU', 'GEO SUL'],
    ['CDD CUIABA', 'GEO CENTRO-OESTE'], ['CDD RONDONOPOLIS', 'GEO CENTRO-OESTE'], ['CDI MACACU', 'GEO SUDESTE']],
  'WH T1': [['CUIABA', 'GEO CENTRO-OESTE']],
  'WH T2': [['CDD RIO DE JANEIRO', 'GEO SUDESTE'], ['CDD GUARULHOS', 'SUDESTE'], ['CDD PELOTAS', 'GEO SUL'],
    ['CDD FLORIANOPOLIS', 'GEO SUL'], ['CDD CUIABA', 'GEO CENTRO-OESTE'], ['CDI MACACU', 'GEO SUDESTE']],
};
const VIGS = []; for (let m = 1; m <= 8; m++) for (const q of [1, 2]) VIGS.push(`${String(m).padStart(2, '0')}_0${q}`);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PTS = [0, 5, 10, 20];
function linha(vig, uni, geo, tier) {
  const r = [vig, uni, tier.startsWith('WH') ? 'WH' : 'TP', geo, 0, null, null, null];
  let tot = 0;
  for (let k = 0; k < 9; k++) {
    let v;
    if (k === 7) v = `Date(1899,11,30,${Math.floor(rnd() * 9)},${Math.floor(rnd() * 60)},0)`;      // MTTR em horas
    else if (k === 8) v = `Date(1899,11,30,${10 + Math.floor(rnd() * 13)},${Math.floor(rnd() * 60)},0)`; // MTBF
    else if (k === 4) v = Math.floor(rnd() * 30);                                                  // OS vencidas
    else if (k === 6 && !tier.startsWith('WH')) v = Math.round(rnd() * 140) / 10;                   // Indisp. em % (escala 100)
    else if (k === 0) v = `${Math.round(90 + rnd() * 10)}% | ${(0.85 + rnd() * .15).toFixed(2)}`;  // composto
    else v = Math.round((0.8 + rnd() * 0.2) * 1000) / 1000;
    if (rnd() < 0.04) v = null;                                                                    // célula vazia
    const p = PTS[Math.floor(rnd() * 4)];
    r.push(v, p); tot += p;
  }
  r[4] = Math.min(100, tot);
  return r;
}
const ABAS = {};
for (const [tier, us] of Object.entries(UNIS)) {
  const rows = [['Vigência', 'CDD', 'TP', 'GEO', 'Total Pontos', 'Ranking', '', '', ...Array(18).fill('x')]];
  for (const v of VIGS) {
    if (tier === 'WH T1' && v === '08_02') continue;   // sem Q2 no último mês → célula vazia
    const rs = us.map(([u, g]) => linha(v, u, g, tier));
    [...rs].sort((a, b) => b[4] - a[4]).forEach((r, i) => r[5] = i + 1);
    rows.push(...rs);
  }
  ABAS[tier] = rows;
  const ac = [['Vigência', 'CDD', 'TP', 'GEO', 'Total Pontos', 'Ranking', '', '', ...Array(18).fill('x')]];
  const rs = us.map(([u, g]) => linha('ACUM', u, g, tier)); [...rs].sort((a, b) => b[4] - a[4]).forEach((r, i) => r[5] = i + 1);
  ac.push(...rs); ABAS[tier + ' - Acum'] = ac;
}
// campos livres (fallback local, igual nos dois lados)
const LOCAL = {
  'mpr|ADERÊNCIA PREVENTIVA|GEO:SUL|causa': 'Plano de preventiva atrasado em Pelotas',
  'mpr|ADERÊNCIA PREVENTIVA|GEO:SUL|acao': 'Replanejar com a oficina',
  'mpr|ADERÊNCIA PREVENTIVA|GEO:SUL|resp': 'Fulano',
  'mpr|ADERÊNCIA PREVENTIVA|GEO:SUL|prazo': '2026-10-30',
  'mpr|ADERÊNCIA PREVENTIVA|CDD PELOTAS|Transportes T2|causa': 'Oficina cheia',
};

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema, falhaGviz = false) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ ABAS, tema, falhaGviz, LOCAL }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    for (const [k, v] of Object.entries(LOCAL)) localStorage.setItem(k, v);
    // captura o download do Excel (data: URL) em vez de baixar
    window.__xls = [];
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__xls.push([this.download, decodeURIComponent(this.href.split(',').slice(1).join(','))]); };
    const gv = rows => ({ status: 'ok', table: { cols: rows[0].map(() => ({ id: 'A', label: '' })),
      rows: rows.slice(1).map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        if (falhaGviz) { setTimeout(() => n.onerror && n.onerror(), 5); return n; }
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const aba = decodeURIComponent((n.src.match(/[?&]sheet=([^&]+)/) || [])[1] || '');
        const rows = ABAS[aba];
        setTimeout(() => { if (fn && window[fn]) window[fn](rows ? gv(JSON.parse(JSON.stringify(rows))) : { status: 'error' }); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { ABAS, tema, falhaGviz, LOCAL });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
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
  if (!falhaGviz) await page.waitForFunction(() => document.querySelectorAll('#tbl table.mpr tr').length > 5, null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

// a tabela inteira, célula a célula: texto, classe de cor, fundo da pílula, campos livres
const leTabela = () => {
  const linhas = [...document.querySelectorAll('#tbl table.mpr tr')].map(tr => [...tr.cells].map(c => {
    const sp = c.querySelector('.cell'), f = c.querySelector('textarea,input');
    let t = c.textContent.replace(/­/g, '').replace(/\s+/g, ' ').trim();
    if (sp) t += '{' + [...sp.classList].filter(x => /^v-|pill|tot|dash/.test(x)).join('.') + (sp.style.background ? ':' + sp.style.background : '') + '}';
    if (f) t += '[' + f.value + ']';
    return t;
  }).join(' | '));
  return { n: linhas.length, linhas, vazio: (document.querySelector('#tbl .loading') || {}).textContent || '',
    filtros: [...document.querySelectorAll('.ms-wrap')].map(w => w.id + ':' + w.querySelectorAll('.ms-opt input[data-v]').length + ':' + [...(w._sel || [])].join('/')).join(',') };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base, filtros, drill de GEO e Excel
console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); w._render(''); render(); };
const passos = {
  base: null,
  'Tier = WH T2': `(${sel})('ms-tier',['WH T2'])`,
  'KPI = MTTR+OS Vencidas · Tier todos': `(${sel})('ms-tier',[]);(${sel})('ms-kpi',['MTTR','OS Vencidas'])`,
  'GEO SUL + abre GEO SUL no MTTR': `(${sel})('ms-geo',['SUL']);toggleGeo('MTTR','SUL')`,
  'Unidade CDD PELOTAS · KPI todos': `(${sel})('ms-geo',[]);(${sel})('ms-kpi',[]);(${sel})('ms-uni',['CDD PELOTAS'])`,
  'fecha GEO SUL da Preventiva': `(${sel})('ms-uni',[]);toggleGeo('ADERÊNCIA PREVENTIVA','SUL')`,
  'Tier T1 + Indisp. (filtro sem dado)': `(${sel})('ms-tier',['WH T1']);(${sel})('ms-kpi',['Indisp. Manutenção'])`,
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  res[lado] = { errs };
  for (const [nome, fn] of Object.entries(passos)) {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(200); }
    res[lado][nome] = await page.evaluate(leTabela);
  }
  // Excel: mesmos filtros nos dois lados (todos), compara o conteúdo do arquivo
  await page.evaluate(`(${sel})('ms-tier',[]);(${sel})('ms-kpi',[])`);
  await page.evaluate(() => exportExcel()); await page.waitForTimeout(150);
  res[lado].xls = await page.evaluate(() => window.__xls.map(([n, h]) => [n.replace(/\d{8}/, 'AAAAMMDD'), h]));
  // digitar a causa grava no localStorage (mesma chave nos dois lados)
  await page.fill('#tbl textarea.fld >> nth=0', 'teste de digitação');
  await page.waitForTimeout(100);
  res[lado].salvo = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('mpr|') && localStorage.getItem(k) === 'teste de digitação'));
  await ctx.close();
}
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
const b = res.novo.base;
console.log('  novo base:', b.n, 'linhas ·', b.filtros);
console.log('  1ª linha de valores:', b.linhas.find(l => /2026/.test(l)));
ok('tabela carregou com linhas', b.n > 20, String(b.n));
ok('campos livres do localStorage aparecem', b.linhas.some(l => l.includes('[Plano de preventiva atrasado em Pelotas]')) && b.linhas.some(l => l.includes('[2026-10-30]')));
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  ok(`igual antes × depois [${nome}]: nº de linhas`, A.n === N.n, `${A.n} × ${N.n}`);
  const dif = A.linhas.findIndex((l, i) => l !== N.linhas[i]);
  ok(`igual antes × depois [${nome}]: todas as células (texto, cor, pílula, campos)`, dif < 0, dif < 0 ? '' : `linha ${dif}: ${A.linhas[dif]} × ${N.linhas[dif]}`);
  ok(`igual antes × depois [${nome}]: aviso de vazio`, A.vazio === N.vazio, `${A.vazio} × ${N.vazio}`);
  ok(`igual antes × depois [${nome}]: filtros`, A.filtros === N.filtros, `${A.filtros} × ${N.filtros}`);
}
ok('filtro muda a tabela', res.novo['Tier = WH T2'].linhas.join() !== b.linhas.join());
ok('Excel: um arquivo nos dois lados', res.antigo.xls.length === 1 && res.novo.xls.length === 1);
ok('Excel: conteúdo idêntico antes × depois', JSON.stringify(res.antigo.xls) === JSON.stringify(res.novo.xls),
  `${(res.antigo.xls[0] || [])[1]?.length} × ${(res.novo.xls[0] || [])[1]?.length}`);
ok('digitar na Causa grava no localStorage (mesma chave)', res.novo.salvo.length === 1 && JSON.stringify(res.antigo.salvo) === JSON.stringify(res.novo.salvo), res.novo.salvo.join());

// 2 · casca: sem rolagem, visão, tema, exportação — 1366×768 e 1600×900
const VISOES = ['resumo'];
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    for (const v of VISOES) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(300);
      const medir = () => page.evaluate(() => {
        const se = document.scrollingElement, vw = document.querySelector('.vw.on');
        const tw = [...vw.querySelectorAll('.twrap')];
        const blocos = [...vw.querySelectorAll('.tsec,.twrap')].map(c => c.getBoundingClientRect());
        const cortes = [...vw.querySelectorAll('tr.hdr th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent.trim());
        const cortesV = [...vw.querySelectorAll('td.vc')].filter(td => td.scrollWidth > td.clientWidth + 1).map(td => td.textContent.trim());
        // input não denuncia corte pelo scrollWidth: mede o texto (placeholder / "dd/mm/aaaa") com a fonte da caixa
        const cv = document.createElement('canvas').getContext('2d');
        const inputs = [...vw.querySelectorAll('input.sml')].filter(i => {
          const cs = getComputedStyle(i); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const txt = i.type === 'date' ? '00/00/0000' : (i.value || i.placeholder);
          const livre = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (i.type === 'date' ? 13 : 0);
          return cv.measureText(txt).width > livre + .5;
        }).length;
        return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
          vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
          twRolaV: tw.map(t => t.scrollHeight > t.clientHeight),
          cortes: [...new Set(cortes)], cortesV: [...new Set(cortesV)], inputs,
          foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
          sobra: Math.round(document.querySelector('.cols').getBoundingClientRect().bottom - 24 - tw[0].getBoundingClientRect().bottom),
          tit: document.getElementById('tit').textContent,
          stickyOk: getComputedStyle(vw.querySelector('tr.hdr th')).position === 'sticky' };
      });
      for (const mini of [false, true]) {
        if (mini) { await page.click('#btMini'); await page.waitForTimeout(300); }
        const m = await medir(); const t2 = tag + (mini ? ' (lateral recolhida)' : '');
        ok(`${t2} · ${v}: visão abre (${m.tit})`, m.id === 'vw-' + v && m.tit === 'Resumo Gerencial');
        ok(`${t2} · ${v}: página não rola`, !m.pagRola);
        ok(`${t2} · ${v}: a visão não transborda`, !m.vwRola);
        ok(`${t2} · ${v}: tabela sem barra horizontal`, !m.horiz);
        ok(`${t2} · ${v}: nada fora da tela`, !m.foraTela);
        ok(`${t2} · ${v}: cabeçalho sem texto cortado`, !m.cortes.length, m.cortes.join(' / '));
        ok(`${t2} · ${v}: valores sem corte (…)`, !m.cortesV.length, m.cortesV.slice(0, 6).join(' / '));
        ok(`${t2} · ${v}: Responsável/Prazo sem texto cortado`, m.inputs === 0, String(m.inputs));
        ok(`${t2} · ${v}: tabela rola dentro do card com cabeçalho sticky`, m.twRolaV[0] && m.stickyOk);
        ok(`${t2} · ${v}: tabela ocupa a altura (sobra ≤ 2px)`, Math.abs(m.sobra) <= 2, m.sobra + 'px');
        if (SHOTS && !mini) {
          const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}${vp.width === 1600 ? '' : '-' + vp.width}.png`) });
          if (vp.width === 1600) {   // rolado até um bloco expandido (unidade·tier)
            await page.evaluate(() => { const t = document.querySelector('.twrap'); t.scrollTop = 700; }); await page.waitForTimeout(150);
            await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}-rolado.png`) });
            await page.evaluate(() => { document.querySelector('.twrap').scrollTop = 0; });
          }
        }
        if (mini) { await page.click('#btMini'); await page.waitForTimeout(250); }
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('#btTema'); await page.waitForTimeout(200);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'), getComputedStyle(document.querySelector('tr.hdr th')).backgroundColor]);
      ok('troca de tema: body.claro + bi_theme + cabeçalho no tom do tema', depois[0] && depois[1] === 'light' && depois[2] === 'rgb(220, 223, 230)', JSON.stringify(depois));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xlsItem: [...document.querySelectorAll('.side .s-item')].some(b => /Exportar Excel/.test(b.textContent) && /exportExcel/.test(b.getAttribute('onclick') || '')),
        h2c: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('Exportar Excel (o .xls do painel) na lateral', exp.xlsItem);
      ok('excel-export carregado (menu Excel/PNG no clique direito)', exp.h2c);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js, gviz-cache.js e supabase-js continuam', ['ctrlk.js', 'gviz-cache.js', 'supabase-js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === B && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      // clique direito na tabela abre o menu Excel/PNG
      await page.click('#tbl tr.grp-end td.vc >> nth=3', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel|imagem/i.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // contagem laranja do filtro aparece e o "só" funciona
      await page.click('#ms-geo .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-geo .ms-only[data-v="SUL"]').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-geo .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.querySelectorAll('#tbl td.uni-cell.geo').length]; });
      ok('contagem laranja do filtro aparece (só GEO SUL)', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      await page.mouse.click(5, 5);
      // clique no GEO expande/recolhe as unidades
      const n0 = await page.evaluate(() => document.querySelectorAll('#tbl td.uni-cell.unit').length);
      await page.click('#tbl td.uni-cell.geo >> nth=0'); await page.waitForTimeout(150);
      const n1 = await page.evaluate(() => document.querySelectorAll('#tbl td.uni-cell.unit').length);
      ok('clique no GEO recolhe/expande as unidades', n0 !== n1, `${n0} → ${n1}`);
      // lateral recolhida guarda a chave
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda mpr_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('mpr_mini') === '1'));
      await page.click('#btMini'); await page.waitForTimeout(200);
      ok('contrato dos filtros: wrap._sel (Set) + wrap._render + render/atualizar', await page.evaluate(() => ['ms-tier', 'ms-kpi', 'ms-geo', 'ms-uni'].every(id => { const w = document.getElementById(id); return w._sel instanceof Set && typeof w._render === 'function'; }) && typeof render === 'function' && typeof atualizar === 'function'));
      await page.evaluate(() => atualizar()); await page.waitForTimeout(600);
      ok('Atualizar dados: subtítulo "Atualizado …"', await page.evaluate(() => /^Atualizado /.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · planilha fora do ar: o aviso vai para o subtítulo e para a tabela
{
  const { ctx, page } = await abre(browser, null, { width: 1366, height: 768 }, 'dark', true);
  await page.waitForFunction(() => /Sem dados|Erro/.test(document.getElementById('titSub').textContent), null, { timeout: 30000 }).catch(() => {});
  const t = await page.evaluate(() => [document.getElementById('titSub').textContent, document.getElementById('tbl').textContent]);
  ok('planilha fora do ar: aviso no subtítulo e na tabela', /Sem dados/.test(t[0]) && /Sem dados/.test(t[1]), t.join(' · '));
  await ctx.close();
}

// 4 · celular: a página volta a rolar e a tabela tem altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    h: Math.round(document.querySelector('.twrap').getBoundingClientRect().height) }));
  ok('celular: página livre para rolar e tabela com altura', m.rola && m.h > 300, m.h + 'px');
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: false });
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

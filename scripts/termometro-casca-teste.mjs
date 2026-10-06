// Migração do Termômetro (termometro/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// Dublês: as abas do workbook do termômetro chegam por gviz JSONP (os 4 tiers,
// as 4 abas "<tier> - Acum" e a aba Regras com headers=0); o shim gviz-cache.js
// fica no caminho, com o Supabase respondendo vazio, e cai no Google dublado.
// Chart.js real via CHART_JS.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 60297e2:termometro/index.html > /tmp/.../termo-antigo.html   (o último antes da casca)
//   cp scripts/termometro-casca-teste.mjs docs/driverpro-apresentacao/_termo-casca-<id>.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<html antigo> CHART_JS=<chart.umd.js> SHOTS=<pasta> node _termo-casca-<id>.mjs ; rm _termo-casca-<id>.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const CHART_JS = process.env.CHART_JS || '';
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070015';
const ORIG = 'http://gem.teste';
const PASTA = 'termometro';

// ── dados sintéticos no layout das abas (índices 0-based do painel) ──
// 0 Vigência(M_Q) · 1 Unidade · 2 TP · 3 GEO · 4 Total Pontos · 5 Ranking · 6,7 livres
// 8..25 = 9 pares (valor, pontos)
const UNIS = {
  'Transportes T1': [['MACACU EMPURRADA', 'GEO SUDESTE'], ['CUIABA EMPURRADA', 'GEO CENTRO-OESTE'], ['PIRAI EMPURRADA', 'GEO SUDESTE']],
  'Transportes T2': [['CDD RIO DE JANEIRO', 'GEO SUDESTE'], ['CDD GUARULHOS', 'GEO SUDESTE'], ['CDD PELOTAS', 'GEO SUL'],
    ['CDD FLORIANOPOLIS', 'GEO SUL'], ['CDD NOVA FRIBURGO', 'GEO SUDESTE'], ['CDD CAMBORIU', 'GEO SUL'],
    ['CDD CUIABA', 'GEO CENTRO-OESTE'], ['CDD RONDONOPOLIS', 'GEO CENTRO-OESTE'], ['CDI MACACU', 'GEO SUDESTE']],
  'WH T1': [['CUIABA', 'GEO CENTRO-OESTE']],
  'WH T2': [['CDD RIO DE JANEIRO', 'GEO SUDESTE'], ['CDD GUARULHOS', 'GEO SUDESTE'], ['CDD PELOTAS', 'GEO SUL'],
    ['CDD FLORIANOPOLIS', 'GEO SUL'], ['CDD CUIABA', 'GEO CENTRO-OESTE'], ['CDI MACACU', 'GEO SUDESTE']],
};
const VIGS = []; for (let m = 2; m <= 8; m++) for (const q of [1, 2]) VIGS.push(`${String(m).padStart(2, '0')}_0${q}`);   // "MM_0Q", como no eixo ALL_VIGS
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PTS = [0, 5, 10, 20];
function linha(vig, uni, geo, tier) {
  const r = [vig, uni, tier.startsWith('WH') ? 'WH' : 'TP', geo, 0, null, null, null];
  let tot = 0;
  for (let k = 0; k < 9; k++) {
    let v;
    if (k === 7) v = `Date(1899,11,30,${Math.floor(rnd() * 9)},${Math.floor(rnd() * 60)},0)`;   // MTTR em horas
    else if (k === 4) v = Math.floor(rnd() * 30);                                               // OS vencidas
    else if (k === 0) v = `${Math.round(90 + rnd() * 10)}% | ${(0.85 + rnd() * .15).toFixed(2)}`; // composto
    else v = Math.round((0.8 + rnd() * 0.2) * 1000) / 1000;
    const p = k < 2 ? PTS[1 + Math.floor(rnd() * 3)] : PTS[Math.floor(rnd() * 3)];
    r.push(v, p); tot += p;
  }
  r[4] = Math.min(100, tot);
  return r;
}
const ABAS = {};
for (const [tier, us] of Object.entries(UNIS)) {
  const rows = [['Vigência', 'CDD', 'TP', 'GEO', 'Total Pontos', 'Ranking', '', '', ...Array(18).fill('x')]];
  for (const v of VIGS) {
    if (tier === 'WH T1' && v === '08_02') continue;   // sem Q2 no último mês → linha efetiva cai na Q1
    const rs = us.map(([u, g]) => linha(v, u, g, tier));
    [...rs].sort((a, b) => b[4] - a[4]).forEach((r, i) => r[5] = i + 1);
    rows.push(...rs);
  }
  ABAS[tier] = rows;
  const ac = [['Vigência', 'CDD', 'TP', 'GEO', 'Total Pontos', 'Ranking', '', '', ...Array(18).fill('x')]];
  const rs = us.map(([u, g]) => linha('ACUM', u, g, tier)); [...rs].sort((a, b) => b[4] - a[4]).forEach((r, i) => r[5] = i + 1);
  ac.push(...rs); ABAS[tier + ' - Acum'] = ac;
}
ABAS.Regras = [['KPIS', 'REGRA', 'DONO', 'EMAIL', 'FONTE', 'MEMÓRIA DE CÁLCULO', 'PERÍODO AVALIADO', 'OBSERVAÇÕES', 'TIER VÁLIDO', '20', '10', '5', '0'],
  ...['ADERÊNCIA PREVENTIVA', 'ADERÊNCIA CHECK CONFORMIDADE', 'MILIMETRAGEM PNEU', 'BLITZ DE SEGURANÇA', 'ADERÊNCIA CHECKLIST', 'ORDENS DE SERVIÇO VENCIDAS',
    'STRESS TEST', 'INDISP. MANUTENÇÃO', 'DISPONIBILIDADE CONTRATADA', 'MTTR', 'MTBF'].map((k, i) => [k, 'regra', 'dono', 'x@y', 'Ginfo',
    'Equipamentos com plano cadastrado ÷ total de equipamentos ativos no período, conferido na base do Ginfo', 'Quinzenal', i % 2 ? 'Considera só a frota própria' : '-',
    'T1 · T2 · ARM', i === 0 ? '> 95% equip. c/ plano + 90% aderência' : '-', '> 95% aderência', '> 90% aderência', '< 90%'])];

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema, falhaGviz = false) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ ABAS, tema, falhaGviz }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    const gv = rows => ({ status: 'ok', table: { cols: rows[0].map(() => ({ id: 'A', label: '' })),
      rows: rows.map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });
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
  }, { ABAS, tema, falhaGviz });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '[]' });
    }
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  if (!falhaGviz) await page.waitForFunction(() => { const e = document.querySelector('#rk-table tbody tr td:nth-child(2)'); return e && document.querySelectorAll('#mtx-table tbody tr').length > 3; }, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

// números da tela, lidos pelos ids (iguais nos dois lados)
const leNumeros = () => {
  const t = id => (document.getElementById(id) || {}).textContent?.replace(/\s+/g, ' ').trim();
  const out = {}; ['h-score', 'h-uni', 'h-vig', 'h-best', 'rk-sub', 'ch-sub'].forEach(id => out[id] = t(id));
  out.heroCor = getComputedStyle(document.querySelector('.hero-value')).color;
  out.cards = [...document.querySelectorAll('#tier-cards .kpi-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ;; ');
  const linhas = tb => [...(tb ? tb.querySelectorAll('tbody tr') : [])].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  const cab = tb => tb ? [...tb.querySelectorAll('thead th')].map(c => c.textContent.replace(/\u00ad/g, '').trim()).join(' | ') : null;   // hífen opcional do cabeçalho novo
  for (const id of ['rk-table', 'mtx-table', 'reg-table']) { const tb = document.getElementById(id); out[id + ':cab'] = cab(tb); out[id] = linhas(tb).join(' ;; '); }
  out.cores = [...document.querySelectorAll('#mtx-table td.cell')].slice(0, 40).map(td => td.style.background).join(',');
  out.rkCores = [...document.querySelectorAll('#rk-table .rk-ind .p')].slice(0, 40).map(s => s.style.color).join(',');
  const k = window.Chart && Chart.getChart(document.getElementById('ch-line'));
  out.chart = k ? JSON.stringify([k.data.labels, k.data.datasets[0].data, k.data.datasets[0]._on]) : null;
  out.indBtns = [...document.querySelectorAll('#ind-selector .ind-btn')].map(b => b.textContent + (b.classList.contains('active') ? '*' : '')).join(',');
  out.filtros = [...document.querySelectorAll('.ms-wrap')].map(w => w.id + ':' + w.querySelectorAll('.ms-opt input[data-v]').length + ':' + [...(w._sel || [])].join('/')).join(',');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base e depois de filtros e do seletor de indicador
console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); applyFilters(); };
const passos = {
  base: null,
  'filtro Tier=WH T2': `(${sel})('ms-tier',['WH T2'])`,
  'Vigência = Todos (ano todo → abas Acum)': `(${sel})('ms-tier',[]);(${sel})('ms-vig',[])`,
  'Vigência 03+05 · GEO SUL': `(${sel})('ms-vig',['03','05']);(${sel})('ms-geo',['GEO SUL'])`,
  'indicador MTTR no gráfico': `(${sel})('ms-geo',[]);setActiveInd('MTTR')`,
  'indicador Conformidade + Unidade CDD PELOTAS': `setActiveInd('ADERÊNCIA CHECK DE CONFORMIDADE');(${sel})('ms-uni',['CDD PELOTAS'])`,
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
console.log('  novo base:', JSON.stringify({ score: b['h-score'], uni: b['h-uni'], vig: b['h-vig'], best: b['h-best'], rk: b['rk-sub'], cards: b.cards }));
ok('hero carregou com número', b['h-score'] && b['h-score'] !== '—', b['h-score']);
ok('gráfico com dados', !!b.chart && JSON.parse(b.chart)[1].some(v => v != null));
ok('matriz com linhas', b['mtx-table'].split(' ;; ').length > 5);
ok('regras da aba Regras (não o fallback)', /Equipamentos com plano/.test(b['reg-table']));
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    if (k === 'heroCor') continue;   // a cor do hero é a mesma regra (bandFg), mas o laranja de "sem faixa" é token
    ok(`igual antes × depois [${nome}]: ${k}`, JSON.stringify(A[k]) === JSON.stringify(N[k]),
      JSON.stringify(A[k]) === JSON.stringify(N[k]) ? '' : `${String(A[k]).slice(0, 110)} × ${String(N[k]).slice(0, 110)}`);
  }
}
ok('filtro muda os números', res.novo['filtro Tier=WH T2']['h-score'] !== b['h-score'] || res.novo['filtro Tier=WH T2']['h-uni'] !== b['h-uni'],
  `${b['h-score']}/${b['h-uni']} → ${res.novo['filtro Tier=WH T2']['h-score']}/${res.novo['filtro Tier=WH T2']['h-uni']}`);
ok('Vigência "Todos" usa o acumulado (h-vig = 1)', res.novo['Vigência = Todos (ano todo → abas Acum)']['h-vig'] === '1');

// 2 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
const VISOES = ['resumo', 'ranking', 'matriz', 'regras'];
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    for (const v of VISOES) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const se = document.scrollingElement, vw = document.querySelector('.vw.on');
        const tw = [...vw.querySelectorAll('.twrap')];
        const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
        const blocos = [...vw.querySelectorAll('.gcard,.tsec,.kpi-card,.fin-hero')].map(c => c.getBoundingClientRect());
        const kpi = [...vw.querySelectorAll('.kpi-card')].map(k => k.getBoundingClientRect().height);
        // células cortadas (texto maior que a célula) nas tabelas
        const cortes = [...vw.querySelectorAll('table thead th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent.trim());
        return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
          vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
          twRolaV: tw.map(t => t.scrollHeight > t.clientHeight),
          canv, kpi, cortes, foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
          sobra: (() => { const last = blocos.reduce((a, r) => Math.max(a, r.bottom), 0); return Math.round(document.querySelector('.cols').getBoundingClientRect().bottom - 24 - last); })(),
          tit: document.getElementById('tit').textContent,
          stickyOk: tw.every(t => { const th = t.querySelector('thead th'); return !th || getComputedStyle(th).position === 'sticky'; }) };
      });
      ok(`${tag} · ${v}: visão abre (${m.tit})`, m.id === 'vw-' + v);
      ok(`${tag} · ${v}: página não rola`, !m.pagRola);
      ok(`${tag} · ${v}: a visão não transborda`, !m.vwRola);
      ok(`${tag} · ${v}: tabela sem barra horizontal`, !m.horiz);
      ok(`${tag} · ${v}: nada fora da tela`, !m.foraTela);
      ok(`${tag} · ${v}: cabeçalho sem texto cortado`, !m.cortes.length, m.cortes.join(' / '));
      if (m.twRolaV.length) ok(`${tag} · ${v}: cabeçalho sticky na tabela`, m.stickyOk);
      if (m.canv.length) ok(`${tag} · ${v}: gráfico com altura`, m.canv.every(h => h > 150), m.canv.map(Math.round).join(','));
      if (m.kpi.length) ok(`${tag} · ${v}: cards com altura (≥ 100px)`, m.kpi.every(h => h >= 100), m.kpi.map(Math.round).join(','));
      if (v === 'resumo') ok(`${tag} · resumo: sem faixa vazia embaixo (≤ 40px)`, m.sobra <= 40, m.sobra + 'px');
      if (SHOTS) {
        const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}${vp.width === 1600 ? '' : '-' + vp.width}.png`) });
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      const antes = await page.evaluate(() => [document.body.classList.contains('claro'), chLine && chLine.options.scales.x.ticks.color]);
      await page.click('#btTema'); await page.waitForTimeout(300);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), chLine && chLine.options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
      ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js e gviz-cache.js continuam', exp.srcs.some(s => s.includes('ctrlk.js')) && exp.srcs.some(s => s.includes('gviz-cache.js')));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === B && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      // menu do Excel/PNG abre no clique direito da tabela
      await page.click('.s-item[data-vw="ranking"]'); await page.waitForTimeout(200);
      await page.click('#rk-table tbody td:nth-child(2)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // ordenação pelo cabeçalho (sortable-table) continua no ranking
      const antesOrd = await page.evaluate(() => document.querySelector('#rk-table tbody tr td:nth-child(2)').textContent);
      await page.click('#rk-table thead th:nth-child(2)'); await page.waitForTimeout(200);
      const depoisOrd = await page.evaluate(() => document.querySelector('#rk-table tbody tr td:nth-child(2)').textContent);
      ok('ordenação pelo cabeçalho (Unidade)', antesOrd !== depoisOrd, `${antesOrd} → ${depoisOrd}`);
      // contagem laranja do filtro aparece e o "only" funciona
      await page.click('#ms-geo .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-geo .ms-only[data-v="GEO SUL"]').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-geo .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('rk-sub').textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      // a vigência abre marcada no último mês, com a contagem visível
      ok('Vigência inicial = último mês, com contagem', await page.evaluate(() => { const w = document.getElementById('ms-vig'); return [...w._sel].join() === '08' && getComputedStyle(w.querySelector('.ms-cnt')).display !== 'none'; }));
      // lateral recolhida
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda termometro_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('termometro_mini') === '1'));
      ok('contrato do check-metas: wrap._sel (Set) + wrap._render', await page.evaluate(() => ['ms-uni', 'ms-tier', 'ms-vig', 'ms-geo'].every(id => { const w = document.getElementById(id); return w._sel instanceof Set && typeof w._render === 'function'; }) && typeof applyFilters === 'function' && typeof atualizar === 'function'));
      // o botão "Atualizar dados" refaz a leitura
      await page.evaluate(() => { localStorage.setItem('termometro_mini', '0'); });
      await page.evaluate(() => atualizar()); await page.waitForTimeout(800);
      ok('Atualizar dados: subtítulo "Atualizado …"', await page.evaluate(() => /^Atualizado /.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · planilha fora do ar: o aviso vai para o subtítulo
{
  const { ctx, page } = await abre(browser, null, { width: 1366, height: 768 }, 'dark', true);
  await page.waitForFunction(() => /Sem dados|Erro/.test(document.getElementById('titSub').textContent), null, { timeout: 30000 }).catch(() => {});
  const t = await page.evaluate(() => document.getElementById('titSub').textContent);
  ok('planilha fora do ar: aviso no subtítulo', /Sem dados|Erro/.test(t), t);
  await ctx.close();
}

// 4 · celular: a página volta a rolar e o gráfico tem altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
  ok('celular: página livre para rolar e gráfico com altura', m.rola && m.canv.every(h => h > 150), m.canv.map(Math.round).join(','));
  await page.click('.s-item[data-vw="matriz"]'); await page.waitForTimeout(600);
  const mt = await page.evaluate(() => { const t = document.querySelector('#vw-matriz .twrap'); return [Math.round(t.getBoundingClientRect().height), document.querySelectorAll('#vw-matriz .mt-detail-btn').length]; });
  ok('celular: matriz com altura e o "+ Detalhar" do mobile.js', mt[0] > 150 && mt[1] > 0, mt.join(' · '));
  await page.click('#vw-matriz .mt-detail-btn'); await page.waitForTimeout(300);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-matriz.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  if (SHOTS) { await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: true }); }
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

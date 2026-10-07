// Migração da área de Pneus para a casca padrão do portal — conferida no
// Chromium, nos DOIS lados (HTML antigo do HEAD × o novo):
//
//  1. pneus/index.html  — o SUB-HUB (casca do hub, sem menu lateral, copiada de
//     combustivel/index.html): os MESMOS 10 cards, na mesma ordem, com o mesmo
//     título, texto, destino e selo; redirect para o hub sem gem_hub; tema.
//  2. pneus/tipos.html  — lê `snapshot` (endpoint tires) do Supabase por
//     branch_id e agrega por Marca · Modelo · Medida · Sulcos: os 4 números e a
//     tabela inteira têm de sair IGUAIS, célula a célula.
//  3. pneus/descarte.html — lê `snapshot` (todos os endpoints) por branch_id,
//     tira as paleteiras, calcula % de descarte e a tabela por Unidade/Motivo/
//     Marca/Modelo: hero e as 4 tabelas IGUAIS, sem filtro e com filtro
//     (Apenas PIR; Apenas um motivo), pelas MESMAS funções do painel
//     (onlyFilter/setDescDim) chamadas nos dois lados.
//
// O Supabase é dublado pela rota do Playwright com pneus sintéticos no formato
// do loader do Prolog (status, marca, modelo, medida, sulcos, cicloVida,
// motivoDescarte, veiculoId; vehicles com tipo, inclusive PALETEIRA).
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 179afa3:pneus/index.html > <tmp>/index-antigo.html
//   git show 179afa3:pneus/tipos.html > <tmp>/tipos-antigo.html
//   git show 179afa3:pneus/descarte.html > <tmp>/descarte-antigo.html
//   cp scripts/pneus-hub-casca-teste.mjs docs/driverpro-apresentacao/_pneus-hub-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGOS=<tmp> \
//     SHOTS=<pasta> node _pneus-hub-x1.mjs ; rm _pneus-hub-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGOS = process.env.ANTIGOS;
const SHOTS = process.env.SHOTS || '';
const FONTE = process.env.FONTE || '';          // pasta com os .woff2 da Montserrat (opcional)
const ORIG = 'http://gem.teste';
const BUILD = '202610070300';

// ── dados sintéticos no formato do snapshot do Prolog ────────────────────────
const BRANCHES = [1676, 1677, 37, 1906, 1907, 1878, 20, 30, 24, 2517, 26, 38, 2277, 2550];
const MARCAS = { BRIDGESTONE: ['M729', 'R268', 'M765'], MICHELIN: ['X MULTI Z', 'X MULTI D'], GOODYEAR: ['G32 CARGO', 'KMAX D'],
  PIRELLI: ['FR85', 'TR88'], CONTINENTAL: ['HDR2'], XBRI: ['FORZA'], '': [''] };
const MEDIDAS = ['295/80 R22.5', '275/80 R22.5', '215/75 R17.5', '600/9 R9', '8/15 R15'];
const MOTIVOS = ['Desgaste - vida útil', 'Corte por objeto cortante', 'Estouro', 'Separação de cintas', 'Baixa pressão / rodou vazio',
  'Impacto (buraco)', '', 'Talão danificado', 'Flanco com bolha', 'Motivo esquisito xyz', 'Superaquecimento'];
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const SNAP = {};          // branch_id → { tires, vehicles, inspections }
let tid = 1;
for (const b of BRANCHES) {
  const vehicles = [], tires = [];
  const nV = 6 + Math.floor(rnd() * 10);
  for (let v = 0; v < nV; v++) vehicles.push({ id: b * 100 + v, placa: 'ABC' + (1000 + v), tipo: v === 0 && rnd() < .7 ? 'PALETEIRA ELETRICA' : pick(['CAMINHAO BAU', 'SEMI REBOQUE - 3 EIXOS', 'CAVALO 3 EIXOS']) });
  const nT = 30 + Math.floor(rnd() * 90);
  for (let i = 0; i < nT; i++) {
    const marca = pick(Object.keys(MARCAS));
    const st = rnd(); const status = st < .45 ? 'INSTALLED' : st < .75 ? 'DISPOSAL' : st < .95 ? 'INVENTORY' : 'ANALYSIS';
    tires.push({ id: tid++, marca: marca === '' && rnd() < .5 ? null : marca + (rnd() < .05 ? ' ' : ''), modelo: pick(MARCAS[marca]) || null,
      medida: pick(MEDIDAS), sulcos: rnd() < .1 ? '' : pick([3, 4, 4, 5]), cicloVida: pick([1, 1, 2, 3, 4, undefined]), status,
      motivoDescarte: status === 'DISPOSAL' ? pick(MOTIVOS) : null, veiculoId: status === 'INSTALLED' ? pick(vehicles).id : null });
  }
  SNAP[b] = { tires, vehicles, inspections: [] };
}

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const ANT = f => fs.readFileSync(path.join(ANTIGOS, f + '-antigo.html'), 'utf8');

const FONT_CSS = FONTE ? [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Montserrat';font-weight:${w};src:url(${ORIG}/__fonte/montserrat-latin-${w}-normal.woff2) format('woff2');}`).join('\n') : '';

async function abre(browser, { arq, antigo = false, vp = { width: 1600, height: 900 }, tema = 'dark', gem = true }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  const sb = [];
  await page.addInitScript(({ tema, gem }) => {
    if (gem) sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('pneus_theme', tema);          // a chave do descarte antigo
  }, { tema, gem });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname.startsWith('/__fonte/') && FONTE) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(FONTE, path.basename(u.pathname))) });
      const ma = u.pathname.match(/\/__antigo-(\w+)\.html$/);
      if (ma) return r.fulfill({ status: 200, contentType: 'text/html', body: ANT(ma[1]) });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname.endsWith('supabase.co')) {
      if (u.pathname.endsWith('/rest/v1/snapshot')) {
        const bid = +(u.searchParams.get('branch_id') || '').replace('eq.', '');
        const ep = (u.searchParams.get('endpoint') || '').replace('eq.', '');
        sb.push(bid + ':' + (ep || '*'));
        const s = SNAP[bid] || {};
        const rows = Object.keys(s).filter(k => !ep || k === ep).map(k => ({ endpoint: k, branch_id: bid, data: JSON.parse(JSON.stringify(s[k])), updated_at: '2026-10-06T12:00:00Z' }));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  const url = antigo ? `${ORIG}/pneus/__antigo-${arq}.html` : `${ORIG}/pneus/${arq === 'index' ? '' : arq + '.html'}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs, sb };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const shot = async (page, nome) => {
  if (!SHOTS) return; const dir = path.join(SHOTS, 'pneus-hub'); fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, nome + '.png') });
};
// casca: página não rola, nada fora da tela, tabelas sem barra horizontal
const mede = page => page.evaluate(() => {
  const se = document.scrollingElement, vw = document.querySelector('.vw.on');
  const tw = [...document.querySelectorAll('.vw.on .twrap')];
  return {
    pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
    vwRola: vw ? vw.scrollHeight > vw.clientHeight + 1 : null,
    horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
    foraTela: [...document.querySelectorAll('.vw.on > *')].some(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1; }),
    tit: (document.getElementById('tit') || {}).textContent,
    twAlt: tw.map(t => Math.round(t.getBoundingClientRect().height)),
  };
});
const casca = async (page, tag) => {
  const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
    pdfAtalho: (() => { const s = document.getElementById('pdf-slot'); let p = s && s.previousElementSibling; while (p && !p.classList.contains('s-sec')) p = p.previousElementSibling; return p && p.textContent.trim(); })(),
    xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean),
    build: (document.querySelector('meta[name=build]') || {}).content }));
  ok(`${tag}: Gerar PDF na lateral (Atalhos)`, exp.pdf && exp.pdfAtalho === 'Atalhos', exp.pdfAtalho);
  ok(`${tag}: excel-export carregado (Excel/PNG no botão direito)`, exp.xls);
  const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
  ok(`${tag}: scripts no fim, na ordem do padrão`, ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
  ok(`${tag}: ctrlk.js e gviz-cache.js ficaram`, exp.srcs.some(s => s.includes('ctrlk.js')) && exp.srcs.some(s => s.includes('gviz-cache.js')));
  ok(`${tag}: build ${exp.build} no <meta> e no build-check`, !!exp.build && exp.build >= BUILD && exp.srcs.some(s => s.includes('build-check.js?v=' + exp.build)));
  const links = await page.evaluate(() => [...document.querySelectorAll('.side .s-volta a.s-item')].map(a => a.textContent.trim() + '→' + a.getAttribute('href')).join(' · '));
  ok(`${tag}: atalhos de volta no rodapé (Pneus → ./ e Hub → ../)`, links === 'Voltar a Pneus→./ · Voltar ao Hub→../', links);
};

// ═════════════════════════ 1 · SUB-HUB ═════════════════════════
console.log('\n══ pneus/index.html (sub-hub) ══');
const leCards = page => page.evaluate(() => [...document.querySelectorAll('.dash-card, .hcard')].map(c => {
  const a = c.tagName === 'A' ? c : c.querySelector('a');
  const q = s => { const e = c.querySelector(s); return e ? e.textContent.trim() : ''; };
  return [q('.card-title, .tit'), q('.card-desc, .dsc'), a && a.getAttribute('href'), q('.badge, .bdg')].join(' ¦ ');
}));
{
  const A = await abre(browser, { arq: 'index', antigo: true }); await A.page.waitForTimeout(300);
  const N = await abre(browser, { arq: 'index' }); await N.page.waitForTimeout(300);
  const ca = await leCards(A.page), cn = await leCards(N.page);
  console.log('  cards:', cn.map(c => c.split(' ¦ ')[0]).join(' | '));
  ok('10 cards no antigo e no novo', ca.length === 10 && cn.length === 10, ca.length + '/' + cn.length);
  ok('mesmos cards, mesma ordem: título, texto, destino e selo', JSON.stringify(ca) === JSON.stringify(cn), cn.find((c, i) => c !== ca[i]) || '');
  const meta = await N.page.evaluate(() => ({ h1: document.querySelector('.marca h1').textContent, p: document.querySelector('.marca p').textContent,
    sub: document.querySelector('.tit-pg p').textContent, voltar: [...document.querySelectorAll('.pe-volta a')].map(a => a.textContent.trim() + '→' + a.getAttribute('href')).join(','),
    side: !!document.querySelector('.side'), build: document.querySelector('meta[name=build]').content,
    srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
  const metaA = await A.page.evaluate(() => ({ h1: document.querySelector('.hub-brand h1').textContent, p: document.querySelector('.hub-brand p').textContent, sub: document.querySelector('.hub-welcome p').textContent }));
  ok('marca e subtítulo do antigo (Gestão de Pneus · Frota)', meta.h1 === metaA.h1 && meta.p === metaA.p, meta.h1 + ' / ' + meta.p);
  ok('texto de boas-vindas do antigo no topo da grade', meta.sub === metaA.sub);
  ok('rodapé: Voltar ao Hub (../)', meta.voltar === 'Voltar ao Hub→../', meta.voltar);
  ok('sem menu lateral (casca do hub)', !meta.side);
  ok(`build ${meta.build} + scripts do antigo (mobile, ctrlk, build-check, gviz-cache)`, meta.build >= BUILD && ['mobile.js', 'ctrlk.js', 'build-check.js?v=' + meta.build, 'gviz-cache.js'].every(n => meta.srcs.some(s => s.includes(n))), meta.srcs.join(','));
  ok('zero erro de página (antigo e novo)', !A.errs.length && !N.errs.length, [...A.errs, ...N.errs].join(' / '));
  await A.ctx.close(); await N.ctx.close();
  // sem gem_hub → vai para o hub
  const R = await abre(browser, { arq: 'index', gem: false }); await R.page.waitForTimeout(400);
  ok('sem sessionStorage.gem_hub → redirect para o hub', new URL(R.page.url()).pathname === '/', R.page.url());
  await R.ctx.close();
  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, { arq: 'index', vp, tema }); await page.waitForTimeout(400);
    const tag = `sub-hub ${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    const m = await page.evaluate(() => { const se = document.scrollingElement, app = document.querySelector('.app').getBoundingClientRect(), bd = document.getElementById('board');
      return { pag: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1, app: app.bottom <= innerHeight && app.right <= innerWidth,
        claro: document.body.classList.contains('claro'), boardH: bd.scrollWidth > bd.clientWidth + 1,
        visiveis: [...document.querySelectorAll('.hcard')].filter(c => { const r = c.getBoundingClientRect(); return r.top >= bd.getBoundingClientRect().top - 1 && r.bottom <= bd.getBoundingClientRect().bottom + 1; }).length }; });
    ok(`${tag}: página não rola (a grade rola dentro do .board) e o app cabe`, !m.pag && m.app && !m.boardH, `cards inteiros à vista: ${m.visiveis}`);
    ok(`${tag}: body.claro = tema`, m.claro === (tema === 'light'));
    if (vp.width === 1600) await shot(page, `subhub-${tema === 'light' ? 'claro' : 'escuro'}`);
    if (vp.width === 1366 && tema === 'dark') {
      await page.click('#btTema'); await page.waitForTimeout(150);
      const t = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme')]);
      ok('sub-hub: botão de tema troca body.claro e grava bi_theme', t[0] && t[1] === 'light', JSON.stringify(t));
      await page.click('.hcard[href="descarte.html"]'); await page.waitForTimeout(500);
      ok('sub-hub: card Descarte abre descarte.html', /\/pneus\/descarte\.html$/.test(page.url()), page.url());
    }
    ok(`${tag}: zero erro de página`, !errs.length, errs.join(' / '));
    await ctx.close();
  }
}

// ═════════════════════════ 2 · TIPOS ═════════════════════════
console.log('\n══ pneus/tipos.html ══');
const leTipos = page => page.evaluate(() => {
  const kpis = [...document.querySelectorAll('.kpi')].map(k => (k.querySelector('.l, .kl') || {}).textContent + '=' + (k.querySelector('.v, .kv') || {}).textContent);
  const tb = document.querySelector('#content table');
  return { kpis, head: tb ? [...tb.querySelectorAll('thead th')].map(t => t.textContent.trim()) : [],
    rows: tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim()).join(' ¦ ')) : [],
    status: (document.getElementById('status') || {}).textContent };
});
{
  const res = {};
  for (const lado of ['antigo', 'novo']) {
    const { ctx, page, errs, sb } = await abre(browser, { arq: 'tipos', antigo: lado === 'antigo' });
    await page.waitForFunction(() => document.querySelector('#content table'), null, { timeout: 15000 }).catch(() => {});
    res[lado] = { errs, sb: [...sb], t: await leTipos(page) };
    if (lado === 'novo') {
      // CSV: o mesmo conteúdo do antigo (o download sai por <a download>)
      res.csv = await page.evaluate(() => { let href = ''; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { href = this.href; }; baixarCSV(); HTMLAnchorElement.prototype.click = o; return decodeURIComponent(href.split(',')[1] || ''); });
    } else {
      res.csvA = await page.evaluate(() => { let href = ''; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { href = this.href; }; baixarCSV(); HTMLAnchorElement.prototype.click = o; return decodeURIComponent(href.split(',')[1] || ''); });
    }
    await ctx.close();
  }
  const A = res.antigo.t, N = res.novo.t;
  console.log('  antigo:', A.kpis.join(' · '), '·', A.rows.length, 'linhas');
  console.log('  novo  :', N.kpis.join(' · '), '·', N.rows.length, 'linhas');
  ok('leu o snapshot (endpoint tires) das 14 unidades', res.novo.sb.length === 14 && res.novo.sb.every(s => s.endsWith(':tires')), res.novo.sb.join(','));
  ok('os 4 números iguais antes × depois', JSON.stringify(A.kpis) === JSON.stringify(N.kpis) && A.kpis.length === 4, N.kpis.join(' · '));
  ok('tabela de tipos: cabeçalho igual', JSON.stringify(A.head) === JSON.stringify(N.head), N.head.join(','));
  ok(`tabela de tipos: ${N.rows.length} linhas iguais célula a célula`, N.rows.length > 20 && JSON.stringify(A.rows) === JSON.stringify(N.rows), N.rows.find((r, i) => r !== A.rows[i]) || '');
  ok('CSV igual ao do antigo', res.csv && res.csv === res.csvA, (res.csv || '').length + ' bytes');
  ok('status no subtítulo (Atualizado …)', /^Atualizado \d\d\/\d\d\/\d{4} \d\d:\d\d$/.test(N.status), N.status);
  ok('zero erro de página (antigo e novo)', !res.antigo.errs.length && !res.novo.errs.length, [...res.antigo.errs, ...res.novo.errs].join(' / '));
  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, { arq: 'tipos', vp, tema });
    await page.waitForFunction(() => document.querySelector('#content table'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(200);
    const tag = `tipos ${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    const m = await mede(page);
    ok(`${tag}: visão "${m.tit}" sem rolar a página nem a visão, tabela sem barra horizontal`, m.tit === 'Resumo Gerencial' && !m.pagRola && !m.vwRola && !m.horiz && !m.foraTela, JSON.stringify(m));
    const kh = await page.evaluate(() => Math.round(document.querySelector('.kpis').getBoundingClientRect().height));
    ok(`${tag}: cards com altura do padrão e a tabela com o resto`, kh >= 110 && m.twAlt[0] > 250, `cards ${kh}px · tabela ${m.twAlt[0]}px`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    if (vp.width === 1600) await shot(page, `tipos-resumo-${tema === 'light' ? 'claro' : 'escuro'}`);
    if (vp.width === 1600 && tema === 'dark') {
      await casca(page, 'tipos');
      const al = await page.evaluate(() => [...document.querySelectorAll('#content thead th')].map(t => getComputedStyle(t).textAlign[0]).join(''));
      ok('tipos: cabeçalho alinhado (texto à esq., número à dir.)', al === 'llllrrrrl', al);
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#content tbody tr')].slice(0, 3).map(tr => tr.cells[1].textContent).join(','));
      await page.click('#content thead th:nth-child(2)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#content tbody tr')].slice(0, 3).map(tr => tr.cells[1].textContent).join(','));
      ok('tipos: ordenação pelo cabeçalho continua', s1 !== s2, `${s1} → ${s2}`);
      await page.click('#content tbody tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent : ''; });
      ok('tipos: botão direito na tabela → "Exportar Excel"', /Exportar Excel/.test(menu));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      await page.click('#btMini'); await page.waitForTimeout(250);
      ok('tipos: lateral recolhe (chave pneus_tipos_mini) e a tabela segue sem barra horizontal', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('pneus_tipos_mini') === '1' && ![...document.querySelectorAll('.twrap')].some(t => t.scrollWidth > t.clientWidth + 1)));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(150);
      ok('tipos: dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Resumo Gerencial'; }));
      await page.click('#btMini');
    }
    ok(`${tag}: zero erro de página`, !errs.length, errs.join(' / '));
    await ctx.close();
  }
}

// ═════════════════════════ 3 · DESCARTE ═════════════════════════
console.log('\n══ pneus/descarte.html ══');
const leDesc = page => page.evaluate(() => {
  const out = { hero: [document.getElementById('descValue').textContent, document.getElementById('descValue').style.color,
    document.getElementById('descTotalUso').textContent, document.getElementById('descTotalDesc').textContent].join(' ¦ '), t: {} };
  for (const d of ['unidade', 'motivo', 'marca', 'modelo']) {
    setDescDim(d);
    out.t[d] = { head: [...document.querySelectorAll('#theadDesc th')].map(t => t.textContent.trim()),
      rows: [...document.querySelectorAll('#tbodyDescUnidade tr')].map(tr => [...tr.cells].map(td => { const s = td.querySelector('span'); return td.textContent.trim() + (s ? '/' + s.style.color : ''); }).join(' ¦ ')) };
  }
  setDescDim('unidade');
  return out;
});
const recortes = [
  ['sem filtro', null],
  ['Apenas PIR', "onlyFilter('branch','PIR')"],
  ['Apenas BRIDGESTONE + Apenas PICOTAGEM? não — Apenas CORTE/PERFURAÇÃO', "onlyFilter('marca','BRIDGESTONE');onlyFilter('motivo','CORTE/PERFURAÇÃO')"],
  ['unidade sem PIR e sem GRL (desmarcando)', "(()=>{const ins=[...document.querySelectorAll('#opts-branch input')];ins.forEach(i=>{if(['PIR','GRL'].includes(i.dataset.val))i.checked=false;});onFilterChange('branch');})()"],
];
{
  const res = {};
  for (const lado of ['antigo', 'novo']) {
    const { ctx, page, errs, sb } = await abre(browser, { arq: 'descarte', antigo: lado === 'antigo' });
    await page.waitForFunction(() => document.querySelectorAll('#tbodyDescUnidade tr').length > 3, null, { timeout: 20000 }).catch(() => {});
    res[lado] = { errs, sb: [...sb], r: [] };
    for (const [nome, js] of recortes) {
      if (js) await page.evaluate(`populateFilters();${js}`);
      const d = await leDesc(page);
      d.cnt = await page.evaluate(() => ['branch', 'marca', 'modelo', 'motivo'].map(k => { const c = document.getElementById('cnt-' + k); return c && getComputedStyle(c).display !== 'none' ? k + ':' + c.textContent : ''; }).filter(Boolean).join(','));
      res[lado].r.push([nome, d]);
    }
    res[lado].sub = await page.evaluate(() => document.getElementById('lastUpdate').textContent);
    await ctx.close();
  }
  ok('leu o snapshot das 14 unidades (todos os endpoints)', res.novo.sb.length === 14 && res.novo.sb.every(s => s.endsWith(':*')), res.novo.sb.length + '');
  for (let i = 0; i < recortes.length; i++) {
    const [nome, a] = res.antigo.r[i], b = res.novo.r[i][1];
    console.log(`  ${nome}: antigo ${a.hero} · novo ${b.hero}`);
    ok(`${nome}: hero igual (%, cor, total, descartados)`, a.hero === b.hero && !/—/.test(b.hero), b.hero);
    for (const d of ['unidade', 'motivo', 'marca', 'modelo']) {
      const ta = a.t[d], tn = b.t[d];
      ok(`${nome}: tabela por ${d} igual (${tn.rows.length} linhas, célula a célula e cor do %)`,
        tn.rows.length > 0 && JSON.stringify(ta) === JSON.stringify(tn), tn.rows.find((r, j) => r !== ta.rows[j]) || '');
    }
    if (i > 0) ok(`${nome}: contagem laranja do filtro aparece no novo`, !!b.cnt, `novo "${b.cnt}" · antigo "${a.cnt}"`);
  }
  ok('paleteiras fora (mesmo total que o antigo, menor que o bruto)', (() => { const tot = +res.novo.r[0][1].hero.split(' ¦ ')[2].replace(/\./g, ''); const bruto = Object.values(SNAP).reduce((s, x) => s + x.tires.length, 0); return tot < bruto; })());
  ok('"Dados de:" no subtítulo, igual ao antigo', res.novo.sub === res.antigo.sub && /Dados de: \d\d\/\d\d\/\d{4}/.test(res.novo.sub), res.novo.sub);
  ok('zero erro de página (antigo e novo)', !res.antigo.errs.length && !res.novo.errs.length, [...res.antigo.errs, ...res.novo.errs].join(' / '));

  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) for (const tema of ['dark', 'light']) {
    const { ctx, page, errs, sb } = await abre(browser, { arq: 'descarte', vp, tema });
    await page.waitForFunction(() => document.querySelectorAll('#tbodyDescUnidade tr').length > 3, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(250);
    const tag = `descarte ${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    let m = await mede(page);
    ok(`${tag}: visão "${m.tit}" sem rolar a página nem a visão, tabela sem barra horizontal`, m.tit === 'Resumo Gerencial' && !m.pagRola && !m.vwRola && !m.horiz && !m.foraTela, JSON.stringify(m));
    ok(`${tag}: a tabela fica com o resto da altura`, m.twAlt[0] > 300, m.twAlt.join(','));
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    if (vp.width === 1600) {
      await shot(page, `descarte-resumo-${tema === 'light' ? 'claro' : 'escuro'}`);
      await page.click('#descDimToggle [data-dim="motivo"]'); await page.waitForTimeout(150);
      await shot(page, `descarte-motivo-${tema === 'light' ? 'claro' : 'escuro'}`);
      m = await mede(page);
      ok(`${tag}: dimensão Motivo sem barra horizontal`, !m.horiz && !m.pagRola);
      await page.click('#descDimToggle [data-dim="modelo"]'); await page.waitForTimeout(150);
      m = await mede(page);
      ok(`${tag}: dimensão Modelo sem barra horizontal`, !m.horiz && !m.pagRola);
      await page.click('#descDimToggle [data-dim="unidade"]');
    }
    if (vp.width === 1600 && tema === 'dark') {
      await casca(page, 'descarte');
      const al = await page.evaluate(() => [...document.querySelectorAll('#theadDesc th')].map(t => getComputedStyle(t).textAlign[0]).join(''));
      ok('descarte: cabeçalho alinhado (texto à esq., número à dir.)', al === 'lrrr', al);
      // filtro pelo clique, como o usuário: abre Unidade, "Apenas" PIR
      await page.click('#wrap-branch .ms-btn'); await page.waitForTimeout(150);
      await shot(page, 'descarte-filtro-aberto-escuro');
      const h0 = await page.evaluate(() => document.getElementById('descValue').textContent);
      await page.hover('#opts-branch .ms-opt[data-val="PIR"]');
      await page.click('#opts-branch .ms-opt[data-val="PIR"] .ms-only'); await page.waitForTimeout(150);
      const f = await page.evaluate(() => ({ h: document.getElementById('descValue').textContent, rows: document.querySelectorAll('#tbodyDescUnidade tr').length,
        cnt: getComputedStyle(document.getElementById('cnt-branch')).display + ':' + document.getElementById('cnt-branch').textContent }));
      ok('descarte: "Apenas" no filtro Unidade muda o número e a tabela, com a contagem laranja', f.h !== h0 && f.rows === 1 && /^(inline-)?block:1$/.test(f.cnt), JSON.stringify(f) + ' · antes ' + h0);
      await page.mouse.click(700, 500); await page.waitForTimeout(100);
      ok('descarte: clique fora fecha o filtro', await page.evaluate(() => !document.querySelector('.ms-panel.open')));
      await page.evaluate(() => populateFilters()); await page.evaluate(() => renderDescarte());
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#tbodyDescUnidade tr')].map(tr => tr.cells[0].textContent).join(','));
      await page.click('#theadDesc th:nth-child(1)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#tbodyDescUnidade tr')].map(tr => tr.cells[0].textContent).join(','));
      ok('descarte: ordenação pelo cabeçalho continua', s1 !== s2, `${s1.slice(0, 40)} → ${s2.slice(0, 40)}`);
      await page.click('#tbodyDescUnidade tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent : ''; });
      ok('descarte: botão direito na tabela → "Exportar Excel"', /Exportar Excel/.test(menu));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const n0 = sb.length;
      await page.click('#btnRefresh'); await page.waitForTimeout(1200);
      ok('descarte: "Atualizar dados" relê o snapshot (14 unidades)', sb.length >= n0 + 14, `${n0} → ${sb.length}`);
      await page.click('#btTema'); await page.waitForTimeout(150);
      const t = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'), document.getElementById('descValue').textContent !== '—']);
      ok('descarte: troca de tema → body.claro + bi_theme, números redesenhados', t[0] && t[1] === 'light' && t[2], JSON.stringify(t));
      await page.click('#btTema');
      await page.click('#btMini'); await page.waitForTimeout(250);
      ok('descarte: lateral recolhe (chave pneus_descarte_mini)', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('pneus_descarte_mini') === '1'));
      await page.hover('.s-item[data-vw="resumo"]'); await page.waitForTimeout(150);
      ok('descarte: dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Resumo Gerencial'; }));
      await shot(page, 'descarte-mini-escuro');
    }
    ok(`${tag}: zero erro de página`, !errs.length, errs.join(' / '));
    await ctx.close();
  }
}

// ═════════════════════════ 4 · CELULAR ═════════════════════════
for (const arq of ['tipos', 'descarte', 'index']) {
  const { ctx, page, errs } = await abre(browser, { arq, vp: { width: 390, height: 844 } });
  await page.waitForTimeout(arq === 'index' ? 400 : 1500);
  const m = await page.evaluate(() => {
    const tw = document.querySelector('.twrap'), se = document.scrollingElement;
    return { rola: se.scrollHeight > innerHeight + 1 || document.body.scrollHeight > document.body.clientHeight + 1, larg: se.scrollWidth <= innerWidth + 1, tab: tw ? Math.round(tw.getBoundingClientRect().height) : null };
  });
  ok(`celular · ${arq}: a página rola, sem rolagem lateral${arq !== 'index' ? ', tabela com altura' : ''}`, m.rola && m.larg && (arq === 'index' || m.tab > 150), JSON.stringify(m));
  await shot(page, `celular-${arq}`);
  ok(`celular · ${arq}: zero erro de página`, !errs.length, errs.join(' / '));
  await ctx.close();
}

await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

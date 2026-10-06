// Migração do Catálogo de Peças (catalogo-pecas/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML + app antigos × novos, mesmos dados).
//
// O catalogo-pecas/index.html é uma casca fina: quem desenha é o
// assets/catalogo-pecas-app.js, que TAMBÉM serve o catalogo-pecas-externo/. A casca
// nova é opt-in (`casca:{...}` no init); por isso o teste tem duas partes:
//   1) hub: antigo (index + app de antes) × novo — mesmos números por aba, por filtro,
//      por ordenação, por "mostrar mais", e a casca (sem rolagem, temas, PDF, mini…);
//   2) externo: o MESMO catalogo-pecas-externo/index.html com o app de antes × o app
//      novo — o HTML renderizado e o CSS injetado têm de sair IDÊNTICOS.
//
// Dados: os de verdade (assets/catalogo-pecas-dados.js e -erp.js, servidos do
// repositório). Frota: ginfo_snapshot['ativos'] dublado, lido pelo supabase-js real
// (SBJS) com uma sessão falsa no localStorage — é o que liga os filtros Unidade/Placa.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:catalogo-pecas/index.html          > <tmp>/catpecas-index-antigo.html
//   git show HEAD:assets/catalogo-pecas-app.js       > <tmp>/catpecas-app-antigo.js
//   cp scripts/catalogo-pecas-casca-teste.mjs docs/driverpro-apresentacao/_catpecas-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<tmp>/catpecas-index-antigo.html APP_ANTIGO=<tmp>/catpecas-app-antigo.js \
//     SBJS=<supabase umd> SHOTS=<pasta> node _catpecas-casca.mjs ; rm _catpecas-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const APP_ANTIGO = process.env.APP_ANTIGO;
const SBJS = process.env.SBJS || '';
const SHOTS = process.env.SHOTS || '';
const ORIG = 'http://gem.teste';

// frota no formato do export do Ginfo (o app acha as colunas pelo nome)
const ATIV = [];
[['PIRAI EMPURRADA', 'CAVALO MECANICO', 'VW CONSTELLATION 26.260', 12], ['CDD CUIABA', 'TRUCK', 'VW 13.180', 9],
 ['CDD CUIABA', 'EMPILHADEIRA GLP', 'HYSTER H50FT', 5], ['CDD GUARULHOS', 'VUC', 'VW 9.170', 8], ['CDD GUARULHOS', 'VAN', 'RENAULT MASTER', 4]]
  .forEach(([fil, tv, mo, n]) => { for (let i = 0; i < n; i++) ATIV.push({ Filial: fil, Projeto: 'X', Placa: `${fil.slice(4, 7) || fil.slice(0, 3)}${tv.slice(0, 1)}${1000 + i}`, Marca: 'M', Modelo: mo, 'Tipo Veículo': tv, Estado: 'X', 'Ano Fabricação': 2020 }); });
const SESSAO = {
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'teste@gem.teste', user_metadata: {}, app_metadata: {} },
};

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, { url, htmlAntigo = null, appAntigo = false, vp = { width: 1600, height: 900 }, tema = 'dark', mini = false }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(({ SESSAO, tema, mini }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('catpecas_mini', mini ? '1' : '0');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify(SESSAO));
  }, { SESSAO, tema, mini });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      if (appAntigo && u.pathname.endsWith('/assets/catalogo-pecas-app.js'))
        return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(APP_ANTIGO) });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('supabase-js') && SBJS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      const json = b => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (u.pathname.endsWith('/ginfo_snapshot')) {
        const obj = { data: ATIV };
        return json((req.headers()['accept'] || '').includes('object') ? obj : [obj]);
      }
      return json([]);
    }
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // a frota chega depois (supabase) e remonta os filtros com Unidade/Placa
  await page.waitForFunction(() => document.getElementById('ms-uni') || document.querySelector('.ms-wrap'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !!document.getElementById('ms-uni'), null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

// ── leitura dos números (mesma régua nos dois lados) ──
const leAba = () => {
  const novo = !!document.querySelector('.app');
  const lim = s => String(s || '').replace(/[▾▲▼]/g, '').replace(/\s+/g, ' ').trim();
  const hero = [...document.querySelectorAll('.hero .hero-item')].map(h =>
    [h.querySelector('.hero-label'), h.querySelector('.hero-value'), h.querySelector('.hero-sub')].map(e => lim(e && e.textContent)).join(':')).join(' | ');
  const tabs = [...document.querySelectorAll('[data-tbl]')].map(t => {
    const tb = t.querySelector('table');
    return {
      k: t.dataset.tbl, linhas: t.dataset.linhas,
      cab: tb ? [...tb.querySelectorAll('thead th')].map(th => lim(th.textContent)).join(' | ') : '',
      n: tb ? tb.querySelectorAll('tbody tr').length : 0,
      prim: tb ? [...tb.querySelectorAll('tbody tr')].slice(0, 3).map(tr => [...tr.cells].map(c => lim(c.textContent)).join(' | ')).join(' ;; ') : '',
      ult: tb ? [...tb.querySelectorAll('tbody tr')].slice(-1).map(tr => [...tr.cells].map(c => lim(c.textContent)).join(' | ')).join('') : '',
      mais: lim((t.querySelector('.cp-mais') || {}).textContent),
    };
  });
  // texto descritivo: o antigo em .panel-txt; o novo em .ptxt + o título/subtítulo dos cards
  const partes = novo ? [...document.querySelectorAll('#cp-main .ptxt, #cp-main .ttit, #cp-main .tsub')] : [...document.querySelectorAll('#cp-main .panel-txt')];
  const texto = partes.map(e => e.textContent).join('').replace(/\s+/g, '').split('').sort().join('');
  const filtros = [...document.querySelectorAll('#cp-filtros .ms-wrap')].map(w => w.id + ':' + (w._items || []).length).join(',');
  const nav = [...document.querySelectorAll(novo ? '#cp-nav .s-item[data-aba]' : '.nav-item[data-aba]')].map(b => b.dataset.aba + '=' + lim((b.querySelector(novo ? '.n' : '.qt') || {}).textContent)).sort().join(',');
  return { hero, tabs: JSON.stringify(tabs), texto: texto.length + ':' + texto.slice(0, 50) + texto.slice(-50), filtros, nav };
};
const abreAba = (aba) => {
  const b = document.querySelector(`#cp-nav .s-item[data-aba="${aba}"]`) || document.querySelector(`.nav-item[data-aba="${aba}"]`);
  b.click();
};
const only = ([rot, idx]) => {
  const w = [...document.querySelectorAll('#cp-filtros .ms-wrap')].find(w => (w.querySelector('.ms-lbl') || {}).textContent === rot);
  const o = w && w.querySelectorAll('.ms-only')[idx || 0];
  if (o) o.click();
  return o ? o.dataset.v : null;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');
const ABAS = ['Resumo', 'Lista de Peças', 'Modelos da Frota', 'Índice NCM', 'Leia-me', 'Validação', 'Fontes'];

// ══ 1 · hub: antigo × novo ══
console.log('\n══ números por aba: antigo × novo ══');
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, {
    url: `${ORIG}/catalogo-pecas/${lado === 'antigo' ? '__antigo.html' : ''}`,
    htmlAntigo, appAntigo: lado === 'antigo',
  });
  const r = res[lado] = { abas: {}, passos: {} };
  for (const a of ABAS) { await page.evaluate(abreAba, a); await page.waitForTimeout(80); r.abas[a] = await page.evaluate(leAba); }
  // filtros e interações na Lista de Peças
  await page.evaluate(abreAba, 'Lista de Peças'); await page.waitForTimeout(80);
  r.passos.base = await page.evaluate(leAba);
  r.passos.grupo = await page.evaluate(only, ['Grupo', 0]) + ' → ' + JSON.stringify(await page.evaluate(leAba));
  r.passos.familia = await page.evaluate(only, ['Família', 1]) + ' → ' + JSON.stringify(await page.evaluate(leAba));
  r.passos.unidade = await page.evaluate(only, ['Unidade', 1]) + ' → ' + JSON.stringify(await page.evaluate(leAba));
  // limpar filtros
  await page.evaluate(() => document.getElementById('f-limpa').click());
  r.passos.limpo = await page.evaluate(leAba);
  // ordenação pelo menu do cabeçalho (Peça, Z→A)
  await page.evaluate(() => { const th = [...document.querySelectorAll('.cp-tbl thead th')].find(t => /^Peça/.test(t.textContent)); th.click(); });
  await page.waitForTimeout(60);
  r.passos.menu = await page.evaluate(() => !!document.querySelector('.colmenu'));
  await page.evaluate(() => document.querySelector('.colmenu [data-ord="desc"]').click());
  await page.waitForTimeout(60);
  r.passos.ordena = await page.evaluate(leAba);
  // filtro pelo menu do cabeçalho (Material = 1º valor) — topo e cabeçalho em sincronia
  await page.evaluate(() => { const th = [...document.querySelectorAll('.cp-tbl thead th')].find(t => /^Material/.test(t.textContent)); th.click(); });
  await page.waitForTimeout(60);
  await page.evaluate(() => { const c = document.querySelector('.colmenu .cm-lista input[value]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(60);
  r.passos.menuFiltro = await page.evaluate(leAba);
  r.passos.contagem = await page.evaluate(() => { const w = [...document.querySelectorAll('#cp-filtros .ms-wrap')].find(w => w.querySelector('.ms-lbl').textContent === 'Material'); const c = w && w.querySelector('.ms-cnt'); return c ? c.textContent + '|' + getComputedStyle(c).display : '—'; });
  // mostrar mais
  await page.evaluate(() => document.getElementById('f-limpa').click());
  await page.evaluate(() => document.querySelector('.cp-mais').click());
  await page.waitForTimeout(80);
  r.passos.mais = await page.evaluate(leAba);
  r.errs = errs;
  await ctx.close();
}
for (const a of ABAS) {
  const A = res.antigo.abas[a], N = res.novo.abas[a];
  ok(`${a}: hero igual`, A.hero === N.hero, N.hero.slice(0, 90));
  ok(`${a}: tabelas iguais (linhas, cabeçalho, 1ªs e última linha)`, A.tabs === N.tabs, A.tabs === N.tabs ? `${JSON.parse(N.tabs).map(t => t.linhas).join('/') || 'sem tabela'}` : `antigo ${A.tabs.slice(0, 160)} × novo ${N.tabs.slice(0, 160)}`);
  ok(`${a}: texto da aba todo presente`, A.texto === N.texto, N.texto.split(':')[0] + ' caracteres');
  ok(`${a}: filtros iguais (ids e opções)`, A.filtros === N.filtros, N.filtros.slice(0, 120));
}
ok('menu lateral: mesmas abas e contagens', res.antigo.abas['Resumo'].nav === res.novo.abas['Resumo'].nav, res.novo.abas['Resumo'].nav);
for (const p of ['base', 'grupo', 'familia', 'unidade', 'limpo', 'menu', 'ordena', 'menuFiltro', 'mais']) {
  const A = JSON.stringify(res.antigo.passos[p]), N = JSON.stringify(res.novo.passos[p]);
  ok(`Lista de Peças · ${p}: igual`, A === N, A === N ? (typeof res.novo.passos[p] === 'string' ? res.novo.passos[p].slice(0, 70) : (res.novo.passos[p].hero || String(res.novo.passos[p])).slice(0, 70)) : `antigo ${A.slice(0, 200)} × novo ${N.slice(0, 200)}`);
}
ok('filtro Unidade existe (frota do Supabase chegou)', /ms-uni:\d+/.test(res.novo.passos.base.filtros), res.novo.passos.base.filtros.slice(0, 60));
// '' devolvia ao CSS (.ms-cnt{display:none}); com 'inline-block' (que dentro do flex do botão computa "block") ela aparece
ok('contagem laranja do filtro aparece no novo', /^1\|(inline-)?block$/.test(res.novo.passos.contagem), `novo ${res.novo.passos.contagem} · antigo ${res.antigo.passos.contagem}`);
ok('zero erro de página (antigo)', !res.antigo.errs.length, res.antigo.errs.join(' | '));
ok('zero erro de página (novo)', !res.novo.errs.length, res.novo.errs.join(' | '));

// ══ 2 · casca: sem rolagem, temas, visões, mini, PDF ══
console.log('\n══ casca: layout em 1366×768 e 1600×900, escuro e claro ══');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SLUG = a => a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, { url: `${ORIG}/catalogo-pecas/`, vp, tema });
    const tag = `${vp.width}×${vp.height} ${tema}`;
    ok(`${tag}: tema aplicado (body.claro ${tema === 'light'})`, await page.evaluate(() => document.body.classList.contains('claro')) === (tema === 'light'));
    ok(`${tag}: abre em "Resumo Gerencial"`, await page.evaluate(() => document.getElementById('tit').textContent) === 'Resumo Gerencial');
    const ruins = [];
    for (const a of ABAS) {
      await page.evaluate(abreAba, a); await page.waitForTimeout(120);
      const m = await page.evaluate(() => {
        const de = document.scrollingElement, main = document.getElementById('cp-main'), app = document.querySelector('.app').getBoundingClientRect();
        const tw = [...document.querySelectorAll('#cp-main .twrap')];
        return {
          rolaPag: de.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
          appFora: app.bottom > innerHeight + 1 || app.right > innerWidth + 1,
          rolaVw: main.scrollHeight > main.clientHeight + 2,
          horiz: tw.filter(t => t.scrollWidth > t.clientWidth + 1).length,
          altTab: tw.map(t => Math.round(t.getBoundingClientRect().height)),
          ptxt: [...document.querySelectorAll('#cp-main .ptxt')].map(t => Math.round(t.getBoundingClientRect().height)),
          tit: document.getElementById('tit').textContent,
          top: Math.round(document.querySelector('.top').getBoundingClientRect().height),
          on: (document.querySelector('#cp-nav .s-item.on') || {}).dataset?.aba,
        };
      });
      const prob = [];
      if (m.rolaPag) prob.push('página rola'); if (m.appFora) prob.push('app fora da tela'); if (m.rolaVw) prob.push('visão rola');
      if (m.horiz) prob.push(m.horiz + ' tabela(s) com barra horizontal');
      if (m.altTab.some(h => h < 110)) prob.push('tabela achatada ' + m.altTab.join('/'));
      if (m.ptxt.some(h => h < 90)) prob.push('texto achatado ' + m.ptxt.join('/'));
      if (m.on !== a) prob.push('item do menu não marcado');
      if (m.tit !== (a === 'Resumo' ? 'Resumo Gerencial' : a)) prob.push('título ' + m.tit);
      if (prob.length) ruins.push(`${a}: ${prob.join(', ')}`);
      if (SHOTS && vp.width === 1600) await page.screenshot({ path: path.join(SHOTS, `${tema === 'light' ? 'claro' : 'escuro'}-${SLUG(a === 'Resumo' ? 'resumo-gerencial' : a)}.png`) });
    }
    ok(`${tag}: 7 visões sem rolagem de página/visão, sem barra horizontal, nada achatado`, !ruins.length, ruins.join(' · '));
    if (vp.width === 1600 && tema === 'dark') {
      // filtro aberto e menu de coluna aberto (prints)
      await page.evaluate(abreAba, 'Lista de Peças');
      await page.evaluate(() => [...document.querySelectorAll('#cp-filtros .ms-btn')][2].click());
      await page.waitForTimeout(100);
      const pnl = await page.evaluate(() => { const p = document.querySelector('.ms-panel.open'); if (!p) return null; const r = p.getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, bg: getComputedStyle(p).backgroundColor }; });
      ok('filtro abre dentro da tela, opaco', pnl && pnl.l >= 0 && pnl.r <= 1600 && pnl.b <= 900 && !/rgba\(.*, 0\.\d+\)/.test(pnl.bg), JSON.stringify(pnl));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'escuro-filtro-aberto.png') });
      await page.mouse.click(800, 20);
      await page.evaluate(() => [...document.querySelectorAll('.cp-tbl thead th')][4].click());
      await page.waitForTimeout(100);
      ok('menu de coluna abre', await page.evaluate(() => !!document.querySelector('.colmenu')));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'escuro-menu-coluna.png') });
      // a tabela rola por dentro e fecha o menu de coluna
      await page.evaluate(() => { const t = document.querySelector('#cp-main .twrap'); t.scrollTop = 600; t.dispatchEvent(new Event('scroll')); });
      await page.waitForTimeout(80);
      ok('rolar a tabela fecha o menu de coluna', !(await page.evaluate(() => !!document.querySelector('.colmenu'))));
      // cabeçalho fixo: o th continua no topo da área rolada
      ok('cabeçalho da tabela fica fixo ao rolar', await page.evaluate(() => { const t = document.querySelector('#cp-main .twrap'), th = t.querySelector('thead th'); return Math.abs(th.getBoundingClientRect().top - t.getBoundingClientRect().top) < 3; }));
      // número à direita, texto à esquerda
      ok('coluna numérica à direita (Item), texto à esquerda (Peça)', await page.evaluate(() => {
        const ths = [...document.querySelectorAll('.cp-tbl thead th')];
        const it = ths.find(t => /^Item/.test(t.textContent)), pc = ths.find(t => /^Peça/.test(t.textContent));
        const td = document.querySelector('.cp-tbl tbody tr').cells;
        return getComputedStyle(it).textAlign === 'right' && getComputedStyle(td[ths.indexOf(it)]).textAlign === 'right' && getComputedStyle(pc).textAlign === 'left';
      }));
      // totalizador da planilha no tom do cabeçalho (Modelos da Frota: linha TOTAL)
      await page.evaluate(abreAba, 'Modelos da Frota');
      ok('linha TOTAL com fundo do cabeçalho', await page.evaluate(() => { const tr = document.querySelector('.cp-tbl tbody tr.total'); const th = document.querySelector('.cp-tbl thead th'); return !!tr && getComputedStyle(tr.cells[0]).backgroundColor === getComputedStyle(th).backgroundColor; }));
      // troca de tema pelo botão
      await page.evaluate(() => document.getElementById('btTema').click());
      ok('botão de tema troca para claro e grava bi_theme', await page.evaluate(() => document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light'));
      await page.evaluate(() => document.getElementById('btTema').click());
      // lateral recolhida
      await page.evaluate(() => trocaMini());
      const mini = await page.evaluate(() => ({ w: Math.round(document.querySelector('.side').getBoundingClientRect().width), k: localStorage.getItem('catpecas_mini'), it: document.querySelectorAll('#cp-nav .s-item').length }));
      ok('lateral recolhe (64 px, chave catpecas_mini)', mini.w === 64 && mini.k === '1', JSON.stringify(mini));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'escuro-lateral-recolhida.png') });
      await page.evaluate(() => trocaMini());
      // PDF na lateral (Atalhos) + exportadores carregados
      ok('"Gerar PDF" na lateral, em Atalhos', await page.evaluate(() => /pdf/i.test(document.getElementById('pdf-slot').textContent)));
      ok('Excel/PNG (excel-export) e ordenação (sortable-table) carregados', await page.evaluate(() => !!window.H2CPrep && !!window.SortableTables && document.querySelector('.cp-tbl').hasAttribute('data-no-sort')));
      ok('PDF enxerga as 7 visões', await page.evaluate(() => Object.keys(TIT).length === 7 && TIT['Resumo'] === 'Resumo Gerencial'));
    }
    ok(`${tag}: zero erro de página`, !errs.length, errs.join(' | '));
    await ctx.close();
  }
}

// celular: página volta a rolar, tabela com altura própria
{
  const { ctx, page, errs } = await abre(browser, { url: `${ORIG}/catalogo-pecas/`, vp: { width: 390, height: 844 } });
  await page.evaluate(abreAba, 'Lista de Peças'); await page.waitForTimeout(150);
  const m = await page.evaluate(() => ({ rola: document.body.scrollHeight > document.body.clientHeight && getComputedStyle(document.body).overflowY === 'auto', alt: Math.round(document.querySelector('#cp-main .cp-tsec').getBoundingClientRect().height), nav: getComputedStyle(document.querySelector('.side')).flexDirection }));
  ok('celular: página rola, tabela com altura, lateral vira fileira', m.rola && m.alt > 300 && m.nav === 'row', JSON.stringify(m));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'celular-lista.png') });
  const visCab = () => [...document.querySelectorAll('.cp-tbl thead th')].filter(t => getComputedStyle(t).display !== 'none').map(t => t.textContent.replace(/[▾▲▼]/g, '').trim()).join(' | ')
    + ' · detalhar:' + !!document.querySelector('.mt-detail-btn');
  await page.waitForTimeout(400);
  const cabNovo = await page.evaluate(visCab);
  const navLinha = await page.evaluate(() => { const its = [...document.querySelectorAll('.side .s-item')].map(b => Math.round(b.getBoundingClientRect().top)); return new Set(its).size; });
  ok('celular: visões numa fileira só (rola de lado)', navLinha === 1, navLinha + ' linha(s)');
  ok('celular: zero erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
  // o antigo no celular: mesmas colunas compactas + "+ Detalhar" (mobile.js)
  const v = await abre(browser, { url: `${ORIG}/catalogo-pecas/__antigo.html`, htmlAntigo, appAntigo: true, vp: { width: 390, height: 844 } });
  await v.page.evaluate(abreAba, 'Lista de Peças'); await v.page.waitForTimeout(700);
  const cabAntigo = await v.page.evaluate(visCab);
  ok('celular: tabela compacta igual à do antigo (colunas + "+ Detalhar")', cabAntigo === cabNovo, `novo ${cabNovo} · antigo ${cabAntigo}`);
  await v.ctx.close();
}

// ══ 3 · externo: o mesmo HTML com o app antigo × o app novo ══
console.log('\n══ catalogo-pecas-externo: app antigo × app novo ══');
const ext = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, { url: `${ORIG}/catalogo-pecas-externo/`, appAntigo: lado === 'antigo' });
  await page.waitForTimeout(300);
  const snap = () => ({ body: document.body.innerHTML, css: (document.getElementById('cp-style') || {}).textContent, head: document.head.innerHTML.replace(/<style id="cp-style">[\s\S]*?<\/style>/, '') });
  const e = ext[lado] = { s0: await page.evaluate(snap) };
  // outra aba + filtro + menu de coluna
  await page.evaluate(() => document.querySelector('.nav-item[data-aba="A. Peça+NCM"]').click());
  await page.waitForTimeout(80);
  await page.evaluate(() => { const o = document.querySelector('#cp-filtros .ms-only'); if (o) o.click(); });
  await page.waitForTimeout(80);
  e.s1 = await page.evaluate(snap);
  await page.evaluate(() => document.querySelector('.cp-tbl thead th').click());
  await page.evaluate(() => document.querySelector('.colmenu [data-ord="desc"]').click());
  await page.evaluate(() => document.querySelector('.cp-mais') && document.querySelector('.cp-mais').click());
  await page.waitForTimeout(80);
  e.s2 = await page.evaluate(snap);
  e.cont = await page.evaluate(() => ({ abas: document.querySelectorAll('.nav-item').length, linhas: document.querySelector('[data-tbl]').dataset.linhas, tr: document.querySelectorAll('.cp-tbl tbody tr').length }));
  e.errs = errs;
  if (SHOTS && lado === 'novo') await page.screenshot({ path: path.join(SHOTS, 'externo-inalterado.png') });
  await ctx.close();
}
for (const s of ['s0', 's1', 's2']) {
  ok(`externo ${s}: HTML do <body> idêntico`, ext.antigo[s].body === ext.novo[s].body, `${ext.novo[s].body.length} caracteres`);
  ok(`externo ${s}: CSS injetado idêntico`, ext.antigo[s].css === ext.novo[s].css && !!ext.novo[s].css, `${(ext.novo[s].css || '').length} caracteres`);
  ok(`externo ${s}: <head> idêntico`, ext.antigo[s].head === ext.novo[s].head);
}
ok('externo: mesmas contagens (abas, linhas, linhas exibidas)', JSON.stringify(ext.antigo.cont) === JSON.stringify(ext.novo.cont), JSON.stringify(ext.novo.cont));
ok('externo: zero erro de página nos dois lados', !ext.antigo.errs.length && !ext.novo.errs.length, [...ext.antigo.errs, ...ext.novo.errs].join(' | '));

await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

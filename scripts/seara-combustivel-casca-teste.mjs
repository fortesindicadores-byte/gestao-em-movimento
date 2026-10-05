// ============================================================================
// Migração dos painéis Km/L · Seara (combustivel/seara/eficiencia) e
// R$/L · Seara (combustivel/seara/preco-litro) para a casca padrão.
//
// Abre o painel ANTIGO (HEAD, servido de um arquivo à parte) e o NOVO no
// Chromium com o gviz DUBLADO (fetch e JSONP) e confere:
//   · os números (hero, total das duas tabelas, séries dos gráficos) saem
//     IGUAIS nos dois lados, sem filtro e com filtro de Modelo / Vigência;
//   · no novo: zero erro de página, sem rolagem da página e sem barra lateral
//     em tabela (1366×768 e 1600×900), cada visão abre, tema claro/escuro
//     redesenha o gráfico, ordenação, menu de Excel, botão de PDF, celular.
//
// Uso (de dentro de docs/driverpro-apresentacao, onde o playwright resolve):
//   RAIZ=<repo> ANTIGO_EFIC=<html antigo> ANTIGO_PRECO=<html antigo>
//   CHARTJS=<chart.umd.js 4.4.0> SHOT_DIR=<pasta> node _copia.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const SHOT = process.env.SHOT_DIR || '';
const CHARTJS = process.env.CHARTJS || '';
const ANTIGO = { eficiencia: process.env.ANTIGO_EFIC, 'preco-litro': process.env.ANTIGO_PRECO };
const SO = process.env.PAINEL || '';   // eficiencia | preco-litro | (vazio = os dois)

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  // o painel antigo é servido NA MESMA PASTA do novo, para os ../../../assets resolverem
  const m = u.match(/^\/combustivel\/seara\/([^/]+)\/__antigo\.html$/);
  const f = m ? ANTIGO[m[1]] : path.join(RAIZ, u);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures no formato das abas ──────────────────────────────────────────
   Combustível (gid 1982300845): C=2 projeto · D=3 unidade · E=4 placa ·
   F=5 mês · G=6 ano · H=7 modelo · I=8 combustível · J=9 tipo · K=10 km ·
   L=11 litros · N=13 total R$.
   Base Remunerado (gid 0): Vigência · Placa · KmPorLitro · PrecoDiesel (pelo nome). */
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const MODELOS = [['VW 17.190', 'CAMINHAO BAU ROLL UP 10 PALLETS', 3.1], ['VW 11.180', 'CAMINHAO BAU ROLL UP 8 PALLETS', 3.9],
  ['MB ACCELO 1016', 'CAMINHAO BAU ROLL UP 6 PALLETS', 4.6], ['VW 24.280', 'CAMINHAO BAU SIDER PLATAFORMA HIDRAULICA 16 PALLETS', 2.7],
  ['IVECO DAILY 35-150', 'CAMINHONETE FURGAO', 7.2], ['SCANIA R450', 'CAVALO MECANICO', 2.2]];
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago'];
const PLACAS = Array.from({ length: 28 }, (_, i) => {
  const L = 'ABCDEFGHIJ';
  return { placa: `S${L[i % 10]}R${(i % 10)}${L[(i * 3) % 10]}${String(10 + i).slice(-2)}`, mod: MODELOS[i % MODELOS.length], proj: i % 4 === 0 ? 'TRANSFERENCIA' : 'ROTA' };
});
const COMB = [], BREM = [];
for (let mi = 0; mi < MES3.length; mi++) for (const p of PLACAS) {
  if (rnd() < 0.08) continue;                         // placa que não rodou no mês
  const km = Math.round(1500 + rnd() * 4500);
  const kml = p.mod[2] * (0.85 + rnd() * 0.3);
  const lit = Math.round(km / kml * 10) / 10;
  const preco = 5.6 + rnd() * 0.8;
  COMB.push([null, null, p.proj, 'ANHANGUERA', p.placa, MES3[mi], 2026, p.mod[0], 'DIESEL S10', p.mod[1], km, lit, null, Math.round(lit * preco * 100) / 100]);
  if (mi < 7) BREM.push([`${String(mi + 1).padStart(2, '0')}/2026`, p.placa, Math.round(p.mod[2] * 100) / 100, Math.round((5.75 + rnd() * 0.4) * 1000) / 1000]);
}
const COLS_COMB = ['Operação', 'Empresa', 'Projeto', 'Unidade', 'Placa', 'Mês', 'Ano', 'Modelo', 'Combustível', 'Tipo Veículo', 'KM', 'Litros', 'Preço', 'Total R$'];
const COLS_BREM = ['Vigência', 'Placa', 'KmPorLitro', 'PrecoDiesel'];

async function abre(browser, url, { vp = { width: 1600, height: 900 }, tema = 'dark', mini = '0' } = {}) {
  const page = await browser.newPage({ viewport: vp });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ COMB, BREM, COLS_COMB, COLS_BREM, tema, mini }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('kmlseara_mini', mini); localStorage.setItem('rslseara_mini', mini);
    window.__PEDIDOS = [];
    const corpo = u => /gid=1982300845/.test(u) ? { rows: COMB, cols: COLS_COMB }
      : /gid=0\b/.test(u) ? { rows: BREM, cols: COLS_BREM } : { rows: [], cols: ['A'] };
    window.__respGviz = u => { window.__PEDIDOS.push(u); const { rows, cols } = corpo(u);
      return JSON.stringify({ status: 'ok', table: { cols: cols.map(c => ({ label: c, id: c })), rows: rows.map(r => ({ c: r.map(v => (v == null ? null : { v })) })) } }); };
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com'))
        return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${window.__respGviz(s)});`, { status: 200 }));
      if (s.startsWith(location.origin)) return real(u, i);
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = window.__respGviz(n.src);
        setTimeout(() => { if (fn && window[fn]) window[fn](JSON.parse(body)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
    window.prompt = () => 'Teste';
  }, { COMB, BREM, COLS_COMB, COLS_BREM, tema, mini });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/cdn.jsdelivr.net/**', r => {
    if (/chart\.js@4/.test(r.request().url()) && CHARTJS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHARTJS) });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('h-real'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, errs };
}

// lê os números que a tela mostra (iguais nos dois lados = a lógica não mudou)
const LE = () => {
  const t = id => (document.getElementById(id) || {}).textContent;
  const tot = id => { const r = document.querySelector('#' + id + ' tr.total'); return r ? [...r.cells].map(c => c.textContent.trim()).join(' | ') : null; };
  const linhas = id => [...document.querySelectorAll('#' + id + ' tr')].map(r => [...r.cells].map(c => c.textContent.trim()).join(' | '));
  const ser = c => c && c.data ? c.data.datasets.map(d => d.data.map(v => v == null ? null : Math.round(v * 1000) / 1000)) : null;
  return {
    hero: ['h-real', 'h-rem', 'h-drem-v', 'h-drem-p', 'h-imp', 'h-ytd-v', 'h-ytd-p', 'h-ytd-imp'].map(t).join(' · '),
    totKml: tot('body-kml'), nKml: linhas('body-kml').length, kml: linhas('body-kml').join('\n'),
    nVei: linhas('body-vei').length, vei: linhas('body-vei').join('\n'),
    chKml: JSON.stringify(ser(typeof chKml !== 'undefined' && chKml)),
    chProj: JSON.stringify(ser(typeof chProj !== 'undefined' && chProj)), projLbl: JSON.stringify(typeof chProj !== 'undefined' && chProj ? chProj.data.labels : null),
    subKml: t('sub-kml'),
  };
};
// aplica o filtro pelo contrato wrap._sel + atualizar() (o mesmo do /check-metas/)
const FILTRA = ([id, vals]) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); if (w._render) w._render(''); atualizar(); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

for (const P of ['eficiencia', 'preco-litro']) {
  if (SO && SO !== P) continue;
  const urlNovo = `/combustivel/seara/${P}/index.html`, urlVelho = `/combustivel/seara/${P}/__antigo.html`;
  console.log(`\n══ ${P}`);

  // ── 1) números: antigo × novo ──
  // os cenários são CUMULATIVOS (o filtro anterior continua valendo)
  const cen = [['sem filtro', null], ['Modelo = VW 17.190', ['ms-modelo', ['VW 17.190']]], ['+ Vigência = todas', ['ms-vig', []]],
    ['+ Vigência jun+jul + Projeto ROTA', null, [['ms-vig', ['2026-06', '2026-07']], ['ms-proj', ['ROTA']]]]];
  const res = { velho: [], novo: [] };
  for (const lado of ['velho', 'novo']) {
    const { page, errs } = await abre(browser, lado === 'velho' ? urlVelho : urlNovo);
    for (const [, f, multi] of cen) {
      if (f) await page.evaluate(FILTRA, f);
      if (multi) for (const m of multi) await page.evaluate(FILTRA, m);
      await page.waitForTimeout(150);
      res[lado].push(await page.evaluate(LE));
    }
    res[lado + 'Errs'] = errs;
    await page.close();
  }
  af('painel antigo carregou sem erro de página', res.velhoErrs.length === 0, res.velhoErrs[0] || '');
  af('painel novo carregou sem erro de página', res.novoErrs.length === 0, res.novoErrs[0] || '');
  cen.forEach(([nome], i) => {
    const a = res.velho[i], b = res.novo[i];
    console.log(`     [${nome}] hero: ${b.hero}`);
    console.log(`     [${nome}] total ${P === 'eficiencia' ? 'Km/L' : 'R$/L'} Detalhado: ${b.totKml}`);
    af(`${nome}: hero igual`, a.hero === b.hero, a.hero === b.hero ? '' : a.hero + '  ≠  ' + b.hero);
    af(`${nome}: tabela Detalhado igual (${b.nKml} linhas)`, a.kml === b.kml && b.nKml > 1);
    af(`${nome}: Consumo por Veículo igual (${b.nVei} linhas)`, a.vei === b.vei && b.nVei > 1);
    af(`${nome}: séries dos gráficos iguais`, a.chKml === b.chKml && a.chProj === b.chProj && a.projLbl === b.projLbl && b.chKml !== 'null');
  });
  af('filtro de Modelo muda os números', res.novo[1].hero !== res.novo[0].hero);
  af('filtro de Vigência muda os números', res.novo[2].hero !== res.novo[1].hero);
  af('filtro de Vigência + Projeto muda os números', res.novo[3].hero !== res.novo[2].hero);

  // ── 2) casca: rolagem, visões, tabelas, tema ──
  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
    const { page, errs } = await abre(browser, urlNovo, { vp });
    const r = await page.evaluate(async () => {
      const out = [];
      for (const v of Object.keys(TIT)) {
        setVw(v); await new Promise(r => setTimeout(r, 120));
        const sec = document.querySelector('.vw.on');
        const tw = sec.querySelector('.twrap');
        const gc = [...sec.querySelectorAll('.gcv')].map(e => Math.round(e.getBoundingClientRect().height));
        out.push({ v, id: sec.id, tit: document.getElementById('tit').textContent,
          pagRola: document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
          vwRola: sec.scrollHeight > sec.clientHeight + 1,
          tabLado: tw ? tw.scrollWidth > tw.clientWidth + 1 : false,
          tabRolaDentro: tw ? tw.scrollHeight >= tw.clientHeight : null, gc });
      }
      return out;
    });
    for (const x of r) {
      af(`${vp.width}×${vp.height} · ${x.tit}: abre, sem rolagem da página/visão${x.gc.length ? ', gráficos ' + x.gc.join('/') + 'px' : ''}`,
        x.id === 'vw-' + x.v && x.tit === ({ resumo: 'Resumo Gerencial' }[x.v] || x.tit) && !x.pagRola && !x.vwRola && x.gc.every(h => h > 120),
        JSON.stringify({ pag: x.pagRola, vw: x.vwRola }));
      if (x.v !== 'resumo') af(`${vp.width}×${vp.height} · ${x.tit}: sem barra horizontal na tabela`, !x.tabLado);
    }
    af(`${vp.width}×${vp.height}: sem erro de página`, errs.length === 0, errs[0] || '');
    await page.close();
  }

  {
    const { page, errs } = await abre(browser, urlNovo);
    const r = await page.evaluate(async () => {
      const o = {};
      o.nomesVisoes = Object.values(TIT);
      o.pdf = !!document.querySelector('#pdf-slot .s-item, #pdf-slot button');
      o.atualizar = [...document.querySelectorAll('.side .s-item')].some(b => /Atualizar dados/.test(b.textContent));
      o.voltar = [...document.querySelectorAll('.side a.s-item')].map(a => a.getAttribute('href'));
      const c0 = chKml; o.escuro = !document.body.classList.contains('claro');
      trocaTema(); await new Promise(r => setTimeout(r, 80));
      o.claro = document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light';
      o.redesenhou = chKml !== c0;
      o.corRemClaro = chKml.data.datasets[1].borderColor;
      trocaTema(); await new Promise(r => setTimeout(r, 80));
      o.corRemEscuro = chKml.data.datasets[1].borderColor;
      // ordenação própria da tabela de veículos
      setVw('vei'); await new Promise(r => setTimeout(r, 80));
      const prim = () => document.querySelector('#body-vei tr').cells[4].textContent;
      const antes = prim(); document.querySelector('#tbl-vei th[onclick*="placa"], #tbl-vei th[onclick*="real"]').click();
      await new Promise(r => setTimeout(r, 80));
      o.ordenou = prim() !== antes && /[▲▼]/.test(document.getElementById('sort-real').textContent);
      // cores de resultado vencem o table.dre td
      const cr = document.querySelector('#body-vei td.cr, #body-vei td.cg');
      o.corRes = cr ? getComputedStyle(cr).color : null;
      o.corTd = getComputedStyle(document.querySelector('#body-vei td:nth-child(6)')).color;
      // totalizador com o tom do cabeçalho; cabeçalho numérico à direita
      setVw('det'); await new Promise(r => setTimeout(r, 80));
      const tt = document.querySelector('#body-kml tr.total td');
      o.totBg = getComputedStyle(tt).backgroundColor; o.cabBg = getComputedStyle(document.querySelector('#tbl-kml thead th')).backgroundColor;
      o.thNum = getComputedStyle(document.querySelector('#tbl-kml thead th.num')).textAlign;
      o.thTxt = getComputedStyle(document.querySelector('#tbl-kml thead th')).textAlign;
      o.mini = (() => { trocaMini(); const m = document.querySelector('.side').classList.contains('mini'); trocaMini(); return m; })();
      return o;
    });
    af('visões: Resumo Gerencial + Detalhado + Consumo por Veículo', r.nomesVisoes[0] === 'Resumo Gerencial' && r.nomesVisoes.length === 3, r.nomesVisoes.join(' / '));
    af('Gerar PDF em Atalhos', r.pdf);
    af('Atualizar dados na lateral', r.atualizar);
    af('volta ao hub da Seara (../)', r.voltar.includes('../'), r.voltar.join(','));
    af('tema escuro por padrão → claro (body.claro + bi_theme) redesenha o gráfico', r.escuro && r.claro && r.redesenhou, `${r.corRemClaro} / ${r.corRemEscuro}`);
    af('cor da linha remunerada segue o tema', r.corRemClaro !== r.corRemEscuro);
    af('ordenação da tabela de veículos', r.ordenou);
    af('cor de resultado vence table.dre td', r.corRes && r.corRes !== r.corTd, `${r.corRes} vs ${r.corTd}`);
    af('totalizador no tom do cabeçalho', r.totBg === r.cabBg, `${r.totBg} / ${r.cabBg}`);
    af('cabeçalho: texto à esquerda, número à direita', r.thNum === 'right' && r.thTxt === 'left');
    af('lateral recolhe', r.mini);
    // Excel/PNG pelo botão direito
    await page.evaluate(() => setVw('vei'));
    await page.click('#body-vei tr td:nth-child(7)', { button: 'right' });
    const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && m.style.display !== 'none' ? m.textContent : ''; });
    af('botão direito na tabela → Exportar Excel / PNG', /Exportar Excel/.test(menu) && /PNG/.test(menu));
    await page.mouse.click(5, 5);
    await page.evaluate(() => setVw('resumo'));
    await page.waitForTimeout(150);
    await page.click('#ch-kml', { button: 'right' });
    const menu2 = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && m.style.display !== 'none' ? m.textContent : ''; });
    af('botão direito no gráfico → Exportar Excel / PNG', /Exportar Excel/.test(menu2));
    af('sem erro de página (interações)', errs.length === 0, errs[0] || '');
    await page.close();
  }

  // ── 3) celular ──
  {
    const { page, errs } = await abre(browser, urlNovo, { vp: { width: 390, height: 844 } });
    const r = await page.evaluate(async () => {
      const o = { bodyRola: getComputedStyle(document.body).overflow !== 'hidden', side: getComputedStyle(document.querySelector('.side')).flexDirection };
      o.gc = [...document.querySelectorAll('#vw-resumo .gcv')].map(e => Math.round(e.getBoundingClientRect().height));
      setVw('vei'); await new Promise(r => setTimeout(r, 100));
      o.tw = Math.round(document.querySelector('#vw-vei .twrap').getBoundingClientRect().height);
      return o;
    });
    af('celular: página rola, lateral vira fileira, gráfico e tabela com altura', r.bodyRola && r.side === 'row' && r.gc.every(h => h > 150) && r.tw > 150, JSON.stringify(r));
    af('celular: sem erro de página', errs.length === 0, errs[0] || '');
    await page.close();
  }

  // ── 4) prints 1600×900, escuro e claro, uma por visão ──
  if (SHOT) {
    const dir = path.join(SHOT, 'combustivel-seara-' + P);
    fs.mkdirSync(dir, { recursive: true });
    for (const tema of ['dark', 'light']) {
      const { page } = await abre(browser, urlNovo, { tema });
      for (const v of ['resumo', 'det', 'vei']) {
        await page.evaluate(v => setVw(v), v);
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(dir, `${v}-${tema === 'dark' ? 'escuro' : 'claro'}.png`) });
      }
      await page.close();
    }
    { const { page } = await abre(browser, urlNovo, { vp: { width: 1366, height: 768 } });
      await page.evaluate(() => setVw('vei')); await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(dir, 'vei-1366.png') }); await page.close(); }
    { const { page } = await abre(browser, urlNovo, { vp: { width: 390, height: 844 } });
      await page.screenshot({ path: path.join(dir, 'celular.png'), fullPage: true }); await page.close(); }
  }
}

await browser.close();
srv.close();
console.log(`\n${falhas ? '✗' : '✓'} ${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

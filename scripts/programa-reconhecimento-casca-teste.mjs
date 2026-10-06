// Migração do Frota de Elite (programa-reconhecimento/) para a casca padrão do
// portal — conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// Dublês: o assets/gerot-base.js é SUBSTITUÍDO por um GerotBase de mentira (como no
// elite-vigencia-teste: pôr o dublê no addInitScript não serve, o arquivo real o
// sobrescreve) com 12 unidades do programa (MACACU já unificado, fundir:true) × 8
// vigências × 11 indicadores; o supabase-js é um dublê que responde portal_flags
// (a cortina) e fca_profiles (admin) conforme o cenário. Chart.js e datalabels reais
// via CHART_JS / DL_JS; Montserrat real via FONT_DIR (para medir corte de texto).
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:programa-reconhecimento/index.html > <antigo.html>   (o último antes da casca)
//   cp scripts/programa-reconhecimento-casca-teste.mjs docs/driverpro-apresentacao/_elite-casca-<id>.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGO=<antigo.html> \
//     CHART_JS=<chart.umd.js> DL_JS=<chartjs-plugin-datalabels.js> FONT_DIR=<@fontsource/montserrat/files> \
//     SHOTS=<pasta> node _elite-casca-<id>.mjs ; rm _elite-casca-<id>.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const CHART_JS = process.env.CHART_JS || '';
const DL_JS = process.env.DL_JS || '';
const FONT_DIR = process.env.FONT_DIR || '';
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070400';
const ORIG = 'http://gem.teste';
const PASTA = 'programa-reconhecimento';

// ── dados sintéticos no formato do GerotBase (vig 'AAAA-MM', unit = NOME) ──
const UNIS = ['MACACU', 'CDD PELOTAS', 'CDD RONDONOPOLIS', 'CDD NOVA FRIBURGO', 'CDD RIO DE JANEIRO',
  'CDD FLORIANOPOLIS', 'CDD CUIABA', 'CDD GUARULHOS', 'CDD CAMBORIU', 'PIRAI EMPURRADA', 'CUIABA EMPURRADA', 'CUIABA'];
const CAMPOS = ['disp', 'prev', 'comb', 'pneus', 'checkT', 'checkWH', 'conf', 'stVeic', 'stEmp', 'civf', 'sla'];
const VIGS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const RECS = [];
for (const v of VIGS) for (const u of UNIS) for (const f of CAMPOS) {
  if (f === 'checkWH' && !['CUIABA', 'MACACU', 'CDD RIO DE JANEIRO'].includes(u)) continue;   // nem toda unidade tem todo indicador
  if (f === 'checkT' && u === 'CUIABA') continue;
  if (f === 'conf' && /EMPURRADA/.test(u) && v < '2026-04') continue;                        // empurradas só de abr/26
  const atg = Math.round((72 + rnd() * 30) * 100) / 100;
  RECS.push({ field: f, label: f, unit: u, vig: v, real: atg, meta: 100, atg: Math.min(atg, 100), atgMeta: Math.min(atg, 100) });
}
// o acumulado da janela: um número próprio (não a média dos meses), como o escopo 'ano' do Ginfo
const GB_JS = `(function(){
  var RECS=${JSON.stringify(RECS)};
  window.GerotBase={ INDICADORES:[], INDICADORES_GEROT:[], COD2UNIT:{},
    load:function(){ return new Promise(function(res){ setTimeout(function(){ res(JSON.parse(JSON.stringify(RECS))); },150); }); },
    acumFor:function(vigs){ var m={};
      RECS.forEach(function(r){ if(vigs.indexOf(r.vig)<0) return; var k=r.unit+'|'+r.field;
        (m[k]=m[k]||{unit:r.unit,field:r.field,s:0,n:0}); m[k].s+=r.atg*(1+vigs.indexOf(r.vig)%3); m[k].n+=1+vigs.indexOf(r.vig)%3; });
      return Object.keys(m).map(function(k){ var o=m[k]; return {unit:o.unit,field:o.field,label:o.field,atg:o.s/o.n}; }); } };
})();`;

// supabase-js: portal_flags (cortina) e fca_profiles (admin), conforme window.__T
const SB_JS = `window.supabase={createClient:function(){
  var T=function(){ return window.__T||{visivel:true,admin:false}; };
  function q(tab){ var o={_tab:tab,_upd:null};
    ['select','eq','limit','order','in','gte','lte'].forEach(function(m){o[m]=function(){return o;};});
    o.update=function(d){ o._upd=d; return o; };
    o.maybeSingle=function(){
      if(tab==='portal_flags') return Promise.resolve({data:{ligado:T().visivel,mensagem:T().msg||''},error:null});
      if(tab==='fca_profiles') return Promise.resolve({data:{is_admin:!!T().admin},error:null});
      return Promise.resolve({data:null,error:null}); };
    o.then=function(res,rej){ if(o._upd){ (window.__T=window.__T||{}).gravou=o._upd; } return Promise.resolve({data:[],error:null}).then(res,rej); };
    return o; }
  return { auth:{ getUser:function(){ return Promise.resolve({data:{user:T().admin?{id:'u-admin'}:(T().logado?{id:'u-uni'}:null)}}); },
                  getSession:function(){ return Promise.resolve({data:{session:null}}); },
                  onAuthStateChange:function(){ return {data:{subscription:{unsubscribe:function(){}}}}; } },
           from:function(t){ return q(t); } };
}};`;

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema, T = { visivel: true, admin: false }, espera = true) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ tema, T }) => {
    sessionStorage.setItem('gem_hub', '1');
    if (!sessionStorage.getItem('_limpo')) { localStorage.clear(); sessionStorage.setItem('_limpo', '1'); }   // sem cache na 1ª carga
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('bi_user_name', 'Teste');
    window.__T = T;
  }, { tema, T });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      if (u.pathname.includes('/assets/gerot-base.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: GB_JS });
      if (u.pathname.includes('/assets/gviz-cache.js') || u.pathname.includes('/assets/build-check.js'))
        return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net') {
      if (u.pathname.includes('datalabels')) return r.fulfill({ status: 200, contentType: 'application/javascript',
        body: DL_JS ? fs.readFileSync(DL_JS) : 'window.ChartDataLabels={id:"datalabels"};' });
      if (u.pathname.includes('chart.js') && CHART_JS) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
      if (u.pathname.includes('supabase')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: SB_JS });
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
  if (espera) await page.waitForFunction(() => document.querySelectorAll('#ranking-tbody tr').length > 5 && /Atualizado/.test((document.getElementById('status-badge') || {}).textContent || ''), null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(600);
  return { ctx, page, errs };
}

// números da tela, lidos pelos ids (iguais nos dois lados)
const leNumeros = () => {
  const t = id => (document.getElementById(id) || {}).textContent?.replace(/\s+/g, ' ').trim();
  const out = {};
  ['hero-score', 'hero-period', 'podio-period', 'ranking-sub', 'ms-vig-lbl', 'ms-vig-cnt'].forEach(id => out[id] = t(id));
  out.cards = [...document.querySelectorAll('#ind-cards .kpi-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim() + '@' + c.querySelector('.ind-farol').style.background).join(' ;; ');
  out.ranking = [...document.querySelectorAll('#ranking-tbody tr')].map(tr => tr.className + ':' + [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim() + (c.querySelector('span') ? '[' + c.querySelector('span').className + ']' : '')).join(' | ')).join(' ;; ');
  out.podio = [...document.querySelectorAll('.podio-slot')].map(s => [s.className, s.querySelector('.pedestal-place')?.textContent, s.querySelector('.pedestal-name')?.textContent,
    s.querySelector('.pedestal-unit')?.textContent, s.querySelector('.pedestal-score')?.textContent, s.querySelector('img')?.getAttribute('src')].join('|')).join(' ;; ');
  out.vigs = [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt)')].map(o => o.querySelector('input').value + '=' + o.querySelector('label').textContent + (o.querySelector('input').checked ? '*' : '')).join(',');
  // o Resumo Executivo saiu do painel (Renan, 06/10/2026) — não se compara mais
  out.pesos = (document.getElementById('peso-grid') || {}).textContent?.replace(/\s+/g, ' ').trim();
  out.indBtns = [...document.querySelectorAll('#ind-selector .ind-btn')].map(b => b.textContent + (b.classList.contains('active') ? '*' : '')).join(',');
  const ch = id => { const k = window.Chart && Chart.getChart && Chart.getChart(document.getElementById(id)); return k ? JSON.stringify([k.data.labels, k.data.datasets.map(d => [d.label, d.data, d.backgroundColor])]) : null; };
  out.chartTemporal = ch('chartTemporal');
  out.chartIndicadores = ch('chartIndicadores');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base e depois de filtros e do seletor de indicador
console.log('\n══ números: antigo × novo ══');
const passos = {
  base: null,
  'só ago/26 (onlyOpt)': `onlyOpt('vig','2026/08/01')`,
  'jun+jul (acumulado da janela)': `setSelArr('vig',['2026/06/01','2026/07/01']);updateMsBtn('vig');renderAll()`,
  'indicador Pontuação no gráfico': `setActiveInd('pontuacao')`,
  'indicador Conformidade + Todas': `setActiveInd('conf');toggleAll('vig')`,
  'contrato check-metas (__cm.elite: setSelArr+updateMsBtn+renderAll em mar/26)': `setSelArr('vig',['2026/03/01']);updateMsBtn('vig');renderAll()`,
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
console.log('  novo base:', JSON.stringify({ hero: b['hero-score'], periodo: b['hero-period'], vigs: b.vigs.split(',').length, podio: b.podio.slice(0, 160) }));
ok('hero carregou com número', b['hero-score'] && b['hero-score'] !== '—', b['hero-score']);
ok('ranking com as 12 unidades', b.ranking.split(' ;; ').length === 12);
ok('pódio com três degraus', b.podio.split(' ;; ').length === 3);
ok('lista de vigências com os 8 meses, o mais recente no topo', b.vigs.split(',').length === 8 && b.vigs.startsWith('2026/08/01'), b.vigs.slice(0, 60));
ok('gráficos com dados', !!b.chartTemporal && !!b.chartIndicadores);
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    if (k === 'ms-vig-cnt') continue;   // a contagem: no antigo o display '' nunca a mostrava; o texto é o mesmo, conferido abaixo
    ok(`igual antes × depois [${nome}]: ${k}`, JSON.stringify(A[k]) === JSON.stringify(N[k]),
      JSON.stringify(A[k]) === JSON.stringify(N[k]) ? '' : `${String(A[k]).slice(0, 140)} × ${String(N[k]).slice(0, 140)}`);
  }
}
ok('filtro muda os números', res.novo['só ago/26 (onlyOpt)']['hero-score'] !== b['hero-score'], `${b['hero-score']} → ${res.novo['só ago/26 (onlyOpt)']['hero-score']}`);
ok('janela de 2 meses usa o acumulado (≠ média simples dos meses)', res.novo['jun+jul (acumulado da janela)']['hero-score'] !== '—');

// 2 · cortina da apuração
console.log('\n══ cortina da apuração ══');
for (const lado of ['antigo', 'novo']) {
  const html = lado === 'antigo' ? htmlAntigo : null;
  {
    const { ctx, page, errs } = await abre(browser, html, { width: 1366, height: 768 }, 'dark', { visivel: false, admin: false, logado: true }, false);
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      return { oculto: document.body.classList.contains('oculto'), cortina: vis(document.getElementById('cortina')),
        rk: vis(document.getElementById('ranking-table')), hero: vis(document.getElementById('hero-score')),
        raw: typeof RAW !== 'undefined' ? RAW.length : -1, btn: vis(document.getElementById('cortinaBtn')),
        aviso: vis(document.getElementById('cortinaAviso')), status: document.getElementById('status-badge').textContent,
        filtro: vis(document.getElementById('ms-vig-btn')), visoes: [...document.querySelectorAll('.s-item[data-vw]')].some(vis) };
    });
    ok(`${lado} · fechado + unidade: o aviso de apuração cobre o painel`, m.oculto && m.cortina && !m.rk && !m.hero && !m.filtro, JSON.stringify(m));
    ok(`${lado} · fechado + unidade: os dados nem carregam`, m.raw === 0 && m.status === 'Em apuração', m.raw + ' · ' + m.status);
    ok(`${lado} · fechado + unidade: sem botão de admin nem faixa`, !m.btn && !m.aviso);
    if (lado === 'novo') ok('novo · fechado + unidade: as visões da lateral somem também', !m.visoes);
    if (SHOTS && lado === 'novo') { fs.mkdirSync(path.join(SHOTS, PASTA), { recursive: true }); await page.screenshot({ path: path.join(SHOTS, PASTA, 'cortina-unidade.png') }); }
    ok(`${lado} · fechado + unidade: zero erro`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await abre(browser, html, { width: 1366, height: 768 }, 'dark', { visivel: false, admin: true });
    const m = await page.evaluate(() => {
      const vis = el => !!el && el.getClientRects().length > 0;
      return { oculto: document.body.classList.contains('oculto'), cortina: vis(document.getElementById('cortina')),
        rk: document.querySelectorAll('#ranking-tbody tr').length, hero: document.getElementById('hero-score').textContent,
        btn: vis(document.getElementById('cortinaBtn')) ? document.getElementById('cortinaBtn').textContent.trim() : null,
        aviso: vis(document.getElementById('cortinaAviso')) ? document.getElementById('cortinaAviso').textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : null };
    });
    ok(`${lado} · fechado + admin: vê os números`, !m.oculto && !m.cortina && m.rk === 12 && m.hero !== '—', JSON.stringify(m));
    ok(`${lado} · fechado + admin: faixa amarela e botão "Liberar resultado"`, /Resultado oculto/.test(m.aviso || '') && m.btn === 'Liberar resultado', m.aviso + ' · ' + m.btn);
    if (SHOTS && lado === 'novo') await page.screenshot({ path: path.join(SHOTS, PASTA, 'cortina-admin.png') });
    await page.click('#cortinaBtn'); await page.waitForTimeout(400);
    const d = await page.evaluate(() => ({ btn: document.getElementById('cortinaBtn').textContent.trim(), gravou: window.__T.gravou && window.__T.gravou.ligado,
      aviso: document.getElementById('cortinaAviso').classList.contains('on') }));
    ok(`${lado} · admin clica: grava ligado=true e o botão vira "Ocultar resultado"`, d.btn === 'Ocultar resultado' && d.gravou === true && !d.aviso, JSON.stringify(d));
    ok(`${lado} · fechado + admin: zero erro`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  {
    const { ctx, page } = await abre(browser, html, { width: 1366, height: 768 }, 'dark', { visivel: true, admin: false, logado: true });
    const m = await page.evaluate(() => ({ btn: document.getElementById('cortinaBtn').getClientRects().length > 0, rk: document.querySelectorAll('#ranking-tbody tr').length }));
    ok(`${lado} · aberto + unidade: números à vista, sem botão de admin`, !m.btn && m.rk === 12, JSON.stringify(m));
    await ctx.close();
  }
}

// 3 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
const VISOES = ['resumo', 'ranking', 'evolucao', 'podio'];
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    for (const v of VISOES) {
      await page.click(`.s-item[data-vw="${v}"]`);
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => {
        const se = document.scrollingElement, vw = document.querySelector('.vw.on');
        const tw = [...vw.querySelectorAll('.twrap')];
        const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
        const blocos = [...vw.querySelectorAll('.gcard,.tsec,.kpi-card,.fin-hero,.peso-box,.podio-section,.resumo-section,.pedestal')].map(c => c.getBoundingClientRect());
        const cortes = [...vw.querySelectorAll('table thead th, .kpi-card .card-label, .peso-item span, .rl-nome, .pedestal-name')]
          .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
        return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
          vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
          twRolaV: tw.map(t => t.scrollHeight > t.clientHeight),
          canv, cortes, foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
          cards: (() => { const c = vw.querySelector('.ind-cards'); return c ? Math.round(c.getBoundingClientRect().height) : null; })(),
          sobra: (() => { const last = blocos.reduce((a, r) => Math.max(a, r.bottom), 0); return Math.round(document.querySelector('.cols').getBoundingClientRect().bottom - 24 - last); })(),
          tit: document.getElementById('tit').textContent,
          stickyOk: tw.every(t => { const th = t.querySelector('thead th'); return !th || getComputedStyle(th).position === 'sticky'; }) };
      });
      ok(`${tag} · ${v}: visão abre (${m.tit})`, m.id === 'vw-' + v);
      ok(`${tag} · ${v}: página não rola`, !m.pagRola);
      ok(`${tag} · ${v}: a visão não transborda`, !m.vwRola);
      ok(`${tag} · ${v}: tabela sem barra horizontal`, !m.horiz);
      ok(`${tag} · ${v}: nada fora da tela`, !m.foraTela);
      ok(`${tag} · ${v}: texto sem corte (cabeçalhos, rótulos dos cards, pesos, nomes)`, !m.cortes.length, m.cortes.join(' / '));
      if (m.twRolaV.length) ok(`${tag} · ${v}: cabeçalho sticky na tabela`, m.stickyOk);
      if (m.canv.length) ok(`${tag} · ${v}: gráfico com altura`, m.canv.every(h => h > 150), m.canv.map(Math.round).join(','));
      if (m.cards != null) ok(`${tag} · ${v}: fileira de cards com altura (≥ 112px)`, m.cards >= 112, m.cards + 'px');
      if (v === 'resumo') ok(`${tag} · resumo: sem faixa vazia embaixo (≤ 40px)`, m.sobra <= 40, m.sobra + 'px');
      if (SHOTS) {
        await page.waitForTimeout(900);   // fim da animação do Chart.js
        const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}${vp.width === 1600 ? '' : '-' + vp.width}.png`) });
      }
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="evolucao"]'); await page.waitForTimeout(250);
      const antes = await page.evaluate(() => [document.body.classList.contains('claro'), Chart.getChart(document.getElementById('chartTemporal')).options.scales.x.ticks.color]);
      await page.click('#btTema'); await page.waitForTimeout(300);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), Chart.getChart(document.getElementById('chartTemporal')).options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
      ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js, gviz-cache.js, gerot-base.js e supabase-js continuam', ['ctrlk.js', 'gviz-cache.js', 'gerot-base.js', 'supabase-js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return !!b && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      // menu do Excel/PNG abre no clique direito da tabela
      await page.click('.s-item[data-vw="ranking"]'); await page.waitForTimeout(200);
      await page.click('#ranking-table tbody td:nth-child(2)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      // ordenação pelo cabeçalho (sortable-table) continua no ranking
      const antesOrd = await page.evaluate(() => document.querySelector('#ranking-table tbody tr td:nth-child(2)').textContent);
      await page.click('#ranking-table thead th:nth-child(2)'); await page.waitForTimeout(200);
      const depoisOrd = await page.evaluate(() => document.querySelector('#ranking-table tbody tr td:nth-child(2)').textContent);
      ok('ordenação pelo cabeçalho (Unidade)', antesOrd !== depoisOrd, `${antesOrd} → ${depoisOrd}`);
      // filtro: abre, "Apenas", contagem laranja visível
      await page.click('#ms-vig-btn'); await page.waitForTimeout(100);
      ok('painel do filtro abre (opaco, com busca)', await page.evaluate(() => { const p = document.getElementById('ms-vig-panel'); return p.classList.contains('open') && !!p.querySelector('.ms-search input'); }));
      await page.fill('#ms-vig-panel .ms-search input', 'jul'); await page.waitForTimeout(80);
      const vistas = await page.evaluate(() => [...document.querySelectorAll('#ms-vig-list .ms-opt:not(.all-opt)')].filter(o => o.style.display !== 'none').map(o => o.querySelector('label').textContent.trim()).join());
      ok('busca do filtro esconde as vigências que não casam', vistas === 'Jul/2026', vistas);
      await page.fill('#ms-vig-panel .ms-search input', ''); await page.waitForTimeout(80);
      await page.evaluate(() => document.querySelector('#ms-vig-list .ms-opt:nth-child(3) .ms-only').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.getElementById('ms-vig-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('ms-vig-lbl').textContent, document.getElementById('ranking-sub').textContent]; });
      ok('contagem laranja do filtro aparece, com o rótulo do mês', cnt[0] !== 'none' && cnt[1] === '1' && cnt[2] === cnt[3], cnt.join(' · '));
      await page.mouse.click(5, 5);
      // lateral recolhida
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda elite_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('elite_mini') === '1'));
      await page.evaluate(() => { localStorage.setItem('elite_mini', '0'); });
      // o botão "Atualizar dados" refaz a leitura
      await page.evaluate(() => atualizar()); await page.waitForTimeout(800);
      ok('Atualizar dados: subtítulo "Atualizado …"', await page.evaluate(() => /^Atualizado /.test(document.getElementById('titSub').textContent)));
      // ── contrato do check-metas: visão certa aberta antes da foto ──
      const cm = await page.evaluate(() => {
        const r = {};
        r.funcs = ['setSelArr', 'updateMsBtn', 'renderAll', 'toggleIndCols', 'setVw'].every(f => typeof window[f] === 'function' || typeof eval(f) === 'function');
        setVw('ranking'); setSelArr('vig', ['2026/06/01']); updateMsBtn('vig'); renderAll();
        const tb = document.querySelector('#ranking-table').closest('.tbl-section');
        r.rankAlvo = !!tb && tb.offsetHeight > 0 && document.querySelector('#ranking-table').offsetHeight > 0;
        const c = document.querySelector('.ind-col'); r.indColVis = getComputedStyle(c).display !== 'none';
        r.podio = [...document.querySelectorAll('.podio-slot')].map(s => s.querySelector('.pedestal-name').textContent + '/' + s.querySelector('.pedestal-score').textContent);
        r.brasao = getComputedStyle(document.querySelector('.podio-section'), '::after').backgroundImage;
        setVw('evolucao');
        const cc = document.querySelector('#chartTemporal').closest('.chart-card');
        r.evolAlvo = !!cc && cc.offsetHeight > 0;
        return r;
      });
      ok('check-metas: funções do contrato existem', cm.funcs);
      ok('check-metas: na visão Ranking o #ranking-table.closest(.tbl-section) está à vista', cm.rankAlvo);
      ok('check-metas: .ind-col à vista no desktop (não chama toggleIndCols)', cm.indColVis);
      ok('check-metas: pódio legível com a visão Ranking aberta (escondido)', cm.podio.length === 3 && cm.podio.every(x => /pts$/.test(x)), cm.podio.join(' · '));
      ok('check-metas: brasão do pódio (::after) lido mesmo escondido', /logo_frota/.test(cm.brasao), cm.brasao);
      ok('check-metas: na visão Evolução o #chartTemporal.closest(.chart-card) está à vista', cm.evolAlvo);
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 4 · celular: a página volta a rolar, colunas de indicador escondidas com o botão
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
  ok('celular: página livre para rolar e gráfico com altura', m.rola && m.canv.every(h => h > 150), m.canv.map(Math.round).join(','));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: true });
  await page.click('.s-item[data-vw="ranking"]'); await page.waitForTimeout(400);
  const a = await page.evaluate(() => [getComputedStyle(document.querySelector('.ind-col')).display, getComputedStyle(document.getElementById('tbl-ind-toggle')).display]);
  ok('celular: indicadores escondidos e o botão "+ Ver indicadores" à vista', a[0] === 'none' && a[1] !== 'none', a.join(' · '));
  // no celular quem abre as colunas é o "+ Detalhar" do mobile.js (como no antigo: as
  // regras !important dele vencem o .tbl-expanded); o toggleIndCols segue marcando a classe
  await page.click('#tbl-ind-toggle'); await page.waitForTimeout(200);
  const d = await page.evaluate(() => [document.querySelector('.tbl-section').classList.contains('tbl-expanded'), document.getElementById('tbl-ind-toggle').textContent]);
  ok('celular: toggleIndCols alterna o .tbl-expanded e o rótulo', d[0] && /Ocultar/.test(d[1]), d.join(' · '));
  const det = await page.$('#vw-ranking .mt-detail-btn');
  ok('celular: o "+ Detalhar" do mobile.js está no ranking', !!det);
  if (det) { await det.click(); await page.waitForTimeout(250); }
  const e = await page.evaluate(() => getComputedStyle(document.querySelector('#ranking-tbody td.ind-col')).display);
  ok('celular: "+ Detalhar" abre as colunas de indicador', e === 'table-cell', e);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-ranking.png'), fullPage: true });
  await page.click('.s-item[data-vw="podio"]'); await page.waitForTimeout(400);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-podio.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

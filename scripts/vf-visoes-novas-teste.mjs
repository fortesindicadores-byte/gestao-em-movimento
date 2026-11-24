// Visão Financeira · as três visões de 23/11/2026 (Ponte do Custo, Conta × Unidade e
// Aderência Mês a Mês), no painel de verdade, com o banco dublado e números conhecidos.
//   CHART_JS = caminho do chart.umd.js real (sem ele, um dublê que só guarda o config)
//   SHOT_DIR = pasta para os prints
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHART_JS = process.env.CHART_JS || '', SHOT = process.env.SHOT_DIR || '';

// base por conta (R$ do remunerado no mês) e fator do realizado por unidade
const CONTAS = { 'Combustíveis Veiculos e Equipamentos': 100000, 'Fluídos (Arla)': 5000, 'Manutenção de Veículos e Equipamentos': 40000, 'Pneus Novos': 20000, 'Seguro de Veículos e Equipamentos': 8000 };
const UNIS = [['ROTA - GRL', 'GUARULHOS', 1.10], ['EMPURRADA - PIR', 'PIRAÍ', 0.90], ['ROTA - CGR', 'RIO DE JANEIRO', 1.50], ['AUTO SERVIÇO - CGR', 'RIO DE JANEIRO', 0.80]];
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LINHAS = { Frota: [], EBITDA: [], 'Receita Líquida': [] };
for (const ano of [2025, 2026]) for (let m = 1; m <= 12; m++) {
  const fechado = ano === 2025 || m <= 10, vig = `${ano}-${String(m).padStart(2, '0')}-01`;
  for (const [n3, uni, fat] of UNIS) {
    for (const [cta, base] of Object.entries(CONTAS)) {
      // Pneus do PIR estoura muito em out/26: é a célula mais quente da matriz
      const f = (n3 === 'EMPURRADA - PIR' && cta === 'Pneus Novos' && ano === 2026 && m === 10) ? 3 : fat;
      LINHAS.Frota.push({ vig, uni, n3, cta, mes: MES[m - 1], ano, orc: -base * 1.05, rem: fechado ? -base : null, real: fechado ? -base * f : null });
    }
    LINHAS.EBITDA.push({ vig, uni, n3, cta: 'EBITDA', mes: MES[m - 1], ano, orc: 60000, rem: fechado ? 50000 : null, real: fechado ? 50000 * (2 - fat) : null });
    LINHAS['Receita Líquida'].push({ vig, uni, n3, cta: 'Receita Líquida', mes: MES[m - 1], ano, orc: 400000, rem: fechado ? 380000 : null, real: fechado ? 390000 : null });
  }
}
const doBanco = aba => LINHAS[aba].map((l, i) => ({ linha: i, vigencia_orig: l.vig, d_orc_brl: 0, d_rem_brl: 0, unidade: l.uni, nivel_3: l.n3, conta_gerencial: l.cta, mes: l.mes, ano: l.ano, orcado: l.orc, remunerado: l.rem, realizado: l.real }));
const TAB = { Frota: 'sh_dre_frota', EBITDA: 'sh_dre_ebitda', 'Receita Líquida': 'sh_dre_receita' };

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8791, r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let falhas = 0, oks = 0;
const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); v ? oks++ : falhas++; };
const perto = (a, b, tol = 1) => Math.abs(a - b) <= tol;

async function abre(w, h, tema) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ L, TAB, tema }) => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('vfa_tema', tema);
    try { localStorage.removeItem('bi_cache_vf_v9'); } catch (e) {}
    window.supabase = { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'r@x.com' } } } }) },
      from: tabela => ({ select() { return this; }, order() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }),
        async range(a, b) { const aba = Object.keys(TAB).find(k => TAB[k].replace(/^sh_/, '') === String(tabela).replace(/^(sh|ca)_/, '')); const rows = L[aba] || []; return { data: rows.slice(a, b + 1), error: null }; } }) }) };
    const orig = window.fetch;
    window.fetch = async (u, o) => { const s = String(u);
      if (s.includes('consumo_auto_base')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      if (s.includes('docs.google.com')) return new Response('', { status: 500 });
      return orig(u, o); };
  }, { L: Object.fromEntries(Object.keys(TAB).map(a => [a, doBanco(a)])), TAB, tema });
  const SHIM = `window.__charts=[];(function(){function Chart(ctx,cfg){this.config=cfg;this.data=cfg.data;this.options=cfg.options||{};window.__charts.push(cfg);this.destroy=function(){};this.update=function(){};this.resize=function(){};}
    Chart.getChart=function(){return null;};Chart.register=function(){};Chart.defaults={font:{}};window.Chart=Chart;})();`;
  await page.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    if (/chart\.umd/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: CHART_JS ? fs.readFileSync(CHART_JS, 'utf8') : SHIM });
    r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('datalabels') ? 'window.ChartDataLabels={id:"datalabels"};' : '/*stub*/' }); });
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('http://localhost:8791/visao-financeira/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof allRows !== 'undefined' && allRows.length > 0 && typeof lastF !== 'undefined' && lastF, { timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}
const semRolagem = page => page.evaluate(() => { const v = document.querySelector('.vw.on'); const de = document.documentElement;
  return { pagina: de.scrollHeight <= de.clientHeight + 1 && de.scrollWidth <= de.clientWidth + 1, visao: v.scrollHeight <= v.clientHeight + 1,
    lateral: [...v.querySelectorAll('.twrap')].every(t => t.scrollWidth <= t.clientWidth + 1) }; });

// ── números (1366×768, escuro) ──
console.log('1 · números');
{
  const { ctx, page, errs } = await abre(1366, 768, 'dark');
  // esperado de out/26
  const esp = { ref: 0, real: 0 }; const porPac = {};
  for (const [n3, , fat] of UNIS) for (const [cta, base] of Object.entries(CONTAS)) {
    const f = (n3 === 'EMPURRADA - PIR' && cta === 'Pneus Novos') ? 3 : fat; esp.ref += base; esp.real += base * f;
    const p = /Combust|Arla/.test(cta) ? 'Combustíveis' : /Manut/.test(cta) ? 'Manutenções' : /Pneus/.test(cta) ? 'Pneus' : 'Seguros e licenças';
    porPac[p] = (porPac[p] || 0) + base * f - base; }
  await page.evaluate(() => setVw('ponte')); await page.waitForTimeout(300);
  const rowsDe = `(f => { const ac = !f.vig || !f.vig.length; return ac ? ateUltimoReal(filterMes(allRows, f)) : filterMes(allRows, f); })(lastF)`;
  const lePonte = () => page.evaluate(rd => { const M = ptDados(eval(rd), ptRef, ptDim);
    return { M, tit: document.getElementById('tit').textContent, sub: document.getElementById('pt-sub').textContent,
      nums: [...document.querySelectorAll('#pt-nums b')].map(b => b.textContent), cls: [...document.querySelectorAll('#pt-nums b')].map(b => b.className),
      cards: document.querySelectorAll('#vw-ponte .gcard').length, canvas: document.querySelectorAll('#vw-ponte canvas').length,
      pe: document.getElementById('pe-pt').textContent, barras: (window.Chart.getChart && Chart.getChart('ch-pt')) ? Chart.getChart('ch-pt').data.datasets[0].data : (window.__charts || []).slice(-1)[0].data.datasets[0].data }; }, rowsDe);
  const P = await lePonte();
  ok('Ponte: uma cascata só', P.cards === 1 && P.canvas === 1, P.cards + ' · ' + P.canvas);
  ok('Ponte: título da visão', P.tit === 'Ponte do Custo', P.tit);
  ok('Ponte com out/26 no filtro: remunerado e realizado do mês', perto(P.M.ref, esp.ref) && perto(P.M.real, esp.real), `${Math.round(P.M.ref)} · ${Math.round(P.M.real)}`);
  ok('Ponte: os passos somam o realizado − remunerado', perto(P.M.st.reduce((a, s) => a + s.d, 0), esp.real - esp.ref));
  ok('Ponte: um passo por pacote, na ordem do painel', P.M.st.map(s => s.nome).join('|') === 'Combustíveis|Manutenções|Pneus|Seguros e licenças', P.M.st.map(s => s.nome).join('|'));
  ok('Ponte: o passo de Pneus é o esperado', perto(P.M.st.find(s => s.nome === 'Pneus').d, porPac.Pneus), String(Math.round(porPac.Pneus)));
  ok('Ponte: barras = referência + passos + realizado, a última termina no realizado', P.barras.length === 6 && perto(P.barras[5][1], esp.real) && P.barras[0][0] === 0);
  ok('Ponte: cada passo começa onde o anterior terminou', (() => { let run = esp.ref; for (let i = 0; i < P.M.st.length; i++) { const d = P.M.st[i].d, b = P.barras[i + 1]; if (!perto(Math.min(run, run + d), b[0]) || !perto(Math.max(run, run + d), b[1])) return false; run += d; } return perto(run, esp.real); })());
  ok('Ponte: o período é o do filtro de Vigência (out/26)', P.sub === 'out/26', P.sub);
  // acumulado = marcar os meses no filtro
  await page.evaluate(() => { const x = document.getElementById('ms-vig')._sel; x.clear(); ['01','02','03','04','05','06','07','08','09','10'].forEach(m => x.add('2026-' + m)); atualizar(); }); await page.waitForTimeout(250);
  const PA = await lePonte();
  ok('Ponte com jan a out no filtro: acumulado, e fecha', PA.sub === '10 meses, de jan/26 a out/26' && PA.M.ref > P.M.ref * 9 && perto(PA.M.st.reduce((a, s) => a + s.d, 0), PA.M.real - PA.M.ref) && perto(PA.barras[PA.barras.length - 1][1], PA.M.real), PA.sub);
  // nada marcado = tudo até o último mês com realizado
  await page.evaluate(() => { document.getElementById('ms-vig')._sel.clear(); atualizar(); }); await page.waitForTimeout(250);
  const PT = await lePonte();
  ok('Ponte sem vigência marcada: até o último mês com realizado (22 meses)', /^22 meses, de jan\/25 a out\/26$/.test(PT.sub) && PT.M.ref > PA.M.ref * 2, PT.sub);
  await page.evaluate(() => { const x = document.getElementById('ms-vig')._sel; x.clear(); x.add('2026-10'); atualizar(); }); await page.waitForTimeout(250);
  ok('Ponte: quatro números, Δ em vermelho (gastou mais)', P.nums.length === 4 && /cr/.test(P.cls[2]) && /cr/.test(P.cls[3]), P.nums.join(' · '));
  ok('Ponte: texto explicativo embaixo', /Vermelha quando gastou mais/.test(P.pe));
  await page.evaluate(() => setPtDim('conta')); await page.waitForTimeout(150);
  const Pc = (await lePonte()).M.st.map(s => s.nome);
  ok('Ponte por conta: nomes curtos, do maior aumento para a maior redução', Pc.join('|') === 'Pneus Novos|Combustíveis|Manutenção de Veículos e Equip.|Seguros|Arla', Pc.join('|'));
  await page.evaluate(() => { setPtDim('pacote'); togglePtRef(); }); await page.waitForTimeout(150);
  const Po = await page.evaluate(rd => ({ r: ptDados(eval(rd), 'orc', 'pacote').ref, lb: document.querySelector('#pt-nums span').textContent, bt: document.getElementById('ref-pt-v').textContent }), rowsDe);
  ok('Ponte vs orçado: a referência vira o orçado', perto(Po.r, esp.ref * 1.05) && /Orçado/i.test(Po.lb) && Po.bt === 'ORÇ', Po.lb);
  await page.evaluate(() => togglePtRef());

  // Conta × Unidade
  await page.evaluate(() => setVw('matriz')); await page.waitForTimeout(150);
  const Mz = await page.evaluate(() => { const t = document.getElementById('tbl-mz'); const head = [...t.querySelectorAll('thead th')].map(x => x.textContent);
    const linhas = [...t.querySelectorAll('tbody tr')].map(tr => ({ cls: tr.className, c: [...tr.children].map(td => td.textContent), bg: [...tr.children].map(td => td.style.background || ''), k: [...tr.children].map(td => td.className) }));
    return { head, linhas, pe: document.getElementById('pe-mz').textContent, tit: document.getElementById('tit').textContent }; });
  ok('Matriz: colunas = unidades em ordem + Total', Mz.head.join('|') === 'CONTA|CGR|GRL|PIR|TOTAL', Mz.head.join('|'));
  ok('Matriz: pacotes na ordem do painel, com a linha Total no fim', Mz.linhas.filter(l => l.cls === 'mz-pac').map(l => l.c[0]).join('|') === 'Combustíveis|Manutenções|Pneus|Seguros e licenças' && Mz.linhas.slice(-1)[0].c[0] === 'Total');
  // o painel abre no último mês com realizado (out/26)
  const ctaL = (L, n) => L.filter(l => l.c[0] === n && l.cls === '')[0];
  ok('Matriz (out/26): GRL × Combustíveis = +10,0k', ctaL(Mz.linhas, 'Combustíveis').c[2] === '10,0k', ctaL(Mz.linhas, 'Combustíveis').c.join('|'));
  ok('Matriz: célula de conta tem calor (vermelho no estouro, verde no saving)', /255, ?102, ?102/.test(ctaL(Mz.linhas, 'Combustíveis').bg[2]) && /59, ?179, ?59/.test(ctaL(Mz.linhas, 'Combustíveis').bg[3]));
  ok('Matriz (out/26): PIR × Pneus Novos = +40,0k (o triplo do remunerado)', ctaL(Mz.linhas, 'Pneus Novos').c[3] === '40,0k', ctaL(Mz.linhas, 'Pneus Novos').c.join('|'));
  ok('Matriz (out/26): Total geral = realizado − remunerado', Mz.linhas.slice(-1)[0].c[4] === ((esp.real - esp.ref) / 1e3).toFixed(1).replace('.', ',') + 'k', Mz.linhas.slice(-1)[0].c.join('|'));
  ok('Matriz: pacote soma as contas dele (Combustíveis do GRL = 10,0k + 500)', Mz.linhas.find(l => l.cls === 'mz-pac' && l.c[0] === 'Combustíveis').c[2] === '10,5k', Mz.linhas.find(l => l.cls === 'mz-pac').c.join('|'));
  ok('Matriz: totais sem calor e coloridos', (() => { const t = Mz.linhas.slice(-1)[0]; return t.bg.every(b => !b) && /cr|cg/.test(t.k[4]); })());
  ok('Matriz: explicação embaixo da tabela', /quanto mais forte o fundo/.test(Mz.pe));
  // sem vigência marcada o recorte é tudo até o último mês com realizado: 12 meses de 2025 + 10 de 2026
  await page.evaluate(() => { document.getElementById('ms-vig')._sel.clear(); atualizar(); }); await page.waitForTimeout(200);
  const Mz2 = await page.evaluate(() => [...document.querySelectorAll('#tbl-mz tbody tr')].map(tr => ({ cls: tr.className, c: [...tr.children].map(td => td.textContent) })));
  ok('Matriz (todas as vigências): GRL × Combustíveis = 22 meses × 10 mil = 220k', ctaL(Mz2, 'Combustíveis').c[2] === '220k', ctaL(Mz2, 'Combustíveis').c.join('|'));
  ok('Matriz (todas): PIR × Pneus = 21 meses de −2 mil + 40 mil = −2,0k', ctaL(Mz2, 'Pneus Novos').c[3] === '-2,0k', ctaL(Mz2, 'Pneus Novos').c.join('|'));
  await page.evaluate(() => { const x = document.getElementById('ms-vig')._sel; x.clear(); x.add('2026-10'); atualizar(); }); await page.waitForTimeout(200);
  await page.evaluate(() => setMzModo('pct')); await page.waitForTimeout(100);
  const Mz3 = await page.evaluate(() => [...document.querySelectorAll('#tbl-mz tbody tr')].map(tr => [...tr.children].map(td => td.textContent)));
  ok('Matriz em %: GRL × Combustíveis = +10%, PIR × Pneus = +200%', Mz3.filter(l => l[0] === 'Combustíveis')[1][2] === '+10%' && Mz3.find(l => l[0] === 'Pneus Novos')[3] === '+200%', Mz3.filter(l => l[0] === 'Combustíveis')[1].join('|'));
  await page.evaluate(() => { setMzModo('brl'); setMzCol('proj'); }); await page.waitForTimeout(100);
  const hp = await page.evaluate(() => [...document.querySelectorAll('#tbl-mz thead th')].map(x => x.textContent).join('|'));
  ok('Matriz por projeto', hp === 'CONTA|AUTO SERVIÇO|EMPURRADA|ROTA|TOTAL', hp);
  await page.evaluate(() => setMzCol('uni'));

  const semAd = await page.evaluate(() => !document.querySelector('[data-vw="adere"]') && !document.getElementById('vw-adere'));
  ok('Aderência Mês a Mês saiu do menu e da página', semAd);

  ok('sem erro de JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ── telas: sem rolagem, nos dois temas ──
console.log('2 · telas');
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { ctx, page, errs } = await abre(w, h, tema);
  for (const v of ['ponte', 'matriz']) {
    await page.evaluate(v => setVw(v), v); await page.waitForTimeout(350);
    const r = await semRolagem(page);
    ok(`${v} ${w}×${h} ${tema}: sem rolagem de página nem barra lateral`, r.pagina && r.visao && r.lateral, JSON.stringify(r));
    if (v === 'ponte' && CHART_JS) { const g = await page.evaluate(() => { const c = document.getElementById('ch-pt'); return [c.clientWidth, c.clientHeight]; });
      ok(`ponte ${w}×${h}: o gráfico ocupa a largura`, g.every(x => x > 150), g.join('×')); }
    if (SHOT) await page.screenshot({ path: path.join(SHOT, `${v}-${w}-${tema}.png`) });
  }
  ok(`${w}×${h} ${tema}: sem erro de JavaScript`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

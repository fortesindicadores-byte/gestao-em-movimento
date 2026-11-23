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
  const foco = await page.evaluate(() => focoVig(lastF));
  ok('o mês em foco é o último com realizado', foco === '2026-10', foco);
  // esperado de out/26
  const esp = { ref: 0, real: 0 }; const porPac = {};
  for (const [n3, , fat] of UNIS) for (const [cta, base] of Object.entries(CONTAS)) {
    const f = (n3 === 'EMPURRADA - PIR' && cta === 'Pneus Novos') ? 3 : fat; esp.ref += base; esp.real += base * f;
    const p = /Combust|Arla/.test(cta) ? 'Combustíveis' : /Manut/.test(cta) ? 'Manutenções' : /Pneus/.test(cta) ? 'Pneus' : 'Seguros e licenças';
    porPac[p] = (porPac[p] || 0) + base * f - base; }
  await page.evaluate(() => setVw('ponte')); await page.waitForTimeout(300);
  const P = await page.evaluate(() => { const f = lastF, foco = focoVig(f); const M = ptDados(f, [foco], 'rem', 'pacote'), A = ptDados(f, mesesAte(foco), 'rem', 'pacote');
    return { M, A, tit: document.getElementById('tit').textContent, subM: document.getElementById('pt-sub-mes').textContent, subA: document.getElementById('pt-sub-ac').textContent,
      nums: [...document.querySelectorAll('#pt-nums-mes b')].map(b => b.textContent), cls: [...document.querySelectorAll('#pt-nums-mes b')].map(b => b.className),
      pe: document.getElementById('pe-pt').textContent, barras: (window.Chart.getChart && Chart.getChart('ch-pt-mes')) ? Chart.getChart('ch-pt-mes').data.datasets[0].data : (window.__charts || []).slice(-1)[0].data.datasets[0].data }; });
  ok('Ponte: título da visão', P.tit === 'Ponte do Custo', P.tit);
  ok('Ponte do mês: remunerado e realizado de out/26', perto(P.M.ref, esp.ref) && perto(P.M.real, esp.real), `${Math.round(P.M.ref)} · ${Math.round(P.M.real)}`);
  ok('Ponte: os passos somam o realizado − remunerado', perto(P.M.st.reduce((a, s) => a + s.d, 0), esp.real - esp.ref));
  ok('Ponte: um passo por pacote, na ordem do painel', P.M.st.map(s => s.nome).join('|') === 'Combustíveis|Manutenções|Pneus|Seguros e licenças', P.M.st.map(s => s.nome).join('|'));
  ok('Ponte: o passo de Pneus é o esperado', perto(P.M.st.find(s => s.nome === 'Pneus').d, porPac.Pneus), String(Math.round(porPac.Pneus)));
  ok('Ponte: barras = referência + passos + realizado, a última termina no realizado', P.barras.length === 6 && perto(P.barras[5][1], esp.real) && P.barras[0][0] === 0);
  ok('Ponte: cada passo começa onde o anterior terminou', (() => { let run = esp.ref; for (let i = 0; i < P.M.st.length; i++) { const d = P.M.st[i].d, b = P.barras[i + 1]; if (!perto(Math.min(run, run + d), b[0]) || !perto(Math.max(run, run + d), b[1])) return false; run += d; } return perto(run, esp.real); })());
  ok('Ponte: acumulado = jan a out', P.subA === 'jan/26 a out/26' && P.subM === 'out/26', P.subA + ' · ' + P.subM);
  ok('Ponte: acumulado maior que o mês e fecha', P.A.ref > P.M.ref * 9 && perto(P.A.st.reduce((a, s) => a + s.d, 0), P.A.real - P.A.ref));
  ok('Ponte: quatro números, Δ em vermelho (gastou mais)', P.nums.length === 4 && /cr/.test(P.cls[2]) && /cr/.test(P.cls[3]), P.nums.join(' · '));
  ok('Ponte: texto explicativo embaixo', /Vermelha quando gastou mais/.test(P.pe));
  await page.evaluate(() => setPtDim('conta')); await page.waitForTimeout(150);
  const Pc = await page.evaluate(() => ptDados(lastF, [focoVig(lastF)], 'rem', 'conta').st.map(s => s.nome));
  ok('Ponte por conta: nomes curtos, do maior aumento para a maior redução', Pc.join('|') === 'Pneus Novos|Combustíveis|Manutenção de Veículos e Equip.|Seguros|Arla', Pc.join('|'));
  await page.evaluate(() => { setPtDim('pacote'); togglePtRef(); }); await page.waitForTimeout(150);
  const Po = await page.evaluate(() => ({ r: ptDados(lastF, [focoVig(lastF)], 'orc', 'pacote').ref, lb: document.querySelector('#pt-nums-mes span').textContent, bt: document.getElementById('ref-pt-v').textContent }));
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

  // Aderência
  await page.evaluate(() => setVw('adere')); await page.waitForTimeout(150);
  const Ad = await page.evaluate(() => { const t = document.getElementById('tbl-ad');
    return { head: [...t.querySelectorAll('thead th')].map(x => x.lastChild.textContent), foco: [...t.querySelectorAll('thead th.foco')].map(x => x.lastChild.textContent),
      linhas: [...t.querySelectorAll('tbody tr')].map(tr => ({ c: [...tr.children].map(td => td.textContent), k: [...tr.children].map(td => td.className) })), pe: document.getElementById('pe-ad').textContent }; });
  ok('Aderência: cabeçalho = unidade, os dois anos e os 12 meses', Ad.head.join('|') === 'UNIDADE|2025|2026|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ', Ad.head.join('|'));
  ok('Aderência: o mês do filtro fica marcado', Ad.foco.join() === 'OUT', Ad.foco.join());
  const al = nome => Ad.linhas.find(l => l.c[0] === nome);
  ok('Aderência: GRL em jan = 1 ÷ 1,10 = 90,9% (Ruim)', al('GRL').c[3] === '90,9%' && /ad-r/.test(al('GRL').k[3]), al('GRL').c.join('|'));
  // CGR: Rota 1,5 e AS 0,8 → custo real = 2,3 × base para 2 de remunerado → 87,0%
  ok('Aderência: CGR junta os dois projetos (2 ÷ 2,3 = 87,0%)', al('CGR').c[3] === '87,0%', al('CGR').c[3]);
  ok('Aderência: PIR em jan = 111,1% (Bom) e cai em out pelo pneu', al('PIR').c[3] === '111,1%' && /ad-b/.test(al('PIR').k[3]) && parseFloat(al('PIR').c[12].replace(',', '.')) < 100, al('PIR').c[12]);
  ok('Aderência: nov e dez em branco (sem realizado)', Ad.linhas.every(l => l.c[13] === '' && l.c[14] === ''));
  ok('Aderência: da menor para a maior no ano, Total no fim', Ad.linhas.map(l => l.c[0]).join('|') === 'CGR|GRL|PIR|Total', Ad.linhas.map(l => l.c[0]).join('|'));
  ok('Aderência: legenda das quatro faixas embaixo', /Muito ruim/.test(Ad.pe) && /Ótimo/.test(Ad.pe) && /gastou menos/.test(Ad.pe));
  await page.evaluate(() => setAdInd('ebitda')); await page.waitForTimeout(100);
  const Ae = await page.evaluate(() => [...document.querySelectorAll('#tbl-ad tbody tr')].map(tr => [...tr.children].map(td => td.textContent)));
  // EBITDA real = 50.000 × (2 − fator): GRL 0,9 → 90,0%; PIR 1,1 → 110,0%
  ok('Aderência do EBITDA: GRL 90,0% e PIR 110,0% em jan', Ae.find(l => l[0] === 'GRL')[3] === '90,0%' && Ae.find(l => l[0] === 'PIR')[3] === '110,0%', Ae.map(l => l[0] + ' ' + l[3]).join(' · '));
  await page.evaluate(() => { setAdInd('custo'); setAdLin('proj'); }); await page.waitForTimeout(100);
  const Ap = await page.evaluate(() => [...document.querySelectorAll('#tbl-ad tbody tr')].map(tr => tr.children[0].textContent).join('|'));
  ok('Aderência por projeto', Ap === 'ROTA|EMPURRADA|AUTO SERVIÇO|Total', Ap);
  ok('sem erro de JavaScript', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ── telas: sem rolagem, nos dois temas ──
console.log('2 · telas');
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { ctx, page, errs } = await abre(w, h, tema);
  for (const v of ['ponte', 'matriz', 'adere']) {
    await page.evaluate(v => setVw(v), v); await page.waitForTimeout(350);
    const r = await semRolagem(page);
    ok(`${v} ${w}×${h} ${tema}: sem rolagem de página nem barra lateral`, r.pagina && r.visao && r.lateral, JSON.stringify(r));
    if (v === 'ponte' && CHART_JS) { const g = await page.evaluate(() => { const c = document.getElementById('ch-pt-ac'), d = document.getElementById('ch-pt-mes'); return [c.clientWidth, c.clientHeight, d.clientWidth, d.clientHeight]; });
      ok(`ponte ${w}×${h}: os dois gráficos têm tamanho`, g.every(x => x > 150), g.join('×')); }
    if (SHOT) await page.screenshot({ path: path.join(SHOT, `${v}-${w}-${tema}.png`) });
  }
  ok(`${w}×${h} ${tema}: sem erro de JavaScript`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

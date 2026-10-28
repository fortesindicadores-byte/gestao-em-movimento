// Correção de Anomalias de Combustível (/anomalias-combustivel/): abre a tela no
// Chromium com o banco dublado (comb_anomalia, comb_correcao, erp_abastecimentos,
// fca_profiles) e confere cards, gráficos, tabela ordenada pelos litros em jogo,
// filtro de situação, a caixa com os abastecimentos e o Δ hodômetro, salvar,
// marcar como certa, desfazer, gate de admin e telas sem rolagem.
// Uso: SBJS=<supabase UMD> CHART_JS=<chart.umd.js> DATALABELS=<…> [SHOT_DIR=…] node scripts/anomalias-combustivel-teste.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };

const A = (o) => ({ dados_ate: '2026-10-21', gerado_em: '2026-10-28T09:05:00Z', n_abast: 6, ...o });
const ANOM = [
  A({ chave: 'ROTA - CGR|2026-06|ABC1D23', ym: '2026-06', unidade: 'CGR', projeto: 'ROTA - CGR', placa: 'ABC1D23', placa_origem: 'ABC1323', modelo: 'VW/24.280 CRM 6X2', tipo: 'kml_baixo', tipos: 'kml_baixo', km: 910, litros: 1289, valor: 8000, kml: 0.71, ref_kml: 2.76, ref_fonte: 'modelo no mês (35 placas)', desvio: -0.74, impacto_l: 959 }),
  A({ chave: 'ROTA - PLT|2026-07|DEF4E56', ym: '2026-07', unidade: 'PLT', projeto: 'ROTA - PLT', placa: 'DEF4E56', placa_origem: 'DEF4E56', modelo: 'VW 13.180', tipo: 'kml_alto', tipos: 'kml_alto', km: 5070, litros: 816, valor: 5300, kml: 6.21, ref_kml: 2.9, ref_fonte: 'modelo no mês (59 placas)', desvio: 1.14, impacto_l: -933 }),
  A({ chave: 'EMPURRADA - PIR|2026-01|GHI7J89', ym: '2026-01', unidade: 'PIR', projeto: 'EMPURRADA - PIR', placa: 'GHI7J89', placa_origem: 'GHI7J89', modelo: 'M.BENZ/ACTROS 2651', tipo: 'km_zero', tipos: 'km_zero', km: 0, litros: 913, valor: 6000, kml: 0, ref_kml: 2.05, ref_fonte: 'modelo no mês (25 placas)', desvio: null, impacto_l: 913 }),
  A({ chave: 'SEARA|2026-04|JKL0M12', ym: '2026-04', unidade: 'ANG', projeto: 'SEARA', placa: 'JKL0M12', placa_origem: 'JKL0M12', modelo: 'VW 11.180', tipo: 'kml_alto', tipos: 'kml_alto', km: 8180, litros: 1158, valor: 7600, kml: 7.06, ref_kml: 3.4, ref_fonte: 'modelo no mês (10 placas)', desvio: 1.08, impacto_l: -1246 }),
  A({ chave: 'ROTA - CBA|2026-09|MNO3P45', ym: '2026-09', unidade: 'CBA', projeto: 'ROTA - CBA', placa: 'MNO3P45', placa_origem: 'MNO3P45', modelo: 'VW 24.280', tipo: 'kml_baixo', tipos: 'kml_baixo', km: 1500, litros: 800, valor: 5600, kml: 1.88, ref_kml: 3.1, ref_fonte: 'modelo no mês (20 placas)', desvio: -0.39, impacto_l: 316 }),
];
const ERP = [
  { ordem_servico: 'OS1', data: '2026-05-28', placa: 'ABC1323', tipo_combustivel: 'DIESEL S10', hodometro: 100000, km_rodado: 300, litros: 120, valor: 720, projeto_os: 'ROTA - CGR', encerrada: 'S' },
  { ordem_servico: 'OS2', data: '2026-06-03', placa: 'ABC1323', tipo_combustivel: 'DIESEL S10', hodometro: 100310, km_rodado: 310, litros: 400, valor: 2400, projeto_os: 'ROTA - CGR', encerrada: 'S' },
  { ordem_servico: 'OS3', data: '2026-06-03', placa: 'ABC1323', tipo_combustivel: 'ARLA 32', hodometro: 100310, km_rodado: 0, litros: 20, valor: 60, projeto_os: 'ROTA - CGR', encerrada: 'S' },
  { ordem_servico: 'OS4', data: '2026-06-15', placa: 'ABC1323', tipo_combustivel: 'DIESEL S10', hodometro: 10500, km_rodado: 300, litros: 450, valor: 2700, projeto_os: 'ROTA - CGR', encerrada: 'S' },
  { ordem_servico: 'OS5', data: '2026-06-28', placa: 'ABC1323', tipo_combustivel: 'DIESEL S10', hodometro: 10800, km_rodado: 300, litros: 439, valor: 2634, projeto_os: 'ROTA - CGR', encerrada: 'S' },
];

async function cenario({ vp = { width: 1366, height: 768 }, tema = 'dark', admin = true, semTabela = false } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' });
  const pg = await ctx.newPage();
  const CORR = new Map(); const gravacoes = [];
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/chart\.js@4/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){},resize(){}}};', contentType: 'application/javascript' }));
  await pg.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/html2canvas|jspdf/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const hd = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range' };
    const json = (b, st = 200) => r.fulfill({ status: st, body: JSON.stringify(b), contentType: 'application/json', headers: hd });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...hd, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) { const o = { is_admin: admin }; return json(/vnd\.pgrst\.object/.test(req.headers()['accept'] || '') ? o : [o]); }
    if (semTabela && /comb_(anomalia|correcao)/.test(p)) return json({ code: 'PGRST205', message: "Could not find the table 'public.comb_anomalia' in the schema cache" }, 404);
    if (p.includes('/rest/v1/comb_anomalia')) return json(ANOM);
    if (p.includes('/rest/v1/comb_correcao')) {
      if (m === 'GET') return json([...CORR.values()]);
      if (m === 'POST') { const b = JSON.parse(req.postData()); const o = Array.isArray(b) ? b[0] : b; const reg = { ...o, updated_at: '2026-10-28T12:00:00Z' }; CORR.set(o.chave, reg); gravacoes.push(['upsert', reg]);
        return json(/vnd\.pgrst\.object/.test(req.headers()['accept'] || '') ? reg : [reg], 201); }
      if (m === 'DELETE') { const k = decodeURIComponent((u.searchParams.get('chave') || '').replace(/^eq\./, '')); CORR.delete(k); gravacoes.push(['delete', k]); return r.fulfill({ status: 204, headers: hd }); }
    }
    if (p.includes('/rest/v1/erp_abastecimentos')) return json(ERP);
    return json([]);
  });
  await pg.addInitScript(t => { window.__tema = t; }, tema);
  await pg.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', window.__tema || 'dark');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { name: 'Renan Fortes' } } }));
  });
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'anomalias-combustivel/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('titSub').textContent; return /anomalia|Falta|Erro|—/.test(s) && !/Carregando/.test(s); }, null, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { b, pg, erros, CORR, gravacoes };
}
const txt = (pg, s) => pg.locator(s).first().textContent();

{
  const { b, pg, erros, gravacoes } = await cenario();
  t('sem erro de página', !erros.length, erros.join(' | '));
  t('5 em aberto no card', (await txt(pg, '#k-ab')).trim() === '5', await txt(pg, '#k-ab'));
  t('meta do card separa os tipos', /2 Km\/L baixo · 2 alto · 1 sem km/.test(await txt(pg, '#k-ab-m')), await txt(pg, '#k-ab-m'));
  t('litros em jogo = soma sem sinal', /4\.367 L/.test(await txt(pg, '#k-lit')), await txt(pg, '#k-lit'));
  t('gráficos por mês e por unidade', await pg.evaluate(() => charts['ch-mes'].data.labels.length === 5 && charts['ch-uni'].data.labels.length === 5));
  t('gráfico no padrão: eixo escondido, sem grade, barra translúcida com contorno', await pg.evaluate(() => { const c = charts['ch-mes'], d = c.data.datasets[0];
    return c.options.scales.y.display === false && c.options.scales.x.grid.display === false && /,\.65\)/.test(d.backgroundColor) && d.borderWidth === 1 && d.borderRadius === 3; }));
  await pg.evaluate(() => setVw('anomalias'));
  const placas = await pg.locator('#tb-anom tbody td.pl').allTextContents();
  t('tabela: maior litragem em jogo primeiro', placas[0] === 'JKL0M12' && placas[1] === 'ABC1323', placas.join(' · '));
  const cab = await pg.locator('#tb-anom thead th').allTextContents();
  t('colunas Unidade e Projeto separadas', cab[0] === 'Unidade' && cab[1] === 'Projeto', cab.join('|'));
  t('texto explicativo embaixo da tabela', await pg.evaluate(() => { const c = document.getElementById('pe-anom'); return c.previousElementSibling.id === 'tab-anom' && /35%/.test(c.textContent); }));
  // caixa
  await pg.click('#tb-anom tbody tr:nth-child(2)'); await pg.waitForTimeout(400);
  t('caixa abre com a placa e o mês', /ABC1323 · jun\/26/.test(await txt(pg, '#m-tit')), await txt(pg, '#m-tit'));
  const ab = await pg.evaluate(() => [...document.querySelectorAll('#m-ab tbody tr')].map(r => [r.className, r.cells[4].textContent, r.cells[4].className]));
  t('abastecimentos do mês + o último do mês anterior', ab.length === 5 && ab[0][0] === 'ant', JSON.stringify(ab));
  t('Δ hodômetro entre os diesel; negativo em vermelho', ab[1][1] === '310' && /alerta/.test(ab[3][2]) && ab[2][0] === 'fora', JSON.stringify(ab.map(x => x[1])));
  t('sugestão de km esperado', /Km esperado: 3\.558/.test(await txt(pg, '#m-sug')), await txt(pg, '#m-sug'));
  await pg.click('#m-sug button:first-child');
  t('resultado recalcula o Km/L', /3\.558 km · 1\.289 L · 2,76 km\/L/.test(await txt(pg, '#m-res')), await txt(pg, '#m-res'));
  await pg.fill('#c-mot', 'hodômetro digitado errado na OS4');
  await pg.click('#b-salva'); await pg.waitForTimeout(400);
  const g = gravacoes[0] || [];
  t('salvar grava a correção com o ERP ao lado', g[0] === 'upsert' && g[1].km === 3558 && g[1].litros == null && g[1].km_erp === 910 && g[1].status === 'corrigido' && g[1].autor === 'RENAN FORTES' && g[1].chave === 'ROTA - CGR|2026-06|ABC1D23', JSON.stringify(g[1]));
  t('sai da lista Em aberto', (await txt(pg, '#k-ab')).trim() === '4' && (await txt(pg, '#k-cor')).trim() === '1');
  await pg.evaluate(() => setVw('correcoes'));
  t('aparece em Correções com ERP → corrigido', /910 → 3\.558/.test(await txt(pg, '#tb-corr tbody')), await txt(pg, '#tb-corr tbody'));
  // marcar como certa e desfazer
  await pg.evaluate(() => abreCaixa('ROTA - CBA|2026-09|MNO3P45')); await pg.waitForTimeout(200);
  await pg.click('#b-ok'); await pg.waitForTimeout(300);
  t('Está correto grava status correto, sem números', gravacoes[1] && gravacoes[1][1].status === 'correto' && gravacoes[1][1].km == null);
  await pg.evaluate(() => abreCaixa('ROTA - CBA|2026-09|MNO3P45')); await pg.waitForTimeout(200);
  await pg.click('#b-desf'); await pg.waitForTimeout(300);
  t('Desfazer apaga a correção', gravacoes[2] && gravacoes[2][0] === 'delete' && (await txt(pg, '#k-ab')).trim() === '4');
  // filtro de situação
  await pg.evaluate(() => { const w = document.getElementById('ms-sit'); w._sel = new Set(['corrigido']); w._auto = false; render(); setVw('anomalias'); });
  t('filtro Situação = Corrigida', (await pg.locator('#tb-anom tbody tr').count()) === 1);
  t('sem erro de página no fim', !erros.length, erros.join(' | '));
  if (SHOT) { await pg.evaluate(() => abreCaixa('ROTA - CGR|2026-06|ABC1D23')); await pg.waitForTimeout(500); await pg.screenshot({ path: join(SHOT, 'anom-caixa.png') }); }
  await b.close();
}
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { b, pg, erros } = await cenario({ vp: { width: w, height: h }, tema });
  const mede = () => pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1,
    hx: [...document.querySelectorAll('.vw.on .twrap')].some(x => x.scrollWidth > x.clientWidth + 1), top: document.querySelector('.top').scrollHeight > 90 }));
  for (const v of ['resumo', 'anomalias', 'correcoes']) {
    await pg.evaluate(v => setVw(v), v); await pg.waitForTimeout(250);
    const m = await mede();
    t(`${w}×${h} ${tema} ${v}: sem rolagem de página nem da visão, sem barra lateral`, !erros.length && !m.pag && !m.vw && !m.hx && !m.top, JSON.stringify(m) + erros.join('|'));
    if (SHOT && w === 1920) { await pg.waitForTimeout(900); await pg.screenshot({ path: join(SHOT, `anom-${v}-${tema}.png`) }); }
  }
  await pg.evaluate(() => abreCaixa('ROTA - CGR|2026-06|ABC1D23')); await pg.waitForTimeout(300);
  const cx = await pg.evaluate(() => { const r = document.querySelector('.mdl').getBoundingClientRect(); return r.height <= innerHeight && r.width <= innerWidth; });
  t(`${w}×${h} ${tema}: caixa cabe na tela`, cx);
  await b.close();
}
{
  const { b, pg } = await cenario({ admin: false });
  t('não admin cai no gate', /Apenas administradores/.test(await txt(pg, '#gate')));
  await b.close();
}
{
  const { b, pg, erros } = await cenario({ semTabela: true });
  t('sem as tabelas: avisa para rodar o SQL', !erros.length && /comb-anomalias\.sql/.test(await txt(pg, '#titSub')), await txt(pg, '#titSub'));
  await b.close();
}
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

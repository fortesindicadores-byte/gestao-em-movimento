// Remuneração (/remuneracao/): abre o painel no Chromium com o banco dublado e confere
// o gate, o Resumo (R$ e unitário, MoM/YoY inteiros e coloridos), as visões de gráfico e
// de tabela separadas (Unidade e Operação em duas colunas), a Evolução Mensal e Anual
// por indicador, o Relatório Excel (colunas escolhidas) e as Tabelas do FT (export igual
// ao FT), a visão Placas e o layout sem rolagem em 1366/1600/1920 nos dois temas.
// Uso: SBJS=<supabase UMD> CHART_JS=<chart.umd.js> DATALABELS=<…> FFLATE=<fflate UMD>
//   [FT_REM_JSON=<linhas do ft-remuneracao.mjs em modo seco>] [SHOT_DIR=…]
//   node scripts/remuneracao-teste.mjs
// Sem FT_REM_JSON usa um dublê sintético (o repositório não guarda remuneração).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', FFL = process.env.FFLATE || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };

function sintetico() {
  const out = [], unis = ['BLC', 'CBA', 'CGR', 'PIR'];
  for (let a = 2024; a <= 2026; a++) for (let m = 1; m <= 12; m++) {
    if (a === 2026 && m > 10) continue;
    const vig = `${a}-${String(m).padStart(2, '0')}`;
    unis.forEach((u, i) => {
      const op = u === 'PIR' ? 'EMPURRADA' : 'ROTA', at = 10 + i * 5 + (a - 2024), km = at * 2300;
      const comb = km * 1.6, manut = km * .5, carroc = km * .15, pneu = km * .22, lavagem_var = op === 'EMPURRADA' ? km * .05 : 0;
      const pedagio = op === 'EMPURRADA' ? km * .1 : 0, salario_var = op === 'EMPURRADA' ? km * .3 : 0;
      const variavel = comb + manut + carroc + pneu + lavagem_var + pedagio + salario_var;
      const fixo_ativo = at * 7000, fixo_parado = 3 * 2500, equipe = at * 9000, qlp_adm = 50000, outras = 30000;
      out.push({ operacao: op, unidade: u, unidade_ft: u, ano: a, mes: m, vigencia: vig, quinzenas: 2, ativos: at, parados: 3, km_teto: km, comb, manut, carroc, pneu,
        lavagem_var, outros_var: pedagio + salario_var, variavel, fixo_ativo, fixo_parado, seguro: (at + 3) * 300, finame: (at + 3) * 4000, ipva: (at + 3) * 200, lavagem: at * 150, rastreador: 0,
        faixa: (at + 3) * 16, deprec: 0, rem_k: 0, pedagio, seguro_var: 0, salario_var, lucro_var: 0,
        equipe, qlp_adm, outras, total: variavel + fixo_ativo + fixo_parado + equipe + qlp_adm + outras, atualizado_em: '2026-10-28T09:00:00Z' });
    });
  }
  return out;
}
const ROWS = process.env.FT_REM_JSON ? JSON.parse(readFileSync(process.env.FT_REM_JSON, 'utf8')).map(r => ({ ...r, atualizado_em: '2026-10-28T09:00:00Z' })) : sintetico();
// placas e tabelas do FT sintéticas
const COLS = ['Vigencia', 'Unidade - Nome', 'Placa', 'Modelo', 'Ano Veículo', 'Ativo', 'Consumo KM/L', 'Consumo R$/KM', 'Manutenção R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu por KM', 'KM Total', 'Total Custo Fixo', 'manutencaoVidaMeses', 'freeMaintenance'];
const PLACAS = [['ROTA_2_10_2026', 'CDD CAMBORIU', 'AAA1A11', 'Descrição: ATEGO 1719', 2022, true, 3.4, 1.9, .55, .15, .2, 2300, 7100, 40, 6],
  ['ROTA_2_10_2026', 'CDD CAMBORIU', 'BBB2B22', 'Descrição: DELIVERY 11.180', 2026, true, 3.8, 1.7, 0, .15, .2, 2300, 8200, 3, 6],
  ['ROTA_2_10_2026', 'CDD RIO DE JANEIRO', 'CCC3C33', 'Descrição: ACCELO 1316', 2019, false, 3.1, 2.0, .6, .15, .25, 0, 2500, 80, 6]];
const FTL = [];
for (const v of ['ROTA_1_9_2026', 'ROTA_2_9_2026', 'ROTA_1_10_2026', 'ROTA_2_10_2026']) {
  const [, q, m, a] = v.split('_');
  FTL.push({ canal: 'ROTA', tabela: 'Caminhao', tabela_nome: 'Caminhão', vigencia: v, ano: +a, mes: +m, quinzena: +q, linhas: 3 });
  FTL.push({ canal: 'ROTA', tabela: 'Resumo', tabela_nome: 'Resumo Rota', vigencia: v, ano: +a, mes: +m, quinzena: +q, linhas: 2 });
  FTL.push({ canal: 'ROTA', tabela: 'FORMULA:Resumo', tabela_nome: null, vigencia: v, ano: +a, mes: +m, quinzena: +q, linhas: 5 });
}
FTL.push({ canal: 'EMPURRADA', tabela: 'TrechoEmpurrada', tabela_nome: 'Trechos', vigencia: 'EMPURRADA_2_10_2026', ano: 2026, mes: 10, quinzena: 2, linhas: 4 });

async function abre(admin, { w = 1366, h = 768, tema = 'dark', vazio = false } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/chart\.js@4/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){}}};', contentType: 'application/javascript' }));
  await pg.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/fflate@/, r => r.fulfill({ status: 200, body: FFL ? readFileSync(FFL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/html2canvas|jspdf/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method(); const sel = u.searchParams.get('select') || '';
    const json = (o, st = 200) => r.fulfill({ status: st, body: JSON.stringify(o), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range' } });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: admin });
    const off = +(u.searchParams.get('offset') || 0), lim = Math.min(+(u.searchParams.get('limit') || 1000), 1000);
    if (p.includes('/rest/v1/ft_rem_mes')) return json(vazio ? [] : ROWS.slice(off, off + lim));
    const eq = k => (u.searchParams.get(k) || '').replace(/^eq\./, '');
    if (p.includes('/rest/v1/ft_layout')) {
      if (sel === 'colunas') return json(eq('tabela') === 'Caminhao' && eq('vigencia') === 'ROTA_2_10_2026' ? { colunas: COLS } : null);
      if (sel.startsWith('canal')) return json(FTL.slice(off, off + lim));
      const vs = (u.searchParams.get('vigencia') || '').replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, ''));
      return json(FTL.filter(l => l.canal === eq('canal') && l.tabela === eq('tabela') && vs.includes(l.vigencia)).map(l => ({ ...l, colunas: COLS })));
    }
    if (p.includes('/rest/v1/ft_linha')) {
      if (off) return json([]);
      if (sel.includes('placa')) return json(eq('tabela') === 'Caminhao' ? PLACAS.map(d => ({ unidade: d[1], placa: d[2], dados: d })) : []);
      return json(PLACAS.map(d => ({ unidade: d[1], dados: [eq('vigencia'), ...d.slice(1)] })));
    }
    return json([]);
  });
  await pg.addInitScript(t0 => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0); localStorage.removeItem('remuneracao_res'); localStorage.removeItem('remuneracao_mini');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  }, tema);
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'remuneracao/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  return { b, pg, erros };
}
const fmtR = v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; const br = (n, d) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return a >= 1e6 ? s + 'R$ ' + br(a / 1e6, 2) + ' mi' : a >= 1e4 ? s + 'R$ ' + br(a / 1e3, 0) + ' mil' : s + 'R$ ' + br(a, 0); };
const vai = async (pg, v) => { await pg.click(`.s-item[data-vw="${v}"]`); await pg.waitForTimeout(500); };
const semRolagem = pg => pg.evaluate(() => { const d = document.documentElement; const tw = [...document.querySelectorAll('.vw.on .twrap')];
  const vw = document.querySelector('.vw.on');
  return { pag: d.scrollHeight <= innerHeight + 1 && d.scrollWidth <= innerWidth + 1, lat: tw.every(x => x.scrollWidth <= x.clientWidth + 2), vw: !vw || vw.scrollHeight <= vw.clientHeight + 2 }; });

{ // admin, 1366 escuro
  const { b, pg, erros } = await abre(true);
  t('sem erro de página', !erros.length, erros.join(' | '));
  const vigs = [...new Set(ROWS.filter(r => r.operacao !== 'ARMAZEM' && r.total > 0).map(r => r.vigencia))].sort();
  const ult = vigs[vigs.length - 1], tot = ROWS.filter(r => r.vigencia === ult).reduce((s, r) => s + r.total, 0);
  t('hero = soma do último mês', (await pg.locator('#h-val').textContent()) === fmtR(tot), `${await pg.locator('#h-val').textContent()} × ${fmtR(tot)}`);
  const hd = await pg.locator('#h-del').innerText();
  const nomes = await pg.locator('#h-del .nt').allInnerTexts();
  t('MoM e YoY com esse nome (sem caixa alta) e % inteiro', nomes[0] === 'MoM' && nomes[1] === 'YoY' && /[+-]?\d+%/.test(hd) && !/,\d%/.test(hd), nomes.join(',') + ' · ' + hd.replace(/\n/g, ' '));
  const ant = ROWS.filter(r => r.vigencia === vigs[vigs.length - 2]).reduce((s, r) => s + r.total, 0);
  const cls = await pg.locator('#h-del b').first().getAttribute('class');
  t('MoM verde quando sobe, vermelho quando desce', tot > ant ? cls === 'cg' : tot < ant ? cls === 'cr' : true, `${cls}`);
  t('5 cards no Resumo', await pg.locator('#kpis-res .kpi').count() === 5);
  t('Resumo sem rolagem', Object.values(await semRolagem(pg)).every(Boolean), JSON.stringify(await semRolagem(pg)));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-resumo.png` });
  await pg.click('#dims-res .dimb[data-res="un"]'); await pg.waitForTimeout(400);
  t('modo unitário: hero em R$/km e o fixo por caminhão ao lado', /R\$\/km/.test(await pg.locator('#h-lbl').textContent()) && /caminhão/.test(await pg.locator('#e-lbl').textContent()) && /R\$ [\d.]+$/.test(await pg.locator('#e-val').textContent()),
    `${await pg.locator('#h-val').textContent()} · ${await pg.locator('#e-val').textContent()}`);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-resumo-un.png` });
  await pg.click('#dims-res .dimb[data-res="rs"]');

  await vai(pg, 'vargraf');
  t('Variável · Gráficos: dois gráficos e nenhuma tabela', await pg.locator('#vw-vargraf canvas').count() === 2 && await pg.locator('#vw-vargraf table').count() === 0);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-vargraf.png` });
  await vai(pg, 'vartab');
  const th = await pg.locator('#t-var thead th').allTextContents();
  t('Variável · Tabela: Unidade e Operação em duas colunas', th[0] === 'Unidade' && th[1] === 'Operação', th.slice(0, 3).join(' | '));
  t('Variável · Tabela tem Lavagem', th.some(x => /Lavagem/.test(x)), th.join(' | '));
  t('Variável · Tabela sem barra lateral', (await semRolagem(pg)).lat);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-vartab.png` });
  await vai(pg, 'fixgraf');
  t('Fixo · Gráficos: três gráficos', await pg.locator('#vw-fixgraf canvas').count() === 3 && await pg.locator('#vw-fixgraf table').count() === 0);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-fixgraf.png` });
  await vai(pg, 'fixtab');
  const thf = await pg.locator('#t-fix thead th').allTextContents();
  t('Fixo · Tabela: Unidade e Operação em duas colunas', thf[0] === 'Unidade' && thf[1] === 'Operação');
  t('Fixo · Tabela sem barra lateral', (await semRolagem(pg)).lat);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-fixtab.png` });

  await vai(pg, 'evomes');
  t('Evolução Mensal: filtro Indicador aparece só nela', await pg.locator('#ms-ind').isVisible());
  const nb = await pg.evaluate(() => Chart.getChart(document.getElementById('ch-em')).data.labels.length);
  t('Evolução Mensal: todos os meses da base', nb === vigs.length, `${nb} × ${vigs.length}`);
  await pg.click('#ms-ind .ms-btn'); await pg.click('#ms-ind .ms-opt[data-u="manut"]'); await pg.waitForTimeout(400);
  t('Indicador Manutenção troca o gráfico', /Manutenção/.test(await pg.locator('#em-tit').textContent()), await pg.locator('#em-tit').textContent());
  await pg.click('#dims-em .dimb[data-g="tier"]'); await pg.waitForTimeout(300);
  t('Evolução por tier: uma série por tier', await pg.evaluate(() => Chart.getChart(document.getElementById('ch-em')).data.datasets.length) >= 1);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-evomes.png` });
  await vai(pg, 'evoano');
  const na = await pg.evaluate(() => Chart.getChart(document.getElementById('ch-ea')).data.labels.length);
  t('Evolução Anual: um ponto por ano', na === new Set(vigs.map(v => v.slice(0, 4))).size, `${na}`);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-evoano.png` });
  await vai(pg, 'analitica');
  t('Analítica sem barra lateral', (await semRolagem(pg)).lat);
  await pg.click('#dims-an .dimb[data-g="uniop"]'); await pg.waitForTimeout(300);
  const tha = await pg.locator('#t-an thead th').allTextContents();
  t('Analítica Unidade e operação = duas colunas', tha[0] === 'Unidade' && tha[1] === 'Operação');

  await vai(pg, 'relat');
  t('Relatório: lista de colunas e prévia', await pg.locator('#rel-pick input[data-col]').count() >= 20 && await pg.locator('#rel-prev tbody tr').count() > 0);
  await pg.click('#rel-pick input[data-agr="unidade"]'); await pg.click('#rel-pick input[data-agr="operacao"]'); await pg.waitForTimeout(300);
  const nr = await pg.locator('#rel-prev tbody tr').count();
  t('Relatório: agrupar só por mês dá uma linha por mês do recorte', nr === 1, `${nr}`);
  if (FFL) {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#rel-bt')]);
    t('Relatório: baixa o Excel', /^remuneracao-ft-.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  }
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-relat.png` });
  await vai(pg, 'expft');
  await pg.waitForTimeout(400);
  t('Tabelas do FT: canais e tabelas (sem fórmulas)', await pg.locator('#dims-canal .dimb').count() === 2 && await pg.locator('#ft-tabs input[data-tab]').count() === 2);
  await pg.click('#ft-tabs input[data-tab="Caminhao"]'); await pg.waitForTimeout(300);
  t('Tabelas do FT: marca as 2 últimas quinzenas sozinho', await pg.locator('#ft-vigs input[data-vig]:checked').count() === 2);
  if (FFL) {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#ft-bt')]);
    t('Tabelas do FT: baixa o Excel', /^FT_ROTA_.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  }
  await pg.check('#ft-form'); await pg.waitForTimeout(200);
  t('Tabelas do FT: mostra as de fórmulas quando marcado', await pg.locator('#ft-tabs input[data-tab]').count() === 3);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-expft.png` });

  await pg.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); w._auto = false; w._render(''); });
  await vai(pg, 'placas'); await pg.waitForTimeout(600);
  t('Placas: filtros Modelo e Situação só nela', await pg.locator('#ms-mod').isVisible() && await pg.locator('#ms-sit').isVisible());
  t('Placas: 3 placas da quinzena', await pg.locator('#t-placas tbody tr').count() === 3);
  await pg.evaluate(() => { const w = document.getElementById('ms-sit'); w._sel = new Set(['Ativo']); w._render(''); renderPlacas(); }); await pg.waitForTimeout(500);
  t('Placas: Situação = Ativo deixa 2', await pg.locator('#t-placas tbody tr').count() === 2);
  t('sem erro de página no fim', !erros.length, erros.join(' | '));
  await b.close();
}
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1000]]) for (const tema of ['dark', 'light']) {
  const { b, pg, erros } = await abre(true, { w, h, tema });
  const r = {};
  for (const v of ['resumo', 'evomes', 'evoano', 'vargraf', 'vartab', 'fixgraf', 'fixtab', 'analitica', 'relat']) { await vai(pg, v); const s = await semRolagem(pg); if (!s.pag || !s.lat) r[v] = s; }
  t(`${w}×${h} ${tema}: nenhuma visão rola a página nem tem barra lateral`, !Object.keys(r).length && !erros.length, JSON.stringify(r) + erros.join(' | '));
  if (SHOT && w === 1920 && tema === 'light') { await vai(pg, 'resumo'); await pg.screenshot({ path: `${SHOT}/rem-1920-claro.png` }); }
  await b.close();
}
{ const { b, pg } = await abre(false); t('sem admin: gate', /Apenas administradores/.test(await pg.locator('.gate').textContent())); await b.close(); }
{ const { b, pg } = await abre(true, { vazio: true }); t('base vazia: gate', /Base ainda vazia/.test(await pg.locator('.gate').textContent())); await b.close(); }
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

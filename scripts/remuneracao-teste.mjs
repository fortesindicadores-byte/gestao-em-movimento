// Remuneração (/remuneracao/): abre o painel no Chromium com o banco dublado e
// confere o gate, o hero (= soma das linhas do mês), as cinco visões, a visão
// Placas lendo ft_linha na hora e o layout sem barra lateral em 1366/1920 nos
// dois temas. Uso: SBJS=<supabase UMD> CHART_JS=<chart.umd.js> DATALABELS=<…>
//   [FT_REM_JSON=<linhas do ft-remuneracao.mjs em modo seco>] [SHOT_DIR=…]
//   node scripts/remuneracao-teste.mjs
// Sem FT_REM_JSON usa um dublê sintético (o repositório não guarda remuneração).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };

function sintetico() {
  const out = [], unis = ['BLC', 'CBA', 'CGR', 'PIR'];
  for (let a = 2025; a <= 2026; a++) for (let m = 1; m <= 12; m++) {
    if (a === 2026 && m > 10) continue;
    const vig = `${a}-${String(m).padStart(2, '0')}`;
    unis.forEach((u, i) => {
      const op = u === 'PIR' ? 'EMPURRADA' : 'ROTA', at = 10 + i * 5, km = at * 2300;
      const comb = km * 1.6, manut = km * .5, carroc = km * .15, pneu = km * .22, variavel = comb + manut + carroc + pneu;
      const fixo_ativo = at * 7000, fixo_parado = 3 * 2500, equipe = at * 9000, qlp_adm = 50000, outras = 30000;
      out.push({ operacao: op, unidade: u, unidade_ft: u, ano: a, mes: m, vigencia: vig, quinzenas: 2, ativos: at, parados: 3, km_teto: km, comb, manut, carroc, pneu,
        lavagem_var: 0, outros_var: 0, variavel, fixo_ativo, fixo_parado, seguro: at * 300, finame: at * 4000, ipva: at * 200, lavagem: at * 300, rastreador: 0,
        equipe, qlp_adm, outras, total: variavel + fixo_ativo + fixo_parado + equipe + qlp_adm + outras, atualizado_em: '2026-10-28T09:00:00Z' });
    });
  }
  return out;
}
const ROWS = process.env.FT_REM_JSON ? JSON.parse(readFileSync(process.env.FT_REM_JSON, 'utf8')).map(r => ({ ...r, atualizado_em: '2026-10-28T09:00:00Z' })) : sintetico();
// placas sintéticas para a visão Placas
const COLS = ['Vigencia', 'Unidade - Nome', 'Placa', 'Modelo', 'Ano Veículo', 'Ativo', 'Consumo KM/L', 'Consumo R$/KM', 'Manutenção R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu por KM', 'KM Total', 'Total Custo Fixo', 'manutencaoVidaMeses', 'freeMaintenance'];
const PLACAS = [['ROTA_2_10_2026', 'CDD CAMBORIU', 'AAA1A11', 'Descrição: ATEGO 1719', 2022, true, 3.4, 1.9, .55, .15, .2, 2300, 7100, 40, 6],
  ['ROTA_2_10_2026', 'CDD CAMBORIU', 'BBB2B22', 'Descrição: DELIVERY 11.180', 2026, true, 3.8, 1.7, 0, .15, .2, 2300, 8200, 3, 6],
  ['ROTA_2_10_2026', 'CDD RIO DE JANEIRO', 'CCC3C33', 'Descrição: ACCELO 1316', 2019, false, 3.1, 2.0, .6, .15, .25, 0, 2500, 80, 6]];

async function abre(admin, { w = 1366, h = 768, tema = 'dark', vazio = false } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const leit = [];
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/chart\.js@4/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){}}};', contentType: 'application/javascript' }));
  await pg.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/html2canvas|jspdf/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method();
    const json = (o, st = 200, hd = {}) => r.fulfill({ status: st, body: JSON.stringify(o), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...hd } });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: admin });
    if (p.includes('/rest/v1/ft_rem_mes')) { leit.push('rem');
      const off = +(u.searchParams.get('offset') || 0), lim = Math.min(+(u.searchParams.get('limit') || 1000), 1000);
      return json(vazio ? [] : ROWS.slice(off, off + lim)); }
    if (p.includes('/rest/v1/ft_layout')) { const vg = (u.searchParams.get('vigencia') || '').replace('eq.', ''); const tab = (u.searchParams.get('tabela') || '').replace('eq.', '');
      return json(tab === 'Caminhao' && vg === 'ROTA_2_10_2026' ? { colunas: COLS } : null); }
    if (p.includes('/rest/v1/ft_linha')) { leit.push('linha'); const tab = (u.searchParams.get('tabela') || '').replace('eq.', '');
      return json(tab === 'Caminhao' ? PLACAS.map(d => ({ unidade: d[1], placa: d[2], dados: d })) : []); }
    return json([]);
  });
  await pg.addInitScript(t0 => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0);
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  }, tema);
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'remuneracao/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  return { b, pg, erros, leit };
}
const fmtR = v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; const br = (n, d) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return a >= 1e6 ? s + 'R$ ' + br(a / 1e6, 2) + ' mi' : a >= 1e4 ? s + 'R$ ' + br(a / 1e3, 0) + ' mil' : s + 'R$ ' + br(a, 0); };

{ // admin, 1366 escuro
  const { b, pg, erros } = await abre(true);
  t('sem erro de página', !erros.length, erros.join(' | '));
  const vigs = [...new Set(ROWS.filter(r => r.operacao !== 'ARMAZEM' && r.total > 0).map(r => r.vigencia))].sort();
  const ult = vigs[vigs.length - 1];
  const tot = ROWS.filter(r => r.vigencia === ult).reduce((s, r) => s + r.total, 0);
  const hero = (await pg.locator('#h-total').textContent()).trim();
  t('hero = soma das linhas do último mês com Rota', hero === fmtR(tot), `${hero} × ${fmtR(tot)} (${ult})`);
  t('vigência abre no último mês', (await pg.locator('#ms-vig .ms-cnt').textContent()) === '1');
  const ant = ROWS.filter(r => r.vigencia === vigs[vigs.length - 2]).reduce((s, r) => s + r.total, 0);
  const mom = ((tot / ant - 1) * 100).toFixed(1).replace('.', ',');
  t('vs mês anterior', (await pg.locator('#h-mom').textContent()).includes(mom), await pg.locator('#h-mom').textContent());
  t('cinco cards com valor', (await pg.locator('.kpi .kv').allTextContents()).every(x => x !== '—'));
  const sem = await pg.evaluate(() => { const a = document.querySelector('#vw-resumo'); return a.scrollHeight <= a.clientHeight + 2; });
  t('resumo sem rolagem em 1366×768', sem);
  if (SHOT) await pg.screenshot({ path: SHOT + '/rem-resumo-1366.png' });
  for (const v of ['analitica', 'rskm', 'fixo']) {
    await pg.click(`.s-item[data-vw="${v}"]`); await pg.waitForTimeout(500);
    const n = await pg.locator(`#vw-${v} table.dre tbody tr`).count();
    const tf = await pg.locator(`#vw-${v} table.dre tfoot tr.total`).count();
    const lat = await pg.evaluate(id => [...document.querySelectorAll('#vw-' + id + ' .twrap')].every(w => w.scrollWidth <= w.clientWidth + 2), v);
    t(`${v}: tabela com linhas e total`, n > 0 && tf === 1, `${n} linhas`);
    t(`${v}: sem barra lateral na tabela (1366)`, lat);
    if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-${v}-1366.png` });
  }
  // analítica: total da tabela = hero
  await pg.click('.s-item[data-vw="analitica"]'); await pg.waitForTimeout(300);
  const totAn = await pg.locator('#t-an tfoot td').nth(11).textContent();
  t('analítica: total = hero', Math.abs(+totAn.replace(/\D/g, '') - Math.round(tot)) <= 2, totAn);
  for (const d of ['operacao', 'uniop', 'mes']) { await pg.click(`#dims-an .dimb[data-an="${d}"]`); await pg.waitForTimeout(200);
    t(`analítica por ${d}`, await pg.locator('#t-an tbody tr').count() > 0); }
  // placas
  await pg.click('.s-item[data-vw="placas"]'); await pg.waitForTimeout(800);
  const np = await pg.locator('#t-placas tbody tr').count();
  const temPlacas = ult === '2026-10';
  t('placas: lê ft_linha da quinzena', !temPlacas || np === 3, `${np} linhas`);
  if (temPlacas) t('placas: carência em cinza', await pg.locator('#t-placas span.mut[title="carência"]').count() === 1);
  if (SHOT) await pg.screenshot({ path: SHOT + '/rem-placas-1366.png' });
  // filtro de unidade muda o hero
  await pg.click('.s-item[data-vw="resumo"]'); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel = new Set([w._itens[0]]); w._render(''); w._onChange(); });
  await pg.waitForTimeout(300);
  const uni0 = await pg.evaluate(() => document.getElementById('ms-uni')._itens[0]);
  const totU = ROWS.filter(r => r.vigencia === ult && r.unidade === uni0).reduce((s, r) => s + r.total, 0);
  t('filtro unidade: hero = soma da unidade', (await pg.locator('#h-total').textContent()).trim() === fmtR(totU), `${uni0}`);
  t('sem erro de página no fim', !erros.length, erros.join(' | '));
  await b.close();
}
for (const [w, h, tema] of [[1920, 1080, 'dark'], [1366, 768, 'light'], [1600, 900, 'light']]) {
  const { b, pg, erros } = await abre(true, { w, h, tema });
  const sem = await pg.evaluate(() => { const a = document.querySelector('#vw-resumo'); return a.scrollHeight <= a.clientHeight + 2; });
  t(`${w}×${h} ${tema}: resumo sem rolagem`, sem && !erros.length, erros.join(' | '));
  for (const v of ['analitica', 'rskm', 'fixo']) { await pg.click(`.s-item[data-vw="${v}"]`); await pg.waitForTimeout(400);
    t(`${w}×${h} ${tema}: ${v} sem barra lateral`, await pg.evaluate(id => [...document.querySelectorAll('#vw-' + id + ' .twrap')].every(x => x.scrollWidth <= x.clientWidth + 2), v)); }
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-fixo-${w}-${tema}.png` });
  await b.close();
}
{ const { b, pg } = await abre(false); t('sem admin: gate', /Apenas administradores/.test(await pg.locator('.gate').textContent())); await b.close(); }
{ const { b, pg } = await abre(true, { vazio: true }); t('tabela vazia: aviso da carga', /Base ainda vazia/.test(await pg.locator('.gate').textContent())); await b.close(); }
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

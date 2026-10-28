// Remuneração (/remuneracao/): abre o painel no Chromium com o banco dublado e confere
// o gate, o Resumo (R$ e unitário, MoM/YoY inteiros e coloridos), as visões de gráfico e
// de tabela separadas (Unidade e Operação em duas colunas), a Análise Histórica (mês a mês + ano a ano)
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
let ok = 0, falha = 0; const PEDIDOS_IA = [];
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
// cadastros e tabelas do FT sintéticos: Caminhão da Rota (4 quinzenas), Resumo, Cavalo da Empurrada, Empilhadeira do Armazém
const COLS = ['Vigencia', 'Unidade - Nome', 'Placa', 'Modelo do Cavalo', 'Montadora', 'Ano Cavalo', 'Ativo', 'Consumo KM/L', 'Consumo R$/KM', 'Manutenção R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu por KM', 'KM Total', 'Total Custo Fixo', 'manutencaoVidaMeses', 'freeMaintenance', 'chassi'];
const PLACAS = [['CDD CAMBORIU', 'AAA1A11', 'ATEGO 1719', 'Descrição: MERCEDES', 2022, true, 3.4, 1.9, .55, .15, .2, 2300, 7100, 40, 6, '9BM111'],
  ['CDD CAMBORIU', 'BBB2B22', 'DELIVERY 11.180', 'Descrição: VOLKS', 2026, true, 3.8, 1.7, 0, .15, .2, 2300, 8200, 3, 6, '9BW222'],
  ['CDD RIO DE JANEIRO', 'CCC3C33', 'ACCELO 1316', 'Descrição: MERCEDES', 2019, false, 3.1, 2.0, .6, .15, .25, 0, 2500, 80, 6, '9BM333']];
const LAY = { 'ROTA|Caminhao': COLS, 'ROTA|Resumo': ['Vigencia', 'Unidade - Nome', 'Total Frota'], 'ROTA|FORMULA:Resumo': ['Vigencia', 'Total Frota'],
  'EMPURRADA|TrechoEmpurrada': ['Vigencia', 'Unidade - Nome', 'kmRodado'],
  'EMPURRADA|CavaloEmpurrada': ['Vigencia', 'Unidade - Nome', 'Placa', 'modeloEmpurrada', 'montadora', 'ano', 'ativo', 'combustivelConsumoNeg', 'reaiskm', 'manutencaoVidaMeses', 'freeMaintenance', 'chassi'],
  'ARMAZEM|EmpilhadeiraApoio': ['Vigencia', 'Unidade - Nome', 'chassi', 'modeloApoio', 'anoEmpilhadeira', 'ativoParado', 'custoFixoCustoFixo', 'custoVariavelTotal', 'horimetroMedio', '_id'] };
const NOME = { Caminhao: 'Caminhão', Resumo: 'Resumo Rota', TrechoEmpurrada: 'Trechos', CavaloEmpurrada: 'Cavalo', EmpilhadeiraApoio: 'Equipamentos Armazém' };
const LIN = [];
const per = v => { const [, q, m, a] = v.split('_'); return { ano: +a, mes: +m, quinzena: +q }; };
['ROTA_1_9_2026', 'ROTA_2_9_2026', 'ROTA_1_10_2026', 'ROTA_2_10_2026'].forEach((v, vi) => {
  PLACAS.forEach(d => LIN.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: v, ...per(v), unidade: d[0], placa: d[1], dados: [v, ...d.slice(0, 7), +(d[7] + vi * .01).toFixed(2), ...d.slice(8)] }));
  ['CDD CAMBORIU', 'CDD RIO DE JANEIRO'].forEach(u => LIN.push({ canal: 'ROTA', tabela: 'Resumo', vigencia: v, ...per(v), unidade: u, placa: null, dados: [v, u, 10] }));
  LIN.push({ canal: 'ROTA', tabela: 'FORMULA:Resumo', vigencia: v, ...per(v), unidade: null, placa: null, dados: [v, '=A1'] });
});
LIN.push({ canal: 'EMPURRADA', tabela: 'TrechoEmpurrada', vigencia: 'EMPURRADA_2_10_2026', ...per('EMPURRADA_2_10_2026'), unidade: 'PIRAI', placa: null, dados: ['EMPURRADA_2_10_2026', 'PIRAI', 1200] });
LIN.push({ canal: 'EMPURRADA', tabela: 'CavaloEmpurrada', vigencia: 'EMPURRADA_2_10_2026', ...per('EMPURRADA_2_10_2026'), unidade: 'PIRAI', placa: 'PIR1A11',
  dados: ['EMPURRADA_2_10_2026', 'PIRAI', 'PIR1A11', 'Modelo: Actros 2651', 'Descrição: MERCEDES', 2025, 'ATIVO', 1.72, .31, 9.1, 6, '9BM963'] });
LIN.push({ canal: 'ARMAZEM', tabela: 'EmpilhadeiraApoio', vigencia: 'ARMAZEM_1_10_2026', ...per('ARMAZEM_1_10_2026'), unidade: 'CUIABA', placa: null,
  dados: ['ARMAZEM_1_10_2026', 'CUIABA', 'EMP123X', 'Modelo: CPD38 | Marca: HELI | Pallets: 2', 2022, false, 22855.69, 0, 266.9, 'uuid'] });
const FTL = [...new Map(LIN.map(l => [l.canal + '|' + l.tabela + '|' + l.vigencia, l])).values()].map(l => ({ canal: l.canal, tabela: l.tabela, tabela_nome: NOME[l.tabela] || null,
  vigencia: l.vigencia, ano: l.ano, mes: l.mes, quinzena: l.quinzena, linhas: LIN.filter(x => x.canal === l.canal && x.tabela === l.tabela && x.vigencia === l.vigencia).length }));

async function abre(admin, { w = 1366, h = 768, tema = 'dark', vazio = false, email = 'x@conlogsa.com.br', fn = 'ok' } = {}) {
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
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email });
    if (p.endsWith('/functions/v1/rapid-processor')) {
      PEDIDOS_IA.push({ auth: r.request().headers().authorization, corpo: JSON.parse(r.request().postData() || '{}') });
      if (fn === '404') return json({ msg: 'Requested function was not found' }, 404);
      const ev = [{ t: 'txt', d: 'Em **set/26** o FT ' }, { t: 'txt', d: 'previu:\n\n' }, { t: 'sql', sql: 'select unidade, sum(total) from ft_rem_mes group by 1', motivo: 'total por unidade' },
        { t: 'res', linhas: 2 }, { t: 'sql', sql: 'select 1', motivo: 'teste recusado' }, { t: 'res', erro: 'permission denied for table portal_segredo' },
        { t: 'txt', d: '| Unidade | Total |\n|---|---|\n| CGR | R$ 200 |\n| CBA | R$ 100 |\n\n- CGR lidera' }, { t: 'fim', consultas: 2, custo: 0.12, seg: 9 }];
      return r.fulfill({ status: 200, body: ev.map(e => JSON.stringify(e)).join('\n') + '\n', contentType: 'application/x-ndjson', headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: admin });
    const off = +(u.searchParams.get('offset') || 0), lim = Math.min(+(u.searchParams.get('limit') || 1000), 1000);
    if (p.includes('/rest/v1/ft_rem_mes')) return json(vazio ? [] : ROWS.slice(off, off + lim));
    const eq = k => (u.searchParams.get(k) || '').replace(/^eq\./, '');
    if (p.includes('/rest/v1/ft_layout')) {
      if (sel.startsWith('canal')) return json(FTL.slice(off, off + lim));
      const vin = u.searchParams.get('vigencia') || '';
      const vs = vin.startsWith('in.') ? vin.replace(/^in\.\(|\)$/g, '').split(',').map(x => x.replace(/"/g, '')) : [vin.replace(/^eq\./, '')];
      return json(FTL.filter(l => l.canal === eq('canal') && l.tabela === eq('tabela') && vs.includes(l.vigencia)).map(l => ({ vigencia: l.vigencia, tabela_nome: l.tabela_nome, colunas: LAY[l.canal + '|' + l.tabela] })));
    }
    if (p.includes('/rest/v1/ft_linha')) {
      if (off) return json([]);
      let rs = LIN;
      for (const k of ['canal', 'tabela', 'vigencia', 'placa']) { const v = u.searchParams.get(k); if (v && v.startsWith('eq.')) rs = rs.filter(r => String(r[k]) === v.slice(3)); }
      const cs = u.searchParams.get('dados'); if (cs && cs.startsWith('cs.')) { const arr = JSON.parse(cs.slice(3)); rs = rs.filter(r => arr.every(x => r.dados.includes(x))); }
      return json(rs);
    }
    return json([]);
  });
  await pg.addInitScript(([t0, e0]) => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0); localStorage.removeItem('remuneracao_res'); localStorage.removeItem('remuneracao_mini');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: e0, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  }, [tema, email]);
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

  await vai(pg, 'hist');
  t('Análise Histórica: filtro Indicador aparece só nela', await pg.locator('#ms-ind').isVisible());
  const nb = await pg.evaluate(() => Chart.getChart(document.getElementById('ch-em')).data.labels.length);
  t('Análise Histórica: todos os meses da base', nb === vigs.length, `${nb} × ${vigs.length}`);
  const na = await pg.evaluate(() => { const c = Chart.getChart(document.getElementById('ch-ea')); return { n: c.data.labels.length, tipo: c.config.type }; });
  t('Análise Histórica: barras por ano ao lado', na.n === new Set(vigs.map(v => v.slice(0, 4))).size && na.tipo === 'bar', JSON.stringify(na));
  t('Análise Histórica: cinco cards', await pg.locator('#kpis-hist .kpi').count() === 5);
  await pg.click('#ms-ind .ms-btn'); await pg.click('#ms-ind .ms-opt[data-u="manut"]'); await pg.waitForTimeout(400);
  t('Indicador Manutenção troca o gráfico', /Manutenção/.test(await pg.locator('#em-tit').textContent()), await pg.locator('#em-tit').textContent());
  t('Indicador de taxa: ano em barras lado a lado', await pg.evaluate(() => { const c = Chart.getChart(document.getElementById('ch-ea')); return c.config.type === 'bar' && !c.options.scales.x.stacked; }));
  await pg.click('#dims-em .dimb[data-g="tier"]'); await pg.waitForTimeout(300);
  t('Por tier: uma série por tier nos dois gráficos', await pg.evaluate(() => Chart.getChart(document.getElementById('ch-em')).data.datasets.length === Chart.getChart(document.getElementById('ch-ea')).data.datasets.length));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-hist.png` });
  await pg.click('#dims-em .dimb[data-g="total"]'); await pg.click('#ms-ind .ms-btn'); await pg.click('#ms-ind .ms-opt[data-u="total"]'); await pg.waitForTimeout(400);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-hist-rs.png` });
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
  // relatório no nível equipamento: 3 caminhões × 2 quinzenas + 1 cavalo + 1 empilhadeira (out/26)
  await pg.click('#rel-pick [data-niv="eq"]'); await pg.waitForTimeout(900);
  t('Relatório por equipamento: tipos de equipamento e quinzenas', await pg.locator('#rel-pick input[data-tipo]').count() === 5 && await pg.locator('#rel-pick input[data-relqz]').count() === 2);
  const neq = await pg.locator('#rel-prev tbody tr').count();
  const tipos = await pg.evaluate(() => [...document.querySelectorAll('#rel-prev tbody tr')].map(tr => tr.children[1].textContent));
  t('Relatório por equipamento: Caminhão, Cavalo e Empilhadeira (8 linhas)', neq === 8 && tipos.includes('Cavalo') && tipos.includes('Empilhadeira'), `${neq} · ${[...new Set(tipos)].join(',')}`);
  t('Relatório por equipamento: modelo do veículo, não o "FIXO"', await pg.evaluate(() => [...document.querySelectorAll('#rel-prev td')].some(td => td.textContent === 'ATEGO 1719')));
  t('Relatório por equipamento sem barra lateral', (await semRolagem(pg)).lat);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-relat-eq.png` });
  if (FFL) {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#rel-bt')]);
    t('Relatório por equipamento: baixa o Excel', /^remuneracao-ft-equipamentos-.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  }
  await pg.click('#rel-pick [data-niv="grupo"]'); await pg.waitForTimeout(300);

  await vai(pg, 'expft');
  await pg.waitForTimeout(700);
  t('Tabelas do FT: Canal, Tabela e Quinzena no topo; Ano, Vigência, Tier e Operação somem', await pg.locator('#ms-ftc').isVisible() && await pg.locator('#ms-ftt').isVisible() && await pg.locator('#ms-ftq').isVisible()
    && !(await pg.locator('#ms-vig').isVisible()) && !(await pg.locator('#ms-op').isVisible()));
  const nTab = await pg.evaluate(() => document.getElementById('ms-ftt')._itens.length);
  t('Tabelas do FT: todos os canais, sem as de fórmulas', nTab === 5, `${nTab}`);
  t('Tabelas do FT: abre no Caminhão da Rota, última quinzena', await pg.locator('#ft-res tbody tr').count() === 1 && /1 tabela\(s\) · 1 quinzena\(s\) · 3 linhas/.test(await pg.locator('#ft-st').textContent()), await pg.locator('#ft-st').textContent());
  t('Tabelas do FT: todos os campos da tabela para escolher', await pg.locator('#ft-campos input[data-campo]').count() === COLS.length);
  await pg.uncheck('#ft-campos input[data-campo="chassi"]'); await pg.waitForTimeout(300);
  t('Tabelas do FT: desmarcar um campo', /16 de 17/.test(await pg.locator('#ft-res tbody').innerText()), await pg.locator('#ft-res tbody').innerText());
  await pg.evaluate(() => { const w = document.getElementById('ms-ftq'); w._sel = new Set(); w._auto = false; w._render(''); ftPinta(); }); await pg.waitForTimeout(400);
  t('Tabelas do FT: Quinzena "Todos" = histórico inteiro, sem limite', /4 quinzena\(s\) · 12 linhas/.test(await pg.locator('#ft-st').textContent()), await pg.locator('#ft-st').textContent());
  if (FFL) {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#ft-bt')]);
    t('Tabelas do FT: baixa o Excel com as 12 linhas', /^FT_ROTA_Caminhao_4q_.*\.xlsx$/.test(dl.suggestedFilename()) && /12 linhas/.test(await pg.locator('#ft-st').textContent()), dl.suggestedFilename() + ' · ' + await pg.locator('#ft-st').textContent());
  }
  await pg.evaluate(() => { const w = document.getElementById('ms-ftt'); w._sel = new Set(['ROTA|Caminhao', 'EMPURRADA|CavaloEmpurrada', 'ARMAZEM|EmpilhadeiraApoio']); w._render(''); ftMontaPer(); }); await pg.waitForTimeout(500);
  t('Tabelas do FT: várias tabelas de canais diferentes', await pg.locator('#ft-res tbody tr').count() === 3 && await pg.locator('#ft-campos .ft-pg').count() === 3);
  await pg.check('#ft-form'); await pg.waitForTimeout(300);
  t('Tabelas do FT: mostra as de fórmulas quando marcado', await pg.evaluate(() => document.getElementById('ms-ftt')._itens.length) === 6);
  t('Tabelas do FT sem barra lateral', (await semRolagem(pg)).lat);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-expft.png` });

  await vai(pg, 'consulta'); await pg.waitForTimeout(900);
  t('Consulta: Ano e Vigência somem do topo', !(await pg.locator('#ms-vig').isVisible()) && await pg.locator('#ms-uni').isVisible());
  t('Consulta: cadastro da última quinzena (3 caminhões, 1 cavalo, 1 empilhadeira)', await pg.locator('#cs-list .cs-it').count() === 5, `${await pg.locator('#cs-list .cs-it').count()}`);
  await pg.fill('#cs-q', 'ccc3'); await pg.waitForTimeout(500);
  t('Consulta: busca pela placa', await pg.locator('#cs-list .cs-it').count() === 1);
  await pg.click('#cs-list .cs-it'); await pg.waitForTimeout(900);
  t('Consulta: ficha da placa com cadastro e gráfico', (await pg.locator('#cs-ficha h2').textContent()) === 'CCC3C33' && /ACCELO 1316/.test(await pg.locator('.cs-fx').innerText()) && await pg.locator('#ch-cs').count() === 1,
    await pg.locator('#cs-ficha').innerText().then(x => x.slice(0, 160)));
  t('Consulta: o histórico tem as 4 quinzenas', await pg.evaluate(() => CS_HIST.eqs.length) === 4);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-consulta.png` });
  t('Consulta sem rolagem', Object.values(await semRolagem(pg)).every(Boolean), JSON.stringify(await semRolagem(pg)));
  await pg.click('#dims-csa [data-csa="hist"]'); await pg.waitForTimeout(300);
  t('Consulta: aba Histórico, uma linha por quinzena', await pg.locator('#cs-corpo tbody tr').count() === 4);
  await pg.click('#dims-csa [data-csa="campos"]'); await pg.waitForTimeout(300);
  t('Consulta: todos os campos do FT, com o que mudou em laranja', await pg.locator('#cs-corpo tbody tr').count() === COLS.length && await pg.locator('#cs-corpo tr.mud').count() >= 1, `${await pg.locator('#cs-corpo tbody tr').count()}`);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-consulta-campos.png` });
  if (FFL) {
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#cs-ficha button.bt.ghost')]);
    t('Consulta: exporta a ficha', /^ficha-CCC3C33-.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  }
  await pg.fill('#cs-q', 'heli'); await pg.waitForTimeout(500);
  await pg.click('#cs-list .cs-it'); await pg.waitForTimeout(900);
  t('Consulta: empilhadeira pelo chassi', (await pg.locator('#cs-ficha h2').textContent()) === 'EMP123X' && /HELI/.test(await pg.locator('.cs-fx').innerText()) && /Fixo/.test(await pg.locator('#cs-corpo').innerText()));
  await pg.fill('#cs-q', ''); await pg.click('#dims-cs [data-cs="mod"]'); await pg.waitForTimeout(500);
  t('Consulta: modelos', await pg.locator('#cs-list .cs-it').count() === 5);
  await pg.click('#cs-list .cs-it[data-mod="MERCEDES ATEGO 1719¦Caminhão"]'); await pg.waitForTimeout(400);
  t('Consulta: ficha do modelo lista as placas', await pg.locator('#cs-ficha tbody tr').count() === 1);
  await pg.click('#cs-ficha tr.cs-lnk'); await pg.waitForTimeout(900);
  t('Consulta: da ficha do modelo para a placa', (await pg.locator('#cs-ficha h2').textContent()) === 'AAA1A11');
  await pg.click('#dims-cs [data-cs="eq"]');

  await pg.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); w._auto = false; w._render(''); });
  await vai(pg, 'placas'); await pg.waitForTimeout(600);
  t('Placas: filtros Modelo e Situação só nela', await pg.locator('#ms-mod').isVisible() && await pg.locator('#ms-sit').isVisible());
  t('Placas: 3 placas da quinzena', await pg.locator('#t-placas tbody tr').count() === 3);
  await pg.evaluate(() => { const w = document.getElementById('ms-sit'); w._sel = new Set(['Ativo']); w._render(''); renderPlacas(); }); await pg.waitForTimeout(500);
  t('Placas: Situação = Ativo deixa 2', await pg.locator('#t-placas tbody tr').count() === 2);
  t('Placas: modelo do veículo e ano', /ATEGO 1719/.test(await pg.locator('#t-placas').innerText()) && /2022/.test(await pg.locator('#t-placas').innerText()));
  await pg.click('#t-placas tr.cs-lnk'); await pg.waitForTimeout(900);
  t('Placas: clicar abre a ficha na Consulta', await pg.locator('#vw-consulta').isVisible() && (await pg.locator('#cs-ficha h2').textContent()) === 'AAA1A11');
  t('sem erro de página no fim', !erros.length, erros.join(' | '));
  await b.close();
}
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1000]]) for (const tema of ['dark', 'light']) {
  const { b, pg, erros } = await abre(true, { w, h, tema });
  const r = {};
  for (const v of ['resumo', 'hist', 'vargraf', 'vartab', 'fixgraf', 'fixtab', 'analitica', 'relat', 'expft', 'consulta']) { await vai(pg, v); const s = await semRolagem(pg); if (!s.pag || !s.lat) r[v] = s; }
  t(`${w}×${h} ${tema}: nenhuma visão rola a página nem tem barra lateral`, !Object.keys(r).filter(k => k !== 'ficha').length && !erros.length, JSON.stringify(r) + erros.join(' | '));
  await vai(pg, 'consulta'); await pg.waitForTimeout(600); await pg.click('#cs-list .cs-it'); await pg.waitForTimeout(900);
  { const s = await semRolagem(pg); if (!s.pag || !s.vw) r.ficha = s; }
  t(`${w}×${h} ${tema}: ficha da Consulta sem rolagem`, !r.ficha, JSON.stringify(r.ficha || ''));
  if (SHOT && tema === 'dark') await pg.screenshot({ path: `${SHOT}/rem-consulta-${w}.png` });
  if (SHOT && w === 1920 && tema === 'light') { await vai(pg, 'resumo'); await pg.screenshot({ path: `${SHOT}/rem-1920-claro.png` }); }
  await b.close();
}
{ // Assistente: só o dono vê; pergunta, resposta em tabela, consultas e custo
  const { b, pg, erros } = await abre(true);
  t('Assistente escondido para outro admin', !(await pg.locator('#it-ia').isVisible()));
  await b.close();
}
for (const [w, h] of [[1366, 768], [1920, 1000]]) {
  const { b, pg, erros } = await abre(true, { w, h, email: 'fortesindicadores@gmail.com' });
  t(`${w}: Assistente aparece para o dono`, await pg.locator('#it-ia').isVisible());
  await vai(pg, 'ia');
  t(`${w}: filtros escondidos e exemplos na tela vazia`, !(await pg.locator('.filtros').isVisible()) && await pg.locator('.ia-ex .dimb').count() === 4);
  await pg.fill('#ia-txt', 'Quem recebe mais?'); await pg.press('#ia-txt', 'Enter'); await pg.waitForTimeout(900);
  const ped = PEDIDOS_IA.at(-1);
  t(`${w}: manda o login do hub e a pergunta`, ped && ped.auth === 'Bearer tok' && ped.corpo.mensagens.at(-1).content === 'Quem recebe mais?' && /Resumo Gerencial/.test(ped.corpo.contexto), JSON.stringify(ped && ped.corpo).slice(0, 160));
  const resp = await pg.locator('.ia-m.ele').last();
  t(`${w}: resposta com negrito, tabela e lista`, await resp.locator('b').count() >= 1 && await resp.locator('table tbody tr').count() === 2 && await resp.locator('li').count() >= 1);
  t(`${w}: coluna de número alinhada à direita`, (await resp.locator('td').nth(1).getAttribute('class')) === 'n');
  t(`${w}: consultas listadas, a recusada em vermelho`, /2 consultas/.test(await resp.locator('summary').textContent()) && await resp.locator('.ia-q .er').count() === 1);
  t(`${w}: rodapé com consultas, tempo e custo`, /2 consultas · 9 s · US\$ 0,12/.test(await resp.locator('.ia-pe').textContent()));
  const s = await semRolagem(pg); t(`${w}: Assistente sem rolagem de página`, s.pag, JSON.stringify(s));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/rem-ia-${w}.png` });
  await pg.fill('#ia-txt', 'E em ago/26?'); await pg.click('#ia-env'); await pg.waitForTimeout(900);
  t(`${w}: 2ª pergunta leva o histórico`, PEDIDOS_IA.at(-1).corpo.mensagens.length === 3 && PEDIDOS_IA.at(-1).corpo.mensagens[1].role === 'assistant');
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1800); await vai(pg, 'ia');
  t(`${w}: conversa volta depois do F5`, await pg.locator('.ia-m.eu').count() === 2);
  await pg.click('#ia-nova'); t(`${w}: Nova limpa`, await pg.locator('.ia-m').count() === 0);
  t(`${w}: sem erro de página`, !erros.length, erros.join(' | '));
  await b.close();
}
{ const { b, pg } = await abre(true, { email: 'fortesindicadores@gmail.com', fn: '404' }); await vai(pg, 'ia');
  await pg.fill('#ia-txt', 'oi'); await pg.press('#ia-txt', 'Enter'); await pg.waitForTimeout(700);
  t('função não publicada: avisa', /ainda não foi publicada/.test(await pg.locator('.ia-m.ele').last().textContent())); await b.close(); }
{ const { b, pg } = await abre(false); t('sem admin: gate', /Apenas administradores/.test(await pg.locator('.gate').textContent())); await b.close(); }
{ const { b, pg } = await abre(true, { vazio: true }); t('base vazia: gate', /Base ainda vazia/.test(await pg.locator('.gate').textContent())); await b.close(); }
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

// Postos (/combustivel/postos/): abre o painel no Chromium com o banco dublado
// (erp_abastecimentos com teto de 1.000 linhas por leitura) e confere cards,
// gráfico dia a dia com o toggle, tabela por posto ordenada pelo R$/L, filtros,
// preço absurdo pelo mediano, unidades fora do portal e telas sem rolagem.
// Uso: SBJS=<supabase UMD> CHART_JS=<chart.umd.js> DATALABELS=<…> [SHOT_DIR=…] node scripts/postos-teste.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };

// ── base sintética: set e out/2026, 3 postos de diesel, Arla, linhas fora do portal ──
const POSTOS = [['11111111000101', 'POSTO BARATO LTDA', 6.00], ['22222222000102', 'POSTO MEIO SA', 6.50], ['33333333000103', 'POSTO CARO', 7.00]];
const L = []; let os = 1;
for (const vig of ['2026-09', '2026-10']) {
  for (let d = 1; d <= 20; d++) {
    const data = `${vig}-${String(d).padStart(2, '0')}`;
    POSTOS.forEach(([cnpj, nome, p], i) => {
      for (let k = 0; k < 9; k++) {
        const preco = vig === '2026-10' ? p + 0.1 : p;
        L.push({ ordem_servico: String(os++), data, placa: `ABC${i}${k}${d % 3}`, filial: 'CDD CUIABA', projeto_os: k % 2 ? 'ROTA - CBA' : 'EMPURRADA - PIR',
          litros: 100, valor: 100 * preco, tipo_combustivel: 'DIESEL S10', posto: nome, cnpj_posto: cnpj, encerrada: 'S', atualizado_em: '2026-10-28T08:00:00Z' });
      }
    });
    L.push({ ordem_servico: String(os++), data, placa: 'ARL0001', filial: 'CDD CUIABA', projeto_os: 'ROTA - CBA', litros: 20, valor: 60, tipo_combustivel: 'ARLA 32', posto: 'POSTO CARO', cnpj_posto: '33333333000103', encerrada: 'S' });
  }
}
// fora: filial fora do portal, projeto operacional; GOI vira GNA; preço absurdo vira mediano
L.push({ ordem_servico: 'x1', data: '2026-10-05', placa: 'CAL0001', filial: 'CALDAS', projeto_os: 'OPERACIONAL - CAL', litros: 500, valor: 3000, tipo_combustivel: 'DIESEL S10', posto: 'X', cnpj_posto: '99', encerrada: 'S' });
L.push({ ordem_servico: 'x2', data: '2026-10-05', placa: 'TER0001', filial: 'CDD PELOTAS', projeto_os: 'TERCEIROS - PLT', litros: 500, valor: 3000, tipo_combustivel: 'DIESEL S10', posto: 'X', cnpj_posto: '99', encerrada: 'S' });
L.push({ ordem_servico: 'x3', data: '2026-10-06', placa: 'GOI0001', filial: 'CDD GOIANIA', projeto_os: 'AUTO SERVIÇO - GOI', litros: 100, valor: 640, tipo_combustivel: 'DIESEL S10', posto: 'POSTO GOIAS', cnpj_posto: '44444444000104', encerrada: 'S' });
L.push({ ordem_servico: 'x4', data: '2026-10-07', placa: 'ABC0000', filial: 'CDD CUIABA', projeto_os: 'ROTA - CBA', litros: 100, valor: 1490000000, tipo_combustivel: 'DIESEL S10', posto: 'POSTO BARATO LTDA', cnpj_posto: '11111111000101', encerrada: 'S' });
const TETO = 1000;
let leituras = 0;

async function cenario({ vp = { width: 1366, height: 768 }, tema = 'dark', semPosto = false } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/chart\.js@4/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){},resize(){}}};', contentType: 'application/javascript' }));
  await pg.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/html2canvas|jspdf/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method(); const h = r.request().headers();
    const hd = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range' };
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...hd, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return r.fulfill({ status: 200, body: JSON.stringify({ id: 'u1', email: 'x@conlogsa.com.br' }), contentType: 'application/json', headers: hd });
    if (p.includes('/rest/v1/erp_abastecimentos')) {
      const sel = u.searchParams.get('select') || '';
      if (semPosto && /posto/.test(sel)) return r.fulfill({ status: 400, body: JSON.stringify({ code: '42703', message: 'column erp_abastecimentos.posto does not exist' }), contentType: 'application/json', headers: hd });
      if (/atualizado_em/.test(sel) && !/litros/.test(sel)) return r.fulfill({ status: 200, body: JSON.stringify([{ atualizado_em: '2026-10-28T08:00:00Z' }]), contentType: 'application/json', headers: hd });
      leituras++;
      let off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || TETO);
      const rg = h['range']; if (rg) { const mm = rg.match(/(\d+)-(\d+)/); if (mm) { off = +mm[1]; lim = +mm[2] - off + 1; } }
      lim = Math.min(lim, TETO);
      const cols = sel.split(',');
      const fatia = L.slice(off, off + lim).map(x => Object.fromEntries(cols.map(c => [c, x[c] ?? null])));
      return r.fulfill({ status: 200, body: JSON.stringify(fatia), contentType: 'application/json', headers: { ...hd, 'Content-Range': `${off}-${off + fatia.length - 1}/${L.length}` } });
    }
    return r.fulfill({ status: 200, body: '[]', contentType: 'application/json', headers: hd });
  });
  await pg.addInitScript(t => { window.__tema = t; }, tema);
  await pg.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', window.__tema || 'dark');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  });
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'combustivel/postos/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => /ERP/.test(document.getElementById('titSub').textContent) || /Erro/.test(document.getElementById('titSub').textContent), null, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { b, pg, erros };
}
const txt = (pg, s) => pg.locator(s).first().textContent();
const num = s => +String(s).replace(/[^\d,-]/g, '').replace(',', '.');

{
  const { b, pg, erros } = await cenario();
  t('sem erro de página', !erros.length, erros.join(' | '));
  t('leu tudo em páginas de 1.000', leituras >= Math.ceil(L.length / TETO), `${leituras} leituras`);
  t('abre em OUT/26 (último mês com abastecimento)', /^OUT\/26/.test(await txt(pg, '#titSub')), await txt(pg, '#titSub'));
  t('combustível abre só nos diesel', await pg.evaluate(() => [...document.getElementById('ms-comb')._sel].join() === 'DIESEL S10'));
  // out/26: 20 dias × 27 abast. × 100 L + GNA 100 L + preço absurdo 100 L
  const lit = num(await txt(pg, '#k-lit'));
  t('litros de out/26 (54.000 + GNA + o absurdo)', lit === 54200, String(lit));
  const val = num(await txt(pg, '#k-val'));
  t('valor sem o R$ 1,49 bi (preço absurdo pelo mediano)', val > 340000 && val < 360000, String(val));
  t('fora do portal e terceiros não entram', !(await pg.evaluate(() => ROWS.some(r => r.placa === 'CAL0001' || r.placa === 'TER0001'))));
  t('GOI vira GNA', await pg.evaluate(() => ROWS.some(r => r.uni === 'GNA')));
  t('três cards: Valor, Litros, Preço', await pg.locator('.kpi').count() === 3);
  t('MoM do R$/L em vermelho quando sobe', await pg.locator('#k-rl-m b.cr').count() === 1, await txt(pg, '#k-rl-m'));
  // tabela: ordem e colunas
  const cab = await pg.locator('#tb-postos thead th').allTextContents();
  t('colunas na ordem pedida', cab.join('|') === 'Posto|Valor abastecido|Litros|R$/L', cab.join('|'));
  const nomes = await pg.locator('#tb-postos tbody td.posto').allTextContents();
  t('do menor para o maior R$/L', nomes[0] === 'POSTO BARATO LTDA' && nomes.indexOf('POSTO CARO') === nomes.length - 1, nomes.join(' · '));
  t('linha Total', await pg.locator('#tb-postos tr.total').count() === 1);
  t('tabela em visão própria (Por Posto), fora do Resumo', await pg.evaluate(() => !!document.querySelector('#vw-postos #tab-postos') && !document.querySelector('#vw-resumo table') && TIT.postos === 'Por Posto'));
  t('gráfico no padrão: eixo de valor escondido, sem grade, rótulo em cima, barra translúcida com contorno', await pg.evaluate(() => { const o = charts.dia.options, d = charts.dia.data.datasets[0];
    return o.scales.y.display === false && o.scales.x.grid.display === false && o.plugins.datalabels.anchor === 'end' && /,\.65\)/.test(d.backgroundColor) && d.borderWidth === 1 && d.borderRadius === 3; }));
  t('texto explicativo embaixo da tabela', await pg.evaluate(() => { const c = document.getElementById('tab-pe'); return c.previousElementSibling.classList.contains('twrap') && /menor para o maior/.test(c.textContent); }));
  // gráfico dia a dia + toggle
  const n0 = await pg.evaluate(() => charts.dia ? charts.dia.data.labels.length : -1);
  t('gráfico com os 20 dias', n0 === 20, String(n0));
  await pg.click('#dims-dia .dimb[data-m="litros"]'); await pg.waitForTimeout(200);
  t('toggle Litros', /Litros/.test(await txt(pg, '#g-tit')) && await pg.evaluate(() => charts.dia.data.datasets[0].data[0] > 2000));
  await pg.click('#dims-dia .dimb[data-m="rl"]'); await pg.waitForTimeout(200);
  t('toggle R$/L', /R\$\/L/.test(await txt(pg, '#g-tit')) && await pg.evaluate(() => { const v = charts.dia.data.datasets[0].data[0]; return v > 6 && v < 7.2; }));
  // filtro por posto
  await pg.evaluate(() => { const w = document.getElementById('ms-posto'); w._sel = new Set(['33333333000103']); render(); });
  t('filtro Posto', (await pg.locator('#tb-postos tbody tr').count()) === 1 && /7,10/.test(await txt(pg, '#k-rl')), await txt(pg, '#k-rl'));
  await pg.evaluate(() => { document.getElementById('ms-posto')._sel = new Set(); document.getElementById('ms-comb')._sel = new Set(); document.getElementById('ms-comb')._auto = false; render(); });
  t('combustível Todos inclui o Arla', await pg.evaluate(() => ROWS.filter(r => passa(r)).some(r => r.prod === 'ARLA 32')));
  if (SHOT) await pg.screenshot({ path: join(SHOT, 'postos-1366.png') });
  await b.close();
}
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { b, pg, erros } = await cenario({ vp: { width: w, height: h }, tema });
  const mede = () => pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1,
    hx: document.querySelector('#tab-postos').scrollWidth > document.querySelector('#tab-postos').clientWidth + 1, top: document.querySelector('.top').scrollHeight > 90,
    gh: Math.round(document.getElementById('ch-dia').getBoundingClientRect().height) }));
  const m = await mede();
  t(`${w}×${h} ${tema}: Resumo sem rolagem de página nem da visão, gráfico com altura`, !erros.length && !m.pag && !m.vw && m.gh > 250, JSON.stringify(m) + erros.join('|'));
  t(`${w}×${h} ${tema}: topo numa linha`, !m.top);
  if (SHOT && w === 1920) { await pg.waitForTimeout(1200); await pg.screenshot({ path: join(SHOT, `postos-${w}-${tema}.png`) }); }
  await pg.evaluate(() => setVw('postos')); await pg.waitForTimeout(150);
  const m2 = await mede();
  t(`${w}×${h} ${tema}: Por Posto sem rolagem de página nem da visão, tabela sem barra lateral`, !m2.pag && !m2.vw && !m2.hx, JSON.stringify(m2));
  if (SHOT && w === 1920) await pg.screenshot({ path: join(SHOT, `postos-tab-${w}-${tema}.png`) });
  await b.close();
}
{
  const { b, pg, erros } = await cenario({ semPosto: true });
  t('sem as colunas de posto: abre igual', !erros.length && num(await txt(pg, '#k-lit')) === 54200);
  t('sem as colunas: tabela com "Posto não informado" e o aviso', /Posto não informado/.test(await txt(pg, '#tb-postos tbody')) && /colunas novas/.test(await txt(pg, '#tab-pe')));
  await b.close();
}
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

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
  A({ chave: 'ROTA - PLT|2026-07|DEF4E56', ym: '2026-07', unidade: 'PLT', projeto: 'ROTA - PLT', placa: 'DEF4E56', placa_origem: 'DEF4E56', modelo: 'VW 13.180', tipo: 'kml_alto', tipos: 'kml_alto', km: 5070, litros: 816, valor: 5300, kml: 6.21, ref_kml: 2.9, ref_fonte: 'modelo no mês (59 placas)', desvio: 1.14, impacto_l: -933, situacao: 'ajustado', auto_km: 2300, auto_litros: 816, auto_valor: 5300, auto_fonte: 'Gasola', auto_obs: 'km pelos hodômetros das APIs', api_litros: 820, api_km: 2300, api_n: 4 }),
  A({ chave: 'EMPURRADA - PIR|2026-01|GHI7J89', ym: '2026-01', unidade: 'PIR', projeto: 'EMPURRADA - PIR', placa: 'GHI7J89', placa_origem: 'GHI7J89', modelo: 'M.BENZ/ACTROS 2651', tipo: 'km_zero', tipos: 'km_zero', km: 0, litros: 913, valor: 6000, kml: 0, ref_kml: 2.05, ref_fonte: 'modelo no mês (25 placas)', desvio: null, impacto_l: 913 }),
  A({ chave: 'SEARA|2026-04|JKL0M12', ym: '2026-04', unidade: 'ANG', projeto: 'SEARA', placa: 'JKL0M12', placa_origem: 'JKL0M12', modelo: 'VW 11.180', tipo: 'kml_alto', tipos: 'kml_alto', km: 8180, litros: 1158, valor: 7600, kml: 7.06, ref_kml: 3.4, ref_fonte: 'modelo no mês (10 placas)', desvio: 1.08, impacto_l: -1246 }),
  A({ chave: 'ROTA - CBA|2026-09|MNO3P45', ym: '2026-09', unidade: 'CBA', projeto: 'ROTA - CBA', placa: 'MNO3P45', placa_origem: 'MNO3P45', modelo: 'VW 24.280', tipo: 'kml_baixo', tipos: 'kml_baixo', km: 1500, litros: 800, valor: 5600, kml: 1.88, ref_kml: 3.1, ref_fonte: 'modelo no mês (20 placas)', desvio: -0.39, impacto_l: 316 }),
];
const API = [
  { sistema: 'GASOLA', id_origem: 'g1', item: 1, data: '2026-06-03T13:00:00Z', produto: 'DIESEL S10', litros: 400, valor: 2600, preco: 6.5, hodometro: 100310, posto: 'Posto A', valido: true },
  { sistema: 'GASOLA', id_origem: 'g2', item: 1, data: '2026-06-15T13:00:00Z', produto: 'DIESEL S10', litros: 450, valor: 2900, preco: 6.44, hodometro: 100500, posto: 'Posto A', valido: true },
  { sistema: 'GASOLA', id_origem: 'g3', item: 1, data: '2026-06-20T13:00:00Z', produto: 'DIESEL S10', litros: 300, valor: 1950, preco: 6.5, hodometro: 100650, posto: 'Posto B', valido: true },
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
  const CORR = new Map(); const COS = new Map(); const gravacoes = [];
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
    if (p.includes('/rest/v1/comb_correcao_os')) {
      if (m === 'GET') return json([...COS.values()]);
      if (m === 'POST') { const b = JSON.parse(req.postData()); const o = Array.isArray(b) ? b[0] : b; COS.set(o.ordem_servico, o); gravacoes.push(['os', o]);
        return json(/vnd\.pgrst\.object/.test(req.headers()['accept'] || '') ? o : [o], 201); }
      if (m === 'DELETE') { const k = decodeURIComponent((u.searchParams.get('ordem_servico') || '').replace(/^eq\./, '')); COS.delete(k); gravacoes.push(['os-del', k]); return r.fulfill({ status: 204, headers: hd }); }
    }
    if (p.includes('/rest/v1/abast_api')) return json(API);
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
  t('4 em aberto no card (a ajustada pelas APIs sai)', (await txt(pg, '#k-ab')).trim() === '4', await txt(pg, '#k-ab'));
  t('meta do card: litros em jogo das em aberto', /3\.434 L em jogo/.test(await txt(pg, '#k-ab-m')), await txt(pg, '#k-ab-m'));
  t('card ajustadas pelas APIs com a fonte', (await txt(pg, '#k-lit')).trim() === '1' && /Gasola 1/.test(await txt(pg, '#k-lit-m')), await txt(pg, '#k-lit') + ' · ' + await txt(pg, '#k-lit-m'));
  t('gráficos por mês e por unidade', await pg.evaluate(() => charts['ch-mes'].data.labels.length === 5 && charts['ch-uni'].data.labels.length === 4));
  t('gráfico no padrão: eixo escondido, sem grade, barra translúcida com contorno', await pg.evaluate(() => { const c = charts['ch-mes'], d = c.data.datasets[0];
    return c.options.scales.y.display === false && c.options.scales.x.grid.display === false && /,\.65\)/.test(d.backgroundColor) && d.borderWidth === 1 && d.borderRadius === 3; }));
  await pg.evaluate(() => setVw('anomalias'));
  const placas = await pg.locator('#tb-anom tbody td.pl').allTextContents();
  t('tabela: maior litragem em jogo primeiro', placas[0] === 'JKL0M12' && placas[1] === 'ABC1323', placas.join(' · '));
  const cab = await pg.locator('#tb-anom thead th').allTextContents();
  t('colunas Unidade e Projeto separadas', cab[0] === 'Unidade' && cab[1] === 'Projeto', cab.join('|'));
  t('coluna Nas APIs e situação ajustada', await pg.evaluate(() => { const w = document.getElementById('ms-sit'); w._sel = new Set(); w._auto = false; render(); const tr = [...document.querySelectorAll('#tb-anom tbody tr')].find(r => /DEF4E56/.test(r.textContent));
    return tr && /Gasola · 820 L/.test(tr.textContent) && /Ajustada pelas APIs/.test(tr.textContent); }));
  // histórico da placa: clique na placa
  await pg.locator('#tb-anom tbody td.pl', { hasText: 'ABC1323' }).click(); await pg.waitForTimeout(500);
  t('clique na placa abre a visão da placa (tabela, sem janela)', await pg.evaluate(() => VW === 'placa' && document.getElementById('vw-placa').classList.contains('on') && !document.getElementById('ov').classList.contains('on') && document.querySelector('#h-tab table.dre.hist') != null && document.querySelector('.s-item[data-vw="anomalias"]').classList.contains('on')));
  t('visão da placa sem rolagem lateral', await pg.evaluate(() => { const w = document.getElementById('h-tab'); return w.scrollWidth <= w.clientWidth + 1; }));
  t('histórico com os meses e as OS', await pg.evaluate(() => document.querySelectorAll('#h-tab tr.mes').length === 2 && document.querySelectorAll('#h-tab tr[data-os]').length === 5), await pg.evaluate(() => document.getElementById('h-tab').innerText.slice(0, 300)));
  t('km da OS com hodômetro errado cai no km da OS (300)', await pg.evaluate(() => { const tr = document.querySelector('#h-tab tr[data-os="OS4"]'); return tr && tr.children[5].textContent.trim() === '300'; }));
  t('API casada no mesmo dia e só-API em itálico', await pg.evaluate(() => /Gasola · 450,0 L · hod\. 100\.500/.test(document.querySelector('#h-tab tr[data-os="OS4"]').textContent) && document.querySelectorAll('#h-tab tr.so-api').length === 1));
  t('hodômetro diferente da API em destaque', await pg.evaluate(() => document.querySelector('#h-tab tr[data-os="OS4"] td.dif') != null));
  await pg.fill('#h-tab tr[data-os="OS4"] input[data-c="km"]', '190'); await pg.press('#h-tab tr[data-os="OS4"] input[data-c="km"]', 'Tab'); await pg.waitForTimeout(400);
  const gos = gravacoes.find(x => x[0] === 'os');
  t('corrigir km grava comb_correcao_os', gos && gos[1].ordem_servico === 'OS4' && gos[1].km === 190 && gos[1].litros == null && gos[1].km_erp === 300, JSON.stringify(gos));
  t('mês recalcula com o km corrigido', await pg.evaluate(() => /800 km/.test(document.getElementById('hm-2026-06').textContent) && /ERP 910 km/.test(document.getElementById('hm-2026-06').textContent)), await pg.evaluate(() => document.getElementById('hm-2026-06').textContent));
  await pg.fill('#h-tab tr[data-os="OS4"] input[data-c="km"]', ''); await pg.press('#h-tab tr[data-os="OS4"] input[data-c="km"]', 'Tab'); await pg.waitForTimeout(400);
  t('campo vazio apaga a correção', gravacoes.some(x => x[0] === 'os-del' && x[1] === 'OS4'));
  if (SHOT) await pg.screenshot({ path: join(SHOT, 'anom-historico.png') });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  t('Esc volta para Anomalias', await pg.evaluate(() => VW === 'anomalias' && document.getElementById('vw-anomalias').classList.contains('on')));
  await pg.click('#tb-anom tbody tr:nth-child(2) td:nth-child(5)'); await pg.waitForTimeout(500);
  t('clique no resto da linha também abre a placa', await pg.evaluate(() => VW === 'placa'));
  t('mês com anomalia tem "Corrigir o mês"', await pg.evaluate(() => document.querySelector('#hm-2026-06 [data-mes]') != null));
  await pg.click('#hm-2026-06 [data-mes]'); await pg.waitForTimeout(400);
  t('texto explicativo embaixo da tabela', await pg.evaluate(() => { const c = document.getElementById('pe-anom'); return c.previousElementSibling.id === 'tab-anom' && /35%/.test(c.textContent); }));
  // caixa (pelo "Corrigir o mês" da visão da placa)
  t('caixa abre com a placa e o mês', /ABC1323 · jun\/26/.test(await txt(pg, '#m-tit')), await txt(pg, '#m-tit'));
  const ab = await pg.evaluate(() => [...document.querySelectorAll('#m-ab tbody tr')].map(r => [r.className, r.cells[4].textContent, r.cells[4].className]));
  t('abastecimentos do mês + o último do mês anterior', ab.length === 5 && ab[0][0] === 'ant', JSON.stringify(ab));
  t('Δ hodômetro entre os diesel; negativo em vermelho', ab[1][1] === '310' && /alerta/.test(ab[3][2]) && ab[2][0] === 'fora', JSON.stringify(ab.map(x => x[1])));
  t('sugestão de km esperado', /Km esperado: 3\.558/.test(await txt(pg, '#m-sug')), await txt(pg, '#m-sug'));
  await pg.click('#m-sug button:first-child');
  t('resultado recalcula o Km/L', /3\.558 km · 1\.289 L · 2,76 km\/L/.test(await txt(pg, '#m-res')), await txt(pg, '#m-res'));
  await pg.fill('#c-mot', 'hodômetro digitado errado na OS4');
  await pg.click('#b-salva'); await pg.waitForTimeout(400);
  const GC = gravacoes.filter(x => !x[0].startsWith('os'));
  const g = GC[0] || [];
  t('salvar grava a correção com o ERP ao lado', g[0] === 'upsert' && g[1].km === 3558 && g[1].litros == null && g[1].km_erp === 910 && g[1].status === 'corrigido' && g[1].autor === 'RENAN FORTES' && g[1].chave === 'ROTA - CGR|2026-06|ABC1D23', JSON.stringify(g[1]));
  t('sai da lista Em aberto', (await txt(pg, '#k-ab')).trim() === '3' && (await txt(pg, '#k-cor')).trim() === '1');
  await pg.evaluate(() => setVw('correcoes'));
  t('aparece em Correções com ERP → corrigido', /910 → 3\.558/.test(await txt(pg, '#tb-corr tbody')), await txt(pg, '#tb-corr tbody'));
  // marcar como certa e desfazer
  await pg.evaluate(() => abreCaixa('ROTA - CBA|2026-09|MNO3P45')); await pg.waitForTimeout(200);
  await pg.click('#b-ok'); await pg.waitForTimeout(300);
  t('Está correto grava status correto, sem números', (x => x && x[1].status === 'correto' && x[1].km == null)(gravacoes.filter(x => !x[0].startsWith('os'))[1]));
  await pg.evaluate(() => abreCaixa('ROTA - CBA|2026-09|MNO3P45')); await pg.waitForTimeout(200);
  await pg.click('#b-desf'); await pg.waitForTimeout(300);
  t('Desfazer apaga a correção', (x => x && x[0] === 'delete')(gravacoes.filter(x => !x[0].startsWith('os'))[2]) && (await txt(pg, '#k-ab')).trim() === '3');
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

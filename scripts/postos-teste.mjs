// Postos (/combustivel/postos/): abre o painel no Chromium com o banco dublado
// (abast_api, as APIs Pró-Frotas · SUMA · Gasola, com teto de 1.000 linhas por
// leitura) e confere cards, gráfico dia a dia com o toggle, tabela por posto
// ordenada pelo R$/L, filtros (Sistema incluso), preço absurdo pelo mediano,
// abastecimento inválido fora, projeto pela placa (Ginfo) e telas sem rolagem.
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
// ERP de antes → linhas da abast_api (a mesma conta). Inválidos: CAL/TER (o servidor filtra valido=true).
const SIS = ['PROFROTAS', 'GASOLA'];
// hodômetro: +300 km por abastecimento de diesel de cada placa (100 L → 3,00 km/L); o absurdo sem hodômetro
const HOD = {};
const A = L.map((x, i) => {
  const hod = /^x4$/.test(x.ordem_servico) ? null : x.tipo_combustivel === 'ARLA 32' ? 1 : (HOD[x.placa] = (HOD[x.placa] || 10000) + 300);
  const suf = (x.projeto_os.match(/-\s*([A-Z]+)$/) || [])[1];
  const uni = suf === 'GOI' ? 'GNA' : suf;
  return { sistema: SIS[i % 2], id_origem: x.ordem_servico, item: 1, dia: x.data, unidade: uni, placa: x.placa, placa_origem: x.placa,
    produto: x.tipo_combustivel, litros: x.litros, valor: x.valor, posto: x.posto, cnpj_posto: x.cnpj_posto, hodometro: hod,
    valido: !/^(OPERACIONAL|TERCEIROS)/.test(x.projeto_os) };
});
// tanque interno (SUMA) sem nome de posto, em CGR
for (let d = 1; d <= 3; d++) A.push({ sistema: 'SUMA', id_origem: 'AB' + d, item: 1, dia: `2026-10-0${d}`, unidade: 'CGR', placa: 'SUM0001', placa_origem: 'SUM0001',
  produto: 'DIESEL S10', litros: 200, valor: 200 * 5.5, posto: null, cnpj_posto: '55555555000155', valido: true });
const AV = A.filter(x => x.valido);
// Ginfo: placa → projeto
const GINFO = [...new Set(L.map(x => x.placa))].map(pl => ({ Placa: pl, Projeto: (L.find(x => x.placa === pl).projeto_os || '').split(' - ')[0] }));
const TETO = 1000;
let leituras = 0;

async function cenario({ vp = { width: 1366, height: 768 }, tema = 'dark', semPosto = false, admin = true } = {}) {
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
    if (p.includes('/rest/v1/fca_profiles')) return r.fulfill({ status: 200, body: JSON.stringify({ is_admin: admin }), contentType: 'application/json', headers: hd });
    if (p.includes('/rest/v1/ginfo_snapshot')) return r.fulfill({ status: 200, body: JSON.stringify({ data: GINFO }), contentType: 'application/json', headers: hd });
    if (p.includes('/rest/v1/abast_api_base')) return r.fulfill({ status: 200, body: JSON.stringify([{ sistema: 'PROFROTAS', carregado_em: '2026-10-28T09:10:00Z', erro: null }, { sistema: 'SUMA', carregado_em: '2026-10-28T09:12:00Z', erro: null }]), contentType: 'application/json', headers: hd });
    if (p.includes('/rest/v1/abast_api')) {
      const sel = u.searchParams.get('select') || '';
      if (semPosto) return r.fulfill({ status: 404, body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.abast_api' in the schema cache" }), contentType: 'application/json', headers: hd });
      if (u.searchParams.get('valido') !== 'eq.true') return r.fulfill({ status: 400, body: '{"message":"sem filtro valido"}', contentType: 'application/json', headers: hd });
      leituras++;
      let off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || TETO);
      const rg = h['range']; if (rg) { const mm = rg.match(/(\d+)-(\d+)/); if (mm) { off = +mm[1]; lim = +mm[2] - off + 1; } }
      lim = Math.min(lim, TETO);
      const cols = sel.split(',');
      const fatia = AV.slice(off, off + lim).map(x => Object.fromEntries(cols.map(c => [c, x[c] ?? null])));
      return r.fulfill({ status: 200, body: JSON.stringify(fatia), contentType: 'application/json', headers: { ...hd, 'Content-Range': `${off}-${off + fatia.length - 1}/${AV.length}` } });
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
  await pg.waitForFunction(() => /APIs/.test(document.getElementById('titSub').textContent) || /Erro|não existe/.test(document.getElementById('titSub').textContent) || document.querySelector('#gate .gate'), null, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { b, pg, erros };
}
const txt = (pg, s) => pg.locator(s).first().textContent();
const num = s => +String(s).replace(/[^\d,-]/g, '').replace(',', '.');

{
  const { b, pg, erros } = await cenario();
  t('sem erro de página', !erros.length, erros.join(' | '));
  t('leu tudo em páginas de 1.000', leituras >= Math.ceil(AV.length / TETO), `${leituras} leituras`);
  t('subtítulo diz APIs e a hora de cada carga', /APIs · Pró-Frotas 28\/10 06:10 · SUMA 28\/10 06:12/.test(await txt(pg, '#titSub')), await txt(pg, '#titSub'));
  t('abre em OUT/26 (último mês com abastecimento)', /^OUT\/26/.test(await txt(pg, '#titSub')), await txt(pg, '#titSub'));
  t('combustível abre só nos diesel', await pg.evaluate(() => [...document.getElementById('ms-comb')._sel].join() === 'DIESEL S10'));
  // out/26: 20 dias × 27 abast. × 100 L + GNA 100 L + preço absurdo 100 L + SUMA 3 × 200 L
  const lit = num(await txt(pg, '#k-lit'));
  t('litros de out/26 (54.000 + GNA + o absurdo + SUMA)', lit === 54800, String(lit));
  const val = num(await txt(pg, '#k-val'));
  t('valor sem o R$ 1,49 bi (preço absurdo pelo mediano)', val > 340000 && val < 365000, String(val));
  t('abastecimento inválido não entra', !(await pg.evaluate(() => ROWS.some(r => r.placa === 'CAL0001' || r.placa === 'TER0001'))));
  t('projeto pela placa (Ginfo)', await pg.evaluate(() => ROWS.some(r => r.proj === 'ROTA') && ROWS.some(r => r.proj === 'EMPURRADA')));
  t('SUMA sem nome vira Tanque interno · CGR', await pg.evaluate(() => ROWS.some(r => r.sis === 'SUMA' && r.posto === 'Tanque interno · CGR')));
  t('filtro Sistema lista os três', await pg.evaluate(() => document.getElementById('ms-sis')._itens.join() === 'GASOLA,PROFROTAS,SUMA'));
  await pg.evaluate(() => { const w = document.getElementById('ms-sis'); w._sel = new Set(['SUMA']); render(); });
  t('filtro Sistema = SUMA', num(await txt(pg, '#k-lit')) === 600, await txt(pg, '#k-lit'));
  await pg.evaluate(() => { document.getElementById('ms-sis')._sel = new Set(); render(); });
  t('GOI vira GNA', await pg.evaluate(() => ROWS.some(r => r.uni === 'GNA')));
  t('três cards: Valor, Litros, Preço', await pg.locator('#vw-resumo .kpi').count() === 3);
  t('MoM do R$/L em vermelho quando sobe', await pg.locator('#k-rl-m b.cr').count() === 1, await txt(pg, '#k-rl-m'));
  // tabela: ordem e colunas
  const cab = await pg.locator('#tb-postos thead th').allTextContents();
  t('colunas na ordem pedida', cab.join('|') === 'Posto|Valor abastecido|Litros|R$/L', cab.join('|'));
  const nomes = await pg.locator('#tb-postos tbody td.posto').allTextContents();
  t('do menor para o maior R$/L (tanque interno a 5,50 primeiro)', nomes[0] === 'Tanque interno · CGR' && nomes[1] === 'POSTO BARATO LTDA' && nomes.indexOf('POSTO CARO') === nomes.length - 1, nomes.join(' · '));
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
  await pg.evaluate(() => { document.getElementById('ms-comb')._auto = true; montaFiltros(); render(); });
  // Km/L: out/26, cada abastecimento regular com o anterior da placa (setembro) → 54.000 L e 162.000 km
  await pg.evaluate(() => setVw('kml')); await pg.waitForTimeout(200);
  t('Km/L: km rodado de out/26', num(await txt(pg, '#k-km')) === 162000, await txt(pg, '#k-km'));
  t('Km/L: litros com km (sem SUMA sem hodômetro, sem o 1º da GNA, sem o absurdo)', num(await txt(pg, '#k-kl')) === 54000, await txt(pg, '#k-kl'));
  t('Km/L = 3,00', (await txt(pg, '#k-kml')) === '3,00', await txt(pg, '#k-kml'));
  t('gráfico Km/L por mês com set e out (out em foco)', await pg.evaluate(() => charts.kml && charts.kml.data.labels.join() === 'set/26,out/26' && /,\.85\)/.test(charts.kml.data.datasets[0].backgroundColor[1]) && /,\.2\)/.test(charts.kml.data.datasets[0].backgroundColor[0])));
  t('set/26: 1º abastecimento de cada placa fica fora', await pg.evaluate(() => { const d = charts.kml.data.datasets[0].data; return Math.abs(d[0] - 3) < 1e-9; }));
  await pg.evaluate(() => setVw('kmld')); await pg.waitForTimeout(150);
  const cabK = await pg.locator('#tb-kml thead th').allTextContents();
  t('Km/L Detalhado: colunas', cabK.join('|') === 'Unidade|Projeto|Km rodado|Litros com km|Km/L|Abastec.|Litros sem km', cabK.join('|'));
  t('Km/L Detalhado: linha Total e litros sem km da SUMA/GNA/absurdo', /^800$/.test((await pg.locator('#tb-kml tr.total td').nth(6).textContent()).replace(/\D/g, '')), await pg.locator('#tb-kml tr.total').textContent());
  await pg.click('#dims-kml .dimb[data-q="placa"]'); await pg.waitForTimeout(150);
  t('Km/L Detalhado por Placa', (await pg.locator('#tb-kml thead th').allTextContents()).includes('Placa') && await pg.locator('#tb-kml tbody tr').count() > 50);
  t('Km/L sem gráfico na visão da tabela e sem tabela na do gráfico', await pg.evaluate(() => !document.querySelector('#vw-kmld canvas') && !document.querySelector('#vw-kml table')));
  await pg.evaluate(() => setVw('preco')); await pg.waitForTimeout(150);
  t('Preço: R$/L igual ao do Resumo', (await txt(pg, '#p-rl')) === (await txt(pg, '#k-rl')) && (await txt(pg, '#p-lit')) === (await txt(pg, '#k-lit')), await txt(pg, '#p-rl'));
  t('Preço: gráfico por mês com set e out', await pg.evaluate(() => charts.preco && charts.preco.data.labels.join() === 'set/26,out/26'));
  await pg.evaluate(() => setVw('precod')); await pg.waitForTimeout(150);
  const cabP = await pg.locator('#tb-preco thead th').allTextContents();
  t('Preço Detalhado: colunas', cabP.join('|') === 'Unidade|Projeto|Valor abastecido|Litros|R$/L|Abastec.|Postos', cabP.join('|'));
  t('Preço Detalhado: total bate com o card', num(await pg.locator('#tb-preco tr.total td').nth(3).textContent()) === num(await txt(pg, '#k-lit')));
  t('nome do painel', (await pg.title()) === 'Integração Abastecimentos · Gestão em Movimento' && /Integração Abastecimentos/.test(await txt(pg, '.s-top b')));
  await pg.evaluate(() => setVw('resumo'));
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
  await pg.evaluate(() => setVw('kml')); await pg.waitForTimeout(200);
  const m3 = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1, gh: Math.round(document.getElementById('ch-kml').getBoundingClientRect().height) }));
  t(`${w}×${h} ${tema}: Km/L sem rolagem, gráfico com altura`, !m3.pag && !m3.vw && m3.gh > 250, JSON.stringify(m3));
  if (SHOT && w === 1920) { await pg.waitForTimeout(1200); await pg.screenshot({ path: join(SHOT, `kml-${w}-${tema}.png`) }); }
  await pg.evaluate(() => setVw('preco')); await pg.waitForTimeout(200);
  const m5 = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1, gh: Math.round(document.getElementById('ch-preco').getBoundingClientRect().height) }));
  t(`${w}×${h} ${tema}: Preço sem rolagem, gráfico com altura`, !m5.pag && !m5.vw && m5.gh > 250, JSON.stringify(m5));
  if (SHOT && w === 1920) { await pg.waitForTimeout(1200); await pg.screenshot({ path: join(SHOT, `preco-${w}-${tema}.png`) }); }
  for (const q of ['up', 'placa']) {
    await pg.evaluate(q => { setVw('precod'); document.querySelector(`#dims-preco .dimb[data-q="${q}"]`).click(); }, q); await pg.waitForTimeout(150);
    const m6 = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1, hx: document.querySelector('#tab-preco').scrollWidth > document.querySelector('#tab-preco').clientWidth + 1 }));
    t(`${w}×${h} ${tema}: Preço Detalhado (${q}) sem rolagem de página, tabela sem barra lateral`, !m6.pag && !m6.vw && !m6.hx, JSON.stringify(m6));
  }
  for (const q of ['up', 'placa']) {
    await pg.evaluate(q => { setVw('kmld'); document.querySelector(`#dims-kml .dimb[data-q="${q}"]`).click(); }, q); await pg.waitForTimeout(150);
    const m4 = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight > innerHeight + 1, vw: document.querySelector('.vw.on').scrollHeight > document.querySelector('.vw.on').clientHeight + 1, hx: document.querySelector('#tab-kml').scrollWidth > document.querySelector('#tab-kml').clientWidth + 1 }));
    t(`${w}×${h} ${tema}: Km/L Detalhado (${q}) sem rolagem de página, tabela sem barra lateral`, !m4.pag && !m4.vw && !m4.hx, JSON.stringify(m4));
    if (SHOT && w === 1920 && q === 'placa') await pg.screenshot({ path: join(SHOT, `kmld-${w}-${tema}.png`) });
  }
  await b.close();
}
{
  const { b, pg, erros } = await cenario({ admin: false });
  t('quem não é admin cai no gate', !erros.length && /só para administradores/.test(await txt(pg, '#gate')), await txt(pg, '#gate'));
  await b.close();
}
{
  const { b, pg, erros } = await cenario({ semPosto: true });
  t('sem a tabela abast_api: avisa para rodar o SQL', !erros.length && /abast_api ainda não existe/.test(await txt(pg, '#titSub')), await txt(pg, '#titSub'));
  await b.close();
}
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

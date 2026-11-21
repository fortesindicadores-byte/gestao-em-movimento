// Teste da visão Árvore do Custo do /arvores/ no Chromium, com o banco, o FT e a aba dublados
// e números conhecidos. Uso: SBJS=<supabase-js UMD> [SHOT_DIR=…] node scripts/arvores-custo-teste.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs'; import path from 'node:path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SBJS = process.env.SBJS || '', SHOT = process.env.SHOT_DIR || '';
if (!SBJS) { console.error('SBJS = caminho do supabase-js UMD'); process.exit(2); }
const srv = createServer((q, r) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]));
  try { const b = fs.readFileSync(f.endsWith('/') ? f + 'index.html' : f); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(b); } catch (e) { r.writeHead(404); r.end(); } });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;

// ── DRE: out/26 e set/26 (Terceiros fica fora do recorte) ──
const dre = (vig, nv3, real, orc, rem = orc) => ({ vigencia: vig.slice(5, 7) + '/' + vig.slice(0, 4), vigencia_orig: vig, nivel_3: nv3, realizado: real, orcado: orc, remunerado: rem, linha: 1 });
const REC = [dre('2026-10-01', 'ROTA - CGR', 3000000, 2900000, 3100000), dre('2026-10-01', 'APOIO - CBA', 1000000, 1000000), dre('2026-10-01', 'AUTO SERVIÇO - GOI', 400000, 400000),
  dre('2026-10-01', 'TERCEIROS - BLC', 500000, 500000), dre('2026-09-01', 'ROTA - CGR', 2800000, 2800000)];
const EBD = [dre('2026-10-01', 'ROTA - CGR', 800000, 700000, 850000), dre('2026-10-01', 'APOIO - CBA', 200000, 200000), dre('2026-10-01', 'AUTO SERVIÇO - GOI', 70000, 70000),
  dre('2026-10-01', 'TERCEIROS - BLC', 90000, 90000), dre('2026-09-01', 'ROTA - CGR', 700000, 700000)];
// aba Frota do DRE (despesa negativa): CGR Rota out/26 · R$/km rem. = (30 + 10 + 2 mil) ÷ 20.700 km
const fr = (nv3, conta, real, orc, rem) => ({ vigencia: '10/2026', vigencia_orig: '2026-10-01', nivel_3: nv3, conta_gerencial: conta, realizado: real, orcado: orc, remunerado: rem, linha: 1 });
const FRT = [fr('ROTA - CGR', 'Combustíveis Veículos e Equipamentos', -33000, -31000, -30000), fr('ROTA - CGR', 'Manutenção de Veículos e Equipamentos', -9000, -10000, -10000),
  fr('ROTA - CGR', 'Pneus Novos', -2500, -2000, -2000), fr('ROTA - CGR', 'Seguro de Veículos e Equipamentos', -1000, -1000, -1000),
  fr('ROTA - CGR', 'Lavação de Veículos', -600, -500, -500)];
const DG = [{ ano: 2026, mes: 10, cod_dre: '351', projeto: 'Rota - CGR', realizado: -180000 }, { ano: 2026, mes: 10, cod_dre: '351', projeto: 'Apoio - CBA', realizado: -4000 },
  { ano: 2026, mes: 10, cod_dre: '351', projeto: 'Auto Serviço - GOI', realizado: -10000 }];
// ── FT: capital (serial do Excel: 45566 = 01/10/2024 · 42370 = 01/01/2016 · 45931 = 01/10/2025 · 45945 = 15/10/2026 (aprox.)) ──
const serial = d => Math.round((Date.UTC(...d) - Date.UTC(1899, 11, 30)) / 864e5);
const CAM = ['Unidade - Nome', 'Placa', 'Ativo', 'Data de Entrada', 'Valor de Compra Cavalo', 'Valor de Compra Carroceria', 'Manutenção R$/KM', 'manutencaoVidaMeses', 'freeMaintenance'];
const LAY = [], LIN = [];
for (const m of [9, 10]) {
  LAY.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, colunas: CAM });
  LIN.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, unidade: 'CDD RIO DE JANEIRO', dados: ['CDD RIO DE JANEIRO', 'AAA1A11', true, serial([2024, 9, 1]), 4000000, 1000000, 0.4, 25, 6] });
  LIN.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, unidade: 'CDD RIO DE JANEIRO', dados: ['CDD RIO DE JANEIRO', 'BBB2B22', false, serial([2016, 0, 1]), 3000000, 0, 0, 120, 6] });
}
LAY.push({ canal: 'ARMAZEM', tabela: 'EmpilhadeiraApoio', vigencia: 'ARMAZEM_1_10_2026', colunas: ['Unidade - Nome', 'chassi', 'ativoParado', 'mesanoEntrada', 'valorCompraNf', 'implementoValorImplemento'] });
LIN.push({ canal: 'ARMAZEM', tabela: 'EmpilhadeiraApoio', vigencia: 'ARMAZEM_1_10_2026', unidade: 'CUIABA', dados: ['CUIABA', 'X1', true, serial([2025, 9, 1]), 1000000, 0] });
LAY.push({ canal: 'AS', tabela: 'CaminhaoAS', vigencia: 'AS_2_10_2026', colunas: CAM });
LIN.push({ canal: 'AS', tabela: 'CaminhaoAS', vigencia: 'AS_2_10_2026', unidade: 'CDD GOIANIA', dados: ['CDD GOIANIA', 'CCC3C33', true, serial([2026, 9, 15]), 2000000, 0, 0, 1, 6] });
// parâmetros do FT para a revisão (km mensal da 1ª viagem: 2500 na 1ª quinzena, 2625 na 2ª)
for (const q of [1, 2]) {
  LAY.push({ canal: 'ROTA', tabela: 'ParametrosGeraisRota', vigencia: `ROTA_${q}_10_2026`, ano: 2026, colunas: ['Unidade - Nome', 'KM Mensal Primeira Viagem', 'kmMensalRemuneradoVan'] });
  LIN.push({ canal: 'ROTA', tabela: 'ParametrosGeraisRota', vigencia: `ROTA_${q}_10_2026`, ano: 2026, unidade: 'CDD RIO DE JANEIRO', dados: ['CDD RIO DE JANEIRO', q === 1 ? 2500 : 2625, 0] });
}
// ── aba Dispersão de km: CGR Rota out/26 ──
const L = (m, pc) => { const c = Array.from({ length: 33 }, () => null); c[0] = { v: `Date(2026,${m - 1},1)` }; c[14] = { v: pc };
  c[21] = { v: 10 }; c[22] = { v: 200 }; c[23] = { v: 100 }; c[25] = { v: 10 }; c[27] = { v: 300 }; c[28] = { v: 5 }; c[30] = { v: 400 }; c[31] = { v: 20700 }; c[32] = { v: 22000 }; return { c }; };
// Van de CGR em out/26: 2 ativos · 40 mapas × 50 km = 2.000 km rem · 2.600 rodados (+600)
const V = (m, pc) => { const c = Array.from({ length: 33 }, () => null); c[0] = { v: `Date(2026,${m - 1},1)` }; c[14] = { v: pc };
  c[21] = { v: 2 }; c[22] = { v: 40 }; c[23] = { v: 50 }; c[31] = { v: 2000 }; c[32] = { v: 2600 }; return { c }; };
const ABA = { status: 'ok', table: { cols: Array.from({ length: 33 }, (_, i) => ({ id: 'c' + i, label: '' })), rows: [L(10, 'ROTA - CGR'), L(9, 'ROTA - CGR'), V(10, 'ROTA (VAN) - CGR')] } };
// km rodado por placa (aba Km/L do consumo): a abertura por placa
const K1 = (projeto, placa, km, lit, tot, med, mod) => ({ vigencia: '10/2026', projeto, placa, modelo: 'VW', tipo_combustivel: 'DIESEL S10', km_rodado_horas_trabalhadas: km, qtd_total_de_litros: lit, totas_rs: tot, km_l_rem_medio: med, km_l_rem_modelo: mod });
const KML = [K1('ROTA - CGR', 'AAA1111', 12000, 4000, 24000, 3.2, 3.0), K1('ROTA - CGR', 'BBB2B22', 10000, 3500, 21700, 3.4, 3.4), K1('VAN - CGR', 'VAN0A01', 2600, 520, 3120, 6, 6)];
const RSL = [{ unidade_benner: 'ROTA - CGR', vigencia_data_3: '2026-10-01', precooperadora: 5.8, precoanp: 6.0, tipocombustivelshared: 'tipoCombustivel: DIESEL S10' }];
const FTM = [{ operacao: 'ROTA', unidade: 'CGR', vigencia: '2026-10', comb: 28000, manut: 9500, pneu: 1800, seguro: 900, km_teto: 25000 }];
const CARTA = [['Motor', 3000, 'Oficina A'], ['Freios', 1000, 'Oficina B'], ['Motor', 500, 'Oficina A']].map(([grupo, valor, fornecedor], i) => ({ id: i + 1, unidade: 'CGR', vigencia: '2026-10', projeto: 'ROTA', conta: 'Manutenção de Veículos e Equipamentos', grupo, valor, fornecedor, equipamento: 'AAA1A11', nf: i < 2 ? 'NF' + i : '', rc: 'RC', oc: 'OC', data: '2026-10-05', created_at: '2026-10-05' }));
const ANOM = [{ ym: '2026-10', unidade: 'CGR', projeto: 'ROTA - CGR', situacao: 'erro', impacto_rs: 800, impacto_l: 130 }, { ym: '2026-10', unidade: 'CGR', projeto: 'ROTA - CGR', situacao: 'ajustado', impacto_rs: 200, impacto_l: 30 }];
const GEROT = `window.GerotBase={FIL2COD:{'CDD RIO DE JANEIRO':'CGR','CDD GOIANIA':'GNA'},load:async()=>[
  {field:'sla',unit:'CDD RIO DE JANEIRO',vig:'10/2026',real:60,meta:75},{field:'prev',unit:'CDD RIO DE JANEIRO',vig:'10/2026',real:90,meta:100},
  {field:'disp',unit:'CDD RIO DE JANEIRO',vig:'10/2026',real:96,meta:95},{field:'mttr',unit:'CDD RIO DE JANEIRO',vig:'10/2026',real:36000,meta:28800},
  {field:'pneus',unit:'CDD RIO DE JANEIRO',vig:'10/2026',real:97,meta:100}]};`;

const filtraBase = (rows, q) => rows.filter(r => [...q.entries()].every(([k, v]) => {
  if (['select', 'order', 'offset', 'limit'].includes(k) || !(k in (rows[0] || {})) && !['ano'].includes(k)) return true;
  const val = String(r[k] ?? ''); const [op, ...rest] = v.split('.'); const arg = rest.join('.');
  if (op === 'eq') return val === arg; if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(val);
  if (op === 'gte') return val >= arg; return true; }));
const filtra = (rows, q) => filtraBase(rows, q);

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let ok = 0, fa = 0; const af = (n, c, d = '') => { if (c) ok++; else { fa++; console.log('FALHA', n, d); } };
for (const [w, h, tema] of [[1366, 768, 'dark'], [1920, 1080, 'light']]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1, 3).join(' ')));
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await pg.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: fs.readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/assets\/(gviz-cache|build-check)\.js/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/assets\/gerot-base\.js/, r => r.fulfill({ status: 200, body: GEROT, contentType: 'application/javascript' }));
  await pg.route(/api\.bcb\.gov\.br/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ data: '01/10/2026', valor: '4,50' }]) }));
  await pg.route(/docs\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `google.visualization.Query.setResponse(${JSON.stringify(ABA)})` }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()), p = u.pathname, json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: true });
    const t = p.split('/rest/v1/')[1]; if (+(u.searchParams.get('offset') || 0) > 0) return json([]);
    const T = { sh_dre_receita: REC, sh_dre_ebitda: EBD, sh_dre_frota: FRT, dre_gerencial: DG, ft_layout: LAY, ft_linha: LIN, sh_consumo_km_litro: KML,
      sh_consumo_rs_litro: RSL, ft_rem_mes: FTM, carta_custos: CARTA, comb_anomalia: ANOM };
    return json(T[t] ? filtra(T[t], u.searchParams) : []);
  });
  await pg.addInitScript(t0 => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0);
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, tema);
  await pg.goto(BASE + '/arvores/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => /Freightech/.test(document.getElementById('titSub').textContent), null, { timeout: 20000 }).catch(() => {});
  const um = w === 1366;
  // tudo aberto até o fim do combustível e da manutenção
  const abre = ids => pg.evaluate(ids0 => { ids0.forEach(i => CT_AB.add(i)); setVw('custo'); }, ids);
  const espera = () => pg.waitForFunction(() => !/carregando/.test(document.getElementById('titSub').textContent) && document.querySelectorAll('#arv-custo .tn').length > 2, null, { timeout: 15000 }).catch(() => {});
  await pg.evaluate(() => { CT_AB.clear(); CT_AB.add('tot'); setVw('custo'); }); await espera(); await pg.waitForTimeout(500);
  const nos = () => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#arv-custo .tn')].map(n => [n._no.id || n._no.t, { t: n._no.t, v: n.querySelector('.tn-v').textContent, cls: n.className,
    g: [...n.querySelectorAll('.tn-g b')].map(b => b.textContent), i: (n.querySelector('.tn-i') || {}).textContent || '', rows: [...n.querySelectorAll('td')].map(t => t.textContent).join('|'), s: (n.querySelector('.tn-s') || {}).textContent || '' }])));
  let N = await nos(); if (um) console.log(JSON.stringify(Object.keys(N)));
  af('abre no custo total com os 4 pacotes', N.tot && N['p:C'] && N['p:M'] && N['p:P'] && N['p:O'] && Object.keys(N).length === 5, JSON.stringify(Object.keys(N)));
  af('custo total R$ 46 mil contra o remunerado R$ 44 mil (▲ +2.600)', N.tot && N.tot.v === 'R$ 46 mil' && N.tot.g[0] === 'R$ 44 mil' && N.tot.g[1] === '+R$ 2.600' && /gap\b/.test(N.tot.cls), JSON.stringify(N.tot));
  const ftTot = await pg.evaluate(() => ctFT(['2026-10'], () => true, ['comb', 'manut', 'carroc', 'pneu', 'lavagem_var', 'lavagem', 'seguro', 'ipva'])); if (um) console.log('FT', ftTot);
  af('FT ao lado do custo total: R$ 33.440', N.tot && /Pago FT \(reconstr\.\)\|R\$ 33 mil\|Real − FT\|\+R\$ 13 mil/.test(N.tot.rows) && Math.abs(await pg.evaluate(() => ctFT(['2026-10'], () => true, ['comb', 'manut', 'carroc', 'pneu', 'lavagem_var', 'lavagem', 'seguro', 'ipva'])) - 33440.4) < 0.5, N.tot && N.tot.rows);
  af('subtítulo diz a referência', /referência: remunerado, com o FT ao lado/.test(await pg.evaluate(() => document.getElementById('titSub').textContent)), await pg.evaluate(() => document.getElementById('titSub').textContent));
  // clique abre o pacote
  const clica = async (id, sel) => { const c = await pg.evaluate(([i, s]) => { const n = [...document.querySelectorAll('#arv-custo .tn')].find(x => x._no.id === i); const e = s ? n.querySelector(s) : n; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(10, r.height / 2) }; }, [id, sel]); await pg.mouse.click(c.x, c.y); await pg.waitForTimeout(250); };
  await clica('p:C'); await pg.waitForTimeout(300); N = await nos();
  af('clique no pacote abre as contas', N['c:COMB'] && N['c:COMB'].v === 'R$ 33 mil', JSON.stringify(Object.keys(N)));
  af('conta diesel: rem R$ 30.000 · ▲ +R$ 3.000 · FT R$ 23.184', N['c:COMB'] && N['c:COMB'].g.join('|') === 'R$ 30 mil|+R$ 3.000|+10,0%' && /Pago FT \(reconstr\.\)\|R\$ 23 mil\|Real com o Arla − FT\|\+R\$ 9.816/.test(N['c:COMB'].rows), JSON.stringify(N['c:COMB']));
  await clica('p:C'); await pg.waitForTimeout(300); N = await nos(); af('clique de novo recolhe', !N['c:COMB'], JSON.stringify(Object.keys(N)));
  // com zoom, abrir e recolher mantém a escala e o nó clicado no mesmo lugar
  const vista = () => pg.evaluate(() => { const tw = document.querySelector('#arv-custo .tw'), m = /scale\(([\d.]+)\)/.exec(tw.style.transform);
    const n = [...document.querySelectorAll('#arv-custo .tn')].find(x => x._no.id === 'p:C').getBoundingClientRect(); return { s: +m[1], x: Math.round(n.left), y: Math.round(n.top + n.height / 2) }; });
  const fit0 = await vista();
  await pg.click('#arv-custo .arv-zoom [data-z="+"]'); await pg.click('#arv-custo .arv-zoom [data-z="+"]'); await pg.waitForTimeout(150);
  const z0 = await vista(); await clica('p:C'); await pg.waitForTimeout(300); const z1 = await vista();
  af('com zoom, abrir o + mantém a escala e o nó no lugar', Math.abs(z1.s - z0.s) < 1e-6 && Math.abs(z1.x - z0.x) <= 1 && Math.abs(z1.y - z0.y) <= 1 && z0.s > fit0.s * 1.5, JSON.stringify({ fit0, z0, z1 }));
  await clica('p:C'); await pg.waitForTimeout(300); const z2 = await vista();
  af('com zoom, recolher também mantém', Math.abs(z2.s - z0.s) < 1e-6 && Math.abs(z2.x - z0.x) <= 1 && Math.abs(z2.y - z0.y) <= 1, JSON.stringify({ z0, z2 }));
  await pg.click('#arv-custo .arv-zoom [data-z="0"]'); await pg.waitForTimeout(150);
  await clica('p:C'); await pg.waitForTimeout(300); const f1 = await vista(); await clica('p:C'); await pg.waitForTimeout(300);
  af('sem zoom (Ajustar), abrir volta a caber inteira', Math.abs(f1.s - fit0.s) > 1e-6 || f1.s <= fit0.s + 1e-6, JSON.stringify({ fit0, f1 }));
  // Abrir tudo e Recolher, no canto do zoom
  await pg.click('#arv-custo .arv-zoom [data-x="tudo"]'); await espera(); await pg.waitForTimeout(500); N = await nos();
  af('Abrir tudo abre todos os nós', N['c:COMB|rk|kml|plab'] && N['c:MANV|rk|ind|resp|sla'] && Object.keys(N).length > 60, Object.keys(N).length);
  af('Abrir tudo cabe a árvore inteira na tela', await pg.evaluate(() => { const a = document.getElementById('arv-custo').getBoundingClientRect(); return [...document.querySelectorAll('#arv-custo .tn')].every(n => { const r = n.getBoundingClientRect(); return r.top >= a.top - 1 && r.bottom <= a.bottom + 1; }); }));
  await pg.click('#arv-custo .arv-zoom [data-x="nada"]'); await pg.waitForTimeout(500); N = await nos();
  af('Recolher volta ao custo total com os pacotes', Object.keys(N).length === 5 && N['p:C'], JSON.stringify(Object.keys(N)));
  await clica('p:C'); await pg.waitForTimeout(300);
  af('o que está aberto não fica guardado no navegador', await pg.evaluate(() => localStorage.getItem('arvores_ct_abertos') === null));
  // combustível aberto até o fim
  await abre(['p:C', 'c:COMB', 'c:COMB|rk', 'c:COMB|rk|rsl', 'c:COMB|rk|kml', 'c:COMB|km']); await espera(); await pg.waitForTimeout(400); N = await nos();
  if (um) console.log(JSON.stringify(Object.fromEntries(Object.entries(N).filter(([k]) => /^c:COMB/.test(k)).map(([k, x]) => [k, [x.v, x.g.join(' '), x.i]]))));
  const km = N['c:COMB|km'], rk = N['c:COMB|rk'];
  af('Km: volume -R$ 2.511/mês', km && /-R\$ 2\.511\/mês/.test(km.i), km && km.i);
  af('R$/km: taxa -R$ 489/mês', rk && /-R\$ 489\/mês/.test(rk.i), rk && rk.i);
  const soma = await pg.evaluate(() => { const g = i => [...document.querySelectorAll('#arv-custo .tn')].find(x => x._no.id === i)._no.g.imp; return g('c:COMB|km') + g('c:COMB|rk'); });
  af('volume + taxa = ▲ da conta (-3.000)', Math.abs(soma + 3000) < 0.01, soma);
  af('R$/L: preço -R$ 2.304/mês', N['c:COMB|rk|rsl'] && /-R\$ 2\.304\/mês/.test(N['c:COMB|rk|rsl'].i), JSON.stringify(N['c:COMB|rk|rsl']));
  af('Km/L: eficiência -R$ 5.336/mês', N['c:COMB|rk|kml'] && /-R\$ 5\.336\/mês/.test(N['c:COMB|rk|kml'].i), JSON.stringify(N['c:COMB|rk|kml']));
  af('diferença DRE × bases -R$ 7.151', N['c:COMB|rk|dif'] && N['c:COMB|rk|dif'].v === '-R$ 7.151', JSON.stringify(N['c:COMB|rk|dif']));
  af('preço acima da ANP R$ 700', N['c:COMB|rk|rsl|anp'] && N['c:COMB|rk|rsl|anp'].v === 'R$ 700', JSON.stringify(N['c:COMB|rk|rsl|anp']));
  af('placas abaixo do modelo -R$ 3.744 (BBB e a van)', N['c:COMB|rk|kml|plab'] && N['c:COMB|rk|kml|plab'].v === '-R$ 3.744', JSON.stringify(N['c:COMB|rk|kml|plab']));
  af('régua do FT -R$ 1.592', N['c:COMB|rk|kml|regua'] && N['c:COMB|rk|kml|regua'].v === '-R$ 1.592', JSON.stringify(N['c:COMB|rk|kml|regua']));
  af('abastecimento com erro: 1 em aberto', N['c:COMB|rk|kml|anom'] && N['c:COMB|rk|kml|anom'].v === '1 em aberto' && /Ajustadas pelas APIs\|1/.test(N['c:COMB|rk|kml|anom'].rows), JSON.stringify(N['c:COMB|rk|kml|anom']));
  af('km abre na composição (1ª viagem, recarga, noturna)', N['c:COMB|km|rem'] && N['c:COMB|km|real'], JSON.stringify(Object.keys(N).filter(k => /km\|/.test(k))));
  // ⊞ abre a tabela por unidade e projeto
  await clica('c:COMB', '.tn-tab');
  const A = await pg.evaluate(() => ({ on: document.getElementById('ab-ov').classList.contains('on'), t: document.getElementById('ab-t').textContent, th: [...document.querySelectorAll('#ab-tab thead th')].map(x => x.textContent), tr: [...document.querySelectorAll('#ab-tab tbody tr')].map(r => [...r.cells].map(x => x.textContent)) }));
  if (um) console.log(JSON.stringify(A));
  af('⊞ abre a tabela da conta com o FT', A.on && A.t === 'Combustíveis (diesel)' && A.th.includes('Pago FT') && A.tr[0][0] === 'CGR' && A.tr[0][1] === 'Rota' && A.tr[0][3] === 'R$ 33 mil', JSON.stringify(A));
  await pg.keyboard.press('Escape');
  // manutenção: pago × gasto e indicadores
  await abre(['p:M', 'c:MANV', 'c:MANV|rk', 'c:MANV|rk|ftp', 'c:MANV|rk|gas', 'c:MANV|rk|ind', 'c:MANV|rk|ind|prev', 'c:MANV|rk|ind|resp', 'c:MANV|rk|ind|conf', 'c:MANV|rk|ind|comp']); await espera(); await pg.waitForTimeout(400); N = await nos();
  if (um) console.log(JSON.stringify(Object.fromEntries(Object.entries(N).filter(([k]) => /^c:MANV/.test(k)).map(([k, x]) => [k, [x.v, x.g.join(' '), x.s]]))));
  af('manutenção abaixo do remunerado fica verde', N['c:MANV'] && /gap-ok/.test(N['c:MANV'].cls), N['c:MANV'] && N['c:MANV'].cls);
  af('FT da manutenção com o contrato: +R$ 1.134', N['c:MANV'] && /Real com o contrato − FT\|\+R\$ 1\.134/.test(N['c:MANV'].rows), N['c:MANV'] && N['c:MANV'].rows);
  af('pago FT por placa: R$ 0,400 e 1 placa recebendo', N['c:MANV|rk|ftp'] && N['c:MANV|rk|ftp'].v === 'R$ 0,400' && /Placas recebendo\|1/.test(N['c:MANV|rk|ftp'].rows), JSON.stringify(N['c:MANV|rk|ftp']));
  af('Carta por grupo: Motor R$ 3.500 (78%)', N['c:MANV|rk|gas|grp'] && /Motor\|R\$ 3\.500 \(78%\)/.test(N['c:MANV|rk|gas|grp'].rows), JSON.stringify(N['c:MANV|rk|gas|grp']));
  af('SLA 60% contra a meta de 75%', N['c:MANV|rk|ind|resp|sla'] && N['c:MANV|rk|ind|resp|sla'].v === '60,0%' && /sinal/.test(N['c:MANV|rk|ind|resp|sla'].cls) && /gap\b/.test(N['c:MANV|rk|ind|resp|sla'].cls), JSON.stringify(N['c:MANV|rk|ind|resp|sla']));
  af('MTTR em horas (10,0 h)', N['c:MANV|rk|ind|resp|mttr'] && N['c:MANV|rk|ind|resp|mttr'].v === '10,0 h', JSON.stringify(N['c:MANV|rk|ind|resp|mttr']));
  af('ligação com poucos pontos avisa', N['c:MANV|rk|ind|resp|sla'] && /poucos pontos/.test(N['c:MANV|rk|ind|resp|sla'].s), N['c:MANV|rk|ind|resp|sla'] && N['c:MANV|rk|ind|resp|sla'].s);
  af('reincidência: 1 placa-grupo', N['c:MANV|rk|ind|conf|reinc'] && /^1 /.test(N['c:MANV|rk|ind|conf|reinc'].v), JSON.stringify(N['c:MANV|rk|ind|conf|reinc']));
  af('concentração de fornecedor 78%', N['c:MANV|rk|ind|comp|conc'] && N['c:MANV|rk|ind|comp|conc'].v === '78%', JSON.stringify(N['c:MANV|rk|ind|comp|conc']));
  // mista: lavação abre em duas leituras, cada uma fechando o ▲ da conta (−100)
  await abre(['c:LAV', 'c:LAV|lk', 'c:LAV|la']); await espera(); N = await nos();
  const mis = await pg.evaluate(() => { const g = i => { const n = [...document.querySelectorAll('#arv-custo .tn')].find(x => x._no.id === i); return n && n._no.g ? n._no.g.imp : null; };
    return { km: g('c:LAV|lk|km') + g('c:LAV|lk|rk'), at: g('c:LAV|la|ra') }; });
  af('lavação é mista: leitura por km e por ativo', N['c:LAV|lk'] && N['c:LAV|la'] && /lente/.test(N['c:LAV|lk'].cls), JSON.stringify(Object.keys(N).filter(k => /LAV/.test(k))));
  af('leitura por km fecha o ▲ da lavação (−100)', Math.abs(mis.km + 100) < 0.01, JSON.stringify(mis));
  af('leitura por ativo fecha o ▲ da lavação (−100)', Math.abs(mis.at + 100) < 0.01, JSON.stringify(mis));
  // fixo
  await abre(['p:O']); await espera(); N = await nos();
  const seg = Object.keys(N).find(k => /SEGURO/.test(k));
  await abre([seg]); await espera(); N = await nos();
  af('seguro é fixo: ativos e R$ por ativo, FT R$ 900', seg && N[seg + '|at'] && N[seg + '|ra'] && /Pago FT \(reconstr\.\)\|R\$ 900\|Real − FT\|\+R\$ 100/.test(N[seg].rows), JSON.stringify([seg, N[seg]]));
  // comparar com o FT
  await pg.click('#modo-custo [data-ccmp="ft"]'); await pg.waitForTimeout(400); N = await nos();
  af('contra o FT o custo total fica +R$ 13 mil', N.tot && N.tot.g[0] === 'R$ 33 mil' && N.tot.g[1] === '+R$ 13 mil', JSON.stringify(N.tot));
  await pg.click('#modo-custo [data-ccmp="rem"]'); await pg.waitForTimeout(300);
  // expandir até o ROIC
  await pg.click('#ct-roic'); await pg.waitForTimeout(400);
  const raiz = await pg.evaluate(() => document.querySelector('#arv-custo .tn.raiz .tn-t').textContent);
  af('expandir até o ROIC põe o ROIC na raiz', /ROIC anualizado/.test(raiz), raiz);
  await pg.click('#ct-roic'); await pg.waitForTimeout(300);
  const caixa = await pg.evaluate(() => { const a = document.getElementById('arv-custo').getBoundingClientRect(); return [...document.querySelectorAll('#arv-custo .tn')].every(n => { const r = n.getBoundingClientRect(); return r.left >= a.left - 1 && r.right <= a.right + 1 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1; }); });
  af('árvore cabe na área', caixa);
  const enc = await pg.evaluate(() => { const a = document.getElementById('modo-custo').getBoundingClientRect(), z = document.querySelector('#arv-custo .arv-zoom').getBoundingClientRect(); return a.right <= z.left || a.bottom <= z.top; });
  af('a barra de cima não encosta no zoom', enc);
  af('sem rolagem', await pg.evaluate(() => { const v = document.querySelector('.vw.on'); return v.scrollHeight - v.clientHeight; }) <= 1);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `custo-${w}-${tema}.png`) });
  // balanço de massa: PIR Empurrada out/26, R$ 6.000 em Combustíveis sobre R$ 60 mil de remunerado e 30 mil km
  // → R$/km líquido = (60.000 − 6.000) ÷ 30.000 = 1,80 → 3.333 km de volta ao remunerado (a regra da Árvore de Combustível)
  const bm = await pg.evaluate(() => { const km0 = KM.slice(), fr0 = Object.assign({}, FRN), b0 = CT.bm;
    KM.push({ vig: '2026-10', uni: 'PIR', op: 'EMP', proj: 'EMPURRADA', frota: 30, vPrim: 100, kmPrim: 30000, vRec: 0, kmRec: 0, vNot: 0, kmNot: 0, rem: 30000, real: 33000 });
    FRN['2026-10|EMPURRADA - PIR'] = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': { rem: 60000 } };
    CT.bm = { '10/2026|EMPURRADA - PIR': { COMBUSTIVEIS: 6000 } }; ctRecompoe(); const r = CT_BM['2026-10|PIR'];
    KM.length = 0; km0.forEach(x => KM.push(x)); Object.keys(FRN).forEach(k => delete FRN[k]); Object.assign(FRN, fr0); CT.bm = b0; ctRecompoe(); return r; });
  af('balanço de massa: 3.333 km a R$ 1,80', bm && Math.abs(bm.km - 3333.33) < 1 && Math.abs(bm.valor - 6000) < 0.01, JSON.stringify(bm));
  af('sem erro na página', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log(ok + ' ok · ' + fa + ' falha(s)'); await nav.close(); srv.close(); process.exit(fa ? 1 : 0);

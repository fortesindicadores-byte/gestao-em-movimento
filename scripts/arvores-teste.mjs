// Teste do painel /arvores/ (ROIC e Km) no Chromium, com o banco, o FT e a aba dublados
// e números conhecidos. Uso: SBJS=<supabase-js UMD> [SHOT_DIR=…] node scripts/arvores-teste.mjs
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
  fr('ROTA - CGR', 'Pneus Novos', -2500, -2000, -2000), fr('ROTA - CGR', 'Seguro de Veículos e Equipamentos', -1000, -1000, -1000)];
const DG = [{ ano: 2026, mes: 10, cod_dre: '351', projeto: 'Rota - CGR', realizado: -180000 }, { ano: 2026, mes: 10, cod_dre: '351', projeto: 'Apoio - CBA', realizado: -4000 },
  { ano: 2026, mes: 10, cod_dre: '351', projeto: 'Auto Serviço - GOI', realizado: -10000 }];
// ── FT: capital (serial do Excel: 45566 = 01/10/2024 · 42370 = 01/01/2016 · 45931 = 01/10/2025 · 45945 = 15/10/2026 (aprox.)) ──
const serial = d => Math.round((Date.UTC(...d) - Date.UTC(1899, 11, 30)) / 864e5);
const CAM = ['Unidade - Nome', 'Placa', 'Ativo', 'Data de Entrada', 'Valor de Compra Cavalo', 'Valor de Compra Carroceria'];
const LAY = [], LIN = [];
for (const m of [9, 10]) {
  LAY.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, colunas: CAM });
  LIN.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, unidade: 'CDD RIO DE JANEIRO', dados: ['CDD RIO DE JANEIRO', 'AAA1A11', true, serial([2024, 9, 1]), 4000000, 1000000] });
  LIN.push({ canal: 'ROTA', tabela: 'Caminhao', vigencia: `ROTA_2_${m}_2026`, unidade: 'CDD RIO DE JANEIRO', dados: ['CDD RIO DE JANEIRO', 'BBB2B22', false, serial([2016, 0, 1]), 3000000, 0] });
}
LAY.push({ canal: 'ARMAZEM', tabela: 'EmpilhadeiraApoio', vigencia: 'ARMAZEM_1_10_2026', colunas: ['Unidade - Nome', 'chassi', 'ativoParado', 'mesanoEntrada', 'valorCompraNf', 'implementoValorImplemento'] });
LIN.push({ canal: 'ARMAZEM', tabela: 'EmpilhadeiraApoio', vigencia: 'ARMAZEM_1_10_2026', unidade: 'CUIABA', dados: ['CUIABA', 'X1', true, serial([2025, 9, 1]), 1000000, 0] });
LAY.push({ canal: 'AS', tabela: 'CaminhaoAS', vigencia: 'AS_2_10_2026', colunas: CAM });
LIN.push({ canal: 'AS', tabela: 'CaminhaoAS', vigencia: 'AS_2_10_2026', unidade: 'CDD GOIANIA', dados: ['CDD GOIANIA', 'CCC3C33', true, serial([2026, 9, 15]), 2000000, 0] });
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
const KML = [{ vigencia: '10/2026', projeto: 'ROTA - CGR', placa: 'AAA1111', km_rodado_horas_trabalhadas: 12000 },
  { vigencia: '10/2026', projeto: 'ROTA - CGR', placa: 'BBB2B22', km_rodado_horas_trabalhadas: 10000 },
  { vigencia: '10/2026', projeto: 'VAN - CGR', placa: 'VAN0A01', km_rodado_horas_trabalhadas: 2600 }];

const filtra = (rows, q) => rows.filter(r => [...q.entries()].every(([k, v]) => {
  if (['select', 'order', 'offset', 'limit'].includes(k) || !(k in (rows[0] || {})) && !['ano'].includes(k)) return true;
  const val = String(r[k] ?? ''); const [op, ...rest] = v.split('.'); const arg = rest.join('.');
  if (op === 'eq') return val === arg; if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(val);
  if (op === 'gte') return val >= arg; return true; }));
const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let ok = 0, fa = 0; const af = (n, c, d = '') => { if (c) ok++; else { fa++; console.log('FALHA', n, d); } };
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await pg.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: fs.readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/assets\/(gviz-cache|build-check)\.js/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/api\.bcb\.gov\.br/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ data: '01/09/2026', valor: '4,60' }, { data: '01/10/2026', valor: '4,50' }]) }));
  await pg.route(/docs\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `google.visualization.Query.setResponse(${JSON.stringify(ABA)})` }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()), p = u.pathname, json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: true });
    const t = p.split('/rest/v1/')[1]; if (+(u.searchParams.get('offset') || 0) > 0) return json([]);
    const T = { sh_dre_receita: REC, sh_dre_ebitda: EBD, sh_dre_frota: FRT, dre_gerencial: DG, ft_layout: LAY, ft_linha: LIN, sh_consumo_km_litro: KML };
    return json(T[t] ? filtra(T[t], u.searchParams) : []);
  });
  await pg.addInitScript(t0 => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0);
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, tema);
  await pg.goto(BASE + '/arvores/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => /Freightech/.test(document.getElementById('titSub').textContent), null, { timeout: 20000 }).catch(() => {});
  const txt = id => pg.evaluate(i => document.getElementById(i).textContent.trim(), id);
  const vaza = () => pg.evaluate(() => { const v = document.querySelector('.vw.on'); return v.scrollHeight - v.clientHeight; });
  const um = w === 1366 && tema === 'dark';
  // out/26: rec 4,4 mi · EBITDA 1,07 mi · dep 194 mil (DRE) · EBIT 876 mil · NOPAT anual 6,94 mi · capital 3,8 + 0,75 + 0,88 + 2,0 = 7,43 mi
  af('vigência abre em out/26', /OUT\/26/.test(await txt('titSub')), await txt('titSub'));
  af('depreciação do DRE', /depreciação do DRE do ERP/.test(await txt('titSub')));
  af('receita 4,4 mi', await txt('k-rec') === 'R$ 4,40 mi', await txt('k-rec'));
  af('EBIT 876 mil', await txt('k-ebit') === 'R$ 876 mil', await txt('k-ebit'));
  af('NOPAT anual 6,94 mi', await txt('k-nop') === 'R$ 6,94 mi', await txt('k-nop'));
  af('capital 7,43 mi', await txt('h-cap') === 'R$ 7,43 mi', await txt('h-cap'));
  af('ROIC 93,4%', await txt('h-roic') === '93,4%', await txt('h-roic'));
  af('capital parado 750 mil (o caminhão inativo de 2016, 25%)', await txt('k-par') === 'R$ 750 mil', await txt('k-par'));
  af('empilhadeira ativoParado=true opera', /4 · 3 operando/.test(await txt('h-qtd')), await txt('h-qtd'));
  const linhas = await pg.evaluate(() => [...document.querySelectorAll('#tbl-res tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())));
  if (um) console.log(JSON.stringify(linhas));
  af('3 linhas (Terceiros fora)', linhas.length === 3, linhas.length);
  af('AS GNA sem depreciação do FT de mês novo', linhas.some(l => l[0] === 'GNA' && l[1] === 'Auto Serviço' && l[5] === '-10 mil'), JSON.stringify(linhas));
  af('Resumo sem rolagem', await vaza() <= 1, await vaza());
  const tb = await pg.evaluate(() => { const w = document.getElementById('t-res'), t = w.querySelector('table'); return { hs: w.scrollWidth - w.clientWidth, alt: Math.max(...[...t.tBodies[0].rows].map(r => r.offsetHeight)) }; });
  af('tabela sem barra lateral', tb.hs <= 1, tb.hs); af('linha da tabela sem quebra', tb.alt <= 40, tb.alt);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `res-${w}-${tema}.png`) });
  // árvore do ROIC
  await pg.evaluate(() => setVw('roic')); await pg.waitForTimeout(800);
  const nos = await pg.evaluate(() => [...document.querySelectorAll('#arv-roic .tn')].map(n => n.querySelector('.tn-t').textContent + '=' + n.querySelector('.tn-v').textContent));
  if (um) console.log(JSON.stringify(nos));
  af('árvore ROIC com 15 nós', nos.length === 15, nos.length);
  const noR = t0 => pg.evaluate(t1 => { const n = [...document.querySelectorAll('#arv-roic .tn')].find(x => x.querySelector('.tn-t').textContent.replace(/ · estimada$/, '') === t1);
    return n ? { cls: n.className, g: [...n.querySelectorAll('.tn-g b')].map(b => b.textContent), i: (n.querySelector('.tn-i') || {}).textContent || '' } : null; }, t0);
  let nr = await noR('Receita líquida'); if (um) console.log(JSON.stringify(nr));
  af('receita contra o remunerado: −100 mil', nr && nr.g[0] === 'R$ 4,50 mi' && nr.g[1] === '-R$ 100 mil' && /gap\b/.test(nr.cls) && /-R\$ 100 mil\/mês/.test(nr.i), JSON.stringify(nr));
  nr = await noR('Combustíveis'); af('combustíveis +3.000 acima do remunerado', nr && nr.g[1] === '+R$ 3.000' && nr.g[2] === '+10,0%' && /gap\b/.test(nr.cls), JSON.stringify(nr));
  nr = await noR('Manutenções'); af('manutenção abaixo do remunerado fica verde', nr && /gap-ok/.test(nr.cls), JSON.stringify(nr));
  nr = await noR('Depreciação'); af('depreciação sem referência no DRE', nr && !nr.g.length && /Sem remunerado para comparar/.test(nr.i), JSON.stringify(nr));
  nr = await noR('ROIC anualizado'); af('raiz contra o IPCA 12m', nr && nr.g[0] === '4,5%' && nr.g[1] === '+88,9 pp', JSON.stringify(nr));
  af('hero: acima do IPCA', await txt('h-ipca') === '+88,9 pp', await txt('h-ipca'));
  const gp = await pg.evaluate(() => [...document.querySelectorAll('#gaps-roic .gp')].map(x => x.textContent));
  af('maiores gaps do ROIC', /Receita líquida -R\$ 100 mil\/mês/.test(gp[0] || '') && gp.some(x => /^Combustíveis -R\$ 3.000/.test(x)) && gp.some(x => /CGR · Rota: EBITDA -R\$ 50 mil/.test(x)), JSON.stringify(gp));
  // abertura de um nó do ROIC
  const cR = await pg.evaluate(() => { const n = [...document.querySelectorAll('#arv-roic .tn.ab')].find(x => x.querySelector('.tn-t').textContent === 'Receita líquida'); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 10 }; });
  await pg.mouse.click(cR.x, cR.y); await pg.waitForTimeout(150);
  const AR = await pg.evaluate(() => ({ on: document.getElementById('ab-ov').classList.contains('on'), t: document.getElementById('ab-t').textContent, tr: [...document.querySelectorAll('#ab-tab tbody tr')].map(r => [...r.cells].map(x => x.textContent)) }));
  af('abertura da receita por unidade e projeto, pior primeiro', AR.on && AR.t === 'Receita líquida' && AR.tr[0][0] === 'CGR' && AR.tr[0][4] === '-R$ 100 mil', JSON.stringify(AR));
  await pg.keyboard.press('Escape');
  // comparar com o orçado
  await pg.click('#modo-roic [data-cmp="orc"]'); await pg.waitForTimeout(400);
  nr = await noR('Receita líquida'); af('contra o orçado a receita fica +100 mil', nr && nr.g[0] === 'R$ 4,30 mi' && nr.g[1] === '+R$ 100 mil' && /gap-ok/.test(nr.cls), JSON.stringify(nr));
  await pg.click('#modo-roic [data-cmp="rem"]'); await pg.waitForTimeout(300);
  af('nó raiz ROIC', nos[0] === 'ROIC anualizado=93,4%', nos[0]);
  const caixa = await pg.evaluate(() => { const a = document.getElementById('arv-roic').getBoundingClientRect(); return [...document.querySelectorAll('#arv-roic .tn')].every(n => { const r = n.getBoundingClientRect(); return r.left >= a.left - 1 && r.right <= a.right + 1 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1; }); });
  af('árvore ROIC cabe na área', caixa);
  af('ROIC sem rolagem', await vaza() <= 1, await vaza());
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `roic-${w}-${tema}.png`) });
  // set + out: depreciação de set estimada pelo FT (5 mi × 1% = 50 mil)
  await pg.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-09', '2026-10']); w._render(''); render(); });
  await pg.waitForFunction(() => /SET\/26 a OUT\/26/.test(document.getElementById('titSub').textContent) && /Freightech/.test(document.getElementById('titSub').textContent), null, { timeout: 10000 }).catch(() => {});
  af('set estimada', /estimada pelo FT em set\/26/.test(await txt('titSub')), await txt('titSub'));
  af('ROIC set+out 100,5%', await txt('h-roic') === '100,5%', await txt('h-roic'));
  af('nó depreciação marcado', await pg.evaluate(() => [...document.querySelectorAll('#arv-roic .tn-s')].some(s => /DRE do ERP \+ FT/.test(s.textContent))));
  // árvore de km (out/26): teto 25 mil · 50 mapas não rodados (5 mil km) · revisão +500 km · dispersão +1.300 (+6,3%)
  await pg.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); w._render(''); const o = document.getElementById('ms-op'); o._sel = new Set(['ROTA']); o._render(''); setVw('km'); });
  await pg.waitForFunction(() => document.querySelectorAll('#arv-km .tn').length > 3, null, { timeout: 10000 }).catch(() => {});
  // modo gaps (padrão): projeto e unidade, com o impacto ao R$/km remunerado (42 mil ÷ 20.700 km)
  const kg = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#arv-km .tn')].map(n => [n.querySelector('.tn-t').textContent, { v: n.querySelector('.tn-v').textContent, cls: n.className, g: [...n.querySelectorAll('.tn-g b')].map(b => b.textContent), i: (n.querySelector('.tn-i') || {}).textContent || '' }])));
  if (um) console.log(JSON.stringify(kg));
  af('gaps: raiz, projeto e unidade', kg['Dispersão de km'] && kg['Rota'] && kg['CGR · Rota'] && kg['CGR · Rota'].v === '+1.300 km', JSON.stringify(Object.keys(kg)));
  af('gaps: rem · real · ▲% e impacto', kg['CGR · Rota'] && kg['CGR · Rota'].g.join('|') === '20.700 km|22.000 km|+6,3%' && /-R\$ 2.638\/mês/.test(kg['CGR · Rota'].i) && /gap\b/.test(kg['CGR · Rota'].cls), JSON.stringify(kg['CGR · Rota']));
  const gk = await pg.evaluate(() => [...document.querySelectorAll('#gaps-km .gp')].map(x => x.textContent));
  af('maiores gaps do km', /CGR · Rota \+1.300 km \(\+6,3%\) · -R\$ 2.638\/mês/.test(gk[0] || ''), JSON.stringify(gk));
  await pg.click('#gaps-km .gp'); await pg.waitForTimeout(150);
  const AG = await pg.evaluate(() => ({ t: document.getElementById('ab-t').textContent, th: [...document.querySelectorAll('#ab-tab thead th')].map(x => x.textContent), tr: [...document.querySelectorAll('#ab-tab tbody tr')].map(r => [...r.cells].map(x => x.textContent)) }));
  af('chip abre a dispersão da unidade com o impacto', AG.t === 'Dispersão de km · CGR · Rota' && AG.th.includes('Impacto R$/mês') && AG.tr[0].includes('-R$ 2.638') && AG.tr[0].includes('2,03'), JSON.stringify(AG));
  await pg.keyboard.press('Escape');
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `kmgap-${w}-${tema}.png`) });
  await pg.click('#modo-km [data-km="comp"]');
  await pg.waitForFunction(() => [...document.querySelectorAll('#arv-km .tn-t')].some(x => x.textContent === 'Km da 1ª viagem'), null, { timeout: 5000 }).catch(() => {});
  const km = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#arv-km .tn')].map(n => [n.querySelector('.tn-t').textContent, n.querySelector('.tn-v').textContent])));
  if (um) console.log(JSON.stringify(km));
  af('dispersão +1.300 km', km['Dispersão de km'] === '+1.300 km', km['Dispersão de km']);
  af('teto 25 mil km', km['Teto da 1ª viagem (T2)'] === '25 mil km', km['Teto da 1ª viagem (T2)']);
  af('não rodados -5.000 km', km['Mapas que não rodaram (T2)'] === '-5.000 km', km['Mapas que não rodaram (T2)']);
  af('revisão +500 km', km['Revisão do km por mapa (T2)'] === '+500 km', km['Revisão do km por mapa (T2)']);
  af('subtítulo da árvore de km', /Dispersão de km e Freightech/.test(await txt('titSub')), await txt('titSub'));
  af('1ª viagem 20 mil km', km['Km da 1ª viagem'] === '20 mil km', km['Km da 1ª viagem']);
  af('Km sem rolagem', await vaza() <= 1, await vaza());
  // a nota de baixo cresce depois do desenho: a árvore tem de se reajustar e nada fica cortado
  await pg.evaluate(() => { document.getElementById('nota-km').innerHTML += '<br>linha a mais<br>outra linha<br>mais uma'; });
  await pg.waitForTimeout(300);
  const cabeKm = await pg.evaluate(() => { const a = document.getElementById('arv-km').getBoundingClientRect(); return [...document.querySelectorAll('#arv-km .tn')].every(n => { const r = n.getBoundingClientRect(); return r.top >= a.top - 1 && r.bottom <= a.bottom + 1 && r.left >= a.left - 1 && r.right <= a.right + 1; }); });
  af('árvore de km cabe depois de a nota crescer', cabeKm);
  // zoom: + aumenta, Ajustar volta ao desenho inteiro
  const larg = () => pg.evaluate(() => document.querySelector('#arv-km .tn').getBoundingClientRect().width);
  const w0 = await larg();
  await pg.click('#arv-km .arv-zoom button[data-z="+"]');
  af('zoom + aumenta', (await larg()) > w0 * 1.2 && /125%/.test(await pg.inputValue('#arv-km .arv-zp')), await pg.inputValue('#arv-km .arv-zp'));
  await pg.click('#arv-km .arv-zoom button[data-z="0"]');
  await pg.fill('#arv-km .arv-zp', '200'); await pg.press('#arv-km .arv-zp', 'Enter');
  af('zoom digitado 200%', (await pg.inputValue('#arv-km .arv-zp')) === '200%' && Math.abs((await larg()) - w0 * 2) < 2, await pg.inputValue('#arv-km .arv-zp'));
  await pg.click('#arv-km .arv-zoom button[data-z="0"]');
  af('Ajustar volta a 100%', /^100%$/.test(await pg.inputValue('#arv-km .arv-zp')) && Math.abs((await larg()) - w0) < 1);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `km-${w}-${tema}.png`) });
  // indicadores nos nós
  const rot = await pg.evaluate(() => [...document.querySelectorAll('#arv-km .tn td')].map(t => t.textContent).join('|'));
  af('km por viagem e placas no nó', /Por viagem\|102,3/.test(rot) && /Placas que rodaram\|2,0/.test(rot) && /Km por placa no mês\|11.000/.test(rot), rot);
  // abertura: clique no nó Km rodado
  await pg.click('#arv-km .arv-zoom button[data-z="0"]');
  const clicaNo = t => pg.evaluate(t0 => { const n = [...document.querySelectorAll('#arv-km .tn.ab')].find(x => x.querySelector('.tn-t').textContent === t0); const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 12 }; }, t);
  let c = await clicaNo('Km rodado'); await pg.mouse.click(c.x, c.y); await pg.waitForTimeout(150);
  const ab = () => pg.evaluate(() => ({ on: document.getElementById('ab-ov').classList.contains('on'), t: document.getElementById('ab-t').textContent,
    q: [...document.querySelectorAll('#ab-q .dimb')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')),
    th: [...document.querySelectorAll('#ab-tab thead th')].map(x => x.textContent), tr: [...document.querySelectorAll('#ab-tab tbody tr')].map(r => [...r.cells].map(x => x.textContent)),
    hs: (() => { const w = document.querySelector('.ab-box .twrap'); return w.scrollWidth - w.clientWidth; })() }));
  let A = await ab(); if (um) console.log(JSON.stringify(A));
  af('clique abre a abertura do nó', A.on && A.t === 'Km rodado', JSON.stringify(A));
  af('abertura por unidade e projeto em duas colunas', A.th[0] === 'Unidade' && A.th[1] === 'Projeto' && A.tr[0][0] === 'CGR' && A.tr[0][1] === 'Rota', JSON.stringify(A.tr));
  af('abertura com km por ativo e por viagem', A.th.includes('Km por ativo no mês') && A.tr[0].includes('2.200') && A.tr[0].includes('102,3'), JSON.stringify(A.tr));
  af('abertura sem barra lateral', A.hs <= 1, A.hs);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `abertura-${w}-${tema}.png`) });
  await pg.click('#ab-q [data-q="placa"]'); A = await ab();
  af('abertura por placa (Km/L)', A.tr.length === 2 && A.tr[0][0] === 'AAA1111' && A.tr[0][4] === '12.000', JSON.stringify(A.tr));
  await pg.keyboard.press('Escape'); A = await ab(); af('Esc fecha a abertura', !A.on);
  // arrastar não abre
  c = await clicaNo('Km remunerado'); await pg.mouse.move(c.x, c.y); await pg.mouse.down(); await pg.mouse.move(c.x + 60, c.y + 30, { steps: 4 }); await pg.mouse.up();
  A = await ab(); af('arrastar não abre a abertura', !A.on);
  await pg.click('#arv-km .arv-zoom button[data-z="0"]');
  c = await clicaNo('Mapas que não rodaram (T2)'); await pg.mouse.click(c.x, c.y); A = await ab();
  af('abertura dos mapas não rodados (T2)', A.on && A.th.includes('Não rodados') && A.tr[0].includes('50'), JSON.stringify(A));
  await pg.click('.ab-x');
  // filtro Projeto: só a Van
  const opc = await pg.evaluate(() => [...document.querySelectorAll('#ms-op .ms-opt:not(.all-opt)')].map(o => o.textContent.replace('only', '').trim()));
  af('filtro Projeto com a Van separada', /Projeto/.test(await pg.evaluate(() => document.querySelector('#ms-op .ms-btn').textContent)) && opc.join(',') === 'Rota,Van,Auto Serviço,Empurrada,Insumos,Armazém', opc.join(','));
  await pg.evaluate(() => { const o = document.getElementById('ms-op'); o._sel = new Set(['VAN']); o._render(''); render(); });
  await pg.waitForTimeout(400);
  const kv = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#arv-km .tn')].map(n => [n.querySelector('.tn-t').textContent, n.querySelector('.tn-v').textContent])));
  af('Van: dispersão +600 km', kv['Dispersão de km'] === '+600 km', JSON.stringify(kv));
  af('sem erro na página', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log(ok + ' ok · ' + fa + ' falha(s)'); await nav.close(); srv.close(); process.exit(fa ? 1 : 0);

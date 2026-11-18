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
const dre = (vig, nv3, real, orc) => ({ vigencia: vig, nivel_3: nv3, realizado: real, orcado: orc, linha: 1 });
const REC = [dre('2026-10-01', 'ROTA - CGR', 3000000, 2900000), dre('2026-10-01', 'APOIO - CBA', 1000000, 1000000), dre('2026-10-01', 'AUTO SERVIÇO - GOI', 400000, 400000),
  dre('2026-10-01', 'TERCEIROS - BLC', 500000, 500000), dre('2026-09-01', 'ROTA - CGR', 2800000, 2800000)];
const EBD = [dre('2026-10-01', 'ROTA - CGR', 800000, 700000), dre('2026-10-01', 'APOIO - CBA', 200000, 200000), dre('2026-10-01', 'AUTO SERVIÇO - GOI', 70000, 70000),
  dre('2026-10-01', 'TERCEIROS - BLC', 90000, 90000), dre('2026-09-01', 'ROTA - CGR', 700000, 700000)];
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
const ABA = { status: 'ok', table: { cols: Array.from({ length: 33 }, (_, i) => ({ id: 'c' + i, label: '' })), rows: [L(10, 'ROTA - CGR'), L(9, 'ROTA - CGR')] } };

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
  await pg.route(/docs\.google\.com/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `google.visualization.Query.setResponse(${JSON.stringify(ABA)})` }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()), p = u.pathname, json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: true });
    const t = p.split('/rest/v1/')[1]; if (+(u.searchParams.get('offset') || 0) > 0) return json([]);
    const T = { sh_dre_receita: REC, sh_dre_ebitda: EBD, dre_gerencial: DG, ft_layout: LAY, ft_linha: LIN };
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
  af('árvore ROIC com 13 nós', nos.length === 13, nos.length);
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
  await pg.evaluate(() => { const w = document.getElementById('ms-vig'); w._sel = new Set(['2026-10']); w._render(''); setVw('km'); });
  await pg.waitForFunction(() => document.querySelectorAll('#arv-km .tn').length > 3, null, { timeout: 10000 }).catch(() => {});
  const km = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#arv-km .tn')].map(n => [n.querySelector('.tn-t').textContent, n.querySelector('.tn-v').textContent])));
  if (um) console.log(JSON.stringify(km));
  af('dispersão +1.300 km', km['Dispersão de km'] === '+1.300 km', km['Dispersão de km']);
  af('teto 25 mil km', km['Teto da 1ª viagem (T2)'] === '25 mil km', km['Teto da 1ª viagem (T2)']);
  af('não rodados -5.000 km', km['Mapas que não rodaram (T2)'] === '-5.000 km', km['Mapas que não rodaram (T2)']);
  af('revisão +500 km', km['Revisão do km por mapa (T2)'] === '+500 km', km['Revisão do km por mapa (T2)']);
  af('subtítulo da árvore de km', /Dispersão de km e Freightech/.test(await txt('titSub')), await txt('titSub'));
  af('1ª viagem 20 mil km', km['Km da 1ª viagem'] === '20 mil km', km['Km da 1ª viagem']);
  af('Km sem rolagem', await vaza() <= 1, await vaza());
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, `km-${w}-${tema}.png`) });
  af('sem erro na página', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log(ok + ' ok · ' + fa + ' falha(s)'); await nav.close(); srv.close(); process.exit(fa ? 1 : 0);

// Teste da RPS de Frota (/rps/): slides da semana a partir da foto diária (gav_diario) e as ações no Plano de Ação.
// Chromium com o banco dublado. Uso: CHART_JS=chart.umd.js ECHARTS=echarts.min.js node scripts/rps-teste.mjs   (SHOT_DIR = prints)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHARTJS = process.env.CHART_JS ? fs.readFileSync(process.env.CHART_JS, 'utf8') : 'window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};';
const ECHARTS = process.env.ECHARTS ? fs.readFileSync(process.env.ECHARTS, 'utf8') : '';
const SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (c, m, x) => { if (c) { ok++; console.log('   ✓ ' + m); } else { falha++; console.log('   ✗ ' + m + (x !== undefined ? '  (' + JSON.stringify(x) + ')' : '')); } };

/* a foto diária: MCC T1 e MCC T2 de 15/11 a 25/11/2026 (semana da RPS = 22/11 a 28/11), CGR à parte */
const dias = []; for (let d = 15; d <= 25; d++) dias.push('2026-11-' + String(d).padStart(2, '0'));
const ind = (base, d) => ({
  dp: { v: d === '2026-11-24' ? base - 6 : base, n: 1, b: [{ Placa: 'ABC1D23', Projeto: 'ROTA', 'Dias parada': 3 }] },
  pv: { v: 100, n: 0, b: [] }, af: { v: 96, n: 0, b: [] }, mm: { v: 92, n: 0, b: [] }, ca: { v: 70, n: 2, b: [{ Placa: 'XYZ9A88', 'Desvio da pressão (%)': -18 }, { Placa: 'XYZ9A88', 'Desvio da pressão (%)': 14 }] },
  al: { v: 85, n: 0, b: [] }, sv: { v: 100, n: 0, b: [] }, se: { v: null, n: 0, b: [] }, cf: { v: 100, n: 0, b: [] }, os: { v: 88, n: 0, b: [] },
  ck: { v: 100, n: 0, b: [] }, conf: { v: 100, n: 0, b: [] }, blz: { v: 95, n: 0, b: [] }, fca: { v: 90, n: 0, b: [] }, docs: { v: 0, n: 0, b: [] },
  qg: { v: 1, n: 1, b: [{ Data: '18/11/2026', dia: '2026-11-18', Conta: 'Manutenção de Veículos', Grupo: 'Motor', Placa: 'ABC1D23', Fornecedor: 'Oficina X', Valor: 42000, 'Rem. da conta': 300000, '% do rem.': 14 }] },
});
const GD = [];
dias.forEach(d => { [['MCC T1', 98, 95], ['MCC T2', 96, 91], ['CGR', 80, 70]].forEach(([u, b, s]) => GD.push({ dia: d, unidade: u, dados: { score: s + (d === '2026-11-24' ? -4 : 0), ind: ind(b, d) } })); });
/* hoje: a foto do dia que ainda não acabou não aparece */
const HOJE = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
['MCC T1', 'MCC T2'].forEach(u => GD.push({ dia: HOJE, unidade: u, dados: { score: 10, ind: ind(10, HOJE) } }));
/* consumo: abastecimentos de diesel do ERP e o Km/L remunerado do projeto (consumo automático, dados até 24/11) */
const ERP = [
  { ordem_servico: 1, data: '2026-11-20', placa: 'MCC1A11', projeto_os: 'EMPURRADA - MCC', hodometro: 10000, km_rodado: null, litros: 300, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 2, data: '2026-11-22', placa: 'MCC1A11', projeto_os: 'EMPURRADA - MCC', hodometro: 10400, km_rodado: 400, litros: 200, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 3, data: '2026-11-23', placa: 'MCC1A11', projeto_os: 'EMPURRADA - MCC', hodometro: 10800, km_rodado: 400, litros: 250, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 4, data: '2026-11-25', placa: 'MCC1A11', projeto_os: 'EMPURRADA - MCC', hodometro: 11200, km_rodado: 400, litros: 160, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 5, data: '2026-11-21', placa: 'MCC2B22', projeto_os: 'ROTA - MCC', hodometro: 5000, km_rodado: null, litros: 90, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 6, data: '2026-11-22', placa: 'MCC2B22', projeto_os: 'ROTA - MCC', hodometro: 5300, km_rodado: 300, litros: 100, tipo_combustivel: 'DIESEL S10' },
  { ordem_servico: 7, data: '2026-11-22', placa: 'MCC2B22', projeto_os: 'ROTA - MCC', hodometro: 5300, km_rodado: 0, litros: 20, tipo_combustivel: 'ARLA 32' },
  { ordem_servico: 8, data: '2026-11-22', placa: 'CGR3C33', projeto_os: 'ROTA - CGR', hodometro: 900, km_rodado: 300, litros: 50, tipo_combustivel: 'DIESEL S10' },
];
const KML = [
  { vigencia_orig: '2026-11-01', projeto: 'EMPURRADA - MCC', placa: 'MCC1A11', km_l_rem_medio: 2, linha: 1 },
  { vigencia_orig: '2026-11-01', projeto: 'ROTA - MCC', placa: 'MCC2B22', km_l_rem_medio: 3, linha: 2 },
  { vigencia_orig: '2026-11-01', projeto: 'ROTA - CGR', placa: 'CGR3C33', km_l_rem_medio: 3, linha: 3 },
];
const CAB = [{ slug: 'consumo_km_litro', tabela: 'ca_consumo_km_litro', linhas: 3, erro: null, resumo: { dados_ate: '2026-11-24' } }];
const PA = [
  { id: 'a1', unidade: 'MCC T2', vigencia: 'nov/26', origem: 'RPS', fato: 'Calibragem', projeto: null, fato_desvio: '18/11/2026 · 70% (meta 90%) · RPS de 15/11/2026', causa: null, acao: 'Calibrar a frota da Rota', responsavel: 'ERICK SILVA', prazo: '2026-11-20', status: 'Concluída', acompanhamento: null, created_at: '2026-11-16T12:00:00Z' },
  { id: 'a2', unidade: 'MCC T1', vigencia: 'nov/26', origem: 'RPS', fato: 'OS no prazo', projeto: null, fato_desvio: '17/11/2026 · 88% (meta 90%) · RPS de 15/11/2026', causa: null, acao: 'Fechar as OS abertas há mais de 8 dias', responsavel: 'ERICK SILVA', prazo: '2026-11-21', status: 'Em andamento', acompanhamento: null, created_at: '2026-11-16T12:00:00Z' },
  { id: 'a3', unidade: 'CGR', vigencia: 'nov/26', origem: 'RPS', fato: 'Preventivas', projeto: null, fato_desvio: '17/11/2026 · 80% · RPS de 15/11/2026', causa: null, acao: 'Outra unidade', responsavel: null, prazo: null, status: 'Não iniciada', acompanhamento: null, created_at: '2026-11-16T12:00:00Z' },
];

const SHIM = `(${function (T0) {
  if (window.top !== window) return;
  sessionStorage.setItem('gem_hub', '1'); window.__T = T0; window.__ins = []; window.__upd = []; window.__del = [];
  window.confirm = () => true;
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'admin@conlogsa.com.br', user_metadata: { name: 'Renan' } } } } }) },
    rpc: async () => ({ data: [{ nome: 'ERICK SILVA', unidade: 'MCC T1,MCC T2', is_admin: false }, { nome: 'Renan Fortes', unidade: '', is_admin: true }], error: null }),
    from: (tab) => { const T = window.__T; let rows = (T[tab] || []).slice(), sel = '';
      const q = { select(s) { sel = s || ''; return q; }, order() { return q; }, or() { return q; },
        eq(c, v) { if (tab === 'fca_profiles') rows = [{ nome: 'Renan', unidade: '', is_admin: true }]; else rows = rows.filter(r => r[c] === v); return q; },
        in(c, vs) { rows = rows.filter(r => vs.includes(r[c])); return q; }, gte(c, v) { rows = rows.filter(r => String(r[c]) >= v); return q; },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        range: async (a, b) => { let r = rows.slice(a, b + 1); if (/score:dados->score/.test(sel)) r = r.map(x => ({ dia: x.dia, unidade: x.unidade, score: x.dados.score })); return { data: JSON.parse(JSON.stringify(r)), error: null }; },
        insert: (r0) => { const r = Object.assign({ id: 'n' + (window.__ins.length + 1), created_at: new Date().toISOString() }, r0); window.__ins.push({ tab, r: r0 }); (T[tab] = T[tab] || []).push(r);
          const q2 = { select: () => q2, single: async () => ({ data: Object.assign({}, r), error: null }) }; return q2; },
        update: (p) => ({ eq: async (c, v) => { window.__upd.push({ tab, p, id: v }); (T[tab] || []).filter(r => r[c] === v).forEach(r => Object.assign(r, p)); return { error: null }; } }),
        delete: () => ({ eq: async (c, v) => { window.__del.push({ tab, id: v }); T[tab] = (T[tab] || []).filter(r => r[c] !== v); return { error: null }; } }) };
      return q; } }) };
}})(${JSON.stringify({ gav_diario: GD, plano_acao: PA, erp_abastecimentos: ERP, ca_consumo_km_litro: KML, consumo_auto_base: CAB })});`;

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(8796, r));
const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

async function abre({ w = 1600, h = 900, tema = 'dark' } = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(SHIM);
  await pg.addInitScript(tm => { try { localStorage.setItem('bi_theme', tm); } catch (e) {} }, tema);
  await pg.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/javascript', body: /supabase/.test(u) ? '/*dublê no initScript*/' : /chart\.js/.test(u) ? CHARTJS : /echarts/.test(u) ? ECHARTS : '/*stub*/' }); });
  await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pg.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await pg.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await pg.goto('http://localhost:8796/rps/index.html?u=MCC', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__apresPronto === true, null, { timeout: 30000 });
  await pg.waitForFunction(() => { const f = document.getElementById('prev'); return f && f.contentWindow && f.contentWindow.__deckPronto; }, null, { timeout: 20000 });
  await pg.waitForTimeout(500);
  return { ctx, pg, errs };
}
const slideTxt = (pg, item) => pg.evaluate(it => { const s = DECK.find(d => d.item === it); if (!s) return ''; const d = document.createElement('div'); d.innerHTML = s.html; return d.textContent.replace(/\s+/g, ' '); }, item);
const vaiItem = (pg, item) => pg.evaluate(it => { POS = DECK.findIndex(d => d.item === it); mostra(); }, item);

console.log('1 · MCC (T1 + T2), semana de 22/11/2026');
{
  const { ctx, pg, errs } = await abre();
  const e = await pg.evaluate(() => ({ itens: DECK.map(d => d.item), vig: VIG, cods: CODS.join(','), sub: document.getElementById('titSub').textContent }));
  t(JSON.stringify(e.itens) === JSON.stringify(['capa', 'sumario', 'resumo', 'follow', 'gerot', 'acoes', 'fim']), 'capa · sumário · Resumo · Follow-up S-1 · Gerot · Ações · encerramento', e.itens);
  t(e.vig === '2026-11-22', 'abre na semana do último dia com foto (22/11)', e.vig);
  t(e.cods === 'MCC T1,MCC T2', 'MCC = T1 + T2 (CGR fora)', e.cods);
  t(/S48 · 22\/11 a 28\/11/.test(e.sub), 'subtítulo com a semana', e.sub);

  // Resumo
  const r = await slideTxt(pg, 'resumo');
  t(/Score da semana/.test(r) && /vs S-1/.test(r) && /Posição/.test(r) && /Quebras Grandes/.test(r), 'Resumo: score, vs S-1, posição e quebras', r.slice(0, 200));
  const sc = await pg.evaluate(() => [valSem('score', '2026-11-22'), valSem('score', '2026-11-15')]);
  // 22/11 a 25/11: (95+91)/2 = 93 em 22, 23, 25; 24/11 = 89 → (93*3+89)/4 = 92
  t(Math.abs(sc[0] - 92) < 0.01 && Math.abs(sc[1] - 93) < 0.01, 'score da semana = média dos dias (92) e da S-1 (93)', sc);
  t(/1º de 2/.test(r), 'posição entre as unidades (MCC 1º, CGR 2º)', r.match(/Posição.{0,30}/));

  // Gerot
  const mx = await pg.evaluate((HOJE) => { const d = document.getElementById('prev').contentDocument; const tb = d.querySelector('table.rps-mx'); if (!tb) return null;
    const dias = [...tb.querySelectorAll('tr.h2 th.dia:not(.sem)')].map(th => th.textContent.trim());
    const linha = n => [...tb.querySelectorAll('tbody tr')].find(tr => (tr.querySelector('td.ind') || {}).textContent === n);
    const dp = linha('Disponibilidade'), qg = linha('Quebras Grandes'), scr = tb.querySelector('tr.score');
    const cel = (tr, dd) => { const c = tr && tr.querySelector(`td[data-d="${dd}"]`); return c ? { t: c.textContent, c: c.className } : null; };
    return { dias, sem: [...tb.querySelectorAll('tr.h1 th.sw')].map(x => x.textContent.trim()), dp24: cel(dp, '2026-11-24'), dp23: cel(dp, '2026-11-23'), qg18: (qg && qg.querySelector('td[data-w="2026-11-15"]') || {}).textContent, qg24: cel(qg, '2026-11-24'),
      sc24: cel(scr, '2026-11-24'), real: dp && dp.querySelectorAll('td')[2].textContent, temSep: !!tb.querySelector('tr.sep'),
      hoje: !!tb.querySelector(`td[data-d="${HOJE}"]`), nSem: tb.querySelectorAll('tr.h2 th.dia.sem').length,
      pvDl: (() => { const l = linha('Preventivas'); return l ? [l.querySelectorAll('td')[3].className, l.querySelectorAll('td')[4].className] : null; })(),
      cons: (() => { const l = linha('Consumo Km/L'); if (!l) return null; const td = l.querySelectorAll('td'); return { meta: td[1].textContent, real: td[2].textContent, dl: td[3].textContent, c22: cel(l, '2026-11-22'), c23: cel(l, '2026-11-23'), c25: cel(l, '2026-11-25'), sem: (l.querySelector('td.sem[data-w="2026-11-22"]') || {}).textContent }; })() }; }, HOJE);
  t(mx && mx.dias.length === 7, 'a semana da RPS abre em 7 dias', mx && mx.dias);
  t(mx && mx.sem.some(s => /^S47/.test(s)), 'as semanas anteriores do mês vêm fechadas (S47)', mx && mx.sem);
  t(mx && mx.dp24 && mx.dp24.t === '91%' && /cr/.test(mx.dp24.c), 'Disponibilidade em 24/11: 91% (média T1 e T2) em vermelho', mx && mx.dp24);
  t(mx && mx.dp23 && mx.dp23.t === '97%' && /cg/.test(mx.dp23.c), 'Disponibilidade em 23/11: 97% em verde', mx && mx.dp23);
  t(mx && mx.qg18 === '2', 'Quebras Grandes contam no dia do lançamento (18/11, T1 e T2 = 2 na S47)', mx && mx.qg18);
  t(mx && mx.qg24 && mx.qg24.t === '0', 'Quebras Grandes: 0 nos outros dias', mx && mx.qg24);
  t(mx && mx.sc24 && mx.sc24.t === '89,0', 'linha Score por dia', mx && mx.sc24);
  t(mx && mx.temSep, 'Custos separado no fim');
  t(mx && !mx.hoje, 'o dia de hoje não aparece (o dia entra quando acaba)', mx && mx.hoje);
  t(mx && mx.nSem === 4, 'Sem. nas três semanas fechadas e no fim da semana aberta', mx && mx.nSem);
  t(mx && mx.pvDl && mx.pvDl[0] === 'n cg' && mx.pvDl[1] === 'n cg', '▲ zero (Preventivas 100% de 100%) em verde', mx && mx.pvDl);
  t(mx && mx.cons && mx.cons.c22 && mx.cons.c22.t === '2,33' && /cg/.test(mx.cons.c22.c), 'Consumo 22/11: 700 km ÷ 300 L = 2,33, no remunerado (verde)', mx && mx.cons);
  t(mx && mx.cons && mx.cons.c23 && mx.cons.c23.t === '1,60' && /cr/.test(mx.cons.c23.c), 'Consumo 23/11: 1,60 contra 2,00 (vermelho)', mx && mx.cons);
  t(mx && mx.cons && !mx.cons.c25, 'Consumo depois do último dia completo do ERP fica vazio', mx && mx.cons);
  t(mx && mx.cons && mx.cons.real === '2,00' && mx.cons.meta === '2,20' && mx.cons.dl === '-0,20' && mx.cons.sem === '2,00', 'Consumo da semana: 1.100 km ÷ 550 L = 2,00 contra 2,20 de remunerado (régua de litros), Arla e CGR fora', mx && mx.cons);

  // detalhe do consumo
  await vaiItem(pg, 'gerot');
  await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; d.querySelector('td[data-k="cons"][data-d="2026-11-23"]').click(); });
  await pg.waitForTimeout(300);
  const dc = await pg.evaluate(() => ({ kp: document.getElementById('drK').innerText.replace(/\s+/g, ' '), bot: document.getElementById('drB').innerText.replace(/\s+/g, ' ') }));
  t(/Meta 2,00/i.test(dc.kp) && /MCC1A11/.test(dc.bot) && /1,60/.test(dc.bot), 'detalhe do consumo: meta do dia e as placas que abasteceram', dc);
  await pg.evaluate(() => fechaDr());

  // detalhe + gerar ação
  await vaiItem(pg, 'gerot');
  await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; d.querySelector('td[data-k="dp"][data-d="2026-11-24"]').click(); });
  await pg.waitForTimeout(300);
  const dr = await pg.evaluate(() => ({ on: document.getElementById('drF').classList.contains('on'), t: document.getElementById('drT').textContent, kp: document.getElementById('drK').innerText.replace(/\s+/g, ' '), linhas: document.querySelectorAll('#drB tbody tr').length, uni: document.getElementById('drU').value, donos: [...document.getElementById('drD').options].map(o => o.text) }));
  t(dr.on && /Disponibilidade · ter 24\/11\/2026/.test(dr.t), 'clicar no dia abre o detalhe do indicador', dr.t);
  t(/MCC T1/.test(dr.kp) && /MCC T2/.test(dr.kp), 'o detalhe abre por unidade (T1 e T2)', dr.kp);
  t(dr.linhas === 2, 'bottom do dia (as placas paradas das duas unidades)', dr.linhas);
  t(dr.uni === 'MCC T2' && dr.donos[0] === 'ERICK SILVA', 'a ação vai para a unidade pior, com o gestor de frota primeiro', dr);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'rps-detalhe.png') });
  await pg.fill('#drA', 'Cobrar a oficina pelas placas paradas');
  await pg.fill('#drP', '2026-12-01');
  await pg.evaluate(() => geraAcao()); await pg.waitForTimeout(500);
  const ins = await pg.evaluate(() => window.__ins.slice(-1)[0]);
  t(ins && ins.tab === 'plano_acao' && ins.r.origem === 'RPS' && ins.r.unidade === 'MCC T2' && ins.r.fato === 'Disponibilidade' && /^24\/11\/2026 · 91% \(meta 95%\) · RPS de 22\/11\/2026$/.test(ins.r.fato_desvio) && ins.r.prazo === '2026-12-01' && ins.r.vigencia === 'nov/26', 'Gerar ação grava no Plano de Ação (origem RPS)', ins);
  const ac = await slideTxt(pg, 'acoes');
  t(/Cobrar a oficina/.test(ac) && /24\/11/.test(ac) && /Disponibilidade/.test(ac), 'a ação entra no slide de Ações da semana', ac.slice(0, 300));
  t(await pg.evaluate(() => DECK[POS].item) === 'acoes', 'depois de gerar, a prévia vai para o slide de Ações');

  // follow-up S-1
  const fw = await slideTxt(pg, 'follow');
  t(/Calibrar a frota/.test(fw) && /Fechar as OS/.test(fw) && !/Outra unidade/.test(fw), 'Follow-up S-1: as ações da RPS de 15/11 da unidade', fw.slice(0, 300));
  t(/15\/11 a 21\/11/.test(fw), 'o follow-up diz a semana anterior');

  // editar uma ação no slide
  await pg.evaluate(() => abreAc('a2')); await pg.evaluate(() => { document.getElementById('acSt').value = 'Concluída'; }); await pg.evaluate(() => salvaAc()); await pg.waitForTimeout(300);
  const up = await pg.evaluate(() => window.__upd.slice(-1)[0]);
  t(up && up.tab === 'plano_acao' && up.id === 'a2' && up.p.status === 'Concluída', 'editar a ação no slide grava no plano_acao', up);

  // abrir a semana fechada
  await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; d.querySelector('th.sw[data-sem="2026-11-15"]').click(); });
  await pg.waitForFunction(() => { const f = document.getElementById('prev'); const d = f.contentDocument; return d && d.querySelectorAll('table.rps-mx tr.h2 th.dia:not(.sem)').length === 14; }, null, { timeout: 8000 }).catch(() => {});
  const n14 = await pg.evaluate(() => document.getElementById('prev').contentDocument.querySelectorAll('table.rps-mx tr.h2 th.dia:not(.sem)').length);
  t(n14 === 14, 'clicar na semana fechada abre os 7 dias dela', n14);

  // trocar de semana
  await pg.evaluate(() => { VIG = '2026-11-15'; ABERTAS = new Set(); filtros(); monta(); }); await pg.waitForTimeout(300);
  const fw2 = await slideTxt(pg, 'follow');
  t(/Nenhuma ação da RPS na semana anterior/.test(fw2), 'semana 15/11: o follow-up olha a semana de 08/11 (vazia)');
  t(!errs.length, 'sem erro de JavaScript', errs);
  await ctx.close();
}

console.log('2 · telas');
for (const [w, h, tema] of [[1366, 768, 'dark'], [1920, 1080, 'light']]) {
  const { ctx, pg, errs } = await abre({ w, h, tema });
  for (const it of ['resumo', 'gerot', 'follow', 'acoes']) {
    await vaiItem(pg, it); await pg.waitForTimeout(250);
    const m = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; const s = [...d.querySelectorAll('.slide')].find(x => x.style.display !== 'none'); const mi = s && s.querySelector('.miolo');
      return mi ? { sh: mi.scrollHeight, ch: mi.clientHeight, sw: mi.scrollWidth, cw: mi.clientWidth } : null; });
    t(m && m.sh <= m.ch + 2 && m.sw <= m.cw + 2, `${w}×${h} ${tema}: ${it} cabe no slide`, m);
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, `rps-${it}-${w}-${tema}.png`) });
  }
  const pag = await pg.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  t(pag.sh <= pag.ih + 1 && pag.sw <= pag.iw + 1, `${w}×${h}: a página não rola`, pag);
  t(!errs.length, 'sem erro de JavaScript', errs);
  await ctx.close();
}
await br.close(); srv.close();
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

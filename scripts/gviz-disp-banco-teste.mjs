/* O shim gviz-cache.js serve a aba Dispersão de km COM os meses do banco
   (Renan, 20/10/2026: "Porra cara. Sempre precisa estar atualizado", vendo a
   Ativação de Frota parada em ago/26). Chromium com o Supabase dublado:
   sh_dispersao_km com jan→ago/26 e dispersao_km com ago e set/26 (set com km
   rodado da planilha, set completado pela aba Km/L e set sem km nenhum).

   1. página mínima que faz o fetch do gviz: setembro entra no formato da aba
      (vigência Date(…), PROJ. - COD, frota ativa, viagens, km rem, km rodado,
      mapa aberto), ago/26 do banco NÃO entra (a aba já tem), a linha sem km
      fica fora e vai para GvizCache.dispBanco.sem;
   2. o mesmo pelo JSONP (responseHandler);
   3. com window.__gvizDispBanco = false (Painel KM, Árvore, FCA, Metas) a aba
      vem como está;
   4. sem o assets/dispersao-km.js alcançável, só a linha com km da planilha;
   5. a Ativação de Frota de verdade mostra set/26 no filtro e nos números.

   Uso: node scripts/gviz-disp-banco-teste.mjs
   (CHART_JS e DL_JS apontam para o Chart.js e o datalabels reais; sem eles
   a Ativação roda com um dublê de Chart) */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHART_JS = process.env.CHART_JS || '', DL_JS = process.env.DL_JS || '';
let ok = 0, falhas = 0;
const t = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✘ ') + m + (c || extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 300))); c ? ok++ : falhas++; };

const KEY = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM|s=Dispersão de km|g=|q=|h=';
const GVIZ = 'https://docs.google.com/spreadsheets/d/1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent('Dispersão de km');

// as 40 colunas da aba, na ordem do scripts/bases-manuais.sql (sh_dispersao_km)
const ROT = ['Vigência', 'Ano', 'Dias Úteis', 'Viagens Rem.', 'Km/Frota Ativa Rem.', 'Km/Frota Ativa Real', 'Δ (km/Frota Ativa)', 'Km/l Rem.', 'Km/ Real',
  'Litros Rem.', 'Litros Real', 'DRE Remunerado', 'DRE Realizado', 'UNID.', 'PROJ.', 'Mês', '[Mês]', 'Unidade', 'Unidade 2', 'Projeto', 'Projeto 2',
  'Frota Ativa', 'Viagens - Real', 'Km/Viagem Real', 'Km Rem. Mês', 'Viagens Rec. Real', 'Km/Viagem Rec. Rem.', 'Km Rec. Mês Real', 'Viagens Noturnas Real',
  'Km/Viagem Noturna Rem.', 'Km Rem. Noturna', 'Km Rem. TT', 'Km Rodado TT', 'Δ (km)', '%', 'R$/km', 'Impacto (BRL)', 'Impacto (BRL / Frota Ativa', 'Viagens Mapa Aberto', 'Km BM'];
const COLN = ['vigencia_orig', 'ano', 'dias_uteis', 'viagens_rem', 'km_frota_ativa_rem', 'km_frota_ativa_real', 'd_km_frota_ativa', 'km_l_rem', 'km_real',
  'litros_rem', 'litros_real', 'dre_remunerado', 'dre_realizado', 'unid', 'proj', 'mes', 'mes_16', 'unidade', 'unidade_2', 'projeto', 'projeto_2',
  'frota_ativa', 'viagens_real', 'km_viagem_real', 'km_rem_mes', 'viagens_rec_real', 'km_viagem_rec_rem', 'km_rec_mes_real', 'viagens_noturnas_real',
  'km_viagem_noturna_rem', 'km_rem_noturna', 'km_rem_tt', 'km_rodado_tt', 'd_km', 'pct', 'rs_km', 'impacto_brl', 'impacto_brl_frota_ativa', 'viagens_mapa_aberto', 'km_bm'];
const TXT = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const colunas = ROT.map((label, i) => ({ i, label, col: COLN[i], tipo: i === 0 ? 'date' : TXT.has(i) ? 'string' : 'number' }));

// a aba: jan→ago/26, três recortes
const ABA = [];
const RECS = [['PIR', 'ROTA', 20000, 21000, 10, 400], ['PIR', 'EMPURRADA', 300000, 330000, 40, 900], ['CBA', 'ROTA', 15000, 15500, 8, 300]];
let n = 0;
for (let m = 1; m <= 8; m++) RECS.forEach(([u, p, rem, real, fa, vg]) => ABA.push({ linha: ++n, vigencia_orig: `2026-${String(m).padStart(2, '0')}-01`, ano: 2026, unid: u, proj: `${p} - ${u}`,
  unidade: u === 'PIR' ? 'Piraí' : 'Cuiabá', projeto: p, frota_ativa: fa, viagens_real: vg, viagens_rec_real: 5, viagens_noturnas_real: 3, km_rem_tt: rem, km_rodado_tt: real, rs_km: 2, viagens_mapa_aberto: 1 }));
const shBase = [{ slug: 'dispersao_km', gviz_chave: KEY, colunas, linhas: ABA.length, erro: null, carregado_em: new Date().toISOString() }];
// o banco: ago (a aba já tem → fora), set com km da planilha, set completado pela Km/L, set sem km nenhum
const BANCO = [
  { vigencia: '2026-08', unidade: 'PIR', projeto: 'Rota', frota_ativa: 10, viagens_prim: 380, km_rem: 99999, km_real: 99999, fator_rskm: 2 },
  { vigencia: '2026-09', unidade: 'PIR', projeto: 'Rota', unidade_orig: 'Piraí -RJ', frota_ativa: 11, viagens_prim: 410, viagens_rec: 6, viagens_not: 2, viagens_mapa_aberto: 1, km_rem_prim: 19000, km_rem: 21000, km_real: 22500, fator_rskm: 2.5 },
  { vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', frota_ativa: 8, viagens_prim: 310, km_rem: 15200, km_real: null, fator_rskm: 2 },
  { vigencia: '2026-09', unidade: 'CBA', projeto: 'Empurrada - 28 Palets', frota_ativa: 20, viagens_prim: 500, km_rem: 100000, km_real: 104000, fator_rskm: 3 },
  { vigencia: '2026-09', unidade: 'GNA', projeto: 'Auto Serviço', frota_ativa: 3, viagens_prim: 40, km_rem: 5000, km_real: null, fator_rskm: 2 },
];
const PLACAS = [['CBA1A11', 'CBA', 'Rota', 7000], ['CBA2B22', 'CBA', 'Rota', 8200]].map(([placa, unidade, projeto, km_rem]) => ({ vigencia: '2026-09', unidade, projeto, placa, placa_origem: placa, km_rem }));
const KML = [['CBA1A11', 7100], ['CBA2B22', 8900], ['CBA2B22', 8900]].map(([placa, km]) => ({ vigencia: '09/2026', projeto: 'ROTA - CBA', placa, km_rodado_horas_trabalhadas: km }));   // placa repetida: conta uma vez
const KM_CBA_SET = 7100 + 8900;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__min.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(MIN); }
  let f = path.join(RAIZ, u); if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(0);
const PORT = srv.address().port;
const MIN = `<!doctype html><meta charset="utf-8"><script src="/assets/gviz-cache.js?v=t"></script><script>
window.__rows = null;
window.le = async () => { const txt = await (await fetch(${JSON.stringify(GVIZ)} + '&t=' + Date.now())).text();
  const j = JSON.parse(txt.match(/setResponse\\(([\\s\\S]*)\\);?$/)[1]); window.__rows = j.table.rows; return j; };
window.jsonp = () => new Promise(res => { window._gvX = o => res(o); const s = document.createElement('script');
  s.src = ${JSON.stringify(GVIZ.replace('tqx=out:json', 'tqx=out:json;responseHandler:_gvX'))}; document.head.appendChild(s); });
</script>`;

const json = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(url, { flag, semMotor = false, init } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  let google = 0;
  if (init) await pg.addInitScript(init);
  if (flag !== undefined) await pg.addInitScript(f => { window.__gvizDispBanco = f; }, flag);
  await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await pg.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    if (u.includes('chart.js') && CHART_JS) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.includes('datalabels') && DL_JS) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(DL_JS) });
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: '/*stub*/' });
  });
  await pg.route('**/docs.google.com/**', r => { google++; r.abort(); });
  if (semMotor) await pg.route('**/assets/dispersao-km.js*', r => r.fulfill({ status: 404, body: '' }));
  await pg.route('**/*.supabase.co/rest/v1/**', r => {
    const u = new URL(r.request().url()); const tab = u.pathname.split('/').pop();
    const range = r.request().headers()['range'] || '0-999'; const de = +range.split('-')[0];
    const pag = rows => de > 0 ? [] : rows;
    if (tab === 'sh_base') return r.fulfill(json(shBase));
    if (tab === 'sh_dispersao_km') return r.fulfill(json(pag(ABA)));
    if (tab === 'dispersao_km') return r.fulfill(json(pag(BANCO)));
    if (tab === 'dispersao_placa') return r.fulfill(json(pag(PLACAS)));
    if (tab === 'sh_consumo_km_litro') return r.fulfill(json(pag(KML)));
    return r.fulfill(json([]));
  });
  await pg.goto(`http://127.0.0.1:${PORT}${url}`);
  return { ctx, pg, erros, google: () => google };
}
const v = (row, i) => row.c[i] && row.c[i].v;
const vigDe = row => { const m = String(v(row, 0) || '').match(/^Date\((\d+),(\d+)/); return m ? m[1] + '-' + String(+m[2] + 1).padStart(2, '0') : ''; };

// ── 1 · fetch: setembro entra no formato da aba ───────────────────────────────
console.log('═══ 1 · fetch do gviz pela página mínima ═══');
{
  const { ctx, pg, erros, google } = await abre('/__min.html');
  const j = await pg.evaluate(() => window.le());
  const rows = j.table.rows;
  t(!erros.length && google() === 0, 'sem erro de página e sem pedido ao Google', erros);
  t(j.table.cols.length === 40 && rows.length === ABA.length + 3, 'a aba (24 linhas) + 3 de setembro; ago/26 do banco e GNA sem km ficam fora', rows.length);
  const set = rows.filter(r => vigDe(r) === '2026-09');
  const pir = set.find(r => v(r, 14) === 'ROTA - PIR'), cba = set.find(r => v(r, 14) === 'ROTA - CBA'), emp = set.find(r => v(r, 14) === 'EMPURRADA - CBA');
  t(!!pir && !!cba && !!emp, 'PROJ. - COD na convenção da aba (ROTA - PIR, ROTA - CBA, EMPURRADA - CBA)', set.map(r => v(r, 14)));
  t(pir && v(pir, 0) === 'Date(2026,8,1)' && pir.c[0].f === '01/09/2026', 'vigência como Date(2026,8,1)', pir && pir.c[0]);
  t(pir && v(pir, 1) === 2026 && v(pir, 2) === 26 && v(pir, 13) === 'PIR' && v(pir, 17) === 'Piraí -RJ' && v(pir, 19) === 'Rota', 'ano, dias úteis (seg–sáb de set/26 = 26), UNID., Unidade e Projeto', pir && [v(pir, 1), v(pir, 2), v(pir, 13), v(pir, 17), v(pir, 19)]);
  t(pir && v(pir, 21) === 11 && v(pir, 22) === 419 && v(pir, 25) === 6 && v(pir, 28) === 2 && v(pir, 38) === 1, 'frota ativa, viagens total (1ª+rec+not+mapa), rec, noturnas, mapa aberto', pir && [v(pir, 21), v(pir, 22), v(pir, 25), v(pir, 28), v(pir, 38)]);
  t(pir && v(pir, 31) === 21000 && v(pir, 32) === 22500 && v(pir, 33) === 1500 && v(pir, 35) === 2.5 && v(pir, 36) === 3750, 'km rem, km rodado (da planilha), Δ, R$/km e impacto', pir && [v(pir, 31), v(pir, 32), v(pir, 33), v(pir, 35), v(pir, 36)]);
  t(cba && v(cba, 32) === KM_CBA_SET && v(cba, 31) === 15200, 'CBA sem km na planilha: km rodado completado pela aba Km/L (placa repetida conta uma vez)', cba && [v(cba, 31), v(cba, 32)]);
  t(emp && v(emp, 32) === 104000 && v(emp, 21) === 20, 'Empurrada - 28 Palets vira EMPURRADA com o km da planilha', emp && [v(emp, 21), v(emp, 32)]);
  t(rows.filter(r => vigDe(r) === '2026-08').length === 3 && !rows.some(r => v(r, 31) === 99999), 'ago/26 continua o da aba (o do banco não entra)');
  const gc = await pg.evaluate(() => ({ fonte: window.GvizCache.fontes[Object.keys(window.GvizCache.fontes)[0]], disp: window.GvizCache.dispBanco }));
  t(/banco \+ dispersao_km \(2026-09\)/.test(gc.fonte) && gc.disp.vigs.join() === '2026-09' && gc.disp.sem.length === 1 && /GNA/.test(gc.disp.sem[0]), 'GvizCache.fontes diz "banco + dispersao_km (2026-09)" e dispBanco.sem lista GNA', gc);
  // 2 · JSONP
  const o = await pg.evaluate(() => window.jsonp());
  t(o && o.table.rows.length === ABA.length + 3 && o.table.rows.filter(r => String(r.c[0].v).startsWith('Date(2026,8')).length === 3, 'JSONP (responseHandler) recebe o mesmo payload com setembro', o && o.table.rows.length);
  await ctx.close();
}
// ── 3 · opt-out ───────────────────────────────────────────────────────────────
console.log('═══ 3 · window.__gvizDispBanco = false (quem junta o banco por conta própria) ═══');
{
  const { ctx, pg } = await abre('/__min.html', { flag: false });
  const j = await pg.evaluate(() => window.le());
  t(j.table.rows.length === ABA.length && !j.table.rows.some(r => vigDe(r) === '2026-09'), 'a aba vem como está, sem setembro', j.table.rows.length);
  const gc = await pg.evaluate(() => Object.values(window.GvizCache.fontes)[0]);
  t(gc === 'banco', 'fonte = banco', gc);
  await ctx.close();
}
// ── 4 · sem o motor ───────────────────────────────────────────────────────────
console.log('═══ 4 · assets/dispersao-km.js fora do ar ═══');
{
  const { ctx, pg } = await abre('/__min.html', { semMotor: true });
  const j = await pg.evaluate(() => window.le());
  const set = j.table.rows.filter(r => vigDe(r) === '2026-09');
  t(set.length === 2 && set.every(r => v(r, 32) != null) && !set.some(r => v(r, 14) === 'ROTA - CBA'), 'só as linhas com km rodado na planilha entram (CBA, que dependia da Km/L, fica fora)', set.map(r => [v(r, 14), v(r, 32)]));
  await ctx.close();
}
// ── 5 · a Ativação de Frota de verdade ────────────────────────────────────────
console.log('═══ 5 · /eficiencia-ativacao/ mostra setembro ═══');
{
  const init = () => { sessionStorage.setItem('gem_hub', '1'); localStorage.removeItem('bi_cache_ativacao_v2');
    if (!window.Chart) { window.Chart = class { constructor() {} destroy() {} update() {} resize() {} }; window.Chart.register = () => {}; window.ChartDataLabels = {}; } };
  const { ctx, pg, erros } = await abre('/eficiencia-ativacao/', { init });
  await pg.waitForFunction(() => typeof ALL !== 'undefined' && ALL.length > 0, null, { timeout: 15000 });
  const r = await pg.evaluate(() => ({ vigs: [...new Set(ALL.map(x => x.vig))].sort(), set: ALL.filter(x => x.vig === '09/2026').map(x => [x.und, x.proj, x.frota_ativa, x.viagens, x.rem, x.real_km, x.isEmp]),
    filtro: [...document.querySelectorAll('#ms-vig .ms-opt, #ms-vig label')].map(e => e.textContent.trim()).filter(Boolean), sub: (document.getElementById('titSub') || {}).textContent || '' }));
  t(!erros.length, 'sem erro de página', erros);
  t(r.vigs.includes('09/2026') && r.vigs.length === 9, 'ALL tem jan→set/26', r.vigs);
  t(r.set.length === 3 && r.set.some(x => x[0] === 'PIR' && x[1] === 'ROTA' && x[2] === 11 && x[3] === 419 && x[4] === 21000 && x[5] === 22500) && r.set.some(x => x[0] === 'CBA' && x[1] === 'EMPURRADA' && x[6] === true), 'set/26 por unidade × projeto com frota ativa, viagens, km rem e km rodado (Empurrada marcada)', r.set);
  t(r.filtro.some(x => /set\/2026/.test(x)), 'o filtro Vigência lista set/2026', r.filtro.slice(0, 4));
  t(/SET\/2026|set\/2026|09\/2026/i.test(r.sub), 'o subtítulo abre em set/26', r.sub);
  await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

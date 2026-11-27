// ============================================================================
// GAV Diário — a foto do dia dos indicadores do Gestão à Vista, por unidade, para
// a RPS de Frota (Renan, 27/11/2026: "Todos os indicadores devem dar pra clicar no
// dia, e abrir detalhamento com gráfico, bottom etc." e "Custos, deve aparecer uma
// linha chamada Quebras Grandes, onde o lançamento na carta de custo superar 10% do
// Remunerado").
//
// Abre o Gestão à Vista (admin) com os dados reais (Supabase só leitura com a
// service key, o mesmo desenho do Apresentacao Check), roda DENTRO da página as
// MESMAS contas do Ranking (unitStats, confDoEscopo, blzPct…) e grava uma linha por
// unidade em public.gav_diario (dia em Brasília). Cada indicador leva o valor, a
// classe de cor do Ranking (cg/cy/cr) e as piores placas (bottom, até 15).
// GAV_SECO=1 só imprime. Sem placa nem valor no log: só contagens.
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SECO = process.env.GAV_SECO === '1';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route('**/assets/assistente-flutuante.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route(SB + '/**', async r => {
  const u = r.request().url();
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(/vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '') ? { is_admin: true, nome: 'Robô' } : [{ is_admin: true, nome: 'Robô' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'robo', email: 'fortesindicadores@gmail.com' }) });
  const rq = r.request();
  if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
  if (rq.method() !== 'GET' && rq.method() !== 'HEAD' && !/\/rpc\//.test(u)) return r.fulfill({ status: 403, headers: CORS, body: '{"message":"robô: só leitura"}' });
  const hin = rq.headers(), h = { apikey: KEY, authorization: 'Bearer ' + KEY };
  ['accept', 'prefer', 'range', 'range-unit', 'content-type', 'accept-profile', 'content-profile'].forEach(k => { if (hin[k]) h[k] = hin[k]; });
  try {
    const resp = await fetch(u, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
    const body = Buffer.from(await resp.arrayBuffer());
    const out = { ...CORS, 'content-type': resp.headers.get('content-type') || 'application/json' };
    if (resp.headers.get('content-range')) out['content-range'] = resp.headers.get('content-range');
    return r.fulfill({ status: resp.status, headers: out, body });
  } catch (e) { return r.fulfill({ status: 599, headers: CORS, body: String(e) }); }
});
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  [pageerror]', e.message));
await pg.addInitScript(() => {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJyb2JvIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'robo', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated' } }));
  sessionStorage.setItem('gem_hub', '1');
});
const t0 = Date.now();
await pg.goto(BASE + '/gestao-a-vista/index.html?u=admin', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction('window.__gavPronto===true', null, { timeout: 300000, polling: 1000 });
console.log(`Gestão à Vista pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s`);

/* roda dentro da página: as funções e os dados do próprio Gestão à Vista */
const FOTO = async () => {
  try { if (typeof PNEUS_OK !== 'undefined' && !PNEUS_OK && typeof loadPneus === 'function') await loadPneus(); } catch (e) {}
  const B = 15, dd = d => d instanceof Date && !isNaN(d) ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() : (d || '');
  const nn = v => v == null || v === '' ? '' : v;
  const ord = (a, f) => a.slice().sort((x, y) => (f(y) || 0) - (f(x) || 0));
  const rows = (k, c) => { try { return (DATA[k] || []).filter(r => r.cod === c); } catch (e) { return []; } };
  const P = DATA.pneus || { tires: [], veic: [] };
  const placaDoVeic = {}; (P.tires || []).forEach(t => { if (t.veiculoId != null && t.placa) placaDoVeic[t.veiculoId] = t.placa; });
  const ref = P.ult || Date.now();
  const BOT = {
    sv: c => ord(rows('stressV', c).filter(r => r.desc > 0), r => r.desc).map(r => ({ Placa: r.placa, Projeto: nn(r.proj), Viagens: nn(r.viagens), Desconto: r.desc })),
    se: c => rows('stressE', c).filter(r => r.contratada && (r.d1 > 0 || r.d2 > 0)).map(r => ({ Placa: r.placa, '1ª quinzena': r.d1, '2ª quinzena': r.d2 })),
    cf: c => rows('cifv', c).filter(r => r.ad != null && r.ad < 1).map(r => ({ Placa: r.placa, Projeto: nn(r.proj), Status: nn(r.st) })),
    pv: c => ord(rows('prev', c).filter(r => r.ad != null && r.ad < 1), r => -(r.dias ?? 0)).map(r => ({ Placa: r.placa, Projeto: nn(r.proj), Modelo: nn(r.modelo), Status: nn(r.st), 'Dias p/ próxima': nn(r.dias) })),
    al: c => rows('alinh', c).filter(r => _n(r.st) === 'VENCIDO').map(r => ({ Placa: r.placa, Status: r.st, Dias: nn(r.dias) })),
    os: c => ord(rows('os', c).filter(r => (r.dias ?? 0) > OS_META), r => r.dias).map(r => ({ OS: r.os, Placa: nn(r.placa), Tipo: nn(r.tipo), Criticidade: nn(r.crit), 'Dias em aberto': nn(r.dias) })),
    ck: c => (DATA.chk || []).filter(r => r.cod === c && _n(r.tipo).includes('SAIDA')).map(r => ({ Data: dd(r.dt), Placa: nn(r.placa), Problema: nn(r.prob), OS: nn(r.os) })),
    dp: c => ord((DATA.dispInd || []).filter(r => r.cod === c), r => r.dias).map(r => ({ Placa: r.placa, Projeto: nn(r.proj), Grupo: nn(r.grupo), Parada: nn(r.dPar), 'Dias parada': nn(r.dias), Previsão: nn(r.prev) })),
    af: c => ord((P.veic || []).filter(v => v.cod === c && (ref - v.dt.getTime()) > 30 * 864e5), v => ref - v.dt.getTime()).map(v => ({ Placa: placaDoVeic[v.veiculoId] || '—', 'Última aferição': dd(v.dt), Dias: Math.round((ref - v.dt.getTime()) / 864e5) })),
    mm: c => (P.tires || []).filter(t => t.cod === c && (t.st === 'Bloquear' || t.st === 'Recapar')).map(t => ({ Placa: t.placa, Posição: nn(t.nomePosicao), Situação: t.st, 'Sulco (mm)': nn(t.mm) })),
    ca: c => ord((P.tires || []).filter(t => t.cod === c && t.pIdeal > 0 && t.desv != null && Math.abs(t.desv) > 10), t => Math.abs(t.desv)).map(t => ({ Placa: t.placa, Posição: nn(t.nomePosicao), 'Desvio da pressão (%)': Math.round(t.desv) })),
    conf: c => (typeof CONFD !== 'undefined' && CONFD ? CONFD : []).filter(r => r.cod === c && /NUNCA|NAO REALIZADO|NÃO REALIZADO/i.test(_n(r.status))).map(r => ({ Placa: r.placa, Projeto: nn(r.proj), Status: r.status, Vencimento: dd(r.venc) })),
    blz: c => ord((DATA.blitz || []).filter(r => r.cod === c && (r.nunca + r.nao + r.fora) > 0), r => -(r.dias ?? 0)).map(r => ({ Placa: r.placa, 'Última blitz': dd(r.ult), Limite: dd(r.lim), Dias: nn(r.dias) })),
    docs: c => ord((DATA.docs || []).filter(r => r.cod === c && r.dias != null && r.dias <= 7), r => -(r.dias)).map(r => ({ Placa: r.placa, Documento: r.doc, Vence: dd(r.prox), Dias: r.dias })),
  };
  // QUEBRAS GRANDES: lançamento da Carta do mês acima de 10% do remunerado da conta na unidade
  let LANC = [], qErro = '';
  try {
    const sbc = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const vig = CartaCalc.mesCorrenteBR();
    const r = await CartaCalc.lerLancamentos(sbc, Object.keys(UNIDADES), [vig]);
    if (r.erro) qErro = r.erro.message || String(r.erro); LANC = (r.data || []).filter(l => !l.origem);
  } catch (e) { qErro = e.message || String(e); }
  const canon = c => (CartaCalc.canonConta ? CartaCalc.canonConta(c) : c);
  const out = {};
  Object.keys(UNIDADES).forEach(c => {
    const s = unitStats(c);
    const conf = typeof confDoEscopo === 'function' ? confDoEscopo(c) : null;
    const fca = typeof fcaDoEscopo === 'function' ? fcaDoEscopo(c) : null;
    const ab = (DATA.blitz || []).filter(r => r.cod === c), blz = ab.length && typeof blzPct === 'function' ? blzPct(ab) : null;
    const dv = (DATA.docs || []).filter(r => r.cod === c), dvenc = DATA.docs ? dv.filter(r => r.dias != null && r.dias < 0).length + (DATA.docsPend || []).filter(r => r.cod === c).length : null, d7 = dv.filter(r => r.dias != null && r.dias >= 0 && r.dias <= 7).length;
    const rem = {}; (DATA.custos || []).filter(x => x.cod === c).forEach(x => { rem[canon(x.conta)] = (rem[canon(x.conta)] || 0) + Math.abs(x.rem || 0); });
    const qb = LANC.filter(l => l.unidade === c).map(l => { const ct = canon(l.conta), rm = rem[ct] || 0; return { l, ct, rm }; })
      .filter(x => x.rm > 0 && Math.abs(+x.l.valor || 0) > 0.1 * x.rm)
      .map(x => ({ Data: x.l.data ? String(x.l.data).slice(0, 10).split('-').reverse().join('/') : '', dia: x.l.data ? String(x.l.data).slice(0, 10) : '', Conta: x.ct, Grupo: x.l.grupo || '', Placa: x.l.equipamento || '', Fornecedor: x.l.fornecedor || '', Valor: Math.round(+x.l.valor || 0), 'Rem. da conta': Math.round(x.rm), '% do rem.': Math.round(Math.abs(+x.l.valor || 0) / x.rm * 100) }));
    const ind = {};
    const put = (k, v, cls, fn) => { let b = []; try { b = fn ? fn(c) : []; } catch (e) { b = []; } ind[k] = { v: v == null ? null : Math.round(v * 10) / 10, cls, n: b.length, b: b.slice(0, B) }; };
    put('dp', s.dp, dispCls(s.dp), BOT.dp);
    put('pv', s.pv, clsPctMeta(s.pv), BOT.pv);
    put('af', s.af, clsPctMeta(s.af, 95, 85), BOT.af);
    put('mm', s.mm, clsPctMeta(s.mm, 90, 75), BOT.mm);
    put('ca', s.ca, clsPctMeta(s.ca, 90, 75), BOT.ca);
    put('al', s.al, s.al == null ? 'mut' : s.al >= 80 ? 'cg' : 'cr', BOT.al);
    put('sv', s.sv, clsPctMeta(s.sv), BOT.sv);
    put('se', s.se, clsPctMeta(s.se), BOT.se);
    put('cf', s.cf, clsPctMeta(s.cf), BOT.cf);
    put('os', s.os, s.os == null ? 'mut' : s.os >= 90 ? 'cg' : s.os >= 70 ? 'cy' : 'cr', BOT.os);
    put('ck', s.ck, s.ck == null ? 'mut' : s.ck >= 100 ? 'cg' : 'cr', BOT.ck);
    put('conf', conf, clsPctMeta(conf, 100, 90), BOT.conf);
    put('blz', blz, clsPctMeta(blz, 100, 90), BOT.blz);
    put('fca', fca, fca == null ? 'mut' : fca < 70 ? 'cr' : fca < 85 ? 'cy' : 'cg', null);
    put('docs', dvenc, dvenc == null ? 'mut' : dvenc ? 'cr' : d7 ? 'cy' : 'cg', BOT.docs);
    ind.qg = { v: qErro ? null : qb.length, cls: qErro ? 'mut' : qb.length ? 'cr' : 'cg', n: qb.length, b: qb.slice(0, 40), erro: qErro || undefined };
    const score = avgA([s.sv, s.se, s.cf, s.pv, s.al, s.os, s.dp, s.af, s.mm, s.ca]);
    out[c] = { score: score == null ? null : Math.round(score * 10) / 10, ind };
  });
  return out;
};
const foto = await pg.evaluate(FOTO);
const dia = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const linhas = Object.entries(foto).map(([unidade, dados]) => ({ dia, unidade, dados, updated_at: new Date().toISOString() }));
for (const l of linhas) {
  const i = l.dados.ind, cont = Object.keys(i).map(k => `${k} ${i[k].v == null ? '—' : i[k].v}${i[k].n ? '(' + i[k].n + ')' : ''}`).join(' · ');
  console.log(`${l.unidade.padEnd(10)} score ${l.dados.score ?? '—'} · ${cont}`);
}
if (SECO) console.log(`seco: ${linhas.length} unidades, nada gravado`);
else {
  const res = await fetch(`${SB}/rest/v1/gav_diario?on_conflict=dia,unidade`, { method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(linhas) });
  if (!res.ok) { console.log(`::error::gav_diario não gravou: ${res.status} ${(await res.text()).slice(0, 200)}`); await nav.close(); srv.close(); process.exit(1); }
  console.log(`gravado: ${linhas.length} unidades em ${dia}`);
}
await nav.close(); srv.close();

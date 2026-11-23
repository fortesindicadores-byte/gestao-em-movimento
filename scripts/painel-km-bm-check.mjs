// ============================================================================
// Painel KM BM Check — abre o /painel-km/ com os dados REAIS (mesmo truque do
// FCA Automatico Check: banco lido com a service key pelo Node) e imprime o
// balanço de massa que O PRÓPRIO PAINEL calculou: por mês, por unidade|projeto,
// km remunerado original, km recomposto, valor e km realizado. Só leitura.
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route('https://lozwipoeacpvplgkrxkq.supabase.co/**', async r => {
  const u = r.request().url();
  if (process.env.SEM_BM === '1' && /\/rest\/v1\/balanco_massa/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '') ? { is_admin: true, nome: 'Check' } : [{ is_admin: true, nome: 'Check' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'check', email: 'check@local' }) });
  // o Supabase recusa a service key vinda de navegador ("Forbidden use of secret API key in browser"):
  // o pedido sai do Node, com a chave, e a resposta volta para a página
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  const rq = r.request();
  if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
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
pg.on('console', m => { const t = m.text(); if (m.type() !== 'log' || /balan/i.test(t)) console.log('  [console]', t.slice(0, 600)); });
const SET = process.env.SET === '1'; console.log(SET ? 'SIMULAÇÃO: set/26 do banco LIGADO' : 'painel como está publicado');
await pg.addInitScript((SET) => {
  sessionStorage.setItem('gem_hub', '1'); if (SET) window.__dispBanco = true; try { Object.keys(localStorage).filter(k => /^bi_cache_km/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'check', email: 'check@local', aud: 'authenticated', role: 'authenticated' } }));
}, SET);
const t0 = Date.now();
await pg.goto(BASE + '/painel-km/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof ALL !== 'undefined' && ALL.length && ALL.some(r => 'rem0' in r), { timeout: 300000 });
await pg.waitForTimeout(3000);
console.log(`carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s · build ${await pg.evaluate(() => document.querySelector('meta[name=build]').content)}`);
const R = await pg.evaluate(() => {
  const g = {}, v = {};
  ALL.forEach(r => { const k = r.vig + ' ' + r.und + ' ' + r.proj; const t = g[k] = g[k] || { rem0: 0, recomp: 0, bm: 0, real: 0 };
    t.rem0 += r.rem0 || 0; t.recomp += r.recomp || 0; t.bm += r.bmValor || 0; t.real += r.real || 0;
    const w = v[r.vig] = v[r.vig] || { rem0: 0, recomp: 0, bm: 0, real: 0, imp: 0 }; w.rem0 += r.rem0 || 0; w.recomp += r.recomp || 0; w.bm += r.bmValor || 0; w.real += r.real || 0; w.imp += r.imp || 0; });
  return { g, v, dbm: (document.getElementById('d-bm') || {}).textContent, sub: (document.getElementById('titSub') || {}).textContent };
});
const br = n => Math.round(n).toLocaleString('pt-BR');
console.log('topo:', R.sub, '· balanço no topo:', R.dbm);
console.log('\n── por mês (todas as unidades) ──');
Object.entries(R.v).sort((a, b) => (a[0].slice(3) + a[0].slice(0, 2)).localeCompare(b[0].slice(3) + b[0].slice(0, 2))).forEach(([k, t]) =>
  console.log(`${k}  real ${br(t.real)} · rem orig ${br(t.rem0)} · recomp +${br(t.recomp)} km · R$ ${br(t.bm)} · Δ% ${((t.real - t.rem0 - t.recomp) / (t.rem0 + t.recomp) * 100).toFixed(1)}% · impacto ${br(t.imp)}`));
console.log('\n── chaves com balanço ──');
Object.entries(R.g).filter(([, t]) => t.recomp || t.bm).sort().forEach(([k, t]) => console.log(`${k.padEnd(32)} rem orig ${br(t.rem0).padStart(9)} · recomp +${br(t.recomp).padStart(7)} · R$ ${br(t.bm).padStart(9)} · real ${br(t.real).padStart(9)}`));

// ── R$/km e impacto de UMA unidade num mês, chave a chave (Renan, 23/11/2026: "o impacto tá certo? R$/km total está certo?") ──
const UNI = (process.env.UNI || '').trim().toUpperCase(), VIGU = (process.env.VIG || '').trim();
if (UNI && VIGU) {
  const X = await pg.evaluate(async ({ UNI, VIGU }) => {
    const linhas = ALL.filter(r => r.vig === VIGU && String(r.und).toUpperCase() === UNI)
      .map(r => ({ proj: r.proj, rem: r.rem, rem0: r.rem0 != null ? r.rem0 : r.rem, real: r.real, rsKm: r.rsKm, imp: r.imp, fonte: r.fonteKm || 'aba' }));
    const c = await fetchCustoRem(); const tot = {}, cta = {};
    Object.keys(c.cta).filter(k => k.startsWith(VIGU + '|') && k.split('|')[1] === UNI).forEach(k => { tot[k] = c.tot[k] || 0; cta[k] = c.cta[k]; });
    return { linhas, tot, cta };
  }, { UNI, VIGU });
  console.log(`\n── ${UNI} · ${VIGU}: linhas do painel ──`);
  let sR = 0, sK = 0, sI = 0, sR0 = 0;
  X.linhas.forEach(l => { sR += l.rem; sR0 += l.rem0; sK += l.real; sI += l.imp;
    console.log(`${String(l.proj).padEnd(16)} rem ${br(l.rem).padStart(8)} (orig ${br(l.rem0).padStart(8)}) · real ${br(l.real).padStart(8)} · Δ ${br(l.real - l.rem).padStart(7)} · R$/km ${l.rsKm.toFixed(3)} · impacto ${br(l.imp).padStart(8)} · km: ${l.fonte}`); });
  console.log(`TOTAL            rem ${br(sR).padStart(8)} (orig ${br(sR0).padStart(8)}) · real ${br(sK).padStart(8)} · Δ ${br(sK - sR).padStart(7)} · impacto ${br(sI).padStart(8)} · R$/km efetivo ${(sI / (sK - sR)).toFixed(3)}`);
  console.log(`\n── ${UNI} · ${VIGU}: remunerado da aba Frota do DRE, por projeto e conta (R$) ──`);
  let g3 = 0, gT = 0;
  Object.keys(X.cta).sort().forEach(k => { const t = Object.values(X.cta[k]).reduce((a, b) => a + b, 0); g3 += X.tot[k]; gT += t;
    console.log(`${k.padEnd(34)} 3 pacotes ${br(X.tot[k]).padStart(9)} · todas as contas ${br(t).padStart(9)}`);
    Object.entries(X.cta[k]).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => console.log(`    ${c.padEnd(44)} ${br(v).padStart(9)}`)); });
  console.log(`TOTAL da unidade: 3 pacotes ${br(g3)} · todas as contas ${br(gT)} · 3 pacotes ÷ km rem orig = ${(g3 / sR0).toFixed(3)} · ÷ km rem = ${(g3 / sR).toFixed(3)}`);
}

// ── Revisão de km e Revisão no Ano (Renan, 18/11/2026): as duas tabelas como a tela mostra ──
for (const [vw, tb] of [['revisao', 'tbl-rv'], ['revano', 'tbl-ra']]) {
  await pg.evaluate(v => setVw(v), vw);
  await pg.waitForFunction(id => { const b = document.querySelector('#' + id + ' tbody'); return b && !/Carregando/.test(b.textContent); }, tb, { timeout: 120000 }).catch(() => {});
  const T = await pg.evaluate(id => [...document.querySelectorAll('#' + id + ' tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | ')), tb);
  console.log(`\n── ${vw} ──`); T.forEach(l => console.log(l));
  console.log(await pg.evaluate(() => (document.querySelector('.vw.on .tsub') || {}).textContent || ''));
}
await nav.close(); srv.close();

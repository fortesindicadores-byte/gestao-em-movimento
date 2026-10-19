// ============================================================================
// Metas Dispersao Check — abre o /painel-metas/ e o /painel-km/ com os dados REAIS
// (banco lido com a service key pelo Node, como no Painel KM BM Check) e imprime,
// mês a mês, a Dispersão de km que o Painel de Metas calculou (ROTA + AS +
// Empurrada com o balanço de massa, set/26 do banco) ao lado da mesma conta feita
// com as linhas do Painel KM. Os dois têm de bater. Só leitura.
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

const prep = async pg => {
  pg.on('pageerror', e => console.log('  [pageerror]', e.message));
  pg.on('console', m => { const t = m.text(); if (m.type() !== 'log' || /metas|disp/i.test(t)) console.log('  [console]', t.slice(0, 400)); });
  await pg.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1'); try { Object.keys(localStorage).forEach(k => { if (/^bi_cache_km|^pm_cache/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
      user: { id: 'check', email: 'check@local', aud: 'authenticated', role: 'authenticated' } }));
  });
};
const pm = await ctx.newPage(); await prep(pm);
let t0 = Date.now();
await pm.goto(BASE + '/painel-metas/index.html', { waitUntil: 'domcontentloaded' });
await pm.waitForFunction(() => typeof ALL !== 'undefined' && ALL.length && !/Carregando|atualizando/.test(document.getElementById('titSub').textContent), { timeout: 300000 });
console.log(`Painel de Metas carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s · build ${await pm.evaluate(() => document.querySelector('meta[name=build]').content)}`);
const M = await pm.evaluate(() => ({ fonte: typeof DISP_FONTE !== 'undefined' ? DISP_FONTE : '(sem DISP_FONTE)', sub: document.getElementById('titSub').textContent,
  linhas: ALL.filter(o => /dispers/i.test(o.indicador)).map(o => ({ vig: o.vig, meta: o.meta, real: o.real, atg: o.atg, pontos: o.pontos })) }));
console.log('topo:', M.sub); console.log('fonte da dispersão:', M.fonte || 'banco completo');
const km = await ctx.newPage(); await prep(km);
t0 = Date.now();
await km.goto(BASE + '/painel-km/index.html', { waitUntil: 'domcontentloaded' });
await km.waitForFunction(() => typeof ALL !== 'undefined' && ALL.length && ALL.some(r => 'rem0' in r), { timeout: 300000 });
await km.waitForTimeout(3000);
console.log(`Painel KM carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const K = await km.evaluate(() => {
  const v = {}, projs = {};
  ALL.forEach(r => { const p = String(r.proj || '').toUpperCase(); projs[p] = (projs[p] || 0) + 1;
    const grupo = /^ROTA$/.test(p) ? 'ROTA' : /AUTO/.test(p) ? 'AS' : /EMPURR|INSUMO/.test(p) ? 'EMP' : 'outro';
    const t = v[r.vig] = v[r.vig] || {}; const g = t[grupo] = t[grupo] || { rem: 0, real: 0, rem0: 0 };
    g.rem += (r.rem0 || 0) + (r.recomp || 0); g.rem0 += r.rem0 || 0; g.real += r.real || 0; });
  return { v, projs };
});
console.log('projetos no Painel KM:', JSON.stringify(K.projs));
const vk = s => { const m = String(s).match(/(\d{2})\/(\d{4})/); return m ? m[2] + m[1] : s; };
const kmVigs = Object.keys(K.v).sort((a, b) => vk(a).localeCompare(vk(b)));
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lbl = s => { const m = String(s).match(/(\d{2})\/(\d{4})/); return m ? MES[+m[1] - 1] + '/' + m[2].slice(2) : s; };
console.log('\n── Dispersão de km YTD: Painel de Metas × Painel KM (ROTA + AS + Empurrada com BM) ──');
const acc = {}, accRA = {}, accBruto = {};
kmVigs.forEach(v => { const y = vk(v).slice(0, 4), t = K.v[v];
  const soma = (gs, f) => gs.reduce((s, g) => s + ((t[g] || {})[f] || 0), 0);
  const a = acc[y] = acc[y] || { rem: 0, real: 0 }; a.rem += soma(['ROTA', 'AS', 'EMP'], 'rem'); a.real += soma(['ROTA', 'AS', 'EMP'], 'real');
  const b = accRA[y] = accRA[y] || { rem: 0, real: 0 }; b.rem += soma(['ROTA', 'AS'], 'rem'); b.real += soma(['ROTA', 'AS'], 'real');
  const c = accBruto[y] = accBruto[y] || { rem: 0, real: 0 }; c.rem += soma(['ROTA', 'AS', 'EMP'], 'rem0'); c.real += soma(['ROTA', 'AS', 'EMP'], 'real');
  const pct = o => o.rem ? ((o.real - o.rem) / o.rem * 100).toFixed(2) + '%' : '—';
  const l = M.linhas.find(x => x.vig === lbl(v));
  console.log(`${lbl(v).padEnd(7)} metas ${(l && l.real != null ? l.real.toFixed(2) + '%' : '—').padStart(8)} · KM c/ Emp+BM ${pct(a).padStart(8)} · KM só ROTA+AS ${pct(b).padStart(8)} · KM c/ Emp sem BM ${pct(c).padStart(8)}${l ? ' · pontos ' + (l.pontos || 0).toFixed(1) : ''}`);
});
const sem = M.linhas.filter(l => !kmVigs.some(v => lbl(v) === l.vig));
if (sem.length) console.log('meses do Painel de Metas sem linha no Painel KM:', sem.map(l => l.vig + ' ' + (l.real != null ? l.real.toFixed(2) + '%' : '—')).join(' · '));
await nav.close(); srv.close();

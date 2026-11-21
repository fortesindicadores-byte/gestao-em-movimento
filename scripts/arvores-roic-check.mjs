// ============================================================================
// Arvores ROIC Check — abre o /arvores/ com os dados reais (service key, só leitura)
// e imprime o ROIC pela MESMA roicDe da página: por mês, por operação, por
// unidade e os recortes do último mês acima de 40% ou sem capital.
// Renan, 21/11/2026: "tem ROIC de 213%?"
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route('https://lozwipoeacpvplgkrxkq.supabase.co/**', async r => {
  const u = r.request().url();
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(/vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '') ? { is_admin: true, nome: 'Check' } : [{ is_admin: true, nome: 'Check' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'check', email: 'fortesindicadores@gmail.com' }) });
  const rq = r.request();
  if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
  if (rq.method() !== 'GET' && rq.method() !== 'HEAD' && !/\/rpc\//.test(u)) return r.fulfill({ status: 403, headers: CORS, body: '{"message":"check: só leitura"}' });
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
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [console]', m.text().slice(0, 220)); });
await pg.addInitScript(() => {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'check', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated' } }));
  sessionStorage.setItem('gem_hub', '1');
});
await pg.goto(BASE + '/arvores/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof VIGS !== 'undefined' && VIGS.length && Object.keys(DRE).length, null, { timeout: 300000, polling: 1000 });
await pg.waitForTimeout(2000);
const out = await pg.evaluate(async (ANO) => {
  const L = [], mi = v => (v / 1e6).toFixed(2), p = v => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(1) + '%';
  const vigs = VIGS.filter(v => v.startsWith(ANO)).sort();
  L.push('vigências com receita: ' + VIGS.slice().sort().join(' '));
  for (const v of vigs) { try { await capMes(v); } catch (e) { L.push(v + ' capMes ERRO ' + (e.message || e)); } }
  const linha = (rot, vv, f) => { const R = roicDe(vv, f); return `${rot.padEnd(26)} ROIC ${p(R.roic).padStart(8)} · pré-IR ${p(R.roicPre).padStart(8)} · EBIT/mês ${mi(R.ebit / R.n)} mi · cap ${mi(R.cap)} mi (${R.qtd.toFixed(0)} eq) · rec/mês ${mi(R.rec / R.n)} mi · dep ${R.mesesEst.length ? 'FT' : 'DRE'}`; };
  L.push('', '== por mês (tudo) ==');
  vigs.forEach(v => { const c = CAP[v] || []; const t = {}; c.forEach(e => { t[e.tipo] = (t[e.tipo] || 0) + 1; });
    L.push(linha(v, [v], () => true) + ' · ' + Object.entries(t).map(([k, n]) => k + ' ' + n).join(', ')); });
  L.push('', '== ano ' + ANO + ' por operação ==');
  OP_ORD.forEach(o => L.push(linha(o, vigs, op => op === o)));
  L.push('', '== ano ' + ANO + ' por unidade ==');
  UNIS.forEach(u => L.push(linha(u, vigs, (op, uni) => uni === u)));
  L.push('', '== último mês ' + vigs[vigs.length - 1] + ' por unidade × operação (só ROIC > 40% ou cap 0 com EBIT) ==');
  const ult = [vigs[vigs.length - 1]];
  UNIS.forEach(u => OP_ORD.forEach(o => { const R = roicDe(ult, (op, uni) => op === o && uni === u); if (!R.rec && !R.cap) return;
    if ((R.roic != null && Math.abs(R.roic) > 0.4) || (!R.cap && R.ebit)) L.push(linha(u + ' ' + o, ult, (op, uni) => op === o && uni === u)); }));
  L.push('', '== chaves do DRE sem capital no ano (op|uni : EBIT/mês) ==');
  const k = {}; Object.keys(DRE).forEach(x => { const [v, op, uni] = x.split('|'); if (v.startsWith(ANO)) k[op + '|' + uni] = 1; });
  Object.keys(k).sort().forEach(x => { const [o, u] = x.split('|'); const R = roicDe(vigs, (op, uni) => op === o && uni === u); if (!R.cap) L.push('  ' + x + ' : ' + mi(R.ebit / R.n)); });
  L.push('', 'filtros salvos no navegador: n/a (check limpo)');
  return L.join('\n');
}, process.env.ROIC_ANO || '2026');
console.log(out);
await nav.close(); srv.close();

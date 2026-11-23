// ============================================================================
// Rem Meta Check — abre a Visão Financeira com os dados reais (service key, só
// leitura) e imprime o Rem Meta × Rem DRE pela MESMA rmCalc da página: por mês,
// por componente no ano e por unidade e projeto no último mês.
// Renan, 23/11/2026: "Visão Rem Meta vs Rem DRE sim, quero".
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
  localStorage.setItem('gem_perfil_check', JSON.stringify({ is_admin: true }));
  sessionStorage.setItem('gem_hub', '1');
});
await pg.goto(BASE + '/visao-financeira/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof allRows !== 'undefined' && allRows.length > 500 && !/Carregando/.test(document.getElementById('titSub').textContent), null, { timeout: 300000, polling: 1000 });
const out = await pg.evaluate(async (ANO) => {
  const L = [], k = v => (v / 1e3).toFixed(0).padStart(8), p = (a, b) => b ? ((a / b - 1) * 100).toFixed(1).padStart(6) + '%' : '     —';
  L.push('fonte do DRE: ' + JSON.stringify(FONTE_TAB) + ' · linhas ' + allRows.length);
  setVw('remmeta'); await RM_P;
  if (!RM) { L.push('REM META NÃO MONTOU: ' + RM_ERR); return L; }
  L.push('meses com km: ' + [...RM.vigsKm].sort().join(' '));
  L.push('meses com FT: ' + [...RM.vigsFT].sort().join(' '));
  L.push('meses da Dispersão que vieram do banco: ' + (RM.bancoVigs.join(' ') || '(nenhum)') + ' · erros: ' + JSON.stringify(RM.erros));
  L.push('último mês com DRE: ' + lastRealVigKey());
  const F = o => Object.assign({ ano: [], vig: [], uni: [], nv3: [], pac: [], cta: [] }, o);
  const meses = [...RM.vigsKm].filter(v => v.startsWith(ANO) && RM.vigsFT.has(v) && v <= lastRealVigKey()).sort();
  L.push(''); L.push('── por mês (R$ mil) · Rem Meta · Rem DRE · ▲ · ▲% ──');
  meses.forEach(v => { const Q = rmCalc(F({ vig: [v] }), 'comp'); L.push(v + k(Q.T.mM) + k(Q.T.mD) + k(Q.T.mD - Q.T.mM) + ' ' + p(Q.T.mD, Q.T.mM) + (Q.vanNaRota ? '  (Van na Rota)' : '')); });
  const ult = meses[meses.length - 1];
  for (const [t, f] of [['ano ' + ANO + ' até ' + ult, F({ vig: meses })], ['último mês ' + ult, F({ vig: [ult] })]]) {
    L.push(''); L.push('── por componente · ' + t + ' (R$ mil) ──');
    const Q = rmCalc(f, 'comp'); Q.rows.concat([Object.assign({ k: 'TOTAL' }, Q.T)]).forEach(x => L.push(x.k.padEnd(36) + k(x.mM) + k(x.mD) + k(x.mD - x.mM) + ' ' + p(x.mD, x.mM)));
    L.push(''); L.push('── por projeto · ' + t + ' (R$ mil) ──');
    const P = rmCalc(f, 'proj'); P.rows.forEach(x => L.push(x.k.padEnd(36) + k(x.mM) + k(x.mD) + k(x.mD - x.mM) + ' ' + p(x.mD, x.mM)));
  }
  L.push(''); L.push('── por unidade e projeto · ' + ult + ' (R$ mil) ──');
  rmCalc(F({ vig: [ult] }), 'uniproj').rows.forEach(x => L.push(x.k.replace('|', ' ').padEnd(36) + k(x.mM) + k(x.mD) + k(x.mD - x.mM) + ' ' + p(x.mD, x.mM)));
  L.push(''); L.push('── por componente e projeto · ' + ult + ' (R$ mil) ──');
  ['ROTA', 'ROTA (VAN)', 'AUTO SERVIÇO', 'EMPURRADA', 'INSUMOS', 'APOIO'].forEach(pj => { const Q = rmCalc(F({ vig: [ult], nv3: [pj] }), 'comp'); if (!Q.rows.length) return;
    L.push(pj); Q.rows.forEach(x => L.push('  ' + x.k.padEnd(34) + k(x.mM) + k(x.mD) + k(x.mD - x.mM) + ' ' + p(x.mD, x.mM))); });
  // a tela
  const w = document.getElementById('ms-vig'); w._sel = new Set([ult]); if (w._render) w._render(''); atualizar();
  L.push(''); L.push('tela (' + document.getElementById('titSub').textContent + '): ' + document.querySelectorAll('#body-rm tr').length + ' linhas · nota: ' + document.getElementById('pe-rm').textContent.slice(0, 60));
  return L;
}, process.env.REM_ANO || '2026');
console.log(out.join('\n'));
await nav.close(); srv.close();

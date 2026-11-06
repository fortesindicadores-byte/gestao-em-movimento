// ============================================================
// App do celular — REPLAY dos resumos lidos pelo App Check.
// O App Check (Actions) grava, por painel, o JSON do que o app leu (PN_DATA)
// e um print. Este script abre o app AQUI (sem banco, sem iframe) com esses
// JSONs no cache do app e tira um print por painel: é como ver o desenho do
// app com os números reais, fora do Actions, para ajustar o layout.
//   node scripts/app-replay.mjs <pasta com os *.json> <pasta dos prints> [ids]
// Libs locais (o sandbox não alcança os CDNs): SBJS=<supabase.js umd>
// CHART_JS=<chart.umd.js>; sem elas procura na pasta do scratchpad.
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [,, ENTRADA, SAIDA, IDS_ARG] = process.argv;
if (!ENTRADA || !SAIDA) { console.log('uso: node scripts/app-replay.mjs <pasta dos json> <pasta dos prints> [ids]'); process.exit(1); }
const RAIZ = process.cwd();
const acha = (env, nome) => {
  if (process.env[env] && fs.existsSync(process.env[env])) return process.env[env];
  const pilha = ['/tmp/claude-0'];
  while (pilha.length) { const d = pilha.pop(); let ls = []; try { ls = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of ls) { const f = path.join(d, e.name); if (e.isDirectory() && !/node_modules|\.git$/.test(e.name)) pilha.push(f); else if (e.name === nome) return f; } }
  return '';
};
const SBJS = acha('SBJS', 'supabase.js'), CHART_JS = acha('CHART_JS', 'chart.umd.js');
if (!SBJS || !CHART_JS) { console.log('faltam as libs: SBJS=' + SBJS + ' CHART_JS=' + CHART_JS); process.exit(1); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
fs.mkdirSync(SAIDA, { recursive: true });
const arqs = fs.readdirSync(ENTRADA).filter(f => f.endsWith('.json') && (!IDS_ARG || IDS_ARG.split(',').includes(f.replace(/\.json$/, ''))));
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
await ctx.route(/supabase-js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) }));
await ctx.route(/chart\.js@/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) }));
await ctx.route(/fonts\.googleapis|fonts\.gstatic/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await ctx.route('https://lozwipoeacpvplgkrxkq.supabase.co/**', r => {
  const u = r.request().url(), um = /vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '');
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
  if (/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { is_admin: true, unidade: '' } : [{ is_admin: true, unidade: '' }]) });
  if (/user_approvals/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { status: 'approved' } : [{ status: 'approved' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'replay', email: 'fortesindicadores@gmail.com', user_metadata: { name: 'Renan Fortes' } }) });
  return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  erro de página: ' + e.message.slice(0, 160)));
const caches = {}, favs = [];
for (const f of arqs) { const j = JSON.parse(fs.readFileSync(path.join(ENTRADA, f), 'utf8')); const id = j.id || f.replace(/\.json$/, ''); caches['gem_app_c_' + id + '|' + (j.data.vw || '') + '|' + (j.data.vigSel || '')] = { t: Date.now(), data: j.data }; favs.push(id); }
await pg.addInitScript(({ caches, favs, tema }) => {
  if (location.pathname.indexOf('/app/') < 0) return;
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJyZXBsYXkifQ.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'replay', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Renan Fortes' }, app_metadata: {} } }));
  Object.keys(caches).forEach(k => localStorage.setItem(k, JSON.stringify(caches[k])));
  localStorage.setItem('gem_app_fav', JSON.stringify(favs.slice(0, 6)));
  localStorage.setItem('bi_theme', tema);
  window.APP_TEMPOS = { teto: 1 };
}, { caches, favs, tema: process.env.TEMA || 'dark' });
await pg.goto(BASE + '/app/', { waitUntil: 'domcontentloaded' });
await pg.waitForSelector('#app:not([style*="none"])', { timeout: 30000 });
await pg.waitForTimeout(600);
await pg.screenshot({ path: path.join(SAIDA, '00-inicio.png') });
await pg.evaluate(() => irPara('paineis')); await pg.waitForTimeout(200);
await pg.screenshot({ path: path.join(SAIDA, '00-paineis.png') });
for (const id of favs) {
  await pg.evaluate(id => abrePainel(id), id);
  await pg.waitForFunction(() => document.querySelector('#pnCorpo .pe-painel'), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(500);
  const h = await pg.evaluate(() => Math.min(6000, document.getElementById('pnCorpo').scrollHeight + 130));
  await pg.setViewportSize({ width: 390, height: Math.max(844, h) });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SAIDA, id + '.png') });
  await pg.setViewportSize({ width: 390, height: 844 });
  console.log('ok ' + id + ' · ' + h + ' px');
  await pg.evaluate(() => { mataForno(); fechaPainel(); });
}
await nav.close(); srv.close();

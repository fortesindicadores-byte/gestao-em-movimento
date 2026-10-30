// ============================================================================
// Elite Apresentacao Check — o "Gerar apresentação" do Frota de Elite com os
// dados REAIS. Sobe o repositório num servidor local, abre o painel no Chromium
// com uma sessão de mentira e troca a credencial de todo pedido ao Supabase
// pela service key (como o FCA Automatico Check). Roda a mesma coleta do botão
// (Frota de Elite + Gestão à Vista no iframe do farol-core) e imprime só
// números por unidade (ELITE_GAV_JSON: aderências e contagens, sem placa).
// Depois clica no botão e confere o PDF baixado (páginas e tamanho). O PDF
// não sai do runner. Nada é gravado.
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
await pg.goto(BASE + '/programa-reconhecimento/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof EliteApresentacao !== 'undefined' && window.GerotBase, { timeout: 120000 });
console.log('painel aberto · página em', await pg.evaluate(() => location.pathname));

const t0 = Date.now();
const D = await pg.evaluate(async () => { const d = await EliteApresentacao.coleta(); return d; });
console.log(`coleta em ${((Date.now() - t0) / 1000).toFixed(0)} s · vigências ${D.vigs.join(' ')} · Gestão à Vista ${D.gav ? 'ok' : 'FORA'}`);
const VU = D.vigs[D.vigs.length - 1];
console.log('pontuação por unidade em', VU, D.mes.filter(r => r.vig === VU).map(r => r.unit + ' ' + (r.pont || 0).toFixed(2)).join(' · '));
console.log('ELITE_GAV_JSON ' + JSON.stringify(D.gav));
console.log('ELITE_D_JSON ' + JSON.stringify({ vigs: D.vigs, mes: D.mes, acum: D.acum }));

// o botão de verdade: baixa o PDF
const t1 = Date.now();
const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 600000 }), pg.click('#btApres')]);
const arq = path.join(process.env.RUNNER_TEMP || '/tmp', 'apres.pdf');
await dl.saveAs(arq);
const b = fs.readFileSync(arq), pags = (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`PDF: ${dl.suggestedFilename()} · ${pags} páginas · ${(b.length / 1e6).toFixed(1)} MB · ${((Date.now() - t1) / 1000).toFixed(0)} s`);
fs.unlinkSync(arq);
await nav.close(); srv.close();

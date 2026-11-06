// ============================================================================
// App Check — o app do celular (/app/) com os painéis REAIS. Mesmo desenho do
// Apresentacao Check: servidor local + Chromium + sessão de mentira, Supabase
// só leitura com a service key. Abre o /app/, deixa o login automático entrar,
// abre cada painel de APP_PAINEIS (ids do catálogo) e imprime o que o app leu:
// blocos, hero, cards, gráficos, tabelas (contagens e rótulos; nunca a tabela
// inteira). Prints em APP_DIR (artefato de 1 dia).
//   APP_PAINEIS=visao-financeira,painel-km node scripts/app-check.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((req, res) => { let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
const DIR = process.env.APP_DIR || '/tmp/app-check';
fs.mkdirSync(DIR, { recursive: true });

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route(/\/sw\.js$/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route('https://lozwipoeacpvplgkrxkq.supabase.co/**', async r => {
  const u = r.request().url();
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  const um = /vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '');
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { is_admin: true, unidade: '' } : [{ is_admin: true, unidade: '' }]) });
  if (/\/rest\/v1\/user_approvals/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { status: 'approved' } : [{ status: 'approved' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'check', email: 'fortesindicadores@gmail.com', user_metadata: { name: 'Renan Fortes' } }) });
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
const erros = [];
pg.on('pageerror', e => { erros.push(e.message.slice(0, 200)); });
await pg.addInitScript(() => {
  if (location.pathname.indexOf('/app/') >= 0) {
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
      user: { id: 'check', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Renan Fortes' }, app_metadata: {} } }));
    localStorage.setItem('gem_app_fav', '[]');
  }
});
const t0 = Date.now();
await pg.goto(BASE + '/app/', { waitUntil: 'domcontentloaded' });
await pg.waitForSelector('#app:not([style*="none"])', { timeout: 60000 });
console.log(`app aberto com a sessão em ${((Date.now() - t0) / 1000).toFixed(0)} s · ${await pg.textContent('#ola')} · ${await pg.$$eval('#lista .li', l => l.length)} painéis no catálogo`);
await pg.screenshot({ path: path.join(DIR, '00-inicio.png') });

const IDS = (process.env.APP_PAINEIS || 'visao-financeira,painel-km,programa-reconhecimento,scorecard,fca-gerencial').split(',').map(s => s.trim()).filter(Boolean);
let falhas = 0;
for (const id of IDS) {
  const t1 = Date.now();
  const existe = await pg.evaluate(id => !!painelPorId(id), id);
  if (!existe) { console.log(`✗ ${id}: não está no catálogo`); falhas++; continue; }
  await pg.evaluate(id => abrePainel(id), id);
  await pg.waitForFunction(() => { const e = document.getElementById('pnEstado'); const c = document.getElementById('pnCorpo'); return (e && e.style.display === 'none' && c && c.textContent.trim().length > 0) || document.querySelector('#pnEstado.erro') || (c && c.querySelector('.vazio')); }, null, { timeout: 180000, polling: 500 }).catch(() => {});
  const r = await pg.evaluate(() => {
    const d = window.PN_DATA; const est = (document.getElementById('pnEstado') || {}).textContent || '';
    if (!d) return { est, vazio: !!document.querySelector('#pnCorpo .vazio') };
    const lin = [];
    d.blocos.forEach(b => {
      if (b.t === 'hero') lin.push('hero: ' + b.itens.map(i => i.l + ' = ' + i.v + (i.dels.length ? ' (' + i.dels.map(x => x.l + ' ' + x.v).join(' · ') + ')' : '')).join(' | '));
      if (b.t === 'kpis') lin.push('cards(' + b.itens.length + '): ' + b.itens.map(i => i.l + ' = ' + i.v).join(' · '));
      if (b.t === 'graf') lin.push('gráfico: ' + (b.tit || '(sem título)') + ' · ' + b.tipo + ' · ' + b.labels.length + ' rótulos · ' + b.ds.length + ' série(s): ' + b.ds.map(x => x.label || '?').join(', '));
      if (b.t === 'tab') lin.push('tabela: ' + (b.tit || '(sem título)') + ' · ' + b.head.length + ' colunas · ' + b.rows.length + ' de ' + b.n + ' linhas · cabeçalho: ' + b.head.slice(0, 6).join(' | '));
      if (b.t === 'txt') lin.push('texto: ' + (b.tit || '(sem título)') + ' · ' + b.corpo.length + ' caracteres');
    });
    return { est, sub: d.sub, vistas: d.vistas.map(v => v.t).join(' / '), vigs: d.vig && d.vig.opts ? d.vig.opts.slice(0, 5).map(o => o.t).join(' ') : '', lin, msgs: d.msgs || [] };
  });
  const seg = ((Date.now() - t1) / 1000).toFixed(0);
  if (!r.lin) { console.log(`✗ ${id} (${seg} s): ${r.vazio ? 'sem resumo' : r.est || 'sem dado'}`); falhas++; }
  else {
    console.log(`${r.lin.length ? 'ok' : '✗ '} ${id} (${seg} s): ${r.sub}\n     visões: ${r.vistas}${r.vigs ? '\n     vigências: ' + r.vigs : ''}${r.msgs.length ? '\n     avisos: ' + r.msgs.join(' · ') : ''}`);
    r.lin.forEach(l => console.log('     ' + l.slice(0, 400)));
    if (!r.lin.length) falhas++;
  }
  // o print da tela inteira do painel (o corpo rola por dentro: a janela cresce até o fim do conteúdo) + o resumo lido, para reproduzir o desenho fora do Actions
  try {
    const h = await pg.evaluate(() => Math.min(5000, document.getElementById('pnCorpo').scrollHeight + 130));
    await pg.setViewportSize({ width: 390, height: Math.max(844, h) });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(DIR, id + '.png') });
    await pg.setViewportSize({ width: 390, height: 844 });
    const dados = await pg.evaluate(() => window.PN_DATA ? { id: PN.id, nome: PN.nome, desc: PN.desc, data: PN_DATA } : null);
    if (dados) fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify(dados));
  } catch (e) { console.log('     (print: ' + e.message.slice(0, 80) + ')'); }
  await pg.evaluate(() => fechaPainel());
}
await pg.evaluate(() => irPara('inicio'));
await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(DIR, '99-inicio-depois.png') });
if (erros.length) console.log('erros de página (' + erros.length + '): ' + erros.slice(0, 8).join(' | '));
console.log(`\n${IDS.length - falhas} ok · ${falhas} falha(s)`);
await nav.close(); srv.close();
process.exit(falhas ? 1 : 0);

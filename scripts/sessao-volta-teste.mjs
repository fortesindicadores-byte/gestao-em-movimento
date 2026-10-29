// Sessão que caiu no hub: aviso + limpeza; painel sem o gem_hub vai ao hub e volta para ele.
// Uso: SBJS=<supabase.js UMD> node scripts/sessao-volta-teste.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname), SBJS = process.env.SBJS;
let ok = 0, falha = 0; const t = (c, m) => { if (c) { ok++; console.log('ok ', m); } else { falha++; console.log('FALHA', m); } };
const srv = http.createServer((q, s) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(RAIZ) || !existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript' : 'text/html' }); s.end(readFileSync(f)); }).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
const KEY = 'sb-lozwipoeacpvplgkrxkq-auth-token';
const user = { id: 'u1', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { name: 'Renan' } };
const b = await chromium.launch();
async function cena({ token, refresh }) {
  const ctx = await b.newContext({ serviceWorkers: 'block' }); const pg = await ctx.newPage();
  await pg.route(/fonts\.g|cdn\.jsdelivr\.net\/npm\/(chart|html2|jspdf|xlsx|chartjs)/, r => r.fulfill({ status: 200, body: '', contentType: 'text/plain' }));
  await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => { const u = new URL(r.request().url());
    if (u.pathname.endsWith('/auth/v1/token')) {
      if (u.searchParams.get('grant_type') === 'password' || refresh === 'ok') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'novo', refresh_token: 'r2', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }) });
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }) }); }
    if (u.pathname.includes('/auth/v1/user')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await pg.addInitScript(([k, tok]) => { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); if (tok) localStorage.setItem(k, JSON.stringify(tok)); } }, [KEY, token]);
  return { ctx, pg };
}
const vencido = { access_token: 'velho', refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) - 60, expires_in: 3600, token_type: 'bearer', user };
const valido = { ...vencido, expires_at: Math.floor(Date.now() / 1000) + 3000 };
const st = pg => pg.evaluate(k => ({ url: location.pathname + location.search, login: document.getElementById('auth-screen') ? getComputedStyle(document.getElementById('auth-screen')).display !== 'none' : null, msg: (document.getElementById('auth-msg') || {}).textContent || '', sessao: !!localStorage.getItem(k) }), KEY);
// A · sessão guardada que o Supabase recusa
{ const { ctx, pg } = await cena({ token: vencido, refresh: 'nega' }); await pg.goto(BASE + '/'); await pg.waitForTimeout(4000); const s = await st(pg);
  t(s.login && /expirou/.test(s.msg), 'A · sessão recusada: login com "Sua sessão expirou" — ' + s.msg); t(!s.sessao, 'A · a sessão inválida foi apagada do navegador'); await ctx.close(); }
// B · sessão válida, painel aberto sem passar pelo hub: vai ao hub e volta para o painel
{ const { ctx, pg } = await cena({ token: valido, refresh: 'ok' }); await pg.goto(BASE + '/painel-km/'); await pg.waitForTimeout(5000); const s = await st(pg);
  t(s.url.startsWith('/painel-km/'), 'B · painel → hub → volta ao painel sozinho — ' + s.url); await ctx.close(); }
// C · sem sessão: hub pede login com aviso e, depois de entrar, volta ao painel
{ const { ctx, pg } = await cena({ token: null, refresh: 'nega' }); await pg.goto(BASE + '/painel-km/'); await pg.waitForTimeout(3000); let s = await st(pg);
  t(s.url.startsWith('/?volta=') && s.login && /abrir o painel/.test(s.msg), 'C · sem sessão: hub com "Entre para abrir o painel" — ' + s.url + ' · ' + s.msg);
  await pg.fill('#login-email', 'fortesindicadores@gmail.com'); await pg.fill('#login-pass', 'x123456'); await pg.click('#btn-login'); await pg.waitForTimeout(4000); s = await st(pg);
  t(s.url.startsWith('/painel-km/'), 'C · depois do login volta ao painel — ' + s.url); await ctx.close(); }
// D · hub normal, sem volta: continua no hub
{ const { ctx, pg } = await cena({ token: valido, refresh: 'ok' }); await pg.goto(BASE + '/'); await pg.waitForTimeout(3000); const s = await st(pg);
  t(s.url === '/' && !s.login, 'D · hub direto: fica no hub — ' + s.url); await ctx.close(); }
// E · volta para fora do portal é ignorada
{ const { ctx, pg } = await cena({ token: valido, refresh: 'ok' }); await pg.goto(BASE + '/?volta=' + encodeURIComponent('//evil.com/x')); await pg.waitForTimeout(3000); const s = await st(pg);
  t(s.url.startsWith('/?volta=') && !s.login, 'E · volta externa ignorada, fica no hub'); await ctx.close(); }
await b.close(); srv.close(); console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);

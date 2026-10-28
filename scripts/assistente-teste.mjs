// Teste da página /assistente/ (Chromium): dono vê a conversa, outro login cai no gate,
// a pergunta vai à Edge Function com o login do hub, a resposta (texto, tabela, consultas
// ao banco e pesquisa na web) aparece e a página não rola em 1366/1920 nos dois temas.
// Uso: SBJS=<supabase.js UMD> node scripts/assistente-teste.mjs   (SHOT_DIR salva prints)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const SBJS = process.env.SBJS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0; const t = (c, m) => { if (c) { ok++; console.log('ok ', m); } else { falha++; console.log('FALHA', m); } };
const srv = http.createServer((q, s) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(RAIZ) || !existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript' : 'text/html' }); s.end(readFileSync(f)); }).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
const b = await chromium.launch();
async function abre(email, w, h, tema) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  const pedidos = [];
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: SBJS ? readFileSync(SBJS, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => { const u = new URL(r.request().url());
    if (u.pathname.endsWith('/functions/v1/rapid-processor')) {
      pedidos.push({ h: r.request().headers(), b: JSON.parse(r.request().postData() || '{}') });
      const ev = [{ t: 'sql', sql: 'select 1', motivo: 'custo por km em 2026' }, { t: 'res', linhas: 9, truncado: false },
        { t: 'web', q: 'IPCA acumulado 2026' }, { t: 'txt', d: 'O custo subiu **4,1%**, abaixo do IPCA.\n\n| Mês | R$/km |\n|---|---|\n| jan/26 | 2,10 |\n| set/26 | 2,19 |\n' },
        { t: 'fim', consultas: 1, web: 1, custo: 0.31, seg: 22 }];
      return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ev.map(e => JSON.stringify(e)).join('\n') + '\n' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await pg.addInitScript(([t0, e0]) => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0); if (!sessionStorage.getItem('t_ia')) { localStorage.removeItem('gem_assistente'); sessionStorage.setItem('t_ia', '1'); }
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: e0, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, [tema, email]);
  await pg.goto(BASE + '/assistente/'); await pg.waitForTimeout(700);
  return { pg, ctx, erros, pedidos };
}
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const k = `${w} ${tema}`; const { pg, ctx, erros, pedidos } = await abre('fortesindicadores@gmail.com', w, h, tema);
  t(await pg.locator('#miolo').isVisible(), k + ': dono vê a conversa');
  t((await pg.locator('.ia-ex .dimb').count()) === 4, k + ': exemplos na tela vazia');
  await pg.fill('#ia-txt', 'Como o custo por km evoluiu contra o IPCA?'); await pg.click('#ia-env'); await pg.waitForTimeout(600);
  t(pedidos.length === 1 && pedidos[0].h.authorization === 'Bearer tok' && pedidos[0].b.mensagens.at(-1).content.includes('IPCA'), k + ': manda o login e a pergunta');
  const ele = pg.locator('.ia-m.ele').last();
  t((await ele.locator('b').first().textContent()) === '4,1%' && (await ele.locator('td.n').count()) === 2, k + ': negrito e tabela com número à direita');
  const sum = await ele.locator('.ia-q summary').textContent();
  t(/1 consulta ao banco · 1 pesquisa na web/.test(sum), k + ': lista consultas e pesquisa na web — ' + sum);
  t(/1 pesquisa na web/.test(await ele.locator('.ia-pe').textContent()), k + ': rodapé conta a pesquisa na web');
  const rola = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight <= innerHeight + 1, lat: document.documentElement.scrollWidth <= innerWidth + 1 }));
  t(rola.pag && rola.lat, k + ': sem rolagem de página ' + JSON.stringify(rola));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/assistente-${w}-${tema}.png` });
  await pg.reload(); await pg.waitForTimeout(700);
  t((await pg.locator('.ia-m').count()) === 2, k + ': conversa volta depois do F5');
  t(!erros.length, k + ': sem erro de página ' + erros.join(' | '));
  await ctx.close();
}
{ const { pg, ctx } = await abre('outro@conlogsa.com.br', 1366, 768, 'dark');
  t(await pg.locator('.gate').isVisible() && !(await pg.locator('#miolo').isVisible()), 'outro login: gate'); await ctx.close(); }
// card no hub, cluster Administração, só para o dono
const hub = readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
t(/"t": "Assistente"[^}]*"h": "assistente\/"[^}]*"dono": true/.test(hub), 'card Assistente no hub, só para o dono');
await b.close(); srv.close();
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);

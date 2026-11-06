// ============================================================================
// App Robot — pré-lê os painéis para o app do celular (06/11/2026).
// Renan: "Bem demorado para carregar no app visão mobile". No celular, cada
// painel era a página inteira de 1366 px num iframe. Aqui o Actions faz essa
// leitura (o MESMO app.js, o mesmo iframe, a mesma extração) com a service key
// e grava o resumo de cada painel × visão em public.app_resumo (3 a 5 KB cada).
// O app lê a tabela em milissegundos e só abre o iframe no "Atualizar".
//   APP_PAINEIS=visao-financeira,painel-km node scripts/app-robot.mjs   (vazio = todos os de modo resumo)
//   APP_SECO=1  → não grava (só mede)
//   APP_VIGS=5  → além da vigência padrão, lê os 5 meses anteriores da 1ª visão (0 desliga)
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SECO = process.env.APP_SECO === '1';
const N_VIGS = process.env.APP_VIGS === undefined ? 5 : +process.env.APP_VIGS;   // quantas vigências além da padrão (só a 1ª visão)
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const BUILD = ((fs.readFileSync(path.join(RAIZ, 'app/index.html'), 'utf8').match(/name="build" content="(\d+)"/) || [])[1]) || '';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((req, res) => { let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

// o catálogo: todos os painéis de modo "resumo" que não são só do dono
const CAT = JSON.parse(fs.readFileSync(path.join(RAIZ, 'app/catalogo.js'), 'utf8').replace(/^[\s\S]*?window\.GEM_CATALOGO = /, '').replace(/;\s*$/, '')).paineis;
const PEDIDOS = (process.env.APP_PAINEIS || '').split(',').map(s => s.trim()).filter(Boolean);
const IDS = (PEDIDOS.length ? PEDIDOS : CAT.filter(p => p.modo === 'resumo' && !p.dono).map(p => p.id));
const INICIO = new Date();

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route(/\/sw\.js$/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route(SB + '/**', async r => {
  const u = r.request().url();
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  const um = /vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '');
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { is_admin: true, unidade: '' } : [{ is_admin: true, unidade: '' }]) });
  if (/\/rest\/v1\/user_approvals/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(um ? { status: 'approved' } : [{ status: 'approved' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'robo', email: 'fortesindicadores@gmail.com', user_metadata: { name: 'Robô' } }) });
  if (/\/rest\/v1\/app_resumo/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });   // o robô nunca lê o que ele mesmo gravou
  if (/\/rest\/v1\/access_log/.test(u)) return r.fulfill({ status: 201, headers: CORS, body: '' });
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
const erros = [];
pg.on('pageerror', e => { erros.push(e.message.slice(0, 200)); });
await pg.addInitScript(() => {
  if (location.pathname.indexOf('/app/') >= 0) {
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJyb2JvIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
      user: { id: 'robo', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Robô' }, app_metadata: {} } }));
    localStorage.setItem('gem_app_fav', '[]');   // sem fila de destaques: quem manda é a lista de ids
    window.APP_SEM_BANCO = true;                 // nunca ler o app_resumo: o robô lê os painéis de verdade
  }
});
await pg.goto(BASE + '/app/', { waitUntil: 'domcontentloaded' });
await pg.waitForSelector('#app:not([style*="none"])', { timeout: 60000 });
console.log(`app aberto · build ${BUILD} · ${IDS.length} painel(is)${SECO ? ' · SECO (não grava)' : ''}`);

// espera a leitura da visão pedida terminar (PN_DATA.vw = a visão, sem "Abrindo/Atualizando" no estado)
const esperaLido = (vw, vig) => pg.waitForFunction(({ vw, vig }) => {
  const e = document.getElementById('pnEstado'), c = document.getElementById('pnCorpo'), d = window.PN_DATA;
  const parado = !e || e.style.display === 'none' || e.classList.contains('erro');
  if (document.querySelector('#pnEstado.erro') || (c && c.querySelector('.vazio') && !d)) return true;
  return parado && d && (!vw || d.vw === vw) && (!vig || d.vigSel === vig) && c && c.textContent.trim().length > 0;
}, { vw, vig }, { timeout: 180000, polling: 500 }).catch(() => {});

async function grava(linhas) {
  if (SECO || !linhas.length) return 0;
  const r = await fetch(SB + '/rest/v1/app_resumo?on_conflict=id,vw,vig,unidade', { method: 'POST',
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(linhas) });
  if (!r.ok) throw new Error('upsert ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return linhas.length;
}
async function apagaVelhos(id) {   // visões que o painel não tem mais somem
  if (SECO) return;
  const r = await fetch(SB + '/rest/v1/app_resumo?id=eq.' + encodeURIComponent(id) + '&unidade=eq.&lido_em=lt.' + encodeURIComponent(INICIO.toISOString()), { method: 'DELETE',
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, prefer: 'return=minimal' } });
  if (!r.ok) console.log('     (limpeza: ' + r.status + ')');
}

let ok = 0, falhas = 0, linhasTot = 0;
for (const id of IDS) {
  const t1 = Date.now();
  const p = CAT.find(x => x.id === id);
  if (!p) { console.log(`✗ ${id}: não está no catálogo`); falhas++; continue; }
  if (p.modo !== 'resumo') { console.log(`– ${id}: modo ${p.modo}, não se pré-lê`); continue; }
  try {
    await pg.evaluate(id => abrePainel(id), id);
    await esperaLido('');
    const primeiro = await pg.evaluate(() => window.PN_DATA ? { vw: PN_DATA.vw || '', vistas: (PN_DATA.vistas || []).map(v => v.v), data: PN_DATA } : null);
    if (!primeiro || !primeiro.data.blocos.length) { console.log(`✗ ${id} (${((Date.now() - t1) / 1000).toFixed(0)} s): ${primeiro ? 'sem blocos' : ((await pg.textContent('#pnEstado').catch(() => '')) || 'sem dado')}`); falhas++; await pg.evaluate(() => fechaPainel()); continue; }
    const linhas = [{ id, vw: primeiro.vw, vig: '', unidade: '', adm: !!p.adm, dados: primeiro.data, lido_em: new Date().toISOString(), build: BUILD }];
    const outras = primeiro.vistas.filter(v => v && v !== primeiro.vw);
    for (const vw of outras) {
      const t2 = Date.now();
      await pg.evaluate(vw => mudaVista(vw), vw);
      await esperaLido(vw);
      const d = await pg.evaluate(vw => (window.PN_DATA && PN_DATA.vw === vw && PN_DATA.blocos.length) ? PN_DATA : null, vw);
      if (d) linhas.push({ id, vw, vig: '', unidade: '', adm: !!p.adm, dados: d, lido_em: new Date().toISOString(), build: BUILD });
      else console.log(`     ${vw}: sem resumo (${((Date.now() - t2) / 1000).toFixed(0)} s)`);
    }
    // os meses anteriores da 1ª visão (trocar o mês no celular sem abrir o iframe)
    const vigs = N_VIGS > 0 ? await pg.evaluate((n) => {
      const vg = (window.PN_DATA && PN_DATA.vig && PN_DATA.vig.opts) || [], sel = PN_DATA.vigSel || (vg.filter(x => x.on)[0] || {}).v || '';
      const lidos = vg.map(o => ({ o, l: vigLe(o) })).filter(x => x.l && x.l.mes != null && x.o.v !== sel);
      lidos.sort((a, b) => (b.l.ano * 12 + b.l.mes) - (a.l.ano * 12 + a.l.mes));
      const selL = vigLe({ v: sel, t: sel }); const ate = selL && selL.mes != null ? selL.ano * 12 + selL.mes : Infinity;
      return lidos.filter(x => x.l.ano * 12 + x.l.mes < ate).slice(0, n).map(x => x.o.v);
    }, N_VIGS) : [];
    if (vigs.length && outras.length) { await pg.evaluate(vw => mudaVista(vw), primeiro.vw); await esperaLido(primeiro.vw); }
    for (const vig of vigs) {
      const t2 = Date.now();
      await pg.evaluate(v => mudaVig(v), vig);
      await esperaLido(primeiro.vw, vig);
      const d = await pg.evaluate(v => (window.PN_DATA && PN_DATA.vigSel === v && PN_DATA.blocos.length) ? PN_DATA : null, vig);
      if (d) linhas.push({ id, vw: primeiro.vw, vig, unidade: '', adm: !!p.adm, dados: d, lido_em: new Date().toISOString(), build: BUILD });
      else console.log(`     ${vig}: sem resumo (${((Date.now() - t2) / 1000).toFixed(0)} s)`);
    }
    const n = await grava(linhas);
    await apagaVelhos(id);
    linhasTot += n; ok++;
    console.log(`ok ${id} (${((Date.now() - t1) / 1000).toFixed(0)} s): ${1 + outras.length} visão(ões) · ${vigs.length} mês(es) a mais · ${(JSON.stringify(linhas).length / 1024).toFixed(0)} KB · ${primeiro.data.sub || ''}`);
  } catch (e) { falhas++; console.log(`✗ ${id} (${((Date.now() - t1) / 1000).toFixed(0)} s): ${(e && e.message || e).slice(0, 160)}`); }
  await pg.evaluate(() => { try { fechaPainel(); } catch (e) {} });
}
if (erros.length) console.log('erros de página (' + erros.length + '): ' + erros.slice(0, 8).join(' | '));
console.log(`\n${ok} ok · ${falhas} falha(s) · ${linhasTot} resumo(s) gravado(s)`);
await nav.close(); srv.close();
process.exit(falhas && !ok ? 1 : 0);

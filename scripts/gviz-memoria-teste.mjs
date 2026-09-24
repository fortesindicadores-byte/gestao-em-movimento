// ============================================================
// O banco não segura a tela e o deck não relê o banco — teste no Chromium
// (24/09/2026: o Nano parou de responder durante a geração do PPT e o hub
// ficou em branco esperando fca_profiles).
//
// Três frentes, cada uma com o lado "antes" reproduzido pelo dublê:
//   A · gviz-cache.js lê em página ADAPTATIVA: pede 10.000, o servidor
//       devolve o teto dele (Max rows) e o passo das leituras seguintes é o
//       que voltou. Com teto 1.000 e 2.500 linhas: 3 leituras; com teto
//       10.000: uma.
//   B · dentro do Check de Metas (window.__gvizMem na página-mãe) o SEGUNDO
//       iframe do mesmo painel não faz leitura nenhuma no banco — nem da aba,
//       nem do sh_base, nem do GET ao REST que o painel faz por supabase-js.
//       Sem a mãe, cada abertura lê de novo (a memória não vaza para o portal).
//   C · o hub desenha os clusters ANTES de o banco responder, aguenta o banco
//       mudo (teto de 5 s + faixa de aviso), roteia o gestor pelo perfil e
//       refina o papel quando o banco responde.
//
// Uso: node scripts/gviz-memoria-teste.mjs   (no sandbox; SBJS aponta para o
//      UMD do supabase-js — sem ele o cenário C é pulado com aviso)
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SBJS = process.env.SBJS || '';
const SHEET = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';   // DRE, aba Frota
const CHAVE = SHEET + '|s=Frota|g=|q=|h=';
let ok = 0, falhas = 0;
const t = (cond, msg, extra) => { if (cond) { ok++; console.log('  ok  ', msg); } else { falhas++; console.log('  ✗   ', msg, extra != null ? '→ ' + JSON.stringify(extra) : ''); } };

// ── servidor estático: o repositório + as páginas do teste ────────────────
const PAGS = {
  '/__t/filho.html': `<!doctype html><html><head><meta charset="utf-8">
<script src="/assets/gviz-cache.js"></script></head><body><script>
(async()=>{
  const r=await fetch('https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?sheet=Frota&tqx=out:json');
  const txt=await r.text(); const a=txt.indexOf('('), b=txt.lastIndexOf(')');
  const obj=JSON.parse(txt.slice(a+1,b));
  const f=await fetch('${SUPA}/rest/v1/fca?select=id&origem=eq.Custos',{headers:{apikey:'k',Authorization:'Bearer k',Range:'0-999','Range-Unit':'items'}});
  const fj=await f.json();
  window.__res={rows:obj.table.rows.length, primeiro:obj.table.rows[0].c[0].v, ultimo:obj.table.rows[obj.table.rows.length-1].c[0].v,
    fca:fj.length, fonte:GvizCache.fontes['${CHAVE}'], status:f.status, cr:f.headers.get('content-range')};
  try{ parent.postMessage({res:window.__res},'*'); }catch(e){}
})();
</script></body></html>`,
  '/__t/mae.html': `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
window.__gvizMem={}; window.__resps=[];
window.addEventListener('message',e=>{ if(e.data&&e.data.res) window.__resps.push(e.data.res); });
window.abre=()=>{ const i=document.createElement('iframe'); i.src='/__t/filho.html'; document.body.appendChild(i); };
</script></body></html>`
};
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (PAGS[u.pathname]) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGS[u.pathname]); }
  let p = path.join(RAIZ, decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => srv.listen(0, r));
const ORIG = 'http://127.0.0.1:' + srv.address().port;

// ── dublê do Supabase ──────────────────────────────────────────────────────
// MAXROWS = o "Max rows" da API do projeto; N = linhas da aba
// o Supabase real expõe o Content-Range ao navegador (senão o supabase-js não
// leria o count); o dublê tem de expor também, ou o cabeçalho chega null
const json = (o, extra) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...(extra || {}) }, body: JSON.stringify(o) });
// .single() do supabase-js pede Accept: application/vnd.pgrst.object+json e
// recebe UM objeto (406 se não houver linha); .maybeSingle() pede lista
const umOuLista = (req, rows) => /pgrst\.object/.test(req.headers()['accept'] || '')
  ? (rows.length ? json(rows[0]) : { status: 406, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' })
  : json(rows);
function dubleBanco(page, cfg) {
  const st = { pedidos: [], ranges: [] };
  page.route(u => String(u).startsWith(SUPA), async route => {
    const req = route.request(); const u = new URL(req.url()); const tab = u.pathname.replace('/rest/v1/', '');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    st.pedidos.push(tab.split('?')[0]);
    if (process.env.DEBUG) console.log('   →', req.method(), tab.slice(0, 80), '| accept:', req.headers()['accept']);
    if (cfg.mudo && cfg.mudo(tab)) return;                                  // banco mudo: nunca responde
    if (tab.startsWith('sh_base')) return route.fulfill(json([{ slug: 'dre_frota', gviz_chave: CHAVE, colunas: [{ i: 0, label: 'Linha', col: 'a', tipo: 'number' }], linhas: cfg.N, erro: null, carregado_em: new Date().toISOString() }]));
    if (tab.startsWith('sh_dre_frota')) {
      const rg = req.headers()['range'] || '0-999'; st.ranges.push(rg);
      const [de, ate] = rg.split('-').map(Number);
      const fim = Math.min(ate, de + cfg.MAXROWS - 1, cfg.N - 1);
      const rows = []; for (let i = de; i <= fim; i++) rows.push({ linha: i + 1, a: i + 1 });
      return route.fulfill(json(rows, { 'Content-Range': `${de}-${fim}/*` }));
    }
    if (tab.startsWith('fca_profiles')) return route.fulfill(umOuLista(req, cfg.perfil ? [cfg.perfil] : []));
    if (tab.startsWith('fca')) return route.fulfill(json([{ id: 1 }, { id: 2 }], { 'Content-Range': '0-1/*' }));
    if (tab.startsWith('user_approvals')) return route.fulfill(umOuLista(req, [{ status: 'approved' }]));
    if (tab.startsWith('access_log')) return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    return route.fulfill(json([]));
  });
  return st;
}
const contaBanco = st => st.pedidos.filter(p => p.startsWith('sh_') || p.startsWith('fca')).length;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
await ctx.route(u => String(u).includes('docs.google.com'), r => r.abort());   // o Google é proibido
const esperaResp = async (page, n) => { await page.waitForFunction(k => (window.__resps || []).length >= k, n, { timeout: 15000 }); return page.evaluate(() => window.__resps); };

// ═══ A · página adaptativa ═══════════════════════════════════════════════
console.log('\n═══ A · gviz-cache lê em página adaptativa ═══');
{
  const page = await ctx.newPage(); const st = dubleBanco(page, { MAXROWS: 1000, N: 2500 });
  await page.goto(ORIG + '/__t/mae.html'); await page.evaluate(() => abre());
  const [r] = await esperaResp(page, 1);
  t(r.rows === 2500 && r.primeiro === 1 && r.ultimo === 2500, 'teto 1.000 e 2.500 linhas: a aba chega inteira e em ordem', r);
  t(st.ranges.length === 3, 'em 3 leituras (pede 10.000, o servidor devolve 1.000 e o passo vira 1.000)', st.ranges);
  t(st.ranges[0] === '0-9999' && st.ranges.includes('1000-1999') && st.ranges.includes('2000-2999'), 'com os Ranges 0-9999 · 1000-1999 · 2000-2999', st.ranges);
  t(r.fonte === 'banco', 'fonte anotada: banco', r.fonte);
  await page.close();
}
{
  const page = await ctx.newPage(); const st = dubleBanco(page, { MAXROWS: 10000, N: 2500 });
  await page.goto(ORIG + '/__t/mae.html'); await page.evaluate(() => abre());
  const [r] = await esperaResp(page, 1);
  t(r.rows === 2500, 'teto 10.000: a aba chega inteira', r.rows);
  t(st.ranges.length === 1 && st.ranges[0] === '0-9999', 'numa leitura só', st.ranges);
  await page.close();
}
{
  const page = await ctx.newPage(); const st = dubleBanco(page, { MAXROWS: 10000, N: 25441 });
  await page.goto(ORIG + '/__t/mae.html'); await page.evaluate(() => abre());
  const [r] = await esperaResp(page, 1);
  t(r.rows === 25441 && r.ultimo === 25441, 'teto 10.000 e 25.441 linhas (manutenção): inteira', { rows: r.rows, ultimo: r.ultimo });
  t(st.ranges.length === 3, 'em 3 leituras em vez de 26', st.ranges);
  await page.close();
}

// ═══ B · memória da página-mãe ═══════════════════════════════════════════
console.log('\n═══ B · dentro do Check de Metas o 2º iframe não volta ao banco ═══');
{
  const page = await ctx.newPage(); const st = dubleBanco(page, { MAXROWS: 1000, N: 2500 });
  await page.goto(ORIG + '/__t/mae.html');
  await page.evaluate(() => abre()); const [r1] = await esperaResp(page, 1);
  const antes = contaBanco(st);
  t(antes === 5, '1º iframe: sh_base + 3 páginas da aba + 1 GET ao REST = 5 leituras', st.pedidos);
  await page.evaluate(() => abre()); const [, r2] = await esperaResp(page, 2);
  t(contaBanco(st) === antes, '2º iframe: ZERO leituras novas no banco', st.pedidos.slice(antes));
  t(r2.rows === 2500 && r2.ultimo === 2500, 'e recebe a aba inteira da memória', r2);
  t(r2.fca === 2 && r2.status === 200 && r2.cr === '0-1/*', 'e o GET ao REST com o mesmo corpo, status e Content-Range', r2);
  t(/memória/.test(r2.fonte), 'fonte anotada como memória', r2.fonte);
  const n = await page.evaluate(() => window.__gvizMem.__n);
  // hit da aba já poupa a consulta ao sh_base, por isso são 2 hits para 3 misses
  t(n && n.miss === 3 && n.hit === 2, 'contador da mãe: 3 leituras · 2 servidas da memória (a aba em memória nem consulta o sh_base)', n);
  // o obj do 2º iframe é reconstruído, não a mesma referência: mexer nele não
  // contamina o 3º
  await page.evaluate(() => abre()); const [, , r3] = await esperaResp(page, 3);
  t(r3.rows === 2500 && contaBanco(st) === antes, '3º iframe: idem, ainda sem ir ao banco', contaBanco(st));
  await page.close();
}
{
  const page = await ctx.newPage(); const st = dubleBanco(page, { MAXROWS: 1000, N: 2500 });
  await page.goto(ORIG + '/__t/filho.html'); await page.waitForFunction(() => window.__res, null, { timeout: 15000 });
  const a = contaBanco(st);
  await page.goto(ORIG + '/__t/filho.html'); await page.waitForFunction(() => window.__res, null, { timeout: 15000 });
  t(contaBanco(st) === 2 * a && a === 5, 'sem a mãe (portal normal): cada abertura lê o banco de novo — a memória não vaza', [a, contaBanco(st)]);
  const f = await page.evaluate(() => window.__res.fonte);
  t(f === 'banco', 'e a fonte é o banco, sem "memória"', f);
  await page.close();
}

// ═══ C · hub ══════════════════════════════════════════════════════════════
console.log('\n═══ C · o hub não espera o banco para desenhar os clusters ═══');
if (!SBJS || !fs.existsSync(SBJS)) {
  console.log('  (pulado: SBJS não aponta para o UMD do supabase-js)');
} else {
  const sessao = (id, email) => JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id, email, aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Teste' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' } });
  async function hub(cfg) {
    const page = await ctx.newPage();
    await page.route(u => String(u).includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS, 'utf8') }));
    await page.route(u => /cdn\.jsdelivr|cdnjs|fonts\.g/.test(String(u)) && !String(u).includes('@supabase'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const st = dubleBanco(page, cfg);
    await page.addInitScript(({ s, cache }) => {
      localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', s);
      if (cache) localStorage.setItem('gem_perfil_' + cache.uid, JSON.stringify(cache.prof));
    }, { s: sessao(cfg.uid, cfg.email), cache: cfg.cache || null });
    await page.goto(ORIG + '/');
    return { page, st };
  }
  const leTela = page => page.evaluate(() => ({
    hub: document.getElementById('hub-screen').style.display, load: document.getElementById('loading').style.display,
    nav: [...document.querySelectorAll('#hnav .s-item')].map(b => b.textContent.replace(/\d+$/, '').trim()),
    papel: document.getElementById('hub-papel').textContent,
    // o hub ANTIGO não tem a faixa — o teste roda também contra ele, para provar o defeito
    aviso: !!document.getElementById('hub-aviso') && document.getElementById('hub-aviso').style.display !== 'none',
    avisoTxt: (document.getElementById('hub-aviso') || {}).textContent || '', cards: document.querySelectorAll('#board .hcard').length
  }));
  // C1 · admin (pelo e-mail), banco MUDO
  {
    const { page } = await hub({ uid: 'u-adm', email: 'fortesindicadores@gmail.com', MAXROWS: 1000, N: 3, mudo: tab => tab.startsWith('fca_profiles') });
    await page.waitForFunction(() => document.querySelectorAll('#hnav .s-item').length > 0, null, { timeout: 4000 }).catch(() => {});
    const t0 = await leTela(page);
    t(t0.hub === 'flex' && t0.nav.length >= 6 && t0.cards > 0, 'admin com o banco mudo: clusters e cards na tela em menos de 4 s (antes: em branco para sempre)', t0);
    t(t0.nav.includes('Administração'), 'com o cluster Administração (papel pelo e-mail)', t0.nav);
    t(!t0.aviso, 'sem aviso ainda (o banco tem 5 s para responder)', t0.aviso);
    await page.waitForFunction(() => document.getElementById('hub-aviso') && document.getElementById('hub-aviso').style.display !== 'none', null, { timeout: 8000 }).catch(() => {});
    const t1 = await leTela(page);
    t(t1.aviso && /sem resposta desde \d\d:\d\d/.test(t1.avisoTxt) && /5 s/.test(t1.avisoTxt), 'depois de 5 s: a faixa diz desde quando o banco não responde', t1.avisoTxt);
    t(t1.nav.length === t0.nav.length && t1.cards > 0, 'e os clusters continuam lá', t1);
    await page.close();
  }
  // C2 · usuário comum com perfil em cache (admin), banco MUDO
  {
    const { page } = await hub({ uid: 'u-cache', email: 'alguem@x.com', MAXROWS: 1000, N: 3, mudo: tab => tab.startsWith('fca_profiles'), cache: { uid: 'u-cache', prof: { unidade: '', is_admin: true } } });
    await page.waitForFunction(() => document.querySelectorAll('#hnav .s-item').length > 0, null, { timeout: 4000 }).catch(() => {});
    const t0 = await leTela(page);
    t(t0.nav.includes('Administração') && t0.papel === 'Administrador', 'usuário com perfil em cache: entra como Administrador sem esperar o banco', t0);
    await page.close();
  }
  // C3 · usuário comum SEM cache, banco MUDO → Portal depois do teto
  {
    const { page } = await hub({ uid: 'u-novo', email: 'novo@x.com', MAXROWS: 1000, N: 3, mudo: tab => tab.startsWith('fca_profiles') });
    await page.waitForFunction(() => document.querySelectorAll('#hnav .s-item').length > 0, null, { timeout: 9000 }).catch(() => {});
    const t0 = await leTela(page);
    t(t0.hub === 'flex' && t0.nav.length > 0 && !t0.nav.includes('Administração') && t0.papel === 'Portal', 'sem cache e banco mudo: entra como Portal depois do teto, sem Administração', t0);
    t(t0.aviso, 'com a faixa de aviso', t0.aviso);
    await page.close();
  }
  // C4 · banco RESPONDE: admin pelo perfil, sem aviso, cache gravado
  {
    const { page } = await hub({ uid: 'u-perf', email: 'perf@x.com', MAXROWS: 1000, N: 3, perfil: { user_id: 'u-perf', unidade: '', is_admin: true } });
    await page.waitForFunction(() => document.getElementById('hub-papel').textContent === 'Administrador', null, { timeout: 8000 }).catch(() => {});
    const t0 = await leTela(page);
    t(t0.papel === 'Administrador' && t0.nav.includes('Administração') && !t0.aviso, 'banco respondendo: Administrador pelo perfil e sem aviso', t0);
    const cache = await page.evaluate(() => localStorage.getItem('gem_perfil_u-perf'));
    t(cache && JSON.parse(cache).is_admin === true, 'e o perfil ficou em cache para a próxima abertura', cache);
    await page.close();
  }
  // C5 · gestor (unidade, não admin) com o banco respondendo → roteado
  {
    const { page } = await hub({ uid: 'u-gest', email: 'gestor@x.com', MAXROWS: 1000, N: 3, perfil: { user_id: 'u-gest', unidade: 'PIR', is_admin: false } });
    await page.waitForFunction(() => location.pathname.includes('fca-preenchimento'), null, { timeout: 8000 }).catch(() => {});
    const url = page.url();
    t(url.includes('fca-preenchimento'), 'gestor: roteado para o preenchimento pelo perfil do banco', url);
    await page.close();
  }
  // C6 · gestor com o banco MUDO e perfil em cache → roteado do cache
  {
    const { page } = await hub({ uid: 'u-gest2', email: 'gestor2@x.com', MAXROWS: 1000, N: 3, mudo: tab => tab.startsWith('fca_profiles'), cache: { uid: 'u-gest2', prof: { unidade: 'PIR', is_admin: false } } });
    await page.waitForFunction(() => location.pathname.includes('fca-preenchimento'), null, { timeout: 4000 }).catch(() => {});
    t(page.url().includes('fca-preenchimento'), 'gestor com o banco mudo: roteado pelo cache, sem esperar', page.url());
    await page.close();
  }
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

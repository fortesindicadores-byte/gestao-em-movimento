// ============================================================================
// Arvore KM Check — abre a Árvore de Combustível e o Painel KM com os dados REAIS
// (banco lido com a service key pelo Node, como no Metas Dispersao Check) e imprime,
// mês a mês, o KM Rodado (rem · real · balanço de massa) que cada um calcula para
// o MESMO recorte (unidade × projetos). Os dois têm de bater. Só leitura.
// Inputs: UNI (padrão CBA) · PROJS (padrão "AUTO SERVIÇO,ROTA,VAN", na grafia da Árvore).
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const UNI = (process.env.UNI || 'CBA').trim();
const PROJS = (process.env.PROJS || 'AUTO SERVIÇO,ROTA,VAN').split(',').map(s => s.trim()).filter(Boolean);
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
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '') ? { is_admin: true, nome: 'Check' } : [{ is_admin: true, nome: 'Check' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'check', email: 'check@local' }) });
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
  pg.on('console', m => { const t = m.text(); if (m.type() !== 'log' || /disp|balan/i.test(t)) console.log('  [console]', t.slice(0, 300)); });
  await pg.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1'); try { Object.keys(localStorage).forEach(k => { if (/^bi_cache_km|^bi_cache_arvore|^bm_banco/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
      user: { id: 'check', email: 'check@local', aud: 'authenticated', role: 'authenticated' } }));
  });
};
const vk = s => { const m = String(s).match(/(\d{2})\/(\d{4})/); return m ? m[2] + m[1] : s; };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lbl = s => { const m = String(s).match(/(\d{2})\/(\d{4})/); return m ? MES[+m[1] - 1] + '/' + m[2].slice(2) : s; };
const n0 = v => Math.round(v || 0).toLocaleString('pt-BR').padStart(11);

// ── Árvore de Combustível ──
const ar = await ctx.newPage(); await prep(ar);
let t0 = Date.now();
await ar.goto(BASE + '/combustivel/arvore-combustivel/index.html', { waitUntil: 'domcontentloaded' });
await ar.waitForFunction(() => { const e = document.getElementById('titSub') || document.getElementById('status-badge'); return e && /Atualizado|Erro/.test(e.textContent) && typeof S_DP !== 'undefined' && S_DP.length; }, null, { timeout: 300000 });
console.log(`Árvore carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s · build ${await ar.evaluate(() => document.querySelector('meta[name=build]').content)}`);
const A = await ar.evaluate(({ UNI, PROJS }) => {
  const anos = {}, projsUni = {}, fontes = {};
  S_DP.forEach(r => { const d = kParseVig(r[DP.vig]); if (!d) { anos['(sem vig)'] = (anos['(sem vig)'] || 0) + 1; return; }
    const y = d.getFullYear(); anos[y] = (anos[y] || 0) + 1; fontes[r._fonte || 'aba'] = (fontes[r._fonte || 'aba'] || 0) + 1;
    const n3 = String(r[DP.proj] || ''); if (getNv3Suffix(n3) === UNI) { const p = getNv3Prefix(n3) + ' (' + n3 + ')'; projsUni[p] = (projsUni[p] || 0) + 1; } });
  const vigs = [...new Set(S_DP.map(r => { const d = kParseVig(r[DP.vig]); return d ? vigBR(d) : null; }).filter(Boolean))];
  const f0 = { ano: [], vigencia: [], unidade: [UNI], nivel3: PROJS };
  const tudo = kmAgg(f0);
  const porMes = {}; vigs.forEach(v => { porMes[v] = kmAgg({ ...f0, vigencia: [v] }); });
  const sel = { uni: getMsValues('ms-uni'), nv3: getMsValues('ms-nv3'), vig: getMsValues('ms-vig'), ano: getMsValues('ms-ano') };
  const opcoes = { uni: (document.getElementById('ms-uni')._items || []), nv3: (document.getElementById('ms-nv3')._items || []) };
  return { anos, projsUni, fontes, tudo, porMes, sel, opcoes, anoMin: typeof ANO_MIN !== 'undefined' ? ANO_MIN : 0, bmFonte: typeof BM_FONTE !== 'undefined' ? BM_FONTE : null, bmChaves: Object.keys((typeof BM_NOVO !== 'undefined' && BM_NOVO.porChave) || {}).filter(k => k.includes(UNI)).length };
}, { UNI, PROJS });
console.log('S_DP por ano:', JSON.stringify(A.anos), '· fonte:', JSON.stringify(A.fontes), '· ANO_MIN da Árvore:', A.anoMin, '(anos antes dele ficam fora da conta da Árvore; no Painel KM o filtro Ano lista todos)');
console.log(`projetos de ${UNI} no S_DP (prefixo lido → nível 3 cru):`, JSON.stringify(A.projsUni));
console.log('filtros ao abrir:', JSON.stringify(A.sel), '· opções unidade:', A.opcoes.uni.join(' '), '· projeto:', A.opcoes.nv3.join(' | '));
console.log('balanço:', JSON.stringify(A.bmFonte), '· chaves do BM com', UNI + ':', A.bmChaves);

// ── Painel KM ──
const km = await ctx.newPage(); await prep(km);
t0 = Date.now();
await km.goto(BASE + '/painel-km/index.html', { waitUntil: 'domcontentloaded' });
await km.waitForFunction(() => typeof ALL !== 'undefined' && ALL.length && ALL.some(r => 'rem0' in r), { timeout: 300000 });
await km.waitForTimeout(3000);
console.log(`Painel KM carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s · build ${await km.evaluate(() => document.querySelector('meta[name=build]').content)}`);
const K = await km.evaluate(({ UNI, PROJS, ANO_MIN }) => {
  const VAN = p => /^ROTA\s*\(VAN\)$/i.test(p) ? 'VAN' : p;
  const anos = {}, projsUni = {}, porMes = {}, unds = new Set();
  let tudo = { rem: 0, real: 0, rem0: 0, bm: 0 };
  ALL.forEach(r => { anos[r.ano] = (anos[r.ano] || 0) + 1; unds.add(r.und);
    if (r.und !== UNI) return; const p = VAN(String(r.proj || '').toUpperCase()); projsUni[p + ' (' + r.proj + ')'] = (projsUni[p + ' (' + r.proj + ')'] || 0) + 1;
    if (!PROJS.map(x => x.toUpperCase()).includes(p) || +r.ano < ANO_MIN) return;   // o mesmo recorte de anos da Árvore
    const m = porMes[r.vig] = porMes[r.vig] || { rem: 0, real: 0, rem0: 0, bm: 0 };
    const rem = (r.rem0 != null ? r.rem0 : r.rem) + (r.recomp || 0);
    m.rem += rem; m.real += r.real || 0; m.rem0 += r.rem0 != null ? r.rem0 : r.rem; m.bm += r.recomp || 0;
    tudo.rem += rem; tudo.real += r.real || 0; tudo.rem0 += r.rem0 != null ? r.rem0 : r.rem; tudo.bm += r.recomp || 0; });
  return { anos, projsUni, porMes, tudo, unds: [...unds].sort(), bmModo: typeof BM_MODO !== 'undefined' ? BM_MODO : null };
}, { UNI, PROJS, ANO_MIN: A.anoMin });
console.log('ALL por ano:', JSON.stringify(K.anos), '· unidades:', K.unds.join(' '), '· modo BM:', K.bmModo);
console.log(`projetos de ${UNI} no Painel KM:`, JSON.stringify(K.projsUni));

console.log(`\n── KM Rodado · ${UNI} · ${PROJS.join(' + ')} · Árvore × Painel KM ──`);
console.log('mês     | Árvore rem   Árvore real  Árv BM     | KM rem       KM real      KM BM      | Δrem        Δreal');
const vigs = [...new Set([...Object.keys(A.porMes), ...Object.keys(K.porMes)])].sort((a, b) => vk(a).localeCompare(vk(b)));
let difs = 0;
vigs.forEach(v => { const a = A.porMes[v] || {}, k = K.porMes[v] || {};
  const dr = (a.rem || 0) - (k.rem || 0), dl = (a.real || 0) - (k.real || 0); if (Math.abs(dr) > 1 || Math.abs(dl) > 1) difs++;
  console.log(`${lbl(v).padEnd(7)} |${n0(a.rem)}${n0(a.real)}${n0(a.bmKm)} |${n0(k.rem)}${n0(k.real)}${n0(k.bm)} |${n0(dr)}${n0(dl)}${(Math.abs(dr) > 1 || Math.abs(dl) > 1) ? '  ◄' : ''}`); });
const pct = o => o.rem ? ((o.real - o.rem) / o.rem * 100).toFixed(1) + '%' : '—';
console.log(`TOTAL   |${n0(A.tudo.rem)}${n0(A.tudo.real)}${n0(A.tudo.bmKm)} |${n0(K.tudo.rem)}${n0(K.tudo.real)}${n0(K.tudo.bm)} | Δ% Árvore ${pct(A.tudo)} · Painel KM ${pct(K.tudo)}`);
console.log(difs ? `\n${difs} mês(es) diferentes` : '\nIGUAIS mês a mês');
await nav.close(); srv.close();

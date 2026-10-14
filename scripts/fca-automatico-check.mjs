// ============================================================================
// FCA Automatico Check — o /fca-automatico/ com os dados REAIS.
// Sobe o repositório num servidor local, abre a página no Chromium com uma
// sessão de mentira no localStorage e troca a credencial de TODO pedido ao
// Supabase pela service key (o painel lê como admin). O perfil é respondido
// como admin. Imprime as fontes, os fatos do mês com a causa e a ação
// geradas, a rede e o aprendizado. Nada é gravado.
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const VIG = (process.env.VIG || '').trim(), UNI = (process.env.UNI || '').trim().toUpperCase();
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
  // o Supabase recusa a service key vinda de navegador ("Forbidden use of secret API key in browser"):
  // o pedido sai do Node, com a chave, e a resposta volta para a página
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
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  [pageerror]', e.message));
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [console]', m.text().slice(0, 220)); });
await pg.addInitScript(() => {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'check', email: 'check@local', aud: 'authenticated', role: 'authenticated' } }));
});
const t0 = Date.now();
await pg.goto(BASE + '/fca-automatico/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => document.querySelector('.gate') || (typeof CTX !== 'undefined' && CTX && typeof PROLOG_ESTADO !== 'undefined' && PROLOG_ESTADO !== 'lendo'), { timeout: 600000 });
console.log(`carregou em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const gate = await pg.evaluate(() => (document.querySelector('.gate') || {}).textContent || '');
if (gate) { console.log('GATE:', gate); process.exit(1); }
const R = await pg.evaluate(({ VIG, UNI }) => {
  const vig = VIG || CTX.maxVig;
  const fs = FATOS.filter(f => f.vig === vig && (!UNI || f.uni === UNI)).sort((a, b) => b.over - a.over);
  return {
    fontes: LIDO.fontes, prolog: PROLOG_ESTADO, maxVig: CTX.maxVig, vig, nFatosTodos: FATOS.length,
    porVig: Object.entries(FATOS.reduce((m, f) => { m[f.vig] = (m[f.vig] || 0) + 1; return m; }, {})).sort(),
    fatos: fs.map(f => { const d = diag(f); return { id: f.id, over: f.over, dpct: f.dpct, expl: d.explicado, causa: d.causaTxt, acao: d.acaoTxt, sinais: d.sinais.map(s => s.txt), avisos: d.avisos,
      ponte: d.blocos.ponte ? ['dCusto', 'vol', 'efic', 'preco', 'dif'].map(k => k + ' ' + Math.round(d.blocos.ponte[k] || 0)).join(' · ') : '',
      hist: d.historico.daUni.length, outras: d.historico.outras.length }; }),
    rede: Object.fromEntries(Object.entries(CTX.rede).map(([p, l]) => [p, l.map(e => `${e.rot}: r0 ${isFinite(e.r0) ? e.r0.toFixed(2) : '—'} (n ${e.n0}, q ${isFinite(e.q0) ? e.q0.toFixed(3) : '—'}) · r1 ${isFinite(e.r1) ? e.r1.toFixed(2) : '—'} (n ${e.n1})${e.sust ? ' · SUSTENTA' : ''}`)])),
    aprend: { casos: CTX.aprend.casos.length, porRes: CTX.aprend.casos.reduce((m, c) => { m[c.res] = (m[c.res] || 0) + 1; return m; }, {}), temas: CTX.aprend.temas.map(t => `${t.pac} · ${t.tema}: ${t.n} FCAs, ${t.melhor}/${t.aval} melhoraram`) },
    amostraOS: (LIDO.ginfo['os-em-aberto'] || []).slice(0, 3).map(r => [r['Data'], typeof r['Data']]), amostraPrev: (LIDO.ginfo['preventivas'] || []).slice(0, 2),
    ginfo: Object.fromEntries(Object.entries(CTX.ginfo).map(([u, g]) => [u, `prev venc ${g.prevVencidas.length} · OS ab ${g.osAbertas.length} · alin venc ${g.alinVencidos.length}`])),
    prologU: Object.fromEntries(Object.entries(CTX.prolog).map(([u, p]) => [u, `inst ${p.inst} · pressão fora ${p.presNOK} · ≤3mm ${p.ate3} · 3–4mm ${p.janela} · amp>5 ${p.amp}`]))
  };
}, { VIG, UNI });
console.log('\n══ FONTES'); R.fontes.forEach(f => console.log(`  ${f.estado === 'ok' ? 'ok  ' : 'ERRO'} ${f.nome}${f.linhas != null ? ' · ' + f.linhas + ' linhas' : ''}${f.msg ? ' · ' + f.msg : ''}`));
console.log(`  Prolog: ${R.prolog}`);
console.log(`\n══ FATOS: ${R.nFatosTodos} no total · DRE até ${R.maxVig} · por mês: ${R.porVig.map(x => x.join(' ')).join(' | ')}`);
console.log(`\n══ ${R.vig}${UNI ? ' · ' + UNI : ''}: ${R.fatos.length} fato(s)`);
R.fatos.forEach(f => {
  console.log(`\n── ${f.id} · R$ ${Math.round(f.over).toLocaleString('pt-BR')} (${f.dpct.toFixed(0)}%)${f.expl != null ? ' · explica ' + Math.round(f.expl * 100) + '%' : ''} · hist ${f.hist} · outras ${f.outras}`);
  if (f.ponte) console.log('   ponte: ' + f.ponte);
  console.log('   CAUSA:\n' + (f.causa || '(nenhuma)').split('\n').map(l => '     ' + l).join('\n'));
  console.log('   AÇÃO:\n' + (f.acao || '(nenhuma)').split('\n').map(l => '     ' + l).join('\n'));
  if (f.sinais.length) console.log('   SINAIS:\n' + f.sinais.map(l => '     · ' + l).join('\n'));
  if (f.avisos.length) console.log('   AVISOS:\n' + f.avisos.map(l => '     ⚠ ' + l).join('\n'));
});
console.log('\n══ REDE'); Object.entries(R.rede).forEach(([p, l]) => { console.log('  ' + p); l.forEach(x => console.log('    ' + x)); });
console.log('\n══ APRENDIZADO', JSON.stringify(R.aprend.porRes), R.aprend.casos, 'casos'); R.aprend.temas.forEach(t => console.log('  ' + t));
console.log('\n══ GINFO HOJE · amostra OS', JSON.stringify(R.amostraOS), '· preventivas', JSON.stringify(R.amostraPrev)); Object.entries(R.ginfo).forEach(([u, t]) => console.log(`  ${u}: ${t}`));
console.log('\n══ PROLOG HOJE'); Object.entries(R.prologU).forEach(([u, t]) => console.log(`  ${u}: ${t}`));
await nav.close(); srv.close();

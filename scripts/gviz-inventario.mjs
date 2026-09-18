// ============================================================
// QUE ABAS CADA PAINEL PEDE AO GVIZ? — inventário dinâmico (18/09/2026)
//
// Abre cada painel que tem "gviz/tq" no Chromium, com fetch e JSONP
// interceptados, e anota a CHAVE de cada pedido (a mesma do gviz-cache.js).
// Depois cruza com scripts/sheets-bases.mjs: chave sem base = painel que
// continuaria lendo o Google Sheets depois do corte.
//
// Complementa o grep estático (URL montada em runtime não aparece no grep) e
// é a lista de entrada do Sheets Gviz Check. Pedidos que só acontecem depois
// de um clique (ex.: visão Placas do Painel KM → aba Abertura) NÃO aparecem
// aqui — para esses vale o grep dos nomes de aba no fonte.
//
// Uso: node scripts/gviz-inventario.mjs   (no sandbox; nada sai para a rede)
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { BASES, chaveDe } from './sheets-bases.mjs';

const RAIZ = process.cwd();
const paineis = execSync(`ls -d */index.html */*/index.html */*/*/index.html 2>/dev/null | xargs grep -l "gviz/tq"`, { cwd: RAIZ })
  .toString().trim().split('\n').map(p => p.replace(/\/index\.html$/, '')).sort();

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8767, r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

const VAZIO = '/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"x","table":{"cols":[],"rows":[]}});';
const porPainel = {};
for (const p of paineis) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const chaves = new Set();
  await page.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1');
    window.__gviz = [];
    // supabase mínimo: tudo devolve vazio (o que importa aqui é o gviz)
    const vazio = () => { const q = { select() { return q; }, order() { return q; }, eq() { return q; }, in() { return q; }, gte() { return q; }, lte() { return q; }, limit() { return q; }, range: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) }; return q; };
    window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u', email: 'x@x' } } } }), onAuthStateChange() {} }, from: vazio, rpc: async () => ({ data: null, error: null }) }) };
    window.Chart = class { constructor() {} destroy() {} update() {} resize() {} }; window.Chart.register = () => {}; window.ChartDataLabels = {};
    const chaveDe = (url) => { try { const u = new URL(url, location.href); if (u.hostname !== 'docs.google.com') return null; const m = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)\/gviz\/tq$/); if (!m) return null; const p = u.searchParams; return m[1] + '|s=' + (p.get('sheet') || '') + '|g=' + (p.get('gid') || '') + '|q=' + (p.get('tq') || '') + '|h=' + (p.get('headers') || ''); } catch (e) { return null; } };
    const orig = window.fetch;
    window.fetch = async (u, o) => {
      const s = typeof u === 'string' ? u : (u && u.url);
      const k = s && chaveDe(s);
      if (k) { window.__gviz.push(k); return new Response('/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"x","table":{"cols":[],"rows":[]}});', { status: 200 }); }
      if (s && /supabase\.co/.test(s)) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      return orig(u, o);
    };
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (node) {
      if (node && node.tagName === 'SCRIPT' && node.src) {
        const k = chaveDe(node.src); const fn = (node.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        if (k && fn) { window.__gviz.push(k); setTimeout(() => { if (typeof window[fn] === 'function') window[fn]({ version: '0.6', status: 'ok', table: { cols: [], rows: [] } }); }, 0); return node; }
      }
      return ap.call(this, node);
    };
  });
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/plain', body: VAZIO }));
  try {
    await page.goto(`http://localhost:8767/${p}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);
    (await page.evaluate(() => window.__gviz || [])).forEach(k => chaves.add(k));
  } catch (e) { chaves.add('!erro: ' + e.message.slice(0, 60)); }
  porPainel[p] = [...chaves];
  await ctx.close();
}
await browser.close(); srv.close();

// ── grep estático dos nomes de aba (cobre o que só sai depois de um clique) ──
const chavesBase = new Map();
BASES.forEach(b => { chavesBase.set(chaveDe(b), b.slug); (b.apelidos || []).forEach(a => chavesBase.set(chaveDe({ ...b, sheet: a.sheet, gid: a.gid, tq: a.tq, headers: a.headers }), b.slug)); });

const todas = new Map();
for (const [p, ks] of Object.entries(porPainel)) ks.forEach(k => { if (!todas.has(k)) todas.set(k, []); todas.get(k).push(p); });

console.log(`${paineis.length} painéis · ${todas.size} chave(s) distintas pedidas na abertura\n`);
for (const [p, ks] of Object.entries(porPainel)) {
  const semBase = ks.filter(k => !k.startsWith('!') && !chavesBase.has(k));
  console.log(`${semBase.length ? '✗' : 'ok'} ${p.padEnd(40)} ${ks.length} pedido(s)${semBase.length ? ' · SEM BASE: ' + semBase.join(' ; ') : ''}${ks.find(k => k.startsWith('!')) || ''}`);
}
const orfas = [...todas.keys()].filter(k => !k.startsWith('!') && !chavesBase.has(k));
console.log(`\n━━ chaves SEM tabela no banco: ${orfas.length}`);
orfas.forEach(k => console.log(`   ${k}\n      ← ${todas.get(k).join(', ')}`));
fs.writeFileSync(path.join(RAIZ, 'docs', 'gviz-inventario.json'), JSON.stringify({ gerado_em: new Date().toISOString(), porPainel, semBase: orfas }, null, 1));
console.log('\n→ docs/gviz-inventario.json');

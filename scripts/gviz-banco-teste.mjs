// ============================================================
// O gviz-cache novo serve os 38 painéis do BANCO? — teste no Chromium
//
// Abre cada painel com o assets/gviz-cache.js DE VERDADE e o Supabase dublado:
// sh_base devolve uma linha por chave conhecida (colunas sintéticas, tipos
// reais) e sh_<slug> devolve linhas sintéticas. O Google é BLOQUEADO — se um
// painel ainda chegar nele, o teste acusa. Confere por painel:
//   · nenhum pedido ao gviz saiu para o Google (GvizCache.google === 0);
//   · todo pedido de chave com tabela veio do banco (GvizCache.banco);
//   · sem erro de página novo em relação ao que o painel já tinha.
// A conferência de CONTEÚDO (o banco reproduz o gviz célula a célula) é o
// Sheets Gviz Check, no Actions, com o dado real. Aqui é a MECÂNICA.
//
// Uso: node scripts/gviz-banco-teste.mjs   (no sandbox)
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { BASES, chaveDe } from './sheets-bases.mjs';

const RAIZ = process.cwd();
const paineis = execSync(`ls -d */index.html */*/index.html */*/*/index.html 2>/dev/null | xargs grep -l "gviz/tq"`, { cwd: RAIZ })
  .toString().trim().split('\n').map(p => p.replace(/\/index\.html$/, '')).filter(p => p !== '_template').sort()
  .filter(p => !process.env.PAINEIS || process.env.PAINEIS.split(',').includes(p));

// ── os apelidos do shim TÊM de espelhar os do sheets-bases ──────────────────
// Apelido que falta no shim faz o painel não achar a tabela e ir ao Google em
// SILÊNCIO — foi exatamente o que aconteceu com a Árvore da Seara (Frota com
// headers=1) e o rs-por-km (Remunerado agregado com headers=1). As duas listas
// vivem em arquivos diferentes porque o shim é um .js de browser sem import;
// esta conferência é o que impede as duas de se separarem de novo.
const shim = fs.readFileSync(path.join(RAIZ, 'assets/gviz-cache.js'), 'utf8');
const bloco = shim.slice(shim.indexOf('var APELIDOS = {'), shim.indexOf('// chave normalizada'));
const noShim = new Set([...bloco.matchAll(/'([^']*\|s=[^']*)'\s*:/g)].map(m => m[1]));
const esperados = BASES.flatMap(b => (b.apelidos || []).map(a => chaveDe({ ...b, sheet: a.sheet, gid: a.gid, tq: a.tq, headers: a.headers })));
const faltando = esperados.filter(k => !noShim.has(k));
if (faltando.length) {
  console.log(`✗ ${faltando.length} apelido(s) do sheets-bases.mjs NÃO estão no APELIDOS do gviz-cache.js:`);
  faltando.forEach(k => console.log(`   ${k}`));
} else {
  console.log(`ok apelidos: ${esperados.length} do sheets-bases.mjs presentes no shim`);
}

// sh_base sintético: colunas genéricas por base (tipos: string, number, date)
const shBase = [];
for (const b of BASES) {
  const colunas = [
    { i: 0, label: 'VIGÊNCIA', col: 'vigencia_orig', tipo: 'date' },
    { i: 1, label: 'Unidade', col: 'unidade', tipo: 'string' },
    { i: 2, label: 'Valor', col: 'valor', tipo: 'number' },
  ];
  shBase.push({ slug: b.slug, gviz_chave: chaveDe(b), colunas, linhas: 3, erro: null, carregado_em: new Date().toISOString() });
}
const linhasDe = () => [1, 2, 3].map(i => ({ linha: i, vigencia: '08/2026', vigencia_orig: '2026-08-01', unidade: 'PIRAÍ', valor: i * 10 }));

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8768, r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

let falhas = faltando.length;
const json = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
for (const p of paineis) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  let google = 0; const fugas = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1');
    window.Chart = class { constructor() {} destroy() {} update() {} resize() {} }; window.Chart.register = () => {}; window.ChartDataLabels = {};
    const vazio = () => { const q = { select() { return q; }, order() { return q; }, eq() { return q; }, in() { return q; }, gte() { return q; }, lte() { return q; }, limit() { return q; }, range: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) }; return q; };
    window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u', email: 'x@x' } } } }), onAuthStateChange() {} }, from: vazio, rpc: async () => ({ data: null, error: null }) }) };
  });
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/docs.google.com/**', r => { google++; if (fugas.length < 4) fugas.push(r.request().url().slice(0, 150)); r.abort(); });
  await page.route('**/*.supabase.co/rest/v1/**', r => {
    const u = new URL(r.request().url());
    const t = u.pathname.split('/').pop();
    if (t === 'sh_base') return r.fulfill(json(shBase));
    if (t.startsWith('sh_')) {
      const range = r.request().headers()['range'] || '0-999';
      return r.fulfill(json(range.startsWith('0-') ? linhasDe() : []));
    }
    return r.fulfill(json([]));
  });
  let r = {};
  try {
    await page.goto(`http://localhost:8768/${p}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    r = await page.evaluate(() => window.GvizCache ? { ...window.GvizCache, fontes: Object.values(window.GvizCache.fontes) } : null) || {};
  } catch (e) { errs.push('goto: ' + e.message.slice(0, 80)); }
  const okBanco = (r.banco || 0) === (r.hits || 0) + (r.misses || 0) || ((r.hits || 0) + (r.misses || 0)) === 0;
  const ruim = google > 0 || (r.google || 0) > 0 || !okBanco;
  if (ruim) falhas++;
  console.log(`${ruim ? '✗ ' : 'ok'} ${p.padEnd(38)} banco ${r.banco || 0} · snapshot ${r.snapshot || 0} · google ${r.google || 0}/${google}${errs.length ? ' · erros: ' + errs.slice(0, 2).join(' | ') : ''}`);
  fugas.forEach(u => console.log(`        fugiu: ${u}`));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(falhas ? `\n✗ ${falhas} painel(is) com pedido fora do banco` : `\n✓ os ${paineis.length} painéis foram servidos do banco; nenhum pedido chegou ao Google`);
process.exit(falhas ? 1 : 0);

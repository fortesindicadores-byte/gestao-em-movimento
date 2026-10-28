// Book do Operador (/book-operador/): abre o painel no Chromium com o banco
// dublado e confere o gate, o resumo, o leitor (blocos lidos ao abrir, HTML
// limpo: sem script, sem estilo, sem on*), a busca, o download de anexo e o
// layout em 1366/1920 nos dois temas. Uso: SBJS=<supabase UMD> CHART_JS=… DATALABELS=…
//   [BOOK_JSON=<book.ndjson do dump>] [SHOT_DIR=…] node scripts/book-operador-teste.mjs
// Sem BOOK_JSON usa um dublê sintético (o conteúdo do Book não vai para o repositório).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '', CHART = process.env.CHART_JS || '', DL = process.env.DATALABELS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };
let REG, ANX;
if (process.env.BOOK_JSON) {
  const L = readFileSync(process.env.BOOK_JSON, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  REG = L.map(({ anexos, ...r }) => r); ANX = L.flatMap(r => r.anexos || []);
} else {
  REG = [{ uuid: 'r1', titulo: 'Custo Fixo', subtitulo: 'Regras do fixo', categoria: 'Equipamentos', ordem: 1, n_blocos: 2, n_anexos: 1, n_imagens: 0, cliques: 50, criado_em: '2022-01-01', atualizado_em: '2026-07-01', coletado_em: '2026-10-27T10:00:00Z',
    texto: 'Custo Fixo seguro FINAME', blocos: [{ subtitulo: '<h2>1. SEGURO</h2>', texto: '<p style="color:black" onclick="alert(1)">Seguro = terceiros + 0,8% da NF</p><script>window.__xss=1</script><img src="x" onerror="window.__xss=2">' }, { subtitulo: '<h2>2. FINAME</h2>', texto: '<p>PMT da taxa</p>' }] },
    { uuid: 'r2', titulo: 'QLP ADM', subtitulo: 'Estrutura', categoria: 'Gente', ordem: 2, n_blocos: 1, n_anexos: 0, n_imagens: 0, cliques: 900, criado_em: '2021-01-01', atualizado_em: '2025-08-07', coletado_em: '2026-10-27T10:00:00Z', texto: 'QLP ADM tabela Hay', blocos: [{ subtitulo: '<h2>1. INTRO</h2>', texto: '<p>Tabela Hay</p>' }] }];
  ANX = [{ id_storage: 'a1', registro: 'r1', bloco: 0, nome: 'Seguro.xlsx', tipo: 'xlsx', tamanho: 1234, texto: 'apolice franquia', base64: Buffer.from('PK teste').toString('base64') }];
}
async function abre(admin, { w = 1366, h = 768, tema = 'dark' } = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/chart\.js@4/, r => r.fulfill({ status: 200, body: CHART ? readFileSync(CHART, 'utf8') : 'window.Chart=function(){return{destroy(){}}};', contentType: 'application/javascript' }));
  await pg.route(/chartjs-plugin-datalabels/, r => r.fulfill({ status: 200, body: DL ? readFileSync(DL, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/html2canvas|jspdf/, r => r.fulfill({ status: 200, body: '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method(); const sel = u.searchParams.get('select') || '';
    const json = o => r.fulfill({ status: 200, body: JSON.stringify(o), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: admin });
    const pega = (k, lista) => { const v = (u.searchParams.get(k) || '').replace('eq.', ''); return lista.find(x => x[k] === v); };
    const corta = (o, cols) => Object.fromEntries(cols.split(',').map(c => [c, o[c]]));
    if (p.includes('/rest/v1/ft_book_anexo')) {
      if (u.searchParams.get('id_storage')) { const a = pega('id_storage', ANX); return json(a ? corta(a, sel) : null); }
      const il = u.searchParams.get('texto'); if (il) { const q = il.replace(/^ilike\.\*?|\*$/g, '').replace(/%/g, '').toLowerCase(); return json(ANX.filter(a => String(a.texto || '').toLowerCase().includes(q)).map(a => ({ id_storage: a.id_storage }))); }
      return json(ANX.map(a => corta(a, sel)));
    }
    if (p.includes('/rest/v1/ft_book')) {
      if (u.searchParams.get('uuid')) { const r0 = pega('uuid', REG); return json(r0 ? { blocos: r0.blocos } : null); }
      return json(REG.map(x => corta(x, sel)));
    }
    return json([]);
  });
  await pg.addInitScript(t0 => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0);
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, tema);
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'book-operador/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2000);
  return { b, pg, erros };
}
{ const { b, pg, erros } = await abre(true);
  t('sem erro de página', !erros.length, erros.join(' | '));
  t('hero = nº de registros', (await pg.locator('#h-reg').textContent()) === String(REG.length));
  t('resumo sem rolagem (1366)', await pg.evaluate(() => { const a = document.querySelector('#vw-resumo'); return a.scrollHeight <= a.clientHeight + 2; }));
  if (SHOT) await pg.screenshot({ path: SHOT + '/book-resumo-1366.png' });
  await pg.click('.s-item[data-vw="registros"]'); await pg.waitForTimeout(800);
  t('registros: lista com todos', await pg.locator('#itens .it').count() === REG.length);
  t('registros: abre o 1º com blocos', await pg.locator('#doc .bloco').count() > 0);
  const html = await pg.locator('#doc').innerHTML();
  t('HTML limpo: sem script, sem style, sem on*', !/<script|style=|onclick|onerror/i.test(html));
  t('nenhum script do FT rodou', await pg.evaluate(() => !window.__xss));
  if (SHOT) await pg.screenshot({ path: SHOT + '/book-registro-1366.png' });
  // busca
  const termo = process.env.BOOK_JSON ? 'finame' : 'hay';
  await pg.fill('#q', termo); await pg.waitForTimeout(600);
  const n = await pg.locator('#itens .it').count();
  t('busca filtra a lista', n > 0 && n < REG.length, `${n} registros com "${termo}"`);
  await pg.fill('#q', ''); await pg.waitForTimeout(400);
  // anexos + download
  await pg.click('.s-item[data-vw="anexos"]'); await pg.waitForTimeout(500);
  t('anexos: todos na tabela', await pg.locator('#t-anx tbody tr').count() === ANX.length);
  t('anexos: sem barra lateral', await pg.evaluate(() => [...document.querySelectorAll('#vw-anexos .twrap')].every(x => x.scrollWidth <= x.clientWidth + 2)));
  const alvo = ANX.find(a => a.base64 && (+a.tamanho || 0) < 400000) || ANX[0];
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click(`#t-anx [data-anx="${alvo.id_storage}"]`)]);
  t('download com o nome do anexo', dl.suggestedFilename() === alvo.nome, dl.suggestedFilename());
  const termoA = process.env.BOOK_JSON ? 'cluster' : 'franquia';
  await pg.fill('#qa', termoA); await pg.waitForTimeout(900);
  const na = await pg.locator('#t-anx tbody tr').count();
  t('busca dentro dos anexos', na > 0 && na <= ANX.length, `${na} com "${termoA}"`);
  if (SHOT) await pg.screenshot({ path: SHOT + '/book-anexos-1366.png' });
  t('sem erro de página no fim', !erros.length, erros.join(' | '));
  await b.close(); }
for (const [w, h, tema] of [[1920, 1080, 'dark'], [1366, 768, 'light']]) {
  const { b, pg, erros } = await abre(true, { w, h, tema });
  t(`${w}×${h} ${tema}: resumo sem rolagem`, !erros.length && await pg.evaluate(() => { const a = document.querySelector('#vw-resumo'); return a.scrollHeight <= a.clientHeight + 2; }));
  await pg.click('.s-item[data-vw="registros"]'); await pg.waitForTimeout(800);
  if (SHOT) await pg.screenshot({ path: `${SHOT}/book-registro-${w}-${tema}.png` });
  await b.close(); }
{ const { b, pg } = await abre(false); t('sem admin: gate', /Apenas administradores/.test(await pg.locator('.gate').textContent())); await b.close(); }
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

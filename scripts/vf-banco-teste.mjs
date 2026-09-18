// A Visão Financeira lendo do BANCO, no painel de verdade.
//
// O que cada cenário prova:
//   banco      → lê as três tabelas sh_dre_*, o selo diz "banco" e os números
//                saem;
//   2ª carga   → recarrega a página COM o localStorage de antes. É a armadilha
//                do Km/L: o cache passa por JSON.stringify, e se a vigência do
//                EBITDA voltasse como Date ou 'AAAA-MM-DD' ela morreria aqui —
//                a tela perderia o EBITDA sem erro nenhum;
//   sem banco  → a leitura falha e o painel cai para a planilha, com o selo
//                dizendo "planilha" e o MESMO número;
//   vazio      → anon sem sessão recebe [] em vez de 401: tabela vazia tem de
//                contar como falha, senão o painel abre zerado.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = '/home/user/gestao-em-movimento';
const S = '/tmp/claude-0/-home-user-gestao-em-movimento/df61d1fb-06c6-51a4-9fae-692ed62b893f/scratchpad';

// duas vigências, duas unidades — o suficiente para os cards e o EBITDA
const LINHAS = [
  // aba, vigencia, unidade, nivel_3, conta, mes, ano, orc, rem, real
  ['Frota', '2026-07-01', 'PIRAÍ', 'PIR - EMPURRADA', 'Combustíveis Veiculos e Equipamentos', 'jul', 2026, -100000, -90000, -95000],
  ['Frota', '2026-08-01', 'PIRAÍ', 'PIR - EMPURRADA', 'Combustíveis Veiculos e Equipamentos', 'ago', 2026, -120000, -110000, -115000],
  ['Frota', '2026-08-01', 'MACACU', 'MCC - CDI', 'Pneus Novos', 'ago', 2026, -20000, -18000, -19000],
  ['EBITDA', '2026-07-01', 'PIRAÍ', 'PIR - EMPURRADA', 'EBITDA', 'jul', 2026, 400000, 380000, 390000],
  ['EBITDA', '2026-08-01', 'PIRAÍ', 'PIR - EMPURRADA', 'EBITDA', 'ago', 2026, 500000, 480000, 512345],
  ['Receita Líquida', '2026-07-01', 'PIRAÍ', 'PIR - EMPURRADA', 'Receita Líquida', 'jul', 2026, 900000, 880000, 890000],
  ['Receita Líquida', '2026-08-01', 'PIRAÍ', 'PIR - EMPURRADA', 'Receita Líquida', 'ago', 2026, 1000000, 980000, 1000000],
];
const TAB = { Frota: 'sh_dre_frota', EBITDA: 'sh_dre_ebitda', 'Receita Líquida': 'sh_dre_receita' };
const doBanco = aba => LINHAS.filter(l => l[0] === aba).map((l, i) => ({
  linha: i, vigencia_orig: l[1], d_orc_brl: 0, d_rem_brl: 0, unidade: l[2], nivel_3: l[3],
  conta_gerencial: l[4], mes: l[5], ano: l[6], orcado: l[7], remunerado: l[8], realizado: l[9],
}));
// o MESMO conteúdo, na forma que o gviz entrega (para o cenário da reserva)
const doGviz = aba => ({
  status: 'ok',
  table: {
    cols: ['VIGÊNCIA', 'Δ ORÇ (BRL)', 'Δ REM (BRL)', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'].map(l => ({ label: l })),
    rows: LINHAS.filter(l => l[0] === aba).map(l => ({
      c: [{ v: `Date(${l[1].slice(0, 4)},${+l[1].slice(5, 7) - 1},1)` }, { v: 0 }, { v: 0 }, { v: l[2] }, { v: l[3] }, { v: l[4] }, { v: l[5] }, { v: l[6] }, { v: l[7] }, { v: l[8] }, { v: l[9] }],
    })),
  },
});

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8766, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let falhas = 0;
const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (!v) falhas++; };

async function abre(ctx, { banco, limpar = true }) {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 140)));
  await page.addInitScript(({ LINHAS, TAB, banco, gvizPorAba, limpar }) => {
    sessionStorage.setItem('gem_hub', '1');
    if (limpar) try { localStorage.removeItem('bi_cache_vf_v8'); } catch (e) {}
    window.Chart = class { constructor() {} destroy() {} update() {} resize() {} };
    window.Chart.register = () => {};
    window.ChartDataLabels = {};
    window.supabase = {
      createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'r@x.com' } } } }) },
        from: (tabela) => ({
          select() { return this; }, order() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { is_admin: true }, error: null }),
          async range(a) {
            if (banco === 'erro') return { data: null, error: { message: 'relation does not exist' } };
            if (banco === 'vazio') return { data: [], error: null };
            const aba = Object.keys(TAB).find(k => TAB[k] === tabela);
            const rows = LINHAS[aba] || [];
            return { data: a > 0 ? [] : rows, error: null };
          },
        }),
      }),
    };
    // o gviz da reserva
    const orig = window.fetch;
    window.fetch = async (u, o) => {
      const s = String(u);
      if (s.includes('docs.google.com')) {
        const aba = decodeURIComponent((s.match(/sheet=([^&]+)/) || [])[1] || '');
        return new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(gvizPorAba[aba])});`, { status: 200 });
      }
      return orig(u, o);
    };
  }, {
    LINHAS: Object.fromEntries(Object.keys(TAB).map(a => [a, doBanco(a)])),
    TAB, banco, limpar, gvizPorAba: Object.fromEntries(Object.keys(TAB).map(a => [a, doGviz(a)])),
  });
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('http://localhost:8766/visao-financeira/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !/Carregando/.test(document.getElementById('titSub').textContent), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({
    sub: document.getElementById('titSub').textContent.trim(),
    ebitda: (document.getElementById('h-ebitda') || {}).textContent,
    fonte: typeof FONTE_TAB !== 'undefined' ? JSON.stringify(FONTE_TAB) : '?',
    linhas: typeof allRows !== 'undefined' ? allRows.length : -1,
    temCache: !!localStorage.getItem('bi_cache_vf_v8'),
    // a vigência do EBITDA depois do caminho inteiro (inclusive o cache)
    ebVigs: (typeof ebitdaRows !== 'undefined' && typeof ebVig === 'function')
      ? ebitdaRows.map(r2 => { const d = ebVig(r2); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'NULA'; }) : [],
  })).catch(e => ({ erro: String(e) }));
  return { page, r, errs, logs };
}

// ── 1) banco, 1ª carga ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const { page, r, errs, logs } = await abre(ctx, { banco: 'ok' });
  console.log('\n══ banco · 1ª carga');
  console.log('   cache no load?', r.temCache, '· console:', logs.slice(0, 4).join(' | ') || '(nada)');
  console.log('   sub:', r.sub, '\n   fonte:', r.fonte, '· linhas:', r.linhas, '· EBITDA:', r.ebitda, '· vigs EBITDA:', r.ebVigs.join(','));
  ok('sem erro de página', errs.length === 0, errs[0] || '');
  ok('as três abas vieram do banco', r.fonte === '{"Frota":"banco","Receita Líquida":"banco","EBITDA":"banco"}', r.fonte);
  ok('o selo diz banco', / · banco$/.test(r.sub), r.sub);
  ok('EBITDA de ago/26 na tela', r.ebitda === '512.35k', r.ebitda);
  ok('vigência do EBITDA viva (2026-07 e 2026-08)', r.ebVigs.join(',') === '2026-07,2026-08', r.ebVigs.join(','));
  await page.close();

  // ── 2) SEGUNDA carga, com o localStorage que a 1ª deixou ────────────────
  const { page: p2, r: r2, errs: e2 } = await abre(ctx, { banco: 'ok', limpar: false });
  console.log('\n══ banco · 2ª carga (localStorage da 1ª)');
  console.log('   sub:', r2.sub, '· EBITDA:', r2.ebitda, '· vigs EBITDA:', r2.ebVigs.join(','));
  ok('sem erro de página', e2.length === 0, e2[0] || '');
  ok('a vigência do EBITDA SOBREVIVE ao JSON.stringify', r2.ebVigs.join(',') === '2026-07,2026-08', r2.ebVigs.join(','));
  ok('EBITDA continua na tela', r2.ebitda === '512.35k', r2.ebitda);
  ok('o selo sobrevive ao cache (ainda diz banco)', / · banco$/.test(r2.sub), r2.sub);
  await p2.close(); await ctx.close();
}

// ── 3) banco fora do ar → reserva da planilha ─────────────────────────────
for (const [rot, modo] of [['banco com ERRO', 'erro'], ['tabela VAZIA (anon sem sessão)', 'vazio']]) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const { page, r, errs } = await abre(ctx, { banco: modo });
  console.log(`\n══ ${rot} → reserva`);
  console.log('   sub:', r.sub, '\n   fonte:', r.fonte, '· linhas:', r.linhas, '· EBITDA:', r.ebitda);
  ok('sem erro de página', errs.length === 0, errs[0] || '');
  ok('caiu para a planilha nas três abas', /planilha/.test(r.fonte) && !/banco/.test(r.fonte), r.fonte);
  ok('o selo diz planilha', / · planilha$/.test(r.sub), r.sub);
  ok('o número é o MESMO da leitura do banco', r.ebitda === '512.35k', r.ebitda);
  await page.close(); await ctx.close();
}

await browser.close(); srv.close();
console.log(falhas ? `\n✗ ${falhas} falha(s)` : '\n✓ tudo certo');
process.exit(falhas ? 1 : 0);

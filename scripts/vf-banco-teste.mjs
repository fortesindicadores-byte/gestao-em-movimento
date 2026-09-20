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
  /* Chart.js DUBLADO que grava o config: é por ele que se prova o desenho de
     barra no padrão do Painel KM (Renan, 20/09/2026), sem CDN. O plugin de
     rótulo vira um objeto com id, como o real. */
  const SHIM_CHART = `window.__charts=[];window.ChartDataLabels={id:'datalabels'};
    (function(){function Chart(ctx,cfg){this.config=cfg;this.data=cfg.data;this.options=cfg.options||{};
      window.__charts.push(cfg);this.destroy=function(){};this.update=function(){};this.resize=function(){};
      this.$exportAoA=null;}
    Chart.getChart=function(){return null;};Chart.register=function(){};Chart.defaults={font:{}};window.Chart=Chart;})();`;
  await page.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/javascript',
      body: /chart\.umd|chartjs-plugin-datalabels/.test(u) ? (u.includes('datalabels') ? '/*datalabels no shim*/' : SHIM_CHART) : '/*stub*/' });
  });
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

  /* ── o gráfico de barra no PADRÃO DO PAINEL KM (Renan, 20/09/2026) ──
     copiado do painel-km, valor por valor: barra clara com borda e canto 3,
     rótulo 14px/700 no topo pelo plugin, eixo Y escondido, eixo X 15px. */
  const g = await page.evaluate(() => (window.__charts || []).filter(c => c.data && c.data.datasets
    && c.data.datasets[0] && c.data.datasets[0].type === 'bar' && c.data.datasets.length === 3)
    .map(c => { const d = c.data.datasets[0], o = c.options || {}, dl = (o.plugins || {}).datalabels || {};
      return { raio: d.borderRadius, borda: d.borderWidth, y: o.scales && o.scales.y && o.scales.y.display,
               yMin: o.scales && o.scales.y && o.scales.y.min, tickX: o.scales && o.scales.x && o.scales.x.ticks && o.scales.x.ticks.font && o.scales.x.ticks.font.size,
               dlTam: dl.font && dl.font.size, dlPeso: dl.font && dl.font.weight, dlAnc: dl.anchor,
               topo: o.layout && o.layout.padding && o.layout.padding.top,
               plug: (c.plugins || []).map(p => p && p.id).join(','),
               alfa: [...new Set((d.backgroundColor || []).filter(x => x !== 'transparent').map(x => String(x).slice(-2)))].sort().join(','),
               cores: [...new Set((d.borderColor || []).filter(x => x !== 'transparent'))],
               barPct: d.barPercentage, catPct: d.categoryPercentage,
               rotulo: typeof dl.formatter === 'function' ? dl.formatter(5.0e6) : null }; }));
  console.log('   gráficos de barra:', JSON.stringify(g));
  ok('os dois gráficos (BRL e AV) foram desenhados', g.length === 2, String(g.length));
  ok('canto arredondado 3 e borda 1, como o KM', g.every(x => x.raio === 3 && x.borda === 1), JSON.stringify(g.map(x=>[x.raio,x.borda])));
  ok('eixo Y escondido, mas com a janela do padBounds (não começa do zero)', g.every(x => x.y === false && typeof x.yMin === 'number'), JSON.stringify(g.map(x=>[x.y,x.yMin])));
  ok('eixo X em 15px', g.every(x => x.tickX === 15), JSON.stringify(g.map(x=>x.tickX)));
  ok('rótulo de dados pelo plugin, 14px/700 no topo da barra', g.every(x => x.dlTam === 14 && x.dlPeso === '700' && x.dlAnc === 'end' && /datalabels/.test(x.plug)), JSON.stringify(g.map(x=>[x.dlTam,x.dlPeso,x.dlAnc,x.plug])));
  ok('respiro de 30 no topo, como o KM', g.every(x => x.topo === 30), JSON.stringify(g.map(x=>x.topo)));
  ok('alfas do KM: 33 fora do foco, D9 no foco (jan→ago todos em foco no acumulado)', g.every(x => /D9/.test(x.alfa) && !/CC|AA/.test(x.alfa)), JSON.stringify(g.map(x=>x.alfa)));
  /* as CORES e o ESPAÇAMENTO do Painel KM (Renan, 20/09/2026: "distanciamento entre
     as barras, verde e vermelho"): #3BB33B / #FF6666 fixos e sem barPercentage */
  ok('verde e vermelho são os do Painel KM (#3BB33B / #FF6666), não os do tema', g.every(x => x.cores.every(c => /^#(3BB33B|FF6666)/i.test(c))), JSON.stringify(g.map(x=>x.cores)));
  ok('sem barPercentage/categoryPercentage — o espaçamento padrão, como no KM', g.every(x => x.barPct == null && x.catPct == null), JSON.stringify(g.map(x=>[x.barPct,x.catPct])));
  ok('o rótulo em BRL usa o fmt do painel', g[0] && g[0].rotulo === '5.00 mi', g[0] && g[0].rotulo);
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

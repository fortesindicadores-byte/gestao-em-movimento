// R$/KM — vigência e cache, os dois defeitos que o Renan viu em 22/10/2026:
//  (1) "abri painel e estava flag em ago/2026, sendo que set/2026 é a última vigência":
//      o painel pinta o cache do navegador e relê; a escolha automática ficava presa no
//      mês do cache. A lista também tem de vir só com mês COM REALIZADO, do mais recente
//      para o mais antigo (PADROES.md §6).
//  (2) o slide "R$/Km Pacotes Frota" do Check de Metas saiu com R$/km ~15× maior em set/26:
//      dentro do deck o painel abria do cache (custo de setembro, km de setembro só da
//      Seara) e o iframe fechava antes da releitura. No deck (window.parent.__gvizMem), o
//      shim gviz-cache.js faz as chaves de cache dos painéis voltarem vazias.
// Roda os DOIS lados: ANTIGO=<rs-por-km antes> e ANTIGO_SHIM=<gviz-cache antes> (opcionais).
// Uso: cp scripts/rskm-vig-cache-teste.mjs docs/driverpro-apresentacao/_t.mjs && cd docs/driverpro-apresentacao
//      && RAIZ=… CHART_JS=<chart.umd.js> node _t.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const CHART_JS = process.env.CHART_JS || '';
const SHOTS = process.env.SHOTS || '';
const ANTIGO = process.env.ANTIGO;
const ORIG = 'http://gem.teste';
const PASTA = 'rs-por-km';

// ── dados sintéticos ─────────────────────────────────────────────────────────
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const VIGS = [[2025, 10], [2025, 11]]; for (let m = 0; m <= 8; m++) VIGS.push([2026, m]);   // nov/25 → set/26
const FUT = [[2026, 9], [2026, 10]];                                                     // out–nov/26: só orçado
const NV3 = ['ROTA - PIR', 'EMPURRADA - PIR', 'ROTA - CBA', 'AS - CBA', 'ROTA - GRL', 'ROTA (VAN) - GRL',
             'Apoio - CBA', 'ROTA - FLP (INATIVO)', 'DISTRIBUIÇÃO URBANA - ANG'];
const CONTAS = { 'Combustíveis Veiculos e Equipamentos': 60000, 'Fluídos (Arla)': 3000, 'Manutenção de Veículos e Equipamentos': 25000,
  'Pneus e Camaras': 9000, 'Consertos e Recapagens de Pneus': 4000, 'Lavação de Veículos': 1500,
  'Contratos de Manutenção Fabricante': 7000, 'Manutenção de Carrocerias': 2500, 'Materiais e Ferramentas de Oficina': 1200,
  'Personalização/Padronização de Veículos': 600, 'IPVA e Licenciamento de Veículos': 5000, 'Seguro de Veículos e Equipamentos': 4000,
  'Estorno de ICMS não Aproveitado': -2000, 'Despesas Diversas de Frota': 800 };
const FROTA = [['VIGÊNCIA', 'c1', 'c2', 'c3', 'NÍVEL 3', 'CONTA GERENCIAL', 'c6', 'c7', 'ORÇADO', 'REMUNERADO', 'REALIZADO']];
VIGS.forEach(([y, m]) => NV3.forEach((nv, i) => Object.entries(CONTAS).forEach(([c, base]) => {
  if (nv.startsWith('DISTRIBUIÇÃO') && (y < 2026 || m < 3)) return;
  const esc = 0.6 + i * 0.15;
  const rem = -base * esc * (0.9 + rnd() * 0.2);
  const real = rem * (0.82 + rnd() * 0.36);
  const orc = rem * (0.95 + rnd() * 0.1);
  FROTA.push([`Date(${y},${m},1)`, null, null, null, nv, c, null, null, +orc.toFixed(2), +rem.toFixed(2), +real.toFixed(2)]);
})));
FUT.forEach(([y, m]) => NV3.slice(0, 3).forEach(nv => FROTA.push([`Date(${y},${m},1)`, null, null, null, nv, 'Combustíveis Veiculos e Equipamentos', null, null, -50000, 0, 0])));
const DISP = [];
VIGS.forEach(([y, m]) => NV3.filter(n => !n.startsWith('DISTRIBUIÇÃO')).forEach((nv, i) => {
  const r = Array(33).fill(null);
  r[0] = `Date(${y},${m},1)`; r[14] = nv;
  r[31] = Math.round(40000 + i * 9000 + rnd() * 20000);
  r[32] = Math.round(r[31] * (0.88 + rnd() * 0.24));
  DISP.push(r);
}));
// Seara: aba Remunerado (select A, sum(D) group by A) e aba Combustível (gid) — F mês · G ano · K km
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro'];
const SREM = [], SCOMB = [];
for (let m = 0; m <= 8; m++) {
  SREM.push([`${String(m + 1).padStart(2, '0')}/2026`, Math.round(70000 + rnd() * 20000)]);
  for (let p = 0; p < 6; p++) { const r = Array(11).fill(null); r[4] = 'RUR' + p; r[5] = MES[m]; r[6] = 2026; r[10] = Math.round(11000 + rnd() * 5000); SCOMB.push(r); }
}
const pack = (cols, rows) => ({ status: 'ok', table: { cols: cols.map(c => ({ id: c, label: c })),
  rows: rows.map(r => ({ c: r.map(v => v == null ? null : { v }) })) } });
const GVIZ = {
  'Frota': pack(FROTA[0].map((_, i) => 'c' + i), FROTA),          // 1ª linha = cabeçalho em texto (o useData a tira)
  'Dispersão de km': pack(DISP[0].map((_, i) => 'c' + i), DISP),
  'Remunerado': pack(['Vigência', 'sum KM'], SREM),
  'gid:1982300845': pack(['c0', 'c1', 'c2', 'c3', 'Placa', 'Mês', 'Ano', 'c7', 'c8', 'c9', 'Km Rodado'], SCOMB),
};

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const ANTIGO_SHIM = process.env.ANTIGO_SHIM;

// cache VELHO: dado de antes de set/26 entrar (sem custo nem km de setembro)
const SET = 'Date(2026,8,1)';
const custoVelho = FROTA.filter(r => r[0] !== SET);
const kmVelho = DISP.filter(r => r[0] !== SET).map(r => {
  const g = r[0].match(/Date\((\d+),(\d+)/); const vk = `${g[1]}-${String(+g[2] + 1).padStart(2, '0')}`;
  const nv = r[14], proj = nv.split('-')[0].trim(), uni = nv.slice(nv.indexOf('-') + 1).trim().replace(/\s*\(INATIVO\)\s*/i, '');
  return { vk, yr: g[1], uni, proj, kmRem: r[31], kmReal: r[32] };
});
// cache "do meio": custo com setembro, km de setembro só da Seara (o caso do deck)
const custoMeio = FROTA;
const kmMeio = kmVelho.concat([{ vk: '2026-09', yr: '2026', uni: 'ANG', proj: 'DISTRIBUIÇÃO URBANA', kmRem: 90000, kmReal: 110000 }]);

async function abre(browser, { cache, mae, html, shim }) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(({ GVIZ, cache }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    if (cache) localStorage.setItem('bi_cache_rskm_v2', JSON.stringify(cache));
    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(u && u.url || u);
      if (s.includes('docs.google.com')) {
        const aba = decodeURIComponent((s.match(/sheet=([^&]+)/) || [])[1] || '');
        const gid = (s.match(/gid=(\d+)/) || [])[1];
        const body = GVIZ[aba] || GVIZ['gid:' + gid] || { status: 'ok', table: { cols: [], rows: [] } };
        return new Promise(res => setTimeout(() => res(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(body)});`, { status: 200 })), 300));
      }
      return real(u, i);
    };
  }, { GVIZ, cache });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname === '/__mae.html') return r.fulfill({ status: 200, contentType: 'text/html',
        body: `<!doctype html><script>window.__gvizMem={};</script><iframe id="f" src="/${PASTA}/" style="width:1500px;height:850px"></iframe>` });
      if (html && u.pathname === `/${PASTA}/`) return r.fulfill({ status: 200, contentType: 'text/html', body: html });
      if (shim && u.pathname.endsWith('/assets/gviz-cache.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: shim });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}${mae ? '/__mae.html' : `/${PASTA}/`}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errs };
}
const frameDe = async (page, mae) => {
  if (!mae) return page.mainFrame();
  await page.waitForSelector('#f'); return (await page.$('#f')).contentFrame();
};
const le = fr => fr.evaluate(() => ({
  sel: [...(document.getElementById('ms-vig')._sel || [])],
  lista: [...document.querySelectorAll('#ms-vig .ms-opt input[data-v]')].map(i => i.dataset.v),
  rsReal: (document.getElementById('h-rsreal') || {}).textContent?.trim(),
  rsRem: (document.getElementById('h-rsrem') || {}).textContent?.trim(),
}));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const lados = [['novo', null, null]];
if (process.env.ANTIGO) lados.push(['antigo', fs.readFileSync(process.env.ANTIGO, 'utf8'), process.env.ANTIGO_SHIM ? fs.readFileSync(process.env.ANTIGO_SHIM, 'utf8') : null]);
for (const [lado, html, shim] of lados) {
  console.log(`\n── ${lado}`);
  // referência: sem cache nenhum
  let a = await abre(browser, { html, shim });
  let fr = await frameDe(a.page, false);
  await fr.waitForFunction(() => { const e = document.getElementById('h-rsreal'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await a.page.waitForTimeout(800);
  const ref = await le(fr);
  ok(`${lado} · sem cache: abre no último mês com realizado (set/26)`, ref.sel.join() === '2026-09', ref.sel.join());
  ok(`${lado} · lista do mais recente para o mais antigo`, ref.lista[0] === '2026-09' && ref.lista.every((v, i, l) => !i || l[i - 1] > v), ref.lista.slice(0, 4).join(','));
  ok(`${lado} · lista sem mês só orçado (out e nov/26)`, !ref.lista.includes('2026-10') && !ref.lista.includes('2026-11'), ref.lista.slice(0, 3).join(','));
  ok(`${lado} · zero erro de página`, !a.errs.length, a.errs.join(' | '));
  await a.ctx.close();

  // cache velho (sem setembro) e vencido: abre no cache e, quando a releitura chega, vai a set/26
  a = await abre(browser, { html, shim, cache: { t: Date.now() - 2 * 3600e3, cost: custoVelho, km: kmVelho } });
  fr = await frameDe(a.page, false);
  await a.page.waitForTimeout(2500);
  const v = await le(fr);
  ok(`${lado} · cache velho: depois da releitura o filtro vai para set/26`, v.sel.join() === '2026-09', v.sel.join());
  ok(`${lado} · cache velho: números iguais aos da leitura sem cache`, v.rsReal === ref.rsReal && v.rsRem === ref.rsRem, `${v.rsReal}/${v.rsRem} × ${ref.rsReal}/${ref.rsRem}`);
  await a.ctx.close();

  // DENTRO DO DECK, com o cache "do meio" ainda válido: o painel não pode abrir dele
  a = await abre(browser, { html, shim, mae: true, cache: { t: Date.now() - 60e3, cost: custoMeio, km: kmMeio } });
  fr = await frameDe(a.page, true);
  await fr.waitForFunction(() => { const e = document.getElementById('h-rsreal'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  // o Check de Metas fotografa assim que a tela para de mudar: lê logo no primeiro desenho
  const d = await le(fr);
  ok(`${lado} · deck: abre em set/26 com os números da leitura do momento (não do cache)`,
     d.sel.join() === '2026-09' && d.rsReal === ref.rsReal && d.rsRem === ref.rsRem, `${d.sel} ${d.rsReal}/${d.rsRem} × ${ref.rsReal}/${ref.rsRem}`);
  const fora = await a.page.evaluate(() => !!localStorage.getItem('bi_cache_rskm_v2'));
  ok(`${lado} · deck: o cache continua no navegador para quem abre o painel fora do deck`, fora);
  await a.ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

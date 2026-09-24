// ============================================================
// Régua por LITROS ESPERADOS (24/09/2026) — o mesmo número nos quatro lugares
// que calculam o Km/L remunerado: gerot-base (Frota de Elite · Gerot · FCAs),
// painel Km/L oficial, Consumo Km/L Análise e Árvore de Combustível.
// Caso-âncora: GRL ago/2026, medido no banco (KmL Elite vs Painel):
//   ROTA 41 placas · 60.646 km · 20.336 L · rem 2,929
//   VAN   8 placas · 14.209 km ·  1.813 L · rem 6,790
//   → litros previstos 22.798 · gastos 22.149 · atingimento 102,9 %
// Roda o CÓDIGO DOS ARQUIVOS (vm), não uma cópia. Rodado nos dois lados:
// com o código de antes o gerot-base dá 95,0 e o painel 92,3.
// ============================================================
import fs from 'node:fs'; import vm from 'node:vm';
let ok = 0, ruim = 0;
const t = (c, m, x) => { c ? ok++ : ruim++; console.log((c ? '  ok   ' : '  ✗    ') + m + (c ? '' : '  → ' + JSON.stringify(x))); };
const perto = (a, b, tol = 0.15) => a != null && Math.abs(a - b) <= tol;

// linhas placa-mês da aba Km/L, no formato do gviz (col 0 vig · 4 rem · 14 projeto · 22 km · 23 litros)
function linha(vig, proj, km, lit, rem) { const c = []; c[0] = { v: `Date(${vig.slice(0, 4)},${+vig.slice(5) - 1},1)` }; c[4] = { v: rem }; c[14] = { v: proj }; c[22] = { v: km }; c[23] = { v: lit }; return { c }; }
const ROWS = [];
for (let i = 0; i < 41; i++) ROWS.push(linha('2026-08', 'ROTA - GRL', 60646 / 41, 20336 / 41, 2.929));
for (let i = 0; i < 8; i++) ROWS.push(linha('2026-08', 'VAN - GRL', 14209 / 8, 1813 / 8, 6.790));
// julho: um mês só de ROTA, para o acumulado somar litros previstos de meses diferentes
for (let i = 0; i < 10; i++) ROWS.push(linha('2026-07', 'ROTA - GRL', 1500, 500, 3.2));
const ESP_AGO = 60646 / 2.929 + 14209 / 6.790, LIT_AGO = 22149;
const ESP_JUL = 15000 / 3.2, LIT_JUL = 5000;

// ── 1) gerot-base, com o load() de verdade ──
console.log('\n═══ gerot-base (Frota de Elite · Gerot · FCAs) ═══');
{
  const ctx = vm.createContext({ console, setTimeout, clearTimeout });
  vm.runInContext('globalThis.window = globalThis;', ctx);
  const vazio = { data: [], error: null };
  const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, range() { return q; }, limit() { return q; }, gte() { return q; }, lte() { return q; }, then(r) { return Promise.resolve(vazio).then(r); } };
  ctx.supabase = { createClient: () => ({ from: () => q }) };
  ctx.document = { createElement: () => ({ remove() {} }), head: { appendChild(el) {
    const fn = (el.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
    const aba = decodeURIComponent((el.src.match(/[?&]sheet=([^&]*)/) || [])[1] || '');
    setTimeout(() => ctx[fn] && ctx[fn]({ status: 'ok', table: { rows: aba === 'Km/L' ? ROWS : [] } }), 0);
  } } };
  vm.runInContext(fs.readFileSync(new URL('../assets/gerot-base.js', import.meta.url), 'utf8'), ctx);
  const recs = await ctx.window.GerotBase.load({ fundir: true });
  const ago = recs.find(r => r.field === 'comb' && r.unit === 'CDD GUARULHOS' && r.vig === '2026-08');
  t(ago && perto(ago.atg, ESP_AGO / LIT_AGO * 100), `GRL ago: atingimento = previstos ÷ gastos = ${(ESP_AGO / LIT_AGO * 100).toFixed(1)}%`, ago && ago.atg);
  t(ago && perto(ago.meta, 74855 / ESP_AGO, 0.01), 'meta = Km/L rem equivalente (Σkm ÷ Σprevistos ≈ 3,28)', ago && ago.meta);
  t(ago && perto(ago.real, 74855 / LIT_AGO, 0.01), 'real = Σkm ÷ Σlitros (3,38)', ago && ago.real);
  t(ago && perto(ago.real / ago.meta * 100, ago.atg), 'real ÷ meta = atingimento (o trio fecha)', ago && [ago.real, ago.meta, ago.atg]);
  const ac = ctx.window.GerotBase.acumFor(['2026-07', '2026-08']).find(r => r.field === 'comb' && r.unit === 'CDD GUARULHOS');
  t(ac && perto(ac.atg, (ESP_AGO + ESP_JUL) / (LIT_AGO + LIT_JUL) * 100), 'acumulado jul+ago: Σprevistos ÷ Σgastos, mês a mês', ac && ac.atg);
}

// ── 2) painéis: aggRows / kmlAgg do próprio arquivo ──
function extrai(arq, ini, fim) { const s = fs.readFileSync(new URL('../' + arq, import.meta.url), 'utf8'); const a = s.indexOf(ini); return s.slice(a, s.indexOf(fim, a)); }
const PAINEL_ROWS = ROWS.filter(r => r.c[0].v.startsWith('Date(2026,7')).map(r => {
  const x = []; x[0] = new Date(2026, 7, 1); x[4] = r.c[4].v; x[5] = 0; x[6] = 0; x[9] = 0; x[14] = r.c[14].v; x[22] = r.c[22].v; x[23] = r.c[23].v; return x; });
for (const arq of ['combustivel/eficiencia-kml/index.html', 'consumo-kml-analise/index.html']) {
  console.log(`\n═══ ${arq} (aggRows) ═══`);
  const ctx = vm.createContext({ console, Date });
  vm.runInContext(extrai(arq, 'function _pvK(v)', '\n}') + '\n}', ctx);
  vm.runInContext(`var CL={vig:0,rem:4,remM:5,real:6,rsLReal:9,proj:14,kmRod:22,litros:23};var remMode='medio';
    var getProj=r=>String(r[14]).split('-')[0].trim(); var remPriceFor=()=>null;` + extrai(arq, 'function aggRows(rows){', '\nfunction ') , ctx);
  const A = vm.runInContext('aggRows', ctx)(PAINEL_ROWS);
  t(perto(A.remAvg, 74855 / ESP_AGO, 0.01), 'Km/L Rem = Σkm ÷ Σprevistos (3,28, era 3,66)', A.remAvg);
  t(perto((A.realWt / A.remAvg - 1) * 100, (ESP_AGO / LIT_AGO - 1) * 100), 'Δ Rem % = +2,9% (era −7,7%)', (A.realWt / A.remAvg - 1) * 100);
}
console.log('\n═══ combustivel/arvore-combustivel (kmlAgg) ═══');
{
  const ctx = vm.createContext({ console, Date });
  vm.runInContext(`var KM={vig:0,proj:14,remMed:4,kmRod:22,litros:23};
    var S_KM=${JSON.stringify(PAINEL_ROWS.map(r => { const y = r.slice(); y[0] = '2026-08'; return y; }))};
    var kParseVig=v=>v?new Date(+v.slice(0,4),+v.slice(5)-1,1):null; var vigBR=d=>String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
    var _match=()=>true; var getNv3Prefix=v=>v.split('-')[0].trim();` + extrai('combustivel/arvore-combustivel/index.html', 'function kmlAgg(f){', '\nfunction '), ctx);
  const K = vm.runInContext('kmlAgg', ctx)({});
  t(perto(K.rem, 74855 / ESP_AGO, 0.01), 'card KM/L Rem = 3,28 (o mesmo do painel e do Elite)', K.rem);
}
console.log(`\n${ok} ok · ${ruim} falha(s)`); process.exit(ruim ? 1 : 0);

// ============================================================================
// Teste do assets/estatistica.js — o motor do painel de Correlações.
//
// Os valores de referência foram calculados em 23/09/2026 com
// simple-statistics 7.12.0 (sampleCorrelation, linearRegression, rSquared) e
// jStat 1.9.6 (studentt.cdf/inv, spearmancoeff, ibeta, models.ols) e estão
// gravados aqui, para o teste não depender de pacote nenhum. Rodar uma cópia
// da fórmula mediria a cópia; por isso cada função é conferida contra uma
// biblioteca independente.
//
// Uso: node scripts/estatistica-teste.mjs
// ============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../assets/estatistica.js');

let ok = 0, falha = 0;
const perto = (nome, v, ref, tol = 1e-6) => {
  const bom = Number.isFinite(v) && Number.isFinite(ref) && Math.abs(v - ref) <= tol * Math.max(1, Math.abs(ref));
  if (bom) ok++; else { falha++; console.log(`✗ ${nome}: ${v} ≠ ${ref}`); }
};
const igual = (nome, v, ref) => { if (v === ref) ok++; else { falha++; console.log(`✗ ${nome}: ${JSON.stringify(v)} ≠ ${JSON.stringify(ref)}`); } };

const x = [2.1, 3.4, 1.9, 5.6, 4.4, 6.1, 7.3, 3.9, 5.0, 8.2, 2.7, 6.8];
const y = [1.0, 2.2, 1.4, 4.9, 3.1, 5.7, 6.0, 2.9, 4.2, 7.9, 1.1, 6.6];
const z = [5.0, 4.1, 5.5, 2.0, 3.3, 2.2, 1.0, 3.8, 2.9, 0.5, 4.8, 1.6];
const w = [3, 3, 7, 7, 1, 9, 9, 2, 5, 5, 6, 4];

// ── Pearson (simple-statistics) + p (jStat) ──
const p = E.pearson(x, y);
perto('pearson r', p.r, 0.9849916743266937);
perto('pearson p', p.p, 5.848133088903751e-9, 1e-6);
igual('pearson n', p.n, 12);
// pares incompletos são descartados, não zerados
const p2 = E.pearson([1, 2, null, 4, NaN, 6, 7, 8], [2, 4, 6, 8, 10, 12, 14, 16]);
igual('pearson ignora buracos (n)', p2.n, 6); perto('pearson ignora buracos (r)', p2.r, 1, 1e-12);
igual('pearson constante', E.pearson([1, 1, 1, 1], [1, 2, 3, 4]).constante, true);

// ── Spearman com empates (jStat.spearmancoeff) ──
const s = E.spearman(w, y);
perto('spearman rho (empates)', s.rho, 0.30986683868975945);
igual('postos com empate pela média', JSON.stringify(E.postos([3, 3, 7, 1])), JSON.stringify([2.5, 2.5, 4, 1]));

// ── reta (simple-statistics linearRegression / rSquared) ──
const f = E.reta(x, y);
perto('reta a', f.a, -1.3525979527003194);
perto('reta b', f.b, 1.101588422167314);
perto('reta r2', f.r2, 0.9702085984929031);
perto('reta p_b = p de pearson', f.p_b, p.p, 1e-6);
const fx = E.faixaReta(f, 5);
perto('faixa da reta: centro', fx.y, f.a + f.b * 5, 1e-12);
igual('faixa da reta: lo < y < hi', fx.lo < fx.y && fx.y < fx.hi, true);

// ── t → p bicaudal (jStat.studentt.cdf) ──
[[2.0, 10, 0.07338803469518873], [1.5, 5, 0.19390368023493632], [3.2, 30, 0.003238601714257161],
 [0.3, 7, 0.7728900510714791], [4.5, 3, 0.020490412344456033]].forEach(([t, gl, ref]) => perto(`pT(${t},${gl})`, E.pT(t, gl), ref, 1e-7));
perto('tCrit(0.05, 10)', E.tCrit(0.05, 10), 2.228138842468655, 1e-6);

// ── beta incompleta regularizada (jStat.ibeta) ──
perto('ibeta(0.3,2,3)', E.ibeta(0.3, 2, 3), 0.34830000000000017, 1e-9);
perto('ibeta(0.7,0.5,5)', E.ibeta(0.7, 0.5, 5), 0.9993086966143995, 1e-9);
perto('ibeta(0.5,10,10)', E.ibeta(0.5, 10, 10), 0.5, 1e-8);

// ── regressão múltipla y ~ x + z (jStat.models.ols) ──
const o = E.ols([x, z], y);
igual('ols ok', o.ok, true);
perto('ols intercepto', o.intercepto, -6.685419399965474, 1e-8);
perto('ols b_x', o.coef[0].b, 1.7152227675052263, 1e-8);
perto('ols b_z', o.coef[1].b, 0.7839576551712777, 1e-8);
perto('ols t_x', o.coef[0].t, 2.9607268685110038, 1e-8);
perto('ols p_x', o.coef[0].p, 0.01594068566642859, 1e-6);
perto('ols p_z', o.coef[1].p, 0.31458121603096756, 1e-6);
perto('ols r2', o.r2, 0.9735432673056971);
perto('ols r2adj', o.r2adj, 0.9676639933736297);
perto('ols F', o.F, 165.58902996434662, 1e-8);
// β padronizado = b · sd(x)/sd(y)
perto('ols beta padronizado', o.coef[0].beta_pad, o.coef[0].b * E.desvio(x) / E.desvio(y), 1e-12);
// colinear: z2 = 2·x → recusa com motivo, não NaN silencioso
const oc = E.ols([x, x.map(v => 2 * v)], y);
igual('ols colinear recusa', oc.ok, false);
igual('ols poucos pontos recusa', E.ols([[1, 2, 3], [2, 3, 5]], [1, 2, 3]).ok, false);

// ── Benjamini-Hochberg ──
igual('BH', JSON.stringify(E.bh([0.01, 0.04, 0.03, 0.005, 0.2]).map(v => +v.toFixed(6))), JSON.stringify([0.025, 0.05, 0.05, 0.025, 0.2]));
igual('BH preserva NaN', Number.isNaN(E.bh([0.01, NaN, 0.5])[1]), true);

// ── defasagem: x adianta y em 1 mês (3 entidades × 8 meses) ──
const serie = [];
['A', 'B', 'C'].forEach((ent, e) => { const base = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10].map(v => v + e);
  for (let t = 1; t <= 8; t++) serie.push({ ent, t, x: base[t], y: base[t - 1] * 2 + (t % 2) * 0.1 }); });
const lags = E.defasagens(serie, 3);
igual('defasagem n por k', JSON.stringify(lags.map(l => l.n)), JSON.stringify([24, 21, 18, 15]));
igual('defasagem: k=1 é a mais forte', lags.reduce((m, l) => (l.r > m.r ? l : m)).k, 1);
perto('defasagem r(k=1)', lags[1].r, 0.9999548012351142, 1e-8);
// entidades não se misturam: um único par por entidade dá n=0 no k=1
igual('defasagem não cruza entidades', E.defasagens([{ ent: 'A', t: 1, x: 1, y: 1 }, { ent: 'B', t: 2, x: 2, y: 2 }], 1)[1].n, 0);

// ── descritivas ──
const d = E.descreve([5, 1, NaN, 3, null, 9]);
igual('descreve n', d.n, 4); perto('descreve media', d.media, 4.5); perto('descreve mediana', d.mediana, 4); perto('descreve dp', d.dp, Math.sqrt((0.25 + 12.25 + 2.25 + 20.25) / 3));
igual('forca', [0.8, -0.5, 0.25, 0.1].map(E.forca).join(','), 'forte,moderada,fraca,desprezível');

console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

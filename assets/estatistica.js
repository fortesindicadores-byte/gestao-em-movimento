/* ============================================================================
   estatistica.js — o motor de cálculo do painel de Correlações (23/09/2026).

   Funções puras, sem DOM: correlação de Pearson e de Spearman com p-valor,
   ajuste linear, regressão múltipla (mínimos quadrados) com erro-padrão e
   p-valor por coeficiente, distribuição t (via beta incompleta regularizada)
   e a correção de Benjamini-Hochberg para múltiplas comparações.

   Vale nos dois mundos: no browser vira `window.Estat`; no node é `module.exports`
   (o teste scripts/estatistica-teste.mjs confere cada função contra valores de
   referência calculados com simple-statistics 7.12 e jStat 1.9.6).

   Regras de uso que o painel segue:
   - um par só entra com n ≥ Estat.N_MIN pontos completos (os dois valores
     presentes e finitos);
   - o p-valor de cada célula da matriz é ajustado por BH (q-valor), porque
     com 30 variáveis são 435 pares e uns 20 "significativos" sairiam por acaso;
   - correlação não é causa — o texto da tela diz isso em cada visão.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Estat = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const N_MIN = 8;
  const fin = v => typeof v === 'number' && isFinite(v);

  // ── pares completos: só as posições em que x e y existem ──
  function pares(x, y) {
    const a = [], b = [];
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) if (fin(x[i]) && fin(y[i])) { a.push(x[i]); b.push(y[i]); }
    return [a, b];
  }
  function media(v) { return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; }
  function desvio(v) {                       // desvio-padrão amostral (n−1)
    if (v.length < 2) return NaN;
    const m = media(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
  }
  function descreve(v) {
    const a = v.filter(fin);
    if (!a.length) return { n: 0, media: NaN, dp: NaN, min: NaN, max: NaN, mediana: NaN };
    const s = a.slice().sort((p, q) => p - q);
    const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return { n: a.length, media: media(a), dp: desvio(a), min: s[0], max: s[s.length - 1], mediana: med };
  }

  // ── funções especiais: ln Γ, beta incompleta regularizada (Numerical Recipes) ──
  function lnGamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -t + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  // I_x(a, b)
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  // p-valor bicaudal da t de Student com `gl` graus de liberdade
  function pT(t, gl) {
    if (!fin(t) || !(gl > 0)) return NaN;
    const x = gl / (gl + t * t);
    return Math.min(1, Math.max(0, ibeta(x, gl / 2, 0.5)));
  }
  // t crítico bicaudal (bisseção sobre pT) — para o intervalo de confiança da reta
  function tCrit(alpha, gl) {
    let lo = 0, hi = 50;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (pT(mid, gl) > alpha) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  // ── Pearson ──
  function pearson(x, y) {
    const [a, b] = pares(x, y), n = a.length;
    if (n < 3) return { r: NaN, n, t: NaN, p: NaN };
    const ma = media(a), mb = media(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    if (!(saa > 0) || !(sbb > 0)) return { r: NaN, n, t: NaN, p: NaN, constante: true };
    const r = Math.max(-1, Math.min(1, sab / Math.sqrt(saa * sbb)));
    const t = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt((n - 2) / (1 - r * r));
    return { r, n, t, p: Math.abs(r) >= 1 ? 0 : pT(t, n - 2) };
  }

  // ── postos com empate pela média (o que Spearman pede) ──
  function postos(v) {
    const idx = v.map((x, i) => i).sort((i, j) => v[i] - v[j]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
      const rk = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]] = rk;
      i = j + 1;
    }
    return r;
  }
  function spearman(x, y) {
    const [a, b] = pares(x, y), n = a.length;
    if (n < 3) return { rho: NaN, n, p: NaN };
    const p = pearson(postos(a), postos(b));
    return { rho: p.r, n, t: p.t, p: p.p };
  }

  // ── reta y = a + b·x, com R², erro-padrão da inclinação e do ajuste ──
  function reta(x, y) {
    const [a, b] = pares(x, y), n = a.length;
    if (n < 3) return { a: NaN, b: NaN, r2: NaN, n, se_b: NaN, p_b: NaN, se: NaN };
    const mx = media(a), my = media(b);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (a[i] - mx) * (b[i] - my); sxx += (a[i] - mx) * (a[i] - mx); }
    if (!(sxx > 0)) return { a: NaN, b: NaN, r2: NaN, n, se_b: NaN, p_b: NaN, se: NaN };
    const bb = sxy / sxx, aa = my - bb * mx;
    let sse = 0, sst = 0;
    for (let i = 0; i < n; i++) { const yh = aa + bb * a[i]; sse += (b[i] - yh) ** 2; sst += (b[i] - my) ** 2; }
    const r2 = sst > 0 ? 1 - sse / sst : NaN;
    const se = n > 2 ? Math.sqrt(sse / (n - 2)) : NaN;
    const se_b = se / Math.sqrt(sxx);
    const t = se_b > 0 ? bb / se_b : Infinity;
    return { a: aa, b: bb, r2, n, se, se_b, t, p_b: se_b > 0 ? pT(t, n - 2) : 0, mx, my, sxx };
  }
  // faixa de confiança da reta média em x0 (95% por padrão)
  function faixaReta(fit, x0, alpha) {
    const tc = tCrit(alpha || 0.05, fit.n - 2);
    const h = tc * fit.se * Math.sqrt(1 / fit.n + (x0 - fit.mx) ** 2 / fit.sxx);
    const y = fit.a + fit.b * x0;
    return { y, lo: y - h, hi: y + h };
  }

  // ── resolve A·x = b por eliminação de Gauss com pivoteamento parcial ──
  function resolve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;             // singular (colinearidade)
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function inversa(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      const piv = M[c][c]; for (let k = 0; k < 2 * n; k++) M[c][k] /= piv;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(r => r.slice(n));
  }

  // ── regressão múltipla: y ~ 1 + X (X = lista de colunas) ──
  // devolve coeficientes brutos, erro-padrão, t, p, R², R² ajustado e o
  // coeficiente padronizado (β em desvios-padrão), que é o que compara variáveis
  // de escalas diferentes.
  function ols(cols, y) {
    const k = cols.length, n0 = y.length, idx = [];
    for (let i = 0; i < n0; i++) if (fin(y[i]) && cols.every(c => fin(c[i]))) idx.push(i);
    const n = idx.length;
    if (n < k + 3) return { ok: false, motivo: `só ${n} linha(s) completas para ${k} variável(is)`, n };
    const X = idx.map(i => [1].concat(cols.map(c => c[i]))), Y = idx.map(i => y[i]);
    const p = k + 1;
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0)), Xty = new Array(p).fill(0);
    for (let r = 0; r < n; r++) for (let i = 0; i < p; i++) { Xty[i] += X[r][i] * Y[r]; for (let j = 0; j < p; j++) XtX[i][j] += X[r][i] * X[r][j]; }
    const inv = inversa(XtX);
    if (!inv) return { ok: false, motivo: 'variáveis colineares (uma é combinação das outras)', n };
    const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const my = media(Y);
    let sse = 0, sst = 0;
    for (let r = 0; r < n; r++) { const yh = beta.reduce((s, b, j) => s + b * X[r][j], 0); sse += (Y[r] - yh) ** 2; sst += (Y[r] - my) ** 2; }
    const gl = n - p, s2 = sse / gl;
    const se = inv.map((row, i) => Math.sqrt(Math.max(0, s2 * row[i])));
    const t = beta.map((b, i) => se[i] > 0 ? b / se[i] : Infinity);
    const pv = t.map(tt => pT(tt, gl));
    const r2 = sst > 0 ? 1 - sse / sst : NaN;
    const r2adj = 1 - (1 - r2) * (n - 1) / gl;
    const sdy = Math.sqrt(sst / (n - 1));
    const coef = cols.map((c, j) => {
      const sdx = desvio(idx.map(i => c[i]));
      return { b: beta[j + 1], se: se[j + 1], t: t[j + 1], p: pv[j + 1], beta_pad: sdy > 0 ? beta[j + 1] * sdx / sdy : NaN };
    });
    // F global
    const F = k > 0 && sse > 0 ? ((sst - sse) / k) / (sse / gl) : NaN;
    return { ok: true, n, k, intercepto: beta[0], coef, r2, r2adj, gl, F, sse, sst };
  }

  // ── Benjamini-Hochberg: p-valores → q-valores (mesma ordem da entrada) ──
  function bh(p) {
    const idx = p.map((v, i) => i).filter(i => fin(p[i])).sort((i, j) => p[i] - p[j]);
    const m = idx.length, q = new Array(p.length).fill(NaN);
    let prev = 1;
    for (let r = m - 1; r >= 0; r--) {
      const i = idx[r];
      const val = Math.min(prev, p[i] * m / (r + 1));
      q[i] = Math.min(1, val); prev = q[i];
    }
    return q;
  }

  // ── defasagem: correlação de X(t−k) com Y(t) dentro de cada entidade ──
  // series = [{ent, t (inteiro ordenável), x, y}] ; devolve [{k, r, n, p}]
  function defasagens(series, kmax) {
    const porEnt = {};
    series.forEach(s => { (porEnt[s.ent] = porEnt[s.ent] || {})[s.t] = s; });
    const out = [];
    for (let k = 0; k <= kmax; k++) {
      const xs = [], ys = [];
      Object.values(porEnt).forEach(m => {
        Object.keys(m).forEach(t => {
          const cur = m[t], ant = m[+t - k];
          if (cur && ant && fin(ant.x) && fin(cur.y)) { xs.push(ant.x); ys.push(cur.y); }
        });
      });
      const c = pearson(xs, ys);
      out.push({ k, r: c.r, n: c.n, p: c.p });
    }
    return out;
  }

  // ── leitura em português da força de uma correlação ──
  function forca(r) {
    const a = Math.abs(r);
    if (!fin(r)) return '—';
    if (a >= 0.7) return 'forte'; if (a >= 0.4) return 'moderada'; if (a >= 0.2) return 'fraca'; return 'desprezível';
  }

  return { N_MIN, pares, media, desvio, descreve, pearson, spearman, postos, reta, faixaReta,
    ols, bh, pT, tCrit, ibeta, lnGamma, resolve, inversa, defasagens, forca };
}));

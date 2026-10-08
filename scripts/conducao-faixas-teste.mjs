// Régua de 3 faixas do pilar RPM (Renan, 08/10/2026): roda o rpmJanela e o
// rpmNotaDia DO PRÓPRIO robô (vm), sem rede. node scripts/conducao-faixas-teste.mjs
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('./conducao-robot.mjs', import.meta.url), 'utf8');
const pega = (ini, fim) => { const a = src.indexOf(ini); const b = src.indexOf(fim, a); if (a < 0 || b < 0) throw new Error('não achei ' + ini); return src.slice(a, b); };
const codigo = pega('const RPM_LENTA', 'async function geotabRpmDia') + pega('function rpmJanela', '/* ── USO DE MARCHAS');
const ctx = { process: { env: {} }, console };
vm.runInNewContext(codigo + ';this.rpmJanela=rpmJanela;this.rpmNotaDia=rpmNotaDia;', ctx);
let ok = 0, fail = 0; const t = (c, m) => { c ? ok++ : fail++; console.log((c ? 'ok  ' : 'FALHA ') + m); };
// 10 s em cada rpm: 800 (lenta, fora) · 950 (abaixo) · 1200 verde · 1600 branca · 2000 amarela · 2500 vermelha
const rpms = [800, 950, 1200, 1600, 2000, 2500];
const am = rpms.map((rpm, i) => ({ t: i * 10000, rpm }));
const j = ctx.rpmJanela(am, 0, 60000);
t(j.rodando === 41 && j.verde === 10 && j.branca === 10 && j.amarela === 10, 'segundos por faixa (marcha lenta fora; a última amostra vale 1 s): ' + JSON.stringify(j));
const n = ctx.rpmNotaDia({ bruto: { rpm: { verde: 600, branca: 600, amarela: 600, rodando: 3000 } }, rpm_verde_pct: 20 });
t(Math.abs(n - (600 + 400 + 200) / 3000 * 100) < 1e-9, 'nota = (verde + 2/3 branca + 1/3 amarela) ÷ rodando = ' + n.toFixed(2));
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 100, rodando: 3000 } }, rpm_verde_pct: 33 }) === 33, 'dia antigo (sem branca/amarela no bruto) usa a % da verde');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 10, branca: 10, amarela: 0, rodando: 30 } }, rpm_verde_pct: null }) === null, 'menos de 1 min rodando não vale nota');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 3000, branca: 0, amarela: 0, rodando: 3000 } } }) === 100, 'tudo na verde = 100');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 0, branca: 0, amarela: 3000, rodando: 3000 } } }).toFixed(4) === (100 / 3).toFixed(4), 'tudo na amarela = 33,3');
// limites: 1400 é verde, 1401 branca, 1800 branca, 2300 amarela, 2301 vermelha
const lim = [1000, 1400, 1401, 1800, 1801, 2300, 2301].map((rpm, i) => ({ t: i * 1000, rpm }));
const k = ctx.rpmJanela(lim, 0, 7000);
t(k.verde === 2 && k.branca === 2 && k.amarela === 2 && k.rodando === 7, 'limites das faixas: ' + JSON.stringify(k));
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail ? 1 : 0);

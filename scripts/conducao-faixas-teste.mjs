// Régua do pilar RPM (Renan, 08/10/2026: "Pontua só faixa verde e faixa
// amarela na descida não entra na conta"): roda o rpmJanela e o rpmNotaDia DO
// PRÓPRIO robô (vm), sem rede. node scripts/conducao-faixas-teste.mjs
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('./conducao-robot.mjs', import.meta.url), 'utf8');
const pega = (ini, fim) => { const a = src.indexOf(ini); const b = src.indexOf(fim, a); if (a < 0 || b < 0) throw new Error('não achei ' + ini); return src.slice(a, b); };
const codigo = pega('const RPM_LENTA', 'async function geotabRpmDia') + pega('function rpmJanela', '/* ── RELEVO');
const ctx = { process: { env: {} }, console };
vm.runInNewContext(codigo + ';this.rpmJanela=rpmJanela;this.rpmNotaDia=rpmNotaDia;', ctx);
let ok = 0, fail = 0; const t = (c, m) => { c ? ok++ : fail++; console.log((c ? 'ok  ' : 'FALHA ') + m); };
// 10 s em cada rpm: 800 (lenta, fora) · 950 (abaixo) · 1200 verde · 1600 branca · 2000 amarela · 2500 vermelha
const rpms = [800, 950, 1200, 1600, 2000, 2500];
const am = rpms.map((rpm, i) => ({ t: i * 10000, rpm }));
const j = ctx.rpmJanela(am, 0, 60000);
t(j.rodando === 41 && j.verde === 10 && j.branca === 10 && j.amarela === 10 && j.amarDesc === 0, 'segundos por faixa (marcha lenta fora; a última amostra vale 1 s): ' + JSON.stringify(j));
// tudo em descida de 5%: só a amarela em descida sai; a vermelha em descida continua contando
const jd = ctx.rpmJanela(am, 0, 60000, () => -5);
t(jd.amarDesc === 10 && jd.semRampa === 0, 'em descida de 5%: 10 s de amarela fora da conta, vermelha não: ' + JSON.stringify(jd));
const js = ctx.rpmJanela(am, 0, 60000, () => -1.9);
t(js.amarDesc === 0, 'descida de 1,9% não conta como descida');
const jn = ctx.rpmJanela(am, 0, 60000, () => null);
t(jn.amarDesc === 0 && jn.semRampa === 41, 'sem rampa medida: a amarela fica no denominador e o tempo vai para semRampa');
const n = ctx.rpmNotaDia({ bruto: { rpm: { verde: 600, branca: 600, amarela: 600, amarDesc: 400, rodando: 3000 } }, rpm_verde_pct: 20 });
t(Math.abs(n - 600 / (3000 - 400) * 100) < 1e-9, 'nota = verde ÷ (rodando − amarela em descida) = ' + n.toFixed(2));
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 600, branca: 600, amarela: 600, rodando: 3000 } }, rpm_verde_pct: 20 }) === 20, 'dia sem rampa (sem amarDesc no bruto) usa a % da verde — a branca não vale mais nada');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 10, amarela: 0, amarDesc: 0, rodando: 30 } }, rpm_verde_pct: null }) === null, 'menos de 1 min rodando não vale nota');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 3000, amarDesc: 0, rodando: 3000 } } }) === 100, 'tudo na verde = 100');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 0, branca: 3000, amarDesc: 0, rodando: 3000 } } }) === 0, 'tudo na branca = 0');
t(ctx.rpmNotaDia({ bruto: { rpm: { verde: 2000, amarela: 1000, amarDesc: 1000, rodando: 3000 } } }) === 100, 'verde + amarela só em descida = 100');
// limites: 1400 é verde, 1401 branca, 1800 branca, 2300 amarela, 2301 vermelha
const lim = [1000, 1400, 1401, 1800, 1801, 2300, 2301].map((rpm, i) => ({ t: i * 1000, rpm }));
const k = ctx.rpmJanela(lim, 0, 7000);
t(k.verde === 2 && k.branca === 2 && k.amarela === 2 && k.rodando === 7, 'limites das faixas: ' + JSON.stringify(k));
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail ? 1 : 0);

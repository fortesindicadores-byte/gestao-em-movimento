// DISPERSÃO DE KM DO PAINEL DE METAS COM SETEMBRO E A EMPURRADA (Renan, 19/10/2026:
// "Dispersão de km está assim… Ajuste e considere empurrada junto. Não mude o texto
// lá nas metas, apenas considere"). Roda o compDisp DO PRÓPRIO painel em node:vm, com
// os motores reais (assets/dispersao-km.js, balanco-massa.js, fca-auto.js), e confere:
//   · sem o banco, o número é o da conta antiga (ROTA + AS da aba);
//   · com a dispersao_km, set/26 entra (a aba vai até ago/26);
//   · com o balanço de massa, a Empurrada entra com o km recomposto; a Van fica fora;
//   · sem o balanço, a Empurrada fica fora (o km dela sem o balanço sai inflado).
// Uso: node scripts/painel-metas-dispersao-teste.mjs
import fs from 'fs';
import vm from 'vm';

const RAIZ = new URL('..', import.meta.url).pathname;
let oks = 0, falhas = 0;
const ok = (n, c, d) => { console.log(`  ${c ? '✓' : '✗'} ${n}${d ? '  (' + d + ')' : ''}`); c ? oks++ : falhas++; };

const ctx = { console: { log() {}, warn() {} }, Math, Date, JSON, Object, Array, Set, Map, String, Number, isFinite, parseFloat, parseInt, RegExp, Promise };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['assets/dispersao-km.js', 'assets/balanco-massa.js', 'assets/fca-auto.js']) vm.runInContext(fs.readFileSync(RAIZ + f, 'utf8'), ctx, { filename: f });

// as funções do painel, como estão no arquivo
const html = fs.readFileSync(RAIZ + 'painel-metas/index.html', 'utf8');
const a = html.indexOf('function compDispAba(rows){'), b = html.indexOf('// DPO/VPO = auditoria por SEMESTRE');
if (a < 0 || b < 0) throw new Error('não achei o compDisp no painel');
const pegaFn = nome => { const i = html.indexOf('function ' + nome + '('); return html.slice(i, html.indexOf('\n', i)); };
vm.runInContext([pegaFn('parseD'), pegaFn('vigKeyN'), html.slice(a, b).replace('const DISP_PROJ_META', 'var DISP_PROJ_META').replace('let DISP_FONTE', 'var DISP_FONTE')].join('\n'), ctx);

// ── aba Dispersão de km (jan–ago/26): 0 vig · 14 projeto · 31 rem · 32 real ──
const PROJS = { 'ROTA - CGR': [10000, 11000], 'AUTO SERVIÇO - FLP': [5000, 5200], 'EMPURRADA - PIR': [40000, 50000], 'ROTA (VAN) - GRL': [2000, 3000] };
const aba = [];
for (let m = 0; m < 8; m++) Object.entries(PROJS).forEach(([p, [rem, real]]) => {
  const r = Array(34).fill(null); r[0] = `Date(2026,${m},1)`; r[14] = p; r[31] = rem; r[32] = real; aba.push(r);
});
// ── banco: set/26 (dispersao_km) ──
const disp = { linhas: [
  { vigencia: '2026-09', unidade: 'CGR', projeto: 'Rota', km_rem: 10000, km_real: 12000 },
  { vigencia: '2026-09', unidade: 'FLP', projeto: 'Auto Serviço', km_rem: 5000, km_real: 5000 },
  { vigencia: '2026-09', unidade: 'PIR', projeto: 'Empurrada - 28 Palets', km_rem: 40000, km_real: 50000 },
  { vigencia: '2026-09', unidade: 'GRL', projeto: 'Van', km_rem: 2000, km_real: 9000 },
  { vigencia: '2026-08', unidade: 'CGR', projeto: 'Rota', km_rem: 1, km_real: 999999 }   // ago/26 a aba tem: não entra
], placas: [], kml: [] };
// ── DRE Frota (remunerado por conta da Empurrada de PIR) e balanço de massa ──
const frotaTab = { header: ['Vigência', 'Unidade', 'Nível 3', 'Conta Gerencial', 'Remunerado', 'Realizado'], rows: [] };
for (let m = 1; m <= 9; m++) frotaTab.rows.push([`Date(2026,${m - 1},1)`, 'Piraí', 'EMPURRADA - PIR', 'Combustíveis Veículos e Equipamentos', -200000, -210000]);
const bal = [{ unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-08', conta: 'Combustíveis Veículos e Equipamentos', valor: 40000 }];

const ytd = (mo, ate) => { let rem = 0, real = 0; mo.forEach(([m, r, re]) => { if (m <= ate) { rem += r; real += re; } }); return (real - rem) / rem * 100; };
const run = banco => vm.runInContext('compDisp(__aba,__frota,__banco)', Object.assign(ctx, { __aba: aba, __frota: frotaTab, __banco: banco }));
const prox = (x, y) => x != null && y != null && Math.abs(x - y) < 1e-6;

console.log('\n1 · sem o banco');
const semB = run({ disp: null, bal: null });
const abaVelha = vm.runInContext('compDispAba(__aba)', ctx);
ok('igual à conta antiga (ROTA + AS da aba) em jan–ago', [0, 1, 2, 3, 4, 5, 6, 7].every(m => prox(semB[202600 + m], abaVelha[202600 + m])), `ago ${semB[202607]?.toFixed(3)} × ${abaVelha[202607]?.toFixed(3)}`);
ok('set/26 não aparece sem o banco', semB[202608] == null);
ok('a nota da fonte diz o que faltou', /Empurrada fora/.test(ctx.DISP_FONTE) && /set\/26/.test(ctx.DISP_FONTE), ctx.DISP_FONTE);

console.log('\n2 · com a dispersão do banco, sem o balanço');
const soDisp = run({ disp, bal: null });
const mo2 = [...Array(8)].map((_, m) => [m, 15000, 16200]).concat([[8, 15000, 17000]]);
ok('set/26 entra (ROTA + AS, a Van e a Empurrada fora)', prox(soDisp[202608], ytd(mo2, 8)), `${soDisp[202608]?.toFixed(3)} × ${ytd(mo2, 8).toFixed(3)}`);
ok('ago/26 continua da aba (o banco de ago não entra)', prox(soDisp[202607], ytd(mo2, 7)));

console.log('\n3 · com o balanço de massa: a Empurrada entra');
const comBal = run({ disp, bal });
const { acc } = ctx.FcaAuto.indexaDispTudo({ disp: { cols: [], rows: aba }, dispBanco: disp, balanco: bal }, ctx.FcaAuto.indexaDRE(frotaTab).acc, ctx.DispersaoKm, ctx.BalancoMassa);
const bm = Object.entries(acc).filter(([k]) => k.startsWith('PIR|EMPURRADA|')).reduce((s, [, x]) => s + (x.bmKm || 0), 0);
ok('o balanço de massa recompõe km da Empurrada', bm > 0, `+${Math.round(bm)} km no ano`);
let rem = 0, real = 0;
Object.entries(acc).forEach(([k, x]) => { const [, p, v] = k.split('|'); if (['ROTA', 'AUTO SERVICO', 'EMPURRADA'].includes(p) && v <= '2026-09') { rem += x.rem; real += x.real; } });
ok('set/26 YTD = ROTA + AS + Empurrada com o balanço (Van fora)', prox(comBal[202608], (real - rem) / rem * 100), `${comBal[202608]?.toFixed(3)} × ${((real - rem) / rem * 100).toFixed(3)}`);
const brutoEmp = [...Array(9)].map((_, m) => [m, 55000, 66200 + (m === 8 ? 800 : 0)]);
ok('com a Empurrada a dispersão muda contra a de só ROTA + AS', !prox(comBal[202608], soDisp[202608]));
ok('o balanço baixa a dispersão contra a Empurrada bruta', comBal[202608] < ytd(brutoEmp, 8), `${comBal[202608]?.toFixed(2)} < ${ytd(brutoEmp, 8).toFixed(2)}`);
ok('sem nota de fonte quando o banco respondeu', ctx.DISP_FONTE === '', ctx.DISP_FONTE);

console.log('\n4 · sem o motor');
const F = ctx.FcaAuto; ctx.FcaAuto = undefined;
const semMotor = run({ disp, bal });
ctx.FcaAuto = F;
ok('cai na conta antiga da aba', prox(semMotor[202607], abaVelha[202607]) && /sem o motor/.test(ctx.DISP_FONTE));

console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

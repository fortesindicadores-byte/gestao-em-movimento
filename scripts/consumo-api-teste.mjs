// assets/consumo-api.js: o realizado das APIs no layout da aba Km/L, rodando a
// própria conta (ConsumoApi.calcula) em node:vm com dados conhecidos.
// Uso: node scripts/consumo-api-teste.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let ok = 0, falha = 0;
const t = (n, c, x = '') => { c ? ok++ : falha++; console.log(`${c ? 'ok ' : 'FALHA'} ${n}${x ? ' — ' + x : ''}`); };
const ctx = { window: {}, location: { search: '?fonte=api' }, document: { documentElement: { classList: { add() {} } }, createElement: () => ({}), head: { appendChild() {} } }, localStorage: { getItem: () => null }, console };
vm.createContext(ctx); vm.runInContext(readFileSync(new URL('../assets/consumo-api.js', import.meta.url), 'utf8'), ctx);
const CA = ctx.window.ConsumoApi;
t('ativo com ?fonte=api', CA.ativo === true);
// aba: 26 colunas (A…Z)
const lin = (vig, proj, placa, rem, rslRem, remM) => { const r = Array(26).fill(null); r[0] = vig; r[4] = rem; r[5] = remM; r[8] = rslRem; r[14] = proj; r[15] = 'PIRAI'; r[16] = placa; r[19] = 'ACTROS 2651'; r[20] = 'DIESEL S10'; r[22] = 99999; r[23] = 1; r[25] = 1; return r; };
const src = { cols: Array(26).fill('x'), rows: [
  lin('Date(2026,8,1)', 'EMPURRADA - PIR', 'ABC1234', 2.0, 6.0, 2.1),   // set (placa antiga na aba)
  lin('Date(2026,9,1)', 'EMPURRADA - PIR', 'ABC1C34', 2.2, 6.2, 2.3),   // out (Mercosul)
  lin('Date(2026,9,1)', 'EMPURRADA - PIR', 'XYZ9A99', 2.4, 6.4, 2.5),   // outra placa do projeto em out
  lin('Date(2026,9,1)', 'ROTA - PIR', 'ROT0A00', 3.0, 6.3, 3.1),
] };
// APIs: ABC1234 abastece em set (2) e out (2); a 1ª de set não tem anterior; DEF (sem aba) fora
const ap = [
  { sistema: 'PROFROTAS', id_origem: '1', item: 1, dia: '2026-09-02', unidade: 'PIR', placa: 'ABC-1234', produto: 'DIESEL S10', litros: 200, valor: 1200, hodometro: 10000 },
  { sistema: 'PROFROTAS', id_origem: '2', item: 1, dia: '2026-09-20', unidade: 'PIR', placa: 'ABC1234', produto: 'DIESEL S10', litros: 200, valor: 1300, hodometro: 10400 },
  { sistema: 'PROFROTAS', id_origem: '2', item: 2, dia: '2026-09-20', unidade: 'PIR', placa: 'ABC1234', produto: 'ARLA 32', litros: 20, valor: 70, hodometro: 10400 },
  { sistema: 'GASOLA', id_origem: 'g1', item: 1, dia: '2026-10-05', unidade: 'PIR', placa: 'ABC1C34', produto: 'DIESEL S10', litros: 100, valor: 700, hodometro: 10650 },
  { sistema: 'GASOLA', id_origem: 'g2', item: 1, dia: '2026-10-20', unidade: 'PIR', placa: 'ABC1C34', produto: 'DIESEL S10', litros: 100, valor: 7e9, hodometro: 10900 },   // preço absurdo
  { sistema: 'GASOLA', id_origem: 'g3', item: 1, dia: '2026-10-25', unidade: 'PIR', placa: 'ABC1C34', produto: 'DIESEL S10', litros: 100, valor: 700, hodometro: 19000 },   // salto > 3.000
  { sistema: 'GASOLA', id_origem: 'd1', item: 1, dia: '2026-10-06', unidade: 'PIR', placa: 'DEF1A11', produto: 'DIESEL S10', litros: 100, valor: 700, hodometro: 1 },
  { sistema: 'GASOLA', id_origem: 'd2', item: 1, dia: '2026-10-07', unidade: 'PIR', placa: 'DEF1A11', produto: 'DIESEL S10', litros: 100, valor: 700, hodometro: 300 },
  // placa da aba só em out, abastecendo em nov (sem linha da aba em nov)
  { sistema: 'SUMA', id_origem: 's1', item: 1, dia: '2026-10-02', unidade: 'PIR', placa: 'XYZ9A99', produto: 'DIESEL S10', litros: 100, valor: 650, hodometro: 5000 },
  { sistema: 'SUMA', id_origem: 's2', item: 1, dia: '2026-11-03', unidade: 'PIR', placa: 'XYZ9A99', produto: 'DIESEL S10', litros: 100, valor: 660, hodometro: 5240 },
];
const K = CA.calcula(ap, src, 'kml');
const ach = (vig, placa) => K.rows.find(r => CA.ymDe(r[0]) === vig && CA.placaKey(r[16]) === placa);
const set = ach('2026-09', 'ABC1C34'), out = ach('2026-10', 'ABC1C34'), nov = ach('2026-11', 'XYZ9A99');
t('set: o 1º abastecimento da placa fica fora; 400 km com 200 L', set && set[22] === 400 && set[23] === 200 && set[6] === 2, set && `${set[22]} km · ${set[23]} L · ${set[6]}`);
t('set: remunerado e projeto da linha da aba', set && set[4] === 2.0 && set[14] === 'EMPURRADA - PIR' && set[7] === 0);
t('out: km dos dois com hodômetro válido (250 + 250), o salto de 8.100 km fica fora do km/L', out && out[22] === 500 && out[23] === 200 && out[6] === 2.5, out && `${out[22]} · ${out[23]} · ${out[6]}`);
t('Arla não entra', set && set[25] === 1300);
t('placa fora da aba (Seara etc.) fica fora e é contada', !K.rows.some(r => CA.placaKey(r[16]) === 'DEF1A11') && K.info.semProjeto === 1);
t('mês sem linha da aba: linha da placa + remunerado do projeto no mês', !nov ? false : nov[4] === null && nov[14] === 'EMPURRADA - PIR', nov && `${nov[4]}`);
t('linha da aba sem abastecimento nas APIs some (ROTA - PIR)', !K.rows.some(r => r[14] === 'ROTA - PIR'));
const P = CA.calcula(ap, src, 'preco');
const outP = P.rows.find(r => CA.ymDe(r[0]) === '2026-10' && CA.placaKey(r[16]) === 'ABC1C34');
t('preço: todos os litros de diesel (300), o absurdo pelo mediano (7,00)', outP && outP[23] === 300 && Math.abs(outP[9] - 7) < 1e-9 && P.info.corrigidos === 1, outP && `${outP[23]} L · ${outP[9]}`);
t('preço: R$/L rem da aba', outP && outP[8] === 6.2 && Math.abs(outP[10] - 0.8) < 1e-9);
t('até = último dia com abastecimento', K.info.ate === '2026-11-03');
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);

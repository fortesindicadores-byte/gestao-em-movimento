// FCA Automático × Dispersão do banco e balanço de massa (Renan, 15/10/2026: "Agora gere o
// FCA automático considerando a dispersão"). Roda o PRÓPRIO assets/fca-auto.js em node:vm,
// com os motores de verdade (dispersao-km.js, balanco-massa.js):
//   · ago/26 vem da aba; set/26 só existe no banco e entra no índice da dispersão;
//   · o banco NÃO passa por cima de mês que a aba tem;
//   · a Empurrada recebe o balanço de massa (km rem. = bruto + recomposto), a Rota não;
//   · a causa do Combustíveis diz "com balanço de massa" e usa o km recomposto.
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['dispersao-km.js', 'balanco-massa.js', 'fca-auto.js'])
  vm.runInContext(fs.readFileSync(new URL('../assets/' + f, import.meta.url), 'utf8'), ctx);
const FA = ctx.FcaAuto, DK = ctx.DispersaoKm, BM = ctx.BalancoMassa;
let ok = 0, falha = 0;
const af = (n, c, d) => { if (c) { ok++; console.log('   ✓ ' + n); } else { falha++; console.log('   ✗ ' + n + (d ? '  (' + d + ')' : '')); } };

// aba Dispersão de km: ago/26 (col 0 vigência, 14 projeto, 31 km rem, 32 km real)
const col = () => Array.from({ length: 40 }, () => '');
const cols = col(); cols[0] = 'Vigência'; cols[14] = 'PROJ. - COD'; cols[31] = 'Km Rem. TT'; cols[32] = 'Km Rodado TT';
const linhaAba = (vig, proj, rem, real) => { const r = Array(40).fill(null); r[0] = vig; r[14] = proj; r[31] = rem; r[32] = real; return r; };
const disp = { cols, rows: [
  linhaAba('Date(2026,7,1)', 'EMPURRADA - PIR', 300000, 400000),
  linhaAba('Date(2026,7,1)', 'ROTA - GRL', 60000, 62000),
] };
// banco: ago (não pode passar por cima da aba) e set
const BL = (vigencia, unidade, projeto, km_rem, km_real, extra) => Object.assign({ vigencia, unidade, projeto, km_rem, km_real, frota_ativa: 10, viagens_prim: 100, viagens_rec: 5, viagens_not: 3, viagens_mapa_aberto: 2 }, extra || {});
const dispBanco = { linhas: [
  BL('2026-08', 'GRL', 'Rota', 999999, 999999),
  BL('2026-09', 'GRL', 'Rota', 57838, 62416),
  BL('2026-09', 'PIR', 'Empurrada - 28 Palets', 330000, 430000),
  BL('2026-09', 'PIR', 'Empurrada - Insumos', 30000, 20000),
  BL('2026-09', 'GNA', 'Auto Serviço', 9374, 11819),
], placas: [], kml: [] };
// DRE (aba Frota): remunerado das contas da Empurrada PIR (negativo, como a aba)
const H = ['Vigência', 'Unidade', 'Nível 3', 'Conta Gerencial', 'Remunerado', 'Realizado'];
const dreRow = (vig, n3, conta, rem, real) => [vig, 'Piraí', n3, conta, -rem, -real];
const dre = { header: H, rows: [
  dreRow('Date(2026,7,1)', 'EMPURRADA - PIR', 'Combustíveis Veículos e Equipamentos', 1500000, 1600000),
  dreRow('Date(2026,8,1)', 'EMPURRADA - PIR', 'Combustíveis Veículos e Equipamentos', 1500000, 1700000),
  dreRow('Date(2026,8,1)', 'ROTA - GRL', 'Combustíveis Veículos e Equipamentos', 200000, 210000),
] };
dre.rows[2][1] = 'Guarulhos';
// balanço de massa no banco: Combustíveis da Empurrada PIR em ago e set
const balanco = [
  { unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-08', conta: 'Combustíveis Veículos e Equipamentos', valor: 200000 },
  { unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-09', conta: 'Combustíveis Veículos e Equipamentos', valor: 300000 },
];
const L = { dre, disp, dispBanco, balanco };
const idx = FA.indexaDRE(dre);
const { acc, info } = FA.indexaDispTudo(L, idx.acc, DK, BM);

console.log('\n══ 1 · set/26 do banco entra; ago/26 continua da aba');
af('GRL Rota ago/26 é o da aba (o banco de ago não passa por cima)', acc['GRL|ROTA|2026-08'] && acc['GRL|ROTA|2026-08'].rem === 60000, JSON.stringify(acc['GRL|ROTA|2026-08']));
af('GRL Rota set/26 vem do banco', acc['GRL|ROTA|2026-09'] && acc['GRL|ROTA|2026-09'].rem === 57838 && acc['GRL|ROTA|2026-09'].real === 62416 && acc['GRL|ROTA|2026-09'].fonte === 'banco', JSON.stringify(acc['GRL|ROTA|2026-09']));
af('viagens do banco: total = 1ª + recs + noturnas + mapa aberto', acc['GRL|ROTA|2026-09'].vgTot === 110 && acc['GRL|ROTA|2026-09'].vgRec === 5);
af('Goiânia entra como GNA · Auto Serviço', acc['GNA|AUTO SERVICO|2026-09'] && acc['GNA|AUTO SERVICO|2026-09'].rem === 9374, Object.keys(acc).join(' '));
af('info.banco lista só set/26', JSON.stringify(info.banco) === '["2026-09"]', JSON.stringify(info.banco));

console.log('\n══ 2 · balanço de massa só na Empurrada');
const pir9 = acc['PIR|EMPURRADA|2026-09'], pir8 = acc['PIR|EMPURRADA|2026-08'];
af('Empurrada PIR set/26 junta 28 Palets + Insumos no bruto', pir9 && pir9.rem0 === 360000, JSON.stringify(pir9));
af('Empurrada PIR set/26 recebe km recomposto', pir9 && pir9.bmKm > 0 && Math.abs(pir9.rem - (pir9.rem0 + pir9.bmKm)) < 1e-6, JSON.stringify(pir9));
af('Empurrada PIR ago/26 também (rateio anual)', pir8 && pir8.bmKm > 0, JSON.stringify(pir8));
af('o valor rateado no ano soma o que foi lançado', Math.abs((pir8.bmValor || 0) + (pir9.bmValor || 0) - 500000) < 1, ((pir8.bmValor || 0) + (pir9.bmValor || 0)).toFixed(2));
af('Rota não recebe balanço', !acc['GRL|ROTA|2026-09'].bmKm);
// a mesma conta do Painel KM: km do ano = Σ balanço ÷ (Σ rem líquido ÷ km0), por trimestre (ago+set no 3º)
const taxa = ((1500000 - 200000) + (1500000 - 300000)) / (300000 + 360000);
af('km do ano = valor ÷ R$/km líquido da conta', Math.abs((pir8.bmKm + pir9.bmKm) - 500000 / taxa) < 1, (pir8.bmKm + pir9.bmKm).toFixed(1) + ' × ' + (500000 / taxa).toFixed(1));

console.log('\n══ 3 · sem os motores ou sem as tabelas, nada quebra');
const so = FA.indexaDispTudo({ dre, disp }, idx.acc, DK, BM);
af('sem banco: só a aba', !so.acc['GRL|ROTA|2026-09'] && so.acc['GRL|ROTA|2026-08'].rem === 60000 && !so.acc['PIR|EMPURRADA|2026-08'].bmKm);
const semBM = FA.indexaDispTudo(L, idx.acc, DK, null);
af('sem o motor do balanço: Empurrada com km bruto', semBM.acc['PIR|EMPURRADA|2026-09'].rem === 360000 && !semBM.acc['PIR|EMPURRADA|2026-09'].bmKm);

console.log('\n══ 4 · aba Abertura de set/26: só o remunerado por placa; o realizado vem da aba Km/L');
const AB = { cols: ['UNIDADE', 'MÊS', 'PROJETO', 'Placa', 'Remunerado', 'Real'], rows: [
  ['Guarulhos-SP', 'Date(2026,8,1)', 'ROTA', 'ABC1234', 5000, null],
  ['Balneário-SC', 'Date(2026,8,1)', 'AUTO SERVIÇO', 'ELQ8654', 315.17, null],
  ['Piraí -RJ', 'Date(2026,7,1)', 'EMPURRADA', 'CUK9G80', 6594, 4632],
] };
const abPl = DK.placasAbertura(AB);
af('placasAbertura: só set/26 em diante, placa em Mercosul, unidade e projeto no padrão do banco',
  abPl.length === 2 && abPl.some(p => p.placa === 'ABC1C34' && p.unidade === 'GRL' && p.projeto === 'Rota' && p.km_rem === 5000)
  && abPl.some(p => p.unidade === 'BLC' && p.projeto === 'Auto Serviço'), JSON.stringify(abPl));
const L2 = Object.assign({}, L, { abertura: AB, dispBanco: Object.assign({}, dispBanco, { kml: [{ vigencia: '09/2026', projeto: 'ROTA - GRL', placa: 'ABC1234', km_rodado_horas_trabalhadas: 6200 }] }) });
const t2 = FA.indexaDispTudo(L2, idx.acc, DK, BM);
af('km rodado por placa e mês sai da aba Km/L', t2.info.kmPlaca && t2.info.kmPlaca['2026-09|ABC1C34'] === 6200, JSON.stringify(t2.info.kmPlaca));
af('o total por unidade × projeto não muda com a Abertura', t2.acc['GRL|ROTA|2026-09'].rem === 57838, JSON.stringify(t2.acc['GRL|ROTA|2026-09']));
const ia = FA.indexaAbertura(AB);
af('linha da Abertura sem Real fica marcada para receber o km da Km/L', (ia['GRL|2026-09'] || [])[0] && ia['GRL|2026-09'][0].semReal === true && !ia['PIR|2026-08'][0].semReal, JSON.stringify(ia));

console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

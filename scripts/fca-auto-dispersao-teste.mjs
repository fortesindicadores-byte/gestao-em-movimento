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

console.log('\n══ 5 · planilha de viagens: remunerado por placa de Rota, AS e Van (T1 fora)');
{
  const { createRequire } = await import('node:module');
  const XLSX = createRequire(import.meta.url)('../node_modules/xlsx');
  const H5 = ['Tipo', 'Vigência', 'Entrega ', 'Carga Atual', 'Frota ', 'VBZ', 'Projeto', 'Nome - Unidade', 'Data', 'Entrega', 'Frota', 'Placa'];
  const V = (tipo, vig, ent, carga, frota, proj, uni, placa) => [tipo, vig, ent, carga, frota, 5, proj, uni, 1092026, ent, frota, placa];
  const rows = [H5,
    ...Array(3).fill(V('TRUCK', 'ROTA_1_9_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'ABC1234')),
    V('TRUCK', 'ROTA_2_9_2026', 'Rota', 'Extra', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'ABC1234'),
    V('TRUCK', 'ROTA_2_9_2026', 'Rota', 'Recarga', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'ABC1234'),
    V('TOCO', 'ROTA_1_9_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'XYZ9A99'),
    V('TOCO', 'ROTA_1_9_2026', 'Rota', 'Noturna', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'XYZ9A99'),
    V('VAN', 'ROTA_1_9_2026', 'Rota', 'Roteriz', 'Fixo', 'ROTA - CBA', 'CDD CUIABA', 'VAN1A11'),
    V('TOCO', 'ROTA_1_9_2026', 'Rota', 'Extra', 'Spot', 'TERCEIROS - CBA', 'CDD CUIABA', 'SPO1T00'),
    V('TOCO', 'ROTA_1_9_2026', 'Rota', 'MKT', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'XYZ9A99'),
    V('TOCO', 'ROTA_1_9_2026', 'Rota', 'Recolha', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'XYZ9A99'),
    V('BI-TRUCK', 'AS_1_9_2026', 'AS', 'Roteriz', 'Padrao', 'ROTA - PLT', 'CDD PELOTAS', 'CUC9514'),
    V('TRUCK', 'AS_1_9_2026', 'AS', 'Roteriz', 'Padrao', 'AUTO SERVIÇO - GOI', 'CDD GOIANIA', 'PRX4934'),
    V('TRUCK', 'ROTA_1_7_2026', 'Rota', 'Roteriz', 'Padrao', 'ROTA - CBA', 'CDD CUIABA', 'ABC1234'),
  ];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Planilha1');
  const rv = DK.leViagens(XLSX, wb, 'viagens.xlsx');
  const acha = (u, p, pl) => rv.linhas.find(l => l.unidade === u && l.projeto === p && l.placa === pl);
  const abc = acha('CBA', 'Rota', 'ABC1C34');
  af('Extra e Roteriz = 1ª; Recarga à parte; placa em Mercosul', abc && abc.viagens_prim === 4 && abc.viagens_rec === 1 && abc.placa_origem === 'ABC1234', JSON.stringify(abc));
  af('Tipo VAN vira o projeto Van', !!acha('CBA', 'Van', 'VAN1A11'));
  af('Spot, MKT e Recolha fora da conta', rv.fora['Spot (freteiro)'] === 1 && rv.fora.MKT === 1 && rv.fora.Recolha === 1 && !rv.linhas.some(l => l.placa === 'SPO1T00'), JSON.stringify(rv.fora));
  af('Pelotas AS conta como Rota', !!acha('PLT', 'Rota', 'CUC9F14') && !rv.linhas.some(l => l.unidade === 'PLT' && l.projeto === 'Auto Serviço'));
  af('Goiânia (GOI) entra como GNA · Auto Serviço', !!acha('GNA', 'Auto Serviço', 'PRX4J34'));
  af('mês antes de ago/26 fica de fora', JSON.stringify(rv.antes) === '["2026-07"]', JSON.stringify(rv.antes));
  af('arquivo sem as colunas da planilha de viagens não é lido como viagens', DK.leViagens(XLSX, (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['01-BD'], [1]]), 'x'); return w; })(), 'x') === null);

  // 01-BD: CBA Rota 5 viagens de 1ª (500 km) + 1 recarga (60 km) + 1 noturna (40 km) = 600 km; Van 1 viagem 80 km
  const bd = [
    { vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', viagens_prim: 5, km_rem_prim: 500, viagens_rec: 1, km_rem_rec: 60, viagens_not: 1, km_rem_not: 40, km_rem: 600 },
    { vigencia: '2026-09', unidade: 'CBA', projeto: 'Van', viagens_prim: 1, km_rem_prim: 80, km_rem: 80 },
    { vigencia: '2026-09', unidade: 'PLT', projeto: 'Rota', viagens_prim: 0, km_rem_prim: 0, km_rem: 0 },
  ];
  const rp = DK.remPlacas(rv.linhas, bd);
  const km = (u, p, pl) => (rp.placas.find(x => x.unidade === u && x.projeto === p && x.placa === pl) || {}).km_rem;
  af('km rem da placa = viagens × km por viagem do tipo', km('CBA', 'Rota', 'ABC1C34') === 460 && km('CBA', 'Rota', 'XYZ9A99') === 140, km('CBA', 'Rota', 'ABC1C34') + ' · ' + km('CBA', 'Rota', 'XYZ9A99'));
  const cR = rp.conf.find(c => c.unidade === 'CBA' && c.projeto === 'Rota');
  af('a soma das placas bate com o km remunerado da 01-BD', cR && cR.km === 600 && cR.v1 === cR.v1BD, JSON.stringify(cR));
  af('unidade × projeto sem linha na 01-BD fica marcada', rp.conf.some(c => c.unidade === 'GNA' && c.semLinha));
  const rp2 = DK.remPlacas([{ vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', placa: 'AAA1A11', viagens_prim: 2, viagens_rec: 0, viagens_not: 0 },
    { vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', placa: 'BBB1B11', viagens_prim: 3, viagens_rec: 0, viagens_not: 0 }], bd);
  af('recarga/noturna da 01-BD sem viagem na planilha: o resto vai pelas viagens de 1ª', rp2.conf[0].km === 600 && rp2.conf[0].restoPela1a === 100, JSON.stringify(rp2.conf[0]));

  // realizado: ABC1C34 rodou 1.000 km na Km/L; tem 460 rem na Rota e 1.840 rem de Empurrada (T1) na lista do banco
  const det = [{ vigencia: '2026-09', unidade: 'CBA', projeto: 'Empurrada - 28 Palets', placa: 'ABC1C34', placa_origem: 'ABC1234', km: 1000 },
    { vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', placa: 'XYZ9A99', placa_origem: 'XYZ9A99', km: 300 },
    { vigencia: '2026-09', unidade: 'CBA', projeto: 'Rota', placa: 'NOV0A00', placa_origem: 'NOV0A00', km: 500 }];
  const lista = [{ vigencia: '2026-09', unidade: 'CBA', projeto: 'Empurrada - 28 Palets', placa: 'ABC1C34', km_rem: 1840 }];
  const rr = DK.realPlacas(rp.placas, det, lista);
  const pr = pl => rr.find(x => x.placa === pl && x.unidade === 'CBA');
  af('placa que roda T1: a Rota leva só a parte do remunerado dela (o resto é T1, fora)', pr('ABC1C34').km_real === 200, JSON.stringify(pr('ABC1C34')));
  af('placa só de Rota leva o km inteiro da Km/L', pr('XYZ9A99').km_real === 300);
  af('placa da Km/L na Rota sem viagem na planilha entra com remunerado 0', pr('NOV0A00') && pr('NOV0A00').km_rem === 0 && pr('NOV0A00').km_real === 500 && pr('NOV0A00').semViagem);
  af('nenhuma linha T1 no resultado', !rr.some(x => /^Empurrada/.test(x.projeto)));
  // placa que a Km/L põe na Empurrada, sem a parte T1 na lista do banco (set/26): fora da análise de T2
  const rrT1 = DK.realPlacas([{ vigencia: '2026-09', unidade: 'MCC', projeto: 'Rota', placa: 'JBL5H95', km_rem: 138 },
    { vigencia: '2026-09', unidade: 'MCC', projeto: 'Rota', placa: 'RYY3F71', km_rem: 1500 }],
    [{ vigencia: '2026-09', unidade: 'MCC', projeto: 'Rota', placa: 'JBL5H95', placa_origem: 'JBL5H95', km: 11254, projeto_kml: 'EMPURRADA - MCC' },
     { vigencia: '2026-09', unidade: 'MCC', projeto: 'Rota', placa: 'RYY3F71', placa_origem: 'RYY3F71', km: 2707, projeto_kml: 'ROTA - MCC' }], []);
  af('placa T1 pela Km/L (JBL5H95, 138 km rem. na Rota) fica fora da análise de T2', !rrT1.some(x => x.placa === 'JBL5H95') && rrT1.t1Fora.length === 1 && rrT1.find(x => x.placa === 'RYY3F71').km_real === 2707, JSON.stringify(rrT1));

  // FCA: T1 fora em todos os meses; Abertura só com Real; set/26 pela planilha de viagens (CBA Rota = CBA T2)
  const AB5 = { cols: ['UNIDADE', 'MÊS', 'PROJETO', 'Placa', 'Remunerado', 'Real'], rows: [
    ['Piraí -RJ', 'Date(2026,7,1)', 'EMPURRADA', 'CUK9G80', 6594, 4632],
    ['Cuiába - MT', 'Date(2026,7,1)', 'ROTA', 'ABC1234', 3000, 3300],
    ['Cuiába - MT', 'Date(2026,8,1)', 'ROTA', 'ABC1234', 999, null],
  ] };
  const ip = FA.indexaPlacas(AB5, rr);
  af('T1 fora das análises do FCA (Empurrada da Abertura não entra)', !ip['PIR|2026-08'], Object.keys(ip).join(' '));
  af('ago/26 continua da Abertura (com o Real)', (ip['CBA T2|2026-08'] || []).length === 1 && ip['CBA T2|2026-08'][0].real === 3300, JSON.stringify(ip['CBA T2|2026-08']));
  const s9 = ip['CBA T2|2026-09'] || [];
  af('set/26 pela planilha de viagens, sem a linha da Abertura sem Real', s9.length && s9.every(r => r.fonte === 'viagens') && s9.some(r => r.placa === 'ABC1C34' && r.rem === 460 && r.real === 200 && r.proj === 'ROTA'), JSON.stringify(s9));
  af('Van no projeto VAN', s9.some(r => r.proj === 'VAN'), JSON.stringify(s9.map(r => r.proj)));

  // AGO/26 (Renan, 15/10/2026: "Libera agosto todo T2 também"): sem 01-BD no banco, o total vem da aba
  const viagAgo = [{ vigencia: '2026-08', unidade: 'CBA', projeto: 'Rota', placa: 'ABC1C34', placa_origem: 'ABC1234', viagens_prim: 6, viagens_rec: 2, viagens_not: 0 },
    { vigencia: '2026-08', unidade: 'CBA', projeto: 'Rota', placa: 'XYZ9A99', placa_origem: 'XYZ9A99', viagens_prim: 2, viagens_rec: 0, viagens_not: 0 }];
  const tot = DK.totaisT2([{ vigencia: '2026-08', unidade: 'CBA T2', projeto: 'ROTA', km_rem: 800, viagens: 10 },
    { vigencia: '2026-08', unidade: 'CBA', projeto: 'EMPURRADA', km_rem: 9000 }, { vigencia: '2026-08', unidade: 'GOI', projeto: 'AUTO SERVIÇO', km_rem: 100 }]);
  af('totaisT2: Rota da aba vira linha sem tipo, Empurrada fora, GOI vira GNA', tot.length === 2 && tot.some(l => l.unidade === 'CBA' && l.projeto === 'Rota' && l.km_rem === 800 && l.semTipo) && tot.some(l => l.unidade === 'GNA'), JSON.stringify(tot));
  const ra = DK.remPlacas(viagAgo, tot), kmA = pl => ra.placas.find(x => x.placa === pl).km_rem;
  af('ago/26: toda viagem vale o mesmo km (800 ÷ 10) e a soma bate com a aba', kmA('ABC1C34') === 640 && kmA('XYZ9A99') === 160 && ra.conf.find(c => c.projeto === 'Rota').km === 800, JSON.stringify(ra.conf));
  const AB8 = { cols: ['UNIDADE', 'MÊS', 'PROJETO', 'Placa', 'Remunerado', 'Real'], rows: [
    ['Cuiába - MT', 'Date(2026,7,1)', 'ROTA', 'ABC1234', 79, 2161], ['Piraí -RJ', 'Date(2026,7,1)', 'EMPURRADA', 'CUK9G80', 6594, 4632]] };
  const ip8 = FA.indexaPlacas(AB8, DK.realPlacas(ra.placas, [], []));
  const a8 = ip8['CBA T2|2026-08'] || [];
  af('ago/26 com planilha de viagens: a linha da Abertura (79 km rem.) sai e entram as viagens', a8.length === 2 && a8.every(r => r.fonte === 'viagens') && a8.find(r => r.placa === 'ABC1C34').rem === 640, JSON.stringify(a8));
  const ip8b = FA.indexaPlacas(AB8, []);
  // pelo caminho do motor: ago/26 da aba (GRL Rota 60.000) e o banco de ago/26 (999.999) não entra
  const L8 = Object.assign({}, L, { dispBanco: Object.assign({}, dispBanco, { viagens: [
    { vigencia: '2026-08', unidade: 'GRL', projeto: 'Rota', placa: 'GRL1A11', placa_origem: 'GRL1A11', viagens_prim: 3, viagens_rec: 0, viagens_not: 0 },
    { vigencia: '2026-08', unidade: 'GRL', projeto: 'Rota', placa: 'GRL2B22', placa_origem: 'GRL2B22', viagens_prim: 1, viagens_rec: 0, viagens_not: 0 }] }) });
  const pv8 = FA.indexaDispTudo(L8, idx.acc, DK, BM).info.placasViagem.filter(p => p.vigencia === '2026-08');
  af('motor: ago/26 reparte o total da aba (60.000) pelas viagens, não o do banco', pv8.length === 2 && Math.round(pv8.reduce((s2, p) => s2 + p.km_rem, 0)) === 60000 && pv8.find(p => p.placa === 'GRL1A11').km_rem === 45000, JSON.stringify(pv8));
  af('ago/26 sem a planilha de viagens: continua a Abertura', (ip8b['CBA T2|2026-08'] || []).length === 1 && ip8b['CBA T2|2026-08'][0].rem === 79);
}

console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);

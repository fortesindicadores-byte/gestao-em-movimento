// ============================================================
// Manual Freightech de frota (versão 26/10/2026): cada custo com a fórmula
// escrita como fórmula (a mesma que o FT exporta no modo `formulas`), um
// exemplo real (Cuiabá, 1ª quinzena de set/26, placa UDT2F07), a origem dos
// campos e, no rodapé, como o custo é composto.
//   MAN=manual.json MAN2=manual2.json MAN3=manual3.json OPO=opo.json FT_HTML=manual.html node deck-manual.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, fx, formula, livro, cartoes, tabela, origem, ponte, matriz, bars, f0, f1, f2, f3, mil, rs, rs2, rk, pct, NOME, MES, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const M = JSON.parse(readFileSync(process.env.MAN || 'manual.json', 'utf8'));
const M2 = JSON.parse(readFileSync(process.env.MAN2 || 'manual2.json', 'utf8'));
const M3 = JSON.parse(readFileSync(process.env.MAN3 || 'manual3.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, capaSec, didat, conc, write } = deck({ rodape: 'Manual Freightech · Frota · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Manual Freightech de Frota' });
const P = M.placa, R = M.resumo, T = M.trecho, C = M.conf, CV = M.cavalo, CR = M.carreta, E = M.empilhadeira || {}, PR = M3.param, FE = M.finame_ex, SR = M3.srtrans, FA = M3.fat, RC = M3.recarga, LU = M3.lucro, EX = O.ex;
const VIG = M.vig, UNI = 'Cuiabá';
const head = (k, h, sub = '') => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const ex = (k, h, corpo, rod) => slide(`${head(k, h)}${corpo}${rod ? didat(rod) : ''}`);
const n2 = v => f2(v), n0 = v => f0(v);
const placaTxt = `${P.Placa} · ${P['Modelo do Cavalo']} · ${UNI} · ${VIG}`;

// ═══ capa ═══
capa(`Manual · ${VIG}`, 'Freightech de frota: cada custo, a fórmula e de onde ela sai',
  `Um slide por custo. A fórmula é a que o Freightech exporta no modo fórmulas (1ª quinzena de out/26), conferida placa a placa nos dados. O exemplo é um caminhão real de ${UNI} (${P.Placa}) e um trecho real de Piraí.`);

// ═══ mapa ═══
slide(`${head('Mapa', 'Três modelos de remuneração de frota')}
  ${cartoes([
    { k: 'T2 · Rota, AS e Van', n: 'Fixo + variável', p: '<b>Fixo</b> por caminhão cadastrado (ativo ou parado): FINAME, seguro, IPVA, rastreador, faixa, lavagem. <b>Variável</b> por km: combustível, manutenção, carroceria, pneu (+ lavagem por km no AS).', o: 'Relatórios: Caminhão · Caminhão AS · Van · Resumo · Faturamento' },
    { k: 'T1 · Empurrada e Insumos', n: 'Frete por viagem', p: '<b>Frete</b> de cada trecho (origem → destino): diesel, manutenção do cavalo e da carreta, pneu, lavagem, pedágio e seguro. Salário e lucro variável entram no frete, mas não são custo de frota. <b>Fixo</b> por equipamento (cavalo + carreta).', o: 'Relatórios: Trecho · Cavalo · Carreta · Faturamento' },
    { k: 'Armazém', n: 'Fixo + hora', p: '<b>Fixo</b> por empilhadeira (financiamento + lucro fixo) e <b>variável</b> por hora de horímetro (manutenção + pneus).', o: 'Relatórios: Equipamento Armazém · Fechamento' },
  ])}
  <div class="filete"></div>
  <p style="font-size:13px">A remuneração do T2 tem ainda equipe de entrega, QLP, outras despesas e o lucro por hectolitro, pagos no mesmo Resumo. Eles não são custo de frota e aparecem uma vez neste manual, no slide do pacote por caminhão.</p>`,
);

// ═══ do caminhão à unidade ═══
{
  const at = R['Total Caminhão Ativo'], pa = R['Total Caminhão Parado'], fa = R['Total por Caminhão Frota Ativa'] * at, fp = R['Total por Caminhão Frota Parada'] * pa, vv = R['Total Viagens'];
  slide(`${head('T2 · Resumo', `Do caminhão à unidade: o Resumo soma três contas`, `${UNI}, ${VIG} · ${f0(at)} caminhões ativos e ${f0(pa)} parados`)}
  ${fx(['Fixo das ativas', { op: '=' }, `fixo médio por ativo ${rs2(R['Total por Caminhão Frota Ativa'])}`, { op: '×' }, `${f0(at)} ativos`, { eq: rs(fa) }], { lab: 'Conta 1' })}
  ${fx(['Fixo das paradas', { op: '=' }, `fixo médio por parado ${rs2(R['Total por Caminhão Frota Parada'])}`, { op: '×' }, `${f0(pa)} parados`, { eq: rs(fp) }], { lab: 'Conta 2' })}
  ${fx(['Variável (teto)', { op: '=' }, `R$/km ${f2(R['Total R$/KM'])}`, { op: '×' }, `${f0(R['KM Remunerado'])} km por caminhão`, { op: '×' }, `${f0(at)} ativos`, { eq: rs(vv) }], { lab: 'Conta 3' })}
  ${origem('Resumo (ROTA)', [
    { c: 'Fixo por caminhão ativo', tec: 'Total por Caminhão Frota Ativa', o: 'seguro + rastreador + faixa + IPVA + FINAME + depreciação + remuneração K, média das placas ativas', v: rs2(R['Total por Caminhão Frota Ativa']) },
    { c: 'Fixo por caminhão parado', tec: 'Total por Caminhão Frota Parada', o: 'as mesmas parcelas, média das placas inativas, mais o lucro fixo do parado', v: rs2(R['Total por Caminhão Frota Parada']) },
    { c: 'R$/km da unidade', tec: 'Total R$/KM', o: 'combustível + manutenção + carroceria + pneu, média das placas ativas ponderada pelo km', v: rk(R['Total R$/KM']) },
    { c: 'Km por caminhão', tec: 'KM Remunerado', o: 'km mensal da 1ª viagem, parâmetro da unidade (igual para todas as placas)', v: f0(R['KM Remunerado']) + ' km' },
    { c: 'Variável no teto', tec: 'Total Viagens', o: 'R$/km × km × ativos: o dimensionamento, se todos os ativos rodarem os 25 mapas', v: rs(vv) },
  ])}
  ${didat(`A unidade recebe o fixo de todo caminhão cadastrado, ativo ou parado, e o variável pelos mapas que os ativos rodam. O variável do Resumo é o teto (25 mapas por ativo): o que entra de verdade é o R$/km × km dos mapas rodados. Equipe, QLP e outras despesas são pagas à parte, no mesmo Resumo.`)}`);
}

// ═══ Parte 1 · fixo ═══
capaSec(1, 'T2 · Custo fixo', 'O que o caminhão recebe por existir: FINAME, seguro, IPVA, rastreador, faixa refletiva e lavagem. Ativo ou parado.');

ex('T2 · Fixo · FINAME', 'FINAME do caminhão financiado: uma parcela PRICE sobre o valor financiado',
  `<p class="sub">${placaTxt} · status FINANCIADO</p>
  ${formula([`FINAME`, { op: '=' }, `PMT(`, 'taxa mensal', '; ', 'parcelas', '; ', '(compra cavalo + carroceria) × (1 − entrada)', ')'],
    [`PMT(${f3(FE.r)}% ao mês; ${f0(FE.n)} parcelas; ${rs(FE.V)} × (1 − ${f0(P['Entrada (%)'])}%) = ${rs(FE.pv)})`, { eq: rs2(P['FINAME Modelo Novo']) + ' por mês' }])}
  ${fx(['taxa ao ano', { op: '=' }, '(1 + TJLP) × (1 + spread BNDES) × (1 + spread banco) − 1', { op: '=' }, `(1 + ${f2(M3.finame.tjlp)}%) × (1 + ${f2(M3.finame.spread_bndes)}%) × (1 + ${f2(M3.finame.spread_banco)}%) − 1`, { eq: f2(M3.finame.taxa_calc) + '% ao ano' }], { ex: true, lab: 'Taxa ao ano' })}
  ${fx(['taxa mensal', { op: '=' }, `(1 + ${f2(P['Taxa FINAME'])}%)`, '<sup>1/12</sup>', '− 1', { eq: f3(FE.r) + '% ao mês' }], { ex: true, lab: 'Taxa mensal' })}
  ${cartoes([
    { k: 'FINANCIADO', n: 'PMT', p: 'Parcela constante (PRICE) sobre o valor com a entrada abatida. Se há carência, o saldo é capitalizado na carência.' },
    { k: 'FINAME (BNDES) e SAC', n: 'Amortização + juros', p: 'Amortização = valor ÷ parcelas × (1 − entrada); juros pela tabela de aquisição do FINAME. A parcela cai todo mês.' },
    { k: 'LEASING', n: 'Aluguel', p: 'O FT paga o custo do leasing no lugar da parcela. Sem IPVA.' },
    { k: 'QUITADO e ALUGADO', n: 'R$ 0', p: 'Sem parcela. O quitado recebe depreciação, remuneração K e lucro fixo pelo modelo antigo; o alugado, nada de capital.' },
  ])}
  ${origem('Caminhão (ROTA)', [
    { c: 'Valor de compra do cavalo e da carroceria', tec: 'Valor de Compra Cavalo · Carroceria', o: 'nota de compra', v: rs(P['Valor de Compra Cavalo']) + ' + ' + rs(P['Valor de Compra Carroceria']) },
    { c: 'Entrada', tec: 'Entrada (%)', o: 'parte paga à vista', v: f0(P['Entrada (%)']) + '%' },
    { c: 'Prazo e carência', tec: 'Período FINAME · Carência', o: 'parcelas; a parcela atual está em ' + f0(P['Mês da Parcela']), v: f0(P['Período FINAME']) + ' · ' + f0(P['Carência']) },
    { c: 'Status do financiamento', tec: 'statusFinanciamentoShared', o: 'decide a regra', v: P.statusFinanciamentoShared },
  ])}`,
  `O FINAME é a parcela do financiamento do caminhão, calculada pelo FT com a taxa, o prazo e o valor de compra cadastrados. Conferido: ${C.finame_FINANCIADO < 0.5 ? 'fecha ao centavo nas placas FINANCIADO' : 'erro mediano de ' + f1(C.finame_FINANCIADO) + '% nas placas FINANCIADO'}. Sobe com o preço do caminhão e com a taxa; cai a zero quando a última parcela é paga.`);

ex('T2 · Fixo · Seguro', 'Seguro: 0,75% ao ano do valor de compra, dividido por 12',
  `<p class="sub">${placaTxt}</p>
  ${formula(['Seguro', { op: '=' }, 'seguro fixo da unidade ÷ 12', { op: '+' }, { fr: ['(compra cavalo + carroceria) × risco', '12'] }],
    [`${rs2(PR.seguro_fixo)} ÷ 12`, { op: '+' }, { fr: [`${rs(P['Valor de Compra Cavalo'] + P['Valor de Compra Carroceria'])} × ${f2(PR.risco)}%`, '12'] }, { eq: rs2(P.Seguro) + ' por mês' }])}
  ${origem('Caminhão e Parâmetros Gerais (ROTA)', [
    { c: 'Risco', tec: 'Parâmetros Gerais · Risco', o: 'taxa anual sobre o valor do caminhão', v: f2(PR.risco) + '%' },
    { c: 'Seguro fixo da unidade', tec: 'Parâmetros Gerais · Seguro', o: 'parcela fixa anual (zero em ' + UNI + ')', v: rs2(PR.seguro_fixo) },
    { c: 'Seguro por caminhão', tec: 'Seguro', o: 'valor mensal pago', v: rs2(P.Seguro) },
    { c: 'Seguro do parado', tec: 'Resumo · Seguro Parado', o: 'média das placas inativas', v: rs2(R['Seguro Parado']) },
  ])}`,
  `O seguro é um percentual fixo (${f2(PR.risco)}% ao ano) sobre o valor de compra do cavalo e da carroceria. Conferido: ${C.seguro < 0.5 ? 'fecha ao centavo em todas as placas' : 'erro mediano de ' + f1(C.seguro) + '%'}. Só muda quando o caminhão muda. O parado recebe igual.`);

ex('T2 · Fixo · IPVA', 'IPVA e licenciamento: o valor anual do cavalo dividido por 12',
  `<p class="sub">${placaTxt}</p>
  ${formula(['IPVA por mês', { op: '=' }, { fr: ['IPVA + licenciamento do ano', '12'] }], [{ fr: [rs2(P['IPVA Licenciamento Cavalo']), '12'] }, { eq: rs2(P['IPVA Licenciamento']) + ' por mês' }])}
  ${cartoes([
    { k: 'Financiado, FINAME, quitado', n: 'anual ÷ 12', p: 'O IPVA cadastrado da placa, dividido por 12.' },
    { k: 'Leasing e alugado', n: 'R$ 0', p: 'O IPVA está dentro do aluguel; o FT não paga de novo.' },
    { k: 'Parado', n: rs2(R['IPVA Licenc. Mensal Parado']), p: 'Média das placas inativas de ' + UNI + '. O parado recebe.' },
  ])}
  ${origem('Caminhão (ROTA)', [
    { c: 'IPVA e licenciamento anual', tec: 'IPVA Licenciamento Cavalo', o: 'alíquota do estado × valor venal + licenciamento', v: rs2(P['IPVA Licenciamento Cavalo']) },
    { c: 'IPVA por mês', tec: 'IPVA Licenciamento', o: 'o que entra no fixo', v: rs2(P['IPVA Licenciamento']) },
  ])}`,
  `O FT devolve o IPVA cadastrado da placa em 12 parcelas iguais. Conferido: ${C.ipva < 0.5 ? 'fecha ao centavo' : 'erro mediano de ' + f1(C.ipva) + '%'}. Caminhão em leasing ou alugado não recebe, porque o imposto já está no aluguel.`);

{
  const RU = M3.rastreador_uni, com = Object.entries(RU).filter(([, v]) => v > 0), sem = Object.entries(RU).filter(([, v]) => !v);
  ex('T2 · Fixo · Rastreador, faixa e lavagem', 'Rastreador, faixa refletiva e lavagem: valores fixos por mês, por unidade',
    `<p class="sub">${placaTxt} · capacidade ${P['Capacidade de Pallets']} pallets</p>
    ${fx(['Rastreador', { op: '=' }, 'parâmetro da unidade', { eq: rs2(P.Rastreador) }, `<small>· ${lista_(com.map(([u]) => NOME[u]))} pagam ${rs2(com[0][1])}; ${lista_(sem.map(([u]) => NOME[u]))} pagam zero</small>`], { lab: 'Rastreador' })}
    ${fx(['Faixa refletiva', { op: '=' }, { fr: ['custo da faixa × 2', '60 meses'] }, { eq: rs2(P['Faixa Reflexiva']) }, `<small>· ${rs2(PR.faixa)} × 2 ÷ 60</small>`], { lab: 'Faixa' })}
    ${fx(['Lavagem', { op: '=' }, 'tabela da unidade por capacidade', { eq: rs2(P.Lavagem) }, `<small>· ${UNI}: ${Object.entries(PR.lavagem).filter(([k]) => k !== 'van').map(([k, v]) => k + ' pallets ' + f0(v)).join(' · ')} · Van ${f0(PR.lavagem.van)}</small>`], { lab: 'Lavagem' })}
    ${origem('Caminhão e Parâmetros Gerais (ROTA)', [
      { c: 'Rastreador', tec: 'Parâmetros Gerais · Rastreador', o: 'mensalidade por caminhão, definida por unidade; o parado também recebe', v: rs2(P.Rastreador) },
      { c: 'Faixa refletiva', tec: 'Parâmetros Gerais · Faixa Reflexiva', o: 'custo de duas faixas diluído em 60 meses', v: rs2(PR.faixa) },
      { c: 'Lavagem', tec: 'Parâmetros Gerais · custoLavagem4p…28p', o: 'valor por mês pela capacidade; só o ativo recebe', v: rs2(P.Lavagem) },
      { c: 'Lavagem no AS', tec: 'Caminhão AS · Lavagem por KM', o: 'no AS a lavagem é por km, dentro do variável (custo × lavagens ÷ km)', v: M3.as ? rk(M3.as['Lavagem por KM']) : '—' },
    ])}`,
    `Três valores de tabela por unidade. O rastreador é pago só nas unidades do Rio de Janeiro (${lista_(com.map(([u]) => NOME[u]))}, ${rs2(com[0][1])} por caminhão, ativo ou parado); nas outras o parâmetro é zero, e o motivo é pergunta aberta ao planejamento. A faixa vale ${rs2(P['Faixa Reflexiva'])} em toda placa. A lavagem é fixa por mês na Rota e na Van e por km no AS.`);
}
function lista_(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

ex('T2 · Fixo · Total', 'Total do fixo do caminhão: a soma das parcelas',
  `<p class="sub">${placaTxt}</p>
  <div class="duas"><div>${livro([{ l: 'FINAME', v: rs2(P['FINAME Modelo Novo']) }, { l: 'Seguro', v: rs2(P.Seguro) }, { l: 'IPVA e licenciamento', v: rs2(P['IPVA Licenciamento']) }, { l: 'Rastreador', v: rs2(P.Rastreador) }, { l: 'Faixa refletiva', v: rs2(P['Faixa Reflexiva']) }, { l: 'Lavagem', v: rs2(P.Lavagem) }], { l: 'Fixo por mês', v: rs2(P['Total Custo Fixo']) })}</div>
  <div>${cartoes([{ k: 'Financiado', n: rs(11260), p: 'fixo mediano por mês da placa financiada (Rota, 2026). 88% é FINAME.' }, { k: 'Leasing', n: rs(5647), p: 'o aluguel entra no lugar da parcela; sem IPVA' }, { k: 'Quitado', n: rs(882), p: 'sem parcela: só seguro, IPVA e faixa' }], 3)}
  <p class="note" style="margin-top:10px">Mediana do fixo mensal por status nas placas ativas da Rota em 2026 (Análise 2026). Status das ativas em ${VIG}: ${Object.entries(M.status).map(([k, v]) => `${k} ${v}`).join(' · ')}.</p></div></div>
  ${origem('Caminhão (ROTA)', [
    { c: 'Total do fixo', tec: 'Total Custo Fixo', o: 'seguro + rastreador + faixa + IPVA + FINAME + depreciação + lucro fixo + lucro FINAME + lavagem', v: rs2(P['Total Custo Fixo']) },
    { c: 'Depreciação, remuneração K e lucro fixo', tec: 'Depreciação Cavalo · Remuneração K · Lucro Fixo', o: 'modelo antigo (caminhões quitados): substituem o FINAME', v: '—' },
  ])}`,
  `O fixo é a soma das parcelas: na placa financiada, 88% é a parcela do FINAME. Conferido: ${C.fixo < 0.5 ? 'a soma fecha ao centavo em todas as placas' : 'erro mediano de ' + f1(C.fixo) + '%'}. Por isso o fixo do caminhão quitado é dez vezes menor que o do financiado: quando a parcela acaba, o fixo quase some.`);

{
  const at = R['Total Caminhão Ativo'], pa = R['Total Caminhão Parado'];
  ex('T2 · Fixo · Parado', 'Caminhão parado recebe o fixo. Variável, só o mapa rodado paga.',
    `<p class="sub">${UNI}, ${VIG} · ${f0(at)} ativos e ${f0(pa)} parados</p>
    ${cartoes([
      { k: 'Por caminhão ativo', n: rs2(R['Total por Caminhão Frota Ativa']), p: 'FINAME + seguro + IPVA + rastreador + faixa (a lavagem vai em Outras Despesas). Média das ' + f0(at) + ' placas ativas.' },
      { k: 'Por caminhão parado', n: rs2(R['Total por Caminhão Frota Parada']), p: 'As mesmas parcelas, média das ' + f0(pa) + ' placas inativas, mais o lucro fixo do parado. Sem lavagem e sem variável.', acc: true },
      { k: 'Fixo das paradas no mês', n: rs(R['Total por Caminhão Frota Parada'] * pa), p: f0(pa) + ' parados × ' + rs2(R['Total por Caminhão Frota Parada']) + '. Em 2026 (jan–ago) o fixo de parado do T2 somou R$ 6,2 mi, 118 parados por mês.' },
    ])}
    ${origem('Resumo (ROTA)', [
      { c: 'Fixo do parado', tec: 'Total por Caminhão Frota Parada', o: 'seguro + rastreador + faixa + IPVA + FINAME + depreciação + remuneração K + lucro fixo + lucro FINAME, das placas com Ativo = FALSO', v: rs2(R['Total por Caminhão Frota Parada']) },
      { c: 'Quantos parados', tec: 'Total Caminhão Parado', o: 'placas cadastradas com Ativo = FALSO', v: f0(pa) },
      { c: 'Quem decide ativo ou parado', tec: 'Caminhão · Ativo', o: 'a unidade, na quinzena; o stress test exige ao menos uma viagem por mês por ativo', v: '' },
    ])}`,
    `Todo caminhão cadastrado recebe o fixo, ativo ou parado; só a lavagem é do ativo. O variável é só do ativo, e só dos mapas que rodaram. A média do parado pode ser maior que a do ativo quando as placas paradas são as mais novas (parcela de FINAME maior), como em ${UNI}.`);
}

// ═══ Parte 2 · variável ═══
capaSec(2, 'T2 · Custo variável', 'O que o caminhão recebe por km: combustível, manutenção, carroceria e pneu. Só nos mapas rodados.');

{
  const D = M.comb_unid['DIESEL S10'] || {}, AR = M.comb_unid.ARLA || {}, CC = M2.comb_casos;
  ex('T2 · Variável · Combustível', 'Combustível: (diesel + 5% do Arla) ÷ Km/L remunerado da placa',
    `<p class="sub">${placaTxt} · DIESEL S10</p>
    ${formula(['Combustível R$/km', { op: '=' }, { fr: ['preço do diesel S10 pago + 0,05 × preço do Arla', 'Km/L remunerado da placa'] }],
      [{ fr: [`${rs2(D.pago)} + 0,05 × ${rs2(AR.pago)}`, f2(P['Consumo KM/L'])] }, { eq: rk(P['Consumo R$/KM']) }])}
    ${fx(['preço pago', { op: '=' }, 'menor entre o nosso preço (NF) e a ANP', { eq: rs2(D.pago) }, `<small>· nosso ${rs2(D.op)} · ANP ${rs2(D.anp)} · revisto a cada quinzena</small>`], { ex: true, lab: 'Preço' })}
    ${cartoes([
      { k: 'DIESEL S10', n: f0(CC['DIESEL S10'].bate) + '%', p: `das ${f0(CC['DIESEL S10'].linhas)} linhas fecham com diesel + 5% do Arla. Só diesel: 0%.` },
      { k: 'S10 S/ ARLA', n: f0(CC['DIESEL S10 S/ ARLA'].bate) + '%', p: `fecham com o diesel sozinho (${f0(CC['DIESEL S10 S/ ARLA'].placas)} placas).` },
      { k: 'DIESEL comum', n: f0(CC['DIESEL'].bate) + '%', p: `preço do diesel comum ÷ Km/L (2022–24, ${f0(CC['DIESEL'].placas)} placas).` },
      { k: 'Elétrico', n: f0(M2.comb_tipos_2026.ELETRICO), p: 'linhas em 2026 (Rio): a energia é da Ambev e o R$/km de combustível é zero.' },
    ])}
    ${origem('Combustível Rota e Caminhão (ROTA)', [
      { c: 'Nosso preço e ANP', tec: 'precoOperadora · precoAnp', o: 'NF que subimos no FT e a ANP da região', v: rs2(D.op) + ' · ' + rs2(D.anp) },
      { c: 'Preço pago', tec: 'precoCreditoImpostos', o: 'o menor dos dois (100% dos registros desde 2022)', v: rs2(D.pago) },
      { c: 'Km/L remunerado', tec: 'Consumo KM/L', o: 'o consumo validado da placa (próximos slides)', v: f2(P['Consumo KM/L']) },
    ])}`,
    `O FT paga, por km, o preço do diesel mais 5% do preço do Arla, dividido pelo Km/L remunerado da placa. O preço é o menor entre o nosso e a ANP, revisto a cada quinzena; o Km/L é o consumo validado no trimestre anterior. Sobe quando o diesel sobe; cai quando o Km/L remunerado da placa sobe.`);
}

// Km/L (a) o que é e por que pesa
{
  const kmlUp = EX.kml + 0.1, litros = EX.km_mes / EX.kml, litros01 = EX.km_mes / kmlUp, preco = EX.comb * EX.kml;
  ex('T2 · Variável · Km/L · 1', 'Km/L remunerado: o número que mais pesa no variável',
    `<p class="sub">Caminhão mediano da Rota em 2026 · ${f0(EX.placas)} placas · ${f0(EX.km_mes)} km por mês</p>
    ${cartoes([
      { k: 'Peso no variável', n: f0(EX.comb / EX.var * 100) + '%', p: `combustível ${rk(EX.comb)} de ${rk(EX.var)}. Manutenção ${f0(EX.manut / EX.var * 100)}%, pneu ${f0(EX.pneu / EX.var * 100)}%, carroceria ${f0(EX.carr / EX.var * 100)}%.` },
      { k: 'Km/L remunerado mediano', n: f2(EX.kml) + ' km/L', p: `o FT prevê ${f0(litros)} litros por mês para ${f0(EX.km_mes)} km.` },
      { k: '0,1 km/L a mais no remunerado', n: '− R$ ' + f0((litros - litros01) * preco), p: `por caminhão por mês: ${f0(litros - litros01)} litros a menos pagos. Na frota (${f0(EX.placas)} placas), ${rs((litros - litros01) * preco * EX.placas)} por mês.`, acc: true },
      { k: 'É por placa', n: '1 valor', p: 'cada placa tem o seu Km/L remunerado, gravado no cadastro do FT (o export de fórmulas mostra o número fixo: <i>return 4.059</i>).' },
    ])}
    ${fx(['Combustível R$/km', { op: '=' }, { fr: ['preço do litro', 'Km/L remunerado'] }, '→ quanto maior o Km/L, menor o R$/km pago'], { lab: 'Por quê' })}`,
    `O combustível é dois terços do variável e o Km/L remunerado é o divisor dele: um décimo de km/L muda o pago de toda a frota em dezenas de milhares de reais por mês. Não há outro número do FT com esse peso. Os próximos slides mostram de onde ele vem, quando muda e o que aconteceu em 2026.`);
}
// Km/L (b) de onde vem
{
  const K = M2.kml, BM = M3.bench_cap;
  ex('T2 · Variável · Km/L · 2', 'De onde vem o Km/L da placa: o validado do trimestre, não o benchmark',
    `<p class="sub">${placaTxt} · benchmark ${f2(P['Benchmark Consumo'])} · Km/L da placa ${f2(P['Consumo KM/L'])}</p>
    <div class="duas"><div>
    ${cartoes([
      { k: 'Benchmark do modelo', n: f2(P['Benchmark Consumo']), p: `tabela por capacidade da unidade (${Object.entries(BM).filter(([k]) => k !== 'None').map(([k, v]) => k.replace('.0', '') + 'p ' + f2(v)).join(' · ')}). É a referência de partida.` },
      { k: 'Campos de ajuste', n: '±2,5 a 4,5%', p: `Perda por ano do veículo (${f1(P['Perda Ano Veículo'])}%) e fator da região (${f1(P['Fator Correção Região'])}%). Só entram na simulação de placa nova: benchmark × ajustes reproduz o Km/L da placa em ${f1(K.bench_x_ajustes)}% das linhas.` },
      { k: 'Consumo validado', n: 'o que vale', p: `A cada trimestre a Ambev valida o consumo real do trimestre anterior, com penalidades, e grava um número por placa. Km/L da placa ÷ benchmark: mediana ${f2(K.razao_bench.mediana)} (${f2(K.razao_bench.p10)} a ${f2(K.razao_bench.p90)}).` },
    ], 1)}</div>
    <div>${tabela({ cols: [{ t: 'Modelo' }, { t: 'Benchmark', n: true }, { t: 'Km/L mediano das placas', n: true }, { t: 'Placas', n: true }], rows: Object.entries(K.modelos).map(([m, x]) => [m, f2(x.benchmark), f2(x.kml_mediana), f0(x.placas)]) })}
    <p class="note">Rota, 2026. O mesmo modelo pode ter placas com Km/L remunerado diferente: o número é por placa, validado pelo histórico dela.</p></div></div>`,
    `O Km/L remunerado da placa não sai de uma fórmula: é o consumo validado do trimestre anterior, gravado placa a placa. O benchmark do modelo e os ajustes por idade e região servem para a placa nova, antes de ter histórico. Como a Ambev chega do real ao validado (média, corte de outliers, penalidades) é pergunta aberta ao especialista.`);
}
// Km/L (c) ciclo de revisão
{
  const cal = M2.kml.calendario, ks = Object.keys(cal).sort();
  const meses = [...new Set(ks.map(k => k.slice(0, 7)))];
  const rows = ['1', '2'].map(q => ({ rot: q + 'ª qz · % que mudaram', vals: meses.map(m => cal[`${m}-${q}`] ? cal[`${m}-${q}`].pct : null) }));
  const rows2 = [{ rot: '1ª qz · Δ mediano', vals: meses.map(m => cal[`${m}-1`] ? cal[`${m}-1`].delta_med : null) }, { rot: '1ª qz · placas', vals: meses.map(m => cal[`${m}-1`] ? cal[`${m}-1`].placas : null) }];
  const cor = v => v >= 50 ? 'rgba(242,44,5,.55)' : v >= 10 ? 'rgba(242,44,5,.22)' : v > 0 ? 'rgba(242,44,5,.07)' : '';
  ex('T2 · Variável · Km/L · 3', 'O Km/L muda na 1ª quinzena de cada trimestre; o resto do tempo fica parado',
    `<p class="sub">Placas ativas da Rota cujo Km/L remunerado mudou em relação à quinzena anterior (%), 2025 e 2026</p>
    ${matriz({ linhas: rows, cols: meses.map(m => MES[+m.slice(5) - 1] + '/' + m.slice(2, 4)), cor, fmt: v => f0(v) + '%', primeira: 'Km/L remunerado' })}
    <div style="margin-top:8px">${matriz({ linhas: rows2, cols: meses.map(m => MES[+m.slice(5) - 1] + '/' + m.slice(2, 4)), cor: v => '', fmt: v => Math.abs(v) < 200 && !Number.isInteger(v) ? pct(v, 1).replace('%', '') : f0(v), primeira: 'Na revisão' })}</div>
    ${cartoes([
      { k: 'Revisão do trimestre', n: '92 a 100%', p: 'das placas mudam na 1ª quinzena de jan, abr, jul e out. Fora dela, menos de 5% por quinzena.' },
      { k: 'Exceções', n: '3', p: 'abr/25 sem revisão (0% mudaram) · jul/25 entrou na 2ª quinzena · out/26 não houve (0 de ' + f0(cal['2026-10-1'].placas) + ').', acc: true },
      { k: 'Sentido das revisões', n: 'out/25 −7%', p: 'mediana por placa: out/25 −7,3% (184 desceram, 72 subiram) · jan/26 −0,3% · abr/26 +1,1% · jul/26 +3,3%.' },
    ])}`,
    `A revisão é trimestral: na 1ª quinzena de janeiro, abril, julho e outubro o FT grava o consumo validado do trimestre anterior em quase todas as placas. Entre revisões o Km/L fica congelado, mude o que mudar na operação. O 4º trimestre de 2026 roda com os valores do 3º porque a revisão de outubro não foi feita (troca do especialista da Ambev).`);
}
// Km/L (d) média da unidade e (e) 2026
{
  const K = O.kml;
  ex('T2 · Variável · Km/L · 4', 'A unidade é paga pela média simples das placas ativas, e 2026 trouxe quatro anomalias',
    `<p class="sub">Como o Km/L da placa vira o combustível da unidade, e o que o cadastro de 2026 mostra</p>
    ${fx(['Combustível R$/km da unidade', { op: '=' }, { fr: ['Σ (combustível R$/km da placa × km da placa)', 'Σ km das placas ativas'] }, '<small>· como todas as placas da unidade têm o mesmo km, é a média simples das ativas</small>'], { lab: 'Resumo' })}
    ${cartoes([
      { k: 'Mix de placas', n: 'ativas', p: 'Só a placa ativa entra na média. Ativar uma placa com Km/L baixo derruba a média e sobe o R$/km pago; inativar uma boa faz o contrário.' },
      { k: 'Q4 sem revisão', n: f0(K.q3q4_mudaram) + ' de ' + f0(K.q3q4_iguais), p: 'placas mudaram de jul para out/26. O 4º trimestre roda com a régua do 3º.', acc: true },
      { k: 'Mesmo modelo, Km/L diferente', n: f0(K.comDif) + ' de ' + f0(K.grupos), p: `grupos modelo × mês com valores diferentes na mesma operação; saldo contra nós de ${f0(K.disp_lit)} L (${rs(K.disp_rs)}).` },
      { k: 'Ativas com consumo zero', n: f0(K.zeradas), p: 'placas ativas com Km/L zero na 1ª abr/26, nas três Empurradas. Se o zero conta na média, a unidade despenca.' },
    ])}
    ${cartoes([
      { k: 'Mudanças fora da revisão', n: f0(K.fora), p: 'placas-operação mudaram de valor fora da 1ª quinzena do trimestre (Piraí 20, Cuiabá 13).' },
      { k: 'Onde acompanhar', n: 'Eficiência Km/L', p: 'Km/L real × remunerado por placa, com as piores, e o impacto em R$. A crítica do consumo validado se prepara ali, antes da revisão.' },
      { k: 'O que pedir na revisão', n: 'placa a placa', p: 'placas novas sem histórico, modelos iguais com valores diferentes, ativas zeradas, e o km legítimo validado na quinzena.' },
    ])}`,
    `O FT paga a unidade pela média das placas ativas, então quem está ativo e com qual Km/L decide o combustível pago. Em 2026 o cadastro deixou quatro rastros: trimestre sem revisão, mesmo modelo com valores diferentes, placas ativas zeradas e mudanças fora do calendário. Todos saem da planilha do FT e cabem na crítica da próxima revisão.`);
}

// manutenção (a) árvore
{
  const G = M3.manut_grupos, g = k => G[k] || { placas: 0, rk: null };
  ex('T2 · Variável · Manutenção · 1', 'Manutenção: carência, contrato, BID da montadora ou tabela por idade',
    `<p class="sub">A regra exportada do FT (campo manutencaoReaisKm), na ordem em que ela é testada · Rota, ${VIG}, ${f0(M2.manut.ativas)} placas ativas</p>
    ${cartoes([
      { k: '1 · Carência', n: 'R$ 0', p: `vida ≤ ${f0(P.freeMaintenance)} meses (caminhão 2018+): o FT não paga manutenção. ${f0(M2.manut.carencia.placas)} placas nesta quinzena.` },
      { k: '2 · Contrato da placa', n: rk(g('contrato (menor que o BID ou compra fora autorizada)').rk), p: `o R$/km do contrato entra quando é <b>menor que o BID</b> ou quando a compra fora do BID foi autorizada. ${f0(g('contrato (menor que o BID ou compra fora autorizada)').placas)} placas.` },
      { k: '3 · BID da montadora', n: rk(g('BID (contrato maior que o BID)').rk), p: `contrato maior que o BID: paga o BID. ${f0(g('BID (contrato maior que o BID)').placas)} placas.` },
      { k: '4 · BID × 90%', n: rk(g('BID × 90% (sem contrato, BID 2019+)').rk), p: `sem contrato, BID de 2019 em diante: paga 90% do BID. ${f0(g('BID × 90% (sem contrato, BID 2019+)').placas)} placas (BID antigo: 100%).` },
      { k: '5 · Tabela por idade', n: rk(g('tabela por idade (sem BID)').rk), p: `sem BID (ou caminhão com mais de 10 anos): tabela da unidade por capacidade × ano × km. ${f0(g('tabela por idade (sem BID)').placas)} placas.` },
    ])}
    ${fx(['Pago no mês', { op: '=' }, 'Manutenção R$/km', { op: '×' }, 'km dos mapas rodados', '<small>· o campo R$/KM (contrato por faixa de odômetro) é informativo; o pago sai do Manutenção R$/KM</small>'], { lab: 'Resumo' })}
    <p class="note">A regra reproduz o Manutenção R$/KM em ${f0(M3.manut_check.bate_pct)}% das placas com BID; o resto cai na tabela por idade (mais de 10 anos de vida) ou leva o reajuste anual do contrato. Percentuais e medianas medidos nos dados, não são campo do FT.</p>`,
    `O FT testa a regra nesta ordem: na carência paga zero; com contrato cadastrado, paga o contrato se ele for menor que o BID (ou se a compra fora do BID foi autorizada), senão paga o BID; sem contrato, 90% do BID; sem BID, a tabela por idade. O pago do mês é esse R$/km vezes o km dos mapas rodados. Contrato acima do BID não entra: a diferença é nossa.`);
}
// manutenção (b) BID
{
  const B = M3.bid_tabela;
  ex('T2 · Variável · Manutenção · 2', 'O BID da montadora: R$/km por capacidade, ano e faixa de odômetro',
    `<p class="sub">Tabela Manutenção BID (ROTA), vencedores do BID de 2021 em diante · o FT busca pela capacidade, montadora, ano do BID e odômetro previsto</p>
    ${tabela({ cols: [{ t: 'Ano do BID', n: true }, { t: 'Pallets', n: true }, { t: 'Montadora' }, { t: 'Faixa 1 (R$/km)', n: true }, { t: 'Faixa 2', n: true }, { t: 'Faixa 3', n: true }, { t: 'Faixa 2 a partir de (km)', n: true }, { t: 'Faixa 3 a partir de (km)', n: true }],
      rows: B.map(b => [b.ano.replace('.0', ''), b.capacidadePallets.replace('.0', ''), b.montadora.replace('Descrição: ', ''), f2(+b.valorFaixa1), f2(+b.valorFaixa2), f2(+b.valorFaixa3), f0(+b.kmApartirDe2), f0(+b.kmApartirDe3)]) })}
    ${fx(['BID da placa', { op: '=' }, 'tabela(capacidade, montadora, ano do BID, odômetro previsto)', { op: '×' }, '(1 + reajuste)', '<small>· odômetro previsto = odômetro + km remunerado × 6</small>'], { lab: 'Busca' })}
    ${fx([`${P.Placa}: BID ${rk(P.manutencaoBid)}`, { op: '×' }, '90% (sem contrato, BID 2021)', { eq: rk(P['Manutenção R$/KM']) }], { ex: true, lab: 'No exemplo' })}`,
    `O BID é o preço de manutenção por km que a montadora vencedora do BID da Ambev oferece para cada capacidade e ano, por faixa de km acumulado. A placa sem contrato recebe 90% desse valor (BID de 2019 em diante). O odômetro previsto (odômetro atual mais seis meses de km) escolhe a faixa; quando a placa passa de faixa, o R$/km muda.`);
}
// manutenção (c) contrato e exemplos
{
  const Ex = M3.manut_ex, ks = Object.keys(Ex);
  ex('T2 · Variável · Manutenção · 3', 'Contrato da placa: entra só quando é menor que o BID. Acima do BID, a diferença é nossa.',
    `<p class="sub">Um exemplo real por regra · Rota, ${VIG}</p>
    ${tabela({ cols: [{ t: 'Regra' }, { t: 'Placa' }, { t: 'Unidade' }, { t: 'Modelo' }, { t: 'Vida (meses)', n: true }, { t: 'BID (R$/km)', n: true }, { t: 'Contrato (R$/km)', n: true }, { t: 'Pago (R$/km)', n: true }],
      rows: ks.map(k => [k, Ex[k].placa, NOME[Ex[k].uni] || Ex[k].uni, Ex[k].modelo, f1(Ex[k].vida), f2(Ex[k].bid), f2(Ex[k].contrato), { v: '<b>' + f2(Ex[k].rk) + '</b>' }]) })}
    ${cartoes([
      { k: 'Contrato VW × pago, 2026', n: 'R$ 274 mil', p: 'em 206 placas com fatura: a VW cobra R$ 0,76/km e o FT paga R$ 0,61/km nessas placas (jan–ago). O que passa do BID não é remunerado.', acc: true },
      { k: 'Placa sem contrato', n: 'recebe', p: '90% do BID ou a tabela por idade. Ter ou não ter contrato não muda o direito; muda o que custa.' },
      { k: 'Compra fora do BID autorizada', n: 'contrato', p: 'quando a Ambev autoriza comprar fora do BID, o contrato cadastrado é pago mesmo acima do BID.' },
    ])}`,
    `O contrato de manutenção da placa só entra no pagamento quando custa menos que o BID, ou quando a compra fora do BID foi autorizada. Contrato acima do BID recebe o BID: a diferença entre a fatura da montadora e o pago sai do nosso resultado. Reajuste anual do contrato (placas 2021+) entra no cadastro e no pago.`);
}
// manutenção (d) tabela por idade
{
  const Tb = M3.tab_idade;
  ex('T2 · Variável · Manutenção · 4', 'Sem BID: a tabela da unidade por ano de vida e km por mês',
    `<p class="sub">Tabela Manutenção Cavalo (ROTA), ${UNI}, capacidade 10 pallets · R$/km</p>
    ${tabela({ cols: [{ t: 'Ano de vida', n: true }, { t: 'até 1.000 km/mês', n: true }, { t: '1.500', n: true }, { t: '2.000', n: true }, { t: '2.500', n: true }, { t: '3.000', n: true }],
      rows: Tb.map(t => [f0(+t.Ano), f2(+t['KM 1000']), f2(+t['KM 1500']), f2(+t['KM 2000']), f2(+t['KM 2500']), f2(+t['KM 3000'])]) })}
    ${fx(['Manutenção R$/km', { op: '=' }, 'tabela(capacidade, ano de vida, km do mês)', { op: '×' }, '(1 + reajuste)', '<small>· caminhão com mais de 10 anos usa a linha do ano 10, sempre</small>'], { lab: 'Busca' })}`,
    `Quando a placa não tem BID (modelo fora do BID, ou mais de 10 anos de vida), o FT usa a tabela da unidade: R$/km por capacidade, ano de vida e faixa de km mensal. O valor sobe com a idade e cai com o km. Em ${VIG} são ${f0(M2.manut.tabela.placas)} placas, ano mediano ${M2.manut.tabela.ano}, a ${rk(M2.manut.tabela.rk)}.`);
}
// carroceria
{
  const CK = M3.carr_check, e = CK.ex || {};
  ex('T2 · Variável · Carroceria', 'Carroceria: o valor mensal da tabela dividido pelo km, mais R$ 0,02',
    `<p class="sub">${placaTxt} · ${P.Material} · ${P.Perfil} · ${P.Tipo}</p>
    ${formula(['Carroceria R$/km', { op: '=' }, { fr: ['valor por mês da tabela', 'km total da placa'] }, { op: '+' }, '0,02'], [{ fr: [rs2(e.vm), f0(e.km) + ' km'] }, { op: '+' }, '0,02', { eq: rk(e.campo) }])}
    ${tabela({ cols: [{ t: 'Material' }, { t: 'Perfil' }, { t: 'Tipo' }, { t: 'Valor por ano (R$)', n: true }, { t: 'Valor por mês (R$)', n: true }], rows: M3.carr_tabela.slice(0, 6).map(t => [t.material, t.perfil, t.tipo, f2(t.ano), f2(t.mes)]) })}
    ${origem('Manutenção Carroceria e Caminhão (ROTA)', [
      { c: 'Chave da tabela', tec: 'Material · Perfil · Tipo', o: 'tipo de carroceria da placa', v: `${P.Material} · ${P.Perfil} · ${P.Tipo}` },
      { c: 'Valor por mês', tec: 'Valor por Mês', o: 'valor por ano ÷ 12, igual em todas as unidades', v: rs2(e.vm) },
      { c: 'Km total', tec: 'KM Total', o: 'km da 1ª viagem + km ELD', v: f0(e.km) + ' km' },
    ])}`,
    `A carroceria tem um custo mensal de manutenção por tipo (material, perfil e tipo), diluído pelo km da placa, mais R$ 0,02 por km fixos. Conferido: a fórmula exportada fecha em ${f0(CK.bate_pct)}% das ${f0(CK.placas)} placas; sem os R$ 0,02, em ${f0(CK.sem_ajuste_pct)}%. O "ajuste de 9% a 26%" das versões anteriores era isso.`);
}
// pneu
{
  const PK = M3.pneu_check, e = PK.ex || {};
  ex('T2 · Variável · Pneu', 'Pneu: 80% liso e 20% tração, duas recapagens e a montagem, divididos pela vida em km',
    `<p class="sub">${placaTxt} · ${P['Medida Pneu']} · ${f0(e.qtd)} pneus</p>
    ${formula(['Pneu R$/km', { op: '=' }, { fr: ['pneus × (0,8 × liso + 0,2 × tração) + pneus × 2 × recapagem + pneus × (câmara + protetor + montagem)', 'vida em km'] }],
      [{ fr: [`${f0(e.qtd)} × (0,8 × ${rs2(e.liso)} + 0,2 × ${rs2(e.tracao)}) + ${f0(e.qtd)} × ${f0(e.nrec)} × ${rs2(e.recap)} + ${f0(e.qtd)} × ${rs2(e.montagem)}`, f0(e.vida) + ' km'] }, { eq: rk(e.campo) }])}
    ${origem('Pneu Caminhão, Pneu KM Caminhão e Caminhão (ROTA)', [
      { c: 'Preço liso, tração e recapagem', tec: 'Preço Liso · Preço Tração · Preço Recapagem', o: 'tabela por medida e região', v: `${rs2(e.liso)} · ${rs2(e.tracao)} · ${rs2(e.recap)}` },
      { c: 'Câmara, protetor e montagem', tec: 'Preço da Câmara · Preço Protetor · Preço Montagem', o: 'por pneu; câmara e protetor só em medidas com câmara', v: `${rs2(e.camara)} · ${rs2(e.protetor)} · ${rs2(e.montagem)}` },
      { c: 'Quantidade de pneus', tec: 'Quantidade de Pneus', o: 'eixo dianteiro + eixo traseiro', v: f0(e.qtd) },
      { c: 'Recapagens e vida', tec: 'Quantidade de Recapagem · Vida Pneus KM', o: 'sempre 2 recapagens; vida por região (km ajustado)', v: `${f0(e.nrec)} · ${f0(e.vida)} km` },
    ])}`,
    `O FT monta um jogo de pneus (80% liso, 20% tração), duas recapagens e a montagem, e divide pela vida em km da região. Conferido: ${f0(PK.bate_pct)}% das placas fecham. Pneu que não chega à vida ou que não recapa duas vezes custa mais do que o pago; comprar abaixo da tabela sobra.`);
}
// R$/km do caminhão
{
  const ex4 = [{ rot: 'Combustível', v: P['Consumo R$/KM'] }, { rot: 'Manutenção', v: P['Manutenção R$/KM'] }, { rot: 'Carroceria', v: P['Manutenção Carroceria R$/KM'] }, { rot: 'Pneu', v: P['Pneu por KM'] }, { rot: 'R$/km do\ncaminhão', v: P['Total Custo Variável'], tot: true }];
  ex('T2 · Variável · R$/km', 'R$/km do caminhão: a soma das quatro peças',
    `<p class="sub">${placaTxt}</p>
    <div class="duas"><div>${ponte({ w: 620, h: 250, itens: ex4, fmt: v => f2(v), corPos: AZUL })}</div>
    <div>${livro([{ l: 'Combustível', v: rk(P['Consumo R$/KM']) }, { l: 'Manutenção', v: rk(P['Manutenção R$/KM']) }, { l: 'Carroceria', v: rk(P['Manutenção Carroceria R$/KM']) }, { l: 'Pneu', v: rk(P['Pneu por KM']) }], { l: 'R$/km do caminhão', v: rk(P['Total Custo Variável']) })}
    ${fx(['Pago no mês', { op: '=' }, `${rk(P['Total Custo Variável'])}`, { op: '×' }, 'km dos mapas rodados', '<small>· no teto (25 mapas): ' + f0(P['KM Mês Roadshow']) + ' km × ' + f2(P['Total Custo Variável']) + ' = ' + rs(P['Total Custo Variável'] * P['KM Mês Roadshow']) + '</small>'], { ex: true, lab: 'Mês' })}</div></div>
    ${origem('Caminhão e Resumo (ROTA)', [
      { c: 'R$/km do caminhão', tec: 'Total Custo Variável', o: 'combustível + manutenção + carroceria + pneu (fecha ao centavo)', v: rk(P['Total Custo Variável']) },
      { c: 'R$/km da unidade', tec: 'Resumo · Total R$/KM', o: 'média das placas ativas ponderada pelo km', v: rk(R['Total R$/KM']) },
      { c: 'No AS', tec: 'Caminhão AS · Total Custo Variável', o: 'as mesmas quatro + lavagem por km', v: M3.as ? rk(M3.as['Total Custo Variável']) : '—' },
    ])}`,
    `O R$/km do caminhão é a soma do combustível, da manutenção, da carroceria e do pneu. É esse número vezes o km dos mapas rodados que forma o variável do mês. A unidade é paga pela média das placas ativas; cada placa que entra ou sai da ativa muda a média.`);
}
// recarga, noturna, Van e AS
{
  const V = M3.van || {}, A = M3.as || {};
  ex('T2 · Variável · Recarga, Van e AS', 'Recarga paga o km da recarga; Van e AS usam a mesma lógica',
    `<p class="sub">${UNI}, ${VIG}</p>
    ${fx(['Recarga', { op: '=' }, `R$/km ${f2(RC.rskm)}`, { op: '×' }, `${f1(RC.km)} km`, { op: '+' }, 'lucro ÷ 25', { op: '+' }, 'prêmio da equipe', { eq: rs2(RC.total) + ' por recarga' }], { lab: 'Recarga' })}
    ${fx(['Noturna', { op: '=' }, `(R$/km × ${f0(PR.km_noturna)} km mensais + equipe noturna + lucro)`, { op: '÷' }, '25', '<small>· só nas unidades com rota noturna cadastrada</small>'], { lab: 'Noturna' })}
    ${cartoes([
      { k: 'Van', n: V.placa ? rk(V.totalCustoVariavel) : '—', p: V.placa ? `${f0(V.placas)} vans em ${UNI}: km mensal ${f0(V.kmMesRoadShow)} (parâmetro próprio), Km/L ${f2(V.consumoKMPorLitro)}, manutenção ${rk(V.manutencaoReaisPorKm)}, pneu ${rk(V.pneuPorKm)}, carroceria zero. Fixo ${rs2(V.totalCustoFixo)} com lavagem de ${rs2(V.lavagem)}.` : 'sem van na unidade do exemplo' },
      { k: 'AS (auto serviço)', n: A.placa ? rk(A['Total Custo Variável']) : '—', p: A.placa ? `placa ${A.placa} (${NOME[A.uni] || A.uni}): km mensal ${f0(A['KM Mês Roadshow'])}, Km/L ${f2(A['Consumo KM/L'])}, manutenção ${rk(A['Manutenção R$/KM'])}, pneu ${rk(A['Pneu por KM'])} e <b>lavagem por km ${rk(A['Lavagem por KM'])}</b> (custo × lavagens ÷ km).` : '—' },
      { k: 'O que não muda', n: '4 peças', p: 'combustível, manutenção, carroceria e pneu com as mesmas fórmulas; muda o km mensal, as tabelas da unidade e, no AS, a lavagem dentro do variável.' },
    ])}`,
    `Cada recarga paga o R$/km da unidade vezes o km de recarga cadastrado (${f1(RC.km)} km em ${UNI}), mais a fatia de lucro e o prêmio da equipe. Van e AS usam as mesmas quatro peças com parâmetros próprios: a Van tem km mensal menor e carroceria zero; o AS paga a lavagem por km dentro do variável, não como fixo.`);
}
// pacote por caminhão e lucro por HL
{
  const at = FA.ativos, lucMes = LU.lucro ? LU.lucro * 2 : 0, lucCam = at ? lucMes / at : 0;
  ex('T2 · O pacote por caminhão', 'O Resumo paga, por caminhão ativo, frota + equipe + QLP + outras despesas, e o lucro vem por hectolitro',
    `<p class="sub">${UNI}, ${VIG} · ${f0(at)} ativos · valores líquidos por caminhão por mês (Faturamento ROTA)</p>
    <div class="duas"><div>${livro([
      { l: 'Fixo da frota ativa <span class="tag erro">frota</span>', v: rs2(FA.fixo_ativo_cam) }, { l: 'Variável no teto (R$/km × km) <span class="tag erro">frota</span>', v: rs2(FA.var_cam) },
      { l: 'Remuneração variável da equipe (RV)', v: rs2(FA.rv_cam) }, { l: 'Equipe de entrega', v: rs2(FA.equipe_cam) }, { l: 'QLP e administrativo', v: rs2(FA.qlp_cam) }, { l: 'Outras despesas (lucro por HL, lavagem, FAD, incentivo)', v: rs2(FA.outras_cam) }],
      { l: 'Total líquido por caminhão', v: rs2(FA.total_liq_cam) })}
      <p class="note">Mais o fixo das paradas: ${rs2(FA.fixo_parado_cam)} × ${f0(FA.parados)} parados. O bruto acrescenta os impostos (${f1(FA.imp_dentro)}% dentro e ${f1(FA.imp_fora)}% fora do município).</p></div>
    <div>${cartoes([
      { k: 'Lucro por hectolitro', n: 'R$ ' + f2(LU.rshl) + '/HL', p: `${f0(LU.volume)} HL na quinzena × R$ ${f2(LU.rshl)} = ${rs(LU.lucro)}; no mês ${rs(lucMes)}, ${rs2(lucCam)} por caminhão ativo, dentro de Outras Despesas.` },
      { k: 'Lucro operacional mínimo', n: 'R$ 500 a 650', p: 'por caminhão e perfil (4 a 14 pallets), no modelo antigo; no modelo novo o lucro é o R$/HL.' },
      { k: 'Por mapa', n: rs2(FA.total_liq_cam / 25), p: 'o pacote inteiro ÷ 25 mapas. Frota (fixo + variável) é ' + f0((FA.fixo_ativo_cam + FA.var_cam) / FA.total_liq_cam * 100) + '% dele.' },
    ], 1)}</div></div>`,
    `O Freightech remunera o T2 em quatro blocos por caminhão ativo: frota (fixo e variável), equipe de entrega, QLP e outras despesas. A margem não vem do km nem do fixo: vem do lucro por hectolitro vendido (R$/HL × volume), que entra em Outras Despesas. Só os dois blocos marcados são custo de frota e objeto deste manual.`);
}

// ═══ Parte 3 · T1 ═══
capaSec(3, 'T1 · Empurrada e Insumos', 'Frete por viagem de cada trecho e fixo por equipamento. Salário e lucro variável entram no frete, mas não são custo de frota.');
{
  const TV = M.trecho_viagem || {};
  const lab = { Diesel: 'Diesel', ManutencaoCavalo: 'Manut.\ncavalo', ManutencaoCarreta: 'Manut.\ncarreta', Pneus: 'Pneus', Lavagem: 'Lavagem', Pedagio: 'Pedágio', Seguro: 'Seguro', SalarioVariavel: 'Salário\nvariável', LucroVariavel: 'Lucro\nvariável' };
  const frota = ['Diesel', 'ManutencaoCavalo', 'ManutencaoCarreta', 'Pneus', 'Lavagem', 'Pedagio', 'Seguro'], nf = ['SalarioVariavel', 'LucroVariavel'];
  const sf = frota.reduce((s, k) => s + (TV[k] || 0), 0);
  ex('T1 · Frete da viagem', 'O frete de cada trecho é a soma de nove componentes; sete são frota',
    `<p class="sub">${T.Origem.replace('Unidade: ', '').split(' |')[0]} → ${T.Destino.replace('Unidade: ', '').split(' |')[0]} · ${f1(T.kmRodado)} km (ida + volta) · ${T.Capacidade.replace('Pallets: ', '')} pallets · Piraí, ${VIG}</p>
    ${ponte({ h: 250, itens: [...frota.filter(k => TV[k]).map(k => ({ rot: lab[k], v: TV[k], cor: AZUL })), { rot: 'Frete de\nfrota', v: sf, tot: true }, ...nf.filter(k => TV[k]).map(k => ({ rot: lab[k], v: TV[k], cor: INK3 })), { rot: 'Frete\nlíquido', v: T.freteLiquido, tot: true }], fmt: v => 'R$ ' + f0(v) })}
    ${fx(['Frete líquido', { op: '=' }, 'Σ (R$/km de cada componente × km rodado do trecho)', { eq: rs2(T.freteLiquido) + ' por viagem' }, `<small>· de frota: ${rs2(sf)} · com impostos (PIS/COFINS e ICMS ${f0(T.percentualIcmsIss)}%): ${rs2(T.freteCtrc)}</small>`], { lab: 'Conta' })}
    <p class="note">Em cinza: salário variável (prêmio de produtividade do motorista, fator ${f1(T.premioProdutividadeFatorMotorista)}) e lucro variável. São remuneração de equipe e margem, não custo de frota, e só aparecem neste slide.</p>`,
    `Cada trecho tem um R$ por viagem: o km de ida e volta vezes o R$/km de cada componente. Diesel, manutenção do cavalo e da carreta, pneu, lavagem, pedágio e seguro são o frete de frota. Salário variável e lucro variável completam o frete líquido, mas não entram na conta de frota deste manual. Conferido: a soma fecha ao centavo em todos os trechos.`);
}
{
  const DE = M.comb_emp['DIESEL S10'] || {}, pago = Math.min(DE.op, DE.anp);
  ex('T1 · Variável · Diesel', 'Diesel do trecho: preço pago com 5% do Arla, dividido pelo Km/L do trecho',
    `<p class="sub">Piraí, ${VIG} · trecho do exemplo</p>
    ${formula(['Diesel R$/km', { op: '=' }, { fr: ['menor entre nosso preço e ANP + 0,05 × preço do Arla', 'Km/L do trecho'] }], [{ fr: [`${rs2(pago)} + 0,05 × ${rs2((M.comb_emp.ARLA || {}).credito || 0)} = ${rs2(DE.credito)}`, f2(T.dieselConsumoKmL)] }, { eq: rk(T.dieselConsumoDieselReaisKM) }])}
    ${fx(['Km/L do trecho', { op: '=' }, 'consumo do parâmetro da unidade', { op: '×' }, '(1 + perda por região + perda por km + perda do descartável)', `<small>· hoje as três perdas estão zeradas na fórmula (× 0): o Km/L do trecho é o consumo cadastrado, ${f2(T.dieselConsumoKmL)}</small>`], { lab: 'Km/L' })}
    ${origem('Combustível Empurrada e Trecho (EMPURRADA)', [
      { c: 'Nosso preço e ANP', tec: 'precoOperadora · precoAnp', o: 'por unidade e quinzena', v: rs2(DE.op) + ' · ' + rs2(DE.anp) },
      { c: 'Preço com crédito', tec: 'precoCreditoImpostos', o: 'o menor dos dois + 5% do Arla (a fórmula exportada); o nome do campo vem do modelo antigo, com crédito de imposto', v: rs2(DE.credito) },
      { c: 'Km/L do trecho', tec: 'dieselConsumoKmL', o: 'consumo cadastrado por unidade (perdas zeradas)', v: f2(T.dieselConsumoKmL) },
      { c: 'Diesel por km', tec: 'dieselConsumoDieselReaisKM', o: 'resultado', v: rk(T.dieselConsumoDieselReaisKM) },
    ])}`,
    `Na Empurrada o diesel do trecho usa a mesma lógica do T2: preço pago (o menor entre o nosso e a ANP) mais 5% do Arla, dividido pelo Km/L. A diferença é que o Km/L é do trecho (um consumo cadastrado por unidade, hoje sem as perdas por região e km, que estão zeradas na fórmula), não da placa. O fator de crédito de imposto das versões anteriores é o 5% do Arla.`);
}
ex('T1 · Variável · Manutenção e pneu', 'Manutenção do cavalo e da carreta e pneu: R$/km de tabela por unidade',
  `<p class="sub">Trecho do exemplo · cavalo ${CV.Placa} (${String(CV.modeloEmpurrada).replace('Modelo: ', '')}), ${f0(CV.manutencaoVidaMeses)} meses, faixa ${String(CV.faixaKm).replace('ATE_', 'até ')} km</p>
  ${fx(['Manutenção do cavalo', { op: '=' }, 'R$/km do parâmetro de manutenção da unidade', { eq: rk(T.manutencaoCavalo) }, '<small>· o cavalo tem a mesma regra do T2 (carência, contrato, BID × 90%), mas o trecho usa o parâmetro da unidade</small>'], { lab: 'Cavalo' })}
  ${fx(['Manutenção da carreta', { op: '=' }, 'tabela por tipo (bitrem ou não) e km do trecho', { eq: rk(T.manutencaoImplementoReaiskm) }, '<small>· trecho de até 150 km leva um multiplicador</small>'], { lab: 'Carreta' })}
  ${formula(['Pneu R$/km', { op: '=' }, { fr: ['(preço médio do pneu + carcaça + recapagem × recapagens) × pneus', 'vida útil em km'] }], [{ fr: [`(${rs2(T.pneuValorMedioPneus)} + ${rs2(T.pneuValorDeVendaDaCarcaca)} + ${rs2(T.pneuValorMedioDaRecapagem)} × 2) × ${f0(T.pneuQuantidadeDePneus)}`, f0(T.vidautilAjustadaPneu) + ' km'] }, { eq: rk(T.pneuCustoPneusCamarasReaisKm) }])}
  ${origem('Trecho, Cavalo e Manutenção (EMPURRADA)', [
    { c: 'Manutenção do cavalo', tec: 'manutencaoCavalo ← parametroManutencaoEmpurrada.manutencaoReaisKm', o: 'R$/km por unidade', v: rk(T.manutencaoCavalo) },
    { c: 'Manutenção da carreta', tec: 'manutencaoImplementoReaiskm', o: 'bitrem (0,22 a 0,38) ou não (0,11 a 0,19) × fator', v: rk(T.manutencaoImplementoReaiskm) },
    { c: 'Pneus, preço e vida', tec: 'pneuQuantidadeDePneus · pneuValorMedioPneus · vidautilAjustadaPneu', o: 'por capacidade e região', v: `${f0(T.pneuQuantidadeDePneus)} · ${rs2(T.pneuValorMedioPneus)} · ${f0(T.vidautilAjustadaPneu)} km` },
  ])}`,
  `No trecho, manutenção e pneu são R$/km de tabela da unidade: a manutenção do cavalo vem do parâmetro de manutenção, a da carreta de uma tabela por tipo de implemento, e o pneu de um jogo (${f0(T.pneuQuantidadeDePneus)} pneus, duas recapagens) dividido pela vida da região. Cavalo com mais de ${f0(CV.freeMaintenance)} meses fora da carência recebe pela mesma regra do T2.`);
{
  const TV = M.trecho_viagem || {};
  ex('T1 · Variável · Lavagem, pedágio e seguro', 'Lavagem, pedágio e seguro completam o frete de frota do trecho',
    `<p class="sub">Trecho do exemplo</p>
    ${fx(['Lavagem R$/km', { op: '=' }, { fr: ['lavagens por mês × custo da lavagem', 'km rodado por equipe no mês'] }, { eq: rk(T.lavagemReaisKm) }], { lab: 'Lavagem' })}
    ${fx(['Pedágio por viagem', { op: '=' }, 'pedágio por eixo (ida e volta)', { op: '×' }, 'eixos da capacidade', { eq: 'R$ ' + f2(TV.Pedagio || 0) }, '<small>· por km: ' + rk(T.pedagioReaisKM) + '</small>'], { lab: 'Pedágio' })}
    ${fx(['Seguro R$/km', { op: '=' }, { fr: ['seguro da carga do trecho', 'km ida e volta'] }, { eq: rk(T.seguroReaiskm) }], { lab: 'Seguro' })}
    ${cartoes([
      { k: 'Salário variável', n: 'R$ ' + f2(TV.SalarioVariavel || 0), p: `por viagem: prêmio de produtividade do motorista ÷ km do mês × fator ${f1(T.premioProdutividadeFatorMotorista)}. Remuneração de equipe, não frota.` },
      { k: 'Lucro variável', n: rk(T.lucroVariavelReaisKm), p: 'lucro operacional variável da unidade ÷ km previsto por equipe. Margem, não frota.' },
      { k: 'Viagens previstas', n: f1(T.previsaoViagens), p: `por dia: grade de carregamento ÷ tempo do trajeto (${f0(T.velocidadeMediaKmH)} km/h + tempos internos).` },
    ])}`,
    `Lavagem, pedágio e seguro são rateados pelo km do trecho: a lavagem pela quantidade e custo mensais, o pedágio pelos eixos da capacidade, o seguro pelo valor da carga. Com o diesel, a manutenção e o pneu, formam o frete de frota. Salário e lucro variável são pagos no mesmo frete, mas pertencem à equipe e à margem.`);
}
ex('T1 · Fixo', 'Fixo do cavalo e da carreta: FINAME e custos do equipamento, ativo ou parado',
  `<p class="sub">Cavalo ${CV.Placa} e carreta ${CR.Placa} (${CR.modelo}), Piraí, ${VIG}</p>
  <div class="duas"><div>${livro([{ l: 'Amortização do cavalo', v: rs2(CV.amortizacaoCavalo) }, { l: 'Juros do FINAME do cavalo', v: rs2(CV.jurosFinameCavalo) }], { l: 'FINAME do cavalo', v: rs2(CV.finameCavalo) })}
    <div class="filete"></div>
    ${livro([{ l: 'FINAME (carreta + cavalo)', v: rs2(CR.finame) }, { l: 'Seguro', v: rs2(CR.seguro) }, { l: 'IPVA por mês', v: rs2(CR.ipvaLicenciamentoMensal) }, { l: 'Tacógrafo e faixa', v: rs2(CR.tacografo + CR.faixaReflexiva) }, { l: 'Lucro fixo do modelo novo (ciclo)', v: rs2(CR.custoFixo - CR.finame - CR.seguro - CR.ipvaLicenciamentoMensal - CR.tacografo - CR.faixaReflexiva - (CR.rastreador || 0)) }], { l: 'Custo fixo do conjunto', v: rs2(CR.custoFixo) })}</div>
  <div>${cartoes([
    { k: 'Equipamento ativo', n: rs2(M.fat_emp.equipamentoAtivoValorUnitario), p: `por mês, × ${f0(M.fat_emp.equipamentoAtivoQuantidade)} ativos em Piraí (Faturamento Empurrada).` },
    { k: 'Equipamento parado', n: rs2(M.fat_emp.equipamentoParadoValorUnitario), p: `o mesmo valor unitário, × ${f0(M.fat_emp.equipamentoParadoQuantidade)} parados. O parado recebe o fixo inteiro.` },
    { k: 'Fora da frota', n: 'equipe e QLP', p: `equipe ativa ${rs2(M.fat_emp.equipeAtivaValorUnitario)} e QLP ${rs2(M.fat_emp.qlpAdmValorUnitario)} por equipamento: remuneração de pessoas e estrutura.` },
  ], 1)}</div></div>`,
  `O fixo do T1 é por conjunto cavalo + carreta: FINAME (amortização + juros), seguro, IPVA, tacógrafo, faixa e o lucro fixo do ciclo. Entra pelo Faturamento como valor unitário vezes equipamentos ativos e parados, com o mesmo valor para os dois. Conferido: a fórmula exportada do custo fixo da carreta é FINAME + lucro fixo do ciclo (o que as versões anteriores chamavam de "demais, campo não exportado").`);

// ═══ Parte 4 · Armazém ═══
capaSec(4, 'Armazém', 'Fixo por empilhadeira e variável por hora de horímetro.');
if (E.custoFixoCustoFixo != null) ex('Armazém · Empilhadeira', 'Empilhadeira: financiamento + lucro fixo por mês; manutenção + pneus por hora',
  `<p class="sub">${String(E.descricaoEmpilhadeira || '').replace('Descrição: ', '')} · ${E.equipamento || ''} · ${E.modeloApoio || ''} · ${M3.vig}</p>
  ${fx(['Fixo por mês', { op: '=' }, 'financiamento (CDC ou FINAME)', { op: '+' }, 'lucro fixo', { eq: rs2(E.custoFixoCustoFixo) }, `<small>· ${rs2(E.custoFixoFinanciamento)} + ${rs2(E.custoFixoLucroFixo)}</small>`], { lab: 'Fixo' })}
  ${fx(['Lucro fixo', { op: '=' }, 'valor da nota × % de lucro do ciclo', { op: '+' }, 'valor da nota × risco (0,25%)', { eq: rs2(E.custoFixoLucroFixo) }], { ex: true, lab: '' })}
  ${fx(['Variável por hora', { op: '=' }, 'manutenção por hora (tabela por tipo e marca)', { op: '+' }, 'pneus por hora (super elástico, por quantidade)', { eq: 'R$ ' + f2(E.custoVariavelTotal) + '/h' }, `<small>· ${f2(E.custoVariavelManutencaoEmpilhadeira)} + ${f2(E.custoVariavelPneus)}</small>`], { lab: 'Variável' })}
  ${origem('Equipamento Armazém e Fechamento (ARMAZEM)', [
    { c: 'Financiamento', tec: 'custoFixoFinanciamento', o: 'CDC: PMT(taxa ao mês, prazo, nota × (1 − entrada)); FINAME: amortização linear + juros médios', v: rs2(E.custoFixoFinanciamento) },
    { c: 'Lucro fixo', tec: 'custoFixoLucroFixo', o: '% do ciclo sobre a nota + 0,25% de risco', v: rs2(E.custoFixoLucroFixo) },
    { c: 'Horas pagas', tec: 'Fechamento · parametrosHorimetroQtde × Valor', o: 'horímetro médio por operador × empilhadeiras', v: '—' },
  ])}`,
  `A empilhadeira recebe um fixo mensal (a parcela do financiamento mais um lucro fixo sobre o valor da nota) e um variável por hora de horímetro, com a manutenção e os pneus de tabela por tipo e marca. O Fechamento multiplica as horas pagas pelo valor por hora.`);

// ═══ fechamento ═══
slide(`${head('Para usar o manual', 'Quatro regras que resolvem a maior parte das dúvidas')}
  ${cartoes([
    { k: '1 · O fixo é do cadastro', n: 'ativo ou parado', p: 'FINAME, seguro, IPVA, rastreador e faixa seguem a placa cadastrada; só a lavagem exige o caminhão ativo. Placa quitada recebe quase nada: a renovação se planeja pelo fim das parcelas.' },
    { k: '2 · O variável é do mapa', n: 'R$/km × km rodado', p: 'Combustível, manutenção, carroceria e pneu são pagos pelo km dos mapas rodados. Km a mais só vira remuneração se for validado na revisão quinzenal.' },
    { k: '3 · O Km/L decide o combustível', n: '66% do variável', p: 'É o consumo validado por placa no trimestre; a média das ativas paga a unidade. Antes de cada revisão, criticar placa a placa: novas, iguais com valores diferentes, zeradas.' },
    { k: '4 · Manutenção paga o BID', n: 'contrato só se menor', p: 'Contrato acima do BID recebe o BID; sem contrato, 90% do BID; sem BID, tabela por idade; zero na carência. A fatura acima disso é nossa.' },
  ])}
  ${conc(`As fórmulas deste manual são as exportadas do Freightech em out/26 e foram conferidas placa a placa: combustível (99,7%), carroceria (100%), pneu (100%), fixo (ao centavo), frete do trecho (ao centavo), manutenção (75% das placas com BID; o resto pela tabela por idade e pelo reajuste). Perguntas abertas ao planejamento e à Ambev: como o real vira o Km/L validado; por que o rastreador só é pago no Rio; como a fatura do mapa (2art) se liga ao Faturamento do FT.`, 'Conferência')}`);

console.log('ok', write(process.env.FT_HTML || 'manual.html'), 'slides');

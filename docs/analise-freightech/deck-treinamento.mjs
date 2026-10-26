// ============================================================
// Treinamento "Como a remuneração funciona" para gestores de operação
// (versão 26/10/2026): introdução didática a partir do mapa, o passo a passo do
// variável, a composição do fixo (ativo × parado), a DRE do mapa com
// Remunerado × Realizado, as alavancas, a Empurrada e a rotina do gestor.
//   OPO=opo.json MAN3=manual3.json MAN=manual.json A2=analise2-2026.json CMP=completa-2026.json FT_HTML=treinamento.html node deck-treinamento.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, fx, formula, livro, cartoes, tabela, origem, ponte, f0, f1, f2, mil, rs, rs2, rk, pct, NOME, MES, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const M3 = JSON.parse(readFileSync(process.env.MAN3 || 'manual3.json', 'utf8'));
const M = JSON.parse(readFileSync(process.env.MAN || 'manual.json', 'utf8'));
const A2 = JSON.parse(readFileSync(process.env.A2 || 'analise2-2026.json', 'utf8'));
const X = JSON.parse(readFileSync(process.env.CMP || 'completa-2026.json', 'utf8'));
const { slide, capa, capaSec, conc, concBlocos, didat, write } = deck({ rodape: 'Treinamento · Como a remuneração funciona · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Como a remuneração funciona' });
const E = O.ex, KE = O.km_ex, FA = M3.fat, SR = M3.srtrans, LU = M3.lucro, PR = M3.param, R = M.resumo, P = M.placa, KT = A2.km_tot, CP = X.comb_ponte;
const kmMapa = E.km_mes / 25, varMapa = E.var * kmMapa, varMes = E.var * E.km_mes, preco = E.comb * E.kml, litros = E.km_mes / E.kml, litros01 = E.km_mes / (E.kml - 0.1);
const head = (k, h, sub = '') => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const PER = `${MES[+X.INI.slice(5) - 1]}/${X.INI.slice(2, 4)} a ${MES[+X.FIM.slice(5) - 1]}/${X.FIM.slice(2, 4)}`;

// ═══ capa ═══
capa('Treinamento para gestores de operação', 'Como a remuneração funciona, e onde a operação ganha ou perde dinheiro',
  'O Freightech (FT) calcula o que a Ambev nos paga pela frota. Este treinamento parte do mapa, mostra o que cada mapa paga, o que é pago sem mapa, e o que a unidade controla.');

// ═══ introdução: o mapa ═══
slide(`${head('Começando do começo', 'Tudo começa no mapa: a viagem do dia que a Ambev monta e o caminhão roda')}
  ${cartoes([
    { k: '1 · A Ambev monta o mapa', n: '1 mapa', p: 'O mapa é a rota de entrega de um dia: clientes, sequência, carga. É a unidade de tudo. Um caminhão ativo faz um mapa por dia útil.', o: 'Até 25 mapas por caminhão por mês.' },
    { k: '2 · O caminhão roda o mapa', n: f1(KE.km_mapa) + ' km', p: `Cada mapa vale um km fixo, definido por unidade na revisão quinzenal: o km do caminhão no mês ÷ 25. Em ${NOME[KE.uni]}, ago/26: ${f0(KE.km_placa)} ÷ 25.`, o: 'Rodar mais do que isso não paga mais.' },
    { k: '3 · Cada mapa rodado é pago', n: 'R$ ' + f0(KE.km_mapa * E.var), p: `km do mapa × R$/km do caminhão (${rk(E.var)} no caminhão mediano). Mais as recargas e as noturnas, que são mapas a mais.`, o: 'Mapa não rodado não paga.' },
    { k: '4 · O fixo não depende do mapa', n: rs(E.fixo) + '/mês', p: 'Todo caminhão cadastrado recebe o fixo (financiamento, seguro, IPVA, rastreador, faixa), ativo ou parado. Só a lavagem exige o caminhão ativo.', o: 'É o caminhão existir.' },
  ])}
  ${conc(`A remuneração do T2 tem duas partes: o <b>variável</b>, pago por km dos mapas rodados, e o <b>fixo</b>, pago por caminhão cadastrado. O resto do treinamento é sobre quem calcula cada uma, o que faz cada uma subir ou cair, e o que a unidade controla.`, 'Em uma frase')}`);

slide(`${head('Começando do começo', 'Quem calcula é o Freightech, a partir do cadastro de cada placa')}
  ${cartoes([
    { k: 'Cadastro da placa', n: '1 ficha', p: 'Modelo, ano, financiamento, tipo de carroceria, medida do pneu, Km/L validado, contrato de manutenção. É dessa ficha que saem o fixo e o R$/km de cada caminhão.', o: 'Relatório Caminhão (ROTA)' },
    { k: 'Revisão quinzenal', n: '2× por mês', p: 'Preço do diesel (a nota que subimos × a ANP), km do caminhão no mês, placas ativas e paradas. A cada quinzena nasce um km e um preço novos.', o: 'Vigência ROTA_1_9_2026 = 1ª quinzena de set/26' },
    { k: 'Revisão trimestral', n: '4× por ano', p: 'O Km/L remunerado de cada placa: o consumo validado do trimestre anterior. É o número que mais pesa no variável.', o: '1ª quinzena de jan, abr, jul e out' },
    { k: 'O resultado', n: 'gastar dentro', p: 'O variável só repõe o custo de um caminhão bem gerido: não tem margem. Cada km a mais, cada litro a mais e cada real acima do preço previsto sai do nosso resultado.', o: 'A margem vem do lucro por hectolitro.', acc: true },
  ])}
  ${fx(['Remuneração de frota', { op: '=' }, 'fixo por caminhão cadastrado', { op: '+' }, 'R$/km × km dos mapas rodados'], { lab: 'Resumo' })}
  ${didat(`O Freightech não mede o que gastamos: ele calcula o que um caminhão como o nosso deveria custar, com as premissas da ficha, e paga isso. Se a ficha está errada (placa ativa que não roda, Km/L desatualizado, contrato cadastrado errado), o pago sai errado. Manter a ficha certa é a primeira tarefa da unidade.`, 'O que isso quer dizer')}`);

// ═══ parte 1 ═══
capaSec(1, 'Como a remuneração funciona', 'Fixo, variável, as quatro peças do R$/km e a DRE de um mapa.');

slide(`${head('A ideia em uma frase', 'A remuneração paga o custo de um caminhão bem gerido. Quem calcula esse custo é o Freightech.')}
  <div class="vs">
    ${cartoes([{ k: 'Custo fixo: o caminhão existir', n: rs(E.fixo) + '<small> por mês</small>', p: 'Parcela do financiamento (FINAME), seguro, IPVA, rastreador, faixa refletiva e lavagem. <b>Todo caminhão cadastrado recebe, ativo ou parado</b>; só a lavagem é do ativo.', o: 'Caminhão mediano da Rota em 2026 (financiado).' }], 1)}
    ${cartoes([{ k: 'Custo variável: o caminhão rodar', n: rk(E.var), p: `Diesel, manutenção, pneu e carroceria. É pago por km, <b>e só nos mapas que de fato rodaram</b>. ≈ ${rs(varMes)} por mês se o caminhão rodar os 25 mapas.`, o: 'Caminhão mediano da Rota em 2026.', acc: true }], 1)}
  </div>
  ${conc(`O variável só repõe o custo do km, sem margem. O resultado vem de gastar dentro do previsto: cada km a mais que o pago, cada litro a mais e cada real acima do preço previsto sai do nosso resultado. O fixo não depende da operação do dia: depende da ficha da placa e do fim das parcelas.`, 'O que isso quer dizer para a operação')}`);

slide(`${head('O variável, passo a passo', 'Do km do caminhão ao dinheiro do mês', `${NOME[KE.uni]}, ago/26`)}
  ${cartoes([
    { k: '1 · Km do caminhão no mês', n: f0(KE.km_placa) + ' km', p: 'Definido pela Ambev em cada revisão quinzenal, por unidade. Todas as placas ativas da unidade têm o mesmo km.', o: 'Caminhão · KM Mês Roadshow (= KM Remunerado do Resumo)' },
    { k: '2 · Km por mapa', n: f1(KE.km_mapa) + ' km', p: `${f0(KE.km_placa)} ÷ 25 dias úteis. É o que cada viagem do dia vale em km.`, o: `Conferido com o Km/Viagem Real da Dispersão de km (${f1(KE.km_viagem)} km)` },
    { k: '3 · Mapas possíveis', n: f0(KE.mapas_pos), p: `${f0(KE.ativos)} caminhões ativos × 25 dias. É o dimensionamento do FT, não uma meta.`, o: 'Resumo · Total Caminhão Ativo × 25' },
    { k: '4 · Mapas rodados', n: f0(KE.viagens), p: 'Só esses são pagos, mais recargas e noturnas.', o: 'Dispersão de km · Viagens - Real (base nossa, não do FT)', acc: true },
  ])}
  ${fx(['Variável do mês', { op: '=' }, 'R$/km do caminhão', { op: '×' }, 'km por mapa', { op: '×' }, 'mapas rodados'], { lab: 'Fórmula' })}
  ${fx([`${rk(E.var)} × ${f1(kmMapa)} km`, { eq: 'R$ ' + f0(varMapa) + ' por mapa rodado' }, `· em ${NOME[KE.uni]}, ago/26: ${f0(KE.pago)} km pagos × R$/km da unidade`], { ex: true, lab: 'No caminhão mediano' })}
  ${didat(`O variável vem do km pago: mapas rodados × km por mapa. O R$/km sai da ficha de cada caminhão (Caminhão · Total Custo Variável) e o km dos mapas da nossa Dispersão de km. O número de mapas possíveis é só o tamanho da frota ativa vezes os dias úteis; o que conta é quantos rodaram.`, 'De onde vem cada número')}`);

{
  const itens = [{ rot: 'Diesel', v: E.comb }, { rot: 'Manutenção', v: E.manut }, { rot: 'Carroceria', v: E.carr }, { rot: 'Pneu', v: E.pneu }, { rot: 'R$/km do\ncaminhão', v: E.var, tot: true }];
  slide(`${head('As quatro peças do R$/km', 'Cada peça tem o seu valor previsto. É nele que a operação ganha ou perde.', 'Caminhão mediano da Rota em 2026')}
  <div class="duas"><div>${ponte({ w: 620, h: 230, itens, fmt: v => f2(v), corPos: AZUL })}</div>
  <div>${cartoes([
    { k: 'Diesel · ' + f0(E.comb / E.var * 100) + '%', n: rk(E.comb), p: `(preço do litro + 5% do Arla) ÷ Km/L remunerado da placa (${f2(E.kml)}). Preço = o menor entre o nosso e a ANP.` },
    { k: 'Manutenção · ' + f0(E.manut / E.var * 100) + '%', n: rk(E.manut), p: 'BID da montadora (90% sem contrato; o contrato só se for menor que o BID). Zero na carência; tabela por idade sem BID.' },
    { k: 'Pneu · ' + f0(E.pneu / E.var * 100) + '%', n: rk(E.pneu), p: `${f0(E.qpneu)} pneus × R$ ${f0(E.preco_pneu)} + 2 recapagens ÷ vida de ${f0(E.vida_pneu)} km.` },
    { k: 'Carroceria · ' + f0(E.carr / E.var * 100) + '%', n: rk(E.carr), p: 'valor mensal da tabela por tipo ÷ km do caminhão + R$ 0,02.' },
  ], 2)}</div></div>
  ${conc(`Diesel é ${f0(E.comb / E.var * 100)}% do variável: é a peça em que um pequeno desvio vira mais dinheiro, pelo consumo e pelo preço do litro. A manutenção é a segunda e a única em que o FT paga uma tabela (o BID) e nós pagamos uma fatura.`)}`);
}

// composição do fixo
{
  const q = A2.quitado;
  slide(`${head('O fixo', 'De que o fixo é feito: quase tudo é a parcela do financiamento', `Placa ${P.Placa} (${P['Modelo do Cavalo']}, ${NOME.CBA}, financiada) × caminhão quitado`)}
  <div class="vs"><div>${livro([{ l: 'FINAME (parcela do financiamento)', v: rs2(P['FINAME Modelo Novo']) }, { l: 'Seguro (0,75% ao ano do valor)', v: rs2(P.Seguro) }, { l: 'IPVA e licenciamento ÷ 12', v: rs2(P['IPVA Licenciamento']) }, { l: 'Rastreador (só no RJ: R$ 106)', v: rs2(P.Rastreador) }, { l: 'Faixa refletiva', v: rs2(P['Faixa Reflexiva']) }, { l: 'Lavagem (só ativo)', v: rs2(P.Lavagem) }], { l: 'Fixo por mês', v: rs2(P['Total Custo Fixo']) })}</div>
  <div>${cartoes([
    { k: 'Financiado', n: rs(11260), p: '88% é a parcela. Sobe com o preço do caminhão e a taxa; some quando a última parcela é paga.' },
    { k: 'Quitado', n: rs(q.fixo_med), p: `${f0(q.placas)} placas quitadas na Rota, idade mediana ${f0(q.idade_med)} meses: o fixo é só seguro, IPVA e faixa.` },
    { k: 'Leasing', n: rs(5647), p: 'o aluguel entra no lugar da parcela e o IPVA não é pago (está no aluguel).' },
  ], 1)}</div></div>
  ${conc(`O fixo não é "por existir" no sentido de um valor igual para todos: é a devolução das parcelas e dos custos cadastrados da placa. Por isso um caminhão quitado parado quase não recebe nada, e a renovação da frota se planeja pelo fim das parcelas.`)}`);
}

// ativo × parado
{
  const at = R['Total Caminhão Ativo'], pa = R['Total Caminhão Parado'], fa = R['Total por Caminhão Frota Ativa'], fp = R['Total por Caminhão Frota Parada'];
  slide(`${head('O fixo', 'Caminhão parado recebe o fixo. Variável, só o mapa rodado paga.', `${NOME.CBA}, ${M.vig} · ${f0(at)} ativos e ${f0(pa)} parados`)}
  ${cartoes([
    { k: 'Por caminhão ativo', n: rs2(fa), p: 'FINAME + seguro + IPVA + rastreador + faixa. Mais a lavagem e o variável dos mapas.', o: 'Resumo · Total por Caminhão Frota Ativa' },
    { k: 'Por caminhão parado', n: rs2(fp), p: 'As mesmas parcelas. Sem lavagem, sem variável. A média é maior aqui porque as placas paradas de Cuiabá são as mais novas (parcela maior).', o: 'Resumo · Total por Caminhão Frota Parada', acc: true },
    { k: 'Fixo das paradas no mês', n: rs(fp * pa), p: `${f0(pa)} parados × ${rs2(fp)}. Em 2026 (${PER}) o fixo de parado do T2 somou ${rs(X.t2_fixo.fixo_par)}, ${f0(X.t2_frota.parados_mes)} parados por mês.` },
  ])}
  ${cartoes([
    { k: 'Parado não custa na remuneração', n: 'mas não gera', p: 'O caminhão parado continua recebendo o fixo, mas deixa de gerar o variável (R$ ' + f0(varMapa) + ' por mapa) e conta contra o stress test: todo ativo precisa de ao menos uma viagem por mês.' },
    { k: 'Quem decide ativo ou parado', n: 'a unidade', p: 'Na quinzena, no cadastro do FT. Placa ativa que não roda e placa parada que roda são erro de cadastro que mexe no pago e no fixo.' },
    { k: 'Onde acompanhar', n: '2 painéis', p: 'Indisponibilidade (dias parado por placa, previsão de retorno) e Painel KM (frota ativa × viagens por placa).' },
  ])}`);
}

// DRE do mapa
{
  const tot = FA.total_liq_cam, mp = v => v / 25, kmM = R['KM Remunerado'] / 25;
  const comb = R['Combustível R$/KM'] * kmM, man = R['Manutenção Caminhão R$/KM'] * kmM, carr = R['Manutenção Carroceria R$/KM'] * kmM, pn = R['Pneu R$/KM'] * kmM;
  const lucMes = LU.lucro * 2, lucCam = lucMes / FA.ativos, outras = FA.outras_cam - lucCam;
  // cenário didático do realizado: rodou 110 km em vez de 95 (+15%), 3,0 km/L em vez do remunerado, R$ 0,10/L acima, pneu descartado aos 40 mil km, oficina acima do BID
  const kmReal = kmM * 1.15, kmlRem = R['KM Remunerado'] > 0 ? (R['Combustível R$/KM'] ? (M.preco_implicito / R['Combustível R$/KM']) : E.kml) : E.kml, kmlReal = kmlRem - 0.33;
  const precoL = M.preco_implicito, combReal = kmReal / kmlReal * (precoL + 0.10), manReal = R['Manutenção Caminhão R$/KM'] * kmReal * 1.3, carrReal = carr * 1.15, pnReal = R['Pneu R$/KM'] * kmReal + 1953 / 25 * 0.5;
  const linhas = [
    ['Fixo do caminhão', mp(FA.fixo_ativo_cam), mp(FA.fixo_ativo_cam), 'o mesmo, rode ou não rode', true],
    ['Diesel', comb, combReal, `rodou ${f0(kmReal)} km em vez de ${f0(kmM)} · fez ${f2(kmlReal)} km/L em vez de ${f2(kmlRem)} · pagou R$ 0,10/L acima`, true],
    ['Manutenção', man, manReal, 'oficina 30% acima do BID, e no km a mais', true],
    ['Carroceria', carr, carrReal, 'no km a mais', true],
    ['Pneu', pn, pnReal, 'um pneu descartado aos 40 mil km por falta de calibragem (metade de um pneu novo ÷ 25 mapas)', true],
    ['Lavagem', mp(R.Lavagem), mp(R.Lavagem), 'fixa por mês', true],
    ['Equipe de entrega', mp(FA.equipe_cam), mp(FA.equipe_cam), 'remuneração de pessoas: sem realizado por mapa aqui', false],
    ['RV da equipe', mp(FA.rv_cam), mp(FA.rv_cam), 'prêmio variável da equipe', false],
    ['QLP e administrativo', mp(FA.qlp_cam), mp(FA.qlp_cam), 'estrutura da unidade', false],
    ['Outras despesas', mp(outras), mp(outras), 'FAD, incentivo, materiais', false],
    ['Lucro por hectolitro', mp(lucCam), mp(lucCam), `R$ ${f2(LU.rshl)}/HL × volume vendido: a margem não vem do km`, false],
  ];
  const sRem = linhas.reduce((s, l) => s + l[1], 0), sReal = linhas.reduce((s, l) => s + l[2], 0), fRem = linhas.filter(l => l[4]).reduce((s, l) => s + l[1], 0), fReal = linhas.filter(l => l[4]).reduce((s, l) => s + l[2], 0);
  const cel = (a, b) => ({ v: (b - a > 0.5 ? '−' : b - a < -0.5 ? '+' : '') + f0(Math.abs(a - b)), style: `color:${b - a > 0.5 ? ACC : b - a < -0.5 ? VERDE : INK3};font-weight:700` });
  slide(`${head('A DRE do mapa', 'Cada mapa é uma DRE: o que ele recebe, o que ele custa, e três desvios que viram o sinal', `${NOME.CBA}, ${M.vig} · pacote por caminhão ativo ÷ 25 mapas · R$ por mapa · frota em destaque`)}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Linha do mapa' }, { t: 'Remunerado (FT)', n: true }, { t: 'Realizado (cenário)', n: true }, { t: 'Resultado', n: true }, { t: 'O que aconteceu no cenário', w: true }],
    rows: [...linhas.map(l => ({ c: [{ v: (l[4] ? '<b>' + l[0] + '</b>' : l[0]) }, f0(l[1]), f0(l[2]), cel(l[1], l[2]), { v: l[3], cls: l[4] ? '' : 'neutro' }], cls: l[4] ? 'fr' : '' })),
      { c: ['<b>Frota (fixo + variável + lavagem)</b>', f0(fRem), f0(fReal), cel(fRem, fReal), 'o que este treinamento controla'], cls: 'sep' }],
    tot: ['Mapa inteiro', f0(sRem), f0(sReal), cel(sRem, sReal), 'remunerado × realizado'] })}
  <p class="note">Remunerado = pacote líquido por caminhão do Faturamento do FT (${rs2(tot)}) ÷ 25 mapas; a frota usa o R$/km e o km por mapa do Resumo (${f1(kmM)} km). O realizado das linhas de frota é um cenário didático com os preços do caminhão mediano; equipe, QLP, outras e lucro ficam no remunerado (sem realizado por mapa). Se o pacote for pago por mapa rodado, o mapa não rodado perde todas as linhas; se for por caminhão ativo, só o variável. A confirmar com o planejamento.</p>`);
}

// definições
slide(`${head('Vocabulário', 'Quatro termos que aparecem em todo material de remuneração')}
  ${cartoes([
    { k: 'Pago FT', n: 'o que entra', p: 'R$/km do caminhão (premissas do FT) × km remunerado dos mapas rodados, mais o fixo por caminhão ativo e parado. Nos painéis, o km dos mapas vem da nossa Dispersão de km (o FT exporta o dimensionamento, não a fatura do mapa).', o: `${NOME.CBA}, ago/26: ${f0(KE.pago)} km pagos × R$/km` },
    { k: 'Remunerado DRE', n: 'o que o planejamento lançou', p: 'A receita de frota esperada da Ambev, lançada na DRE por conta (combustível, manutenção, pneu…). Deveria ser igual ao pago FT; quando não é, ou a DRE engana ou estamos sendo pagos a menos.' },
    { k: 'Realizado DRE', n: 'o que gastamos', p: 'O custo de verdade, lançado na DRE por conta. É contra o pago FT que ele se compara: pago − realizado = resultado da frota.' },
    { k: 'Teto', n: 'informativo', p: 'R$/km × km da placa × ativos × 25 mapas: o dimensionamento do FT se todos os ativos rodassem todos os dias. Não é meta nem base de comparação.', o: `2026: a rede rodou ${f1(KT.viag_ativo_mes)} mapas por ativo por mês` },
  ])}
  ${conc(`Comparar pago com realizado diz se a frota se paga. Comparar remunerado DRE com pago FT diz se o planejamento está lançando o que o FT paga. O teto só diz quanto o FT dimensionou.`)}`);

// ═══ parte 2 ═══
capaSec(2, 'Onde a operação ganha ou perde', 'As alavancas, com o valor de cada uma, e o que o caminhão parado faz com a conta.');

{
  const L = [
    ['Km acima do pago', `rodar mais km do que o mapa remunera (rota longa, desvio, ida ao posto)`, `R$ ${f0(E.var * 100)} a cada 100 km`, `validar o km legítimo na revisão quinzenal; o resto é roteirização`],
    ['Consumo pior que o previsto', `fazer 0,1 km/L abaixo do Km/L remunerado da placa`, `${f0(litros01 - litros)} L ≈ R$ ${f0((litros01 - litros) * preco)} por caminhão por mês`, `vistoria, perfil de rota, feedback ao motorista (DriverPro)`],
    ['Diesel acima da ANP', `pagar R$ 0,10/L acima do preço que o FT remunera`, `R$ ${f0(litros * 0.1)} por caminhão por mês`, `posto com preço negociado; no tanque interno, compra abaixo do remunerado`],
    ['Manutenção acima do pago', `gastar na oficina mais do que o R$/km de manutenção da placa no FT`, `cada R$ 0,10/km = R$ ${f0(E.km_mes * 0.1)} por caminhão por mês`, `causa raiz por placa e grupo; cotação; conferir a fatura do contrato × BID`],
    ['Pneu que não chega à vida', `trocar ou perder o pneu antes dos ${f0(E.vida_pneu)} km e das 2 recapagens`, `R$ ${f0(E.preco_pneu)} por pneu perdido`, `calibragem, rodízio, alinhamento (Prolog e Ginfo)`],
  ];
  slide(`${head('Onde perdemos dinheiro', 'Cinco alavancas da operação, cada uma com o seu valor', `Caminhão mediano da Rota em 2026: ${f0(E.km_mes)} km/mês, Km/L remunerado ${f2(E.kml)}, R$ ${f2(preco)} por litro com Arla, ${rk(E.var)} de variável`)}
  ${tabela({ cols: [{ t: 'Alavanca' }, { t: 'O que é', w: true }, { t: 'Quanto custa', n: true }, { t: 'O que fazer', w: true }], rows: L.map(([a, b, c, d]) => [{ v: '<b>' + a + '</b>' }, b, { v: '<b>' + c + '</b>' }, d]) })}
  ${concBlocos([
    { t: 'Em 2026', v: `+${f0((CP.lit / CP.lit_esp - 1) * 100)}% de litros`, s: `o consumo da frota T2 ficou ${f0((CP.lit / CP.lit_esp - 1) * 100)}% acima do previsto pelo FT, e o km abastecido ${f0((CP.km / CP['Km Rem. TT'] - 1) * 100)}% acima do km pago. São as duas maiores alavancas.` },
    { t: 'Km a mais tem conserto', v: 'validar', s: 'o km rodado de verdade entra na revisão quinzenal do km da placa. Se o km a mais é legítimo (rota mudou, cliente novo), a unidade tem de registrar e validar na revisão. Km a mais é perda só enquanto não é validado.' },
    { t: 'Onde está', v: '4 painéis', s: 'Painel KM (dispersão), Eficiência Km/L (consumo por placa), Preço R$/L (× ANP), Carta de Custos (manutenção e pneu por placa).' },
  ], 'Leitura')}`);
}

{
  const I = A2.inativas, IU = I.uni;
  slide(`${head('Km que não vira pagamento', 'Km rodado além do mapa e km de placa inativa: o que o FT não paga', `T2, ${PER}`)}
  ${cartoes([
    { k: 'Km pago', n: f1(KT.pago / 1e6) + ' mi km', p: 'mapas rodados × km por mapa, mais recargas e noturnas (Dispersão de km).', o: `${f1(KT.viag_ativo_mes)} mapas por ativo por mês` },
    { k: 'Km rodado acima do pago', n: '+' + f0((KT.rodado / KT.pago - 1) * 100) + '%', p: `${f1((KT.rodado - KT.pago) / 1e3)} mil km (dispersão). Ao R$/km pago: <b>${rs(KT.disp_rs)}</b> de variável que o FT não pagou.`, acc: true },
    { k: 'Km de placa inativa no FT', n: f0(I.km_pct_abast) + '% do km', p: `${f0(I.placas)} placas marcadas como inativas no FT abasteceram ${f1(I.km / 1e6)} mi km. Elas não geram variável nem lavagem: ou a ficha está errada, ou o mapa foi rodado por quem não devia.`, acc: true },
    { k: 'Validar na quinzena', n: '2× por mês', p: 'O km legítimo a mais e a lista de ativos certa entram na revisão quinzenal. Depois dela, viram remuneração; antes, são dispersão.' },
  ])}
  ${tabela({ classe: 'mini', cols: [{ t: 'Unidade' }, ...Object.keys(A2.km_uni).map(u => ({ t: NOME[u] || u, n: true }))],
    rows: [['Km rodado acima do pago', ...Object.values(A2.km_uni).map(x => pct(x.disp_km / x.pago * 100, 0))], ['R$ da dispersão (mil)', ...Object.values(A2.km_uni).map(x => f0(x.disp_rs / 1e3))], ['Placas inativas que rodaram', ...Object.keys(A2.km_uni).map(u => IU[u] ? f0(IU[u].placas) : '0')], ['Km delas (mil)', ...Object.keys(A2.km_uni).map(u => IU[u] ? f0(IU[u].km / 1e3) : '0')]] })}
  ${conc(`Dois cadastros decidem o que vira pagamento: o km da placa na revisão quinzenal e a lista de ativos. Rodar mais que o mapa custa ${rk(E.var)}; placa inativa rodando não gera variável e ainda recebe o fixo de parado sem lavagem. As duas correções são da unidade e cabem na quinzena.`)}`);
}

// ═══ parte 3 ═══
capaSec(3, 'Empurrada', 'Na Empurrada a remuneração é por trecho, e a lógica do R$/km é a mesma.');
{
  const TT = O.trecho, us = ['PIR', 'MCC', 'CBA'].filter(u => TT[u]), P1 = TT.PIR;
  const fr = u => TT[u].diesel + TT[u].manut_cav + TT[u].manut_carr + TT[u].pneu + TT[u].lav;
  slide(`${head('Empurrada (T1)', 'Cada trecho tem o seu R$ por viagem; o R$/km de frota é diesel, manutenção, pneu e lavagem', 'Média ponderada pela previsão de km dos trechos ativos, 2026')}
  <div class="duas"><div>${ponte({ w: 640, h: 230, itens: [{ rot: 'Diesel', v: P1.diesel }, { rot: 'Manut.\ncavalo', v: P1.manut_cav }, { rot: 'Manut.\ncarreta', v: P1.manut_carr }, { rot: 'Pneu', v: P1.pneu }, { rot: 'Lavagem', v: P1.lav }, { rot: 'R$/km de\nfrota · Piraí', v: fr('PIR'), tot: true }], fmt: v => f2(v), corPos: AZUL })}</div>
  <div>${tabela({ classe: 'compacta', cols: [{ t: 'R$/km do trecho' }, ...us.map(u => ({ t: NOME[u], n: true }))], rows: [['Diesel', ...us.map(u => f2(TT[u].diesel))], ['Manutenção do cavalo', ...us.map(u => f2(TT[u].manut_cav))], ['Manutenção da carreta', ...us.map(u => f2(TT[u].manut_carr))], ['Pneu', ...us.map(u => f2(TT[u].pneu))], ['Lavagem', ...us.map(u => f2(TT[u].lav))]], tot: ['R$/km de frota', ...us.map(u => f2(fr(u)))] })}
  ${tabela({ classe: 'compacta', style: 'margin-top:8px', cols: [{ t: '' }, ...us.map(u => ({ t: NOME[u], n: true }))], rows: [['Km/L do trecho', ...us.map(u => f2(TT[u].kml))], ['Diesel no R$/km de frota', ...us.map(u => f0(TT[u].diesel / fr(u) * 100) + '%')]] })}</div></div>
  ${conc(`Na Empurrada o frete é por viagem de cada trecho: km de ida e volta × R$/km. O diesel é ${f0(P1.diesel / fr('PIR') * 100)}% do R$/km de frota em Piraí, e sai do preço pago (+ 5% do Arla) ÷ Km/L do trecho (${f2(P1.kml)}). O fixo é por cavalo e carreta, ativo ou parado. Salário variável e lucro variável também estão no frete, mas são equipe e margem, não frota.`)}`);
}

// ═══ parte 4 ═══
capaSec(4, 'A rotina do gestor', 'O que olhar por frequência, o que fazer quando estoura, e o calendário do FT.');
slide(`${head('A rotina por frequência', 'O que olhar todo dia, toda semana, toda quinzena, todo mês e todo trimestre')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Quando' }, { t: 'O que olhar', w: true }, { t: 'Por quê', w: true }, { t: 'Onde' }], rows: [
    [{ v: '<b>Diário</b>' }, 'frota ativa × mapas do dia; placas paradas e previsão de retorno; abastecimentos do dia e preço × ANP', 'ativo sem mapa não paga e fere o stress test; preço acima da ANP é nosso', 'Painel KM · Indisponibilidade · Preço R$/L'],
    [{ v: '<b>Semanal</b>' }, 'dispersão de km por placa (meta 5%); Km/L real × remunerado por placa, com as piores; OS abertas e preventivas vencidas; calibragem e milimetragem', 'km a mais e consumo pior são as duas maiores alavancas; pneu descalibrado não chega à vida', 'Painel KM · Eficiência Km/L · Gestão à Vista · Pneus'],
    [{ v: '<b>Quinzenal</b>' }, 'o ciclo do FT: conferir o km da placa e o preço do diesel que entraram na revisão; validar km legítimo a mais; ativar e inativar as placas certas; conferir ativas com consumo zero', 'é a revisão que transforma km em remuneração; a ficha errada paga errado', 'FT (Caminhão, Combustível) · Painel KM'],
    [{ v: '<b>Mensal</b>' }, 'FCA de custos com causa e ação; DRE de frota × pago FT por conta; pneus descartados antes da vida; fatura do contrato × BID', 'o desvio do mês tem dono e ação; a fatura acima do BID é nossa', 'FCA · Carta de Custos · Pneus'],
    [{ v: '<b>Trimestral</b>' }, 'a revisão do Km/L: preparar a crítica do consumo validado com o Km/L real por placa, modelos iguais com valores diferentes, placas novas sem histórico', 'o Km/L é 66% do variável e fica congelado três meses', 'Eficiência Km/L · FT (Caminhão)'],
  ] })}
  ${conc(`A quinzena é a rotina que mais vale dinheiro: é nela que o km, o preço e a lista de ativos viram remuneração. A trimestral é a que mais pesa: o Km/L validado decide dois terços do variável até a próxima revisão.`)}`);

slide(`${head('A rotina por alavanca', 'Indicador, régua, onde olhar e o que fazer quando estoura', 'Valores do caminhão mediano da Rota em 2026')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Alavanca' }, { t: 'Indicador' }, { t: 'Régua', n: true }, { t: 'Onde' }, { t: 'O que fazer quando estoura', w: true }], rows: [
    [{ v: '<b>Km</b>' }, 'km rodado ÷ km pago (dispersão)', '≤ 5%', 'Painel KM', 'validar o km legítimo na quinzena; roteirização; viagens que não remuneram; placa de contrato fixo nas rotas longas'],
    [{ v: '<b>Consumo</b>' }, 'Km/L real × remunerado, por placa', `≥ ${f2(E.kml)} (a placa)`, 'Eficiência Km/L', 'vistoriar as piores placas (vazamento, injeção, filtro, pneu murcho, motor ligado parado); perfil de rota; feedback DriverPro'],
    [{ v: '<b>Preço</b>' }, 'R$/L pago × ANP', '≤ ANP', 'Preço R$/L', 'posto com preço negociado; cobrar o posto que cobrou acima; tanque interno abaixo do remunerado'],
    [{ v: '<b>Manutenção</b>' }, 'R$/km gasto × R$/km pago (BID)', `≤ ${rk(E.manut)}`, 'Carta de Custos', 'causa raiz por grupo e placa; cotação; conferir fatura do contrato × BID; preventivas em dia'],
    [{ v: '<b>Pneu</b>' }, 'vida em km e recapagens; calibragem', `${f0(E.vida_pneu)} km · 2 recapes · ±10%`, 'Pneus · Prolog', 'calibragem e rodízio; alinhamento vencido; comprar abaixo da tabela do FT'],
    [{ v: '<b>Frota</b>' }, 'ativos × mapas; parados sem motivo', 'parados = 0 sem motivo', 'Indisponibilidade', 'ativar e inativar na quinzena; previsão de retorno; stress test (1 viagem por mês por ativo)'],
  ] })}
  ${conc(`Toda alavanca tem um número do FT como régua. A ação boa é a que fecha a distância entre o real e essa régua, placa a placa; a ação ruim é a que trata a média da unidade.`)}`);

slide(`${head('O calendário do FT', 'O que a unidade manda ou valida, quando, e o que acontece se não mandar')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Quando' }, { t: 'O que' }, { t: 'Quem' }, { t: 'Se não fizer', w: true }], rows: [
    [{ v: '<b>Toda quinzena</b>' }, 'NF do diesel (o nosso preço); km da placa validado; lista de placas ativas e paradas; ativas com consumo', 'unidade + planejamento', 'preço fica no valor anterior; km a mais vira dispersão para sempre; placa ativa sem mapa fere o stress test; inativa que roda não gera variável'],
    [{ v: '<b>Todo trimestre</b>', }, 'crítica do consumo validado (Km/L por placa) antes da 1ª quinzena de jan, abr, jul e out', 'unidade + corporativo', 'o Km/L fica três meses errado; em out/26 a revisão não aconteceu e o Q4 roda com o Q3'],
    [{ v: '<b>Todo mês</b>' }, 'FCA de custos; fatura do contrato × BID; pneus descartados', 'unidade', 'desvio sem causa e sem ação; fatura acima do BID sem cobrança'],
    [{ v: '<b>Na entrada de placa</b>' }, 'ficha completa: modelo, ano, financiamento, carroceria, pneu, contrato', 'corporativo', 'placa nova com Km/L do benchmark e sem contrato: paga errado até a próxima revisão'],
    [{ v: '<b>Na saída de placa</b>' }, 'inativar no FT e na Dispersão', 'unidade', 'placa fantasma recebe fixo de parado; se roda, não recebe variável'],
  ] })}
  ${conc(`O FT paga pelo cadastro e pela revisão. O que a unidade não manda na quinzena não entra; o que não critica no trimestre fica três meses. O calendário é a lista do que mandar, não uma sugestão.`)}`);

// fechamento
slide(`${head('Para levar', 'O que lembrar, com o número e a ação')}
  ${cartoes([
    { k: '1 · O mapa é a unidade', n: 'R$ ' + f0(varMapa) + '/mapa', p: 'Mapa rodado paga km por mapa × R$/km. Mapa não rodado não paga; km além do mapa também não.', o: 'Ação: ativos certos, viagens certas, km validado.' },
    { k: '2 · Km a mais custa', n: 'R$ ' + f0(E.var * 100) + '/100 km', p: `${rs(KT.disp_rs)} de dispersão em 2026. Só vira remuneração se for validado na quinzena.`, o: 'Ação: validar o km legítimo; roteirizar o resto.' },
    { k: '3 · Diesel decide', n: f0(E.comb / E.var * 100) + '% do variável', p: `0,1 km/L abaixo do remunerado = R$ ${f0((litros01 - litros) * preco)} por caminhão por mês; R$ 0,10/L acima da ANP = R$ ${f0(litros * 0.1)}.`, o: 'Ação: piores placas, posto, DriverPro, crítica trimestral.' },
    { k: '4 · Manutenção paga o BID', n: rk(E.manut), p: 'Contrato acima do BID recebe o BID; fatura acima é nossa. Placa quitada parada quase não recebe fixo.', o: 'Ação: causa raiz por placa; fatura × BID; renovação pelo fim das parcelas.' },
  ])}
  ${concBlocos([
    { t: 'O que muda na sua semana', s: 'segunda: dispersão e Km/L por placa com as piores; quarta: paradas e previsão de retorno; sexta: OS, preventivas e calibragem. Na quinzena, a lista de ativos e o km validado. No fechamento, o FCA com causa e ação.' },
    { t: 'Onde tirar dúvida', s: 'Manual Freightech de frota (fórmula e origem de cada custo), Painel KM, Eficiência Km/L, Preço R$/L, Carta de Custos, Pneus, Indisponibilidade e FCA, no portal Gestão em Movimento.' },
  ], 'A partir de amanhã', 2)}`);

console.log('ok', write(process.env.FT_HTML || 'treinamento.html'), 'slides');

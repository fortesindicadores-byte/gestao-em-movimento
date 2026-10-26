// ============================================================
// "Book do Operador Frota" — as regras de remuneração de frota do Book do
// Operador do Freightech (Central de Ajuda do FT, 66 registros), organizadas
// para a Conlog. Renan, 26/10/2026: "tem todas as regras de tudo… deve ter
// mais um pdf chamado 'Book do Operador Frota'".
// As regras são citadas em prosa a partir do texto do Book (registro e data
// de atualização em cada slide); os números (inventário, dimensionamento
// oficial × ativos do FT) saem de book.json (book.py).
//   BOOK=book.json FT_HTML=book.html node deck-book.mjs
// O HTML e o PDF NÃO vão para o repositório (regras contratuais da Ambev).
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, cartoes, tabela, fx, f0, f1, f2, NOME, lista, INK2, INK3 } from './deck-base.mjs';
const B = JSON.parse(readFileSync(process.env.BOOK || 'book.json', 'utf8'));
const { slide, capa, capaSec, conc, concBlocos, didat, write } = deck({ rodape: 'Remuneração Freightech · Book do Operador Frota · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Book do Operador Frota' });
const head = (k, h, sub = '') => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const R = Object.fromEntries(B.regras.map(r => [r.t, r]));
const fonte = (...ts) => `<p class="note">Fonte: Book do Operador do Freightech · ${ts.map(t => `${t}${R[t] ? ' (atualizado ' + R[t].atual.split('-').reverse().join('/') + ')' : ''}`).join(' · ')}</p>`;
const I = B.inv;

// ═══ capa ═══
capa('As regras da Ambev, do próprio FT', 'Book do Operador Frota: o que a Ambev paga, como calcula e o que desconta, segundo o Book do Operador do Freightech',
  `O Book do Operador é a Central de Ajuda do Freightech: ${B.n} registros em ${Object.keys(I.categorias).length} categorias, com ${f0(I.anexos)} anexos, que descrevem o modelo de negócio assinado em contrato entre a Ambev e os operadores. Este material reúne as regras de frota (Equipamentos, Lucro e Geral) na ordem em que o dinheiro acontece: cadastro, fixo, variável, descontos, fechamento.`);

// ═══ o que é ═══
slide(`${head('O que é o Book', 'Um manual contratual: "todas as orientações estão vinculadas a contrato e à obrigatoriedade de execução por ambas as partes"')}
  ${cartoes([
    { k: 'Planilha Aberta', n: 'preço, não reembolso', p: 'O modelo define uma remuneração Base Zero (com lucro) por item: caminhão, empilhadeira, pneu, diesel, manutenção e indiretos, com preços negociados pelo RPO com o segundo layer de fornecedores. O que não está no padrão não é pago sem autorização prévia do RPO.', o: 'Modelo de precificação' },
    { k: 'A ferramenta é o FT', n: 'o preço é o que está no sistema', p: '"O preço da operação será sempre o que estiver inserido no sistema", seguindo ANS e fluxos de alteração. Chamado é o caminho oficial de qualquer mudança de cadastro.', o: 'Book do operador · 1. Introdução' },
    { k: 'Quatro seções', n: 'Gerais · Gente · Equipamentos · Lucro', p: 'Cada canal (Rota e AS no T2, Empurrada e Insumos no T1, Apoio) tem contrato próprio, com unidades, prazos de pagamento, regime e regras de rescisão.', o: 'Book do operador' },
    { k: 'No banco', n: `${B.n} registros`, p: `${f0(I.blocos)} blocos de texto, ${f0(I.imagens)} imagens embutidas e ${f0(I.anexos)} anexos (${f0(I.mb)} MB) em ft_book / ft_book_anexo, com o texto extraído para busca e IA. Atualizações de ${I.mais_antigo.slice(0, 4)} a ${I.mais_novo.split('-').reverse().join('/')}.`, acc: true },
  ])}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Categoria' }, { t: 'Registros', n: true }, { t: 'De que trata', w: true }], rows: [
    ['Equipamentos', f0(I.categorias.Equipamentos), 'manutenção, preço e consumo de combustível, custo fixo, pneu, ativação, inclusão e remoção, movimentação, CIVF, stress test, disponibilidade, empilhadeiras'],
    ['Gente', f0(I.categorias.Gente), 'equipe de entrega, QLP ADM, encargos, benefícios, uniformes, plano de saúde, noturna, descontos de QLP e de motoristas'],
    ['Lucro', f0(I.categorias.Lucro), 'lucro da Distribuição (R$/HL), do T1 e do Armazém'],
    ['Geral', f0(I.categorias.Geral), 'dimensionamento oficial por quinzena, fechamentos, recarga, outros custos, custos pré-operacionais, workflow de chamados, PGR'],
    ['Outras', f0(B.n - I.categorias.Equipamentos - I.categorias.Gente - I.categorias.Lucro - I.categorias.Geral), 'menus e funcionalidades do sistema, outros custos (OCs), vale pedágio, histórico, estoques, chamados'],
  ] })}
  ${conc('As regras de frota são 16 registros de Equipamentos, 3 de Lucro e os de Geral que mexem no pagamento (dimensionamento, fechamento, recarga, outros custos). O resto do Book é Gente e o uso do sistema.', 'Onde está o que importa')}`);

// ═══ Parte 1 · O caminhão no FT ═══
capaSec(1, 'O caminhão no FT', 'Inclusão, ativação, movimentação e remoção: o cadastro que decide tudo.');
slide(`${head('Inclusão de equipamento', 'A ficha da placa entra por chamado, com NF, CRLV e carta de compra do BID')}
  ${cartoes([
    { k: 'O que a unidade informa', n: '11 campos', p: 'Placa (com CRLV digital), odômetro real de entrada, carência de manutenção em meses (negociada com a montadora), data de entrada, montadora/modelo/câmbio iguais à NF e à carta de compra, valor da NF mais o frete, % de entrada, período e taxas do FINAME, ICMS e PIS/COFINS, IPVA mais licenciamento, ano do BID.' },
    { k: 'Anexos', n: 'NF + CRLV', p: 'Obrigatórios: a NF do equipamento (duas, para cavalo e carroceria; duas de carreta no bitrem) e o CRLV-e. Complementares: carta de compra do BID e validação do RPO para o que foge à regra.' },
    { k: 'Compra fora do BID', n: 'só com o RPO', p: 'Modelo não previsto no BID entra com validação prévia do RPO anexada ao chamado. Qualquer valor diferente do BID (juros, carência, NF) exige comprovação.' },
    { k: 'Telemetria', n: 'em até 1 dia útil', p: 'Com o chassi em mãos: ok do corporativo de transportes (2 dias úteis), ticket na Veltec (T2) ou Argus (T1) para instalar; depois do emplacamento, ajuste placa × chassi em 1 dia útil.' },
  ])}
  ${didat('Tudo o que o FT paga sai dessa ficha: o FINAME da taxa e do prazo cadastrados, o seguro do valor da NF, o IPVA do valor informado, a carência da manutenção do que foi negociado com a montadora, o Km/L do benchmark até a primeira revisão. Ficha errada paga errado até alguém abrir chamado.', 'Por que importa')}
  ${fonte('INCLUSÃO E REMOÇÃO DE EQUIPAMENTOS')}`);

slide(`${head('Ativação, desativação e movimentação', 'Ativar com 30 dias de aviso, desativar com 10; transferir antes da virada da quinzena')}
  ${cartoes([
    { k: 'Ativação de frota', n: '30 dias', p: 'O operador é comunicado com 30 dias de antecedência, com ajustes até 15 dias antes, limitados a 5% (ou uma frota). Durante a integração não há custo ao operador.' },
    { k: 'Desativação', n: '10 dias', p: 'Comunicada 10 dias antes do início da próxima vigência; 30 dias se a equipe for colocada em férias. As mudanças seguem o dimensionamento mensal do tático; divergência se discute antes do fechamento da quinzena. Não há retroativo por descumprimento de processo.' },
    { k: 'Movimentação (Rota e AS)', n: 'dia 02 e dia 17', p: 'Transferência entre unidades ou canais (entre operadores = aluguel) só dentro da quinzena vigente, antes do fechamento do fixo: pedido até o dia 02 vale na 1ª quinzena; até o dia 17, na 2ª. E-mail "Movimentação de Frota + TP" com a planilha padrão.' },
    { k: 'Empurrada e Insumos', n: 'dia 30', p: 'Sem transferência na 2ª quinzena (o fixo fecha no dia 17); pedido até o dia 30 do mês anterior vale na 1ª quinzena. Armazém: até o dia 30, para o mês seguinte.', acc: true },
  ])}
  ${didat('A lista de ativos é o que a unidade controla a cada quinzena. Placa ativa sem mapa fere o stress test; placa inativa que roda não gera variável. O Book fixa as datas: fora delas a movimentação fica para a vigência seguinte.', 'O que isso quer dizer')}
  ${fonte('ATIVAÇÃO E DESATIVAÇÃO FROTA', 'MOVIMENTAÇÃO DE FROTAS')}`);

slide(`${head('Remoção de equipamento', 'Apta a sair: mais de 1.000.000 km ou mais de 5 anos em planilha; o processo começa dois meses antes')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Quando' }, { t: 'O que' }, { t: 'Dono' }], rows: [
    ['Dia 20 do M-2', 'levantamento dos equipamentos a retirar', 'Campo'], ['Dia 25 do M-2', 'definição e envio ao RPO', 'Tático Transportes'], ['Dia 30 do M-2', 'comunicação aos transportadores', 'RPO'], ['Dia 09 do M-0', 'retirada do Freightech', 'RPO'],
  ] })}
  ${cartoes([
    { k: 'Chamado de exclusão', n: 'ok do RPO', p: 'Exclusão (desmobilização) por chamado do operador, com aprovação do especialista de equipamentos do RPO; sinistro exige B.O., documento da seguradora de perda total e ok do RPO.' },
    { k: 'Rastreador', n: '30 dias', p: 'Depois de sair do FT, o ticket de desinstalação na Veltec/Argus precisa acontecer em 30 dias; senão o aluguel do rastreador é descontado do transportador.' },
    { k: 'Desmobilização em massa', n: 'planilha', p: 'E-mail "Desmobilização de Frota – TP" com a aba Desmobilização do template.' },
  ], 3)}
  ${fonte('INCLUSÃO E REMOÇÃO DE EQUIPAMENTOS', 'MOVIMENTAÇÃO DE FROTAS')}`);

// ═══ Parte 2 · Custo fixo ═══
capaSec(2, 'Custo fixo', 'O que o caminhão recebe por existir: financiamento, seguro, IPVA, rastreador, faixa, tacógrafo e revestimento.');
slide(`${head('Custo fixo de equipamentos', 'Cada item tem uma regra e um índice de reajuste; o reajuste é em julho')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Item' }, { t: 'Regra no T2 (Rota e AS)', w: true }, { t: 'No T1 (Empurrada, Insumos)', w: true }, { t: 'Reajuste' }], rows: [
    [{ v: '<b>Financiamento</b>' }, 'conforme a negociação com o banco: NF financiada, taxa, prazo e carência, nos modelos CDC ou FINAME', 'idem', 'da carta de compra'],
    [{ v: '<b>Seguro</b>' }, 'seguro contra terceiros (anual, em parcelas mensais) + risco da operação de 0,8% sobre a NF do cavalo e da carroceria', '2% sobre a NF do cavalo e da carreta, cobrindo terceiros e risco', 'IPCA ou negociado, em julho'],
    [{ v: '<b>IPVA + licenciamento</b>' }, 'repasse mensal do valor informado na inclusão e reajustado em julho; diferença dos 6 primeiros meses acertada no 2º semestre', 'idem', 'julho'],
    [{ v: '<b>Rastreador</b>' }, 'custo mensal negociado pelo RPO <b>para as operações em que esse custo for aprovado</b>', 'idem', 'IPCA ou negociado, em julho'],
    [{ v: '<b>Faixa refletiva</b>' }, 'valor com duração de 5 anos, em parcelas mensais', 'idem', 'IPCA ou negociado, em julho'],
    [{ v: '<b>Tacógrafo</b>' }, 'não remunerado', 'custo com troca a cada 2 anos', 'IPCA, em julho'],
    [{ v: '<b>Revestimento</b>' }, 'não remunerado', 'manutenção do revestimento da carreta a cada ano, mensal', 'IPCA, em julho'],
    [{ v: '<b>Lucro fixo</b>' }, 'na seção Lucro', '% sobre a NF do equipamento', ''],
  ] })}
  ${concBlocos([
    { t: 'Rastreador só onde aprovado', v: 'é regra', s: 'o Book paga rastreador "nas operações em que seja aprovado este custo". É por isso que só as unidades do Rio recebem: não é cadastro, é aprovação do RPO por operação.' },
    { t: 'Seguro', v: '0,8% da NF', s: 'no T2 o risco da operação é 0,8% sobre a NF, mais o seguro contra terceiros. O FT exporta os dois somados no campo Seguro.' },
    { t: 'Julho', v: 'mês do reajuste', s: 'faixa, seguro, IPVA, rastreador, tacógrafo e revestimento reajustam em julho, pelo IPCA ou pelo valor negociado pelo RPO.' },
  ])}
  ${fonte('CUSTO FIXO DE EQUIPAMENTOS')}`);

// ═══ Parte 3 · Variável ═══
capaSec(3, 'Custo variável', 'Combustível (preço e consumo), manutenção e pneu: as regras que viram R$/km.');
slide(`${head('Preço do diesel', 'O FT paga o menor entre o nosso preço e a ANP no posto comum; no tanque interno e no cartão, paga o nosso preço')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Iniciativa' }, { t: 'Como compramos', w: true }, { t: 'O que o FT paga' }, { t: 'Quem atualiza e quando', w: true }], rows: [
    [{ v: '<b>Tradicional (posto comum)</b>' }, 'direto nos postos da região', 'menor entre o preço operadora (R$/L ponderado das NFs) e a ANP', 'transportadora abre chamado com as NFs: dias 01–15 valem na 2ª quinzena; 16–31, na 1ª do mês seguinte'],
    [{ v: '<b>Cartão de abastecimento</b>' }, 'solução de pagamento homologada negocia com as redes', 'preço operadora (o ponderado da quinzena)', 'a solução manda o preço à Ambev; atualizado até o dia 10 (1ª) e o dia 24 (2ª)'],
    [{ v: '<b>Tanque interno</b>' }, 'direto do distribuidor, tanque na unidade Ambev', 'preço operadora (R$/L real de todas as NFs do período)', 'o distribuidor manda as NFs à Ambev; a Célula de Custos atualiza'],
    [{ v: '<b>Tanque externo</b>' }, 'direto do distribuidor, tanque em terreno do operador', 'menor entre operadora e ANP', 'chamado do operador, mesmos prazos do tradicional'],
  ] })}
  ${cartoes([
    { k: 'ANP', n: 'média de 2 semanas', p: 'Os dois últimos relatórios da ANP antes da quinzena, do município da unidade ou o mais próximo. Atualizada pela Célula de Custos até o dia 4 (1ª quinzena) e o dia 22 (2ª).' },
    { k: 'Validação da NF', n: '10 dias · 50 km · 30 dias', p: 'Litragem compatível com pelo menos 10 dias de operação; abastecimento na cidade ou até 50 km; NF com até 30 dias. Diesel e Arla em chamados separados, com a média ponderada de cada um.' },
    { k: 'Penalidade', n: '90% da ANP', p: 'Sem NF por 45 dias seguidos (3 quinzenas), o preço operadora vira 90% da ANP, com aviso de 72 h. Romper a intermediação do cartão tem a mesma pena.', acc: true },
  ], 3)}
  ${fonte('PREÇO COMBUSTÍVEIS')}`);

slide(`${head('Consumo (Km/L)', 'Desde 2022 a Ambev remunera o consumo real, lido na telemetria ou na solução de pagamento, atualizado por trimestre')}
  ${cartoes([
    { k: 'De onde vem', n: 'telemetria ou cartão', p: 'Caminhão do BID 2019 em diante tem telemetria obrigatória (o pacote é pago dentro da manutenção). Antes de 2019, solução de pagamento (Gasola, Ticket, Alelo). Sem leitura, cai nos clusters de benchmark.' },
    { k: 'O cálculo', n: 'por dia, sem outliers', p: 'Km e litros somados por dia e por placa; consumo abaixo de 0,1 ou acima de 20 km/L sai; placa com 4 dias ou menos de leitura sai. Média = Σkm ÷ Σlitros; 3º quartil quando a regra pede.' },
    { k: 'Os clusters', n: '1 a 8', p: '1: média do modelo na unidade · 2: média marca-perfil na unidade · 3: 3º quartil do modelo na transportadora · 4: marca-perfil na transportadora · 5: modelo na regional · 6: marca-perfil na regional · 7: modelo no Brasil · 8: marca-perfil no Brasil · senão, benchmark do FT.' },
    { k: 'Quando muda', n: 'trimestral', p: 'As leituras do trimestre anterior entram no trimestre vigente. Modelo novo roda no benchmark com deflatores até a virada do trimestre. Vans: 7,8 km/L fixo. Placa com telemetria obrigatória e não contratada: desconto de indisponibilidade e fora da média da unidade.', acc: true },
  ])}
  ${didat('O cluster 1 é a média do próprio modelo na própria unidade: é a nossa frota que define a régua. A partir do cluster 5 entram dados de outras transportadoras, e o Book avisa que aí o operador não consegue reproduzir o número. Cadastro errado de placa, chassi, unidade, perfil, montadora ou modelo muda o cluster e o Km/L pago.', 'O que isso quer dizer')}
  ${fonte('CONSUMO DE COMBUSTÍVEIS', 'CONSUMO')}`);

slide(`${head('Manutenção', 'Carência paga zero; com contrato, o menor entre contrato e BID; sem contrato, o BID com 10% de desconto')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Situação da placa' }, { t: 'O que o FT paga por km', w: true }], rows: [
    [{ v: '<b>Em carência</b>' }, 'zero. A carência é a cadastrada na inclusão (em meses, negociada com a montadora).'],
    [{ v: '<b>Com contrato, compra fora do BID autorizada</b>' }, 'o R$/km do contrato.'],
    [{ v: '<b>Com contrato, dentro do BID</b>' }, 'o menor entre o R$/km do contrato e o do BID, na faixa de km em que a placa está.'],
    [{ v: '<b>Sem contrato, BID 2019 ou depois</b>' }, 'o R$/km do BID com 10% de desconto.'],
    [{ v: '<b>Sem contrato, antes do BID 2019</b>' }, 'o R$/km do BID (sem obrigação de contrato).'],
  ] })}
  ${cartoes([
    { k: 'Reajuste', n: 'IGP-M, em julho', p: 'A manutenção é reajustada anualmente pelo IGP-M ou pelo valor negociado pelo RPO com as montadoras, no mês de julho.' },
    { k: 'Faixas de km', n: 'por odômetro previsto', p: 'O contrato é cadastrado por placa com o R$/km de cada faixa; a faixa vem do km previsto do odômetro. Valores líquidos, sem PIS/COFINS, no T2.' },
    { k: 'Carroceria', n: 'R$/ano ÷ 12 ÷ km', p: 'Tabela por material, perfil e tipo da carroceria; vira R$/km pelo km total do mês da placa.' },
    { k: 'Contrato × BID', n: 'o BID é o teto', p: 'Contrato acima do BID recebe o BID. O chamado de inclusão do contrato é por placa, com o contrato operador-montadora anexado.', acc: true },
  ])}
  ${fonte('MANUTENÇÃO')}`);

slide(`${head('Pneu', 'R$/km = custo do ciclo (compra + recapagens) ÷ vida útil em km, por medida e quantidade do equipamento')}
  ${cartoes([
    { k: 'A conta', n: 'linearização', p: 'O custo do ciclo do jogo de pneus (direcionais e tração comprados mais as recapagens) é dividido pela vida útil em km do ciclo. É um R$/km por placa.' },
    { k: 'As categorias', n: '4', p: 'Direcional (eixos direcionais, sentido de rodagem marcado), tração, empilhadeira e recapagem (substituição da banda de rodagem).' },
    { k: 'Carretas de 30 pallets', n: 'ponderação', p: 'No T1 as carretas de 30 pallets (16 direcionais) entram no grupo das simples (28 pallets, 12 direcionais) e a quantidade e o valor são ponderados pelas carretas ativas de cada tipo.' },
    { k: 'O que o FT não cobre', n: 'o que foge do ciclo', p: 'Pneu perdido antes da vida, recapagem a mais, troca por avaria: o FT paga o ciclo previsto; o resto é nosso.', acc: true },
  ])}
  ${fonte('PNEU')}`);

// ═══ Parte 4 · Descontos ═══
capaSec(4, 'Descontos', 'Stress test, CIVF e disponibilidade: o que a Ambev tira quando a frota não cumpre a regra.');
slide(`${head('Stress test de veículos', 'Todo ativo precisa de ao menos uma viagem por mês, na unidade onde está cadastrado; três meses sem viagem tiram a placa do FT')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Check' }, { t: 'Se falha', w: true }], rows: [
    [{ v: '<b>1 · A placa tem ao menos uma viagem no mês?</b>' }, 'desconta-se o custo fixo e o lucro fixo do equipamento.'],
    [{ v: '<b>2 · As viagens saem da unidade em que a placa está no FT?</b>' }, 'se repetir por dois meses seguidos, desconta-se custo e lucro fixo.'],
    [{ v: '<b>3 · Sem viagem no mês, teve viagem nos últimos 3 meses?</b>' }, 'sem viagem por três meses seguidos: a placa sai do FT e desconta-se 80% da FIPE (ou o valor do seguro casco na perda total), abatida a entrada corrigida pela Selic. O operador pode propor a substituição do ativo, a critério do RPO.'],
    [{ v: '<b>4 · Sinistro</b>' }, 'roubo: ok; perda total sem remoção ou substituição com ok do RPO: NOK; acidente: 45 dias para ajuste.'],
  ] })}
  ${cartoes([
    { k: 'Calendário', n: 'dia 02 · 7 dias · dia 15', p: 'Ambev sobe os arquivos no 2º dia do mês seguinte; o operador tem 7 dias para justificar; a Ambev trata em 3 dias e sobe o desconto até o dia 15.' },
    { k: 'Base do desconto', n: 'custo fixo', p: 'Todo veículo remunerado tem um custo fixo no FT; é essa base que o desconto usa. O acompanhamento e as justificativas ficam no G-Info e no Power BI.' },
    { k: 'Empilhadeiras', n: '24 h por quinzena', p: 'Rodagem mínima de 24 h por quinzena, 3 checklists por quinzena, coleta de horímetro semanal pela liderança; desconto de meio custo fixo do mês por quinzena, dobrado no desvio de conduta e no 3º mês.' },
  ], 3)}
  ${fonte('STRESS TEST VEICULOS', 'STRESS TEST EMPILHADEIRAS')}`);

slide(`${head('CIVF e disponibilidade do armazém', 'Fotos até o dia 20; sem foto, foto fora do padrão ou anomalia não tratada vira desconto, e o desconto quadruplica se repetir')}
  ${cartoes([
    { k: 'CIVF · o processo', n: '6 fotos por placa', p: 'Registro no app do Ginfo até o dia 20 de cada mês, de dia, com a base de placas da 2ª quinzena do mês anterior. A avaliação é centralizada (Demarco), por cluster de frota (BID 2016–2025, vans, BID 2020–22, 2019–20, mais antigas, AS).' },
    { k: 'CIVF · o desconto', n: '×2, depois ×4', p: 'Manutenção: km rodado × valor de manutenção × 2 (AS, Rota e vans). Lavagem: km × valor × 2 no AS; valor × 2 na Rota e nas vans. Retirado no FT na 2ª vigência anterior ao mês; se a anomalia persiste, 4× o desconto anterior.' },
    { k: 'CIVF · contestação', n: '2 dias úteis', p: 'Depois do fim das avaliações. Documentos aceitos: B.O. e comunicado de sinistro (roubo e acidente), OS, orçamento e fotos (manutenção), e-mail da Ambev (acordo).' },
    { k: 'Armazém', n: 'meta 95,6% ou 100%', p: 'Disponibilidade = empilhadeiras disponíveis ÷ ativas, por turno, ponderada pelas ativas. Meta 95,6% sem backup (24 h de manutenção em 546 h) e 100% com backup. Abaixo da meta, desconto proporcional sobre o custo fixo do mês.' },
  ])}
  ${fonte('CIVF - CONSERVAÇÃO DA IDENTIDADE VISUAL DA FROTA', 'DISPONIBILIDADE - ARMAZÉM')}`);

// ═══ Parte 5 · Lucro e dimensionamento ═══
capaSec(5, 'Lucro, dimensionamento e fechamento', 'Como o lucro é pago, de onde vem a frota dimensionada e o calendário de cada mês.');
slide(`${head('Lucro', 'No T2 o lucro é R$/HL × volume entregue, por quinzena; o fator é reajustado pela performance contra o IPCA')}
  ${cartoes([
    { k: 'Distribuição (Rota e AS)', n: 'R$/HL × HL', p: 'Volume do relatório 2artd da quinzena, inclusive o entregue por spot. O fator de lucratividade é reajustado por ano conforme a performance: R$/HL de Gente (50%), R$/km (40%) e R$/HL spot (10%) contra o IPCA do ano anterior.', o: 'YoY acima de 150% da inflação: 0% · acima da inflação: 20% · 75%: 50% · 50%: 75% · 25%: 100% · abaixo de zero: 200%' },
    { k: 'Bônus e pênalti', n: 'trimestral', p: 'Sobre o lucro acumulado do trimestre, por KPI (On Time 60%, Devolução PDV 40%; 2 a 4 indicadores, avisados com 30 dias). Bônus até 10% quando bate ano anterior e meta; pênalti até 5% quando perde dos dois.' },
    { k: 'Modelo antigo', n: '% da NF', p: 'Lucro fixo sobre todo equipamento cadastrado (0% até 60 meses de financiamento, 0,90% de 61 a 96, 1,30% de 97 a 120) e lucro variável sobre os ativos (0,95% de 13 a 60 meses, 0,65% de 61 a 96, 0,70% de 97 a 120), dividido por 25 e pago no frete por viagem.' },
    { k: 'T1 e Armazém', n: 'fixo + variável', p: 'Transportes: lucro fixo sobre cavalos e carretas cadastrados e variável sobre os conjuntos ativos, % da NF. Armazém: fixo e variável sobre as empilhadeiras mais o lucro de mão de obra por HL movimentado.', acc: true },
  ])}
  ${didat('O que é pago por mapa é o variável (R$/km × km); a equipe de entrega é dimensionada por frota ativa × fator (motorista, ajudante, reserva, ferista), o fixo é por caminhão cadastrado e o lucro é por hectolitro entregue. Um mapa não rodado tira o variável do mapa; equipe, fixo e lucro seguem o dimensionamento e o volume.', 'O pacote, pelo Book')}
  ${fonte('LUCRO - DISTRIBUIÇÃO', 'LUCRO - TRANSPORTES T1', 'LUCRO - ARMAZÉM', 'EQUIPE DISTRIBUIÇÃO URBANA')}`);

{
  const Q = Object.keys(B.comp).sort((a, b) => { const f = v => { const m = v.match(/_(\d)_(\d{1,2})_(\d{4})$/); return +m[3] * 100 + +m[2] * 2 + +m[1]; }; return f(a) - f(b); });
  const rot = v => { const m = v.match(/_(\d)_(\d{1,2})_(\d{4})$/); return `${m[1]}ª ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m[2] - 1]}/${m[3].slice(2)}`; };
  const us = ['CGR', 'CBA', 'GRL', 'PLT', 'FLP', 'BLC', 'MCC'].filter(u => B.comp[Q[Q.length - 1]][u]);
  const ult = Q[Q.length - 1], S = B.sizing[ult];
  const dif = Q.flatMap(q => us.map(u => B.comp[q][u])).filter(x => x && (x.siz_cam !== x.ft_cam || x.siz_van !== x.ft_van)).length;
  slide(`${head('Dimensionamento oficial × ativos no FT', `O Book publica o dimensionamento de cada quinzena; nas últimas ${Q.length}, o número de caminhões e vans ativos no FT bate com o oficial em ${Q.length * us.length - dif} de ${Q.length * us.length} casos`, `Registro "Dimensionamento 2nd Tier e 3rd Tier" (${R['DIMENSIONAMENTO 2nd TIER E 3rd TIER'].anexos} arquivos, 2022 a ${I.mais_novo.slice(0, 4)}) · caminhões + vans dimensionados (arquivo oficial da quinzena) × placas ativas no relatório Caminhão e Van do FT`)}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, ...Q.map(q => ({ t: rot(q), n: true })), { t: 'Volume ' + rot(ult) + ' (HL)', n: true }, { t: 'Dias úteis', n: true }], rows: us.map(u => [NOME[u] || u, ...Q.map(q => { const x = B.comp[q][u]; if (!x) return '—'; const ok = x.siz_cam === x.ft_cam && x.siz_van === x.ft_van; return { v: `${f0(x.siz_cam)}+${f0(x.siz_van)} · FT ${f0(x.ft_cam)}+${f0(x.ft_van)}`, style: ok ? '' : 'color:#F22C05;font-weight:700' }; }), f0(S[u].vol), f0(S[u].du)]) })}
  <p class="note">Cada célula: caminhões + vans do dimensionamento oficial · caminhões + vans ativos no FT. Em vermelho, a quinzena em que os dois não batem. Nova Friburgo e Rondonópolis não estão na aba ROTA do arquivo (outra GEO).</p>
  ${concBlocos([
    { t: 'O que o dimensionamento decide', v: 'ativos e equipe', s: 'frotas ativas (caminhão e vans), noturna, reserva, spot e a capacidade teórica de atendimento por unidade e quinzena, com o volume e os dias úteis. É a base de ativos × fatores que paga a equipe de entrega e o fixo.' },
    { t: 'Rio de Janeiro', v: `${f0(S.CGR.cam)} caminhões`, s: `de ${f0(B.comp[Q[0]].CGR.siz_cam)} em ${rot(Q[0])} para ${f0(S.CGR.cam)} em ${rot(ult)} (${f0(S.CGR.vol)} HL, ${f0(S.CGR.du)} dias úteis): o dimensionamento muda a cada quinzena, e o FT acompanha.` },
    { t: 'Onde conferir', v: 'ft_book_anexo', s: 'os arquivos oficiais de cada quinzena estão no banco com o texto extraído; a crítica do dimensionamento se faz contra o arquivo da quinzena, não contra o FT.' },
  ])}
  ${fonte('DIMENSIONAMENTO 2nd TIER E 3rd TIER')}`);
}

slide(`${head('Fechamento e calendário', 'O que a unidade manda em cada data, pelo Book')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Quando' }, { t: 'O que', w: true }, { t: 'Regra do Book', w: true }], rows: [
    ['Dia 02 e dia 17', 'movimentação de frota (Rota e AS)', 'pedido até o dia 02 vale na 1ª quinzena; até o dia 17, na 2ª'],
    ['Dia 04 e dia 22', 'preço ANP atualizado pela Célula de Custos', 'média dos 2 últimos relatórios antes da quinzena'],
    ['Dias 01–15 e 16–31', 'NF do diesel (preço operadora)', 'chamado de 01 a 15 vale na 2ª quinzena; de 16 a 31, na 1ª do mês seguinte; sem NF por 45 dias, 90% da ANP'],
    ['4º dia útil', 'dimensionamento do T2 atualizado no FT pelo CSC', 'enviado pelo time de produtividade até o último dia do mês anterior'],
    ['Até o dia 09', 'críticas dos especialistas regionais aos valores do FT', 'tratadas até o dia 14; SAP no dia 15; validação no SAP até o dia 20'],
    ['Até o 18º dia útil', 'alteração de km (T2)', 'uma vez por mês, junto com o dimensionamento da 2ª quinzena'],
    ['Até o dia 20', 'fotos do CIVF', 'base de placas da 2ª quinzena do mês anterior; contestação em 2 dias úteis'],
    ['Dia 02 + 7 dias', 'stress test: arquivos da Ambev e justificativa do operador', 'tratativa em 3 dias; desconto até o dia 15'],
    ['Trimestre', 'consumo (Km/L) das leituras do trimestre anterior', 'entra no trimestre vigente; modelo novo no benchmark até a virada'],
    ['Julho', 'reajuste anual', 'manutenção pelo IGP-M; faixa, seguro, IPVA, rastreador, tacógrafo e revestimento pelo IPCA (ou valor negociado)'],
    ['M+1 até M+2', 'outros custos (OCs)', 'despesa pedida no mês seguinte ao da ocorrência, até M+2, valor líquido; aprovação até o 1º dia útil do mês seguinte'],
  ] })}
  ${conc('O km do caminhão muda uma vez por mês, não a cada quinzena; o preço do diesel e a lista de ativos mudam a cada quinzena; o Km/L muda a cada trimestre; os preços de tabela mudam em julho. Essas quatro frequências organizam a rotina da unidade.', 'A regra que organiza o calendário')}
  ${fonte('FECHAMENTOS APOIO, 1st TIER E 2nd TIER', 'MOVIMENTAÇÃO DE FROTAS', 'PREÇO COMBUSTÍVEIS', 'Outros Custos')}`);

slide(`${head('Recarga, outros custos e vale pedágio', 'O que é pago fora do R$/km do mapa')}
  ${cartoes([
    { k: 'Recarga', n: 'mesmo R$/km', p: 'Segunda viagem do veículo no mesmo dia com a mesma equipe: paga o mesmo R$/km da primeira viagem × km realizado. A jornada do dia não pode passar de 10h20.' },
    { k: 'Outros custos (OCs)', n: 'só pré-orçado', p: 'Gastos não planilhados e de responsabilidade da Ambev, autorizados pela AC (Logística ou RPO) antes de acontecer; sobre eles incidem ICMS/ISS, PIS e COFINS. Despesa executada sem alinhamento prévio é do operador. Categorias: entrega (diária, pernoite, pedágio, balsa), equipamento (aluguel, frota fixa, manutenção), gente (hora extra, RV, dissídio, turnover forçado).' },
    { k: 'Turnover e hora extra (T1)', n: 'template', p: 'Turnover reembolsado só no desligamento forçado por redução de frota, pelo QLP mais novo; hora extra da equipe operacional com a planilha padrão e o detalhamento da jornada.' },
    { k: 'Vale pedágio', n: 'limpa pautas', p: 'Desde o 1º limpa pautas de 2026, as pendências de vale pedágio entram no fluxo padrão, com calendário próprio; pendência não sinalizada não é reconhecida.', acc: true },
  ])}
  ${fonte('RECARGA', 'OUTROS CUSTOS', 'Outros Custos (Empurrada)', 'BOOK VALE PEDÁGIO')}`);

// ═══ Parte 6 · O que o Book responde ═══
capaSec(6, 'O que o Book responde', 'As perguntas abertas das análises que o Book fecha, e as que seguem em aberto.');
slide(`${head('Perguntas das análises que o Book responde', 'Sete respostas, e três perguntas que continuam dependendo do planejamento e dos relatórios oficiais')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Pergunta' }, { t: 'O que o Book diz', w: true }, { t: 'Onde' }], rows: [
    [{ v: '<b>Rastreador só no Rio é regra?</b>' }, 'sim: custo mensal negociado pelo RPO "para as operações em que seja aprovado este custo".', 'Custo fixo'],
    [{ v: '<b>Qual índice reajusta o contrato?</b>' }, 'manutenção: IGP-M ou valor negociado, em julho; faixa, seguro, IPVA, rastreador, tacógrafo e revestimento: IPCA ou negociado, em julho; lucro R$/HL: performance × IPCA.', 'Custo fixo · Manutenção · Lucro'],
    [{ v: '<b>O km é revisto por quinzena?</b>' }, 'não: a alteração de km é uma vez por mês, até o 18º dia útil, junto com o dimensionamento da 2ª quinzena. O que muda por quinzena é o preço do diesel e a lista de ativos.', 'Fechamentos'],
    [{ v: '<b>Como o Km/L validado sai do real?</b>' }, 'leituras diárias da telemetria ou do cartão, sem outliers (0,1 a 20 km/L; placa com mais de 4 dias), média ou 3º quartil por cluster, do trimestre anterior; cluster 1 é a média do modelo na unidade.', 'Consumo'],
    [{ v: '<b>O pacote é pago por mapa ou por ativo?</b>' }, 'o variável é por km dos mapas; a equipe é por frota ativa × fatores do dimensionamento; o fixo é por caminhão cadastrado; o lucro é por HL entregue. Só o variável depende do mapa rodado.', 'Equipe · Lucro · Custo fixo'],
    [{ v: '<b>Manutenção zero fora da carência?</b>' }, 'a carência é a cadastrada na inclusão, em meses, negociada com a montadora; fora dela o FT paga contrato, BID ou BID −10%. Zero fora da carência contraria o Book.', 'Manutenção'],
    [{ v: '<b>Diesel: o FT paga a ANP?</b>' }, 'o menor entre o nosso preço e a ANP no posto comum e no tanque externo; o nosso preço no tanque interno (Rio e Florianópolis) e no cartão.', 'Preço'],
    [{ v: 'Como o remunerado da DRE é montado' }, 'não está no Book: é do planejamento da Conlog.', '—'],
    [{ v: 'Efeito do imposto (lucro real × crédito presumido)' }, 'o Book só diz que o FT calcula valores líquidos de PIS/COFINS e que OCs levam ICMS/ISS, PIS e COFINS; o regime é do fiscal.', '—'],
    [{ v: 'A fatura por mapa (2art)' }, 'o Book cita o 2artd como fonte do volume do lucro; o export da fatura por mapa segue com a TI.', '—'],
  ] })}
  ${fonte('CUSTO FIXO DE EQUIPAMENTOS', 'MANUTENÇÃO', 'CONSUMO', 'FECHAMENTOS APOIO, 1st TIER E 2nd TIER')}`);

slide(`${head('Para levar', 'O Book muda quatro coisas na forma de gerir a remuneração')}
  ${cartoes([
    { k: '1 · O km é mensal', n: 'até o 18º dia útil', p: 'A revisão do km da placa é uma vez por mês, com o dimensionamento da 2ª quinzena. A crítica do km legítimo a mais tem uma janela por mês, não duas.' },
    { k: '2 · O preço tem regra por iniciativa', n: 'NF em dia', p: 'Posto comum: o menor entre o nosso e a ANP, com a NF subida na quinzena certa; sem NF por 45 dias, 90% da ANP. Tanque interno: o nosso preço real.' },
    { k: '3 · Os descontos têm calendário', n: 'dia 20 · dia 02 + 7', p: 'CIVF até o dia 20 e stress test justificado em 7 dias; a repetição multiplica o desconto. Ativo sem viagem no mês perde custo e lucro fixo.' },
    { k: '4 · Tudo é cadastro', n: 'chamado', p: 'Carência, contrato, Km/L, FINAME, IPVA: o FT paga o que está na ficha. A inclusão certa e o chamado na data valem mais do que qualquer negociação depois.', acc: true },
  ])}
  ${concBlocos([
    { t: 'No banco', s: `${B.n} registros e ${f0(I.anexos)} anexos em ft_book e ft_book_anexo, com texto extraído; o robô relê o Book toda segunda-feira e grava só o que mudou (hash por registro).` },
    { t: 'Nas análises', s: 'a Análise 2026, o Histórico, o Manual e o Treinamento passaram a citar o Book nas regras de manutenção, preço, consumo, custo fixo, km e calendário, e o dimensionamento oficial entrou como conferência dos ativos.' },
  ], 'Próximos passos', 2)}`);

console.log('ok', write(process.env.FT_HTML || 'book.html'), 'slides');

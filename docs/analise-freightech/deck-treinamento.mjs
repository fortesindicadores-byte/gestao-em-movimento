// ============================================================
// Treinamento "Como a remuneração funciona" para gestores de operação: simples e
// didático, com o caminhão mediano da Rota de 2026 como exemplo.
//   OPO=…/opo.json FT_HTML=…/treinamento.html node deck-treinamento.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, f0, f1, f2, mi, mil, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Treinamento · Como a remuneração funciona · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Como a remuneração funciona' });
const E = O.ex, KE = O.km_ex;
const kmMapa = E.km_mes / 25, varMapa = E.var * kmMapa, varMes = E.var * E.km_mes;
const preco = E.comb * E.kml;                                  // R$ por litro (diesel + Arla) embutido no R$/km
const litros = E.km_mes / E.kml, litros01 = E.km_mes / (E.kml - 0.1);
const big = (n, t, cor = INK) => `<div class="box" style="text-align:center"><div class="num" style="color:${cor}">${n}</div><p>${t}</p></div>`;
const peca = (nome, rk, cor, como, regua) => `<div class="box" style="border-top:5px solid ${cor}"><div class="lbl">${nome}</div><div class="num">R$ ${f2(rk)}<small>/km</small></div><p><b>Como sai:</b> ${como}</p><p style="margin-top:6px"><b>A régua:</b> ${regua}</p></div>`;

// 1
capa('Treinamento para gestores de operação', 'Como a remuneração funciona, e onde a operação ganha ou perde dinheiro',
  'O Freightech (FT) calcula a nossa remuneração. Ele monta o custo de um caminhão bem gerido. Se gastamos mais do que essa régua, a diferença sai do nosso resultado; se gastamos menos, fica com a gente.');

// 2
slide(`
  <div class="kicker">A ideia em uma frase</div>
  <h2>A remuneração paga o custo de um caminhão bem gerido. A régua é o Freightech.</h2>
  <div class="grid g2" style="margin-top:22px;gap:24px">
    <div class="box" style="border-top:5px solid ${AZUL}"><h3>Custo FIXO: o caminhão existir</h3><p style="margin-top:6px">Parcela do financiamento (FINAME), seguro, IPVA, rastreador, faixa refletiva e lavagem. É pago todo mês por caminhão ativo, rode ou não rode.</p>
      <div class="num" style="margin-top:12px">R$ ${f0(E.fixo)}<small> por mês</small></div><p class="note">caminhão mediano da Rota em 2026</p></div>
    <div class="box" style="border-top:5px solid ${ACC}"><h3>Custo VARIÁVEL: o caminhão rodar</h3><p style="margin-top:6px">Diesel, manutenção, pneu e carroceria. É pago por km, e só nos mapas que de fato rodaram.</p>
      <div class="num" style="margin-top:12px">R$ ${f2(E.var)}<small> por km</small></div><p class="note">≈ R$ ${f0(varMes)} por mês, se o caminhão rodar todos os mapas</p></div>
  </div>
  <div style="margin-top:18px">${escuro('<b>O que isso quer dizer para a operação:</b> o fixo depende pouco de nós. O variável depende muito: cada mapa que não roda, cada km a mais, cada litro a mais e cada real acima do preço da régua é dinheiro que não volta.')}</div>`);

// 3
slide(`
  <div class="kicker">O variável, passo a passo</div>
  <h2>Do km do caminhão ao dinheiro do mês</h2>
  <div class="grid g4" style="margin-top:20px;gap:14px">
    ${big(f0(KE.km_placa) + ' km', `<b>1. Km do caminhão no mês.</b> Definido em cada revisão. Exemplo: Cuiabá, ago/26.`)}
    ${big(f1(KE.km_mapa) + ' km', `<b>2. Km por mapa.</b> ${f0(KE.km_placa)} ÷ 25 dias úteis. É o que cada viagem do dia vale em km.`)}
    ${big(f0(KE.mapas_pos), `<b>3. Mapas possíveis.</b> ${KE.ativos} caminhões ativos × 25 dias.`)}
    ${big(f0(KE.viagens), `<b>4. Mapas rodados.</b> Só esses são pagos (mais recargas e noturnas).`, ACC)}
  </div>
  <div class="formula" style="margin-top:20px;font-size:18px;text-align:center">Variável do mês = R$/km do caminhão × km por mapa × mapas rodados<small>No caminhão mediano: R$ ${f2(E.var)} × ${f1(kmMapa)} km = <b>R$ ${f0(varMapa)} por mapa rodado</b></small></div>
  <p style="margin-top:14px;text-align:center">Cuiabá, ago/26: ${f0(KE.mapas_pos - KE.viagens)} mapas possíveis não viraram viagem. Cada um é cerca de R$ ${f0(varMapa)} que não entrou.</p>`);

// 4
slide(`
  <div class="kicker">As quatro peças do R$/km</div>
  <h2>Cada peça tem a sua régua. É nela que a operação ganha ou perde.</h2>
  <div class="grid g4" style="margin-top:18px;gap:14px">
    ${peca('Diesel', E.comb, ACC, `(preço do litro + Arla) ÷ Km/L remunerado da placa.`, `Km/L remunerado ${f2(E.kml)} e preço da ANP (vale o menor entre o nosso preço e a ANP).`)}
    ${peca('Manutenção', E.manut, AZUL, '90% do BID da montadora para o modelo e a faixa de km; sem BID, tabela por idade. Zero na carência.', 'o BID do modelo ou a tabela por idade, com ou sem contrato.')}
    ${peca('Pneu', E.pneu, VERDE, `(${f0(E.qpneu)} pneus × R$ ${f0(E.preco_pneu)} + recapagens) ÷ vida de ${f0(E.vida_pneu)} km.`, 'a vida em km do pneu e as recapagens previstas.')}
    ${peca('Carroceria', E.carr, AMB, 'valor por ano da manutenção da carroceria, por tipo.', 'a tabela por tipo de carroceria.')}
  </div>
  <div style="margin-top:16px">${escuro(`<b>Diesel é ${f0(E.comb / E.var * 100)}% do variável.</b> É a peça em que um pequeno desvio vira mais dinheiro: consumo e preço do litro.`)}</div>`);

// 5
{
  const L = [
    ['Mapa que não roda', `um caminhão ativo que fica sem viagem num dia`, `R$ ${f0(varMapa)} a menos por mapa`],
    ['Km acima do pago', `rodar mais km do que o km por mapa remunera (rota longa, desvio, ida ao posto)`, `~R$ ${f0(E.var * 100)} a cada 100 km a mais`],
    ['Consumo pior que a régua', `fazer 0,1 km/L abaixo do Km/L remunerado`, `${f0(litros01 - litros)} L ≈ R$ ${f0((litros01 - litros) * preco)} por caminhão por mês`],
    ['Diesel acima da ANP', `pagar R$ 0,10/L acima do preço da ANP`, `≈ R$ ${f0(litros * 0.1)} por caminhão por mês`],
    ['Manutenção acima do pago', `gastar na oficina mais do que o R$/km de manutenção da placa no FT`, `cada R$ 0,10/km = R$ ${f0(E.km_mes * 0.1)} por caminhão por mês`],
    ['Pneu que não chega à vida', `trocar ou perder o pneu antes da vida em km prevista`, 'o pneu a mais sai do nosso resultado'],
  ];
  slide(`
  <div class="kicker">Onde perdemos dinheiro</div>
  <h2>Seis alavancas da operação, cada uma com o seu valor</h2>
  <table style="margin-top:16px"><tr><th>Alavanca</th><th>O que é</th><th class="n">Quanto custa</th></tr>
  ${L.map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${b}</td><td class="n"><b>${c}</b></td></tr>`).join('')}</table>
  <p class="note" style="margin-top:10px">Valores do caminhão mediano da Rota em 2026: ${f0(E.km_mes)} km/mês, Km/L remunerado ${f2(E.kml)}, R$ ${f2(preco)} por litro com Arla, R$ ${f2(E.var)}/km de variável.</p>
  <div style="margin-top:12px">${escuro(`<b>Em 2026 (jan–ago),</b> os mapas que não rodaram somaram R$ ${mi(O.km['2026'].rs_nao)} de variável que não entrou. É a maior alavanca da operação.`)}</div>`);
}

// 6
slide(`
  <div class="kicker">Caminhão parado</div>
  <h2>O caminhão parado recebe o fixo, mas não roda mapa</h2>
  <div class="grid g2" style="margin-top:20px;gap:24px;align-items:start">
    <div>
      <div class="step"><b>1. Parado no FT continua recebendo o fixo de parado.</b><span>Capital do caminhão, seguro, IPVA e rastreador. Em 2026, ~${f0(Object.values(O.parado).reduce((s, x) => s + x.parados, 0))} caminhões parados por mês na Rota.</span></div>
      <div class="step"><b>2. O variável vem só dos mapas.</b><span>Se o caminhão ativo para na oficina e ninguém cobre o mapa, o mapa não roda e o variável não entra.</span></div>
      <div class="step"><b>3. Por isso a manutenção longa pesa duas vezes.</b><span>Custa a oficina e tira o mapa. O stress test exige ao menos uma viagem por mês de cada caminhão ativo.</span></div>
    </div>
    ${escuro(`<b>O que fazer:</b> caminhão ativo na oficina por mais de um dia precisa de um reserva cobrindo o mapa. Acompanhar no portal a Indisponibilidade (dias parado por placa) e o Painel KM (frota ativa × viagens).`)}
  </div>`);

// 7
slide(`
  <div class="kicker">Empurrada (T1)</div>
  <h2>Na Empurrada, a remuneração é por trecho</h2>
  <div class="grid g2" style="margin-top:20px;gap:24px;align-items:start">
    <div>
      <div class="step"><b>Cada trecho (origem → destino) tem o seu R$ por viagem.</b><span>Ele já traz o diesel, a manutenção do cavalo e da carreta, o pneu, a lavagem, o pedágio, o seguro e o salário variável daquele caminho.</span></div>
      <div class="step"><b>Fixo à parte:</b><span>cavalo e carreta (financiamento, seguro, IPVA, rastreador), equipe e estrutura, pagos por equipamento ativo.</span></div>
      <div class="step"><b>A régua do diesel do trecho:</b><span>preço pago × fator de crédito de imposto ÷ Km/L do trecho.</span></div>
    </div>
    <table class="compacta"><tr><th>2026 · R$/km do trecho</th>${['PIR', 'MCC', 'CBA'].filter(u => O.trecho[u]).map(u => `<th class="n">${NOME[u]}</th>`).join('')}</tr>
      ${[['Diesel', 'diesel'], ['Manutenção cavalo', 'manut_cav'], ['Manutenção carreta', 'manut_carr'], ['Pneu', 'pneu'], ['Lavagem', 'lav'], ['Salário variável', 'salario']].map(([n, k]) => `<tr><td>${n}</td>${['PIR', 'MCC', 'CBA'].filter(u => O.trecho[u]).map(u => `<td class="n">${f2(O.trecho[u][k])}</td>`).join('')}</tr>`).join('')}
      <tr><td>Km/L do trecho</td>${['PIR', 'MCC', 'CBA'].filter(u => O.trecho[u]).map(u => `<td class="n">${f2(O.trecho[u].kml)}</td>`).join('')}</tr></table>
  </div>`);

// 8
slide(`
  <div class="kicker">A rotina do gestor</div>
  <h2>O que olhar toda semana, e onde está no portal</h2>
  <table style="margin-top:16px"><tr><th>O que olhar</th><th>Por quê</th><th>Onde</th></tr>
    <tr><td><b>Frota ativa × viagens</b></td><td>mapa que não roda é variável que não entra</td><td>Painel KM · Indisponibilidade</td></tr>
    <tr><td><b>Dispersão de km</b> (rodado × pago)</td><td>km acima do pago é custo nosso; meta 5%</td><td>Painel KM</td></tr>
    <tr><td><b>Km/L real × remunerado</b>, por placa</td><td>consumo pior que a régua é diesel a mais</td><td>Eficiência Km/L · Árvore de Combustível</td></tr>
    <tr><td><b>R$/L real × ANP</b></td><td>o FT paga até a ANP; o que passar disso é nosso</td><td>Preço R$/L</td></tr>
    <tr><td><b>Gasto de manutenção e pneu</b></td><td>acima do R$/km da placa é perda</td><td>Carta de Custos · Pneus</td></tr>
    <tr><td><b>FCA de custos</b></td><td>causa e ação de cada desvio do mês</td><td>FCA</td></tr>
  </table>`);

// 9
slide(`
  <div class="kicker">Para levar</div>
  <h2>Cinco frases para lembrar</h2>
  <div style="margin-top:18px">
    <div class="step"><b>1. O FT é a régua: a remuneração cobre o custo de um caminhão bem gerido.</b><span></span></div>
    <div class="step"><b>2. Fixo é o caminhão existir; variável é o caminhão rodar, por km e por mapa rodado.</b><span></span></div>
    <div class="step"><b>3. Mapa que não roda é dinheiro perdido: ~R$ ${f0(varMapa)} cada.</b><span></span></div>
    <div class="step"><b>4. Diesel é ${f0(E.comb / E.var * 100)}% do variável: consumo e preço do litro valem mais que qualquer outra coisa.</b><span></span></div>
    <div class="step"><b>5. Todo desvio vira FCA, com causa e ação, e o portal mostra onde está cada um.</b><span></span></div>
  </div>`);

console.log('ok', write(process.env.FT_HTML || 'treinamento.html'), 'slides');

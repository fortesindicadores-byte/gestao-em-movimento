// ============================================================
// Deck para as unidades: como o variável da Ambev é composto e onde a gestão atua
// a partir do opo.json (oportunidades.py).
//   OPO=…/opo.json FT_HTML=…/variavel.html node deck-unidades.mjs
// O HTML e o PDF NÃO vão para o repositório (remuneração da Ambev).
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, f0, f1, f2, mil, mi, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Como o variável é composto · Freightech · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Como o variável é composto' });
const E = O.ex, kmMapa = E.km_mes / 25, varMes = E.var * E.km_mes, porMapa = E.var * kmMapa;
const pneuConta = (E.qpneu * E.preco_pneu + E.qpneu * E.qrecap * E.preco_recap) / E.vida_pneu;
const precoL = E.comb * E.kml;

// barra horizontal empilhada do R$/km
function pecas(parts, w = 1136, h = 64) {
  const tot = parts.reduce((s, p) => s + p.v, 0); let x = 0, s = `<svg viewBox="0 0 ${w} ${h + 26}" width="${w}" height="${h + 26}" font-family="Montserrat,Arial" font-size="12">`;
  parts.forEach(p => { const ww = w * p.v / tot; s += `<rect x="${x}" y="0" width="${ww - 3}" height="${h}" rx="6" fill="${p.cor}"/><text x="${x + 12}" y="26" fill="#fff" font-weight="700">${p.nome}</text><text x="${x + 12}" y="48" fill="#fff">R$ ${f2(p.v)}/km · ${Math.round(p.v / tot * 100)}%</text>`; x += ww; });
  return s + `<text x="0" y="${h + 20}" fill="${INK2}" font-size="11">Total do exemplo: R$ ${f2(tot)}/km (o FT arredonda e soma as peças por placa)</text></svg>`;
}

// ═══ capa ═══
capa('Para as unidades', 'Como a Ambev paga o nosso variável, e onde a unidade faz diferença', 'Combustível, manutenção, pneus, km rodado e contratos: de onde sai cada real que a Ambev paga por km, com um caminhão de exemplo. No fim, o que acompanhar no portal para não deixar dinheiro na mesa.');

// ═══ a conta em uma linha ═══
slide(`
  <div class="kicker">A ideia central</div>
  <h2>A Ambev paga por mapa rodado: caminhão parado não gera variável</h2>
  <div class="formula" style="margin-top:16px">Variável do mês = R$/km do caminhão × km por mapa × mapas rodados
    <small>O FT calcula o R$/km de cada placa a cada quinzena. O km por mapa vem do roteiro (Roadshow). O teto é 25 mapas por mês por caminhão ativo; entra o que rodou.</small></div>
  <div class="grid g4" style="margin-top:18px;gap:14px">
    <div class="box"><div class="lbl">R$/km do caminhão</div><div class="num">R$ ${f2(E.var)}</div><p>mediana dos ${E.placas} caminhões ativos da Rota em 2026</p></div>
    <div class="box"><div class="lbl">Km por mapa</div><div class="num">${f0(kmMapa)} km</div><p>${f0(E.km_mes)} km no mês ÷ 25 dias úteis</p></div>
    <div class="box"><div class="lbl">Cada mapa rodado vale</div><div class="num">R$ ${f0(porMapa)}</div><p>de variável (R$ ${f2(E.var)} × ${f0(kmMapa)} km)</p></div>
    <div class="box"><div class="lbl">25 mapas no mês</div><div class="num">R$ ${mil(varMes).replace(' mil', '')}<small> mil</small></div><p>de variável por caminhão, além do fixo de R$ ${f0(E.fixo)}</p></div>
  </div>
  <div style="margin-top:16px">${escuro(`<b>O que isso quer dizer na prática:</b> cada mapa que não roda deixa ~R$ ${f0(porMapa)} na mesa, e o custo do caminhão (motorista, financiamento, seguro) continua. O fixo a Ambev paga pelo caminhão ativo, rode ou não. O variável, só se rodar.`)}</div>`);

// ═══ as quatro peças ═══
slide(`
  <div class="kicker">O R$/km por dentro</div>
  <h2>O R$/km tem quatro peças, cada uma com a sua conta</h2>
  <div style="margin-top:16px">${pecas([{ nome: 'Combustível', v: E.comb, cor: ACC }, { nome: 'Manutenção', v: E.manut, cor: INK }, { nome: 'Pneu', v: E.pneu, cor: AZUL }, { nome: 'Carroc.', v: E.carr, cor: INK3 }])}</div>
  <table style="margin-top:14px">
    <tr><th>Peça</th><th>Como o FT calcula</th><th>Quem define</th><th>Muda quando</th></tr>
    <tr><td><b>Combustível</b></td><td>(preço do diesel + Arla) ÷ Km/L remunerado da placa</td><td>preço: o menor entre o nosso e a ANP · Km/L: Ambev</td><td>preço a cada quinzena · Km/L a cada trimestre</td></tr>
    <tr><td><b>Manutenção</b></td><td>R$/km do contrato de manutenção da placa (zero na carência do caminhão novo)</td><td>contrato da montadora cadastrado no FT; BID de referência</td><td>reajuste do contrato, fim da carência</td></tr>
    <tr><td><b>Pneu</b></td><td>(pneus × preço + pneus × recapagens × preço da recapagem) ÷ vida em km</td><td>premissas do FT (preço, vida, recapagens)</td><td>revisão das premissas</td></tr>
    <tr><td><b>Carroceria</b></td><td>R$/km de manutenção do baú</td><td>premissa do FT por tipo de carroceria</td><td>revisão das premissas</td></tr>
  </table>
  <p class="note" style="margin-top:8px">Valores do exemplo: medianas da Rota em 2026. AS e Van seguem a mesma lógica; a Empurrada é paga por trecho (mais adiante).</p>`);

// ═══ km ═══
{
  const U = Object.entries(O.uni).sort((a, b) => b[1].rs_nao - a[1].rs_nao), K26 = O.km['2026'];
  const tot = U.reduce((s, [, x]) => ({ mp: s.mp + x.mapas_pos, v: s.v + x.viagens, n: s.n + x.nao_rod, r: s.r + x.rs_nao, p: s.p + x.pago, o: s.o + x.rodado }), { mp: 0, v: 0, n: 0, r: 0, p: 0, o: 0 });
  slide(`
  <div class="kicker">Km rodado</div>
  <h2>Três km diferentes: o teto, o pago e o rodado</h2>
  <div class="grid g2" style="margin-top:12px;gap:22px;align-items:start">
    <div>
      <div class="step"><b>Teto do FT = km por mapa × 25 × caminhões ativos.</b><span>É o máximo que a Ambev pagaria no mês. Não é o que ela paga.</span></div>
      <div class="step"><b>Pago = mapas rodados × km por mapa + recargas e noturnas.</b><span>É o km remunerado da nossa Dispersão de km. A diferença para o teto é <b>mapa que não rodou</b>: em 2026 (jan–ago), ${f1(100 - K26.aprov)}% dos mapas possíveis.</span></div>
      <div class="step"><b>Rodado = o que o caminhão andou (hodômetro).</b><span>Km rodado acima do pago é a <b>dispersão</b>: combustível, pneu e manutenção gastos sem remuneração. Meta: até 5%.</span></div>
      ${escuro(`<b>As duas alavancas da unidade:</b> rodar todos os mapas possíveis (manutenção rápida, reserva de motorista, stress test em dia) e não rodar além do mapa (roteiro, deslocamento para abastecer, viagem que não remunera).`)}
    </div>
    <table class="compacta"><tr><th>2026 (jan–ago)</th><th class="n">Mapas possíveis</th><th class="n">Não rodados</th><th class="n">Variável que não entrou</th><th class="n">Dispersão</th></tr>
      ${U.map(([u, x]) => `<tr><td>${NOME[u]}</td><td class="n">${f0(x.mapas_pos)}</td><td class="n">${f0(x.nao_rod)} · ${f1(x.nao_rod / x.mapas_pos * 100)}%</td><td class="n">R$ ${mil(x.rs_nao)}</td><td class="n" style="color:${x.disp > 5 ? ACC : INK}">${x.disp > 0 ? '+' : ''}${f1(x.disp)}%</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td class="n"><b>${f0(tot.mp)}</b></td><td class="n"><b>${f0(tot.n)}</b></td><td class="n"><b>R$ ${mi(tot.r)}</b></td><td class="n"><b>+${f1((tot.o / tot.p - 1) * 100)}%</b></td></tr>
    </table>
  </div>
  <p class="note" style="margin-top:8px">Rota, Van e UDC. Mapas possíveis = frota ativa da Dispersão × 25; variável que não entrou = mapas não rodados × km por viagem × R$/km do variável da unidade no FT. Dispersão = km rodado ÷ km remunerado − 1.</p>`);
}

// ═══ combustível ═══
{
  const D = O.diesel26, T2 = Object.entries(D).filter(([k]) => k.startsWith('T2')).sort((a, b) => b[1].perda - a[1].perda);
  slide(`
  <div class="kicker">Combustível · ${Math.round(E.comb / E.var * 100)}% do R$/km</div>
  <h2>Combustível: preço, Km/L e km rodado</h2>
  <div class="formula" style="margin-top:12px">Combustível R$/km = (menor entre nosso preço e a ANP + Arla) ÷ Km/L remunerado
    <small>Exemplo: R$ ${f2(precoL)}/L com Arla ÷ ${f2(E.kml)} km/L = R$ ${f2(E.comb)}/km. A ANP e o nosso preço ficam no FT, quinzena a quinzena.</small></div>
  <div class="grid g3" style="margin-top:14px;gap:16px;align-items:start">
    <div class="box"><h3>1. Preço</h3><p>Se compramos <b>abaixo</b> da ANP, a Ambev paga o nosso preço. Se compramos <b>acima</b>, ela paga a ANP e a diferença é nossa. Comprar no preço negociado e lançar o preço certo no FT é dinheiro direto.</p>
      <table class="compacta" style="margin-top:6px"><tr><th>2026</th><th class="n">Acima da ANP</th></tr>${T2.slice(0, 5).map(([k, x]) => `<tr><td>${NOME[k.split('|')[1]]}</td><td class="n">R$ ${mil(x.perda)}</td></tr>`).join('')}</table></div>
    <div class="box"><h3>2. Km/L</h3><p>O Km/L remunerado de cada placa é revisto por trimestre: a régua nasce do consumo real do trimestre anterior, com os ajustes da Ambev. Cada placa com régua errada (zerada, mudada fora da revisão, mesmo modelo com valor diferente) muda o que recebemos. Dirigir bem (faixa verde, motor desligado parado) reduz o gasto na hora.</p></div>
    <div class="box"><h3>3. Km rodado</h3><p>Todo km acima do mapa queima diesel sem remuneração. Na média, ${f1(E.kml)} km por litro: 100 km a mais por dia num caminhão são ~${f0(100 / E.kml * 25)} L por mês, ~R$ ${mil(100 / E.kml * 25 * precoL)} só de diesel.</p></div>
  </div>
  <p class="note" style="margin-top:8px">Onde acompanhar: R$/L e Eficiência Km/L (Combustível), Painel KM (dispersão), Carta de Custos (abastecimentos do ERP).</p>`);
}

// ═══ manutenção e contratos ═══
slide(`
  <div class="kicker">Manutenção e contratos · ${Math.round((E.manut + E.carr) / E.var * 100)}% do R$/km</div>
  <h2>Manutenção: o contrato da placa, a carência e a fatura da montadora</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    <div>
      <div class="step"><b>O FT paga o R$/km do contrato de manutenção da placa.</b><span>Mediana da Rota em 2026: R$ ${f2(E.contrato)}/km de contrato, com BID de referência de R$ ${f2(E.bid)}/km. A carroceria vem à parte (R$ ${f2(E.carr)}/km).</span></div>
      <div class="step"><b>Caminhão novo tem carência.</b><span>Na carência o FT paga zero de manutenção, porque a montadora cobre. Depois dela, o contrato tem de aparecer no FT. Placa com mais de 2 anos e manutenção zero no FT é sinal de alerta.</span></div>
      <div class="step"><b>A fatura da montadora é por km e por faixa.</b><span>A VW cobra o km rodado do mês anterior ao R$/km da faixa do contrato. Passou da faixa, o preço do km muda (em alguns contratos fica mais barato, em outros mais caro).</span></div>
    </div>
    <div>
      <div class="box"><h3>O que a unidade acompanha</h3><p>1. <b>Placas zeradas</b>: caminhão fora da carência com manutenção zero no FT. Avisar o corporativo com a placa e a data de entrada.<br>2. <b>Km a mais custa duas vezes</b>: na placa com contrato variável, o km acima do mapa entra no diesel <b>e</b> na fatura do contrato.<br>3. <b>Faixa do contrato</b>: a coluna Faixa (1 → 2) na Carta de Custos mostra quem atravessou no mês.<br>4. <b>Fora do contrato</b>: o que é lançado na Carta além da fatura (corretiva, pneu, item fora do plano) não tem remuneração própria.</p></div>
      <p class="note" style="margin-top:8px">Onde acompanhar: Carta de Custos (Placas Contrato, faixa e hodômetros), Gestão à Vista (Contrato do mês corrente).</p>
    </div>
  </div>`);

// ═══ pneus ═══
slide(`
  <div class="kicker">Pneus · ${Math.round(E.pneu / E.var * 100)}% do R$/km</div>
  <h2>Pneus: o FT paga a vida do pneu dividida em km</h2>
  <div class="formula" style="margin-top:12px">Pneu R$/km = (pneus × preço do pneu + pneus × recapagens × preço da recapagem) ÷ vida em km
    <small>Exemplo: (${f0(E.qpneu)} × R$ ${f0(E.preco_pneu)} + ${f0(E.qpneu)} × ${f0(E.qrecap)} × R$ ${f0(E.preco_recap)}) ÷ ${f0(E.vida_pneu)} km = R$ ${f2(pneuConta)}/km (a mediana no FT é R$ ${f2(E.pneu)}; a diferença é montagem e arredondamento).</small></div>
  <div class="grid g3" style="margin-top:14px;gap:16px">
    <div class="box"><h3>Vida em km</h3><p>O FT considera ~${f0(E.vida_pneu)} km por pneu. Pneu que dura menos (pressão errada, desalinhamento, rota ruim) custa mais por km do que a Ambev paga.</p></div>
    <div class="box"><h3>Recapagens</h3><p>O FT considera ${f0(E.qrecap)} recapagens por pneu. Carcaça perdida antes disso é pneu novo pago por nós. Retirar no ponto certo (3–4 mm) preserva a carcaça.</p></div>
    <div class="box"><h3>O que acompanhar</h3><p>Aferição em dia, calibragem dentro de ±10% da pressão ideal, alinhamento no prazo, pedido de pneu novo só na necessidade. Tudo no hub Pneus e na Compra de Pneus.</p></div>
  </div>
  <div style="margin-top:14px">${escuro('<b>Conta de bolso:</b> se a vida real cai 10% (de 88 mil para 80 mil km), o custo por km do pneu sobe ~11%, e a Ambev continua pagando pela premissa. O ganho está em fazer o pneu chegar à vida e às recapagens que o FT já considera.')}</div>`);

// ═══ empurrada ═══
{
  const T = O.trecho, U = ['PIR', 'MCC', 'CBA'].filter(u => T[u]);
  const linha = (rot, k, d = 2) => `<tr><td>${rot}</td>${U.map(u => `<td class="n">${d === 2 ? f2(T[u][k]) : f1(T[u][k])}</td>`).join('')}</tr>`;
  slide(`
  <div class="kicker">Empurrada (T1)</div>
  <h2>Na Empurrada a Ambev paga por trecho, e o diesel já vem com o crédito de imposto</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    <div>
      <div class="step"><b>Cada trecho (origem → destino) tem o seu R$/km.</b><span>O frete do trecho soma diesel, manutenção do cavalo e da carreta, pneu, lavagem, salário variável do motorista e lucro, cada um em R$/km, × km de ida e volta.</span></div>
      <div class="step"><b>Diesel do trecho = preço pago × fator de crédito ÷ Km/L do trecho.</b><span>O fator é o imposto que a Ambev entende que recuperamos. Quem confere o fator é o corporativo com o fiscal.</span></div>
      <div class="step"><b>Viagem sem CTE volta pelo balanço de massa.</b><span>O km dessas viagens é recomposto no remunerado (Painel KM). Por isso a dispersão da Empurrada se lê com o balanço de massa, nunca pelo km bruto.</span></div>
    </div>
    <table class="compacta"><tr><th>R$/km do trecho · 2026</th>${U.map(u => `<th class="n">${NOME[u]}</th>`).join('')}</tr>
      ${linha('Diesel', 'diesel')}${linha('Manutenção cavalo', 'manut_cav')}${linha('Manutenção carreta', 'manut_carr')}${linha('Pneu', 'pneu')}${linha('Lavagem', 'lav')}${linha('Salário variável', 'salario')}${linha('Lucro variável', 'lucro')}
      <tr><td><b>Km/L do trecho</b></td>${U.map(u => `<td class="n"><b>${f2(T[u].kml)}</b></td>`).join('')}</tr>
    </table>
  </div>
  <div style="margin-top:14px">${escuro('<b>Onde a unidade atua:</b> Km/L (o diesel é ~70% do R$/km do trecho e cada décimo de km/L conta), aproveitamento das viagens programadas e o lançamento correto das notas de diesel. A condução econômica do DriverPro (Piraí) mira exatamente o Km/L.')}</div>
  <p class="note" style="margin-top:6px">Médias ponderadas pelo km programado dos trechos de 2026.</p>`);
}

// ═══ checklist ═══
slide(`
  <div class="kicker">Rotina de gestão</div>
  <h2>O que acompanhar todo mês para não deixar dinheiro na mesa</h2>
  <table style="margin-top:14px">
    <tr><th>Alavanca</th><th>Pergunta do mês</th><th>Onde ver no portal</th><th>Referência</th></tr>
    <tr><td><b>Mapas rodados</b></td><td>Algum caminhão ativo ficou sem rodar? Por quê?</td><td>Painel KM · Indisponibilidade · Ativação de Frota</td><td>todos os mapas possíveis</td></tr>
    <tr><td><b>Dispersão de km</b></td><td>Rodamos mais do que o remunerado? Onde?</td><td>Painel KM (unidade, projeto, placa)</td><td>até 5%</td></tr>
    <tr><td><b>Preço do diesel</b></td><td>Compramos acima da ANP? O preço do FT está certo?</td><td>R$/L · Carta de Custos</td><td>≤ ANP</td></tr>
    <tr><td><b>Km/L</b></td><td>Real × remunerado por placa; alguma régua zerada ou estranha?</td><td>Eficiência Km/L · Análise do Impacto · DriverPro</td><td>real ≥ remunerado</td></tr>
    <tr><td><b>Manutenção</b></td><td>Placa fora da carência com zero no FT? Quem passou de faixa?</td><td>Carta de Custos · Gestão à Vista (Contrato)</td><td>contrato no FT</td></tr>
    <tr><td><b>Pneus</b></td><td>Aferição, calibragem e alinhamento em dia?</td><td>Hub Pneus · Compra de Pneus</td><td>100% · ±10% · no prazo</td></tr>
    <tr><td><b>Desvio do mês</b></td><td>Que pacote estourou e qual é a ação?</td><td>FCA (causas e ações automáticas)</td><td>FCA preenchido</td></tr>
  </table>
  <div style="margin-top:14px">${escuro('<b>Em resumo:</b> o variável é uma conta simples (R$/km × km por mapa × mapas rodados), mas cada peça tem premissas. A unidade ganha rodando todos os mapas, não rodando além deles, comprando diesel no preço e cuidando de Km/L, pneu e manutenção. O corporativo cuida das premissas no FT e leva à Ambev o que estiver errado.')}</div>`);

console.log('ok', write(process.env.FT_HTML || 'variavel.html'), 'slides');

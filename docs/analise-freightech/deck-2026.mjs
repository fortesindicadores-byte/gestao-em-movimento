// ============================================================
// Deck "Freightech 2026: o que questionar com a Ambev" (jan–out/26), didático:
// cada oportunidade em uma frase, um exemplo de placa/mês e a matriz do detalhe.
//   OPO=…/opo.json FT_DADOS=…/dados.json FT_HTML=…/ft2026.html node deck-2026.mjs
// O HTML e o PDF NÃO vão para o repositório (remuneração da Ambev).
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, f0, f1, f2, f3, mi, mil, rs, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3 } from './deck-base.mjs';
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const A = JSON.parse(readFileSync(process.env.FT_DADOS || 'dados.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Freightech 2026 · o que questionar com a Ambev · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Freightech 2026' });
const tag = c => `<span class="tag ${c}">${{ alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' }[c]}</span>`;
const mv = v => MES[+v.slice(5) - 1] + '/' + v.slice(2, 4);
const k1 = v => v == null ? '' : f0(v / 1000);                      // R$ mil sem o "mil"
const heat = (v, max, cor = '242,44,5') => v > 0 ? `background:rgba(${cor},${Math.min(.08 + .62 * v / max, .7).toFixed(2)})` : '';
// bloco didático: frase, como deveria ser, o que acontece, exemplo, valor, pedido
const passo = (n, t, x) => `<div class="step"><b>${typeof n === 'number' ? n + '.' : `<span style="color:${ACC};font-size:10.5px;letter-spacing:.6px;text-transform:uppercase">${n}</span><br>`} ${t}</b><span>${x}</span></div>`;

const V = O.vw.ano['2026'], Z = O.zero.ano['2026'], FI = O.fator.impacto, K = O.kml;
const f26 = FI['CBA|2026'].imp + FI['MCC|2026'].imp;
const TOT = V.gap + Z.sem_vw_bid + f26 + K.disp_rs;
const KE = O.km_ex, EX = O.ex;
const PAR = O.parado, parTot = Object.values(PAR).reduce((s, x) => s + x.fixo_parado_ano, 0), parN = Object.values(PAR).reduce((s, x) => s + x.parados, 0);

// ═══ 1 · capa ═══
capa('Freightech · janeiro a outubro de 2026', 'O que questionar com a Ambev em 2026',
  `Quatro pontos para levar, cada um com a regra do Freightech, um exemplo de placa e mês, a matriz do detalhe e a pergunta pronta. Antes deles, como a Ambev nos paga. No fim, o que conferimos e não vai para a mesa, e o que é lição de casa nossa.`);

// ═══ 2 · como a Ambev nos paga (T2) ═══
slide(`
  <div class="kicker">Antes de começar · Rota, AS e Van</div>
  <h2>Como a Ambev nos paga o variável: km da placa, km por mapa e mapas rodados</h2>
  <div class="grid g2" style="margin-top:14px;gap:24px;align-items:start">
    <div>
      ${passo(1, 'Na revisão, a Ambev define o km do mês de cada caminhão.', `Esse é o km remunerado da placa no FT. Exemplo: Cuiabá, ago/26, <b>${f0(KE.km_placa)} km</b> por caminhão.`)}
      ${passo(2, 'Km por mapa = km da placa ÷ 25 dias úteis.', `${f0(KE.km_placa)} ÷ 25 = <b>${f1(KE.km_mapa)} km</b> por mapa. (A nossa Dispersão mostrou ${f1(KE.km_viagem)} km por viagem no mesmo mês.)`)}
      ${passo(3, 'O teto do mês = km da placa × caminhões ativos.', `${f0(KE.km_placa)} × ${KE.ativos} ativos = <b>${f0(KE.teto)} km</b>, ou ${f0(KE.mapas_pos)} mapas possíveis.`)}
      ${passo(4, 'A Ambev paga os mapas que rodaram.', `Cuiabá fez ${f0(KE.viagens)} viagens, com recargas e noturnas: <b>${f0(KE.pago)} km pagos</b> (${f0(KE.pago / KE.teto * 100)}% do teto). Cada km vale o R$/km do caminhão.`)}
      ${passo(5, 'O fixo vem à parte, e o caminhão parado também recebe.', `Ativo recebe o fixo cheio (finame, depreciação, equipe, seguro, IPVA). Parado recebe o fixo de parado (capital, seguro, IPVA, rastreador): em 2026, ~${f0(parN)} caminhões parados por mês, R$ ${mi(parTot)} no ano.`)}
    </div>
    <div>
      <div class="formula">Variável do mês = R$/km × km por mapa × mapas rodados<small>R$/km do caminhão = combustível + manutenção + carroceria + pneu, placa a placa e quinzena a quinzena</small></div>
      <table class="compacta" style="margin-top:12px"><tr><th>Caminhão mediano da Rota · 2026</th><th class="n">R$/km</th><th>De onde sai no FT</th></tr>
        <tr><td>Combustível</td><td class="n">${f2(EX.comb)}</td><td>(preço do diesel + Arla) ÷ Km/L remunerado (${f2(EX.kml)})</td></tr>
        <tr><td>Manutenção</td><td class="n">${f2(EX.manut)}</td><td>contrato da placa; zero na carência do caminhão novo</td></tr>
        <tr><td>Carroceria</td><td class="n">${f2(EX.carr)}</td><td>tabela por tipo de carroceria</td></tr>
        <tr><td>Pneu</td><td class="n">${f2(EX.pneu)}</td><td>(pneus × preço + recapagens × preço) ÷ vida em km</td></tr>
        <tr><td><b>Total</b></td><td class="n"><b>${f2(EX.var)}</b></td><td>× ${f1(EX.km_mes / 25)} km por mapa ≈ R$ ${f0(EX.var * EX.km_mes / 25)} por mapa rodado</td></tr>
      </table>
      <div style="margin-top:12px">${escuro('<b>Onde estão as oportunidades:</b> não na conta, que fecha, mas nas <b>premissas</b> de cada parcela: o contrato de manutenção cadastrado, o crédito de imposto do diesel, o Km/L remunerado. Cada uma muda o R$/km de uma placa e, por ele, o que a Ambev paga.')}</div>
    </div>
  </div>
  <p class="note" style="margin-top:10px">Na Empurrada (T1) o pagamento é por trecho: cada trecho tem o seu R$/km, que já traz o diesel, a manutenção e o pneu daquele caminho.</p>`);

// ═══ 3 · resumo ═══
slide(`
  <div class="kicker">Resumo de 2026</div>
  <h2>Quatro pontos para levar à Ambev, ~R$ ${mi(TOT)} em 2026</h2>
  <table style="margin-top:14px">
    <tr><th>#</th><th>Em uma frase</th><th class="n">2026</th><th>Confiança</th><th>O que pedir</th></tr>
    <tr><td>1</td><td><b>A VW cobra mais por km do que o FT paga de manutenção</b>, nas mesmas placas e meses. Em ${V.pl_ft0} placas o FT paga zero.</td><td class="n"><b>R$ ${mil(V.gap)}</b></td><td>${tag('media')}</td><td>Cadastrar o contrato da montadora no FT</td></tr>
    <tr><td>2</td><td><b>Caminhão fora da carência com manutenção zero no FT</b>, sem contrato VW (${Z.sem_vw_pl} placas, vida mediana ${f0(O.zero.vida26)} meses).</td><td class="n"><b>R$ ${mil(Z.sem_vw_bid)}</b></td><td>${tag('media')}</td><td>Pagar o BID (ou o contrato) depois da carência</td></tr>
    <tr><td>3</td><td><b>O crédito de imposto do diesel da Empurrada</b>: Cuiabá caiu de ${f2(O.fator.ano.CBA['2025'])} para ${f2(O.fator.ano.CBA['2026'])} em jan/26; Macacu segue abaixo de Piraí.</td><td class="n"><b>R$ ${mil(f26)}</b></td><td>${tag('baixa')}</td><td>Explicar o fator (depois de o fiscal confirmar)</td></tr>
    <tr><td>4</td><td><b>Km/L remunerado</b>: o 4º trimestre roda com a régua do 3º; mudanças fora da revisão; placas ativas zeradas.</td><td class="n">R$ ${mil(K.disp_rs)}<br><span class="note">+ a revisão do Q4</span></td><td>${tag('alta')}</td><td>Fazer a revisão do Q4 e corrigir os cadastros</td></tr>
  </table>
  <div style="margin-top:12px">${escuro(`<b>Os pontos 1 e 2 não se somam duas vezes:</b> o 2 só conta as placas sem fatura VW no mês. <b>O 3 começa no fiscal</b>, não na Ambev. <b>O 4 é o mais sólido</b> (está no próprio FT) e o valor maior depende de a Ambev rodar a revisão.`)}</div>
  <p class="note" style="margin-top:8px">Conferimos e <b>não</b> vão para a mesa: caminhão inativo que roda (o parado já recebe o fixo), o km do FT maior que o pago (é teto) e o preço do diesel (a regra está certa em 100% dos casos). Ver o slide "O que conferimos e não é oportunidade".</p>`);

// ═══ 4 · ponto 1 · explicação + exemplo ═══
{
  const E = O.vw.ex, T = O.vw.top26[0], m24 = E.find(r => r.vida >= 24), mud = E.find((r, i) => i && r.rk_vw > E[i - 1].rk_vw + 0.05);
  slide(`
  <div class="kicker">Ponto 1 · manutenção · contrato da montadora</div>
  <h2>A VW cobra mais por km do que o FT paga de manutenção para o mesmo caminhão</h2>
  <div class="grid g2" style="margin-top:14px;gap:24px;align-items:start">
    <div>
      ${passo('Como deveria ser', 'O FT paga a manutenção pelo contrato da placa.', 'O R$/km de manutenção do caminhão sai do contrato cadastrado no FT. Quando o caminhão tem contrato com a montadora, o natural é o FT pagar perto do que o contrato cobra.')}
      ${passo('O que acontece', `Em 2026 a VW cobrou R$ ${f3(V.rk_vw)}/km e o FT pagou R$ ${f3(V.rk_ft)}/km.`, `Nas ${V.placas} placas com fatura VW, comparando placa a placa e mês a mês. Em ${V.pl_ft0} delas o FT paga <b>zero</b>, com a montadora cobrando todo mês (R$ ${mil(V.gap_ft0)}).`)}
      ${passo('Quanto vale', `R$ ${mil(V.gap)} de fev a out/26.`, `(R$/km da fatura − R$/km do FT) × km faturado pela VW. É conservador: o teto de km dessas placas no FT é maior que o km faturado.`)}
      ${passo('O que pedir', 'Que o contrato da montadora entre no FT com o valor atual.', 'E a explicação das placas com contrato ativo e manutenção zero.')}
      <div style="margin-top:4px">${tag('media')} <span class="note">a Ambev pode dizer que paga um valor de referência, e não o nosso contrato.</span></div>
    </div>
    <div>
      <h3>Exemplo: ${T.pl} · ${NOME[T.cod]} · VW ${T.mod}</h3>
      <table class="compacta" style="margin-top:6px"><tr><th>Mês</th><th class="n">Km faturado</th><th class="n">VW R$/km</th><th class="n">FT R$/km</th><th class="n">BID FT</th><th class="n">Vida (meses)</th><th class="n">Diferença</th></tr>
      ${E.map(r => `<tr><td>${mv(r.vig)}</td><td class="n">${f0(r.km)}</td><td class="n">${f3(r.rk_vw)}</td><td class="n" style="color:${ACC}"><b>${f3(r.rk_ft)}</b></td><td class="n">${f2(r.bid)}</td><td class="n">${f0(r.vida)}</td><td class="n">R$ ${f0(r.gap)}</td></tr>`).join('')}
      <tr><td><b>2026</b></td><td class="n"><b>${f0(E.reduce((s, r) => s + r.km, 0))}</b></td><td colspan="4"></td><td class="n"><b>R$ ${f0(E.reduce((s, r) => s + r.gap, 0))}</b></td></tr></table>
      <p class="note" style="margin-top:8px">${m24 ? `O caminhão passou dos 24 meses de vida em ${mv(m24.vig)}, tem contrato com a VW e o FT continua pagando ${f3(E[E.length - 1].rk_ft)} de manutenção.` : ''}${mud ? ` A fatura da VW subiu de R$ ${f3(E[E.indexOf(mud) - 1].rk_vw)} para R$ ${f3(mud.rk_vw)}/km em ${mv(mud.vig)}.` : ''} O BID do próprio FT para a placa é R$ ${f2(E[0].bid)}/km.</p>
    </div>
  </div>`);
}

// ═══ 5 · ponto 1 · matriz ═══
{
  const M = O.vw.mat26, vs = [...new Set(Object.values(M).flatMap(Object.keys))].sort();
  const us = Object.keys(M).sort((a, b) => Object.values(M[b]).reduce((s, x) => s + x, 0) - Object.values(M[a]).reduce((s, x) => s + x, 0));
  const max = Math.max(...us.flatMap(u => vs.map(v => M[u][v] || 0)));
  const tu = u => vs.reduce((s, v) => s + (M[u][v] || 0), 0), tv = v => us.reduce((s, u) => s + (M[u][v] || 0), 0);
  slide(`
  <div class="kicker">Ponto 1 · onde está a diferença</div>
  <h2>Matriz: diferença entre a fatura VW e a manutenção do FT, por unidade e mês de 2026</h2>
  <table class="compacta" style="margin-top:12px;font-size:11px"><tr><th>R$ mil</th>${vs.map(v => `<th class="n">${mv(v)}</th>`).join('')}<th class="n">2026</th><th class="n">Placas</th><th class="n">Com FT zero</th></tr>
  ${us.map(u => `<tr><td><b>${NOME[u]}</b></td>${vs.map(v => `<td class="n" style="padding:4px 8px;${heat(M[u][v] || 0, max)}">${M[u][v] == null ? '·' : k1(M[u][v])}</td>`).join('')}<td class="n"><b>${k1(tu(u))}</b></td><td class="n">${O.vw.uni26[u].placas}</td><td class="n">${k1(O.vw.uni26[u].gap_ft0)}</td></tr>`).join('')}
  <tr><td><b>Total</b></td>${vs.map(v => `<td class="n"><b>${k1(tv(v))}</b></td>`).join('')}<td class="n"><b>${k1(V.gap)}</b></td><td class="n">${V.placas}</td><td class="n">${k1(V.gap_ft0)}</td></tr></table>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${escuro(`<b>Como ler:</b> cada célula é a soma, nas placas da unidade com fatura VW no mês, de (R$/km da VW − R$/km do FT) × km faturado. Quanto mais forte o vermelho, maior a diferença. <b>Rio de Janeiro e Guarulhos</b> concentram metade do valor; <b>Nova Friburgo</b> tem poucas placas e quase tudo com o FT em zero.`)}
    <table class="compacta"><tr><th>Placas com maior diferença em 2026</th><th>Unid.</th><th class="n">Km</th><th class="n">VW</th><th class="n">FT</th><th class="n">Diferença</th></tr>
    ${O.vw.top26.slice(0, 6).map(p => `<tr><td>${p.pl} · ${p.mod}</td><td>${p.cod}</td><td class="n">${f0(p.km)}</td><td class="n">${f3(p.rk_vw)}</td><td class="n">${f3(p.rk_ft)}</td><td class="n">R$ ${f0(p.gap)}</td></tr>`).join('')}</table>
  </div>
  <p class="note" style="margin-top:8px">A fatura de jan/26 não existe no portal da VW, por isso a matriz começa em fevereiro. As placas e os meses estão na planilha anexa.</p>`);
}

// ═══ 6 · ponto 2 ═══
{
  const U = Object.entries(O.zero.uni26).sort((a, b) => b[1].pot_bid - a[1].pot_bid), T = O.zero.top26;
  slide(`
  <div class="kicker">Ponto 2 · manutenção · fora da carência</div>
  <h2>Caminhão com mais de 24 meses de vida e manutenção zero no FT</h2>
  <div class="grid g2" style="margin-top:14px;gap:24px;align-items:start">
    <div>
      ${passo('Como deveria ser', 'Caminhão novo tem carência; depois dela o FT paga a manutenção.', 'Na carência o R$/km de manutenção é zero. Passou dela, o FT deveria pagar o contrato da placa ou, sem contrato, perto do BID que o próprio FT traz para a placa.')}
      ${passo('O que acontece', `${Z.sem_vw_pl} placas da Rota, ativas, com mais de 24 meses e manutenção zero em 2026.`, `Vida mediana de ${f0(O.zero.vida26)} meses, bem fora da carência. Nenhuma tem fatura VW no mês (essas já estão no ponto 1). Das ${Z.placas} placas zeradas fora da carência (com e sem fatura VW), ${Z.irm_pl} têm irmãs do mesmo modelo e unidade recebendo manutenção.`)}
      ${passo('Quanto vale', `R$ ${mil(Z.sem_vw_bid)} ao BID do próprio FT.`, `BID × km da placa, quinzena a quinzena. Ao R$/km das placas irmãs que recebem: R$ ${mil(Z.sem_vw_irm)}.`)}
      ${passo('O que pedir', 'A regra para o caminhão que saiu da carência e não tem contrato.', 'E o acerto dessas placas a partir de quando passaram dos 24 meses.')}
      <div>${tag('media')} <span class="note">antes, cada unidade confirma quem pagou a manutenção dessas placas.</span></div>
    </div>
    <div>
      <table class="compacta"><tr><th>Exemplos · 2026</th><th>Unid.</th><th class="n">Vida</th><th class="n">BID</th><th class="n">Km</th><th class="n">Irmãs pagas</th><th class="n">Ao BID</th></tr>
      ${T.map(p => `<tr><td>${p.pl} · ${p.mod}</td><td>${p.cod}</td><td class="n">${f0(p.vida)}</td><td class="n">${f2(p.bid)}</td><td class="n">${f0(p.km)}</td><td class="n">${p.irm ? `${p.irm} a ${f2(p.rk_irm)}` : '—'}</td><td class="n">R$ ${f0(p.pot)}</td></tr>`).join('')}</table>
      <table class="compacta" style="margin-top:10px"><tr><th>2026 · unidade</th><th class="n">Placas</th><th class="n">Ao BID</th><th class="n">Às irmãs</th></tr>
      ${U.map(([u, x]) => `<tr><td>${NOME[u]}</td><td class="n">${x.placas}</td><td class="n">R$ ${mil(x.pot_bid)}</td><td class="n">R$ ${mil(x.pot_irm)}</td></tr>`).join('')}</table>
      <p class="note" style="margin-top:6px">Exemplo: ${T[0].pl} (${NOME[T[0].cod]}, VW ${T[0].mod}), ${f0(T[0].vida)} meses de vida, manutenção zero nas ${T[0].qz} quinzenas de 2026. BID do FT R$ ${f2(T[0].bid)}/km × ${f0(T[0].km)} km = R$ ${f0(T[0].pot)}.</p>
    </div>
  </div>`);
}

// ═══ 7 · ponto 3 · explicação + exemplo ═══
{
  const X = O.fator.ex, sem = X.pago * 0.94, c = FI['CBA|2026'], m = FI['MCC|2026'];
  slide(`
  <div class="kicker">Ponto 3 · combustível · Empurrada</div>
  <h2>O desconto de crédito de imposto no diesel da Empurrada mudou em jan/26</h2>
  <div class="grid g2" style="margin-top:14px;gap:24px;align-items:start">
    <div>
      ${passo('Como funciona', 'Na Empurrada o FT desconta do diesel o imposto que entende que recuperamos.', 'Preço pago = o menor entre o nosso e a ANP. Depois ele é multiplicado por um <b>fator</b> (preço com crédito ÷ preço pago). Fator menor, diesel do trecho mais barato, pagamento menor.')}
      ${passo('O que acontece', `Cuiabá: ${f2(O.fator.ano.CBA['2025'])} o ano de 2025 inteiro, ${f2(O.fator.mes.CBA['2026-01'])} em jan/26.`, `Macacu fez o caminho contrário: ${f2(O.fator.mes.MCC['2025-12'])} em dez/25, ${f2(O.fator.mes.MCC['2026-01'])} em jan/26. Piraí, no mesmo estado de Macacu, ficou em ${f2(O.fator.mes.PIR['2026-01'])} o tempo todo. Parece que Cuiabá e Macacu trocaram de lugar.`)}
      ${passo('Quanto vale', `R$ ${mil(f26)} em 2026 (jan–set).`, `Cuiabá com o fator dela de 2025 (0,94): R$ ${mil(c.imp)}. Macacu com o fator de Piraí: R$ ${mil(m.imp)}. Sobre o remunerado de diesel da DRE.`)}
      ${passo('O que pedir', 'Qual crédito o FT considera em cada unidade e por que mudou em jan/26.', 'E se a troca entre Cuiabá e Macacu foi intencional.')}
      <div>${tag('baixa')} <span class="note">depende do crédito que recuperamos de fato: o fiscal confirma antes.</span></div>
    </div>
    <div>
      <h3>Exemplo: Cuiabá · ${X.qz}ª quinzena de ${MES[X.mes - 1]}/26 · diesel S10</h3>
      <table class="compacta" style="margin-top:6px">
        <tr><td>Nosso preço</td><td class="n">R$ ${f2(X.op)}</td></tr>
        <tr><td>ANP</td><td class="n">R$ ${f2(X.anp)}</td></tr>
        <tr><td><b>Preço pago</b> (o menor dos dois)</td><td class="n"><b>R$ ${f2(X.pago)}</b></td></tr>
        <tr><td>Preço com crédito de imposto no FT</td><td class="n">R$ ${f2(X.cred)}</td></tr>
        <tr><td><b>Fator</b> = ${f2(X.cred)} ÷ ${f2(X.pago)}</td><td class="n" style="color:${ACC}"><b>${f3(X.f)}</b></td></tr>
        <tr><td>Com o fator de 2025 (0,94)</td><td class="n">R$ ${f2(sem)}</td></tr>
        <tr><td><b>Diferença por litro</b></td><td class="n"><b>R$ ${f2(sem - X.cred)}</b></td></tr>
      </table>
      <div style="margin-top:12px">${escuro(`<b>Em palavras:</b> em 2025 a Ambev pagava 94% do preço do diesel de Cuiabá; desde jan/26 paga ${f0(X.f * 100)}%. A cada litro da Empurrada de Cuiabá, R$ ${f2(sem - X.cred)} a menos. A matriz do próximo slide mostra a virada mês a mês.`)}</div>
    </div>
  </div>`);
}

// ═══ 8 · ponto 3 · matriz ═══
{
  const F = O.fator.mes, vs = Object.keys(F.PIR).sort(), IM = O.fator.imp26_mes;
  const cel = (u, v) => { const f = F[u][v], p = F.PIR[v]; if (f == null) return '<td class="n" style="padding:5px 3px">·</td>'; const d = p - f; return `<td class="n" style="padding:5px 3px;${u !== 'PIR' && d > 0.02 ? heat(d, 0.2) : ''}">${f2(f)}</td>`; };
  const v26 = vs.filter(v => v >= '2026' && v <= '2026-09');
  slide(`
  <div class="kicker">Ponto 3 · a mudança no detalhe</div>
  <h2>Matriz do fator de crédito: Cuiabá cai em jan/26, Macacu sobe, Piraí não muda</h2>
  <table class="compacta" style="margin-top:14px;font-size:10.5px"><tr><th>Fator</th>${vs.map(v => `<th class="n" style="padding:6px 3px${v === '2026-01' ? `;color:${ACC}` : ''}">${mv(v)}</th>`).join('')}</tr>
  ${['CBA', 'MCC', 'PIR'].map(u => `<tr><td style="white-space:nowrap"><b>${NOME[u]}</b></td>${vs.map(v => cel(u, v)).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:6px">Fator = preço do diesel com crédito ÷ preço pago, mediana do mês. Vermelho = abaixo de Piraí (mais forte, mais abaixo). Em ago/25, Macacu usa só a 2ª quinzena: a 1ª, com o preço lançado a R$ 1,85, ficou fora.</p>
  <h3 style="margin-top:14px">Quanto o fator mais baixo tirou em 2026, mês a mês</h3>
  <table class="compacta" style="margin-top:6px"><tr><th>R$ mil</th>${v26.map(v => `<th class="n">${mv(v)}</th>`).join('')}<th class="n">2026</th><th>Referência usada</th></tr>
  ${['CBA', 'MCC'].map(u => `<tr><td><b>${NOME[u]}</b></td>${v26.map(v => `<td class="n">${k1(IM[u + '|' + v])}</td>`).join('')}<td class="n"><b>${k1(FI[u + '|2026'].imp)}</b></td><td>${u === 'CBA' ? 'o fator dela em 2025 (0,94)' : 'o fator de Piraí no mês'}</td></tr>`).join('')}
  <tr><td><b>Total</b></td>${v26.map(v => `<td class="n"><b>${k1((IM['CBA|' + v] || 0) + (IM['MCC|' + v] || 0))}</b></td>`).join('')}<td class="n"><b>${k1(f26)}</b></td><td></td></tr></table>
  <p class="note" style="margin-top:6px">Valor = remunerado de diesel da DRE (Empurrada + Insumos) × (fator de referência ÷ fator do mês − 1). Outubro ainda não tem DRE. Em 2025 Macacu já estava abaixo de Piraí (R$ ${mil(FI['MCC|2025'].imp)} no ano), assunto do material histórico.</p>`);
}

// ═══ 9 · ponto 4 · Km/L ═══
slide(`
  <div class="kicker">Ponto 4 · combustível · Km/L remunerado</div>
  <h2>O Km/L remunerado do 4º trimestre não foi revisto, e há cadastro errado</h2>
  <div class="grid g2" style="margin-top:14px;gap:24px;align-items:start">
    <div>
      ${passo('Como deveria ser', 'A Ambev revisa o Km/L de cada placa por trimestre.', 'Na 1ª quinzena do trimestre entra o Km/L validado no trimestre anterior. O combustível do caminhão no FT = (preço + Arla) ÷ esse Km/L: Km/L alto demais, a Ambev paga menos litros do que gastamos.')}
      ${passo('O que acontece', `Em out/26 nenhuma das ${K.q3q4_iguais} placas mudou.`, `O especialista da Ambev saiu no meio do 3º trimestre e a revisão do 4º não aconteceu. Fora dela: ${K.fora} placas mudaram de valor sem revisão, ${K.zeradas} placas ativas ficaram com consumo zero na 1ª abr e, em ${K.comDif} de ${K.grupos} grupos, o mesmo modelo na mesma operação tem réguas diferentes.`)}
      ${passo('Quanto vale', `${f0(K.disp_lit)} L contra nós só na régua diferente do mesmo modelo (~R$ ${mil(K.disp_rs)}).`, 'O valor maior é a revisão do Q4, que só a Ambev consegue calcular.')}
      ${passo('O que pedir', 'A data da revisão do Q4 e se ela volta a outubro.', 'O acerto das placas zeradas, das mudanças fora da revisão e a placa "TESTE" ativa em Guarulhos UDC.')}
      <div>${tag('alta')} <span class="note">tudo está no próprio FT, quinzena a quinzena.</span></div>
    </div>
    <div>
      <div class="grid g2" style="gap:12px">
        <div class="box"><div class="lbl">Placas que mudaram no Q4</div><div class="num">${K.q3q4_mudaram}<small> de ${K.q3q4_iguais}</small></div></div>
        <div class="box"><div class="lbl">Mudaram fora da revisão</div><div class="num">${K.fora}</div></div>
        <div class="box"><div class="lbl">Ativas com consumo zero</div><div class="num">${K.zeradas}</div></div>
        <div class="box"><div class="lbl">Grupos com réguas diferentes</div><div class="num">${K.comDif}<small> de ${K.grupos}</small></div></div>
      </div>
      <div style="margin-top:14px">${escuro('<b>O detalhe já está pronto:</b> o PDF "Consumo remunerado Km/L 2026" (21/10) traz as matrizes placa × quinzena, e a planilha de cobrança (abas G1 a G8) cada placa e o que pedir.')}</div>
    </div>
  </div>`);

// ═══ 10 · o que não é oportunidade ═══
{
  const P = Object.entries(PAR).sort((a, b) => b[1].fixo_parado_ano - a[1].fixo_parado_ano);
  slide(`
  <div class="kicker">Conferimos e não vai para a mesa</div>
  <h2>Três coisas que parecem perda e não são</h2>
  <div class="grid g3" style="margin-top:14px;gap:18px;align-items:start">
    <div class="box"><h3>Caminhão inativo que roda</h3><p>${f1(K.km_inat_pct)}% do km de 2026 foi rodado por placa inativa no FT. Mas, no T2, <b>o caminhão parado recebe o fixo</b> de parado e o variável sai dos ativos × mapas. O inativo que roda está, em regra, cobrindo um ativo parado: o mapa é pago do mesmo jeito.</p>
      <table class="compacta" style="margin-top:8px"><tr><th>2026</th><th class="n">Parados/mês</th><th class="n">Fixo parado</th></tr>
      ${P.map(([u, x]) => `<tr><td>${NOME[u]}</td><td class="n">${f1(x.parados)}</td><td class="n">R$ ${mil(x.fixo_parado_ano)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td class="n"><b>${f0(parN)}</b></td><td class="n"><b>R$ ${mi(parTot)}</b></td></tr></table>
      <p class="note" style="margin-top:4px">Resumo do FT, jan–out/26. Na Empurrada o pagamento é por trecho; esse caso não foi analisado aqui.</p></div>
    <div class="box"><h3>Km do FT maior que o pago</h3><p>O km do FT (km da placa × ativos) é o <b>teto</b>. Em 2026 (jan–ago) o teto foi ${mi(O.km['2026'].teto).replace(' mi', ' mi km')} e a Ambev pagou ${mi(O.km['2026'].pago).replace(' mi', ' mi km')}. A diferença é mapa que não rodou (${f1(100 - O.km['2026'].aprov)}% dos mapas possíveis): assunto nosso, na lição de casa.</p></div>
    <div class="box"><h3>Preço do diesel</h3><p>Em ${Math.round(A.comb_regra.igual_min * 100)}% dos ${f0(A.comb_regra.diesel_regs)} preços desde 2022 o FT pagou o menor entre o nosso e a ANP, como diz a regra. Em 2026 não há preço lançado errado. O único caso (Macacu, 1ª ago/25, R$ 1,85/L) é de 2025 e está no material histórico.</p>
      <p style="margin-top:8px">Também batem: o R$/km do caminhão com a soma das quatro parcelas, o km por mapa com o km por viagem da Dispersão (${f2(A.km_kmv.mediana)}), e a frota ativa, a lavagem e o IPVA (±2%).</p></div>
  </div>`);
}

// ═══ 11 · lição de casa ═══
{
  const UN = Object.entries(O.uni).sort((a, b) => b[1].rs_nao - a[1].rs_nao), D = O.diesel26;
  const dT = Object.values(D).reduce((s, x) => s + x.perda, 0);
  const top = Object.entries(D).filter(([, x]) => x.perda > 0).sort((a, b) => b[1].perda - a[1].perda).slice(0, 6);
  slide(`
  <div class="kicker">Lição de casa de 2026 · não vai para a Ambev</div>
  <h2>O que é nosso: mapa que não rodou, diesel acima da ANP e dispersão</h2>
  <div class="grid g3" style="margin-top:14px;gap:18px;align-items:start">
    <div class="box"><h3>Mapa que não rodou</h3><div class="num">R$ ${mi(O.km['2026'].rs_nao)}</div><p>de variável que não entrou (jan–ago): mapa possível que não virou viagem × km por viagem × R$/km. A causa mais comum é manutenção que se estende.</p>
      <table class="compacta" style="margin-top:6px"><tr><th>Unidade</th><th class="n">Mapas</th><th class="n">%</th><th class="n">R$ mil</th></tr>${UN.slice(0, 6).map(([u, x]) => `<tr><td style="white-space:nowrap">${NOME[u]}</td><td class="n">${f0(x.nao_rod)}</td><td class="n">${f0(x.nao_rod / x.mapas_pos * 100)}%</td><td class="n">${k1(x.rs_nao)}</td></tr>`).join('')}</table></div>
    <div class="box"><h3>Diesel acima da ANP</h3><div class="num">R$ ${mil(dT)}</div><p>O FT paga a ANP; o que compramos acima sai do nosso bolso (ERP, S10, notas encerradas, quinzena a quinzena).</p>
      <table class="compacta" style="margin-top:6px"><tr><th>Unidade</th><th class="n">Acima</th></tr>${top.map(([k, x]) => { const [c, u] = k.split('|'); return `<tr><td>${NOME[u]}${c === 'T2' ? '' : ' · Empurrada'}</td><td class="n">R$ ${mil(x.perda)}</td></tr>`; }).join('')}</table></div>
    <div class="box"><h3>Dispersão de km</h3><p>Km rodado acima do km pago é custo nosso (meta 5%). Em 2026 (jan–ago):</p>
      <table class="compacta" style="margin-top:6px"><tr><th>Unidade</th><th class="n">Pago</th><th class="n">Rodado</th><th class="n">Δ</th></tr>${Object.entries(O.uni).sort((a, b) => b[1].disp - a[1].disp).map(([u, x]) => `<tr><td>${NOME[u]}</td><td class="n">${mil(x.pago)}</td><td class="n">${mil(x.rodado)}</td><td class="n"${x.disp > 5 ? ` style="color:${ACC}"` : ''}>${f1(x.disp)}%</td></tr>`).join('')}</table></div>
  </div>`);
}

// ═══ 12 · próximos passos ═══
slide(`
  <div class="kicker">Próximos passos</div>
  <h2>Como levar: validar dentro, fiscal, e a pauta por confiança</h2>
  <div class="grid g3" style="margin-top:16px;gap:18px">
    <div class="box"><h3>1. Unidades (1 semana)</h3><p>Com a planilha anexa: as unidades confirmam as placas do ponto 2 (quem pagou a manutenção?) e conferem as placas com fatura VW do ponto 1.</p></div>
    <div class="box"><h3>2. Fiscal e planejamento</h3><p>Fiscal: o crédito de imposto do diesel que recuperamos em Cuiabá, Macacu e Piraí (ponto 3). Planejamento: como o remunerado da DRE é montado, para não cobrar da Ambev uma diferença que é da nossa conta.</p></div>
    <div class="box"><h3>3. Pauta com a Ambev</h3><p>Primeiro o que é fato no FT: a revisão do Km/L do Q4 e os cadastros (ponto 4). Depois a manutenção (pontos 1 e 2), com a fatura VW e a lista de placas. Por último o fator de crédito, se o fiscal confirmar.</p></div>
  </div>
  <div style="margin-top:18px">${escuro(`<b>Base:</b> robô do Freightech (todas as quinzenas de 2026, 5 canais), fatura do portal Volks|Total, abastecimentos do ERP, DRE Frota, Dispersão de km e a análise do Km/L remunerado de 21/10. Tudo lido do banco do portal e reproduzível.`)}</div>`);

console.log('ok', write(process.env.FT_HTML || 'ft2026.html'), 'slides');

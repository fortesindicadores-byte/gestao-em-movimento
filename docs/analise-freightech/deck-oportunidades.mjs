// ============================================================
// Deck "Oportunidades de questionamento com a Ambev" (2022→2026, foco em 2026)
// a partir do opo.json (oportunidades.py) e do dados.json (analise.py).
//   OPO=…/opo.json FT_DADOS=…/dados.json FT_HTML=…/oportunidades.html node deck-oportunidades.mjs
// O HTML e o PDF NÃO vão para o repositório (remuneração da Ambev).
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, bars, lines, f0, f1, f2, f3, mi, mil, rs, pct, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3 } from './deck-base.mjs';
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const A = JSON.parse(readFileSync(process.env.FT_DADOS || 'dados.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Oportunidades de questionamento com a Ambev · Freightech 2022–2026 · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Oportunidades com a Ambev' });
const tag = c => `<span class="tag ${c}">${{ alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' }[c]}</span>`;
const ficha = (o) => `<dl class="ficha">
  <dt>O que é</dt><dd>${o.oque}</dd><dt>Como o FT paga</dt><dd>${o.como}</dd><dt>O que achamos</dt><dd>${o.achado}</dd>
  <dt>Quanto vale</dt><dd>${o.vale}</dd><dt>O que perguntar</dt><dd>${o.pergunta}</dd><dt>Confiança</dt><dd>${tag(o.conf)} ${o.porque}</dd></dl>`;
const soma = (o, k) => Object.values(o).reduce((s, x) => s + (x[k] || 0), 0);

// ── números ──
const VW = O.vw.ano, v25 = VW['2025'], v26 = VW['2026'], vwTot = v25.gap + v26.gap, vwFt0 = v25.gap_ft0 + v26.gap_ft0;
const Z = O.zero.ano, ANOS = ['2022', '2023', '2024', '2025', '2026'];
const zTot = soma(Z, 'sem_vw_bid'), zIrm = soma(Z, 'sem_vw_irm'), z26 = Z['2026'];
const P = O.preco, pRota = P.valor, pEmp = P.emp.perda;
const FI = O.fator.impacto, fTot = Object.values(FI).reduce((s, x) => s + x.imp, 0);
const K = O.kml;
const ALTA_MEDIA = vwTot + zTot + pRota + pEmp;

// ═══ 1 · capa ═══
capa('Freightech · 2022 a 2026, com foco em 2026', 'Oportunidades de questionamento com a Ambev',
  `O que o Freightech paga, o que as nossas bases mostram e onde vale perguntar. Cada oportunidade vem com a conta, o valor, a pergunta pronta e o quanto confiamos nela. No fim, o que é lição de casa nossa e não vai para a mesa.`);

// ═══ 2 · como ler ═══
slide(`
  <div class="kicker">Antes de começar</div>
  <h2>Como a Ambev nos paga, em três frases, e como ler cada oportunidade</h2>
  <div class="grid g2" style="margin-top:16px;gap:22px;align-items:start">
    <div>
      <div class="step"><b>1. A Ambev paga por MAPA RODADO.</b><span>Cada caminhão ativo tem um km por mapa. O teto do mês é esse km × 25 dias úteis; o que entra é o km dos mapas que rodaram de fato.</span></div>
      <div class="step"><b>2. Cada km vale o R$/km do caminhão.</b><span>R$/km = combustível + manutenção + carroceria + pneu. Cada parcela tem a sua conta e as suas premissas, todas no Freightech (FT), placa a placa e quinzena a quinzena.</span></div>
      <div class="step"><b>3. O fixo vem à parte.</b><span>Depreciação, finame, equipe, seguro, IPVA: pagos pelo caminhão ativo, rode ou não rode. Este material olha o VARIÁVEL, que é onde as premissas mudam.</span></div>
    </div>
    <div class="box">
      <h3>Cada oportunidade tem a mesma ficha</h3>
      <dl class="ficha" style="margin-top:8px">
        <dt>O que é</dt><dd>o assunto, em uma linha</dd><dt>Como o FT paga</dt><dd>a regra que está no sistema</dd>
        <dt>O que achamos</dt><dd>o que as nossas bases mostram</dd><dt>Quanto vale</dt><dd>a ordem de grandeza, com o período</dd>
        <dt>O que perguntar</dt><dd>a pergunta pronta para a reunião</dd><dt>Confiança</dt><dd>${tag('alta')} provado placa a placa · ${tag('media')} provado, mas depende de regra que a Ambev define · ${tag('baixa')} precisa de confirmação interna antes</dd>
      </dl>
    </div>
  </div>
  <div style="margin-top:14px">${escuro('<b>Regra deste material:</b> só vai para a Ambev o que dá para provar com a base dela (o FT) contra a nossa. O que é falha nossa (comprar diesel acima da ANP, mapa que não rodou) fica numa seção à parte, como lição de casa.')}</div>`);

// ═══ 3 · resumo ═══
slide(`
  <div class="kicker">Resumo</div>
  <h2>Seis oportunidades, R$ ${mi(ALTA_MEDIA + fTot)} na mesa, R$ ${mi(ALTA_MEDIA)} com confiança alta ou média</h2>
  <table style="margin-top:14px">
    <tr><th>#</th><th>Oportunidade</th><th>Período</th><th class="n">Ordem de grandeza</th><th>Confiança</th></tr>
    <tr><td>1</td><td><b>Contrato da montadora acima do que o FT paga de manutenção</b><br><span class="note">fatura VW × R$/km de manutenção do FT, placa a placa e mês a mês</span></td><td>2025–2026</td><td class="n"><b>R$ ${mil(vwTot)}</b></td><td>${tag('media')}</td></tr>
    <tr><td>2</td><td><b>Manutenção zero no FT em caminhão fora da carência</b><br><span class="note">placas com mais de 24 meses e R$/km zero, sem contrato VW no mês</span></td><td>2022–2026</td><td class="n"><b>R$ ${mi(zTot)}</b><br><span class="note">ao BID do próprio FT</span></td><td>${tag('media')}</td></tr>
    <tr><td>3</td><td><b>Preço do diesel lançado errado</b> (Macacu, 1ª quinzena de ago/25)</td><td>2025</td><td class="n"><b>R$ ${mil(pRota)}</b> Rota<br>+ ~R$ ${mil(pEmp)} Empurrada</td><td>${tag('alta')}</td></tr>
    <tr><td>4</td><td><b>Fator de crédito de imposto no diesel da Empurrada</b><br><span class="note">Cuiabá caiu de ${f2(O.fator.ano.CBA['2025'])} para ${f2(O.fator.ano.CBA['2026'])} em jan/26; Macacu abaixo de Piraí (mesmo estado)</span></td><td>2025–2026</td><td class="n"><b>~R$ ${mi(fTot)}</b></td><td>${tag('baixa')}</td></tr>
    <tr><td>5</td><td><b>Km/L remunerado</b>: revisão do 4º trimestre não feita, valores mudados fora da revisão, placas ativas zeradas</td><td>2026</td><td class="n">régua do Q3 congelada<br><span class="note">${f0(K.disp_lit)} L só na dispersão</span></td><td>${tag('alta')}</td></tr>
    <tr><td>6</td><td><b>Caminhão que roda sem estar ativo no FT</b></td><td>2026</td><td class="n">${mi(K.km_inat).replace(' mi', ' mi km')}<br><span class="note">${f1(K.km_inat_pct)}% do km rodado</span></td><td>${tag('baixa')}</td></tr>
  </table>
  <div style="margin-top:12px">${escuro(`<b>Leitura:</b> os itens 1 e 2 são o mesmo assunto visto de dois lados (manutenção que pagamos e o FT não reconhece) e somam R$ ${mi(vwTot + zTot)}; não há dupla contagem, porque o item 2 tira as placas que têm fatura VW no mês. O item 4 é grande e o mais incerto: começa no fiscal, não na Ambev.`)}</div>`);

// ═══ 4 · o que está certo ═══
{
  const I = A.ident, KV = A.km_kmv, CR = A.comb_regra;
  slide(`
  <div class="kicker">Credibilidade</div>
  <h2>Antes de questionar: o que o FT faz certo (e conferimos)</h2>
  <p style="margin-top:6px;max-width:1000px">Chegar à Ambev dizendo que "o FT está errado" não funciona e não é verdade. Conferimos as regras centrais contra as nossas bases e elas batem. As oportunidades são <b>pontuais</b>: premissas que mudaram, campos zerados, um preço digitado errado.</p>
  <div class="grid g4" style="margin-top:16px;gap:14px">
    <div class="box"><div class="lbl">Preço do diesel</div><div class="num">${Math.round(CR.igual_min * 100)}%</div><p>dos ${f0(CR.diesel_regs)} preços de diesel pagos = o <b>menor</b> entre o nosso e a ANP. A regra é aplicada sempre.</p></div>
    <div class="box"><div class="lbl">R$/km do caminhão</div><div class="num">${f2(I.rskm_max)}</div><p>maior diferença entre o R$/km total e a soma das quatro parcelas, em ${f0(I.registros)} registros. A conta fecha.</p></div>
    <div class="box"><div class="lbl">Km por mapa</div><div class="num">${f2(KV.mediana)}</div><p>razão entre o km por mapa do FT e o km por viagem da nossa Dispersão (mediana de ${KV.n} unidade-mês).</p></div>
    <div class="box"><div class="lbl">Frota, lavagem, IPVA</div><div class="num">±2%</div><p>frota ativa do FT × Dispersão; lavagem e IPVA do FT × remunerado da DRE ficam a ±1%.</p></div>
  </div>
  <div style="margin-top:16px">${escuro('<b>O que isso quer dizer:</b> o FT é uma planilha de custo por caminhão, bem montada. O que muda o valor são as <b>premissas</b> (preço, Km/L, contrato de manutenção, crédito de imposto) e os <b>cadastros</b> (placa ativa, campo zerado). É nelas que estão as oportunidades.')}</div>`);
}

// ═══ Parte 1 · manutenção ═══
capa('Parte 1', 'Manutenção: o que pagamos e o FT não reconhece', 'O FT paga a manutenção do caminhão por km rodado. O valor sai do contrato de manutenção da placa (R$/km), com um BID de referência e uma carência de caminhão novo. Duas oportunidades: o contrato da montadora maior que o FT e placas fora da carência com R$/km zero.');

// O1
{
  const U = Object.entries(O.vw.uni26).sort((a, b) => b[1].gap - a[1].gap);
  slide(`
  <div class="kicker">Oportunidade 1 · manutenção</div>
  <h2>O contrato da montadora cobra mais por km do que o FT paga de manutenção</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${ficha({ oque: 'Nas placas com contrato de manutenção da VW, o R$/km da fatura é maior que o R$/km de manutenção que o FT paga para a mesma placa, no mesmo mês.',
      como: 'R$/km de manutenção da placa = <b>manutencaoContrato</b> (o contrato cadastrado no FT); zero na carência do caminhão novo.',
      achado: `Fatura VW média de R$ ${f3(v26.rk_vw)}/km contra R$ ${f3(v26.rk_ft)}/km no FT em 2026 (R$ ${f3(v25.rk_vw)} × ${f3(v25.rk_ft)} em 2025). Em ${v26.pl_ft0} placas de 2026 o FT está com <b>zero</b> e a VW cobrando.`,
      vale: `R$ ${mil(v25.gap)} em 2025 e R$ ${mil(v26.gap)} em 2026 (fev–out): <b>R$ ${mil(vwTot)}</b>. Só nas placas com FT zero: R$ ${mil(vwFt0)}.`,
      pergunta: 'O contrato da montadora está cadastrado no FT com o valor atual? Por que estas placas, com contrato ativo e fatura mensal, aparecem com R$/km de manutenção zero ou menor?',
      conf: 'media', porque: 'a conta é placa a placa e mês a mês; a Ambev pode responder que o FT paga um valor de referência, e não o nosso contrato.' })}
    <div>
      <table class="compacta"><tr><th>Ano</th><th class="n">Placas</th><th class="n">Km faturado</th><th class="n">Fatura VW</th><th class="n">Diferença</th><th class="n">Com FT zero</th></tr>
      ${['2025', '2026'].map(a => `<tr><td>${a}</td><td class="n">${VW[a].placas}</td><td class="n">${f0(VW[a].km)}</td><td class="n">R$ ${mil(VW[a].fatura)}</td><td class="n"><b>R$ ${mil(VW[a].gap)}</b></td><td class="n">R$ ${mil(VW[a].gap_ft0)} · ${VW[a].pl_ft0} pl.</td></tr>`).join('')}
      </table>
      <table class="compacta" style="margin-top:12px"><tr><th>2026 · unidade</th><th class="n">Placas</th><th class="n">Diferença</th><th class="n">Com FT zero</th></tr>
      ${U.map(([u, x]) => `<tr><td>${NOME[u] || u}</td><td class="n">${x.placas}</td><td class="n">R$ ${mil(x.gap)}</td><td class="n">R$ ${mil(x.gap_ft0)}</td></tr>`).join('')}
      </table>
      <p class="note" style="margin-top:8px">Diferença = (R$/km da fatura − R$/km do FT) × km faturado. Fatura de jan/26 não existe no portal da VW (só 1 linha); por isso 2026 é fev–out. Detalhe placa a placa na planilha anexa.</p>
    </div>
  </div>`);
  const M = O.vw.mes, mk = Object.keys(M).sort();
  slide(`
  <div class="kicker">Oportunidade 1 · onde está a diferença</div>
  <h2>A diferença dobrou de meados de 2025 para cá, e se concentra em poucas placas</h2>
  <div style="margin-top:10px">${bars({ w: 1136, h: 210, labels: mk.map(v => MES[+v.slice(5) - 1] + '/' + v.slice(2, 4)), data: mk.map(v => M[v]), cor: i => mk[i] < '2026' ? '#9AA3AF' : INK, fmt: v => mil(v).replace(' mil', '') })}</div>
  <p class="note">Diferença por mês, em R$ mil (cinza = 2025, preto = 2026).</p>
  <div class="grid g2" style="margin-top:10px;gap:22px;align-items:start">
    <table class="compacta"><tr><th>Placas com maior diferença em 2026</th><th>Unid.</th><th>Modelo</th><th class="n">Km</th><th class="n">VW R$/km</th><th class="n">FT R$/km</th><th class="n">Diferença</th></tr>
    ${O.vw.top26.map(p => `<tr><td>${p.pl}</td><td>${p.cod}</td><td>${p.mod}</td><td class="n">${f0(p.km)}</td><td class="n">${f3(p.rk_vw)}</td><td class="n">${f3(p.rk_ft)}</td><td class="n">R$ ${mil(p.gap)}</td></tr>`).join('')}
    </table>
    ${escuro(`<b>Para a reunião:</b> levar as placas da tabela com a fatura VW do mês. O caso mais forte são as placas com contrato ativo e manutenção <b>zero</b> no FT (R$ ${mil(vwFt0)} em 21 meses): o caminhão não está na carência, a montadora cobra todo mês e o FT não paga nada.<br><br><b>Por que cresceu:</b> as placas com contrato VW e manutenção zero no FT eram 4 por mês até jun/25, 14 no 2º semestre de 2025 e chegaram a 44–51 em mai–jun/26. No mesmo período o R$/km médio do FT nessas placas caiu de ~0,75 para ~0,55, enquanto a fatura ficou entre 0,74 e 0,87.`)}
  </div>`);
}

// O2
{
  const U = Object.entries(O.zero.uni26).sort((a, b) => b[1].pot_bid - a[1].pot_bid);
  slide(`
  <div class="kicker">Oportunidade 2 · manutenção</div>
  <h2>Caminhão com mais de 24 meses e manutenção zero no FT</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${ficha({ oque: 'Placas ativas, com mais de 24 meses de vida, com R$/km de manutenção <b>zero</b> no FT e sem fatura de contrato VW no mês.',
      como: 'O caminhão novo tem carência de manutenção: o campo do FT diz 6 meses e, na prática, a carência é maior. Usamos 24 meses como corte seguro. Depois dela o FT deveria pagar o contrato ou, sem contrato, algo perto do BID.',
      achado: `Em 2026, ${z26.placas} placas zeradas com vida mediana de ${f1(O.zero.vida26)} meses; ${z26.sem_vw_pl} delas sem nenhuma fatura VW. Em ${z26.irm_pl} das ${z26.placas}, outras placas do mesmo modelo e unidade recebem manutenção normalmente.`,
      vale: `Ao BID do próprio FT, sem as placas com fatura VW: <b>R$ ${mi(zTot)}</b> de 2022 a 2026 (R$ ${mil(z26.sem_vw_bid)} em 2026). Ao R$/km das irmãs que recebem: R$ ${mi(zIrm)}.`,
      pergunta: 'Por que estas placas, fora da carência, não têm R$/km de manutenção? Qual é a regra para o caminhão que saiu da carência e não tem contrato?',
      conf: 'media', porque: 'o zero está no FT, placa a placa; falta a unidade confirmar quem pagou a manutenção dessas placas (oficina própria, garantia estendida).' })}
    <div>
      ${bars({ w: 520, h: 190, labels: ANOS, data: ANOS.map(a => Z[a].sem_vw_bid), fmt: v => mil(v).replace(' mil', '') })}
      <p class="note">Potencial ao BID, sem as placas com fatura VW, em R$ mil por ano (2026 = jan–out).</p>
      <table class="compacta" style="margin-top:8px"><tr><th>2026 · unidade (sem fatura VW)</th><th class="n">Placas</th><th class="n">Ao BID</th><th class="n">Às irmãs</th></tr>
      ${U.map(([u, x]) => `<tr><td>${NOME[u] || u}</td><td class="n">${x.placas}</td><td class="n">R$ ${mil(x.pot_bid)}</td><td class="n">R$ ${mil(x.pot_irm)}</td></tr>`).join('')}
      </table>
    </div>
  </div>
  <p class="note" style="margin-top:8px">Potencial = BID R$/km × km por mapa do FT, quinzena a quinzena. É o teto: o pago de verdade seria proporcional aos mapas rodados (~90%). Em 2023 as ${Z['2023'].placas} placas zeradas também estavam sem BID no FT; ao R$/km das irmãs dariam R$ ${mil(Z['2023'].sem_vw_irm)}. A planilha anexa traz as placas e as quinzenas.</p>`);
}

// ═══ Parte 2 · combustível ═══
capa('Parte 2', 'Combustível: preço, crédito de imposto e Km/L', 'O FT paga o combustível por km: (preço do diesel + Arla) ÷ Km/L remunerado. O preço é o menor entre o que declaramos e a ANP; na Empurrada o preço ainda passa por um fator de crédito de imposto. O Km/L é revisado por trimestre.');

// O3
{
  const E = P.emp;
  slide(`
  <div class="kicker">Oportunidade 3 · combustível</div>
  <h2>Diesel de Macacu lançado a R$ ${f2(P.baixo[0].op)}/L na 1ª quinzena de agosto de 2025</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${ficha({ oque: `Na 1ª quinzena de ago/25 o preço do diesel S10 de Macacu entrou no FT a R$ ${f2(P.baixo[0].op)}/L, com a ANP a R$ ${f2(P.baixo[0].anp)}/L. Na quinzena seguinte voltou ao normal.`,
      como: 'Preço pago = o menor entre o nosso preço declarado e a ANP. Com o nosso lançado a R$ 1,85, o FT pagou R$ 1,85.',
      achado: `É o único caso, em ${f0(P.registros)} preços de diesel desde 2022, de preço abaixo de 60% da ANP fora das unidades com tanque interno. Afetou a Rota e a Empurrada: o diesel do trecho caiu de R$ ${f2(E.rskm_normal)}/km para R$ ${f2(E.rskm_erro)}/km.`,
      vale: `Rota: <b>R$ ${mil(pRota)}</b> (${f0(P.lit)} L das placas ativas × diferença para a ANP). Empurrada: ~<b>R$ ${mil(pEmp)}</b> (meia quinzena de diesel de julho com o R$/km da quinzena errada).`,
      pergunta: 'Pedir o retroativo da 1ª quinzena de ago/25 de Macacu, Rota e Empurrada, ao preço da ANP (ou ao nosso preço real da nota, se menor).',
      conf: 'alta', porque: 'digitação evidente, isolada, com a ANP no próprio FT ao lado.' })}
    <div>
      <table class="compacta"><tr><th>Macacu · diesel S10</th><th class="n">Nosso preço</th><th class="n">ANP</th><th class="n">Pago</th></tr>
        <tr><td>jul/25</td><td class="n">R$ 6,73</td><td class="n">R$ 6,24</td><td class="n">R$ 6,24</td></tr>
        <tr><td><b>1ª ago/25</b></td><td class="n"><b>R$ ${f2(P.baixo[0].op)}</b></td><td class="n">R$ ${f2(P.baixo[0].anp)}</td><td class="n" style="color:${ACC}"><b>R$ ${f2(P.baixo[0].op)}</b></td></tr>
        <tr><td>2ª ago/25</td><td class="n">R$ 5,99</td><td class="n">R$ 5,99</td><td class="n">R$ 5,99</td></tr>
      </table>
      <div style="margin-top:14px">${escuro(`<b>Atenção na Empurrada:</b> a DRE de agosto (R$ ${mil(E.dre_ago)} de remunerado de diesel) não mostra a queda em relação a julho (R$ ${mil(E.dre_jul)}). Antes de pedir, conferir com o planejamento o que a Ambev pagou de fato nos trechos daquela quinzena. Se o pagamento seguiu o FT, os R$ ${mil(pEmp)} entram no pedido.`)}</div>
    </div>
  </div>`);
}

// O4
{
  const SE = O.fator.serie, lab = SE.k.map(k => { const [a, m, q] = k.split('-'); return q === '1' && (+m === 1 || +m === 7) ? MES[+m - 1] + '/' + a.slice(2) : ''; });
  const FA = O.fator.ano;
  slide(`
  <div class="kicker">Oportunidade 4 · combustível · Empurrada</div>
  <h2>O fator de crédito de imposto da Empurrada mudou em jan/26 e os de Cuiabá e Macacu parecem ter trocado de lugar</h2>
  <div style="margin-top:8px">${lines({ w: 1136, h: 130, pad: { l: 50, r: 80, t: 12, b: 26 }, labels: lab, y0: 0.7, y1: 1.0, yfmt: v => f2(v), series: [
    { data: SE.CBA, cor: ACC, rotulo: 'Cuiabá' }, { data: SE.MCC, cor: AZUL, rotulo: 'Macacu' }, { data: SE.PIR, cor: INK3, rotulo: 'Piraí' }] })}</div>
  <p class="note">Fator = preço do diesel com crédito de imposto ÷ preço pago (o menor entre o nosso e a ANP), por quinzena, de 2024 a out/26. A quinzena do erro de ago/25 de Macacu ficou fora.</p>
  <div class="grid g2" style="margin-top:10px;gap:22px;align-items:start">
    ${ficha({ oque: 'Na Empurrada o FT desconta do diesel o imposto que a Ambev entende que recuperamos. Diesel do trecho = preço pago × fator ÷ Km/L. Fator menor, pagamento menor.',
      como: 'Fator por unidade e quinzena, na tabela de combustível da Empurrada.',
      achado: `Cuiabá ficou em ${f2(FA.CBA['2025'])} em 2024–25 e caiu para ${f2(FA.CBA['2026'])} em jan/26. Macacu fez o caminho inverso (${f2(FA.MCC['2025'])} → ${f2(FA.MCC['2026'])}). Piraí, no mesmo estado de Macacu, ficou sempre em ${f2(FA.PIR['2026'])}.`,
      vale: `Se Cuiabá tivesse ficado em 0,94 em 2026 e Macacu tivesse o fator de Piraí: <b>~R$ ${mi(fTot)}</b> (jan/25–set/26), sobre o remunerado de diesel da DRE.`,
      pergunta: 'Qual crédito de imposto o FT considera em Cuiabá e em Macacu, e por que mudou em jan/26? A troca entre as duas foi intencional?',
      conf: 'baixa', porque: 'depende do regime fiscal de cada unidade: o fiscal confirma antes.' })}
    <table class="compacta"><tr><th>Unidade · ano</th><th class="n">Remunerado diesel</th><th class="n">Fator</th><th class="n">Referência</th><th class="n">Diferença</th></tr>
    ${Object.entries(FI).filter(([, x]) => x.imp > 0).map(([k, x]) => { const [u, a] = k.split('|'); return `<tr><td>${NOME[u]} · ${a}</td><td class="n">R$ ${mil(x.rem)}</td><td class="n">${f3(x.f)}</td><td class="n">${f3(x.ref)}</td><td class="n"><b>R$ ${mil(x.imp)}</b></td></tr>`; }).join('')}
    <tr><td colspan="4"><b>Total</b></td><td class="n"><b>R$ ${mil(fTot)}</b></td></tr></table>
  </div>`);
}

// O5
slide(`
  <div class="kicker">Oportunidade 5 · combustível · Km/L</div>
  <h2>Km/L remunerado: o 4º trimestre roda com a régua do 3º, e há mudanças fora da revisão</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${ficha({ oque: 'O Km/L remunerado de cada placa é revisto por trimestre (a Ambev valida o consumo do trimestre anterior e aplica no seguinte). A revisão de out/26 não aconteceu: o especialista da Ambev saiu no meio do 3º trimestre.',
      como: 'Combustível R$/km = (preço + Arla) ÷ Km/L remunerado da placa. Km/L mais alto que o real = Ambev paga menos litros do que gastamos.',
      achado: `Em outubro <b>nenhuma das ${K.q3q4_iguais} placas</b> mudou de valor. Desde julho houve mudanças fora da revisão (${K.fora} placas-operação). ${K.zeradas} placas ativas com consumo zero na 1ª quinzena de abril (Empurradas). Em ${K.comDif} de ${K.grupos} grupos o mesmo modelo, na mesma operação, tem réguas diferentes.`,
      vale: `A dispersão do mesmo modelo sozinha soma ${f0(K.disp_lit)} L contra nós em 2026 (~R$ ${mil(K.disp_rs)}). A revisão do Q4 não feita é o ponto maior, e o valor só sai quando a Ambev rodar a revisão.`,
      pergunta: 'Quando a revisão do 4º trimestre vai ser feita, e se ela retroage a outubro. Por que houve mudança de Km/L fora da revisão e placas ativas com consumo zero.',
      conf: 'alta', porque: 'os fatos estão no próprio FT, quinzena a quinzena; o valor depende da revisão.' })}
    <div>
      <div class="grid g2" style="gap:12px">
        <div class="box"><div class="lbl">Placas que mudaram no Q4</div><div class="num">${K.q3q4_mudaram}<small> de ${K.q3q4_iguais}</small></div></div>
        <div class="box"><div class="lbl">Mudaram fora da revisão</div><div class="num">${K.fora}</div></div>
        <div class="box"><div class="lbl">Ativas com consumo zero</div><div class="num">${K.zeradas}</div></div>
        <div class="box"><div class="lbl">Grupos com réguas diferentes</div><div class="num">${K.comDif}<small> de ${K.grupos}</small></div></div>
      </div>
      <div style="margin-top:14px">${escuro('<b>Material de apoio:</b> o PDF "Consumo remunerado Km/L 2026" (21/10) e a planilha de cobrança com as abas G1 a G8 trazem cada placa, cada quinzena e o que pedir. Este item resume aquele trabalho.')}</div>
    </div>
  </div>`);

// ═══ Parte 3 · frota ═══
{
  const KMa = O.km;
  slide(`
  <div class="kicker">Oportunidade 6 · frota</div>
  <h2>Um quarto do km de 2026 foi rodado por caminhão inativo no FT</h2>
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${ficha({ oque: 'Placas que abasteceram e rodaram no mês, mas estavam <b>inativas</b> no FT nas duas quinzenas.',
      como: 'A Ambev paga o fixo e o km por mapa só do caminhão ativo. O caminhão inativo que roda costuma estar substituindo um ativo parado; aí não há perda.',
      achado: `${mi(K.km_inat).replace(' mi', ' milhões de km')} (${f1(K.km_inat_pct)}% do km do ano) em ${K.pl_inat} placas. 32 placas rodaram de 7 a 9 meses inativas: a maior é a RXQ9A16 (Volvo FH 460, Piraí Empurrada, 157 mil km de jan a set), e seis VW 26.260 da Rota de Macacu rodaram inativas o ano todo.`,
      vale: 'Não dá para pôr um valor sem saber se cada uma substituiu um ativo. Se a frota ativa do FT for menor do que a operação precisa, o fixo de um caminhão fica de fora todo mês.',
      pergunta: 'A frota ativa do FT reflete o dimensionamento da operação? Placas que rodam o ano inteiro inativas deveriam estar ativas?',
      conf: 'baixa', porque: 'pede o cruzamento com as paradas (indisponibilidade) placa a placa antes de virar pedido.' })}
    <div>
      <h3>Não é oportunidade: o km do FT é um TETO</h3>
      <p style="font-size:13px;margin-top:4px">O km remunerado do FT (km por mapa × 25 × caminhões ativos) é o máximo. O que a Ambev paga é o km dos mapas que rodaram. A diferença é mapa que não rodou, e isso é gestão nossa (próxima seção).</p>
      <table class="compacta" style="margin-top:8px"><tr><th>Ano</th><th class="n">Teto FT</th><th class="n">Pago (Dispersão)</th><th class="n">Mapas rodados</th></tr>
      ${Object.entries(KMa).map(([a, x]) => `<tr><td>${a}${x.meses < 12 ? ` <span class="note">(${x.meses} meses)</span>` : ''}</td><td class="n">${mi(x.teto).replace(' mi', ' mi km')}</td><td class="n">${mi(x.pago).replace(' mi', ' mi km')}</td><td class="n">${f1(x.aprov)}%</td></tr>`).join('')}
      </table>
      <p class="note" style="margin-top:6px">Rota, Van e UDC, onde o FT tem o Resumo por unidade. A Dispersão de km começa em 2023.</p>
    </div>
  </div>`);
}

// ═══ lição de casa ═══
{
  const KMa = O.km, D26 = O.diesel26, dT = Object.values(D26).reduce((s, x) => s + x.perda, 0);
  const top = Object.entries(D26).filter(([, x]) => x.perda > 0).sort((a, b) => b[1].perda - a[1].perda).slice(0, 6);
  const UN = Object.entries(O.uni).sort((a, b) => b[1].rs_nao - a[1].rs_nao).slice(0, 5);
  slide(`
  <div class="kicker">Lição de casa · não vai para a Ambev</div>
  <h2>O que é nosso: mapa que não rodou e diesel comprado acima da ANP</h2>
  <div class="grid g3" style="margin-top:14px;gap:18px;align-items:start">
    <div class="box"><h3>Mapa que não rodou</h3><div class="num">R$ ${mi(KMa['2026'].rs_nao)}</div><p>de variável que não entrou em 2026 (jan–ago): ${f1(100 - KMa['2026'].aprov)}% dos mapas possíveis não viraram viagem. Em 2025 foram R$ ${mi(KMa['2025'].rs_nao)}. A causa mais comum é manutenção que se estende; o stress test exige ao menos uma viagem por mês.</p>
      <table class="compacta" style="margin-top:6px">${UN.map(([u, x]) => `<tr><td>${NOME[u]}</td><td class="n">${f0(x.nao_rod)} mapas</td><td class="n">R$ ${mil(x.rs_nao)}</td></tr>`).join('')}</table></div>
    <div class="box"><h3>Diesel acima da ANP</h3><div class="num">R$ ${mil(dT)}</div><p>em 2026 (ERP, S10, notas encerradas). O FT paga a ANP; o que compramos acima sai do nosso bolso. Assunto de negociação com posto, não de pedido à Ambev.</p>
      <table class="compacta" style="margin-top:6px"><tr><th>Unidade</th><th class="n">R$/L real × ANP</th><th class="n">Acima</th></tr>${top.map(([k, x]) => { const [c, u] = k.split('|'); return `<tr><td>${NOME[u]} ${c === 'T2' ? '' : '· Emp.'}</td><td class="n">${f2(x.real)} × ${f2(x.anp)}</td><td class="n">R$ ${mil(x.perda)}</td></tr>`; }).join('')}</table><p class="note" style="margin-top:4px">Preços médios do ano; a perda é contada quinzena a quinzena, por isso aparece mesmo quando a média fica abaixo da ANP.</p></div>
    <div class="box"><h3>Remunerado da DRE</h3><p>O remunerado da DRE é montado pelo planejamento a partir dos mapas (T2) e dos trechos (T1). Ao km pago, ele fica acima do FT em manutenção e pneus. Antes de qualquer pedido, alinhar com o planejamento como cada conta é composta, para não cobrar da Ambev uma diferença que é da nossa montagem.</p>
      <p style="margin-top:8px"><b>Dispersão de km:</b> km rodado acima do remunerado é custo nosso (meta 5%). Rondonópolis, Cuiabá e Camboriú passaram de 9% em 2026.</p></div>
  </div>`);
}

// ═══ como levar ═══
slide(`
  <div class="kicker">Próximos passos</div>
  <h2>Como levar: validar dentro, confirmar o fiscal, depois a reunião</h2>
  <div class="grid g3" style="margin-top:16px;gap:18px">
    <div class="box"><h3>1. Validar com as unidades (1 semana)</h3><p>Planilha anexa, aba por oportunidade. As unidades confirmam as placas zeradas (quem pagou a manutenção?) e as placas que rodaram inativas (substituíam quem?).</p></div>
    <div class="box"><h3>2. Fiscal e planejamento</h3><p>Fiscal: o crédito de imposto do diesel que recuperamos em Cuiabá, Macacu e Piraí (oportunidade 4). Planejamento: o que a Ambev pagou nos trechos de Macacu da 1ª ago/25 e como o remunerado da DRE é montado.</p></div>
    <div class="box"><h3>3. Pauta com a Ambev, por confiança</h3><p>Primeiro o que é fato no FT: diesel de ago/25, revisão do Km/L do Q4, Km/L zerado e mudado fora da revisão. Depois manutenção (contrato VW e placas zeradas), com a fatura na mão. Por último o fator de crédito, se o fiscal confirmar.</p></div>
  </div>
  <div style="margin-top:18px">${escuro(`<b>Base desta análise:</b> robô do Freightech (todas as quinzenas desde jan/2022, 5 canais, 38 tabelas), fatura do portal Volks|Total (jan/25 em diante), abastecimentos do ERP, DRE Frota, Dispersão de km e a análise do Km/L remunerado de 21/10. Tudo lido do banco do portal e reproduzível.`)}</div>`);

console.log('ok', write(process.env.FT_HTML || 'oportunidades.html'), 'slides');

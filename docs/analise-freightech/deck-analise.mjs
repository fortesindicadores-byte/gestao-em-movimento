// ============================================================
// Análise completa do Freightech × DRE (frota), visual e executiva.
//   CMP=…/completa-2026.json OPO=…/opo.json FT_HTML=…/analise.html node deck-analise.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, ponte, hbars, bars, lines, f0, f1, f2, f3, mi, mil, pct, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const X = JSON.parse(readFileSync(process.env.CMP || 'completa-2026.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const PER = `${MES[+X.INI.slice(5) - 1]}/${X.INI.slice(2, 4)} a ${MES[+X.FIM.slice(5) - 1]}/${X.FIM.slice(2, 4)}`;
const { slide, capa, escuro, write } = deck({ rodape: `Remuneração Freightech · Análise ${X.ROT} · Conlog`, marca: 'Remuneração <b>Freightech</b>', titulo: `Análise Freightech ${X.ROT}` });
const M = v => f1(v / 1e6), K = v => f0(v / 1e3), sg = v => (v > 0 ? '+' : '') + f1(v / 1e6);
const tile = (l, v, s, cor = INK) => `<div class="box"><div class="lbl">${l}</div><div class="num" style="color:${cor}">${v}</div><p>${s}</p></div>`;
const head = (k, h) => `<div class="kicker">${k}</div><h2>${h}</h2>`;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
const P = X.peca, ordem = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro'];
const soma = (k) => ordem.reduce((s, c) => s + P[c][k], 0);
const varT = ['comb', 'manut', 'carr', 'pneu'].reduce((s, c) => s + X.t2_teto[c], 0), varP = ['comb', 'manut', 'carr', 'pneu'].reduce((s, c) => s + X.t2_pago[c], 0);
const fixo = X.t2_fixo.fixo_at + X.t2_fixo.fixo_par;
const cor = v => v > 0 ? ACC : VERDE;

// 1 · capa
capa(`T2 · Rota, AS e Van · ${PER}`, `Remuneração Freightech ${X.ROT}: o que entra, o que custa e onde está a diferença`, 'Freightech placa a placa e quinzena a quinzena, cruzado com a Dispersão de km, os abastecimentos e a DRE de frota.');

// 2 · números-chave
slide(`${head('Números-chave', `Frota T2 · ${PER}`)}
  <div class="grid g4" style="margin-top:18px;gap:14px">
    ${tile('Fixo de frota', 'R$ ' + M(fixo) + ' mi', `ativos R$ ${M(X.t2_fixo.fixo_at)} mi · parados R$ ${M(X.t2_fixo.fixo_par)} mi`)}
    ${tile('Variável pago', 'R$ ' + M(varP) + ' mi', `teto R$ ${M(varT)} mi · ${f0(varP / varT * 100)}% do teto`)}
    ${tile('Frota média', f0(X.t2_frota.ativos_mes) + ' + ' + f0(X.t2_frota.parados_mes), 'ativos + parados por mês (Rota e Van)')}
    ${tile('Custo de frota (DRE)', 'R$ ' + M(soma('real')) + ' mi', `contra R$ ${M(soma('ft'))} mi pagos nas mesmas contas`, ACC)}
  </div>
  <div class="grid g3" style="margin-top:14px;gap:14px">
    ${tile('Km', M(X.t2_pago.km) + ' mi pagos', `teto ${M(X.t2_teto.kmtot)} mi · rodado ${M(X.t2_pago.rodado)} mi · abastecido ${M(X.comb_ponte.km)} mi`)}
    ${tile('Litros', M(X.comb_ponte.lit) + ' mi', `régua do FT ${M(X.comb_ponte.lit_esp)} mi · +${f0((X.comb_ponte.lit / X.comb_ponte.lit_esp - 1) * 100)}%`, ACC)}
    ${tile('Resultado nas contas de frota', 'R$ ' + sg(soma('ft') - soma('real')) + ' mi', 'pago − custo realizado (DRE)', soma('ft') - soma('real') < 0 ? ACC : VERDE)}
  </div>`);

// 3 · ponte do variável: teto → pago
slide(`${head('Variável', 'Do teto ao pago: o que os mapas não rodados tiram')}
  <div style="margin-top:14px">${ponte({ h: 300, itens: [{ rot: 'Teto\n(25 mapas/mês)', v: varT, tot: true }, ...['comb', 'manut', 'carr', 'pneu'].map(c => ({ rot: NM[c] + '\nnão pago', v: X.t2_pago[c] - X.t2_teto[c], cor: ACC })), { rot: 'Variável\npago', v: varP, tot: true }], fmt: v => 'R$ ' + M(Math.abs(v)) + ' mi' })}</div>
  <table class="compacta" style="margin-top:8px"><tr><th>Km</th><th class="n">Teto</th><th class="n">Pago</th><th class="n">Rodado (Dispersão)</th><th class="n">Abastecido (base Km/L)</th></tr>
  <tr><td>milhões de km</td><td class="n">${M(X.t2_teto.kmtot)}</td><td class="n">${M(X.t2_pago.km)}</td><td class="n">${M(X.t2_pago.rodado)}</td><td class="n">${M(X.comb_ponte.km)}</td></tr></table>`);

// 4 · ponte FT pago → custo real, por conta
{
  const itens = [{ rot: 'Pago FT\n(contas de frota)', v: soma('ft'), tot: true }, ...ordem.map(c => ({ rot: NM[c], v: P[c].real - P[c].ft })), { rot: 'Custo real\n(DRE)', v: soma('real'), tot: true }];
  slide(`${head('Resultado por conta', 'Do que o FT paga ao custo realizado: combustível e manutenção explicam a diferença')}
  <div style="margin-top:12px">${ponte({ h: 290, itens, fmt: v => 'R$ ' + f1(Math.abs(v) / 1e6) + ' mi' })}</div>
  <table class="compacta" style="margin-top:6px"><tr><th>R$ mi</th>${ordem.map(c => `<th class="n">${NM[c]}</th>`).join('')}<th class="n">Total</th></tr>
    <tr><td>Pago FT</td>${ordem.map(c => `<td class="n">${M(P[c].ft)}</td>`).join('')}<td class="n"><b>${M(soma('ft'))}</b></td></tr>
    <tr><td>Remunerado DRE</td>${ordem.map(c => `<td class="n">${M(P[c].rem)}</td>`).join('')}<td class="n"><b>${M(soma('rem'))}</b></td></tr>
    <tr><td>Realizado DRE</td>${ordem.map(c => `<td class="n">${M(P[c].real)}</td>`).join('')}<td class="n"><b>${M(soma('real'))}</b></td></tr>
    <tr><td><b>Real − FT</b></td>${ordem.map(c => `<td class="n" style="color:${cor(P[c].real - P[c].ft)}"><b>${sg(P[c].real - P[c].ft)}</b></td>`).join('')}<td class="n" style="color:${cor(soma('real') - soma('ft'))}"><b>${sg(soma('real') - soma('ft'))}</b></td></tr></table>
  <p class="note" style="margin-top:6px">Pago FT = R$/km do Resumo × km da Dispersão (variável) e lavagem, IPVA e seguro do FT. Manutenção do DRE inclui contratos de fabricante, oficina, materiais e personalização. Seguro: a DRE de frota quase não registra seguro.</p>`);
}

// 5 · remunerado da DRE × FT (composição do planejamento)
slide(`${head('Remunerado da DRE × FT', 'O remunerado lançado na DRE fica acima do que o FT calcula')}
  <div style="margin-top:14px">${hbars({ w: 1136, lw: 140, lh: 34, linhas: ordem.map(c => ({ rot: NM[c], ft: P[c].ft, rem: P[c].rem })), series: [{ k: 'ft', rot: 'Pago FT', cor: INK }, { k: 'rem', rot: 'Remunerado DRE', cor: AZUL }], fmt: v => 'R$ ' + f2(v / 1e6) + ' mi' })}</div>
  <table class="compacta" style="margin-top:8px"><tr><th>R$ mi</th>${ordem.map(c => `<th class="n">${NM[c]}</th>`).join('')}</tr>
  <tr><td>Rem. DRE − FT</td>${ordem.map(c => `<td class="n"><b>${sg(P[c].rem - P[c].ft)}</b></td>`).join('')}</tr></table>`);

// 6 · combustível: ponte
{
  const C = X.comb_ponte;
  slide(`${head('Combustível', 'Do pago ao custo: km fora do pagamento pesa mais que preço e consumo')}
  <div style="margin-top:12px">${ponte({ h: 300, itens: [{ rot: 'Pago FT', v: C.comb_pago, tot: true }, { rot: 'Régua FT\n(média unid.)', v: C.ft_regua }, { rot: 'Dispersão\n(rodado − pago)', v: C.km_disp }, { rot: 'Km de placa\ninativa', v: C.km_fora }, { rot: 'Consumo\n(Km/L)', v: C.ef }, { rot: 'Preço\n(R$/L)', v: C.pr }, { rot: 'Abastecido', v: C.rs, tot: true }, { rot: 'Contábil\n(ICMS, Arla)', v: C.contabil }, { rot: 'DRE\nrealizado', v: C.dre_real, tot: true }], fmt: v => 'R$ ' + f1(Math.abs(v) / 1e6) + ' mi' })}</div>
  <div class="grid g4" style="margin-top:8px;gap:12px">
    ${tile('Km abastecido', M(C.km) + ' mi', `pago ${M(C['Km Rem. TT'])} mi · rodado (Dispersão) ${M(C['Km Rodado TT'])} mi`)}
    ${tile('Litros', M(C.lit) + ' mi', `régua ${M(C.lit_esp)} mi`)}
    ${tile('Preço médio', 'R$ ' + f2(C.rs / C.lit) + '/L', 'abastecido')}
    ${tile('Fecha em', 'R$ ' + K(C.fecha) + ' mil', 'resíduo da ponte')}
  </div>`);
}

// 7 · combustível por unidade
{
  const U = Object.entries(X.comb_ponte_uni).filter(([u]) => u !== 'GNA').sort((a, b) => (b[1].dre_real - b[1].comb_pago) - (a[1].dre_real - a[1].comb_pago));
  const cel = v => `<td class="n" style="color:${cor(v)}">${K(v)}</td>`;
  slide(`${head('Combustível por unidade', 'Onde a diferença nasce: km, consumo ou preço')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th><th class="n">Pago FT</th><th class="n">Régua FT</th><th class="n">Dispersão</th><th class="n">Km inativa</th><th class="n">Consumo</th><th class="n">Preço</th><th class="n">Contábil</th><th class="n">DRE real</th><th class="n">Real − FT</th><th class="n">Km/L real × régua</th></tr>
  ${U.map(([u, x]) => `<tr><td><b>${NOME[u] || u}</b></td><td class="n">${K(x.comb_pago)}</td>${cel(x.ft_regua)}${cel(x.km_disp)}${cel(x.km_fora)}${cel(x.ef)}${cel(x.pr)}${cel(x.contabil)}<td class="n">${K(x.dre_real)}</td><td class="n" style="color:${cor(x.dre_real - x.comb_pago)}"><b>${K(x.dre_real - x.comb_pago)}</b></td><td class="n">${f2(x.km / x.lit)} × ${f2(x.km / x.lit_esp)}</td></tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Vermelho = custou a mais que o FT paga. Km inativa = km abastecido por placa inativa no FT (a Dispersão não conta). Régua FT = diferença entre o R$/km médio da unidade (Resumo) e a régua de cada placa.</p>`);
}

// 8 · manutenção
{
  const MR = X.manut_regra, U = Object.entries(X.peca_uni).filter(([u]) => u !== 'GNA').sort((a, b) => (b[1].manut.real - b[1].manut.ft) - (a[1].manut.real - a[1].manut.ft));
  slide(`${head('Manutenção', `O FT paga R$ ${M(P.manut.ft)} mi; o custo foi R$ ${M(P.manut.real)} mi`)}
  <div class="grid g2" style="margin-top:12px;gap:22px;align-items:start">
    <div>${hbars({ w: 560, lw: 110, lh: 30, linhas: U.map(([u, x]) => ({ rot: NOME[u] || u, ft: x.manut.ft, real: x.manut.real })), series: [{ k: 'ft', rot: 'Pago FT', cor: INK }, { k: 'real', rot: 'Realizado DRE', cor: ACC }], fmt: v => K(v) + ' mil' })}</div>
    <div>
      <table class="compacta"><tr><th>Regra no FT</th><th class="n">Placas</th><th class="n">R$/km</th><th class="n">Pago</th></tr>
      ${Object.entries(MR).filter(([r]) => r !== 'zero fora da carência').map(([r, x]) => `<tr><td>${r}</td><td class="n">${x.placas}</td><td class="n">${f2(x.rk)}</td><td class="n">R$ ${K(x.pago)} mil</td></tr>`).join('')}</table>
      <table class="compacta" style="margin-top:10px"><tr><th>Contrato da montadora (VW)</th><th class="n">Valor</th></tr>
        <tr><td>Placas com fatura</td><td class="n">${X.vw.placas}</td></tr><tr><td>Fatura VW</td><td class="n">R$ ${K(X.vw.fatura)} mil · ${f3(X.vw.rk_vw)}/km</td></tr>
        <tr><td>FT pago nas mesmas placas e km</td><td class="n">R$ ${K(X.vw.ft)} mil · ${f3(X.vw.rk_ft)}/km</td></tr><tr><td><b>Diferença</b></td><td class="n" style="color:${ACC}"><b>R$ ${K(X.vw.fatura - X.vw.ft)} mil</b></td></tr></table>
      <p class="note" style="margin-top:6px">FT pago pelo campo Manutenção R$/KM (regra do FT). Carência: ${MR['carência'] ? MR['carência'].placas : 0} placas com 0,00. Valor pago = R$/km × km do FT, sem o ajuste de mapas.</p>
    </div></div>`);
}

// 9 · manutenção por idade
{
  const I = X.manut_idade;
  slide(`${head('Manutenção por idade', 'O R$/km do FT por idade do caminhão e o peso dos contratos')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:center">
    ${bars({ w: 560, h: 260, labels: Object.keys(I).map(k => k + ' m'), data: Object.values(I).map(x => x.rk), cor: INK, fmt: v => f2(v) })}
    <table class="compacta"><tr><th>Vida (meses)</th><th class="n">Placas</th><th class="n">R$/km FT</th><th class="n">Com contrato</th></tr>
    ${Object.entries(I).map(([k, x]) => `<tr><td>${k}</td><td class="n">${x.placas}</td><td class="n">${f2(x.rk)}</td><td class="n">${f0(x.contrato)}%</td></tr>`).join('')}</table>
  </div>`);
}

// 10 · pneus
{
  const PN = Object.entries(X.pneu).filter(([, x]) => x.placas >= 5);
  slide(`${head('Pneu', `Pago R$ ${M(P.pneu.ft)} mi · custo R$ ${M(P.pneu.real)} mi · remunerado DRE R$ ${M(P.pneu.rem)} mi`)}
  <table class="compacta" style="margin-top:16px"><tr><th>Medida</th><th class="n">Placas</th><th class="n">Pneus</th><th class="n">Preço FT</th><th class="n">Nossa compra (mediana)</th><th class="n">Δ</th><th class="n">Recapagem FT</th><th class="n">Vida FT (km)</th><th class="n">R$/km FT</th></tr>
  ${PN.map(([m, x]) => `<tr><td><b>${m}</b></td><td class="n">${f0(x.placas)}</td><td class="n">${f0(x.qtd)}</td><td class="n">R$ ${f0(x.tracao)}</td><td class="n">${x.compra_med ? 'R$ ' + f0(x.compra_med) : '—'}</td><td class="n" style="color:${x.compra_med ? cor(x.compra_med - x.tracao) : INK}">${x.compra_med ? pct((x.compra_med / x.tracao - 1) * 100, 0) : '—'}</td><td class="n">R$ ${f0(x.recap)}</td><td class="n">${f0(x.vida)}</td><td class="n">${f2(x.rk)}</td></tr>`).join('')}</table>
  <div class="grid g3" style="margin-top:14px;gap:14px">
    ${tile('Pago FT', 'R$ ' + M(P.pneu.ft) + ' mi', 'R$/km × km pago')}${tile('Custo real', 'R$ ' + M(P.pneu.real) + ' mi', 'pneus novos + recapagens', P.pneu.real > P.pneu.ft ? ACC : VERDE)}${tile('Remunerado DRE', 'R$ ' + M(P.pneu.rem) + ' mi', `+R$ ${M(P.pneu.rem - P.pneu.ft)} mi sobre o FT`)}
  </div>`);
}

// 11 · fixo e frota
{
  const S = X.frota_status, FF = X.finame_fim;
  slide(`${head('Fixo e frota', 'Quem financia a frota e quando as parcelas acabam')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    <table class="compacta"><tr><th>Status</th><th class="n">Placas</th><th class="n">Fixo mediano/mês</th><th class="n">FINAME mediano</th><th class="n">Idade (meses)</th></tr>
    ${Object.entries(S).sort((a, b) => b[1].placas - a[1].placas).map(([s, x]) => `<tr><td><b>${s}</b></td><td class="n">${x.placas}</td><td class="n">R$ ${f0(x.fixo_med)}</td><td class="n">R$ ${f0(x.finame_med)}</td><td class="n">${f0(x.idade)}</td></tr>`).join('')}</table>
    <div>${bars({ w: 520, h: 220, labels: Object.keys(FF).map(k => k + ' m'), data: Object.values(FF).map(x => x.finame_mes), cor: AZUL, fmt: v => K(v) + ' mil' })}
      <p class="note">FINAME mensal das placas FINANCIADO/FINAME, pelas parcelas que faltam. Quando a parcela acaba, o caminhão passa a QUITADO e o fixo cai para ~R$ ${f0(S.QUITADO ? S.QUITADO.fixo_med : 0)}/mês.</p></div>
  </div>`);
}

// 12 · ponte do variável no período
if (X.ponte_var) {
  const B = X.ponte_var;
  slide(`${head('Evolução do variável', `Variável (teto, Rota + Van) de ${mv(B.de)} para ${mv(B.ate)}`)}
  <div style="margin-top:14px">${ponte({ h: 300, itens: [{ rot: mv(B.de), v: B.ini, tot: true }, { rot: 'Frota\nativa', v: B.frota }, { rot: 'Km por\nplaca', v: B.kmplaca }, ...Object.entries(B.pecas).map(([c, v]) => ({ rot: 'R$/km\n' + NM[c].toLowerCase(), v })), { rot: mv(B.ate), v: B.fim, tot: true }], corPos: VERDE, corNeg: ACC, fmt: v => 'R$ ' + K(Math.abs(v)) + ' mil' })}</div>
  <p class="note">Mês contra mês, no teto (25 mapas). Verde = aumenta a remuneração.</p>`);
}
function mv(v) { return MES[+v.slice(5) - 1] + '/' + v.slice(2, 4); }

// 13 · Km/L remunerado e fator de crédito
{
  const F = O.fator.mes, vs = Object.keys(F.PIR).filter(v => v >= X.INI.slice(0, 4) + '-01' || X.ROT === 'hist').sort();
  const heat = d => d > 0.02 ? `background:rgba(242,44,5,${Math.min(.08 + .62 * d / 0.2, .7).toFixed(2)})` : '';
  slide(`${head('Combustível · régua', 'Km/L sem revisão no 4º trimestre e crédito de imposto da Empurrada')}
  <div class="grid g4" style="margin-top:14px;gap:12px">
    ${tile('Placas que mudaram no Q4', f0(O.kml.q3q4_mudaram) + ' de ' + f0(O.kml.q3q4_iguais), 'revisão de out/26 não feita')}
    ${tile('Mudanças fora da revisão', f0(O.kml.fora), 'placas-operação')}${tile('Ativas com consumo zero', f0(O.kml.zeradas), '1ª abr, Empurradas')}${tile('Mesmo modelo, réguas diferentes', f0(O.kml.comDif) + ' de ' + f0(O.kml.grupos), 'grupos')}
  </div>
  <table class="compacta" style="margin-top:14px;font-size:10.5px"><tr><th>Fator de crédito</th>${vs.map(v => `<th class="n" style="padding:6px 3px">${mv(v)}</th>`).join('')}</tr>
  ${['CBA', 'MCC', 'PIR'].map(u => `<tr><td><b>${NOME[u]}</b></td>${vs.map(v => `<td class="n" style="padding:5px 3px;${u !== 'PIR' && F[u][v] != null ? heat(F.PIR[v] - F[u][v]) : ''}">${F[u][v] == null ? '·' : f2(F[u][v])}</td>`).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:6px">Fator = preço com crédito ÷ preço pago no diesel da Empurrada. Vermelho = abaixo de Piraí. Com Cuiabá em 0,94 e Macacu no fator de Piraí, 2026 teria R$ ${K(O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp)} mil a mais.</p>`);
}

// 14 · divergências
{
  const D = [
    ['Manutenção: contrato VW acima do FT', `R$ ${K(X.vw.fatura - X.vw.ft)} mil`, `${X.vw.placas} placas; FT ${f3(X.vw.rk_ft)}/km × fatura ${f3(X.vw.rk_vw)}/km`, 'média'],
    ['Crédito de imposto do diesel (Empurrada)', `R$ ${K(O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp)} mil`, 'Cuiabá 0,94 → 0,78 em jan/26; Macacu abaixo de Piraí', 'baixa (fiscal)'],
    ['Km/L do 4º trimestre sem revisão', 'revisão', `${O.kml.q3q4_iguais} placas com a régua do Q3`, 'alta'],
    ['Km/L: régua diferente no mesmo modelo', `R$ ${K(O.kml.disp_rs)} mil`, `${f0(O.kml.disp_lit)} L contra nós`, 'alta'],
    ['Km/L: ativas com consumo zero e mudança fora da revisão', 'cadastro', `${O.kml.zeradas} zeradas · ${O.kml.fora} fora da revisão`, 'alta'],
    ['Remunerado da DRE acima do FT', `R$ ${M(soma('rem') - soma('ft'))} mi`, 'composição do planejamento (manutenção e pneu)', 'interno'],
  ];
  slide(`${head('Divergências de remuneração', `${X.ROT}: o que está fora da regra ou da base`)}
  <table style="margin-top:14px"><tr><th>Divergência</th><th class="n">Valor</th><th>Base</th><th>Confiança</th></tr>
  ${D.map(r => `<tr><td><b>${r[0]}</b></td><td class="n"><b>${r[1]}</b></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Corrigido nesta versão: a manutenção paga pelo FT é o campo Manutenção R$/KM (BID ou tabela por idade), também nas placas sem contrato. As "placas com manutenção zero fora da carência" da versão anterior não existem (${X.manut_regra['zero fora da carência'] ? X.manut_regra['zero fora da carência'].placas : 0} em ${X.ROT}).</p>`);
}

// ═══ T1 · Empurrada e Insumos ═══
if (X.t1_trecho) {
  const TT = X.t1_trecho, ks = Object.keys(TT), CMP = [['diesel', 'Diesel'], ['salario', 'Salário var.'], ['lucro', 'Lucro var.'], ['pneu', 'Pneu'], ['manut_cav', 'Manut. cavalo'], ['manut_carr', 'Manut. carreta'], ['pedagio', 'Pedágio'], ['lav', 'Lavagem']];
  const nm = k => { const [c, u] = k.split('|'); return (NOME[u] || u.replace('LATA PIRAI', 'Lata Piraí')) + (c === 'INSUMOS' ? ' · Insumos' : ''); };
  const tot = k => CMP.reduce((s, [c]) => s + TT[k][c], 0);
  slide(`${head('T1 · trecho', 'R$ por km rodado no trecho, por componente')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$/km (média ponderada pela previsão de km)</th>${ks.map(k => `<th class="n">${nm(k)}</th>`).join('')}</tr>
  ${CMP.map(([c, n]) => `<tr><td>${n}</td>${ks.map(k => `<td class="n">${f2(TT[k][c])}</td>`).join('')}</tr>`).join('')}
  <tr><td><b>Total</b></td>${ks.map(k => `<td class="n"><b>${f2(tot(k))}</b></td>`).join('')}</tr>
  <tr><td>Km/L do trecho</td>${ks.map(k => `<td class="n">${f2(TT[k].kml)}</td>`).join('')}</tr>
  <tr><td>Trechos ativos</td>${ks.map(k => `<td class="n">${f0(TT[k].trechos)}</td>`).join('')}</tr></table>
  <div class="grid g3" style="margin-top:14px;gap:14px">${ks.filter(k => k.startsWith('EMP')).map(k => tile(nm(k), 'R$ ' + f2(tot(k)) + '/km', `diesel ${f0(TT[k].diesel / tot(k) * 100)}% do frete`)).join('')}</div>`);
  const D1 = X.t1_dre, us = Object.keys(D1), PC = [['comb', 'Combustível'], ['manut', 'Manutenção'], ['carr', 'Carreta'], ['pneu', 'Pneu'], ['lav', 'Lavagem'], ['ipva', 'IPVA'], ['seguro', 'Seguro'], ['icms', 'ICMS']];
  const v = (u, c, k) => (D1[u][c] || {})[k] || 0;
  slide(`${head('T1 · DRE de frota', 'Remunerado × realizado na Empurrada e nos Insumos')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th>${us.map(u => `<th class="n" colspan="3">${NOME[u] || u}</th>`).join('')}</tr>
  <tr><td></td>${us.map(() => '<td class="n note">rem.</td><td class="n note">real</td><td class="n note">Δ</td>').join('')}</tr>
  ${PC.map(([c, n]) => `<tr><td>${n}</td>${us.map(u => { const d = v(u, c, 'real') - v(u, c, 'rem'); return `<td class="n">${K(v(u, c, 'rem'))}</td><td class="n">${K(v(u, c, 'real'))}</td><td class="n" style="color:${cor(d)}"><b>${K(d)}</b></td>`; }).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Vermelho = custou acima do remunerado. Na Empurrada o remunerado de frota sai do frete de cada trecho (diesel, manutenção, pneu, lavagem) × viagens.</p>`);
  const FX = X.t1_fixo, fk = Object.keys(FX), FCs = [['equipamentoAtivo', 'Equipamento ativo'], ['equipamentoParado', 'Equipamento parado'], ['equipeAtiva', 'Equipe'], ['qlpAdm', 'QLP adm.'], ['estacionariaAtivo', 'Estacionária'], ['outraDespesa', 'Outras']];
  slide(`${head('T1 · fixo', 'Fixo do período por unidade: equipamento ativo e parado')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th>${fk.map(k => `<th class="n">${nm(k)}</th>`).join('')}</tr>
  ${FCs.map(([c, n]) => `<tr><td>${n}</td>${fk.map(k => `<td class="n">${K(FX[k][c] || 0)}</td>`).join('')}</tr>`).join('')}
  <tr><td>Equipamentos ativos / parados (média)</td>${fk.map(k => `<td class="n">${f1(FX[k].ativos)} / ${f1(FX[k].parados)}</td>`).join('')}</tr></table>
  <p class="note" style="margin-top:8px">Faturamento Empurrada/Insumos: quantidade × valor unitário, frete líquido. O parado recebe o mesmo valor unitário de equipamento do ativo.</p>`);
}
// receita do período
if (X.receita) {
  const RC = Object.entries(X.receita).sort((a, b) => b[1].real - a[1].real);
  slide(`${head('Receita', `Receita líquida do período por projeto (DRE) · R$ ${M(RC.reduce((s, [, x]) => s + x.real, 0))} mi`)}
  <div style="margin-top:14px">${hbars({ w: 1136, lw: 180, lh: 34, linhas: RC.map(([p, x]) => ({ rot: p, rem: x.rem, real: x.real })), series: [{ k: 'rem', rot: 'Remunerado', cor: AZUL }, { k: 'real', rot: 'Realizado', cor: INK }], fmt: v => 'R$ ' + f1(v / 1e6) + ' mi' })}</div>`);
}

console.log('ok', write(process.env.FT_HTML || 'analise.html'), 'slides');

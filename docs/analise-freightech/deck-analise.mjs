// ============================================================
// Análise completa do Freightech × DRE (frota), visual e executiva.
//   CMP=…/completa-2026.json OPO=…/opo.json FT_HTML=…/analise.html node deck-analise.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, ponte, hbars, bars, lines, f0, f1, f2, f3, mi, mil, pct, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const X = JSON.parse(readFileSync(process.env.CMP || 'completa-2026.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const E = JSON.parse(readFileSync(process.env.EXTRA || 'extra-2026.json', 'utf8'));
const PER = `${MES[+X.INI.slice(5) - 1]}/${X.INI.slice(2, 4)} a ${MES[+X.FIM.slice(5) - 1]}/${X.FIM.slice(2, 4)}`;
const { slide, capa, escuro, conc, write } = deck({ rodape: `Remuneração Freightech · Análise ${X.ROT} · Conlog`, marca: 'Remuneração <b>Freightech</b>', titulo: `Análise Freightech ${X.ROT}` });
const M = v => f1(v / 1e6), K = v => f0(v / 1e3), sg = v => (v > 0 ? '+' : '') + f1(v / 1e6);
const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
const tile = (l, v, s, cor = INK) => `<div class="box"><div class="lbl">${l}</div><div class="num" style="color:${cor}">${v}</div><p>${s}</p></div>`;
const head = (k, h) => `<div class="kicker">${k}</div><h2>${h}</h2>`;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
var pneuAte;
const P = X.peca, ordem = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro'];
const soma = (k) => ordem.reduce((s, c) => s + P[c][k], 0);
const varT = ['comb', 'manut', 'carr', 'pneu'].reduce((s, c) => s + X.t2_teto[c], 0), varP = ['comb', 'manut', 'carr', 'pneu'].reduce((s, c) => s + X.t2_pago[c], 0);
const fixo = X.t2_fixo.fixo_at + X.t2_fixo.fixo_par;
const cor = v => v > 0 ? ACC : VERDE;
const NMES = (+X.FIM.slice(0, 4) - +X.INI.slice(0, 4)) * 12 + +X.FIM.slice(5) - +X.INI.slice(5) + 1;
const CP = X.comb_ponte || {};
const dfrota = soma('real') - soma('ft');

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
  </div>
  ${(() => { const SU = Object.entries(E.saldo_uni).map(([u, x]) => [u, x.real - x.ft]).sort((a, b) => b[1] - a[1]); const t = SU.reduce((s, x) => s + x[1], 0); const SM = Object.entries(E.saldo_mes).map(([v, x]) => [v, x.real - x.ft]); const mn = SM.slice().sort((a, b) => a[1] - b[1])[0], mx = SM.slice().sort((a, b) => b[1] - a[1])[0]; const fecham = SU.filter(x => Math.abs(x[1]) < 0.05 * t).map(x => NOME[x[0]] || x[0]);
  return conc(`Em ${PER}, as contas de frota do T2 custaram <b>R$ ${M(soma('real'))} mi</b> contra R$ ${M(soma('ft'))} mi pagos pelo FT: <b>déficit de R$ ${M(dfrota)} mi</b>, R$ ${K(dfrota / NMES)} mil por mês, entre R$ ${K(mn[1])} mil (${mv(mn[0])}) e R$ ${K(mx[1])} mil (${mv(mx[0])}). Rodamos ${M(CP.km)} mi km, praticamente o teto de ${M(X.t2_teto.kmtot)} mi, mas o FT pagou ${M(X.t2_pago.km)} mi km (${f0(X.t2_pago.km / X.t2_teto.kmtot * 100)}%). <b>${NOME[SU[0][0]]} responde por ${f0(SU[0][1] / t * 100)}% do déficit</b> (R$ ${M(SU[0][1])} mi), ${NOME[SU[1][0]]} e ${NOME[SU[2][0]]} por mais ${f0((SU[1][1] + SU[2][1]) / t * 100)}%; ${fecham.join(', ')} fecham perto do pago. A diferença nasce em duas contas, combustível e manutenção, e as páginas seguintes abrem cada uma por unidade.`); })()}`);

// 3 · teto → pago, por unidade: onde o variável não virou pagamento e por quê
{
  const TU = X.teto_uni || {}, NM_ = X.n_meses || 1, CU = X.comb_ponte_uni || {};
  const us = Object.keys(TU).sort((a, b) => (TU[b].var_pago - TU[b].var_teto) - (TU[a].var_pago - TU[a].var_teto)).reverse();
  const L = us.map(u => { const t = TU[u], c = CU[u] || {}; return { u, n: NOME[u] || u, gap: t.var_pago - t.var_teto, pt: t.pago / t.teto, vc: t.viagens / (t.ativos_mes * NM_), rp: t.rodado / t.pago - 1, ar: c.km && t.rodado ? c.km / t.rodado - 1 : null }; });
  const gapT = varP - varT, piores = L.filter(x => x.gap < 0).slice(0, 4), cg = L[0];
  const bons = L.filter(x => x.pt >= 0.98).map(x => x.n);
  const abs = L.filter(x => x.ar != null && x.ar > 0.15).sort((a, b) => b.ar - a.ar)[0];
  const vcRede = us.reduce((s, u) => s + TU[u].viagens, 0) / us.reduce((s, u) => s + TU[u].ativos_mes * NM_, 0);
  const c = v => v < 0 ? ACC : VERDE, pc = v => (v >= 0 ? '+' : '') + f0(v * 100) + '%';
  slide(`${head('Variável', `R$ ${M(-gapT)} mi do variável de teto não viraram pagamento; ${f0(piores.reduce((s, x) => s + x.gap, 0) / gapT * 100)}% em ${piores.map(x => x.n).join(', ')}`)}
  <div style="margin-top:8px"><div class="lbl">Variável de teto que não virou pagamento, por unidade (${PER})</div>${bars({ w: 1136, h: 190, labels: L.map(x => x.n), data: L.map(x => -x.gap), cor: i => L[i].gap < 0 ? ACC : VERDE, fmt: v => v > 0 ? 'R$ ' + K(v) + ' mil' : '+R$ ' + K(-v) + ' mil' })}</div>
  <table class="compacta" style="margin-top:4px"><tr><th></th>${L.map(x => `<th class="n">${x.n}</th>`).join('')}</tr>
    <tr><td>Viagens por caminhão ativo/mês (teto 25)</td>${L.map(x => `<td class="n" style="color:${x.vc < 21.5 ? ACC : INK}">${f1(x.vc)}</td>`).join('')}</tr>
    <tr><td>Km pago ÷ km teto</td>${L.map(x => `<td class="n" style="color:${x.pt < 0.9 ? ACC : INK}">${f0(x.pt * 100)}%</td>`).join('')}</tr>
    <tr><td>Km rodado acima do pago (Dispersão)</td>${L.map(x => `<td class="n" style="color:${x.rp > 0.08 ? ACC : INK}">${pc(x.rp)}</td>`).join('')}</tr>
    <tr><td>Km abastecido acima do rodado</td>${L.map(x => `<td class="n" style="color:${x.ar > 0.08 ? ACC : INK}">${x.ar == null ? '—' : pc(x.ar)}</td>`).join('')}</tr></table>
  ${conc(`O teto paga 25 mapas por caminhão ativo; a rede fez <b>${f1(vcRede)} viagens por ativo/mês</b> e recebeu ${f0(varP / varT * 100)}% do variável. <b>${cg.n} sozinho responde por ${f0(cg.gap / gapT * 100)}% da perda</b> (R$ ${M(-cg.gap)} mi): ${f1(cg.vc)} viagens por ativo e ${pc(cg.rp)} de km acima do pago. ${piores.slice(1).map(x => `${x.n} (${f1(x.vc)} viagens, ${pc(x.rp)} de km)`).join(', ')} repetem o padrão: <b>frota ativa maior do que os mapas usam, e cada mapa rodando mais km do que paga</b>. ${bons.length ? bons.join(' e ') + ' recebem o teto inteiro. ' : ''}${abs ? `Em ${abs.n} o km abastecido nos projetos T2 fica ${pc(abs.ar)} acima do rodado da Dispersão: placa inativa no FT ou placa da Empurrada abastecendo no projeto da Rota (conferir placa a placa).` : ''}`)}`);
}

// 4 · ponte FT pago → custo real, por conta
{
  const itens = [{ rot: 'Pago FT\n(contas de frota)', v: soma('ft'), tot: true }, ...ordem.map(c => ({ rot: NM[c], v: P[c].real - P[c].ft })), { rot: 'Custo real\n(DRE)', v: soma('real'), tot: true }];
  slide(`${head('Resultado por conta', 'Do que o FT paga ao custo realizado: combustível e manutenção explicam a diferença')}
  <div style="margin-top:10px">${ponte({ h: 230, itens, fmt: v => 'R$ ' + f1(Math.abs(v) / 1e6) + ' mi' })}</div>
  <table class="compacta" style="margin-top:6px"><tr><th>R$ mi</th>${ordem.map(c => `<th class="n">${NM[c]}</th>`).join('')}<th class="n">Total</th></tr>
    <tr><td>Pago FT</td>${ordem.map(c => `<td class="n">${M(P[c].ft)}</td>`).join('')}<td class="n"><b>${M(soma('ft'))}</b></td></tr>
    <tr><td>Remunerado DRE</td>${ordem.map(c => `<td class="n">${M(P[c].rem)}</td>`).join('')}<td class="n"><b>${M(soma('rem'))}</b></td></tr>
    <tr><td>Realizado DRE</td>${ordem.map(c => `<td class="n">${M(P[c].real)}</td>`).join('')}<td class="n"><b>${M(soma('real'))}</b></td></tr>
    <tr><td><b>Real − FT</b></td>${ordem.map(c => `<td class="n" style="color:${cor(P[c].real - P[c].ft)}"><b>${sg(P[c].real - P[c].ft)}</b></td>`).join('')}<td class="n" style="color:${cor(soma('real') - soma('ft'))}"><b>${sg(soma('real') - soma('ft'))}</b></td></tr></table>
  ${(() => { const MC = E.manut_contas; const SM = X.peca_mes; const mr = SM.manut_real, mi_ = Math.min(...mr), ma_ = Math.max(...mr); const cr = SM.comb_real;
  return conc(`O déficit de R$ ${M(dfrota)} mi está em duas contas. <b>Manutenção, R$ ${M(P.manut.real - P.manut.ft)} mi</b>: o FT paga R$ ${M(P.manut.ft)} mi e só o contrato da montadora lançado na DRE custa R$ ${M(MC.contrato.real)} mi; a oficina (peças e serviços fora do contrato) soma mais R$ ${M(MC.oficina.real)} mi. Ou seja, o pago cobre o contrato e sobra R$ ${M(P.manut.ft - MC.contrato.real)} mi para uma oficina de R$ ${M(MC.oficina.real)} mi. O realizado oscila de R$ ${K(mi_)} mil a R$ ${K(ma_)} mil por mês contra um pago estável de R$ ${K(P.manut.ft / NMES)} mil. <b>Combustível, R$ ${M(P.comb.real - P.comb.ft)} mi</b> (+${f0((P.comb.real / P.comb.ft - 1) * 100)}%), constante nos ${NMES} meses (R$ ${K(Math.min(...cr.map((v, i) => v - SM.comb_ft[i])))} a ${K(Math.max(...cr.map((v, i) => v - SM.comb_ft[i])))} mil acima do pago): é estrutural, não sazonal. Carroceria, pneu e lavagem dão sobra de R$ ${M(-(P.carr.real - P.carr.ft + P.pneu.real - P.pneu.ft + P.lav.real - P.lav.ft))} mi; o seguro (R$ ${M(P.seguro.ft)} mi pagos) não tem custo lançado nos projetos T2 e a sobra dele é só aparente.`); })()}`);
}

// 4b · resultado por unidade: onde o déficit está e o que o explica
{
  const SU = Object.entries(E.saldo_uni).filter(([u]) => u !== 'GNA').map(([u, x]) => ({ u, n: NOME[u] || u, ...x, dif: x.real - x.ft, mdif: X.peca_uni[u].manut.real - X.peca_uni[u].manut.ft, cdif: X.peca_uni[u].comb.real - X.peca_uni[u].comb.ft, vc: X.teto_uni[u].viagens / (X.teto_uni[u].ativos_mes * X.n_meses), par: E.fixo_uni[u] ? E.fixo_uni[u].parados / (E.fixo_uni[u].ativos + E.fixo_uni[u].parados) : null })).sort((a, b) => b.dif - a.dif);
  const t = SU.reduce((s, x) => s + x.dif, 0), top = SU[0];
  const corr = SU.filter(x => x.dif > 0.08 * t), ok = SU.filter(x => x.dif <= 0.03 * t);
  const cm = v => `<td class="n" style="color:${cor(v)}"><b>${K(v)}</b></td>`;
  slide(`${head('Resultado por unidade', `${top.n} concentra ${f0(top.dif / t * 100)}% do déficit; ${ok.map(x => x.n).join(', ')} fecham perto do pago`)}
  <div style="margin-top:10px">${bars({ w: 1136, h: 170, labels: SU.map(x => x.n), data: SU.map(x => x.dif), cor: i => SU[i].dif > 0.03 * t ? ACC : INK3, fmt: v => 'R$ ' + K(v) + ' mil' })}</div>
  <table class="compacta" style="margin-top:4px"><tr><th>R$ mil</th>${SU.map(x => `<th class="n">${x.n}</th>`).join('')}</tr>
    <tr><td>Pago FT (contas de frota)</td>${SU.map(x => `<td class="n">${K(x.ft)}</td>`).join('')}</tr>
    <tr><td>Realizado DRE</td>${SU.map(x => `<td class="n">${K(x.real)}</td>`).join('')}</tr>
    <tr><td>Real − FT</td>${SU.map(x => cm(x.dif)).join('')}</tr>
    <tr><td>· manutenção</td>${SU.map(x => cm(x.mdif)).join('')}</tr>
    <tr><td>· combustível</td>${SU.map(x => cm(x.cdif)).join('')}</tr>
    <tr><td>Viagens por caminhão ativo/mês</td>${SU.map(x => `<td class="n" style="color:${x.vc < 21.5 ? ACC : INK}">${f1(x.vc)}</td>`).join('')}</tr>
    <tr><td>Caminhões parados (% da frota)</td>${SU.map(x => `<td class="n" style="color:${x.par > 0.3 ? ACC : INK}">${x.par == null ? '—' : f0(x.par * 100) + '%'}</td>`).join('')}</tr></table>
  ${conc(`O déficit de R$ ${M(t)} mi não é da rede inteira: <b>${corr.map(x => `${x.n} (R$ ${K(x.dif)} mil)`).join(', ')} somam ${f0(corr.reduce((s, x) => s + x.dif, 0) / t * 100)}%</b>; ${ok.map(x => x.n).join(', ')} ficam a menos de R$ ${K(0.03 * t)} mil do pago. Em ${top.n} os dois lados pesam: manutenção R$ ${K(top.mdif)} mil e combustível R$ ${K(top.cdif)} mil, com ${f1(top.vc)} viagens por ativo (o teto paga 25). ${lista(corr.filter(x => x.mdif >= x.cdif).map(x => x.n))} ${corr.filter(x => x.mdif >= x.cdif).length > 1 ? 'devem' : 'deve'} mais à manutenção; ${lista(corr.filter(x => x.cdif > x.mdif).map(x => x.n))} ao combustível. Frota parada não explica: ${lista(ok.filter(x => x.par > 0.28).map(x => `${x.n} (${f0(x.par * 100)}%)`))} ${ok.filter(x => x.par > 0.28).length > 1 ? 'têm' : 'tem'} mais caminhão parado que ${top.n} (${f0(top.par * 100)}%) e fecham a conta, porque o parado recebe o fixo e não gera custo variável. Viagens por ativo também não separam: ${lista(ok.map(x => `${x.n} ${f1(x.vc)}`))} contra ${top.n} ${f1(top.vc)}. O que separa é o custo por km rodado: nas unidades que fecham, manutenção e combustível cabem no R$/km que o FT paga.`)}`);
}

pneuAte = pneuAteF();
// 5 · remunerado da DRE × FT (composição do planejamento)
slide(`${head('Remunerado da DRE × FT', 'O remunerado lançado na DRE fica acima do FT em manutenção e pneu')}
  <div style="margin-top:10px">${hbars({ w: 1136, lw: 140, lh: 30, linhas: ordem.map(c => ({ rot: NM[c], ft: P[c].ft, rem: P[c].rem })), series: [{ k: 'ft', rot: 'Pago FT', cor: INK }, { k: 'rem', rot: 'Remunerado DRE', cor: AZUL }], fmt: v => 'R$ ' + f2(v / 1e6) + ' mi' })}</div>
  <table class="compacta" style="margin-top:8px"><tr><th>R$ mi</th>${ordem.map(c => `<th class="n">${NM[c]}</th>`).join('')}</tr>
  <tr><td>Rem. DRE − FT</td>${ordem.map(c => `<td class="n"><b>${sg(P[c].rem - P[c].ft)}</b></td>`).join('')}</tr>
  <tr><td>Rem. DRE ÷ FT</td>${ordem.map(c => `<td class="n">${P[c].ft ? pct((P[c].rem / P[c].ft - 1) * 100, 0) : '—'}</td>`).join('')}</tr></table>
  ${conc(`Não é ajuste de imposto: um acréscimo de PIS/COFINS (+10%) apareceria em todas as contas, e lavagem, IPVA e carroceria batem com o FT; o combustível fica só ${f0((P.comb.rem / P.comb.ft - 1) * 100)}% acima. A diferença está em <b>manutenção (+R$ ${M(P.manut.rem - P.manut.ft)} mi, ${pct((P.manut.rem / P.manut.ft - 1) * 100, 0)})</b> e <b>pneu (+R$ ${M(P.pneu.rem - P.pneu.ft)} mi)</b>${pneuAte ? `, este até ${pneuAte}; depois passa a bater com o FT` : ''}. Com o remunerado acima do que o FT paga, o resultado de frota reportado na DRE fica melhor que o real.`)}`);


function pneuAteF() { const pm = X.peca_mes; if (!pm) return ''; let last = ''; pm.vig.forEach((v, i) => { if (pm.pneu_ft[i] && pm.pneu_rem[i] / pm.pneu_ft[i] > 1.1) last = v; }); return last && last < X.FIM ? mv(last) : ''; }
// 6 · combustível: ponte
{
  const C = X.comb_ponte;
  slide(`${head('Combustível', 'Do pago ao custo: km sem pagamento e consumo explicam a diferença')}
  <div style="margin-top:10px">${ponte({ h: 245, itens: [{ rot: 'Pago FT', v: C.comb_pago, tot: true }, { rot: 'Mix de placas', v: C.ft_regua }, { rot: 'Dispersão\n(rodado − pago)', v: C.km_disp }, { rot: 'Km de placa\ninativa', v: C.km_fora }, { rot: 'Consumo\n(Km/L)', v: C.ef }, { rot: 'Preço\n(R$/L)', v: C.pr }, { rot: 'Abastecido', v: C.rs, tot: true }, { rot: 'Contábil\n(ICMS, Arla)', v: C.contabil }, { rot: 'DRE\nrealizado', v: C.dre_real, tot: true }], fmt: v => 'R$ ' + f1(Math.abs(v) / 1e6) + ' mi' })}</div>
  <div class="grid g4" style="margin-top:8px;gap:12px">
    ${tile('Km abastecido', M(C.km) + ' mi', `pago ${M(C['Km Rem. TT'])} mi · rodado (Dispersão) ${M(C['Km Rodado TT'])} mi`)}
    ${tile('Litros', M(C.lit) + ' mi', `previsto pelo FT ${M(C.lit_esp)} mi (+${f0((C.lit / C.lit_esp - 1) * 100)}%)`)}
    ${tile('Preço médio', 'R$ ' + f2(C.rs / C.lit) + '/L', 'abastecido')}
    ${tile('Fecha em', 'R$ ' + K(C.fecha) + ' mil', 'resíduo da ponte')}
  </div>
  ${conc(`Abastecemos R$ ${M(C.rs)} mi, <b>R$ ${M(C.rs - C.comb_pago)} mi acima do que o FT pagou</b>. Km rodado sem pagamento: R$ ${M(C.km_disp + C.km_fora)} mi (dispersão ${M(C.km_disp)} + placas inativas ${M(C.km_fora)}). Mix de placas: R$ ${M(C.ft_regua)} mi, porque o FT paga pelo consumo médio das placas da unidade e as que mais rodam gastam mais por km que essa média. Consumo: ${f0((C.lit / C.lit_esp - 1) * 100)}% mais litros que o previsto (R$ ${M(C.ef)} mi). Preço joga a favor (R$ ${M(-C.pr)} mi).`)}`);
}

// 7 · combustível por unidade
{
  const U = Object.entries(X.comb_ponte_uni).filter(([u]) => u !== 'GNA').sort((a, b) => (b[1].dre_real - b[1].comb_pago) - (a[1].dre_real - a[1].comb_pago));
  const cel = v => `<td class="n" style="color:${cor(v)}">${K(v)}</td>`;
  const CN = [['ft_regua', 'mix de placas'], ['km_disp', 'dispersão'], ['km_fora', 'placa inativa'], ['ef', 'consumo'], ['pr', 'preço']];
  const totD = U.reduce((s, [, x]) => s + x.dre_real - x.comb_pago, 0), top = U.slice(0, 3);
  const dz = ([u, x]) => { const [k, n] = CN.slice().sort((a, b) => x[b[0]] - x[a[0]])[0]; return `${NOME[u] || u}, ${n} (R$ ${K(x[k])} mil)`; };
  slide(`${head('Combustível por unidade', 'Onde a diferença nasce: km, consumo ou preço')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th><th class="n">Pago FT</th><th class="n">Mix de placas</th><th class="n">Dispersão</th><th class="n">Km inativa</th><th class="n">Consumo</th><th class="n">Preço</th><th class="n">Contábil</th><th class="n">DRE real</th><th class="n">Real − FT</th><th class="n">Km/L real × previsto</th></tr>
  ${U.map(([u, x]) => `<tr><td><b>${NOME[u] || u}</b></td><td class="n">${K(x.comb_pago)}</td>${cel(x.ft_regua)}${cel(x.km_disp)}${cel(x.km_fora)}${cel(x.ef)}${cel(x.pr)}${cel(x.contabil)}<td class="n">${K(x.dre_real)}</td><td class="n" style="color:${cor(x.dre_real - x.comb_pago)}"><b>${K(x.dre_real - x.comb_pago)}</b></td><td class="n">${f2(x.km / x.lit)} × ${f2(x.km / x.lit_esp)}</td></tr>`).join('')}</table>
  <p class="note" style="margin-top:6px">Vermelho = custou a mais que o FT paga. Previsto = R$/L e Km/L remunerados de cada placa (aba Km/L). Mix de placas = o FT paga pelo R$/km médio da unidade; as placas que rodam têm previsto diferente.</p>
  ${(() => { const CB = E.comb_uni_placa, g = CB[top[0][0]], g2 = CB[top[1][0]]; const tq = Object.entries(CB).filter(([u]) => u !== 'GNA'); const piorKm = tq.slice().sort((a, b) => b[1].km_abaixo15_pct - a[1].km_abaixo15_pct); const tanque = tq.filter(([, x]) => x.pl_real < x.pl_rem - 0.3).map(([u]) => NOME[u] || u);
  return conc(`${top.map(([u]) => NOME[u] || u).join(', ')} somam <b>${f0(top.reduce((s, [, x]) => s + x.dre_real - x.comb_pago, 0) / totD * 100)}% da diferença</b>, e a causa muda de uma para outra. Em ${NOME[top[0][0]]} é consumo: <b>${g.placas_abaixo15} das ${g.placas} placas</b> rodam 15% ou mais abaixo do Km/L previsto, respondem por ${f0(g.km_abaixo15_pct)}% do km e queimaram ${K(g.lit_extra_abaixo15)} mil litros a mais (${g.pior.slice(0, 2).map(p => `${p[0]} ${f2(p[1])} contra ${f2(p[2])}`).join(', ')}); o preço joga a favor (R$ ${f2(g.pl_real)}/L contra R$ ${f2(g.pl_rem)} remunerado) e ainda assim sobra R$ ${K(top[0][1].dre_real - top[0][1].comb_pago)} mil. Em ${NOME[top[1][0]]} é km: dispersão de R$ ${K(top[1][1].km_disp)} mil com ${g2.placas_abaixo15} placas abaixo do previsto. ${piorKm[1][0] !== top[0][0] ? `${NOME[piorKm[1][0]]} tem ${f0(piorKm[1][1].km_abaixo15_pct)}% do km em placas ruins de consumo. ` : ''}${tanque.length ? `${lista(tanque)} compram abaixo do preço remunerado (tanque interno) e isso cobre parte do consumo; nas outras o preço custa a mais.` : ''}`); })()}`);
}

// 8 · manutenção
{
  const MR = X.manut_regra, U = Object.entries(X.peca_uni).filter(([u]) => u !== 'GNA').sort((a, b) => (b[1].manut.real - b[1].manut.ft) - (a[1].manut.real - a[1].manut.ft));
  const vwd = X.vw.fatura - X.vw.ft, mtop = U.slice(0, 3).map(([u, x]) => `${NOME[u] || u} (R$ ${K(x.manut.real - x.manut.ft)} mil)`).join(', ');
  slide(`${head('Manutenção', `O FT paga R$ ${M(P.manut.ft)} mi; o custo foi R$ ${M(P.manut.real)} mi`)}
  <div class="grid g2" style="margin-top:12px;gap:22px;align-items:start">
    <table class="compacta"><tr><th>R$ mil</th><th class="n">Placas</th><th class="n">Idade (m)</th><th class="n">Km em carência</th><th class="n">R$/km FT</th><th class="n">Pago FT</th><th class="n">Contrato fabr.</th><th class="n">Oficina</th><th class="n">Real − FT</th></tr>
    ${U.map(([u, x]) => { const m = E.manut_uni[u] || {}, d = m.dre || {}; return `<tr><td><b>${NOME[u] || u}</b></td><td class="n">${m.placas || '—'}</td><td class="n">${f0(m.vida_med)}</td><td class="n">${f0(m.carencia_km_pct)}%</td><td class="n">${f2(m.rk_ft)}</td><td class="n">${K(x.manut.ft)}</td><td class="n">${K((d.contrato || {}).real || 0)}</td><td class="n">${K(((d.oficina || {}).real || 0) + ((d.materiais || {}).real || 0) + ((d.personaliz || {}).real || 0))}</td><td class="n" style="color:${cor(x.manut.real - x.manut.ft)}"><b>${K(x.manut.real - x.manut.ft)}</b></td></tr>`; }).join('')}</table>
    <div>
      <table class="compacta"><tr><th>Regra no FT</th><th class="n">Placas</th><th class="n">R$/km</th><th class="n">Pago</th></tr>
      ${Object.entries(MR).filter(([r]) => r !== 'zero fora da carência').map(([r, x]) => `<tr><td>${r}</td><td class="n">${x.placas}</td><td class="n">${f2(x.rk)}</td><td class="n">R$ ${K(x.pago)} mil</td></tr>`).join('')}</table>
      <table class="compacta" style="margin-top:10px"><tr><th>Contrato da montadora (VW)</th><th class="n">Valor</th></tr>
        <tr><td>Placas com fatura</td><td class="n">${X.vw.placas}</td></tr><tr><td>Fatura VW</td><td class="n">R$ ${K(X.vw.fatura)} mil · ${f3(X.vw.rk_vw)}/km</td></tr>
        <tr><td>FT pago nas mesmas placas e km</td><td class="n">R$ ${K(X.vw.ft)} mil · ${f3(X.vw.rk_ft)}/km</td></tr><tr><td><b>Diferença</b></td><td class="n" style="color:${ACC}"><b>R$ ${K(X.vw.fatura - X.vw.ft)} mil</b></td></tr></table>
      <p class="note" style="margin-top:6px">FT pago pelo campo Manutenção R$/KM. Contrato fabr. e Oficina = realizado da DRE por conta (contrato da montadora; manutenção, materiais e personalização).</p>
    </div></div>
  ${(() => { const MU = E.manut_uni, MC = E.manut_contas; const r = ([u]) => MU[u] || { dre: {} }; const ofi = x => ((x.dre.oficina || {}).real || 0) + ((x.dre.materiais || {}).real || 0) + ((x.dre.personaliz || {}).real || 0); const u0 = U[0], m0 = r(u0); const novo = Object.entries(MU).sort((a, b) => a[1].vida_med - b[1].vida_med)[0]; const velho = Object.entries(MU).sort((a, b) => b[1].vida_med - a[1].vida_med)[0]; const ofiRuim = Object.entries(MU).map(([u, x]) => [u, ofi(x) / (x.pago_ft || 1)]).sort((a, b) => b[1] - a[1])[0];
  return conc(`A manutenção custou <b>${f1(P.manut.real / P.manut.ft)}× o pago</b> e a causa está na composição: o FT paga R$ ${M(P.manut.ft)} mi, o contrato da montadora lançado custa R$ ${M(MC.contrato.real)} mi e a oficina R$ ${M(MC.oficina.real + MC.materiais.real + MC.personaliz.real)} mi. Em <b>${NOME[u0[0]]}</b> o contrato sozinho (R$ ${K(m0.dre.contrato.real)} mil) ${m0.dre.contrato.real > u0[1].manut.ft ? 'já passa' : 'quase consome'} o pago (R$ ${K(u0[1].manut.ft)} mil) e a oficina acrescenta R$ ${K(ofi(m0))} mil: é a unidade com mais placas (${m0.placas}) e ${f0(m0.contrato_pct)}% delas em contrato. A idade não explica o déficit: ${NOME[velho[0]]}, a frota mais velha (${f0(velho[1].vida_med)} meses), recebe R$ ${f2(velho[1].rk_ft)}/km, o maior da rede, e ${NOME[novo[0]]}, a mais nova (${f0(novo[1].vida_med)} meses, ${f0(novo[1].carencia_km_pct)}% do km em carência a R$ ${f2(novo[1].rk_ft)}/km), gasta R$ ${K(ofi(novo[1]))} mil de oficina com caminhão de menos de um ano. ${NOME[ofiRuim[0]]} tem a pior relação: oficina de ${f1(ofiRuim[1])}× o que o FT paga. O contrato VW custa R$ ${K(vwd)} mil acima do FT nas ${X.vw.placas} placas; <b>R$ ${M(P.manut.real - P.manut.ft - vwd)} mi</b> do déficit são oficina fora do contrato.`); })()}`);
}

// 9 · manutenção por idade
{
  const I = X.manut_idade;
  slide(`${head('Manutenção por idade', 'O R$/km do FT por idade do caminhão e o peso dos contratos')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:center">
    ${bars({ w: 560, h: 240, labels: Object.keys(I).map(k => k + ' m'), data: Object.values(I).map(x => x.rk), cor: INK, fmt: v => f2(v) })}
    <table class="compacta"><tr><th>Vida (meses)</th><th class="n">Placas</th><th class="n">R$/km FT</th><th class="n">Com contrato</th></tr>
    ${Object.entries(I).map(([k, x]) => `<tr><td>${k}</td><td class="n">${x.placas}</td><td class="n">${f2(x.rk)}</td><td class="n">${f0(x.contrato)}%</td></tr>`).join('')}</table>
  </div>
  ${(() => { const e = Object.entries(I), a = e[0][1], b = e[1][1], o = e[e.length - 1]; return conc(`Até ${e[0][0].split('–')[1]} meses o FT paga zero (carência, ${a.placas} placas). De ${e[1][0]} meses paga R$ ${f2(b.rk)}/km e só ${f0(b.contrato)}% das placas têm contrato: é a faixa em que a manutenção sai da carência e ainda não está coberta. Acima de 24 meses o R$/km fica entre ${f2(Math.min(...e.slice(2).map(([, x]) => x.rk)))} e ${f2(Math.max(...e.slice(2).map(([, x]) => x.rk)))} e <b>não sobe com a idade</b>: as ${o[1].placas} placas com ${o[0]} meses recebem R$ ${f2(o[1].rk)}/km.`); })()}`);
}

// 10 · pneus
{
  const PN = Object.entries(X.pneu).filter(([, x]) => x.placas >= 5);
  slide(`${head('Pneu', `Pago R$ ${M(P.pneu.ft)} mi · custo R$ ${M(P.pneu.real)} mi · remunerado DRE R$ ${M(P.pneu.rem)} mi`)}
  <table class="compacta" style="margin-top:12px"><tr><th>Medida</th><th class="n">Placas</th><th class="n">Pneus</th><th class="n">Preço FT</th><th class="n">Nossa compra (mediana)</th><th class="n">Δ</th><th class="n">Recapagem FT</th><th class="n">Vida FT (km)</th><th class="n">R$/km FT</th></tr>
  ${PN.map(([m, x]) => `<tr><td><b>${m}</b></td><td class="n">${f0(x.placas)}</td><td class="n">${f0(x.qtd)}</td><td class="n">R$ ${f0(x.tracao)}</td><td class="n">${x.compra_med ? 'R$ ' + f0(x.compra_med) : '—'}</td><td class="n" style="color:${x.compra_med ? cor(x.compra_med - x.tracao) : INK}">${x.compra_med ? pct((x.compra_med / x.tracao - 1) * 100, 0) : '—'}</td><td class="n">R$ ${f0(x.recap)}</td><td class="n">${f0(x.vida)}</td><td class="n">${f2(x.rk)}</td></tr>`).join('')}</table>
  <div class="grid g3" style="margin-top:12px;gap:14px">
    ${tile('Pago FT', 'R$ ' + M(P.pneu.ft) + ' mi', 'R$/km × km pago')}${tile('Custo real', 'R$ ' + M(P.pneu.real) + ' mi', 'pneus novos + recapagens', P.pneu.real > P.pneu.ft ? ACC : VERDE)}${tile('Remunerado DRE', 'R$ ' + M(P.pneu.rem) + ' mi', `+R$ ${M(P.pneu.rem - P.pneu.ft)} mi sobre o FT`)}
  </div>
  ${(() => { const m = PN.slice().sort((a, b) => b[1].placas - a[1].placas)[0]; return conc(`Pneu dá <b>sobra de R$ ${M(P.pneu.ft - P.pneu.real)} mi</b>: o FT paga pelo preço de tabela e compramos abaixo dele. A ${m[0]}, que equipa ${f0(m[1].placas)} placas, sai a R$ ${f0(m[1].compra_med)} contra R$ ${f0(m[1].tracao)} no FT (${pct((m[1].compra_med / m[1].tracao - 1) * 100, 0)}). A vida de ${f0(m[1].vida)} km com ${m[1].nrec} recapagens é a premissa do FT: rodar mais que isso aumenta a sobra.`); })()}`);
}

// 11 · fixo e frota
{
  const S = X.frota_status, FF = X.finame_fim;
  slide(`${head('Fixo e frota', 'Quem financia a frota e quando as parcelas acabam')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    <table class="compacta"><tr><th>Status</th><th class="n">Placas</th><th class="n">Fixo mediano/mês</th><th class="n">FINAME mediano</th><th class="n">Idade (meses)</th></tr>
    ${Object.entries(S).sort((a, b) => b[1].placas - a[1].placas).map(([s, x]) => `<tr><td><b>${s}</b></td><td class="n">${x.placas}</td><td class="n">R$ ${f0(x.fixo_med)}</td><td class="n">R$ ${f0(x.finame_med)}</td><td class="n">${f0(x.idade)}</td></tr>`).join('')}</table>
    <div>${bars({ w: 520, h: 200, labels: Object.keys(FF).map(k => k + ' m'), data: Object.values(FF).map(x => x.finame_mes), cor: AZUL, fmt: v => K(v) + ' mil' })}
      <p class="note">FINAME mensal das placas FINANCIADO/FINAME, pelas parcelas que faltam (meses).</p></div>
  </div>
  ${(() => { const f0k = Object.keys(FF)[0], q = S.QUITADO || {}, fi = S.FINANCIADO || {}; return conc(`Caminhão financiado recebe ~R$ ${f0(fi.fixo_med)}/mês de fixo; <b>quitado recebe ~R$ ${f0(q.fixo_med)}</b> (${q.placas} placas, ${f0(q.idade)} meses de idade mediana). ${FF[f0k].placas} placas terminam a parcela em ${f0k} meses: <b>R$ ${K(FF[f0k].finame_mes)} mil/mês de FINAME</b> saem da remuneração junto com a parcela. Quitado velho rodando recebe pouco fixo e não ganha R$/km de manutenção a mais: a renovação tem de ser planejada pelo fim das parcelas.`); })()}`);
}

// 12 · ponte do variável no período
if (X.ponte_var) {
  const B = X.ponte_var;
  slide(`${head('Evolução do variável', `Variável (teto, Rota + Van) de ${mv(B.de)} para ${mv(B.ate)}`)}
  <div style="margin-top:10px">${ponte({ h: 260, itens: [{ rot: mv(B.de), v: B.ini, tot: true }, { rot: 'Frota\nativa', v: B.frota }, { rot: 'Km por\nplaca', v: B.kmplaca }, ...Object.entries(B.pecas).map(([c, v]) => ({ rot: 'R$/km\n' + NM[c].toLowerCase(), v })), { rot: mv(B.ate), v: B.fim, tot: true }], corPos: VERDE, corNeg: ACC, fmt: v => 'R$ ' + K(Math.abs(v)) + ' mil' })}</div>
  <p class="note">Mês contra mês, no teto (25 mapas). Verde = aumenta a remuneração.</p>
  ${conc(`O variável de teto ${B.fim < B.ini ? 'caiu' : 'subiu'} <b>R$ ${K(Math.abs(B.fim - B.ini))} mil/mês</b> de ${mv(B.de)} a ${mv(B.ate)}. A frota ativa ${B.frota < 0 ? 'tirou' : 'somou'} R$ ${K(Math.abs(B.frota))} mil; km por placa (R$ ${K(B.kmplaca)} mil) e R$/km (R$ ${K(Object.values(B.pecas).reduce((s, x) => s + x, 0))} mil, quase todo manutenção e combustível) compensaram parte. O que mais mexe no variável é o número de caminhões ativos.`)}`);
}
function mv(v) { return MES[+v.slice(5) - 1] + '/' + v.slice(2, 4); }

// 13 · Km/L remunerado e fator de crédito
{
  const F = O.fator.mes, vs = Object.keys(F.PIR).filter(v => v >= X.INI.slice(0, 4) + '-01' || X.ROT === 'hist').sort();
  const heat = d => d > 0.02 ? `background:rgba(242,44,5,${Math.min(.08 + .62 * d / 0.2, .7).toFixed(2)})` : '';
  const fimp = O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp;
  slide(`${head('Combustível · Km/L remunerado', 'Km/L sem revisão no 4º trimestre e crédito de imposto da Empurrada')}
  <div class="grid g4" style="margin-top:14px;gap:12px">
    ${tile('Placas que mudaram no Q4', f0(O.kml.q3q4_mudaram) + ' de ' + f0(O.kml.q3q4_iguais), 'revisão de out/26 não feita')}
    ${tile('Mudanças fora da revisão', f0(O.kml.fora), 'placas-operação')}${tile('Ativas com consumo zero', f0(O.kml.zeradas), '1ª abr, Empurradas')}${tile('Mesmo modelo, réguas diferentes', f0(O.kml.comDif) + ' de ' + f0(O.kml.grupos), 'grupos')}
  </div>
  <table class="compacta" style="margin-top:14px;font-size:10.5px"><tr><th>Fator de crédito</th>${vs.map(v => `<th class="n" style="padding:6px 3px">${mv(v)}</th>`).join('')}</tr>
  ${['CBA', 'MCC', 'PIR'].map(u => `<tr><td><b>${NOME[u]}</b></td>${vs.map(v => `<td class="n" style="padding:5px 3px;${u !== 'PIR' && F[u][v] != null ? heat(F.PIR[v] - F[u][v]) : ''}">${F[u][v] == null ? '·' : f2(F[u][v])}</td>`).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:6px">Fator = preço com crédito ÷ preço pago no diesel da Empurrada. Vermelho = abaixo de Piraí. </p>
  ${conc(`O Km/L remunerado do 4º trimestre não foi revisado: as ${O.kml.q3q4_iguais} placas seguem com o valor do 3º. Em ${O.kml.comDif} de ${O.kml.grupos} grupos o mesmo modelo, na mesma operação, tem Km/L remunerado diferente. Na Empurrada, o fator de crédito do diesel de Cuiabá caiu de 0,94 para ${f2(O.fator.impacto['CBA|2026'].f)} em 2026 e o de Macacu ficou abaixo de Piraí: <b>R$ ${K(fimp)} mil em 2026</b> se os dois seguissem a referência (o fiscal confirma o crédito recuperado).`)}`);
}

// 14 · divergências
{
  const D = [
    ['Manutenção: contrato VW acima do FT', `R$ ${K(X.vw.fatura - X.vw.ft)} mil`, `${X.vw.placas} placas; FT ${f3(X.vw.rk_ft)}/km × fatura ${f3(X.vw.rk_vw)}/km`, 'média'],
    ['Crédito de imposto do diesel (Empurrada)', `R$ ${K(O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp)} mil`, 'Cuiabá 0,94 → 0,78 em jan/26; Macacu abaixo de Piraí', 'baixa (fiscal)'],
    ['Km/L do 4º trimestre sem revisão', 'revisão', `${O.kml.q3q4_iguais} placas com a régua do Q3`, 'alta'],
    ['Km/L: régua diferente no mesmo modelo', `R$ ${K(O.kml.disp_rs)} mil`, `${f0(O.kml.disp_lit)} L contra nós`, 'alta'],
    ['Km/L: ativas com consumo zero e mudança fora da revisão', 'cadastro', `${O.kml.zeradas} zeradas · ${O.kml.fora} fora da revisão`, 'alta'],
    ['Remunerado da DRE acima do FT', `R$ ${M(P.manut.rem - P.manut.ft + P.pneu.rem - P.pneu.ft)} mi`, 'composição do planejamento (manutenção e pneu)', 'interno'],
  ];
  slide(`${head('Divergências de remuneração', `${X.ROT}: o que está fora da regra ou da base`)}
  <table style="margin-top:14px"><tr><th>Divergência</th><th class="n">Valor</th><th>Base</th><th>Confiança</th></tr>
  ${D.map(r => `<tr><td><b>${r[0]}</b></td><td class="n"><b>${r[1]}</b></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table>
  ${conc(`Fora da regra ou da base: <b>R$ ${K(X.vw.fatura - X.vw.ft + O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp + O.kml.disp_rs)} mil</b> (contrato VW acima do pago, crédito do diesel da Empurrada e Km/L diferente no mesmo modelo), mais a revisão do Km/L do 4º trimestre, que muda o combustível de toda a frota. Dentro de casa: o remunerado da DRE R$ ${M(P.manut.rem - P.manut.ft + P.pneu.rem - P.pneu.ft)} mi acima do FT em manutenção e pneu esconde parte do déficit.`)}`);
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
  <div class="grid g3" style="margin-top:12px;gap:14px">${ks.filter(k => k.startsWith('EMP')).map(k => tile(nm(k), 'R$ ' + f2(tot(k)) + '/km', `diesel ${f0(TT[k].diesel / tot(k) * 100)}% do frete`)).join('')}</div>
  ${(() => { const e = ks.filter(k => k.startsWith('EMP')); const sh = e.map(k => TT[k].diesel / tot(k) * 100); return conc(`No T1 o frete do trecho é <b>diesel: ${f0(Math.min(...sh))}% a ${f0(Math.max(...sh))}%</b> do R$/km nas Empurradas, com Km/L de ${f2(Math.min(...e.map(k => TT[k].kml)))} a ${f2(Math.max(...e.map(k => TT[k].kml)))}. Manutenção de cavalo e carreta soma R$ ${f2(Math.min(...e.map(k => TT[k].manut_cav + TT[k].manut_carr)))} a ${f2(Math.max(...e.map(k => TT[k].manut_cav + TT[k].manut_carr)))}/km. O resultado do T1 é o Km/L real contra o Km/L de cada trecho.`); })()}`);
  const D1 = X.t1_dre, us = Object.keys(D1), PC = [['comb', 'Combustível'], ['manut', 'Manutenção'], ['carr', 'Carreta'], ['pneu', 'Pneu'], ['lav', 'Lavagem'], ['ipva', 'IPVA'], ['seguro', 'Seguro'], ['icms', 'ICMS']];
  const v = (u, c, k) => (D1[u][c] || {})[k] || 0;
  slide(`${head('T1 · DRE de frota', 'Remunerado × realizado na Empurrada e nos Insumos')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th>${us.map(u => `<th class="n" colspan="3">${NOME[u] || u}</th>`).join('')}</tr>
  <tr><td></td>${us.map(() => '<td class="n note">rem.</td><td class="n note">real</td><td class="n note">Δ</td>').join('')}</tr>
  ${PC.map(([c, n]) => `<tr><td>${n}</td>${us.map(u => { const d = v(u, c, 'real') - v(u, c, 'rem'); return `<td class="n">${K(v(u, c, 'rem'))}</td><td class="n">${K(v(u, c, 'real'))}</td><td class="n" style="color:${cor(d)}"><b>${K(d)}</b></td>`; }).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:6px">Vermelho = custou acima do remunerado. Na Empurrada o remunerado de frota sai do frete de cada trecho × viagens.</p>
  ${(() => { const dd = us.map(u => { const l = PC.filter(([c]) => c !== 'icms').map(([c, n]) => [n, v(u, c, 'real') - v(u, c, 'rem')]).sort((a, b) => b[1] - a[1]); return { u, t: l.reduce((s, x) => s + x[1], 0), top: l[0] }; }); return conc(`Sem o ICMS, o T1 custou ${dd.map(d => `<b>${NOME[d.u] || d.u} ${d.t >= 0 ? '+' : '−'}R$ ${K(Math.abs(d.t))} mil</b>`).join(', ')} contra o remunerado. Maior desvio em cada uma: ${dd.map(d => `${NOME[d.u] || d.u}, ${d.top[0].toLowerCase()} (R$ ${K(d.top[1])} mil)`).join('; ')}. O crédito de ICMS realizado entra à parte e reduz o custo do combustível.`); })()}`);
  const FX = X.t1_fixo, fk = Object.keys(FX), FCs = [['equipamentoAtivo', 'Equipamento ativo'], ['equipamentoParado', 'Equipamento parado'], ['equipeAtiva', 'Equipe'], ['qlpAdm', 'QLP adm.'], ['estacionariaAtivo', 'Estacionária'], ['outraDespesa', 'Outras']];
  slide(`${head('T1 · fixo', 'Fixo do período por unidade: equipamento ativo e parado')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mil</th>${fk.map(k => `<th class="n">${nm(k)}</th>`).join('')}</tr>
  ${FCs.map(([c, n]) => `<tr><td>${n}</td>${fk.map(k => `<td class="n">${K(FX[k][c] || 0)}</td>`).join('')}</tr>`).join('')}
  <tr><td>Equipamentos ativos / parados (média)</td>${fk.map(k => `<td class="n">${f1(FX[k].ativos)} / ${f1(FX[k].parados)}</td>`).join('')}</tr></table>
  <p class="note" style="margin-top:6px">Faturamento Empurrada/Insumos: quantidade × valor unitário. O parado recebe o mesmo valor unitário de equipamento do ativo.</p>
  ${(() => { const t = k => FCs.reduce((s, [c]) => s + (FX[k][c] || 0), 0), big = fk.slice().sort((a, b) => t(b) - t(a))[0], x = FX[big]; return conc(`${nm(big)} concentra o fixo do T1: <b>R$ ${M(t(big))} mi</b>, com ${f1(x.ativos)} equipamentos ativos e ${f1(x.parados)} parados por mês. O equipamento parado recebe R$ ${M(x.equipamentoParado)} mi (${f0(x.equipamentoParado / (x.equipamentoAtivo + x.equipamentoParado) * 100)}% do fixo de equipamento). A equipe é o maior item (R$ ${M(x.equipeAtiva)} mi).`); })()}`);
}
// receita do período
if (X.receita) {
  const RC = Object.entries(X.receita).sort((a, b) => b[1].real - a[1].real);
  slide(`${head('Receita', `Receita líquida do período por projeto (DRE) · R$ ${M(RC.reduce((s, [, x]) => s + x.real, 0))} mi`)}
  <div style="margin-top:12px">${hbars({ w: 1136, lw: 180, lh: 30, linhas: RC.map(([p, x]) => ({ rot: p, rem: x.rem, real: x.real })), series: [{ k: 'rem', rot: 'Remunerado', cor: AZUL }, { k: 'real', rot: 'Realizado', cor: INK }], fmt: v => 'R$ ' + f1(v / 1e6) + ' mi' })}</div>
  ${(() => { const tot = RC.reduce((s, [, x]) => s + x.real, 0), dif = RC.map(([p, x]) => [p, x.real - x.rem]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); return conc(`Receita líquida de <b>R$ ${M(tot)} mi</b> em ${PER}; ${RC[0][0]} e ${RC[1][0]} são ${f0((RC[0][1].real + RC[1][1].real) / tot * 100)}%. Realizado e remunerado batem em quase todos os projetos; a exceção é ${dif[0][0]} (${dif[0][1] > 0 ? '+' : '−'}R$ ${M(Math.abs(dif[0][1]))} mi).`); })()}`);
}

console.log('ok', write(process.env.FT_HTML || 'analise.html'), 'slides');

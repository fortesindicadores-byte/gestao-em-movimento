// ============================================================
// Análise estrutural Freightech × DRE de frota, 2026 (versão 26/10/2026).
// Estrutura nova (CONTEXTO.md, 6b): definições → Resultado (dois perímetros,
// pago × remunerado DRE × realizado, por mês, por unidade com causa, o porquê do
// remunerado) → Combustível (km pago × rodado × abastecido, ponte com as três
// colunas, por unidade, placas, preço × ANP, Km/L e crédito) → Manutenção (regra,
// por unidade, mês a mês, idade, VW por placa) → Pneu e fixo → Erros · Gaps ·
// Oportunidades · Discrepantes (fichas + síntese) → T1 → Receita → fechamento.
// O teto (km da placa × ativos × 25) aparece UMA vez, como informação.
//   CMP=completa-2026.json EXTRA=extra-2026.json A2=analise2-2026.json OPO=opo.json FT_HTML=analise.html node deck-analise.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, cartoes, tabela, ponte, hbars, gbars, bars, lines, matriz, f0, f1, f2, f3, pct, MES, mv, NOME, lista, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const X = JSON.parse(readFileSync(process.env.CMP || 'completa-2026.json', 'utf8'));
const E = JSON.parse(readFileSync(process.env.EXTRA || 'extra-2026.json', 'utf8'));
const A = JSON.parse(readFileSync(process.env.A2 || 'analise2-2026.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const BK = JSON.parse(readFileSync(process.env.BOOK || 'book.json', 'utf8'));   // Book do Operador (book.py): inventário + dimensionamento oficial × ativos
const PER = `${mv(X.INI)} a ${mv(X.FIM)}`, N = X.n_meses;
const { slide, capa, capaSec, conc, concBlocos, write } = deck({ rodape: `Remuneração Freightech · Análise ${X.ROT} · Conlog`, marca: 'Remuneração <b>Freightech</b>', titulo: `Análise Freightech ${X.ROT}` });
const M = v => f1(Math.abs(v) < 5e4 ? 0 : v / 1e6), K = v => f0(Math.abs(v) < 500 ? 0 : v / 1e3), sM = v => Math.abs(v) < 5e4 ? '0,0' : (v >= 0 ? '+' : '−') + M(Math.abs(v)), sK = v => Math.abs(v) < 500 ? '0' : (v >= 0 ? '+' : '−') + K(Math.abs(v));
const head = (k, h, sub = '') => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const cor = v => v > 0 ? ACC : VERDE, red = v => `color:${cor(v)};font-weight:700`;
const tag = c => `<span class="tag ${c === 'alta' ? 'alta' : c === 'média' ? 'media' : c === 'erro' ? 'erro' : 'baixa'}">${c}</span>`;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
const C7 = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro'], C4 = ['comb', 'manut', 'carr', 'pneu'];
const P = X.peca, soma = k => C7.reduce((s, c) => s + P[c][k], 0);
const FT7 = soma('ft'), REM7 = soma('rem'), REAL7 = soma('real'), DEF = REAL7 - FT7;
const FX = X.t2_fixo, VARP = C4.reduce((s, c) => s + X.t2_pago[c], 0), VART = C4.reduce((s, c) => s + X.t2_teto[c], 0);
const US = Object.keys(X.peca_uni).filter(u => u !== 'GNA'), nm = u => NOME[u] || u;
const KU = A.km_uni, KT = A.km_tot, CP = X.comb_ponte, CU = X.comb_ponte_uni, MU = E.manut_uni, MC = E.manut_contas;
const SU = Object.fromEntries(US.map(u => [u, { ...E.saldo_uni[u], dif: E.saldo_uni[u].real - E.saldo_uni[u].ft }]));
const porDif = US.slice().sort((a, b) => SU[b].dif - SU[a].dif);

// ═══ capa ═══
capa(`T2 · Rota, AS e Van · ${PER}`, `Remuneração Freightech ${X.ROT}: o que o FT pagou, o que a frota custou e o que explica a diferença`,
  'Freightech placa a placa e quinzena a quinzena, cruzado com a Dispersão de km, os abastecimentos do ERP, a fatura do contrato VW e a DRE de frota. Cada achado é classificado (a confirmar, gap, oportunidade ou custo discrepante) e tem valor. Os valores são reconstruídos com as premissas do FT; os relatórios oficiais ainda estão sendo liberados pela TI.');

// ═══ definições ═══
{
  const u = 'CBA', s = SU[u], t = X.teto_uni[u];
  slide(`${head('Antes de começar', 'Quatro termos que aparecem em toda tabela desta análise', `Exemplo: ${nm(u)}, ${PER}, as sete contas de frota (combustível, manutenção, carroceria, pneu, lavagem, IPVA, seguro)`)}
  ${cartoes([
    { k: 'Pago FT', n: 'R$ ' + M(s.ft) + ' mi', p: 'O que o Freightech paga pela frota: R$/km do caminhão (premissas do FT) × km remunerado dos mapas rodados, mais o fixo por caminhão. O km dos mapas vem da <b>nossa Dispersão de km</b> (viagens realizadas × km por mapa, mais recargas e noturnas); não é a fatura.', o: 'Tabelas Caminhão e Resumo do FT × Dispersão de km' },
    { k: 'Remunerado DRE', n: 'R$ ' + M(s.rem) + ' mi', p: 'O que o planejamento lançou na DRE como receita de frota esperada, conta a conta. Pode diferir do pago FT por imposto (regime tributário: lucro real × crédito presumido) e pela composição do planejamento; a diferença fica em aberto até os relatórios oficiais do FT.', o: 'DRE de frota · coluna Remunerado' },
    { k: 'Realizado DRE', n: 'R$ ' + M(s.real) + ' mi', p: 'O que de fato gastamos, lançado na DRE por conta. É contra o pago FT que ele se compara: <b>pago − realizado = resultado da frota</b>.', o: 'DRE de frota · coluna Realizado', acc: true },
    { k: 'Teto (informativo)', n: 'R$ ' + M(t.var_teto) + ' mi', p: `R$/km × km da placa × ativos × 25 mapas: o variável se todos os ativos rodassem todos os dias. Em ${nm(u)} o variável pago foi R$ ${M(t.var_pago)} mi. <b>Não é meta nem base de comparação</b>; aparece só aqui.`, o: 'Resumo do FT · Total Viagens' },
  ])}
  ${conc(`Toda ponte e tabela desta análise traz as três colunas: pago FT, remunerado DRE e realizado. A diferença <b>realizado − pago FT</b> é o resultado da frota; a diferença <b>remunerado DRE − pago FT</b> fica só registrada: pode ser imposto (regime tributário) ou composição do planejamento, e não é tratada como erro até os relatórios oficiais do FT.`, 'Como ler')}`);
}

// ═══ Parte 1 · Resultado ═══
capaSec(1, 'Resultado', 'Quanto o FT pagou pela frota T2, quanto ela custou nas contas que dá para comparar, onde o déficit está e por quê.');

// 1a · quanto o FT pagou (perímetro A)
slide(`${head('Quanto o FT pagou pela frota T2', `R$ ${M(FX.fixo_at + FX.fixo_par + VARP)} mi em ${N} meses: fixo das ativas, fixo das paradas e variável dos mapas rodados`, `${PER} · Rota, AS e Van · frota média de ${f0(X.t2_frota.ativos_mes)} caminhões ativos e ${f0(X.t2_frota.parados_mes)} parados por mês`)}
  ${ponte({ h: 250, itens: [{ rot: 'Fixo das ativas', v: FX.fixo_at, tot: true, cor: INK }, { rot: 'Fixo das paradas', v: FX.fixo_par, cor: INK3 }, { rot: 'Variável pago\n(mapas rodados)', v: VARP, cor: AZUL }, { rot: 'Remuneração\nde frota', v: FX.fixo_at + FX.fixo_par + VARP, tot: true }], fmt: v => 'R$ ' + M(v) + ' mi' })}
  ${cartoes([
    { k: 'Fixo por caminhão ativo', n: 'R$ ' + K(FX.fixo_at / X.t2_frota.ativos_mes / N) + ' mil<small> /mês</small>', p: 'FINAME + seguro + IPVA + rastreador (só no RJ) + faixa refletiva. A lavagem é a única parte do fixo que exige o caminhão ativo.', o: 'Resumo · Total por Caminhão Frota Ativa' },
    { k: 'Fixo por caminhão parado', n: 'R$ ' + K(FX.fixo_par / X.t2_frota.parados_mes / N) + ' mil<small> /mês</small>', p: `As mesmas parcelas, sem lavagem e sem variável. ${f0(X.t2_frota.parados_mes)} parados por mês somaram R$ ${M(FX.fixo_par)} mi.`, o: 'Resumo · Total por Caminhão Frota Parada' },
    { k: 'Variável por km pago', n: 'R$ ' + f2(VARP / X.t2_pago.km) + '/km', p: `${M(X.t2_pago.km)} mi km remunerados pelos mapas rodados (Dispersão de km). Diesel ${f0(X.t2_pago.comb / VARP * 100)}%, manutenção ${f0(X.t2_pago.manut / VARP * 100)}%, pneu ${f0(X.t2_pago.pneu / VARP * 100)}%, carroceria ${f0(X.t2_pago.carr / VARP * 100)}%.`, o: 'Caminhão · Total Custo Variável × Dispersão' },
    { k: 'Informativo: o dimensionamento', n: f1(KT.viag_ativo_mes) + '<small> mapas por ativo/mês</small>', p: `O FT dimensiona o variável para 25 mapas por caminhão ativo (R$ ${M(VART)} mi no período). A rede rodou ${f1(KT.viag_ativo_mes)}. Não é meta nem base de comparação.`, o: 'Resumo · Total Viagens' },
  ])}`);

// 1b · quanto custou (perímetro B)
slide(`${head('Quanto custou, nas contas que dá para comparar', `Sete contas: o FT pagou R$ ${M(FT7)} mi, a DRE lançou R$ ${M(REM7)} mi e a frota custou R$ ${M(REAL7)} mi`, `${PER} · combustível, manutenção, carroceria, pneu, lavagem, IPVA e seguro · FINAME, rastreador e faixa ficam fora porque a DRE de frota não tem a linha`)}
  ${cartoes([
    { k: 'Pago FT', n: 'R$ ' + M(FT7) + ' mi', p: 'R$/km × km dos mapas rodados, mais lavagem, IPVA e seguro do fixo.', o: 'FT × Dispersão de km' },
    { k: 'Remunerado DRE', n: 'R$ ' + M(REM7) + ' mi', p: `${sM(REM7 - FT7)} mi sobre o pago. Quase tudo em manutenção e pneu (próximos slides).`, o: 'DRE de frota' },
    { k: 'Realizado DRE', n: 'R$ ' + M(REAL7) + ' mi', p: `${sM(DEF)} mi sobre o pago FT. R$ ${K(DEF / N)} mil por mês.`, o: 'DRE de frota', acc: true },
    { k: 'Resultado da frota', n: 'R$ ' + sM(FT7 - REAL7) + ' mi', p: `pago FT − realizado. ${f0(DEF / FT7 * 100)}% acima do que o FT paga.`, o: 'nas sete contas', acc: true },
  ])}
  ${tabela({ cols: [{ t: 'R$ mi · ' + PER }, ...C7.map(c => ({ t: NM[c], n: true })), { t: 'Total', n: true }], rows: [
    ['Pago FT', ...C7.map(c => M(P[c].ft)), { v: '<b>' + M(FT7) + '</b>' }],
    ['Remunerado DRE', ...C7.map(c => M(P[c].rem)), { v: '<b>' + M(REM7) + '</b>' }],
    ['Realizado DRE', ...C7.map(c => M(P[c].real)), { v: '<b>' + M(REAL7) + '</b>' }],
    { c: ['<b>Realizado − pago FT</b>', ...C7.map(c => ({ v: sM(P[c].real - P[c].ft), style: red(P[c].real - P[c].ft) })), { v: sM(DEF), style: red(DEF) }], cls: 'sep' },
    ['Remunerado DRE − pago FT', ...C7.map(c => ({ v: sM(P[c].rem - P[c].ft), style: Math.abs(P[c].rem - P[c].ft) > 2e5 ? red(P[c].rem - P[c].ft) : '' })), { v: sM(REM7 - FT7) }],
  ] })}
  ${concBlocos([
    { t: 'Déficit', v: 'R$ ' + M(DEF) + ' mi', s: `em ${N} meses; a frota custou ${f0(REAL7 / FT7 * 100)}% do que o FT pagou nas sete contas.` },
    { t: 'Em que contas', v: 'manutenção e combustível', s: `manutenção ${sM(P.manut.real - P.manut.ft)} mi (${f1(P.manut.real / P.manut.ft)}× o pago) e combustível ${sM(P.comb.real - P.comb.ft)} mi (+${f0((P.comb.real / P.comb.ft - 1) * 100)}%); as outras cinco dão sobra de R$ ${M(-(DEF - (P.manut.real - P.manut.ft) - (P.comb.real - P.comb.ft)))} mi.` },
    { t: 'Seguro é sobra aparente', v: 'R$ ' + K(P.seguro.ft) + ' mil', s: 'o FT paga seguro e a DRE de frota do T2 não tem custo nem remunerado lançado: o custo está em outra conta. Fica nos pontos a confirmar.' },
  ])}`);

// 1c · mês a mês
{
  const SM = E.saldo_mes, vs = Object.keys(SM), d = vs.map(v => SM[v].real - SM[v].ft);
  const mn = vs[d.indexOf(Math.min(...d))], mx = vs[d.indexOf(Math.max(...d))];
  slide(`${head('O déficit mês a mês', `De R$ ${K(Math.min(...d))} mil em ${mv(mn)} a R$ ${K(Math.max(...d))} mil em ${mv(mx)}: o pago FT fica parado e o realizado sobe`, 'R$ por mês · as sete contas de frota do T2')}
  ${lines({ w: 1136, h: 200, labels: vs.map(mv), series: [{ data: vs.map(v => SM[v].ft), cor: INK, rotulo: 'pago FT', pontos: true }, { data: vs.map(v => SM[v].rem), cor: AZUL, rotulo: 'remun. DRE', pontos: true, dash: true }, { data: vs.map(v => SM[v].real), cor: ACC, rotulo: 'realizado', pontos: true }], yfmt: v => 'R$ ' + M(v) + ' mi', y0: 1.7e6, y1: 3.0e6, pad: { l: 60, r: 96, t: 16, b: 30 } })}
  ${tabela({ classe: 'compacta', cols: [{ t: 'R$ mil' }, ...vs.map(v => ({ t: mv(v), n: true }))], rows: [['Pago FT', ...vs.map(v => K(SM[v].ft))], ['Remunerado DRE', ...vs.map(v => K(SM[v].rem))], ['Realizado', ...vs.map(v => K(SM[v].real))], { c: ['<b>Realizado − pago FT</b>', ...vs.map(v => ({ v: sK(SM[v].real - SM[v].ft), style: red(SM[v].real - SM[v].ft) }))], cls: 'sep' }], style: 'margin-top:6px' })}
  ${(() => { const pm = X.peca_mes, i = vs.indexOf(mx); return concBlocos([
    { t: 'O pago não acompanha', v: 'R$ ' + K(Math.min(...vs.map(v => SM[v].ft))) + ' a ' + K(Math.max(...vs.map(v => SM[v].ft))) + ' mil', s: 'o pago FT varia só com os mapas rodados e o preço do diesel; o realizado varia com a oficina e os litros.' },
    { t: 'O pior mês', v: mv(mx), s: `manutenção de R$ ${K(pm.manut_real[i])} mil (pago R$ ${K(pm.manut_ft[i])} mil) e combustível de R$ ${K(pm.comb_real[i])} mil (pago R$ ${K(pm.comb_ft[i])} mil).` },
    { t: 'Combustível é constante', v: 'R$ ' + K(Math.min(...pm.comb_real.map((v, k) => v - pm.comb_ft[k]))) + ' a ' + K(Math.max(...pm.comb_real.map((v, k) => v - pm.comb_ft[k]))) + ' mil/mês', s: 'acima do pago em todos os meses: é estrutural (consumo e km), não sazonal.' },
    { t: 'Manutenção oscila', v: 'R$ ' + K(Math.min(...pm.manut_real)) + ' a ' + K(Math.max(...pm.manut_real)) + ' mil/mês', s: `contra um pago de R$ ${K(P.manut.ft / N)} mil/mês: é a oficina que faz o mês.` },
  ], 'Leitura', 4); })()}`);
}

// 1d · por unidade: onde está e por quê
{
  const L = porDif.map(u => { const p = X.peca_uni[u], t = X.teto_uni[u]; const real4 = C4.reduce((s, c) => s + p[c].real, 0); return { u, n: nm(u), dif: SU[u].dif, m: p.manut.real - p.manut.ft, c: p.comb.real - p.comb.ft, o: SU[u].dif - (p.manut.real - p.manut.ft) - (p.comb.real - p.comb.ft), ckr: real4 / t.rodado, pago: KU[u].rskm_pago, vc: KU[u].viag_ativo_mes, par: E.fixo_uni[u].parados / (E.fixo_uni[u].ativos + E.fixo_uni[u].parados) }; });
  const top = L[0], ok = L.filter(x => Math.abs(x.dif) < 0.03 * DEF), g = E.comb_uni_placa, vw = A.vw_placa.uni;
  const r = L.find(x => x.u === 'CGR'), gr = L.find(x => x.u === 'GRL'), cb = L.find(x => x.u === 'CBA');
  slide(`${head('Resultado por unidade', `${top.n} concentra ${f0(top.dif / DEF * 100)}% do déficit; ${lista(ok.map(x => x.n))} fecham a menos de 3% do pago`, `Realizado − pago FT, R$ mil, ${PER} · as sete contas de frota`)}
  <div class="duas">
    <div>${bars({ w: 640, h: 170, labels: L.map(x => x.n.replace('Rio de Janeiro', 'Rio').replace('Nova Friburgo', 'N. Friburgo').replace('Florianópolis', 'Floripa').replace('Rondonópolis', 'Rondonóp.')), data: L.map(x => x.dif), cor: i => L[i].dif > 0.03 * DEF ? ACC : INK3, fmt: v => K(v), fs: 9.5 })}
    <p class="note">Barra = realizado − pago FT (R$ mil). Vermelho = acima de 3% do déficit total.</p></div>
    ${tabela({ classe: 'mini', cols: [{ t: 'Unidade' }, { t: 'Real − FT', n: true }, { t: 'Manut.', n: true }, { t: 'Comb.', n: true }, { t: 'Outras', n: true }, { t: 'Custo/km rodado', n: true }, { t: 'R$/km pago', n: true }],
      rows: L.map(x => [{ v: '<b>' + x.n + '</b>' }, { v: sK(x.dif), style: red(x.dif) }, { v: sK(x.m), style: red(x.m) }, { v: sK(x.c), style: red(x.c) }, { v: sK(x.o), style: red(x.o) }, { v: f2(x.ckr), style: x.ckr > x.pago * 1.1 ? red(1) : '' }, f2(x.pago)]) })}
  </div>
  ${concBlocos([
    { t: r.n + ' = consumo e oficina', v: 'R$ ' + K(r.dif) + ' mil', s: `${g.CGR.placas_abaixo15} das ${g.CGR.placas} placas rodam 15% ou mais abaixo do Km/L previsto (${f0(g.CGR.km_abaixo15_pct)}% do km, ${K(g.CGR.lit_extra_abaixo15)} mil L a mais); contrato VW R$ ${K(vw.CGR.dif)} mil acima do pago em ${vw.CGR.placas} placas; oficina R$ ${K(MU.CGR.dre.oficina.real)} mil.` },
    { t: gr.n + ' = oficina de frota velha', v: 'R$ ' + K(gr.dif) + ' mil', s: `idade mediana ${f0(MU.GRL.vida_med)} meses, oficina R$ ${K(MU.GRL.dre.oficina.real)} mil (${f1(MU.GRL.dre.oficina.real / MU.GRL.pago_ft)}× o pago) e ${g.GRL.placas_abaixo15} placas abaixo do Km/L (${f0(g.GRL.km_abaixo15_pct)}% do km).` },
    { t: cb.n + ' = km e oficina', v: 'R$ ' + K(cb.dif) + ' mil', s: `dispersão de R$ ${K(KU.CBA.disp_rs)} mil (+${f0(KU.CBA.disp_km / KU.CBA.pago * 100)}% de km acima do pago); oficina R$ ${K(MU.CBA.dre.oficina.real)} mil com só ${f0(MU.CBA.contrato_pct)}% das placas em contrato.` },
    { t: 'O que não explica', v: 'parados e mapas', s: `${lista(ok.filter(x => x.par > 0.28).map(x => `${x.n} (${f0(x.par * 100)}% parados)`))} ${ok.filter(x => x.par > 0.28).length > 1 ? 'têm' : 'tem'} mais caminhão parado que ${top.n} (${f0(top.par * 100)}%) e fecham a conta. O que separa é o custo por km rodado contra o R$/km pago.` },
  ])}`);
}

// 1e · remunerado DRE × FT: o porquê
{
  const RQ = A.rem_manut_porque, RM = A.rem_manut_mes, RP = A.rem_pneu_mes, vs = RM.vig;
  const cand = Object.entries(RQ).filter(([k]) => !k.startsWith('re'));
  const pneuBate = vs.filter((v, i) => RP.rem[i] / RP.pago[i] < 1.1).map(mv);
  slide(`${head('Remunerado DRE × pago FT', `O remunerado da DRE fica R$ ${M(REM7 - FT7)} mi acima do pago reconstruído, em manutenção e pneu; a diferença fica em aberto até os relatórios oficiais`, 'R$ por mês · manutenção do T2')}
  <div class="duas">
    <div>${lines({ w: 600, h: 190, labels: vs.map(mv), series: [{ data: RM.pago, cor: INK, rotulo: 'pago FT', pontos: true }, { data: RM.rem, cor: AZUL, rotulo: 'remun. DRE', pontos: true }, { data: RM.real, cor: ACC, rotulo: 'realizado', pontos: true }], yfmt: v => K(v) + ' mil', y0: 2e5, y1: 9.5e5, pad: { l: 56, r: 92, t: 20, b: 30 } })}</div>
    <div>${tabela({ classe: 'mini', cols: [{ t: 'Composição testada · manutenção' }, { t: 'Soma R$ mi', n: true }, { t: 'Rem. DRE ÷', n: true }, { t: 'Correlação', n: true }, { t: 'Erro mediano', n: true }], rows: cand.map(([k, x]) => [k, M(x.soma), f2(x.razao) + '×', f2(x.r), f0(x.erro_med_pct) + '%']) })}
    <p class="note">Remunerado DRE de manutenção = R$ ${M(RQ.rem_dre)} mi. Cada linha é uma forma possível de o planejamento montar o número; a razão diz quanto ele fica acima, a correlação diz se o desenho mensal é o mesmo.</p></div>
  </div>
  ${concBlocos([
    { t: 'Manutenção', v: sM(P.manut.rem - P.manut.ft) + ' mi (+' + f0((P.manut.rem / P.manut.ft - 1) * 100) + '%)', s: `o remunerado segue o desenho mensal do pago (correlação ${f2(cand[0][1].r)}), mas fica ${f2(cand[0][1].razao)}× acima: é o pago FT com um fator, não outra conta. Com o contrato da placa em vez do Manutenção R$/KM a razão sobe para ${f2(cand[2][1].razao)}×.` },
    { t: 'Pneu', v: sM(P.pneu.rem - P.pneu.ft) + ' mi', s: `acima do pago de ${mv(vs[0])} a ${mv(vs[vs.findIndex((v, i) => RP.rem[i] / RP.pago[i] < 1.1) - 1] || vs[0])}; em ${lista(pneuBate)} passa a bater (${f2(RP.rem[vs.length - 1] / RP.pago[vs.length - 1])}×). Algo mudou na composição em jul/26.` },
    { t: 'Seguro', v: 'R$ ' + K(P.seguro.ft) + ' mil sem conta', s: 'o FT paga seguro por placa e a DRE de frota dos projetos T2 não tem remunerado nem realizado: a linha mora em outra conta ou não é lançada.' },
    { t: 'Contra-prova', v: 'as outras batem', s: `combustível +${f0((P.comb.rem / P.comb.ft - 1) * 100)}%, lavagem, IPVA e carroceria a menos de 3% do pago FT. A diferença está só em manutenção e pneu, e é ela que separa as duas colunas.` },
  ])}
  <p class="note">Não é erro afirmado: o pago FT aqui é reconstruído com as premissas do FT, e uma hipótese é imposto (a Ambev não paga como lucro real e nós estamos no crédito presumido). Pendências: os relatórios oficiais do FT (a TI está liberando os endpoints) e como o planejamento monta o remunerado de manutenção e pneu, e o que mudou em jul/26 no pneu.</p>`);
}

// ═══ Parte 2 · Combustível ═══
capaSec(2, 'Combustível', `${f0(P.comb.ft / VARP * 100)}% do variável pago. O km pago, rodado e abastecido; a ponte do pago ao realizado com as três colunas; a causa por unidade e por placa; o preço contra a ANP; o Km/L remunerado.`);

// 2a · km por unidade
{
  const L = US.slice().sort((a, b) => KU[b].pago - KU[a].pago);
  slide(`${head('Km por unidade: pago, rodado e abastecido', `Rodamos ${M(KT.rodado)} mi km e abastecemos ${M(KT.abastecido)} mi; o FT pagou ${M(KT.pago)} mi`, `${PER} · km pago = mapas rodados × km por mapa (Dispersão de km) · abastecido = km dos abastecimentos do ERP nos projetos T2`)}
  ${gbars({ w: 1136, h: 180, linhas: L.map(u => ({ rot: nm(u).replace('Rio de Janeiro', 'Rio').replace('Nova Friburgo', 'N. Friburgo').replace('Florianópolis', 'Floripa').replace('Rondonópolis', 'Rondonóp.'), p: KU[u].pago, r: KU[u].rodado, a: KU[u].abastecido })), series: [{ k: 'p', rot: 'km pago', cor: INK }, { k: 'r', rot: 'km rodado', cor: AZUL }, { k: 'a', rot: 'km abastecido', cor: INK3 }], fmt: v => K(v), fs: 9.5 })}
  ${tabela({ classe: 'mini', style: 'margin-top:4px', cols: [{ t: 'km mil' }, ...L.map(u => ({ t: nm(u).replace('Rio de Janeiro', 'Rio').replace('Nova Friburgo', 'N. Friburgo').replace('Florianópolis', 'Floripa').replace('Rondonópolis', 'Rondonóp.'), n: true })), { t: 'T2', n: true }],
    rows: [
      ['Mapas por ativo/mês (informativo)', ...L.map(u => f1(KU[u].viag_ativo_mes)), f1(KT.viag_ativo_mes)],
      ['Rodado acima do pago (dispersão)', ...L.map(u => { const d = KU[u].disp_km / KU[u].pago; return { v: pct(d * 100, 0), style: d > 0.05 ? red(1) : '' }; }), pct((KT.rodado / KT.pago - 1) * 100, 0)],
      ['· R$ mil ao R$/km pago', ...L.map(u => ({ v: sK(KU[u].disp_rs), style: red(KU[u].disp_rs) })), { v: sK(KT.disp_rs), style: red(1) }],
      ['Abastecido acima do rodado', ...L.map(u => { const a = KU[u].inat_km / KU[u].rodado; return { v: pct(a * 100, 0), style: a > 0.05 ? red(1) : '' }; }), pct((KT.abastecido / KT.rodado - 1) * 100, 0)],
      ['· R$ mil ao R$/km pago', ...L.map(u => ({ v: sK(KU[u].inat_rs), style: red(KU[u].inat_rs) })), { v: sK(KT.inat_rs), style: red(1) }],
    ] })}
  <p class="note">O FT dimensiona 25 mapas por ativo; o número é só contexto. Dispersão = km rodado além do pago, meta 5%. Abastecido acima do rodado = placa inativa no FT ou placa da Empurrada abastecendo no projeto da Rota.</p>
  ${concBlocos([
    { t: 'Dispersão', v: 'R$ ' + K(KT.disp_rs) + ' mil', s: `${pct((KT.rodado / KT.pago - 1) * 100, 0)} de km acima do pago na rede; ${lista(L.filter(u => KU[u].disp_km / KU[u].pago > 0.1).map(nm))} acima de 10%. O km a mais só deixa de ser perda quando é validado na revisão quinzenal.` },
    { t: 'Placa inativa que roda', v: 'R$ ' + K(KT.inat_rs) + ' mil', s: `${A.inativas.placas} placas marcadas como inativas no FT abasteceram ${M(A.inativas.km)} mi km (${f0(A.inativas.km_pct_abast)}% do km abastecido); ${A.inativas.fora_ft.placas} nem estão no cadastro. Em ${nm('MCC')} são ${K(KU.MCC.inat_km)} mil km: Empurrada abastecendo na Rota ou ativação errada.` },
    { t: 'Nova Friburgo', v: pct((KU.NFR.rodado / KU.NFR.pago - 1) * 100, 0), s: 'roda menos do que o FT paga pelos mapas: o km por mapa da revisão está acima do km real das viagens. É o único caso a favor.' },
  ])}`);
}

// 2b · ponte com as três colunas
slide(`${head('Combustível: do pago FT ao realizado, com o remunerado DRE ao lado', `R$ ${M(CP.rs)} mi abastecidos contra R$ ${M(CP.comb_pago)} mi pagos pelo FT; o planejamento lançou R$ ${M(P.comb.rem)} mi`, `${PER} · T2 · R$`)}
  ${ponte({ h: 200, itens: [{ rot: 'Pago FT', v: CP.comb_pago, tot: true }, { rot: 'Mix de\nplacas', v: CP.ft_regua }, { rot: 'Dispersão\n(rodado − pago)', v: CP.km_disp }, { rot: 'Km de placa\ninativa', v: CP.km_fora }, { rot: 'Consumo\n(Km/L)', v: CP.ef }, { rot: 'Preço\n(R$/L)', v: CP.pr }, { rot: 'Abastecido\n(ERP)', v: CP.rs, tot: true }, { rot: 'ICMS, Arla,\ncontábil', v: CP.contabil }, { rot: 'Realizado\nDRE', v: CP.dre_real, tot: true }], fmt: v => 'R$ ' + f1(Math.abs(v) / 1e6) + ' mi', fs: 10.5 })}
  ${cartoes([
    { k: 'Pago FT', n: 'R$ ' + M(CP.comb_pago) + ' mi', p: `${M(CP['Km Rem. TT'])} mi km × (diesel + 5% Arla) ÷ Km/L da placa.` },
    { k: 'Remunerado DRE', n: 'R$ ' + M(P.comb.rem) + ' mi', p: `${pct((P.comb.rem / P.comb.ft - 1) * 100, 0)} sobre o pago FT: o planejamento acompanha.` },
    { k: 'Realizado DRE', n: 'R$ ' + M(P.comb.real) + ' mi', p: `${sM(P.comb.real - P.comb.ft)} mi sobre o pago (+${f0((P.comb.real / P.comb.ft - 1) * 100)}%).`, acc: true },
    { k: 'Litros', n: M(CP.lit) + ' mi L', p: `previsto ${M(CP.lit_esp)} mi L (+${f0((CP.lit / CP.lit_esp - 1) * 100)}%) · R$ ${f2(CP.rs / CP.lit)}/L.` },
  ])}
  ${concBlocos([
    { t: 'Km sem pagamento', v: 'R$ ' + M(CP.km_disp + CP.km_fora) + ' mi', s: `dispersão R$ ${M(CP.km_disp)} mi + placas inativas R$ ${M(CP.km_fora)} mi: litros queimados em km que o FT não paga.` },
    { t: 'Consumo', v: 'R$ ' + M(CP.ef) + ' mi', s: `${f0((CP.lit / CP.lit_esp - 1) * 100)}% mais litros do que o Km/L remunerado das placas prevê para o km rodado.` },
    { t: 'Mix de placas', v: 'R$ ' + M(CP.ft_regua) + ' mi', s: 'o FT paga pelo R$/km médio das placas ativas da unidade; as que mais rodam têm Km/L previsto pior que essa média.' },
    { t: 'Preço joga a favor', v: 'R$ ' + M(-CP.pr) + ' mi', s: 'o tanque interno do Rio, de Florianópolis e de Macacu compra abaixo do preço remunerado; nas outras unidades o preço custa a mais (slide do preço).' },
  ])}`);

// 2c · por unidade (tabela aprovada)
{
  const U = US.slice().sort((a, b) => (CU[b].dre_real - CU[b].comb_pago) - (CU[a].dre_real - CU[a].comb_pago));
  const cel = v => ({ v: sK(v), style: red(v) }), totD = U.reduce((s, u) => s + CU[u].dre_real - CU[u].comb_pago, 0), top = U.slice(0, 3);
  const g = E.comb_uni_placa, tanque = U.filter(u => g[u].pl_real < g[u].pl_rem - 0.3).map(nm), caro = U.filter(u => CU[u].pr > 3e4).map(nm);
  slide(`${head('Combustível por unidade', `${lista(top.map(nm))} somam ${f0(top.reduce((s, u) => s + CU[u].dre_real - CU[u].comb_pago, 0) / totD * 100)}% da diferença, por causas diferentes`, 'R$ mil · vermelho = custou a mais do que o FT paga · Km/L real × previsto pelo FT para as placas que rodaram')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Pago FT', n: true }, { t: 'Rem. DRE', n: true }, { t: 'Mix', n: true }, { t: 'Dispersão', n: true }, { t: 'Km inativa', n: true }, { t: 'Consumo', n: true }, { t: 'Preço', n: true }, { t: 'Contábil', n: true }, { t: 'Realizado', n: true }, { t: 'Real − FT', n: true }, { t: 'Km/L real × prev.', n: true }],
    rows: U.map(u => { const x = CU[u]; return [{ v: '<b>' + nm(u) + '</b>' }, K(x.comb_pago), K(X.peca_uni[u].comb.rem), cel(x.ft_regua), cel(x.km_disp), cel(x.km_fora), cel(x.ef), cel(x.pr), cel(x.contabil), K(x.dre_real), { v: '<b>' + sK(x.dre_real - x.comb_pago) + '</b>', style: red(x.dre_real - x.comb_pago) }, f2(x.km / x.lit) + ' × ' + f2(x.km / x.lit_esp)]; }),
    tot: ['<b>T2</b>', K(CP.comb_pago), K(P.comb.rem), sK(CP.ft_regua), sK(CP.km_disp), sK(CP.km_fora), sK(CP.ef), sK(CP.pr), sK(CP.contabil), K(CP.dre_real), sK(CP.dre_real - CP.comb_pago), f2(CP.km / CP.lit) + ' × ' + f2(CP.km / CP.lit_esp)] })}
  ${concBlocos([
    { t: 'Onde', v: f0(top.reduce((s, u) => s + CU[u].dre_real - CU[u].comb_pago, 0) / totD * 100) + '% em três unidades', s: top.map(u => `${nm(u)} R$ ${K(CU[u].dre_real - CU[u].comb_pago)} mil`).join(' · ') + '.' },
    { t: nm('CGR') + ' = consumo', v: K(g.CGR.lit_extra_abaixo15) + ' mil L a mais', s: `${g.CGR.placas_abaixo15} de ${g.CGR.placas} placas 15% abaixo do Km/L (${f0(g.CGR.km_abaixo15_pct)}% do km): ${g.CGR.pior.slice(0, 2).map(p => `${p[0]} ${f2(p[1])} × ${f2(p[2])}`).join(', ')}. O preço joga a favor (R$ ${f2(g.CGR.pl_real)} × ${f2(g.CGR.pl_rem)}/L) e ainda sobra R$ ${K(CU.CGR.dre_real - CU.CGR.comb_pago)} mil.` },
    { t: nm('CBA') + ' = km', v: 'R$ ' + K(CU.CBA.km_disp) + ' mil de dispersão', s: `+${f0(KU.CBA.disp_km / KU.CBA.pago * 100)}% de km acima do pago, ${g.CBA.placas_abaixo15} placas abaixo do Km/L e preço R$ ${f2(g.CBA.pl_real)} contra ${f2(g.CBA.pl_rem)} remunerado.` },
    { t: 'Preço', v: 'tanque interno a favor', s: `${lista(tanque)} compram abaixo do remunerado; em ${lista(caro)} o preço custa a mais.` },
  ])}`);
}

// 2d · placas discrepantes de consumo
{
  const KR = A.kml_ruim, rows = KR.top.slice(0, 10);
  slide(`${head('Custos discrepantes · consumo', `${KR.placas} das ${KR.de} placas ativas rodam 15% ou mais abaixo do Km/L remunerado: ${K(KR.lit)} mil litros e R$ ${M(KR.rs)} mi a mais`, `${PER} · placa a placa, abastecimentos do ERP × Km/L remunerado da placa no FT · as dez piores`)}
  <div class="duas" style="grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Placa' }, { t: 'Unidade' }, { t: 'Modelo' }, { t: 'Km/L real', n: true }, { t: 'Km/L FT', n: true }, { t: 'Km', n: true }, { t: 'Litros a mais', n: true }, { t: 'R$', n: true }],
      rows: rows.map(r => [{ v: '<b>' + r[0] + '</b>' }, nm(r[1]), String(r[2]).replace(/\.0$/, ''), { v: f2(r[3]), style: red(1) }, f2(r[4]), f0(r[5]), f0(r[6]), 'R$ ' + f0(r[7])]) })}
    <div>${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Placas', n: true }, { t: 'Litros a mais', n: true }, { t: 'R$ mil', n: true }], rows: US.slice().sort((a, b) => KR.uni[b].rs - KR.uni[a].rs).map(u => [nm(u), f0(KR.uni[u].placas), f0(KR.uni[u].lit), K(KR.uni[u].rs)]), tot: ['<b>T2</b>', f0(KR.placas), f0(KR.lit), K(KR.rs)] })}
    <p class="note">Litros a mais = km rodado ÷ Km/L real − km rodado ÷ Km/L remunerado; R$ ao preço pago pela placa. Vale para a vistoria (vazamento, injeção, filtro, pneu murcho, motor ligado parado), o perfil de rota e o feedback ao motorista.</p></div>
  </div>
  ${concBlocos([
    { t: 'Concentração', v: nm('CGR') + ' ' + f0(KR.uni.CGR.rs / KR.rs * 100) + '%', s: `${KR.uni.CGR.placas} placas e R$ ${K(KR.uni.CGR.rs)} mil; as três piores são 1719/17.190 fazendo 1,4 a 1,7 km/L contra 3,17 remunerados.` },
    { t: 'Padrão', v: 'modelo antigo', s: `${rows.filter(r => /^17/.test(String(r[2]))).length} das dez piores são VW 17.190/1719. Ou o Km/L validado dessas placas está alto para a idade, ou há defeito: as duas hipóteses pedem vistoria antes da revisão do Km/L.` },
    { t: 'Peso', v: f0(KR.km_pct) + '% do km', s: `as ${KR.placas} placas respondem por ${f0(KR.km_pct)}% do km abastecido do T2 e por R$ ${M(KR.rs)} mi dos R$ ${M(P.comb.real - P.comb.ft)} mi de déficit do combustível.` },
  ])}`);
}

// 2e · preço × ANP por unidade
{
  const AN = A.anp, L = US.slice().sort((a, b) => AN[b].acima - AN[a].acima);
  slide(`${head('Preço do diesel × ANP', `Compramos R$ ${K(AN._tot)} mil acima da ANP em ${PER}; o FT paga o menor entre o nosso preço e a ANP`, 'Abastecimentos do ERP (só diesel S10, OS encerradas) × ANP da unidade na quinzena · R$ por litro')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Litros', n: true }, { t: 'Preço pago R$/L', n: true }, { t: 'ANP R$/L', n: true }, { t: 'Litros acima da ANP', n: true }, { t: 'R$ acima da ANP', n: true }, { t: 'Abastecimentos', n: true }],
    rows: L.map(u => { const x = AN[u]; return [{ v: '<b>' + nm(u) + '</b>' }, f0(x.lit), { v: f2(x.pl), style: x.pl > x.anp ? red(1) : '' }, f2(x.anp), f0(x.lit_acima_pct) + '%', { v: 'R$ ' + f0(x.acima), style: red(x.acima) }, f0(x.n)]; }),
    tot: ['<b>T2</b>', f0(L.reduce((s, u) => s + AN[u].lit, 0)), '', '', '', 'R$ ' + f0(AN._tot), f0(L.reduce((s, u) => s + AN[u].n, 0))] })}
  ${concBlocos([
    { t: 'Onde custa', v: lista(L.slice(0, 3).map(nm)), s: `R$ ${K(L.slice(0, 3).reduce((s, u) => s + AN[u].acima, 0))} mil dos R$ ${K(AN._tot)} mil; em ${nm(L[0])} ${f0(AN[L[0]].lit_acima_pct)}% dos litros saem acima da ANP (R$ ${f2(AN[L[0]].pl)} contra ${f2(AN[L[0]].anp)}).` },
    { t: 'Onde o tanque segura', v: lista(L.filter(u => AN[u].pl < AN[u].anp - 0.3).map(nm)), s: 'tanque interno comprando bem abaixo da ANP: é o único lugar em que o preço gera sobra contra o FT.' },
    { t: 'Ação', v: 'posto com preço negociado', s: 'a NF que subimos ao FT vira o preço pago na quinzena: cada centavo acima da ANP é nosso. Negociar o posto e cobrar o que cobrou acima.' },
  ])}`);
}

// 2f · Km/L remunerado e crédito da Empurrada
{
  const F = O.fator, anos = ['2024', '2025', '2026'], imp = F.impacto['CBA|2026'].imp + F.impacto['MCC|2026'].imp;
  slide(`${head('Km/L remunerado e crédito de imposto', `O Km/L de ${O.kml.q3q4_iguais} placas não foi revisado no 4º trimestre; na Empurrada o crédito do diesel de Cuiabá e Macacu fica abaixo de Piraí`, 'Km/L: tabela Caminhão (ROTA), 2026 · crédito: TrechoEmpurrada, preço com crédito ÷ preço pago')}
  ${cartoes([
    { k: 'Revisão do Q4', n: f0(O.kml.q3q4_mudaram) + ' de ' + f0(O.kml.q3q4_iguais), p: 'placas mudaram de Km/L em out/26: a revisão trimestral não aconteceu (troca do especialista) e o Q4 roda com o consumo validado do Q3.' },
    { k: 'Mesmo modelo, Km/L diferente', n: f0(O.kml.comDif) + ' de ' + f0(O.kml.grupos), p: `grupos modelo × mês com valores diferentes na mesma operação; saldo contra nós de ${f0(O.kml.disp_lit)} L (R$ ${K(O.kml.disp_rs)} mil), quase todo em Piraí Empurrada.` },
    { k: 'Fora da revisão', n: f0(O.kml.fora) + ' placas', p: 'mudaram de valor fora da 1ª quinzena do trimestre (Piraí 20, Cuiabá 13). Cada mudança tem placa e quinzena na planilha de apoio.' },
    { k: 'Ativas com consumo zero', n: f0(O.kml.zeradas), p: 'placas ativas com Km/L zero na 1ª quinzena de abr/26, nas três Empurradas: se o zero entra na média simples, a média da operação cai.' },
  ])}
  <div class="duas" style="margin-top:10px">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Fator de crédito do diesel · Empurrada' }, ...anos.map(a => ({ t: a, n: true }))], rows: ['PIR', 'CBA', 'MCC'].map(u => [{ v: '<b>' + nm(u) + '</b>' }, ...anos.map(a => ({ v: F.ano[u][a] == null ? '—' : f2(F.ano[u][a]), style: u !== 'PIR' && F.ano[u][a] != null && F.ano.PIR[a] - F.ano[u][a] > 0.03 ? red(1) : '' }))]) })}
    <div>${tabela({ classe: 'compacta', cols: [{ t: 'Se o fator fosse o de Piraí' }, { t: 'Fator', n: true }, { t: 'Referência', n: true }, { t: 'R$ mil', n: true }], rows: ['CBA|2026', 'MCC|2026', 'MCC|2025'].map(k => [nm(k.split('|')[0]) + ' ' + k.split('|')[1], f2(F.impacto[k].f), f2(F.impacto[k].ref), { v: K(F.impacto[k].imp), style: red(1) }]) })}</div>
  </div>
  ${concBlocos([
    { t: 'Revisão', v: 'pedir a do Q4', s: 'o Km/L validado decide dois terços do variável; três meses sem revisão congelam a conta no Q3, para o bem e para o mal.' },
    { t: 'Crédito', v: 'R$ ' + K(imp) + ' mil em 2026', s: `Cuiabá caiu de 0,94 para ${f2(F.ano.CBA['2026'])} em jan/26 e Macacu ficou abaixo de Piraí: antes de levar, o fiscal confirma o crédito recuperado de verdade.` },
    { t: 'Cadastro', v: 'placa a placa', s: 'zeradas, fora da revisão e mesmo modelo com valores diferentes são erros de cadastro corrigíveis na quinzena; a planilha de apoio traz cada placa.' },
  ])}`);
}

// ═══ Parte 3 · Manutenção ═══
capaSec(3, 'Manutenção', `A conta com o maior déficit: o FT paga R$ ${M(P.manut.ft)} mi, a frota custou R$ ${M(P.manut.real)} mi. A regra do FT, a composição do custo, a unidade, o mês, a idade e o contrato VW placa a placa.`);

// 3a · regra e composição
{
  const MR = X.manut_regra, regras = Object.entries(MR).filter(([r]) => r !== 'zero fora da carência');
  const ofi = MC.oficina.real + MC.materiais.real + MC.personaliz.real;
  slide(`${head('Manutenção: o que o FT paga e o que a frota custa', `Pago R$ ${M(P.manut.ft)} mi · contrato do fabricante R$ ${M(MC.contrato.real)} mi · oficina R$ ${M(ofi)} mi`, `${PER} · T2 · o FT paga pelo campo Manutenção R$/KM da placa (BID da montadora, tabela por idade ou zero na carência) × km dos mapas rodados`)}
  ${cartoes([
    { k: 'Pago FT', n: 'R$ ' + M(P.manut.ft) + ' mi', p: `R$ ${f3(P.manut.ft / X.t2_pago.km)}/km pago em média.`, o: 'Caminhão · Manutenção R$/KM × Dispersão' },
    { k: 'Remunerado DRE', n: 'R$ ' + M(P.manut.rem) + ' mi', p: `${pct((P.manut.rem / P.manut.ft - 1) * 100, 0)} sobre o pago FT (slide do porquê).` },
    { k: 'Realizado DRE', n: 'R$ ' + M(P.manut.real) + ' mi', p: `contrato R$ ${M(MC.contrato.real)} mi + oficina R$ ${M(MC.oficina.real)} mi + materiais e personalização R$ ${K(MC.materiais.real + MC.personaliz.real)} mil.`, acc: true },
    { k: 'Realizado − pago FT', n: sM(P.manut.real - P.manut.ft) + ' mi', p: `${f1(P.manut.real / P.manut.ft)}× o pago. O pago cobre o contrato e sobra R$ ${M(P.manut.ft - MC.contrato.real)} mi para uma oficina de R$ ${M(ofi)} mi.`, acc: true },
  ])}
  ${tabela({ classe: 'compacta', style: 'margin-top:10px', cols: [{ t: 'Regra aplicada pelo FT (placas ativas da Rota)' }, { t: 'Placas', n: true }, { t: 'Km pago', n: true }, { t: 'R$/km', n: true }, { t: 'Pago R$ mil', n: true }, { t: 'Vida mediana (meses)', n: true }],
    rows: regras.map(([r, x]) => [{ v: '<b>' + r + '</b>' }, f0(x.placas), f0(x.km), f3(x.rk), K(x.pago), f1(x.vida)]) })}
  ${concBlocos([
    { t: 'Composição', v: 'contrato quase consome o pago', s: `o contrato do fabricante lançado na DRE (R$ ${M(MC.contrato.real)} mi) é ${f0(MC.contrato.real / P.manut.ft * 100)}% do que o FT paga; a oficina inteira fica descoberta.` },
    { t: 'Regra', v: f0(MR['BID da montadora'].placas) + ' placas no BID', s: `R$ ${f3(MR['BID da montadora'].rk)}/km; ${MR['carência'].placas} em carência (zero, ${f1(MR['carência'].vida)} meses); ${MR['tabela por idade'].placas} sem BID na tabela por idade (R$ ${f3(MR['tabela por idade'].rk)}/km, ${f0(MR['tabela por idade'].vida)} meses).` },
    { t: 'O contrato não entra', v: 'R$/KM só informativo', s: 'o FT paga o Manutenção R$/KM (BID ou tabela), não o contrato da placa. Por isso a fatura VW pode ficar acima do pago mesmo com a placa em contrato (slide do VW).' },
  ])}`);
}

// 3b · por unidade
{
  const U = US.slice().sort((a, b) => (X.peca_uni[b].manut.real - X.peca_uni[b].manut.ft) - (X.peca_uni[a].manut.real - X.peca_uni[a].manut.ft));
  const ofi = u => MU[u].dre.oficina.real + MU[u].dre.materiais.real + MU[u].dre.personaliz.real;
  const novo = US.slice().sort((a, b) => MU[a].vida_med - MU[b].vida_med)[0], velho = US.slice().sort((a, b) => MU[b].vida_med - MU[a].vida_med)[0];
  const ofiRuim = US.slice().sort((a, b) => ofi(b) / MU[b].pago_ft - ofi(a) / MU[a].pago_ft)[0];
  slide(`${head('Manutenção por unidade', `${lista(U.slice(0, 3).map(nm))} somam ${f0(U.slice(0, 3).reduce((s, u) => s + X.peca_uni[u].manut.real - X.peca_uni[u].manut.ft, 0) / (P.manut.real - P.manut.ft) * 100)}% do déficit de manutenção`, 'R$ mil · idade em meses · carência em % do km · contrato em % das placas · vermelho = custou acima do pago')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Placas', n: true }, { t: 'Idade', n: true }, { t: 'Carência', n: true }, { t: 'Contrato', n: true }, { t: 'R$/km FT', n: true }, { t: 'Pago FT', n: true }, { t: 'Rem. DRE', n: true }, { t: 'Contrato real', n: true }, { t: 'Oficina real', n: true }, { t: 'Realizado', n: true }, { t: 'Real − FT', n: true }, { t: 'Real ÷ FT', n: true }],
    rows: U.map(u => { const m = MU[u], p = X.peca_uni[u].manut; return [{ v: '<b>' + nm(u) + '</b>' }, f0(m.placas), f0(m.vida_med), f0(m.carencia_km_pct) + '%', f0(m.contrato_pct) + '%', f3(m.rk_ft), K(p.ft), K(p.rem), K(m.dre.contrato.real), K(ofi(u)), K(p.real), { v: '<b>' + sK(p.real - p.ft) + '</b>', style: red(p.real - p.ft) }, { v: f1(p.real / p.ft) + '×', style: p.real / p.ft > 1.5 ? red(1) : '' }]; }),
    tot: ['<b>T2</b>', f0(US.reduce((s, u) => s + MU[u].placas, 0)), '', '', '', f3(P.manut.ft / X.t2_pago.km), K(P.manut.ft), K(P.manut.rem), K(MC.contrato.real), K(MC.oficina.real + MC.materiais.real + MC.personaliz.real), K(P.manut.real), sK(P.manut.real - P.manut.ft), f1(P.manut.real / P.manut.ft) + '×'] })}
  ${concBlocos([
    { t: nm('CGR'), v: 'R$ ' + K(X.peca_uni.CGR.manut.real - X.peca_uni.CGR.manut.ft) + ' mil', s: `o contrato sozinho (R$ ${K(MU.CGR.dre.contrato.real)} mil) ${MU.CGR.dre.contrato.real > X.peca_uni.CGR.manut.ft ? 'passa' : 'quase consome'} o pago (R$ ${K(X.peca_uni.CGR.manut.ft)} mil); ${f0(MU.CGR.contrato_pct)}% das ${MU.CGR.placas} placas em contrato e oficina de R$ ${K(ofi('CGR'))} mil por cima.` },
    { t: 'Idade não explica', v: nm(velho) + ' × ' + nm(novo), s: `${nm(velho)} (${f0(MU[velho].vida_med)} meses) recebe R$ ${f3(MU[velho].rk_ft)}/km, o maior da rede, e gasta R$ ${K(ofi(velho))} mil de oficina; ${nm(novo)} (${f0(MU[novo].vida_med)} meses, ${f0(MU[novo].carencia_km_pct)}% do km em carência) gasta R$ ${K(ofi(novo))} mil de oficina com caminhão de menos de um ano.` },
    { t: 'Pior relação', v: nm(ofiRuim) + ' ' + f1(ofi(ofiRuim) / MU[ofiRuim].pago_ft) + '×', s: `oficina de ${f1(ofi(ofiRuim) / MU[ofiRuim].pago_ft)} vezes o que o FT paga de manutenção na unidade.` },
    { t: 'Quem fecha', v: lista(U.filter(u => X.peca_uni[u].manut.real / X.peca_uni[u].manut.ft < 1.15).map(nm)) || 'ninguém', s: 'custo de manutenção a menos de 15% do pago: contrato e oficina cabem no R$/km do FT.' },
  ])}`);
}

// 3c · mês a mês (matriz)
{
  const MRt = A.manut_ratio, vs = MRt.vig, top = A.manut_mes_top.slice().sort((a, b) => b[2] / b[3] - a[2] / a[3]);
  const heat = v => v <= 1 ? 'rgba(30,142,90,.14)' : `rgba(242,44,5,${Math.min(.08 + (v - 1) * .28, .72).toFixed(2)})`;
  slide(`${head('Manutenção mês a mês', 'A oficina faz o mês: realizado ÷ pago FT por unidade, de 0,3× a 9,5×', `${PER} · verde = custou menos que o pago · vermelho = mais, quanto mais escuro maior`)}
  <div class="duas" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    ${matriz({ classe: 'compacta', primeira: 'Realizado ÷ pago FT', cols: vs.map(mv), linhas: US.map(u => ({ rot: nm(u), vals: MRt.uni[u] })), cor: heat, fmt: v => f1(v) + '×' })}
    <div>${tabela({ classe: 'compacta', cols: [{ t: 'Unidade · mês' }, { t: 'Realizado', n: true }, { t: 'Pago FT', n: true }, { t: '÷', n: true }], rows: top.slice(0, 8).map(r => [nm(r[0]) + ' · ' + mv(r[1]), K(r[2]) + ' mil', K(r[3]) + ' mil', { v: f1(r[2] / r[3]) + '×', style: red(1) }]) })}
    <p class="note">Meses em que o realizado passou de 2,5× o pago e de R$ 50 mil, mais os de Rondonópolis. Cada um pede a Carta de Custos aberta por placa, grupo e fornecedor.</p></div>
  </div>
  ${concBlocos([
    { t: nm('RON'), v: f1(MRt.uni.RON[0]) + '× em ' + mv(vs[0]), s: `frota de ${f0(MU.RON.vida_med)} meses com ${f0(MU.RON.carencia_km_pct)}% do km em carência (pago quase zero) e oficina desde janeiro: o FT não paga e a placa nova já custa.` },
    { t: nm('GRL'), v: 'acima de 2× em ' + MRt.uni.GRL.filter(v => v >= 2).length + ' meses', s: 'oficina de frota velha sem BID (tabela por idade) todo mês; é estrutural, não um evento.' },
    { t: 'Picos', v: lista(top.slice(0, 2).map(r => nm(r[0]) + ' ' + mv(r[1]))), s: 'um mês de oficina concentrada (motor, embreagem, freios) vale o déficit de um trimestre; a causa raiz é por placa, na Carta de Custos.' },
    { t: 'Quem fecha', v: nm('MCC'), s: `abaixo do pago em ${MRt.uni.MCC.filter(v => v < 1).length} dos ${vs.length} meses: contrato cobrindo a frota e oficina pequena.` },
  ])}`);
}

// 3d · por idade
{
  const I = X.manut_idade, e = Object.entries(I);
  slide(`${head('Manutenção por idade do caminhão', 'O R$/km pago sobe até 48 meses e depois fica parado; a oficina não', 'Placas ativas da Rota em 2026 · vida em meses · R$/km = Manutenção R$/KM do FT')}
  <div class="duas">
    ${bars({ w: 560, h: 220, labels: e.map(([k]) => k + ' meses'), data: e.map(([, x]) => x.rk), cor: INK, fmt: v => 'R$ ' + f3(v) })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'Vida (meses)' }, { t: 'Placas', n: true }, { t: 'R$/km FT', n: true }, { t: 'Com contrato', n: true }], rows: e.map(([k, x]) => [{ v: '<b>' + k + '</b>' }, f0(x.placas), f3(x.rk), f0(x.contrato) + '%']) })}
  </div>
  ${concBlocos([
    { t: 'Carência', v: e[0][1].placas + ' placas a zero', s: `até ${e[0][0].split('–')[1]} meses o FT não paga manutenção; a oficina dessas placas (Rondonópolis) não é zero.` },
    { t: 'Faixa descoberta', v: e[1][0] + ' meses', s: `R$ ${f3(e[1][1].rk)}/km pago e só ${f0(e[1][1].contrato)}% das placas em contrato: sai da carência e ainda não está coberta.` },
    { t: 'Não sobe com a idade', v: 'R$ ' + f3(Math.min(...e.slice(2).map(([, x]) => x.rk))) + ' a ' + f3(Math.max(...e.slice(2).map(([, x]) => x.rk))) + '/km', s: `acima de 24 meses o pago fica parado; as ${e[e.length - 1][1].placas} placas com ${e[e.length - 1][0]} meses recebem R$ ${f3(e[e.length - 1][1].rk)}/km e custam oficina de frota velha.` },
  ])}`);
}

// 3e · contrato VW placa a placa
{
  const V = A.vw_placa, rows = V.top.slice(0, 8), U = US.slice().sort((a, b) => V.uni[b].dif - V.uni[a].dif);
  slide(`${head('Gap · contrato VW acima do pago', `Em ${V.acima} das ${V.placas} placas com fatura a VW cobra mais do que o FT paga de manutenção: R$ ${K(V.dif_total)} mil no saldo`, `${PER} · fatura VW por placa e mês (vw_contrato_km) × Manutenção R$/KM do FT × km faturado · as oito maiores diferenças`)}
  <div class="duas" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Placa' }, { t: 'Unidade' }, { t: 'Km faturado', n: true }, { t: 'VW R$/km', n: true }, { t: 'FT R$/km', n: true }, { t: 'Diferença', n: true }, { t: 'Regra no FT' }],
      rows: rows.map(r => [{ v: '<b>' + r[0] + '</b>' }, nm(r[1]), f0(r[2]), { v: f3(r[3]), style: red(1) }, f3(r[4]), { v: 'R$ ' + f0(r[5]), style: red(1) }, r[6]]) })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Placas', n: true }, { t: 'Fatura VW', n: true }, { t: 'Pago FT', n: true }, { t: 'Diferença', n: true }], rows: U.map(u => [nm(u), f0(V.uni[u].placas), K(V.uni[u].fat), K(V.uni[u].ft), { v: sK(V.uni[u].dif), style: red(V.uni[u].dif) }]), tot: ['<b>T2</b>', f0(V.placas), K(X.vw.fatura), K(X.vw.ft), sK(V.dif_total)] })}
  </div>
  ${concBlocos([
    { t: 'Tamanho', v: 'R$ ' + K(V.dif_total) + ' mil', s: `fatura R$ ${f3(X.vw.rk_vw)}/km contra R$ ${f3(X.vw.rk_ft)}/km pagos nas mesmas placas e km; ${f0(V.acima / V.placas * 100)}% das placas em contrato custam acima do pago.` },
    { t: 'Onde', v: lista(U.slice(0, 2).map(nm)), s: `R$ ${K(V.uni[U[0]].dif + V.uni[U[1]].dif)} mil; em ${nm('GRL')} as maiores diferenças são placas na tabela por idade (sem BID) com a VW a R$ 1,25/km.` },
    { t: 'Por quê', v: 'o contrato não é a regra', s: 'o FT paga o BID da montadora (ou a tabela por idade), não o contrato da placa; um contrato acima do BID nunca é coberto. Cotar o contrato contra o BID placa a placa e não renovar acima dele.' },
  ])}`);
}

// ═══ Parte 4 · Pneu e fixo ═══
capaSec(4, 'Pneu e fixo', 'As contas que dão sobra, a diferença do remunerado DRE no pneu, quem financia a frota e quando as parcelas acabam.');

// 4a · pneu
{
  const PN = Object.entries(X.pneu).filter(([, x]) => x.placas >= 5), PU = E.pneu_uni, U = US.slice().sort((a, b) => (PU[a].real - PU[a].ft) - (PU[b].real - PU[b].ft));
  const m = PN.slice().sort((a, b) => b[1].placas - a[1].placas)[0];
  slide(`${head('Pneu', `Sobra de R$ ${M(P.pneu.ft - P.pneu.real)} mi: o FT paga pelo preço de tabela e compramos abaixo dele`, `${PER} · pago FT R$ ${M(P.pneu.ft)} mi · remunerado DRE R$ ${M(P.pneu.rem)} mi · realizado R$ ${M(P.pneu.real)} mi`)}
  <div class="duas" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Medida' }, { t: 'Placas', n: true }, { t: 'Pneus', n: true }, { t: 'Preço FT', n: true }, { t: 'Nossa compra', n: true }, { t: 'Δ', n: true }, { t: 'Recap. FT', n: true }, { t: 'Vida FT (km)', n: true }, { t: 'R$/km FT', n: true }],
      rows: PN.map(([mm, x]) => [{ v: '<b>' + mm + '</b>' }, f0(x.placas), f0(x.qtd), 'R$ ' + f0(x.tracao), x.compra_med ? 'R$ ' + f0(x.compra_med) : '—', { v: x.compra_med ? pct((x.compra_med / x.tracao - 1) * 100, 0) : '—', style: x.compra_med ? red(x.compra_med - x.tracao) : '' }, 'R$ ' + f0(x.recap), f0(x.vida), f2(x.rk)]) })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Pago FT', n: true }, { t: 'Rem. DRE', n: true }, { t: 'Realizado', n: true }, { t: 'Real − FT', n: true }], rows: U.map(u => [nm(u), K(PU[u].ft), K(PU[u].rem), K(PU[u].real), { v: sK(PU[u].real - PU[u].ft), style: red(PU[u].real - PU[u].ft) }]), tot: ['<b>T2</b>', K(P.pneu.ft), K(P.pneu.rem), K(P.pneu.real), sK(P.pneu.real - P.pneu.ft)] })}
  </div>
  ${concBlocos([
    { t: 'Preço', v: 'medida ' + m[0] + ': ' + pct((m[1].compra_med / m[1].tracao - 1) * 100, 0), s: `a medida de ${f0(m[1].placas)} placas sai a R$ ${f0(m[1].compra_med)} contra R$ ${f0(m[1].tracao)} de tabela do FT. Vale manter: o preço de compra é a sobra.` },
    { t: 'Vida', v: f0(m[1].vida) + ' km · ' + m[1].nrec + ' recapagens', s: 'é a premissa do FT; pneu descartado antes disso (calibragem, alinhamento) come a sobra. Prolog e Ginfo mostram quais.' },
    { t: 'Quem gasta acima', v: lista(U.filter(u => PU[u].real > PU[u].ft).map(nm)) || 'ninguém', s: `${lista(U.filter(u => PU[u].real > PU[u].ft).map(u => `${nm(u)} ${sK(PU[u].real - PU[u].ft)} mil`))}.` },
    { t: 'Remunerado DRE', v: sM(P.pneu.rem - P.pneu.ft) + ' mi acima', s: 'lançado acima do pago FT até jun/26 e batendo desde jul/26: a DRE mostrou o pneu melhor do que o FT paga no 1º semestre.' },
  ])}`);
}

// 4b · fixo e financiamento
{
  const S = X.frota_status, FF = X.finame_fim, Q = A.quitado, f0k = Object.keys(FF)[0], FU = E.fixo_uni;
  const U = US.slice().sort((a, b) => FU[b].fixo_par - FU[a].fixo_par);
  slide(`${head('Fixo e financiamento', `Caminhão financiado recebe R$ ${K(S.FINANCIADO.fixo_med)} mil de fixo por mês; quitado recebe R$ ${f0(Q.fixo_med)}`, 'Placas ativas da Rota em 2026 · fixo mediano por mês · FINAME = parcela do financiamento')}
  <div class="duas" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
    <div>${tabela({ classe: 'compacta', cols: [{ t: 'Financiamento' }, { t: 'Placas', n: true }, { t: 'Fixo/mês', n: true }, { t: 'FINAME/mês', n: true }, { t: 'Idade (meses)', n: true }], rows: Object.entries(S).sort((a, b) => b[1].placas - a[1].placas).map(([s, x]) => [{ v: '<b>' + s + '</b>' }, f0(x.placas), 'R$ ' + f0(x.fixo_med), 'R$ ' + f0(x.finame_med), f0(x.idade)]) })}
    ${tabela({ classe: 'compacta', style: 'margin-top:8px', cols: [{ t: 'Parcelas que faltam' }, { t: 'Placas', n: true }, { t: 'FINAME R$ mil/mês', n: true }], rows: Object.entries(FF).filter(([, x]) => x.placas).map(([k, x]) => [k + ' meses', f0(x.placas), K(x.finame_mes)]) })}</div>
    ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, { t: 'Ativos', n: true }, { t: 'Parados', n: true }, { t: 'Fixo ativos', n: true }, { t: 'Fixo parados', n: true }, { t: 'Por parado/mês', n: true }], rows: U.map(u => [nm(u), f1(FU[u].ativos), f1(FU[u].parados), K(FU[u].fixo_at) + ' mil', K(FU[u].fixo_par) + ' mil', 'R$ ' + f0(FU[u].fixo_par / FU[u].parados / N)]) })}
  </div>
  ${concBlocos([
    { t: 'Quitado parado não recebe', v: 'R$ ' + f0(Q.fixo_med) + '/mês', s: `${Q.placas} placas quitadas, idade mediana ${f0(Q.idade_med)} meses: o fixo é só seguro, IPVA e faixa, e a manutenção paga não sobe com a idade.` },
    { t: 'Parcelas acabando', v: 'R$ ' + K(FF[f0k].finame_mes) + ' mil/mês', s: `${FF[f0k].placas} placas terminam o financiamento em ${f0k} meses: esse FINAME sai da remuneração com a parcela. A renovação se planeja por aqui.` },
    { t: 'Parado recebe o fixo', v: 'R$ ' + M(FX.fixo_par) + ' mi', s: `${f0(X.t2_frota.parados_mes)} parados por mês recebem FINAME, seguro, IPVA, rastreador (RJ) e faixa; só a lavagem e o variável são do ativo. ${nm(U[0])} tem o maior fixo de parado (R$ ${K(FU[U[0]].fixo_par)} mil).` },
  ])}`);
}

// ═══ Parte 5 · Erros, gaps, oportunidades, discrepantes ═══
capaSec(5, 'A confirmar, gaps, oportunidades e custos discrepantes', 'Cada achado classificado, com o que é, o que medimos, quanto vale, a confiança e o próximo passo. O detalhe por placa e mês está na planilha de apoio.');
const ficha = (kicker, titulo, sub, rows, c) => slide(`${head(kicker, titulo, sub)}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Achado' }, { t: 'O que medimos', w: true }, { t: 'Quanto vale', n: true }, { t: 'Confiança' }, { t: 'Próximo passo', w: true }], rows: rows.map(r => [{ v: '<b>' + r[0] + '</b>' }, r[1], { v: '<b>' + r[2] + '</b>' }, tag(r[3]), r[4]]) })}
  ${c}`);
{
  const F = O.fator, cad = ((O.cadastro_seguro || []))[0];
  ficha('A confirmar', 'A confirmar: diferenças que dependem de relatório oficial, cadastro ou fiscal', 'Nada aqui é erro afirmado: são diferenças medidas na base, a conferir com os relatórios oficiais do FT, o planejamento e o fiscal', [
    ['Placa inativa no FT que roda', `${A.inativas.placas} placas inativas abasteceram ${M(A.inativas.km)} mi km (${f0(A.inativas.km_pct_abast)}% do km abastecido); ${A.inativas.fora_ft.placas} fora do cadastro`, 'R$ ' + K(KT.inat_rs) + ' mil', 'alta', 'abrir placa a placa: ativação da unidade ou Empurrada abastecendo na Rota (Macacu)'],
    ['Remunerado DRE acima do pago reconstruído', `manutenção ${f2(A.rem_manut_porque['pago FT (Manutenção R$/KM × km pago)'].razao)}× o pago; pneu acima até jun/26`, 'R$ ' + M(REM7 - FT7) + ' mi', 'baixa', 'aguardar os relatórios oficiais do FT; hipótese de imposto (lucro real × crédito presumido); fica fora das somas'],
    ['Seguro pago sem conta na DRE', `FT paga R$ ${K(P.seguro.ft)} mil; DRE de frota do T2 com R$ ${K(P.seguro.real)} mil`, 'R$ ' + K(P.seguro.ft) + ' mil', 'média', 'achar onde o seguro é lançado; se não é, a sobra é real'],
    ['Km/L: ativas com consumo zero', `${O.kml.zeradas} placas ativas com Km/L zero na 1ª abr/26 (Empurradas)`, 'cadastro', 'alta', 'corrigir na quinzena; pedir a regra da média (o zero conta?)'],
    ['Km/L: mesmo modelo, valores diferentes', `${O.kml.comDif} de ${O.kml.grupos} grupos; ${O.kml.fora} placas mudaram fora da revisão`, 'R$ ' + K(O.kml.disp_rs) + ' mil', 'alta', 'lista por placa na planilha; levar à revisão do Q4'],
    ['Rastreador pago só no RJ', '156 de 159 placas do RJ com R$ 106/mês; zero nas outras seis unidades, desde 2022', 'regra?', 'média', 'confirmar com o planejamento se é regra ou cadastro'],
    ['Diesel de Macacu a R$ 1,85/L', 'Macacu, 1ª ago/25: R$ 1,85/L contra ANP 6,16 (Rota e Empurrada)', 'R$ ' + K(O.preco.valor + O.preco.emp.perda) + ' mil (2025)', 'alta', 'histórico; conferir se foi corrigido na fatura'],
  ], concBlocos([{ t: 'Soma com valor', v: 'R$ ' + M(KT.inat_rs + P.seguro.ft + O.kml.disp_rs) + ' mi', s: 'placas inativas, seguro e Km/L. A diferença do remunerado DRE fica fora da soma até os relatórios oficiais.' }, { t: 'Quem confere', v: 'unidade, planejamento e fiscal', s: 'ativação e Km/L na quinzena (unidade); remunerado e seguro com o planejamento; imposto com o fiscal.' }], 'Síntese', 2));
}
{
  const ofi = MC.oficina.real + MC.materiais.real + MC.personaliz.real;
  ficha('Gaps', 'Gaps: o que o FT não paga e a frota custa', 'Gap = custo real sem linha equivalente no pago FT; é estrutural, não erro', [
    ['Oficina fora do contrato', `R$ ${M(ofi)} mi de oficina, materiais e personalização; o pago cobre o contrato e sobra R$ ${M(P.manut.ft - MC.contrato.real)} mi`, 'R$ ' + M(ofi - (P.manut.ft - MC.contrato.real)) + ' mi', 'alta', 'Carta de Custos por grupo (motor, embreagem, freios), placa e fornecedor; causa raiz nas placas que mais custam'],
    ['Contrato VW acima do pago', `${A.vw_placa.acima} de ${A.vw_placa.placas} placas; VW R$ ${f3(X.vw.rk_vw)}/km × FT R$ ${f3(X.vw.rk_ft)}/km`, 'R$ ' + K(A.vw_placa.dif_total) + ' mil', 'alta', 'cotar contrato × BID placa a placa; não renovar acima do BID'],
    ['Consumo acima do Km/L remunerado', `${f0((CP.lit / CP.lit_esp - 1) * 100)}% mais litros que o previsto para o km rodado`, 'R$ ' + M(CP.ef) + ' mi', 'alta', 'vistoria das 149 placas abaixo de 15%; perfil de rota; DriverPro'],
    ['Km rodado além do pago (dispersão)', `${pct((KT.rodado / KT.pago - 1) * 100, 0)} de km; meta 5%`, 'R$ ' + K(KT.disp_rs) + ' mil', 'alta', 'validar o km legítimo na revisão quinzenal; roteirizar o resto'],
    ['FINAME, rastreador e faixa', 'o FT paga R$ ' + M(FX.finame) + ' mi de FINAME e a DRE de frota não tem a linha: não dá para comparar', 'sem medida', 'média', 'trazer capital e rastreador para a DRE de frota ou comparar no resultado da unidade'],
    ['ICMS e Arla', `ICMS crédito realizado R$ ${M(-A.contas_fora.icms.real)} mi (rem. R$ ${M(-A.contas_fora.icms.rem)} mi); Arla real R$ ${K(A.contas_fora.arla.real)} mil (rem. R$ ${K(A.contas_fora.arla.rem)} mil)`, 'a favor', 'média', 'ficam fora das sete contas; conferir o crédito com o fiscal'],
  ], concBlocos([{ t: 'O gap que pesa', v: 'oficina', s: `R$ ${M(ofi - (P.manut.ft - MC.contrato.real))} mi descobertos: é o déficit de manutenção quase inteiro. O FT paga uma tabela (BID) e nós pagamos uma fatura.` }, { t: 'O que a operação controla', v: 'km e litros', s: `dispersão e consumo somam R$ ${M(KT.disp_rs + CP.ef)} mi e dependem de roteirização, validação do km e vistoria das placas.` }], 'Síntese', 2));
}
{
  const F = O.fator, FF = X.finame_fim, f0k = Object.keys(FF)[0], imp = F.impacto['CBA|2026'].imp + F.impacto['MCC|2026'].imp;
  ficha('Oportunidades', 'Oportunidades: o que podemos mudar e quanto vale', 'Oportunidade = dinheiro que entra ou deixa de sair com uma ação nossa', [
    ['Validar km legítimo na quinzena', `R$ ${K(KT.disp_rs)} mil de km rodado além do pago; o km validado vira remunerado na quinzena seguinte`, 'até R$ ' + K(KT.disp_rs) + ' mil', 'alta', 'registrar rota mudada, cliente novo e ida ao posto na revisão quinzenal'],
    ['Ativar e inativar as placas certas', `${A.inativas.placas} placas inativas rodando; ${A.inativas.fora_ft.placas} fora do cadastro`, 'R$ ' + K(KT.inat_rs) + ' mil', 'alta', 'lista de ativos na quinzena; placa inativa que roda não gera variável nem lavagem'],
    ['Revisão do Km/L do Q4', `${O.kml.q3q4_iguais} placas com o Km/L do Q3; mesmo modelo com valores diferentes`, 'R$ ' + K(O.kml.disp_rs) + ' mil + revisão', 'alta', 'preparar a crítica com o Km/L real por placa antes da 1ª quinzena'],
    ['Crédito de imposto do diesel (Empurrada)', `Cuiabá 0,94 → ${f2(F.ano.CBA['2026'])}; Macacu ${f2(F.ano.MCC['2026'])} contra Piraí ${f2(F.ano.PIR['2026'])}`, 'R$ ' + K(imp) + ' mil', 'baixa', 'fiscal confirma o crédito recuperado; depois, planejamento'],
    ['Diesel abaixo da ANP', `R$ ${K(A.anp._tot)} mil comprados acima da ANP; o FT paga o menor`, 'R$ ' + K(A.anp._tot) + ' mil', 'alta', 'posto com preço negociado em Cuiabá, Macacu, Guarulhos'],
    ['Pneu abaixo da tabela', `sobra de R$ ${M(P.pneu.ft - P.pneu.real)} mi; vida de 88.650 km com 2 recapagens`, 'manter R$ ' + M(P.pneu.ft - P.pneu.real) + ' mi', 'alta', 'calibragem e alinhamento para o pneu chegar à vida'],
    ['Renovação pelo fim das parcelas', `${FF[f0k].placas} placas terminam o FINAME em ${f0k} meses; quitado recebe R$ ${f0(A.quitado.fixo_med)}/mês`, 'R$ ' + K(FF[f0k].finame_mes) + ' mil/mês saem', 'alta', 'planejar a troca antes de a parcela acabar e a placa virar quitada parada'],
  ], concBlocos([{ t: 'Soma das oportunidades com valor', v: 'R$ ' + M(KT.disp_rs + KT.inat_rs + O.kml.disp_rs + imp + A.anp._tot) + ' mi', s: 'km validado, ativação, Km/L, crédito e preço; mais a sobra do pneu a manter e a renovação a planejar.' }, { t: 'A que depende de nós na quinzena', v: 'R$ ' + M(KT.disp_rs + KT.inat_rs) + ' mi', s: 'km e lista de ativos entram na revisão quinzenal: é rotina da unidade, sem negociação.' }], 'Síntese', 2));
}
{
  const KR = A.kml_ruim, top = A.manut_mes_top.slice().sort((a, b) => b[2] - a[2]), V = A.vw_placa;
  ficha('Custos discrepantes', 'Custos discrepantes: o que foge da curva, com placa, unidade e mês', 'Outlier = fora do padrão da própria frota; é onde a causa raiz rende mais', [
    ['Placas 15% abaixo do Km/L', `${KR.placas} de ${KR.de} placas; ${K(KR.lit)} mil L a mais; ${f0(KR.km_pct)}% do km`, 'R$ ' + M(KR.rs) + ' mi', 'alta', `vistoria das dez piores (${KR.top.slice(0, 3).map(r => r[0]).join(', ')}): 1,4 a 1,7 km/L contra 3,17`],
    ['Mês fora da curva na manutenção', `${top.slice(0, 3).map(r => `${nm(r[0])} ${mv(r[1])} R$ ${K(r[2])} mil (${f1(r[2] / r[3])}×)`).join('; ')}`, 'R$ ' + K(top.slice(0, 3).reduce((s, r) => s + r[2] - r[3], 0)) + ' mil', 'alta', 'Carta de Custos do mês: grupo, placa, fornecedor'],
    ['Rondonópolis', `${f1(A.manut_ratio.uni.RON[0])}× o pago em jan/26 com frota de ${f0(MU.RON.vida_med)} meses; oficina R$ ${K(MU.RON.dre.oficina.real)} mil no ano`, 'R$ ' + K(X.peca_uni.RON.manut.real - X.peca_uni.RON.manut.ft) + ' mil', 'alta', 'garantia da montadora: placa em carência não deveria pagar oficina'],
    ['Contrato VW por placa', `${V.top.slice(0, 2).map(r => `${r[0]} (${nm(r[1])}) R$ ${f3(r[3])}/km × FT ${f3(r[4])}`).join('; ')}`, 'R$ ' + f0(V.top[0][5] + V.top[1][5]) + ' nas duas', 'alta', 'renegociar as placas acima de 1,5× o pago'],
    ['Macacu abastecendo fora do pago', `${K(KU.MCC.inat_km)} mil km abastecidos acima do rodado da Rota (${pct(KU.MCC.inat_km / KU.MCC.rodado * 100, 0)})`, 'R$ ' + K(KU.MCC.inat_rs) + ' mil', 'média', 'separar Empurrada × Rota nos abastecimentos; corrigir o projeto da placa'],
    ['Guarulhos: 44% do km em placas ruins', `${E.comb_uni_placa.GRL.placas_abaixo15} de ${E.comb_uni_placa.GRL.placas} placas, ${K(E.comb_uni_placa.GRL.lit_extra_abaixo15)} mil L; frota de ${f0(MU.GRL.vida_med)} meses`, 'R$ ' + K(KR.uni.GRL.rs) + ' mil', 'alta', 'vistoria e perfil de rota; é a frota mais velha da rede'],
  ], concBlocos([{ t: 'Onde a causa raiz rende', v: 'placa, não média', s: 'as dez piores placas de consumo e os três piores meses de oficina valem mais que qualquer ação na média da unidade.' }, { t: 'Detalhe', v: 'planilha de apoio', s: 'placa × mês de consumo, manutenção (Carta e VW) e km, para a unidade tratar uma a uma.' }], 'Síntese', 2));
}
// síntese
{
  const ofi = MC.oficina.real + MC.materiais.real + MC.personaliz.real, F = O.fator, imp = F.impacto['CBA|2026'].imp + F.impacto['MCC|2026'].imp;
  const erros = KT.inat_rs + P.seguro.ft + O.kml.disp_rs, gaps = (ofi - (P.manut.ft - MC.contrato.real)) + A.vw_placa.dif_total + CP.ef + KT.disp_rs, opo = KT.disp_rs + KT.inat_rs + O.kml.disp_rs + imp + A.anp._tot;
  const sobras = -C7.reduce((s, c) => s + Math.min(P[c].real - P[c].ft, 0), 0);
  slide(`${head('Síntese', `Déficit de R$ ${M(DEF)} mi: gaps de R$ ${M(gaps)} mi menos R$ ${M(sobras)} mi de sobras; R$ ${M(opo)} mi têm ação nossa e R$ ${M(erros)} mi estão a confirmar`, `${PER} · T2 · sobras = pneu, carroceria, lavagem e seguro · os valores se sobrepõem em parte (a dispersão é gap e oportunidade); a conta de cada um está nas fichas`)}
  ${cartoes([
    { k: 'A confirmar', n: 'R$ ' + M(erros) + ' mi', p: `placas inativas rodando (R$ ${K(KT.inat_rs)} mil), seguro sem conta (R$ ${K(P.seguro.ft)} mil), Km/L por modelo (R$ ${K(O.kml.disp_rs)} mil). O remunerado DRE acima do pago (R$ ${M(REM7 - FT7)} mi) fica fora até os relatórios oficiais.`, o: 'confere: unidade, planejamento e fiscal' },
    { k: 'Gaps', n: 'R$ ' + M(gaps) + ' mi', p: `oficina descoberta (R$ ${M(ofi - (P.manut.ft - MC.contrato.real))} mi), consumo (R$ ${M(CP.ef)} mi), dispersão (R$ ${K(KT.disp_rs)} mil), contrato VW (R$ ${K(A.vw_placa.dif_total)} mil).`, o: 'é o déficit de verdade', acc: true },
    { k: 'Oportunidades', n: 'R$ ' + M(opo) + ' mi', p: `km validado e ativação na quinzena (R$ ${M(KT.disp_rs + KT.inat_rs)} mi), Km/L do Q4, crédito do diesel (R$ ${K(imp)} mil), preço × ANP (R$ ${K(A.anp._tot)} mil).`, o: 'ação nossa, com prazo' },
    { k: 'Discrepantes', n: f0(A.kml_ruim.placas) + ' placas', p: `R$ ${M(A.kml_ruim.rs)} mi de consumo em placas 15% abaixo do Km/L; três meses de oficina acima de 2,5×; Rondonópolis a ${f1(A.manut_ratio.uni.RON[0])}× em janeiro.`, o: 'causa raiz placa a placa' },
  ])}
  ${concBlocos([
    { t: 'O que fechar primeiro', v: 'oficina e consumo', s: `R$ ${M(ofi - (P.manut.ft - MC.contrato.real) + CP.ef)} mi; são as duas causas que separam ${nm('CGR')}, ${nm('GRL')} e ${nm('CBA')} das unidades que fecham.` },
    { t: 'O que é rotina da quinzena', v: 'km, ativos, preço', s: 'validar km, ativar/inativar certo e subir a NF do diesel negociado: sem negociação, só disciplina.' },
    { t: 'O que depende de terceiros', v: 'Km/L, crédito, remunerado', s: 'revisão do Q4 (especialista), crédito de imposto (fiscal), composição do remunerado (planejamento).' },
  ])}`);
}

// ═══ Parte 6 · T1 ═══
capaSec(6, 'Empurrada e Insumos (T1)', 'O frete do trecho só com as peças de frota; a DRE de frota remunerado × realizado; o fixo do equipamento.');
{
  const TT = X.t1_trecho, ks = Object.keys(TT), FR = [['diesel', 'Diesel'], ['manut_cav', 'Manutenção do cavalo'], ['manut_carr', 'Manutenção da carreta'], ['pneu', 'Pneu'], ['lav', 'Lavagem'], ['pedagio', 'Pedágio'], ['seguro', 'Seguro']];
  const nmk = k => { const [c, u] = k.split('|'); return (NOME[u] || u.replace('LATA PIRAI', 'Lata Piraí')) + (c === 'INSUMOS' ? ' · Insumos' : ''); };
  const fr = k => FR.reduce((s, [c]) => s + (TT[k][c] || 0), 0), pir = TT['EMPURRADA|PIR'];
  slide(`${head('T1 · R$/km de frota do trecho', `Na Empurrada o diesel é ${f0(pir.diesel / fr('EMPURRADA|PIR') * 100)}% do R$/km de frota em Piraí; o Km/L do trecho é ${f2(pir.kml)}`, 'Média ponderada pela previsão de km dos trechos ativos, 2026 · só as peças de frota (salário variável e lucro variável são equipe e margem, e ficam no Manual)')}
  <div class="duas">
    <div>${ponte({ w: 560, h: 220, itens: [...FR.filter(([c]) => pir[c] > 0.005).map(([c, n]) => ({ rot: n.replace('Manutenção do', 'Manut.').replace('Manutenção da', 'Manut.'), v: pir[c], cor: AZUL })), { rot: 'R$/km de frota\n' + nm('PIR'), v: fr('EMPURRADA|PIR'), tot: true }], fmt: v => f2(v), fs: 10 })}</div>
    <div>${tabela({ classe: 'compacta', cols: [{ t: 'R$/km do trecho' }, ...ks.map(k => ({ t: nmk(k), n: true }))], rows: FR.filter(([c]) => ks.some(k => (TT[k][c] || 0) > 0.004)).map(([c, n]) => [n, ...ks.map(k => f2(TT[k][c] || 0))]), tot: ['R$/km de frota', ...ks.map(k => f2(fr(k)))] })}
    ${tabela({ classe: 'compacta', style: 'margin-top:8px', cols: [{ t: '' }, ...ks.map(k => ({ t: nmk(k), n: true }))], rows: [['Km/L do trecho', ...ks.map(k => f2(TT[k].kml))], ['Diesel no R$/km de frota', ...ks.map(k => f0(TT[k].diesel / fr(k) * 100) + '%')], ['Trechos ativos', ...ks.map(k => f0(TT[k].trechos))]] })}</div>
  </div>
  ${concBlocos([
    { t: 'Diesel decide', v: f0(Math.min(...ks.filter(k => k.startsWith('EMP')).map(k => TT[k].diesel / fr(k) * 100))) + ' a ' + f0(Math.max(...ks.filter(k => k.startsWith('EMP')).map(k => TT[k].diesel / fr(k) * 100))) + '%', s: 'do R$/km de frota nas Empurradas: preço pago (+5% Arla) ÷ Km/L do trecho. O resultado do T1 é o Km/L real contra o do trecho.' },
    { t: 'Km/L do trecho', v: f2(Math.min(...ks.filter(k => k.startsWith('EMP')).map(k => TT[k].kml))) + ' a ' + f2(Math.max(...ks.filter(k => k.startsWith('EMP')).map(k => TT[k].kml))), s: 'um décimo abaixo do remunerado em Piraí custa ~5% a mais de diesel sem pagamento.' },
    { t: 'Manutenção', v: 'R$ ' + f2(pir.manut_cav + pir.manut_carr) + '/km em Piraí', s: 'cavalo em carência pela renovação (Actros 2651); volta a ~R$ 0,22/km quando ela acaba.' },
  ])}`);
}
{
  const D1 = X.t1_dre, us = Object.keys(D1), PC = [['comb', 'Combustível'], ['manut', 'Manutenção'], ['carr', 'Carreta'], ['pneu', 'Pneu'], ['lav', 'Lavagem'], ['ipva', 'IPVA'], ['seguro', 'Seguro'], ['icms', 'ICMS']];
  const v = (u, c, k) => (D1[u][c] || {})[k] || 0;
  const dd = us.map(u => { const l = PC.filter(([c]) => c !== 'icms').map(([c, n]) => [n, v(u, c, 'real') - v(u, c, 'rem')]).sort((a, b) => b[1] - a[1]); return { u, t: l.reduce((s, x) => s + x[1], 0), top: l[0] }; });
  slide(`${head('T1 · DRE de frota', `Sem o ICMS, ${dd.map(d => `${nm(d.u)} ${d.t >= 0 ? '+' : '−'}R$ ${K(Math.abs(d.t))} mil`).join(', ')} contra o remunerado`, `${PER} · R$ mil · remunerado = frete do trecho × viagens, lançado na DRE · vermelho = custou acima`)}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Conta' }, ...us.flatMap(u => [{ t: nm(u) + ' rem.', n: true }, { t: 'real', n: true }, { t: 'Δ', n: true }])],
    rows: PC.map(([c, n]) => [n, ...us.flatMap(u => { const d = v(u, c, 'real') - v(u, c, 'rem'); return [K(v(u, c, 'rem')), K(v(u, c, 'real')), { v: sK(d), style: red(d) }]; })]) })}
  ${concBlocos(dd.map(d => ({ t: nm(d.u), v: (d.t >= 0 ? '+' : '−') + 'R$ ' + K(Math.abs(d.t)) + ' mil', s: `maior desvio: ${d.top[0].toLowerCase()} (${sK(d.top[1])} mil). ${d.u === 'PIR' ? 'A carreta custa 2,4× o remunerado: manutenção de implemento fora da previsão do trecho.' : d.u === 'CBA' ? 'Carreta e combustível acima; o crédito de ICMS realizado (R$ ' + K(-v(d.u, 'icms', 'real')) + ' mil) ficou abaixo do previsto.' : 'Combustível acima do remunerado; manutenção e carreta abaixo.'}` })), 'Leitura', 3)}`);
}
{
  const FXT = X.t1_fixo, fk = Object.keys(FXT), FCs = [['equipamentoAtivo', 'Equipamento ativo'], ['equipamentoParado', 'Equipamento parado'], ['equipeAtiva', 'Equipe'], ['qlpAdm', 'QLP adm.'], ['estacionariaAtivo', 'Estacionária'], ['outraDespesa', 'Outras']];
  const nmk = k => { const [c, u] = k.split('|'); return (NOME[u] || u.replace('LATA PIRAI', 'Lata Piraí')) + (c === 'INSUMOS' ? ' · Insumos' : ''); };
  const t = k => FCs.reduce((s, [c]) => s + (FXT[k][c] || 0), 0), big = fk.slice().sort((a, b) => t(b) - t(a))[0], x = FXT[big];
  slide(`${head('T1 · fixo do período', `${nmk(big)} concentra R$ ${M(t(big))} mi de fixo; o equipamento parado recebe o mesmo valor unitário do ativo`, `${PER} · R$ mil · Faturamento Empurrada/Insumos: quantidade × valor unitário`)}
  ${tabela({ classe: 'compacta', cols: [{ t: 'R$ mil' }, ...fk.map(k => ({ t: nmk(k), n: true }))], rows: [...FCs.map(([c, n]) => [n, ...fk.map(k => K(FXT[k][c] || 0))]), ['Equipamentos ativos / parados (média por mês)', ...fk.map(k => f1(FXT[k].ativos) + ' / ' + f1(FXT[k].parados))]], tot: ['Total', ...fk.map(k => K(t(k)))] })}
  ${concBlocos([
    { t: 'Equipe é o maior item', v: 'R$ ' + M(x.equipeAtiva) + ' mi', s: `em ${nmk(big)}; o equipamento ativo recebe R$ ${M(x.equipamentoAtivo)} mi e o parado R$ ${M(x.equipamentoParado)} mi (${f0(x.equipamentoParado / (x.equipamentoAtivo + x.equipamentoParado) * 100)}% do fixo de equipamento).` },
    { t: 'Parado', v: f1(x.parados) + ' de ' + f1(x.ativos + x.parados), s: 'equipamentos por mês parados em Piraí recebendo o fixo inteiro: a renovação (Actros 2651) deixou cavalos antigos cadastrados.' },
    { t: 'Insumos', v: 'sem parado', s: `Lata Piraí com ${f1(FXT['INSUMOS|LATA PIRAI'].ativos)} ativos e equipe de R$ ${M(FXT['INSUMOS|LATA PIRAI'].equipeAtiva)} mi: é operação de equipe, não de equipamento.` },
  ])}`);
}

// ═══ Parte 7 · Receita ═══
capaSec(7, 'Receita', 'A receita líquida por projeto na DRE, remunerado × realizado, para fechar o perímetro.');
{
  const RC = Object.entries(X.receita).sort((a, b) => b[1].real - a[1].real), tot = RC.reduce((s, [, x]) => s + x.real, 0), dif = RC.map(([p, x]) => [p, x.real - x.rem]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  slide(`${head('Receita líquida por projeto', `R$ ${M(tot)} mi em ${PER}; ${RC[0][0]} e ${RC[1][0]} são ${f0((RC[0][1].real + RC[1][1].real) / tot * 100)}%`, 'DRE · R$ mi · remunerado (planejamento) × realizado')}
  ${hbars({ w: 1136, lw: 190, lh: 30, linhas: RC.map(([p, x]) => ({ rot: p, rem: x.rem, real: x.real })), series: [{ k: 'rem', rot: 'Remunerado', cor: AZUL }, { k: 'real', rot: 'Realizado', cor: INK }], fmt: v => 'R$ ' + M(v) + ' mi' })}
  ${concBlocos([
    { t: 'Total', v: 'R$ ' + M(tot) + ' mi', s: `realizado e remunerado batem em quase todos os projetos; a frota T2 (Rota, AS e Van) recebeu R$ ${M(FX.fixo_at + FX.fixo_par + VARP)} mi de remuneração de frota nesse período.` },
    { t: 'Exceção', v: dif[0][0], s: `${dif[0][1] > 0 ? '+' : '−'}R$ ${M(Math.abs(dif[0][1]))} mi sobre o remunerado: ${dif[0][0] === 'DISTRIBUIÇÃO URBANA' ? 'Anhanguera entrou com volume acima do planejado' : 'diferença de volume'}.` },
    { t: 'Perímetro', v: 'frota é parte', s: 'o déficit de R$ ' + M(DEF) + ' mi das sete contas de frota se compara com a receita de frota, não com a receita do projeto inteiro (equipe, QLP, lucro por HL).' },
  ])}`);
}

// ═══ Parte 8 · O Book do Operador ═══
capaSec(8, 'O que o Book do Operador diz', 'As regras contratuais do FT (Central de Ajuda, 66 registros) lidas contra cada achado desta análise, e o dimensionamento oficial contra os ativos.');
{
  const RB = Object.fromEntries(BK.regras.map(r => [r.t, r]));
  slide(`${head('Regra do Book × achado', 'Onde o Book confirma o achado, onde corrige a leitura e onde não alcança', 'Fonte: Book do Operador do Freightech, registros de Equipamentos, Lucro e Geral (atualizados entre ' + RB['MANUTENÇÃO'].atual.slice(0, 4) + ' e ' + BK.inv.mais_novo.slice(0, 4) + ')')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Achado' }, { t: 'O que o Book diz', w: true }, { t: 'O que muda na leitura', w: true }], rows: [
    [{ v: '<b>Dispersão de km</b>' }, 'o km do caminhão é revisto uma vez por mês (alteração de km até o 18º dia útil, com o dimensionamento da 2ª quinzena); o que muda por quinzena é o preço do diesel e a lista de ativos', 'a crítica do km legítimo tem uma janela por mês, não duas; o km a mais de um mês só entra no seguinte'],
    [{ v: '<b>Diesel acima da ANP</b>' }, 'posto comum e tanque externo: o menor entre o preço operadora e a ANP; tanque interno e cartão: o preço operadora real; sem NF por 45 dias, 90% da ANP', 'no Rio e em Florianópolis (tanque interno) comprar acima da ANP não é perda contra o FT; nas outras unidades é, e a NF tem de subir na quinzena certa'],
    [{ v: '<b>Km/L sem revisão no Q4</b>' }, 'as leituras do trimestre anterior entram no trimestre vigente; a placa é paga pela média do modelo na unidade (cluster 1) ou pelo 3º quartil de clusters mais largos', 'o Q4 rodando com o Q3 é desvio do processo do Book; a crítica por placa se faz com a regra dos clusters na mão'],
    [{ v: '<b>Manutenção: oficina acima do pago</b>' }, 'na carência paga zero; com contrato, o menor entre contrato e BID por faixa de km; sem contrato, BID com 10% de desconto; reajuste em julho pelo IGP-M', 'o BID é o teto por regra, não por cadastro: a fatura acima do BID é nossa por contrato. A carência é a negociada com a montadora e cadastrada na inclusão'],
    [{ v: '<b>Contrato VW acima do pago</b>' }, 'o valor cadastrado é o menor entre contrato e BID; contrato só vale cheio em compra fora do BID autorizada pelo RPO', 'cotar contrato × BID antes de assinar; contrato acima do BID nunca é pago'],
    [{ v: '<b>Placas inativas rodando</b>' }, 'stress test: ativo sem viagem no mês perde custo e lucro fixo; viagens fora da unidade por dois meses, idem; três meses sem viagem tiram a placa do FT (80% da FIPE)', 'a lista de ativos é obrigação com desconto, não só cadastro; movimentação de placa tem data (dia 02 e dia 17)'],
    [{ v: '<b>Rastreador só no Rio</b>' }, 'custo mensal negociado pelo RPO "para as operações em que seja aprovado este custo"', 'é regra, não cadastro: sai das perguntas abertas'],
    [{ v: '<b>Seguro sem conta na DRE</b>' }, 'seguro contra terceiros anual em parcelas + 0,8% de risco sobre a NF; reajuste em julho pelo IPCA', 'o FT paga; onde a DRE lança continua pergunta ao planejamento'],
    [{ v: '<b>Remunerado DRE × pago FT</b>' }, 'o Book não trata do remunerado da nossa DRE; diz que o FT trabalha com valores líquidos de PIS/COFINS e que OCs levam ICMS/ISS, PIS e COFINS', 'a diferença segue em aberto até os relatórios oficiais e o fiscal'],
  ] })}
  ${conc('O Book fecha quatro das sete perguntas abertas (rastreador, índice de reajuste, ciclo do km, Km/L validado) e dá a regra do pacote: variável por km do mapa, equipe por frota ativa × fatores, fixo por cadastro, lucro por hectolitro. Ficam com o planejamento e o fiscal: remunerado da DRE, imposto e seguro.', 'Leitura')}`);
}
{
  const Q = Object.keys(BK.comp).sort((a, b) => { const f = v => { const m = v.match(/_(\d)_(\d{1,2})_(\d{4})$/); return +m[3] * 100 + +m[2] * 2 + +m[1]; }; return f(a) - f(b); });
  const rot = v => { const m = v.match(/_(\d)_(\d{1,2})_(\d{4})$/); return `${m[1]}ª ${MES[+m[2] - 1]}/${m[3].slice(2)}`; };
  const ult = Q[Q.length - 1], S = BK.sizing[ult], us = ['CGR', 'CBA', 'GRL', 'PLT', 'FLP', 'BLC', 'MCC'].filter(u => BK.comp[ult][u]);
  const cel = Q.flatMap(q => us.map(u => BK.comp[q][u])).filter(Boolean), dif = cel.filter(x => x.siz_cam !== x.ft_cam || x.siz_van !== x.ft_van).length;
  slide(`${head('Dimensionamento oficial × ativos no FT', `Nas ${Q.length} últimas quinzenas, os caminhões e vans ativos no FT batem com o dimensionamento oficial do Book em ${cel.length - dif} de ${cel.length} casos`, 'Arquivo oficial da quinzena (registro "Dimensionamento 2nd Tier e 3rd Tier" do Book) × placas ativas nos relatórios Caminhão e Van do FT · caminhões + vans')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Unidade' }, ...Q.map(q => ({ t: rot(q), n: true })), { t: 'Volume ' + rot(ult) + ' (HL)', n: true }], rows: us.map(u => [nm(u), ...Q.map(q => { const x = BK.comp[q][u]; if (!x) return '—'; const ok = x.siz_cam === x.ft_cam && x.siz_van === x.ft_van; return { v: `${f0(x.siz_cam)}+${f0(x.siz_van)} · FT ${f0(x.ft_cam)}+${f0(x.ft_van)}`, style: ok ? '' : red(1) }; }), f0(S[u].vol)]) })}
  <p class="note">Célula: caminhões + vans dimensionados · caminhões + vans ativos no FT; em vermelho a quinzena em que não batem. Nova Friburgo e Rondonópolis não estão na aba ROTA desse arquivo. O volume é o do dimensionamento (VOL SIZ-AC), base do lucro por hectolitro.</p>
  ${concBlocos([
    { t: 'Ativos', v: `${cel.length - dif} de ${cel.length}`, s: 'o FT acompanha o dimensionamento: quem define quantos caminhões estão ativos é o arquivo oficial da quinzena, e a lista de ativos do FT reflete isso. Placa inativa que roda é placa fora do dimensionamento.' },
    { t: 'Rio de Janeiro', v: `${f0(BK.comp[Q[0]].CGR.siz_cam)} → ${f0(S.CGR.cam)}`, s: `caminhões dimensionados de ${rot(Q[0])} a ${rot(ult)}: o teto de mapas e a equipe sobem com o dimensionamento, não com a frota cadastrada.` },
    { t: 'Uso', v: 'crítica do dimensionamento', s: 'o arquivo da quinzena está no banco (ft_book_anexo, com o texto extraído): a crítica de ativos, noturna, reserva e spot se faz contra ele, no prazo do fechamento (até o dia 09).' },
  ])}`);
}

// ═══ fechamento ═══
{
  const ofi = MC.oficina.real + MC.materiais.real + MC.personaliz.real;
  slide(`${head('Para levar', `Frota T2 em ${PER}: R$ ${M(DEF)} mi acima do pago, em manutenção e combustível, concentrados em três unidades`, 'O que fazer, quem faz e o que ainda depende de resposta')}
  ${cartoes([
    { k: '1 · Oficina', n: 'R$ ' + M(ofi - (P.manut.ft - MC.contrato.real)) + ' mi', p: 'descobertos pelo pago FT. Carta de Custos por grupo, placa e fornecedor; contrato × BID placa a placa; garantia nas placas em carência.', o: 'unidades + corporativo' },
    { k: '2 · Consumo e km', n: 'R$ ' + M(CP.ef + KT.disp_rs + KT.inat_rs) + ' mi', p: `vistoria das ${A.kml_ruim.placas} placas abaixo do Km/L; lista de ativos na quinzena e km validado na revisão mensal (Book: até o 18º dia útil).`, o: 'unidades, na quinzena e no mês' },
    { k: '3 · Remunerado DRE', n: sM(REM7 - FT7) + ' mi', p: 'diferença em aberto: conferir com os relatórios oficiais do FT e com o planejamento (imposto, composição de manutenção e pneu); achar a conta do seguro.', o: 'planejamento + fiscal' },
    { k: '4 · Km/L e crédito', n: 'Q4 + R$ ' + K(O.fator.impacto['CBA|2026'].imp + O.fator.impacto['MCC|2026'].imp) + ' mil', p: 'pedir a revisão do Q4 com a crítica por placa; fiscal confirma o crédito do diesel da Empurrada.', o: 'corporativo' },
  ])}
  ${concBlocos([
    { t: 'Perguntas abertas', s: 'Relatórios oficiais do FT (endpoints em liberação pela TI) · efeito do imposto (lucro real × crédito presumido) · como o remunerado de manutenção e pneu é montado na DRE e o que mudou em jul/26 · onde o seguro é lançado. O Book respondeu: rastreador só no RJ é regra (custo aprovado por operação); o km é revisto uma vez por mês; o Km/L validado é a média do modelo na unidade das leituras do trimestre; o pacote paga o variável por km do mapa, a equipe por frota ativa, o fixo por cadastro e o lucro por hectolitro.' },
    { t: 'O que esta análise não usa', s: 'O teto do FT (25 mapas por ativo) aparece uma vez, como informação. "Pago FT" é reconstruído com o km da nossa Dispersão; passa a ser o faturado quando o export de faturamento por mapa existir. O Faturamento exportado hoje é o dimensionamento quinzenal, não a fatura.' },
  ], 'Pendências', 2)}`);
}

console.log('ok', write(process.env.FT_HTML || 'analise.html'), 'slides');

// ============================================================
// Análise histórica do Freightech × DRE (2022→2026), visual e executiva.
//   HIS=…/historico.json OPO=…/opo.json FT_HTML=…/historico.html node deck-historico.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, ponte, hbars, bars, lines, f0, f1, f2, f3, mi, mil, pct, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const H = JSON.parse(readFileSync(process.env.HIS || 'historico.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, escuro, conc, write } = deck({ rodape: 'Remuneração Freightech · Histórico 2022–2026 · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Freightech 2022–2026' });
const A = H.anos.map(String), Y = H.ano, PR = H.premissas;
const M = v => f1(v / 1e6), K = v => f0(v / 1e3), sg = v => (v > 0 ? '+' : '') + f1(v / 1e6);
const head = (k, h) => `<div class="kicker">${k}</div><h2>${h}</h2>`;
const tile = (l, v, s, cor = INK) => `<div class="box"><div class="lbl">${l}</div><div class="num" style="color:${cor}">${v}</div><p>${s}</p></div>`;
const lab = a => a === '2026' ? '2026*' : a;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
const PC = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva'];
const cor = v => v > 0 ? ACC : VERDE;
const mv = v => MES[+v.slice(5) - 1] + '/' + v.slice(2, 4);
const FIM26 = mv(Y['2026'].FIM), N26 = +Y['2026'].FIM.slice(5), AA = A.filter(a => Y[a].peca.comb.ft > 0);
const tot = (a, k) => PC.reduce((s, c) => s + Y[a].peca[c][k], 0);
const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];

capa(`2022 a 2026 (2026 até ${FIM26})`, 'Remuneração Freightech: cinco anos de premissas, frota e resultado', `Todas as quinzenas do FT desde jan/2022, cruzadas com a DRE de frota e a receita. Os valores de 2026 vão de janeiro a ${FIM26}.`);

// receita
{
  const P = ['ROTA', 'EMPURRADA', 'APOIO', 'TERCEIROS', 'AUTO SERVIÇO', 'DISTRIBUIÇÃO URBANA', 'EMPURRADA BITREM', 'INSUMOS', 'ROTA (VAN)'];
  const v = (a, p) => ((Y[a].receita || {})[p] || {}).real || 0, tot_ = a => Object.values(Y[a].receita || {}).reduce((s, x) => s + x.real, 0);
  slide(`${head('Receita', 'Receita líquida por projeto (DRE)')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${bars({ w: 520, h: 260, labels: A.map(lab), data: A.map(tot_), cor: i => i === 4 ? INK3 : INK, fmt: v => 'R$ ' + M(v) + ' mi' })}
    <table class="compacta"><tr><th>R$ mi</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
    ${P.filter(p => A.some(a => v(a, p) > 1e5)).map(p => `<tr><td>${p}</td>${A.map(a => `<td class="n">${v(a, p) ? M(v(a, p)) : '—'}</td>`).join('')}</tr>`).join('')}
    <tr><td><b>Total</b></td>${A.map(a => `<td class="n"><b>${M(tot_(a))}</b></td>`).join('')}</tr></table>
  </div><p class="note">* 2026 = jan a ${FIM26}.</p>
  ${(() => { const t22 = tot_('2022'), t25 = tot_('2025'), t26 = tot_('2026'); const r = a => v(a, 'ROTA'), e = a => v(a, 'EMPURRADA'); const an26 = t26 / N26 * 12;
  return conc(`A receita líquida cresceu <b>${f0((t25 / t22 - 1) * 100)}% de 2022 a 2025</b> (R$ ${M(t22)} → ${M(t25)} mi), e 2026 anualizado dá R$ ${M(an26)} mi (${(an26 / t25 - 1) >= 0 ? '+' : ''}${f0((an26 / t25 - 1) * 100)}% sobre 2025). A Rota puxa: R$ ${M(r('2022'))} → ${M(r('2025'))} mi (${f0((r('2025') / r('2022') - 1) * 100)}%), ${f0(r('2025') / t25 * 100)}% do total em 2025; a Empurrada cresceu ${f0((e('2025') / e('2022') - 1) * 100)}%. Distribuição Urbana (Anhanguera) entrou em 2025 e já é R$ ${M(v('2026', 'DISTRIBUIÇÃO URBANA'))} mi em ${N26} meses. O crescimento veio de frota e km, não de preço: o R$/km variável da Rota ficou em ~R$ 3,0 desde 2023 (próximo slide).`); })()}`);
}

// frota e km
{
  const F = H.frota_mes, idx = F.v.map((x, i) => i).filter(i => i % 3 === 0);
  slide(`${head('Frota T2 (Rota)', 'Caminhões ativos e parados por mês')}
  <div style="margin-top:10px">${lines({ w: 1136, h: 205, labels: F.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: F.at, cor: INK, rotulo: 'ativos' }, { data: F.par, cor: ACC, rotulo: 'parados' }], y0: 0, y1: Math.max(...F.at) * 1.15 })}</div>
  <table class="compacta" style="margin-top:8px"><tr><th></th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
  <tr><td>Ativos / mês (Rota + Van)</td>${A.map(a => `<td class="n">${f0(Y[a].t2_frota.ativos_mes)}</td>`).join('')}</tr>
  <tr><td>Parados / mês</td>${A.map(a => `<td class="n">${f0(Y[a].t2_frota.parados_mes)}</td>`).join('')}</tr>
  <tr><td>Km teto (mi)</td>${A.map(a => `<td class="n">${M(Y[a].t2_teto.kmtot)}</td>`).join('')}</tr>
  <tr><td>Km pago (mi)</td>${A.map(a => `<td class="n">${Y[a].t2_pago.km ? M(Y[a].t2_pago.km) : '—'}</td>`).join('')}</tr>
  <tr><td>Pago ÷ teto</td>${A.map(a => `<td class="n">${Y[a].t2_pago.km ? f0(Y[a].t2_pago.km / Y[a].t2_teto.kmtot * 100) + '%' : '—'}</td>`).join('')}</tr></table>
  <p class="note">A Dispersão de km (km pago) começa em 2023.</p>
  ${(() => { const fr = a => Y[a].t2_frota, pt = a => Y[a].t2_pago.km / Y[a].t2_teto.kmtot; const best = AA.slice().sort((a, b) => pt(b) - pt(a))[0];
  return conc(`A frota ativa cresceu de ${f0(fr('2022').ativos_mes)} para ${f0(fr('2025').ativos_mes)} caminhões por mês (+${f0((fr('2025').ativos_mes / fr('2022').ativos_mes - 1) * 100)}%), mas os <b>parados foram de ${f0(fr('2022').parados_mes)} para ${f0(fr('2026').parados_mes)}</b>: a frota parada passou de ${f0(fr('2022').parados_mes / (fr('2022').ativos_mes + fr('2022').parados_mes) * 100)}% para ${f0(fr('2026').parados_mes / (fr('2026').ativos_mes + fr('2026').parados_mes) * 100)}% do total, e o parado recebe só o fixo de capital, seguro e IPVA (R$ ${M(Y['2026'].t2_fixo.fixo_par)} mi em ${N26} meses de 2026). O km pago ficou em ${f0(Math.min(...AA.map(pt)) * 100)}% a ${f0(Math.max(...AA.map(pt)) * 100)}% do teto: o melhor ano foi ${lab(best)} (${f0(pt(best) * 100)}%), e 2026 recuou para ${f0(pt('2026') * 100)}%. Cada ponto do teto que não vira mapa em 2026 vale R$ ${K(['comb', 'manut', 'carr', 'pneu'].reduce((s, c) => s + Y['2026'].t2_teto[c], 0) / 100)} mil no período.`); })()}`);
}

// premissas do caminhão
{
  const row = (n, k, f = f2) => `<tr><td>${n}</td>${A.map(a => `<td class="n">${PR[a][k] == null ? '—' : f(PR[a][k])}</td>`).join('')}</tr>`;
  slide(`${head('Premissas do caminhão (Rota)', 'Como o R$/km e o fixo de um caminhão mudaram em cinco anos')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    <table class="compacta"><tr><th>Mediana das placas ativas</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
    ${row('Combustível R$/km', 'comb')}${row('Manutenção R$/km', 'manut')}${row('Carroceria R$/km', 'carr')}${row('Pneu R$/km', 'pneu')}${row('<b>Variável R$/km</b>', 'var')}
    ${row('Km/L remunerado (ponderado)', 'kml')}${row('Km da placa / mês', 'km_placa', f0)}${row('Fixo / mês (R$)', 'fixo', f0)}${row('FINAME / mês (R$)', 'finame', f0)}
    ${row('Valor de compra (R$ mil)', 'compra', v => f0(v / 1e3))}${row('Taxa FINAME (% a.a.)', 'taxa', f1)}${row('Vida mediana (meses)', 'vida', f0)}</table>
    <div>${lines({ w: 520, h: 230, pad: { l: 50, r: 70, t: 20, b: 30 }, labels: A.map(lab), series: [{ data: A.map(a => PR[a].comb), cor: ACC, rotulo: 'comb.' }, { data: A.map(a => PR[a].manut), cor: AZUL, rotulo: 'manut.' }, { data: A.map(a => PR[a].pneu), cor: VERDE, rotulo: 'pneu' }], yfmt: v => f2(v) })}</div>
  </div>
  ${conc(`O variável por km <b>caiu de R$ ${f2(PR['2022'].var)} para R$ ${f2(PR['2023'].var)} em 2023 e parou em ~R$ 3,0</b>: a manutenção paga caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% (R$ ${f2(PR['2022'].manut)} → ${f2(PR['2026'].manut)}/km) enquanto o custo real subiu, e o Km/L remunerado subiu de ${f2(PR['2022'].kml)} para ${f2(PR['2026'].kml)}, o que reduz o combustível pago por km mesmo com diesel mais caro (R$ ${f2(PR['2022'].comb)} → ${f2(PR['2026'].comb)}/km). O fixo por caminhão subiu ${f0((PR['2026'].fixo / PR['2022'].fixo - 1) * 100)}% (R$ ${f0(PR['2022'].fixo)} → ${f0(PR['2026'].fixo)}/mês) com a frota nova: valor de compra R$ ${K(PR['2022'].compra)} → ${K(PR['2026'].compra)} mil, taxa ${f1(PR['2022'].taxa)}% → ${f1(PR['2026'].taxa)}% a.a. A remuneração migrou do variável para o fixo: paga-se mais pelo caminhão existir e menos pelo km que ele roda.`)}`);
}

// diesel
{
  const D = H.diesel_mes;
  slide(`${head('Diesel S10 (Rota)', 'Nosso preço, ANP e o preço pago pelo FT, mês a mês')}
  <div style="margin-top:10px">${lines({ w: 1136, h: 270, labels: D.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: D.anp, cor: INK3, rotulo: '', dash: true }, { data: D.op, cor: AZUL, rotulo: '' }, { data: D.pago, cor: ACC, rotulo: 'pago' }], yfmt: v => f2(v) })}</div>
  <table class="compacta" style="margin-top:6px"><tr><th>Mediana R$/L</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
  ${['op', 'anp', 'pago'].map(k => `<tr><td>${{ op: 'Nosso preço', anp: 'ANP', pago: 'Pago' }[k]}</td>${A.map(a => `<td class="n">${f2(H.diesel[a][k])}</td>`).join('')}</tr>`).join('')}</table>
  <p class="note">Cinza tracejado = ANP · azul = nosso preço · vermelho = pago pelo FT. O pago é sempre o menor entre o nosso e a ANP (100% dos registros). A queda pontual de Macacu em ago/25 (R$ 1,85) aparece na série.</p>
  ${(() => { const D_ = H.diesel; const dif = A.map(a => [a, D_[a].anp - D_[a].op]); const maior = dif.slice().sort((a, b) => b[1] - a[1])[0];
  return conc(`O diesel pago seguiu o nosso preço nos cinco anos (mediana R$ ${f2(D_['2022'].pago)} em 2022, R$ ${f2(D_['2023'].pago)} em 2023, R$ ${f2(D_['2026'].pago)} em 2026), porque compramos abaixo da ANP em todos eles: a maior folga foi em ${lab(maior[0])}, R$ ${f2(maior[1])}/L. Isso significa que <b>a regra do menor preço nunca nos favoreceu</b>: o FT paga o que pagamos, e o ganho de preço só existe no tanque interno (Rio, Florianópolis), onde a nota de compra fica abaixo do remunerado da placa. A alta de 2026 (R$ ${f2(D_['2025'].pago)} → ${f2(D_['2026'].pago)}, +${f0((D_['2026'].pago / D_['2025'].pago - 1) * 100)}%) entrou no pago e no custo ao mesmo tempo; o déficit de combustível de 2026 não vem do preço, vem do km e do consumo.`); })()}`);
}

// pago × DRE por ano
{
  const t = (a, k) => PC.reduce((s, c) => s + Y[a].peca[c][k], 0);
  const AA = A.filter(a => Y[a].peca.comb.ft > 0);
  slide(`${head('Resultado de frota por ano', 'Pago pelo FT × remunerado e realizado na DRE (T2)')}
  <table class="compacta" style="margin-top:14px"><tr><th>R$ mi</th>${AA.map(a => `<th class="n" colspan="3">${lab(a)}</th>`).join('')}</tr>
  <tr><td></td>${AA.map(() => '<td class="n note">FT</td><td class="n note">rem.</td><td class="n note">real</td>').join('')}</tr>
  ${PC.map(c => `<tr><td>${NM[c]}</td>${AA.map(a => { const x = Y[a].peca[c]; return `<td class="n">${M(x.ft)}</td><td class="n">${M(x.rem)}</td><td class="n" style="color:${cor(x.real - x.ft)}">${M(x.real)}</td>`; }).join('')}</tr>`).join('')}
  <tr><td><b>Total</b></td>${AA.map(a => `<td class="n"><b>${M(t(a, 'ft'))}</b></td><td class="n"><b>${M(t(a, 'rem'))}</b></td><td class="n" style="color:${cor(t(a, 'real') - t(a, 'ft'))}"><b>${M(t(a, 'real'))}</b></td>`).join('')}</tr></table>
  <div style="margin-top:8px">${bars({ w: 1136, h: 105, labels: AA.map(lab), data: AA.map(a => t(a, 'real') - t(a, 'ft')), cor: ACC, fmt: v => 'R$ ' + sg(v) + ' mi' })}</div>
  <p class="note">Barra = realizado − pago FT nas contas de frota (combustível, manutenção, carroceria, pneu, lavagem, IPVA). Vermelho no real = custou acima do pago.</p>
  ${(() => { const d = a => tot(a, 'real') - tot(a, 'ft'); const best = AA.slice().sort((a, b) => d(a) - d(b))[0]; const m = a => Y[a].peca.manut, c = a => Y[a].peca.comb; const an26 = d('2026') / N26 * 12;
  return conc(`O custo de frota ficou <b>acima do pago em todos os anos</b>: R$ ${M(d('2023'))} mi em 2023, R$ ${M(d('2024'))} mi em 2024 (o melhor ano, ${f0((tot('2024', 'real') / tot('2024', 'ft') - 1) * 100)}% acima), R$ ${M(d('2025'))} mi em 2025 e R$ ${M(d('2026'))} mi em ${N26} meses de 2026 (R$ ${M(an26)} mi anualizado, o pior). A manutenção explica a piora: custou ${f1(m('2024').real / m('2024').ft)}× o pago em 2024, ${f1(m('2025').real / m('2025').ft)}× em 2025 e ${f1(m('2026').real / m('2026').ft)}× em 2026, porque o FT baixou o R$/km pago (R$ ${f2(PR['2024'].manut)} → ${f2(PR['2026'].manut)}) e o custo subiu com a frota envelhecendo (vida mediana ${f0(PR['2024'].vida)} → ${f0(PR['2026'].vida)} meses). O combustível ficou entre ${f0((Math.min(...AA.map(a => c(a).real / c(a).ft)) - 1) * 100)}% e ${f0((Math.max(...AA.map(a => c(a).real / c(a).ft)) - 1) * 100)}% acima do pago, estável. O remunerado da DRE ficou entre o pago e o realizado em todos os anos: o planejamento lança mais do que o FT paga, e ainda assim menos do que custa.`); })()}`);
}

// manutenção ao longo do tempo
{
  const AA = A.filter(a => Y[a].peca.manut.ft > 0);
  slide(`${head('Manutenção', 'O custo ficou acima do pago em todos os anos; em 2026 é o dobro')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${hbars({ w: 560, lw: 70, lh: 40, linhas: AA.map(a => ({ rot: lab(a), ft: Y[a].peca.manut.ft, real: Y[a].peca.manut.real })), series: [{ k: 'ft', rot: 'Pago FT', cor: INK }, { k: 'real', rot: 'Realizado DRE', cor: ACC }], fmt: v => 'R$ ' + M(v) + ' mi' })}
    <table class="compacta"><tr><th>Rota</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
      <tr><td>R$/km pago (mediana)</td>${A.map(a => `<td class="n">${f2(PR[a].manut)}</td>`).join('')}</tr>
      <tr><td>Placas em carência</td>${A.map(a => `<td class="n">${PR[a].carencia_pl}</td>`).join('')}</tr>
      <tr><td>Placas ativas</td>${A.map(a => `<td class="n">${PR[a].placas}</td>`).join('')}</tr></table>
  </div>
  <p class="note">O FT paga 90% do BID da montadora (ou a tabela por idade sem BID) e zero na carência.</p>
  ${(() => { const m = a => Y[a].peca.manut; const pl = a => PR[a].placas, ca = a => PR[a].carencia_pl, fa = a => Y[a].t2_frota.ativos_mes;
  return conc(`O R$/km pago pela manutenção caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% em cinco anos (R$ ${f2(PR['2022'].manut)} → ${f2(PR['2026'].manut)}) e o custo por caminhão foi na direção contrária: o realizado por caminhão ativo subiu de R$ ${K(m('2023').real / fa('2023'))} mil por ano (2023) para R$ ${K(m('2025').real / fa('2025'))} mil (2025) e R$ ${K(m('2026').real / fa('2026') / N26 * 12)} mil anualizado em 2026. A carência explica parte: ${ca('2026')} das ${pl('2026')} placas de 2026 recebem zero, mas a oficina dessas placas novas não é zero (Rondonópolis, 9 meses de idade, gasta R$ 120 mil de oficina). O resto é a tabela do FT: BID da montadora com 10% de desconto num contrato que, na VW, já custa R$ 0,76/km contra R$ 0,61 pagos. <b>A manutenção virou a maior fonte de déficit da frota</b>: R$ ${M(m('2026').real - m('2026').ft)} mi em ${N26} meses de 2026, contra R$ ${M(m('2024').real - m('2024').ft)} mi em 2024 inteiro.`); })()}`);
}

// status da frota
{
  const S = ['QUITADO', 'FINANCIADO', 'LEASING', 'FINAME', 'ALUGADO'];
  slide(`${head('Frota por financiamento', 'A frota financiada cresceu e o caminhão ficou mais caro')}
  <table class="compacta" style="margin-top:14px"><tr><th>Placas ativas (Rota)</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
  ${S.map(s => `<tr><td>${s}</td>${A.map(a => `<td class="n">${PR[a].status[s] || 0}</td>`).join('')}</tr>`).join('')}</table>
  <div class="grid g3" style="margin-top:14px;gap:14px">
    ${tile('Valor de compra', 'R$ ' + K(PR['2022'].compra) + ' → ' + K(PR['2026'].compra) + ' mil', 'mediana cavalo + carroceria')}
    ${tile('FINAME mediano', 'R$ ' + f0(PR['2022'].finame) + ' → ' + f0(PR['2026'].finame), 'por mês')}
    ${tile('Taxa do financiamento', f1(PR['2022'].taxa) + '% → ' + f1(PR['2026'].taxa) + '%', 'a.a., mediana')}
  </div>
  ${(() => { const st = a => PR[a].status, fin = a => (st(a).FINANCIADO || 0) + (st(a).FINAME || 0) + (st(a).LEASING || 0), q = a => st(a).QUITADO || 0;
  return conc(`Em 2022, ${f0(q('2022') / PR['2022'].placas * 100)}% das placas ativas da Rota eram quitadas; em 2025 a frota financiada (FINAME, financiado e leasing) chegou a ${fin('2025')} placas, ${f0(fin('2025') / PR['2025'].placas * 100)}% do total, e o leasing saiu de ${st('2022').LEASING} para ${st('2025').LEASING} placas. <b>O FINAME mediano por caminhão subiu ${f0((PR['2026'].finame / PR['2022'].finame - 1) * 100)}%</b> (R$ ${f0(PR['2022'].finame)} → ${f0(PR['2026'].finame)}/mês) por dois motivos somados: caminhão ${f0((PR['2026'].compra / PR['2022'].compra - 1) * 100)}% mais caro e taxa ${f1(PR['2026'].taxa - PR['2022'].taxa)} pontos maior. O FT remunera o capital pela parcela, então o fixo acompanha; o risco é o fim das parcelas: o caminhão quitado recebe ~R$ 900/mês de fixo (Análise 2026) e continua custando manutenção de frota velha.`); })()}`);
}

// T1
{
  const T = H.t1, us = Object.keys(T);
  const C = [['diesel', 'Diesel'], ['manut', 'Manut. cavalo'], ['carr', 'Manut. carreta'], ['pneu', 'Pneu'], ['salario', 'Salário var.'], ['lucro', 'Lucro var.'], ['kml', 'Km/L do trecho']];
  slide(`${head('T1 · Empurrada', 'R$ por km do trecho, por ano (média ponderada pela previsão de km)')}
  <table class="compacta" style="margin-top:14px;font-size:11px"><tr><th></th>${us.map(u => `<th class="n" colspan="${Object.keys(T[u]).length}">${NOME[u]}</th>`).join('')}</tr>
  <tr><td></td>${us.map(u => Object.keys(T[u]).map(a => `<td class="n note">${lab(a)}</td>`).join('')).join('')}</tr>
  ${C.map(([k, n]) => `<tr><td>${n}</td>${us.map(u => Object.keys(T[u]).map(a => `<td class="n">${f2(T[u][a][k])}</td>`).join('')).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Diesel do trecho = preço com crédito de imposto ÷ Km/L do trecho.</p>
  ${(() => { const p = H.t1.PIR, a0 = Object.keys(p)[0], a1 = '2026'; const tt = (u, a) => ['diesel', 'manut', 'carr', 'pneu', 'salario', 'lucro'].reduce((s, k) => s + H.t1[u][a][k], 0);
  return conc(`Na Empurrada o diesel é o frete: em Piraí foi de R$ ${f2(p[a0].diesel)} para R$ ${f2(p[a1].diesel)}/km (+${f0((p[a1].diesel / p[a0].diesel - 1) * 100)}%), e a causa não é só o preço: <b>o Km/L do trecho caiu de ${f2(p[a0].kml)} para ${f2(p[a1].kml)}</b>, porque a frota nova de Piraí (Actros 2651) tem Km/L remunerado menor que a antiga, e o FT paga mais litros por km. A manutenção do cavalo caiu de R$ ${f2(p['2025'].manut)} para R$ ${f2(p[a1].manut)}/km com a carência da renovação (~50% dos cavalos de nov/25 a mai/26), e volta a R$ 0,22/km quando ela acaba: o frete de 2027 cai por aí. Cuiabá e Macacu seguem o mesmo desenho em 2026 (R$ ${f2(tt('CBA', '2026'))} e R$ ${f2(tt('MCC', '2026'))}/km). O resultado do T1 depende do Km/L real contra o do trecho: um décimo de Km/L abaixo do remunerado em Piraí custa ~${f0(1 / (p[a1].kml - 0.1) * 100 / (1 / p[a1].kml) - 100)}% a mais de diesel sem pagamento.`); })()}`);
}

// divergências históricas
{
  const Y25 = Y['2025'], cad = (Y25.cadastro_seguro || [])[0];
  const D = [
    ['Diesel de Macacu lançado a R$ 1,85 (1ª ago/25)', `R$ ${K(O.preco.valor)} mil Rota + ~R$ ${K(O.preco.emp.perda)} mil Empurrada`, '2025', 'alta'],
    ['Crédito de imposto do diesel: Macacu abaixo de Piraí', `R$ ${K(O.fator.impacto['MCC|2025'].imp)} mil (2025) · R$ ${K(O.fator.impacto['MCC|2026'].imp)} mil (2026)`, '2024–2026', 'baixa (fiscal)'],
    ['Crédito de imposto do diesel: Cuiabá 0,94 → 0,78', `R$ ${K(O.fator.impacto['CBA|2026'].imp)} mil`, '2026', 'baixa (fiscal)'],
    ['Contrato VW acima da manutenção paga', 'ver Análise 2026', '2025–2026', 'média'],
    ['Km/L: 4º trimestre sem revisão, mudanças fora da revisão, ativas zeradas', `R$ ${K(O.kml.disp_rs)} mil + revisão`, '2026', 'alta'],
    cad ? ['Cadastro: carroceria de R$ 9,5 bi (UDC5B42, Cuiabá)', `seguro de R$ ${K(cad.excesso)} mil no Resumo`, '2ª nov/25 · não faturado', 'cadastro'] : null,
  ].filter(Boolean);
  slide(`${head('Divergências de remuneração', '2022 a 2026')}
  <table style="margin-top:14px"><tr><th>Divergência</th><th class="n">Valor</th><th>Período</th><th>Confiança</th></tr>
  ${D.map(r => `<tr><td><b>${r[0]}</b></td><td class="n">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Corrigido: as "placas com manutenção zero fora da carência" das versões anteriores não existem; o FT paga a manutenção pelo campo Manutenção R$/KM (BID ou tabela por idade), também sem contrato.</p>
  ${conc(`Em cinco anos de FT, os erros de remuneração encontrados são <b>poucos e pontuais</b>: um preço de diesel digitado errado (Macacu, ago/25), um cadastro de carroceria absurdo que não chegou a ser faturado, e o crédito de imposto do diesel da Empurrada que precisa de confirmação do fiscal. O que pesa de verdade não é erro: é <b>premissa</b>. A manutenção paga caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% por km enquanto a frota envelheceu, o Km/L remunerado parou de ser revisado em 2026, e o km do teto só vira pagamento quando o mapa roda. São esses três pontos, com os números das páginas anteriores, que sustentam a revisão de premissas; os erros entram como prova de que a base é lida placa a placa.`)}`);
}

console.log('ok', write(process.env.FT_HTML || 'historico.html'), 'slides');

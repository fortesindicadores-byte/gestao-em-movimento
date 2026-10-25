// ============================================================
// Análise histórica do Freightech × DRE (2022→2026), visual e executiva.
//   HIS=…/historico.json OPO=…/opo.json FT_HTML=…/historico.html node deck-historico.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, ponte, hbars, bars, lines, f0, f1, f2, f3, mi, mil, pct, MES, NOME, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const H = JSON.parse(readFileSync(process.env.HIS || 'historico.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Remuneração Freightech · Histórico 2022–2026 · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Freightech 2022–2026' });
const A = H.anos.map(String), Y = H.ano, PR = H.premissas;
const M = v => f1(v / 1e6), K = v => f0(v / 1e3), sg = v => (v > 0 ? '+' : '') + f1(v / 1e6);
const head = (k, h) => `<div class="kicker">${k}</div><h2>${h}</h2>`;
const tile = (l, v, s, cor = INK) => `<div class="box"><div class="lbl">${l}</div><div class="num" style="color:${cor}">${v}</div><p>${s}</p></div>`;
const lab = a => a === '2026' ? '2026*' : a;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
const PC = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva'];
const cor = v => v > 0 ? ACC : VERDE;
const mv = v => MES[+v.slice(5) - 1] + '/' + v.slice(2, 4);

capa('2022 a 2026 (2026 até setembro)', 'Remuneração Freightech: cinco anos de premissas, frota e resultado', 'Todas as quinzenas do FT desde jan/2022, cruzadas com a DRE de frota e a receita. Os valores de 2026 vão de janeiro a setembro.');

// receita
{
  const P = ['ROTA', 'EMPURRADA', 'APOIO', 'TERCEIROS', 'AUTO SERVIÇO', 'DISTRIBUIÇÃO URBANA', 'EMPURRADA BITREM', 'INSUMOS', 'ROTA (VAN)'];
  const v = (a, p) => ((Y[a].receita || {})[p] || {}).real || 0, tot = a => Object.values(Y[a].receita || {}).reduce((s, x) => s + x.real, 0);
  slide(`${head('Receita', 'Receita líquida por projeto (DRE)')}
  <div class="grid g2" style="margin-top:14px;gap:22px;align-items:start">
    ${bars({ w: 520, h: 260, labels: A.map(lab), data: A.map(tot), cor: i => i === 4 ? INK3 : INK, fmt: v => 'R$ ' + M(v) + ' mi' })}
    <table class="compacta"><tr><th>R$ mi</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
    ${P.filter(p => A.some(a => v(a, p) > 1e5)).map(p => `<tr><td>${p}</td>${A.map(a => `<td class="n">${v(a, p) ? M(v(a, p)) : '—'}</td>`).join('')}</tr>`).join('')}
    <tr><td><b>Total</b></td>${A.map(a => `<td class="n"><b>${M(tot(a))}</b></td>`).join('')}</tr></table>
  </div><p class="note">* 2026 = jan a set.</p>`);
}

// frota e km
{
  const F = H.frota_mes, idx = F.v.map((x, i) => i).filter(i => i % 3 === 0);
  slide(`${head('Frota T2 (Rota)', 'Caminhões ativos e parados por mês')}
  <div style="margin-top:10px">${lines({ w: 1136, h: 250, labels: F.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: F.at, cor: INK, rotulo: 'ativos' }, { data: F.par, cor: ACC, rotulo: 'parados' }], y0: 0, y1: Math.max(...F.at) * 1.15 })}</div>
  <table class="compacta" style="margin-top:8px"><tr><th></th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
  <tr><td>Ativos / mês (Rota + Van)</td>${A.map(a => `<td class="n">${f0(Y[a].t2_frota.ativos_mes)}</td>`).join('')}</tr>
  <tr><td>Parados / mês</td>${A.map(a => `<td class="n">${f0(Y[a].t2_frota.parados_mes)}</td>`).join('')}</tr>
  <tr><td>Km teto (mi)</td>${A.map(a => `<td class="n">${M(Y[a].t2_teto.kmtot)}</td>`).join('')}</tr>
  <tr><td>Km pago (mi)</td>${A.map(a => `<td class="n">${Y[a].t2_pago.km ? M(Y[a].t2_pago.km) : '—'}</td>`).join('')}</tr>
  <tr><td>Pago ÷ teto</td>${A.map(a => `<td class="n">${Y[a].t2_pago.km ? f0(Y[a].t2_pago.km / Y[a].t2_teto.kmtot * 100) + '%' : '—'}</td>`).join('')}</tr></table>
  <p class="note">Parados triplicaram de 2022 para 2025 (40 → 117 por mês). A Dispersão de km (km pago) começa em 2023.</p>`);
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
    <div>${lines({ w: 520, h: 230, pad: { l: 50, r: 70, t: 20, b: 30 }, labels: A.map(lab), series: [{ data: A.map(a => PR[a].comb), cor: ACC, rotulo: 'comb.' }, { data: A.map(a => PR[a].manut), cor: AZUL, rotulo: 'manut.' }, { data: A.map(a => PR[a].pneu), cor: VERDE, rotulo: 'pneu' }], yfmt: v => f2(v) })}
    ${escuro(`<b>Leitura:</b> o variável por km ficou em ~R$ 3,0 desde 2023, com a manutenção caindo (R$ ${f2(PR['2022'].manut)} → ${f2(PR['2026'].manut)}) e o combustível subindo com o diesel. O fixo subiu com caminhões mais caros (R$ ${K(PR['2022'].compra)} → ${K(PR['2026'].compra)} mil) e a taxa do financiamento (${f1(PR['2022'].taxa)}% → ${f1(PR['2026'].taxa)}% a.a.).`)}</div>
  </div>`);
}

// diesel
{
  const D = H.diesel_mes;
  slide(`${head('Diesel S10 (Rota)', 'Nosso preço, ANP e o preço pago pelo FT, mês a mês')}
  <div style="margin-top:10px">${lines({ w: 1136, h: 270, labels: D.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: D.anp, cor: INK3, rotulo: 'ANP', dash: true }, { data: D.op, cor: AZUL, rotulo: 'nosso' }, { data: D.pago, cor: ACC, rotulo: 'pago' }], yfmt: v => f2(v) })}</div>
  <table class="compacta" style="margin-top:6px"><tr><th>Mediana R$/L</th>${A.map(a => `<th class="n">${lab(a)}</th>`).join('')}</tr>
  ${['op', 'anp', 'pago'].map(k => `<tr><td>${{ op: 'Nosso preço', anp: 'ANP', pago: 'Pago' }[k]}</td>${A.map(a => `<td class="n">${f2(H.diesel[a][k])}</td>`).join('')}</tr>`).join('')}</table>
  <p class="note">O pago é sempre o menor entre o nosso e a ANP (100% dos registros). A queda pontual de Macacu em ago/25 (R$ 1,85) aparece na série.</p>`);
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
  <div style="margin-top:12px">${bars({ w: 1136, h: 170, labels: AA.map(lab), data: AA.map(a => t(a, 'real') - t(a, 'ft')), cor: ACC, fmt: v => 'R$ ' + sg(v) + ' mi' })}</div>
  <p class="note">Barra = realizado − pago FT nas contas de frota (combustível, manutenção, carroceria, pneu, lavagem, IPVA). Vermelho no real = custou acima do pago.</p>`);
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
  <p class="note">O FT paga 90% do BID da montadora (ou a tabela por idade sem BID) e zero na carência. A DRE de 2026 traz R$ 3,1 mi de contratos de manutenção do fabricante.</p>`);
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
  </div>`);
}

// T1
{
  const T = H.t1, us = Object.keys(T);
  const C = [['diesel', 'Diesel'], ['manut', 'Manut. cavalo'], ['carr', 'Manut. carreta'], ['pneu', 'Pneu'], ['salario', 'Salário var.'], ['lucro', 'Lucro var.'], ['kml', 'Km/L do trecho']];
  slide(`${head('T1 · Empurrada', 'R$ por km do trecho, por ano (média ponderada pela previsão de km)')}
  <table class="compacta" style="margin-top:14px;font-size:11px"><tr><th></th>${us.map(u => `<th class="n" colspan="${Object.keys(T[u]).length}">${NOME[u]}</th>`).join('')}</tr>
  <tr><td></td>${us.map(u => Object.keys(T[u]).map(a => `<td class="n note">${lab(a)}</td>`).join('')).join('')}</tr>
  ${C.map(([k, n]) => `<tr><td>${n}</td>${us.map(u => Object.keys(T[u]).map(a => `<td class="n">${f2(T[u][a][k])}</td>`).join('')).join('')}</tr>`).join('')}</table>
  <p class="note" style="margin-top:8px">Diesel do trecho = preço com crédito de imposto ÷ Km/L do trecho. A manutenção do cavalo caiu em 2026 com a renovação da frota: ~50% dos cavalos em carência de nov/25 a mai/26 (manutenção zero); voltou a R$ 0,22/km em jun/26.</p>`);
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
  <p class="note" style="margin-top:8px">Corrigido: as "placas com manutenção zero fora da carência" das versões anteriores não existem; o FT paga a manutenção pelo campo Manutenção R$/KM (BID ou tabela por idade), também sem contrato.</p>`);
}

console.log('ok', write(process.env.FT_HTML || 'historico.html'), 'slides');

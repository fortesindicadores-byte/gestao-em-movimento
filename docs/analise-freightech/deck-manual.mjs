// ============================================================
// Manual Freightech de frota: cada custo fixo e variável, com a memória de
// cálculo no centro do slide, o relatório de origem e os campos.
//   MAN=…/manual.json FT_HTML=…/manual.html node deck-manual.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, ponte, f0, f1, f2, f3, mil, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const M = JSON.parse(readFileSync(process.env.MAN || 'manual.json', 'utf8'));
const { slide, capa, escuro, write } = deck({ rodape: 'Manual Freightech · Frota · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Manual Freightech de Frota' });
const P = M.placa, R = M.resumo, T = M.trecho, C = M.conf, CV = M.cavalo, CR = M.carreta, E = M.empilhadeira || {};
const rs = v => 'R$ ' + f2(v), rk = v => 'R$ ' + f2(v) + '/km';

// tira de memória de cálculo: [{l, v}] e operadores em texto
// o valor encolhe para caber na caixa (Montserrat 800: ~0,64 em por caractere)
const cabe = (v, w) => Math.max(14, Math.min(27, Math.floor((w - 24) / (String(v).replace(/<[^>]+>/g, '').length * 0.64))));
const caixa = (l, v, d = false, w = 200, fs = null) => `<div style="flex:1;min-width:0;background:${d ? INK : '#fff'};color:${d ? '#fff' : INK};border:1px solid ${d ? INK : '#D9DDE3'};border-radius:12px;padding:18px 10px;text-align:center;overflow:hidden">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${d ? '#C9CED6' : INK2};line-height:1.3">${l}</div>
  <div style="font-size:${fs || cabe(v, w)}px;font-weight:800;margin-top:8px;white-space:nowrap">${v}</div></div>`;
const op = s => `<div style="font-size:26px;font-weight:800;color:${ACC};padding:0 2px;flex:0 0 auto">${s}</div>`;
// soma de muitas parcelas: vira uma conta em coluna (parcelas empilhadas + total grande), em vez de seis caixas espremidas
const contaColuna = itens => {
  const bx = itens.filter(x => typeof x !== 'string'), tot = bx[bx.length - 1], parc = bx.slice(0, -1);
  return `<div style="background:${PALE};border-radius:14px;padding:14px 16px 16px;margin-top:18px"><div class="lbl" style="color:${ACC};margin-bottom:10px">Memória de cálculo</div>
  <div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:center">
    <div style="background:#fff;border:1px solid #D9DDE3;border-radius:12px;padding:6px 18px">
      ${parc.map((x, i) => `<div style="display:flex;align-items:baseline;gap:10px;padding:4px 0;${i ? 'border-top:1px solid #EDEFF2' : ''}"><span style="font-size:18px;font-weight:800;color:${ACC};width:16px">${i ? '+' : ''}</span><span style="flex:1;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${INK2}">${x.l}</span><span style="font-size:19px;font-weight:800;color:${INK};white-space:nowrap">${x.v}</span></div>`).join('')}
    </div>
    <div style="background:${INK};color:#fff;border-radius:12px;padding:26px 16px;text-align:center"><div class="lbl" style="color:#C9CED6">${tot.l}</div><div style="font-size:${Math.min(34, cabe(tot.v, 420))}px;font-weight:800;margin-top:10px;white-space:nowrap">= ${tot.v}</div></div>
  </div></div>`;
};
const fita = itens => {
  if (itens.filter(x => typeof x !== 'string').length >= 6 && itens.every(x => typeof x !== 'string' || true) && itens.filter(x => typeof x === 'string').every(o => o === '+' || o === '=')) return contaColuna(itens);
  const bx = itens.filter(x => typeof x !== 'string'), nb = bx.length, no = itens.length - nb, w = (1104 - no * 34 - (itens.length - 1) * 8) / nb;
  const fs = Math.min(...bx.map(x => cabe(x.v, w)));   // a fita inteira no mesmo tamanho
  return `<div style="background:${PALE};border-radius:14px;padding:14px 16px 16px;margin-top:18px"><div class="lbl" style="color:${ACC};margin-bottom:10px">Memória de cálculo</div><div style="display:flex;align-items:center;gap:8px">${itens.map(x => typeof x === 'string' ? op(x) : caixa(x.l, x.v, x.d, w, fs)).join('')}</div></div>`;
};
const origem = linhas => `<table class="compacta" style="margin-top:16px"><tr><th>Relatório (tabela FT)</th><th>Campo</th><th>O que é</th><th class="n">No exemplo</th></tr>
  ${linhas.map(([t, c, o, v]) => `<tr><td>${t}</td><td><b>${c}</b></td><td>${o}</td><td class="n">${v}</td></tr>`).join('')}</table>`;
const nota = t => `<p class="note" style="margin-top:10px">${t}</p>`;
const conf = v => v == null ? '' : v < 0.5 ? 'fecha ao centavo em todas as placas' : `erro mediano de ${f1(v)}% sobre as placas`;
const custo = ({ k, h, fit, org, n }) => slide(`<div class="kicker">${k}</div><h2>${h}</h2>${fit}${org}${n ? nota(n) : ''}`);

// ═══ capa e mapa ═══
capa('Manual · ' + M.vig, 'Freightech de frota: cada custo, a conta e de onde ela sai',
  'Um slide por custo. No centro, a memória de cálculo com um caminhão e um trecho reais. Embaixo, o relatório do FT e os campos que compõem a conta.');

slide(`<div class="kicker">Mapa</div><h2>Três modelos de remuneração de frota</h2>
  <div class="grid g3" style="margin-top:18px;gap:16px">
    <div class="box" style="border-top:5px solid ${ACC}"><h3>T2 · Rota, AS e Van</h3><p style="margin-top:6px"><b>Fixo</b> por caminhão ativo (e de parado) + <b>variável</b> por km dos mapas rodados.</p>
      <table class="compacta" style="margin-top:8px"><tr><td>Fixo</td><td>FINAME · seguro · IPVA · rastreador · faixa · lavagem*</td></tr><tr><td>Variável</td><td>combustível · manutenção · carroceria · pneu (+ lavagem no AS)</td></tr><tr><td>Relatórios</td><td>Caminhão, Caminhão AS, Van, Resumo</td></tr></table></div>
    <div class="box" style="border-top:5px solid ${AZUL}"><h3>T1 · Empurrada e Insumos</h3><p style="margin-top:6px"><b>Frete por viagem</b> de cada trecho + <b>fixo</b> por equipamento (cavalo + carreta).</p>
      <table class="compacta" style="margin-top:8px"><tr><td>Viagem</td><td>diesel · manutenção cavalo e carreta · pneu · lavagem · pedágio · seguro · salário e lucro variável</td></tr><tr><td>Fixo</td><td>equipamento ativo e parado</td></tr><tr><td>Relatórios</td><td>Trecho, Cavalo, Carreta, Faturamento</td></tr></table></div>
    <div class="box" style="border-top:5px solid ${VERDE}"><h3>Armazém</h3><p style="margin-top:6px"><b>Fixo</b> por empilhadeira + <b>variável</b> por hora de horímetro.</p>
      <table class="compacta" style="margin-top:8px"><tr><td>Fixo</td><td>financiamento (CDC/FINAME) + lucro fixo</td></tr><tr><td>Variável</td><td>manutenção · pneus</td></tr><tr><td>Relatórios</td><td>Equipamento Armazém, Fechamento</td></tr></table></div>
  </div>
  ${nota('* Lavagem: fixa por mês na Rota e na Van; por km no AS. Equipe, QLP e outras despesas não são custos de frota e ficam fora deste manual.')}`);

{
  const at = R['Total Caminhão Ativo'], fa = R['Total por Caminhão Frota Ativa'] * at, fp = R['Total por Caminhão Frota Parada'] * R['Total Caminhão Parado'], vv = R['Total Viagens'];
  const cx = (l, v, d) => `<div style="background:${d ? INK : PALE};color:${d ? '#fff' : INK};border-radius:10px;padding:10px 8px;text-align:center;height:66px;display:flex;flex-direction:column;justify-content:center"><div class="lbl" style="${d ? 'color:#C9CED6' : ''}">${l}</div><div style="font-size:${Math.min(21, cabe(v, 190))}px;font-weight:800;margin-top:3px;white-space:nowrap">${v}</div></div>`;
  const o = t => `<div style="font-size:22px;font-weight:800;color:${ACC};text-align:center">${t}</div>`;
  const lin = (nome, a, b, c, res, d) => `<div style="display:grid;grid-template-columns:130px 1fr 26px 1fr 26px 1fr 26px 1.15fr;align-items:center;gap:6px;margin-top:10px">
    <div style="font-size:12.5px;font-weight:800;color:${INK}">${nome}</div>${cx(...a)}${o('×')}${cx(...b)}${c ? o('×') + cx(...c) : '<div></div><div></div>'}${o('=')}${cx(...res, d)}</div>`;
  slide(`<div class="kicker">T2 · como o pagamento se forma</div><h2>Do caminhão à unidade: três contas no Resumo</h2>
  ${lin('Fixo das ativas', ['Fixo médio por ativo', rs(R['Total por Caminhão Frota Ativa'])], ['Caminhões ativos', f0(at)], null, ['Fixo das ativas', 'R$ ' + mil(fa)])}
  ${lin('Fixo das paradas', ['Fixo médio por parado', rs(R['Total por Caminhão Frota Parada'])], ['Caminhões parados', f0(R['Total Caminhão Parado'])], null, ['Fixo das paradas', 'R$ ' + mil(fp)])}
  ${lin('Variável (teto)', ['R$/km médio', rk(R['Total R$/KM'])], ['Km por caminhão no mês', f0(R['KM Remunerado'])], ['Caminhões ativos', f0(at)], ['Variável (teto)', 'R$ ' + mil(vv)])}
  <div style="display:grid;grid-template-columns:130px 1fr 26px 1fr 26px 1fr 26px 1.15fr;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #D9DDE3">
    <div style="font-size:12.5px;font-weight:800;color:${INK}">Frota da unidade</div>${cx('Fixo das ativas', 'R$ ' + mil(fa))}${o('+')}${cx('Fixo das paradas', 'R$ ' + mil(fp))}${o('+')}${cx('Variável (teto)', 'R$ ' + mil(vv))}${o('=')}${cx('Frota no mês', 'R$ ' + mil(fa + fp + vv), true)}</div>
  ${origem([['Resumo', 'Total por Caminhão Frota Ativa · Total Caminhão Ativo', 'fixo médio das placas ativas × quantas estão ativas', rs(R['Total por Caminhão Frota Ativa']) + ' × ' + f0(at)], ['Resumo', 'Total por Caminhão Frota Parada · Total Caminhão Parado', 'fixo de parado × quantas estão paradas', rs(R['Total por Caminhão Frota Parada']) + ' × ' + f0(R['Total Caminhão Parado'])],
    ['Resumo', 'Total R$/KM · KM Remunerado', 'combustível + manutenção + carroceria + pneu (média das placas) × km por caminhão', rk(R['Total R$/KM']) + ' × ' + f0(R['KM Remunerado'])], ['Resumo', 'Total Viagens', 'variável no teto (25 mapas por caminhão ativo)', 'R$ ' + mil(vv)]])}
  ${nota(`Cuiabá, ${M.vig}. Os ${f0(at)} ativos entram duas vezes porque cada caminhão ativo recebe o fixo e gera o variável. O pago de verdade do variável é o R$/km × km dos mapas que rodaram (Dispersão de km). Equipe de entrega, QLP e outras despesas são pagas à parte, no mesmo Resumo.`)}`);
}

// ═══ T2 · fixo ═══
const FE = M.finame_ex;
custo({ k: 'T2 · Fixo · 1', h: 'FINAME do caminhão financiado: a parcela do financiamento',
  fit: fita([{ l: 'Compra cavalo + carroceria', v: 'R$ ' + mil(FE.V) }, '×', { l: '1 − entrada', v: f0(100 - P['Entrada (%)']) + '%' }, '→', { l: 'Taxa mensal', v: f3(FE.r) + '%' }, '·', { l: 'Parcelas', v: f0(FE.n) }, '=', { l: 'FINAME / mês', v: rs(P['FINAME Modelo Novo']), d: true }]),
  org: origem([['Caminhão', 'Valor de Compra Cavalo / Carroceria', 'nota de compra', 'R$ ' + mil(P['Valor de Compra Cavalo']) + ' + ' + mil(P['Valor de Compra Carroceria'])], ['Caminhão', 'Entrada (%)', 'parte paga à vista', f0(P['Entrada (%)']) + '%'],
    ['Caminhão', 'Taxa FINAME', 'taxa anual → mensal equivalente', f2(P['Taxa FINAME']) + '% a.a.'], ['Caminhão', 'Período FINAME · Carência', 'parcelas; juros da carência entram no saldo', f0(P['Período FINAME']) + ' · ' + f0(P['Carência'])],
    ['Caminhão', 'Mês da Parcela', 'em que parcela está', f0(P['Mês da Parcela']) + ' (faltam ' + f0(FE.restam) + ')'], ['Caminhão', 'statusFinanciamentoShared', 'regra usada', P.statusFinanciamentoShared]]),
  n: `Placa ${P.Placa} (${P['Modelo do Cavalo']}, Cuiabá). Regra do FINANCIADO: ${conf(C.finame_FINANCIADO)}. No status FINAME (BNDES), a taxa é TJLP + spreads ÷ 12 sobre o valor cheio, sem entrada. QUITADO, LEASING e ALUGADO não têm parcela: o fixo de capital vem em outros campos.` });

custo({ k: 'T2 · Fixo · 2', h: 'Seguro: 0,75% ao ano do valor de compra',
  fit: fita([{ l: 'Compra cavalo + carroceria', v: 'R$ ' + mil(P['Valor de Compra Cavalo'] + P['Valor de Compra Carroceria']) }, '×', { l: 'Taxa anual', v: '0,75%' }, '÷', { l: 'Meses', v: '12' }, '=', { l: 'Seguro / mês', v: rs(P.Seguro), d: true }]),
  org: origem([['Caminhão', 'Valor de Compra Cavalo + Carroceria', 'base do seguro', 'R$ ' + mil(P['Valor de Compra Cavalo'] + P['Valor de Compra Carroceria'])], ['Caminhão', 'Seguro', 'valor mensal pago', rs(P.Seguro)], ['Resumo', 'Seguro / Seguro Parado', 'média por ativo e por parado', rs(R['Seguro Parado']) + ' (parado)']]),
  n: `Conferência: ${conf(C.seguro)}.` });

custo({ k: 'T2 · Fixo · 3', h: 'IPVA e licenciamento: o anual do cavalo dividido por 12',
  fit: fita([{ l: 'IPVA + licenciamento no ano', v: rs(P['IPVA Licenciamento Cavalo']) }, '÷', { l: 'Meses', v: '12' }, '=', { l: 'IPVA / mês', v: rs(P['IPVA Licenciamento']), d: true }]),
  org: origem([['Caminhão', 'IPVA Licenciamento Cavalo', 'valor anual (alíquota do estado × valor do veículo)', rs(P['IPVA Licenciamento Cavalo'])], ['Caminhão', 'IPVA Licenciamento', 'valor mensal pago', rs(P['IPVA Licenciamento'])], ['Resumo', 'IPVA Licen. Mensal / Parado', 'média por ativo e parado', rs(R['IPVA Licenc. Mensal Parado']) + ' (parado)']]),
  n: `Conferência: ${conf(C.ipva)}.` });

custo({ k: 'T2 · Fixo · 4', h: 'Rastreador, faixa refletiva e lavagem: valores fixos por caminhão',
  fit: fita([{ l: 'Rastreador', v: rs(P.Rastreador) }, '+', { l: 'Faixa refletiva', v: rs(P['Faixa Reflexiva']) }, '+', { l: 'Lavagem (Rota)', v: rs(P.Lavagem) }]),
  org: origem([['Caminhão', 'Rastreador', 'mensalidade (zero quando o rastreador não é nosso)', rs(P.Rastreador)], ['Caminhão', 'Faixa Reflexiva', 'custo mensal da faixa', rs(P['Faixa Reflexiva'])], ['Caminhão / Van', 'Lavagem', 'valor fixo por mês, por unidade', rs(P.Lavagem)], ['Caminhão AS', 'Lavagem por KM', 'no AS a lavagem é por km, dentro do variável', 'R$/km']]),
  n: 'Lavagem por unidade em 2026: R$ 135 (Rio) a R$ 262 (Nova Friburgo) por mês na Rota; R$ 120 na Van.' });

custo({ k: 'T2 · Fixo · 5', h: 'Total do fixo do caminhão: a soma das parcelas',
  fit: fita([{ l: 'FINAME', v: rs(P['FINAME Modelo Novo']) }, '+', { l: 'Seguro', v: rs(P.Seguro) }, '+', { l: 'IPVA', v: rs(P['IPVA Licenciamento']) }, '+', { l: 'Rastr. + faixa', v: rs(P.Rastreador + P['Faixa Reflexiva']) }, '+', { l: 'Lavagem', v: rs(P.Lavagem) }, '=', { l: 'Fixo / mês', v: rs(P['Total Custo Fixo']), d: true }]),
  org: origem([['Caminhão', 'Total Custo Fixo', 'soma das parcelas acima', rs(P['Total Custo Fixo'])], ['Caminhão', 'Depreciação · Remuneração K · Lucro Fixo', 'modelo antigo (caminhões quitados): substituem o FINAME', '—'], ['Caminhão', 'Custo Aluguel', 'caminhão alugado (Vamos, TB Green, Athivalog): fora do Total Custo Fixo', '—']]),
  n: `Conferência: ${conf(C.fixo)}. Status das placas ativas: ${Object.entries(M.status).map(([k, v]) => `${k} ${v}`).join(' · ')}.` });

custo({ k: 'T2 · Fixo · 6', h: 'Caminhão parado: recebe o fixo de parado',
  fit: fita([{ l: 'FINAME parado', v: rs(R['FINAME Modelo Novo Parado']) }, '+', { l: 'Seguro parado', v: rs(R['Seguro Parado']) }, '+', { l: 'IPVA parado', v: rs(R['IPVA Licenc. Mensal Parado']) }, '+', { l: 'Faixa', v: rs(R['Faixa Reflexiva Parado']) }, '=', { l: 'Por parado / mês', v: rs(R['Total por Caminhão Frota Parada']), d: true }]),
  org: origem([['Caminhão', 'Ativo = FALSO', 'placa inativa vira "parado" no Resumo', f0(R['Total Caminhão Parado']) + ' em Cuiabá'], ['Resumo', '… Parado', 'média do fixo das placas inativas', rs(R['Total por Caminhão Frota Parada'])], ['Resumo', 'Total Frota Parada', 'por parado × parados', 'R$ ' + mil(R['Total por Caminhão Frota Parada'] * R['Total Caminhão Parado'])]]),
  n: 'O parado não recebe variável: o variável sai só dos ativos × mapas.' });

// ═══ T2 · variável ═══
const D = M.comb_unid['DIESEL S10'] || {}, AR = M.comb_unid.ARLA || {};
custo({ k: 'T2 · Variável · 1', h: 'Combustível: (preço do diesel + Arla) ÷ Km/L remunerado',
  fit: fita([{ l: 'Preço pago diesel', v: rs(D.pago) }, '+', { l: 'Arla (~5% do diesel)', v: rs(AR.pago) + ' × 5%' }, '÷', { l: 'Km/L remunerado', v: f2(P['Consumo KM/L']) }, '=', { l: 'Combustível', v: rk(P['Consumo R$/KM']), d: true }]),
  org: origem([['Combustível Rota', 'precoOperadora · precoAnp', 'nosso preço (NF) e a ANP', rs(D.op) + ' · ' + rs(D.anp)], ['Combustível Rota', 'precoCreditoImpostos', 'preço pago = o menor dos dois', rs(D.pago)], ['Combustível Rota', 'ARLA', 'preço do Arla', rs(AR.pago)],
    ['Caminhão', 'Consumo KM/L', 'Km/L remunerado da placa (revisão trimestral)', f2(P['Consumo KM/L'])], ['Caminhão', 'Consumo R$/KM', 'resultado, 2 casas', rk(P['Consumo R$/KM'])]]),
  n: `Preço implícito na conta: R$ ${f2(P['Consumo R$/KM'] * P['Consumo KM/L'])}/L. Placa "S10 S/ ARLA" usa só o diesel. Em 100% dos preços de diesel desde 2022 o pago é o menor entre o nosso e a ANP.` });

custo({ k: 'T2 · Variável · 2', h: 'Km/L remunerado: o consumo previsto da placa',
  fit: fita([{ l: 'Benchmark do modelo', v: f2(P['Benchmark Consumo']) }, '→', { l: 'Revisão trimestral', v: 'consumo validado' }, '→', { l: 'Km/L da placa', v: f2(P['Consumo KM/L']), d: true }]),
  org: origem([['Caminhão', 'Benchmark Consumo', 'referência do modelo', f2(P['Benchmark Consumo'])], ['Caminhão', 'Fator Correção Região', 'ajuste por região (%)', f1(P['Fator Correção Região'])], ['Caminhão', 'Perda Ano Veículo', 'ajuste por idade (%)', f1(P['Perda Ano Veículo'])], ['Caminhão', 'Consumo KM/L', 'valor que entra na conta', f2(P['Consumo KM/L'])]]),
  n: 'A revisão entra na 1ª quinzena de cada trimestre: o consumo validado do trimestre anterior, com penalidades. Em out/26 a revisão do 4º trimestre não foi feita (nenhuma placa mudou).' });

const MB = M.manut_bid || {}, MS = M.manut_sembid || {};
custo({ k: 'T2 · Variável · 3', h: 'Manutenção do caminhão: carência, BID da montadora ou tabela por idade',
  fit: `<div class="grid g4" style="margin-top:16px;gap:12px">
    <div class="box" style="text-align:center"><div class="lbl">Carência · vida ≤ ${f0(P.freeMaintenance)} meses</div><div class="num">R$ 0,00</div><p>caminhão na garantia</p></div>
    <div class="box" style="text-align:center"><div class="lbl">Com BID · regra padrão</div><div class="num">${MB.padrao ? f0(MB.padrao.r * 100) + '%' : '—'}<small> do BID</small></div><p>${MB.padrao ? f0(MB.padrao.n) : 0} placas</p></div>
    <div class="box" style="text-align:center"><div class="lbl">BID · compra fora autorizada, > 24 meses</div><div class="num">${MB.fora_24 ? f0(MB.fora_24.r * 100) + '%' : '—'}<small> do BID</small></div><p>${MB.fora_24 ? f0(MB.fora_24.n) : 0} placas</p></div>
    <div class="box" style="text-align:center"><div class="lbl">Sem BID · tabela por idade</div><div class="num">${MS.rk ? rk(MS.rk) : '—'}</div><p>${MS.n || 0} placas, ano mediano ${MS.ano || '—'}</p></div></div>
    ${fita([{ l: 'Exemplo: ' + P.Placa + ' · ' + f0(P.manutencaoVidaMeses) + ' meses', v: 'BID ' + rk(P.manutencaoBid) }, '×', { l: 'Regra padrão', v: '90%' }, '=', { l: 'Manutenção R$/KM', v: rk(P['Manutenção R$/KM']), d: true }])}`,
  org: origem([['Caminhão', 'Manutenção R$/KM', 'o que entra no variável', rk(P['Manutenção R$/KM'])], ['Caminhão', 'manutencaoBid', 'BID da montadora para modelo, capacidade e faixa de km', rk(P.manutencaoBid)],
    ['Caminhão', 'manutencaoCompraForaDoBidAutorizada · manutencaoVidaMeses', 'muda a regra', f0(P.manutencaoVidaMeses) + ' meses'], ['Manutenção BID Rota', 'valorFaixa1…10 · kmApartirDe1…10', 'R$/km por faixa de km acumulado', '—'],
    ['Manutenção Cavalo', 'KM 1000 … KM 3500 por Ano de vida', 'tabela de quem não tem BID', '—'], ['Caminhão', 'R$/KM · manutencaoContrato', 'contrato da placa: NÃO entra no pagamento', rk(P.manutencaoContrato)]]),
  n: 'Placa sem contrato recebe manutenção do mesmo jeito (BID ou tabela). Os percentuais são medianas da quinzena, não um campo do FT.' });

custo({ k: 'T2 · Variável · 4', h: 'Manutenção da carroceria: valor mensal da tabela, por km',
  fit: fita([{ l: 'Tabela: valor por mês', v: rs(M.carroceria.mes) }, '÷', { l: 'Km da placa no mês', v: f0(P['KM Mês Roadshow']) }, '×', { l: 'Ajuste da tabela', v: '≈ 1,15' }, '=', { l: 'Carroceria', v: rk(P['Manutenção Carroceria R$/KM']), d: true }]),
  org: origem([['Manutenção Carroceria', 'Material · Perfil · Tipo', 'chave da tabela', `${P.Material} · ${P.Perfil} · ${P.Tipo}`], ['Manutenção Carroceria', 'Valor por Ano / Valor por Mês', 'custo de manutenção', rs(M.carroceria.ano) + ' / ' + rs(M.carroceria.mes)], ['Caminhão', 'Manutenção Carroceria R$/KM', 'resultado', rk(P['Manutenção Carroceria R$/KM'])]]),
  n: 'O ajuste de ~15% sobre a tabela aparece em todas as placas; o fator não vem nas colunas exportadas.' });

custo({ k: 'T2 · Variável · 5', h: 'Pneu: jogo novo + recapagens, divididos pela vida em km',
  fit: fita([{ l: 'Pneus × preço', v: f0(P['Quantidade de Pneus']) + ' × ' + rs(P['Preço Tração']) }, '+', { l: 'Recapagens × preço', v: f0(P['Quantidade de Pneus'] * P['Quantidade de Recapagem']) + ' × ' + rs(P['Preço Recapagem']) }, '÷', { l: 'Vida', v: f0(P['Vida Pneus KM']) + ' km' }, '=', { l: 'Pneu', v: rk(P['Pneu por KM']), d: true }]),
  org: origem([['Caminhão', 'Quantidade de Pneus', 'pelos eixos (dianteiro simples, traseiro duplo)', f0(P['Quantidade de Pneus'])], ['Pneu Caminhão', 'Preço Liso · Tração · Recapagem', 'por medida e região', rs(P['Preço Liso']) + ' · ' + rs(P['Preço Recapagem'])],
    ['Caminhão', 'Quantidade de Recapagem', 'recapagens por pneu', f0(P['Quantidade de Recapagem'])], ['Pneu KM Caminhão', 'KM Vida Útil (ajustado)', 'vida do pneu por região', f0(P['Vida Pneus KM'])], ['Caminhão', 'Medida Pneu', 'medida da placa', P['Medida Pneu']]]),
  n: `Conferência: ${conf(C.pneu)} (arredondamento em 2 casas).` });

custo({ k: 'T2 · Variável · 6', h: 'R$/km do caminhão: a soma das quatro peças',
  fit: fita([{ l: 'Combustível', v: f2(P['Consumo R$/KM']) }, '+', { l: 'Manutenção', v: f2(P['Manutenção R$/KM']) }, '+', { l: 'Carroceria', v: f2(P['Manutenção Carroceria R$/KM']) }, '+', { l: 'Pneu', v: f2(P['Pneu por KM']) }, '=', { l: 'R$/km', v: rk(P['Total Custo Variável']), d: true }]),
  org: origem([['Caminhão', 'Total Custo Variável', 'soma das peças', rk(P['Total Custo Variável'])], ['Caminhão AS', 'Total Custo Variável', 'as mesmas + Lavagem por KM', '—'], ['Van', 'totalCustoVariavel', 'as mesmas quatro', '—'], ['Resumo', 'Total R$/KM', 'média simples das placas ativas da unidade', rk(R['Total R$/KM'])]]),
  n: `Conferência: ${conf(C.variavel)}.` });

// ═══ T1 ═══
const TV = M.trecho_viagem || {};
const lab = { Diesel: 'Diesel', ManutencaoCavalo: 'Manut.\ncavalo', ManutencaoCarreta: 'Manut.\ncarreta', Pneus: 'Pneus', Lavagem: 'Lavagem', Pedagio: 'Pedágio', Seguro: 'Seguro', SalarioVariavel: 'Salário\nvariável', LucroVariavel: 'Lucro\nvariável' };
const ordem = ['Diesel', 'Pedagio', 'SalarioVariavel', 'LucroVariavel', 'Pneus', 'ManutencaoCavalo', 'ManutencaoCarreta', 'Lavagem', 'Seguro'];
slide(`<div class="kicker">T1 · Empurrada · frete da viagem</div><h2>O frete de cada trecho é a soma de nove componentes</h2>
  <p style="margin-top:4px">${T.Origem.replace('Unidade: ', '').split(' |')[0]} → ${T.Destino.replace('Unidade: ', '').split(' |')[0]} · ${f1(T.kmRodado)} km (ida + volta) · ${T.Capacidade.replace('Pallets: ', '')} pallets</p>
  <div style="margin-top:6px">${ponte({ h: 300, itens: [...ordem.filter(k => TV[k]).map(k => ({ rot: lab[k], v: TV[k], cor: AZUL })), { rot: 'Frete\nlíquido', v: T.freteLiquido, tot: true }], fmt: v => 'R$ ' + f0(v) })}</div>
  ${origem([['Trecho', 'freteReaisViagem…', 'cada componente por viagem (R$/km × km rodado)', 'R$ ' + f0(T.freteLiquido)], ['Trecho', 'freteLiquido', 'soma dos componentes (' + conf(C.trecho) + ')', 'R$ ' + f2(T.freteLiquido)], ['Trecho', 'freteCtrc', 'com impostos (PIS/COFINS e ICMS ' + f0(T.percentualIcmsIss) + '%)', 'R$ ' + f2(T.freteCtrc)]])}`);

const DE = M.comb_emp['DIESEL S10'] || {};
custo({ k: 'T1 · Variável · Diesel', h: 'Diesel do trecho: preço com crédito de imposto ÷ Km/L do trecho',
  fit: fita([{ l: 'Preço pago', v: rs(Math.min(DE.op, DE.anp)) }, '×', { l: 'Fator de crédito', v: f3(DE.credito / Math.min(DE.op, DE.anp)) }, '=', { l: 'Preço com crédito', v: rs(DE.credito) }, '÷', { l: 'Km/L do trecho', v: f2(T.dieselConsumoKmL) }, '=', { l: 'Diesel', v: rk(T.dieselConsumoDieselReaisKM), d: true }]),
  org: origem([['Combustível Empurrada', 'precoOperadora · precoAnp', 'nosso preço e a ANP', rs(DE.op) + ' · ' + rs(DE.anp)], ['Combustível Empurrada', 'precoCreditoImpostos', 'preço depois do crédito de imposto', rs(DE.credito)], ['Trecho', 'dieselConsumoKmL', 'Km/L do trecho (benchmark do cavalo, perdas de km e região)', f2(T.dieselConsumoKmL)], ['Trecho', 'dieselConsumoDieselReaisKM', 'resultado', rk(T.dieselConsumoDieselReaisKM)]]),
  n: `Piraí, ${M.vig}. Conferência: erro mediano de ${f2(C.diesel_trecho)}%. O fator de crédito varia por unidade (Cuiabá caiu de 0,94 para 0,78 em jan/26).` });

custo({ k: 'T1 · Variável · Manutenção e pneu', h: 'Manutenção do cavalo e da carreta, e pneu: R$/km da tabela',
  fit: fita([{ l: 'Manutenção cavalo', v: rk(T.manutencaoCavalo) }, '+', { l: 'Manutenção carreta', v: rk(T.manutencaoImplementoReaiskm) }, '+', { l: 'Pneu', v: rk(T.pneuCustoPneusCamarasReaisKm) }]) +
    fita([{ l: 'Pneus × preço médio', v: f0(T.pneuQuantidadeDePneus) + ' × ' + rs(T.pneuValorMedioPneus) }, '+', { l: 'Recapagens', v: rs(T.pneuValorMedioDaRecapagem) }, '÷', { l: 'Vida útil', v: f0(T.vidautilAjustadaPneu) + ' km' }, '=', { l: 'Pneu', v: rk(T.pneuCustoPneusCamarasReaisKm), d: true }]),
  org: origem([['Cavalo Empurrada', 'reaiskm · manutencaoBid · manutencaoContrato', 'R$/km do cavalo (BID por faixa de km acumulado)', rk(CV.reaiskm)], ['Manutenção BID Empurrada', 'até 120.000 … até 1.200.000', 'R$/km por faixa de odômetro', '—'], ['Manutenção Implemento', 'implemento 28/40, menor/maior 150 km', 'R$/km da carreta', rk(T.manutencaoImplementoReaiskm)], ['Trecho', 'pneuQuantidadeDePneus · pneuValorMedio… · vidautilAjustadaPneu', 'premissas do pneu', f0(T.pneuQuantidadeDePneus) + ' pneus']]),
  n: `Cavalo ${CV.Placa} (${String(CV.modeloEmpurrada).replace('Modelo: ', '')}), ${f0(CV.manutencaoVidaMeses)} meses, faixa ${String(CV.faixaKm).replace('ATE_', 'até ')} km.` });

custo({ k: 'T1 · Variável · Lavagem, pedágio, seguro, salário e lucro', h: 'Os demais componentes da viagem',
  fit: fita([{ l: 'Lavagem', v: rk(T.lavagemReaisKm) }, '+', { l: 'Pedágio / viagem', v: 'R$ ' + f0(TV.Pedagio || 0) }, '+', { l: 'Seguro', v: rk(T.seguroReaiskm) }, '+', { l: 'Salário variável', v: 'R$ ' + f0(TV.SalarioVariavel || 0) }, '+', { l: 'Lucro variável', v: rk(T.lucroVariavelReaisKm) }]),
  org: origem([['Trecho', 'lavagemReaisKm', 'lavagem por km (na Empurrada é variável)', rk(T.lavagemReaisKm)], ['Trecho', 'pedagioPorEixoIdaVolta · pedagio', 'pedágio por eixo, ida e volta', 'R$ ' + f0(TV.Pedagio || 0)], ['Trecho', 'seguroReaiskm', 'seguro da carga por km', rk(T.seguroReaiskm)],
    ['Trecho', 'premioProdutividade…', 'salário variável do motorista (fator ' + f1(T.premioProdutividadeFatorMotorista) + ')', 'R$ ' + f0(TV.SalarioVariavel || 0)], ['Trecho', 'lucroVariavelReaisKm', 'margem por km', rk(T.lucroVariavelReaisKm)]]) });

custo({ k: `T1 · Fixo · cavalo ${CV.Placa} e carreta ${CR.Placa} (${CR.modelo}), Piraí`, h: 'Fixo do cavalo e da carreta: FINAME e custos do equipamento',
  fit: fita([{ l: 'FINAME cavalo', v: rs(CV.finameCavalo) }, '=', { l: 'Amortização', v: rs(CV.amortizacaoCavalo) }, '+', { l: 'Juros', v: rs(CV.jurosFinameCavalo) }]) +
    fita([{ l: 'FINAME carreta', v: rs(CR.finame) }, '+', { l: 'Seguro', v: rs(CR.seguro) }, '+', { l: 'IPVA / mês', v: rs(CR.ipvaLicenciamentoMensal) }, '+', { l: 'Tacógrafo + faixa', v: rs(CR.tacografo + CR.faixaReflexiva) }, '+', { l: 'Demais (campo não exportado)', v: rs(CR.custoFixo - CR.finame - CR.seguro - CR.ipvaLicenciamentoMensal - CR.tacografo - CR.faixaReflexiva - (CR.rastreador || 0)) }, '=', { l: 'Custo fixo carreta', v: rs(CR.custoFixo), d: true }]),
  org: origem([['Cavalo Empurrada', 'valorNfCompra · percentualEntrada · Taxa Finame · periodoFiname · carencia', 'premissas do financiamento', 'R$ ' + mil(CV.valorNfCompra) + ' · ' + f2(CV['Taxa Finame (%)']) + '%'], ['Cavalo Empurrada', 'finameCavalo = amortizacaoCavalo + jurosFinameCavalo', 'parcela do cavalo', rs(CV.finameCavalo)],
    ['Carreta Empurrada', 'finame · seguro · ipvaLicenciamentoMensal · rastreador · tacografo · faixaReflexiva · custoFixo', 'parcelas da carreta', rs(CR.custoFixo)], ['Faturamento Empurrada', 'equipamentoAtivo / equipamentoParado (Quantidade × ValorUnitario)', 'fixo pago por equipamento', '—']]),
  n: '' });

// ═══ Armazém ═══
if (E.custoFixoCustoFixo != null) custo({ k: 'Armazém · Empilhadeira', h: 'Empilhadeira: financiamento + lucro fixo; variável por hora',
  fit: fita([{ l: 'Financiamento', v: rs(E.custoFixoFinanciamento) }, '+', { l: 'Lucro fixo', v: rs(E.custoFixoLucroFixo) }, '=', { l: 'Fixo / mês', v: rs(E.custoFixoCustoFixo), d: true }]) +
    fita([{ l: 'Manutenção', v: 'R$ ' + f2(E.custoVariavelManutencaoEmpilhadeira) }, '+', { l: 'Pneus', v: 'R$ ' + f2(E.custoVariavelPneus) }, '=', { l: 'Variável / hora', v: 'R$ ' + f2(E.custoVariavelTotal), d: true }]),
  org: origem([['Equipamento Armazém', 'valorCompraNf · percentualEntrada · taxaCdcMes / taxaFinameAno · periodoFinanciamento', 'premissas do financiamento', 'R$ ' + mil(E.valorCompraNf || 0)], ['Equipamento Armazém', 'custoFixoFinanciamento · custoFixoLucroFixo', 'parcela e margem', rs(E.custoFixoCustoFixo)], ['Equipamento Armazém', 'custoVariavelManutencaoEmpilhadeira · custoVariavelPneus', 'R$ por hora de horímetro', 'R$ ' + f2(E.custoVariavelTotal)], ['Fechamento Apoio', 'parametrosHorimetroQtde × Valor', 'horas pagas no mês', '—']]),
  n: `${E.descricaoEmpilhadeira || ''} ${E.modeloApoio || ''}`.trim() });

console.log('ok', write(process.env.FT_HTML || 'manual.html'), 'slides');

// ============================================================
// Histórico Freightech × DRE de frota, 2022→2026 (versão 26/10/2026).
// Estrutura (CONTEXTO.md, 6b): definições → Receita e frota → Contexto de
// mercado 2019→2026 (pandemia, inflação, juros) → Premissas (o caminhão; × IPCA,
// IGP-M e IPA-M base 2022 = 100; diesel × ANP; fixo × preço × juros; o PORQUÊ:
// mesmas placas × troca de frota, coorte de idade, modelo) → Resultado (pago ×
// remunerado DRE × realizado por ano; manutenção; financiamento; pneu) → T1 →
// Divergências → fechamento. O teto aparece só como informação.
//   HIS=historico.json H2=historico2.json OPO=opo.json FT_HTML=historico.html node deck-historico.mjs
// O HTML e o PDF NÃO vão para o repositório.
// ============================================================
import { readFileSync } from 'node:fs';
import { deck, cartoes, tabela, ponte, hbars, gbars, bars, lines, f0, f1, f2, f3, pct, MES, mv, NOME, lista, ACC, AZUL, VERDE, AMB, INK, INK2, INK3, PALE } from './deck-base.mjs';
const H = JSON.parse(readFileSync(process.env.HIS || 'historico.json', 'utf8'));
const H2 = JSON.parse(readFileSync(process.env.H2 || 'historico2.json', 'utf8'));
const O = JSON.parse(readFileSync(process.env.OPO || 'opo.json', 'utf8'));
const { slide, capa, capaSec, conc, concBlocos, write } = deck({ rodape: 'Remuneração Freightech · Histórico 2022–2026 · Conlog', marca: 'Remuneração <b>Freightech</b>', titulo: 'Freightech 2022–2026' });
const A = H.anos.map(String), Y = H.ano, PR = H.premissas, MA = H2.macro || {};
const M = v => f1(Math.abs(v) < 5e4 ? 0 : v / 1e6), K = v => f0(Math.abs(v) < 500 ? 0 : v / 1e3), sM = v => Math.abs(v) < 5e4 ? '0,0' : (v >= 0 ? '+' : '−') + M(Math.abs(v)), sK = v => Math.abs(v) < 500 ? '0' : (v >= 0 ? '+' : '−') + K(Math.abs(v));
const head = (k, h, sub = '') => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const cor = v => v > 0 ? ACC : VERDE, red = v => `color:${cor(v)};font-weight:700`;
const tag = c => `<span class="tag ${c === 'alta' ? 'alta' : c === 'média' ? 'media' : c === 'erro' ? 'erro' : 'baixa'}">${c}</span>`;
const lab = a => a === '2026' ? '2026*' : a;
const NM = { comb: 'Combustível', manut: 'Manutenção', carr: 'Carroceria', pneu: 'Pneu', lav: 'Lavagem', ipva: 'IPVA', seguro: 'Seguro' };
const C7 = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro'], C4 = ['comb', 'manut', 'carr', 'pneu'];
const FIM26 = mv(Y['2026'].FIM), N26 = +Y['2026'].FIM.slice(5), AA = A.filter(a => Y[a].peca.comb.ft > 0);
const tot = (a, k) => C7.reduce((s, c) => s + Y[a].peca[c][k], 0);
const idx = (k, a) => (((MA[k] || {}).idx22 || {})[a]);
const var22 = (k, a) => PR[a][k] / PR['2022'][k] * 100;

// ═══ capa ═══
capa(`2022 a 2026 (2026 até ${FIM26})`, 'Remuneração Freightech, 2022 a 2026: o que mudou nas premissas, por quê, e o que isso fez com o resultado', `Todas as quinzenas do FT desde jan/2022, cruzadas com a DRE de frota, a receita e os índices de mercado. Cada premissa do caminhão é lida contra a inflação e contra a troca de frota. Os valores de 2026 vão de janeiro a ${FIM26}.`);

// ═══ definições ═══
{
  const a = '2025', s = { ft: tot(a, 'ft'), rem: tot(a, 'rem'), real: tot(a, 'real') }, vt = C4.reduce((x, c) => x + Y[a].t2_teto[c], 0), vp = C4.reduce((x, c) => x + Y[a].t2_pago[c], 0);
  slide(`${head('Antes de começar', 'Quatro termos que aparecem em toda tabela deste histórico', `Exemplo: frota T2 em ${a}, as sete contas de frota (combustível, manutenção, carroceria, pneu, lavagem, IPVA, seguro)`)}
  ${cartoes([
    { k: 'Pago FT', n: 'R$ ' + M(s.ft) + ' mi', p: 'O que o Freightech paga pela frota: R$/km do caminhão (premissas do FT) × km remunerado dos mapas rodados, mais o fixo por caminhão. O km dos mapas vem da <b>nossa Dispersão de km</b>; não é a fatura.', o: 'Caminhão e Resumo do FT × Dispersão de km (desde 2023)' },
    { k: 'Remunerado DRE', n: 'R$ ' + M(s.rem) + ' mi', p: 'O que o planejamento lançou na DRE como receita de frota esperada, conta a conta. Pode diferir do pago FT por imposto (regime tributário: lucro real × crédito presumido) e pela composição do planejamento; a diferença fica em aberto até os relatórios oficiais do FT.', o: 'DRE de frota · Remunerado' },
    { k: 'Realizado DRE', n: 'R$ ' + M(s.real) + ' mi', p: 'O que de fato gastamos, por conta. <b>Pago − realizado = resultado da frota.</b>', o: 'DRE de frota · Realizado', acc: true },
    { k: 'Teto (informativo)', n: 'R$ ' + M(vt) + ' mi', p: `R$/km × km da placa × ativos × 25 mapas: o variável se todos os ativos rodassem todos os dias. Em ${a} o variável pago foi R$ ${M(vp)} mi. Não é meta nem base de comparação.`, o: 'Resumo do FT · Total Viagens' },
  ])}
  ${conc(`As premissas (R$/km, Km/L, fixo) são medianas das placas ativas da Rota em cada ano, lidas da tabela Caminhão do FT. 2022 não tem km pago porque a Dispersão de km começa em 2023; nesse ano o pago FT das contas variáveis fica em branco.`, 'Como ler')}`);
}

// ═══ Parte 1 · Receita e frota ═══
capaSec(1, 'Receita e frota', 'Quanto a operação faturou e com quantos caminhões, ano a ano.');
{
  const P = ['ROTA', 'EMPURRADA', 'APOIO', 'TERCEIROS', 'AUTO SERVIÇO', 'DISTRIBUIÇÃO URBANA', 'INSUMOS', 'ROTA (VAN)', 'EMPURRADA BITREM'];
  const v = (a, p) => ((Y[a].receita || {})[p] || {}).real || 0, tot_ = a => Object.values(Y[a].receita || {}).reduce((s, x) => s + x.real, 0);
  const t22 = tot_('2022'), t25 = tot_('2025'), t26 = tot_('2026'), an26 = t26 / N26 * 12, r = a => v(a, 'ROTA'), e = a => v(a, 'EMPURRADA');
  slide(`${head('Receita líquida por projeto', `A receita cresceu ${f0((t25 / t22 - 1) * 100)}% de 2022 a 2025, de R$ ${M(t22)} mi para R$ ${M(t25)} mi`, `DRE · R$ mi por ano · realizado · * 2026 = jan a ${FIM26}`)}
  <div class="duas" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)">
    ${bars({ w: 480, h: 230, labels: A.map(lab), data: A.map(tot_), cor: i => i === 4 ? INK3 : INK, fmt: v => 'R$ ' + M(v) + ' mi' })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'R$ mi' }, ...A.map(a => ({ t: lab(a), n: true }))], rows: P.filter(p => A.some(a => v(a, p) > 1e5)).map(p => [p, ...A.map(a => v(a, p) ? M(v(a, p)) : '—')]), tot: ['Total', ...A.map(a => M(tot_(a)))] })}
  </div>
  ${concBlocos([
    { t: 'Crescimento', v: '+' + f0((t25 / t22 - 1) * 100) + '% em 3 anos', s: `2026 anualizado dá R$ ${M(an26)} mi (${pct((an26 / t25 - 1) * 100, 0)} sobre 2025).` },
    { t: 'Quem puxa', v: 'Rota', s: `R$ ${M(r('2022'))} → ${M(r('2025'))} mi (+${f0((r('2025') / r('2022') - 1) * 100)}%), ${f0(r('2025') / t25 * 100)}% do total em 2025; Empurrada +${f0((e('2025') / e('2022') - 1) * 100)}%.` },
    { t: 'Entrou', v: 'Distribuição Urbana', s: `Anhanguera em 2025; R$ ${M(v('2026', 'DISTRIBUIÇÃO URBANA'))} mi em ${N26} meses de 2026.` },
    { t: 'Volume, não preço', v: 'R$/km parado', s: `o variável por km da Rota ficou em ~R$ ${f2(PR['2024'].var)} desde 2023 (próxima parte): o crescimento é frota e km.` },
  ])}`);
}
{
  const F = H.frota_mes, fr = a => Y[a].t2_frota;
  slide(`${head('Frota T2 (Rota e Van)', `A frota ativa cresceu ${f0((fr('2025').ativos_mes / fr('2022').ativos_mes - 1) * 100)}% e a parada triplicou: ${f0(fr('2022').parados_mes)} → ${f0(fr('2026').parados_mes)} caminhões por mês`, 'Caminhões por mês (média das duas quinzenas) · km em mi por ano · * 2026 = jan a ' + FIM26)}
  ${lines({ w: 1136, h: 175, labels: F.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: F.at, cor: INK, rotulo: 'ativos' }, { data: F.par, cor: ACC, rotulo: 'parados' }], y0: 0, y1: Math.max(...F.at) * 1.15, pad: { l: 50, r: 70, t: 14, b: 30 } })}
  ${tabela({ classe: 'compacta', style: 'margin-top:6px', cols: [{ t: 'Por ano' }, ...A.map(a => ({ t: lab(a), n: true }))], rows: [
    ['Caminhões ativos por mês', ...A.map(a => f0(fr(a).ativos_mes))],
    ['Caminhões parados por mês', ...A.map(a => f0(fr(a).parados_mes))],
    ['Parados em % da frota', ...A.map(a => f0(fr(a).parados_mes / (fr(a).ativos_mes + fr(a).parados_mes) * 100) + '%')],
    ['Km pago (mi, mapas rodados)', ...A.map(a => Y[a].t2_pago.km ? M(Y[a].t2_pago.km) : '—')],
    ['Km rodado (mi, Dispersão)', ...A.map(a => Y[a].t2_pago.rodado ? M(Y[a].t2_pago.rodado) : '—')],
    ['Km dimensionado pelo FT (mi, informativo)', ...A.map(a => M(Y[a].t2_teto.kmtot))],
  ] })}
  ${concBlocos([
    { t: 'Frota', v: f0(fr('2022').ativos_mes) + ' → ' + f0(fr('2025').ativos_mes) + ' ativos', s: `2026 recuou para ${f0(fr('2026').ativos_mes)} por mês com a saída de placas antigas.` },
    { t: 'Parados', v: f0(fr('2022').parados_mes / (fr('2022').ativos_mes + fr('2022').parados_mes) * 100) + '% → ' + f0(fr('2026').parados_mes / (fr('2026').ativos_mes + fr('2026').parados_mes) * 100) + '% da frota', s: `o parado recebe o fixo inteiro (FINAME, seguro, IPVA, rastreador, faixa): R$ ${M(Y['2026'].t2_fixo.fixo_par)} mi em ${N26} meses de 2026, contra R$ ${M(Y['2022'].t2_fixo.fixo_par)} mi em 2022 inteiro.` },
    { t: 'Km pago', v: M(Y['2023'].t2_pago.km) + ' → ' + M(Y['2025'].t2_pago.km) + ' mi', s: 'cresce com a frota; o km rodado fica 2% a 4% acima do pago em todos os anos (dispersão).' },
    { t: 'Dimensionamento', v: 'só informação', s: 'o FT dimensiona 25 mapas por ativo; a rede rodou de 21 a 22,5. Não é meta nem base de comparação.' },
  ])}`);
}

// ═══ Parte 2 · Contexto de mercado ═══
capaSec(2, 'Contexto de mercado, 2019 a 2026', 'Pandemia, inflação, juros e demanda: a base 2022 é uma base distorcida, e é contra ela que as premissas do FT são lidas.');
{
  const anos = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], m = k => (MA[k] || {}).ano || {};
  const row = (n, k, f = v => pct(v, 1)) => [n, ...anos.map(a => m(k)[a] == null ? '—' : f(m(k)[a]))];
  const tj = H2.tjlp || {}, tf = H2.taxa_finame || {};
  slide(`${head('Contexto de mercado', 'De 2019 a 2026: a inflação de atacado dobrou na pandemia, a Selic foi de 2% a 14%, e 2023 normalizou os preços', 'Séries anuais do Banco Central (SGS) · IPCA, IGP-M e IPA-M = variação no ano · Selic = média do ano · TJLP e taxa FINAME = mediana nas placas do FT · * 2026 parcial')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Indicador' }, ...anos.map(a => ({ t: a === '2026' ? '2026*' : a, n: true }))], rows: [
    row('IPCA (varejo), % no ano', 'ipca'), row('IGP-M (geral), % no ano', 'igpm'), row('IPA-M (atacado: peças, caminhão), % no ano', 'ipa_m'),
    row('Selic meta, % a.a. (média)', 'selic_meta', v => f1(v) + '%'),
    ['TJLP nas placas do FT, % a.a.', ...anos.map(a => tj[a] == null ? '—' : f1(tj[a]) + '%')],
    ['Taxa FINAME nas placas do FT, % a.a.', ...anos.map(a => tf[a] == null ? '—' : f1(tf[a]) + '%')],
    row('Desemprego PNAD, %', 'desemprego', v => f1(v) + '%'), row('IBC-Br (atividade, 2022 = 100)', 'ibc_br', v => f1(v)),
    ['IPCA acumulado (2019 = 100)', ...anos.map(a => f1((MA.ipca || {}).idx19?.[a]))], ['IGP-M acumulado (2019 = 100)', ...anos.map(a => f1((MA.igpm || {}).idx19?.[a]))], ['IPA-M acumulado (2019 = 100)', ...anos.map(a => f1((MA.ipa_m || {}).idx19?.[a]))],
  ] })}
  ${concBlocos([
    { t: 'Pandemia', v: '2020–2021', s: `IGP-M +${f1(m('igpm')['2020'])}% e +${f1(m('igpm')['2021'])}%, IPA-M +${f1(m('ipa_m')['2020'])}% e +${f1(m('ipa_m')['2021'])}%: peça, pneu e caminhão novo subiram o dobro do varejo; Selic de ${f1(m('selic_meta')['2020'])}% para ${f1(m('selic_meta')['2022'])}% em dois anos.` },
    { t: '2022 é base distorcida', v: 'atacado +' + f0(((MA.ipa_m || {}).idx19?.['2022'] || 100) - 100) + '% sobre 2019', s: 'o ano de partida deste histórico carrega o pico do diesel (guerra), fila das montadoras e juros em alta. Premissa que cai em 2023 pode ser normalização, não corte.' },
    { t: '2023–2026', v: 'varejo sobe, atacado para', s: `IPCA +${f0((idx('ipca', '2026') || 100) - 100)}% de 2022 a 2026; IGP-M +${f0((idx('igpm', '2026') || 100) - 100)}% e IPA-M +${f0((idx('ipa_m', '2026') || 100) - 100)}%: peça e caminhão ficaram quase parados em preço, o custo de gente e serviço não.` },
    { t: 'Juros', v: 'TJLP ' + f1(tj['2022']) + '% → ' + f1(tj['2026']) + '%', s: `a taxa do FINAME nas placas foi de ${f1(tf['2022'])}% a ${f1(tf['2026'])}% a.a.: cada caminhão novo entra com parcela maior, e o FT remunera a parcela.` },
  ])}`);
}

// ═══ Parte 3 · Premissas ═══
capaSec(3, 'As premissas do caminhão', 'O R$/km e o fixo de um caminhão da Rota em cinco anos, contra a inflação e explicados pela troca de frota.');
{
  const row = (n, k, f = f2) => [n, ...A.map(a => PR[a][k] == null ? '—' : f(PR[a][k]))];
  slide(`${head('Premissas do caminhão (Rota)', `O variável caiu de R$ ${f2(PR['2022'].var)} para R$ ${f2(PR['2026'].var)}/km e o fixo subiu ${f0((PR['2026'].fixo / PR['2022'].fixo - 1) * 100)}%: a remuneração migrou do km para o caminhão`, 'Mediana das placas ativas da Rota em cada ano · tabela Caminhão do FT · unidade em cada linha')}
  <div class="duas" style="grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Premissa (mediana das placas)' }, ...A.map(a => ({ t: lab(a), n: true }))], rows: [
      row('Combustível, R$/km', 'comb'), row('Manutenção, R$/km', 'manut'), row('Carroceria, R$/km', 'carr'), row('Pneu, R$/km', 'pneu'), { c: row('<b>Variável, R$/km</b>', 'var'), cls: 'sep' },
      row('Km/L remunerado', 'kml'), row('Km da placa por mês', 'km_placa', f0), row('Fixo por mês, R$', 'fixo', f0), row('FINAME por mês, R$', 'finame', f0), row('Valor de compra, R$ mil', 'compra', v => f0(v / 1e3)), row('Taxa FINAME, % a.a.', 'taxa', f1), row('Vida, meses', 'vida', f0), row('Placas ativas no ano (distintas)', 'placas', f0)] })}
    <div>${lines({ w: 480, h: 230, pad: { l: 40, r: 104, t: 16, b: 30 }, labels: A.map(lab), series: [{ data: A.map(a => PR[a].comb), cor: ACC, rotulo: 'combustível', pontos: true }, { data: A.map(a => PR[a].manut), cor: AZUL, rotulo: 'manutenção', pontos: true }, { data: A.map(a => PR[a].pneu), cor: VERDE, rotulo: 'pneu', pontos: true }], yfmt: v => f2(v) })}
    <p class="note">R$/km por peça, mediana das placas ativas. Placas distintas no ano ≠ frota média por mês (${f0(Y['2025'].t2_frota.ativos_mes)} ativos/mês em 2025).</p></div>
  </div>
  ${concBlocos([
    { t: 'Variável', v: 'R$ ' + f2(PR['2022'].var) + ' → ' + f2(PR['2026'].var) + '/km', s: `cai em 2023 (diesel R$ ${f2(H.diesel['2022'].pago)} → ${f2(H.diesel['2023'].pago)}) e para em ~R$ 3,0; o IPCA subiu ${f0((idx('ipca', '2026') || 100) - 100)}% no mesmo período.` },
    { t: 'Manutenção', v: '−' + f0((1 - PR['2026'].manut / PR['2022'].manut) * 100) + '%', s: 'o porquê está na troca de frota (placas velhas na tabela por idade saíram, novas em carência e BID baixo entraram), não na mesma placa: slide do porquê.' },
    { t: 'Km/L', v: f2(PR['2022'].kml) + ' → ' + f2(PR['2026'].kml), s: 'subiu com a frota mais velha (vida 42 → 50 meses), o que não é o esperado: parte é revisão do validado, parte é a saída das placas piores.' },
    { t: 'Fixo', v: 'R$ ' + f0(PR['2022'].fixo) + ' → ' + f0(PR['2026'].fixo) + '/mês', s: `caminhão ${f0((PR['2026'].compra / PR['2022'].compra - 1) * 100)}% mais caro e taxa ${f1(PR['2026'].taxa - PR['2022'].taxa)} pontos maior: o FT remunera a parcela, então o fixo acompanha.` },
  ])}`);
}
// premissas × inflação
{
  const km26 = Y['2026'].t2_pago.km, L = [
    ['Variável, R$/km', 'var', f2, true], ['Combustível, R$/km', 'comb', f2, true], ['Manutenção, R$/km', 'manut', f2, true], ['Pneu, R$/km', 'pneu', f2, true], ['Carroceria, R$/km', 'carr', f2, true],
    ['Km/L remunerado', 'kml', f2, false], ['Km da placa por mês', 'km_placa', f0, false], ['Fixo por mês, R$', 'fixo', f0, false], ['FINAME por mês, R$', 'finame', f0, false], ['Valor de compra, R$ mil', 'compra', v => f0(v / 1e3), false],
  ];
  const ip = idx('ipca', '2026'), ig = idx('igpm', '2026'), ipa = idx('ipa_m', '2026');
  const leitura = (k) => { const v = var22(k, '2026'); if (k === 'kml') return 'não é preço; subiu ' + pct(v - 100, 0); if (v < ipa - 3) return 'ficou atrás do atacado (IPA-M)'; if (v < ip - 3) return 'acompanhou o atacado, ficou atrás do IPCA'; if (v <= ip + 3) return 'acompanhou o IPCA'; return 'passou o IPCA'; };
  const valor = k => (PR['2022'][k] * ip / 100 - PR['2026'][k]) * km26;
  slide(`${head('Premissas × inflação', `Se o R$/km de 2022 tivesse seguido o IPCA, o variável de 2026 seria R$ ${f2(PR['2022'].var * ip / 100)}/km, não R$ ${f2(PR['2026'].var)}: R$ ${M(valor('var'))} mi a menos no km pago de ${N26} meses`, 'Base 2022 = 100 · premissa = mediana das placas ativas da Rota · índices acumulados do BCB (2022 → 2026) · leitura: o que a premissa fez contra o índice')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Premissa' }, { t: '2022', n: true }, { t: '2026', n: true }, { t: '2026 (2022 = 100)', n: true }, { t: 'IPCA', n: true }, { t: 'IGP-M', n: true }, { t: 'IPA-M', n: true }, { t: 'Leitura' }, { t: 'Vale em 2026', n: true }],
    rows: L.map(([n, k, f, km]) => { const v = var22(k, '2026'); return [n, f(PR['2022'][k]), f(PR['2026'][k]), { v: f0(v), style: v < ip - 3 && k !== 'kml' ? red(1) : '' }, f0(ip), f0(ig), f0(ipa), leitura(k), km ? { v: 'R$ ' + M(valor(k)) + ' mi', style: red(valor(k)) } : '—']; }) })}
  <p class="note">"Vale em 2026" = (premissa de 2022 corrigida pelo IPCA − premissa de 2026) × km pago de ${N26} meses de 2026 (${M(km26)} mi km). Positivo = o FT paga menos do que pagaria se a premissa tivesse acompanhado o IPCA. Km/L não é preço e não entra na conta.</p>
  ${concBlocos([
    { t: 'Variável', v: var22('var', '2026') < 100 ? '−' + f0(100 - var22('var', '2026')) + '% nominal' : '+' + f0(var22('var', '2026') - 100) + '%', s: `contra IPCA +${f0(ip - 100)}%: em termos reais o km da Rota paga ${f0((1 - PR['2026'].var / (PR['2022'].var * ip / 100)) * 100)}% menos do que em 2022.` },
    { t: 'Manutenção', v: 'R$ ' + M(valor('manut')) + ' mi', s: `a premissa caiu ${f0(100 - var22('manut', '2026'))}% enquanto peça e serviço subiram: é a linha que mais pesa, e o porquê é a troca de frota (slide seguinte).` },
    { t: 'Pneu e carroceria', v: 'acompanharam', s: `pneu +${f0(var22('pneu', '2026') - 100)}% (IPA-M ${pct(ipa - 100, 0)}): o preço de tabela do 275 subiu em 2023 e recuou; carroceria +${f0(var22('carr', '2026') - 100)}%.` },
    { t: 'Fixo e compra', v: '+' + f0(var22('fixo', '2026') - 100) + '% e +' + f0(var22('compra', '2026') - 100) + '%', s: `muito acima de qualquer índice: não é inflação, é frota nova financiada a juros maiores (slide do fixo).` },
  ])}`);
}
// diesel × ANP × IPCA
{
  const D = H.diesel_mes, D_ = H.diesel, dif = A.map(a => [a, D_[a].anp - D_[a].op]), maior = dif.slice().sort((a, b) => b[1] - a[1])[0];
  slide(`${head('Diesel S10 (Rota)', `O diesel pago seguiu o nosso preço nos cinco anos; a regra do menor preço nunca nos favoreceu`, 'Mediana R$/L por quinzena nas unidades da Rota · tabela Combustível do FT · cinza tracejado = ANP · azul = nosso preço · vermelho = pago')}
  ${lines({ w: 1136, h: 210, labels: D.v.map((x, i) => i % 6 === 0 ? mv(x) : ''), series: [{ data: D.anp, cor: INK3, rotulo: '', dash: true }, { data: D.op, cor: AZUL, rotulo: '' }, { data: D.pago, cor: ACC, rotulo: 'pago' }], yfmt: v => f2(v), pad: { l: 50, r: 70, t: 14, b: 30 } })}
  ${tabela({ classe: 'compacta', style: 'margin-top:6px', cols: [{ t: 'Mediana do ano, R$/L' }, ...A.map(a => ({ t: lab(a), n: true })), { t: '2026 (2022 = 100)', n: true }], rows: [
    ['Nosso preço (NF subida ao FT)', ...A.map(a => f2(D_[a].op)), f0(D_['2026'].op / D_['2022'].op * 100)],
    ['ANP da unidade', ...A.map(a => f2(D_[a].anp)), f0(D_['2026'].anp / D_['2022'].anp * 100)],
    ['Pago pelo FT (o menor dos dois)', ...A.map(a => f2(D_[a].pago)), f0(D_['2026'].pago / D_['2022'].pago * 100)],
    ['IPCA acumulado', ...A.map(a => f0(idx('ipca', a))), f0(idx('ipca', '2026'))],
  ] })}
  ${concBlocos([
    { t: 'Pago = nosso preço', v: '100% dos registros', s: `compramos abaixo da ANP em todos os anos (maior folga em ${lab(maior[0])}, R$ ${f2(maior[1])}/L): o FT paga o que pagamos, e o ganho de preço só existe no tanque interno (Rio, Florianópolis).` },
    { t: 'Preço real caiu', v: f0(D_['2026'].pago / D_['2022'].pago * 100) + ' contra IPCA ' + f0(idx('ipca', '2026')), s: `2022 era o pico da guerra (R$ ${f2(D_['2022'].pago)}); 2023 normalizou (R$ ${f2(D_['2023'].pago)}) e 2026 voltou a R$ ${f2(D_['2026'].pago)}: abaixo da inflação, como a ANP.` },
    { t: 'Então', v: 'déficit não é preço', s: 'a alta de 2026 entrou no pago e no custo ao mesmo tempo; o combustível acima do pago vem do km e do consumo (Análise 2026).' },
    { t: 'Exceção', v: 'Macacu, 1ª ago/25', s: `R$ ${f2(O.preco.baixo[0].op)}/L digitado contra ANP ${f2(O.preco.baixo[0].anp)}: R$ ${K(O.preco.valor)} mil na Rota e ~R$ ${K(O.preco.emp.perda)} mil na Empurrada.` },
  ])}`);
}
// fixo × preço × juros
{
  const S = H2.status, FS = H2.fixo_status, tj = H2.tjlp, tf = H2.taxa_finame, sel = (MA.selic_meta || {}).ano || {};
  const fin = a => (S[a].FINANCIADO || 0) + (S[a].FINAME || 0) + (S[a].LEASING || 0), q = a => S[a].QUITADO || 0, tot_ = a => Object.values(S[a]).reduce((s, x) => s + x, 0);
  slide(`${head('Fixo × preço do caminhão × juros', `O FINAME mediano subiu ${f0((PR['2026'].finame / PR['2022'].finame - 1) * 100)}%: caminhão ${f0((PR['2026'].compra / PR['2022'].compra - 1) * 100)}% mais caro e taxa ${f1(PR['2026'].taxa - PR['2022'].taxa)} pontos maior`, 'Mediana das placas ativas da Rota · nº de placas distintas ativas no ano por tipo de financiamento · fixo mediano por mês e tipo (R$)')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Por ano' }, ...A.map(a => ({ t: lab(a), n: true }))], rows: [
      ['Fixo por mês, R$ (mediana de todas)', ...A.map(a => f0(PR[a].fixo))], ['· financiada', ...A.map(a => f0(FS[a].FINANCIADO))], ['· leasing', ...A.map(a => f0(FS[a].LEASING))], ['· quitada', ...A.map(a => f0(FS[a].QUITADO))],
      ['FINAME por mês, R$ (mediana)', ...A.map(a => f0(PR[a].finame))], ['Valor de compra, R$ mil (mediana)', ...A.map(a => f0(PR[a].compra / 1e3))],
      ['Taxa FINAME nas placas, % a.a.', ...A.map(a => f1(tf[a]) + '%')], ['TJLP nas placas, % a.a.', ...A.map(a => f1(tj[a]) + '%')], ['Selic média, % a.a.', ...A.map(a => sel[a] == null ? '—' : f1(sel[a]) + '%')],
      { c: ['Placas financiadas (FINAME, financiado, leasing)', ...A.map(a => f0(fin(a)) + ' de ' + f0(tot_(a)))], cls: 'sep' }, ['Placas quitadas', ...A.map(a => f0(q(a)) + ' de ' + f0(tot_(a)))]] })}
  ${concBlocos([
    { t: 'Preço do caminhão', v: 'R$ ' + K(PR['2022'].compra) + ' → ' + K(PR['2026'].compra) + ' mil', s: `+${f0((PR['2026'].compra / PR['2022'].compra - 1) * 100)}% na mediana, acima do IPA-M (${pct((idx('ipa_m', '2026') || 100) - 100, 0)}): não é só inflação, é mix (26.260 e Constellation no lugar de 1719/1718).` },
    { t: 'Juros', v: f1(tf['2022']) + '% → ' + f1(tf['2026']) + '% a.a.', s: `TJLP ${f1(tj['2022'])}% → ${f1(tj['2026'])}% e spreads: a parcela do mesmo caminhão sobe ~${f0(((1 + tf['2026'] / 100) ** (1 / 12) - 1) / ((1 + tf['2022'] / 100) ** (1 / 12) - 1) * 100 - 100)}% só pela taxa.` },
    { t: 'Frota financiada', v: f0(fin('2022') / tot_('2022') * 100) + '% → ' + f0(fin('2025') / tot_('2025') * 100) + '%', s: `leasing de ${S['2022'].LEASING} para ${S['2025'].LEASING} placas; o quitado recebe R$ ${f0(FS['2026'].QUITADO)}/mês e o financiado R$ ${f0(FS['2026'].FINANCIADO)}.` },
    { t: 'O risco', v: 'fim das parcelas', s: 'o FT remunera a parcela: quando ela acaba, o fixo cai para o do quitado e a manutenção paga não sobe. A renovação se planeja pelo fim das parcelas.' },
  ])}`);
}
// o porquê: mesmas placas × troca de frota
{
  const D = H2.decomp['2022-2026'], L = [['Manutenção, R$/km', 'manut', f2], ['Km/L remunerado', 'kml', f2], ['Combustível, R$/km', 'comb', f2], ['Pneu, R$/km', 'pneu', f2], ['Variável, R$/km', 'var', f2], ['Fixo por mês, R$', 'fixo', f0], ['FINAME por mês, R$', 'finame', f0], ['Vida, meses', 'vida', f0], ['Valor de compra, R$ mil', 'compra', v => f0(v / 1e3)]];
  slide(`${head('O porquê: mesmas placas × troca de frota', `Das ${D.placas_a} placas de 2022, ${D.saiu} saíram e ${D.entrou} entraram até 2026: a mudança das premissas é troca de frota, não revisão da mesma placa`, 'Mediana por placa (cada placa pesa 1) · "mesmas" = as ' + D.comum + ' placas ativas nos dois anos · "saíram" = valor delas em 2022 · "entraram" = valor delas em 2026')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Premissa' }, { t: 'Todas 2022', n: true }, { t: 'Todas 2026', n: true }, { t: 'Mesmas placas 2022', n: true }, { t: 'Mesmas placas 2026', n: true }, { t: 'Saíram (2022)', n: true }, { t: 'Entraram (2026)', n: true }, { t: 'Leitura' }],
    rows: L.map(([n, k, f]) => { const x = D[k], mesmas = x.mesmas_para - x.mesmas_de, troca = (x.para - x.de) - mesmas; const le = Math.abs(mesmas) > Math.abs(troca) ? 'mesma placa mudou' : 'troca de frota'; return [n, f(x.de), f(x.para), f(x.mesmas_de), f(x.mesmas_para), f(x.saiu), f(x.entrou), le]; }) })}
  ${concBlocos([
    { t: 'Manutenção', v: f2(D.manut.de) + ' → ' + f2(D.manut.para), s: `a mesma placa ficou parada (${f2(D.manut.mesmas_de)} → ${f2(D.manut.mesmas_para)}); as que saíram pagavam R$ ${f2(D.manut.saiu)}/km (tabela por idade, ${f0(D.vida.saiu)} meses) e as que entraram R$ ${f2(D.manut.entrou)} (BID novo, ${f0(D.carencia_entrou_pct)}% em carência). A queda é 100% troca de frota.` },
    { t: 'Km/L', v: f2(D.kml.de) + ' → ' + f2(D.kml.para), s: `dois efeitos: a mesma placa subiu ${f2(D.kml.mesmas_de)} → ${f2(D.kml.mesmas_para)} (revisão do validado) e as que saíram faziam ${f2(D.kml.saiu)} contra ${f2(D.kml.entrou)} das que entraram.` },
    { t: 'Fixo', v: 'R$ ' + f0(D.fixo.de) + ' → ' + f0(D.fixo.para), s: `as mesmas placas CAÍRAM de R$ ${f0(D.fixo.mesmas_de)} para R$ ${f0(D.fixo.mesmas_para)} (parcelas acabaram, viraram quitadas); as que entraram chegam a R$ ${f0(D.fixo.entrou)} (compra R$ ${K(D.compra.entrou)} mil a ${f1(H2.taxa_finame['2026'])}% a.a.).` },
    { t: 'Combustível e pneu', v: 'mesma placa', s: `combustível caiu na mesma placa (${f2(D.comb.mesmas_de)} → ${f2(D.comb.mesmas_para)}, Km/L revisado); pneu subiu na mesma placa (${f2(D.pneu.mesmas_de)} → ${f2(D.pneu.mesmas_para)}, preço de tabela do 275).` },
  ])}`);
}
// coorte de idade e modelo
{
  const CO = H2.coorte, fx = ['0–12', '13–36', '37–60', '61–84', '85+'], MO = H2.modelos, KM = H2.kml_modelo, MM = H2.manut_modelo;
  const top26 = Object.entries(MO['2026']).slice(0, 5), top22 = Object.entries(MO['2022']).slice(0, 5);
  slide(`${head('Idade e modelo', 'A frota de 2026 é mais velha na mediana e mais nova nas pontas: 60 placas de até um ano e 158 de 3 a 5 anos', 'Placas ativas da Rota · coorte = vida em meses · manutenção R$/km (fora da carência) e Km/L = mediana da coorte · modelo = os cinco mais frequentes')}
  <div class="duas">
    ${tabela({ classe: 'compacta', cols: [{ t: 'Coorte (meses)' }, { t: 'Placas 22', n: true }, { t: 'Placas 26', n: true }, { t: 'Manut. 22', n: true }, { t: 'Manut. 26', n: true }, { t: 'Km/L 22', n: true }, { t: 'Km/L 26', n: true }, { t: 'Fixo 26', n: true }],
      rows: fx.map(f => [f, f0(CO['2022'][f].placas), f0(CO['2026'][f].placas), f2(CO['2022'][f].manut), f2(CO['2026'][f].manut), f2(CO['2022'][f].kml), f2(CO['2026'][f].kml), 'R$ ' + f0(CO['2026'][f].fixo)]) })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'Modelo' }, { t: 'Placas 22', n: true }, { t: 'Placas 26', n: true }, { t: 'Km/L 22', n: true }, { t: 'Km/L 26', n: true }, { t: 'Manut. 22', n: true }, { t: 'Manut. 26', n: true }],
      rows: [...new Set([...top22.map(x => x[0]), ...top26.map(x => x[0])])].slice(0, 8).map(m => [m, f0(MO['2022'][m] || 0), f0(MO['2026'][m] || 0), KM['2022'][m] == null ? '—' : f2(KM['2022'][m]), KM['2026'][m] == null ? '—' : f2(KM['2026'][m]), MM['2022'][m] == null ? '—' : f2(MM['2022'][m]), MM['2026'][m] == null || isNaN(MM['2026'][m]) ? '—' : f2(MM['2026'][m])]) })}
  </div>
  ${concBlocos([
    { t: 'Velhas saíram', v: f0(CO['2022']['85+'].placas) + ' → ' + f0(CO['2026']['85+'].placas) + ' placas com 85+ meses', s: `pagavam R$ ${f2(CO['2022']['85+'].manut)}/km em 2022; as que ficaram pagam R$ ${f2(CO['2026']['85+'].manut)} e fazem ${f2(CO['2026']['85+'].kml)} km/L (as piores saíram).` },
    { t: 'Novas em carência', v: f0(CO['2026']['0–12'].placas) + ' placas', s: `manutenção paga R$ ${f2(CO['2026']['0–12'].manut)}/km e fixo de R$ ${f0(CO['2026']['0–12'].fixo)}/mês: é onde o fixo sobe e o variável cai ao mesmo tempo.` },
    { t: 'Modelo', v: '1719/1718 → 13.180 e 26.260', s: `o 1719 (${f0(MO['2022']['1719'])} placas em 2022, Km/L ${f2(KM['2022']['1719'])}) deu lugar ao 13.180 (${f2(KM['2026']['13180'])} km/L) e ao Constellation 26.260 (${f2(KM['2026']['Constellation 26.260'] || KM['2026']['26260'])} km/L, truck): o mix explica parte do Km/L e do R$/km.` },
    { t: 'Então', v: 'premissa segue a frota', s: 'o FT paga o caminhão cadastrado: renovar baixa a manutenção paga (carência e BID) e sobe o fixo (parcela). Nenhum dos dois é revisão de regra.' },
  ])}`);
}

// ═══ Parte 4 · Resultado ═══
capaSec(4, 'Resultado', 'Pago pelo FT × remunerado DRE × realizado, ano a ano; a manutenção; o pneu.');
{
  const d = a => tot(a, 'real') - tot(a, 'ft'), best = AA.slice().sort((a, b) => d(a) - d(b))[0], m = a => Y[a].peca.manut, c = a => Y[a].peca.comb, an26 = d('2026') / N26 * 12;
  slide(`${head('Resultado de frota por ano', `O custo ficou acima do pago em todos os anos: R$ ${M(d('2023'))} mi em 2023, R$ ${M(d('2024'))} mi em 2024, R$ ${M(d('2025'))} mi em 2025 e R$ ${M(d('2026'))} mi em ${N26} meses de 2026`, 'R$ mi · as sete contas de frota do T2 · pago FT = R$/km × km dos mapas rodados (Dispersão, desde 2023) + lavagem, IPVA e seguro · vermelho = custou acima do pago')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'R$ mi' }, ...AA.flatMap(a => [{ t: lab(a) + ' FT', n: true }, { t: 'rem.', n: true }, { t: 'real', n: true }])],
    rows: [...C7.map(c => [NM[c], ...AA.flatMap(a => { const x = Y[a].peca[c]; return [M(x.ft), M(x.rem), { v: M(x.real), style: x.real > x.ft * 1.05 ? red(1) : '' }]; })]), { c: ['<b>Total</b>', ...AA.flatMap(a => [{ v: '<b>' + M(tot(a, 'ft')) + '</b>' }, { v: '<b>' + M(tot(a, 'rem')) + '</b>' }, { v: '<b>' + M(tot(a, 'real')) + '</b>', style: red(1) }])], cls: 'sep' }, ['Realizado − pago FT', ...AA.flatMap(a => ['', '', { v: sM(d(a)), style: red(d(a)) }])], ['Remunerado DRE − pago FT', ...AA.flatMap(a => ['', '', { v: sM(tot(a, 'rem') - tot(a, 'ft')) }])]] })}
  ${concBlocos([
    { t: 'Todo ano', v: 'acima do pago', s: `o melhor foi ${lab(best)} (${f0((tot(best, 'real') / tot(best, 'ft') - 1) * 100)}% acima); 2026 anualizado dá R$ ${M(an26)} mi, o pior.` },
    { t: 'Manutenção', v: f1(m('2024').real / m('2024').ft) + '× → ' + f1(m('2026').real / m('2026').ft) + '× o pago', s: `o R$/km pago caiu (R$ ${f2(PR['2024'].manut)} → ${f2(PR['2026'].manut)}) pela troca de frota e a oficina da frota que ficou não caiu junto.` },
    { t: 'Combustível', v: f0((Math.min(...AA.map(a => c(a).real / c(a).ft)) - 1) * 100) + '% a ' + f0((Math.max(...AA.map(a => c(a).real / c(a).ft)) - 1) * 100) + '% acima', s: 'estável: km além do pago e consumo acima do Km/L remunerado, todo ano.' },
    { t: 'Remunerado DRE', v: 'entre os dois', s: `o remunerado da DRE fica acima do pago reconstruído em todos os anos (${AA.map(a => `${sM(tot(a, 'rem') - tot(a, 'ft'))} mi em ${lab(a)}`).join(', ')}) e ainda assim abaixo do realizado. A diferença para o pago fica em aberto (imposto ou composição) até os relatórios oficiais.` },
  ])}`);
}
// manutenção ao longo do tempo
{
  const m = a => Y[a].peca.manut, fa = a => Y[a].t2_frota.ativos_mes, D = H2.decomp;
  slide(`${head('Manutenção', `O R$/km pago caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% em cinco anos e o custo por caminhão foi na direção contrária`, 'R$ mi por ano · R$/km = mediana das placas ativas · placas em carência = distintas no ano · custo por caminhão ativo = realizado ÷ ativos por mês ÷ 12')}
  <div class="duas">
    ${hbars({ w: 540, lw: 70, lh: 36, linhas: AA.map(a => ({ rot: lab(a), ft: m(a).ft, rem: m(a).rem, real: m(a).real })), series: [{ k: 'ft', rot: 'Pago FT', cor: INK }, { k: 'rem', rot: 'Remunerado DRE', cor: AZUL }, { k: 'real', rot: 'Realizado', cor: ACC }], fmt: v => 'R$ ' + M(v) + ' mi' })}
    ${tabela({ classe: 'compacta', cols: [{ t: 'Rota' }, ...A.map(a => ({ t: lab(a), n: true }))], rows: [
      ['R$/km pago (mediana)', ...A.map(a => f2(PR[a].manut))], ['Placas em carência (zero)', ...A.map(a => f0(PR[a].carencia_pl))], ['Placas ativas no ano (distintas)', ...A.map(a => f0(PR[a].placas))],
      ['Custo por caminhão ativo, R$ mil/ano', ...A.map(a => m(a).ft ? K(m(a).real / fa(a) / (a === '2026' ? N26 : 12) * 12) : '—')], ['Realizado ÷ pago FT', ...A.map(a => m(a).ft ? f1(m(a).real / m(a).ft) + '×' : '—')]] })}
  </div>
  ${concBlocos([
    { t: 'Por quê o pago caiu', v: 'troca de frota', s: `de 2022 a 2026 a mesma placa ficou em R$ ${f2(D['2022-2026'].manut.mesmas_de)} → ${f2(D['2022-2026'].manut.mesmas_para)}/km; saíram placas a R$ ${f2(D['2022-2026'].manut.saiu)} e entraram a R$ ${f2(D['2022-2026'].manut.entrou)}.` },
    { t: 'Por quê o custo subiu', v: 'R$ ' + K(m('2023').real / fa('2023')) + ' → ' + K(m('2026').real / fa('2026') / N26 * 12) + ' mil/caminhão', s: 'a frota que ficou envelheceu (vida 42 → 50 meses) e a oficina das placas novas não é zero (Rondonópolis).' },
    { t: 'O contrato', v: 'VW R$ ' + f2(Y['2026'].vw.rk_vw) + ' × FT ' + f2(Y['2026'].vw.rk_ft) + '/km', s: `em 2025 a fatura VW ficou R$ ${K(Y['2025'].vw.fatura - Y['2025'].vw.ft)} mil acima do pago; em ${N26} meses de 2026, R$ ${K(Y['2026'].vw.fatura - Y['2026'].vw.ft)} mil.` },
    { t: 'Resultado', v: 'R$ ' + M(m('2026').real - m('2026').ft) + ' mi em ' + N26 + ' meses', s: `contra R$ ${M(m('2024').real - m('2024').ft)} mi em 2024 inteiro: a manutenção virou a maior fonte de déficit da frota.` },
  ])}`);
}
// pneu
{
  const PN = H2.pneu, p275 = a => (Y[a].pneu || {})['275'] || {};
  slide(`${head('Pneu', `O preço de tabela do 275 no FT subiu ${f0((PN['2023'].preco_275 / PN['2022'].preco_275 - 1) * 100)}% em 2023 e recuou; compramos abaixo da tabela em todos os anos`, 'Placas ativas da Rota · medida dominante e preço de tabela do FT (mediana) · R$/km = Pneu por KM · realizado = pneus novos + recapagens na DRE')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Por ano' }, ...A.map(a => ({ t: lab(a), n: true })), { t: '2026 (2022 = 100)', n: true }], rows: [
    ['Placas com 275 / 235 / 215', ...A.map(a => Object.entries(PN[a].medidas).map(([m, n]) => n).join(' / ')), '—'],
    ['Preço de tabela do 275, R$', ...A.map(a => f0(PN[a].preco_275)), f0(PN['2026'].preco_275 / PN['2022'].preco_275 * 100)],
    ['Recapagem, R$', ...A.map(a => f0(PN[a].recap)), f0(PN['2026'].recap / PN['2022'].recap * 100)],
    ['Vida, km', ...A.map(a => f0(PN[a].vida)), f0(PN['2026'].vida / PN['2022'].vida * 100)],
    ['R$/km pago (mediana)', ...A.map(a => f2(PN[a].rk)), f0(PN['2026'].rk / PN['2022'].rk * 100)],
    ['IPCA acumulado', ...A.map(a => f0(idx('ipca', a))), f0(idx('ipca', '2026'))],
    { c: ['Pago FT, R$ mi', ...A.map(a => Y[a].peca.pneu.ft ? M(Y[a].peca.pneu.ft) : '—'), ''], cls: 'sep' }, ['Remunerado DRE, R$ mi', ...A.map(a => M(Y[a].peca.pneu.rem)), ''], ['Realizado, R$ mi', ...A.map(a => ({ v: M(Y[a].peca.pneu.real), style: Y[a].peca.pneu.ft && Y[a].peca.pneu.real > Y[a].peca.pneu.ft ? red(1) : '' })), ''],
  ] })}
  ${concBlocos([
    { t: 'Preço de tabela', v: 'R$ ' + f0(PN['2022'].preco_275) + ' → ' + f0(PN['2026'].preco_275), s: `+${f0((PN['2026'].preco_275 / PN['2022'].preco_275 - 1) * 100)}% em quatro anos, acima do IPA-M; o pico foi 2023 (R$ ${f0(PN['2023'].preco_275)}).` },
    { t: 'Nossa compra', v: 'abaixo da tabela', s: `o 275 sai a R$ ${f0(p275('2026').compra_med)} contra R$ ${f0(p275('2026').tracao)}: a sobra de pneu (${AA.map(a => `R$ ${M(Y[a].peca.pneu.ft - Y[a].peca.pneu.real)} mi em ${lab(a)}`).join(', ')}) é preço de compra.` },
    { t: 'Remunerado DRE', v: 'acima do pago', s: `${AA.map(a => `${sM(Y[a].peca.pneu.rem - Y[a].peca.pneu.ft)} mi em ${lab(a)}`).join(', ')}: diferença em aberto, a conferir com os relatórios oficiais do FT.` },
    { t: 'Vida', v: f0(PN['2026'].vida) + ' km · 2 recapagens', s: 'a premissa não mudou em cinco anos; pneu descartado antes disso come a sobra.' },
  ])}`);
}

// ═══ Parte 5 · T1 ═══
capaSec(5, 'Empurrada (T1)', 'O R$/km de frota do trecho ano a ano, e o Km/L do trecho que o explica.');
{
  const us = ['PIR', 'CBA', 'MCC'], FR = ['diesel', 'manut_cav', 'manut_carr', 'pneu', 'lav', 'pedagio', 'seguro'], tt = (u, a) => (Y[a].t1_trecho || {})['EMPURRADA|' + u];
  const fr = (u, a) => { const t = tt(u, a); return t ? FR.reduce((s, k) => s + (t[k] || 0), 0) : null; };
  const anosU = u => A.filter(a => tt(u, a));
  const p = H.t1.PIR, a0 = Object.keys(p)[0];
  slide(`${head('T1 · R$/km de frota do trecho', `Em Piraí o diesel do trecho foi de R$ ${f2(p[a0].diesel)} para R$ ${f2(p['2026'].diesel)}/km porque o Km/L do trecho caiu de ${f2(p[a0].kml)} para ${f2(p['2026'].kml)}`, 'Média ponderada pela previsão de km dos trechos ativos · só as peças de frota (salário variável e lucro variável são equipe e margem) · diesel = preço com crédito ÷ Km/L do trecho')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'R$/km do trecho' }, ...us.flatMap(u => anosU(u).map(a => ({ t: NOME[u].slice(0, 3) + ' ' + lab(a).slice(2), n: true })))],
    rows: [['Diesel', ...us.flatMap(u => anosU(u).map(a => f2(tt(u, a).diesel)))], ['Manutenção do cavalo', ...us.flatMap(u => anosU(u).map(a => f2(tt(u, a).manut_cav)))], ['Manutenção da carreta', ...us.flatMap(u => anosU(u).map(a => f2(tt(u, a).manut_carr)))], ['Pneu', ...us.flatMap(u => anosU(u).map(a => f2(tt(u, a).pneu)))], ['Lavagem e pedágio', ...us.flatMap(u => anosU(u).map(a => f2((tt(u, a).lav || 0) + (tt(u, a).pedagio || 0))))],
      { c: ['<b>R$/km de frota</b>', ...us.flatMap(u => anosU(u).map(a => ({ v: '<b>' + f2(fr(u, a)) + '</b>' })))], cls: 'sep' }, ['Km/L do trecho', ...us.flatMap(u => anosU(u).map(a => f2(tt(u, a).kml)))], ['Trechos ativos', ...us.flatMap(u => anosU(u).map(a => f0(tt(u, a).trechos)))]] })}
  <p class="note">Colunas: Pir = Piraí, Cui = Cuiabá, Mac = Macacu; o número é o ano (26 = jan a ${FIM26}). Cuiabá e Macacu entram no FT em 2024.</p>
  ${concBlocos([
    { t: 'Diesel é o frete', v: f0(p['2026'].diesel / fr('PIR', '2026') * 100) + '% em Piraí', s: `o Km/L do trecho caiu ${f0((1 - p['2026'].kml / p[a0].kml) * 100)}%: a frota nova (Actros 2651) tem Km/L remunerado menor que a antiga, e o FT paga mais litros por km.` },
    { t: 'Manutenção', v: 'R$ ' + f2(p['2025'].manut) + ' → ' + f2(p['2026'].manut) + '/km', s: 'carência da renovação (~50% dos cavalos de nov/25 a mai/26); volta a ~R$ 0,22/km quando ela acaba, e o frete de 2027 cai por aí.' },
    { t: 'Cuiabá e Macacu', v: 'R$ ' + f2(fr('CBA', '2026')) + ' e ' + f2(fr('MCC', '2026')) + '/km', s: 'mesmo desenho em 2026: diesel 79% a 84% do R$/km de frota, Km/L do trecho de 1,99 a 2,07.' },
    { t: 'Resultado', v: 'Km/L real × do trecho', s: `um décimo abaixo do remunerado em Piraí custa ~${f0((p['2026'].kml / (p['2026'].kml - 0.1) - 1) * 100)}% a mais de diesel sem pagamento.` },
  ])}`);
}

// ═══ Parte 6 · Divergências ═══
capaSec(6, 'Divergências de remuneração', 'O que esteve fora da regra ou da base em cinco anos, com valor e confiança.');
{
  const Y25 = Y['2025'], cad = (Y25.cadastro_seguro || [])[0], F = O.fator;
  const D = [
    ['Diesel de Macacu lançado a R$ 1,85/L', '1ª ago/25, Rota e Empurrada; ANP R$ 6,16', `R$ ${K(O.preco.valor)} mil + ~R$ ${K(O.preco.emp.perda)} mil`, 'alta', 'conferir se a fatura da quinzena foi corrigida'],
    ['Crédito de imposto do diesel: Macacu abaixo de Piraí', `fator ${f2(F.ano.MCC['2024'])} (2024), ${f2(F.ano.MCC['2025'])} (2025), ${f2(F.ano.MCC['2026'])} (2026) contra ${f2(F.ano.PIR['2026'])} em Piraí`, `R$ ${K(F.impacto['MCC|2025'].imp)} mil (2025) · R$ ${K(F.impacto['MCC|2026'].imp)} mil (2026)`, 'baixa', 'fiscal confirma o crédito recuperado'],
    ['Crédito de imposto do diesel: Cuiabá caiu', `fator ${f2(F.ano.CBA['2025'])} → ${f2(F.ano.CBA['2026'])} em jan/26`, `R$ ${K(F.impacto['CBA|2026'].imp)} mil (2026)`, 'baixa', 'idem'],
    ['Contrato VW acima da manutenção paga', `${Y25.vw.placas} placas em 2025, ${Y['2026'].vw.placas} em 2026; fatura R$ ${f3(Y['2026'].vw.rk_vw)} × FT ${f3(Y['2026'].vw.rk_ft)}/km`, `R$ ${K(Y25.vw.fatura - Y25.vw.ft)} mil (2025) · R$ ${K(Y['2026'].vw.fatura - Y['2026'].vw.ft)} mil (2026)`, 'alta', 'cotar contrato × BID placa a placa'],
    ['Km/L: Q4/26 sem revisão, valores diferentes no mesmo modelo, ativas zeradas', `${O.kml.q3q4_iguais} placas com o Km/L do Q3; ${O.kml.comDif} de ${O.kml.grupos} grupos; ${O.kml.zeradas} zeradas`, `R$ ${K(O.kml.disp_rs)} mil + revisão`, 'alta', 'crítica do consumo por placa antes da 1ª quinzena'],
    ['Remunerado DRE acima do pago reconstruído', `manutenção e pneu, todos os anos (${AA.map(a => `${sM(tot(a, 'rem') - tot(a, 'ft'))} mi ${lab(a)}`).join(', ')})`, 'R$ ' + M(AA.reduce((s, a) => s + tot(a, 'rem') - tot(a, 'ft'), 0)) + ' mi acumulado', 'baixa', 'aguardar os relatórios oficiais; hipótese de imposto (lucro real × crédito presumido)'],
    cad ? ['Cadastro: carroceria de R$ 9,5 bi (Cuiabá)', `2ª nov/25; seguro de R$ ${K(cad.seguro)} mil na quinzena; não faturado`, 'R$ 0', 'cadastro', 'corrigido no cadastro; vale como prova de leitura placa a placa'] : null,
    ['Diesel comprado acima da ANP', `Rota, ano a ano: ${Object.entries(O.preco.acima_ano).map(([a, v]) => `${a} R$ ${K(v)} mil`).join(' · ')}`, 'R$ ' + K(Object.values(O.preco.acima_ano).reduce((s, v) => s + v, 0)) + ' mil (2022–25)', 'alta', 'posto com preço negociado'],
  ].filter(Boolean);
  slide(`${head('Divergências de remuneração, 2022 a 2026', 'As divergências pontuais são poucas; o que pesa é premissa, e as diferenças da DRE ficam em aberto', 'Confiança: alta = medido na base; baixa = depende de confirmação de terceiro (relatório oficial do FT, fiscal); cadastro = valor do cadastro')}
  ${tabela({ classe: 'compacta', cols: [{ t: 'Divergência' }, { t: 'Base', w: true }, { t: 'Valor', n: true }, { t: 'Confiança' }, { t: 'Próximo passo', w: true }], rows: D.map(r => [{ v: '<b>' + r[0] + '</b>' }, r[1], { v: '<b>' + r[2] + '</b>' }, tag(r[3]), r[4]]) })}
  ${concBlocos([
    { t: 'Pontuais', v: 'três', s: 'um preço de diesel fora da curva, um cadastro absurdo que não faturou, e o crédito do diesel que o fiscal confirma.' },
    { t: 'Premissa', v: 'manutenção e Km/L', s: `a manutenção paga caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% por km pela troca de frota; o Km/L parou de ser revisado em out/26.` },
    { t: 'Em aberto', v: 'remunerado DRE', s: 'fica acima do pago reconstruído todos os anos; pode ser imposto ou composição, e não é tratado como erro até os relatórios oficiais do FT.' },
  ])}`);
}

// ═══ fechamento ═══
{
  const d = a => tot(a, 'real') - tot(a, 'ft'), D = H2.decomp['2022-2026'];
  slide(`${head('Para levar', 'Cinco anos de FT: a receita cresceu por frota e km, o R$/km real caiu, o fixo subiu com a frota nova, e o custo ficou acima do pago todo ano', 'O que o histórico sustenta, com o número')}
  ${cartoes([
    { k: '1 · Receita', n: '+' + f0((Object.values(Y['2025'].receita).reduce((s, x) => s + x.real, 0) / Object.values(Y['2022'].receita).reduce((s, x) => s + x.real, 0) - 1) * 100) + '%', p: `2022 → 2025, por frota (+${f0((Y['2025'].t2_frota.ativos_mes / Y['2022'].t2_frota.ativos_mes - 1) * 100)}% de ativos) e km; o variável por km ficou parado em ~R$ 3,0.` },
    { k: '2 · Premissas × inflação', n: '−' + f0((1 - PR['2026'].var / (PR['2022'].var * (idx('ipca', '2026') || 100) / 100)) * 100) + '% real', p: `o variável por km perdeu para o IPCA; a manutenção paga caiu ${f0((1 - PR['2026'].manut / PR['2022'].manut) * 100)}% pela troca de frota (${D.saiu} placas saíram a R$ ${f2(D.manut.saiu)}, ${D.entrou} entraram a R$ ${f2(D.manut.entrou)}).`, acc: true },
    { k: '3 · Fixo', n: '+' + f0((PR['2026'].fixo / PR['2022'].fixo - 1) * 100) + '%', p: `caminhão +${f0((PR['2026'].compra / PR['2022'].compra - 1) * 100)}%, taxa ${f1(PR['2022'].taxa)}% → ${f1(PR['2026'].taxa)}%: o FT remunera a parcela. As parcelas das mesmas placas acabaram (R$ ${f0(D.fixo.mesmas_de)} → ${f0(D.fixo.mesmas_para)}).` },
    { k: '4 · Resultado', n: 'R$ ' + M(d('2026')) + ' mi em ' + N26 + ' meses', p: `acima do pago em todos os anos (2024 o melhor, R$ ${M(d('2024'))} mi); manutenção e combustível explicam; o remunerado DRE fica entre os dois.` },
  ])}
  ${concBlocos([
    { t: 'O que pedir', s: 'Revisão do Km/L do Q4 com a crítica por placa · regra da manutenção para placas fora da carência com oficina (garantia) · composição do remunerado da DRE e efeito do imposto, com os relatórios oficiais do FT · índice de reajuste do contrato (qual?) contra o IPCA.' },
    { t: 'O que planejar', s: 'Renovação pelo fim das parcelas (quitado recebe ~R$ 600/mês) · contratos de manutenção cotados contra o BID · consumo validado preparado a cada trimestre.' },
  ], 'Próximos passos', 2)}`);
}

console.log('ok', write(process.env.FT_HTML || 'historico.html'), 'slides');

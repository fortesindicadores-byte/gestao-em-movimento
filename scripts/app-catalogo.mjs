// Gera app/catalogo.js a partir do CLUSTERS do hub (index.html) e dos sub-hubs
// (combustivel/, combustivel/seara/, pneus/). O app do celular (/app/) lê esse
// arquivo; o hub continua sendo a fonte dos nomes, descrições, ícones e flags
// (adm/dono). Rodar de novo quando o hub ganhar ou perder card:
//   node scripts/app-catalogo.mjs
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const le = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const hub = le('index.html');
const m = hub.match(/const CLUSTERS = (\[[\s\S]*?\]);\n/);
if (!m) throw new Error('CLUSTERS não achado no index.html');
const CLUSTERS = eval(m[1]);

/* Como o app abre cada painel:
   resumo = abre por dentro e redesenha hero, cards, gráficos e tabelas no app;
   web    = o painel inteiro dentro do app (telas interativas, formulários, hub).
   rdz    = a função do painel que redesenha depois de trocar a vigência.
   vig    = o id do filtro de vigência (padrão ms-vig; '' = sem seletor). */
const OPC = {
  'scorecard/':              { modo: 'resumo', rdz: 'atualizar' },
  'diagnostico/':            { modo: 'resumo', rdz: 'atualizar' },
  'resumo-executivo/':       { modo: 'resumo', rdz: 'atualizar' },
  'ativos/':                 { modo: 'resumo', vig: '' },
  'gestao-a-vista/':         { modo: 'resumo', vig: '', gav: true },
  'correlacoes-operacao/':   { modo: 'resumo', vig: '' },
  'remuneracao/':            { modo: 'resumo', rdz: 'atualizar' },
  'book-operador/':          { modo: 'web' },
  'visao-financeira/':       { modo: 'resumo', rdz: 'atualizar' },
  'painel-km/':              { modo: 'resumo', rdz: 'atualizar' },
  'rs-por-km/':              { modo: 'resumo', rdz: 'atualizar' },
  'arvore-frota/':           { modo: 'resumo', rdz: 'atualizar' },
  'carta-custos/':           { modo: 'resumo', rdz: 'atualizar' },
  'eficiencia-ativacao/':    { modo: 'resumo', rdz: 'atualizar' },
  'termometro/':             { modo: 'resumo', rdz: 'atualizar' },
  'manutencao/':             { modo: 'resumo', rdz: 'atualizar' },
  'preventivas-seara/':      { modo: 'web' },
  'catalogo/':               { modo: 'web' },
  'catalogo-pecas/':         { modo: 'web' },
  'relatorios/':             { modo: 'web' },
  'gerot/':                  { modo: 'resumo', rdz: 'atualizar' },
  'fca-preenchimento/':      { modo: 'web' },
  'disponibilidade-preenchimento/': { modo: 'web' },
  'mpr/':                    { modo: 'web' },
  'planner-corporativo/':    { modo: 'web' },
  'compra-pneus/':           { modo: 'web' },
  'programa-reconhecimento/':{ modo: 'resumo', vig: 'elite' },
  'fca-gerencial/':          { modo: 'resumo', rdz: 'atualizar' },
  'painel-metas/':           { modo: 'resumo', rdz: 'atualizar' },
  'auditorias/':             { modo: 'resumo', vig: '' },
  'governanca/':             { modo: 'web' },
  'papeis-responsabilidades/': { modo: 'web' },
  'acessos/':                { modo: 'resumo', vig: 'ms-mes', rdz: 'atualizar' },
  'conferencia-locacao/':    { modo: 'web' },
  'parametros-seara/':       { modo: 'resumo', vig: '' },
  'anomalias-combustivel/':  { modo: 'resumo', rdz: 'atualizar' },
  'saude/':                  { modo: 'resumo', vig: '' },
  'check-metas/':            { modo: 'web' },
  'correlacoes/':            { modo: 'resumo', vig: '' },
  'assistente/':             { modo: 'web' },
  'fca-automatico/':         { modo: 'web' },
  'combustivel/arvore-combustivel/': { modo: 'resumo', rdz: 'onFilterChange' },
  'combustivel/eficiencia-kml/':     { modo: 'resumo', rdz: 'atualizar' },
  'combustivel/preco-litro/':        { modo: 'resumo', rdz: 'atualizar' },
  'combustivel/co2/':                { modo: 'resumo', rdz: 'atualizar' },
  'combustivel/postos/':             { modo: 'resumo', rdz: 'atualizar', adm: true },
  'combustivel/conducao-economica/': { modo: 'resumo', rdz: 'atualizar', adm: true },
  'combustivel/seara/arvore/':       { modo: 'resumo', rdz: 'onFilterChange' },
  'combustivel/seara/eficiencia/':   { modo: 'resumo', rdz: 'atualizar' },
  'combustivel/seara/preco-litro/':  { modo: 'resumo', rdz: 'atualizar' },
  'combustivel/seara/remunerado/':   { modo: 'web', adm: true },
  'pneus/descarte.html':             { modo: 'resumo', vig: '' },
};
// os painéis de pneus: um arquivo só, ?page= escolhe o painel
const PNEUS = [
  ['saude', 'Saúde dos Pneus', 'Pontuação 0–100 da frota: milimetragem, vida, recapes, amplitude e calibragem.'],
  ['painel', 'Aderência às Aferições', 'Aferições: evolução mensal e faróis de milimetragem e calibragem por veículo.'],
  ['milimetragem', 'Milimetragem', 'Status dos sulcos: bloquear, recapar, regular e bom estado.'],
  ['pressao', 'Pressão', 'Calibragem: desvios da pressão ideal e distribuição por faixa.'],
  ['cpk', 'CPK — Custo por Km', 'CPK médio, evolução mensal e ranking por marca, modelo e banda.'],
  ['previsao', 'Previsão de Troca', 'Quando cada pneu chega ao ponto de recape pela taxa de desgaste real.'],
  ['desgaste', 'Desgaste — mm/1.000km', 'Velocidade de desgaste: média da frota e ranking por unidade, marca e modelo.'],
  ['orcamento', 'Previsão Orçamentária', 'Orçamento mês a mês de recape e compra de pneus novos.'],
  ['eixos', 'Visão de Eixos', 'Diagrama por veículo com vida, banda, DOT, milimetragem e calibragem de cada pneu.'],
];

const ICO_PADRAO = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16V11M12 16V8M16 16v-3"/></svg>';
// ícone do card do sub-hub (lido do HTML do sub-hub, pelo href)
function icoSub(arq, href) {
  const s = le(arq);
  const i = s.indexOf('href="' + href + '"');
  if (i < 0) return ICO_PADRAO;
  const trecho = s.slice(i, i + 3000);
  const sv = trecho.match(/<svg[\s\S]*?<\/svg>/);
  return sv ? sv[0].replace(/\s+width="[^"]*"|\s+height="[^"]*"/g, '') : ICO_PADRAO;
}

const out = [];
const vistos = new Set();
function add(cl, t, d, h, ico, flags) {
  if (!h || vistos.has(h)) return;
  vistos.add(h);
  const o = OPC[h] || { modo: 'web' };
  out.push({ id: h.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), nome: t, desc: d, href: h, cluster: cl,
    adm: !!(flags.adm || o.adm), dono: !!flags.dono, modo: o.modo, rdz: o.rdz || '', vig: o.vig === undefined ? 'ms-vig' : o.vig,
    gav: !!o.gav, ico: ico || ICO_PADRAO });
}
for (const c of CLUSTERS) {
  const cl = c.nome;
  for (const k of c.cards) {
    if (k.soon) continue;
    const flags = { adm: c.adm || k.adm, dono: k.dono };
    if (k.h === 'combustivel/') {
      const sub = [
        ['combustivel/arvore-combustivel/', 'Árvore de Combustível', 'Custo de combustível decomposto — R$/km, R$/L e Km/L por unidade e projeto.'],
        ['combustivel/eficiencia-kml/', 'Eficiência Km/L', 'Km/L realizado vs remunerado, impacto financeiro e ranking por veículo.'],
        ['combustivel/preco-litro/', 'Preço R$/L', 'R$/L realizado vs remunerado, impacto financeiro e ranking por veículo.'],
        ['combustivel/co2/', 'Emissões CO²', 'Ton CO² realizada vs remunerada, impacto em árvores e logística verde.'],
        ['combustivel/postos/', 'Integração Abastecimentos', 'Valor, litros, R$/L e Km/L dos abastecimentos das APIs Pró-Frotas, SUMA e Gasola.'],
        ['combustivel/conducao-economica/', 'Condução Econômica', 'DriverPro — ranking de motoristas por faixa de RPM, aceleração e marcha lenta.'],
      ];
      for (const [h, t, d] of sub) add('Combustível', t, d, h, icoSub('combustivel/index.html', h.replace('combustivel/', '')), flags);
      const seara = [
        ['combustivel/seara/arvore/', 'Árvore de Combustível · Seara', 'Custo de combustível da Seara — R$/km, R$/L e Km/L (rem × real).'],
        ['combustivel/seara/eficiencia/', 'Eficiência Km/L · Seara', 'Km/L realizado vs remunerado da Seara, impacto por modelo e por placa.'],
        ['combustivel/seara/preco-litro/', 'Preço R$/L · Seara', 'R$/L realizado vs remunerado da Seara, impacto por modelo e por placa.'],
        ['combustivel/seara/remunerado/', 'Remuneração por placa · Seara', 'Sobe as planilhas VariavelDeFrete_PorPlaca para o banco.'],
      ];
      for (const [h, t, d] of seara) add('Combustível', t, d, h, icoSub('combustivel/seara/index.html', h.replace('combustivel/seara/', '')), flags);
      continue;
    }
    if (k.h === 'pneus/') {
      for (const [p, t, d] of PNEUS) add('Pneus', t, d, 'pneus/painel.html?page=' + p, icoSub('pneus/index.html', 'painel.html?page=' + p), flags);
      add('Pneus', 'Descarte de Pneus', '% de descarte sobre o acervo, motivos e ranking por unidade.', 'pneus/descarte.html', icoSub('pneus/index.html', 'descarte.html'), flags);
      continue;
    }
    if (!k.h) continue;   // Gerenciar Acessos / Bases do Sheets são funções do hub
    add(cl, k.t, (k.d || '').replace(/&amp;/g, '&'), k.h, (k.ico || '').replace(/\s+width="[^"]*"|\s+height="[^"]*"/g, ''), flags);
  }
}
// trata o modo dos pneus (todos da casca → resumo, sem vigência)
for (const p of out) if (p.href.startsWith('pneus/painel.html')) { p.modo = 'resumo'; p.vig = ''; }

const ORDEM = ['Visão Geral', 'Financeiro', 'Operacional', 'Combustível', 'Pneus', 'Processos', 'Resultados', 'Planejamento Estratégico', 'Administração'];
out.sort((a, b) => ORDEM.indexOf(a.cluster) - ORDEM.indexOf(b.cluster));

const js = '// GERADO por scripts/app-catalogo.mjs a partir do CLUSTERS do hub — não editar à mão.\n' +
  '// ' + out.length + ' painéis em ' + new Set(out.map(p => p.cluster)).size + ' grupos. Regerar quando o hub mudar.\n' +
  'window.GEM_CATALOGO = ' + JSON.stringify({ ordem: ORDEM, paineis: out }, null, 1) + ';\n';
fs.writeFileSync(path.join(RAIZ, 'app/catalogo.js'), js);
console.log('app/catalogo.js: ' + out.length + ' painéis');
for (const p of out) console.log('  ' + p.cluster.padEnd(14) + p.modo.padEnd(7) + (p.adm ? 'adm ' : '    ') + p.href + '  ' + p.nome);

// ============================================================
// A lista e o catálogo em UM Excel (Renan, 18/09/2026: "Me mande a lista em
// excel aqui. Quais modelos que faltaram no catálogo? A lista também não
// contempla?")
//
// Quatro abas, e a 3ª é a que responde a pergunta dele:
//   Lista de Peças      — os 1.191 itens genéricos com NCM e o alerta da regra
//   Alertas NCM         — só os que pedem olhada do Fiscal
//   Modelos sem ficha   — os que a pesquisa não cobriu, com o PORQUÊ e se a
//                         LISTA tem item para aquela família (são coisas
//                         diferentes: a lista é de ITEM, sem modelo nenhum;
//                         o catálogo é que amarra item × modelo)
//   Cobertura por modelo — quantas fichas cada modelo tem e com que confiança
//
// Uso: node scripts/catalogo-excel.mjs [saída.xlsx]
// ============================================================
import fs from 'node:fs';
import XLSX from 'xlsx';

const OUT = process.argv[2] || 'Catalogo_e_Lista_de_Pecas.xlsx';
const itens = JSON.parse(fs.readFileSync('docs/catalogo/itens.json', 'utf8')).itens;
const apl = JSON.parse(fs.readFileSync('docs/catalogo/aplicacoes.json', 'utf8')).linhas;
const cad = JSON.parse(fs.readFileSync('docs/catalogo/pesquisa/modelos-cadastro.json', 'utf8'));
const notas = JSON.parse(fs.readFileSync('docs/catalogo/modelos-notas.json', 'utf8'));

const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── 1) a lista ──────────────────────────────────────────────────────────────
const abaLista = itens.map(i => ({
  'Nº': i.n, 'Família/Conjunto': i.familia, 'Peça': i.peca, 'Material': i.material || '',
  'NCM': i.ncm || '', 'Status NCM': i.status_ncm, 'Alerta (regra da Política/Parecer)': i.alerta || '',
}));

// ── 2) só o que o Fiscal precisa olhar ──────────────────────────────────────
const abaAlertas = abaLista.filter(l => l['Alerta (regra da Política/Parecer)']);

// ── 3) modelos sem ficha, e o que a LISTA tem para eles ─────────────────────
// A lista não tem dimensão de modelo: ela cobre FAMÍLIA de item. Então a
// pergunta "a lista também não contempla?" se responde procurando, por tipo de
// equipamento, se existe item que sirva — e dizendo quantos.
const FAMILIA_DO_TIPO = [
  [/EMPILHADEIRA/, /empilhadeira|garfo|corrente|rolete|bateria|hidraulic/],
  [/PALETEIRA|BALANCA/, /paleteira|transpalete|garfo|timao|roda de carga|balanca|celula de carga|indicador de peso|hidraulic/],
  [/ELEVACAO/, /macaco|talha|cavalete|elevacao|guincho|cilindro|kit de reparo/],
  [/SOPRADOR/, /soprador|sopro|escova de carvao/],
  [/LIMPEZA|VARREDEIRA/, /escova|rodo|disco|aspira|bateria/],
];
const itensDe = tipo => {
  const par = FAMILIA_DO_TIPO.find(([re]) => re.test(tipo));
  if (!par) return [];
  return itens.filter(i => par[1].test(nrm(i.peca)));
};
const todos = [...cad.mot.map(m => ({ ...m, mot: true })), ...cad.nao.map(m => ({ ...m, mot: false }))];
const comFicha = new Set(apl.map(l => l.modelo));
const semFicha = todos.filter(m => !comFicha.has(m.modelo)).sort((a, b) => b.n - a.n);

// "MACACO | MACACO", "VOLKSWAGEN | —", "BOSH | BOSH": o cadastro repete a marca
// ou não tem modelo nenhum. Não há o que pesquisar — é plaqueta, não busca.
const semModelo = m => {
  const [marca, modelo] = m.modelo.split(' | ');
  return nrm(marca) === nrm(modelo) || modelo === '—' || /^(macaco|cavalete)$/i.test(modelo.trim())
    || /^(macaco hidraulico|macaco hidropneumatico|macaco pneumatico|talha hidraulica|carrinho de caixa hidraulico)$/i.test(nrm(modelo));
};
const abaSem = semFicha.map(m => {
  const tipo = (m.tipos || []).join(' / ');
  const its = itensDe(tipo);
  return {
    'Marca | Modelo': m.modelo, 'Ativos': m.n, 'Tipo': tipo,
    'Por que não tem ficha': semModelo(m)
      ? 'O CADASTRO não tem modelo (repete a marca ou está vazio) — não há o que pesquisar: precisa da plaqueta do equipamento'
      : 'Modelo identificável, mas ficou fora da pesquisa (orçamento de busca da sessão)',
    'A LISTA tem item para esta família?': its.length ? `SIM — ${its.length} item(ns)` : 'NÃO',
    'Exemplos de item na lista': its.slice(0, 5).map(i => `${i.n} ${i.peca}`).join(' · '),
    'Nota de cadastro': notas[m.modelo] || '',
  };
});

// ── 4) cobertura por modelo ────────────────────────────────────────────────
const porModelo = new Map();
apl.forEach(l => {
  const a = porModelo.get(l.modelo) || { n: 0, conf: 0, inf: 0, nao: 0, na: 0 };
  a.n++; a[{ confirmado: 'conf', inferido: 'inf', nao_encontrado: 'nao', nao_aplica: 'na' }[l.status]]++;
  porModelo.set(l.modelo, a);
});
const abaCob = todos.sort((a, b) => b.n - a.n).map(m => {
  const c = porModelo.get(m.modelo) || { n: 0, conf: 0, inf: 0, nao: 0, na: 0 };
  const util = c.n - c.na;
  return {
    'Marca | Modelo': m.modelo, 'Ativos': m.n, 'Tipo': (m.tipos || []).join(' / '),
    'Anos': (m.anos || []).filter(Boolean).join(', '),
    'Fichas': c.n, 'Confirmadas': c.conf, 'Inferidas': c.inf, 'Não encontradas': c.nao, 'Não se aplica': c.na,
    '% confirmado': util ? Math.round(c.conf / util * 100) + '%' : '',
    'Nota de cadastro': notas[m.modelo] || '',
  };
});

const wb = XLSX.utils.book_new();
const add = (nome, dados, larguras) => {
  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = larguras.map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, nome);
};
add('Lista de Peças', abaLista, [6, 34, 60, 24, 13, 12, 90]);
add('Alertas NCM', abaAlertas, [6, 34, 60, 24, 13, 12, 110]);
add('Modelos sem ficha', abaSem, [38, 8, 34, 78, 26, 70, 70]);
add('Cobertura por modelo', abaCob, [38, 8, 30, 22, 8, 12, 11, 16, 14, 13, 70]);
XLSX.writeFile(wb, OUT);

console.log(`${OUT}`);
console.log(`  Lista de Peças ....... ${abaLista.length}`);
console.log(`  Alertas NCM .......... ${abaAlertas.length}`);
console.log(`  Modelos sem ficha .... ${abaSem.length} (${abaSem.reduce((s, m) => s + m.Ativos, 0)} ativos)`);
console.log(`     sem modelo no cadastro: ${abaSem.filter(m => /CADASTRO/.test(m['Por que não tem ficha'])).length}`);
console.log(`     com item na lista:      ${abaSem.filter(m => /^SIM/.test(m['A LISTA tem item para esta família?'])).length}`);
console.log(`  Cobertura por modelo . ${abaCob.length}`);

// ============================================================
// A LISTA de itens (cat_item) a partir da planilha da Frota
//
// Entrada: docs/catalogo/pesquisa/Lista_de_Pecas_e_Servicos.xlsx, aba
//          LISTA_PEÇAS_FINAL_IMPORTAR (n · Família/Conjunto · Peça · NCM).
// Saída:   docs/catalogo/itens.json
//
// O que este script FAZ com a Política v1.2 e o Parecer da Frota: aplica as
// regras como ALERTAS, não como correções. A NCM da lista é a que a Frota
// definiu; o script só marca onde uma regra pede que o Fiscal olhe:
//   · "Mudou o imposto, separa o item" (Parecer): óleo dito sintético em 2710
//     (base PAO/éster/PAG cai em 3403 — e óleo "sintético" de base Grupo III
//     continua 2710.19.32, então é conferência de base, não erro);
//   · filtro: ar do motor 8421.31.00 ≠ óleo/combustível 8421.23.00 ≠ cabine
//     8421.39.90 — nome e NCM têm de contar a mesma história;
//   · parafuso/porca/arruela de nylon/plástico: 3926.90, não 7318;
//   · porta de baú/carroceria: 8708.29 (3,25%), nunca 7610.10 (esquadria);
//   · unidade de medida: a Política pede uma só (LT/L/LITRO viram três
//     cadastros) — o nome não deve carregar unidade.
// A "diferença exclusiva de material" que a Seção 6 proíbe é exatamente o que
// muda o imposto nos três exemplos do Parecer; por isso o material fica numa
// coluna própria, para o Fiscal filtrar.
//
// Uso: node scripts/catalogo-itens.mjs
// ============================================================
import fs from 'node:fs';
import XLSX from 'xlsx';

const ARQ = 'docs/catalogo/pesquisa/Lista_de_Pecas_e_Servicos.xlsx';
const OUT = 'docs/catalogo/itens.json';
const wb = XLSX.readFile(ARQ);
const ws = wb.Sheets['LISTA_PEÇAS_FINAL_IMPORTAR'];
if (!ws) throw new Error('aba LISTA_PEÇAS_FINAL_IMPORTAR não existe');
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1).filter(r => r[0] != null && r[2]);

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ncmOk = (ncm, ...prefixos) => prefixos.some(p => String(ncm || '').replace(/\./g, '').startsWith(p.replace(/\./g, '')));

function alertaDe(peca, ncm, material) {
  const p = norm(peca), mat = norm(material), a = [];
  // óleo / lubrificante
  if (/^(oleo|lubrificante|graxa)/.test(p)) {
    if (/sintetic|pag\b|pao\b|ester/.test(p) && ncmOk(ncm, '2710'))
      a.push('óleo dito sintético em 2710.19: se a base for PAO/éster/PAG (não petróleo ≥70%) é 3403.19 (9,75%) — conferir a base na NF-e do fornecedor');
    if (/mineral/.test(p) && ncmOk(ncm, '3403'))
      a.push('óleo dito mineral em 3403: mineral com ≥70% de petróleo é 2710.19.32');
  }
  // filtros
  if (/^filtro/.test(p) && !/particula|dpf|secador|banho de oleo|hidraul|transmiss|respiro|glp|gas|arla|ureia/.test(p)) {
    if (/\bar\b/.test(p) && !/cabine|condicionado/.test(p) && !ncmOk(ncm, '8421.31'))
      a.push('filtro de ar do MOTOR é 8421.31.00 — a lista tem outra NCM');
    if (/cabine|condicionado/.test(p) && !ncmOk(ncm, '8421.39'))
      a.push('filtro de ar da CABINE é 8421.39.90 (0%), não a do filtro do motor');
    if (/(oleo|combust|separador|racor|diesel)/.test(p) && !ncmOk(ncm, '8421.23'))
      a.push('filtro de óleo/combustível é 8421.23.00 — a lista tem outra NCM');
  }
  // fixadores
  if (/^(parafuso|porca|arruela|rebite)/.test(p)) {
    if (/nylon|nailon|plastic|polim|poliam/.test(mat) && !ncmOk(ncm, '3926'))
      a.push('fixador de nylon/plástico é 3926.90 (9,75%), não 7318');
    if (/\b(aco|inox|ferro)\b/.test(mat) && !ncmOk(ncm, '7318'))
      a.push('fixador de aço é 7318 — a lista tem outra NCM');
    if (/latao|bronze|cobre/.test(mat) && !ncmOk(ncm, '7415'))
      a.push('fixador de latão/cobre é 7415 — a lista tem outra NCM');
    if (/aluminio/.test(mat) && !ncmOk(ncm, '7616'))
      a.push('fixador de alumínio é 7616.10 — a lista tem outra NCM');
  }
  // porta de baú / carroceria
  // porta de baú: no CAMINHÃO é parte de carroçaria (8708.29, 3,25%); no
  // SEMIRREBOQUE é parte de reboque (8716.90). O que NUNCA é: 7610.10, a
  // esquadria de edifício do relatório externo (Parecer da Frota).
  if (/\bporta\b/.test(p) && /bau|carroc|furgao|sider|roll/.test(p)) {
    if (ncmOk(ncm, '7610')) a.push('porta de baú em 7610.10 (esquadria de EDIFÍCIO, 0%): porta de carroçaria é 8708.29 (3,25%) — decisão da Controladoria pendente (Parecer)');
    else if (!ncmOk(ncm, '8708.29') && !ncmOk(ncm, '8716.90')) a.push('porta de baú/carroçaria: 8708.29 (sobre caminhão) ou 8716.90 (semirreboque) — conferir onde a peça vai');
  }
  // unidade de medida no nome
  if (/\b\d+\s?(l|lt|litro|litros|ml)\b/.test(p) && !/capacidade|≥|>=|ate /.test(p))
    a.push('nome carrega unidade de medida — a Política pede unidade única no cadastro, não no nome');
  if (!ncm) a.push('sem NCM');
  return a;
}

const itens = rows.map(r => {
  const peca = String(r[2]).trim();
  const m = peca.match(/^(.*?)\s+de\s+([^()]+?)\s*$/i);          // "Peça de Material"
  const ncm = r[3] == null ? null : String(r[3]).trim();
  const alertas = alertaDe(peca, ncm, m ? m[2] : '');
  return { n: Number(r[0]), familia: String(r[1] || '').trim(), peca, material: m ? m[2].trim() : null, ncm,
           alerta: alertas.length ? alertas.join(' | ') : null, status_ncm: alertas.length ? 'a_confirmar' : 'lista' };
});

fs.writeFileSync(OUT, JSON.stringify({ gerado_em: new Date().toISOString(), fonte: 'LISTA_PEÇAS_FINAL_IMPORTAR', itens }, null, 1));
const comAlerta = itens.filter(i => i.alerta);
console.log(`${OUT}: ${itens.length} item(ns) · ${comAlerta.length} com alerta de regra`);
const porRegra = {};
comAlerta.forEach(i => i.alerta.split(' | ').forEach(a => { const k = a.split(':')[0].slice(0, 60); porRegra[k] = (porRegra[k] || 0) + 1; }));
Object.entries(porRegra).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));

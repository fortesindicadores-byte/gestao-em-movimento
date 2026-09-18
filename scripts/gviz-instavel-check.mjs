// ============================================================
// A ABA DEVOLVE O MESMO DUAS VEZES SEGUIDAS? (18/09/2026)
//
// Nasceu do `term_wh_t2_acum`: a foto do gviz e a carga da tabela foram
// tiradas no MESMO minuto e ainda assim divergiram — gviz 29 colunas × banco
// 26, com Total Pontos 73 × 71. Minha primeira explicação (alguém editando a
// aba) morreu aí, então a pergunta passou a ser outra: a aba devolve a mesma
// coisa em duas leituras consecutivas?
//
// Aba montada por fórmula (IMPORTRANGE, QUERY, agregação) pode recalcular
// entre um pedido e o seguinte. Se for esse o caso, NENHUM comparador vai
// fechar, e o certo é saber disso em vez de caçar bug no nosso lado.
//
// Uso: GVIZ_SO=term_wh  GVIZ_VEZES=3  node scripts/gviz-instavel-check.mjs
// Sem GVIZ_SO, varre as bases que mais mudam de forma (term_*).
// Não grava nada. Roda no Actions — o sandbox não alcança o docs.google.
// ============================================================
import { createHash } from 'node:crypto';
import { BASES, baixa, mapaColunas } from './sheets-bases.mjs';

const SO = process.env.GVIZ_SO || 'term_';
const VEZES = Math.max(2, +(process.env.GVIZ_VEZES || 3));
const alvos = BASES.filter(b => SO.split(',').some(p => p.trim() && b.slug.startsWith(p.trim())));
if (!alvos.length) { console.error('nenhuma base casa com ' + SO); process.exit(1); }

console.log(`═══ a mesma aba, ${VEZES} leituras seguidas ═══\n`);
let instaveis = 0;
for (const b of alvos) {
  const leituras = [];
  for (let i = 0; i < VEZES; i++) {
    try {
      const { json } = await baixa(b);
      const mapa = mapaColunas(json.table.cols || []);
      const rows = json.table.rows || [];
      leituras.push({
        cols: mapa.length,
        labels: mapa.map(c => c.label).join(' | '),
        linhas: rows.length,
        hash: createHash('md5').update(JSON.stringify(json.table)).digest('hex').slice(0, 10),
        l1: JSON.stringify((rows[0] && rows[0].c || []).map(c => (c && c.v != null ? c.v : null))).slice(0, 160),
      });
    } catch (e) { leituras.push({ erro: e.message.slice(0, 120) }); }
    await new Promise(r => setTimeout(r, 1200));
  }
  const hs = [...new Set(leituras.map(l => l.hash || 'ERRO'))];
  const cs = [...new Set(leituras.map(l => l.cols))];
  const igual = hs.length === 1;
  if (!igual) instaveis++;
  console.log(`${igual ? 'ok ' : '✗  '} ${b.slug.padEnd(26)} ${leituras.map(l => l.erro ? 'ERRO' : `${l.linhas}l×${l.cols}c ${l.hash}`).join('  ·  ')}`);
  if (!igual) {
    if (cs.length > 1) console.log(`       o nº de COLUNAS muda entre leituras: ${cs.join(' → ')}`);
    leituras.forEach((l, i) => console.log(`       [${i + 1}] ${l.erro || l.l1}`));
    if (cs.length > 1) leituras.forEach((l, i) => console.log(`       [${i + 1}] rótulos: ${String(l.labels).slice(0, 220)}`));
  }
}
console.log(`\n${alvos.length - instaveis} estável(is) · ${instaveis} INSTÁVEL(is)`);
console.log(instaveis
  ? '→ aba que muda entre duas leituras não fecha em comparador nenhum: é a PLANILHA, não o nosso lado.'
  : '→ todas devolveram o mesmo conteúdo em leituras seguidas.');

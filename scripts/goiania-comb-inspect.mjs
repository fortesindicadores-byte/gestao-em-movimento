// ============================================================
// Goiânia na Árvore de Combustível — por que o R$/L remunerado sai 0,00
// (só leitura). Renan, 15/10/2026: "Tem preço na operação Goiânia, nossa
// nova operação. E tem consumo também. Pode olhar nas abas sheets."
//
// A Árvore casa a linha da aba Km/L (coluna Projeto, ex.: "ROTA - GNA") com a
// coluna "Unidade Benner" da aba R$/L, por vigência (e tipo de combustível).
// Este script imprime, das duas abas, o que se refere a Goiânia, para mostrar
// se o rótulo ou a vigência não casa. Também mostra as linhas da Frota e da
// Dispersão de km de Goiânia.
//
// Uso: node scripts/goiania-comb-inspect.mjs   (abas públicas, sem segredo)
// ============================================================
const VF_ID  = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';
const GV_ID  = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const ALVO = new RegExp(process.env.ALVO || 'GOI|GNA|GYN|ANAPOLIS|APARECIDA', 'i');

const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
const cell = c => !c ? '' : (c.f != null ? String(c.f) : (c.v == null ? '' : String(c.v)));
async function aba(id, nome) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?sheet=${encodeURIComponent(nome)}&tqx=out:json&headers=1`;
  const j = parse(await (await fetch(url)).text());
  if (j.status !== 'ok') throw new Error(`${nome}: ${JSON.stringify(j.errors || {})}`);
  return { cols: (j.table.cols || []).map(c => c.label || c.id || ''), rows: (j.table.rows || []).map(r => (r.c || []).map(cell)) };
}
const temAlvo = r => r.some(v => ALVO.test(v));
function mostra(rot, a, max = 40) {
  const hit = a.rows.filter(temAlvo);
  console.log(`\n══ ${rot}: ${a.rows.length} linhas, ${hit.length} com /${ALVO.source}/`);
  console.log('   colunas: ' + a.cols.map((c, i) => `${i}:${c}`).join(' | '));
  hit.slice(0, max).forEach(r => console.log('   ' + r.map((v, i) => v === '' ? null : `${i}=${v}`).filter(Boolean).join(' · ')));
  return hit;
}

const rl = await aba(KML_ID, 'R$/L');
const hRl = mostra('R$/L (KML_ID)', rl);
// rótulos distintos da coluna Unidade Benner, para comparar com a Km/L
const iUB = rl.cols.findIndex(c => /unidade benner/i.test(c));
console.log('\n   Unidade Benner (todas, distintas): ' + [...new Set(rl.rows.map(r => r[iUB]).filter(Boolean))].sort().join(' · '));
const iVig = rl.cols.findIndex(c => /vig/i.test(c));
console.log('   vigências da R$/L com Goiânia: ' + [...new Set(hRl.map(r => r[iVig]))].join(' · '));

const km = await aba(KML_ID, 'Km/L');
const hKm = mostra('Km/L (KML_ID)', km, 12);
const iProj = km.cols.findIndex(c => /^projeto$/i.test(String(c).trim()));
const proj = {}; hKm.forEach(r => { const k = (r[iProj] || r[14] || '?') + ' | ' + r[0]; proj[k] = (proj[k] || 0) + 1; });
console.log('   Projeto × vigência (Goiânia): ' + JSON.stringify(proj));

const fr = await aba(VF_ID, 'Frota');
const hFr = fr.rows.filter(temAlvo);
const n3 = {}; hFr.forEach(r => { const k = r[11] + ' | ' + r[10] + ' | ' + r[9]; n3[k] = (n3[k] || 0) + 1; });
console.log(`\n══ Frota (DRE): ${hFr.length} linhas de Goiânia · nível3 | unidade | vigência → linhas`);
Object.entries(n3).slice(0, 30).forEach(([k, v]) => console.log('   ' + k + ' → ' + v));

const dp = await aba(GV_ID, 'Dispersão de km');
mostra('Dispersão de km (GV_ID)', dp, 10);

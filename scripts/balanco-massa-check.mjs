// ============================================================
// BALANÇO DE MASSA → km remunerado das EMPURRADAS (Renan, 08/09/2026)
//
// A aba "Balanço de Massa" (workbook Base Dispersão de km) traz, por unidade
// empurrada e vigência, o VALOR em R$ de viagens que não emitiram CTE e foram
// cobradas depois. Esse valor precisa voltar ao km remunerado da Dispersão:
//   km recomposto = Valor ÷ R$/km dos VARIÁVEIS, com
//   R$/km variável = Σ remunerado (Manutenção de Veículos, Manutenção de
//     Carrocerias, Pneus Novos, Recapagens, Combustíveis) ÷ km remunerado
//     ORIGINAL da chave (vigência | projeto | unidade), na aba Frota do DRE.
//
// Este script reproduz a conta que o /painel-km/ e a Árvore de Combustível
// fazem, e imprime o ANTES × DEPOIS por unidade e vigência (mais um JSON no
// fim, que alimenta o PDF comparativo). Não grava nada.
// Uso: node scripts/balanco-massa-check.mjs   (abas públicas, sem segredo)
// ============================================================
const DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const COST_ID = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';

const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
async function sheet(id, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const j = parse(await (await fetch(url)).text());
  if (j.status !== 'ok') throw new Error(`${tab}: ${JSON.stringify(j.errors || j.status)}`);
  const cols = (j.table.cols || []).map(c => String((c && (c.label || c.id)) || '').trim());
  const rows = (j.table.rows || []).map(r => (r.c || []).map(c => c ? { v: c.v, f: c.f } : null));
  return { cols, rows };
}
const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
function vigDe(cell) {                       // → 'MM/AAAA'
  if (!cell || cell.v == null) return '';
  const s = String(cell.v);
  let m = s.match(/Date\((\d+),(\d+)/); if (m) return String(+m[2] + 1).padStart(2, '0') + '/' + m[1];
  const f = String(cell.f != null ? cell.f : s).trim().toLowerCase();
  m = f.match(/^(\d{1,2})\/(\d{4})$/); if (m) return m[1].padStart(2, '0') + '/' + m[2];
  m = f.match(/^([a-zç]{3})[a-zç]*\.?\s*\/\s*(\d{2,4})$/); if (m && MES[m[1]]) { let y = +m[2]; if (y < 100) y += 2000; return String(MES[m[1]]).padStart(2, '0') + '/' + y; }
  return '';
}
const NK = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const num = c => { const n = parseFloat(c && c.v); return isFinite(n) ? n : 0; };
const br = (v, d = 0) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

// TAXA = R$/km remunerado de TODAS as contas dos pacotes Combustíveis + Manutenções + Pneus
// (o mesmo R$/km do /painel-km/; Renan, 08/09/2026: "pode pegar de todas as contas")
const ALIAS = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'COMBUSTIVEIS', 'FLUIDOS (ARLA)': 'ARLA',
  'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'MANUTENCAO DE VEICULOS E EQUIP.', 'CONSERTOS E RECAPAGENS DE PNEUS': 'RECAPAGENS E OUTROS SERVICOS', 'PNEUS E CAMARAS': 'PNEUS NOVOS' };
const PAC = { 'COMBUSTIVEIS': 1, 'ARLA': 1, 'MANUTENCAO DE CARROCERIAS': 1, 'CONTRATOS DE MANUTENCAO FABRICANTE': 1, 'MATERIAIS E FERRAMENTAS DE OFICINA': 1,
  'PERSONALIZACAO/PADRONIZACAO': 1, 'LAVACAO DE VEICULOS': 1, 'MANUTENCAO DE VEICULOS E EQUIP.': 1, 'RECAPAGENS E OUTROS SERVICOS': 1, 'PNEUS NOVOS': 1 };
// "CUIABA EMPURRADA" → chave 'EMPURRADA|CBA'
const CIDADE = { CUIABA: 'CBA', PIRAI: 'PIR', MACACU: 'MCC', 'CACHOEIRAS DE MACACU': 'MCC', 'CAMPO GRANDE': 'CGR', 'RIO DE JANEIRO': 'CGR',
  PELOTAS: 'PLT', FLORIANOPOLIS: 'FLP', GUARULHOS: 'GRL', 'NOVA FRIBURGO': 'NFR', RONDONOPOLIS: 'RON', 'BALNEARIO CAMBORIU': 'BLC', CAMBORIU: 'BLC' };
function chaveBM(unidade) {
  const u = NK(unidade); const partes = u.split(' '); const proj = partes.pop(); const cid = partes.join(' ');
  const cod = CIDADE[cid] || CIDADE[partes[partes.length - 1]] || null;
  return cod ? `${proj}|${cod}` : null;
}

const [disp, frota, bm] = await Promise.all([sheet(DISP_ID, 'Dispersão de km'), sheet(COST_ID, 'Frota'), sheet(DISP_ID, 'Balanço de Massa')]);
console.log(`Dispersão de km: ${disp.rows.length} linha(s) · Frota: ${frota.rows.length} · Balanço de Massa: ${bm.rows.length}`);
console.log('Balanço de Massa · colunas:', JSON.stringify(bm.cols));

// Dispersão: col 0 vig · col 14 "PROJETO - COD" · col 31 km rem · col 32 km real (índices do /painel-km/)
const km0 = {}, kmReal = {};
disp.rows.forEach(r => { const vig = vigDe(r[0]); const n3 = String((r[14] && r[14].v) || ''); if (!vig || !n3.includes('-')) return;
  const [proj, cod] = n3.split('-').map(s => NK(s)); const k = `${vig}|${proj}|${cod}`;
  km0[k] = (km0[k] || 0) + num(r[31]); kmReal[k] = (kmReal[k] || 0) + num(r[32]); });

// Frota: por nome de coluna
const fi = (...t) => frota.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const K = { vig: fi('vigência', 'vigencia'), n3: fi('nível 3', 'nivel 3'), cta: fi('conta'), rem: fi('remunerado') };
const remPac = {};
frota.rows.forEach(r => { const vig = vigDe(r[K.vig]); const n3 = String((r[K.n3] && r[K.n3].v) || ''); if (!vig || !n3.includes('-')) return;
  const i = n3.indexOf('-'); const proj = NK(n3.slice(0, i)), cod = NK(n3.slice(i + 1)); const k = `${vig}|${proj}|${cod}`;
  const cta = NK(r[K.cta] && r[K.cta].v); const v = -num(r[K.rem]);   // custo na DRE vem negativo
  if (PAC[ALIAS[cta] || cta]) remPac[k] = (remPac[k] || 0) + v; });

// Balanço de Massa: Unidade | Vigência | Valor (por nome de coluna)
const bi = (...t) => bm.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
// VALOR 85% (Renan, 10/09/2026): a coluna "Valor 85%" é a que vira km — a "Valor" crua só se a de 85% não existir
const b85 = bm.cols.findIndex(c => /valor/i.test(c) && /85/.test(c));
const B = { uni: bi('unidade'), vig: bi('vig'), val: b85 >= 0 ? b85 : bi('valor') };
console.log(b85 >= 0 ? `Balanço de Massa · usando a coluna "${bm.cols[b85]}"` : '⚠ Balanço de Massa: coluna "Valor 85%" não encontrada — usando "Valor"');
console.log('Balanço de Massa · índices:', JSON.stringify(B));
const linhas = [];
bm.rows.forEach(r => { const vig = vigDe(r[B.vig]); const valor = num(r[B.val]); const uni = String((r[B.uni] && r[B.uni].v) || '');
  if (!vig || !uni) return;
  const kb = chaveBM(uni); if (!kb) { console.log(`  ⚠ unidade sem código: "${uni}"`); return; }
  const [proj, cod] = kb.split('|'); const k = `${vig}|${proj}|${cod}`;
  const k0 = km0[k] || 0, real = kmReal[k] || 0, rv = remPac[k] || 0;
  const taxaVar = k0 > 0 && rv > 0 ? rv / k0 : 0, taxaImp = taxaVar;
  const kmRec = taxaVar > 0 ? valor / taxaVar : 0;
  linhas.push({ uni, vig, proj, cod, valor, km0: k0, real, remVar: rv, taxaVar, kmRec, km1: k0 + kmRec, taxaImp,
    dAntes: real - k0, dDepois: real - (k0 + kmRec), impAntes: (real - k0) * taxaImp, impDepois: (real - k0 - kmRec) * taxaImp,
    semKm: k0 <= 0, semCusto: rv <= 0 }); });

const ym = v => v.slice(3) + v.slice(0, 2);
const ord = (a, b) => a.uni.localeCompare(b.uni) || ym(a.vig).localeCompare(ym(b.vig));
linhas.sort(ord);
console.log('\n── ANTES × DEPOIS por unidade e vigência (só linhas com Valor) ──');
console.log('unidade            vig      valor R$   R$/km rem  km rem antes  km recomp  km rem depois   km real   Δ antes   Δ depois  imp antes  imp depois');
linhas.filter(l => l.valor).forEach(l => console.log(
  `${l.uni.padEnd(18)} ${l.vig}  ${br(l.valor).padStart(10)}  ${br(l.taxaVar, 4).padStart(9)}  ${br(l.km0).padStart(12)}  ${br(l.kmRec).padStart(9)}  ${br(l.km1).padStart(13)}  ${br(l.real).padStart(8)}  ${br(l.dAntes).padStart(8)}  ${br(l.dDepois).padStart(9)}  ${br(l.impAntes).padStart(9)}  ${br(l.impDepois).padStart(10)}`
  + (l.semKm ? '  ⚠ sem km na Dispersão' : '') + (l.semCusto ? '  ⚠ sem custo remunerado na Frota' : '')));

console.log('\n── TOTAL por unidade ──');
const porUni = {};
linhas.forEach(l => { const t = porUni[l.uni] = porUni[l.uni] || { valor: 0, km0: 0, kmRec: 0, real: 0, impAntes: 0, impDepois: 0 };
  t.valor += l.valor; t.km0 += l.km0; t.kmRec += l.kmRec; t.real += l.real; t.impAntes += l.impAntes; t.impDepois += l.impDepois; });
Object.entries(porUni).forEach(([u, t]) => console.log(`${u.padEnd(18)} valor ${br(t.valor).padStart(10)} · km rem ${br(t.km0)} → ${br(t.km0 + t.kmRec)} (+${br(t.kmRec)}) · Δ ${br(t.real - t.km0)} → ${br(t.real - t.km0 - t.kmRec)} · impacto ${br(t.impAntes)} → ${br(t.impDepois)}`));
const tot = Object.values(porUni).reduce((a, t) => ({ valor: a.valor + t.valor, km0: a.km0 + t.km0, kmRec: a.kmRec + t.kmRec, real: a.real + t.real, impAntes: a.impAntes + t.impAntes, impDepois: a.impDepois + t.impDepois }), { valor: 0, km0: 0, kmRec: 0, real: 0, impAntes: 0, impDepois: 0 });
console.log(`${'TOTAL'.padEnd(18)} valor ${br(tot.valor).padStart(10)} · km rem ${br(tot.km0)} → ${br(tot.km0 + tot.kmRec)} (+${br(tot.kmRec)}) · Δ ${br(tot.real - tot.km0)} → ${br(tot.real - tot.km0 - tot.kmRec)} · impacto ${br(tot.impAntes)} → ${br(tot.impDepois)}`);
console.log('\nJSON_INICIO');
console.log(JSON.stringify({ linhas, porUni, tot }));
console.log('JSON_FIM');

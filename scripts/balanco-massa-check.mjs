// ============================================================
// BALANÇO DE MASSA → km remunerado das EMPURRADAS — auditoria do antes × depois
//
// DUAS REGRAS, pelo mês (Renan, 09/10/2026: "Deve valer de agosto em diante"):
//   · até jul/26: aba "Balanço de Massa" (Base Dispersão de km), coluna
//     "Valor 85%", ÷ R$/km de TODAS as contas dos pacotes Combustíveis +
//     Manutenções + Pneus (Σ remunerado ÷ km remunerado original da chave);
//   · de ago/26 em diante: tabela `balanco_massa` do Supabase (importada do
//     export do DRE), CONTA A CONTA — somado no TRIMESTRE, rateado pelo
//     remunerado da conta e convertido pelo R$/km da própria conta (remunerado
//     LÍQUIDO do balanço ÷ km original). O motor é `assets/balanco-massa.js`,
//     o MESMO que o /painel-km/ e a Árvore de Combustível rodam — conferir com
//     uma cópia da fórmula mediria a cópia.
//
// Imprime o ANTES × DEPOIS por unidade e vigência, o detalhe por conta e os
// avisos do motor. Não grava nada.
// Uso: node scripts/balanco-massa-check.mjs
//   GEM_SUPABASE_SERVICE_KEY (ou GEM_SUPABASE_KEY) para ler a tabela — sem
//   ela, só a regra antiga é conferida e o script avisa.
// ============================================================
import { createRequire } from 'node:module';
const BM = createRequire(import.meta.url)('../assets/balanco-massa.js');

const DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const COST_ID = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';
const SUPA_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SUPA_KEY = process.env.GEM_SUPABASE_SERVICE_KEY || process.env.GEM_SUPABASE_KEY || '';
const INICIO = BM.INICIO;   // '08/2026'

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
const antes = v => BM.ym(v) < BM.ym(INICIO);

// contas: o mesmo alias do painel (nomes compridos da Frota → nome curto do export)
const ALIAS = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'COMBUSTIVEIS', 'FLUIDOS (ARLA)': 'ARLA',
  'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'MANUTENCAO DE VEICULOS E EQUIP.', 'CONSERTOS E RECAPAGENS DE PNEUS': 'RECAPAGENS E OUTROS SERVICOS', 'PNEUS E CAMARAS': 'PNEUS NOVOS' };
const ctaNK = c => { const n = NK(c); return ALIAS[n] || n; };
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
async function tabelaBanco() {
  if (!SUPA_KEY) { console.log('⚠ sem GEM_SUPABASE_SERVICE_KEY: a tabela balanco_massa não foi lida — só a regra antiga (até jul/26) está conferida'); return []; }
  const out = []; const passo = 1000;
  for (let i = 0; ; i += passo) {
    const r = await fetch(`${SUPA_URL}/rest/v1/balanco_massa?select=unidade,projeto,vigencia,conta,valor,linhas&order=vigencia,unidade,conta&limit=${passo}&offset=${i}`,
      { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY } });
    if (!r.ok) throw new Error('balanco_massa HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const rows = await r.json(); out.push(...rows); if (rows.length < passo) break;
  }
  return out;
}

const [disp, frota, bm, banco] = await Promise.all([sheet(DISP_ID, 'Dispersão de km'), sheet(COST_ID, 'Frota'), sheet(DISP_ID, 'Balanço de Massa'), tabelaBanco()]);
console.log(`Dispersão de km: ${disp.rows.length} linha(s) · Frota: ${frota.rows.length} · aba Balanço de Massa: ${bm.rows.length} · tabela balanco_massa: ${banco.length} linha(s)`);
console.log(`Regra antiga até ${INICIO === '08/2026' ? 'jul/26' : 'antes de ' + INICIO} (aba, Valor 85%) · regra nova de ${INICIO} em diante (banco, conta a conta)`);

// Dispersão: col 0 vig · col 14 "PROJETO - COD" · col 31 km rem · col 32 km real (índices do /painel-km/)
const km0 = {}, kmReal = {};
disp.rows.forEach(r => { const vig = vigDe(r[0]); const n3 = String((r[14] && r[14].v) || ''); if (!vig || !n3.includes('-')) return;
  const [proj, cod] = n3.split('-').map(s => NK(s)); const k = `${vig}|${proj}|${cod}`;
  km0[k] = (km0[k] || 0) + num(r[31]); kmReal[k] = (kmReal[k] || 0) + num(r[32]); });

// Frota: por nome de coluna — Σ dos 3 pacotes (regra antiga) e por conta (regra nova)
const fi = (...t) => frota.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const K = { vig: fi('vigência', 'vigencia'), n3: fi('nível 3', 'nivel 3'), cta: fi('conta'), rem: fi('remunerado') };
const remPac = {}, remCta = {};
frota.rows.forEach(r => { const vig = vigDe(r[K.vig]); const n3 = String((r[K.n3] && r[K.n3].v) || ''); if (!vig || !n3.includes('-')) return;
  const i = n3.indexOf('-'); const proj = NK(n3.slice(0, i)), cod = NK(n3.slice(i + 1)); const k = `${vig}|${proj}|${cod}`;
  const cta = ctaNK(r[K.cta] && r[K.cta].v); const v = -num(r[K.rem]);   // custo na DRE vem negativo
  (remCta[k] = remCta[k] || {})[cta] = (remCta[k][cta] || 0) + v;
  if (PAC[cta]) remPac[k] = (remPac[k] || 0) + v; });

const linhas = [];
// ── REGRA ANTIGA (até jul/26): aba Balanço de Massa, Valor 85%, R$/km BRUTO dos 3 pacotes —
//    RATEADA pelo motor: jan→jul num bloco só ('tudo'), pelo remunerado de cada mês
//    (Renan, 09/10/2026: "os meses anteriores seria importante dividir… Ou de jan a jul proporcionalize tudo")
const ANTIGA_INICIO = '01/2026', ANTIGA_JANELA = 'tudo';
const bi = (...t) => bm.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const b85 = bm.cols.findIndex(c => /valor/i.test(c) && /85/.test(c));
const B = { uni: bi('unidade'), vig: bi('vig'), val: b85 >= 0 ? b85 : bi('valor') };
console.log(b85 >= 0 ? `aba · usando a coluna "${bm.cols[b85]}"` : '⚠ aba: coluna "Valor 85%" não encontrada — usando "Valor"');
let abaDepois = 0; const balAnt = {}, lancadoAnt = {};
bm.rows.forEach(r => { const vig = vigDe(r[B.vig]); const valor = num(r[B.val]); const uni = String((r[B.uni] && r[B.uni].v) || '');
  if (!vig || !uni) return;
  if (!antes(vig)) { abaDepois++; return; }
  const kb = chaveBM(uni); if (!kb) { console.log(`  ⚠ unidade sem código: "${uni}"`); return; }
  const [proj, cod] = kb.split('|'); const k = `${vig}|${proj}|${cod}`;
  (balAnt[k] = balAnt[k] || {}).TOTAL = (balAnt[k].TOTAL || 0) + valor; lancadoAnt[k] = (lancadoAnt[k] || 0) + valor; });
if (abaDepois) console.log(`aba · ${abaDepois} linha(s) de ${INICIO} em diante IGNORADAS — nesse período vale o banco`);
const remPacAnt = {}, km0Ant = {};
Object.keys(remPac).forEach(k => { if (antes(k.slice(0, 7))) remPacAnt[k] = { TOTAL: remPac[k] }; });
Object.keys(km0).forEach(k => { if (antes(k.slice(0, 7))) km0Ant[k] = km0[k]; });
const resAnt = BM.recompoe({ bal: balAnt, remCta: remPacAnt, km0: km0Ant, inicio: ANTIGA_INICIO, fim: INICIO, janela: ANTIGA_JANELA, liquido: false });
resAnt.avisos.forEach(a => console.log('  ⚠ motor (antiga): ' + a));
console.log(`regra antiga · janela "${ANTIGA_JANELA}" de ${ANTIGA_INICIO} até antes de ${INICIO} · ${Object.keys(resAnt.porChave).length} chave(s) com rateio`);
Object.entries(resAnt.porChave).forEach(([k, e]) => {
  const [vig, proj, cod] = k.split('|'); const k0 = km0[k] || 0, real = kmReal[k] || 0, rv = remPac[k] || 0;
  const taxaImp = k0 > 0 && rv > 0 ? rv / k0 : 0;
  linhas.push({ regra: 'antiga', uni: `${cod} ${proj}`, vig, proj, cod, valor: e.valor, lancado: lancadoAnt[k] || 0, km0: k0, real, remVar: rv, taxaVar: e.taxa, kmRec: e.km, km1: k0 + e.km, taxaImp,
    dAntes: real - k0, dDepois: real - (k0 + e.km), impAntes: (real - k0) * taxaImp, impDepois: (real - k0 - e.km) * taxaImp,
    semKm: k0 <= 0, semCusto: rv <= 0, contas: null }); });

// ── REGRA NOVA (ago/26+): tabela balanco_massa, motor compartilhado ──
const bal = {}; let bancoAntes = 0;
banco.forEach(x => { const m = String(x.vigencia || '').match(/^(\d{4})-(\d{2})$/); if (!m) return; const vig = m[2] + '/' + m[1];
  if (antes(vig)) { bancoAntes++; return; }
  const k = `${vig}|${NK(x.projeto)}|${NK(x.unidade)}`, c = ctaNK(x.conta);
  (bal[k] = bal[k] || {})[c] = (bal[k][c] || 0) + (+x.valor || 0); });
if (bancoAntes) console.log(`banco · ${bancoAntes} linha(s) anteriores a ${INICIO} ignoradas — nesse período vale a aba`);
const km0Novo = {}; Object.keys(km0).forEach(k => { if (!antes(k.slice(0, 7))) km0Novo[k] = km0[k]; });
const resNova = BM.recompoe({ bal, remCta, km0: km0Novo, inicio: INICIO });
resNova.avisos.forEach(a => console.log('  ⚠ motor: ' + a));
Object.entries(resNova.porChave).forEach(([k, e]) => {
  const [vig, proj, cod] = k.split('|'); const k0 = km0[k] || 0, real = kmReal[k] || 0, rv = remPac[k] || 0;
  const taxaImp = k0 > 0 && rv > 0 ? rv / k0 : 0;
  const lanc = Object.values(bal[k] || {}).reduce((s, v) => s + v, 0);
  linhas.push({ regra: 'nova', uni: `${cod} ${proj}`, vig, proj, cod, valor: e.valor, lancado: lanc, km0: k0, real, remVar: rv, taxaVar: e.taxa, kmRec: e.km, km1: k0 + e.km, taxaImp,
    dAntes: real - k0, dDepois: real - (k0 + e.km), impAntes: (real - k0) * taxaImp, impDepois: (real - k0 - e.km) * taxaImp,
    semKm: k0 <= 0, semCusto: rv <= 0, contas: e.contas }); });
// chaves com balanço no banco que o motor não recompôs (sem km no trimestre) aparecem nos avisos acima

const ym = v => v.slice(3) + v.slice(0, 2);
const ord = (a, b) => a.uni.localeCompare(b.uni) || ym(a.vig).localeCompare(ym(b.vig));
linhas.sort(ord);
console.log('\n── ANTES × DEPOIS por unidade e vigência ──');
console.log('regra   unidade          vig     lançado R$   rateado R$   R$/km bm   km rem antes  km recomp  km rem depois   km real   Δ antes   Δ depois  imp antes  imp depois');
linhas.filter(l => l.valor || l.lancado).forEach(l => console.log(
  `${l.regra.padEnd(7)} ${l.uni.padEnd(16)} ${l.vig}  ${br(l.lancado).padStart(10)}  ${br(l.valor).padStart(10)}  ${br(l.taxaVar, 4).padStart(9)}  ${br(l.km0).padStart(12)}  ${br(l.kmRec).padStart(9)}  ${br(l.km1).padStart(13)}  ${br(l.real).padStart(8)}  ${br(l.dAntes).padStart(8)}  ${br(l.dDepois).padStart(9)}  ${br(l.impAntes).padStart(9)}  ${br(l.impDepois).padStart(10)}`
  + (l.semKm ? '  ⚠ sem km na Dispersão' : '') + (l.semCusto ? '  ⚠ sem custo remunerado na Frota' : '')));

console.log('\n── DETALHE POR CONTA (regra nova) · o km da unidade sai do TOTAL (valor ÷ R$/km das contas do balanço); o km por conta é só o que ela SOZINHA diria ──');
linhas.filter(l => l.contas).forEach(l => {
  const e = resNova.porChave[`${l.vig}|${l.proj}|${l.cod}`];
  console.log(`${l.uni} ${l.vig} · trimestre ${BM.trimestre(l.vig)} · índice da unidade ${(e.indice * 100).toFixed(2)}% · R$/km ${br(l.taxaVar, 4)} · km ${br(l.kmRec)}${e.planoB ? ' (plano B)' : ''}`);
  Object.entries(l.contas).sort((a, b) => b[1].remNet - a[1].remNet).forEach(([c, d]) => console.log(
    `   ${c.padEnd(36)} lançado ${br(d.bal).padStart(9)} → rateado ${br(d.balApp).padStart(9)}  rem ${br(d.remBruto).padStart(10)} → ${br(d.remNet).padStart(10)}  índice ${d.indice == null ? '     —' : (d.indice * 100).toFixed(2).padStart(6) + '%'}  R$/km ${br(d.rsKm, 4)}  sozinha ${br(d.km).padStart(8)} km`));
});

console.log('\n── TOTAL por unidade ──');
const porUni = {};
linhas.forEach(l => { const t = porUni[l.uni] = porUni[l.uni] || { valor: 0, km0: 0, kmRec: 0, real: 0, impAntes: 0, impDepois: 0 };
  t.valor += l.valor; t.km0 += l.km0; t.kmRec += l.kmRec; t.real += l.real; t.impAntes += l.impAntes; t.impDepois += l.impDepois; });
Object.entries(porUni).forEach(([u, t]) => console.log(`${u.padEnd(18)} valor ${br(t.valor).padStart(10)} · km rem ${br(t.km0)} → ${br(t.km0 + t.kmRec)} (+${br(t.kmRec)}) · Δ ${br(t.real - t.km0)} → ${br(t.real - t.km0 - t.kmRec)} · impacto ${br(t.impAntes)} → ${br(t.impDepois)}`));
const tot = Object.values(porUni).reduce((a, t) => ({ valor: a.valor + t.valor, km0: a.km0 + t.km0, kmRec: a.kmRec + t.kmRec, real: a.real + t.real, impAntes: a.impAntes + t.impAntes, impDepois: a.impDepois + t.impDepois }), { valor: 0, km0: 0, kmRec: 0, real: 0, impAntes: 0, impDepois: 0 });
console.log(`${'TOTAL'.padEnd(18)} valor ${br(tot.valor).padStart(10)} · km rem ${br(tot.km0)} → ${br(tot.km0 + tot.kmRec)} (+${br(tot.kmRec)}) · Δ ${br(tot.real - tot.km0)} → ${br(tot.real - tot.km0 - tot.kmRec)} · impacto ${br(tot.impAntes)} → ${br(tot.impDepois)}`);
console.log('\nJSON_INICIO');
console.log(JSON.stringify({ linhas: linhas.map(l => ({ ...l, contas: undefined })), porUni, tot, avisos: [...resAnt.avisos, ...resNova.avisos] }));
console.log('JSON_FIM');

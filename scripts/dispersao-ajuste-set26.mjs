// ============================================================
// Dispersão de km · set/26 — grava na dispersao_km os números da 01-BD que o
// Renan corrigiu na planilha (Rota, Auto Serviço e Van), tirados do print que
// ele mandou em 15/10/2026 ("Então suba os valores que eu mandei na imagem").
// Empurrada não muda (não foi mexida na planilha).
//
// Mexe só em frota_ativa · viagens_prim · km_rem_prim · km_rem · fator_rskm
// (+ arquivo/updated_by), por upsert na chave (vigencia, unidade, projeto):
// as outras colunas da linha ficam como estão. Goiânia (GNA · Auto Serviço)
// não existia no banco e entra agora.
//
// GRAVAR=1 grava; sem isso só imprime antes × depois.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const GRAVAR = process.env.GRAVAR === '1';
const VIG = '2026-09';

// [unidade, frota ativa, viagens realizadas, km rem 1ª viagem, km rem consolidado, R$/km]
const PRINT = {
  'Rota': [
    ['BLC', 17, 422, 39300, 42087, 3.21], ['CBA', 43, 841, 81639, 85278, 3.49], ['FLP', 19, 443, 40411, 45348, 2.74],
    ['GRL', 37, 822, 55984, 57838, 3.48], ['NFR', 19, 408, 46537, 46990, 2.85], ['PLT', 19, 456, 70783, 71829, 2.81],
    ['CGR', 78, 1645, 126514, 128201, 3.42], ['RON', 13, 247, 31856, 32134, 2.80], ['MCC', 19, 418, 57647, 57647, 2.14]],
  'Auto Serviço': [
    ['BLC', 2, 28, 2806, 3150, 3.31], ['CBA', 2, 30, 1034, 1179, 8.14], ['FLP', 4, 51, 8387, 8610, 3.51],
    ['GNA', 10, 106, 9374, 9374, 3.50], ['CGR', 27, 325, 33274, 33880, 2.93]],
  'Van': [
    ['BLC', 2, 17, 1308, 1370, 1.07], ['CBA', 3, 53, 3142, 3282, 1.58], ['FLP', 3, 36, 2895, 4875, 1.50],
    ['GRL', 8, 144, 9516, 9516, 2.14], ['NFR', 2, 22, 1973, 1973, 1.16], ['PLT', 3, 66, 7256, 7328, 1.53],
    ['CGR', 3, 35, 2658, 2658, 1.54], ['RON', 2, 30, 2192, 2680, 2.35], ['MCC', 2, 38, 6059, 6059, 1.03]],
};
const NOME = { BLC: 'Balneário-SC', CBA: 'Cuiába - MT', FLP: 'Florianópolis-SC', GRL: 'Guarulhos-SP', NFR: 'Nova Friburgo - RJ',
  PLT: 'Pelotas-RS', CGR: 'Campo Grande-RJ', RON: 'Rondonopolis - MT', MCC: 'Macacu - RJ', GNA: 'Goiânia - GO' };

const r0 = await fetch(`${SB_URL}/rest/v1/dispersao_km?vigencia=eq.${VIG}&select=*`, { headers: H });
if (!r0.ok) { console.error('leitura', r0.status, await r0.text()); process.exit(1); }
const antes = new Map((await r0.json()).map(l => [l.unidade + '|' + l.projeto, l]));

const n = v => (v == null ? '—' : Math.round(v).toLocaleString('pt-BR'));
const linhas = [];
let tA = 0, tN = 0;
console.log(`dispersao_km ${VIG} · ${GRAVAR ? 'GRAVANDO' : 'SÓ CONFERINDO (GRAVAR=1 para gravar)'}\n`);
console.log('projeto        uni   frota      viagens      km rem 1ª         km rem (consol.)        R$/km');
for (const [proj, rows] of Object.entries(PRINT)) for (const [uni, frota, viag, kr1, kr, fat] of rows) {
  const a = antes.get(uni + '|' + proj) || {};
  tA += +a.km_rem || 0; tN += kr;
  console.log(`${proj.padEnd(14)} ${uni.padEnd(4)} ${String(n(a.frota_ativa)).padStart(4)}→${String(frota).padEnd(4)} ${String(n(a.viagens_prim)).padStart(5)}→${String(viag).padEnd(5)} ${String(n(a.km_rem_prim)).padStart(8)}→${n(kr1).padEnd(8)} ${String(n(a.km_rem)).padStart(8)}→${n(kr).padEnd(8)} (${(kr - (+a.km_rem || 0) >= 0 ? '+' : '') + n(kr - (+a.km_rem || 0))})  ${a.fator_rskm ?? '—'}→${fat}${a.vigencia ? '' : '  · NOVA'}`);
  linhas.push({ vigencia: VIG, unidade: uni, projeto: proj, unidade_orig: a.unidade_orig || NOME[uni], projetos_orig: a.projetos_orig || proj,
    frota_ativa: frota, viagens_prim: viag, km_rem_prim: kr1, km_rem: kr, fator_rskm: fat,
    arquivo: 'Ajuste 15/10/2026 (print da 01-BD de set/26)', updated_by: 'ajuste-set26', updated_at: new Date().toISOString() });
}
console.log(`\nRota + AS + Van · km rem: ${n(tA)} → ${n(tN)} (${(tN - tA >= 0 ? '+' : '') + n(tN - tA)})`);
const fora = [...antes.keys()].filter(k => !linhas.some(l => l.unidade + '|' + l.projeto === k));
console.log('linhas do banco que ficam como estão:', fora.join(' · ') || '—');

if (GRAVAR) {
  // PostgREST: upsert em lote exige as mesmas chaves em todos os objetos (já são)
  const r = await fetch(`${SB_URL}/rest/v1/dispersao_km?on_conflict=vigencia,unidade,projeto`, {
    method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(linhas) });
  if (!r.ok) { console.error('gravação', r.status, await r.text()); process.exit(1); }
  const ok = await r.json();
  console.log(`\ngravadas ${ok.length} de ${linhas.length} linhas (confirmado pelo banco)`);
  const r2 = await fetch(`${SB_URL}/rest/v1/dispersao_km?vigencia=eq.${VIG}&select=projeto,km_rem`, { headers: H });
  const tot = (await r2.json()).reduce((o, l) => (o[l.projeto] = (o[l.projeto] || 0) + (+l.km_rem || 0), o), {});
  console.log('relido do banco, km rem por projeto:', Object.entries(tot).map(([p, v]) => p + ' ' + n(v)).join(' · '));
}

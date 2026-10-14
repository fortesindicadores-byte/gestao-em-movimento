// ============================================================
// Dispersão de km × abastecimentos do ERP — o km rodado sai do banco?
// (Renan, 14/10/2026)
//
// A planilha "Dispersão de KM - Consolidado" (aba 01-BD) traz, por mês ×
// unidade × projeto, o km remunerado e o km rodado. O km rodado é o dos
// ABASTECIMENTOS ("Km rodado no mês (abastc)" na dinâmica por placa), que já
// está no banco em erp_abastecimentos. Antes de completar o km rodado pelo
// banco, conferir se o ERP reproduz o que a planilha tem de jan a ago.
//
// Imprime, por vigência × projeto da OS:
//   · km_os   = Σ km_rodado das OS do mês (o DESGASTE de cada abastecimento)
//   · km_rat  = Σ km_vig da km_vigencia (hodômetro rateado por dia), com a
//               placa no projeto em que ela mais abasteceu no mês
// e a aba Dispersão de km do banco (sh_dispersao_km), para casar as chaves.
// Não grava nada. Sem nome de pessoa.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const DESDE = process.env.DESDE || '2026-01-01';

const n = v => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR'));
const num = v => (v == null || v === '' ? 0 : typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')) || 0);

async function todas(caminho) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${caminho.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json(); out.push(...p);
    if (p.length < 1000) return out;
  }
}

console.log(`═══ Dispersão de km × ERP (desde ${DESDE}) ═══\n`);

const ab = await todas(`erp_abastecimentos?select=placa,data,projeto_os,projeto_veiculo,filial,km_rodado,encerrada&data=gte.${DESDE}&order=data.asc`);
console.log(`abastecimentos: ${n(ab.length)}`);

// km por OS e projeto dominante de cada placa no mês
const osAgg = new Map(), dom = new Map();
for (const r of ab) {
  const vig = String(r.data).slice(0, 7), proj = (r.projeto_os || '(sem projeto)').trim();
  const k = vig + '|' + proj;
  const a = osAgg.get(k) || { os: 0, enc: 0, km: 0, placas: new Set() };
  a.os++; if (r.encerrada === 'S') a.enc++; a.km += num(r.km_rodado); a.placas.add(r.placa);
  osAgg.set(k, a);
  const kd = vig + '|' + r.placa, d = dom.get(kd) || new Map();
  d.set(proj, (d.get(proj) || 0) + 1); dom.set(kd, d);
}

let kv = [];
try { kv = await todas(`km_vigencia?select=placa,vig_km,km_vig,km_hodometro&vig_km=gte.${DESDE.slice(0, 7)}`); }
catch (e) { console.log('km_vigencia:', e.message); }
const rat = new Map();
for (const r of kv) {
  const d = dom.get(r.vig_km + '|' + r.placa);
  const proj = d ? [...d.entries()].sort((a, b) => b[1] - a[1])[0][0] : '(placa sem abastecimento no mês)';
  const k = r.vig_km + '|' + proj;
  const a = rat.get(k) || { km: 0, hod: 0, placas: 0 };
  a.km += num(r.km_vig); a.hod += num(r.km_hodometro); a.placas++; rat.set(k, a);
}

const chaves = [...new Set([...osAgg.keys(), ...rat.keys()])].sort();
console.log('\n━━ ERP por vigência × projeto da OS');
console.log('vig | projeto | OS | encerradas | placas | km_os | km_rat | km_hodometro');
for (const k of chaves) {
  const [vig, proj] = k.split('|'), a = osAgg.get(k), b = rat.get(k);
  console.log(`${vig} | ${proj} | ${a ? a.os : 0} | ${a ? a.enc : 0} | ${a ? a.placas.size : b ? b.placas : 0} | ${n(a ? a.km : 0)} | ${n(b ? b.km : 0)} | ${n(b ? b.hod : 0)}`);
}

console.log('\n━━ Aba Dispersão de km no banco (sh_dispersao_km)');
try {
  const dk = await todas('sh_dispersao_km?select=vigencia,unid,proj,unidade,projeto,projeto_2,km_rem_tt,km_rodado_tt&order=linha.asc');
  console.log('vigencia | unid | proj | unidade | projeto | projeto_2 | km_rem_tt | km_rodado_tt');
  for (const r of dk) if (String(r.vigencia || '').endsWith('2026'))
    console.log(`${r.vigencia} | ${r.unid} | ${r.proj} | ${r.unidade} | ${r.projeto} | ${r.projeto_2} | ${n(num(r.km_rem_tt))} | ${n(num(r.km_rodado_tt))}`);
} catch (e) { console.log('sh_dispersao_km:', e.message); }

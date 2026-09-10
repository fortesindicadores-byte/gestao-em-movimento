// ============================================================
// O CONTRATO DE AGORA (Renan, 10/09/2026: "deve ser o de agora,
// que entra em outubro")
//
// A visão Contrato do Gestão à Vista mostra o mês de km que está CORRENDO —
// que é a fatura do mês seguinte (vig_cobranca = vig_km + 1 mês). Este script
// lê exatamente o que a tela vai ler (custo_vigencia_mv, mesmo recorte) e
// imprime o ranking por unidade, para conferir os números antes de olhar a
// tela. Não grava nada.
//
// Roda no GitHub Actions: o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const hoje = new Date();
const VIG_KM = process.env.CT_VIG_KM
  || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

const n = v => Math.round(+v || 0).toLocaleString('pt-BR');
const brl = v => 'R$ ' + Math.round(+v || 0).toLocaleString('pt-BR');

// a tela lê a materializada e cai na view se ela não existir — igual aqui
async function leia(tabela) {
  const cols = 'vig_cobranca,vig_km,placa,placa_origem,unidade,projeto,tipo,taxa_km,'
    + 'km_vig,valor_fixo,custo_vig,abastecimentos,ultimo_abast,previa,modelo';
  const r = await fetch(`${SB_URL}/rest/v1/${tabela}?select=${cols}`
    + `&vig_km=eq.${VIG_KM}&limit=5000`, { headers: H });
  if (!r.ok) throw new Error(`${tabela} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

let linhas = null, fonte = '';
for (const t of ['custo_vigencia_mv', 'custo_vigencia']) {
  try { linhas = await leia(t); fonte = t; break; }
  catch (e) { console.log(`${t}: ${e.message}`); }
}
if (!linhas) { console.error('nenhuma das duas respondeu'); process.exit(1); }

const cob = (linhas[0] && linhas[0].vig_cobranca) || '(sem linhas)';
console.log(`fonte: ${fonte} · km de ${VIG_KM} → fatura de ${cob} · ${linhas.length} linha(s)`);
if (!linhas.length) {
  console.log('\nSem linha para este mês. Ou o ERP ainda não recebeu carga do mês'
    + ' (o Renan roda o PowerShell de dentro da rede), ou a materializada está atrasada.');
  process.exit(0);
}
const previa = linhas.filter(l => l.previa).length;
console.log(`marcadas como prévia: ${previa}/${linhas.length}`
  + (previa === linhas.length ? '  (esperado: o mês ainda está correndo)' : '  ⚠ deveria ser tudo prévia'));

for (const tipo of ['variavel', 'fixo']) {
  const rs = linhas.filter(l => l.tipo === tipo);
  if (!rs.length) { console.log(`\n── ${tipo}: nenhuma placa`); continue; }
  const km = rs.reduce((s, l) => s + (+l.km_vig || 0), 0);
  const tot = rs.reduce((s, l) => s + (+l.custo_vig || 0), 0);
  const semKm = rs.filter(l => !(+l.km_vig > 0)).length;
  console.log(`\n── ${tipo.toUpperCase()} · ${rs.length} placa(s) · ${n(km)} km · ${brl(tot)}`
    + ` · ${semKm} sem km no mês` + (tipo === 'variavel' && km ? ` · R$/km médio ${(tot / km).toFixed(2)}` : ''));

  const porU = {};
  rs.forEach(l => { const u = l.unidade || '(sem unidade)';
    const a = porU[u] || (porU[u] = { n: 0, km: 0, custo: 0 });
    a.n++; a.km += +l.km_vig || 0; a.custo += +l.custo_vig || 0; });
  console.log('   unidade        placas        km        custo');
  Object.entries(porU).sort((a, b) => b[1].custo - a[1].custo).forEach(([u, a]) =>
    console.log(`   ${u.padEnd(12)} ${String(a.n).padStart(6)} ${n(a.km).padStart(10)} ${brl(a.custo).padStart(13)}`));

  // o ranking é por CUSTO, que é o que a tela ordena
  console.log('   top 10 por custo:');
  rs.slice().sort((a, b) => (+b.custo_vig || 0) - (+a.custo_vig || 0)).slice(0, 10).forEach(l =>
    console.log(`      ${String(l.placa_origem || l.placa).padEnd(9)} ${String(l.unidade || '—').padEnd(10)}`
      + ` ${n(l.km_vig).padStart(8)} km · ${brl(l.custo_vig).padStart(11)}`
      + (tipo === 'variavel' ? ` · ${(+l.taxa_km || 0).toFixed(3)} R$/km` : '')
      + ` · ${l.abastecimentos || 0} abast.`));
}

// placa fora do de-para de unidades do portal não aparece na tela — o filtro
// do Gestão à Vista é por unidade, então ela sumiria sem aviso
const UNI = new Set(['BLC', 'CBA T1', 'CBA T1 WH', 'CBA T2', 'CGR', 'FLP', 'GRL',
  'MCC T1', 'MCC T2', 'NFR', 'PIR', 'PLT', 'RON']);
const fora = linhas.filter(l => !UNI.has(l.unidade));
if (fora.length) {
  const porU = {};
  fora.forEach(l => { const u = l.unidade || '(nula)'; porU[u] = (porU[u] || 0) + 1; });
  console.log(`\n⚠ ${fora.length} linha(s) com unidade que o Gestão à Vista não mostra:`,
    Object.entries(porU).map(([u, q]) => `${u}=${q}`).join(' · '));
}

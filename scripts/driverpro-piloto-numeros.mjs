// Números do piloto do DriverPro para as apresentações e o descritivo.
// Renan, 08/10/2026: "o Piloto é só na Empurrada Piraí". Lê o banco com a
// service key e aplica as regras VIGENTES (as mesmas do ce_app_dados):
//   · elegível = km do mês ≥ km mínimo da unidade (todos ganham, sem cota);
//   · carteira = ce_app_carteira(nota, saldo, piso) = min(saldo, max(0, nota−piso) × saldo ÷ (100−piso));
//   · pódio = 1º/2º/3º do grupo entre os elegíveis, por nota e, no empate, por km.
// Imprime, por mês: cadastrados, medidos, elegíveis, custo, teto, medianas dos
// pilares e o diesel realizado da DRE (aba Frota) do projeto da unidade.
// Uso: DP_UNI='EMP PIRAI' DP_MES='2026-08,2026-09' DP_KM=1000 node scripts/driverpro-piloto-numeros.mjs
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const UNIS = (process.env.DP_UNI || 'EMP PIRAI').toUpperCase().split(/\s*[,+]\s*/).filter(Boolean);
const MESES = (process.env.DP_MES || '2026-08,2026-09').split(',').map(s => s.trim().slice(0, 7)).filter(Boolean);
const KM_MIN = +process.env.DP_KM || 1000;

async function todos(caminho) {
  const url = caminho.includes('order=') ? caminho : caminho + (caminho.includes('?') ? '&' : '?') + 'order=id.asc';
  const out = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${url}`, { headers: { ...H, Range: `${de}-${de + 999}` } });
    if (!r.ok) throw new Error(`${caminho.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const l = await r.json(); out.push(...l);
    if (l.length < 1000) return out;
  }
}
async function um(caminho) {
  const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, { headers: H });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const brl = v => 'R$ ' + (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = v => v == null ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const med = xs => { const s = xs.filter(v => v != null).map(Number).sort((a, b) => a - b);
  if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const regras = (await um('ce_app_regras?id=eq.1&select=*'))[0] || {};
const SALDO = +(regras.saldo_inicial ?? 200), PISO = +(regras.piso_nota ?? 60);
const PODIO = (regras.podio || [300, 150, 100]).map(Number);
console.log(`regras do banco: saldo ${brl(SALDO)} · piso ${PISO} · pódio ${PODIO.map(brl).join(' / ')}`
  + ` · unidades no programa ${JSON.stringify(regras.unidades)}`);
console.log(`recorte: ${UNIS.join(' + ')} · km mínimo ${KM_MIN} · meses ${MESES.join(', ')}\n`);
const carteira = nota => Math.round(Math.min(SALDO, Math.max(0, nota - PISO) * SALDO / (100 - PISO)) * 100) / 100;

// cadastro (o que o robô viu do Geotab)
const mot = await todos('ce_motoristas?select=id,chave,unidade,ativo');
const uniMot = {}; mot.forEach(m => { const u = String(m.unidade || '').toUpperCase(); if (/PIRAI/.test(u)) uniMot[u] = (uniMot[u] || 0) + 1; });
console.log('cadastro com PIRAI na unidade:', JSON.stringify(uniMot));
const cad = mot.filter(m => UNIS.includes(String(m.unidade || '').toUpperCase()) && !String(m.chave).startsWith('semlogin:') && !String(m.chave).startsWith('teste:'));
console.log(`cadastrados no recorte: ${cad.length}\n`);

const resumo = [];
for (const mes of MESES) {
  const sc = await todos(`ce_scores_mensais?select=id,chave,unidade,km,pontuacao,rpm_pontos,idle_pontos,acel_pontos,litros,km_litros&competencia=eq.${mes}-01`);
  const doRec = sc.filter(s => UNIS.includes(String(s.unidade || '').toUpperCase()));
  const sem = doRec.filter(s => String(s.chave).startsWith('semlogin:'));
  const pes = doRec.filter(s => !String(s.chave).startsWith('semlogin:') && !String(s.chave).startsWith('teste:') && s.pontuacao != null);
  const kmTot = doRec.reduce((a, s) => a + (+s.km || 0), 0), kmSem = sem.reduce((a, s) => a + (+s.km || 0), 0);
  const eleg = pes.filter(s => (+s.km || 0) >= KM_MIN).sort((a, b) => b.pontuacao - a.pontuacao || (+b.km || 0) - (+a.km || 0));
  const carts = eleg.map(s => carteira(+s.pontuacao));
  const somaCart = carts.reduce((a, b) => a + b, 0);
  const pod = PODIO.slice(0, eleg.length).reduce((a, b) => a + b, 0);
  const total = somaCart + pod, teto = eleg.length * SALDO + pod;
  const zerados = carts.filter(c => !c).length;
  console.log(`══ ${mes} ══`);
  console.log(`medidos (com nota): ${pes.length} · com ${KM_MIN}+ km: ${eleg.length} · abaixo do km: ${pes.length - eleg.length}`);
  console.log(`km do recorte ${Math.round(kmTot).toLocaleString('pt-BR')} · sem identificação ${Math.round(kmSem).toLocaleString('pt-BR')} (${kmTot ? (kmSem / kmTot * 100).toFixed(1) : '—'}%)`);
  console.log(`carteiras ${brl(somaCart)} · pódio ${brl(pod)} · CUSTO ${brl(total)} · teto ${brl(teto)}`);
  if (carts.length) console.log(`carteira por elegível: maior ${brl(Math.max(...carts))} · mediana ${brl(med(carts))} · menor ${brl(Math.min(...carts))} · zerados (nota ≤ ${PISO}): ${zerados}`);
  if (eleg.length) console.log(`nota dos elegíveis: ${n1(Math.min(...eleg.map(s => +s.pontuacao)))} a ${n1(Math.max(...eleg.map(s => +s.pontuacao)))} · mediana ${n1(med(eleg.map(s => s.pontuacao)))}`);
  const base = eleg.length ? eleg : pes;
  console.log(`medianas entre ${eleg.length ? 'elegíveis' : 'medidos'}: giro ${n1(med(base.map(s => s.rpm_pontos)))} · motor parado ${n1(med(base.map(s => s.idle_pontos)))} · acelerações ${n1(med(base.map(s => s.acel_pontos)))}`);
  const idl = base.map(s => s.idle_pontos).filter(v => v != null).map(Number);
  const rpm = base.map(s => s.rpm_pontos).filter(v => v != null).map(Number);
  if (idl.length) console.log(`   motor parado de ${n1(Math.min(...idl))} a ${n1(Math.max(...idl))} · giro de ${n1(Math.min(...rpm))} a ${n1(Math.max(...rpm))}`);
  const kmL = base.reduce((a, s) => a + (+s.km_litros || 0), 0), lit = base.reduce((a, s) => a + (+s.litros || 0), 0);
  if (lit) console.log(`   km/L da telemetria: ${(kmL / lit).toFixed(2)} (${Math.round(lit).toLocaleString('pt-BR')} L)`);
  console.log('pódio:', eleg.slice(0, 3).map((s, i) => `${i + 1}º nota ${n1(s.pontuacao)} · ${Math.round(s.km)} km · ${brl(carteira(+s.pontuacao) + (PODIO[i] || 0))}`).join(' | '));
  console.log('');
  resumo.push({ mes, medidos: pes.length, eleg: eleg.length, total, teto });
}

// diesel realizado: DRE (aba Frota) — conta de combustível dos níveis 3 de Piraí
try {
  const dre = await todos('sh_dre_frota?order=linha.asc&select=linha,vigencia,unidade,nivel_3,conta_gerencial,realizado,remunerado&nivel_3=ilike.*PIR*');
  const comb = dre.filter(d => /combust/i.test(d.conta_gerencial || '') && /ve[ií]culos/i.test(d.conta_gerencial || ''));
  const contas = [...new Set(dre.filter(d => /combust|arla/i.test(d.conta_gerencial || '')).map(d => d.conta_gerencial))];
  console.log('contas de combustível nos níveis 3 de Piraí:', JSON.stringify(contas));
  const por = {};
  comb.forEach(d => { const k = `${d.nivel_3}|${d.vigencia}`; por[k] = (por[k] || 0) + (-(+d.realizado || 0)); });
  const niveis = [...new Set(comb.map(d => d.nivel_3))].sort();
  const vigs = [...new Set(comb.map(d => d.vigencia))].sort((a, b) => a.slice(3) + a.slice(0, 2) < b.slice(3) + b.slice(0, 2) ? -1 : 1);
  console.log('\nDIESEL REALIZADO (Combustíveis Veículos e Equipamentos, sinal invertido = gasto):');
  for (const nv of niveis) console.log(`  ${nv.padEnd(22)} ` + vigs.map(v => `${v} ${brl(por[`${nv}|${v}`] || 0)}`).join(' · '));
  for (const nv of niveis) {
    const ult = vigs.filter(v => por[`${nv}|${v}`]).slice(-3);
    const m = ult.reduce((a, v) => a + por[`${nv}|${v}`], 0) / (ult.length || 1);
    console.log(`  média dos 3 últimos meses com valor · ${nv}: ${brl(m)} (${ult.join(', ')}) → 1% = ${brl(m / 100)}`);
  }
} catch (e) { console.log('DRE:', e.message); }

console.log('\nRESUMO:', resumo.map(r => `${r.mes}: ${r.eleg}/${r.medidos} elegíveis · custo ${brl(r.total)} · teto ${brl(r.teto)}`).join(' | '));

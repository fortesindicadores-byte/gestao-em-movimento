// As três faixas (verde 1 · branca 2/3 · amarela 1/3) mascaram a faixa verde?
// Renan, 08/10/2026: "Acha que não pode mascarar um pouco a faixa verde com
// esses pontos das faixas?". Mede, no período de uma competência, motorista a
// motorista, a nota do pilar de giro nas duas réguas — SÓ VERDE (a % do tempo
// rodando na verde) e TRÊS FAIXAS (a régua vigente, rpmNotaDia do robô) —, com
// a MESMA ponderação por km do mensal, e o que muda na nota total, no ranking,
// no pódio e na carteira. Lê o ce_diario (bruto.rpm de cada dia) e o
// ce_scores_mensais da competência (nota vigente e pilares).
// Uso: DP_UNI='EMP PIRAI' DP_MES=2026-09 DP_KM=1000 node scripts/driverpro-faixas-impacto.mjs
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const UNI = (process.env.DP_UNI || 'EMP PIRAI').toUpperCase();
const MES = (process.env.DP_MES || '2026-09').slice(0, 7);
const KM_MIN = +process.env.DP_KM || 1000;
const PESOS = { rpm: 50, idle: 30, acel: 20 };

async function todos(caminho) {
  const url = caminho + (caminho.includes('?') ? '&' : '?') + 'order=id.asc';
  const out = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${url}`, { headers: { ...H, Range: `${de}-${de + 999}` } });
    if (!r.ok) throw new Error(`${caminho.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const l = await r.json(); out.push(...l);
    if (l.length < 1000) return out;
  }
}
const n1 = v => v == null ? '—' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const ord = xs => xs.slice().sort((a, b) => a - b);
const q = (xs, p) => { const s = ord(xs); return s.length ? s[Math.min(s.length - 1, Math.floor((s.length - 1) * p + .5))] : null; };
const dp = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
function postos(xs) { // postos com empate (média), para o Spearman
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function pearson(a, b) { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb); }

// período 21 → 20 da competência
const [y, m] = MES.split('-').map(Number);
let py = y, pm = m - 1; if (pm < 1) { pm = 12; py--; }
const INI = `${py}-${String(pm).padStart(2, '0')}-21`, FIM = `${MES}-20`;

const regras = (await todos('ce_app_regras?select=*&id=eq.1'))[0] || {};
const SALDO = +(regras.saldo_inicial ?? 200), PISO = +(regras.piso_nota ?? 60);
const PODIO = (regras.podio || [300, 150, 100]).map(Number);
const cart = nota => Math.min(SALDO, Math.max(0, nota - PISO) * SALDO / (100 - PISO));
console.log(`competência ${MES} = período ${INI} a ${FIM} · ${UNI} · km mínimo ${KM_MIN} · piso ${PISO} · saldo ${SALDO}\n`);

const sc = (await todos(`ce_scores_mensais?select=id,chave,unidade,km,pontuacao,rpm_pontos,idle_pontos,acel_pontos&competencia=eq.${MES}-01`))
  .filter(s => String(s.unidade || '').toUpperCase() === UNI && !/^(semlogin|teste):/.test(s.chave) && s.pontuacao != null);
const chaves = new Set(sc.map(s => s.chave));
const dias = (await todos(`ce_diario?select=id,chave,km,rpm_verde_pct,bruto&dia=gte.${INI}&dia=lte.${FIM}`))
  .filter(d => chaves.has(d.chave));

// por motorista: nota de giro nas duas réguas, ponderada por km (como o mensal)
const por = new Map(); let tot = { v: 0, b: 0, a: 0, r: 0 }, diasSemFaixa = 0;
for (const d of dias) {
  const r = d.bruto && d.bruto.rpm; const w = +d.km > 0 ? +d.km : 1;
  const e = por.get(d.chave) || { nV: 0, nT: 0, p: 0, v: 0, b: 0, a: 0, r: 0 };
  if (r && r.branca != null && r.amarela != null && (+r.rodando || 0) > 60) {
    const vd = +r.verde / +r.rodando * 100, td = (+r.verde + +r.branca * 2 / 3 + +r.amarela / 3) / +r.rodando * 100;
    e.nV += vd * w; e.nT += td * w; e.p += w;
    e.v += +r.verde; e.b += +r.branca; e.a += +r.amarela; e.r += +r.rodando;
    tot.v += +r.verde; tot.b += +r.branca; tot.a += +r.amarela; tot.r += +r.rodando;
  } else if (d.rpm_verde_pct != null) diasSemFaixa++;
  por.set(d.chave, e);
}
console.log(`dias lidos: ${dias.length} · sem as três faixas no bruto (dia não reprocessado): ${diasSemFaixa}`);
console.log(`TEMPO RODANDO NO PERÍODO (todos os motoristas): verde ${n1(tot.v / tot.r * 100)}% · branca ${n1(tot.b / tot.r * 100)}% · `
  + `amarela ${n1(tot.a / tot.r * 100)}% · fora (abaixo de 1.000 ou acima de 2.300) ${n1((tot.r - tot.v - tot.b - tot.a) / tot.r * 100)}%\n`);

const L = [];
for (const s of sc) {
  const e = por.get(s.chave); if (!e || !e.p) continue;
  const gV = e.nV / e.p, gT = e.nT / e.p;
  const W = PESOS.rpm + (s.idle_pontos != null ? PESOS.idle : 0) + (s.acel_pontos != null ? PESOS.acel : 0);
  const notaT = +s.pontuacao, notaV = notaT + PESOS.rpm / W * (gV - gT);
  L.push({ chave: s.chave, km: +s.km || 0, gV, gT, notaV, notaT, verde: e.v / e.r * 100, branca: e.b / e.r * 100, amarela: e.a / e.r * 100,
    difRpm: Math.abs((+s.rpm_pontos || 0) - gT) });
}
const conf = L.filter(l => l.difRpm > 0.5).length;
console.log(`motoristas com nota e faixas: ${L.length} · conferência: giro recalculado ≠ rpm_pontos gravado (>0,5 pt) em ${conf}`);

function bloco(rot, ls) {
  if (!ls.length) return;
  const gV = ls.map(l => l.gV), gT = ls.map(l => l.gT), nV = ls.map(l => l.notaV), nT = ls.map(l => l.notaT);
  console.log(`\n══ ${rot} (${ls.length}) ══`);
  console.log(`GIRO só verde : mediana ${n1(q(gV, .5))} · p10 ${n1(q(gV, .1))} · p90 ${n1(q(gV, .9))} · amplitude p10–p90 ${n1(q(gV, .9) - q(gV, .1))} · desvio ${n1(dp(gV))}`);
  console.log(`GIRO 3 faixas : mediana ${n1(q(gT, .5))} · p10 ${n1(q(gT, .1))} · p90 ${n1(q(gT, .9))} · amplitude p10–p90 ${n1(q(gT, .9) - q(gT, .1))} · desvio ${n1(dp(gT))}`);
  console.log(`  a régua nova soma em média ${n1(gT.reduce((a, b) => a + b, 0) / gT.length - gV.reduce((a, b) => a + b, 0) / gV.length)} pontos ao giro; `
    + `de onde vêm: branca ${n1(ls.reduce((a, l) => a + l.branca * 2 / 3, 0) / ls.length)} · amarela ${n1(ls.reduce((a, l) => a + l.amarela / 3, 0) / ls.length)}`);
  console.log(`  ordem dos motoristas no giro, uma régua × a outra: Spearman ${pearson(postos(gV), postos(gT)).toFixed(3)} · Pearson ${pearson(gV, gT).toFixed(3)}`);
  console.log(`NOTA TOTAL só verde : mediana ${n1(q(nV, .5))} · p10 ${n1(q(nV, .1))} · p90 ${n1(q(nV, .9))} · desvio ${n1(dp(nV))}`);
  console.log(`NOTA TOTAL 3 faixas : mediana ${n1(q(nT, .5))} · p10 ${n1(q(nT, .1))} · p90 ${n1(q(nT, .9))} · desvio ${n1(dp(nT))}`);
  console.log(`  ordem na nota total: Spearman ${pearson(postos(nV), postos(nT)).toFixed(3)}`);
}
bloco('TODOS COM NOTA', L);
const E = L.filter(l => l.km >= KM_MIN);
bloco(`ELEGÍVEIS (${KM_MIN}+ km)`, E);

// quem a régua nova mais ajuda: muito tempo fora da verde
const ajuda = E.slice().sort((a, b) => (b.gT - b.gV) - (a.gT - a.gV));
console.log('\nquem a régua nova mais ajuda (giro só verde → 3 faixas · verde/branca/amarela do tempo rodando):');
ajuda.slice(0, 8).forEach(l => console.log(`  ${n1(l.gV)} → ${n1(l.gT)} (+${n1(l.gT - l.gV)}) · ${n1(l.verde)}/${n1(l.branca)}/${n1(l.amarela)}% · ${Math.round(l.km)} km`));
console.log('quem ela menos ajuda:');
ajuda.slice(-4).forEach(l => console.log(`  ${n1(l.gV)} → ${n1(l.gT)} (+${n1(l.gT - l.gV)}) · ${n1(l.verde)}/${n1(l.branca)}/${n1(l.amarela)}%`));

// ranking, pódio e carteira nas duas réguas
const rk = (ls, k) => ls.slice().sort((a, b) => b[k] - a[k] || b.km - a.km).map(l => l.chave);
const rV = rk(E, 'notaV'), rT = rk(E, 'notaT');
const pos = r => new Map(r.map((c, i) => [c, i + 1]));
const pV = pos(rV), pT = pos(rT); const mud = E.map(l => Math.abs(pV.get(l.chave) - pT.get(l.chave)));
console.log(`\nRANKING dos elegíveis: ${mud.filter(x => x).length} de ${E.length} mudam de posição · mediana ${q(mud, .5)} casa(s) · máx ${Math.max(...mud)}`);
console.log(`pódio só verde e pódio 3 faixas: ${rV.slice(0, 3).every((c, i) => rT[i] === c) ? 'IGUAIS' : 'DIFERENTES'} · `
  + `top 3 em comum: ${rV.slice(0, 3).filter(c => rT.slice(0, 3).includes(c)).length}`);
const cV = E.reduce((a, l) => a + cart(l.notaV), 0), cT = E.reduce((a, l) => a + cart(l.notaT), 0);
console.log(`CARTEIRAS do período: só verde ${brl(cV)} · 3 faixas ${brl(cT)} (+${brl(cT - cV)}, ${n1((cT / cV - 1) * 100)}%) · pódio igual nas duas`);
console.log(`zerados (nota ≤ piso): só verde ${E.filter(l => l.notaV <= PISO).length} · 3 faixas ${E.filter(l => l.notaT <= PISO).length}`);
// distância em R$ entre um motorista do topo e um do fundo (p90 × p10 da nota)
const dV = cart(q(E.map(l => l.notaV), .9)) - cart(q(E.map(l => l.notaV), .1));
const dT = cart(q(E.map(l => l.notaT), .9)) - cart(q(E.map(l => l.notaT), .1));
console.log(`distância na carteira entre o p90 e o p10: só verde ${brl(dV)} · 3 faixas ${brl(dT)}`);

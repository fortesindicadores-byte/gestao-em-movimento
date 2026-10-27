// ============================================================
// Consumo Outubro Check — por que o Km/L realizado do mês corrente subiu?
// (Renan, 27/10/2026: "quando olho o realizado geral achei que subiu um
// pouco demais... valide"). Só leitura, no Actions, com a service key.
//
// Repete a conta do consumo-auto.mjs (diesel do ERP, projeto da OS, km =
// Σ km_rodado de todos os abastecimentos com a guarda) e separa as causas:
//   1. MIX: o mês corrente ainda não tem todo mundo (Empurrada a 2 km/L entra
//      menos que Rota a 3,3) — Km/L com o peso do mês anterior;
//   2. MÊS PARCIAL: o mês anterior nos MESMOS DIAS (1 → D) contra o mês
//      anterior inteiro — se o começo do mês sempre sai mais alto, é a conta;
//   3. DENTRO DO PROJETO: Km/L por projeto, mês a mês, nos mesmos dias;
//   4. PLACA A PLACA: razão Km/L mês corrente ÷ mês anterior (mediana e quem
//      passa de 1,3×), e as placas que mais puxam a média para cima;
//   5. O DADO CRU: OS abertas × encerradas, abastecimento com km e sem litro
//      (ou o contrário), km_rodado por abastecimento (p50/p90/máx/na guarda).
// Env: CONSUMO_MES (padrão: mês corrente), CONSUMO_KM_MAX (3000).
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!KEY) { console.error('::error::GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const log = (...a) => console.log(...a);
const KM_MAX = +(process.env.CONSUMO_KM_MAX || 3000);
const hoje = new Date();
const MES = process.env.CONSUMO_MES || hoje.toISOString().slice(0, 7);
const mesAnt = ym => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };
const ANT = mesAnt(MES), ANT2 = mesAnt(ANT);

async function api(path) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H });
    if (r.ok) return r.json();
    const txt = (await r.text()).slice(0, 200);
    if (r.status < 500 || t >= 4) throw new Error(`HTTP ${r.status} ${path.slice(0, 80)} ${txt}`);
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}
async function tudo(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const p = await api(`${path}${path.includes('?') ? '&' : '?'}limit=1000&offset=${off}`);
    out.push(...(p || [])); if (!p || p.length < 1000) break;
  }
  return out;
}
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
const norm = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const MERC = 'ABCDEFGHIJ';
const placaKey = s => { const p = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 4) + MERC[+p[4]] + p.slice(5) : p; };
const f0 = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR');
const f2 = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const quant = (arr, q) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const CODS = new Set(['BLC', 'CBA', 'CGR', 'FLP', 'GNA', 'GOI', 'MCC', 'PIR', 'GRL', 'NFR', 'PLT', 'RON']);
const ANG = r => /ANHANGUERA/.test(norm(r.filial)) || /- ANG\b/.test(norm(r.projeto_os));

// vans do FT (como o robô: placa de van no ROTA vira VAN)
const vanPlacas = new Set();
try {
  const rows = await tudo(`ft_linha?select=placa&canal=eq.ROTA&tabela=eq.Van&ano=gte.${+MES.slice(0, 4)}`);
  rows.forEach(r => { const p = placaKey(r.placa); if (p) vanPlacas.add(p); });
} catch (e) { log('::warning::ft_linha Van: ' + e.message); }
function projetoAba(r) {
  let p = norm(r.projeto_os).replace(/\s*\(INATIVO\)\s*$/, '');
  p = p.replace(/^ROTA \(VAN\) - /, 'VAN - ').replace(/^UDC - /, 'ROTA - ');
  const m = p.match(/^(ROTA|AUTO SERVICO|VAN|EMPURRADA|INSUMOS) - ([A-Z]{3})$/); if (!m) return null;
  if (!CODS.has(m[2])) return null;
  const pref = m[1] === 'AUTO SERVICO' ? 'AS' : m[1];
  if (pref === 'ROTA' && vanPlacas.has(placaKey(r.placa))) return 'VAN - ' + m[2];
  return pref + ' - ' + m[2];
}

const ini = ANT2 + '-01';
const erp = await tudo(`erp_abastecimentos?select=ordem_servico,data,placa,filial,projeto_os,hodometro,km_rodado,litros,media_km_l,valor,tipo_combustivel,encerrada,status_os&data=gte.${ini}&order=data.asc`);
const ehDiesel = r => !r.tipo_combustivel || (/DIESEL/.test(norm(r.tipo_combustivel)) && !/ARLA/.test(norm(r.tipo_combustivel)));
const linhas = erp.filter(r => !ANG(r)).map(r => ({ ...r, ym: String(r.data).slice(0, 7), dia: +String(r.data).slice(8, 10), proj: projetoAba(r), placa: placaKey(r.placa), diesel: ehDiesel(r), kr: num(r.km_rodado), lt: num(r.litros) || 0 })).filter(r => r.proj);
const ultimoDia = Math.max(...linhas.filter(r => r.ym === MES).map(r => r.dia));
log(`Consumo Outubro Check · mês ${MES} (dados até o dia ${ultimoDia}) · comparado com ${ANT} e ${ANT2} · ${linhas.length} abastecimentos da Ambev\n`);

// agrega por projeto × placa num recorte (ym, diaMax)
function agrega(ym, diaMax = 31) {
  const m = new Map();
  linhas.forEach(r => {
    if (r.ym !== ym || r.dia > diaMax) return;
    const k = r.proj + '|' + r.placa;
    if (!m.has(k)) m.set(k, { proj: r.proj, placa: r.placa, km: 0, lt: 0, n: 0, nTodos: 0 });
    const a = m.get(k); a.nTodos++;
    if (r.kr != null && r.kr >= 0 && r.kr <= KM_MAX) a.km += r.kr;
    if (r.diesel) { a.lt += r.lt; a.n++; }
  });
  [...m.keys()].forEach(k => { if (!m.get(k).n) m.delete(k); });
  return m;
}
const tot = m => { let km = 0, lt = 0; m.forEach(a => { km += a.km; lt += a.lt; }); return { km, lt, kml: lt ? km / lt : null, placas: m.size }; };
const porProj = m => { const o = new Map(); m.forEach(a => { if (!o.has(a.proj)) o.set(a.proj, { km: 0, lt: 0, placas: 0 }); const p = o.get(a.proj); p.km += a.km; p.lt += a.lt; p.placas++; }); return o; };
const canal = proj => proj.split(' - ')[0];

const A = { cheio: agrega(ANT), dias: agrega(ANT, ultimoDia) }, A2 = { cheio: agrega(ANT2), dias: agrega(ANT2, ultimoDia) }, M = agrega(MES);
const tA = tot(A.cheio), tAd = tot(A.dias), tA2 = tot(A2.cheio), tA2d = tot(A2.dias), tM = tot(M);

log('── 1. Km/L geral (Σkm ÷ Σlitros, a conta do painel) ──');
log(`${pad(ANT2 + ' inteiro', 22)} ${padL(f2(tA2.kml), 6)} km/L · ${f0(tA2.km)} km · ${f0(tA2.lt)} L · ${tA2.placas} placas`);
log(`${pad(ANT2 + ' dias 1→' + ultimoDia, 22)} ${padL(f2(tA2d.kml), 6)} km/L · ${f0(tA2d.km)} km · ${f0(tA2d.lt)} L · ${tA2d.placas} placas`);
log(`${pad(ANT + ' inteiro', 22)} ${padL(f2(tA.kml), 6)} km/L · ${f0(tA.km)} km · ${f0(tA.lt)} L · ${tA.placas} placas`);
log(`${pad(ANT + ' dias 1→' + ultimoDia, 22)} ${padL(f2(tAd.kml), 6)} km/L · ${f0(tAd.km)} km · ${f0(tAd.lt)} L · ${tAd.placas} placas`);
log(`${pad(MES + ' dias 1→' + ultimoDia, 22)} ${padL(f2(tM.kml), 6)} km/L · ${f0(tM.km)} km · ${f0(tM.lt)} L · ${tM.placas} placas`);
log(`  o mês corrente tem ${pct(tM.km, tA.km)} do km e ${pct(tM.lt, tA.lt)} dos litros do mês anterior inteiro (os mesmos dias do anterior tinham ${pct(tAd.km, tA.km)} do km)`);

log('\n── 2. MIX por canal (participação no km e Km/L do canal) ──');
const pc = (m, t) => { const o = new Map(); porProj(m).forEach((p, proj) => { const c = canal(proj); if (!o.has(c)) o.set(c, { km: 0, lt: 0 }); o.get(c).km += p.km; o.get(c).lt += p.lt; }); return o; };
const cA = pc(A.cheio, tA), cAd = pc(A.dias, tAd), cM = pc(M, tM);
log(`${pad('canal', 11)} ${padL(ANT + ' km%', 12)} ${padL('km/L', 6)} ${padL(ANT + ' 1→' + ultimoDia + ' km%', 18)} ${padL('km/L', 6)} ${padL(MES + ' km%', 12)} ${padL('km/L', 6)}`);
['EMPURRADA', 'INSUMOS', 'ROTA', 'AS', 'VAN'].forEach(c => {
  const a = cA.get(c) || { km: 0, lt: 0 }, ad = cAd.get(c) || { km: 0, lt: 0 }, m = cM.get(c) || { km: 0, lt: 0 };
  log(`${pad(c, 11)} ${padL(pct(a.km, tA.km), 12)} ${padL(f2(a.lt ? a.km / a.lt : null), 6)} ${padL(pct(ad.km, tAd.km), 18)} ${padL(f2(ad.lt ? ad.km / ad.lt : null), 6)} ${padL(pct(m.km, tM.km), 12)} ${padL(f2(m.lt ? m.km / m.lt : null), 6)}`);
});
// Km/L do mês corrente com o peso (km por canal) do mês anterior inteiro
{
  let lt = 0, km = 0;
  cA.forEach((a, c) => { const m = cM.get(c); if (!m || !m.lt) return; km += a.km; lt += a.km / (m.km / m.lt); });
  log(`  Km/L do mês corrente com o MIX do mês anterior: ${f2(lt ? km / lt : null)} (sem a mudança de mix) · o painel mostra ${f2(tM.kml)}`);
}

log('\n── 3. Por projeto, nos MESMOS dias (1→' + ultimoDia + ') ──');
const pA2d = porProj(A2.dias), pAd = porProj(A.dias), pA = porProj(A.cheio), pM = porProj(M);
log(`${pad('projeto', 16)} ${padL(ANT2 + ' 1→' + ultimoDia, 14)} ${padL(ANT + ' inteiro', 14)} ${padL(ANT + ' 1→' + ultimoDia, 14)} ${padL(MES, 10)} ${padL('Δ%', 7)}  placas ${ANT}→${MES}`);
[...new Set([...pA.keys(), ...pM.keys()])].sort().forEach(proj => {
  const a2 = pA2d.get(proj), a = pA.get(proj), ad = pAd.get(proj), m = pM.get(proj);
  const k = x => x && x.lt ? x.km / x.lt : null;
  const d = (k(ad) && k(m)) ? ((k(m) / k(ad) - 1) * 100).toFixed(0) + '%' : '—';
  log(`${pad(proj, 16)} ${padL(f2(k(a2)), 14)} ${padL(f2(k(a)), 14)} ${padL(f2(k(ad)), 14)} ${padL(f2(k(m)), 10)} ${padL(d, 7)}  ${a ? a.placas : 0}→${m ? m.placas : 0}`);
});

log('\n── 4. Placa a placa (mês corrente ÷ mês anterior nos mesmos dias, placas com ≥ 300 km nos dois) ──');
const razoes = [], puxa = [];
M.forEach((m, k) => {
  const a = A.dias.get(k); if (!a || a.km < 300 || m.km < 300 || !a.lt || !m.lt) return;
  const ka = a.km / a.lt, km = m.km / m.lt; razoes.push(km / ka);
  // quanto a placa puxa o Km/L geral: litros que ela "economizou" contra a própria régua do mês anterior
  puxa.push({ k, proj: m.proj, placa: m.placa, ka, km, kmM: m.km, ltM: m.lt, n: m.n, nTodos: m.nTodos, ganho: m.km / ka - m.lt });
});
log(`placas comparáveis: ${razoes.length} · mediana da razão ${f2(quant(razoes, .5))} · p25 ${f2(quant(razoes, .25))} · p75 ${f2(quant(razoes, .75))} · acima de 1,3× ${razoes.filter(r => r > 1.3).length} · abaixo de 0,7× ${razoes.filter(r => r < 0.7).length}`);
puxa.sort((a, b) => b.ganho - a.ganho);
log('as 15 que mais puxam para cima (litros a menos que o Km/L do mês anterior previa para o km rodado):');
puxa.slice(0, 15).forEach(p => log(`  ${pad(p.proj, 16)} ${p.placa}  ${f2(p.ka)} → ${f2(p.km)} km/L · ${f0(p.kmM)} km · ${f0(p.ltM)} L · ${p.n} abast. diesel de ${p.nTodos} · ${f0(p.ganho)} L a menos`));
const somaGanho = puxa.reduce((s, p) => s + p.ganho, 0);
log(`  Σ litros "a menos" de todas as comparáveis: ${f0(somaGanho)} L de ${f0(tM.lt)} L do mês (${pct(somaGanho, tM.lt)}); as 15 acima respondem por ${f0(puxa.slice(0, 15).reduce((s, p) => s + p.ganho, 0))} L`);

log('\n── 5. O dado cru por abastecimento ──');
for (const ym of [ANT2, ANT, MES]) {
  const rs = linhas.filter(r => r.ym === ym && (ym !== MES ? r.dia <= ultimoDia : true));
  const ds = rs.filter(r => r.diesel);
  const enc = rs.filter(r => r.encerrada === 'S').length, abertas = rs.length - enc;
  const semKm = ds.filter(r => r.kr == null || r.kr === 0).length, semLt = ds.filter(r => !r.lt).length;
  const kmSemLitro = ds.filter(r => !r.lt).reduce((s, r) => s + (r.kr && r.kr <= KM_MAX && r.kr > 0 ? r.kr : 0), 0);
  const litroSemKm = ds.filter(r => r.kr == null || r.kr === 0).reduce((s, r) => s + r.lt, 0);
  const krs = rs.filter(r => r.kr != null && r.kr > 0).map(r => r.kr);
  const naGuarda = rs.filter(r => r.kr != null && (r.kr < 0 || r.kr > KM_MAX)).length;
  const arlaKm = rs.filter(r => !r.diesel && r.kr > 0 && r.kr <= KM_MAX).reduce((s, r) => s + r.kr, 0);
  const abertasSemKm = rs.filter(r => r.encerrada !== 'S' && r.diesel && (r.kr == null || r.kr === 0)).length;
  log(`${ym} (dias 1→${ultimoDia}): ${rs.length} abastecimentos (${ds.length} diesel) · encerradas ${enc} · abertas ${abertas} (${abertasSemKm} abertas de diesel sem km)`);
  log(`  diesel sem km: ${semKm} (${f0(litroSemKm)} L entram sem km) · diesel sem litro: ${semLt} (${f0(kmSemLitro)} km entram sem litro) · km dos abastecimentos de Arla/outros somado: ${f0(arlaKm)} km (${pct(arlaKm, tot(agrega(ym, ultimoDia)).km)} do km)`);
  log(`  km_rodado por abastecimento: p50 ${f0(quant(krs, .5))} · p90 ${f0(quant(krs, .9))} · máx ${f0(Math.max(0, ...krs))} · fora da guarda (${KM_MAX}) ${naGuarda} · entre 1.500 e ${KM_MAX}: ${krs.filter(k => k > 1500).length}`);
}
log('\n── 6. Placa a placa nos canais que chamaram a atenção (Insumos baixo; Van e Empurrada altos) ──');
for (const c of ['INSUMOS', 'VAN', 'EMPURRADA']) {
  const ps = [...M.values()].filter(a => canal(a.proj) === c).sort((a, b) => (a.proj + a.placa).localeCompare(b.proj + b.placa));
  log(`${c}: ${ps.length} placas no mês corrente`);
  ps.forEach(m => {
    const a = A.cheio.get(m.proj + '|' + m.placa);
    const abs = linhas.filter(r => r.ym === MES && r.proj === m.proj && r.placa === m.placa);
    const semKm = abs.filter(r => r.diesel && !(r.kr > 0)).length, semLt = abs.filter(r => r.diesel && !r.lt).length, arla = abs.filter(r => !r.diesel && r.kr > 0).length;
    const maxKr = Math.max(0, ...abs.map(r => r.kr || 0));
    const obs = [semKm ? `${semKm} diesel sem km` : '', semLt ? `${semLt} diesel sem litro` : '', arla ? `${arla} Arla com km` : '', maxKr > 1500 ? `abast. de ${f0(maxKr)} km` : ''].filter(Boolean).join(' · ');
    log(`  ${pad(m.proj, 16)} ${m.placa}  ${padL(f0(m.km), 7)} km ${padL(f0(m.lt), 6)} L  ${padL(f2(m.lt ? m.km / m.lt : null), 6)} km/L  (${ANT}: ${a ? f2(a.lt ? a.km / a.lt : null) : '—'} km/L, ${a ? f0(a.km) : '—'} km)  ${m.n} abast.${obs ? '  ⚠ ' + obs : ''}`);
  });
}

log('\n── 7. Dia a dia: OS de diesel por dia (mês corrente × anterior) e quando cada OS entrou no banco ──');
{
  const porDia = ym => { const o = {}; linhas.forEach(r => { if (r.ym !== ym || !r.diesel) return; o[r.dia] = (o[r.dia] || 0) + 1; }); return o; };
  const dA = porDia(ANT), dM = porDia(MES);
  const linha = [];
  for (let d = 1; d <= 31; d++) linha.push(`${padL(d, 2)}: ${padL(dM[d] || 0, 3)}/${padL(dA[d] || 0, 3)}`);
  log('  dia: out/set →');
  for (let i = 0; i < 31; i += 8) log('  ' + linha.slice(i, i + 8).join('   '));
  // carregado_em: se for a 1ª aparição, dá o atraso entre abastecer e entrar no banco
  const car = await tudo(`erp_abastecimentos?select=data,carregado_em,tipo_combustivel,filial,projeto_os&data=gte.${ANT}-01&order=data.asc`);
  const dias = car.map(r => ({ d: r.data, c: String(r.carregado_em || '').slice(0, 10) })).filter(r => r.c);
  const distintos = new Set(dias.map(r => r.c));
  log(`  carregado_em: ${distintos.size} data(s) distinta(s) desde ${ANT}: ${[...distintos].sort().slice(-8).join(' · ')}${distintos.size > 8 ? ' (…)' : ''}`);
  if (distintos.size > 3) {
    const lag = dias.map(r => Math.round((Date.parse(r.c) - Date.parse(r.d)) / 86400000)).filter(x => x >= 0);
    log(`  atraso abastecer → entrar (dias): p50 ${quant(lag, .5)} · p75 ${quant(lag, .75)} · p90 ${quant(lag, .9)} · p95 ${quant(lag, .95)} · máx ${Math.max(...lag)} (vale se carregado_em for a 1ª aparição)`);
    const ult = [...distintos].sort().slice(-1)[0];
    const hojeC = car.filter(r => String(r.carregado_em || '').slice(0, 10) === ult);
    const porD = {}; hojeC.forEach(r => { porD[r.data] = (porD[r.data] || 0) + 1; });
    log(`  a carga de ${ult} trouxe ${hojeC.length} OS, com data de abastecimento: ${Object.entries(porD).sort().map(([d, n]) => `${d.slice(5)} ${n}`).join(' · ')}`);
  } else log('  carregado_em é reescrito a cada carga (não serve para medir atraso)');
}

log('\n── 8. Abastecimento por abastecimento das placas que mais puxaram (e CONSUMO_PLACAS, se dado) ──');
{
  const alvo = (process.env.CONSUMO_PLACAS || '').split(/[,\s]+/).filter(Boolean).map(placaKey);
  const lista = alvo.length ? alvo : puxa.slice(0, 4).map(p => p.placa);
  for (const pl of lista) {
    const rs = erp.filter(r => placaKey(r.placa) === pl && String(r.data).slice(0, 7) >= ANT).sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.ordem_servico).localeCompare(String(b.ordem_servico)));
    log(`${pl}: ${rs.length} OS desde ${ANT}`);
    log(`  ${pad('data', 10)} ${pad('OS', 9)} ${pad('produto', 16)} ${padL('litros', 7)} ${padL('hodômetro', 10)} ${padL('km_rod', 7)} ${padL('média', 6)} enc st  projeto`);
    rs.forEach(r => log(`  ${pad(String(r.data).slice(0, 10), 10)} ${pad(r.ordem_servico ?? '', 9)} ${pad(String(r.tipo_combustivel || '(vazio)').slice(0, 16), 16)} ${padL(f0(num(r.litros)), 7)} ${padL(f0(num(r.hodometro)), 10)} ${padL(f0(num(r.km_rodado)), 7)} ${padL(f2(num(r.media_km_l)), 6)} ${pad(r.encerrada || '-', 3)} ${pad(r.status_os ?? '-', 3)} ${String(r.projeto_os || '').slice(0, 20)}`));
  }
}

log('\nLeitura: se "mix do mês anterior" já devolve o Km/L para perto do mês anterior, é composição (quem ainda não abasteceu/encerrou); se o mês anterior nos mesmos dias também sai alto, é o começo do mês; se a razão placa a placa tem mediana perto de 1 e poucas acima de 1,3×, o dado por placa está estável e o salto vem de poucas placas (lista do item 4).');

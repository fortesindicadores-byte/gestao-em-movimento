// ============================================================
// Dispersão de km de set/26 (banco) × ago/26 (aba) — "achei meio altas as
// dispersões. Teve algo atípico? Ficou algo de fora?" (Renan, 14/10/2026)
//
// Roda o MESMO motor do Painel KM (assets/dispersao-km.js, em node:vm) com as
// tabelas do banco e imprime, por unidade × projeto:
//   · ago/26 da aba Dispersão de km (km rem e km rodado brutos, sem balanço)
//   · set/26 do banco (km rem da planilha, km rodado da planilha ou da Km/L)
// e mais: km da Km/L que não caiu em nenhuma linha da planilha (fica de fora
// do painel), placas sem km rodado, origem do projeto de cada placa e o km
// total da Km/L por unidade em ago × set. Só leitura. Sem nome de pessoa.
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const VIG = process.env.VIG || '2026-09';
const ANT = (() => { const [a, m] = VIG.split('-').map(Number); const d = new Date(a, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();

const n = v => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR'));
const pc = (a, b) => (b ? ((a / b - 1) * 100).toFixed(1).replace('.', ',') + '%' : '—');
const pad = (s, w) => String(s).padEnd(w).slice(0, w);
const padl = (s, w) => String(s).padStart(w);

async function todas(caminho) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${caminho.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json(); out.push(...p);
    if (p.length < 1000) return out;
  }
}

const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../assets/dispersao-km.js', import.meta.url), 'utf8'), ctx);
const D = ctx.DispersaoKm;

console.log(`═══ Dispersão de km · ${VIG} (banco) × ${ANT} (aba) ═══\n`);

const [linhas, placas, kml, base] = await Promise.all([
  todas('dispersao_km?select=*'),
  todas('dispersao_placa?select=vigencia,unidade,projeto,placa,placa_origem,km_rem'),
  todas('sh_consumo_km_litro?select=vigencia,projeto,placa,km_rodado_horas_trabalhadas'),
  todas('sh_base?select=slug,colunas,carregado_em,linhas&slug=in.(dispersao_km,consumo_km_litro)')
]);
console.log('bases:', base.map(b => `${b.slug} ${b.linhas} linhas, carregada ${b.carregado_em}`).join(' · '));
console.log(`dispersao_km: ${linhas.length} linhas (${[...new Set(linhas.map(l => l.vigencia))].join(', ')}) · dispersao_placa: ${placas.length}`);

// ── linhas cruas da 01-BD gravadas no banco (para conferir contra a planilha, campo a campo)
console.log(`\n── 01-BD no banco · ${VIG} (cru) ──`);
console.log(['uni', 'projeto', 'frota', 'viag1', 'kmRem1', 'kmRem', 'kmReal', 'R$/km', 'gravada em', 'arquivo'].join(' | '));
linhas.filter(l => l.vigencia === VIG).sort((a, b) => a.projeto.localeCompare(b.projeto) || a.unidade.localeCompare(b.unidade)).forEach(l =>
  console.log([l.unidade, l.projeto, l.frota_ativa, l.viagens_prim, l.km_rem_prim, l.km_rem, l.km_real, l.fator_rskm, l.updated_at, l.arquivo].join(' | ')));
console.log('');

const kmlRows = kml.map(r => { const m = String(r.vigencia || '').match(/^(\d{2})\/(\d{4})$/);
  return { vigencia: m ? m[2] + '-' + m[1] : '', projeto: r.projeto, placa: r.placa, km: +r.km_rodado_horas_trabalhadas || 0 }; });
const kmlVig = kmlRows.filter(r => r.vigencia >= D.INICIO);
const km = D.kmRodado(placas, kmlVig);
const tab = D.monta(linhas, km).filter(l => l.vigencia === VIG);
console.log(`Km/L ${VIG}: ${kmlVig.filter(r => r.vigencia === VIG).length} linhas · repetidas ${km.repetidas} · sem projeto ${km.semProjeto}\n`);

// ── ago/26 da aba Dispersão de km (sh_dispersao_km), pelas mesmas posições do Painel KM
const cols = (base.find(b => b.slug === 'dispersao_km')?.colunas || []).slice().sort((a, b) => a.i - b.i);
const colDe = i => cols.find(c => c.i === i)?.col;
const cV = colDe(0), c13 = colDe(13), c14 = colDe(14), c31 = colDe(31), c32 = colDe(32);
console.log(`aba Dispersão de km: col0=${cV} col14=${c14} col31=${c31} (${cols[31]?.label}) col32=${c32} (${cols[32]?.label})`);
const aba = await todas(`sh_dispersao_km?select=vigencia,${[cV, c13, c14, c31, c32].filter(Boolean).join(',')}`);
const ago = new Map();
aba.forEach(r => {
  const raw = String(r.vigencia || r[cV] || ''); const mm = raw.match(/^(\d{2})\/(\d{4})/); const v = mm ? mm[2] + '-' + mm[1] : raw.slice(0, 7); if (v !== ANT) return;
  const pu = String(r[c14] || ''); const i = pu.indexOf('-');
  const uni = i >= 0 ? pu.slice(i + 1).trim() : String(r[c13] || '').trim(), proj = (i >= 0 ? pu.slice(0, i) : pu).trim();
  const k = uni + '|' + proj; const a = ago.get(k) || { rem: 0, real: 0 };
  a.rem += +r[c31] || 0; a.real += +r[c32] || 0; ago.set(k, a);
});

// projeto da planilha → convenção da aba (a mesma do Painel KM)
const DISP_PROJ = { 'Rota': 'ROTA', 'Auto Serviço': 'AUTO SERVIÇO', 'Van': 'ROTA (VAN)',
  'Empurrada - 28 Palets': 'EMPURRADA', 'Empurrada - 42 Palets': 'EMPURRADA', 'Empurrada - Insumos': 'EMPURRADA' };
const NK = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const projAba = p => NK(DISP_PROJ[p] || p);

// ── tabela por unidade × projeto
console.log(`\n${pad('UNI', 5)}${pad('PROJETO', 24)}${padl('rem ' + ANT.slice(5), 11)}${padl('real', 10)}${padl('disp', 8)} │${padl('rem ' + VIG.slice(5), 11)}${padl('real', 10)}${padl('disp', 8)}${padl('fonte', 9)}${padl('Δrem', 8)}${padl('Δreal', 8)}`);
const porUni = new Map();
const vistosAgo = new Set();
tab.sort((a, b) => a.unidade.localeCompare(b.unidade) || a.projeto.localeCompare(b.projeto)).forEach(l => {
  const kA = l.unidade + '|' + projAba(l.projeto);
  // juntar as linhas do mesmo projeto da aba (Empurrada 28/42/Insumos)
  const a = [...ago.entries()].filter(([k]) => NK(k) === NK(kA)).reduce((s, [k, v]) => { vistosAgo.add(k); return { rem: s.rem + v.rem, real: s.real + v.real }; }, { rem: 0, real: 0 });
  const u = porUni.get(l.unidade) || { remA: 0, realA: 0, rem: 0, real: 0 };
  u.rem += +l.km_rem || 0; u.real += +l.km_rodado || 0; porUni.set(l.unidade, u);
  console.log(`${pad(l.unidade, 5)}${pad(l.projeto, 24)}${padl(n(a.rem), 11)}${padl(n(a.real), 10)}${padl(pc(a.real, a.rem), 8)} │${padl(n(l.km_rem), 11)}${padl(n(l.km_rodado), 10)}${padl(pc(l.km_rodado, l.km_rem), 8)}${padl(l.fonte || '—', 9)}${padl(pc(l.km_rem, a.rem), 8)}${padl(pc(l.km_rodado, a.real), 8)}`);
});
// a aba de ago soma por unidade (todas as linhas, para o total bater)
ago.forEach((v, k) => { const uni = k.split('|')[0]; const u = porUni.get(uni) || { remA: 0, realA: 0, rem: 0, real: 0 }; u.remA += v.rem; u.realA += v.real; porUni.set(uni, u); });
const semPar = [...ago.keys()].filter(k => !vistosAgo.has(k) && (ago.get(k).rem || ago.get(k).real));
if (semPar.length) console.log(`\n${ANT} na aba sem linha em ${VIG}: ` + semPar.map(k => `${k} (rem ${n(ago.get(k).rem)}, real ${n(ago.get(k).real)})`).join(' · '));

console.log(`\n── por unidade ──\n${pad('UNI', 6)}${padl('rem ' + ANT.slice(5), 11)}${padl('real', 10)}${padl('disp', 8)} │${padl('rem ' + VIG.slice(5), 11)}${padl('real', 10)}${padl('disp', 8)}`);
let T = { remA: 0, realA: 0, rem: 0, real: 0 };
[...porUni.entries()].sort().forEach(([u, v]) => { Object.keys(T).forEach(k => T[k] += v[k]);
  console.log(`${pad(u, 6)}${padl(n(v.remA), 11)}${padl(n(v.realA), 10)}${padl(pc(v.realA, v.remA), 8)} │${padl(n(v.rem), 11)}${padl(n(v.real), 10)}${padl(pc(v.real, v.rem), 8)}`); });
console.log(`${pad('TOTAL', 6)}${padl(n(T.remA), 11)}${padl(n(T.realA), 10)}${padl(pc(T.realA, T.remA), 8)} │${padl(n(T.rem), 11)}${padl(n(T.real), 10)}${padl(pc(T.real, T.rem), 8)}`);

// ── o que a Km/L tem e não caiu em linha nenhuma da planilha (fica FORA do painel)
const chaves = new Set(tab.map(l => l.vigencia + '|' + l.unidade + '|' + l.projeto));
const orfaos = new Map();
km.det.filter(d => d.vigencia === VIG && !chaves.has(d.vigencia + '|' + d.unidade + '|' + d.projeto)).forEach(d => {
  const k = d.unidade + '|' + d.projeto; const o = orfaos.get(k) || { km: 0, placas: [] };
  o.km += d.km; o.placas.push(d.placa_origem + ' ' + n(d.km) + ' (' + d.projeto_kml + ', ' + d.origem + ')'); orfaos.set(k, o);
});
console.log(`\n── km da Km/L ${VIG} SEM linha na planilha (fora do painel): ${n([...orfaos.values()].reduce((s, o) => s + o.km, 0))} km ──`);
orfaos.forEach((o, k) => console.log(`  ${k}: ${n(o.km)} km · ${o.placas.slice(0, 12).join(' · ')}${o.placas.length > 12 ? ' …' : ''}`));

// ── origem do projeto das placas de set
const orig = new Map();
km.det.filter(d => d.vigencia === VIG).forEach(d => { const k = d.origem.replace(/\(.*\)/, '(mês anterior)'); const o = orig.get(k) || { n: 0, km: 0 }; o.n++; o.km += d.km; orig.set(k, o); });
console.log(`\n── de onde veio o projeto de cada placa (${VIG}) ──`);
orig.forEach((o, k) => console.log(`  ${pad(k, 26)} ${padl(o.n, 4)} placas · ${n(o.km)} km`));

// placas da Km/L SEM a placa na lista de set (rodaram e não têm km remunerado nesse mês)
const naLista = new Set(placas.filter(p => p.vigencia === VIG).map(p => p.unidade + '|' + p.placa));
const semRem = km.det.filter(d => d.vigencia === VIG && d.projeto !== 'Van' && !naLista.has(d.unidade + '|' + d.placa));
const sr = new Map(); semRem.forEach(d => { const k = d.unidade + '|' + d.projeto; const o = sr.get(k) || { n: 0, km: 0, p: [] }; o.n++; o.km += d.km; o.p.push(d.placa_origem + ' ' + n(d.km)); sr.set(k, o); });
console.log(`\n── placas que rodaram em ${VIG} (Km/L) e NÃO estão na lista de placas da planilha do mês (km sem remunerado): ${semRem.length} placas, ${n(semRem.reduce((s, d) => s + d.km, 0))} km ──`);
[...sr.entries()].sort((a, b) => b[1].km - a[1].km).forEach(([k, o]) => console.log(`  ${pad(k, 28)} ${padl(o.n, 3)} placas · ${padl(n(o.km), 8)} km · ${o.p.slice(0, 8).join(' · ')}${o.p.length > 8 ? ' …' : ''}`));

// placas da planilha com km remunerado e SEM km na Km/L
const comKm = new Set(km.det.filter(d => d.vigencia === VIG).map(d => d.placa));
const semKm = placas.filter(p => p.vigencia === VIG && p.projeto !== 'Van' && !comKm.has(p.placa));
console.log(`\n── placas da planilha (${VIG}) com km remunerado e SEM km na Km/L: ${semKm.length} placas, ${n(semKm.reduce((s, p) => s + (+p.km_rem || 0), 0))} km rem ──`);
const sk = new Map(); semKm.forEach(p => { const k = p.unidade + '|' + p.projeto; const o = sk.get(k) || { n: 0, km: 0 }; o.n++; o.km += +p.km_rem || 0; sk.set(k, o); });
sk.forEach((o, k) => console.log(`  ${pad(k, 28)} ${padl(o.n, 3)} placas · ${n(o.km)} km rem`));

// lista de placas × 01-BD: o km rem por unidade × projeto bate?
{ const ps = placas.filter(p => p.vigencia === VIG); const vz = ps.filter(p => !(+p.km_rem > 0));
  console.log(`\n── lista de placas ${VIG}: ${ps.length} placas · ${vz.length} sem km rem · por projeto: ` +
    Object.entries(ps.reduce((o, p) => (o[p.unidade + '|' + p.projeto] = (o[p.unidade + '|' + p.projeto] || 0) + 1, o), {})).map(([k, c]) => k + ' ' + c).join(' · '));
  console.log('amostra vigência da aba:', JSON.stringify(aba.slice(0, 2).map(r => ({ v: r.vigencia, o: r[cV] })))); }
console.log(`\n── km rem: 01-BD × lista de placas (${VIG}) ──`);
const lp = new Map(); placas.filter(p => p.vigencia === VIG).forEach(p => { const k = p.unidade + '|' + p.projeto; lp.set(k, (lp.get(k) || 0) + (+p.km_rem || 0)); });
tab.forEach(l => { const k = l.unidade + '|' + l.projeto; const v = lp.get(k) || 0; const d = (+l.km_rem || 0) - v;
  if (Math.abs(d) > 1000) console.log(`  ${pad(k, 32)} 01-BD ${padl(n(l.km_rem), 9)} · placas ${padl(n(v), 9)} · Δ ${n(d)}`); });

// km da Km/L por unidade, ago × set (o rodado andou?)
console.log(`\n── km total da aba Km/L por unidade (${ANT} × ${VIG}) ──`);
const kU = new Map(); const vist = new Set();
kmlRows.forEach(r => { if (r.vigencia !== ANT && r.vigencia !== VIG) return; const pm = D.merc(r.placa); const ch = r.vigencia + '|' + pm; if (vist.has(ch)) return; vist.add(ch);
  const pk = D.projetoKml(r.projeto); const u = pk ? pk.uni : '(?)'; const o = kU.get(u) || {}; o[r.vigencia] = (o[r.vigencia] || 0) + r.km; kU.set(u, o); });
[...kU.entries()].sort().forEach(([u, o]) => console.log(`  ${pad(u, 6)} ${padl(n(o[ANT]), 10)} → ${padl(n(o[VIG]), 10)}  (${pc(o[VIG], o[ANT])})`));

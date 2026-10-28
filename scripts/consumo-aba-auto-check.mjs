// ============================================================
// Consumo Aba × Auto — a aba Km/L que o Renan colava (sh_consumo_km_litro)
// contra o consumo automático (ca_consumo_km_litro, ERP + Freightech), mês a
// mês (Renan, 28/10/2026: "confira o resultado dos outros meses, de janeiro a
// set, e compare com o resultado que eu subia. Todas unidades juntas e CGR").
// Só leitura. Imprime só agregados (placas, km, litros, Km/L, R$/L).
// Km/L rem = régua dos painéis: rem de cada projeto × mês = média simples do
// KM/l Rem Médio; litros previstos = km ÷ esse rem; Km/L rem = Σkm ÷ Σprevistos.
// Env: CHECK_DE (AAAA-MM, 2026-01), CHECK_ATE (AAAA-MM, 2026-09), CHECK_UNI (CGR).
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!KEY) { console.error('::error::GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const DE = process.env.CHECK_DE || '2026-01', ATE = process.env.CHECK_ATE || '2026-09';
const UNIS = (process.env.CHECK_UNI || 'CGR').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
async function tudo(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    let p;
    for (let t = 1; ; t++) {
      const r = await fetch(`${SUPA}/rest/v1/${path}&limit=1000&offset=${off}`, { headers: H });
      if (r.ok) { p = await r.json(); break; }
      if (r.status < 500 || t >= 4) throw new Error(`HTTP ${r.status} ${path.slice(0, 60)}`);
      await new Promise(x => setTimeout(x, 3000 * t));
    }
    out.push(...p); if (p.length < 1000) break;
  }
  return out;
}
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const SEL = 'select=projeto,vigencia_orig,placa,km_rodado_horas_trabalhadas,qtd_total_de_litros,totas_rs,km_l_rem_medio&order=linha.asc';
const [aba, auto] = await Promise.all([tudo(`sh_consumo_km_litro?${SEL}`), tudo(`ca_consumo_km_litro?${SEL}`)]);
console.log(`linhas: aba ${aba.length} · automático ${auto.length}`);
const ymDe = r => String(r.vigencia_orig || '').slice(0, 7);
function agrega(rows, filtro) {
  const m = new Map();
  rows.forEach(r => { const ym = ymDe(r); if (ym < DE || ym > ATE || !filtro(r)) return;
    if (!m.has(ym)) m.set(ym, { placas: new Set(), km: 0, lit: 0, rs: 0, proj: new Map() });
    const a = m.get(ym); const km = num(r.km_rodado_horas_trabalhadas) || 0, lit = num(r.qtd_total_de_litros) || 0;
    a.placas.add(String(r.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')); a.km += km; a.lit += lit; a.rs += num(r.totas_rs) || 0;
    const pk = String(r.projeto || ''); if (!a.proj.has(pk)) a.proj.set(pk, { km: 0, rems: [] });
    const p = a.proj.get(pk); p.km += km; const rem = num(r.km_l_rem_medio); if (rem > 0) p.rems.push(rem); });
  m.forEach(a => { let km = 0, prev = 0; a.proj.forEach(p => { if (!p.rems.length) return; const rem = p.rems.reduce((s, x) => s + x, 0) / p.rems.length; km += p.km; prev += p.km / rem; }); a.rem = prev ? km / prev : null; });
  return m;
}
const f0 = v => v == null ? '—' : Math.round(v).toLocaleString('pt-BR');
const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dp = (a, b) => (a && b) ? ((b / a - 1) * 100).toFixed(1).replace('.', ',') + '%' : '—';
function tabela(rot, filtro) {
  const A = agrega(aba, filtro), N = agrega(auto, filtro);
  const meses = [...new Set([...A.keys(), ...N.keys()])].sort();
  console.log(`\n── ${rot} · aba (A) × automático (N) ──`);
  console.log(['mês', 'placas A×N', 'km A', 'km N', 'Δkm', 'litros A', 'litros N', 'Δlit', 'Km/L A', 'Km/L N', 'ΔKm/L', 'rem A', 'rem N', 'R$/L A', 'R$/L N'].join(' | '));
  const T = { A: { km: 0, lit: 0, rs: 0 }, N: { km: 0, lit: 0, rs: 0 } };
  meses.forEach(ym => { const a = A.get(ym) || { placas: new Set(), km: 0, lit: 0, rs: 0 }, n = N.get(ym) || { placas: new Set(), km: 0, lit: 0, rs: 0 };
    ['km', 'lit', 'rs'].forEach(k => { T.A[k] += a[k]; T.N[k] += n[k]; });
    const ka = a.lit ? a.km / a.lit : null, kn = n.lit ? n.km / n.lit : null;
    console.log([ym, `${a.placas.size}×${n.placas.size}`, f0(a.km), f0(n.km), dp(a.km, n.km), f0(a.lit), f0(n.lit), dp(a.lit, n.lit), f2(ka), f2(kn), dp(ka, kn), f2(a.rem), f2(n.rem), f2(a.lit ? a.rs / a.lit : null), f2(n.lit ? n.rs / n.lit : null)].join(' | ')); });
  const ka = T.A.km / T.A.lit, kn = T.N.km / T.N.lit;
  console.log(['TOTAL', '', f0(T.A.km), f0(T.N.km), dp(T.A.km, T.N.km), f0(T.A.lit), f0(T.N.lit), dp(T.A.lit, T.N.lit), f2(ka), f2(kn), dp(ka, kn), '', '', f2(T.A.rs / T.A.lit), f2(T.N.rs / T.N.lit)].join(' | '));
}
tabela('TODAS AS UNIDADES', () => true);
UNIS.forEach(u => tabela(u, r => new RegExp(`- ${u}$`).test(String(r.projeto || '').toUpperCase().trim())));

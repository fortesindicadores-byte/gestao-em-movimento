// ver o cabeçalho de SIMULAÇÃO abaixo — o harness é o mesmo do scorecard-ics-check.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = process.env.GEM_SUPABASE_SERVICE_KEY
            || 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';

const ctx = vm.createContext({ console, fetch, setTimeout, clearTimeout });
vm.runInContext('globalThis.window = globalThis;', ctx);

// ── supabase.createClient mínimo: from().select().eq().in() → REST ──
ctx.supabase = {
  createClient: () => ({
    from(tab) {
      const st = { tab, sel: '*', qs: [] };
      const run = async () => {
        const url = `${SB_URL}/rest/v1/${st.tab}?select=${encodeURIComponent(st.sel)}`
                  + (st.qs.length ? '&' + st.qs.join('&') : '');
        const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
        if (!r.ok) return { data: null, error: new Error(r.status + ' ' + (await r.text()).slice(0, 200)) };
        return { data: await r.json(), error: null };
      };
      const api = {
        select(s) { st.sel = s; return api; },
        eq(c, v) { st.qs.push(`${c}=eq.${encodeURIComponent(v)}`); return api; },
        in(c, arr) { st.qs.push(`${c}=in.(${arr.map(x => '"' + x + '"').join(',')})`); return api; },
        then(res, rej) { return run().then(res, rej); },
      };
      return api;
    },
  }),
};

// ── document mínimo: o <script> do JSONP vira fetch + eval no mesmo contexto ──
ctx.document = {
  createElement: () => ({ remove() {} }),
  head: {
    appendChild(el) {
      fetch(el.src)
        .then(r => (r.ok ? r.text() : Promise.reject(new Error('http ' + r.status))))
        .then(t => vm.runInContext(t, ctx))
        .catch(() => { if (el.onerror) el.onerror(); });
    },
  },
};

vm.runInContext(fs.readFileSync(new URL('../assets/gerot-base.js', import.meta.url), 'utf8'), ctx);


// ============================================================
// SIMULAÇÃO — o que muda no Frota de Elite se o Combustível passar a sair
// da régua do painel oficial (Renan, 24/09/2026: "Deve ler dos painéis
// oficiais… Só mude caso depois de eu avaliar se mudaria muito a colocação").
//
// Três réguas para o MESMO indicador, da MESMA aba Km/L:
//   A · HOJE (gerot-base combUm): rem = média simples de TODAS as linhas
//       placa-mês da filial; atg = (Σkm ÷ Σlitros) ÷ rem.
//   B · PAINEL OFICIAL (eficiencia-kml aggRows, modo "medio"): rem = média
//       simples POR PROJETO, projetos ponderados pelo km; atg = real ÷ rem.
//   C · LITROS: litros esperados = Σ km_proj ÷ rem_proj; atg = esperados ÷
//       gastos. É a régua da fusão do MACACU e do Km/L da Seara.
// A pontuação é a do painel (calcScore_: pesos do programa, teto 100 por
// indicador, peso redistribuído quando falta indicador). NADA é gravado.
// A régua A é recalculada aqui e CONFERIDA contra o que o gerot-base
// entrega — se não bater, a simulação não vale e o script avisa.
// ============================================================
// régua que o gerot-base usa hoje: C desde 24/09/2026 (a de litros esperados)
const CONTROLE = process.env.CONTROLE || 'C';
const GerotBase = ctx.window.GerotBase;
if (!GerotBase) { console.log('GerotBase não carregou'); process.exit(1); }
const recs = await GerotBase.load({ fundir: true });
console.log('records do GerotBase (fundir:true):', recs.length);

const NOMES = ['MACACU','CDD PELOTAS','CDD RONDONOPOLIS','CDD NOVA FRIBURGO','CDD RIO DE JANEIRO','CDD FLORIANOPOLIS',
  'CDD CUIABA','CDD GUARULHOS','CDD CAMBORIU','PIRAI EMPURRADA','CUIABA EMPURRADA','CUIABA'];
const W = { disp:20, prev:15, comb:10, pneus:10, checkT:10, checkWH:10, conf:5, stVeic:5, stEmp:5, sla:5, civf:5 };
const score = f => { let n = 0, d = 0; for (const k in W) { const v = f[k]; if (v == null) continue; const w = W[k] / 100; d += w; n += w * Math.min(1, v / 100); } return d > 0 ? n / d * 100 : null; };

// ── Km/L: a mesma leitura do gerot-base (col 0 vig · 14 projeto · 22 km · 23 litros · 4 rem médio)
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
const j = parse(await (await fetch(`https://docs.google.com/spreadsheets/d/${KML_ID}/gviz/tq?sheet=${encodeURIComponent('Km/L')}&tqx=out:json`)).text());
const nRaw = c => { if (!c || c.v == null) return 0; const n = Number(c.v); return isFinite(n) ? n : 0; };
function gvig(c) { if (!c) return null; const v = c.v; let m = String(v).match(/Date\((\d+),(\d+)/); if (m) return m[1] + '-' + String(+m[2] + 1).padStart(2, '0');
  const f = String(c.f != null ? c.f : (v != null ? v : '')); m = f.match(/(\d{1,2})[\/\-](\d{4})/); if (m) return m[2] + '-' + m[1].padStart(2, '0');
  m = f.match(/(\d{4})[\/\-](\d{1,2})/); if (m) return m[1] + '-' + m[2].padStart(2, '0'); return null; }
const NK = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const linhas = (j.table.rows || []).map(r => { const c = r.c || []; const vig = gvig(c[0]); if (!vig) return null;
  const proj = String(c[14] && c[14].v != null ? c[14].v : ''); const k = proj.indexOf('-');
  return { vig, proj, pre: (k >= 0 ? proj.slice(0, k) : proj).trim(), km: nRaw(c[22]), lit: nRaw(c[23]), rem: nRaw(c[4]) }; }).filter(Boolean);

// filial → código, igual ao gerot-base (UNI2COD + projMatchUni)
const UNI2COD = {'CDD CAMBORIU':'BLC','CDD CUIABA':'CBA','CUIABA':'CBA','CUIABA EMPURRADA':'CBA','CDD FLORIANOPOLIS':'FLP','CDD GUARULHOS':'GRL','CDD NOVA FRIBURGO':'NFR','CDD PELOTAS':'PLT','CDD RIO DE JANEIRO':'CGR','CDD RONDONOPOLIS':'RON','CDI MACACU':'MCC','MACACU EMPURRADA':'MCC','PIRAI EMPURRADA':'PIR','CDD GOIANIA':'GNA'};
const SEM_KM = new Set(['CUIABA']);
function casa(uni, proj) { const p = NK(proj), cod = UNI2COD[uni]; if (!cod || !p.includes(cod)) return false;
  const emp = /EMPURRAD/.test(p);
  if (uni === 'CUIABA EMPURRADA' || uni === 'MACACU EMPURRADA') return emp;
  if (uni === 'CDD CUIABA' || uni === 'CDI MACACU') return !emp; return true; }
const FUSAO = { 'CDI MACACU': 'MACACU', 'MACACU EMPURRADA': 'MACACU' };

// três réguas para um conjunto de linhas de UMA filial (1 ou n vigências)
function reguas(ls) {
  const km = ls.reduce((s, l) => s + l.km, 0), lit = ls.reduce((s, l) => s + l.lit, 0);
  const rems = ls.filter(l => l.rem > 0).map(l => l.rem);
  if (!lit || !rems.length) return null;
  const real = km / lit;
  const A = real / (rems.reduce((s, x) => s + x, 0) / rems.length) * 100;
  // B: por projeto (média burra das linhas do projeto na janela), ponderado pelo km do projeto
  const pj = {}; ls.forEach(l => { const o = pj[l.pre] || (pj[l.pre] = { s: 0, n: 0, km: 0 }); if (l.rem > 0) { o.s += l.rem; o.n++; } o.km += l.km; });
  let sM = 0, kM = 0; Object.values(pj).forEach(o => { if (o.n && o.km > 0) { sM += o.s / o.n * o.km; kM += o.km; } });
  const B = kM ? real / (sM / kM) * 100 : null;
  // C: litros esperados por projeto × mês (rem do projeto no mês)
  const pm = {}; ls.forEach(l => { const k = l.pre + '|' + l.vig; const o = pm[k] || (pm[k] = { s: 0, n: 0, km: 0 }); if (l.rem > 0) { o.s += l.rem; o.n++; } o.km += l.km; });
  let esp = 0; Object.values(pm).forEach(o => { if (o.n && o.km > 0) esp += o.km / (o.s / o.n); });
  const C = esp ? esp / lit * 100 : null;
  return { A, B, C, lit };
}
// por unidade do programa (com a fusão do MACACU pelo pool de litros, como o combFunde)
function combPor(vigs) {
  const porFil = {};
  for (const uni in UNI2COD) { if (SEM_KM.has(uni)) continue;
    const ls = linhas.filter(l => vigs.includes(l.vig) && casa(uni, l.proj)); const r = reguas(ls); if (r) porFil[uni] = r; }
  const out = {};
  Object.entries(porFil).forEach(([uni, r]) => { const u = FUSAO[uni] || uni; (out[u] = out[u] || []).push(r); });
  const res = {};
  Object.entries(out).forEach(([u, rs]) => {
    const lit = rs.reduce((s, r) => s + r.lit, 0);
    res[u] = {}; ['A', 'B', 'C'].forEach(k => { const e = rs.reduce((s, r) => s + (r[k] == null ? 0 : r[k] / 100 * r.lit), 0); res[u][k] = lit ? e / lit * 100 : null; });
  });
  return res;
}

// campos (os outros 10 indicadores) por unidade: mês a mês e acumulado
const porMes = {};
recs.forEach(r => { if (!NOMES.includes(r.unit)) return; ((porMes[r.vig] = porMes[r.vig] || {})[r.unit] = porMes[r.vig][r.unit] || {})[r.field] = r.atg; });
const vigs = Object.keys(porMes).filter(v => v >= '2026-01').sort();
console.log('vigências:', vigs.join(' '));

const f1 = v => v == null ? '   —  ' : v.toFixed(1).padStart(6);
function rank(obj) { const ord = Object.entries(obj).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]); const p = {}; ord.forEach(([u], i) => p[u] = i + 1); return p; }
const resumo = [];
function simula(rot, campos, comb) {
  const pont = { A: {}, B: {}, C: {} }; let confere = 0, diverge = [];
  Object.entries(campos).forEach(([u, f]) => {
    const c = comb[u] || {};
    // desde 24/09/2026 o gerot-base JÁ usa a régua C — o controle diz qual das
    // réguas simuladas bate com o que o leitor entrega
    const ref = CONTROLE === 'C' ? c.C : c.A;
    if (f.comb != null && ref != null) { if (Math.abs(f.comb - ref) < 0.05) confere++; else diverge.push(`${u} gerot ${f.comb.toFixed(2)} × simulação ${ref.toFixed(2)}`); }
    ['A', 'B', 'C'].forEach(k => { pont[k][u] = score(Object.assign({}, f, { comb: c[k] ?? null })); });
  });
  const pA = rank(pont.A), pB = rank(pont.B), pC = rank(pont.C);
  console.log(`\n═══ ${rot} ═══   controle: régua ${CONTROLE} recalculada bate com o gerot-base em ${confere} unidade(s)${diverge.length ? ' · DIVERGE: ' + diverge.join(' | ') : ''}`);
  console.log('  unidade'.padEnd(22) + 'comb A'.padStart(7) + 'comb B'.padStart(7) + 'comb C'.padStart(7) + '  │' + 'pont A'.padStart(7) + 'pont B'.padStart(7) + 'pont C'.padStart(7) + '  │ pos A→B  A→C');
  Object.keys(pA).sort((a, b) => pA[a] - pA[b]).forEach(u => {
    const c = comb[u] || {}, f = campos[u];
    const mv = (x, y) => (x === y ? `${x}º`.padStart(4) + '    ' : `${x}º→${y}º`.padStart(8));
    console.log('  ' + u.padEnd(20) + f1(f.comb ?? null) + f1(c.B) + f1(c.C) + '  │' + f1(pont.A[u]) + f1(pont.B[u]) + f1(pont.C[u]) + '  │' + mv(pA[u], pB[u]) + mv(pA[u], pC[u]));
  });
  const mudB = Object.keys(pA).filter(u => pA[u] !== pB[u]).length, mudC = Object.keys(pA).filter(u => pA[u] !== pC[u]).length;
  const top = p => Object.keys(p).sort((a, b) => p[a] - p[b]).slice(0, 3).join(' · ');
  const maxB = Math.max(0, ...Object.keys(pA).map(u => Math.abs(pA[u] - (pB[u] ?? pA[u])))), maxC = Math.max(0, ...Object.keys(pA).map(u => Math.abs(pA[u] - (pC[u] ?? pA[u]))));
  resumo.push({ rot, mudB, mudC, maxB, maxC, podA: top(pA), podB: top(pB), podC: top(pC) });
}
vigs.forEach(v => simula(v, porMes[v], combPor([v])));
// acumulado jan→último mês: os 10 indicadores pelo acumFor do próprio gerot-base
const acum = {}; GerotBase.acumFor(vigs).forEach(r => { if (!NOMES.includes(r.unit)) return; (acum[r.unit] = acum[r.unit] || {})[r.field] = r.atg; });
simula(`ACUMULADO ${vigs[0]} → ${vigs[vigs.length - 1]}`, acum, combPor(vigs));

console.log('\n═══ RESUMO — quantas unidades trocam de posição (máx. de casas) · pódio ═══');
resumo.forEach(r => {
  console.log(`  ${r.rot.padEnd(28)} B: ${String(r.mudB).padStart(2)} mudam (máx ${r.maxB}) · C: ${String(r.mudC).padStart(2)} mudam (máx ${r.maxC})`);
  if (r.podA !== r.podB || r.podA !== r.podC) console.log(`      pódio A: ${r.podA}\n      pódio B: ${r.podB}\n      pódio C: ${r.podC}`);
});

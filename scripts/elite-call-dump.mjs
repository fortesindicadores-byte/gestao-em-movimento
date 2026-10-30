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
// Elite Call Dump — os números da Call de Resultados do Frota de Elite
// (Renan, 30/10/2026: "Gerar apresentação" no Frota de Elite). Só leitura.
// Roda o próprio assets/gerot-base.js (fundir:true, como o painel) e monta as
// linhas com a MESMA conta do programa-reconhecimento (buildEliteRows +
// calcScore_), mês a mês e o acumulado (acumFor). Imprime um JSON por linha
// (ELITE_JSON) com a pontuação por unidade e indicador — nível unidade, sem
// pessoa, placa nem valor em R$.
// ============================================================
const GB = ctx.window.GerotBase;
if (!GB) { console.log('GerotBase não carregou'); process.exit(1); }
const recs = await GB.load({ fundir: true });
const NOMES = ['MACACU','CDD PELOTAS','CDD RONDONOPOLIS','CDD NOVA FRIBURGO','CDD RIO DE JANEIRO','CDD FLORIANOPOLIS',
  'CDD CUIABA','CDD GUARULHOS','CDD CAMBORIU','PIRAI EMPURRADA','CUIABA EMPURRADA','CUIABA'];
const W = { disp:20, prev:15, comb:10, pneus:10, checkT:10, checkWH:10, conf:5, stVeic:5, stEmp:5, sla:5, civf:5 };
const score = f => { let n = 0, d = 0; for (const k in W) { const v = f[k]; if (v == null) continue; const w = W[k] / 100; d += w; n += w * Math.min(1, v / 100); } return d > 0 ? n / d * 100 : null; };
const linhas = rs => { const m = new Map();
  rs.forEach(r => { if (!NOMES.includes(r.unit)) return; const k = (r.vig || 'acum') + '|' + r.unit;
    if (!m.has(k)) m.set(k, { vig: r.vig || 'acum', unit: r.unit, f: {} }); m.get(k).f[r.field] = r.atg; });
  return [...m.values()].map(o => ({ vig: o.vig, unit: o.unit, ...Object.fromEntries(Object.keys(W).map(k => [k, o.f[k] ?? null])), pont: score(o.f) })); };
const ATE = process.env.ATE || '2026-09';
const mes = linhas(recs).filter(r => r.vig >= '2026-01' && r.vig <= ATE);
const vigs = [...new Set(mes.map(r => r.vig))].sort();
console.log('records', recs.length, '· vigências', vigs.join(' '));
const acum = {};
for (const v of vigs) { const janela = vigs.filter(x => x <= v); if (janela.length > 1) acum[v] = linhas(GB.acumFor(janela).map(r => ({ ...r, vig: null }))); }
console.log('ELITE_JSON ' + JSON.stringify({ gerado: new Date().toISOString(), ate: ATE, vigs, mes, acum }));

// ============================================================
// Volkstotal Check — o portal da VW × a planilha "Contratos Man."
// (Renan, 15/09/2026: "antes de mudar algo na carta de custos, vamos comparar
//  vigência a vigência o que subiu e o que o robô buscou de km e valores")
//
// É a etapa que a migração do Km/L ensinou a não pular: lá o comparador rodou
// ANTES da troca de fonte e pegou justamente o que a planilha escondia. Aqui
// ele responde, mês a mês: as duas fontes contam as mesmas placas? somam o
// mesmo km? o mesmo valor? e, quando não, QUAIS placas explicam a diferença.
//
// Não escreve nada. Lê `vw_contrato_km` (o que o robô buscou) e a planilha
// (o que está subindo hoje), usando a MESMA leitura do contratos-robot — se a
// planilha for lida de outro jeito, a comparação não vale.
//
// Uso: node scripts/volkstotal-check.mjs
// Env: VT_VIG (AAAA-MM, lista — vazio = todas as que existirem dos dois lados)
// ============================================================
const SHEET  = process.env.CONTRATOS_ID || '1FOIUgEKtOdTrNUyOYd8wk5Cyur6cFIf7-COr_l4hEsI';
const GID    = process.env.CONTRATOS_GID || '0';
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
const SO_VIG = (process.env.VT_VIG || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);

const brl   = v => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = v => Math.round(+v || 0).toLocaleString('pt-BR');
const pct   = (a, b) => !b ? (a ? '—' : '0,0%') : ((a / b - 1) * 100).toFixed(1).replace('.', ',') + '%';

// ── a planilha, lida EXATAMENTE como o contratos-robot lê ─────────────────
const parse  = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
const txtOf  = c => !c ? '' : (c.f != null ? String(c.f) : (c.v == null ? '' : String(c.v)));
function numOf(c) {
  if (!c) return 0;
  if (typeof c.v === 'number' && isFinite(c.v)) return c.v;
  let s = String(c.v != null ? c.v : (c.f || '')).replace(/[R$\s ]/g, '');
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (ult >= 0) {
    const casas = s.length - ult - 1;
    if (casas === 3 && s.slice(0, ult).match(/[.,]/) === null && !/[.,]/.test(s.slice(ult + 1))) {
      s = s.replace(/[.,]/g, '');
    } else {
      s = s.slice(0, ult).replace(/[.,]/g, '') + '.' + s.slice(ult + 1);
    }
  }
  const n = parseFloat(s);
  return isFinite(n) ? (neg ? -n : n) : 0;
}
const MES3 = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12,
               feb:2, apr:4, may:5, aug:8, sep:9, oct:10, dec:12 };
function mesDoRotulo(s) {
  const m = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .match(/([a-z]{3})[a-z.]*[\s\-\/]+(\d{2,4})/);
  if (!m || !MES3[m[1]]) return null;
  const ano = +m[2] < 100 ? 2000 + +m[2] : +m[2];
  return `${ano}-${String(MES3[m[1]]).padStart(2, '0')}`;
}
/* A PLACA É A CHAVE DA COMPARAÇÃO, e os dois lados podem estar em formatos
   diferentes: a planilha é digitada à mão, o portal vem do cadastro da VW.
   Normalizar para Mercosul é o que o resto do portal já faz — é só para
   CRUZAR; cada lado continua mostrando a placa como ela veio. */
const D2L = '0123456789';
function placaKey(p) {
  const s = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d{4}$/.test(s)) return s;
  return s.slice(0, 4) + 'ABCDEFGHIJ'[D2L.indexOf(s[4])] + s.slice(5);
}

async function daPlanilha() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq`
    + `?gid=${GID}&tqx=out:json&headers=0&tq=${encodeURIComponent('select *')}`;
  const j = parse(await (await fetch(url)).text());
  if (j.status !== 'ok') throw new Error('gviz: ' + j.status + ' ' + JSON.stringify(j.errors || {}));
  const rows = (j.table.rows || []).map(r => r.c || []);
  const nCols = (j.table.cols || []).length;
  const L1 = rows[0] || [];
  const marcos = [];
  for (let i = 0; i < nCols; i++) { const r = txtOf(L1[i]).trim(); if (r) marcos.push({ rot: r, ini: i }); }
  const blocos = marcos.map((m, k) => {
    const fim = k + 1 < marcos.length ? marcos[k + 1].ini : nCols;
    return { vig: mesDoRotulo(m.rot), km: m.ini, desloc: m.ini + 1, valor: m.ini + 2, largura: fim - m.ini };
  }).filter(b => b.vig);

  // as colunas de identificação são DESCOBERTAS, como no robô: a planilha já
  // foi reorganizada uma vez e a leitura por posição caiu para zero em silêncio
  const idCols = blocos.length ? blocos[0].km : Math.min(nCols, 6);
  const amostra = rows.slice(2, 200);
  const ehPlaca = v => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  let colPlaca = -1, melhor = 0;
  for (let c = 0; c < idCols; c++) {
    const n = amostra.reduce((a, r) => a + (ehPlaca(txtOf(r[c])) ? 1 : 0), 0);
    if (n > melhor) { melhor = n; colPlaca = c; }
  }
  if (colPlaca < 0) throw new Error('não achei a coluna de placa na planilha');
  const ehContrato = v => /^[A-Z]{1,2}\s?\d{3,6}\s?[A-Z]{0,2}$/.test(String(v || '').toUpperCase().trim());
  let colCt = -1, melhorC = 0;
  for (let c = 0; c < idCols; c++) {
    if (c === colPlaca) continue;
    const n = amostra.reduce((a, r) => a + (ehContrato(txtOf(r[c])) ? 1 : 0), 0);
    if (n > melhorC) { melhorC = n; colCt = c; }
  }

  const out = [];
  for (const b of blocos) {
    for (const r of rows.slice(2)) {
      const placa = placaKey(txtOf(r[colPlaca]));
      if (!placa) continue;
      const valor = numOf(r[b.valor]), desloc = numOf(r[b.desloc]);
      if (!(valor > 0) && !(desloc > 0)) continue;
      out.push({ vig: b.vig, placa, contrato: colCt >= 0 ? txtOf(r[colCt]).trim().toUpperCase() : '',
                 km: desloc, valor });
    }
  }
  console.log(`planilha: ${out.length} linha(s) · ${blocos.length} bloco(s) de mês`
    + ` · placa na coluna ${String.fromCharCode(65 + colPlaca)} (${melhor}/${amostra.length})`
    + (colCt >= 0 ? ` · contrato na ${String.fromCharCode(65 + colCt)} (${melhorC}/${amostra.length})` : ''));
  return out;
}

// ── o portal ──────────────────────────────────────────────────────────────
async function doPortal() {
  if (!SB_KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
  const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  // o PostgREST corta em 1.000 linhas: sem paginar a comparação sairia com
  // parte do portal faltando e acusaria diferença que não existe
  const out = []; const passo = 1000;
  for (let off = 0; ; off += passo) {
    const r = await fetch(`${SB_URL}/rest/v1/vw_contrato_km`
      + `?select=contrato,vigencia,placa,chassi,km_rodado,valor&order=vigencia.asc,contrato.asc`
      + `&offset=${off}&limit=${passo}`, { headers: H });
    if (!r.ok) throw new Error(`vw_contrato_km: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json();
    out.push(...p);
    if (p.length < passo) break;
  }
  console.log(`portal:   ${out.length} linha(s) em vw_contrato_km`);
  return out.map(l => ({ vig: l.vigencia, placa: placaKey(l.placa || l.chassi),
                         contrato: String(l.contrato || '').toUpperCase(),
                         km: +l.km_rodado || 0, valor: +l.valor || 0 }));
}

// ── comparação ────────────────────────────────────────────────────────────
const [plan, port] = await Promise.all([daPlanilha(), doPortal()]);
if (!port.length) {
  console.log('\n⚠ vw_contrato_km está VAZIA — rode o Volkstotal Robot em modo "gravar" antes.');
  process.exit(0);
}

const soma = (arr, vig) => arr.filter(l => l.vig === vig)
  .reduce((a, l) => ({ n: a.n + 1, km: a.km + l.km, v: a.v + l.valor, placas: a.placas.add(l.placa) }),
          { n: 0, km: 0, v: 0, placas: new Set() });

const vigs = [...new Set([...plan, ...port].map(l => l.vig))]
  .filter(v => !SO_VIG.length || SO_VIG.includes(v)).sort();

console.log('\n══ POR VIGÊNCIA ═══════════════════════════════════════════════════');
console.log('vigência   placas P/p        km portal      km planilha   Δkm'
  + '        valor portal    valor planilha   Δvalor');
let difVal = 0, difKm = 0;
const detalhe = [];
for (const v of vigs) {
  const P = soma(port, v), L = soma(plan, v);
  difVal += P.v - L.v; difKm += P.km - L.km;
  console.log(`${v}   ${String(P.placas.size).padStart(3)}/${String(L.placas.size).padEnd(4)}`
    + `${numBR(P.km).padStart(14)}${numBR(L.km).padStart(16)}${pct(P.km, L.km).padStart(9)}`
    + `${brl(P.v).padStart(18)}${brl(L.v).padStart(18)}${pct(P.v, L.v).padStart(9)}`);

  // QUAIS placas explicam a diferença — o total sozinho não diz se é uma
  // placa grande fora ou dez pequenas divergindo
  const mp = new Map(), ml = new Map();
  port.filter(l => l.vig === v).forEach(l => mp.set(l.placa, (mp.get(l.placa) || 0) + l.valor));
  plan.filter(l => l.vig === v).forEach(l => ml.set(l.placa, (ml.get(l.placa) || 0) + l.valor));
  const todas = new Set([...mp.keys(), ...ml.keys()]);
  const soPortal = [], soPlan = [], diverge = [];
  todas.forEach(p => {
    const a = mp.get(p), b = ml.get(p);
    if (a != null && b == null) soPortal.push([p, a]);
    else if (a == null && b != null) soPlan.push([p, b]);
    else if (Math.abs(a - b) > 0.02) diverge.push([p, a, b]);
  });
  detalhe.push({ v, soPortal, soPlan, diverge });
}
console.log('─'.repeat(110));
console.log(`TOTAL: Δkm ${numBR(difKm)} · Δvalor ${brl(difVal)}`);

console.log('\n══ ONDE ESTÁ A DIFERENÇA ══════════════════════════════════════════');
for (const d of detalhe) {
  if (!d.soPortal.length && !d.soPlan.length && !d.diverge.length) {
    console.log(`\n${d.v}: bate placa a placa.`);
    continue;
  }
  console.log(`\n${d.v}:`);
  const mostra = (rot, lista, fmt) => {
    if (!lista.length) return;
    const tot = lista.reduce((s, x) => s + (x[1] - (x[2] || 0)), 0);
    console.log(`   ${rot}: ${lista.length} placa(s) · ${brl(Math.abs(tot))}`);
    lista.sort((a, b) => Math.abs(b[1] - (b[2] || 0)) - Math.abs(a[1] - (a[2] || 0)))
      .slice(0, 10).forEach(x => console.log('      ' + fmt(x)));
    if (lista.length > 10) console.log(`      … e mais ${lista.length - 10}`);
  };
  mostra('só no PORTAL (a planilha não tem)', d.soPortal, ([p, a]) => `${p}  ${brl(a)}`);
  mostra('só na PLANILHA (o portal não trouxe)', d.soPlan, ([p, b]) => `${p}  ${brl(b)}`);
  mostra('valor DIFERENTE', d.diverge,
    ([p, a, b]) => `${p}  portal ${brl(a)}  planilha ${brl(b)}  Δ ${brl(a - b)}`);
}

console.log('\n══ COMO LER ═══════════════════════════════════════════════════════');
console.log('· "só na PLANILHA" pode ser contrato FIXO: o portal só entrega o que é por km.');
console.log('· "só no PORTAL" é placa que a unidade não lançou — o robô a traz sozinho.');
console.log('· valor diferente é o caso que importa conferir antes de trocar a fonte.');

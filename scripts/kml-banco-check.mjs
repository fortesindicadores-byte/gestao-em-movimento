// ============================================================
// Km/L: O BANCO BATE COM O GVIZ? (passo 4 do roteiro do Supabase)
//
// Antes de trocar a leitura do painel /combustivel/eficiencia-kml/ da aba do
// Sheets para a tabela sh_consumo_km_litro, este script lê AS DUAS e compara
// exatamente o que a tela mostra: linhas, vigências, Σkm, Σlitros e o km/L
// por vigência e por unidade. Só troca quando bater.
//
// Roda no GitHub Actions: o sandbox não alcança o docs.google nem o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const TABELA = 'sh_consumo_km_litro';
const TOL = +(process.env.KML_TOL || 0.5);   // tolerância em % por número comparado

const n = v => (+v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const f2 = v => (+v || 0).toFixed(2);

// ── 1) a aba, do jeito que o painel pede hoje (JSONP vira fetch aqui) ──
async function doGviz() {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${KML_ID}/gviz/tq`
    + `?sheet=${encodeURIComponent('Km/L')}&tqx=out:json`);
  const t = await r.text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  if (j.status !== 'ok') throw new Error(j.errors?.[0]?.message || 'gviz recusou');
  const cols = j.table.cols.map(c => (c.label || c.id || '').trim());
  const rows = j.table.rows.map(r2 => (r2.c || []).map(c => (c && c.v != null ? c.v : null)));
  return { cols, rows };
}

// ── 2) a tabela do banco, paginada (o PostgREST corta em 1000) ──
async function doBanco() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?select=*&order=linha.asc`
      + `&offset=${off}&limit=1000`, { headers: H });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json();
    out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
}

// ── vigência: os dois lados viram "AAAA-MM" ──
const MES = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
function vigGviz(v) {
  if (v == null) return '';
  if (typeof v === 'string') {
    let m = v.match(/^Date\((\d+),(\d+)/); if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}`;
    m = v.match(/^([a-zç]+)\.?\/(\d{4})$/i);
    if (m) { const mo = MES[m[1].toLowerCase().slice(0, 3)]; if (mo != null) return `${m[2]}-${String(mo + 1).padStart(2, '0')}`; }
    m = v.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  }
  return '';
}
const vigBanco = l => {
  if (l.vigencia_orig) return String(l.vigencia_orig).slice(0, 7);
  const m = String(l.vigencia || '').match(/^(\d{1,2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1].padStart(2, '0')}` : '';
};

const g = await doGviz();
console.log(`gviz : ${g.rows.length} linha(s) · ${g.cols.length} coluna(s)`);
const b = await doBanco();
console.log(`banco: ${b.length} linha(s) em ${TABELA}`);
if (!b.length) {
  console.error('\n✘ A tabela está VAZIA. Rode o Sheets Robot (ou o botão do hub) antes de trocar o painel.');
  process.exit(1);
}
const carga = b.map(l => l.atualizado_em).filter(Boolean).sort().pop();
console.log(`carga mais recente: ${carga || '—'}\n`);

// índices das colunas que a tela usa, achados pelo rótulo (a mesma regra do painel)
const iCol = (...t) => g.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const I = {
  vig: iCol('vigência', 'vigencia'), uni: iCol('unidade'), proj: iCol('projeto'),
  km: iCol('km rodado'), lit: iCol('qtd total', 'litro'),
  rem: iCol('rem médio', 'rem medio'), real: iCol('km/l real'),
};
const faltando = Object.entries(I).filter(([, v]) => v < 0).map(([k]) => k);
if (faltando.length) { console.error('✘ coluna não encontrada na aba:', faltando.join(', ')); process.exit(1); }

// ── agrega os dois lados do mesmo jeito ──
const agrega = (linhas, get) => {
  const m = new Map();
  linhas.forEach(l => {
    const k = get.chave(l); if (!k) return;
    const a = m.get(k) || { linhas: 0, km: 0, lit: 0 };
    a.linhas++; a.km += +get.km(l) || 0; a.lit += +get.lit(l) || 0;
    m.set(k, a);
  });
  return m;
};
const porG = (campo) => agrega(g.rows, {
  chave: r => campo === 'vig' ? vigGviz(r[I.vig]) : String(r[I.uni] || '').trim(),
  km: r => r[I.km], lit: r => r[I.lit],
});
const porB = (campo) => agrega(b, {
  chave: l => campo === 'vig' ? vigBanco(l) : String(l.unidade || '').trim(),
  km: l => l.km_rodado_horas_trabalhadas, lit: l => l.qtd_total_de_litros,
});

let erros = 0;
const difPct = (x, y) => (!x && !y) ? 0 : Math.abs(x - y) / (Math.abs(x) || Math.abs(y)) * 100;

for (const campo of ['vig', 'uni']) {
  const A = porG(campo), B = porB(campo);
  const chaves = [...new Set([...A.keys(), ...B.keys()])].sort();
  console.log(`── por ${campo === 'vig' ? 'VIGÊNCIA' : 'UNIDADE'} ──`);
  console.log('   chave                 linhas g/b            km gviz            km banco     km/L g   km/L b');
  chaves.forEach(k => {
    const a = A.get(k) || { linhas: 0, km: 0, lit: 0 }, c = B.get(k) || { linhas: 0, km: 0, lit: 0 };
    const ka = a.lit ? a.km / a.lit : 0, kb = c.lit ? c.km / c.lit : 0;
    const ruim = a.linhas !== c.linhas || difPct(a.km, c.km) > TOL || difPct(a.lit, c.lit) > TOL;
    if (ruim) erros++;
    console.log(`   ${(ruim ? '✘ ' : '  ') + k.padEnd(20)} ${String(a.linhas).padStart(5)}/${String(c.linhas).padEnd(5)}`
      + ` ${n(a.km).padStart(16)} ${n(c.km).padStart(16)}  ${f2(ka).padStart(7)}  ${f2(kb).padStart(7)}`);
  });
  console.log('');
}

// ── o número do hero: km/L do ano inteiro ──
const somaG = g.rows.reduce((s, r) => ({ km: s.km + (+r[I.km] || 0), lit: s.lit + (+r[I.lit] || 0) }), { km: 0, lit: 0 });
const somaB = b.reduce((s, l) => ({ km: s.km + (+l.km_rodado_horas_trabalhadas || 0), lit: s.lit + (+l.qtd_total_de_litros || 0) }), { km: 0, lit: 0 });
console.log(`TOTAL gviz : ${n(somaG.km)} km · ${n(somaG.lit)} L · ${f2(somaG.km / somaG.lit)} km/L`);
console.log(`TOTAL banco: ${n(somaB.km)} km · ${n(somaB.lit)} L · ${f2(somaB.km / somaB.lit)} km/L`);
if (g.rows.length !== b.length) { console.log(`\n⚠ contagem de linhas diferente: ${g.rows.length} × ${b.length}`); erros++; }

console.log(erros ? `\n✘ ${erros} divergência(s) — NÃO trocar o painel ainda.`
  : `\n✔ banco e planilha batem (tolerância ${TOL}%). Pode trocar a leitura do painel.`);
process.exit(erros ? 1 : 0);

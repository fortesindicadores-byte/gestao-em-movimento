// ============================================================
// O BANCO REPRODUZ O GVIZ? — célula a célula, base a base (18/09/2026)
//
// O gviz-cache.js passou a responder aos painéis com um payload gviz
// RECONSTRUÍDO das tabelas sh_<slug>. Este check prova, no banco real, que a
// reconstrução é idêntica ao que o Google devolve: para cada base compara a
// foto crua do gviz_snapshot (o texto que o Google mandou) com o payload
// montado pelo PRÓPRIO gviz-cache.js (carregado em node:vm) a partir de
// sh_base.colunas + sh_<slug>. Confere cols (label, type) e cada célula (v).
// O `f` (valor formatado) é contado à parte: os painéis leem `v`; quem lê `f`
// (parseVigCell, cellText) já trata Date( antes.
//
// Também lista o que ficaria de fora: alvo do gviz-robot sem tabela, chave do
// gviz_snapshot sem base — cada um é um painel que continuaria indo ao Google.
//
// Não grava nada. Roda no Actions (o sandbox não alcança o Supabase).
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';
import { BASES, chaveDe } from './sheets-bases.mjs';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const n = v => (+v).toLocaleString('pt-BR');

// ── o rebuild é o do gviz-cache.js, sem cópia ──────────────────────────────
const janela = { location: { href: 'https://x/' }, localStorage: { getItem: () => null }, console,
  fetch: () => Promise.resolve({ ok: false }), URL, Element: { prototype: { appendChild() {} } },
  Response: class {}, AbortController: undefined };
janela.window = janela;
vm.runInNewContext(fs.readFileSync(new URL('../assets/gviz-cache.js', import.meta.url), 'utf8'), janela);
const R = janela.GvizRebuild;
if (!R) { console.error('gviz-cache.js não expôs GvizRebuild'); process.exit(1); }

async function api(path, extra = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: { ...H, ...extra } });
  if (!r.ok) throw new Error(`${path.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}
async function tabela(slug, linhas) {
  const out = [];
  for (let off = 0; off < Math.max(linhas, 1); off += 1000) {
    out.push(...await api(`sh_${slug}?select=*&order=linha.asc`, { Range: `${off}-${off + 999}` }));
  }
  return out;
}
const parseGviz = body => { const a = body.indexOf('('), b = body.lastIndexOf(')'); return JSON.parse(body.slice(a + 1, b)); };
const igual = (a, b) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  if (Array.isArray(a) && Array.isArray(b)) return a.slice(0, 3).join(':') === b.slice(0, 3).join(':');
  return String(a) === String(b);
};

console.log('═══ gviz × banco: a reconstrução é idêntica? ═══\n');
const shBase = Object.fromEntries((await api('sh_base?select=*')).map(b => [b.slug, b]));
const snapKeys = new Set((await api('gviz_snapshot?select=key')).map(r => r.key));

let ruins = 0, ok = 0, semTabela = 0;
for (const b of BASES) {
  const chave = chaveDe(b);
  const base = shBase[b.slug];
  const rot = b.slug.padEnd(26);
  if (!base || !base.colunas || !base.linhas) { console.log(`?   ${rot} sem carga no banco${base && base.erro ? ' · erro: ' + base.erro.slice(0, 80) : ''}`); semTabela++; continue; }
  if (!snapKeys.has(chave)) { console.log(`?   ${rot} sem foto no gviz_snapshot — nada com que comparar (banco: ${n(base.linhas)} linhas)`); continue; }
  let snap;
  try {
    const [row] = await api(`gviz_snapshot?key=eq.${encodeURIComponent(chave)}&select=body,updated_at`);
    snap = { obj: parseGviz(row.body), em: row.updated_at };
  } catch (e) { console.log(`!   ${rot} snapshot ilegível: ${e.message}`); ruins++; continue; }
  const linhas = await tabela(b.slug, base.linhas);
  const rec = R.tabela(base.colunas, linhas);
  const g = snap.obj.table;

  const probs = [];
  if (g.cols.length !== rec.cols.length) probs.push(`nº de colunas: gviz ${g.cols.length} × banco ${rec.cols.length}`);
  g.cols.forEach((c, i) => {
    const r = rec.cols[i]; if (!r) return;
    if ((c.label || '') !== r.label) probs.push(`col ${i} label: "${c.label}" × "${r.label}"`);
    if ((c.type || 'string') !== r.type) probs.push(`col ${i} tipo: ${c.type} × ${r.type}`);
  });
  if (g.rows.length !== rec.rows.length) probs.push(`nº de linhas: gviz ${n(g.rows.length)} × banco ${n(rec.rows.length)}`);
  let difV = 0, difF = 0, exemplos = [];
  const nl = Math.min(g.rows.length, rec.rows.length);
  for (let i = 0; i < nl; i++) {
    const a = g.rows[i].c || [], c = rec.rows[i].c;
    for (let j = 0; j < rec.cols.length; j++) {
      const ga = a[j], rb = c[j];
      const gv = ga && ga.v != null ? ga.v : null, rv = rb && rb.v != null ? rb.v : null;
      if (!igual(gv, rv)) { difV++; if (exemplos.length < 5) exemplos.push(`L${i + 1} ${rec.cols[j].label || 'col' + j}: gviz ${JSON.stringify(gv)} × banco ${JSON.stringify(rv)}`); }
      else if (ga && ga.f != null && (!rb || rb.f !== ga.f)) difF++;
    }
  }
  if (difV) probs.push(`${n(difV)} célula(s) com v diferente`);
  const idade = `foto ${snap.em.slice(0, 16)} · carga ${String(base.carregado_em).slice(0, 16)}`;
  if (probs.length) {
    ruins++;
    console.log(`✗   ${rot} ${probs.join(' · ')}  (${idade})`);
    exemplos.forEach(e => console.log(`        ${e}`));
    if (g.rows.length !== rec.rows.length) console.log('        (linhas diferentes: a foto e a carga podem ser de horas diferentes — conferir as datas)');
  } else {
    ok++;
    console.log(`ok  ${rot} ${n(rec.rows.length)} linhas × ${rec.cols.length} cols idênticas${difF ? ` · f difere em ${n(difF)} célula(s) (só formato)` : ''}`);
  }
}

// ── o que continuaria indo ao Google ──────────────────────────────────────
console.log('\n━━ cobertura');
const chavesBase = new Set(BASES.flatMap(b => [chaveDe(b), ...(b.apelidos || []).map(a => chaveDe({ ...b, sheet: a.sheet, gid: a.gid, tq: a.tq, headers: a.headers }))]));
const orfas = [...snapKeys].filter(k => !chavesBase.has(k));
console.log(`   bases: ${BASES.length} · fotos no gviz_snapshot: ${snapKeys.size} · fotos SEM tabela: ${orfas.length}`);
orfas.forEach(k => console.log(`      → ${k}   (painel que ainda vai ao Google)`));

console.log(`\n${ok} idêntica(s) · ${ruins} divergente(s) · ${semTabela} sem carga`);
console.log(ruins || orfas.length
  ? '✗ ainda há aba que o gviz-cache não reproduz do banco — corrigir antes de publicar.'
  : '✓ o banco reproduz o gviz em todas as bases: os painéis podem parar de ler o Google.');
process.exit(ruins || orfas.length ? 1 : 0);

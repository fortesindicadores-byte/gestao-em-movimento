// ============================================================
// ABA INSPECT — fotografa QUALQUER aba do Sheets pelo gviz (só leitura).
//
// O sandbox não alcança o docs.google, então toda conferência de aba roda no
// Actions. Este é o genérico: cabeçalhos, tipos, quantas linhas, primeiras
// linhas e os valores distintos das colunas que se pedir — para não desenhar
// leitor nenhum em cima de chute.
//
// Uso: SHEET_ID=<id> ABA=<nome ou gid> [LINHAS=8] [DISTINTOS="UNIDADE,PROJETO,MÊS"]
//      node scripts/aba-inspect.mjs
// ============================================================
const ID = process.env.SHEET_ID, ABA = process.env.ABA || '';
if (!ID || !ABA) { console.error('SHEET_ID e ABA são obrigatórios'); process.exit(1); }
const N = +(process.env.LINHAS || 8);
const DIST = (process.env.DISTINTOS || '').split(',').map(s => s.trim()).filter(Boolean);

const q = /^\d+$/.test(ABA) ? `gid=${ABA}` : `sheet=${encodeURIComponent(ABA)}`;
const url = `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:json&${q}`;
const txt = await (await fetch(url)).text();
const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
if (j.status !== 'ok') { console.error('gviz recusou:', j.status, JSON.stringify(j.errors || [])); process.exit(1); }

const cols = j.table.cols || [], rows = j.table.rows || [];
console.log(`aba "${ABA}" · ${rows.length} linha(s) · ${cols.length} coluna(s) · ${(txt.length / 1024).toFixed(0)} kB\n`);
console.log('colunas (índice · rótulo · tipo):');
cols.forEach((c, i) => console.log(`  ${String(i).padStart(2)} · ${(c.label || '(sem rótulo)').padEnd(28)} · ${c.type || '?'}`));

const cel = (r, i) => { const c = r.c && r.c[i]; if (!c) return ''; return c.f != null ? `${c.v}  [f=${c.f}]` : String(c.v ?? ''); };
console.log(`\nprimeiras ${Math.min(N, rows.length)} linha(s):`);
rows.slice(0, N).forEach((r, k) => console.log(`  #${k + 1}: ` + cols.map((c, i) => cel(r, i)).join(' | ')));

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
DIST.forEach(nome => {
  const i = cols.findIndex(c => norm(c.label) === norm(nome));
  if (i < 0) { console.log(`\n⚠ coluna "${nome}" não encontrada`); return; }
  const cont = new Map();
  rows.forEach(r => { const c = r.c && r.c[i]; const v = c ? (c.f != null ? c.f : (c.v == null ? '(vazio)' : String(c.v))) : '(vazio)'; cont.set(v, (cont.get(v) || 0) + 1); });
  console.log(`\ndistintos de "${cols[i].label}" (${cont.size}):`);
  [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).forEach(([v, n]) => console.log(`  ${String(n).padStart(6)} · ${v}`));
});

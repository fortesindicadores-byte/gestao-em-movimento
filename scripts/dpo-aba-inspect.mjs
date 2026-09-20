// ============================================================
// DPO / VPO — o que a aba DPO do Termômetro entrega e o que o Painel de
// Metas faz com ela, SEMESTRE a semestre.
//
// Renan, 20/09/2026: "No momento que uma unidade foi auditada no H2, vale
// só o H2 para acumulado ano e meses vigentes para o painel de metas."
//
// A sonda imprime a aba célula a célula (cabeçalho 1H25 · 2H25 · 1H26 ·
// 2H26 e o nível de cada unidade) e roda o compDPO DO PRÓPRIO
// painel-metas/index.html (extraído do arquivo e avaliado em node:vm) para
// dizer, mês a mês do ano corrente, qual coluna vale, quantas unidades
// estão auditadas, quantas abaixo de Nível 3 e o % que sai. Rodar uma
// cópia da regra mediria a cópia, não o painel.
//
// Uso: node scripts/dpo-aba-inspect.mjs       (workflow "DPO Aba Inspect")
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';

const WB = '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o';
const url = `https://docs.google.com/spreadsheets/d/${WB}/gviz/tq?sheet=DPO&tqx=out:json`;

const bruto = await (await fetch(url)).text();
const j = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1));
if (j.status !== 'ok') { console.error('gviz recusou:', j.status, JSON.stringify(j.errors || [])); process.exit(1); }

// o MESMO achatamento do gviz() do painel: só o .v de cada célula
const rows = (j.table.rows || []).map(x => (x.c || []).map(c => c ? c.v : null));
const labels = (j.table.cols || []).map(c => c && c.label ? c.label : '');
console.log(`rótulos do gviz (cols): ${labels.map((l, i) => `${i}=${l || '(vazio)'}`).join(' · ')}`);
console.log(`${rows.length} linha(s) — a 1ª é o cabeçalho que o painel usa (rows[0])\n`);
rows.forEach((r, i) => console.log(String(i).padStart(3) + ' | ' + r.map(v => String(v == null ? '' : v).padEnd(10)).join(' | ')));

// ── o compDPO do próprio painel ──
const html = fs.readFileSync(new URL('../painel-metas/index.html', import.meta.url), 'utf8');
const ini = html.indexOf('function compDPO(');
const fim = html.indexOf('\n// FCA:', ini);
if (ini < 0 || fim < 0) { console.error('não achei o compDPO no painel'); process.exit(1); }
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(html.slice(ini, fim) + '\nthis.compDPO = compDPO;', ctx);

const dpo = ctx.compDPO(rows);
console.log('\n── semestres que o painel enxerga ──');
if (!dpo.cols.length) console.log('   (cabeçalho fora do padrão nHaa → regra antiga: ' + JSON.stringify(dpo.de(0, 0)) + ')');
dpo.cols.forEach(c => console.log(`   ${c.sem.padEnd(6)} auditadas ${String(c.aud).padStart(2)} · abaixo de Nível 3: ${c.below} → ${c.frac * 100}%`));

const hoje = new Date();
const ano = +(process.env.DPO_ANO || hoje.getFullYear());
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
console.log(`\n── mês a mês de ${ano} (peso 20 → pontos) ──`);
for (let m = 0; m < 12; m++) {
  const d = dpo.de(ano, m);
  console.log(`   ${MESES[m]}/${String(ano).slice(2)}  ${String(d.sem || '—').padEnd(6)} ${String(d.frac * 100).padStart(3)}%  ${(d.frac * 20).toFixed(0).padStart(2)} pts`
    + (d.aud ? `   (${d.aud} auditadas, ${d.below} abaixo de N3)` : '   (sem auditoria)'));
}

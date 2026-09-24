// ============================================================
// Combustível de uma unidade: o Frota de Elite e o painel Km/L usam a MESMA
// aba (Km/L do workbook Consumo) e chegam a REMUNERADOS diferentes.
//   · Frota de Elite (gerot-base combUm): rem = média SIMPLES do "KM/l Rem
//     Médio" de todas as linhas (placa-mês) da filial; real = Σkm ÷ Σlitros.
//   · Painel Km/L (aggRows, remMode 'medio'): rem = média simples POR PROJETO,
//     projetos ponderados pelo km rodado do projeto; real = Σkm ÷ Σlitros.
// 24/09/2026: GRL ago/26 saiu 95% no Elite e −7,7% (92,3%) no painel.
// Este script imprime os dois, e a abertura por projeto que explica a diferença.
// Uso (Actions): VIG=2026-08 UNI=GRL node scripts/kml-elite-vs-painel.mjs
// ============================================================
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const VIG = process.env.VIG || '2026-08';
const UNI = (process.env.UNI || 'GRL').toUpperCase();

const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
const num = c => { if (!c || c.v == null) return 0; const n = Number(c.v); return isFinite(n) ? n : 0; };
const txt = c => c ? String(c.v != null ? c.v : (c.f != null ? c.f : '')) : '';
const MM = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
function gvig(c) {
  if (!c) return null; let m = String(c.v).match(/Date\((\d+),(\d+)/); if (m) return m[1] + '-' + String(+m[2] + 1).padStart(2, '0');
  const f = String(c.f != null ? c.f : (c.v != null ? c.v : ''));
  m = f.match(/([a-zç]{3,})\.?[\/\-](\d{4})/i); if (m && MM[m[1].toLowerCase().slice(0, 3)]) return m[2] + '-' + String(MM[m[1].toLowerCase().slice(0, 3)]).padStart(2, '0');
  m = f.match(/(\d{1,2})\/(\d{4})/); if (m) return m[2] + '-' + m[1].padStart(2, '0'); return null;
}
const r = await fetch(`https://docs.google.com/spreadsheets/d/${KML_ID}/gviz/tq?sheet=${encodeURIComponent('Km/L')}&tqx=out:json`);
const j = parse(await r.text()); if (j.status !== 'ok') throw new Error('gviz ' + j.status);
const cols = (j.table.cols || []).map(c => String(c.label || '').toLowerCase());
const fi = (...t) => cols.findIndex(c => t.some(x => c.includes(x)));
const I = { vig: 0, rem: fi('rem médio', 'rem medio'), remM: fi('rem modelo'), proj: fi('projeto'), km: fi('km rodado'), lit: fi('qtd total de litro', 'qtd litro', 'litro'), ativo: fi('ativo') };
console.log('colunas:', JSON.stringify(I));

const linhas = (j.table.rows || []).map(x => x.c || []).filter(c => gvig(c[0]) === VIG).map(c => {
  const p = txt(c[I.proj]); const k = p.indexOf('-');
  return { proj: (k >= 0 ? p.slice(0, k) : p).trim(), uni: (k >= 0 ? p.slice(k + 1) : '').replace(/\s*\(INATIVO\)/i, '').trim().toUpperCase(),
    km: num(c[I.km]), lit: num(c[I.lit]), rem: num(c[I.rem]), remM: num(c[I.remM]), ativo: txt(c[I.ativo]) };
}).filter(l => l.uni === UNI);
console.log(`\n${UNI} · ${VIG}: ${linhas.length} linha(s) (placa-mês) na aba Km/L`);
if (!linhas.length) process.exit(0);

const km = linhas.reduce((s, l) => s + l.km, 0), lit = linhas.reduce((s, l) => s + l.lit, 0);
const real = lit ? km / lit : null;
const comRem = linhas.filter(l => l.rem > 0);
const remElite = comRem.length ? comRem.reduce((s, l) => s + l.rem, 0) / comRem.length : null;
const proj = {};
linhas.forEach(l => { const o = proj[l.proj] || (proj[l.proj] = { n: 0, nRem: 0, sRem: 0, km: 0, lit: 0 }); o.n++; o.km += l.km; o.lit += l.lit; if (l.rem > 0) { o.nRem++; o.sRem += l.rem; } });
let sMp = 0, kMp = 0;
Object.values(proj).forEach(o => { if (o.nRem && o.km > 0) { sMp += (o.sRem / o.nRem) * o.km; kMp += o.km; } });
const remPainel = kMp ? sMp / kMp : null;
const f = v => v == null ? '—' : v.toFixed(3);
const pct = (a, b) => a && b ? (a / b * 100).toFixed(1) + '%' : '—';
console.log(`\nREALIZADO (igual nos dois): Σkm ${km.toLocaleString('pt-BR')} ÷ Σlitros ${lit.toLocaleString('pt-BR')} = ${f(real)} km/L`);
console.log(`\nREMUNERADO:`);
console.log(`  Frota de Elite  (média simples das ${comRem.length} linhas)            = ${f(remElite)} → atingimento ${pct(real, remElite)}`);
console.log(`  Painel Km/L     (média por projeto, ponderada pelo km do projeto) = ${f(remPainel)} → atingimento ${pct(real, remPainel)} (Δ ${real && remPainel ? ((real / remPainel - 1) * 100).toFixed(1) + '%' : '—'})`);
console.log(`\nPOR PROJETO (é aqui que os dois se separam):`);
console.log('  projeto'.padEnd(22) + 'placas'.padStart(7) + 'km'.padStart(10) + 'litros'.padStart(9) + 'real'.padStart(7) + 'rem médio'.padStart(11) + 'peso Elite'.padStart(12) + 'peso Painel'.padStart(13));
const totN = comRem.length;
Object.entries(proj).sort((a, b) => b[1].km - a[1].km).forEach(([p, o]) => {
  const rp = o.nRem ? o.sRem / o.nRem : null;
  console.log('  ' + p.padEnd(20) + String(o.n).padStart(7) + Math.round(o.km).toLocaleString('pt-BR').padStart(10) + Math.round(o.lit).toLocaleString('pt-BR').padStart(9)
    + f(o.lit ? o.km / o.lit : null).padStart(7) + f(rp).padStart(11) + (totN ? (o.nRem / totN * 100).toFixed(0) + '%' : '—').padStart(12) + (kMp ? (o.km / kMp * 100).toFixed(0) + '%' : '—').padStart(13));
});
console.log(`\nLeitura: o Elite pesa cada PLACA igual; o painel pesa cada PROJETO pelo km. Onde um projeto tem muitas placas de pouco km (vans, apoio) com rem diferente do resto, os dois remunerados se afastam.`);

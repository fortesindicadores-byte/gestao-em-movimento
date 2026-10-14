// ============================================================
// Dispersão de km × aba Km/L (Consumo) — placa a placa (Renan, 14/10/2026:
// "Van do import, com vans do consumo km/L (é de lá que deve vir o km rodado)").
//
// Imprime cada linha da aba Km/L de 2026 em formato compacto
//   KML|vigência|Projeto-Unidade (O)|Unidade (P)|Placa (Q)|Tipo Veículo (V)|Ativo (L)|Km (W)
// para cruzar, fora daqui, com as placas da planilha "Dispersão de KM -
// Consolidado" (aba 02-ABERT. PLACA). A aba chega sem cabeçalho no gviz, então
// as colunas vão pela posição conferida (A, O, P, Q, V, L, W). Não grava nada.
// ============================================================
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const url = `https://docs.google.com/spreadsheets/d/${KML_ID}/gviz/tq?sheet=${encodeURIComponent('Km/L')}&tqx=out:json`;
const txt = await (await fetch(url)).text();
const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
if (j.status !== 'ok') { console.log('gviz:', j.status, JSON.stringify(j.errors || {})); process.exit(1); }
const rows = j.table.rows || [];
const cell = (r, i) => { const c = r.c?.[i]; return !c ? '' : (c.v == null ? '' : String(c.v)); };
const fmt = (r, i) => { const c = r.c?.[i]; return !c ? '' : (c.f != null ? String(c.f) : (c.v == null ? '' : String(c.v))); };
const vigDe = v => { const m = /Date\((\d+),(\d+)/.exec(v); if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}`;
  const t = /(\d{1,2})\/(\d{4})/.exec(v); return t ? `${t[2]}-${t[1].padStart(2, '0')}` : v; };
console.log(`linhas: ${rows.length}`);
let n = 0;
for (const r of rows) {
  const vig = vigDe(cell(r, 0));
  if (!/^2026-/.test(vig)) continue;
  n++;
  console.log(['KML', vig, fmt(r, 14), fmt(r, 15), fmt(r, 16), fmt(r, 21), fmt(r, 11), cell(r, 22)].join('|'));
}
console.log(`linhas de 2026: ${n}`);

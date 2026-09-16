// ============================================================
// Seara · a aba REMUNERADO nova × o km remunerado que os painéis usam hoje
//
// Renan, 16/09/2026: "Km remunerado agora está aqui" (aba `Remunerado`, colada
// das planilhas VariavelDeFrete_PorPlaca) e "troque o que tem hoje por esse".
//
// CINCO painéis leem o km remunerado da Base CTEs. Trocar a fonte dos cinco sem
// olhar a aba seria trocar um número certo por um desconhecido — e três desses
// painéis já estão quebrados (mandam `sum(Z)`, coluna que não existe mais), o
// que esconderia o estrago ainda mais. Este script responde, ANTES da troca:
//
//   · a aba tem quais colunas, quantas linhas e quais vigências;
//   · o Σkm dela bate com o da Base CTEs, mês a mês?
//   · as placas são as mesmas, e no mesmo formato?
//
// A Base CTEs é lida do jeito que os painéis leem HOJE: uma vez por viagem
// (CD_VIAGEM_TRANSPORTE), porque a mesma viagem gera vários CTEs e todos
// repetem o km — somar linha a linha infla 23×.
//
// Roda no GitHub Actions: o sandbox não alcança docs.google. Não grava nada.
// ============================================================
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';
const ABA_NOVA = 'Remunerado';
const ABA_CTES = 'Base CTEs';

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const XLSX = createRequire(import.meta.url)('xlsx');

const n0  = v => Math.round(+v || 0).toLocaleString('pt-BR');
const n1  = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (a, b) => b ? ((a / b - 1) * 100).toFixed(1) + '%' : '—';

// placa antiga LLLNNNN → Mercosul LLLNLNN: só para CRUZAR as bases
const D2L = '0123456789';
const placaKey = p => {
  const s = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(s) ? s.slice(0, 4) + 'ABCDEFGHIJ'[D2L.indexOf(s[4])] + s.slice(5) : s;
};
const norm = s => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// a data do Sheets chega como serial, Date ou texto — os três viram MM/AAAA
const BASE = Date.UTC(1899, 11, 30);
function vigDe(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return `${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
  if (typeof v === 'number') { const d = new Date(BASE + v * 86400000);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);            if (m) return `${m[1].padStart(2, '0')}/${m[2]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);      if (m) return `${m[2].padStart(2, '0')}/${m[3]}`;
  m = s.match(/^(\d{4})-(\d{2})/);                    if (m) return `${m[2]}/${m[1]}`;
  return s.slice(0, 7);
}
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  const casas = ult < 0 ? 0 : s.length - ult - 1;
  const lim = ult < 0 || casas === 3 ? s.replace(/[.,]/g, '')
            : s.slice(0, ult).replace(/[.,]/g, '') + '.' + s.slice(ult + 1);
  const x = parseFloat(lim); return isFinite(x) ? x : 0;
};

// ── o workbook inteiro, como o seara-abas-inspect já faz ──────────────────
console.log('baixando o workbook…');
const buf = Buffer.from(await (await fetch(
  `https://docs.google.com/spreadsheets/d/${SEARA_ID}/export?format=xlsx`)).arrayBuffer());
writeFileSync('/tmp/seara.xlsx', buf);
console.log(`xlsx: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
const wb = XLSX.readFile('/tmp/seara.xlsx', { cellDates: true });
console.log(`abas: ${wb.SheetNames.join(' · ')}\n`);

const grade = aba => {
  if (!wb.Sheets[aba]) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null, blankrows: false, raw: true });
};
// acha a coluna pelo RÓTULO, nunca pela posição: a aba nova ganhou uma coluna
// de Vigência na frente e empurrou tudo um lugar para a direita
const acha = (hdr, ...alvos) => {
  const h = hdr.map(norm);
  for (const a of alvos) { const i = h.indexOf(norm(a)); if (i >= 0) return i; }
  for (const a of alvos) { const i = h.findIndex(x => x.includes(norm(a))); if (i >= 0) return i; }
  return -1;
};

// ── 1) a aba nova ─────────────────────────────────────────────────────────
const gN = grade(ABA_NOVA);
if (!gN) { console.error(`aba "${ABA_NOVA}" não existe. Abas: ${wb.SheetNames.join(', ')}`); process.exit(1); }
const hN = (gN[0] || []).map(v => String(v == null ? '' : v).trim());
console.log(`══ 1) ABA "${ABA_NOVA}" — ${gN.length - 1} linha(s) × ${hN.length} coluna(s)\n`);
hN.forEach((v, i) => { if (v) console.log(`   [${String(i).padStart(2)}] ${v}`); });

const cV = acha(hN, 'vigencia'), cP = acha(hN, 'placa'), cK = acha(hN, 'km'),
      cC = acha(hN, 'ct-e', 'cte'), cT = acha(hN, 'total');
console.log(`\n   vigência=[${cV}] placa=[${cP}] km=[${cK}] ct-e=[${cC}] total=[${cT}]`);
if (cV < 0 || cP < 0 || cK < 0) { console.error('faltou vigência, placa ou km — parando'); process.exit(1); }

const NOVA = new Map();   // "vig|placa" → km
const vigN = new Map();   // vig → {n, km, placas:Set, cte, total}
let semPlaca = 0, antigas = 0;
for (let i = 1; i < gN.length; i++) {
  const l = gN[i] || [];
  const vig = vigDe(l[cV]), praw = String(l[cP] == null ? '' : l[cP]).trim();
  if (!vig || !praw) { semPlaca++; continue; }
  if (/^[A-Z]{3}\d{4}$/.test(praw.toUpperCase().replace(/[^A-Z0-9]/g, ''))) antigas++;
  const pl = placaKey(praw), km = num(l[cK]);
  NOVA.set(`${vig}|${pl}`, (NOVA.get(`${vig}|${pl}`) || 0) + km);
  const a = vigN.get(vig) || { n: 0, km: 0, placas: new Set(), cte: 0, total: 0 };
  a.n++; a.km += km; a.placas.add(pl);
  if (cC >= 0) a.cte += num(l[cC]);
  if (cT >= 0) a.total += num(l[cT]);
  vigN.set(vig, a);
};
const ordVig = v => v.slice(3) + v.slice(0, 2);
const vigsN = [...vigN.keys()].sort((a, b) => ordVig(a).localeCompare(ordVig(b)));
console.log(`\n   linhas sem vigência/placa: ${semPlaca} · placas no formato ANTIGO: ${antigas}`);
console.log('\n   vigência   linhas   placas         Σ km      Σ CT-e          Σ total');
vigsN.forEach(v => { const a = vigN.get(v);
  console.log(`   ${v}  ${String(a.n).padStart(6)}  ${String(a.placas.size).padStart(6)}`
    + `  ${n0(a.km).padStart(11)}  ${n0(a.cte).padStart(10)}  ${n0(a.total).padStart(15)}`); });

// ── 2) a Base CTEs, como os painéis leem HOJE ─────────────────────────────
const gC = grade(ABA_CTES);
const CTES = new Map(); const vigC = new Map();
if (!gC) console.log(`\n══ 2) aba "${ABA_CTES}" não existe mais — nada a comparar\n`);
else {
  const hC = (gC[0] || []).map(v => String(v == null ? '' : v).trim());
  const iVg = acha(hC, 'cd_viagem_transporte', 'viagem'), iPl = acha(hC, 'placa'),
        iKm = acha(hC, 'qt_quilometros_viagem', 'quilometros');
  // a data oscila entre D e E conforme o layout — vale a que PARECE data
  let iDt = acha(hC, 'dt_emissao', 'emissao', 'data');
  if (iDt < 0) for (const c of [3, 4]) { if (vigDe((gC[1] || [])[c])) { iDt = c; break; } }
  console.log(`\n══ 2) ABA "${ABA_CTES}" — ${gC.length - 1} linha(s)`
    + ` · viagem=[${iVg}] placa=[${iPl}] data=[${iDt}] km=[${iKm}]\n`);
  const vistas = new Set();
  let brutas = 0;
  for (let i = 1; i < gC.length; i++) {
    const l = gC[i] || [];
    const vig = vigDe(l[iDt]), pl = placaKey(l[iPl]), km = num(l[iKm]);
    if (!vig || !pl) continue;
    brutas += km;
    const chave = String(l[iVg] == null ? '' : l[iVg]).trim();
    // A DEDUPLICAÇÃO É OBRIGATÓRIA: a mesma viagem gera vários CTEs e todos
    // repetem o km. Sem ela o total infla ~23×.
    if (chave && vistas.has(chave)) continue;
    if (chave) vistas.add(chave);
    CTES.set(`${vig}|${pl}`, (CTES.get(`${vig}|${pl}`) || 0) + km);
    const a = vigC.get(vig) || { km: 0, placas: new Set(), viagens: 0 };
    a.km += km; a.placas.add(pl); a.viagens++; vigC.set(vig, a);
  }
  console.log(`   viagens distintas: ${n0(vistas.size)} · Σkm linha a linha (ERRADO): ${n0(brutas)}`
    + ` · Σkm por viagem (o que os painéis usam): ${n0([...vigC.values()].reduce((s, a) => s + a.km, 0))}`);
}

// ── 3) lado a lado ────────────────────────────────────────────────────────
console.log('\n══ 3) Σ KM REMUNERADO — aba nova × Base CTEs\n');
console.log('vigência        aba nova      Base CTEs            Δ km        Δ %   placas N/C');
const todas = [...new Set([...vigsN, ...vigC.keys()])].sort((a, b) => ordVig(a).localeCompare(ordVig(b)));
todas.forEach(v => {
  const a = vigN.get(v), b = vigC.get(v);
  const ka = a ? a.km : 0, kb = b ? b.km : 0;
  console.log(`${v}  ${n0(ka).padStart(14)}  ${n0(kb).padStart(13)}  ${n0(ka - kb).padStart(14)}`
    + `  ${pct(ka, kb).padStart(9)}   ${String(a ? a.placas.size : 0)}/${String(b ? b.placas.size : 0)}`);
});

// as placas que mais divergem, nas vigências que existem nos DOIS lados
const comuns = todas.filter(v => vigN.has(v) && vigC.has(v));
if (comuns.length) {
  const dif = [];
  for (const ch of new Set([...NOVA.keys(), ...CTES.keys()])) {
    const [v] = ch.split('|'); if (!comuns.includes(v)) continue;
    const a = NOVA.get(ch) || 0, b = CTES.get(ch) || 0;
    if (Math.abs(a - b) >= 1) dif.push({ ch, a, b, d: a - b });
  }
  dif.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  console.log(`\n── placas que mais divergem (${dif.length} de ${new Set([...NOVA.keys(), ...CTES.keys()]).size} chaves)\n`);
  console.log('vig|placa            aba nova   Base CTEs         Δ');
  dif.slice(0, 20).forEach(d => console.log(`${d.ch.padEnd(20)} ${n0(d.a).padStart(9)} ${n0(d.b).padStart(11)} ${n0(d.d).padStart(9)}`));
  const soN = dif.filter(d => !d.b).length, soC = dif.filter(d => !d.a).length;
  console.log(`\n   só na aba nova: ${soN} · só na Base CTEs: ${soC}`);
}
console.log('\nLEITURA: vigência que a aba nova cobre e a CTEs não é GANHO (a CTEs chega');
console.log('dois meses depois). Δ grande numa vigência que os dois têm é o que precisa');
console.log('de explicação ANTES de trocar os painéis.');

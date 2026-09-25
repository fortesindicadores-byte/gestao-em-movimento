// ============================================================
// Carta de Custos: o Orçado e o Rem (tend.) do Acompanhamento por Conta
// estão certos? (Renan, 25/09/2026: "esse orçado e rem estão o dobro?")
//
// Roda o CÓDIGO da própria Carta (DEPARA, unitMatchNv3, accDreForUnit…,
// extraído do carta-custos/index.html e executado em node:vm) contra a aba
// Frota do DRE, e põe ao lado:
//   · a soma CRUA da aba para as mesmas contas (sem filtro de unidade);
//   · quantas linhas casam com MAIS DE UMA unidade (seria contagem dobrada);
//   · linhas repetidas (mesma vigência + nível 3 + conta);
//   · o orçado de cada conta mês a mês no ano, para ver se o mês pulou.
// Não grava nada. Roda no Actions — o sandbox não alcança o docs.google.
// ============================================================
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DRE_ID = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';
const VIG = process.env.CARTA_VIG || '2026-09';
const ANO = VIG.slice(0, 4);

const html = readFileSync(new URL('../carta-custos/index.html', import.meta.url), 'utf8');
const corta = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim, a);
  if (a < 0 || b < 0) throw new Error(`trecho não encontrado: ${ini}`);
  return html.slice(a, b);
};
const codigo = [
  corta('const DEPARA=', 'const PROJETOS='),
  corta('const CONTAS={', 'const GRUPOS='),
  corta('const _normEb=', 'async function fetchTab('),
  corta('let DRE={};', 'async function loadDRE('),
].join('\n') + '\n;globalThis.__c={DEPARA,CONTAS,unitMatchNv3,mapTab,accDreForUnit,canonConta,_numBR,_mesNum,parseVigD,getDRE:()=>DRE,resetDRE:()=>{DRE={};}};';
const ctx = {}; vm.createContext(ctx); vm.runInContext(codigo, ctx);
const C = ctx.__c;

const r = await fetch(`https://docs.google.com/spreadsheets/d/${DRE_ID}/gviz/tq?tqx=out:json&sheet=Frota`);
const raw = await r.text();
const json = JSON.parse(raw.replace(/^[\s\S]*?\(/, '').replace(/\);?\s*$/, ''));
if (json.status !== 'ok') throw new Error('gviz recusou');
const header = json.table.cols.map(c => (c && c.label) || '');
const rows = json.table.rows.map(x => (x.c || []).map(c => (c && c.v != null ? c.v : null)));
const m = C.mapTab(header);
console.log(`aba Frota: ${rows.length} linhas · colunas ${JSON.stringify(m)}`);

const n = v => (v == null ? '—' : Math.round(v).toLocaleString('pt-BR'));
const MAN = C.CONTAS['Manutenção'];
const units = Object.keys(C.DEPARA);
const ymDe = row => {
  let ry = m.ano >= 0 ? parseInt(row[m.ano]) : null, rm = m.mes >= 0 ? C._mesNum(row[m.mes]) : null;
  if ((!ry || !rm) && m.vig >= 0) { const d = C.parseVigD(row[m.vig]); if (d) { ry = d.getFullYear(); rm = d.getMonth() + 1; } }
  return ry && rm ? `${ry}-${String(rm).padStart(2, '0')}` : null;
};

// 1) o que a Carta mostra (todas as unidades, todos os projetos)
C.resetDRE();
units.forEach(u => C.accDreForUnit(rows, m, u, new Set([VIG]), new Set([ANO]), null));
const D = C.getDRE();

// 2) soma crua da aba + detecção de dupla contagem
const crua = {}, casadas = {}, multi = [], semUni = {};
const chaves = new Map();
rows.forEach(row => {
  if (ymDe(row) !== VIG) return;
  const conta = C.canonConta(String(row[m.cta] || ''));
  if (!MAN.includes(conta)) return;
  const nv3 = String(row[m.nv3] || '');
  const o = Math.abs(C._numBR(row[m.orc]) || 0);
  crua[conta] = (crua[conta] || 0) + o;
  const quem = units.filter(u => C.unitMatchNv3(u, nv3));
  if (quem.length > 1) multi.push(`${nv3} → ${quem.join(', ')}`);
  if (quem.length) casadas[conta] = (casadas[conta] || 0) + o * quem.length;
  else semUni[nv3] = (semUni[nv3] || 0) + o;
  const k = `${nv3}|${conta}`;
  chaves.set(k, (chaves.get(k) || 0) + 1);
});

console.log(`\n── ${VIG} · Manutenção por conta ──`);
console.log('conta'.padEnd(40) + 'Orç Carta'.padStart(14) + 'Rem Carta'.padStart(14) + 'Orç cru aba'.padStart(14) + 'razão'.padStart(8));
let tC = 0, tR = 0, tA = 0;
MAN.forEach(c => {
  const d = D[c] || { orc: 0, rem: 0 }, a = crua[c] || 0;
  tC += d.orc; tR += d.rem; tA += a;
  console.log(c.padEnd(40) + n(d.orc).padStart(14) + n(d.rem).padStart(14) + n(a).padStart(14)
    + (a ? (d.orc / a).toFixed(2) : '—').padStart(8));
});
console.log('TOTAL'.padEnd(40) + n(tC).padStart(14) + n(tR).padStart(14) + n(tA).padStart(14) + (tA ? (tC / tA).toFixed(2) : '—').padStart(8));

console.log(`\nlinhas que casam com MAIS de uma unidade: ${multi.length}`);
[...new Set(multi)].slice(0, 20).forEach(x => console.log('   ' + x));
console.log(`nível 3 sem unidade da Carta (orçado fora da conta):`);
Object.entries(semUni).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`   ${k.padEnd(40)} ${n(v)}`));
const rep = [...chaves.entries()].filter(([, q]) => q > 1);
console.log(`nível 3 + conta com mais de uma linha no mês: ${rep.length}`);
rep.slice(0, 20).forEach(([k, q]) => console.log(`   ${k}  ×${q}`));

// 3) o orçado mês a mês — o mês pulou?
console.log(`\n── orçado de Manutenção mês a mês (${ANO}, aba crua) ──`);
const porMes = {};
rows.forEach(row => {
  const ym = ymDe(row); if (!ym || !ym.startsWith(ANO)) return;
  const conta = C.canonConta(String(row[m.cta] || ''));
  if (!MAN.includes(conta)) return;
  const o = porMes[ym] || (porMes[ym] = { orc: 0, rem: 0, real: 0, n: 0 });
  o.orc += Math.abs(C._numBR(row[m.orc]) || 0);
  o.rem += Math.abs(C._numBR(row[m.rem]) || 0);
  o.real += Math.abs(C._numBR(row[m.real]) || 0);
  o.n++;
});
console.log('vig'.padEnd(10) + 'linhas'.padStart(8) + 'orçado'.padStart(14) + 'remunerado'.padStart(14) + 'realizado'.padStart(14));
Object.keys(porMes).sort().forEach(k => {
  const o = porMes[k];
  console.log(k.padEnd(10) + String(o.n).padStart(8) + n(o.orc).padStart(14) + n(o.rem).padStart(14) + n(o.real).padStart(14));
});

// ============================================================
// Análise do consumo (Km/L) REMUNERADO · FT × aba Km/L do Consumo
//
// Entrada (fora do repositório, caminhos por variável):
//   KML_REM_XLSX  → "Análise Km/L Remunerado.xlsx" (export do FT: projeto,
//                   quinzena, unidade, consumo remunerado, placa, ativo)
//   KML_REM_DUMP  → dump.txt do workflow KmL Rem Dump (aba Km/L do banco +
//                   ativos do Ginfo, por placa)
// Saída: dados.json (tudo que o deck usa) — o HTML é montado por deck.mjs.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const XLSX_PATH = process.env.KML_REM_XLSX;
const DUMP_PATH = process.env.KML_REM_DUMP;
const OUT = process.env.KML_REM_OUT || new URL('./dados.json', import.meta.url).pathname;
if (!XLSX_PATH || !DUMP_PATH) { console.error('KML_REM_XLSX e KML_REM_DUMP obrigatórios'); process.exit(1); }

// ── helpers ──
const merc = p => { p = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (/^[A-Z]{3}\d{4}$/.test(p)) return p.slice(0, 4) + 'ABCDEFGHIJ'[+p[4]] + p.slice(5); return p; };
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const sum = a => a.reduce((s, v) => s + v, 0);
const QDE = m => Math.ceil(m / 3);
// ciclo de revisão do FT = trimestre civil: o valor novo entra na 1ª quinzena do 1º mês (medido: 1ª abr e 1ª jul)
const CICLO = t => t <= 5 ? 1 : t <= 11 ? 2 : t <= 17 ? 3 : 4; // t=0..19 (1ª jan..2ª out)
const FRONT = new Set([6, 12, 18]);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// unidade do FT → código do portal (unidade-projeto é a chave da revisão)
const UNI = {
  'CDD CAMBORIU': 'BLC', 'CDD CUIABA': 'CBA', 'CDD FLORIANOPOLIS': 'FLP', 'CDD GUARULHOS': 'GRL',
  'CDD NOVA FRIBURGO': 'NFR', 'CDD PELOTAS': 'PLT', 'CDD RIO DE JANEIRO': 'CGR', 'CDD RONDONOPOLIS': 'RON',
  'MACACU': 'MCC', 'UDC GUARULHOS': 'GRL UDC', 'CDD GOIANIA': 'GNA', 'CUIABA': 'CBA', 'PIRAI': 'PIR', 'LATA PIRAI': 'PIR', // Lata = projeto INSUMOS da mesma PIR, como na aba Km/L
};
const NOME = {
  BLC: 'Balneário Camboriú', CBA: 'Cuiabá', FLP: 'Florianópolis', GRL: 'Guarulhos', NFR: 'Nova Friburgo', PLT: 'Pelotas',
  CGR: 'Campo Grande (CDD Rio de Janeiro)', RON: 'Rondonópolis', MCC: 'Macacu', 'GRL UDC': 'Guarulhos UDC', GNA: 'Goiânia', PIR: 'Piraí', 'PIR LATA': 'Piraí Lata',
};
// unidade da aba Km/L (sufixo do projeto) → código
const SUF = { BLC: 'BLC', CBA: 'CBA', CGR: 'CGR', FLP: 'FLP', GRL: 'GRL', MCC: 'MCC', NFR: 'NFR', PLT: 'PLT', RON: 'RON', PIR: 'PIR', GOI: 'GNA' };

// modelo canônico (a aba Km/L e o Ginfo escrevem o mesmo modelo de vários jeitos)
function modeloCanon(s) {
  let t = String(s || '').toUpperCase().replace(/[\/,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.replace(/\bM\.? ?BENZ\b|\bMERCEDES(?: BENZ)?\b|\bMBB\b/g, 'MB').replace(/\bVOLKSWAGEN\b/g, 'VW').replace(/\bCAMINHAO\b/g, '').replace(/\bDALLY\b/g, 'DAILY');
  const num = t.match(/\b(\d{1,2})[.]?(\d{3})\b/); // 26.260 · 26260 · 17.190 · 13180
  const n = num ? (num[1] + '.' + num[2]) : null;
  const fam = (t.match(/\b(ATEGO|ACTROS|ACCELO|ATRON|AXOR|METEOR|CONSTELLATION|MASTER|DAILY|SPRINTER|FH|R ?\d{3}|DELIVERY|EXPRESS|DUCATO|TRANSIT|314 ?CDI|TGX|VOLARE|CARGO)\b/) || [])[1];
  const marca = (t.match(/\b(MB|VW|RENAULT|IVECO|VOLVO|SCANIA|MAN|FIAT|FORD|DAF|HYUNDAI|PEUGEOT|CITROEN)\b/) || [])[1] || '';
  // Mercedes: família + número de 4 dígitos (2426, 1719, 2548, 2651, 1316, 3026)
  const n4 = (t.match(/\b(\d{4})\s?[A-Z]?\b/) || [])[1];
  if (fam === 'ACTROS' || fam === 'ATEGO' || fam === 'ACCELO' || fam === 'ATRON' || fam === 'AXOR') return `MB ${fam} ${n4 || ''}`.trim();
  if (fam === '314 CDI' || fam === '314CDI' || fam === 'SPRINTER') return 'MB SPRINTER';
  if (fam === 'MASTER') return 'RENAULT MASTER';
  if (fam === 'DAILY') return 'IVECO DAILY';
  if (fam === 'METEOR') return `VW METEOR ${n || ''}`.trim();
  if (fam === 'FH') return `VOLVO FH ${(t.match(/FH\s?(\d{3})/) || [])[1] || ''}`.trim();
  if (fam && /^R ?\d{3}$/.test(fam)) return `SCANIA ${fam.replace(' ', '')}`;
  if (fam === 'TGX') return 'MAN TGX';
  if (n) return `${marca || 'VW'} ${n}`;
  return t;
}

// ── 1) planilha do FT ──
const wb = XLSX.readFile(XLSX_PATH);
const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true });
let FT = raw.map(r => {
  const m = String(r.Vigencia).match(/_(\d)_(\d+)_(\d{4})$/);
  const qz = +m[1], mes = +m[2], ano = +m[3];
  const at = String(r.Ativo);
  return {
    proj: r.Projeto, uni: UNI[r['Unidade - Nome']] || r['Unidade - Nome'], uniNome: r['Unidade - Nome'],
    up: `${UNI[r['Unidade - Nome']] || r['Unidade - Nome']} · ${r.Projeto}`,
    qz, mes, ano, t: (mes - 1) * 2 + (qz - 1) /* 0..19 */, q: CICLO((mes - 1) * 2 + (qz - 1)), k: `${ano}-${String(mes).padStart(2, '0')}`,
    placaOrig: String(r.Placa).trim(), placa: merc(r.Placa), v: +r['Consumo KM/L'] || 0,
    ativo: at === 'true' || at === 'ATIVO', ativoTxt: at,
  };
});
const QZ = [...new Set(FT.map(r => r.t))].sort((a, b) => a - b);
const qzLabel = t => `${(t % 2) + 1}ª ${MESES[Math.floor(t / 2)]}`;
const MES_IDX = [...new Set(FT.map(r => r.mes))].sort((a, b) => a - b);

// ── 2) dump: aba Km/L + ativos ──
const dump = readFileSync(DUMP_PATH, 'utf8').split('\n');
const seg = (a, b) => { const i0 = dump.indexOf(a), i1 = dump.indexOf(b); return dump.slice(i0 + 2, i1).map(l => l.split('|')); };
const KML0 = seg('#### KML ####', '#### FIM KML ####').map(c => {
  const sufx = (c[1].match(/-\s*([A-Z]{3})\s*$/) || [])[1];
  const projRaw = c[1].replace(/\s*-\s*[A-Z]{3}\s*$/, '').trim();
  const proj = /EMPURRADA/.test(projRaw) ? 'EMPURRADA' : /INSUMOS/.test(projRaw) ? 'INSUMOS' : /VAN/.test(projRaw) ? 'VAN' : /AUTO/.test(projRaw) ? 'AS' : 'ROTA';
  return { k: c[0].slice(0, 7), mes: +c[0].slice(5, 7), uni: SUF[sufx] || sufx, proj, up: `${SUF[sufx] || sufx} · ${proj}`, placa: merc(c[3]), modelo: c[4], tipo: c[5],
    km: +c[6] || 0, lit: +c[7] || 0, remM: +c[8] || 0, remMod: +c[9] || 0, real: +c[10] || 0, ativo: c[11], rsLRem: +c[12] || 0, rsLReal: +c[13] || 0 };
});
const ATIVOS = seg('#### ATIVOS ####', '#### FIM ATIVOS ####').map(c => ({ placa: merc(c[0]), filial: c[1], proj: c[2], marca: c[3], modelo: c[4], tipo: c[5], ano: +c[6] || null }));
// Elétricas ficam FORA da análise (Renan, 21/10/2026: "CGR são as elétricas, tire"): não têm Km/L e
// aparecem no FT como ativas com consumo zero (as 8 VW Delivery 14 VUC ELÉTRICO de Campo Grande).
const ELETRICAS = new Set(ATIVOS.filter(a => /EL[ÉE]TRIC/i.test(`${a.tipo} ${a.modelo}`)).map(a => a.placa));
const eletricasFT = [...new Set(FT.filter(r => ELETRICAS.has(r.placa)).map(r => `${r.up}|${r.placa}`))].map(k => { const [up, placa] = k.split('|'); const a = ATIVOS.find(x => x.placa === placa); return { up, placa, modelo: `${a.marca} ${a.modelo}`, tipo: a.tipo }; });
// Campo Grande (CGR) é tratada em OUTRA pauta (tanque interno/SUMA, benchmark da montadora) e fica fora
// desta análise inteira (Renan, 21/10/2026: "Falei que CGR está sendo tratado em outra pauta"). Pelotas AS
// não existe como operação (entra em Rota): também fora.
const FORA_UNI = new Set(['CGR']), FORA_UP = new Set(['PLT · AS']);
FT = FT.filter(r => !ELETRICAS.has(r.placa) && !FORA_UNI.has(r.uni) && !FORA_UP.has(r.up));
const KML = KML0.filter(r => !ELETRICAS.has(r.placa) && !FORA_UNI.has(r.uni) && !FORA_UP.has(r.up));

// modelo por placa: moda na aba Km/L → Ginfo → "(sem modelo)"
const modeloDe = {};
{
  const cnt = {};
  KML.forEach(r => { if (!r.modelo) return; cnt[r.placa] = cnt[r.placa] || {}; const k = modeloCanon(r.modelo); cnt[r.placa][k] = (cnt[r.placa][k] || 0) + 1; });
  for (const p in cnt) modeloDe[p] = Object.entries(cnt[p]).sort((a, b) => b[1] - a[1])[0][0];
  ATIVOS.forEach(a => { if (!modeloDe[a.placa] && a.modelo) modeloDe[a.placa] = modeloCanon(`${a.marca} ${a.modelo}`); });
}
const fonteModelo = { kml: 0, ginfo: 0, sem: 0 };
const placasFT = [...new Set(FT.map(r => r.placa))];
placasFT.forEach(p => { if (KML.some(r => r.placa === p && r.modelo)) fonteModelo.kml++; else if (modeloDe[p]) fonteModelo.ginfo++; else fonteModelo.sem++; });
FT.forEach(r => { r.modelo = modeloDe[r.placa] || '(sem modelo)'; });

// ── grupos ──
const groupBy = (arr, fn) => { const m = new Map(); arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
const ativasComValor = FT.filter(r => r.ativo && r.v > 0);
const UPS = [...new Set(FT.map(r => r.up))].sort();

// ═══ A · média por unidade-projeto × quinzena / mês / trimestre (média simples das placas ativas com valor) ═══
const mediaUP = {};   // up → { qz: {t: {media,n,zeros}}, mes:{...}, q:{...} }
for (const up of UPS) {
  const rows = FT.filter(r => r.up === up);
  const o = { qz: {}, mes: {}, q: {} };
  for (const [t, g] of groupBy(rows, r => r.t)) {
    const a = g.filter(r => r.ativo), av = a.filter(r => r.v > 0);
    o.qz[t] = { media: mean(av.map(r => r.v)), n: av.length, nAt: a.length, zeros: a.length - av.length, nInat: g.length - a.length };
  }
  for (const [m, g] of groupBy(rows, r => r.mes)) {
    const av = g.filter(r => r.ativo && r.v > 0);
    o.mes[m] = { media: mean(av.map(r => r.v)), placas: new Set(av.map(r => r.placa)).size };
  }
  for (const [q, g] of groupBy(rows, r => r.q)) {
    const av = g.filter(r => r.ativo && r.v > 0);
    o.q[q] = { media: mean(av.map(r => r.v)), placas: new Set(av.map(r => r.placa)).size };
  }
  mediaUP[up] = o;
}
// frota: média simples de todas as placas ativas com valor (é a régua do FT: cada placa pesa igual)
const frota = { qz: {}, mes: {}, q: {} };
for (const [t, g] of groupBy(ativasComValor, r => r.t)) frota.qz[t] = { media: mean(g.map(r => r.v)), n: g.length };
for (const [m, g] of groupBy(ativasComValor, r => r.mes)) frota.mes[m] = { media: mean(g.map(r => r.v)), n: new Set(g.map(r => r.placa)).size };
for (const [q, g] of groupBy(ativasComValor, r => r.q)) frota.q[q] = { media: mean(g.map(r => r.v)), n: new Set(g.map(r => r.placa)).size };
// realizado da frota por mês (Σkm ÷ Σlitros, aba Km/L, só T2+T1 do portal — os mesmos projetos)
const realMes = {}; for (const [m, g] of groupBy(KML.filter(r => r.km > 0 && r.lit > 0), r => r.mes)) realMes[m] = { kml: sum(g.map(r => r.km)) / sum(g.map(r => r.lit)), km: sum(g.map(r => r.km)) };
const realUP = {}; for (const [k, g] of groupBy(KML.filter(r => r.km > 0 && r.lit > 0), r => `${r.up}|${r.mes}`)) { const [up, m] = k.split('|'); realUP[up] = realUP[up] || {}; realUP[up][m] = { kml: sum(g.map(r => r.km)) / sum(g.map(r => r.lit)), km: sum(g.map(r => r.km)), lit: sum(g.map(r => r.lit)), rsL: sum(g.map(r => r.rsLReal * r.lit)) / sum(g.map(r => r.lit)) }; }
const realUPq = {}; for (const [k, g] of groupBy(KML.filter(r => r.km > 0 && r.lit > 0), r => `${r.up}|${QDE(r.mes)}`)) { const [up, q] = k.split('|'); realUPq[up] = realUPq[up] || {};
  const porPlaca = [...groupBy(g, r => r.placa)].map(([p, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit)));
  realUPq[up][q] = { kml: sum(g.map(r => r.km)) / sum(g.map(r => r.lit)), simples: mean(porPlaca), placas: porPlaca.length, km: sum(g.map(r => r.km)), lit: sum(g.map(r => r.lit)) }; }
// realizado da frota por mês como média simples por placa (a régua do FT)
const realMesSimples = {}; for (const [m, g] of groupBy(KML.filter(r => r.km > 300 && r.lit > 0), r => r.mes)) realMesSimples[m] = { kml: mean([...groupBy(g, r => r.placa)].map(([p, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit)))), placas: new Set(g.map(r => r.placa)).size };
for (const up in realUP) for (const m in realUP[up]) { const g = KML.filter(r => r.up === up && r.mes === +m && r.km > 0 && r.lit > 0); realUP[up][m].simples = mean([...groupBy(g, r => r.placa)].map(([p, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit)))); }

// ═══ 1 · modelos × trimestre, por unidade-projeto ═══
const modelosQ = {}, movUP = {};
for (const up of UPS) {
  const rows = ativasComValor.filter(r => r.up === up);
  const porMod = groupBy(rows, r => r.modelo);
  const lista = [];
  for (const [mod, g] of porMod) {
    const q = {};
    for (let qi = 1; qi <= 4; qi++) { const gg = g.filter(r => r.q === qi); q[qi] = gg.length ? { media: mean(gg.map(r => r.v)), min: Math.min(...gg.map(r => r.v)), max: Math.max(...gg.map(r => r.v)), placas: new Set(gg.map(r => r.placa)).size } : null; }
    // placas que mudaram de valor entre 2ª set e 1ª out (Q3→Q4), no mesmo up
    const set2 = new Map(g.filter(r => r.t === 17).map(r => [r.placa, r.v])), out1 = new Map(g.filter(r => r.t === 18).map(r => [r.placa, r.v]));
    let iguais = 0, mudaram = [];
    for (const [p, v] of out1) if (set2.has(p)) { if (Math.abs(set2.get(p) - v) < 0.005) iguais++; else mudaram.push({ placa: p, de: set2.get(p), para: v }); }
    lista.push({ modelo: mod, q, placas: new Set(g.map(r => r.placa)).size, q3q4: { iguais, mudaram, novas: [...out1.keys()].filter(p => !set2.has(p)).length, sairam: [...set2.keys()].filter(p => !out1.has(p)).length }, mov: movQ3Q4(g) });
  }
  lista.sort((a, b) => b.placas - a.placas);
  modelosQ[up] = lista;
  movUP[up] = movQ3Q4(rows);
}
// o que explica o Δ Q3→Q4 de um conjunto de linhas ativas com valor: placas que ENTRARAM no ativo em
// outubro (média delas no Q4), que SAÍRAM (média no Q3) e as que FICARAM (média Q3 × Q4; diferença
// só se o valor mudou dentro do Q3, porque em outubro nenhum valor mudou)
function movQ3Q4(g) {
  const porPlaca = groupBy(g.filter(r => r.q === 3 || r.q === 4), r => r.placa);
  const ent = [], sai = [], ficQ3 = [], ficQ4 = [];
  for (const [p, gg] of porPlaca) {
    const q3 = gg.filter(r => r.q === 3).map(r => r.v), q4 = gg.filter(r => r.q === 4).map(r => r.v);
    if (q3.length && q4.length) { ficQ3.push(mean(q3)); ficQ4.push(mean(q4)); } else if (q4.length) ent.push(mean(q4)); else sai.push(mean(q3));
  }
  return { ent: { n: ent.length, media: mean(ent) }, sai: { n: sai.length, media: mean(sai) }, fic: { n: ficQ3.length, q3: mean(ficQ3), q4: mean(ficQ4) } };
}
// resumo global Q3→Q4 por placa (2ª set × 1ª out) e dentro do Q4 (1ª out × 2ª out)
function compQz(tA, tB) {
  const A = new Map(ativasComValor.filter(r => r.t === tA).map(r => [r.up + '|' + r.placa, r.v])), B = new Map(ativasComValor.filter(r => r.t === tB).map(r => [r.up + '|' + r.placa, r.v]));
  let iguais = 0, mud = [];
  for (const [k, v] of B) if (A.has(k)) { if (Math.abs(A.get(k) - v) < 0.005) iguais++; else mud.push({ k, de: A.get(k), para: v }); }
  return { iguais, mudaram: mud.length, lista: mud, novas: [...B.keys()].filter(k => !A.has(k)).length, sairam: [...A.keys()].filter(k => !B.has(k)).length };
}
const q3q4 = compQz(17, 18), q4in = compQz(18, 19);
// mudanças de valor por fronteira de trimestre e dentro do trimestre (toda a série)
const fronteiras = {}; for (let t = 1; t < 20; t++) { const c = compQz(t - 1, t); fronteiras[t] = { de: qzLabel(t - 1), para: qzLabel(t), iguais: c.iguais, mudaram: c.mudaram, fronteiraQ: FRONT.has(t) }; }

// ═══ 2 · mesmo modelo, médias diferentes (ano inteiro, visão mensal) ═══
const dispersao = {}; const dispRes = { grupos: 0, comDif: 0, placasMes: 0, placasMesAcimaMin: 0 };
const impDisp = {}; // up → {litros, rs, km}
for (const up of UPS) {
  const rows = ativasComValor.filter(r => r.up === up);
  const out = [];
  for (const [k, g] of groupBy(rows, r => `${r.mes}|${r.modelo}`)) {
    const [mes, mod] = k.split('|');
    const porPlaca = new Map(); g.forEach(r => { porPlaca.set(r.placa, (porPlaca.get(r.placa) || []).concat(r.v)); });
    if (porPlaca.size < 2) continue;
    const vals = [...porPlaca.entries()].map(([p, vs]) => ({ placa: p, v: mean(vs) }));
    const min = Math.min(...vals.map(x => x.v)), max = Math.max(...vals.map(x => x.v));
    dispRes.grupos++; if (max - min > 0.005) dispRes.comDif++;
    dispRes.placasMes += vals.length; dispRes.placasMesAcimaMin += vals.filter(x => x.v - min > 0.005).length;
    // impacto: litros remunerados a menos porque a placa recebe consumo acima do mínimo do modelo na unidade
    const sorted = vals.map(x => x.v).sort((a, b) => a - b), mediana = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    // impacto contra a MEDIANA do modelo na unidade-mês, nos dois sentidos: placa acima da mediana recebe
    // menos litros (perde); abaixo recebe mais (ganha). litros = km da placa no mês (aba Km/L)
    let perde = 0, ganha = 0, rsPerde = 0, rsGanha = 0, km = 0;
    vals.forEach(x => {
      const kr = KML.find(r => r.up === up && r.placa === x.placa && r.mes === +mes) || KML.find(r => r.placa === x.placa && r.mes === +mes);
      if (!kr || !(kr.km > 0)) return;
      const d = kr.km / mediana - kr.km / x.v; const p = kr.rsLRem || kr.rsLReal || 0; km += kr.km;
      if (d > 0) { perde += d; rsPerde += d * p; } else { ganha += -d; rsGanha += -d * p; }
    });
    out.push({ mes: +mes, modelo: mod, n: vals.length, min, max, mediana, spread: max - min, pct: (max / min - 1) * 100, perde, ganha, rsPerde, rsGanha, km, placas: vals.sort((a, b) => a.v - b.v) });
  }
  dispersao[up] = out;
  impDisp[up] = { perde: sum(out.map(o => o.perde)), ganha: sum(out.map(o => o.ganha)), rsPerde: sum(out.map(o => o.rsPerde)), rsGanha: sum(out.map(o => o.rsGanha)), grupos: out.length, comDif: out.filter(o => o.spread > 0.005).length };
}
// placa manteve a média? (por placa, nº de valores distintos no ano e onde mudou)
const placaSerie = {};
for (const [k, g] of groupBy(ativasComValor, r => r.up + '|' + r.placa)) {
  const porT = new Map(g.map(r => [r.t, r.v]));
  const ts = [...porT.keys()].sort((a, b) => a - b);
  let mudFront = 0, mudDentro = 0;
  for (let i = 1; i < ts.length; i++) { if (ts[i] !== ts[i - 1] + 1) continue; if (Math.abs(porT.get(ts[i]) - porT.get(ts[i - 1])) > 0.005) { if (FRONT.has(ts[i])) mudFront++; else mudDentro++; } }
  placaSerie[k] = { distintos: new Set([...porT.values()].map(v => r2(v))).size, mudFront, mudDentro, n: ts.length };
}
const placaRes = { total: Object.keys(placaSerie).length, constantes: Object.values(placaSerie).filter(s => s.distintos === 1).length, soFronteira: Object.values(placaSerie).filter(s => s.mudDentro === 0 && s.mudFront > 0).length, dentroTri: Object.values(placaSerie).filter(s => s.mudDentro > 0).length };

// ═══ 3 · ativação: média das ativas × média do pool (quem tem valor no trimestre), mensal ═══
const ativacao = {}; const eventos = [];
for (const up of UPS) {
  const rows = FT.filter(r => r.up === up);
  const valorQ = {}; // placa|q → valor conhecido (média das quinzenas ativas com valor no trimestre)
  for (const [k, g] of groupBy(rows.filter(r => r.ativo && r.v > 0), r => r.placa + '|' + r.q)) valorQ[k] = mean(g.map(r => r.v));
  const porMes = {};
  for (const [m, g] of groupBy(rows, r => r.mes)) {
    const q = CICLO((m - 1) * 2);
    const ativas = g.filter(r => r.ativo && r.v > 0);
    const mediaAt = mean(ativas.map(r => r.v));
    // pool: toda placa da unidade-projeto que aparece na planilha no mês e tem valor conhecido no trimestre
    const pool = [...new Set(g.map(r => r.placa))].map(p => valorQ[p + '|' + q]).filter(v => v != null);
    const mediaPool = mean(pool);
    const inativasComValor = [...new Set(g.filter(r => !r.ativo).map(r => r.placa))].map(p => ({ placa: p, v: valorQ[p + '|' + q] })).filter(x => x.v != null);
    porMes[m] = { mediaAt, mediaPool, delta: mediaAt != null && mediaPool != null ? mediaAt - mediaPool : null, nAt: new Set(ativas.map(r => r.placa)).size, nPool: pool.length, nInat: new Set(g.filter(r => !r.ativo).map(r => r.placa)).size, inativasAbaixo: inativasComValor.filter(x => x.v < mediaAt).length, inativasAcima: inativasComValor.filter(x => x.v >= mediaAt).length };
  }
  ativacao[up] = porMes;
  // eventos de desativação / ativação (quinzena a quinzena) × média da unidade na quinzena anterior
  for (const [p, g] of groupBy(rows, r => r.placa)) {
    const porT = new Map(g.map(r => [r.t, r]));
    for (let t = 1; t < 20; t++) {
      const a = porT.get(t - 1), b = porT.get(t); if (!a || !b) continue;
      const med = mediaUP[up].qz[t - 1]?.media; if (med == null) continue;
      if (a.ativo && !b.ativo) { const v = a.v > 0 ? a.v : valorQ[p + '|' + CICLO(t)]; if (v) eventos.push({ up, placa: p, t, tipo: 'desativou', v, media: med, abaixo: v < med }); }
      if (!a.ativo && b.ativo && b.v > 0) eventos.push({ up, placa: p, t, tipo: 'ativou', v: b.v, media: med, abaixo: b.v < med });
    }
  }
}
const evRes = {
  desat: { n: eventos.filter(e => e.tipo === 'desativou').length, abaixo: eventos.filter(e => e.tipo === 'desativou' && e.abaixo).length },
  ativ: { n: eventos.filter(e => e.tipo === 'ativou').length, abaixo: eventos.filter(e => e.tipo === 'ativou' && e.abaixo).length },
};
// km rodado por placa marcada INATIVA na planilha do FT no mês (as duas quinzenas inativas), pela aba Km/L
const inatFT = {}; for (const [k, g] of groupBy(FT, r => r.placa + '|' + r.mes)) if (g.every(r => !r.ativo)) inatFT[k] = g[0].up;
const kmInatFT = {}; const kmInatFTTot = { km: 0, lit: 0, placas: new Set() };
for (const r of KML) { const up = inatFT[r.placa + '|' + r.mes]; if (!up || !(r.km > 0)) continue; kmInatFT[up] = kmInatFT[up] || {}; kmInatFT[up][r.mes] = (kmInatFT[up][r.mes] || 0) + r.km; kmInatFTTot.km += r.km; kmInatFTTot.lit += r.lit; kmInatFTTot.placas.add(r.placa); }
kmInatFTTot.placas = kmInatFTTot.placas.size;
// km rodado por placa inativa/parada no FT (aba Km/L), por unidade-projeto e mês
const kmInativas = {}; const kmInatTot = { km: 0, lit: 0, placas: new Set(), total: 0 };
for (const r of KML) { if (!(r.km > 0)) continue; kmInatTot.total += r.km; if (r.ativo === 'FALSO' || r.ativo === 'PARADO' || r.ativo === '0') { kmInativas[r.up] = kmInativas[r.up] || {}; kmInativas[r.up][r.mes] = (kmInativas[r.up][r.mes] || 0) + r.km; kmInatTot.km += r.km; kmInatTot.lit += r.lit; kmInatTot.placas.add(r.placa); } }
kmInatTot.placas = kmInatTot.placas.size;

// realizado (média simples por placa) por unidade-projeto × modelo × trimestre, para pôr ao lado do remunerado
const realModQ = {};
for (const [k, g] of groupBy(KML.filter(r => r.km > 300 && r.lit > 0), r => `${r.up}|${modeloDe[r.placa] || '(sem modelo)'}|${QDE(r.mes)}`)) {
  const [up, mod, q] = k.split('|'); realModQ[up] = realModQ[up] || {}; realModQ[up][mod] = realModQ[up][mod] || {};
  realModQ[up][mod][q] = { simples: mean([...groupBy(g, r => r.placa)].map(([p, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit)))), placas: new Set(g.map(r => r.placa)).size };
}
// o realizado das placas ATIVAS no FT × das INATIVAS (teste direto da hipótese "ativam as melhores")
const atFT = {}; for (const [k, g] of groupBy(FT, r => r.placa + '|' + r.mes)) atFT[k] = g.some(r => r.ativo) ? 'ativa' : 'inativa';
const realAtInat = {};
for (const [k, g] of groupBy(KML.filter(r => r.km > 300 && r.lit > 0 && atFT[r.placa + '|' + r.mes]), r => r.up)) {
  const a = g.filter(r => atFT[r.placa + '|' + r.mes] === 'ativa'), i = g.filter(r => atFT[r.placa + '|' + r.mes] === 'inativa');
  const simples = arr => mean([...groupBy(arr, r => r.placa + '|' + r.mes)].map(([kk, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit))));
  realAtInat[k] = { ativas: simples(a), inativas: i.length ? simples(i) : null, nAt: a.length, nInat: i.length, kmInat: sum(i.map(r => r.km)), kmAt: sum(a.map(r => r.km)) };
}
const todasA = KML.filter(r => r.km > 300 && r.lit > 0 && atFT[r.placa + '|' + r.mes] === 'ativa'), todasI = KML.filter(r => r.km > 300 && r.lit > 0 && atFT[r.placa + '|' + r.mes] === 'inativa');
const simplesG = arr => mean([...groupBy(arr, r => r.placa + '|' + r.mes)].map(([kk, gg]) => sum(gg.map(r => r.km)) / sum(gg.map(r => r.lit))));
const realAtInatTot = { ativas: simplesG(todasA), inativas: simplesG(todasI), nAt: todasA.length, nInat: todasI.length };

// ═══ 4 · outros erros ═══
const erros = {};
erros.ativasZero = FT.filter(r => r.ativo && !(r.v > 0));
erros.ativasZeroPorUp = Object.fromEntries([...groupBy(erros.ativasZero, r => r.up)].map(([k, g]) => [k, { linhas: g.length, placas: [...new Set(g.map(r => r.placa))], quinzenas: [...new Set(g.map(r => qzLabel(r.t)))] }]));
// detalhe de cada zero: o modelo da placa, se há irmãs do mesmo modelo ativas com valor na mesma quinzena e
// o que a placa tinha na quinzena anterior / recebeu na seguinte (Renan, 21/10/2026: "As placas zeradas, tem
// consumo no modelo delas? tem outras placas do mesmo modelo com consumo remunerado ativas?")
erros.ativasZeroDet = erros.ativasZero.map(r => {
  const irmas = FT.filter(x => x.up === r.up && x.t === r.t && x.modelo === r.modelo && x.placa !== r.placa && x.ativo && x.v > 0);
  const ant = FT.find(x => x.placa === r.placa && x.up === r.up && x.t === r.t - 1);
  const prox = FT.find(x => x.placa === r.placa && x.up === r.up && x.t === r.t + 1);
  return { up: r.up, t: qzLabel(r.t), placa: r.placa, modelo: r.modelo, irmas: irmas.length, irmasMedia: mean(irmas.map(x => x.v)), irmasMin: irmas.length ? Math.min(...irmas.map(x => x.v)) : null, irmasMax: irmas.length ? Math.max(...irmas.map(x => x.v)) : null,
    ant: ant ? { v: ant.v, ativo: ant.ativo } : null, prox: prox ? { v: prox.v, ativo: prox.ativo } : null };
});
erros.eletricasFora = eletricasFT;
erros.placaTeste = FT.filter(r => /TESTE/.test(r.placa)).map(r => ({ up: r.up, t: qzLabel(r.t), v: r.v, ativo: r.ativoTxt }));
const porMerc = groupBy(FT, r => r.placa); erros.duplaGrafia = [...porMerc].filter(([p, g]) => new Set(g.map(r => r.placaOrig)).size > 1).map(([p, g]) => ({ placa: p, grafias: [...new Set(g.map(r => r.placaOrig))], ups: [...new Set(g.map(r => r.up))] }));
erros.placaDoisUps = [...groupBy(FT, r => r.placa + '|' + r.t)].filter(([k, g]) => new Set(g.map(r => r.up)).size > 1).map(([k, g]) => ({ placa: k.split('|')[0], t: qzLabel(+k.split('|')[1]), ups: [...new Set(g.map(r => r.up + (r.ativo ? '' : ' (inativa)')))] }));
erros.placaDoisUpsRes = { pares: erros.placaDoisUps.length, placas: new Set(erros.placaDoisUps.map(x => x.placa)).size };
// outlier contra o modelo (dentro do up-mês): |v − mediana| > 25%
erros.outliers = [];
for (const up of UPS) for (const o of dispersao[up] || []) { const med = o.mediana; o.placas.forEach(x => { if (Math.abs(x.v / med - 1) > 0.25) erros.outliers.push({ up, mes: o.mes, modelo: o.modelo, placa: x.placa, v: x.v, mediana: med, pct: (x.v / med - 1) * 100 }); }); }
erros.outliersRes = { n: erros.outliers.length, placas: new Set(erros.outliers.map(x => x.up + '|' + x.placa)).size };
// valores mudando dentro do trimestre (sem revisão)
erros.mudDentroTri = Object.values(fronteiras).filter(f => !f.fronteiraQ).reduce((s, f) => s + f.mudaram, 0);
// 1ª quinzena de julho com ativas zeradas (Empurradas)
erros.julho = Object.fromEntries(Object.entries(erros.ativasZeroPorUp).filter(([k, v]) => v.quinzenas.includes('1ª jul')).map(([k, v]) => [k, erros.ativasZero.filter(r => r.up === k && r.t === 12).length]));
// unidades-projeto sem nenhuma placa ativa com valor em alguma quinzena
erros.upSemAtivas = []; for (const up of UPS) for (const t of QZ) { const o = mediaUP[up].qz[t]; if (o && o.n === 0 && o.nAt + o.nInat > 0) erros.upSemAtivas.push({ up, t: qzLabel(t), nAt: o.nAt, nInat: o.nInat }); }
// placas na aba Km/L (rodando) que não estão na planilha do FT no mesmo mês
const ftMes = new Set(FT.map(r => r.placa + '|' + r.mes));
const foraFT = KML.filter(r => r.km > 500 && !ftMes.has(r.placa + '|' + r.mes));
erros.foraFT = { linhas: foraFT.length, placas: new Set(foraFT.map(r => r.placa)).size, km: sum(foraFT.map(r => r.km)), porUp: Object.fromEntries([...groupBy(foraFT, r => r.up)].map(([k, g]) => [k, { placas: new Set(g.map(r => r.placa)).size, km: sum(g.map(r => r.km)) }])) };

// ═══ 5 · a premissa da revisão: rem Q(n) × realizado Q(n−1), por unidade-projeto ═══
const premissa = {};
for (const up of UPS) {
  const o = {};
  for (let q = 2; q <= 4; q++) {
    const rem = mediaUP[up].q[q]?.media, realAnt = realUPq[up]?.[q - 1]?.simples, realAntPond = realUPq[up]?.[q - 1]?.kml, remAnt = mediaUP[up].q[q - 1]?.media;
    if (rem == null || realAnt == null) continue;
    o[q] = { rem, realAnt, realAntPond, remAnt, gap: rem - realAnt, gapPct: (rem / realAnt - 1) * 100, placasReal: realUPq[up][q - 1].placas };
  }
  // se a revisão do Q4 tivesse acontecido (rem Q4 = real Q3): impacto em litros/mês e R$/mês com o km de set/26
  const r3 = realUPq[up]?.[3], rem4 = mediaUP[up].q[4]?.media, kmSet = realUP[up]?.['9']?.km, rsL = realUP[up]?.['9']?.rsL;
  if (r3 && rem4 && kmSet) { const litMes = kmSet / rem4 - kmSet / r3.simples; o.semRevisao = { rem4, real3: r3.simples, real3Pond: r3.kml, litMes, rsMes: litMes * (rsL || 0), kmSet, rsL }; }
  premissa[up] = o;
}

// ═══ ranking de unidades (ano) ═══
const rankUP = UPS.map(up => {
  const m = mediaUP[up]; const q1 = m.q[1]?.media, q3 = m.q[3]?.media, q4 = m.q[4]?.media;
  const at = Object.values(ativacao[up]).map(x => x.delta).filter(x => x != null);
  return { up, q1, q2: m.q[2]?.media, q3, q4, dQ1Q3: q1 && q3 ? (q3 / q1 - 1) * 100 : null, dQ3Q4: q3 && q4 ? (q4 / q3 - 1) * 100 : null, ativMed: mean(at), placas: new Set(FT.filter(r => r.up === up).map(r => r.placa)).size, disp: impDisp[up], prem: premissa[up] };
});

const dados = {
  geradoEm: new Date().toISOString(), NOME, MESES, QZ: QZ.map(t => ({ t, label: qzLabel(t), q: QDE(Math.floor(t / 2) + 1) })), MES_IDX,
  totais: { linhas: FT.length, placas: placasFT.length, ups: UPS.length, fonteModelo, kmlLinhas: KML.length },
  frota, realMes, mediaUP, movUP, realUP, realUPq, modelosQ, q3q4: { ...q3q4, lista: q3q4.lista.slice(0, 60) }, q4in: { iguais: q4in.iguais, mudaram: q4in.mudaram, lista: q4in.lista.slice(0, 40) }, fronteiras,
  dispersao, dispRes, impDisp, placaRes, ativacao, evRes, eventos: eventos.slice(0, 400), kmInativas, kmInatTot, kmInatFT, kmInatFTTot, realMesSimples, realModQ, realAtInat, realAtInatTot, mudancasCiclo: Object.values(fronteiras).filter(f => !f.fronteiraQ).reduce((s, f) => s + f.mudaram, 0), erros, premissa, rankUP, UPS,
};
writeFileSync(OUT, JSON.stringify(dados));
console.log('gravado', OUT);
console.log('FT', FT.length, 'linhas ·', placasFT.length, 'placas ·', UPS.length, 'unidade-projeto · modelo:', fonteModelo);
console.log('frota por trimestre', Object.entries(frota.q).map(([q, o]) => `Q${q} ${r2(o.media)} (${o.n} placas)`).join(' · '));
console.log('frota por mês', MES_IDX.map(m => `${MESES[m - 1]} ${r2(frota.mes[m].media)} / real ${realMes[m] ? r2(realMes[m].kml) : '—'}`).join(' · '));
console.log('Q3→Q4 (2ª set × 1ª out):', q3q4.iguais, 'iguais ·', q3q4.mudaram, 'mudaram ·', q3q4.novas, 'novas ·', q3q4.sairam, 'saíram');
console.log('1ª out × 2ª out:', q4in.iguais, 'iguais ·', q4in.mudaram, 'mudaram');
console.log('fronteiras:', Object.values(fronteiras).map(f => `${f.para}${f.fronteiraQ ? '*' : ''}:${f.mudaram}`).join(' '));
console.log('dispersão:', dispRes, 'placas:', placaRes);
console.log('impacto dispersão vs mediana (perde/ganha L jan→set):', Object.entries(impDisp).map(([k, v]) => `${k} -${Math.round(v.perde)}/+${Math.round(v.ganha)}L`).join(' · '));
console.log('km por placa inativa no FT:', kmInatFTTot, 'frota real simples por mês:', Object.entries(realMesSimples).map(([m, o]) => `${m}:${r2(o.kml)}`).join(' '));
console.log('ativação eventos:', evRes);
console.log('ativação Δ médio por up:', rankUP.map(r => `${r.up} ${r.ativMed != null ? r1(r.ativMed * 100) / 100 : '—'}`).join(' · '));
console.log('km inativas:', kmInatTot, 'de', Math.round(kmInatTot.total));
console.log('erros:', { ativasZero: erros.ativasZero.length, ups: Object.keys(erros.ativasZeroPorUp), teste: erros.placaTeste.length, duplaGrafia: erros.duplaGrafia.length, doisUps: erros.placaDoisUpsRes, outliers: erros.outliersRes, mudDentroTri: erros.mudDentroTri, julho: erros.julho, upSemAtivas: erros.upSemAtivas, foraFT: { placas: erros.foraFT.placas, km: Math.round(erros.foraFT.km) } });
console.log('real ativas × inativas (simples):', realAtInatTot, Object.entries(realAtInat).map(([k, v]) => `${k} ${r2(v.ativas)}/${v.inativas != null ? r2(v.inativas) : '—'}`).join(' · '));
console.log('sem revisão total L/mês:', Math.round(sum(Object.values(premissa).map(p => p.semRevisao?.litMes || 0))), 'R$/mês', Math.round(sum(Object.values(premissa).map(p => p.semRevisao?.rsMes || 0))));
console.log('premissa (rem Q × real Q−1):'); rankUP.forEach(r => console.log('  ', r.up.padEnd(18), [2, 3, 4].map(q => r.prem[q] ? `Q${q} rem ${r2(r.prem[q].rem)} × real ${r2(r.prem[q].realAnt)} (${r1(r.prem[q].gapPct)}%)` : `Q${q} —`).join(' | '), r.prem.semRevisao ? ` sem revisão: ${Math.round(r.prem.semRevisao.litMes)} L/mês R$${Math.round(r.prem.semRevisao.rsMes)}` : ''));

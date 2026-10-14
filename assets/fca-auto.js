/* ============================================================================
   FCA AUTOMÁTICO — causa e ação dos desvios de CUSTOS, cruzando as bases
   (Renan, 14/10/2026: "Uma cópia do FCA… aprender e trazer as causas e ações
   automáticas? Gostaria só de custos, e cruzar com os dados que temos dos
   indicadores do Ginfo, eficiência km/l, R$/l, dispersão de km, carta de
   custos, manutenção. Tudo. Cruzar e correlacionar para explicar decisões e
   gerar as ações.")

   O FATO é o mesmo do FCA: o PACOTE (Combustíveis · Manutenções · Pneus) que
   estourou contra o remunerado no DRE (aba Frota), por unidade × projeto ×
   vigência, com as contas embaixo (mesma regra do pushDRE do
   fca-preenchimento). Para cada fato, o motor:

   · COMBUSTÍVEIS — abre o desvio da conta Combustíveis na ponte da Árvore
     (assets/arvore-impacto.js): Volume (Dispersão de km × R$/km rem) ·
     Eficiência (régua de litros esperados do painel Km/L) · Preço (conta do
     painel R$/L) · Diferença DRE × bases; o Arla vai à parte. Ofensores: as
     placas que mais gastaram litros acima da régua e as que mais pagaram
     acima do preço remunerado (aba Km/L + aba R$/L), e os motoristas com a
     pior nota de condução (ce_scores_mensais), quando a unidade tem.
   · MANUTENÇÕES — onde o dinheiro foi (Carta de Custos: grupo, placa,
     fornecedor; contrato de manutenção por placa e faixa) e os indicadores do
     Ginfo/Gerot do mês fora da meta (SLA, conformidade, preventivas, MTTR,
     MTBF, OS vencidas, saída com OS crítica, checklist, CIVF, stress test,
     disponibilidade), com as listas de HOJE do Ginfo (preventivas vencidas,
     OS em aberto) para virar ação com placa.
   · PNEUS — Carta (pneus novos × recapagem, grupo, placa, fornecedor),
     aderência de aferição, Prolog de hoje (pressão fora, sulco ≤ 3 mm, janela
     de recape 3–4 mm, amplitude > 5 mm) e alinhamentos vencidos do Ginfo.

   E APRENDE de duas formas, as duas à vista na tela:
   · a REDE: correlação entre o desvio de cada pacote e cada indicador, no
     mesmo mês e no mês seguinte, em todas as unidades × meses do banco
     (assets/correlacoes-dados.js + assets/estatistica.js, p ajustado por
     Benjamini-Hochberg). Um indicador ruim só vira causa "sustentada pela
     rede" quando a rede mostra a ligação no sentido certo; senão aparece como
     sinal a conferir.
   · o HISTÓRICO do FCA: as causas e ações que as unidades já escreveram, com
     o resultado no mês seguinte (o desvio do mesmo pacote caiu ou não), por
     tema. A ação automática leva a taxa de acerto do tema dela na rede.

   Nada é gravado: a tela só lê. Funções puras (fatos, diagnostico, rede,
   aprendizado) separadas da leitura (carregar), para o teste rodar em vm.
   ========================================================================== */
(function (global) {
'use strict';
const fin = v => typeof v === 'number' && isFinite(v);
const NK = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const d2 = n => String(n).padStart(2, '0');
const vigLbl = k => { const m = String(k || '').match(/^(\d{4})-(\d{2})$/); return m ? MESES[+m[2] - 1] + '/' + m[1].slice(2) : String(k || ''); };
const vigDeLbl = s => { const m = String(s || '').trim().toLowerCase().match(/^([a-zç]{3})\/(\d{2})$/); if (!m) return null; const i = MESES.indexOf(m[1]); return i < 0 ? null : (2000 + +m[2]) + '-' + d2(i + 1); };
const vigIdx = k => { const m = String(k || '').match(/^(\d{4})-(\d{2})$/); return m ? (+m[1]) * 12 + (+m[2] - 1) : null; };
const vigDeIdx = i => Math.floor(i / 12) + '-' + d2(i % 12 + 1);
const vigAnt = k => vigDeIdx(vigIdx(k) - 1), vigSeg = k => vigDeIdx(vigIdx(k) + 1);
/* datas: Date, "Date(y,m,d)", serial do Excel, dd/mm/aaaa, aaaa-mm-dd, mm/aaaa, mmm/aaaa */
function parseData(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v * 864e5)) : null;
  const s = String(v).trim(); let m;
  if ((m = s.match(/^Date\((\d+),(\d+)(?:,(\d+))?/))) return new Date(+m[1], +m[2], +(m[3] || 1));
  if ((m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/))) return new Date(+m[1], +m[2] - 1, +(m[3] || 1));
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return new Date(+m[2], +m[1] - 1, 1);
  if ((m = s.toLowerCase().match(/^([a-zç]{3})[a-zç]*\.?\s*\/\s*(\d{2,4})$/))) { const i = MESES.indexOf(m[1]); if (i >= 0) { let y = +m[2]; if (y < 100) y += 2000; return new Date(y, i, 1); } }
  return null;
}
const vigDe = v => { const d = parseData(v); return d ? d.getFullYear() + '-' + d2(d.getMonth() + 1) : null; };
const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return isFinite(v) ? v : null; let s = String(v).replace(/\s|R\$|%/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const f = parseFloat(s); return isNaN(f) ? null : f; };

/* ── formatos (pt-BR) ── */
const br = (n, d = 0) => (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
function rs(v) {   // R$ curto: R$ 41,5 mil · R$ 1,2 mi · R$ 840
  if (!fin(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return s + 'R$ ' + br(a / 1e6, 2) + ' mi';
  if (a >= 1e3) return s + 'R$ ' + br(a / 1e3, 1) + ' mil';
  return s + 'R$ ' + br(a, 0);
}
// o mesmo formato do fato do FCA (fca-preenchimento: impFmt)
function impFmt(v) { const a = Math.abs(v); if (a >= 1e6) return String(Math.round(a / 1e6 * 10) / 10).replace('.', ',') + 'M'; if (a >= 1e3) { const k = a >= 1e4 ? Math.round(a / 1e3) : Math.round(a / 100) / 10; return String(k).replace('.', ',') + 'K'; } return String(Math.round(a)); }
const pct = (v, d = 0) => fin(v) ? br(v, d) + '%' : '—';
const sinalPct = (v, d = 0) => fin(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + br(Math.abs(v), d) + '%' : '—';

/* ═════════ unidades, projetos e pacotes ═════════ */
const UNITS = ['CGR', 'BLC', 'CBA T1', 'CBA T1 WH', 'CBA T2', 'FLP', 'GRL', 'NFR', 'PLT', 'RON', 'MCC T1', 'MCC T2', 'PIR', 'ANG', 'GNA'];
const UNIT_BASE = c => { c = String(c || ''); return c.startsWith('CBA ') ? 'CBA' : c.startsWith('MCC ') ? 'MCC' : c; };
const UNIT_TIER = c => { c = String(c || ''); return (c.startsWith('CBA ') || c.startsWith('MCC ')) ? c.slice(4) : ''; };
const tierOfPrefix = (base, p) => { p = NK(p); if (/EMPURRAD/.test(p)) return 'T1'; if (base === 'CBA' && /APOIO/.test(p)) return 'T1 WH'; return 'T2'; };
const sufixo = v => { v = String(v || ''); const i = v.indexOf('-'); return (i >= 0 ? v.slice(i + 1) : v).replace(/\s*\(INATIVO\)\s*/i, '').trim(); };
const prefixo = v => { v = String(v || ''); const i = v.indexOf('-'); return (i >= 0 ? v.slice(0, i) : v).trim(); };
// VAN: o DRE e a Dispersão escrevem "ROTA (VAN)", a aba Km/L escreve "VAN" (Árvore, 24/09/2026)
const projKey = p => { const n = NK(prefixo(p)).replace(/\s*\(INATIVO\)\s*/, ''); return n === 'ROTA (VAN)' ? 'VAN' : n; };
function unidadeDoNv3(nv3) {
  const suf = NK(sufixo(nv3)), pre = prefixo(nv3);
  for (const u of UNITS) { if (UNIT_BASE(u) !== suf) continue; const t = UNIT_TIER(u); if (!t || tierOfPrefix(UNIT_BASE(u), pre) === t) return u; }
  return null;
}
const PACOTES = ['Combustíveis', 'Manutenções', 'Pneus'];
const PACOTES_MAP = {
  'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'Combustíveis', 'COMBUSTIVEIS': 'Combustíveis', 'FLUIDOS (ARLA)': 'Combustíveis', 'ARLA': 'Combustíveis',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'Manutenções', 'MANUTENCAO DE VEICULOS E EQUIP.': 'Manutenções', 'MATERIAIS E FERRAMENTAS DE OFICINA': 'Manutenções',
  'LAVACAO DE VEICULOS': 'Manutenções', 'MANUTENCAO DE CARROCERIAS': 'Manutenções', 'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'Manutenções',
  'PERSONALIZACAO/PADRONIZACAO': 'Manutenções', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'Manutenções', 'CONTRATOS DE MANUTENCAO FABRICANTE': 'Manutenções',
  'CONSERTOS E RECAPAGENS DE PNEUS': 'Pneus', 'PNEUS E CAMARAS': 'Pneus', 'RECAPAGENS E OUTROS SERVICOS': 'Pneus', 'PNEUS NOVOS': 'Pneus'
};
const CONTA_COMB = new Set(['COMBUSTIVEIS VEICULOS E EQUIPAMENTOS', 'COMBUSTIVEIS']);   // a conta da Árvore (sem Arla)
const CONTA_ARLA = new Set(['FLUIDOS (ARLA)', 'ARLA']);
// pacote da Carta (Manutenção) ↔ pacote do FCA (Manutenções)
const PAC_CARTA = { 'Combustíveis': 'Combustíveis', 'Manutenções': 'Manutenção', 'Pneus': 'Pneus' };
const EMPURRADA = u => u === 'PIR' || u === 'CBA T1' || u === 'MCC T1';
const SEARA = u => u === 'ANG';

/* ═════════ índice de colunas por rótulo, com posição padrão ═════════ */
function achaCol(cols, testes, padrao) {
  const n = (cols || []).map(c => String(c || '').toLowerCase());
  for (let i = 0; i < n.length; i++) if (testes.some(t => n[i].includes(t))) return i;
  return padrao == null ? -1 : padrao;
}

/* ═════════ 1) FATOS — o pacote que estourou contra o remunerado ═════════
   dre = {header, rows} da aba Frota (CartaCalc.frota). Custos na DRE são
   NEGATIVOS: estouro = rem − real > 0 (mesma conta do pushDRE). */
function indexaDRE(dre) {
  const h = (dre && dre.header) || [], rows = (dre && dre.rows) || [];
  const iVig = achaCol(h, ['vigência', 'vigencia']), iMes = achaCol(h, ['mês', 'mes']), iAno = achaCol(h, ['ano']);
  const iN3 = achaCol(h, ['nível 3', 'nivel 3', 'nivel3']), iCta = achaCol(h, ['conta gerencial', 'conta']);
  const iRem = achaCol(h, ['remunerado']), iReal = achaCol(h, ['realizado']);
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const acc = {};         // uni|proj|vig → {uni, nv3, proj, vig, contas:{conta:{rem,real}}}
  let maxReal = null;
  rows.forEach(r => {
    let vig = iVig >= 0 ? vigDe(r[iVig]) : null;
    if (!vig && iAno >= 0 && iMes >= 0) { const y = parseInt(r[iAno]); const mm = typeof r[iMes] === 'number' ? r[iMes] : MES[NK(r[iMes]).toLowerCase().slice(0, 3)]; if (y && mm) vig = y + '-' + d2(mm); }
    if (!vig) return;
    const nv3 = String(r[iN3] || '').replace(/\s*\(INATIVO\)\s*/i, ' ').replace(/\s+/g, ' ').trim();
    const uni = unidadeDoNv3(nv3); if (!uni) return;
    const conta = String(r[iCta] || '').trim(); const ck = NK(conta);
    const pac = PACOTES_MAP[ck]; if (!pac) return;
    const rem = num(r[iRem]) || 0, real = num(r[iReal]) || 0;
    if (real !== 0 && (!maxReal || vig > maxReal)) maxReal = vig;
    const pk = projKey(nv3), k = uni + '|' + pk + '|' + vig;
    const a = acc[k] || (acc[k] = { uni, nv3, proj: pk, vig, contas: {} });
    const c = a.contas[conta] || (a.contas[conta] = { conta, ck, pac, rem: 0, real: 0 });
    c.rem += rem; c.real += real;
  });
  return { acc, maxReal };
}
function fatos(dreIdx) {
  const out = [];
  Object.values(dreIdx.acc).forEach(a => {
    if (dreIdx.maxReal && a.vig > dreIdx.maxReal) return;           // meses só orçados
    PACOTES.forEach(pac => {
      const cs = Object.values(a.contas).filter(c => c.pac === pac);
      if (!cs.length) return;
      const rem = cs.reduce((s, c) => s + c.rem, 0), real = cs.reduce((s, c) => s + c.real, 0);
      if (!real) return;
      const over = rem - real, dpct = Math.abs(rem) > 0 ? over / Math.abs(rem) * 100 : 0;
      const contas = cs.map(c => { const ov = c.rem - c.real, b = Math.abs(c.rem); return { conta: c.conta, ck: c.ck, ov, rem: -c.rem, real: -c.real, p: b > 0 ? Math.round(Math.abs(ov) / b * 100) : null }; })
        .filter(c => Math.round(c.ov) !== 0)
        .sort((x, y) => { const px = x.ov > 0, py = y.ov > 0; if (px && py) return y.ov - x.ov; if (px) return -1; if (py) return 1; return x.ov - y.ov; });
      out.push({ id: a.uni + '|' + a.proj + '|' + pac + '|' + a.vig, uni: a.uni, nv3: a.nv3, proj: a.proj, pac, vig: a.vig, vigLbl: vigLbl(a.vig),
        rem: -rem, real: -real, over, dpct, estourou: over > 0 && rem !== 0, sev: dpct >= 5 ? 'crit' : 'aten', contas });
    });
  });
  return out;
}
// "Desvio: ▲ R$ 41.454 · ▲ -12%" + as contas — o mesmo texto do fato do FCA
function desvioTxt(f) {
  const ls = [`Desvio: ▲ R$ ${Math.round(Math.abs(f.over)).toLocaleString('pt-BR')} · ▲ -${Math.round(f.dpct)}%`];
  if (f.contas.length) { ls.push('Contas:'); f.contas.forEach(o => { const s = o.ov > 0 ? '▲' : '▼'; ls.push(`- ${o.conta}: ${s} ${impFmt(o.ov)}${o.p != null ? ' | ' + s + ' ' + o.p + '%' : ''}${o.ov < 0 ? ' (saving)' : ''}`); }); }
  return ls.join('\n');
}

/* ═════════ 2) BASES DE COMBUSTÍVEL (Dispersão, Km/L, R$/L) ═════════ */
function indexaDisp(disp) {
  const cols = (disp && disp.cols) || [], rows = (disp && disp.rows) || [];
  const c = { vig: 0, proj: achaCol(cols, ['proj.'], 14), rem: achaCol(cols, ['km rem. tt'], 31), real: achaCol(cols, ['km rodado tt'], 32),
    vgTot: achaCol(cols, ['viagens - real'], 22), vgRec: achaCol(cols, ['viagens rec'], 25), vgNot: achaCol(cols, ['viagens noturnas'], 28), vgMap: achaCol(cols, ['viagens mapa aberto'], 38) };
  const acc = {};
  rows.forEach(r => {
    const vig = vigDe(r[c.vig]); if (!vig) return;
    const n3 = String(r[c.proj] || ''); const uni = unidadeDoNv3(n3); if (!uni) return;
    const k = uni + '|' + projKey(n3) + '|' + vig;
    const a = acc[k] || (acc[k] = { rem: 0, real: 0, vgTot: 0, vgRec: 0, vgNot: 0, vgMap: 0 });
    a.rem += num(r[c.rem]) || 0; a.real += num(r[c.real]) || 0;
    a.vgTot += num(r[c.vgTot]) || 0; a.vgRec += num(r[c.vgRec]) || 0; a.vgNot += num(r[c.vgNot]) || 0; a.vgMap += num(r[c.vgMap]) || 0;
  });
  return acc;
}
/* preço remunerado da aba R$/L (KML_ID): mesma consulta da Árvore — chave
   "PROJ - UNI" × mês × combustível, VAN sem preço usa o do ROTA da unidade */
function indexaPreco(rsl) {
  const cols = (rsl && rsl.cols) || [], rows = (rsl && rsl.rows) || [];
  const cProj = achaCol(cols, ['unidade benner']), cPreco = achaCol(cols, ['precooperadora', 'preco operadora']), cFuel = achaCol(cols, ['tipocombustivel', 'combustivel', 'combustível']);
  let cVig = -1;
  for (let i = 0; i < cols.length; i++) { const lc = String(cols[i] || '').toLowerCase(); if (lc.includes('vigência') || lc.includes('vigencia')) { const sv = (rows.find(r => r[i] != null) || [])[i]; if (vigDe(sv)) { cVig = i; break; } } }
  if (cVig < 0) cVig = 3;
  const L1 = new Map(), L2 = new Map();
  const nf = s => { let x = String(s || ''); const i = x.indexOf(':'); if (i >= 0) x = x.slice(i + 1); return NK(x); };
  if (cProj >= 0 && cPreco >= 0) rows.forEach(r => {
    const p = NK(r[cProj]), ym = vigDe(r[cVig]); if (!p || !ym) return;
    const v = num(r[cPreco]) || 0; if (!(v > 0)) return;
    const fu = cFuel >= 0 ? nf(r[cFuel]) : '';
    [[L1, p + '|' + ym + '|' + fu], [L2, p + '|' + ym]].forEach(([L, k]) => { const e = L.get(k) || { s: 0, n: 0 }; e.s += v; e.n++; L.set(k, e); });
  });
  const vanRota = p => { const m = String(p).match(/^(?:ROTA \(VAN\)|VAN)\s*-\s*(.+)$/); return m ? 'ROTA - ' + m[1] : null; };
  return function precoRem(projUni, ym, fuel) {
    const p = NK(projUni), fu = nf(fuel);
    let e = L1.get(p + '|' + ym + '|' + fu) || L2.get(p + '|' + ym);
    const q = !e && vanRota(p); if (q) e = L1.get(q + '|' + ym + '|' + fu) || L2.get(q + '|' + ym);
    return e && e.n > 0 ? e.s / e.n : null;
  };
}
/* aba Km/L: uma linha por placa × mês. A aba chega sem cabeçalho às vezes:
   vale a posição padrão (KmL Aba Inspect: E rem médio · F rem modelo · G real ·
   I R$/L rem · J real · O Projeto-Unidade · Q Placa · T Modelo · W Km · X Litros · Z TOTAL R$) */
function indexaKml(kml, precoRem) {
  const cols = (kml && kml.cols) || [], rows = (kml && kml.rows) || [];
  const c = { vig: achaCol(cols, ['vigência', 'vigencia'], 0), rem: achaCol(cols, ['rem médio', 'rem medio'], 4), remM: achaCol(cols, ['rem modelo'], 5),
    real: achaCol(cols, ['km/l real'], 6), rsLReal: achaCol(cols, ['r$/l real', 'rs/l real'], 9), proj: achaCol(cols, ['projeto'], 14), placa: achaCol(cols, ['placa'], 16),
    modelo: 19, fuel: achaCol(cols, ['tipo combust', 'combustivel', 'combustível']), km: achaCol(cols, ['km rodado', 'km_rodado', 'kmrodado'], 22),
    lit: achaCol(cols, ['qtd total de litro', 'qtd litro', 'qtd total', 'litro'], 23), tot: achaCol(cols, ['totas r$', 'total r$', 'total geral'], 25) };
  for (let i = 0; i < cols.length; i++) { const lc = String(cols[i] || '').toLowerCase(); if (lc.includes('modelo') && !/rem|km\/l|km \/l/.test(lc)) { c.modelo = i; break; } }
  const acc = {};
  rows.forEach(r => {
    const vig = vigDe(r[c.vig]); if (!vig) return;
    const n3 = String(r[c.proj] || ''); const uni = unidadeDoNv3(n3); if (!uni) return;
    const km = num(r[c.km]) || 0, lit = num(r[c.lit]) || 0; if (!(km > 0 || lit > 0)) return;
    const tot = num(r[c.tot]) || 0, fuel = c.fuel >= 0 ? r[c.fuel] : '';
    const k = uni + '|' + projKey(n3) + '|' + vig;
    (acc[k] || (acc[k] = [])).push({ placa: String(r[c.placa] || '').trim().toUpperCase(), modelo: String(r[c.modelo] || '').trim(), km, lit, tot,
      remMed: num(r[c.rem]) || 0, remMod: num(r[c.remM]) || 0, kmlReal: num(r[c.real]) || (lit > 0 ? km / lit : 0),
      rsLReal: num(r[c.rsLReal]) || (lit > 0 ? tot / lit : 0), pRem: precoRem ? precoRem(n3, vig, fuel) : null });
  });
  return acc;
}
/* régua de litros esperados (painel Km/L, Árvore e Frota de Elite): rem do
   projeto × mês = média simples do Km/L rem médio; previstos = km ÷ rem.
   Preço = Σ R$ − Σ(preço rem × litros) nos litros com preço (painel R$/L).
   Eficiência = (litros − previstos) × R$/L rem ponderado pelo km (Km/L). */
function combBases(ls) {
  if (!ls || !ls.length) return null;
  let km = 0, lit = 0, tot = 0, s = 0, n = 0, rxl = 0, litR = 0, totR = 0, pkm = 0, kmp = 0;
  ls.forEach(r => { km += r.km; lit += r.lit; tot += r.tot; if (r.remMed > 0) { s += r.remMed; n++; }
    if (r.pRem > 0) { rxl += r.pRem * r.lit; litR += r.lit; if (r.tot > 0) totR += r.tot; }
    const pr = r.pRem > 0 ? r.pRem : r.rsLReal; if (r.km > 0 && pr > 0) { pkm += pr * r.km; kmp += r.km; } });
  const rp = n ? s / n : null, litEsp = rp > 0 ? km / rp : null, pr = kmp > 0 ? pkm / kmp : null;
  const placas = ls.map(r => {
    const esp = rp > 0 && r.km > 0 ? r.km / rp : null, prr = r.pRem > 0 ? r.pRem : r.rsLReal;
    return { ...r, litEsp: esp, litMais: esp != null ? r.lit - esp : null, rsEfic: esp != null && prr > 0 ? (r.lit - esp) * prr : null,
      rsPreco: r.pRem > 0 && r.tot > 0 ? r.tot - r.pRem * r.lit : null };
  });
  return { km, lit, tot, kmLRem: rp, kmLReal: lit > 0 ? km / lit : null, rsLRem: litR > 0 ? rxl / litR : null, rsLReal: lit > 0 ? tot / lit : null,
    preco: litR > 0 ? totR - rxl : null, efic: litEsp > 0 && lit > 0 && pr > 0 ? (lit - litEsp) * pr : null, litEsp, prRem: pr, placas };
}

/* ═════════ 3) A REDE — correlação desvio × indicador ═════════
   fatoUni = CorrDados FATO.uni ({ent, cod, vig, v}). Mesmo mês e mês
   seguinte (indicador de t−1 contra o desvio de t, dentro da unidade). */
const DRIVERS = {
  'Combustíveis': ['dispersao', 'comb', 'km_viagem', 'disp', 'sla', 'prev', 'checkT'],
  'Manutenções': ['sla', 'conf', 'prev', 'disp', 'mttr', 'mtbf', 'osVenc', 'osCritica', 'checkT', 'civf', 'stVeic', 'disp_app', 'indisp_med', 'dispersao', 'km_viagem'],
  'Pneus': ['pneus', 'dispersao', 'km_viagem', 'conf', 'checkT', 'civf', 'stVeic', 'prev']
};
const Y_PAC = { 'Combustíveis': 'desvio_comb', 'Manutenções': 'desvio_manut', 'Pneus': 'desvio_pneus' };
// sentido em que o indicador é BOM (up = maior é melhor); o resto vem do catálogo do CorrDados
const DIR = { dispersao: 'down', comb: 'up', km_viagem: null, disp: 'up', sla: 'up', prev: 'up', checkT: 'up', conf: 'up', mttr: 'down', mtbf: 'up', osVenc: 'down', osCritica: 'down',
  civf: 'up', stVeic: 'up', disp_app: 'up', indisp_med: 'down', pneus: 'up' };
const ROT = { dispersao: 'Dispersão de km', comb: 'Km/L', km_viagem: 'Km por viagem', disp: 'Disponibilidade', sla: 'SLA de manutenção', prev: 'Preventivas',
  checkT: 'Checklist T1/T2', conf: 'Conformidade', mttr: 'MTTR', mtbf: 'MTBF', osVenc: 'OS vencidas', osCritica: 'Saída com OS crítica', civf: 'CIVF',
  stVeic: 'Stress Test veículos', disp_app: 'Disponibilidade (app)', indisp_med: 'Veículos indisponíveis', pneus: 'Aferição de pneus' };
function rede(fatoUni, Estat) {
  const out = {}; if (!Estat || !fatoUni) return out;
  const todos = [];
  PACOTES.forEach(pac => {
    const y = Y_PAC[pac]; out[pac] = [];
    DRIVERS[pac].forEach(x => {
      const xs = [], ys = [], ser = [];
      fatoUni.forEach(L => { const vx = L.v[x], vy = L.v[y]; const t = vigIdx(L.vig);
        if (fin(vx) && fin(vy)) { xs.push(vx); ys.push(vy); }
        if (t != null) ser.push({ ent: L.ent, t, x: fin(vx) ? vx : null, y: fin(vy) ? vy : null }); });
      const c0 = Estat.pearson(xs, ys);
      const lag = Estat.defasagens(ser, 1)[1] || { r: NaN, n: 0, p: NaN };
      const d = DIR[x];
      const apoia = r => fin(r) && d ? (d === 'up' ? r < 0 : r > 0) : null;   // indicador pior ↔ desvio maior
      const e = { pac, x, rot: ROT[x] || x, dir: d, r0: c0.r, n0: c0.n, p0: c0.p, r1: lag.r, n1: lag.n, p1: lag.p, apoia0: apoia(c0.r), apoia1: apoia(lag.r) };
      out[pac].push(e); todos.push(e);
    });
  });
  // p ajustado (BH) sobre TODOS os testes do painel, mesmo mês e mês seguinte juntos
  const ps = []; todos.forEach(e => { ps.push(e.n0 >= Estat.N_MIN ? e.p0 : NaN); ps.push(e.n1 >= Estat.N_MIN ? e.p1 : NaN); });
  const q = Estat.bh(ps);
  todos.forEach((e, i) => { e.q0 = q[2 * i]; e.q1 = q[2 * i + 1];
    e.sust = (e.apoia0 && e.q0 < 0.10) || (e.apoia1 && e.q1 < 0.10);   // a rede sustenta: sentido certo e dificilmente acaso
    e.forca = Math.max(fin(e.r0) && e.apoia0 ? Math.abs(e.r0) : 0, fin(e.r1) && e.apoia1 ? Math.abs(e.r1) : 0); });
  PACOTES.forEach(p => out[p].sort((a, b) => (b.sust - a.sust) || (b.forca - a.forca)));
  return out;
}
const forcaTxt = r => { const a = Math.abs(r); if (!fin(r)) return '—'; if (a >= 0.7) return 'forte'; if (a >= 0.4) return 'moderada'; if (a >= 0.2) return 'fraca'; return 'quase nenhuma'; };
function redeLeitura(e) {
  if (!e) return '';
  const melhor = [];
  if (fin(e.r0) && e.n0 >= 8) melhor.push({ k: 'no mesmo mês', r: e.r0, q: e.q0, n: e.n0, ap: e.apoia0 });
  if (fin(e.r1) && e.n1 >= 8) melhor.push({ k: 'no mês seguinte', r: e.r1, q: e.q1, n: e.n1, ap: e.apoia1 });
  const b = melhor.filter(m => m.ap).sort((x, y) => Math.abs(y.r) - Math.abs(x.r))[0];
  if (!b) return 'na rede, não aparece ligação no sentido esperado';
  return `na rede, ligação ${forcaTxt(b.r)} ${b.k} (r = ${br(b.r, 2)}, ${b.n} unidade-mês${b.q < 0.10 ? '' : ', pode ser coincidência'})`;
}

/* ═════════ 4) HISTÓRICO DO FCA — o que as unidades já escreveram ═════════ */
const TEMAS = [
  { k: 'Preventiva', re: /preventiv|revis[aã]o program/ },
  { k: 'Corretiva / quebra', re: /corretiv|quebra|falha|socorro|guincho|pane/ },
  { k: 'Oficina / SLA', re: /oficina|mec[aâ]nic|\bsla\b|m[aã]o de obra|tempo de reparo|mttr/ },
  { k: 'Peças / fornecedor', re: /fornecedor|\bpe[cç]as?\b|or[cç]amento|cota[cç]|compra/ },
  { k: 'Contrato', re: /contrato|faixa|fabricante|volks|\bvw\b/ },
  { k: 'Pneus', re: /pneu|recap|calibr|alinh|sulco|afer/ },
  { k: 'Condução', re: /motorist|condu[cç]|treinament|telemetr|ociosid|marcha lenta|rpm/ },
  { k: 'Abastecimento / preço', re: /pre[cç]o|posto|abastec|diesel|litro|arla|tanque/ },
  { k: 'Km / rota', re: /\bkm\b|rota|roteir|viage|dispers|deslocament/ },
  { k: 'Lançamento / contábil', re: /lan[cç]ament|provis|nota fiscal|\bnf\b|rateio|cont[aá]bil|estorno|reclassific|competência|competencia/ },
  { k: 'Sinistro / avaria', re: /sinistr|acident|colis|avaria|batid/ },
  { k: 'Frota / idade', re: /idade|antig|renova|frota velha|substitui/ }
];
const temasDe = t => { const s = String(t || '').toLowerCase(); return TEMAS.filter(x => x.re.test(s)).map(x => x.k); };
const nomeLimpo = t => String(t || '').split('\n')[0].trim().replace(/(\S)\s*desvio\s*(de\s+r\$|:|$)[\s\S]*$/i, '$1').replace(/\s+desvio\b[\s\S]*$/i, '').replace(/^pacote\s+/i, '').trim();
const pacDoFato = t => { const n = NK(nomeLimpo(t)); if (/COMBUST/.test(n)) return 'Combustíveis'; if (/MANUT/.test(n)) return 'Manutenções'; if (/PNEU/.test(n)) return 'Pneus'; return null; };
/* fcaRows = tabela fca (todas); mapaFatos = id → fato (todas as vigências).
   Resultado de cada FCA preenchido: o desvio do MESMO pacote no mês seguinte. */
function aprendizado(fcaRows, todosFatos, maxVig) {
  const porId = {}; todosFatos.forEach(f => { porId[f.id] = f; });
  const vigsDRE = new Set(todosFatos.map(f => f.vig));
  const casos = [];
  (fcaRows || []).forEach(r => {
    if (String(r.origem || '').toLowerCase() !== 'custos') return;
    const causa = String(r.causa || '').trim(), acao = String(r.acao || '').trim();
    if (!causa && !acao) return;
    const pac = pacDoFato(r.fato); const vig = vigDeLbl(r.vigencia); if (!pac || !vig) return;
    const uni = String(r.unidade || '').replace(/\s*\(INATIVO\)\s*/gi, ' ').trim();
    const proj = projKey(r.projeto || '');
    const id = uni + '|' + proj + '|' + pac + '|' + vig, prox = uni + '|' + proj + '|' + pac + '|' + vigSeg(vig);
    const f = porId[id], g = porId[prox];
    let res = 'aguardando', overProx = null;
    if (maxVig && vigSeg(vig) <= maxVig && vigsDRE.has(vigSeg(vig))) {
      overProx = g ? Math.max(0, g.over) : 0;
      if (f && f.over > 0) res = overProx < f.over * 0.9 ? 'melhorou' : (overProx > f.over * 1.1 ? 'piorou' : 'igual');
      else res = overProx > 0 ? 'piorou' : 'melhorou';
    }
    casos.push({ id: r.id, uni, proj, pac, vig, causa, acao, temas: temasDe(causa + '\n' + acao), over: f ? f.over : null, overProx, res, status: r.status || '' });
  });
  const temas = {};
  casos.forEach(c => c.temas.forEach(t => { const k = c.pac + '|' + t; const e = temas[k] || (temas[k] = { pac: c.pac, tema: t, n: 0, aval: 0, melhor: 0 });
    e.n++; if (c.res !== 'aguardando') { e.aval++; if (c.res === 'melhorou') e.melhor++; } }));
  return { casos, temas: Object.values(temas).sort((a, b) => a.pac.localeCompare(b.pac) || b.n - a.n) };
}

/* ═════════ 5) DIAGNÓSTICO de um fato: causas + ações ═════════
   ctx = {kml, disp, fatoUni:{cod|vig → v}, fatoPlaca, fatoMot, carta, ginfo,
          prolog, rede, aprend, metasRede} */
const METAS = { disp: 95, prev: 100, pneus: 100, checkT: 95, checkWH: 95, conf: 100, stVeic: 100, stEmp: 100, civf: 100, sla: 75, osVenc: 10, osCritica: 0, blitz: 100 };
const FMT_IND = { disp: 'pct', prev: 'pct', pneus: 'pct', checkT: 'pct', conf: 'pct', stVeic: 'pct', civf: 'pct', sla: 'pct', osVenc: 'n', osCritica: 'n', mttr: 'h', mtbf: 'h', disp_app: 'pct', indisp_med: 'd1', dispersao: 'pct' };
const fmtInd = (k, v) => !fin(v) ? '—' : FMT_IND[k] === 'pct' ? pct(v, 1) : FMT_IND[k] === 'h' ? br(v, 1) + ' h' : FMT_IND[k] === 'd1' ? br(v, 1) : br(v, 0);
const quartis = xs => { const s = xs.filter(fin).sort((a, b) => a - b); if (s.length < 4) return null; const q = p => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }; return { q1: q(.25), q2: q(.5), q3: q(.75) }; };
/* indicadores da unidade no mês contra a meta (ou o quartil da rede no MTTR/MTBF) */
function indicadores(cod, vig, ctx, lista) {
  const v = (ctx.fatoUni[cod + '|' + vig] || {});
  const out = [];
  lista.forEach(k => {
    const x = v[k]; if (!fin(x)) return;
    let meta = METAS[k], ruim = null, ref = '';
    if (k === 'mttr' || k === 'mtbf') {
      const qs = (ctx.quartisRede[vig] || {})[k];
      if (qs) { if (k === 'mttr') { ruim = x > qs.q3; ref = `pior quartil da rede > ${fmtInd(k, qs.q3)}`; meta = qs.q3; } else { ruim = x < qs.q1; ref = `pior quartil da rede < ${fmtInd(k, qs.q1)}`; meta = qs.q1; } }
    } else if (k === 'dispersao') { meta = SEARA(cod) ? 10 : 5; ruim = x > meta; ref = `meta ${meta}%`; }
    else if (k === 'disp_app') { meta = 95; ruim = x < meta; ref = 'meta 95%'; }
    else if (k === 'indisp_med') { ruim = null; }
    else if (meta != null) { ruim = (k === 'osVenc' || k === 'osCritica') ? x > meta : x < meta; ref = `meta ${fmtInd(k, meta)}`; }
    const re = ((ctx.rede[ctx._pac] || []).find(e => e.x === k)) || null;
    out.push({ k, rot: ROT[k] || k, val: x, meta, ref, ruim, rede: re });
  });
  return out;
}
const top = (arr, n, by) => arr.slice().sort((a, b) => by(b) - by(a)).slice(0, n);
const somaPor = (rows, key, val) => { const m = {}; rows.forEach(r => { const k = key(r) || '(sem ' + 'informação)'; m[k] = (m[k] || 0) + val(r); }); return Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v); };
function taxaTema(ctx, pac, tema) {
  const e = (ctx.aprend && ctx.aprend.temas || []).find(t => t.pac === pac && t.tema === tema);
  return e && e.aval ? { ...e, txt: `na rede, FCAs de ${tema.toLowerCase()} em ${pac} melhoraram o mês seguinte em ${e.melhor} de ${e.aval}` } : null;
}
function diagnostico(f, ctx) {
  ctx._pac = f.pac;
  const D = { causas: [], acoes: [], sinais: [], blocos: {}, explicado: 0, avisos: [] };
  const causa = (tema, txt, rsv, extra) => D.causas.push(Object.assign({ tema, txt, rs: fin(rsv) ? rsv : null }, extra || {}));
  const acao = (tema, txt, ofens, temaRede) => { const tx = taxaTema(ctx, f.pac, temaRede || tema); D.acoes.push({ tema, txt, ofens: ofens || [], taxa: tx }); };
  const k = f.uni + '|' + f.proj + '|' + f.vig;
  const base = Math.max(f.over, 0) || 1;
  D.minimo = Math.max(100, 0.01 * base);     // abaixo disso a linha não diz nada (rodou 0 km, economizou R$ 0)

  if (f.pac === 'Combustíveis') diagComb(f, ctx, D, causa, acao, k, base);
  else if (f.pac === 'Manutenções') diagManut(f, ctx, D, causa, acao, base);
  else diagPneus(f, ctx, D, causa, acao, base);

  // quanto do desvio as causas em R$ explicam (só Combustíveis tem a ponte que
  // fecha no Δ do custo; em Manutenções e Pneus as contas JÁ são o fato, e o que
  // o motor traz é onde o dinheiro foi e o que estava fora da meta)
  if (f.pac === 'Combustíveis') {
    const pos = D.causas.filter(c => c.rs > 0 && c.soma !== false).reduce((s, c) => s + c.rs, 0);
    D.explicado = f.over > 0 ? Math.min(1, pos / f.over) : 0;
    D.causas.forEach(c => { if (c.rs > 0 && c.soma !== false && f.over > 0) c.part = c.rs / f.over; });
  } else D.explicado = null;
  // ordem: R$ primeiro (o que fecha a conta), depois o que a rede sustenta, depois o resto
  const peso = c => (c.soma === false ? 0 : (c.rs || 0)) * 10 + (c.rede ? 5 : 0) + (c.rs != null && c.soma !== false ? 1 : 0);
  D.causas.sort((a, b) => peso(b) - peso(a));
  D.historico = histDoFato(f, ctx);
  D.causaTxt = D.causas.map((c, i) => `${i + 1}. ${c.txt}`).join('\n');
  D.acaoTxt = D.acoes.map((a, i) => `${i + 1}. ${a.txt}${a.ofens.length ? ': ' + a.ofens.join(' · ') : ''}`).join('\n');
  return D;
}
function histDoFato(f, ctx) {
  const cs = (ctx.aprend && ctx.aprend.casos) || [];
  const daUni = cs.filter(c => c.uni === f.uni && c.pac === f.pac && c.vig < f.vig).sort((a, b) => b.vig.localeCompare(a.vig)).slice(0, 4);
  const doMes = cs.filter(c => c.uni === f.uni && c.pac === f.pac && c.vig === f.vig && c.proj === f.proj);
  const temasAuto = new Set(); /* preenchido no fim do diagnóstico pela tela, se quiser */
  const outras = cs.filter(c => c.uni !== f.uni && c.pac === f.pac && c.res === 'melhorou' && c.acao && c.over > 0)
    .map(c => ({ ...c, queda: c.over - (c.overProx || 0) })).sort((a, b) => b.queda - a.queda).slice(0, 3);
  return { daUni, doMes, outras, temasAuto };
}

/* ── COMBUSTÍVEIS ── */
function diagComb(f, ctx, D, causa, acao, k, base) {
  const Arv = ctx.ArvImpacto;
  const ls = ctx.kml[k] || [], cb = combBases(ls), dp = ctx.disp[k] || null;
  // a conta Combustíveis sem Arla, inclusive quando ela não estourou sozinha
  const contasTodas = (ctx.dreAcc[k] && Object.values(ctx.dreAcc[k].contas)) || [];
  const comb = contasTodas.filter(c => CONTA_COMB.has(NK(c.conta))).reduce((s, c) => ({ rem: s.rem + c.rem, real: s.real + c.real }), { rem: 0, real: 0 });
  const arla = contasTodas.filter(c => CONTA_ARLA.has(NK(c.conta))).reduce((s, c) => ({ rem: s.rem + c.rem, real: s.real + c.real }), { rem: 0, real: 0 });
  const b = Arv ? Arv.calc({ custoRem: comb.rem, custoReal: comb.real, kmRem: dp ? dp.rem : 0, kmReal: dp ? dp.real : 0,
    rsLRem: cb && cb.rsLRem, rsLReal: cb && cb.rsLReal, kmLRem: cb && cb.kmLRem, kmLReal: cb && cb.kmLReal,
    impPrecoBase: cb ? cb.preco : null, impEficBase: cb ? cb.efic : null, litBase: cb ? cb.lit : 0, kmBase: cb ? cb.km : 0, totBase: cb ? cb.tot : 0 }) : null;
  D.blocos.ponte = b; D.blocos.comb = cb; D.blocos.disp = dp;
  if (!cb) D.avisos.push(SEARA(f.uni) ? 'A Seara não está na aba Km/L do Consumo: eficiência e preço da Anhanguera ficam de fora deste motor.' : 'Sem linhas na aba Km/L para este projeto e mês: eficiência e preço não foram abertos.');
  if (!dp) D.avisos.push('Sem km da Dispersão de km para este projeto e mês: o volume não foi calculado.');

  // Volume
  if (b && fin(b.vol) && dp && dp.rem > 0) {
    const dkm = dp.real - dp.rem, dpct = (dp.real / dp.rem - 1) * 100;
    if (b.vol >= D.minimo) {
      const extra = EMPURRADA(f.uni) ? ' (km remunerado bruto, sem o balanço de massa: conferir no Painel KM antes de agir)' : '';
      causa('Km / rota', `Volume: rodou ${br(dkm, 0)} km acima do remunerado (Dispersão ${sinalPct(dpct, 1)}), ${rs(b.vol)} no R$/km remunerado${extra}`, b.vol);
      const vg = []; if (dp.vgRec) vg.push(br(dp.vgRec, 0) + ' recs'); if (dp.vgNot) vg.push(br(dp.vgNot, 0) + ' noturnas'); if (dp.vgMap) vg.push(br(dp.vgMap, 0) + ' com mapa aberto');
      acao('Km / rota', `Conferir as viagens que não remuneram e a roteirização no Painel KM${vg.length ? ' (no mês: ' + vg.join(', ') + ' de ' + br(dp.vgTot, 0) + ' viagens)' : ''}`);
    } else if (Math.abs(b.vol) >= D.minimo) causa('Km / rota', `Volume: rodou ${br(-dkm, 0)} km abaixo do remunerado (Dispersão ${sinalPct(dpct, 1)}), ${rs(b.vol)}: o km não explica o estouro`, b.vol, { soma: false });
  }
  // Eficiência
  if (cb && fin(cb.efic)) {
    const dk = cb.kmLRem > 0 && cb.kmLReal > 0 ? (cb.kmLReal / cb.kmLRem - 1) * 100 : null;
    if (cb.efic >= D.minimo) {
      causa('Condução', `Eficiência: Km/L ${br(cb.kmLReal, 2)} contra ${br(cb.kmLRem, 2)} remunerado (${sinalPct(dk, 1)}), ${br(cb.lit - cb.litEsp, 0)} L a mais, ${rs(cb.efic)}`, cb.efic);
      const of = top(cb.placas.filter(p => p.rsEfic > 0 && p.placa), 5, p => p.rsEfic)
        .map(p => `${p.placa}${p.modelo ? ' (' + p.modelo + ')' : ''} ${br(p.kmlReal, 2)} km/L, ${br(p.litMais, 0)} L, ${rs(p.rsEfic)}`);
      if (of.length) acao('Condução', `Vistoria de consumo nas placas que mais gastaram acima da régua (vazamento, injeção, filtro, pneu murcho, ocioso) e acompanhar quem dirige`, of);
    } else if (Math.abs(cb.efic) >= D.minimo) causa('Condução', `Eficiência: Km/L ${br(cb.kmLReal, 2)} contra ${br(cb.kmLRem, 2)} remunerado (${sinalPct(dk, 1)}), economizou ${rs(-cb.efic)}`, cb.efic, { soma: false });
  }
  // Preço
  if (cb && fin(cb.preco)) {
    const dp2 = cb.rsLRem > 0 && cb.rsLReal > 0 ? (cb.rsLReal / cb.rsLRem - 1) * 100 : null;
    if (cb.preco >= D.minimo) {
      causa('Abastecimento / preço', `Preço: R$/L ${br(cb.rsLReal, 2)} contra ${br(cb.rsLRem, 2)} remunerado (${sinalPct(dp2, 1)}), ${rs(cb.preco)}`, cb.preco);
      const of = top(cb.placas.filter(p => p.rsPreco > 0 && p.placa), 5, p => p.rsPreco).map(p => `${p.placa} R$/L ${br(p.rsLReal, 2)} × ${br(p.pRem, 2)}, ${rs(p.rsPreco)}`);
      acao('Abastecimento / preço', `Direcionar o abastecimento para o posto/tanque com preço no remunerado e cobrar o preço negociado; placas que mais pagaram acima`, of);
    } else if (Math.abs(cb.preco) >= D.minimo) causa('Abastecimento / preço', `Preço: R$/L ${br(cb.rsLReal, 2)} contra ${br(cb.rsLRem, 2)} remunerado (${sinalPct(dp2, 1)}), economizou ${rs(-cb.preco)}`, cb.preco, { soma: false });
  }
  // Diferença DRE × bases
  if (b && fin(b.dif) && Math.abs(b.dif) >= Math.max(1000, 0.1 * base)) {
    const l = [];
    if (fin(b.difReal) && Math.abs(b.difReal) >= 500) l.push(`realizado da DRE ${b.difReal > 0 ? 'acima' : 'abaixo'} dos abastecimentos da aba Km/L em ${rs(Math.abs(b.difReal))}`);
    if (fin(b.difRem) && Math.abs(b.difRem) >= 500) l.push(`remunerado da DRE ${b.difRem > 0 ? 'abaixo' : 'acima'} do que as bases preveem em ${rs(Math.abs(b.difRem))}`);
    if (b.dif > 0) {
      causa('Lançamento / contábil', `Diferença DRE × bases: ${rs(b.dif)} que o km, a eficiência e o preço não explicam${l.length ? ' (' + l.join('; ') + ')' : ''}`, b.dif);
      acao('Lançamento / contábil', `Conciliar a conta Combustíveis do DRE com os abastecimentos do mês (lançamento de outra competência, provisão, placa de outro projeto)`);
    }
  }
  // Arla
  const ovArla = arla.rem - arla.real;    // negativos: estouro > 0
  if (ovArla > 0 && Math.abs(arla.rem) > 0) {
    causa('Abastecimento / preço', `Arla: ${rs(ovArla)} acima do remunerado (${sinalPct(ovArla / Math.abs(arla.rem) * 100, 0)})`, ovArla);
    acao('Abastecimento / preço', `Conferir a proporção Arla/diesel por placa e o preço do Arla do mês`);
  }
  // condução (telemetria) — quando a unidade tem
  const mot = (ctx.fatoMot[f.uni + '|' + f.vig] || []).filter(m => fin(m.v.nota) && (m.v.km || 0) >= 500);
  if (mot.length) {
    const baixos = mot.filter(m => m.v.nota < 75);
    const kmT = mot.reduce((s, m) => s + (m.v.km || 0), 0), kmB = baixos.reduce((s, m) => s + (m.v.km || 0), 0);
    D.blocos.mot = mot;
    if (baixos.length) {
      D.sinais.push({ tema: 'Condução', txt: `Condução (telemetria): ${baixos.length} de ${mot.length} motoristas abaixo de 75 pontos, com ${pct(kmT ? kmB / kmT * 100 : 0)} do km` });
      const of = top(baixos, 5, m => (75 - m.v.nota) * (m.v.km || 0)).map(m => `${m.nome || m.ent} ${br(m.v.nota, 0)} pts, ${br(m.v.km, 0)} km${fin(m.v.km_l) ? ', ' + br(m.v.km_l, 2) + ' km/L' : ''}`);
      if (cb && cb.efic > 0) acao('Condução', `Feedback de condução (faixa verde, motor ligado parado) com os motoristas de pior nota no DriverPro`, of);
    }
  }
  // indicadores que a rede liga ao desvio de Combustíveis
  // Dispersão e Km/L já estão na ponte (volume e eficiência): aqui só o que ela não mede
  sinaisRede(f, ctx, D, ['disp', 'sla', 'prev', 'checkT']);
}
/* indicadores fora da meta: viram causa quando a rede sustenta, sinal quando não */
function sinaisRede(f, ctx, D, lista) {
  const ind = indicadores(f.uni, f.vig, ctx, lista); D.blocos.ind = ind;
  ind.filter(i => i.ruim).forEach(i => {
    const txt = `${i.rot} ${fmtInd(i.k, i.val)} (${i.ref}); ${redeLeitura(i.rede)}`;
    if (i.rede && i.rede.sust) D.causas.push({ tema: TEMA_IND[i.k] || 'Oficina / SLA', txt, rs: null, rede: true, ind: i.k });
    else D.sinais.push({ tema: TEMA_IND[i.k] || '', txt, ind: i.k });
  });
  return ind;
}
const TEMA_IND = { sla: 'Oficina / SLA', mttr: 'Oficina / SLA', osVenc: 'Oficina / SLA', prev: 'Preventiva', conf: 'Corretiva / quebra', checkT: 'Corretiva / quebra', osCritica: 'Corretiva / quebra',
  mtbf: 'Corretiva / quebra', civf: 'Corretiva / quebra', stVeic: 'Frota / idade', disp: 'Oficina / SLA', disp_app: 'Oficina / SLA', indisp_med: 'Oficina / SLA', dispersao: 'Km / rota', comb: 'Condução', pneus: 'Pneus' };
const ACAO_IND = {
  prev: 'Zerar as preventivas vencidas (lista do Ginfo de hoje)',
  sla: 'Cobrar o SLA da oficina/fornecedor e priorizar as OS em aberto há mais tempo',
  mttr: 'Reduzir o tempo de reparo: atacar primeiro as placas paradas há mais dias',
  osVenc: 'Fechar as OS vencidas no Ginfo',
  conf: 'Regularizar a conformidade das placas pendentes (checklist de conformidade)',
  checkT: 'Retomar o checklist de saída/retorno nos turnos em falta',
  osCritica: 'Não liberar saída com OS crítica aberta: revisar as placas que saíram',
  mtbf: 'Atacar a reincidência: placas com quebras repetidas no mês',
  civf: 'Tratar as pendências de CIVF (manutenção e lavação) apontadas pela Ambev',
  stVeic: 'Rodar as placas paradas no Stress Test do mês',
  disp: 'Recuperar disponibilidade: placas indisponíveis há mais tempo primeiro',
  pneus: 'Recuperar a aderência de aferição (calibragem e sulco) das placas sem aferição'
};

/* ── MANUTENÇÕES ── */
function diagManut(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Manutenção');
  D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const gr = somaPor(lanc.rows, r => r.grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => r.equipamento), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
    D.blocos.cartaGr = gr; D.blocos.cartaPl = pl; D.blocos.cartaFo = fo;
    const g1 = gr[0], top3 = pl.slice(0, 3), sTop3 = top3.reduce((s, x) => s + x.v, 0);
    // concentração: o maior grupo e as 3 maiores placas; R$ "explicado" = parte do estouro proporcional ao peso no lançado
    if (g1) causa('Peças / fornecedor', `Onde o dinheiro foi (Carta de Custos${lanc.nivel === 'unidade' ? ', unidade inteira' : ''}): ${g1.k} ${rs(g1.v)} (${pct(g1.v / tot * 100)} do lançado de ${rs(tot)})${gr[1] ? ', ' + gr[1].k + ' ' + rs(gr[1].v) : ''}${gr[2] ? ', ' + gr[2].k + ' ' + rs(gr[2].v) : ''}`, null);
    if (top3.length) acao('Corretiva / quebra', `Análise de causa raiz nas placas que mais custaram (reincidência, idade, garantia, cobertura do contrato)`, top3.map(x => `${x.k} ${rs(x.v)}`));
    if (fo[0] && fo[0].v >= 0.25 * tot) acao('Peças / fornecedor', `Auditar os orçamentos e renegociar com o fornecedor que concentra o gasto`, fo.slice(0, 2).map(x => `${x.k} ${rs(x.v)} (${pct(x.v / tot * 100)})`));
    D.blocos.cartaTop3 = sTop3;
  } else D.avisos.push('Sem lançamentos na Carta de Custos para este mês: a abertura por grupo, placa e fornecedor ficou de fora.');
  // contrato de manutenção: a fatura do mês V cobra o km de V−1 (Carta)
  const kmMes = vigAnt(f.vig);
  const ct = (ctx.fatoPlaca[f.uni + '|' + kmMes] || []).filter(p => fin(p.v.custo_mes));
  if (ct.length) {
    const tc = ct.reduce((s, p) => s + p.v.custo_mes, 0), fx2 = ct.filter(p => (p.v.faixas || 0) >= 2);
    const cContr = f.contas.find(c => /CONTRATOS DE MANUTENCAO/.test(c.ck));
    D.blocos.contrato = { tot: tc, n: ct.length, faixa2: fx2 };
    if (cContr && cContr.ov > 0) {
      causa('Contrato', `Contrato de manutenção: ${rs(cContr.ov)} acima do remunerado; ${ct.length} placas faturadas (${rs(tc)}) pelo km de ${vigLbl(kmMes)}${fx2.length ? ', ' + fx2.length + ' atravessaram para a faixa 2' : ''}`, cContr.ov);
      acao('Contrato', `Conferir a fatura do contrato: km cobrado × km rodado e as placas que subiram de faixa`, top(ct, 5, p => p.v.custo_mes).map(p => `${p.ent} ${rs(p.v.custo_mes)}${fin(p.v.km_mes) ? ', ' + br(p.v.km_mes, 0) + ' km' : ''}${(p.v.faixas || 0) >= 2 ? ', faixa 2' : ''}`));
    }
  }
  // indicadores do Ginfo/Gerot
  const ind = sinaisRede(f, ctx, D, ['sla', 'conf', 'prev', 'mttr', 'mtbf', 'osVenc', 'osCritica', 'checkT', 'civf', 'stVeic', 'disp', 'disp_app']);
  // listas de hoje do Ginfo → ações com placa
  const gi = ctx.ginfo[f.uni] || {};
  const prevV = gi.prevVencidas || [], osAb = gi.osAbertas || [];
  const ruins = new Set(ind.filter(i => i.ruim).map(i => i.k));
  if (prevV.length) acao('Preventiva', `${ACAO_IND.prev}: ${prevV.length} placa(s)`, prevV.slice(0, 6).map(p => `${p.placa}${fin(p.dias) ? ' (' + br(Math.abs(p.dias), 0) + 'd)' : ''}`));
  else if (ruins.has('prev')) acao('Preventiva', ACAO_IND.prev);
  if (osAb.length && (ruins.has('sla') || ruins.has('mttr') || ruins.has('osVenc') || osAb.some(o => o.dias > 7))) {
    const velhas = top(osAb, 6, o => o.dias || 0);
    acao('Oficina / SLA', `${ACAO_IND.sla}: ${osAb.length} OS em aberto na unidade hoje`, velhas.map(o => `OS ${o.os} ${o.placa} ${br(o.dias, 0)}d${o.crit ? ' (' + o.crit + ')' : ''}`));
  }
  ['conf', 'checkT', 'osCritica', 'mtbf', 'civf', 'stVeic', 'mttr', 'osVenc', 'disp'].forEach(kx => { if (ruins.has(kx) && !(kx === 'osVenc' && osAb.length) && !(kx === 'mttr' && osAb.length)) acao(TEMA_IND[kx], ACAO_IND[kx]); });
  // placas paradas mais dias no mês (eventos do app de indisponibilidade)
  const par = (ctx.fatoPlaca[f.uni + '|' + f.vig] || []).filter(p => (p.v.dias_indisp || 0) >= 3);
  if (par.length) { D.blocos.paradas = par; D.sinais.push({ tema: 'Oficina / SLA', txt: `Indisponibilidade: ${par.length} placa(s) paradas 3 dias ou mais no mês (${top(par, 4, p => p.v.dias_indisp).map(p => p.ent + ' ' + br(p.v.dias_indisp, 0) + 'd').join(', ')})` }); }
}
/* lançamentos da Carta do fato: do projeto; sem nada no projeto, da unidade */
function cartaDo(f, ctx, pacCarta) {
  const all = (ctx.carta[f.uni + '|' + f.vig] || []).filter(r => r.pacote === pacCarta && r.valor > 0);
  const doProj = all.filter(r => projKey(r.projeto) === f.proj);
  return doProj.length ? { rows: doProj, nivel: 'projeto' } : { rows: all, nivel: all.length ? 'unidade' : 'nenhum' };
}

/* ── PNEUS ── */
function diagPneus(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Pneus'); D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const novos = lanc.rows.filter(r => /NOVOS/.test(NK(r.conta))).reduce((s, r) => s + r.valor, 0);
    const gr = somaPor(lanc.rows, r => r.grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => r.equipamento), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
    D.blocos.cartaGr = gr; D.blocos.cartaPl = pl; D.blocos.cartaFo = fo;
    causa('Pneus', `Onde o dinheiro foi (Carta de Custos${lanc.nivel === 'unidade' ? ', unidade inteira' : ''}): ${rs(tot)} lançados, ${pct(tot ? novos / tot * 100 : 0)} em pneus novos; ${gr.slice(0, 3).map(g => g.k + ' ' + rs(g.v)).join(', ')}`, null);
    if (pl.length) acao('Pneus', `Conferir as placas com mais gasto de pneu (troca antes da hora, desalinhamento, avaria)`, pl.slice(0, 5).map(x => `${x.k} ${rs(x.v)}`));
    if (novos > 0 && novos >= 0.5 * tot) acao('Pneus', `Revisar a compra de pneus novos do mês contra as premissas da Compra de Pneus (vida 1 no dianteiro, 4ª recapagem, último eixo da carreta)`);
  } else D.avisos.push('Sem lançamentos de Pneus na Carta de Custos para este mês.');
  // Prolog de hoje
  const pr = ctx.prolog && ctx.prolog[f.uni];
  if (pr) {
    D.blocos.prolog = pr;
    if (pr.inst) {
      const pPres = pr.presNOK / pr.inst * 100;
      if (pr.presNOK) (pPres >= 10 ? causa : (t, x) => D.sinais.push({ tema: t, txt: x }))('Pneus', `Prolog (hoje): ${br(pr.presNOK, 0)} de ${br(pr.inst, 0)} pneus instalados com pressão fora (±10% da ideal), ${pct(pPres, 1)}`, null);
      if (pr.presNOK) acao('Pneus', `Calibrar os pneus com pressão fora (pneu murcho gasta o pneu e o diesel)`, pr.topPres.map(x => `${x.placa} ${x.n} pneu(s)`));
      if (pr.ate3) causa('Pneus', `Prolog (hoje): ${br(pr.ate3, 0)} pneu(s) instalados com 3 mm ou menos (risco e carcaça perdida para recape, vira pneu novo)`, null);
      if (pr.amp) D.sinais.push({ tema: 'Pneus', txt: `Prolog (hoje): ${br(pr.amp, 0)} pneu(s) com amplitude de sulco acima de 5 mm (desgaste irregular)` });
      if (pr.janela) acao('Pneus', `Mandar para recape os ${br(pr.janela, 0)} pneu(s) entre 3 e 4 mm antes de perder a carcaça`, pr.topJanela.map(x => `${x.placa} ${x.n}`));
      if (pr.amp) acao('Pneus', `Verificar alinhamento/geometria nas placas com amplitude de sulco acima de 5 mm`, pr.topAmp.map(x => `${x.placa} ${x.n}`));
    }
  }
  const al = ((ctx.ginfo[f.uni] || {}).alinVencidos) || [];
  if (al.length) causa('Pneus', `Ginfo (hoje): ${al.length} placa(s) com alinhamento vencido (desgaste irregular)`, null);
  if (al.length) acao('Pneus', `Alinhar as placas com alinhamento vencido no Ginfo: ${al.length} placa(s)`, al.slice(0, 6).map(a => a.placa));
  sinaisRede(f, ctx, D, ['pneus', 'dispersao', 'conf', 'checkT', 'stVeic']);
}

/* ═════════ 6) Ginfo (hoje) e Prolog (hoje) — por unidade ═════════ */
const FIL2COD = { 'CDD CAMBORIU': 'BLC', 'BALNEARIO CAMBORIU': 'BLC', 'CDD CUIABA': 'CBA T2', 'CUIABA': 'CBA T1 WH', 'CUIABA EMPURRADA': 'CBA T1', 'CDD RIO DE JANEIRO': 'CGR', 'CAMPO GRANDE': 'CGR',
  'CDD FLORIANOPOLIS': 'FLP', 'FLORIANOPOLIS': 'FLP', 'CDD GUARULHOS': 'GRL', 'GUARULHOS': 'GRL', 'CDI MACACU': 'MCC T2', 'MACACU EMPURRADA': 'MCC T1', 'CACHOEIRAS DE MACACU': 'MCC T2', 'MACACU': 'MCC T2',
  'CDD NOVA FRIBURGO': 'NFR', 'NOVA FRIBURGO': 'NFR', 'PIRAI EMPURRADA': 'PIR', 'PIRAI': 'PIR', 'CDD PELOTAS': 'PLT', 'PELOTAS': 'PLT', 'CDD RONDONOPOLIS': 'RON', 'RONDONOPOLIS': 'RON', 'CDD GOIANIA': 'GNA', 'GOIANIA': 'GNA' };
const MERC = 'ABCDEFGHIJ';
const placaKey = s => { const p = NK(s).replace(/[^A-Z0-9]/g, ''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 4) + MERC[+p[4]] + p.slice(5) : p; };
function refina(cod, proj) {
  if (!cod) return cod; const p = NK(proj);
  if (cod.startsWith('CBA')) { if (/EMPURRAD/.test(p)) return 'CBA T1'; if (/APOIO|EMPILHADEIRA|\bWH\b|ARMAZEM/.test(p)) return 'CBA T1 WH'; if (/ROTA|CDD|AUTO SERVICO/.test(p)) return 'CBA T2'; return cod; }
  if (cod.startsWith('MCC')) { if (/EMPURRAD/.test(p)) return 'MCC T1'; if (/ROTA|CDI|CDD|AUTO SERVICO/.test(p)) return 'MCC T2'; return cod; }
  return cod;
}
function indexaGinfo(snap, hoje) {
  hoje = hoje || new Date();
  const projPl = {}; ((snap.ativos) || []).forEach(a => { const p = placaKey(a['Placa']); if (p) projPl[p] = a['Projeto'] || ''; });
  const uniDe = r => refina(FIL2COD[NK(r['Filial'] || r['Filial Freightech'] || '')] || null, projPl[placaKey(r['Placa'])] || r['Projeto'] || '');
  const out = {}; const slot = u => out[u] || (out[u] = { prevVencidas: [], osAbertas: [], alinVencidos: [] });
  (snap.preventivas || []).forEach(r => { if (!/VENCID/.test(NK(r['Status']))) return; const u = uniDe(r); if (!u) return;
    slot(u).prevVencidas.push({ placa: placaKey(r['Placa']), dias: num(r['Dias Próxima'] != null ? r['Dias Próxima'] : r['Dias Proxima']), modelo: r['Modelo'] || '' }); });
  Object.values(out).forEach(o => o.prevVencidas.sort((a, b) => (a.dias || 0) - (b.dias || 0)));
  (snap['os-em-aberto'] || []).forEach(r => { const u = uniDe(r); if (!u) return; const d = parseData(r['Data']);
    slot(u).osAbertas.push({ os: r['Nº OS'] || r['N° OS'] || '', placa: placaKey(r['Placa']), dias: d ? Math.max(0, Math.floor((hoje - d) / 864e5)) : null, crit: r['Criticidade'] || '', tipo: r['Tipo'] || '' }); });
  (snap.alinhamentos || []).forEach(r => { if (!/VENCID/.test(NK(r['Status']))) return; const u = uniDe(r); if (!u) return; slot(u).alinVencidos.push({ placa: placaKey(r['Placa']) }); });
  return out;
}
const PROLOG_BRANCH = { 1676: 'MCC T1', 1677: 'MCC T2', 37: 'CGR', 1906: 'CBA T1 WH', 1907: 'CBA T1', 1878: 'CBA T2', 20: 'FLP', 30: 'GRL', 24: 'BLC', 2517: 'NFR', 26: 'PLT', 38: 'PIR', 2277: 'RON', 2550: 'ANG' };
function resumoProlog(tires) {
  const r = { inst: 0, presNOK: 0, ate3: 0, janela: 0, amp: 0 }; const pp = {}, pj = {}, pa = {};
  (tires || []).forEach(t => { if (String(t.status || '').toUpperCase() !== 'INSTALLED') return; r.inst++;
    const pl = t.placa || '—';
    if (t.pressaoNOK) { r.presNOK++; pp[pl] = (pp[pl] || 0) + 1; }
    const mm = +t.menorMM; if (mm > 0 && mm <= 3) r.ate3++; else if (mm > 3 && mm <= 4) { r.janela++; pj[pl] = (pj[pl] || 0) + 1; }
    if (+t.amplitude > 5) { r.amp++; pa[pl] = (pa[pl] || 0) + 1; } });
  const t5 = m => Object.entries(m).map(([placa, n]) => ({ placa, n })).sort((a, b) => b.n - a.n).slice(0, 5);
  r.topPres = t5(pp); r.topJanela = t5(pj); r.topAmp = t5(pa);
  return r;
}

/* ═════════ 7) monta o contexto a partir do que foi lido ═════════ */
function contexto(L, deps) {
  deps = deps || {};
  const dreIdx = indexaDRE(L.dre);
  const todos = fatos(dreIdx);
  const precoRem = indexaPreco(L.rsl);
  const fatoUni = {}, quartisRede = {}, fatoPlaca = {}, fatoMot = {};
  const FU = (L.corr && L.corr.FATO && L.corr.FATO.uni) || [];
  FU.forEach(r => { fatoUni[r.cod + '|' + r.vig] = r.v; });
  const porVig = {}; FU.forEach(r => { (porVig[r.vig] = porVig[r.vig] || []).push(r.v); });
  Object.entries(porVig).forEach(([vg, vs]) => { quartisRede[vg] = { mttr: quartis(vs.map(v => v.mttr)), mtbf: quartis(vs.map(v => v.mtbf)) }; });
  ((L.corr && L.corr.FATO && L.corr.FATO.placa) || []).forEach(r => { (fatoPlaca[r.cod + '|' + r.vig] = fatoPlaca[r.cod + '|' + r.vig] || []).push(r); });
  ((L.corr && L.corr.FATO && L.corr.FATO.mot) || []).forEach(r => { if (!r.cod) return; (fatoMot[r.cod + '|' + r.vig] = fatoMot[r.cod + '|' + r.vig] || []).push(r); });
  const carta = {}; (L.carta || []).forEach(r => { const k = r.unidade + '|' + r.vigencia; (carta[k] = carta[k] || []).push(r); });
  const prolog = {}; Object.entries(L.prolog || {}).forEach(([u, t]) => { prolog[u] = resumoProlog(t); });
  const ctx = { dreAcc: dreIdx.acc, maxVig: dreIdx.maxReal, todos, disp: indexaDisp(L.disp), kml: indexaKml(L.kml, precoRem),
    fatoUni, quartisRede, fatoPlaca, fatoMot, carta, ginfo: indexaGinfo(L.ginfo || {}, deps.hoje), prolog, ArvImpacto: deps.ArvImpacto || global.ArvImpacto };
  ctx.rede = rede(FU, deps.Estat || global.Estat);
  ctx.aprend = aprendizado(L.fca, todos, dreIdx.maxReal);
  return ctx;
}

/* ═════════ 8) leitura (navegador) ═════════ */
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A', DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
async function gviz(id, aba) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(aba)}`;
  const txt = await (await fetch(url)).text();
  const m = txt.match(/setResponse\(([\s\S]*)\)\s*;?\s*$/) || txt.match(/^[\s\S]*?\(([\s\S]*)\);?\s*$/); if (!m) throw new Error('resposta gviz inesperada (' + aba + ')');
  const j = JSON.parse(m[1]); if (j.status !== 'ok') throw new Error('gviz ' + aba + ': ' + ((j.errors && j.errors[0] && j.errors[0].message) || j.status));
  let cols = (j.table.cols || []).map(c => String((c && (c.label || c.id)) || ''));
  let rows = (j.table.rows || []).map(r => (r.c || []).map(c => c ? c.v : null));
  // aba sem cabeçalho (rótulos A, B, C…): a 1ª linha vira rótulo onde for texto
  if (cols.every(c => !c || /^[A-Z]{1,2}$/.test(c)) && rows.length && !vigDe(rows[0][0])) { cols = rows[0].map((v, i) => v == null ? cols[i] : String(v)); rows = rows.slice(1); }
  return { cols, rows };
}
async function todasLinhas(sb, tabela, sel, ajuste) {
  const out = [];
  for (let off = 0; off < 200000; off += 1000) {
    let q = sb.from(tabela).select(sel); if (ajuste) q = ajuste(q);
    const { data, error } = await q.range(off, off + 999); if (error) throw new Error(tabela + ': ' + error.message);
    out.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  return out;
}
async function carregar(sb, o) {
  o = o || {};
  const etapa = o.etapa || (() => {});
  const fontes = [];
  const passo = async (nome, fn, contar) => { etapa(nome); try { const v = await fn(); fontes.push({ nome, estado: 'ok', linhas: contar ? contar(v) : null }); return v; }
    catch (e) { console.error(nome, e); fontes.push({ nome, estado: 'erro', msg: String((e && e.message) || e) }); return null; } };
  const CC = global.CartaCalc;
  const [dre, disp, kml, rsl, fca, corr, gin] = await Promise.all([
    passo('DRE · aba Frota', () => CC.frota(), v => v.rows.length),
    passo('Dispersão de km', () => gviz(DISP_ID, 'Dispersão de km'), v => v.rows.length),
    passo('Km/L (aba Km/L do Consumo)', () => gviz(KML_ID, 'Km/L'), v => v.rows.length),
    passo('R$/L remunerado (aba R$/L)', () => gviz(KML_ID, 'R$/L'), v => v.rows.length),
    passo('FCA (histórico de causas e ações)', () => todasLinhas(sb, 'fca', 'id,unidade,vigencia,origem,fato,projeto,fato_desvio,causa,acao,responsavel,prazo,status,created_at'), v => v.length),
    passo('Gerot/Ginfo, contrato, condução (Correlações)', () => global.CorrDados.carregar(sb), v => v.FATO.uni.length + v.FATO.placa.length + v.FATO.mot.length),
    passo('Ginfo de hoje (preventivas, OS, alinhamentos, ativos)', async () => {
      const { data, error } = await sb.from('ginfo_snapshot').select('chave,data,updated_at').in('chave', ['preventivas', 'os-em-aberto', 'alinhamentos', 'ativos']);
      if (error) throw new Error(error.message); const m = {}; (data || []).forEach(r => { m[r.chave] = Array.isArray(r.data) ? r.data : []; m['_em_' + r.chave] = r.updated_at; }); return m; },
      v => ['preventivas', 'os-em-aberto', 'alinhamentos'].reduce((s, k) => s + ((v[k] || []).length), 0))
  ]);
  if (corr && corr.FONTES) corr.FONTES.filter(x => x.estado === 'erro').forEach(x => fontes.push({ nome: '· ' + x.nome, estado: 'erro', msg: x.msg }));
  // Carta: os meses do DRE com realizado nos últimos 13 meses
  let carta = null;
  if (dre) {
    const idx = indexaDRE(dre); const ate = idx.maxReal;
    if (ate) { const vigs = []; for (let i = 0; i < 13; i++) vigs.push(vigDeIdx(vigIdx(ate) - i));
      carta = await passo('Carta de Custos (lançamentos)', async () => { const r = await CC.lerLancamentos(sb, UNITS, vigs); if (r.erro) throw new Error(r.erro.message || String(r.erro)); return r.data; }, v => v.length); }
  }
  return { dre, disp, kml, rsl, fca: fca || [], corr, ginfo: gin || {}, carta: carta || [], prolog: {}, fontes };
}
/* Prolog de hoje: uma leitura por unidade (o jsonb das 14 juntas estoura o payload) */
async function carregarProlog(sb) {
  const out = {}; const ids = Object.keys(PROLOG_BRANCH);
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(ids.slice(i, i + 3).map(async bid => {
      const { data, error } = await sb.from('snapshot').select('endpoint,data').eq('endpoint', 'tires').eq('branch_id', +bid);
      if (!error && data && data[0] && Array.isArray(data[0].data)) out[PROLOG_BRANCH[bid]] = data[0].data;
    }));
  }
  return out;
}

global.FcaAuto = { UNITS, PACOTES, vigLbl, vigDeLbl, vigIdx, vigAnt, vigSeg, projKey, unidadeDoNv3, rs, br, pct, sinalPct, impFmt, NK,
  indexaDRE, fatos, desvioTxt, indexaDisp, indexaPreco, indexaKml, combBases, rede, redeLeitura, forcaTxt, aprendizado, temasDe, TEMAS,
  diagnostico, indicadores, indexaGinfo, resumoProlog, contexto, carregar, carregarProlog, ROT, METAS, fmtInd, placaKey };
})(typeof window !== 'undefined' ? window : globalThis);

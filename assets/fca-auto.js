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
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return (/AM|PM/i.test(s) || +m[2] > 12) ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(+m[3], +m[2] - 1, +m[1]);
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
/* A REGRA DE FATOS É A DO FCA (Renan, 14/10/2026: "Ele tem que seguir a mesma
   regra de fatos que já existe. Simples assim"): o mesmo PACOTES_MAP e as mesmas
   exclusões do pushDRE do fca-preenchimento; conta fora do mapa cai em "Outros";
   unidade pela coluna Unidade do DRE (cidade) e tier pelo prefixo do Nível 3. */
const PACOTES = ['Combustíveis', 'Manutenções', 'Pneus'];           // os que têm base própria para cruzar
const PACOTES_MAP = {
  'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'Combustíveis', 'COMBUSTIVEIS': 'Combustíveis', 'FLUIDOS (ARLA)': 'Combustíveis', 'ARLA': 'Combustíveis',
  'ESTORNO DE ICMS NAO APROVEITADO': 'ICMS', 'ICMS CREDITO PRESUMIDO': 'ICMS',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'Manutenções', 'MANUTENCAO DE VEICULOS E EQUIP.': 'Manutenções', 'MATERIAIS E FERRAMENTAS DE OFICINA': 'Manutenções',
  'LAVACAO DE VEICULOS': 'Manutenções', 'MANUTENCAO DE CARROCERIAS': 'Manutenções', 'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'Manutenções',
  'PERSONALIZACAO/PADRONIZACAO': 'Manutenções', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'Manutenções', 'CONTRATOS DE MANUTENCAO FABRICANTE': 'Manutenções',
  'CONSERTOS E RECAPAGENS DE PNEUS': 'Pneus', 'PNEUS E CAMARAS': 'Pneus', 'RECAPAGENS E OUTROS SERVICOS': 'Pneus', 'PNEUS NOVOS': 'Pneus',
  'IPVA E LICENCIAMENTO DE VEICULOS': 'Seguros e licenças', 'IPVA E LICENCIAMENTO': 'Seguros e licenças',
  'SEGURO DE VEICULOS E EQUIPAMENTOS': 'Seguros e licenças', 'SEGUROS': 'Seguros e licenças'
};
const getPacote = ck => PACOTES_MAP[ck] || 'Outros';
// as contas que o FCA nem lê (EXCL do pushDRE)
const EXCL_FCA = new Set(['RECEITA LIQUIDA', 'ICMS CREDITO PRESUMIDO', 'IPVA E LICENCIAMENTO DE VEICULOS', 'ESTORNO ICMS NAO APROVEITADO', 'ESTORNO DE ICMS NAO APROVEITADO']);
// coluna Unidade do DRE (cidade) → código base; o tier vem do Nível 3 (como o DEPARA + tierMatch do FCA)
const CIDADE_DRE = { 'CAMPO GRANDE': 'CGR', 'BALNEARIO CAMBORIU': 'BLC', 'CUIABA': 'CBA', 'FLORIANOPOLIS': 'FLP', 'GUARULHOS': 'GRL', 'NOVA FRIBURGO': 'NFR', 'PELOTAS': 'PLT',
  'RONDONOPOLIS': 'RON', 'CACHOEIRAS DE MACACU': 'MCC', 'MACACU': 'MCC', 'PIRAI': 'PIR', 'ANHANGUERA': 'ANG', 'GOIANIA': 'GNA' };
function unidadeDoDRE(cidade, nv3) {
  const base = CIDADE_DRE[NK(String(cidade || '').replace(/\s*\(INATIVO\)\s*/i, ''))];
  if (!base) return unidadeDoNv3(nv3);                   // sem a coluna Unidade: pelo sufixo do Nível 3
  if (base !== 'CBA' && base !== 'MCC') return base;
  return base + ' ' + tierOfPrefix(base, prefixo(nv3));
}
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
  const iN3 = achaCol(h, ['nível 3', 'nivel 3', 'nivel3']), iCta = achaCol(h, ['conta gerencial', 'conta']), iUni = achaCol(h, ['unidade']);
  const iRem = achaCol(h, ['remunerado']), iReal = achaCol(h, ['realizado']);
  const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const acc = {};         // uni|proj|vig → {uni, nv3, proj, vig, contas:{conta:{rem,real}}}
  let maxReal = null;
  rows.forEach(r => {
    let vig = iVig >= 0 ? vigDe(r[iVig]) : null;
    if (!vig && iAno >= 0 && iMes >= 0) { const y = parseInt(r[iAno]); const mm = typeof r[iMes] === 'number' ? r[iMes] : MES[NK(r[iMes]).toLowerCase().slice(0, 3)]; if (y && mm) vig = y + '-' + d2(mm); }
    if (!vig) return;
    const nv3 = String(r[iN3] || '').replace(/\s*\(INATIVO\)\s*/i, ' ').replace(/\s+/g, ' ').trim();
    const uni = unidadeDoDRE(iUni >= 0 ? r[iUni] : null, nv3); if (!uni) return;
    const conta = String(r[iCta] || '—').trim(); const ck = NK(conta);
    if (EXCL_FCA.has(ck)) return;
    const pac = getPacote(ck);
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
    [...new Set(Object.values(a.contas).map(c => c.pac))].forEach(pac => {
      const cs = Object.values(a.contas).filter(c => c.pac === pac);
      const rem = cs.reduce((s, c) => s + c.rem, 0), real = cs.reduce((s, c) => s + c.real, 0);
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

/* ═════════ 2b) SEARA — as abas da Árvore da Seara (Renan, 14/10/2026: "Seara
   deveria se basear pela árvore de combustível para causas"). A Anhanguera não
   está na aba Km/L do Consumo nem na Dispersão de km: o km real, os litros e o
   R$ saem da aba Combustível, o km remunerado da aba Remunerado (por placa e
   mês) e o Km/L e o R$/L remunerados da Base Remunerado (KmPorLitro,
   PrecoDiesel), com a média do modelo para a placa sem remunerado
   (SearaBenchModelo). É a MESMA conta da Árvore da Seara: Km/L rem = Σkm ÷
   Σ(km ÷ KmPorLitro); R$/L rem = Σ(preço × litros) ÷ Σlitros; Preço = Σ(R$ −
   preço × litros) nas placas com preço; Eficiência = (km ÷ Km/L real − km ÷
   Km/L rem) × R$/L real médio. O resultado tem a forma do combBases (cb) e da
   Dispersão (dp), então o diagnóstico do Combustíveis é o mesmo. */
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE', SEARA_GID_REM = '0', SEARA_GID_COMB = '1982300845', SEARA_ABA_REM = 'Remunerado';
function indexaSeara(S, Bench) {
  if (!S || !S.comb) return {};
  const remKm = {};
  ((S.rem && S.rem.rows) || []).forEach(r => { const p = placaKey(r[1]), vg = vigDe(r[0]), km = num(r[2]) || 0; if (!p || !vg) return; remKm[p + '|' + vg] = (remKm[p + '|' + vg] || 0) + km; });
  // Base Remunerado: colunas pelo NOME (reserva: layout largo — Vigência 0 · Placa 3 · ModeloVeiculo 5 · KmPorLitro 15 · PrecoDiesel 17)
  const bc = ((S.brem && S.brem.cols) || []).map(c => String(c || '').toLowerCase().replace(/\s/g, ''));
  const bi = (alvo, def) => { const i = bc.findIndex(c => c.includes(alvo)); return i >= 0 ? i : def; };
  const iVig = bi('vigencia', 0), iPl = bi('placa', 3), iKmL = bi('kmporlitro', 15), iPr = bi('precodiesel', 17), iMod = bi('modeloveiculo', 5);
  const bench = {}, porMod = Bench ? Bench.nova(S.prevMod || {}) : null;
  ((S.brem && S.brem.rows) || []).forEach(r => { const p = placaKey(r[iPl]), vg = vigDe(r[iVig]); if (!p || !vg) return;
    const b = { kmL: num(r[iKmL]) || 0, preco: num(r[iPr]) || 0 }; bench[p + '|' + vg] = b; if (porMod) porMod.add(p, vg, r[iMod], b); });
  // placa sem remunerado no mês: o mês anterior da mesma placa; senão a média do modelo
  const benchFor = (p, vg, mod) => { const b = bench[p + '|' + vg]; if (b && (b.kmL > 0 || b.preco > 0)) return b;
    const a = bench[p + '|' + vigAnt(vg)]; if (a && (a.kmL > 0 || a.preco > 0)) return a;
    const m = porMod && porMod.media(p, vg, mod); return m ? { kmL: m.kmL || 0, preco: m.preco || 0, porModelo: true } : { kmL: 0, preco: 0 }; };
  // raiz = aba Combustível (E placa · F mês · G ano · H modelo · K km · L litros · N total R$), como na Árvore
  const porVig = {};
  ((S.comb && S.comb.rows) || []).forEach(r => {
    const placa = placaKey(r[4]); const mi = MESES.indexOf(String(r[5] || '').toLowerCase().slice(0, 3)); const y = +r[6];
    const km = num(r[10]) || 0; if (!placa || mi < 0 || !y || km <= 0) return;
    const vg = y + '-' + d2(mi + 1); const b = benchFor(placa, vg, r[7]);
    (porVig[vg] || (porVig[vg] = [])).push({ placa, modelo: String(r[7] || '').trim(), km, lit: num(r[11]) || 0, tot: num(r[13]) || 0, kmRem: remKm[placa + '|' + vg] || 0, kmL: b.kmL, pRem: b.preco, porModelo: !!b.porModelo });
  });
  const out = {};
  Object.entries(porVig).forEach(([vg, ls]) => {
    let km = 0, kmRem = 0, lit = 0, tot = 0, pxl = 0, litP = 0, kmB = 0, litB = 0, totP = 0, totL = 0;
    ls.forEach(r => { km += r.km; kmRem += r.kmRem; lit += r.lit; tot += r.tot;
      if (r.pRem > 0 && r.lit > 0) { pxl += r.pRem * r.lit; litP += r.lit; if (r.tot > 0) totP += r.tot; }
      if (r.kmL > 0 && r.km > 0) { kmB += r.km; litB += r.km / r.kmL; }
      if (r.lit > 0 && r.tot > 0) totL += r.tot; });
    const rsLReal = lit > 0 ? tot / lit : null, rsLRem = litP > 0 ? pxl / litP : null, kmLReal = lit > 0 ? km / lit : null, kmLRem = litB > 0 ? kmB / litB : null;
    const rsLMed = lit > 0 ? totL / lit : 0;
    const preco = litP > 0 ? totP - pxl : null, litEsp = kmLRem > 0 ? km / kmLRem : null;
    const efic = kmLRem > 0 && kmLReal > 0 && rsLMed > 0 ? (km / kmLReal - km / kmLRem) * rsLMed : null;
    const placas = ls.map(r => { const esp = r.kmL > 0 ? r.km / r.kmL : null, prr = r.lit > 0 && r.tot > 0 ? r.tot / r.lit : rsLMed;
      return { ...r, kmlReal: r.lit > 0 ? r.km / r.lit : 0, rsLReal: r.lit > 0 ? r.tot / r.lit : 0, litEsp: esp, litMais: esp != null ? r.lit - esp : null,
        rsEfic: esp != null && prr > 0 ? (r.lit - esp) * prr : null, rsPreco: r.pRem > 0 && r.tot > 0 ? r.tot - r.pRem * r.lit : null }; });
    out[vg] = { cb: { km, lit, tot, kmLRem, kmLReal, rsLRem, rsLReal, preco, efic, litEsp, prRem: rsLMed, placas, seara: true, porModelo: ls.filter(r => r.porModelo).length },
      dp: kmRem > 0 ? { rem: kmRem, real: km, seara: true } : null };
  });
  return out;
}

/* ═════════ 3) A REDE — correlação desvio × TUDO que pode explicar ═════════
   (Renan, 14/10/2026: "Leia tudo que pode ter correlação"). O catálogo junta
   todas as variáveis por unidade × mês que o banco tem: os indicadores do
   Gerot/Ginfo e da Dispersão (CorrDados), a condução (DriverPro), a frota
   (idade, contrato, dias parados, ERP), as bases de combustível (diferença de
   Km/L e de R$/L contra o remunerado), a Carta de Custos e o próprio FCA.
   Cada uma é cruzada com o desvio de cada pacote (real ÷ rem − 1), no mesmo
   mês e no seguinte. Ficam de fora só as variáveis de custo/receita do DRE,
   que são a própria conta (correlacionar o desvio com o custo é trivial). */
const Y_PAC = { 'Combustíveis': 'desvio_comb', 'Manutenções': 'desvio_manut', 'Pneus': 'desvio_pneus' };
// variáveis montadas aqui (as do CorrDados entram pelo catálogo dele)
const EXTRA = [
  { id: 'cond_nota', rot: 'Nota de condução (média ponderada pelo km)', g: 'Condução (DriverPro · só Empurrada)', dir: 'up', f: 'd1' },
  { id: 'cond_rpm', rot: 'Faixa verde de RPM (pontos)', g: 'Condução (DriverPro · só Empurrada)', dir: 'up', f: 'd1' },
  { id: 'cond_idle', rot: 'Motor ligado parado (pontos)', g: 'Condução (DriverPro · só Empurrada)', dir: 'up', f: 'd1' },
  { id: 'cond_acel', rot: 'Acelerações bruscas (pontos)', g: 'Condução (DriverPro · só Empurrada)', dir: 'up', f: 'd1' },
  { id: 'cond_baixo', rot: 'Km com motorista abaixo de 75 pontos', g: 'Condução (DriverPro · só Empurrada)', dir: 'down', f: 'pct' },
  { id: 'cond_kml', rot: 'Km/L da telemetria', g: 'Condução (DriverPro · só Empurrada)', dir: 'up', f: 'd2' },
  { id: 'frota_idade', rot: 'Idade média da frota', g: 'Frota', dir: 'down', f: 'anos' },
  { id: 'contr_rskm', pac: ['Manutenções'], rot: 'R$/km do contrato de manutenção', g: 'Frota', dir: 'down', f: 'rskm' },
  { id: 'contr_faixa2', pac: ['Manutenções'], rot: 'Placas do contrato na faixa 2', g: 'Frota', dir: 'down', f: 'pct' },
  { id: 'dias_parado', rot: 'Dias parado por placa (média)', g: 'Frota', dir: 'down', f: 'd1' },
  { id: 'erp_kml', rot: 'Km/L do ERP (abastecimentos)', g: 'Frota', dir: 'up', f: 'd2' },
  { id: 'erp_preco', rot: 'R$/L pago no ERP', g: 'Frota', dir: 'down', f: 'd2' },
  { id: 'kml_gap', rot: 'Km/L real contra remunerado (aba Km/L)', g: 'Combustível (bases)', dir: 'up', f: 'pct', ponte: true },
  { id: 'preco_gap', rot: 'R$/L real contra remunerado (aba Km/L)', g: 'Combustível (bases)', dir: 'down', f: 'pct', ponte: true },
  { id: 'carta_n', pac: ['Manutenções'], rot: 'Lançamentos de manutenção na Carta', g: 'Carta de Custos', dir: 'down', f: 'n' },
  { id: 'carta_ticket', pac: ['Manutenções'], rot: 'Valor médio do lançamento de manutenção', g: 'Carta de Custos', dir: 'down', f: 'brl' },
  { id: 'carta_forn', pac: ['Manutenções'], rot: 'Concentração no maior fornecedor', g: 'Carta de Custos', dir: 'down', f: 'pct' },
  { id: 'carta_novos', pac: ['Pneus'], rot: 'Pneus novos no lançado de pneus', g: 'Carta de Custos', dir: 'down', f: 'pct' },
  { id: 'fca_preench', rot: 'FCAs de Custos com ação preenchida', g: 'FCA', dir: 'up', f: 'pct' }
];
const FMT_CAT = { pct: v => pct(v, 1), brl: v => rs(v), num: v => br(v, 0), n: v => br(v, 0), d1: v => br(v, 1), d2: v => br(v, 2), kml: v => br(v, 2) + ' km/L',
  rskm: v => 'R$ ' + br(v, 2) + '/km', mm: v => br(v, 2) + ' mm', h: v => br(v / 3600, 1) + ' h', anos: v => br(v, 1) + ' anos', l: v => br(v, 0) + ' L', dias: v => br(v, 1) + ' d' };
let CAT = {};      // id → {id, rot, g, dir, f}
const ROT = new Proxy({}, { get: (_, k) => (CAT[k] && CAT[k].rot) || k });
function montaCatalogo(CD) {
  CAT = {};
  const fora = new Set(['Custos (DRE)', 'Receita (DRE)']);
  ((CD && CD.VARS && CD.VARS.uni) || []).forEach(v => { if (fora.has(v.g)) return;
    CAT[v.id] = { id: v.id, rot: v.rot, g: v.g, dir: v.dir || null, f: v.id === 'mttr' || v.id === 'mtbf' ? 'h' : v.f }; });
  // o CorrDados não traz o MTTR/MTBF em horas: chegam em segundos (gerot-base)
  EXTRA.forEach(v => { CAT[v.id] = Object.assign({}, v); });
  return CAT;
}
function rede(fatoUni, Estat) {
  const out = {}; if (!Estat || !fatoUni) return out;
  const todos = [];
  PACOTES.forEach(pac => {
    const y = Y_PAC[pac]; out[pac] = [];
    Object.values(CAT).forEach(cv => {
      if (cv.pac && !cv.pac.includes(pac)) return;     // Carta e contrato só no pacote deles
      const x = cv.id;
      const xs = [], ys = [], ser = [];
      fatoUni.forEach(L => { const vx = L.v[x], vy = L.v[y]; const t = vigIdx(L.vig);
        if (fin(vx) && fin(vy)) { xs.push(vx); ys.push(vy); }
        if (t != null) ser.push({ ent: L.ent, t, x: fin(vx) ? vx : null, y: fin(vy) ? vy : null }); });
      if (xs.length < 3 && !ser.some(z => fin(z.x))) return;      // sem dado nenhum: nem entra
      const c0 = Estat.pearson(xs, ys);
      const lag = Estat.defasagens(ser, 1)[1] || { r: NaN, n: 0, p: NaN };
      const d = cv.dir;
      const apoia = r => fin(r) && d ? (d === 'up' ? r < 0 : r > 0) : null;   // indicador pior ↔ desvio maior
      const e = { pac, x, rot: cv.rot, g: cv.g, dir: d, r0: c0.r, n0: c0.n, p0: c0.p, r1: lag.r, n1: lag.n, p1: lag.p, apoia0: apoia(c0.r), apoia1: apoia(lag.r) };
      out[pac].push(e); todos.push(e);
    });
  });
  // p ajustado (BH) sobre TODOS os testes do painel, mesmo mês e mês seguinte juntos
  const ps = []; todos.forEach(e => { ps.push(e.n0 >= Estat.N_MIN ? e.p0 : NaN); ps.push(e.n1 >= Estat.N_MIN ? e.p1 : NaN); });
  const q = Estat.bh(ps);
  todos.forEach((e, i) => { e.q0 = q[2 * i]; e.q1 = q[2 * i + 1];
    e.sust = !!((e.apoia0 && e.q0 < 0.10) || (e.apoia1 && e.q1 < 0.10));   // a rede sustenta: sentido certo e dificilmente acaso
    e.forca = Math.max(fin(e.r0) && e.apoia0 ? Math.abs(e.r0) : 0, fin(e.r1) && e.apoia1 ? Math.abs(e.r1) : 0);
    e.forte = Math.max(fin(e.r0) && e.n0 >= 8 ? Math.abs(e.r0) : 0, fin(e.r1) && e.n1 >= 8 ? Math.abs(e.r1) : 0); });
  PACOTES.forEach(p => out[p].sort((a, b) => (b.sust - a.sust) || (b.forca - a.forca) || (b.forte - a.forte)));
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

/* A MESMA leitura, em português da ponta (Renan, 14/10/2026: "precisa ser mais didático e
   menos estatístico… essas causas e ações serão para o time da ponta"): sem r, sem n, sem
   quartil. A tabela do modal continua com o redeLeitura técnico. */
function redeFala(e, pac) {
  if (!e) return '';
  const melhor = [];
  if (fin(e.r0) && e.n0 >= 8) melhor.push({ k: 0, r: e.r0, q: e.q0, ap: e.apoia0 });
  if (fin(e.r1) && e.n1 >= 8) melhor.push({ k: 1, r: e.r1, q: e.q1, ap: e.apoia1 });
  const b = melhor.filter(m => m.ap).sort((x, y) => Math.abs(y.r) - Math.abs(x.r))[0];
  const nome = pac ? 'o ' + pac : 'o pacote';
  if (!b) return `Nas outras unidades isso não anda junto com o estouro d${nome}`;
  const forca = forcaTxt(b.r);
  return `Nas outras unidades, quando isso piora ${nome} estoura junto${b.k ? ' no mês seguinte' : ''} (ligação ${forca}${b.q < 0.10 ? '' : ', pode ser coincidência'})`;
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
/* O fato antigo vinha com o NOME DA CONTA (Recapagens e Outros Serviços, Lavação de Veículos,
   Arla…) — classifica pelo PACOTES_MAP do FCA antes de olhar o nome do pacote. */
const pacDoFato = t => { const n = NK(nomeLimpo(t)); const pm = PACOTES_MAP[n]; if (pm) return pm;
  if (/COMBUST|ARLA|FLUID/.test(n)) return 'Combustíveis'; if (/PNEU|RECAP|CAMARA/.test(n)) return 'Pneus';
  if (/MANUT|LAVAC|OFICINA|CARROCERIA|PERSONALIZ|PADRONIZ/.test(n)) return 'Manutenções';
  if (/SEGURO|LICEN|IPVA/.test(n)) return 'Seguros e licenças'; if (/ICMS/.test(n)) return 'ICMS'; if (/^OUTROS$/.test(n)) return 'Outros'; return null; };
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
const METAS = { disp: 95, prev: 100, pneus: 100, checkT: 95, checkWH: 95, conf: 100, stVeic: 100, stEmp: 100, civf: 100, sla: 75, osVenc: 10, osCritica: 0, blitz: 100, disp_app: 95,
  cond_nota: 75, cond_rpm: 75, cond_idle: 75, cond_acel: 75 };   // DriverPro: abaixo de 75 é a faixa vermelha
const fmtInd = (k, v) => { if (!fin(v)) return '—'; const c = CAT[k]; return ((c && FMT_CAT[c.f]) || FMT_CAT.d1)(v); };
const quartis = xs => { const s = xs.filter(fin).sort((a, b) => a - b); if (s.length < 4) return null; const q = p => { const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }; return { q1: q(.25), q2: q(.5), q3: q(.75), n: s.length }; };
/* a unidade no mês contra a META, quando há (Gerot, Dispersão); senão contra o
   PIOR QUARTIL da rede naquele mês, no sentido de cada variável */
function indicadores(cod, vig, ctx, lista) {
  const v = (ctx.fatoUni[cod + '|' + vig] || {});
  const out = [];
  lista.forEach(k => {
    const x = v[k]; if (!fin(x)) return;
    const cv = CAT[k] || {}, dir = cv.dir;
    let meta = METAS[k], ruim = null, ref = '';
    if (k === 'dispersao') { meta = SEARA(cod) ? 10 : 5; ruim = x > meta; ref = `meta ${meta}%`; }
    else if (meta != null) { ruim = (k === 'osVenc' || k === 'osCritica') ? x > meta : x < meta; ref = `meta ${fmtInd(k, meta)}`; }
    else if (dir) {
      const qs = (ctx.quartisRede[vig] || {})[k];
      if (qs) { if (dir === 'down') { ruim = x > qs.q3; meta = qs.q3; ref = `entre os 25% piores da rede no mês`; }
                else { ruim = x < qs.q1; meta = qs.q1; ref = `entre os 25% piores da rede no mês`; } }
    }
    const re = ((ctx.rede[ctx._pac] || []).find(e => e.x === k)) || null;
    out.push({ k, rot: cv.rot || k, g: cv.g || '', val: x, meta, ref, ruim, rede: re });
  });
  return out;
}
const ehPlaca = s => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
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
  else if (f.pac === 'Pneus') diagPneus(f, ctx, D, causa, acao, base);
  else diagOutros(f, ctx, D, causa, acao, base);

  D.ano = acumuladoAno(f, ctx);
  // quanto do desvio as causas em R$ explicam (só Combustíveis tem a ponte que
  // fecha no Δ do custo; em Manutenções e Pneus as contas JÁ são o fato, e o que
  // o motor traz é onde o dinheiro foi e o que estava fora da meta)
  if (f.pac === 'Combustíveis') {
    // LÍQUIDO: o que economizou (preço abaixo do remunerado, km a menos) abate o que estourou
    const liq = fin(D.tres) ? D.tres : D.causas.filter(c => fin(c.rs)).reduce((s, c) => s + c.rs, 0);
    D.explicado = f.over > 0 ? Math.max(0, Math.min(1, liq / f.over)) : 0;
    D.causas.forEach(c => { if (c.rs > 0 && c.soma !== false && f.over > 0) c.part = c.rs / f.over; });
  } else D.explicado = null;
  // ordem: R$ primeiro (o que fecha a conta), depois o que a rede sustenta, depois o resto
  // (os grupos da Carta vêm antes de tudo em Manutenções — Renan, 14/10/2026: "principalmente grupos")
  const peso = c => (c.prio || 0) * 1e12 + (c.soma === false ? 0 : (c.rs || 0)) * 10 + (c.rede ? 5 : 0) + (c.rs != null && c.soma !== false ? 1 : 0);
  D.causas.sort((a, b) => peso(b) - peso(a));
  D.historico = histDoFato(f, ctx);
  D.causaTxt = D.causas.map((c, i) => `${i + 1}. ${c.txt}`).join('\n') + (D.ano ? (D.causas.length ? '\n' : '') + 'Ano: ' + D.ano.txt : '');
  D.acaoTxt = D.acoes.map((a, i) => `${i + 1}. ${a.txt}${a.ofens.length ? ': ' + a.ofens.join(' · ') : ''}`).join('\n');
  return D;
}
/* ACUMULADO DO ANO embaixo das causas, em TODO pacote (Renan, 14/10/2026: "Todos
   pacotes devem abaixo das causas trazer conta de chegada ano de forma direta…
   Desvio ano ▲ 55.549 (8%) Curva de captura com redução de 10%. Ou, Saving no
   ano de ▼ 15.395 (15%) - Tratar como desvio casualmente"). Soma jan → mês do
   fato do mesmo pacote, unidade e projeto. A curva de captura é quanto abaixo do
   remunerado os meses que faltam precisam rodar para o ano fechar no
   remunerado, com o remunerado dos meses que faltam estimado pela média mensal
   do ano. */
function acumuladoAno(f, ctx) {
  const ano = f.vig.slice(0, 4), mes = +f.vig.slice(5, 7);
  const fs = (ctx.todos || []).filter(x => x.uni === f.uni && x.proj === f.proj && x.pac === f.pac && x.vig.slice(0, 4) === ano && x.vig <= f.vig).sort((a, b) => a.vig.localeCompare(b.vig));
  if (!fs.length) return null;
  const rem = fs.reduce((s, x) => s + x.rem, 0), real = fs.reduce((s, x) => s + x.real, 0), over = real - rem;
  const pctA = Math.abs(rem) > 0 ? over / Math.abs(rem) * 100 : null;
  const restam = 12 - mes, remMes = rem / fs.length, de = vigLbl(fs[0].vig), ate = vigLbl(f.vig);
  const r = { over, rem, real, pct: pctA, meses: fs.length, restam, de, ate, reducao: null, txt: '' };
  const vals = 'R$ ' + Math.round(Math.abs(over)).toLocaleString('pt-BR') + (pctA != null ? ' (' + Math.round(Math.abs(pctA)) + '%)' : '');
  const per = de === ate ? ate : de + ' → ' + ate;
  if (Math.round(over) > 0) {
    if (restam > 0 && remMes > 0) { r.reducao = over / (remMes * restam) * 100;
      const quando = `${restam === 1 ? 'no mês que falta' : 'nos ' + restam + ' meses que faltam'} (${vigLbl(vigSeg(f.vig))}${restam > 1 ? ' → dez/' + ano.slice(2) : ''})`;
      // acima de 100% não há como capturar: o desvio já passa do remunerado inteiro dos meses que faltam
      if (r.reducao > 100) r.txt = `Desvio no ano (${per}) ▲ ${vals} · não fecha no ano: o desvio já supera o remunerado ${quando}, R$ ${Math.round(remMes * restam).toLocaleString('pt-BR')}`;
      else r.txt = `Desvio no ano (${per}) ▲ ${vals} · curva de captura: rodar ${r.reducao < 10 ? br(r.reducao, 1) : Math.round(r.reducao)}% abaixo do remunerado ${quando} para fechar o ano no remunerado`; }
    else r.txt = `Desvio no ano (${per}) ▲ ${vals} · ano fechado: não há mês para capturar`;
  } else if (Math.round(over) < 0) r.txt = `Saving no ano (${per}) ▼ ${vals} · tratar o desvio do mês como pontual`;
  else r.txt = `No ano (${per}), no remunerado`;
  return r;
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
  const Arv = ctx.ArvImpacto, seara = SEARA(f.uni);
  // SEARA PELA ÁRVORE DA SEARA (Renan, 14/10/2026): as abas Combustível / Base Remunerado / Remunerado no lugar da Km/L e da Dispersão
  const S = seara ? ((ctx.seara || {})[f.vig] || null) : null;
  const ls = seara ? [] : (ctx.kml[k] || []), cb = seara ? (S && S.cb) : combBases(ls), dp = seara ? (S && S.dp) : (ctx.disp[k] || null);
  D.blocos.seara = seara; const abaKm = seara ? 'aba Combustível da Seara' : 'aba Km/L', painelKm = seara ? 'Painel KM · Seara' : 'Painel KM';
  // a conta Combustíveis sem Arla, inclusive quando ela não estourou sozinha
  const contasTodas = (ctx.dreAcc[k] && Object.values(ctx.dreAcc[k].contas)) || [];
  const comb = contasTodas.filter(c => CONTA_COMB.has(NK(c.conta))).reduce((s, c) => ({ rem: s.rem + c.rem, real: s.real + c.real }), { rem: 0, real: 0 });
  const arla = contasTodas.filter(c => CONTA_ARLA.has(NK(c.conta))).reduce((s, c) => ({ rem: s.rem + c.rem, real: s.real + c.real }), { rem: 0, real: 0 });
  const b = Arv ? Arv.calc({ custoRem: comb.rem, custoReal: comb.real, kmRem: dp ? dp.rem : 0, kmReal: dp ? dp.real : 0,
    rsLRem: cb && cb.rsLRem, rsLReal: cb && cb.rsLReal, kmLRem: cb && cb.kmLRem, kmLReal: cb && cb.kmLReal,
    impPrecoBase: cb ? cb.preco : null, impEficBase: cb ? cb.efic : null, litBase: cb ? cb.lit : 0, kmBase: cb ? cb.km : 0, totBase: cb ? cb.tot : 0 }) : null;
  D.blocos.ponte = b; D.blocos.comb = cb; D.blocos.disp = dp;
  if (!cb) D.avisos.push(seara ? 'Sem linhas na aba Combustível da Seara para este mês: eficiência e preço não foram abertos.' : 'Sem linhas na aba Km/L para este projeto e mês: eficiência e preço não foram abertos.');
  if (!dp) D.avisos.push(seara ? 'Sem km remunerado na aba Remunerado da Seara para este mês: o volume não foi calculado.' : 'Sem km da Dispersão de km para este projeto e mês: o volume não foi calculado.');
  if (cb && cb.porModelo) D.avisos.push(`${cb.porModelo} placa(s) sem remunerado na Base Remunerado: Km/L e R$/L remunerados pela média do modelo (a mesma regra da Árvore da Seara).`);

  // Volume
  if (b && fin(b.vol) && dp && dp.rem > 0) {
    const dkm = dp.real - dp.rem, dpct = (dp.real / dp.rem - 1) * 100;
    if (b.vol >= D.minimo) {
      const extra = EMPURRADA(f.uni) ? ' (km remunerado bruto, sem o balanço de massa: conferir no Painel KM antes de agir)' : '';
      causa('Km / rota', `Km rodado: rodou ${br(dkm, 0)} km acima do remunerado (${sinalPct(dpct, 1)}), ${rs(b.vol)} no R$/km remunerado${extra}`, b.vol);
      const vg = []; if (dp.vgRec) vg.push(br(dp.vgRec, 0) + ' recs'); if (dp.vgNot) vg.push(br(dp.vgNot, 0) + ' noturnas'); if (dp.vgMap) vg.push(br(dp.vgMap, 0) + ' com mapa aberto');
      acao('Km / rota', `Conferir as viagens que não remuneram e a roteirização no ${painelKm}${vg.length ? ' (no mês: ' + vg.join(', ') + ' de ' + br(dp.vgTot, 0) + ' viagens)' : ''}`);
    } else if (Math.abs(b.vol) >= D.minimo) causa('Km / rota', `Km rodado: rodou ${br(-dkm, 0)} km abaixo do remunerado (${sinalPct(dpct, 1)}), ${rs(b.vol)} a menos: o km não explica o estouro`, b.vol, { soma: false });
  }
  // Eficiência
  if (cb && fin(cb.efic)) {
    const dk = cb.kmLRem > 0 && cb.kmLReal > 0 ? (cb.kmLReal / cb.kmLRem - 1) * 100 : null;
    if (cb.efic >= D.minimo) {
      causa('Condução', `Eficiência: fizemos ${br(cb.kmLReal, 2)} km/L contra ${br(cb.kmLRem, 2)} remunerado (${sinalPct(dk, 1)}): ${br(cb.lit - cb.litEsp, 0)} L a mais do que o remunerado previa para o km rodado, ${rs(cb.efic)}`, cb.efic);
      const of = top(cb.placas.filter(p => p.rsEfic > 0 && p.placa), 5, p => p.rsEfic)
        .map(p => `${p.placa}${p.modelo ? ' (' + p.modelo + ')' : ''} ${br(p.kmlReal, 2)} km/L, ${br(p.litMais, 0)} L, ${rs(p.rsEfic)}`);
      if (of.length) acao('Condução', `Vistoria de consumo nas placas que mais gastaram acima da régua (vazamento, injeção, filtro, pneu murcho, ocioso) e acompanhar quem dirige`, of);
    } else if (Math.abs(cb.efic) >= D.minimo) causa('Condução', `Eficiência: fizemos ${br(cb.kmLReal, 2)} km/L contra ${br(cb.kmLRem, 2)} remunerado (${sinalPct(dk, 1)}): gastamos menos litros do que o previsto, economizou ${rs(-cb.efic)}`, cb.efic, { soma: false });
  }
  // Preço
  if (cb && fin(cb.preco)) {
    const dp2 = cb.rsLRem > 0 && cb.rsLReal > 0 ? (cb.rsLReal / cb.rsLRem - 1) * 100 : null;
    if (cb.preco >= D.minimo) {
      causa('Abastecimento / preço', `Preço: pagamos R$ ${br(cb.rsLReal, 2)}/L contra R$ ${br(cb.rsLRem, 2)}/L remunerado (${sinalPct(dp2, 1)}): ${rs(cb.preco)} a mais nos litros abastecidos`, cb.preco);
      const of = top(cb.placas.filter(p => p.rsPreco > 0 && p.placa), 5, p => p.rsPreco).map(p => `${p.placa} R$/L ${br(p.rsLReal, 2)} × ${br(p.pRem, 2)}, ${rs(p.rsPreco)}`);
      acao('Abastecimento / preço', `Direcionar o abastecimento para o posto/tanque com preço no remunerado e cobrar o preço negociado; placas que mais pagaram acima`, of);
    } else if (Math.abs(cb.preco) >= D.minimo) causa('Abastecimento / preço', `Preço: pagamos R$ ${br(cb.rsLReal, 2)}/L contra R$ ${br(cb.rsLRem, 2)}/L remunerado (${sinalPct(dp2, 1)}): economizou ${rs(-cb.preco)}`, cb.preco, { soma: false });
  }
  // Arla (faz parte do pacote: entra no que as alavancas explicam)
  const ovArla = arla.rem - arla.real;    // negativos: estouro > 0
  if (ovArla > 0 && Math.abs(arla.rem) > 0) {
    causa('Abastecimento / preço', `Arla: ${rs(ovArla)} acima do remunerado (${sinalPct(ovArla / Math.abs(arla.rem) * 100, 0)})`, ovArla);
    acao('Abastecimento / preço', `Conferir a proporção Arla/diesel por placa e o preço do Arla do mês`);
  }
  // AS TRÊS ALAVANCAS EXPLICAM O DESVIO? (Renan, 14/10/2026: "Tanto Seara quanto Ambev, quando no
  // combustível os 3 parâmetros não explicarem diretamente o desvio (nunca vai bater na vírgula, mas
  // quando estiverem muito discrepantes), por exemplo o desvio ser de 100k e os três explicarem 50% ou
  // menos"). Explicado = preço + eficiência + km rodado (+ Arla, que é do pacote), líquido. Só quando
  // isso fica em metade ou menos do desvio entra a linha do resto (DRE × bases), com o que faltou medir.
  const temVol = !!(b && fin(b.vol) && dp && dp.rem > 0), temEf = !!(cb && fin(cb.efic)), temPr = !!(cb && fin(cb.preco));
  const tres = (temVol ? b.vol : 0) + (temEf ? cb.efic : 0) + (temPr ? cb.preco : 0) + ovArla;
  D.tres = tres;
  D.explicado = f.over > 0 ? Math.max(0, Math.min(1, tres / f.over)) : 0;
  const resto = f.over - tres;
  if (f.over > 0 && D.explicado <= 0.5 && resto >= Math.max(1000, 0.1 * base)) {
    const medidas = [temPr && 'preço', temEf && 'eficiência', temVol && 'km rodado'].filter(Boolean);
    const quem = medidas.length ? medidas.join(', ').replace(/, ([^,]+)$/, ' e $1') : 'as bases';
    const verbo = medidas.length === 1 ? 'explica' : 'explicam';
    const faltas = [];
    if (!temVol) faltas.push(seara ? 'o km rodado ainda não entrou (aba Remunerado da Seara sem o mês)' : 'o km rodado ainda não entrou (Dispersão de km sem o mês)');
    if (!temEf && !temPr) faltas.push(seara ? 'eficiência e preço sem a aba Combustível da Seara no mês' : 'eficiência e preço sem a aba Km/L no mês');
    else { if (!temPr) faltas.push('o preço não foi medido (sem R$/L remunerado)'); if (!temEf) faltas.push('a eficiência não foi medida (sem Km/L remunerado)'); }
    const l = [];
    if (b && fin(b.dif)) {
      if (fin(b.difReal) && Math.abs(b.difReal) >= 500) l.push(`realizado da DRE ${b.difReal > 0 ? 'acima' : 'abaixo'} dos abastecimentos da ${abaKm} em ${rs(Math.abs(b.difReal))}`);
      if (fin(b.difRem) && Math.abs(b.difRem) >= 500) l.push(`remunerado da DRE ${b.difRem > 0 ? 'abaixo' : 'acima'} do que as bases preveem em ${rs(Math.abs(b.difRem))}`);
    }
    const q = quem.charAt(0).toUpperCase() + quem.slice(1);
    causa('Lançamento / contábil', `${q} ${verbo} só ${Math.round(D.explicado * 100)}% do desvio (${rs(Math.max(tres, 0))} de ${rs(f.over)}): ${rs(resto)} ${medidas.length === 3 ? 'não batem com os abastecimentos' : 'sem explicação pelas bases'}${l.length ? ' (' + l.join('; ') + ')' : ''}${faltas.length ? '; ' + faltas.join('; ') : ''}`, null, { prio: -1 });
    acao('Lançamento / contábil', `${temVol ? 'C' : (seara ? 'Atualizar a aba Remunerado da Seara e c' : 'Atualizar a Dispersão de km do mês e c')}onciliar a conta Combustíveis do DRE com os abastecimentos do mês (lançamento de outra competência, provisão, placa de outro projeto)`);
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
      if (cb && cb.efic > 0) acao('Condução', `Feedback de condução (faixa verde, motor ligado parado) com os motoristas de pior nota da unidade no DriverPro`, of);
    }
  }
  // COMBUSTÍVEIS SÓ TEM TRÊS ALAVANCAS (Renan, 14/10/2026: "O que checklist de saída e retorno tem a ver com
  // combustível? Combustível temos variáveis bem direcionadas: 1. Preço 2. Eficiência 3. Km rodado"): a ponte já
  // mede as três em R$; da rede entra SÓ a condução (DriverPro), que explica a eficiência. Checklist,
  // preventivas, conformidade etc. ficam na tabela da rede, nunca como causa ou ação de combustível.
  sinaisRede(f, ctx, D, ['cond_kml'], k => /^cond_/.test(k));
  acoesDaRede(f, ctx, D);
}
/* TODAS as variáveis do catálogo, menos as que o diagnóstico já mede em R$
   (a ponte do combustível). Fora da meta / no pior quartil: vira CAUSA quando a
   rede sustenta a ligação com o desvio do pacote; vira SINAL quando tem meta
   ou a rede mostra alguma ligação no sentido certo; o resto fica só na tabela. */
function sinaisRede(f, ctx, D, excluir, apenas) {
  if (!ctx.rede[f.pac]) return [];
  const ex = new Set(excluir || []);
  const lista = Object.keys(CAT).filter(k => !ex.has(k) && !(CAT[k].pac && !CAT[k].pac.includes(f.pac)) && (!apenas || apenas(k)));
  const ind = indicadores(f.uni, f.vig, ctx, lista); D.blocos.ind = ind;
  ind.filter(i => i.ruim).forEach(i => {
    const txt = `${i.rot}: ${fmtInd(i.k, i.val)} (${i.ref}). ${redeFala(i.rede, f.pac)}`;
    if (i.rede && i.rede.sust) D.causas.push({ tema: TEMA_IND[i.k] || TEMA_GRUPO[i.g] || 'Oficina / SLA', txt, rs: null, rede: true, ind: i.k, forca: i.rede.forca });
    else if (METAS[i.k] != null || i.k === 'dispersao' || (i.rede && i.rede.forca >= 0.2 && Math.max(i.rede.n0 || 0, i.rede.n1 || 0) >= 30)) D.sinais.push({ tema: TEMA_IND[i.k] || TEMA_GRUPO[i.g] || '', txt, ind: i.k });
  });
  return ind;
}
const TEMA_GRUPO = { 'Condução (DriverPro · só Empurrada)': 'Condução', 'Frota': 'Frota / idade', 'Carta de Custos': 'Peças / fornecedor', 'FCA': 'Lançamento / contábil',
  'Combustível (bases)': 'Abastecimento / preço', 'Dispersão de km': 'Km / rota', 'Indisponibilidade': 'Oficina / SLA', 'Frota de Elite / Gerot': 'Oficina / SLA' };
const TEMA_IND = { sla: 'Oficina / SLA', mttr: 'Oficina / SLA', osVenc: 'Oficina / SLA', prev: 'Preventiva', conf: 'Corretiva / quebra', checkT: 'Corretiva / quebra', osCritica: 'Corretiva / quebra',
  mtbf: 'Corretiva / quebra', civf: 'Corretiva / quebra', stVeic: 'Frota / idade', disp: 'Oficina / SLA', disp_app: 'Oficina / SLA', indisp_med: 'Oficina / SLA', dispersao: 'Km / rota', comb: 'Condução', pneus: 'Pneus',
  checkWH: 'Corretiva / quebra', stEmp: 'Frota / idade', blitz: 'Corretiva / quebra', viagens: 'Km / rota', km_viagem: 'Km / rota', km_real: 'Km / rota',
  cond_nota: 'Condução', cond_rpm: 'Condução', cond_idle: 'Condução', cond_acel: 'Condução', cond_baixo: 'Condução', cond_kml: 'Condução',
  frota_idade: 'Frota / idade', contr_rskm: 'Contrato', contr_faixa2: 'Contrato', dias_parado: 'Oficina / SLA', erp_kml: 'Condução', erp_preco: 'Abastecimento / preço',
  kml_gap: 'Condução', preco_gap: 'Abastecimento / preço', carta_n: 'Corretiva / quebra', carta_ticket: 'Peças / fornecedor', carta_forn: 'Peças / fornecedor', carta_novos: 'Pneus', fca_preench: 'Lançamento / contábil' };
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
  pneus: 'Recuperar a aderência de aferição (calibragem e sulco) das placas sem aferição',
  checkWH: 'Retomar o checklist das empilhadeiras (WH) nos turnos em falta',
  stEmp: 'Rodar as empilhadeiras paradas no Stress Test da quinzena',
  blitz: 'Fazer as blitz de segurança vencidas',
  cond_nota: 'Feedback de condução com os motoristas de pior nota no DriverPro',
  cond_rpm: 'Treinar troca de marcha na faixa verde (1.000 a 1.400 RPM) com os motoristas de pior nota',
  cond_idle: 'Cortar o motor ligado parado (carga, descarga, espera) com os motoristas de pior nota',
  cond_acel: 'Corrigir as acelerações bruscas com os motoristas de pior nota',
  cond_baixo: 'Feedback de condução com os motoristas abaixo de 75 pontos, que rodam a maior parte do km',
  frota_idade: 'Priorizar inspeção e revisão nas placas mais velhas (e levar a idade para a renovação de frota)',
  contr_rskm: 'Conferir a fatura do contrato de manutenção: R$/km acima do resto da rede',
  contr_faixa2: 'Conferir as placas que passaram para a faixa 2 do contrato',
  dias_parado: 'Atacar as placas paradas há mais dias (indisponibilidade do app)',
  carta_n: 'Revisar a reincidência: muitos lançamentos de manutenção no mês',
  carta_ticket: 'Auditar os orçamentos de maior valor antes de aprovar',
  carta_forn: 'Cotar com outro fornecedor: o gasto está concentrado em um só',
  carta_novos: 'Recapar antes de comprar: pneu novo pesa acima do resto da rede',
  fca_preench: 'Preencher causa e ação dos FCAs de Custos em aberto da unidade'
};

/* ação de cada variável que virou CAUSA pela rede (sem repetir tema já com ação) */
function acoesDaRede(f, ctx, D, pular) {
  const ja = new Set(D.acoes.map(a => a.txt)), pl = new Set(pular || []);
  D.causas.filter(c => c.rede && c.ind && ACAO_IND[c.ind] && !pl.has(c.ind)).forEach(c => {
    const t = ACAO_IND[c.ind]; if (ja.has(t)) return; ja.add(t);
    // condução: se o diagnóstico já mandou o feedback com os motoristas, não repete
    if (/^cond_/.test(c.ind) && D.acoes.some(a => /DriverPro/.test(a.txt))) return;
    const tx = taxaTema(ctx, f.pac, TEMA_IND[c.ind] || c.tema);
    D.acoes.push({ tema: TEMA_IND[c.ind] || c.tema, txt: t, ofens: ofensoresDe(c.ind, f, ctx), taxa: tx });
  });
}
/* quem puxa a variável para baixo na unidade, quando dá para dizer */
function ofensoresDe(k, f, ctx) {
  if (/^cond_/.test(k)) return top((ctx.fatoMot[f.uni + '|' + f.vig] || []).filter(m => fin(m.v.nota) && (m.v.km || 0) >= 500 && m.v.nota < 75), 5, m => (75 - m.v.nota) * (m.v.km || 0))
    .map(m => `${m.nome || m.ent} ${br(m.v.nota, 0)} pts, ${br(m.v.km, 0)} km`);
  const pl = ctx.fatoPlaca[f.uni + '|' + f.vig] || [], pa = ctx.fatoPlaca[f.uni + '|' + vigAnt(f.vig)] || [];
  if (k === 'frota_idade') return top(pl.filter(p => fin(p.v.idade)), 5, p => p.v.idade).map(p => `${p.ent} ${br(p.v.idade, 1)} anos`);
  if (k === 'dias_parado') return top(pl.filter(p => (p.v.dias_indisp || 0) > 0), 5, p => p.v.dias_indisp).map(p => `${p.ent} ${br(p.v.dias_indisp, 0)}d`);
  if (k === 'contr_rskm') return top(pa.filter(p => fin(p.v.rskm)), 5, p => p.v.rskm).map(p => `${p.ent} R$ ${br(p.v.rskm, 2)}/km`);
  if (k === 'contr_faixa2') return pa.filter(p => (p.v.faixas || 0) >= 2).slice(0, 6).map(p => p.ent);
  return [];
}

/* ── MANUTENÇÕES ── */
function diagManut(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Manutenção');
  D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const grupo = r => r.grupo || 'sem grupo';
    const gr = somaPor(lanc.rows, grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
    // o grupo que pesa em cada placa (a "causa" da placa cara: Motor, Embreagem…)
    const grPl = {}; lanc.rows.filter(r => ehPlaca(r.equipamento)).forEach(r => { const g = grPl[r.equipamento] || (grPl[r.equipamento] = {}); g[grupo(r)] = (g[grupo(r)] || 0) + r.valor; });
    const grupoDa = p => Object.entries(grPl[p] || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g, v]) => `${g} ${rs(v)}`).join(', ');
    D.blocos.cartaGr = gr; D.blocos.cartaPl = pl; D.blocos.cartaFo = fo; D.blocos.cartaPlGr = grPl;
    // GRUPOS PRIMEIRO (Renan, 14/10/2026: "Manutenções, além do contrato, sempre considerar os grupos de custos
    // que mais gastaram. Placas, fornecedores e grupos de custos podem explicar. Mas principalmente grupos.
    // Placas se ficaram com gastos muito altos, trazer valor e a causa (Motor, Embreagem etc)")
    const g3 = gr.slice(0, 3).map((g, i) => `${g.k} ${rs(g.v)} (${pct(g.v / tot * 100)}${i === 0 ? ' do lançado de ' + rs(tot) : ''})`);
    causa('Corretiva / quebra', `Grupos que mais gastaram (Carta de Custos${lanc.nivel === 'unidade' ? ', unidade inteira' : ''}): ${g3.join(', ')}`, null, { prio: 3 });
    // placa com gasto muito alto = acima de 2× a média por placa e de 15% do lançado; vai com o valor e o grupo
    const mediaPl = pl.length ? pl.reduce((s, x) => s + x.v, 0) / pl.length : 0;
    const caras = pl.filter(p => p.v >= Math.max(2 * mediaPl, 0.15 * tot, 1000)).slice(0, 4);
    if (caras.length) causa('Corretiva / quebra', `Placas com gasto muito alto: ${caras.map(p => `${p.k} ${rs(p.v)} (${grupoDa(p.k)})`).join('; ')}`, null, { prio: 2 });
    if (fo[0] && fo.length > 1 && fo[0].v >= 0.4 * tot) causa('Peças / fornecedor', `Fornecedor que concentra o gasto: ${fo[0].k} ${rs(fo[0].v)} (${pct(fo[0].v / tot * 100)} do lançado)`, null, { prio: 1 });
    const g1 = gr[0], top3 = pl.slice(0, 3);
    if (g1) { const plG = somaPor(lanc.rows.filter(r => grupo(r) === g1.k && ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor).slice(0, 5);
      acao('Corretiva / quebra', `Atacar o grupo que mais pesa (${g1.k}): análise de causa raiz nas placas desse grupo (reincidência, idade, garantia, cobertura do contrato)`, plG.map(x => `${x.k} ${rs(x.v)}`)); }
    if (top3.length) acao('Corretiva / quebra', `Análise de causa raiz nas placas que mais custaram, pelo grupo de cada uma`, top3.map(x => `${x.k} ${rs(x.v)} (${grupoDa(x.k)})`));
    if (fo[0] && fo[0].v >= 0.25 * tot) acao('Peças / fornecedor', `Auditar os orçamentos e renegociar com o fornecedor que concentra o gasto`, fo.slice(0, 2).map(x => `${x.k} ${rs(x.v)} (${pct(x.v / tot * 100)})`));
  } else D.avisos.push('Sem lançamentos na Carta de Custos para este mês: a abertura por grupo, placa e fornecedor ficou de fora.');
  // contrato de manutenção: a fatura do mês V cobra o km de V−1 (Carta)
  const kmMes = vigAnt(f.vig);
  const ct = (ctx.fatoPlaca[f.uni + '|' + kmMes] || []).filter(p => fin(p.v.custo_mes));
  if (ct.length) {
    const tc = ct.reduce((s, p) => s + p.v.custo_mes, 0), fx2 = ct.filter(p => (p.v.faixas || 0) >= 2);
    const cContr = f.contas.find(c => /CONTRATOS DE MANUTENCAO/.test(c.ck));
    D.blocos.contrato = { tot: tc, n: ct.length, faixa2: fx2 };
    if (cContr && cContr.ov > 0) {
      causa('Contrato', `Contrato de manutenção: ${rs(cContr.ov)} acima do remunerado; na unidade, ${ct.length} placas faturadas (${rs(tc)}) pelo km de ${vigLbl(kmMes)}${fx2.length ? ', ' + fx2.length + ' atravessaram para a faixa 2' : ''}`, cContr.ov);
      acao('Contrato', `Conferir a fatura do contrato (km cobrado × km rodado)${fx2.length ? ' e as ' + fx2.length + ' placas que passaram para a faixa 2' : ''}; as de maior fatura`, top(ct, 5, p => p.v.custo_mes).map(p => `${p.ent} ${rs(p.v.custo_mes)}${fin(p.v.km_mes) ? ', ' + br(p.v.km_mes, 0) + ' km' : ''}${(p.v.faixas || 0) >= 2 ? ', faixa 2' : ''}`));
    }
  }
  // indicadores do Ginfo/Gerot
  const ind = sinaisRede(f, ctx, D, []);
  // listas de hoje do Ginfo → ações com placa
  const gi = ctx.ginfo[f.uni] || {};
  const prevV = gi.prevVencidas || [], osAb = gi.osAbertas || [];
  const ruins = new Set(ind.filter(i => i.ruim).map(i => i.k)), causasInd = new Set(ind.filter(i => i.ruim && i.rede && i.rede.sust).map(i => i.k));
  if (prevV.length) acao('Preventiva', `${ACAO_IND.prev}: ${prevV.length} placa(s)`, prevV.slice(0, 6).map(p => `${p.placa}${fin(p.dias) ? ' (' + br(Math.abs(p.dias), 0) + 'd)' : ''}`));
  else if (ruins.has('prev')) acao('Preventiva', ACAO_IND.prev);
  if (osAb.length && (ruins.has('sla') || ruins.has('mttr') || ruins.has('osVenc') || osAb.some(o => (o.dias || 0) > 7))) {
    // sem data no export, a mais antiga é a de menor número
    const velhas = osAb.slice().sort((a, b) => (b.dias != null && a.dias != null ? b.dias - a.dias : (+a.os || 0) - (+b.os || 0))).slice(0, 6);
    acao('Oficina / SLA', `${ACAO_IND.sla}: ${osAb.length} OS em aberto na unidade hoje`, velhas.map(o => `OS ${o.os} ${o.placa}${o.dias != null ? ' ' + br(o.dias, 0) + 'd' : ''}${o.crit ? ' (' + o.crit + ')' : ''}`));
  }
  acoesDaRede(f, ctx, D, osAb.length ? ['osVenc', 'mttr', 'sla', 'prev'] : ['prev']);
  // placas paradas mais dias no mês (eventos do app de indisponibilidade)
  const par = (ctx.fatoPlaca[f.uni + '|' + f.vig] || []).filter(p => (p.v.dias_indisp || 0) >= 3);
  if (par.length) { D.blocos.paradas = par; D.sinais.push({ tema: 'Oficina / SLA', txt: `Placas paradas: ${par.length} placa(s) ficaram 3 dias ou mais paradas no mês (${top(par, 4, p => p.v.dias_indisp).map(p => p.ent + ' ' + br(p.v.dias_indisp, 0) + 'd').join(', ')})` }); }
}
/* lançamentos da Carta do fato: do projeto; sem nada no projeto, da unidade */
function cartaDo(f, ctx, pacCarta) {
  const all = (ctx.carta[f.uni + '|' + f.vig] || []).filter(r => r.pacote === pacCarta && r.valor > 0);
  const doProj = all.filter(r => projKey(r.projeto) === f.proj);
  return doProj.length ? { rows: doProj, nivel: 'projeto' } : { rows: all, nivel: all.length ? 'unidade' : 'nenhum' };
}

/* ── SEGUROS E LICENÇAS · ICMS · OUTROS — sem base operacional para cruzar:
   a causa é a conta que estourou, e a ação é conferir o lançamento ── */
function diagOutros(f, ctx, D, causa, acao, base) {
  f.contas.filter(c => c.ov > 0).forEach(c => causa('Lançamento / contábil', `${c.conta}: ${rs(c.ov)} acima do remunerado${c.p != null ? ' (▲ ' + c.p + '%)' : ''}${fin(c.real) ? ' · realizado ' + rs(c.real) + ' × remunerado ' + rs(c.rem) : ''}`, c.ov));
  const dSeg = f.pac === 'Seguros e licenças';
  const lanc = (ctx.carta[f.uni + '|' + f.vig] || []).filter(r => r.valor > 0 && f.contas.some(c => NK(r.conta) === c.ck));
  if (lanc.length) { const fo = somaPor(lanc.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor); D.blocos.cartaFo = fo;
    acao('Lançamento / contábil', `Conferir os lançamentos da Carta de Custos nessas contas`, fo.slice(0, 4).map(x => `${x.k} ${rs(x.v)}`)); }
  if (dSeg) acao('Lançamento / contábil', `Conferir apólice e parcelas do seguro lançadas no mês (competência, placa de outra unidade, sinistro) contra o remunerado`);
  else if (f.pac === 'ICMS') acao('Lançamento / contábil', `Conferir o crédito e o estorno de ICMS do mês com o Fiscal`);
  else acao('Lançamento / contábil', `Conciliar o lançamento com a Contabilidade: conta sem pacote de custo (competência, rateio, reclassificação)`);
  D.explicado = null;
}

/* ── PNEUS ── */
function diagPneus(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Pneus'); D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const novos = lanc.rows.filter(r => /NOVOS/.test(NK(r.conta))).reduce((s, r) => s + r.valor, 0);
    const gr = somaPor(lanc.rows, r => r.grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
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
  sinaisRede(f, ctx, D, []);
  acoesDaRede(f, ctx, D);
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
  // a data da OS: "Data" (o export às vezes vem sem ela) ou a 1ª coluna "Data…" que for data
  const dataOS = r => { let d = parseData(r['Data']); if (d) return d; for (const k of Object.keys(r)) { if (/^data/i.test(k) && (d = parseData(r[k]))) return d; } return null; };
  (snap['os-em-aberto'] || []).forEach(r => { const u = uniDe(r); if (!u) return; const d = dataOS(r);
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

/* ═════════ 7) as variáveis novas, por unidade × mês ═════════ */
function enriquece(o) {
  const { fatoPlaca, fatoMot, carta, fca, linhaU } = o;   // tudo já indexado por unidade|mês
  // condução: média ponderada pelo km dos motoristas com 500 km ou mais
  Object.entries(fatoMot).forEach(([k, ms]) => { const [cod, vig] = k.split('|');
    const ok = ms.filter(m => fin(m.v.nota) && (m.v.km || 0) >= 500); if (!ok.length) return;
    const km = ok.reduce((s, m) => s + m.v.km, 0), w = f => ok.filter(m => fin(m.v[f])).reduce((s, m) => s + m.v[f] * m.v.km, 0) / (ok.filter(m => fin(m.v[f])).reduce((s, m) => s + m.v.km, 0) || NaN);
    const v = linhaU(cod, vig); v.cond_nota = w('nota'); v.cond_rpm = w('rpm'); v.cond_idle = w('idle'); v.cond_acel = w('acel');
    v.cond_baixo = ok.filter(m => m.v.nota < 75).reduce((s, m) => s + m.v.km, 0) / km * 100;
    const lit = ms.reduce((s, m) => s + (m.v.litros || 0), 0), kml = ms.reduce((s, m) => s + (fin(m.v.km_l) && m.v.litros ? m.v.km_l * m.v.litros : 0), 0);
    if (lit > 0 && kml > 0) v.cond_kml = kml / lit; });
  // frota: idade, contrato, dias parado e ERP — das placas da unidade no mês (contrato e ERP pelo km do mês)
  Object.entries(fatoPlaca).forEach(([k, ps]) => { const [cod, vig] = k.split('|'); const v = linhaU(cod, vig);
    const id = ps.filter(p => fin(p.v.idade)); if (id.length) v.frota_idade = id.reduce((s, p) => s + p.v.idade, 0) / id.length;
    const cv = ps.filter(p => p.tipo !== 'fixo' && fin(p.v.custo_mes) && p.v.km_mes > 0); if (cv.length) v.contr_rskm = cv.reduce((s, p) => s + p.v.custo_mes, 0) / cv.reduce((s, p) => s + p.v.km_mes, 0);
    const fx = ps.filter(p => fin(p.v.faixas)); if (fx.length) v.contr_faixa2 = fx.filter(p => p.v.faixas >= 2).length / fx.length * 100;
    const di = ps.filter(p => fin(p.v.dias_indisp)); if (di.length) v.dias_parado = di.reduce((s, p) => s + p.v.dias_indisp, 0) / di.length;
    const ab = ps.filter(p => p.v.litros > 0 && p.v.km_mes > 0); if (ab.length) { const lit = ab.reduce((s, p) => s + p.v.litros, 0); v.erp_kml = ab.reduce((s, p) => s + p.v.km_mes, 0) / lit;
      const pr = ab.filter(p => fin(p.v.preco_l)); if (pr.length) v.erp_preco = pr.reduce((s, p) => s + p.v.preco_l * p.v.litros, 0) / pr.reduce((s, p) => s + p.v.litros, 0); } });
  // Carta: manutenção (quantos lançamentos, valor médio, peso do maior fornecedor) e pneus (peso dos novos)
  Object.entries(carta).forEach(([k, ls]) => { const [cod, vig] = k.split('|'); const v = linhaU(cod, vig);
    const mn = ls.filter(r => r.pacote === 'Manutenção' && r.valor > 0 && r.origem !== 'contratos-planilha' && !/CONTRATO/.test(NK(r.conta)));
    if (mn.length) { const t = mn.reduce((s, r) => s + r.valor, 0); v.carta_n = mn.length; v.carta_ticket = t / mn.length;
      const fo = somaPor(mn.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor); if (fo.length && t > 0) v.carta_forn = fo[0].v / t * 100; }
    const pn = ls.filter(r => r.pacote === 'Pneus' && r.valor > 0); if (pn.length) { const t = pn.reduce((s, r) => s + r.valor, 0); if (t > 0) v.carta_novos = pn.filter(r => /NOVOS/.test(NK(r.conta))).reduce((s, r) => s + r.valor, 0) / t * 100; } });
  // FCA: dos fatos de Custos do mês, quantos já têm ação
  const fc = {}; (fca || []).forEach(r => { if (String(r.origem || '').toLowerCase() !== 'custos') return; const vig = vigDeLbl(r.vigencia); if (!vig) return;
    const k = String(r.unidade || '').trim() + '|' + vig, e = fc[k] || (fc[k] = { n: 0, ok: 0 }); e.n++; if (String(r.acao || '').trim()) e.ok++; });
  Object.entries(fc).forEach(([k, e]) => { const [cod, vig] = k.split('|'); if (UNITS.includes(cod)) linhaU(cod, vig).fca_preench = e.ok / e.n * 100; });
}
/* bases de combustível: Km/L real contra a régua e R$/L contra o remunerado, por unidade × mês */
function enriqueceKml(kmlIdx, linhaU, searaIdx) {
  // Seara: as mesmas duas variáveis, pelas abas da Árvore da Seara
  Object.entries(searaIdx || {}).forEach(([vg, s]) => { const c = s.cb; if (!c) return; const v = linhaU('ANG', vg);
    if (c.kmLRem > 0 && c.kmLReal > 0) v.kml_gap = (c.kmLReal / c.kmLRem - 1) * 100; if (c.rsLRem > 0 && c.rsLReal > 0) v.preco_gap = (c.rsLReal / c.rsLRem - 1) * 100; });
  // a régua é por projeto × mês: litros previstos somados projeto a projeto
  const prev = {};
  Object.entries(kmlIdx).forEach(([k, ls]) => { const [cod, , vig] = k.split('|'); const cb = combBases(ls); if (!cb) return;
    const e = prev[cod + '|' + vig] || (prev[cod + '|' + vig] = { km: 0, lit: 0, esp: 0, tot: 0, rxl: 0, litR: 0 });
    e.km += cb.km; e.lit += cb.lit; if (cb.litEsp > 0) e.esp += cb.litEsp;
    ls.forEach(r => { if (r.pRem > 0 && r.lit > 0 && r.tot > 0) { e.tot += r.tot; e.rxl += r.pRem * r.lit; e.litR += r.lit; } }); });
  Object.entries(prev).forEach(([k, e]) => { const [cod, vig] = k.split('|'); const v = linhaU(cod, vig);
    if (e.esp > 0 && e.lit > 0) v.kml_gap = ((e.km / e.lit) / (e.km / e.esp) - 1) * 100;
    if (e.rxl > 0 && e.litR > 0) v.preco_gap = (e.tot / e.rxl - 1) * 100; });
}

/* ═════════ 8) monta o contexto a partir do que foi lido ═════════ */
function contexto(L, deps) {
  deps = deps || {};
  const dreIdx = indexaDRE(L.dre);
  const todos = fatos(dreIdx);
  const precoRem = indexaPreco(L.rsl);
  const fatoUni = {}, quartisRede = {}, fatoPlaca = {}, fatoMot = {};
  montaCatalogo(deps.CorrDados || global.CorrDados);
  // cópia das linhas do CorrDados (a página não deve mexer no objeto de lá)
  const FU = ((L.corr && L.corr.FATO && L.corr.FATO.uni) || []).map(r => ({ ent: r.cod, cod: r.cod, vig: r.vig, v: Object.assign({}, r.v) }));
  const linhaU = (cod, vig) => { const k = cod + '|' + vig; if (!fatoUni[k]) { const r = { ent: cod, cod, vig, v: {} }; FU.push(r); fatoUni[k] = r.v; } return fatoUni[k]; };
  FU.forEach(r => { fatoUni[r.cod + '|' + r.vig] = r.v; });
  ((L.corr && L.corr.FATO && L.corr.FATO.placa) || []).forEach(r => { (fatoPlaca[r.cod + '|' + r.vig] = fatoPlaca[r.cod + '|' + r.vig] || []).push(r); });
  // DRIVERPRO SÓ NA EMPURRADA (Renan, 14/10/2026: "Eu deixaria DriverPro inicialmente apenas com Empurrada.
  // Acredito que rota ainda tenham muitos veículos com Trimble/Veltec"): o motorista entra na rede e nas
  // causas só quando a unidade dele no Geotab é EMP … (a unidade crua da linha, não o código do portal)
  ((L.corr && L.corr.FATO && L.corr.FATO.mot) || []).forEach(r => { if (!r.cod || !/^EMP\b/.test(NK(r.uni))) return; (fatoMot[r.cod + '|' + r.vig] = fatoMot[r.cod + '|' + r.vig] || []).push(r); });
  const carta = {}; (L.carta || []).forEach(r => { const k = r.unidade + '|' + r.vigencia; (carta[k] = carta[k] || []).push(r); });
  enriquece({ fatoPlaca, fatoMot, carta, fca: L.fca, linhaU });
  const kmlIdx = indexaKml(L.kml, precoRem);
  const searaIdx = indexaSeara(L.seara, deps.SearaBenchModelo || global.SearaBenchModelo);
  enriqueceKml(kmlIdx, linhaU, searaIdx);
  const porVig = {}; FU.forEach(r => { (porVig[r.vig] = porVig[r.vig] || []).push(r.v); });
  Object.entries(porVig).forEach(([vg, vs]) => { const q = {}; Object.keys(CAT).forEach(k => { q[k] = quartis(vs.map(v => v[k])); }); quartisRede[vg] = q; });
  const prolog = {}; Object.entries(L.prolog || {}).forEach(([u, t]) => { prolog[u] = resumoProlog(t); });
  const ctx = { dreAcc: dreIdx.acc, maxVig: dreIdx.maxReal, todos, disp: indexaDisp(L.disp), kml: kmlIdx, cat: CAT, fatoRede: FU,
    fatoUni, quartisRede, fatoPlaca, fatoMot, carta, seara: searaIdx, ginfo: indexaGinfo(L.ginfo || {}, deps.hoje), prolog, ArvImpacto: deps.ArvImpacto || global.ArvImpacto };
  ctx.rede = rede(FU, deps.Estat || global.Estat);
  ctx.aprend = aprendizado(L.fca, todos, dreIdx.maxReal);
  return ctx;
}

/* ═════════ 9) leitura (navegador) ═════════ */
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A', DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const gviz = (id, aba) => gvizP(id, { sheet: aba });
/* os parâmetros têm de ser os MESMOS que o painel dono da aba manda (sheet/gid/tq/headers): a chave
   do gviz-cache é exata, e com outra chave o pedido iria ao Google em vez do banco */
async function gvizP(id, o) {
  const p = ['tqx=out:json']; if (o.sheet) p.push('sheet=' + encodeURIComponent(o.sheet)); if (o.gid != null) p.push('gid=' + o.gid); if (o.tq) p.push('tq=' + encodeURIComponent(o.tq)); if (o.headers) p.push('headers=' + o.headers);
  const aba = o.sheet || ('gid ' + o.gid);
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${p.join('&')}`;
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
  const SBM = global.SearaBenchModelo;
  const [dre, disp, kml, rsl, fca, corr, gin, sComb, sBrem, sRem, sMod] = await Promise.all([
    passo('DRE · aba Frota', () => CC.frota(), v => v.rows.length),
    passo('Dispersão de km', () => gviz(DISP_ID, 'Dispersão de km'), v => v.rows.length),
    passo('Km/L (aba Km/L do Consumo)', () => gviz(KML_ID, 'Km/L'), v => v.rows.length),
    passo('R$/L remunerado (aba R$/L)', () => gviz(KML_ID, 'R$/L'), v => v.rows.length),
    passo('FCA (histórico de causas e ações)', () => todasLinhas(sb, 'fca', 'id,unidade,vigencia,origem,fato,projeto,fato_desvio,causa,acao,responsavel,prazo,status,created_at'), v => v.length),
    passo('Gerot/Ginfo, contrato, condução (Correlações)', () => global.CorrDados.carregar(sb), v => v.FATO.uni.length + v.FATO.placa.length + v.FATO.mot.length),
    passo('Ginfo de hoje (preventivas, OS, alinhamentos, ativos)', async () => {
      const { data, error } = await sb.from('ginfo_snapshot').select('chave,data,updated_at').in('chave', ['preventivas', 'os-em-aberto', 'alinhamentos', 'ativos']);
      if (error) throw new Error(error.message); const m = {}; (data || []).forEach(r => { m[r.chave] = Array.isArray(r.data) ? r.data : []; m['_em_' + r.chave] = r.updated_at; }); return m; },
      v => ['preventivas', 'os-em-aberto', 'alinhamentos'].reduce((s, k) => s + ((v[k] || []).length), 0)),
    // Seara: as mesmas três abas, com os mesmos parâmetros da Árvore da Seara (é o que o banco serve)
    passo('Seara · aba Combustível', () => gvizP(SEARA_ID, { gid: SEARA_GID_COMB, headers: '1' }), v => v.rows.length),
    passo('Seara · Base Remunerado (Km/L e R$/L rem)', () => gvizP(SEARA_ID, { gid: SEARA_GID_REM, headers: '1' }), v => v.rows.length),
    passo('Seara · Remunerado (km por placa)', () => gvizP(SEARA_ID, { sheet: SEARA_ABA_REM, tq: 'select A, B, D', headers: '1' }), v => v.rows.length),
    passo('Seara · modelo das placas (base das preventivas)', async () => SBM ? await SBM.modelos() : {}, v => Object.keys(v || {}).length)
  ]);
  if (corr && corr.FONTES) corr.FONTES.filter(x => x.estado === 'erro').forEach(x => fontes.push({ nome: '· ' + x.nome, estado: 'erro', msg: x.msg }));
  // Carta: os meses do DRE com realizado nos últimos 13 meses
  let carta = null;
  if (dre) {
    const idx = indexaDRE(dre); const ate = idx.maxReal;
    if (ate) { const vigs = []; for (let i = 0; i < 13; i++) vigs.push(vigDeIdx(vigIdx(ate) - i));
      carta = await passo('Carta de Custos (lançamentos)', async () => { const r = await CC.lerLancamentos(sb, UNITS, vigs); if (r.erro) throw new Error(r.erro.message || String(r.erro)); return r.data; }, v => v.length); }
  }
  return { dre, disp, kml, rsl, fca: fca || [], corr, ginfo: gin || {}, carta: carta || [], prolog: {}, fontes,
    seara: { comb: sComb, brem: sBrem, rem: sRem, prevMod: sMod || {} } };
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
  indexaDRE, fatos, desvioTxt, getPacote, pacDoFato, EXCL_FCA, indexaSeara, acumuladoAno, redeFala, unidadeDoDRE, indexaDisp, indexaPreco, indexaKml, combBases, rede, redeLeitura, forcaTxt, aprendizado, temasDe, TEMAS,
  diagnostico, indicadores, indexaGinfo, EXTRA, montaCatalogo, CAT: () => CAT, resumoProlog, contexto, carregar, carregarProlog, ROT, METAS, fmtInd, placaKey };
})(typeof window !== 'undefined' ? window : globalThis);

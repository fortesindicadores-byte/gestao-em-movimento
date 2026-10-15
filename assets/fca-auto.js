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
// a aba Km/L escreve Goiânia como "AUTO SERVIÇO - GOI"; no portal é GNA
const SUF_ALIAS = { GOI: 'GNA' };
function unidadeDoNv3(nv3) {
  let suf = NK(sufixo(nv3)); suf = SUF_ALIAS[suf] || suf; const pre = prefixo(nv3);
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
// Seguros e licenças saiu do FCA (Renan, 15/10/2026: "unidade não tem ação sobre, é corporativo")
const EXCL_FCA = new Set(['RECEITA LIQUIDA', 'ICMS CREDITO PRESUMIDO', 'IPVA E LICENCIAMENTO DE VEICULOS', 'ESTORNO ICMS NAO APROVEITADO', 'ESTORNO DE ICMS NAO APROVEITADO',
  'IPVA E LICENCIAMENTO', 'SEGURO DE VEICULOS E EQUIPAMENTOS', 'SEGUROS']);
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

/* O MESMO FATO, CURTO, PARA A TABELA (Renan, 14/10/2026: "As contas poderiam ser mais
   resumidas, tipo 'Ferramentas', 'Personalização', 'Man. Veículos e Equip.'… o desvio da
   conta também poderia ter apenas uma vez o ▲ ou ▼, e o % entre parênteses"). O texto
   inteiro do FCA (desvioTxt) continua no modal e no que vai para o FCA. */
const CONTA_CURTA = {
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'Man. Veículos e Equip.', 'MANUTENCAO DE VEICULOS E EQUIP.': 'Man. Veículos e Equip.',
  'CONTRATOS DE MANUTENCAO FABRICANTE': 'Contratos Fabricante', 'MANUTENCAO DE CARROCERIAS': 'Carrocerias', 'MATERIAIS E FERRAMENTAS DE OFICINA': 'Ferramentas',
  'LAVACAO DE VEICULOS': 'Lavação', 'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'Personalização', 'PERSONALIZACAO/PADRONIZACAO': 'Personalização', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'Personalização',
  'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'Combustíveis', 'COMBUSTIVEIS': 'Combustíveis', 'FLUIDOS (ARLA)': 'Arla', 'ARLA': 'Arla',
  'PNEUS NOVOS': 'Pneus Novos', 'RECAPAGENS E OUTROS SERVICOS': 'Recapagens', 'CONSERTOS E RECAPAGENS DE PNEUS': 'Consertos e Recap.', 'PNEUS E CAMARAS': 'Pneus e Câmaras',
  'SEGURO DE VEICULOS E EQUIPAMENTOS': 'Seguro', 'SEGUROS': 'Seguro', 'IPVA E LICENCIAMENTO DE VEICULOS': 'IPVA', 'IPVA E LICENCIAMENTO': 'IPVA'
};
const contaCurta = o => CONTA_CURTA[o.ck] || o.conta;
function desvioCurto(f) {
  const ls = [`▲ R$ ${Math.round(Math.abs(f.over)).toLocaleString('pt-BR')} (${Math.round(Math.abs(f.dpct))}%)`];
  f.contas.forEach(o => { const s = o.ov > 0 ? '▲' : '▼'; ls.push(`${contaCurta(o)} ${s} ${impFmt(o.ov)}${o.p != null ? ' (' + Math.abs(o.p) + '%)' : ''}`); });
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
/* DISPERSÃO DO BANCO E BALANÇO DE MASSA (Renan, 15/10/2026: "Agora gere o FCA automático
   considerando a dispersão"). A aba Dispersão de km vai até ago/26; set/26 em diante mora
   no banco (dispersao_km + lista de placas + aba Km/L, o mesmo motor `assets/dispersao-km.js`
   do Painel KM), e entra só nos meses que a aba não tem. O km remunerado das Empurradas
   recebe o BALANÇO DE MASSA (tabela balanco_massa, o motor `assets/balanco-massa.js`, conta a
   conta e rateado no ano pela diferença do mês, igual ao Painel KM): sem ele, PIR set/26
   daria +27,7% de dispersão quando o balanço devolve o km cobrado depois (+0,4%). */
const DISP_PROJ_BANCO = { 'Rota': 'ROTA', 'Auto Serviço': 'AUTO SERVIÇO', 'Van': 'ROTA (VAN)',
  'Empurrada - 28 Palets': 'EMPURRADA', 'Empurrada - 42 Palets': 'EMPURRADA', 'Empurrada - Insumos': 'EMPURRADA' };
const CTA_ALIAS_BM = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'COMBUSTIVEIS', 'FLUIDOS (ARLA)': 'ARLA',
  'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'MANUTENCAO DE VEICULOS E EQUIP.', 'CONSERTOS E RECAPAGENS DE PNEUS': 'RECAPAGENS E OUTROS SERVICOS', 'PNEUS E CAMARAS': 'PNEUS NOVOS' };
const ctaBM = c => { const n = NK(c).replace(/\s+/g, ' ').trim(); return CTA_ALIAS_BM[n] || n; };
const vigBM = v => v.slice(5) + '/' + v.slice(0, 4);   // 'AAAA-MM' → 'MM/AAAA' (formato do motor do balanço)
function indexaDispTudo(L, dreAcc, DK, BM) {
  const acc = indexaDisp(L.disp), vigsAba = new Set(Object.keys(acc).map(k => k.split('|').pop()));
  const info = { banco: [], semKm: [], bm: null, bmAvisos: [], kmPlaca: null, placasViagem: [] };
  // 1) set/26 em diante, do banco: só os meses que a aba não tem
  const db = L.dispBanco;
  if (db && DK && (db.linhas || []).length) {
    const kmlTodas = (db.kml || []).map(r => { const m = String(r.vigencia || '').match(/^(\d{2})\/(\d{4})$/);
      return { vigencia: m ? m[2] + '-' + m[1] : '', projeto: r.projeto, placa: r.placa, km: +r.km_rodado_horas_trabalhadas || 0 }; });
    const kmlRows = kmlTodas.filter(r => r.vigencia >= DK.INICIO);
    const kmR = DK.kmRodado(db.placas || [], kmlRows);
    // km rodado por placa e mês (aba Km/L): é o realizado da placa nas linhas da aba Abertura que só
    // trazem o remunerado (set/26 em diante)
    info.kmPlaca = {}; kmR.det.forEach(d => { const k = d.vigencia + '|' + d.placa; info.kmPlaca[k] = (info.kmPlaca[k] || 0) + (+d.km || 0); });
    // REMUNERADO POR PLACA PELA PLANILHA DE VIAGENS (Renan, 15/10/2026): Rota, AS e Van; viagens × km por
    // viagem da 01-BD, realizado = km da placa na Km/L repartido pelo remunerado (a parte T1 fica fora)
    if ((db.viagens || []).length && DK.remPlacas) {
      // ago/26 não tem 01-BD no banco: o km por viagem sai do total da aba Dispersão de km (acc, km bruto)
      // mês que a aba Dispersão de km tem: o total é o dela (como no Painel KM); senão, a 01-BD do banco
      const vigsAbaV = new Set(db.viagens.map(v => v.vigencia).filter(v => vigsAba.has(v)));
      const totAba = DK.totaisT2 ? DK.totaisT2(Object.entries(acc).filter(([k, a]) => a.fonte !== 'banco' && vigsAbaV.has(k.split('|')[2]))
        .map(([k, a]) => { const [u, p, v] = k.split('|'); return { vigencia: v, unidade: u, projeto: p === 'VAN' ? 'ROTA (VAN)' : p, km_rem: a.rem, viagens: a.vgTot }; })) : [];
      const kmV = DK.VIAG_INICIO ? DK.kmRodado(db.placas || [], kmlTodas.filter(r => r.vigencia >= DK.VIAG_INICIO)) : kmR;
      info.placasViagem = DK.realPlacas(DK.remPlacas(db.viagens, [...db.linhas.filter(l => !vigsAba.has(l.vigencia)), ...totAba]).placas, kmV.det, db.placas || []);
    }
    DK.monta(db.linhas, kmR).forEach(l => {
      const vig = l.vigencia; if (!vig || vigsAba.has(vig)) return;
      const n3 = (DISP_PROJ_BANCO[l.projeto] || l.projeto) + ' - ' + l.unidade;
      const uni = unidadeDoNv3(n3); if (!uni) return;
      if (l.km_rodado == null) { info.semKm.push(uni + ' ' + l.projeto + ' ' + vig); return; }
      const k = uni + '|' + projKey(n3) + '|' + vig;
      const a = acc[k] || (acc[k] = { rem: 0, real: 0, vgTot: 0, vgRec: 0, vgNot: 0, vgMap: 0, fonte: 'banco' });
      const vp = +l.viagens_prim || 0, vr = +l.viagens_rec || 0, vn = +l.viagens_not || 0, vm = +l.viagens_mapa_aberto || 0;
      a.rem += +l.km_rem || 0; a.real += +l.km_rodado || 0; a.vgTot += vp + vr + vn + vm; a.vgRec += vr; a.vgNot += vn; a.vgMap += vm;
      if (!info.banco.includes(vig)) info.banco.push(vig);
    });
  }
  // 2) balanço de massa das Empurradas
  const bal = {};
  (L.balanco || []).forEach(x => { const m = String(x.vigencia || '').match(/^(\d{4})-(\d{2})$/); if (!m) return;
    const n3 = NK(x.projeto) + ' - ' + NK(x.unidade), uni = unidadeDoNv3(n3); if (!uni) return;
    const ch = m[2] + '/' + m[1] + '|' + uni + '|' + projKey(n3), c = ctaBM(x.conta);
    (bal[ch] = bal[ch] || {})[c] = (bal[ch][c] || 0) + (+x.valor || 0); });
  if (BM && Object.keys(bal).length) {
    const km0 = {}, kmRe = {}, remCta = {};
    Object.entries(acc).forEach(([k, a]) => { const [u, p, v] = k.split('|'); const ch = vigBM(v) + '|' + u + '|' + p; km0[ch] = a.rem; kmRe[ch] = a.real; });
    Object.values(dreAcc || {}).forEach(a => { const ch = vigBM(a.vig) + '|' + a.uni + '|' + a.proj;
      Object.values(a.contas).forEach(c => { const n = ctaBM(c.conta); (remCta[ch] = remCta[ch] || {})[n] = (remCta[ch][n] || 0) - c.rem; }); });   // custo na DRE vem negativo
    const ini = BM.inicioDoBanco(bal, '08/2026');
    const cr = BM.comRealizado(bal, kmRe);
    const nov = BM.recompoe({ bal: cr.bal, remCta, km0, inicio: ini });
    const anu = BM.porAno([nov.porChave], km0, kmRe);
    info.bm = { inicio: ini, adiados: cr.adiados };
    info.bmAvisos = [...nov.avisos, ...anu.avisos];
    Object.entries(anu.porChave).forEach(([ch, e]) => {
      const p = BM.parte(ch), [u, pr] = p.grupo.split('|'), v = p.vig.slice(3) + '-' + p.vig.slice(0, 2);
      const a = acc[u + '|' + pr + '|' + v]; if (!a || !(e.km > 0)) return;
      a.rem0 = a.rem; a.bmKm = e.km; a.bmValor = e.valor; a.rem += e.km;
    });
  }
  return { acc, info };
}
/* ABA ABERTURA (Painel KM · Placas): km remunerado × realizado POR PLACA e mês
   (Renan, 14/10/2026: "Nos contratos, as placas variáveis pode correlacionar com a
   dispersão de km das placas para explicar desvios e sugerir ações de contenção").
   Colunas por rótulo (Unidade · Mês · Projeto · Placa · Remunerado · Real · R$/km ·
   Impacto); a unidade vem em grafias ("CDD CUIABÁ", "Cuiába - MT", "Piraí -RJ") e o
   projeto como AS / VAN / ROTA / EMPURRADA. Índice: unidade|AAAA-MM → [{placa, proj,
   rem, real, delta}]. */
const AB_PROJ = { 'AS': 'AUTO SERVICO', 'VAN': 'VAN', 'ROTA (VAN)': 'VAN' };
const AB_CIDADE = Object.assign({ 'RIO DE JANEIRO': 'CGR', 'CAMBORIU': 'BLC', 'BALNEARIO': 'BLC', 'FLORIPA': 'FLP' }, CIDADE_DRE);
function abUnidade(unidade, proj) {
  const n = NK(unidade).replace(/^CDD\s+/, '').replace(/\s*-\s*[A-Z]{2}$/, '').trim();
  const base = AB_CIDADE[n] || AB_CIDADE[n.split(' ').pop()]; if (!base) return null;
  return (base === 'CBA' || base === 'MCC') ? base + ' ' + tierOfPrefix(base, proj) : base;
}
function indexaAbertura(ab) {
  const cols = (ab && ab.cols) || [], rows = (ab && ab.rows) || [];
  const c = { uni: achaCol(cols, ['unidade']), vig: achaCol(cols, ['mês', 'mes']), proj: achaCol(cols, ['projeto']), placa: achaCol(cols, ['placa']),
    rem: achaCol(cols, ['remunerado']), real: achaCol(cols, ['real']) };
  const out = {};
  if (Object.values(c).some(i => i < 0)) return out;
  rows.forEach(r => {
    const vig = vigDe(r[c.vig]), placa = placaKey(r[c.placa]); if (!vig || !placa) return;
    const pj = NK(r[c.proj]), proj = AB_PROJ[pj] || pj, uni = abUnidade(r[c.uni], proj); if (!uni) return;
    const rem = num(r[c.rem]) || 0, real = num(r[c.real]) || 0, semReal = r[c.real] == null || r[c.real] === '';
    (out[uni + '|' + vig] = out[uni + '|' + vig] || []).push({ placa, proj, rem, real, delta: real - rem, semReal, vig });
  });
  return out;
}
/* KM POR PLACA DAS ANÁLISES DO FCA (Renan, 15/10/2026: "Use essa planilha para subir remunerado por
   placa Rota, AS e Van. Deixe T1 fora de setembro e das análises do FCA"): a aba Abertura vale só nas
   linhas com o Real preenchido; no mês que tem a planilha de viagens no banco (ago/26 em diante), ela.
   T1 (Empurrada) fica fora em todos os meses. Mesmo formato do indexaAbertura. */
function indexaPlacas(ab, viag) {
  const out = {}, vigsV = new Set((viag || []).map(p => p.vigencia));   // mês com a planilha de viagens: ela manda (ago/26 em diante)
  Object.entries(indexaAbertura(ab)).forEach(([k, rs]) => { const v = rs.filter(r => !r.semReal && !vigsV.has(r.vig) && !/^EMPURR|INSUMO/.test(r.proj)); if (v.length) out[k] = v; });
  (viag || []).forEach(p => {
    if (/^Empurrada/.test(p.projeto)) return;
    const n3 = (DISP_PROJ_BANCO[p.projeto] || p.projeto) + ' - ' + p.unidade, uni = unidadeDoNv3(n3); if (!uni) return;
    const placa = placaKey(p.placa), rem = +p.km_rem || 0, real = +p.km_real || 0;
    (out[uni + '|' + p.vigencia] = out[uni + '|' + p.vigencia] || []).push({ placa, proj: projKey(n3), rem, real, delta: real - rem, vig: p.vigencia, fonte: 'viagens' });
  });
  return out;
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
  if (!b) return `na rede, não anda junto com ${nome}`;
  const forca = forcaTxt(b.r);
  return `na rede, piora junto com ${nome}${b.k ? ' no mês seguinte' : ''} (ligação ${forca}${b.q < 0.10 ? '' : ', pode ser coincidência'})`;
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
  { k: 'Deslocamento p/ abastecer', re: /deslocament[^.\n]{0,40}abastec|abastec[^.\n]{0,40}deslocament|km[^.\n]{0,25}(posto|abastec)|posto[^.\n]{0,25}(fora|longe|distan)/ },   // ANG set/26 (reunião do Renan): km rodado só para abastecer
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
      if (qs) { if (dir === 'down') { ruim = x > qs.q3; meta = qs.q3; ref = `entre as 25% piores unidades no mês`; }
                else { ruim = x < qs.q1; meta = qs.q1; ref = `entre as 25% piores unidades no mês`; } }
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
  return e && e.aval ? { ...e, txt: `nas unidades, FCAs de ${tema.toLowerCase()} em ${pac} melhoraram o mês seguinte em ${e.melhor} de ${e.aval}` } : null;
}
const MAX_CAUSAS = 3;
/* DESVIO PEQUENO NÃO PRECISA DE EXPLICAÇÃO (Renan, 15/10/2026: "2% ou 5.000. Lembrando que se for >2%,
   independente do valor nominal, aparece"): até 2% (o % que a tela mostra, arredondado) E até R$ 5 mil
   o fato continua, mas sem causa e ação. Acima de 2%, sempre explica; até 2% com mais de R$ 5 mil também. */
const TOL = { pct: 2, rs: 5000 };
const naTolerancia = f => f.over > 0 && Math.round(Math.abs(f.dpct)) <= TOL.pct && f.over <= TOL.rs;
function diagnostico(f, ctx) {
  ctx._pac = f.pac;
  const D = { causas: [], acoes: [], sinais: [], obs: [], blocos: {}, explicado: 0, avisos: [] };
  if (naTolerancia(f)) {
    D.tol = true; D.explicado = null; D.ano = acumuladoAno(f, ctx); D.historico = histDoFato(f, ctx);
    D.causaTxt = `Dentro da tolerância (até ${TOL.pct}% e até R$ ${TOL.rs.toLocaleString('pt-BR')}): sem causa e ação` + (D.ano ? '\nYTD: ' + D.ano.txt : '');
    D.acaoTxt = '';
    return D;
  }
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
  // NO MÁXIMO 3 CAUSAS E TODA AÇÃO RESPONDE A UMA DELAS (Renan, 14/10/2026: "No máximo 3 causas…
  // me preocupa ver ações nada a ver com causas"). A causa marcada fixa (o resto que as alavancas
  // não explicam, no Combustíveis) entra no lugar da última. O que sobra vira sinal; a ação só fica
  // se o tema dela é o de uma causa mostrada, e no máximo 2 por causa.
  if (D.causas.length > MAX_CAUSAS) {
    let ficam = D.causas.slice(0, MAX_CAUSAS);
    D.causas.filter(c => c.fixa && !ficam.includes(c)).forEach(c => { ficam = ficam.slice(0, MAX_CAUSAS - 1).concat([c]); });
    D.causas.filter(c => !ficam.includes(c)).forEach(c => D.sinais.push({ tema: c.tema, txt: c.txt, ind: c.ind }));
    D.causas = ficam;
  }
  // SAVING NÃO É CAUSA, É OBSERVAÇÃO (Renan, 14/10/2026: "Se não é gap não é causa, mas observação"):
  // vai num parágrafo à parte embaixo da 1ª causa; sem causa, fica nos sinais
  if (D.obs.length) { if (D.causas.length) D.causas[0].txt += D.obs.map(o => `\n\nObs.: ${o}`).join('');
    else D.obs.forEach(o => D.sinais.push({ tema: 'Observação', txt: o })); }
  const temas = new Set(D.causas.map(c => c.tema)), porTema = {};
  // até 3 por causa: uma ação por linha (a vistoria, a rota e os motoristas eram uma só, "embolada")
  D.acoes = D.acoes.filter(a => { if (!temas.has(a.tema)) return false; porTema[a.tema] = (porTema[a.tema] || 0) + 1; return porTema[a.tema] <= 3; });
  // AS PLACAS OFENSORAS FICAM EMBAIXO DA CAUSA (Renan, 14/10/2026: "as placas ofensoras, em qualquer ação,
  // ficam abaixo da sua respectiva causa"): a ação fica só com o que fazer. A causa de cada ação é a mesma
  // que a Tabela usa (a 1ª ainda livre do tema; senão, a 1ª do tema).
  // A AÇÃO LEVA O NÚMERO DA CAUSA (Renan, 15/10/2026: "As ações podem começar com o número da causa… 2.1., 2.2. e 2.3."):
  // a.num = "<causa>.<ordem dentro da causa>"
  const usadas = new Set(), nPorCausa = {}; D.causas.forEach(c => { c.ofens = []; });
  D.acoes.forEach(a => { let ci = D.causas.findIndex((c, i) => !usadas.has(i) && c.tema === a.tema); if (ci >= 0) usadas.add(ci); else ci = D.causas.findIndex(c => c.tema === a.tema);
    a.ci = ci; a.num = ci >= 0 ? `${ci + 1}.${(nPorCausa[ci] = (nPorCausa[ci] || 0) + 1)}` : null;
    if (ci >= 0) a.ofens.forEach(o => { if (!D.causas[ci].ofens.includes(o)) D.causas[ci].ofens.push(o); }); });
  // ações na ordem das causas (1.1, 1.2, 2.1…), a sem causa no fim
  D.acoes = D.acoes.map((a, i) => [a, i]).sort((x, y) => ((x[0].ci < 0 ? 99 : x[0].ci) - (y[0].ci < 0 ? 99 : y[0].ci)) || (x[1] - y[1])).map(x => x[0]);
  D.historico = histDoFato(f, ctx);
  D.causaTxt = D.causas.map((c, i) => `${i + 1}. ${c.txt}${c.ofens.length ? '\n' + c.ofens.map(o => '   - ' + o).join('\n') : ''}`).join('\n') + (D.ano ? (D.causas.length ? '\n' : '') + 'YTD: ' + D.ano.txt : '');
  D.acaoTxt = D.acoes.map((a, i) => `${a.num || i + 1}. ${a.txt}`).join('\n');
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
  // YTD DIRETO (Renan, 14/10/2026: "Texto demais no YTD. Bem direto tem que ser"): valor, % e o que fazer.
  // O período (jan → mês do fato) e o remunerado dos meses que faltam ficam no objeto, não no texto.
  if (Math.round(over) > 0) {
    if (restam > 0 && remMes > 0) { r.reducao = over / (remMes * restam) * 100;
      r.txt = r.reducao > 100 ? `▲ ${vals} · não fecha no ano`
        : `▲ ${vals} · reduzir ${r.reducao < 10 ? br(r.reducao, 1) : Math.round(r.reducao)}% até dez/${ano.slice(2)}`; }
    else r.txt = `▲ ${vals} · ano fechado`;
  } else if (Math.round(over) < 0) r.txt = `▼ ${vals} · desvio pontual`;
  else r.txt = 'no remunerado';
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
  // KM RODADO PELOS DOIS OUTROS PARÂMETROS, NÃO PELO R$/km (Renan, 14/10/2026: "Porque no R$/km se está
  // falando de km? … R$/km é aberto em Km/L e R$/L. Eu expliquei o que deveria ser explicado. Km, R$/L e
  // Km/L, não R$/km"): o km a mais vira litros pelo Km/L remunerado e R$ pelo R$/L remunerado. Sem os dois
  // remunerados no mês, fica o valor da Árvore (custo remunerado da DRE por km). A diferença DRE × bases
  // é refeita para a ponte continuar fechando no Δ custo.
  if (b && fin(b.vol) && cb && cb.kmLRem > 0 && cb.rsLRem > 0) {
    b.volDre = b.vol; b.litVol = (b.kmReal - b.kmRem) / cb.kmLRem; b.vol = b.litVol * cb.rsLRem; b.volBases = true;
    if (fin(b.preco) && fin(b.efic)) { b.dif = b.dCusto - b.vol - b.preco - b.efic; if (fin(b.difReal)) b.difRem = b.dif - b.difReal; }
  }
  D.blocos.ponte = b; D.blocos.comb = cb; D.blocos.disp = dp;
  if (!cb) D.avisos.push(seara ? 'Sem linhas na aba Combustível da Seara para este mês: eficiência e preço não foram abertos.' : 'Sem linhas na aba Km/L para este projeto e mês: eficiência e preço não foram abertos.');
  if (!dp) D.avisos.push(seara ? 'Sem km remunerado na aba Remunerado da Seara para este mês: o volume não foi calculado.' : 'Sem km da Dispersão de km para este projeto e mês: o volume não foi calculado.');
  if (cb && cb.porModelo) D.avisos.push(`${cb.porModelo} placa${cb.porModelo>1?'s':''} sem remunerado na Base Remunerado: Km/L e R$/L remunerados pela média do modelo (a mesma regra da Árvore da Seara).`);

  // Volume
  if (b && fin(b.vol) && dp && dp.rem > 0) {
    const dkm = dp.real - dp.rem, dpct = (dp.real / dp.rem - 1) * 100;
    if (b.vol >= D.minimo) {
      // TEXTO DIRETO (Renan, 14/10/2026: "Km Rodado chame de Dispersão de km… pode ser mais direto")
      const extra = dp.bmKm ? ` · km rem. com balanço de massa (+${br(dp.bmKm, 0)} km)` : (EMPURRADA(f.uni) ? ' · km rem. sem balanço de massa' : '');
      const como = b.volBases ? ` · ${rs(b.vol)}` : ` · ${rs(b.vol)} (pelo custo rem. da DRE)`;
      causa('Km / rota', `Dispersão de km: +${br(dkm, 0)} km (${sinalPct(dpct, 1)})${como}${extra}`, b.vol);
      const vg = []; if (dp.vgRec) vg.push(br(dp.vgRec, 0) + ' recs'); if (dp.vgNot) vg.push(br(dp.vgNot, 0) + ' noturnas'); if (dp.vgMap) vg.push(br(dp.vgMap, 0) + ' com mapa aberto');
      // DISPERSÃO POR PLACA (Renan, 15/10/2026): as placas que mais rodaram acima do km remunerado no mês,
      // (indexaPlacas: aba Abertura até ago/26, planilha de viagens de set/26 em diante, T1 fora); do projeto, senão da unidade
      const abT = (ctx.abertura || {})[f.uni + '|' + f.vig] || [], abP = abT.filter(r => r.proj === f.proj), abU = abP.length ? abP : abT;
      const ofPl = top(abU.filter(r => r.delta > 0), 5, r => r.delta)
        .map(r => `${r.placa} +${br(r.delta, 0)} km (${r.rem >= 500 ? sinalPct(r.delta / r.rem * 100, 0) : r.rem > 0 ? 'só ' + br(r.rem, 0) + ' km rem.' : 'sem viagem remunerada'})`);
      acao('Km / rota', `Conferir as viagens que não remuneram e a roteirização no ${painelKm}${vg.length ? ' (no mês: ' + vg.join(', ') + ' de ' + br(dp.vgTot, 0) + ' viagens)' : ''}`, ofPl);
    } else if (Math.abs(b.vol) >= D.minimo) D.obs.push(`Dispersão de km: −${br(-dkm, 0)} km (${sinalPct(dpct, 1)}) · economizou ${rs(-b.vol)}`);
  }
  // Eficiência
  if (cb && fin(cb.efic)) {
    const dk = cb.kmLRem > 0 && cb.kmLReal > 0 ? (cb.kmLReal / cb.kmLRem - 1) * 100 : null;
    if (cb.efic >= D.minimo) {
      causa('Condução', `Eficiência Km/L: ${br(cb.kmLReal, 2)} vs ${br(cb.kmLRem, 2)} rem. (${sinalPct(dk, 1)}) · +${br(cb.lit - cb.litEsp, 0)} L · ${rs(cb.efic)}`, cb.efic);
      const of = top(cb.placas.filter(p => p.rsEfic > 0 && p.placa), 5, p => p.rsEfic)
        .map(p => `${p.placa}${p.modelo ? ' (' + p.modelo + ')' : ''} ${br(p.kmlReal, 2)} km/L, ${br(p.litMais, 0)} L, ${rs(p.rsEfic)}`);
      // UMA AÇÃO POR LINHA (Renan, 14/10/2026: "3 ações escritas na mesma ação"): vistoria, rota e motoristas
      if (of.length) {
        acao('Condução', `Vistoriar as placas listadas (vazamento, injeção, filtro, pneu murcho, motor ligado parado)`, of);
        acao('Condução', `Validar o perfil de rota das placas listadas`);
        acao('Condução', `Acompanhar os motoristas que mais dirigem as placas listadas`);
      }
    } else if (Math.abs(cb.efic) >= D.minimo) D.obs.push(`Eficiência Km/L: ${br(cb.kmLReal, 2)} vs ${br(cb.kmLRem, 2)} rem. (${sinalPct(dk, 1)}) · economizou ${rs(-cb.efic)}`);
  }
  // Preço
  if (cb && fin(cb.preco)) {
    const dp2 = cb.rsLRem > 0 && cb.rsLReal > 0 ? (cb.rsLReal / cb.rsLRem - 1) * 100 : null;
    if (cb.preco >= D.minimo) {
      causa('Abastecimento / preço', `Preço R$/L: ${br(cb.rsLReal, 2)} vs ${br(cb.rsLRem, 2)} rem. (${sinalPct(dp2, 1)}) · ${rs(cb.preco)}`, cb.preco);
      const of = top(cb.placas.filter(p => p.rsPreco > 0 && p.placa), 5, p => p.rsPreco).map(p => `${p.placa} R$/L ${br(p.rsLReal, 2)} × ${br(p.pRem, 2)}, ${rs(p.rsPreco)}`);
      // TANQUE INTERNO SÓ EM FLORIANÓPOLIS E CAMPO GRANDE; MACACU TEM TANQUE E ABASTECE FORA; O RESTO É POSTO (Renan, 14/10/2026)
      const txtPr = ['FLP', 'CGR'].includes(f.uni) ? `Negociar a compra do tanque interno no preço remunerado`
        : /^MCC/.test(f.uni) ? `Abastecer no tanque interno e, fora dele, só em posto com o preço negociado`
        : `Abastecer só em posto com o preço negociado e cobrar o posto que cobrou acima`;
      acao('Abastecimento / preço', txtPr, of);
    } else if (Math.abs(cb.preco) >= D.minimo) {
      // SAVING DE PREÇO NÃO É LINHA PRÓPRIA (Renan, 14/10/2026: "Quando Preço tiver saving, fica só como
      // observação dentro da causa da eficiência. Não gera uma linha de ação"). Sem causa de eficiência,
      // vai para os sinais.
      const obs = `Preço R$/L economizou ${rs(-cb.preco)} (${br(cb.rsLReal, 2)} vs ${br(cb.rsLRem, 2)} rem.)`;
      const ef = D.causas.find(c => c.tema === 'Condução' && /^Eficiência Km\/L:/.test(c.txt));
      if (ef) ef.txt += `\n\nObs.: ${obs}`;
      else D.obs.push(obs);
    }
  }
  // Arla (faz parte do pacote: entra no que as alavancas explicam)
  const ovArla = arla.rem - arla.real;    // negativos: estouro > 0
  // ARLA SÓ VIRA CAUSA E AÇÃO ACIMA DE 10% DO DESVIO (Renan, 14/10/2026: "Arla só gere ações quando o valor
  // representar um impacto maior que 10% de todo o desvio"); abaixo disso fica nos sinais (e segue contando
  // no que as alavancas explicam).
  if (ovArla > 0) {   // sem remunerado de Arla no mês (Goiânia, set/26) o real inteiro é o estouro
    const txtArla = `Arla: real ${rs(Math.abs(arla.real))} vs rem. ${rs(Math.abs(arla.rem))}`;
    if (f.over > 0 && ovArla > 0.1 * f.over) {
      causa('Arla', txtArla, ovArla);
      acao('Arla', `Conferir a proporção Arla/diesel por placa e o preço do Arla do mês`, [], 'Abastecimento / preço');
    } else D.sinais.push({ tema: 'Arla', txt: txtArla + ` · menos de 10% do desvio, sem ação` });
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
    const medidas = [temVol && 'Dispersão de km', temEf && 'Eficiência Km/L', temPr && 'Preço R$/L'].filter(Boolean);
    const quem = medidas.length ? medidas.join(', ').replace(/, ([^,]+)$/, ' e $1') : 'As bases';
    const verbo = medidas.length === 1 ? 'explica' : 'explicam';
    const faltas = [];
    if (!temVol) faltas.push(seara ? 'aba Remunerado da Seara sem o mês' : 'Dispersão de km sem o mês');
    if (!temEf && !temPr) faltas.push(seara ? 'aba Combustível da Seara sem o mês' : 'aba Km/L sem o mês');
    else { if (!temPr) faltas.push('sem R$/L rem.'); if (!temEf) faltas.push('sem Km/L rem.'); }
    const l = [];
    if (b && fin(b.dif)) {
      if (fin(b.difReal) && Math.abs(b.difReal) >= 500) l.push(`real DRE ${b.difReal > 0 ? '+' : '−'}${rs(Math.abs(b.difReal))} vs abastecimentos`);
      if (fin(b.difRem) && Math.abs(b.difRem) >= 500) l.push(`rem. DRE ${b.difRem > 0 ? '−' : '+'}${rs(Math.abs(b.difRem))} vs bases`);
    }
    const q = quem;
    const cauda = `${l.length ? ' (' + l.join('; ') + ')' : ''}${faltas.length ? ' · ' + faltas.join('; ') : ''}`;
    // alavancas que ECONOMIZARAM (tres < 0): o desvio inteiro fica sem explicação — dizer isso, e não "0% (R$ 0 de X): Y", com Y maior que o desvio
    const txtExpl = tres < 0
      ? `${q} não ${verbo} o desvio (bases −${rs(-tres)}) · ${rs(f.over)} sem explicação${cauda}`
      : `${q} ${verbo} só ${Math.round(D.explicado * 100)}% (${rs(tres)} de ${rs(f.over)}) · ${rs(resto)} sem explicação${cauda}`;
    causa('Lançamento / contábil', txtExpl, null, { prio: -1, fixa: true });
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
      // com o DriverPro, o feedback com os motoristas de pior nota fica no lugar do "acompanhar os motoristas"
      if (cb && cb.efic > 0) D.acoes = D.acoes.filter(a => !/^Acompanhar os motoristas/.test(a.txt));
      if (cb && cb.efic > 0) acao('Condução', `Feedback de condução (faixa verde, motor ligado parado) com os motoristas de pior nota da unidade no DriverPro`, of);
    }
  }
  // COMBUSTÍVEIS SÓ TEM TRÊS ALAVANCAS (Renan, 14/10/2026: "O que checklist de saída e retorno tem a ver com
  // combustível? Combustível temos variáveis bem direcionadas: 1. Preço 2. Eficiência 3. Km rodado"): a ponte já
  // mede as três em R$; da rede entra SÓ a condução (DriverPro), que explica a eficiência. Checklist,
  // preventivas, conformidade etc. ficam na tabela da rede, nunca como causa ou ação de combustível.
  sinaisRede(f, ctx, D, ['cond_kml'], k => /^cond_/.test(k));
  // a condução fica como SINAL (a causa é a eficiência, que já traz os motoristas na ação)
  D.causas.filter(c => c.rede).forEach(c => D.sinais.push({ tema: c.tema, txt: c.txt, ind: c.ind })); D.causas = D.causas.filter(c => !c.rede);
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
    const txt = `${i.rot}: ${fmtInd(i.k, i.val)} (${i.ref})`;   // só o indicador (Renan, 14/10/2026: "na rede e ligação fraca confundem")
    if (i.rede && i.rede.sust) D.causas.push({ tema: TEMA_IND[i.k] || TEMA_GRUPO[i.g] || 'Oficina / SLA', txt, rs: null, rede: true, ind: i.k, forca: i.rede.forca, val: i.val, meta: i.meta, dir: METAS[i.k] != null ? (/osVenc|osCritica/.test(i.k) ? 'down' : 'up') : (CAT[i.k] || {}).dir });
    else if (METAS[i.k] != null || i.k === 'dispersao' || (i.rede && i.rede.forca >= 0.2 && Math.max(i.rede.n0 || 0, i.rede.n1 || 0) >= 30)) D.sinais.push({ tema: TEMA_IND[i.k] || TEMA_GRUPO[i.g] || '', txt, ind: i.k });
  });
  return ind;
}
const TEMA_GRUPO = { 'Condução (DriverPro · só Empurrada)': 'Condução', 'Frota': 'Frota / idade', 'Carta de Custos': 'Peças / fornecedor', 'FCA': 'Lançamento / contábil',
  'Combustível (bases)': 'Abastecimento / preço', 'Dispersão de km': 'Km / rota', 'Indisponibilidade': 'Oficina / SLA', 'Frota de Elite / Gerot': 'Oficina / SLA' };
const TEMA_IND = { sla: 'Oficina / SLA', mttr: 'Oficina / SLA', osVenc: 'Oficina / SLA', prev: 'Preventiva', conf: 'Conformidade (preditiva)', checkT: 'Checklist', osCritica: 'Checklist',
  mtbf: 'Corretiva / quebra', civf: 'CIVF', stVeic: 'Frota / idade', disp: 'Oficina / SLA', disp_app: 'Oficina / SLA', indisp_med: 'Oficina / SLA', dispersao: 'Km / rota', comb: 'Condução', pneus: 'Pneus',
  checkWH: 'Checklist', stEmp: 'Frota / idade', blitz: 'Segurança', viagens: 'Km / rota', km_viagem: 'Km / rota', km_real: 'Km / rota',
  cond_nota: 'Condução', cond_rpm: 'Condução', cond_idle: 'Condução', cond_acel: 'Condução', cond_baixo: 'Condução', cond_kml: 'Condução',
  frota_idade: 'Frota / idade', contr_rskm: 'Contrato', contr_faixa2: 'Contrato', dias_parado: 'Oficina / SLA', erp_kml: 'Condução', erp_preco: 'Abastecimento / preço',
  kml_gap: 'Condução', preco_gap: 'Abastecimento / preço', carta_n: 'Corretiva / quebra', carta_ticket: 'Peças / fornecedor', carta_forn: 'Peças / fornecedor', carta_novos: 'Pneus', fca_preench: 'Lançamento / contábil' };
const ACAO_IND = {
  prev: 'Zerar as preventivas vencidas (lista do Ginfo de hoje)',
  sla: 'Cobrar o SLA da oficina/fornecedor e priorizar as OS em aberto há mais tempo',
  mttr: 'Reduzir o tempo de reparo começando pelas OS abertas há mais tempo',
  osVenc: 'Fechar as OS vencidas no Ginfo',
  conf: 'Fazer o check de conformidade (preditivo, do time de frota) nas placas pendentes e tratar os itens NOK que ele apontar antes de virar quebra',
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
  contr_rskm: 'Conferir o R$/km cobrado na fatura do contrato de manutenção',
  contr_faixa2: 'Conferir as placas que passaram para a faixa 2 do contrato',
  dias_parado: 'Atacar as placas paradas há mais dias (indisponibilidade do app)',
  carta_n: 'Revisar a reincidência nas placas com mais lançamentos',
  carta_ticket: 'Auditar os orçamentos de maior valor antes de aprovar',
  carta_forn: 'Cotar com outro fornecedor',
  carta_novos: 'Recapar antes de comprar pneu novo',
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

/* variáveis de combustível que não viram causa nem sinal de Manutenções/Pneus (Renan, 14/10/2026: "Porque km/L em manutenção? Retire") */
const SEM_COMB = ['kml_gap', 'preco_gap', 'erp_kml', 'erp_preco', 'cond_kml', 'comb', 'km_l', 'preco_l'];
// vale também para qualquer variável cujo rótulo fale em Km/L ou R$/L (o catálogo cresce com o CorrDados)
const foraComb = k => !SEM_COMB.includes(k) && !/km\/l|r\$\/l/i.test((CAT[k] && CAT[k].rot) || '');

/* ── MANUTENÇÕES ──
   NO MÁXIMO 3 CAUSAS, E CADA AÇÃO RESPONDE A UMA DELAS (Renan, 14/10/2026: "No máximo 3 causas. Nem
   que una tudo da carta de custos… me preocupa ver ações nada a ver com causas aí em manutenções"):
   1) a Carta de Custos numa causa só (grupos, a placa que mais pesa, o fornecedor que concentra);
   2) o contrato de manutenção, quando a conta estourou, junto com o km das placas variáveis;
   3) o indicador da rede com a ligação mais forte, entre os que são de manutenção, com a ação dele.
   Os outros indicadores fora da meta vão para "Sinais a conferir" (modal), sem ação. */
const REDE_MANUT = ['prev', 'conf', 'sla', 'mttr', 'mtbf', 'osVenc', 'osCritica', 'checkT', 'checkWH', 'civf', 'disp', 'disp_app', 'indisp_med', 'dias_parado', 'frota_idade'];
const REDE_PNEUS = ['pneus'];
/* fica só a causa da rede mais forte entre as permitidas; as demais viram sinal */
function umaDaRede(D, permitidos) {
  // perto da meta não é causa (Renan, 14/10/2026, sobre o Checklist 94,3% × 95% ao lado do km do contrato):
  // com meta, só entra quem está a 5% dela ou mais (OS vencida/crítica: acima da meta)
  // vale também para a régua do quartil da rede (MTTR, MTBF, idade…): só quem passa dela por 5% ou mais
  const longe = c => { if (c.meta == null || !fin(c.val)) return true; if (c.ind === 'osVenc' || c.ind === 'osCritica') return c.val > c.meta;
    return c.dir === 'down' ? c.val >= c.meta * 1.05 : c.val <= c.meta * 0.95; };
  const rede = D.causas.filter(c => c.rede), fora = c => !permitidos.includes(c.ind) || !longe(c);
  const ok = rede.filter(c => !fora(c)).sort((a, b) => (b.forca || 0) - (a.forca || 0));
  const fica = ok[0] || null;
  rede.forEach(c => { if (c !== fica) D.sinais.push({ tema: c.tema, txt: c.txt, ind: c.ind }); });
  D.causas = D.causas.filter(c => !c.rede || c === fica);
  return fica;
}
function diagManut(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Manutenção');
  D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const grupo = r => r.grupo || 'sem grupo';
    const gr = somaPor(lanc.rows, grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
    const grPl = {}; lanc.rows.filter(r => ehPlaca(r.equipamento)).forEach(r => { const g = grPl[r.equipamento] || (grPl[r.equipamento] = {}); g[grupo(r)] = (g[grupo(r)] || 0) + r.valor; });
    const grupoDa = p => Object.entries(grPl[p] || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g, v]) => `${g} ${rs(v)}`).join(', ');
    D.blocos.cartaGr = gr; D.blocos.cartaPl = pl; D.blocos.cartaFo = fo; D.blocos.cartaPlGr = grPl;
    // a Carta numa causa só: grupos (o principal), a placa que mais pesa e o fornecedor que concentra
    const g3 = gr.slice(0, 3).map((g, i) => `${g.k} ${rs(g.v)} (${pct(g.v / tot * 100)}${i === 0 ? ' de ' + rs(tot) : ''})`);
    const mediaPl = pl.length ? pl.reduce((s, x) => s + x.v, 0) / pl.length : 0;
    const caras = pl.filter(p => p.v >= Math.max(2 * mediaPl, 0.15 * tot, 1000)).slice(0, 2);
    const conc = fo[0] && fo.length > 1 && fo[0].v >= 0.4 * tot ? fo[0] : null;
    causa('Carta de Custos', `Carta de Custos${lanc.nivel === 'unidade' ? ' (unidade inteira)' : ''}: ${g3.join(', ')}`
      + (caras.length ? ` · placa${caras.length > 1 ? 's' : ''}: ${caras.map(p => `${p.k} ${rs(p.v)} (${grupoDa(p.k)})`).join(', ')}` : '')
      + (conc ? ` · fornecedor: ${conc.k} ${pct(conc.v / tot * 100)}` : ''), null, { prio: 3 });
    const g1 = gr[0];
    if (g1) { const plG = somaPor(lanc.rows.filter(r => grupo(r) === g1.k && ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor);
      const lista = plG.slice(0, 4).map(x => `${x.k} ${rs(x.v)}`); caras.filter(p => !plG.slice(0, 4).some(x => x.k === p.k)).forEach(p => lista.push(`${p.k} ${rs(p.v)} (${grupoDa(p.k)})`));
      // o que fazer depende do grupo: preventiva é custo de plano (conferir o lançado), "Diversos" esconde a causa (reclassificar)
      const gk = NK(g1.k);
      const txtG = /PREVENTIV|REVISAO/.test(gk) ? `Conferir as preventivas lançadas nas placas listadas: itens fora do plano, preço acima da tabela, serviço repetido`
        : /DIVERSOS|SEM GRUPO|OUTROS/.test(gk) ? `Reclassificar os lançamentos em "${g1.k}" na Carta de Custos e conferir os de maior valor`
        : /CONTRATO/.test(gk) ? `Conferir nas placas listadas o que o contrato cobrou além da fatura de km (serviço fora do escopo)`
        : `Fazer a análise de causa raiz nas placas listadas: reincidência, garantia e cobertura do contrato`;
      acao('Carta de Custos', txtG, lista, 'Corretiva / quebra'); }
    if (conc) acao('Carta de Custos', `Auditar os orçamentos de ${conc.k} e cotar com outro fornecedor`, [], 'Peças / fornecedor');
  } else D.avisos.push('Sem lançamentos na Carta de Custos para este mês: a abertura por grupo, placa e fornecedor ficou de fora.');
  // contrato de manutenção: a fatura do mês V cobra o km de V−1 (Carta), cruzado com o km das placas variáveis
  const kmMes = vigAnt(f.vig);
  const ct = (ctx.fatoPlaca[f.uni + '|' + kmMes] || []).filter(p => fin(p.v.custo_mes));
  const cContr = f.contas.find(c => /CONTRATOS DE MANUTENCAO/.test(c.ck));
  if (ct.length && cContr && cContr.ov > 0) {
    const tc = ct.reduce((s, p) => s + p.v.custo_mes, 0), fx2 = ct.filter(p => (p.v.faixas || 0) >= 2);
    D.blocos.contrato = { tot: tc, n: ct.length, faixa2: fx2 };
    // CONTRATO VARIÁVEL × KM POR PLACA (Renan, 14/10/2026): a fatura variável é km × taxa; o km acima do
    // remunerado (aba Abertura do Painel KM, no mês do km) entra na fatura. Do projeto do fato, senão da unidade.
    const abTudo = (ctx.abertura || {})[f.uni + '|' + kmMes] || [], abProj = abTudo.filter(r => r.proj === f.proj), abUse = abProj.length ? abProj : abTudo;
    const porPl = {}; abUse.forEach(r => { porPl[r.placa] = r; });
    const cruz = ct.filter(p => p.tipo !== 'fixo' && p.v.km_mes > 0).map(p => { const a = porPl[placaKey(p.ent)]; if (!a) return null;
      const rk = fin(p.v.rskm) ? p.v.rskm : (p.v.taxa_km > 0 ? p.v.taxa_km : null);
      return { placa: p.ent, rem: a.rem, real: a.real, delta: a.delta, rk, rsDelta: rk != null ? a.delta * rk : null, custo: p.v.custo_mes }; }).filter(Boolean);
    const acima = cruz.filter(x => x.delta > 0), kmAcima = acima.reduce((s, x) => s + x.delta, 0), rsAcima = acima.reduce((s, x) => s + (x.rsDelta || 0), 0), remT = cruz.reduce((s, x) => s + x.rem, 0);
    if (cruz.length) D.blocos.contratoKm = { mes: kmMes, nivel: abProj.length ? 'projeto' : 'unidade', cruz: cruz.slice().sort((a, b) => (b.rsDelta || 0) - (a.rsDelta || 0)), acima: acima.length, kmAcima, rsAcima };
    const kmPesa = acima.length && rsAcima >= D.minimo;
    // o valor acima do remunerado já está no fato (a conta Contratos): a causa diz só o porquê
    causa('Contrato', `Contrato de manutenção: `
      + (kmPesa ? `${acima.length} de ${cruz.length} placas variáveis acima do km rem. em ${vigLbl(kmMes)} (+${br(kmAcima, 0)} km${remT > 0 ? ', ' + sinalPct(kmAcima / remT * 100, 0) : ''}) · ${rs(rsAcima)} na fatura`
        : cruz.length ? `placas variáveis no km rem.: não é km a mais` : `${ct.length} placas faturadas (${rs(tc)}) pelo km de ${vigLbl(kmMes)}`)
      + (fx2.length ? ` · ${fx2.length} na faixa 2` : ''), cContr.ov, { prio: 2 });
    if (kmPesa) { acao('Contrato', `Rever as viagens que não remuneram e a roteirização das placas listadas`,
      top(acima, 5, x => x.rsDelta || x.delta).map(x => `${x.placa} +${br(x.delta, 0)} km (${x.rem >= 500 ? sinalPct(x.delta / x.rem * 100, 0) : x.rem > 0 ? 'só ' + br(x.rem, 0) + ' km remunerados' : 'sem viagem remunerada'})${x.rsDelta != null ? ', ' + rs(x.rsDelta) : ''}`));
      acao('Contrato', `Usar placa de contrato fixo nas rotas mais longas`); }
    else acao('Contrato', `Conferir a fatura do contrato nas placas listadas: km cobrado × km rodado${fx2.length ? ' e as que foram para a faixa 2' : ''}`,
      top(ct, 5, p => p.v.custo_mes).map(p => `${p.ent} ${rs(p.v.custo_mes)}${fin(p.v.km_mes) ? ', ' + br(p.v.km_mes, 0) + ' km' : ''}${(p.v.faixas || 0) >= 2 ? ', faixa 2' : ''}`));
  }
  // o indicador da rede mais forte (só os de manutenção), com a ação DELE
  sinaisRede(f, ctx, D, SEM_COMB, k => foraComb(k) && REDE_MANUT.includes(k));
  const r = umaDaRede(D, REDE_MANUT);
  if (r) {
    const gi = ctx.ginfo[f.uni] || {}, prevV = gi.prevVencidas || [], osAb = gi.osAbertas || [];
    const tx = taxaTema(ctx, f.pac, r.tema);
    if (r.ind === 'prev' && prevV.length) D.acoes.push({ tema: r.tema, txt: `${ACAO_IND.prev}: ${prevV.length} placa${prevV.length>1?'s':''}`, ofens: prevV.slice(0, 6).map(p => `${p.placa}${fin(p.dias) ? ' (' + br(Math.abs(p.dias), 0) + 'd)' : ''}`), taxa: tx });
    else if (['sla', 'mttr', 'osVenc'].includes(r.ind) && osAb.length) {
      const velhas = osAb.slice().sort((a, b) => (b.dias != null && a.dias != null ? b.dias - a.dias : (+a.os || 0) - (+b.os || 0))).slice(0, 6);
      D.acoes.push({ tema: r.tema, txt: `${ACAO_IND[r.ind]}: ${osAb.length} OS em aberto na unidade hoje`, ofens: velhas.map(o => `OS ${o.os} ${o.placa}${o.dias != null ? ' ' + br(o.dias, 0) + 'd' : ''}${o.crit ? ' (' + o.crit + ')' : ''}`), taxa: tx });
    } else if (ACAO_IND[r.ind]) D.acoes.push({ tema: r.tema, txt: ACAO_IND[r.ind], ofens: ofensoresDe(r.ind, f, ctx), taxa: tx });
  }
  // placas paradas mais dias no mês (eventos do app de indisponibilidade): sinal, sem ação
  const par = (ctx.fatoPlaca[f.uni + '|' + f.vig] || []).filter(p => (p.v.dias_indisp || 0) >= 3);
  if (par.length) { D.blocos.paradas = par; D.sinais.push({ tema: 'Oficina / SLA', txt: `Placas paradas: ${par.length} ${par.length>1?'placas ficaram':'placa ficou'} 3 dias ou mais paradas no mês (${top(par, 4, p => p.v.dias_indisp).map(p => p.ent + ' ' + br(p.v.dias_indisp, 0) + 'd').join(', ')})` }); }
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
  f.contas.filter(c => c.ov > 0).forEach(c => causa('Lançamento / contábil', fin(c.real) ? `${c.conta}: real ${rs(c.real)} vs rem. ${rs(c.rem)}` : `${c.conta}: ${rs(c.ov)} acima do rem.`, c.ov));   // o ▲ e o % já estão no fato
  const dSeg = f.pac === 'Seguros e licenças';
  const lanc = (ctx.carta[f.uni + '|' + f.vig] || []).filter(r => r.valor > 0 && f.contas.some(c => NK(r.conta) === c.ck));
  if (lanc.length) { const fo = somaPor(lanc.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor); D.blocos.cartaFo = fo;
    acao('Lançamento / contábil', `Conferir os lançamentos da Carta de Custos nessas contas`, fo.slice(0, 4).map(x => `${x.k} ${rs(x.v)}`)); }
  if (dSeg) acao('Lançamento / contábil', `Conferir apólice e parcelas do seguro lançadas no mês (competência, placa de outra unidade, sinistro) contra o remunerado`);
  else if (f.pac === 'ICMS') acao('Lançamento / contábil', `Conferir o crédito e o estorno de ICMS do mês com o Fiscal`);
  else acao('Lançamento / contábil', `Conciliar o lançamento com a Contabilidade: conta sem pacote de custo (competência, rateio, reclassificação)`);
  D.explicado = null;
}

/* ── PNEUS ── no máximo 3 causas, cada ação respondendo a uma delas: a Carta numa causa só, o Prolog
   de hoje numa causa só (pressão, ≤ 3 mm, amplitude) e o alinhamento vencido do Ginfo; a aderência de
   aferição entra quando a rede a sustenta. */
function diagPneus(f, ctx, D, causa, acao, base) {
  const lanc = cartaDo(f, ctx, 'Pneus'); D.blocos.carta = lanc;
  const tot = lanc.rows.reduce((s, r) => s + r.valor, 0);
  if (lanc.rows.length) {
    const novos = lanc.rows.filter(r => /NOVOS/.test(NK(r.conta))).reduce((s, r) => s + r.valor, 0);
    const gr = somaPor(lanc.rows, r => r.grupo, r => r.valor), pl = somaPor(lanc.rows.filter(r => ehPlaca(r.equipamento)), r => r.equipamento, r => r.valor), fo = somaPor(lanc.rows.filter(r => r.fornecedor), r => r.fornecedor, r => r.valor);
    D.blocos.cartaGr = gr; D.blocos.cartaPl = pl; D.blocos.cartaFo = fo;
    causa('Carta de Custos', `Carta de Custos${lanc.nivel === 'unidade' ? ' (unidade inteira)' : ''}: ${rs(tot)}, ${pct(tot ? novos / tot * 100 : 0)} em pneus novos · ${gr.slice(0, 3).map(g => g.k + ' ' + rs(g.v)).join(', ')}`, null, { prio: 3 });
    if (novos > 0 && novos >= 0.5 * tot) acao('Carta de Custos', `Revisar a compra de pneus novos do mês contra as premissas da Compra de Pneus (vida 1 no dianteiro, 4ª recapagem, último eixo da carreta)`, [], 'Pneus');
    if (pl.length) acao('Carta de Custos', `Conferir troca antes da hora, desalinhamento e avaria nas placas listadas`, pl.slice(0, 5).map(x => `${x.k} ${rs(x.v)}`), 'Pneus');
  } else D.avisos.push('Sem lançamentos de Pneus na Carta de Custos para este mês.');
  // Prolog de hoje numa causa só
  const pr = ctx.prolog && ctx.prolog[f.uni];
  if (pr && pr.inst) {
    D.blocos.prolog = pr;
    const pPres = pr.presNOK / pr.inst * 100, partes = [];
    if (pr.presNOK && pPres >= 10) partes.push(`pressão fora do ideal em ${br(pr.presNOK, 0)} de ${br(pr.inst, 0)} pneus (${pct(pPres, 1)})`);
    if (pr.ate3) partes.push(`${br(pr.ate3, 0)} com ≤ 3 mm`);
    if (pr.amp) partes.push(`${br(pr.amp, 0)} com amplitude > 5 mm`);
    if (partes.length) {
      causa('Prolog', `Prolog (hoje): ${partes.join(' · ')}`, null, { prio: 2 });
      if (pr.presNOK && pPres >= 10) acao('Prolog', `Calibrar os pneus com pressão fora do ideal (pneu murcho gasta o pneu e o diesel)`, pr.topPres.map(x => `${x.placa} ${x.n} pneu${x.n>1?'s':''}`), 'Pneus');
      if (pr.janela) acao('Prolog', `Mandar para recape ${pr.janela>1?'os '+br(pr.janela, 0)+' pneus':'o pneu'} entre 3 e 4 mm antes de perder a carcaça`, pr.topJanela.map(x => `${x.placa} ${x.n}`), 'Pneus');
      else if (pr.amp) acao('Prolog', `Verificar alinhamento/geometria nas placas com amplitude de sulco acima de 5 mm`, pr.topAmp.map(x => `${x.placa} ${x.n}`), 'Pneus');
    } else if (pr.presNOK) D.sinais.push({ tema: 'Prolog', txt: `Prolog (hoje): ${br(pr.presNOK, 0)} de ${br(pr.inst, 0)} pneus instalados com pressão fora (±10% da ideal), ${pct(pPres, 1)}` });
  }
  const al = ((ctx.ginfo[f.uni] || {}).alinVencidos) || [];
  if (al.length) { causa('Alinhamento', `Alinhamento vencido (Ginfo, hoje): ${al.length} placa${al.length>1?'s':''}`, null, { prio: 1 });
    acao('Alinhamento', `Alinhar ${al.length > 1 ? 'as ' + al.length + ' placas listadas' : 'a placa listada'}`, al.slice(0, 6).map(a => a.placa), 'Pneus'); }
  sinaisRede(f, ctx, D, SEM_COMB, k => foraComb(k) && REDE_PNEUS.includes(k));
  const r = umaDaRede(D, REDE_PNEUS);
  if (r && ACAO_IND[r.ind]) D.acoes.push({ tema: r.tema, txt: ACAO_IND[r.ind], ofens: ofensoresDe(r.ind, f, ctx), taxa: taxaTema(ctx, f.pac, r.tema) });
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
  const dispT = indexaDispTudo(L, dreIdx.acc, deps.DispersaoKm || global.DispersaoKm, deps.BalancoMassa || global.BalancoMassa);
  const abertura = indexaPlacas(L.abertura, dispT.info.placasViagem);
  const ctx = { dreAcc: dreIdx.acc, maxVig: dreIdx.maxReal, todos, disp: dispT.acc, dispInfo: dispT.info, abertura, kml: kmlIdx, cat: CAT, fatoRede: FU,
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
  const [dre, disp, abert, kml, rsl, fca, corr, gin, sComb, sBrem, sRem, sMod] = await Promise.all([
    passo('DRE · aba Frota', () => CC.frota(), v => v.rows.length),
    passo('Dispersão de km', () => gviz(DISP_ID, 'Dispersão de km'), v => v.rows.length),
    passo('Dispersão · Abertura (km por placa)', () => gviz(DISP_ID, 'Abertura'), v => v.rows.length),
    passo('Km/L (aba Km/L do Consumo)', () => gviz(KML_ID, 'Km/L'), v => v.rows.length),
    passo('R$/L remunerado (aba R$/L)', () => gviz(KML_ID, 'R$/L'), v => v.rows.length),
    passo('FCA (histórico de causas e ações)', async () => {
      // OFICIAL (15/10/2026): as linhas que o automático gravou levam auto_chave. Banco sem a coluna
      // (SQL fca-auto-oficial.sql não rodado) → lê sem ela e a página avisa.
      const COLS = 'id,unidade,vigencia,origem,fato,projeto,fato_desvio,causa,acao,responsavel,prazo,status,acompanhamento,created_at';
      try { const v = await todasLinhas(sb, 'fca', COLS + ',auto_chave,auto_em'); v.autoCol = true; return v; }
      catch (e) { if (!/auto_chave|auto_em/.test(String(e && e.message))) throw e; const v = await todasLinhas(sb, 'fca', COLS); v.autoCol = false; return v; }
    }, v => v.length),
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
  // Dispersão de km do banco (set/26+) e balanço de massa: em sequência, depois do resto (tabela vazia = falha: login vencido ou mês não importado)
  const [dispBanco, viagens, balanco] = await Promise.all([
    passo('Dispersão de km do banco (set/26 em diante)', async () => {
      const [linhas, placas, kml] = await Promise.all([todasLinhas(sb, 'dispersao_km', '*'),
        todasLinhas(sb, 'dispersao_placa', 'vigencia,unidade,projeto,placa,placa_origem,km_rem'),
        todasLinhas(sb, 'sh_consumo_km_litro', 'vigencia,projeto,placa,km_rodado_horas_trabalhadas')]);
      if (!linhas.length) throw new Error('a tabela dispersao_km veio vazia'); return { linhas, placas, kml }; }, v => v.linhas.length),
    passo('Viagens por placa (remunerado por placa de Rota, AS e Van)', async () => {
      const r = await todasLinhas(sb, 'dispersao_placa_viagem', 'vigencia,unidade,projeto,placa,placa_origem,viagens_prim,viagens_rec,viagens_not');
      if (!r.length) throw new Error('a tabela dispersao_placa_viagem veio vazia'); return r; }, v => v.length),
    passo('Balanço de massa (banco)', async () => { const r = await todasLinhas(sb, 'balanco_massa', 'unidade,projeto,vigencia,conta,valor');
      if (!r.length) throw new Error('a tabela balanco_massa veio vazia'); return r; }, v => v.length)
  ]);
  if (dispBanco) dispBanco.viagens = viagens || [];
  if (corr && corr.FONTES) corr.FONTES.filter(x => x.estado === 'erro').forEach(x => fontes.push({ nome: '· ' + x.nome, estado: 'erro', msg: x.msg }));
  // Carta: os meses do DRE com realizado nos últimos 13 meses
  let carta = null;
  if (dre) {
    const idx = indexaDRE(dre); const ate = idx.maxReal;
    if (ate) { const vigs = []; for (let i = 0; i < 13; i++) vigs.push(vigDeIdx(vigIdx(ate) - i));
      carta = await passo('Carta de Custos (lançamentos)', async () => { const r = await CC.lerLancamentos(sb, UNITS, vigs); if (r.erro) throw new Error(r.erro.message || String(r.erro)); return r.data; }, v => v.length); }
  }
  return { dre, disp, dispBanco, balanco: balanco || [], abertura: abert, kml, rsl, fca: fca || [], fcaAutoCol: !!(fca && fca.autoCol), corr, ginfo: gin || {}, carta: carta || [], prolog: {}, fontes,
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

/* ══ OFICIAL — a sugestão vira linha da tabela `fca` (Renan, 15/10/2026: "Agora vamos subir como oficial, de
   setembro em diante. Anhanguera eu já fiz a reunião com eles, então ainda não considere esse mês o automático"
   → "Não quero enviar. Quero que já seja direto o oficial quando for gerar FCA custos").
   Quem grava é a GERAÇÃO do FCA de Custos (fca-preenchimento ?gen=all), logo depois de criar os fatos do mês;
   o /fca-automatico/ só lê o que está na fca. As peças moram aqui para as duas páginas usarem a MESMA conta:
   · chaveAcao: identidade da ação (tema + as 6 primeiras palavras sem números — contagens e valores mudam a cada leitura);
   · linhasDoFato: o pareamento ação → causa da Tabela (causas numeradas 1, 2, 3; ações 1.1, 1.2…);
   · causaTexto/textoCausa/textoAcao: o texto gravado (causa com as placas e o "Obs."; ação com o número);
   · GESTOR_FROTA/respDe: o dono automático (nome curto, maiúsculo);
   · planoOficial: o que vai para a fca sem gravar (é o que o teste e o relatório da geração olham);
   · aplicaOficial: grava o plano (updates um a um, inserts em lotes de 200) e devolve as linhas à lista lida. ══ */
const OFICIAL_INICIO = (global.__oficialInicio) || '2026-09';            // o teste adianta o corte (o dublê só tem fatos até ago/26)
const OFICIAL_FORA = new Set((global.__oficialFora) || ['ANG|2026-09']);   // unidade|vigência fechada à mão (a reunião da ANG)
const oficialElegivel = f => f.vig >= OFICIAL_INICIO && !OFICIAL_FORA.has(f.uni + '|' + f.vig);
const chaveAcao = a => (a.tema || '') + '|' + NK(a.txt).replace(/[0-9]+([.,][0-9]+)*/g, ' ').replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
function linhasDoFato(d) {
  const usadas = new Set(), vistos = {}, acs = [];
  d.acoes.forEach(a => { let ci = d.causas.findIndex((c, i) => !usadas.has(i) && c.tema === a.tema);
    if (ci >= 0) usadas.add(ci); else ci = d.causas.findIndex(c => c.tema === a.tema);
    let k = chaveAcao(a); vistos[k] = (vistos[k] || 0) + 1; if (vistos[k] > 1) k += '#' + vistos[k];
    acs.push({ a, k, ci }); });
  const out = [];
  d.causas.forEach((c, ci) => { const meus = acs.filter(x => x.ci === ci);
    if (!meus.length) { out.push({ a: null, c, k: null, ci, span: 1 }); return; }
    meus.forEach((x, j) => out.push({ a: x.a, c, k: x.k, ci, span: j === 0 ? meus.length : 0 })); });
  acs.filter(x => x.ci < 0).forEach(x => out.push({ a: x.a, c: null, k: x.k, ci: -1, span: 1 }));
  return out;
}
// a causa gravada leva as placas/ofensores (um por linha) antes do "Obs."
const causaTexto = c => { const i = c.txt.indexOf('\n\nObs.:'), of = (c.ofens || []).map(o => '- ' + o).join('\n');
  return i < 0 ? c.txt + (of ? '\n' + of : '') : c.txt.slice(0, i) + (of ? '\n' + of : '') + c.txt.slice(i); };
const textoCausa = l => (l.c ? (l.ci >= 0 ? (l.ci + 1) + '. ' : '') + causaTexto(l.c) : '');
const textoAcao = l => (l.a.num ? l.a.num + '. ' : '') + l.a.txt;
// GESTOR DE FROTA = DONO AUTOMÁTICO (Renan, 15/10/2026: "é para vir automático, mas com lista para selecionar caso queira trocar")
const GESTOR_FROTA = { 'CBA T1': 'ALEXANDRE SILVERIO', 'CBA T1 WH': 'ALEXANDRE SILVERIO', 'CBA T2': 'JOAO SILVA',
  'FLP': 'ANA ROCHA', 'MCC T1': 'ERICK SILVA', 'MCC T2': 'ERICK SILVA', 'ANG': 'FERNANDO MOREIRA', 'RON': 'GABRIEL BARBOSA',
  'PIR': 'JEAN GOMES', 'GRL': 'JOSE SANTOS', 'NFR': 'LUCAS TARDIM', 'BLC': 'MÁRCIO PRIETO', 'CGR': 'MICHEL OLIVEIRA',
  'PLT': 'RITCHER SALVADOR', 'GNA': 'WESLLEY VASCONCELOS' };
const gestorDe = uni => GESTOR_FROTA[String(uni || '').trim()] || '';
// primeiro + último nome, em maiúsculo: "Márcio Rodrigues Prieto" → "MÁRCIO PRIETO"
function nomeCurto(n) { const p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return ''; return (p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0]).toUpperCase(); }
const respDe = (r, uni) => String((r && r.responsavel) || '').trim() || gestorDe(uni);
// linha da fca → id do fato do automático (unidade|projeto|pacote|AAAA-MM)
const fidDe = r => String(r.unidade || '').replace(/\s*\(INATIVO\)\s*/gi, ' ').trim() + '|' + projKey(r.projeto || '') + '|' + (pacDoFato(r.fato) || '') + '|' + (vigDeLbl(r.vigencia) || '');
const tocada = r => !!(r.prazo || (r.acompanhamento && String(r.acompanhamento).trim()) || (r.status && r.status !== 'Não iniciada'));
const escritaAMao = r => !r.auto_chave && !!((r.causa && String(r.causa).trim()) || (r.acao && String(r.acao).trim()) || (r.responsavel && String(r.responsavel).trim()) || tocada(r));
/* planoOficial(fatos, fcaRows, ctx, o) → {ins, upd, pulados, semAcao, iguais}. Regras:
   · só fatos de OFICIAL_INICIO em diante, fora de OFICIAL_FORA;
   · a 1ª ação REUSA a linha vazia que o fca-preenchimento criou para o fato (update); as demais viram inserts;
   · fato com linha escrita à mão (sem auto_chave) é pulado inteiro;
   · linha já com auto_chave só muda se o texto mudou e ninguém mexeu (prazo, acompanhamento, status);
   o.diag(f) = diagnóstico memoizado (padrão: diagnostico(f, ctx)); o.resp(f, k) = dono já escolhido (padrão: o gestor). */
function planoOficial(fatos, fcaRows, ctx, o) {
  o = o || {}; const diag = o.diag || (f => diagnostico(f, ctx)); const respAt = o.resp || (() => '');
  const ins = [], upd = [], pulados = [], semAcao = [], iguais = [], agora = new Date().toISOString();
  const porFid = {}; (fcaRows || []).forEach(r => { if (String(r.origem || '').toLowerCase() !== 'custos') return; (porFid[fidDe(r)] = porFid[fidDe(r)] || []).push(r); });
  (fatos || []).filter(oficialElegivel).sort((a, b) => a.vig.localeCompare(b.vig) || a.uni.localeCompare(b.uni)).forEach(f => {
    const d = diag(f), ls = linhasDoFato(d).filter(l => l.a); if (!ls.length) { semAcao.push(f); return; }
    const rows = porFid[f.id] || [];
    if (rows.some(escritaAMao)) { pulados.push(f); return; }
    const vazias = rows.filter(r => !r.auto_chave);
    ls.forEach(l => { const causa = textoCausa(l) || null, acao = textoAcao(l), resp = String(respAt(f, l.k) || '').trim() || gestorDe(f.uni) || null;
      const ja = rows.find(r => r.auto_chave === l.k);
      if (ja) { if (tocada(ja)) { iguais.push(ja); return; }
        const u = {}; if (ja.causa !== causa) u.causa = causa; if (ja.acao !== acao) u.acao = acao; if (!ja.responsavel && resp) u.responsavel = resp;
        if (Object.keys(u).length) { u.auto_em = agora; upd.push({ id: ja.id, f, u }); } else iguais.push(ja); return; }
      const base = vazias.shift();
      const campos = { causa, acao, responsavel: resp, status: 'Não iniciada', auto_chave: l.k, auto_em: agora };
      if (base) { if (!base.fato_desvio) campos.fato_desvio = desvioTxt(f); upd.push({ id: base.id, f, u: campos }); }
      else ins.push(Object.assign({ unidade: f.uni, vigencia: f.vigLbl, origem: 'Custos', fato: f.pac, projeto: f.nv3 || f.proj || null, fato_desvio: desvioTxt(f), prazo: null, acompanhamento: null, locked: false }, campos)); });
  });
  return { ins, upd, pulados, semAcao, iguais };
}
const FCA_SEL = 'id,unidade,vigencia,origem,fato,projeto,fato_desvio,causa,acao,responsavel,prazo,status,acompanhamento,auto_chave,auto_em';
// grava o plano; fcaRows (a lista lida) recebe as linhas novas e as mudanças, para quem redesenha depois
async function aplicaOficial(sb, P, fcaRows) {
  for (const x of P.upd) { const { error } = await sb.from('fca').update(x.u).eq('id', x.id); if (error) throw new Error(error.message);
    const lf = (fcaRows || []).find(r => r.id === x.id); if (lf) Object.assign(lf, x.u); }
  for (let i = 0; i < P.ins.length; i += 200) { const lote = P.ins.slice(i, i + 200);
    const { data, error } = await sb.from('fca').insert(lote).select(FCA_SEL);
    if (error) throw new Error(error.message); if (fcaRows) (data && data.length ? data : lote).forEach(r => fcaRows.push(r)); }
  return { ins: P.ins.length, upd: P.upd.length };
}

global.FcaAuto = { UNITS, PACOTES, vigLbl, vigDeLbl, vigIdx, vigAnt, vigSeg, projKey, unidadeDoNv3, rs, br, pct, sinalPct, impFmt, NK,
  OFICIAL_INICIO, OFICIAL_FORA, oficialElegivel, chaveAcao, linhasDoFato, causaTexto, textoCausa, textoAcao, GESTOR_FROTA, gestorDe, nomeCurto, respDe, fidDe, tocada, escritaAMao, planoOficial, aplicaOficial,
  indexaDRE, fatos, desvioTxt, desvioCurto, contaCurta, getPacote, pacDoFato, EXCL_FCA, indexaSeara, acumuladoAno, redeFala, unidadeDoDRE, indexaDisp, indexaDispTudo, indexaAbertura, indexaPlacas, indexaPreco, indexaKml, combBases, rede, redeLeitura, forcaTxt, aprendizado, temasDe, TEMAS,
  diagnostico, TOL, naTolerancia, indicadores, indexaGinfo, EXTRA, montaCatalogo, CAT: () => CAT, resumoProlog, contexto, carregar, carregarProlog, ROT, METAS, fmtInd, placaKey };
})(typeof window !== 'undefined' ? window : globalThis);

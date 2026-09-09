// ============================================================
// AS BASES MANUAIS DO PORTAL — lista canônica (Renan, 09/09/2026)
//
// Toda aba de Google Sheets que algum painel lê hoje. É a mesma lista que o
// gviz-robot usa para o snapshot cru, agora com um SLUG por aba: o slug vira
// o nome da tabela no Supabase (sh_<slug>) e é por ele que os painéis vão
// pedir os dados quando saírem do gviz.
//
// Quem consome: sheets-inventario.mjs (lê e descreve), sheets-ddl.mjs (gera o
// SQL das tabelas) e sheets-robot.mjs (carrega as linhas).
//
// Regras:
//  - `slug` é estável: mudar o slug é mudar o nome da tabela.
//  - os parâmetros (sheet/gid/tq/headers) têm de bater BYTE A BYTE com os do
//    painel, senão a chave do gviz-cache não casa e o snapshot cru fica órfão.
//  - `chave` são as colunas que identificam a linha (upsert). Sem chave, a
//    carga é por posição da linha na aba, que é o certo para aba consolidada
//    que o Renan reescreve inteira.
// ============================================================

export const WB = {
  DRE:   '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8',   // DRE (Visão Financeira e cia.)
  DISP:  '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM',   // Base Dispersão de km
  KML:   '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A',   // Consumo (Km/L, R$/L)
  TERM:  '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o',   // DPO/Demarco/FCA Total/Metas
  RPM:   '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY',   // Gerot / Base RPM / ICs
  TERM2: '10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac',   // Termômetro (tiers)
  SEARA: '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE',   // Seara (3 abas)
  ELITE: '1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M',   // Frota de Elite (aba Pneus)
  MANUT: '1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k',   // Manutenção
  TEND:  '1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0',   // Tendência/Comparativos
  MTDIR: '1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8',   // Painel de Metas do Diretor
};

const t2 = (slug, sheet) => ({ slug, id: WB.TERM2, sheet });

export const BASES = [
  // ── DRE (Visão Financeira, Painel KM, Árvore, R$/km, Carta…) ──
  { slug: 'dre_frota',        id: WB.DRE,  sheet: 'Frota',            nome: 'DRE · Frota' },
  { slug: 'dre_ebitda',       id: WB.DRE,  sheet: 'EBITDA',           nome: 'DRE · EBITDA' },

  // ── Base Dispersão de km ──
  { slug: 'dispersao_km',     id: WB.DISP, sheet: 'Dispersão de km',  nome: 'Dispersão de km' },
  { slug: 'balanco_massa',    id: WB.DISP, sheet: 'Balanço de Massa', nome: 'Balanço de Massa' },

  // ── Consumo ──
  { slug: 'consumo_km_litro', id: WB.KML,  sheet: 'Km/L',             nome: 'Consumo · Km/L' },
  { slug: 'consumo_rs_litro', id: WB.KML,  sheet: 'R$/L',             nome: 'Consumo · R$/L' },

  // ── Auditorias / FCA / Metas ──
  { slug: 'dpo',              id: WB.TERM, sheet: 'DPO',              nome: 'DPO' },
  { slug: 'demarco',          id: WB.TERM, sheet: 'Demarco',          nome: 'Demarco' },
  { slug: 'fca_total',        id: WB.TERM, sheet: 'FCA Total', headers: '1', nome: 'FCA Total',
    // o /fca/ e o fca-migracao pedem a MESMA aba pelo gid — resposta byte a
    // byte igual (414 linhas, 26 colunas, 225.221 bytes, conferido 09/09/2026).
    // Uma tabela só; o apelido existe para o snapshot cru continuar casando.
    apelidos: [{ gid: '216663799' }] },
  { slug: 'metas',            id: WB.TERM, gid: '199351909',          nome: 'Metas (painel-metas)' },

  // ── Gerot / RPM ──
  { slug: 'rpm_depara',       id: WB.RPM,  sheet: 'De-Para', headers: '0', nome: 'RPM · De-Para' },
  { slug: 'rpm_base',         id: WB.RPM,  sheet: 'Base RPM', headers: '1', nome: 'Base RPM',
    // gid 0 é a MESMA aba (6.551 linhas, 13 colunas, 1.522.526 bytes)
    apelidos: [{ gid: '0' }] },
  { slug: 'rpm_ics',          id: WB.RPM,  sheet: 'Consolidado ICs',  nome: 'Consolidado ICs' },

  // ── Termômetro / MPR (mês + acumulado, por tier) ──
  t2('term_transportes_t1',      'Transportes T1'),
  t2('term_transportes_t1_acum', 'Transportes T1 - Acum'),
  t2('term_transportes_t2',      'Transportes T2'),
  t2('term_transportes_t2_acum', 'Transportes T2 - Acum'),
  t2('term_wh_t1',               'WH T1'),
  t2('term_wh_t1_acum',          'WH T1 - Acum'),
  t2('term_wh_t2',               'WH T2'),
  t2('term_wh_t2_acum',          'WH T2 - Acum'),

  // ── Seara (os parâmetros são os que o painel manda) ──
  { slug: 'seara_remunerado',  id: WB.SEARA, gid: '0', headers: '1',  nome: 'Seara · Base Remunerado' },
  { slug: 'seara_ctes',        id: WB.SEARA, gid: '1672208132', headers: '1', tq: 'select B, C, D, J', nome: 'Seara · Base CTEs' },
  { slug: 'seara_combustivel', id: WB.SEARA, gid: '1982300845', headers: '1', nome: 'Seara · Combustível' },

  // ── Frota de Elite / Manutenção / Tendência ──
  { slug: 'elite_pneus',      id: WB.ELITE, sheet: 'Pneus',           nome: 'Frota de Elite · Pneus' },
  { slug: 'manutencao',       id: WB.MANUT, gid: '0', headers: '1',   nome: 'Manutenção' },
  { slug: 'tendencia_base',   id: WB.TEND,  sheet: 'Base',            nome: 'Tendência · Base' },

  // ── Painel de Metas do Diretor (regras + um gid por indicador) ──
  { slug: 'mtdir_regras',     id: WB.MTDIR, gid: '0',                 nome: 'Metas Diretor · Regras' },
  { slug: 'mtdir_ind1_getrans',   id: WB.MTDIR, gid: '410676465',  nome: 'Metas Diretor · Getrans/Gemovi' },
  { slug: 'mtdir_ind2_ebitda',    id: WB.MTDIR, gid: '1055877945', nome: 'Metas Diretor · Resultado Operacional' },
  { slug: 'mtdir_ind3_sucessores',id: WB.MTDIR, gid: '1358349252', nome: 'Metas Diretor · Gente/Sucessores' },
  { slug: 'mtdir_ind4_ssmaq',     id: WB.MTDIR, gid: '1177655149', nome: 'Metas Diretor · SSMAQ' },
  { slug: 'mtdir_ind5_perdas',    id: WB.MTDIR, gid: '523073816',  nome: 'Metas Diretor · Perdas Operacionais' },
];

// a MESMA chave do gviz-cache.js e do gviz-robot.mjs — tem de bater byte a byte
export const chaveDe = a => `${a.id}|s=${a.sheet || ''}|g=${a.gid || ''}|q=${a.tq || ''}|h=${a.headers || ''}`;

export function urlDe(a) {
  const p = [];
  if (a.sheet) p.push('sheet=' + encodeURIComponent(a.sheet));
  if (a.gid != null) p.push('gid=' + encodeURIComponent(a.gid));
  if (a.tq) p.push('tq=' + encodeURIComponent(a.tq));
  if (a.headers != null) p.push('headers=' + a.headers);
  p.push('tqx=out:json');
  return `https://docs.google.com/spreadsheets/d/${a.id}/gviz/tq?${p.join('&')}`;
}

// baixa e devolve o objeto do gviz (com 3 tentativas, como o gviz-robot)
export async function baixa(a) {
  let txt = null;
  for (let t = 0; t < 3 && txt == null; t++) {
    try {
      const r = await fetch(urlDe(a));
      const s = r.ok ? await r.text() : '';
      if (s.includes('setResponse') && s.includes('"status":"ok"')) txt = s;
      else await new Promise(res => setTimeout(res, 1500));
    } catch (e) { await new Promise(res => setTimeout(res, 1500)); }
  }
  if (txt == null) throw new Error('resposta gviz inválida');
  const m = txt.match(/setResponse\(([\s\S]*)\)/);
  if (!m) throw new Error('corpo gviz não reconhecido');
  return { json: JSON.parse(m[1]), bytes: txt.length };
}

// ── nome da coluna no banco ───────────────────────────────────────────────
// O rótulo da aba vira um identificador do Postgres. Os símbolos que a gente
// usa muito viram palavra ("Δ"→d, "R$"→rs, "%"→pct) em vez de sumirem, senão
// "Δ (km)" e "(km)" colidiriam. Coluna sem rótulo (cabeçalho que não está na
// primeira linha) vira col_<i>, que é como os painéis já a leem: pelo índice.
const SIMB = [[/Δ/g, 'd '], [/R\$/g, 'rs '], [/%/g, ' pct '], [/º|°/g, ''], [/ª/g, '']];
export function colSlug(label, i) {
  let s = String(label || '').trim();
  if (!s) return `col_${i}`;
  for (const [re, sub] of SIMB) s = s.replace(re, sub);
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')
       .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) return `col_${i}`;
  if (/^[0-9]/.test(s)) s = 'c_' + s;
  return s.slice(0, 55);
}
// as colunas de controle da tabela — uma coluna da aba que caia num desses
// nomes ganha _orig (a aba do DRE tem "VIGÊNCIA", que viraria `vigencia` e
// brigaria com a vigência normalizada que o robô grava)
export const RESERVADAS = new Set(['linha', 'vigencia', 'atualizado_em']);
// devolve [{i, label, col, tipo, sql}] com nomes ÚNICOS (colisão ganha _<i>)
export function mapaColunas(cols) {
  const vistos = new Set();
  return cols.map((c, i) => {
    const label = String((c && c.label) || '').trim();
    let col = colSlug(label, i);
    if (RESERVADAS.has(col)) col = col + '_orig';
    if (vistos.has(col)) col = `${col}_${i}`.slice(0, 63);
    vistos.add(col);
    const tipo = (c && c.type) || 'string';
    return { i, label, col, tipo, sql: SQL_TIPO[tipo] || 'text' };
  });
}
export const SQL_TIPO = { number: 'numeric', date: 'date', datetime: 'timestamptz',
  timeofday: 'text', boolean: 'boolean', string: 'text' };

// ── valor da célula ───────────────────────────────────────────────────────
// O gviz manda data como o TEXTO "Date(2026,0,15)" (mês começa em zero) e
// hora como [h,m,s,ms]. Sem converter, a data entraria como string e o
// Postgres recusaria a coluna date.
const dRe = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/;
const p2 = n => String(n).padStart(2, '0');
export function valorDe(cel, tipo) {
  const v = cel && cel.v;
  if (v == null || v === '') return null;
  if (tipo === 'date' || tipo === 'datetime') {
    const m = typeof v === 'string' && v.match(dRe);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m;
    const dia = `${y}-${p2(+mo + 1)}-${p2(+d)}`;
    return tipo === 'date' ? dia : `${dia}T${p2(h || 0)}:${p2(mi || 0)}:${p2(s || 0)}Z`;
  }
  if (tipo === 'timeofday') return Array.isArray(v) ? v.slice(0, 3).map(p2).join(':') : String(v);
  if (tipo === 'number') return typeof v === 'number' ? v : (isFinite(+v) ? +v : null);
  if (tipo === 'boolean') return typeof v === 'boolean' ? v : /^(true|verdadeiro|sim)$/i.test(String(v));
  return String(v);
}

// ── vigência normalizada (MM/YYYY) ────────────────────────────────────────
// Cada aba escreve a vigência do seu jeito: data de verdade, "jan/26",
// "01/2026", ou um par Mês+Ano em colunas separadas. A coluna `vigencia` da
// tabela guarda sempre MM/YYYY, que é o que os painéis filtram.
const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
export function achaVigencia(mapa) {
  const acha = re => mapa.find(c => re.test(c.label));
  const v = acha(/vig[eê]nci|compet[eê]nci/i);
  if (v) return { tipo: 'coluna', vig: v };
  const mes = mapa.find(c => /^m[eê]s$/i.test(c.label.trim()));
  const ano = mapa.find(c => /^ano$/i.test(c.label.trim()));
  if (mes && ano) return { tipo: 'mes_ano', mes, ano };
  return null;
}
export function vigenciaDe(fonte, valores) {
  if (!fonte) return null;
  if (fonte.tipo === 'mes_ano') {
    const m = MESES[String(valores[fonte.mes.col] || '').slice(0, 3).toLowerCase()];
    const a = +valores[fonte.ano.col];
    return m && a ? `${p2(m)}/${a}` : null;
  }
  const raw = valores[fonte.vig.col];
  if (raw == null || raw === '') return null;
  const s = String(raw);
  let m = s.match(/^(\d{4})-(\d{2})-\d{2}/);            // date já convertida
  if (m) return `${m[2]}/${m[1]}`;
  m = s.match(/^(\d{1,2})[\/-](\d{4})$/);               // 01/2026
  if (m) return `${p2(+m[1])}/${m[2]}`;
  m = s.match(/^([a-zç]{3})[a-zç]*[\/-](\d{2,4})$/i);   // jan/26
  if (m && MESES[m[1].toLowerCase()]) {
    const a = +m[2]; return `${p2(MESES[m[1].toLowerCase()])}/${a < 100 ? 2000 + a : a}`;
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // 15/01/2026
  if (m) return `${p2(+m[2])}/${m[3]}`;
  return null;
}

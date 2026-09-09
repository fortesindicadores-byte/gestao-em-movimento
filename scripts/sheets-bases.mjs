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
  { slug: 'fca_total',        id: WB.TERM, sheet: 'FCA Total', headers: '1', nome: 'FCA Total' },
  { slug: 'fca_base',         id: WB.TERM, gid: '216663799',          nome: 'FCA (base do /fca/)' },
  { slug: 'metas',            id: WB.TERM, gid: '199351909',          nome: 'Metas (painel-metas)' },

  // ── Gerot / RPM ──
  { slug: 'gerot',            id: WB.RPM,  gid: '0',                  nome: 'Gerot' },
  { slug: 'rpm_depara',       id: WB.RPM,  sheet: 'De-Para', headers: '0', nome: 'RPM · De-Para' },
  { slug: 'rpm_base',         id: WB.RPM,  sheet: 'Base RPM', headers: '1', nome: 'Base RPM' },
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

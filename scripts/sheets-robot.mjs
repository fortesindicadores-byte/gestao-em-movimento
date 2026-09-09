// ============================================================
// ROBÔ DAS BASES MANUAIS — Sheets → Supabase (Renan, 09/09/2026:
// "sempre que essas bases manuais sejam atualizadas os dados vão para o
// banco de dados no Supabase")
//
// Para cada aba de sheets-bases.mjs: baixa, compara o md5 com o que está
// gravado e, se mudou, escreve as LINHAS TIPADAS em public.sh_<slug>.
// Diferente do gviz-robot (que guarda o texto cru para acelerar a abertura),
// aqui o dado vira tabela de verdade: dá para consultar por SQL, filtrar por
// vigência e — o motivo de tudo isto — não depende mais de a aba estar
// desfiltrada no Google na hora em que alguém abre o painel.
//
// ARMADILHA QUE ESTE ROBÔ EVITA: aba filtrada no Sheets faz o gviz devolver
// só as linhas visíveis, sem erro nenhum (foi o que zerou o Km/L). Por isso
// ele RECUSA uma carga que encolha demais: queda de mais de 40% no número de
// linhas em relação à carga anterior é tratada como aba filtrada, não como
// dado novo — grava o aviso em sh_base.erro e mantém o que já estava lá.
//
// Modos (env SHEETS_MODO):
//   run   (padrão) — carrega o que mudou
//   tudo           — recarrega todas, mesmo sem mudança
//   seco           — não grava nada, só diz o que faria (serve sem as tabelas)
// SHEETS_SO=<prefixo> limita a um subconjunto de slugs.
// ============================================================
import { createHash } from 'node:crypto';
import { BASES, baixa, chaveDe, mapaColunas, achaVigencia, vigenciaDe, valorDe } from './sheets-bases.mjs';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const MODO = process.env.SHEETS_MODO || 'run';
const SO = process.env.SHEETS_SO || '';
const SECO = MODO === 'seco';
if (!KEY && !SECO) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const LOTE = 500;                 // linhas por requisição
const QUEDA_MAX = 0.4;            // encolher mais que isto = aba filtrada

const alvos = SO ? BASES.filter(b => b.slug.startsWith(SO)) : BASES;
console.log(`Robô das bases manuais · modo ${MODO} · ${alvos.length} base(s)\n`);

// Enquanto o SQL não for rodado não há onde gravar. Isso NÃO é falha do robô:
// sair com erro pintaria de vermelho toda hora cheia até alguém rodar o SQL,
// e aí um vermelho de verdade passaria despercebido no meio.
if (!SECO) {
  const r = await fetch(`${SUPA}/rest/v1/sh_base?select=slug&limit=1`, { headers: H });
  if (r.status === 404) {
    console.log('As tabelas ainda não existem. Rode scripts/bases-manuais.sql no SQL'
      + ' Editor do Supabase (uma vez) e este robô passa a carregar sozinho a cada hora.');
    process.exit(0);
  }
}

const api = async (caminho, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${caminho}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};
// O upsert do PostgREST monta a linha ANTES de resolver o conflito, então o
// NOT NULL de sheet_id é checado mesmo quando a linha já existe: mandar só
// {slug, carregado_em} devolvia 23502 e derrubava TODA hora em que nada mudou
// (bug real, 09/09/2026 — 34 falhas de 34). Por isso a identidade da base vai
// junto em toda gravação; o resto vem em `extra`.
const identDe = b => ({
  slug: b.slug, nome: b.nome, sheet_id: b.id, aba: b.sheet || null, gid: b.gid || null,
  tq: b.tq || null, headers: b.headers || null, gviz_chave: chaveDe(b),
});
const gravaBase = async (b, extra) => api('sh_base?on_conflict=slug', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ ...identDe(b), ...extra }]),
});

let carregadas = 0, iguais = 0, falhas = 0, recusadas = 0, linhasTot = 0;

for (const b of alvos) {
  const t0 = Date.now();
  try {
    const { json, bytes } = await baixa(b);
    const hash = createHash('md5').update(JSON.stringify(json.table)).digest('hex');
    const mapa = mapaColunas(json.table.cols || []);
    const rows = json.table.rows || [];
    const fonteVig = achaVigencia(mapa);

    let antes = null;
    if (!SECO) {
      const q = await api(`sh_base?slug=eq.${b.slug}&select=hash,linhas`);
      antes = q && q[0];
    }
    if (antes && antes.hash === hash && MODO !== 'tudo') {
      await gravaBase(b, { carregado_em: new Date().toISOString(), erro: null });
      iguais++;
      console.log(`=   ${b.slug.padEnd(24)} sem mudança (${rows.length} linhas)`);
      continue;
    }
    // ── porteiro: aba filtrada no Sheets devolve menos linhas, calada ──
    if (antes && antes.linhas > 20 && rows.length < antes.linhas * (1 - QUEDA_MAX)) {
      const aviso = `carga recusada: a aba veio com ${rows.length} linha(s) contra `
        + `${antes.linhas} da carga anterior — provável filtro aplicado na aba`;
      if (!SECO) await gravaBase(b, { erro: aviso, carregado_em: new Date().toISOString() });
      recusadas++;
      console.log(`!   ${b.slug.padEnd(24)} ${aviso}`);
      continue;
    }

    // ── monta as linhas tipadas ──
    const linhas = rows.map((r, i) => {
      const o = { linha: i + 1, atualizado_em: new Date().toISOString() };
      mapa.forEach(c => { o[c.col] = valorDe(r.c && r.c[c.i], c.tipo); });
      o.vigencia = vigenciaDe(fonteVig, o);
      return o;
    });
    linhasTot += linhas.length;

    if (SECO) {
      const comVig = linhas.filter(l => l.vigencia).length;
      console.log(`~   ${b.slug.padEnd(24)} gravaria ${linhas.length} linha(s) · ${mapa.length} coluna(s)`
        + ` · ${comVig} com vigência · ${(bytes / 1024).toFixed(0)}KB`);
      if (linhas[0]) console.log(`      1ª linha: ${JSON.stringify(linhas[0]).slice(0, 220)}`);
      carregadas++;
      continue;
    }

    // ── grava: upsert por linha e depois apaga o excedente ──
    // (upsert em vez de apagar tudo e reinserir: assim a tabela nunca fica
    // vazia no meio da carga, que é quando alguém abriria o painel e veria
    // um painel zerado sem entender por quê)
    const t = `sh_${b.slug}`;
    for (let i = 0; i < linhas.length; i += LOTE) {
      await api(`${t}?on_conflict=linha`, {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(linhas.slice(i, i + LOTE)),
      });
    }
    await api(`${t}?linha=gt.${linhas.length}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

    await gravaBase(b, {
      colunas: mapa.map(c => ({ i: c.i, label: c.label, col: c.col, tipo: c.tipo })),
      linhas: linhas.length, hash, carregado_em: new Date().toISOString(), erro: null,
    });
    carregadas++;
    console.log(`ok  ${b.slug.padEnd(24)} ${linhas.length} linha(s) · ${mapa.length} coluna(s)`
      + ` · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    falhas++;
    const msg = e.message.slice(0, 300);
    console.log(`FALHOU ${b.slug.padEnd(24)} ${msg}`);
    if (!SECO) { try { await gravaBase(b, { erro: msg, carregado_em: new Date().toISOString() }); } catch (_) {} }
  }
}

console.log(`\n${carregadas} carregada(s) · ${iguais} sem mudança · ${recusadas} recusada(s)`
  + ` · ${falhas} falha(s) de ${alvos.length}`);
if (linhasTot) console.log(`${linhasTot.toLocaleString('pt-BR')} linha(s) gravada(s)`);
// falha parcial não derruba o job: o painel continua no gviz enquanto isso.
if (carregadas + iguais === 0) process.exit(1);

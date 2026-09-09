// ============================================================
// GERA O SQL DAS TABELAS DAS BASES MANUAIS (Renan, 09/09/2026)
//
// Lê o cabeçalho REAL de cada aba e escreve o CREATE TABLE de cada uma. Não
// executa nada — imprime o SQL, que o Renan cola uma vez no SQL Editor.
// Gerar em vez de escrever à mão evita o erro clássico de inventar nome e
// tipo de coluna: o tipo vem do que o próprio Sheets declara.
//
// Reexecutável de propósito: a tabela nasce só com as colunas de controle e
// TODA coluna de dado entra por "add column if not exists". Se o Renan
// acrescentar uma coluna na aba, é só rodar este gerador de novo e colar — o
// que já existe fica intacto e a nova aparece.
//
// Roda no GitHub Actions (o sandbox não alcança o docs.google).
// ============================================================
import { BASES, baixa, chaveDe, mapaColunas, achaVigencia } from './sheets-bases.mjs';

const SO = process.env.SHEETS_SO || '';
const alvos = SO ? BASES.filter(b => b.slug.startsWith(SO)) : BASES;

const L = [];
const w = s => L.push(s);

w('-- ============================================================');
w('-- BASES MANUAIS NO SUPABASE — uma tabela por aba do Sheets');
w(`-- Gerado por scripts/sheets-ddl.mjs em ${new Date().toISOString().slice(0, 10)}.`);
w('-- Rode no SQL Editor do Supabase. Pode rodar quantas vezes quiser.');
w('--');
w('-- Escrita: só a service_role (o robô). Leitura: quem está logado no');
w('-- portal, como nas outras bases.');
w('-- ============================================================');
w('');
w('-- ── controle: o que cada base é e quando foi carregada ──────────────────');
w('create table if not exists public.sh_base (');
w('  slug          text primary key,');
w('  nome          text,');
w('  sheet_id      text not null,');
w('  aba           text,');
w('  gid           text,');
w('  tq            text,');
w('  headers       text,');
w('  gviz_chave    text,');
w('  colunas       jsonb,          -- [{i,label,col,tipo}] — de-para índice ↔ coluna');
w('  linhas        integer,');
w('  hash          text,           -- md5 da resposta do gviz: igual = não recarrega');
w('  carregado_em  timestamptz,');
w('  erro          text');
w(');');
w("comment on table public.sh_base is 'Bases manuais do Sheets copiadas para o banco: uma linha por aba.';");
w('alter table public.sh_base enable row level security;');
w('drop policy if exists sh_base_sel on public.sh_base;');
w('create policy sh_base_sel on public.sh_base for select to authenticated using (true);');
w('');

let nCols = 0, falhas = 0;
for (const b of alvos) {
  try {
    const { json } = await baixa(b);
    const mapa = mapaColunas(json.table.cols || []);
    const linhas = (json.table.rows || []).length;
    const vig = achaVigencia(mapa);
    nCols += mapa.length;
    const t = `public.sh_${b.slug}`;

    w(`-- ── ${b.nome} · ${linhas} linha(s) · ${mapa.length} coluna(s)`);
    w(`--    ${chaveDe(b)}`);
    if (!vig) w('--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)');
    w(`create table if not exists ${t} (`);
    w('  linha         integer primary key,   -- posição da linha na aba');
    w('  vigencia      text,                  -- MM/YYYY normalizada');
    w('  atualizado_em timestamptz not null default now()');
    w(');');
    w(`alter table ${t}`);
    w(mapa.map(c => `  add column if not exists ${c.col.padEnd(38)} ${c.sql}`
      + (c.label ? `   -- ${c.label}` : `   -- (coluna ${c.i}, sem rótulo na aba)`)).join(',\n') + ';');
    w(`alter table ${t} enable row level security;`);
    w(`drop policy if exists sh_${b.slug}_sel on ${t};`);
    w(`create policy sh_${b.slug}_sel on ${t} for select to authenticated using (true);`);
    if (vig) w(`create index if not exists sh_${b.slug}_vig_idx on ${t} (vigencia);`);
    w('');
  } catch (e) {
    falhas++;
    w(`-- !! ${b.slug}: FALHOU ao ler a aba (${e.message}) — tabela não gerada`);
    w('');
  }
}

w('-- ---------- Conferência -------------------------------------------------');
w('-- select slug, linhas, carregado_em, erro from public.sh_base order by slug;');

console.log(L.join('\n'));
console.error(`\n${alvos.length - falhas} tabela(s) · ${nCols} coluna(s) · ${falhas} falha(s)`);
if (falhas === alvos.length) process.exit(1);

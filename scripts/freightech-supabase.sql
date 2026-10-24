-- ============================================================
-- Freightech (remuneração da Ambev) no Supabase
--
-- O robô (scripts/freightech-robot.mjs, modo carga) exporta do FT as tabelas
-- da rodada, quinzena a quinzena, e grava aqui:
--   ft_linha  — uma linha por linha do relatório (os valores na ordem das
--               colunas, em jsonb array; os nomes ficam no ft_layout)
--   ft_layout — por canal × tabela × vigência: as colunas, quantas linhas e
--               quando carregou. É também a lista do que já foi carregado.
-- Recarregar uma vigência APAGA as linhas dela e grava de novo.
-- Leitura só para admin (é remuneração); escrita só service_role (robô).
-- Reexecutável.
-- ============================================================

create table if not exists public.ft_linha (
  canal     text not null,               -- ROTA, AS, ARMAZEM, EMPURRADA, INSUMOS
  tabela    text not null,               -- nome interno da tabela no FT (Caminhao, ResumoSrtrans…)
  vigencia  text not null,               -- como o FT escreve: ROTA_2_10_2026
  linha     int  not null,               -- ordem da linha no arquivo
  ano       int,
  mes       int,
  quinzena  int,
  unidade   text,                        -- "Unidade - Nome"
  placa     text,                        -- coluna Placa, quando a tabela tem
  dados     jsonb not null,              -- valores, na ordem de ft_layout.colunas
  primary key (canal, tabela, vigencia, linha)
);
create index if not exists ft_linha_periodo on public.ft_linha (canal, tabela, ano, mes, quinzena);
create index if not exists ft_linha_unidade on public.ft_linha (canal, tabela, unidade);
create index if not exists ft_linha_placa   on public.ft_linha (placa) where placa is not null;

create table if not exists public.ft_layout (
  canal        text not null,
  tabela       text not null,
  vigencia     text not null,
  tabela_nome  text,                     -- nome na tela (Caminhão, Resumo - SRTrans…)
  ano          int,
  mes          int,
  quinzena     int,
  colunas      jsonb not null,           -- rótulos das colunas, na ordem
  linhas       int  not null default 0,
  carregado_em timestamptz not null default now(),
  primary key (canal, tabela, vigencia)
);

alter table public.ft_linha  enable row level security;
alter table public.ft_layout enable row level security;

drop policy if exists ft_linha_le  on public.ft_linha;
drop policy if exists ft_layout_le on public.ft_layout;
create policy ft_linha_le  on public.ft_linha  for select to authenticated using (public.fca_is_admin());
create policy ft_layout_le on public.ft_layout for select to authenticated using (public.fca_is_admin());

grant select on public.ft_linha, public.ft_layout to authenticated;

-- conferência
select (select count(*) from public.ft_layout) as vigencias_carregadas,
       (select count(*) from public.ft_linha)  as linhas;

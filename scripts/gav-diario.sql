-- ============================================================================
-- Foto diária dos indicadores do Gestão à Vista, por unidade (RPS de Frota,
-- Renan, 27/11/2026). Uma linha por dia × unidade; dados = valor e cor de cada
-- indicador do Ranking do Gestão à Vista, as piores placas (bottom) e as Quebras
-- Grandes da Carta. Grava o robô (scripts/gav-diario.mjs, no fim do Ginfo Robot).
-- Reexecutável. Leitura: admin ou quem tem a unidade; escrita: só o robô.
-- ============================================================================
create table if not exists public.gav_diario (
  dia        date not null,
  unidade    text not null,
  dados      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (dia, unidade)
);
alter table public.gav_diario enable row level security;
drop policy if exists gav_diario_sel on public.gav_diario;
create policy gav_diario_sel on public.gav_diario for select to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade));
grant select on public.gav_diario to authenticated;

select count(*) as linhas, min(dia) as de, max(dia) as ate from public.gav_diario;

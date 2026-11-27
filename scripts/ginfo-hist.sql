-- ============================================================================
-- Histórico diário das exportações do Ginfo (Renan, 27/11/2026: a RPS de Frota
-- mostra os indicadores DIA A DIA). O ginfo_snapshot guarda só a foto de hoje
-- (cada coleta sobrescreve); o robô passa a gravar também uma cópia por dia aqui.
-- Reexecutável. Leitura: qualquer logado (como o ginfo_snapshot); escrita: só o robô.
-- ============================================================================
create table if not exists public.ginfo_hist (
  chave      text not null,                -- a mesma do ginfo_snapshot (ex.: 'preventivas')
  dia        date not null,                -- dia da coleta, em Brasília
  data       jsonb not null,
  linhas     integer,
  updated_at timestamptz not null default now(),
  primary key (chave, dia)
);
create index if not exists ginfo_hist_dia_idx on public.ginfo_hist (dia);

alter table public.ginfo_hist enable row level security;
drop policy if exists ginfo_hist_select on public.ginfo_hist;
create policy ginfo_hist_select on public.ginfo_hist for select using (auth.uid() is not null);

-- a foto de hoje já entra como o 1º dia do histórico
insert into public.ginfo_hist (chave, dia, data, linhas, updated_at)
select chave, (updated_at at time zone 'America/Sao_Paulo')::date, data, jsonb_array_length(data), updated_at
from public.ginfo_snapshot
where jsonb_typeof(data) = 'array'
on conflict (chave, dia) do nothing;

select chave, min(dia) as de, max(dia) as ate, count(*) as dias from public.ginfo_hist group by chave order by chave;

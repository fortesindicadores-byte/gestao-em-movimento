-- ============================================================================
-- Plano de Ação da unidade (Renan, 27/11/2026: "Quero criar um Plano de ação
-- pra unidade utilizar, que o que fazem no FCA, na reunião de custos, etc,
-- consolide. Tipo nosso planner. Ele terá como origem o FCA obrigatório da
-- reunião mensal, as ações da RPS, e o que mais quiserem lançar também, de dia
-- a dia. Todas com filtro de origem").
--
-- As ações do FCA continuam na tabela fca (o Plano edita a mesma linha). Esta
-- tabela guarda o que NÃO é FCA: as ações da RPS de Frota e as do dia a dia,
-- com os mesmos campos do FCA (fato = o assunto).
-- Reexecutável. Acesso: admin ou quem tem a unidade (fca_has_unit), como o FCA.
-- ============================================================================
create table if not exists public.plano_acao (
  id             uuid primary key default gen_random_uuid(),
  unidade        text not null,                       -- código do portal, com tier (ex.: 'MCC T2')
  vigencia       text not null,                       -- 'nov/26' (mês em que a ação nasceu)
  origem         text not null,                       -- 'RPS' | 'Dia a dia'
  fato           text not null,                       -- o assunto
  projeto        text,                                -- nível 3 do DRE (ex.: 'ROTA - CGR'); null = geral
  fato_desvio    text,
  causa          text,
  acao           text,
  responsavel    text,
  prazo          date,
  status         text not null default 'Não iniciada',
  acompanhamento text,
  locked         boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.plano_acao drop constraint if exists plano_acao_origem_ck;
alter table public.plano_acao add constraint plano_acao_origem_ck check (origem in ('RPS','Dia a dia'));
alter table public.plano_acao drop constraint if exists plano_acao_status_ck;
alter table public.plano_acao add constraint plano_acao_status_ck check (status in ('Não iniciada','Em andamento','Concluída','Cancelada'));
create index if not exists plano_acao_unidade_idx on public.plano_acao (unidade, vigencia);

create or replace function public.plano_acao_touch() returns trigger
  language plpgsql set search_path = public as $$
begin
  -- remover o usuário (on delete set null) não carimba "alterado agora"
  if (to_jsonb(new) - 'created_by' - 'updated_by') = (to_jsonb(old) - 'created_by' - 'updated_by') then return new; end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists plano_acao_touch on public.plano_acao;
create trigger plano_acao_touch before update on public.plano_acao
  for each row execute function public.plano_acao_touch();

alter table public.plano_acao enable row level security;
drop policy if exists plano_acao_sel on public.plano_acao;
drop policy if exists plano_acao_ins on public.plano_acao;
drop policy if exists plano_acao_upd on public.plano_acao;
drop policy if exists plano_acao_del on public.plano_acao;
create policy plano_acao_sel on public.plano_acao for select to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy plano_acao_ins on public.plano_acao for insert to authenticated with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy plano_acao_upd on public.plano_acao for update to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade)) with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy plano_acao_del on public.plano_acao for delete to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade));
grant select, insert, update, delete on public.plano_acao to authenticated;

-- conferência
select count(*) as linhas, count(distinct unidade) as unidades from public.plano_acao;

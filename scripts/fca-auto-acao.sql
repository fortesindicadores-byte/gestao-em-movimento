-- FCA Automático: cada ação gerada vira um item com dono, prazo e status
-- (Renan, 14/10/2026: "Ideia é da dinâmica é separar para cada ação ser fechada
-- individualmente. E cada ação com um dono. Traga também as colunas prazo, status
-- e responsável").
--
-- Uma linha por fato × ação. O fato é a chave do FCA Automático
-- (UNIDADE|PROJETO|PACOTE|AAAA-MM) e a ação é identificada pelo tema + as
-- primeiras palavras do texto, sem números (o texto traz contagens e valores que
-- mudam a cada leitura). Causa e ação ficam gravadas como estavam quando alguém
-- mexeu na linha, para o histórico não depender da leitura de hoje.
--
-- Reexecutável. Leitura e escrita: admin ou quem tem a unidade (fca_has_unit,
-- nunca fca_my_unit: o perfil pode ter várias unidades).

create table if not exists public.fca_auto_acao (
  fato_id      text not null,
  chave        text not null,
  unidade      text not null,
  vigencia     text not null,            -- AAAA-MM
  pacote       text,
  projeto      text,
  tema         text,
  causa        text,
  acao         text,
  responsavel  text,
  prazo        date,
  status       text not null default 'Não iniciada',
  updated_by   uuid references auth.users(id) on delete set null,
  updated_nome text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  primary key (fato_id, chave)
);

alter table public.fca_auto_acao
  drop constraint if exists fca_auto_acao_status_chk;
alter table public.fca_auto_acao
  add constraint fca_auto_acao_status_chk
  check (status in ('Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'));

create index if not exists fca_auto_acao_uni_vig on public.fca_auto_acao (unidade, vigencia);

-- quem mexeu e quando: sai da sessão, não do que a tela manda
create or replace function public.fca_auto_acao_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;

drop trigger if exists fca_auto_acao_touch on public.fca_auto_acao;
create trigger fca_auto_acao_touch before insert or update on public.fca_auto_acao
  for each row execute function public.fca_auto_acao_touch();

alter table public.fca_auto_acao enable row level security;

drop policy if exists fca_auto_acao_select on public.fca_auto_acao;
drop policy if exists fca_auto_acao_insert on public.fca_auto_acao;
drop policy if exists fca_auto_acao_update on public.fca_auto_acao;
drop policy if exists fca_auto_acao_delete on public.fca_auto_acao;

create policy fca_auto_acao_select on public.fca_auto_acao for select to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy fca_auto_acao_insert on public.fca_auto_acao for insert to authenticated
  with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy fca_auto_acao_update on public.fca_auto_acao for update to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade))
  with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy fca_auto_acao_delete on public.fca_auto_acao for delete to authenticated
  using (public.fca_is_admin());

grant select, insert, update, delete on public.fca_auto_acao to authenticated;

-- conferência
select count(*) as linhas, count(distinct fato_id) as fatos from public.fca_auto_acao;

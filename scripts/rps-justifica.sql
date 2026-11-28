-- RPS de Frota: justificativa de indicador sem ação (Renan, 28/11/2026:
-- "nem sempre será gerada ação. Deve ter uma opção de o gestor abrir, e isentar
-- aquele indicador com uma observação").
-- Uma linha por unidade × indicador × dia. A célula do Gerot fica cinza, com a
-- observação na dica, e a justificativa aparece no slide "Ações da semana".
-- Reexecutável.

create table if not exists public.rps_justifica (
  id          bigserial primary key,
  unidade     text not null,
  indicador   text not null,
  dia         date not null,
  obs         text not null check (length(trim(obs)) > 0),
  autor       text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (unidade, indicador, dia)
);

alter table public.rps_justifica enable row level security;

drop policy if exists rps_justifica_sel on public.rps_justifica;
drop policy if exists rps_justifica_ins on public.rps_justifica;
drop policy if exists rps_justifica_upd on public.rps_justifica;
drop policy if exists rps_justifica_del on public.rps_justifica;
create policy rps_justifica_sel on public.rps_justifica for select to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy rps_justifica_ins on public.rps_justifica for insert to authenticated with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy rps_justifica_upd on public.rps_justifica for update to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade)) with check (public.fca_is_admin() or public.fca_has_unit(unidade));
create policy rps_justifica_del on public.rps_justifica for delete to authenticated using (public.fca_is_admin() or public.fca_has_unit(unidade));

create or replace function public.rps_justifica_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.obs is not distinct from old.obs and new.autor is not distinct from old.autor then return new; end if;
  new.updated_at := now();
  if auth.uid() is not null then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;
drop trigger if exists rps_justifica_touch on public.rps_justifica;
create trigger rps_justifica_touch before insert or update on public.rps_justifica for each row execute function public.rps_justifica_touch();

grant select, insert, update, delete on public.rps_justifica to authenticated;
grant usage, select on sequence public.rps_justifica_id_seq to authenticated;

-- Apresentações (/apresentacoes/): o modelo de cada unidade
-- (ordem dos blocos, blocos desligados, título e recados do gestor).
-- Uma linha por unidade. Reexecutável.
create table if not exists public.apres_modelo (
  unidade     text primary key,
  modelo      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create or replace function public.apres_modelo_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

drop trigger if exists apres_modelo_touch on public.apres_modelo;
create trigger apres_modelo_touch before insert or update on public.apres_modelo
  for each row execute function public.apres_modelo_touch();

alter table public.apres_modelo enable row level security;

drop policy if exists apres_modelo_sel on public.apres_modelo;
create policy apres_modelo_sel on public.apres_modelo for select to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade));

drop policy if exists apres_modelo_ins on public.apres_modelo;
create policy apres_modelo_ins on public.apres_modelo for insert to authenticated
  with check (public.fca_is_admin() or public.fca_has_unit(unidade));

drop policy if exists apres_modelo_upd on public.apres_modelo;
create policy apres_modelo_upd on public.apres_modelo for update to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade))
  with check (public.fca_is_admin() or public.fca_has_unit(unidade));

grant select, insert, update on public.apres_modelo to authenticated;

-- conferência
select count(*) as modelos from public.apres_modelo;

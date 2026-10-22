-- Cargos no Gerenciar Acessos (Renan, 22/10/2026: "Além de Gestor de Frota, coloque Gestor de Unidade,
-- Gestor Regional e Gestor" → "Adicionar Gestor de Área também"). Todos têm o MESMO acesso do Gestor
-- de Frota (as unidades marcadas); a coluna só diz o cargo. Vazio = Gestor de Frota. Time Frota continua
-- também no time_frota. Reexecutável: a regra é recriada com a lista atual de cargos.

alter table public.fca_profiles add column if not exists cargo text;

alter table public.fca_profiles drop constraint if exists fca_profiles_cargo_ck;
alter table public.fca_profiles add constraint fca_profiles_cargo_ck
  check (cargo is null or cargo in ('Gestor de Unidade', 'Gestor de Área', 'Gestor Regional', 'Gestor', 'Time Frota'));

-- quem já era Time Frota ganha o cargo
update public.fca_profiles set cargo = 'Time Frota'
 where coalesce(time_frota, false) and cargo is null;

-- conferência: cadastros por cargo
select coalesce(cargo, 'Gestor de Frota') as cargo, count(*) as perfis
  from public.fca_profiles where not coalesce(is_admin, false)
 group by 1 order by 1;

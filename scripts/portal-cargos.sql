-- Cargos no Gerenciar Acessos (Renan, 22/10/2026: "Além de Gestor de Frota, coloque Gestor de Unidade,
-- Gestor Regional e Gestor"). Todos têm o MESMO acesso do Gestor de Frota (as unidades marcadas);
-- a coluna só diz o cargo. Vazio = Gestor de Frota. Time Frota continua também no time_frota. Reexecutável.

alter table public.fca_profiles add column if not exists cargo text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fca_profiles_cargo_ck') then
    alter table public.fca_profiles add constraint fca_profiles_cargo_ck
      check (cargo is null or cargo in ('Gestor de Unidade', 'Gestor Regional', 'Gestor', 'Time Frota'));
  end if;
end $$;

-- quem já era Time Frota ganha o cargo
update public.fca_profiles set cargo = 'Time Frota'
 where coalesce(time_frota, false) and cargo is null;

-- conferência: cadastros por cargo
select coalesce(cargo, 'Gestor de Frota') as cargo, count(*) as perfis
  from public.fca_profiles where not coalesce(is_admin, false)
 group by 1 order by 1;

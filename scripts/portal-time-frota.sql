-- Perfil "Time Frota" no Gerenciar Acessos + nomes sempre em maiúsculo (Renan, 16/10/2026).
-- Time Frota tem o MESMO acesso do Gestor de Frota (as unidades marcadas); a
-- coluna só diferencia quem é do time de frota. Reexecutável.

alter table public.fca_profiles add column if not exists time_frota boolean not null default false;

-- nomes em maiúsculo, com espaço simples (cadastro, perfil e o nome do login)
update public.user_approvals
   set name = upper(regexp_replace(btrim(name), '\s+', ' ', 'g'))
 where name is not null and name <> upper(regexp_replace(btrim(name), '\s+', ' ', 'g'));

update public.fca_profiles
   set nome = upper(regexp_replace(btrim(nome), '\s+', ' ', 'g'))
 where nome is not null and nome <> upper(regexp_replace(btrim(nome), '\s+', ' ', 'g'));

update auth.users
   set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{name}',
         to_jsonb(upper(regexp_replace(btrim(raw_user_meta_data->>'name'), '\s+', ' ', 'g'))))
 where coalesce(raw_user_meta_data->>'name', '') <> ''
   and raw_user_meta_data->>'name' <> upper(regexp_replace(btrim(raw_user_meta_data->>'name'), '\s+', ' ', 'g'));

-- conferência: quantos nomes ainda têm minúscula (deve dar 0, 0, 0)
select (select count(*) from public.user_approvals where name <> upper(name))                     as aprovacoes,
       (select count(*) from public.fca_profiles  where nome <> upper(nome))                      as perfis,
       (select count(*) from auth.users where raw_user_meta_data->>'name' <> upper(raw_user_meta_data->>'name')) as logins;

-- E-mails sempre em minúsculo e sem espaço (Renan, 16/10/2026). Reexecutável.
-- O login do Supabase já compara o e-mail em minúsculo; aqui é para o cadastro
-- e a lista do Gerenciar Acessos ficarem iguais ao login.

update public.user_approvals
   set email = lower(btrim(email))
 where email is not null and email <> lower(btrim(email));

-- conta de login: só quando não há outra conta com o mesmo e-mail em minúsculo
update auth.users u
   set email = lower(btrim(u.email))
 where u.email is not null and u.email <> lower(btrim(u.email))
   and not exists (select 1 from auth.users o where o.id <> u.id and lower(btrim(o.email)) = lower(btrim(u.email)));

update auth.identities i
   set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(lower(btrim(i.identity_data->>'email'))))
 where i.provider = 'email' and coalesce(i.identity_data->>'email', '') <> ''
   and i.identity_data->>'email' <> lower(btrim(i.identity_data->>'email'));

-- conferência (deve dar 0, 0, 0)
select (select count(*) from public.user_approvals where email <> lower(email))                         as aprovacoes,
       (select count(*) from auth.users where email <> lower(email))                                     as logins,
       (select count(*) from auth.identities where identity_data->>'email' <> lower(identity_data->>'email')) as identidades;

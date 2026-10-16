-- ════════════════════════════════════════════════════════════════════════════
--  ADMINISTRADOR MASTER — acesso total aos cadastros do portal (Renan, 16/10/2026)
--  "Crie uma função para que eu consiga liberar cadastro, gerar senha nova etc.
--   Alterar qualquer coisa nos cadastros."
--
--  O Master faz, pelo Gerenciar Acessos, o que antes só dava para fazer no
--  painel do Supabase: liberar cadastro (confirma o e-mail e aprova), gerar ou
--  definir senha, trocar e-mail/nome/telefone/situação/unidades/admin, criar
--  usuário sem depender do e-mail, encerrar as sessões e dar ou tirar o Master.
--
--  Tudo passa por funções SECURITY DEFINER que conferem portal_is_master()
--  antes de mexer; a tabela portal_master não tem policy (ninguém a lê direto)
--  e cada ação fica em portal_master_log (a senha nunca é gravada).
--  Reexecutável.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.portal_master (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
alter table public.portal_master enable row level security;

create table if not exists public.portal_master_log (
  id         bigserial primary key,
  em         timestamptz not null default now(),
  quem       uuid references auth.users(id) on delete set null,
  alvo       uuid,
  alvo_email text,
  acao       text not null,
  detalhe    jsonb
);
alter table public.portal_master_log enable row level security;

-- o 1º Master é o Renan
insert into public.portal_master (user_id)
select id from auth.users where lower(email) = 'fortesindicadores@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.portal_is_master() returns boolean
  language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.portal_master where user_id = auth.uid());
$$;

drop policy if exists portal_master_log_sel on public.portal_master_log;
create policy portal_master_log_sel on public.portal_master_log
  for select to authenticated using (public.portal_is_master());

-- ── peças internas ──────────────────────────────────────────────────────────
create or replace function public._master_exige() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.portal_is_master() then
    raise exception 'Só o administrador Master pode fazer isso.';
  end if;
end $$;

create or replace function public._master_log(p_acao text, p_alvo uuid, p_detalhe jsonb default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.portal_master_log (quem, alvo, alvo_email, acao, detalhe)
  values (auth.uid(), p_alvo, (select email from auth.users where id = p_alvo), p_acao, p_detalhe);
end $$;

-- senha legível: 10 caracteres sem os que se confundem (0/O, 1/l/I)
create or replace function public._master_gera_senha() returns text
  language plpgsql volatile security definer set search_path = public as $$
declare
  alf text := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  b bytea := extensions.gen_random_bytes(10);
  s text := '';
begin
  for i in 0..9 loop
    s := s || substr(alf, (get_byte(b, i) % length(alf)) + 1, 1);
  end loop;
  return s;
end $$;

create or replace function public._master_hash(p_senha text) returns text
  language sql volatile security definer set search_path = public as $$
  select extensions.crypt(p_senha, extensions.gen_salt('bf', 10));
$$;

-- garante a linha de aprovação (o cadastro que travou no e-mail nunca a criou)
create or replace function public._master_aprovacao(p_user uuid, p_status text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_approvals (user_id, email, name, phone, status)
  select u.id, u.email, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'phone', p_status
    from auth.users u where u.id = p_user
  on conflict (user_id) do update set status = excluded.status;
end $$;

-- ── o que a tela chama ──────────────────────────────────────────────────────
create or replace function public.master_eu() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.portal_is_master();
$$;

-- todos os cadastros de auth.users, inclusive os que nunca chegaram à aprovação
create or replace function public.master_usuarios() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._master_exige();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.criado desc), '[]'::jsonb) into r from (
    select u.id, u.email, u.created_at as criado, u.email_confirmed_at as confirmado,
           u.last_sign_in_at as ultimo,
           coalesce(a.name,  u.raw_user_meta_data->>'name')  as nome,
           coalesce(a.phone, u.raw_user_meta_data->>'phone') as telefone,
           a.status, p.unidade, coalesce(p.is_admin, false) as admin,
           (m.user_id is not null) as master,
           coalesce((u.raw_app_meta_data->>'troca_senha')::boolean, false) as troca_senha,
           (select count(*) from auth.sessions s where s.user_id = u.id) as sessoes
      from auth.users u
      left join public.user_approvals a on a.user_id = u.id
      left join public.fca_profiles   p on p.user_id = u.id
      left join public.portal_master  m on m.user_id = u.id
  ) x;
  return r;
end $$;

-- liberar cadastro: e-mail confirmado + aprovado
create or replace function public.master_liberar(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform public._master_exige();
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
   where id = p_user;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  perform public._master_aprovacao(p_user, 'approved');
  perform public._master_log('liberar', p_user);
end $$;

-- senha nova: sem p_senha gera uma; devolve a senha UMA vez para mostrar na tela.
-- É PROVISÓRIA (Renan, 16/10/2026: "eu libero senha nova e ele só refaz a senha"):
-- marca troca_senha no app_metadata e, no 1º acesso, o hub pede a senha dele.
create or replace function public.master_senha(p_user uuid, p_senha text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare s text := nullif(btrim(coalesce(p_senha, '')), '');
begin
  perform public._master_exige();
  if s is null then s := public._master_gera_senha(); end if;
  if length(s) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  update auth.users
     set encrypted_password = public._master_hash(s),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"troca_senha":true}'::jsonb,
         updated_at = now()
   where id = p_user;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  perform public._master_log('senha', p_user, jsonb_build_object('gerada', p_senha is null or btrim(p_senha) = ''));
  return s;
end $$;

-- alterar o cadastro: só as chaves que vierem em p_dados mudam
--   email · nome · telefone · status (pending|approved|blocked) · unidade · admin
create or replace function public.master_altera(p_user uuid, p_dados jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  em text; nm text; tel text; st text; uni text; adm boolean;
begin
  perform public._master_exige();
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Usuário não encontrado.';
  end if;

  if p_dados ? 'email' then
    em := lower(btrim(p_dados->>'email'));
    if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
    if exists (select 1 from auth.users where lower(email) = em and id <> p_user) then
      raise exception 'Já existe um cadastro com o e-mail %.', em;
    end if;
    update auth.users set email = em, email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', em),
           updated_at = now()
     where id = p_user;
    update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', em),
           updated_at = now()
     where user_id = p_user and provider = 'email';
    update public.user_approvals set email = em where user_id = p_user;
  end if;

  if p_dados ? 'nome' then
    nm := upper(regexp_replace(btrim(p_dados->>'nome'), '\s+', ' ', 'g'));
    if nm = '' then raise exception 'O nome não pode ficar vazio.'; end if;
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', nm),
           updated_at = now() where id = p_user;
    update public.user_approvals set name = nm where user_id = p_user;
    update public.fca_profiles   set nome = nm where user_id = p_user;
  end if;

  if p_dados ? 'telefone' then
    tel := nullif(btrim(p_dados->>'telefone'), '');
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', tel),
           updated_at = now() where id = p_user;
    update public.user_approvals set phone = tel where user_id = p_user;
  end if;

  if p_dados ? 'status' then
    st := p_dados->>'status';
    if st not in ('pending', 'approved', 'blocked') then raise exception 'Situação inválida: %.', st; end if;
    perform public._master_aprovacao(p_user, st);
  end if;

  if p_dados ? 'unidade' or p_dados ? 'admin' then
    adm := case when p_dados ? 'admin' then coalesce((p_dados->>'admin')::boolean, false)
                else coalesce((select is_admin from public.fca_profiles where user_id = p_user), false) end;
    uni := case when p_dados ? 'unidade'
                then nullif(regexp_replace(upper(btrim(p_dados->>'unidade')), '\s*,\s*', ',', 'g'), '')
                else (select unidade from public.fca_profiles where user_id = p_user) end;
    if adm then uni := null; end if;
    insert into public.fca_profiles (user_id, nome, unidade, is_admin)
    values (p_user, (select coalesce(a.name, u.raw_user_meta_data->>'name') from auth.users u
                       left join public.user_approvals a on a.user_id = u.id where u.id = p_user), uni, adm)
    on conflict (user_id) do update set unidade = excluded.unidade, is_admin = excluded.is_admin;
  end if;

  perform public._master_log('altera', p_user, p_dados);
end $$;

-- criar usuário sem e-mail: já confirmado e aprovado; devolve {id, senha}
create or replace function public.master_criar(p_email text, p_nome text, p_telefone text default null,
                                               p_senha text default null, p_unidade text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := gen_random_uuid();
  em  text := lower(btrim(coalesce(p_email, '')));
  nm  text := upper(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'));
  tel text := nullif(btrim(coalesce(p_telefone, '')), '');
  s   text := nullif(btrim(coalesce(p_senha, '')), '');
begin
  perform public._master_exige();
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if nm = '' then raise exception 'Informe o nome.'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then
    raise exception 'Já existe um cadastro com o e-mail %. Use Editar nele.', em;
  end if;
  if s is null then s := public._master_gera_senha(); end if;
  if length(s) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
          public._master_hash(s), now(),
          '{"provider":"email","providers":["email"],"troca_senha":true}'::jsonb,
          jsonb_build_object('name', nm, 'phone', tel, 'email', em, 'email_verified', true),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  insert into public.user_approvals (user_id, email, name, phone, status)
  values (uid, em, nm, tel, 'approved')
  on conflict (user_id) do update set status = 'approved', email = excluded.email, name = excluded.name, phone = excluded.phone;

  if nullif(btrim(coalesce(p_unidade, '')), '') is not null then
    insert into public.fca_profiles (user_id, nome, unidade, is_admin)
    values (uid, nm, regexp_replace(upper(btrim(p_unidade)), '\s*,\s*', ',', 'g'), false)
    on conflict (user_id) do update set unidade = excluded.unidade;
  end if;

  perform public._master_log('criar', uid, jsonb_build_object('email', em, 'nome', nm, 'unidade', p_unidade));
  return jsonb_build_object('id', uid, 'senha', s);
end $$;

-- a própria pessoa, depois de criar a senha dela, tira a marca de senha provisória
create or replace function public.portal_senha_trocada() returns void
  language sql security definer set search_path = public as $$
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'troca_senha', updated_at = now()
   where id = auth.uid();
$$;

-- derrubar as sessões abertas (o usuário precisa entrar de novo)
create or replace function public.master_encerrar(p_user uuid) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public._master_exige();
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  delete from auth.refresh_tokens where user_id = p_user::text;
  perform public._master_log('encerrar', p_user, jsonb_build_object('sessoes', n));
  return n;
end $$;

-- dar ou tirar o Master (ninguém tira o próprio)
create or replace function public.master_define(p_user uuid, p_master boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform public._master_exige();
  if p_master then
    insert into public.portal_master (user_id, criado_por) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    if p_user = auth.uid() then raise exception 'Você não pode tirar o seu próprio Master.'; end if;
    if exists (select 1 from auth.users where id = p_user and lower(email) = 'fortesindicadores@gmail.com') then
      raise exception 'O Master do dono do portal não pode ser retirado.';
    end if;
    delete from public.portal_master where user_id = p_user;
  end if;
  perform public._master_log(case when p_master then 'master_on' else 'master_off' end, p_user);
end $$;

-- só usuário logado chama; as peças internas não ficam expostas na API
revoke all on function public._master_exige()                       from public, anon, authenticated;
revoke all on function public._master_log(text, uuid, jsonb)        from public, anon, authenticated;
revoke all on function public._master_gera_senha()                  from public, anon, authenticated;
revoke all on function public._master_hash(text)                    from public, anon, authenticated;
revoke all on function public._master_aprovacao(uuid, text)         from public, anon, authenticated;
revoke all on function public.master_usuarios()                     from public, anon;
revoke all on function public.master_liberar(uuid)                  from public, anon;
revoke all on function public.master_senha(uuid, text)              from public, anon;
revoke all on function public.master_altera(uuid, jsonb)            from public, anon;
revoke all on function public.master_criar(text, text, text, text, text) from public, anon;
revoke all on function public.master_encerrar(uuid)                 from public, anon;
revoke all on function public.master_define(uuid, boolean)          from public, anon;
revoke all on function public.portal_senha_trocada()                from public, anon;
grant execute on function public.portal_senha_trocada()             to authenticated;
grant execute on function public.master_eu()                        to authenticated;
grant execute on function public.master_usuarios()                  to authenticated;
grant execute on function public.master_liberar(uuid)               to authenticated;
grant execute on function public.master_senha(uuid, text)           to authenticated;
grant execute on function public.master_altera(uuid, jsonb)         to authenticated;
grant execute on function public.master_criar(text, text, text, text, text) to authenticated;
grant execute on function public.master_encerrar(uuid)              to authenticated;
grant execute on function public.master_define(uuid, boolean)       to authenticated;

-- conferência: quem é Master
select u.email, m.criado_em from public.portal_master m join auth.users u on u.id = m.user_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- Assistente do portal Gestão em Movimento (Renan, 28/10/2026 — etapa 3 do Freightech,
-- ampliado no mesmo dia para o banco inteiro)
--
-- A IA roda numa Edge Function do Supabase (supabase/functions/assistente-ft),
-- que guarda a chave do modelo. Para responder, ela consulta o banco por UMA
-- porta só: public.assistente_sql(p_sql), que
--   · aceita só SELECT/WITH (uma consulta por vez);
--   · roda como o papel assistente_leitor, que lê todo o schema public menos o
--     que é sensível (nada de auth.users, portal_segredo, master, CPF, e-mail,
--     telefone, senha, token, nome de motorista…);
--   · trava a transação em somente leitura (escrita nenhuma passa, nem por função);
--   · devolve no máximo 2.000 linhas.
-- Só a service_role (a Edge Function) chama a porta.
-- public.ft_obj(canal, tabela, ano, mes) devolve as linhas do FT já com o nome
-- de cada coluna (o ft_linha guarda os valores na ordem do ft_layout).
-- assistente_log guarda cada pergunta (tokens, custo, consultas), sem a chave.
-- Reexecutável.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · o papel de leitura -----------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'assistente_leitor') then
    create role assistente_leitor nologin;
  end if;
end $$;
grant assistente_leitor to postgres;          -- para o postgres poder passar a função a ele
grant usage on schema public to assistente_leitor;

-- 2 · o que ele pode ler: TODO o schema public, menos o que é sensível ----------
-- (Renan, 28/10/2026: "Quero para tudo do Gestão em Movimento. Banco, tudo".)
-- Fora por inteiro: segredos, master, cadastro e log de acesso de usuários,
-- senha e sessão do app do motorista, o próprio log do assistente.
-- Fora por coluna, em toda tabela: CPF, CNH, e-mail, telefone, senha, token,
-- segredo, chave de API, arquivo em base64/bytea, nome de motorista; e o nome
-- nas tabelas do DriverPro (ce_*). Tabela com coluna cortada ganha grant por
-- coluna; a sem nada sensível ganha a tabela inteira.
-- Rode de novo quando entrar tabela nova: ela passa a ser lida também.
do $$
declare
  r record; cols text; cortadas int; n_tab int := 0; n_parc int := 0;
  fora text[] := array['portal_segredo','portal_master','portal_master_log','user_approvals',
    'access_log','ce_app_acesso','ce_app_sessao','ce_app_senha_zerada','ce_app_log',
    'ce_app_admins','assistente_log','fca_resp_depara'];
  sens text := '(cpf|cnh|e_?mail|telefone|fone|phone|celular|whatsapp|senha|password|token|secret|segredo|api_?key|base64|motorista)';
begin
  -- limpa o que foi liberado antes (inclusive a lista da 1ª versão)
  for r in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p','v','m') loop
    execute format('revoke all on public.%I from assistente_leitor', r.relname);
  end loop;
  for r in select c.oid, c.relname, c.relkind, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p','v','m') and not c.relispartition
              and c.relname <> all(fora) loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into cols
      from pg_attribute a
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
       and a.attname !~* sens
       and a.atttypid <> 'bytea'::regtype
       and not (r.relname like 'ce\_%' and a.attname ~* '^nome')
       and not (r.relname = 'ft_book' and a.attname = 'blocos');
    select count(*) into cortadas from pg_attribute a
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
       and (a.attname ~* sens or a.atttypid = 'bytea'::regtype
            or (r.relname like 'ce\_%' and a.attname ~* '^nome')
            or (r.relname = 'ft_book' and a.attname = 'blocos'));
    if cols is null then continue; end if;
    begin
      if cortadas = 0 then
        execute format('grant select on public.%I to assistente_leitor', r.relname); n_tab := n_tab + 1;
      else
        execute format('grant select (%s) on public.%I to assistente_leitor', cols, r.relname); n_parc := n_parc + 1;
      end if;
      if r.relkind in ('r','p') and r.relrowsecurity then
        execute format('drop policy if exists assistente_le on public.%I', r.relname);
        execute format('create policy assistente_le on public.%I for select to assistente_leitor using (true)', r.relname);
      end if;
    exception when others then
      raise notice 'assistente: % ficou de fora (%)', r.relname, sqlerrm;
    end;
  end loop;
  raise notice 'assistente: % tabela(s) inteiras e % com colunas cortadas', n_tab, n_parc;
end $$;

-- 3 · FT com o nome das colunas ----------------------------------------------
create or replace function public.ft_obj(p_canal text, p_tabela text, p_ano int default null, p_mes int default null)
returns table (vigencia text, ano int, mes int, quinzena int, unidade text, placa text, r jsonb)
language sql stable set search_path = public as $$
  select l.vigencia, l.ano, l.mes, l.quinzena, l.unidade, l.placa,
         (select jsonb_object_agg(c.nome, l.dados -> (c.i::int - 1))
            from jsonb_array_elements_text(y.colunas) with ordinality as c(nome, i))
    from public.ft_linha l
    join public.ft_layout y on y.canal = l.canal and y.tabela = l.tabela and y.vigencia = l.vigencia
   where l.canal = p_canal and l.tabela = p_tabela
     and (p_ano is null or l.ano = p_ano)
     and (p_mes is null or l.mes = p_mes)
$$;
revoke all on function public.ft_obj(text, text, int, int) from public, anon, authenticated;
grant execute on function public.ft_obj(text, text, int, int) to assistente_leitor, service_role;

-- 4 · a porta de consulta ----------------------------------------------------
-- o dono precisa de CREATE no schema só para receber a função
grant create on schema public to assistente_leitor;

create or replace function public.assistente_sql(p_sql text, p_max int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q   text := btrim(coalesce(p_sql, ''));
  lim int  := greatest(1, least(coalesce(p_max, 500), 2000));
  res jsonb;
  n   int;
begin
  q := regexp_replace(q, ';\s*$', '');
  if q = '' then raise exception 'consulta vazia'; end if;
  if position(';' in q) > 0 then raise exception 'uma consulta por vez (sem ";")'; end if;
  if q !~* '^\s*(select|with)\s' then raise exception 'só SELECT ou WITH'; end if;
  perform set_config('transaction_read_only', 'on', true);
  -- dentro de um subselect, WITH com INSERT/UPDATE/DELETE não é aceito pelo Postgres
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb), count(*) from (select * from (%s) s limit %s) t', q, lim + 1)
    into res, n;
  if n > lim then res := res - lim; end if;
  return jsonb_build_object('linhas', n - (case when n > lim then 1 else 0 end), 'truncado', n > lim, 'dados', res);
end $$;

alter function public.assistente_sql(text, int) owner to assistente_leitor;
revoke create on schema public from assistente_leitor;
revoke all on function public.assistente_sql(text, int) from public, anon, authenticated;
grant execute on function public.assistente_sql(text, int) to service_role;

-- 5 · registro das perguntas -------------------------------------------------
create table if not exists public.assistente_log (
  id          bigint generated always as identity primary key,
  em          timestamptz not null default now(),
  email       text,
  pergunta    text,
  consultas   int,
  modelo      text,
  tok_in      int,
  tok_out     int,
  tok_cache   int,
  custo_usd   numeric,
  segundos    numeric,
  erro        text
);
alter table public.assistente_log enable row level security;
drop policy if exists assistente_log_le on public.assistente_log;
create policy assistente_log_le on public.assistente_log for select to authenticated using (public.fca_is_admin());
grant select on public.assistente_log to authenticated;

-- conferência: o que o assistente enxerga (inteira = todas as colunas; parcial = sem as sensíveis)
select c.relname as tabela,
       case when has_table_privilege('assistente_leitor', c.oid, 'select') then 'inteira' else 'parcial' end as acesso
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','p','v','m')
   and (has_table_privilege('assistente_leitor', c.oid, 'select')
        or has_any_column_privilege('assistente_leitor', c.oid, 'select'))
 order by 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- Assistente do painel Remuneração (Renan, 28/10/2026 — etapa 3 do Freightech)
--
-- A IA roda numa Edge Function do Supabase (supabase/functions/assistente-ft),
-- que guarda a chave do modelo. Para responder, ela consulta o banco por UMA
-- porta só: public.assistente_sql(p_sql), que
--   · aceita só SELECT/WITH (uma consulta por vez);
--   · roda como o papel assistente_leitor, que só enxerga as tabelas da lista
--     abaixo (nada de auth.users, portal_segredo, perfis, CPF…);
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

-- 2 · o que ele pode ler (só as tabelas que existirem) ------------------------
do $$
declare
  t text;
  lista text[] := array[
    -- Freightech
    'ft_rem_mes','ft_linha','ft_layout',
    -- DRE e operação
    'sh_dre_frota','sh_dre_receita','sh_dre_ebitda','sh_dispersao_km','sh_balanco_massa',
    'sh_dispersao_abertura','dispersao_km','dispersao_placa','dispersao_placa_viagem','balanco_massa',
    -- combustível
    'ca_consumo_km_litro','ca_consumo_rs_litro','ca_consumo_rem_modelo',
    'sh_consumo_km_litro','sh_consumo_rs_litro','sh_consumo_rem_modelo',
    'erp_abastecimentos','abast_api','comb_anomalia','comb_correcao',
    -- manutenção, contratos, carta
    'sh_manutencao','vw_contrato_km','carta_custos',
    -- metadados das bases do Sheets (rótulos das colunas)
    'sh_base','consumo_auto_base','abast_api_base'
  ];
begin
  foreach t in array lista loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('grant select on public.%I to assistente_leitor', t);
    if exists (select 1 from pg_class where oid = ('public.'||t)::regclass and relrowsecurity) then
      execute format('drop policy if exists assistente_le on public.%I', t);
      execute format('create policy assistente_le on public.%I for select to assistente_leitor using (true)', t);
    end if;
  end loop;
  -- visões materializadas não têm RLS
  if to_regclass('public.custo_vigencia_mv') is not null then
    execute 'grant select on public.custo_vigencia_mv to assistente_leitor';
  end if;
  -- Book do Operador: sem as imagens embutidas (blocos) e sem o arquivo (base64)
  if to_regclass('public.ft_book') is not null then
    execute 'revoke select on public.ft_book from assistente_leitor';
    execute 'grant select (uuid, titulo, subtitulo, categoria, categorias, ordem, texto, n_blocos, n_anexos, criado_em, atualizado_em) on public.ft_book to assistente_leitor';
    execute 'drop policy if exists assistente_le on public.ft_book';
    execute 'create policy assistente_le on public.ft_book for select to assistente_leitor using (true)';
  end if;
  if to_regclass('public.ft_book_anexo') is not null then
    execute 'revoke select on public.ft_book_anexo from assistente_leitor';
    execute 'grant select (id_storage, registro, bloco, nome, tipo, tamanho, texto) on public.ft_book_anexo to assistente_leitor';
    execute 'drop policy if exists assistente_le on public.ft_book_anexo';
    execute 'create policy assistente_le on public.ft_book_anexo for select to assistente_leitor using (true)';
  end if;
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

-- conferência: as tabelas que o assistente enxerga
select table_name from information_schema.role_table_grants
 where grantee = 'assistente_leitor' and table_schema = 'public'
union
select table_name from information_schema.column_privileges
 where grantee = 'assistente_leitor' and table_schema = 'public'
order by 1;

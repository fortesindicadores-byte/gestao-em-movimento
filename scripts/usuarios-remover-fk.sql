-- ════════════════════════════════════════════════════════════════════════════
-- REMOVER USUÁRIO SEM PERDER O QUE ELE LANÇOU (Renan, 07/10/2026)
--
-- Sintoma: "Erro ao remover: update or delete on table "users" violates foreign
-- key constraint "indisponibilidade_created_by_fkey"". As colunas de autoria
-- (created_by / updated_by / user_id) apontam para auth.users SEM regra de
-- exclusão, então o banco recusa apagar quem já lançou alguma coisa.
--
-- O conserto: toda chave de autoria em public que aponta para auth.users e
-- aceita nulo passa a ser ON DELETE SET NULL — o lançamento fica, só perde o
-- vínculo com a conta apagada. As que já são CASCADE (fca_profiles,
-- user_approvals…) ficam como estão.
--
-- Cuidado com os gatilhos de carimbo: o SET NULL é um UPDATE na tabela, e o
-- indisp_touch / ativos_manual_touch / fca_touch carimbariam "alterado agora,
-- pelo admin" em todo lançamento da pessoa removida. Eles passam a ignorar a
-- linha quando o ÚNICO campo que mudou é a coluna de autoria.
--
-- Reexecutável.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 · gatilhos de carimbo não reescrevem a auditoria quando só a autoria mudou
create or replace function public.indisp_touch() returns trigger
  language plpgsql as $$
begin
  if (to_jsonb(new) - 'created_by' - 'updated_by') = (to_jsonb(old) - 'created_by' - 'updated_by') then
    return new;   -- usuário removido: o banco só zerou a autoria
  end if;
  new.updated_at = now(); new.updated_by = auth.uid(); return new;
end $$;

create or replace function public.ativos_manual_touch() returns trigger
  language plpgsql as $$
begin
  if (to_jsonb(new) - 'created_by' - 'updated_by') = (to_jsonb(old) - 'created_by' - 'updated_by') then
    return new;
  end if;
  new.updated_at = now(); new.updated_by = auth.uid(); return new;
end $$;

create or replace function public.fca_touch() returns trigger
  language plpgsql as $$
begin
  if (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  new.updated_at = now(); return new;
end $$;

-- 2 · toda chave para auth.users em public sem regra de exclusão vira SET NULL
do $$
declare r record; cols text;
begin
  for r in
    select c.oid, c.conname, c.conrelid::regclass as tabela, c.conkey
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and n.nspname = 'public'
       and c.confdeltype in ('a','r')            -- no action / restrict
  loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
      from pg_attribute a where a.attrelid = r.tabela and a.attnum = any(r.conkey);
    if exists (select 1 from pg_attribute a
                where a.attrelid = r.tabela and a.attnum = any(r.conkey) and a.attnotnull) then
      raise notice 'NÃO MEXIDA (coluna obrigatória): %.% (%)', r.tabela, r.conname, cols;
      continue;
    end if;
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
    execute format('alter table %s add constraint %I foreign key (%s) references auth.users(id) on delete set null',
                   r.tabela, r.conname, cols);
    raise notice 'SET NULL: %.% (%)', r.tabela, r.conname, cols;
  end loop;
end $$;

-- 3 · conferência: como ficou cada chave que aponta para auth.users
select c.conrelid::regclass as tabela, c.conname as chave,
       case c.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL'
                          when 'a' then 'NO ACTION (bloqueia)' when 'r' then 'RESTRICT (bloqueia)'
                          else c.confdeltype::text end as ao_excluir_usuario
  from pg_constraint c
 where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
 order by 3, 1;

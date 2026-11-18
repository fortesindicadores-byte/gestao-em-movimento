-- =============================================================================
-- Lista de responsáveis da caixa da ação do FCA (Renan, 18/11/2026:
-- "Porque o Adolfo não aparece").
--
-- A RLS do fca_profiles deixa quem não é admin ler SÓ o próprio cadastro, então
-- na página da unidade a lista do Responsável saía só com o gestor de frota (e a
-- própria pessoa). Esta função devolve, para quem está logado, os cadastros que
-- dividem uma unidade com ele (pela sigla: MCC T1 e MCC T2 são MCC) + os admins.
-- Admin recebe todos. Só nome, unidade e is_admin; nada de e-mail ou telefone.
-- Reexecutável.
-- =============================================================================
create or replace function public.fca_perfis_resp()
returns table(nome text, unidade text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  with eu as (
    select distinct split_part(trim(x), ' ', 1) as b
      from public.fca_profiles p,
           unnest(string_to_array(coalesce(p.unidade, ''), ',')) as x
     where p.user_id = auth.uid() and trim(x) <> ''
  )
  select p.nome, p.unidade, coalesce(p.is_admin, false)
    from public.fca_profiles p
   where auth.uid() is not null
     and coalesce(trim(p.nome), '') <> ''
     and (public.fca_is_admin()
          or coalesce(p.is_admin, false)
          or exists (select 1
                       from unnest(string_to_array(coalesce(p.unidade, ''), ',')) as y
                       join eu on eu.b = split_part(trim(y), ' ', 1)));
$$;
revoke all on function public.fca_perfis_resp() from public, anon;
grant execute on function public.fca_perfis_resp() to authenticated;

-- Conferência (troque o nome): o cadastro da pessoa e a unidade dela
-- select a.name, a.status, p.nome as nome_fca, p.unidade, p.is_admin
--   from public.user_approvals a left join public.fca_profiles p on p.user_id = a.user_id
--  where a.name ilike '%adolfo%' or p.nome ilike '%adolfo%';

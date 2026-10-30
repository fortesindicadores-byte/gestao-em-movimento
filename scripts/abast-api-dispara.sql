-- ─────────────────────────────────────────────────────────────────────────────
-- Abast API Robot às 05:00 BRT — quem dá a hora é o pg_cron, não o GitHub
--
-- Renan, 30/10/2026: "sempre rode às 05:00 da manhã". O agendador do GitHub
-- atrasa o cron do YAML em horas (mesmo caso do Ginfo e do Freightech), e o
-- workflow_dispatch é imediato. O cron do abast-api-robot.yml fica como rede
-- de segurança: rodar duas vezes não estraga nada (upsert pela chave
-- sistema + id_origem + item).
--
-- ARMADILHA: o workflow_dispatch aplica os DEFAULTS dos inputs, e o `modo` do
-- abast-api-robot.yml tem default "ensaio" (não grava). O corpo TEM de mandar
-- modo = gravar e dias = 10.
--
-- Pré-requisito: o token do GitHub em public.portal_segredo (chave
-- 'github_token'), instalado por scripts/pedido-instantaneo.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.abast_api_dispara()
returns void language plpgsql security definer
set search_path = public, net, extensions as $$
declare tok text;
begin
  select valor into tok from public.portal_segredo where chave = 'github_token';
  if tok is null or length(tok) < 30 then
    raise notice 'sem token em portal_segredo - nada disparado';
    return;
  end if;
  perform net.http_post(
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/abast-api-robot.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    -- gravar explícito: o default do workflow é "ensaio", que não grava nada
    body    := jsonb_build_object('ref', 'main',
                                  'inputs', jsonb_build_object('modo', 'gravar', 'dias', '10')));
end $$;

-- 05:00 BRT = 08:00 UTC
select cron.unschedule('abast-api-5h') where exists (select 1 from cron.job where jobname = 'abast-api-5h');
select cron.schedule('abast-api-5h', '0 8 * * *', $$select public.abast_api_dispara()$$);

-- Conferir:
--   select jobname, schedule, active from cron.job where jobname = 'abast-api-5h';
--   select * from net._http_response order by id desc limit 5;   -- 204 = disparou

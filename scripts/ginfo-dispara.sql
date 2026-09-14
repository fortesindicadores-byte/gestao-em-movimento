-- ─────────────────────────────────────────────────────────────────────────────
-- Robô Ginfo às 04:00 BRT — quem dá a hora é o pg_cron, não o GitHub
--
-- O cron declarado no ginfo-robot.yml (0 10 * * * UTC = 07:00 BRT) chegava
-- ~4 h atrasado: o agendador do GitHub nem criava o run na hora (created_at ==
-- run_started_at). O workflow_dispatch é imediato, então o pg_cron passa a ser
-- o relógio e o cron do YAML fica como rede de segurança.
--
-- ARMADILHA: o workflow_dispatch aplica os DEFAULTS dos inputs, e o `modo` do
-- ginfo-robot.yml tem default "login" (só tira print, não coleta). O corpo TEM
-- de mandar inputs.modo = "run".
--
-- Pré-requisito: o token do GitHub em public.portal_segredo (chave
-- 'github_token'), instalado por scripts/pedido-instantaneo.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.ginfo_dispara()
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
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/ginfo-robot.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    -- modo RUN explícito: o default do workflow é "login", que só tira print
    body    := jsonb_build_object('ref', 'main',
                                  'inputs', jsonb_build_object('modo', 'run')));
end $$;

-- 04:00 BRT = 07:00 UTC
select cron.unschedule('ginfo-4h') where exists (select 1 from cron.job where jobname = 'ginfo-4h');
select cron.schedule('ginfo-4h', '0 7 * * *', $$select public.ginfo_dispara()$$);

-- Conferir:
--   select jobname, schedule, active from cron.job where jobname = 'ginfo-4h';
--   select * from net._http_response order by id desc limit 5;

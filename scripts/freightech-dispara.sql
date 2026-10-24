-- ─────────────────────────────────────────────────────────────────────────────
-- Robô Freightech às 05:00 BRT — quem dá a hora é o pg_cron, não o GitHub
--
-- Mesmo desenho do ginfo-dispara.sql: o agendador do GitHub atrasa o cron do
-- YAML em horas (o run nem é criado na hora), e o Renan começa às 7h. O
-- workflow_dispatch é imediato, então o pg_cron passa a ser o relógio e o cron
-- do freightech-robot.yml fica como rede de segurança (rodar duas vezes no dia
-- não estraga nada: a carga das 4 últimas quinzenas é idempotente).
--
-- ARMADILHA: o workflow_dispatch aplica os DEFAULTS dos inputs, e o `modo` do
-- freightech-robot.yml tem default "sonda" (só entra e olha, não grava). O
-- corpo TEM de mandar modo = carga, ultimas = 4 e refazer = 1.
--
-- Pré-requisito: o token do GitHub em public.portal_segredo (chave
-- 'github_token'), instalado por scripts/pedido-instantaneo.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.freightech_dispara()
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
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/freightech-robot.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    -- carga explícita: o default do workflow é "sonda", que não grava nada
    body    := jsonb_build_object('ref', 'main',
                                  'inputs', jsonb_build_object(
                                    'modo', 'carga', 'ultimas', '4', 'refazer', '1')));
end $$;

-- 05:00 BRT = 08:00 UTC (depois do Ginfo das 04:00; contas e grupos separados)
select cron.unschedule('freightech-5h') where exists (select 1 from cron.job where jobname = 'freightech-5h');
select cron.schedule('freightech-5h', '0 8 * * *', $$select public.freightech_dispara()$$);

-- Conferir:
--   select jobname, schedule, active from cron.job where jobname = 'freightech-5h';
--   select * from net._http_response order by id desc limit 5;   -- 204 = disparou

-- ─────────────────────────────────────────────────────────────────────────────
-- Sheets Robot de hora em hora — quem dá a hora é o pg_cron, não o GitHub
--
-- O cron do sheets-robot.yml é ':25 de cada hora', mas o agendador do GitHub
-- atrasa e pula: em 18–19/11/2026 rodou 22:05, 03:39 e 13:27 UTC (6 a 10 h de
-- buraco). O Renan atualizou a aba Ebitda das Metas da Diretoria e o painel
-- ficou com o número antigo a tarde inteira. O workflow_dispatch é imediato,
-- então o pg_cron vira o relógio e o cron do YAML fica como rede (rodar duas
-- vezes não estraga nada: só grava aba que mudou).
--
-- Pré-requisito: o token do GitHub em public.portal_segredo (chave
-- 'github_token'), instalado por scripts/pedido-instantaneo.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.sheets_dispara()
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
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/sheets-robot.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    body    := jsonb_build_object('ref', 'main',
                                  'inputs', jsonb_build_object('modo', 'run')));
end $$;

-- :25 de cada hora (antes do App Robot das :40, que lê o que o Sheets gravou)
select cron.unschedule('sheets-robot-h') where exists (select 1 from cron.job where jobname = 'sheets-robot-h');
select cron.schedule('sheets-robot-h', '25 * * * *', $$select public.sheets_dispara()$$);

-- Conferir:
--   select jobname, schedule, active from cron.job where jobname = 'sheets-robot-h';
--   select * from net._http_response order by id desc limit 5;   -- 204 = disparou

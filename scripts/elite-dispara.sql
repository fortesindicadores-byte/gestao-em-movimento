-- ─────────────────────────────────────────────────────────────────────────────
-- Elite Robot e Conf Detalhe na hora certa — quem dá a hora é o pg_cron
--
-- Os três robôs que entram no Ginfo (ginfo-robot, elite-robot, conf-detalhe)
-- dividem o grupo de concorrência `ginfo-conta`, porque o portal só aceita uma
-- sessão da conta. O GitHub guarda no máximo UM run pendente por grupo: quando
-- chega o terceiro, o pendente anterior é CANCELADO. Como o agendador do GitHub
-- atrasa os crons do YAML em ~4 a 8 h, os três chegavam juntos à tarde
-- (05/10: ginfo 19:08 rodando, elite 19:19 pendente, conf-detalhe 19:24 →
-- elite cancelado às 19:24:55). Foi assim TODO DIA de 27/09 a 05/10, e por isso
-- a vigência 09/2026 ficou sem nenhum indicador do Frota de Elite (Gerot com
-- traço em tudo que vem do Ginfo).
--
-- Agora cada um tem a sua hora, separada, pelo workflow_dispatch (que não
-- atrasa): ginfo 04:00 BRT (ginfo-dispara.sql) · elite 05:00 · conf-detalhe
-- 07:00. Os crons do YAML ficam como rede de segurança: se um deles for
-- cancelado à tarde, o da manhã já gravou (o Elite pula chave existente e o
-- Conf Detalhe só regrava a foto do dia).
--
-- ARMADILHA: o workflow_dispatch aplica os DEFAULTS dos inputs, e o `modo` do
-- elite-robot.yml tem default "login" (só tira print). O corpo TEM de mandar
-- inputs.modo = "mes". O conf-detalhe não tem inputs.
--
-- Pré-requisito: o token do GitHub em public.portal_segredo (chave
-- 'github_token'), instalado por scripts/pedido-instantaneo.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.robo_dispara(p_workflow text, p_inputs jsonb default '{}'::jsonb)
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
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/'
               || p_workflow || '/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    body    := case when p_inputs = '{}'::jsonb
                    then jsonb_build_object('ref', 'main')
                    else jsonb_build_object('ref', 'main', 'inputs', p_inputs) end);
end $$;

revoke all on function public.robo_dispara(text, jsonb) from public, anon, authenticated;

-- 05:00 BRT = 08:00 UTC — modo MES explícito (o default do workflow é "login")
select cron.unschedule('elite-5h') where exists (select 1 from cron.job where jobname = 'elite-5h');
select cron.schedule('elite-5h', '0 8 * * *',
  $$select public.robo_dispara('elite-robot.yml', '{"modo":"mes"}'::jsonb)$$);

-- 07:00 BRT = 10:00 UTC
select cron.unschedule('conf-detalhe-7h') where exists (select 1 from cron.job where jobname = 'conf-detalhe-7h');
select cron.schedule('conf-detalhe-7h', '0 10 * * *',
  $$select public.robo_dispara('conf-detalhe.yml')$$);

-- Conferir:
--   select jobname, schedule, active from cron.job where jobname in ('ginfo-4h','elite-5h','conf-detalhe-7h');
--   select id, status_code, left(content::text,200) from net._http_response order by id desc limit 5;

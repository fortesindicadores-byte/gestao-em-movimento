-- ─────────────────────────────────────────────────────────────────────────────
-- App do celular — RESUMOS PRÉ-LIDOS (Renan, 06/11/2026: "Bem demorado para
-- carregar no app visão mobile")
--
-- O app abria cada painel inteiro num iframe de 1366 px no celular: a página,
-- o Chart.js, o supabase-js e as tabelas inteiras (DRE Frota com 17 mil
-- linhas) rodando no processador do telefone. Agora o robô App Robot
-- (scripts/app-robot.mjs, Actions) faz essa leitura de hora em hora com a
-- service key e grava aqui o resumo de cada painel × visão (3 a 5 KB cada).
-- O app lê esta tabela (milissegundos) e só abre o iframe quando a pessoa
-- pede "Atualizar" ou troca a vigência.
--
-- Leitura: logados, respeitando o que a pessoa pode ver (painel só de admin
-- exige fca_is_admin(); resumo por unidade exige fca_has_unit()). Escrita: só
-- a service_role (o robô). Reexecutável.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_resumo (
  id       text not null,                      -- id do painel no app/catalogo.js
  vw       text not null default '',           -- visão (chave do .s-item[data-vw]); '' = painel sem visões
  vig      text not null default '',           -- vigência escolhida; '' = a padrão do painel
  unidade  text not null default '',           -- '' = painel sem recorte por unidade (ou a visão do admin)
  adm      boolean not null default false,     -- painel só de admin (flag do catálogo)
  dados    jsonb not null,                     -- o PN_DATA que o app desenha (hero, cards, gráficos, tabelas)
  lido_em  timestamptz not null default now(), -- quando o robô leu
  build    text,                               -- build do app que leu
  primary key (id, vw, vig, unidade)
);
create index if not exists app_resumo_id_idx on public.app_resumo (id);

alter table public.app_resumo enable row level security;

drop policy if exists app_resumo_sel on public.app_resumo;
create policy app_resumo_sel on public.app_resumo for select to authenticated
  using ((not adm or public.fca_is_admin())
         and (unidade = '' or public.fca_is_admin() or public.fca_has_unit(unidade)));
-- sem policy de insert/update/delete: só a service_role escreve

grant select on public.app_resumo to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- O relógio: pg_cron chama o workflow_dispatch do App Robot de hora em hora
-- (mesmo desenho do ginfo-4h / consumo-auto-6h: o agendador do GitHub atrasa
-- horas; o cron do YAML fica como rede). Pré-requisito: o token em
-- public.portal_segredo (chave 'github_token', scripts/pedido-instantaneo.sql).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.app_robot_dispara()
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
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/app-robot.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    body    := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('paineis', '')));
end $$;

-- de hora em hora, aos 40 min (o Sheets Robot roda aos 25: o DRE novo já está no banco)
select cron.unschedule('app-robot-h') where exists (select 1 from cron.job where jobname = 'app-robot-h');
select cron.schedule('app-robot-h', '40 * * * *', $$select public.app_robot_dispara()$$);

-- Conferir:
--   select id, vw, vig, unidade, lido_em from public.app_resumo order by lido_em desc limit 20;
--   select jobname, schedule, active from cron.job where jobname = 'app-robot-h';
--   select * from net._http_response order by id desc limit 5;   -- 204 = disparou

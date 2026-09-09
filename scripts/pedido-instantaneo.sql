-- ============================================================
-- O BOTÃO PASSA A VALER NA HORA (Renan, 09/09/2026:
-- "lógico, senão de que adianta a porra do botão")
--
-- Hoje o clique grava um pedido em sh_pedido e alguém precisa vir buscar: a
-- varredura de 5 em 5 min (que o GitHub segura) ou a carga da hora cheia.
-- Com isto aqui o BANCO chama o GitHub no instante do insert, e a carga
-- começa em segundos.
--
-- POR QUE NO BANCO E NÃO NA PÁGINA: o hub é HTML público. Token nenhum pode
-- morar lá. Aqui ele fica numa tabela SEM policy — nem anon nem authenticated
-- leem pelo PostgREST; só a service_role e o dono do banco. A função é
-- security definer justamente para o gatilho poder ler o token sem expô-lo.
--
-- ANTES DE COLAR: crie um token no GitHub (Settings → Developer settings →
-- Personal access tokens → Fine-grained), com acesso ao repositório
-- gestao-em-movimento e a permissão "Actions: Read and write", e troque o
-- COLE_O_TOKEN_AQUI abaixo. O token NÃO entra no repositório.
-- ============================================================

-- o pg_net é quem faz a chamada HTTP de dentro do Postgres
create extension if not exists pg_net;

-- ── o cofre: uma linha por segredo, sem policy nenhuma ───────────────────────
create table if not exists public.portal_segredo (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now()
);
comment on table public.portal_segredo is
  'Segredos do portal (ex.: token do GitHub). Sem policy: só service_role lê.';
alter table public.portal_segredo enable row level security;
revoke all on public.portal_segredo from anon, authenticated;

insert into public.portal_segredo (chave, valor)
values ('github_token', 'COLE_O_TOKEN_AQUI')
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

-- ── o gatilho: pedido gravado → workflow disparado ───────────────────────────
create or replace function public.sh_pedido_dispara()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare tok text;
begin
  select valor into tok from public.portal_segredo where chave = 'github_token';
  -- sem token o pedido continua valendo: a varredura e a carga da hora cheia
  -- pegam do mesmo jeito, só que mais devagar
  if tok is null or tok = 'COLE_O_TOKEN_AQUI' then return new; end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/sheets-pedido.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    body    := jsonb_build_object('ref', 'main'));
  return new;
end $$;

drop trigger if exists sh_pedido_dispara_t on public.sh_pedido;
create trigger sh_pedido_dispara_t
  after insert on public.sh_pedido
  for each row execute function public.sh_pedido_dispara();

-- ---------- Conferência ------------------------------------------------------
-- Depois de clicar no botão do hub, a chamada aparece aqui (200 = aceito):
-- select id, status_code, created from net._http_response order by id desc limit 5;

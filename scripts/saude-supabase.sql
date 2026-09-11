-- ============================================================
-- SAÚDE DO ECOSSISTEMA (Renan, 11/09/2026)
--
-- "Uma visão geral dos painéis, robôs, etc. — mais focado em como está
--  rodando o ecossistema: taxa de falha geral, por robô, por painel."
--
-- Quem preenche: scripts/saude-robot.mjs (workflow Saude Robot, de 6 em 6h)
-- com a service key. Ele lê a API do GitHub Actions (execuções dos
-- workflows), o estado das bases no próprio banco e faz a varredura dos
-- index.html do repositório. O painel /saude/ só LÊ estas tabelas — não
-- chama o GitHub (o HTML é público e não pode guardar token).
--
-- Leitura: qualquer usuário logado (a tela barra quem não é admin).
-- Escrita: nenhuma policy => só a service_role, como nos demais snapshots.
-- Reexecutável: tudo com "if not exists" / "drop policy if exists".
-- ============================================================

-- ---------- 1. Workflows (robôs): estado atual de cada um ------------------
create table if not exists public.saude_wf (
  wf            text primary key,        -- arquivo: 'gviz-robot.yml'
  nome          text,                    -- name: declarado no YAML
  estado        text,                    -- active | disabled_manually | deleted
  tipo          text,                    -- carga | auditoria | deploy
  cron          text,                    -- crons ativos, separados por vírgula
  cron_off      text,                    -- crons comentados (agendamento desligado)
  dispatch      boolean default false,   -- aceita disparo manual
  concorrencia  text,                    -- group do concurrency, se houver
  alerta_email  boolean default false,   -- tem passo de aviso por e-mail
  ult_id        bigint,                  -- id da última execução
  ult_status    text,                    -- queued | in_progress | completed
  ult_conclusao text,                    -- success | failure | cancelled | skipped…
  ult_em        timestamptz,             -- quando a última execução começou
  ult_dur_s     integer,                 -- duração da última execução
  ult_url       text,
  ok_em         timestamptz,             -- último sucesso conhecido
  falhas_seq    integer default 0,       -- falhas seguidas até agora
  atualizado_em timestamptz not null default now()
);
comment on table public.saude_wf is
  'Saúde do ecossistema: um registro por workflow do Actions, com a última execução e o estado.';

-- ---------- 2. Execuções agregadas por dia --------------------------------
-- Agregado no robô de propósito: o PostgREST não soma, e guardar execução a
-- execução estouraria (o Sheets Pedido roda a cada 5 min = 288 linhas/dia).
create table if not exists public.saude_dia (
  wf       text not null,
  dia      date not null,               -- dia em horário de Brasília
  runs     integer not null default 0,
  ok       integer not null default 0,
  falha    integer not null default 0,
  cancel   integer not null default 0,
  outros   integer not null default 0,  -- skipped, neutral, em andamento…
  dur_s    integer not null default 0,  -- soma das durações
  dur_max  integer not null default 0,
  primary key (wf, dia)
);
create index if not exists saude_dia_dia_idx on public.saude_dia (dia desc);
comment on table public.saude_dia is
  'Saúde do ecossistema: execuções por workflow e por dia (BRT) — base das taxas de falha.';

-- ---------- 3. Bases de dados: idade e tamanho ----------------------------
create table if not exists public.saude_base (
  chave         text primary key,        -- 'sh:consumo_km_litro', 'ginfo:ativos'…
  rotulo        text,
  grupo         text,                    -- Sheets · Ginfo · Frota de Elite · Aplicativos
  fonte         text,                    -- sh | gviz | ginfo | elite | app
  linhas        integer,
  atualizado_em timestamptz,             -- quando o dado foi gravado pela última vez
  erro          text,                    -- motivo registrado pelo robô da base
  wf            text,                    -- workflow que alimenta esta base
  visto_em      timestamptz not null default now()
);
comment on table public.saude_base is
  'Saúde do ecossistema: uma linha por base monitorada, com idade do dado e tamanho.';

-- ---------- 4. Painéis: o que cada tela lê --------------------------------
create table if not exists public.saude_painel (
  pasta      text primary key,           -- 'painel-km/', '/' para o hub
  titulo     text,
  casca      text,                       -- padrão | antiga | app próprio
  tema       text,
  fontes     text[],                     -- Sheets:DRE, sb:fca, ginfo:ativos…
  filtros    integer,
  graficos   text,
  tabela     text,
  exporta    text,
  build      text,
  acessos30  integer,                    -- aberturas nos últimos 30 dias
  visto_em   timestamptz not null default now()
);
comment on table public.saude_painel is
  'Saúde do ecossistema: inventário dos painéis (casca, fontes, build) com o uso dos últimos 30 dias.';

-- ---------- 5. Marca da coleta -------------------------------------------
create table if not exists public.saude_coleta (
  id          integer primary key default 1 check (id = 1),
  coletado_em timestamptz not null default now(),
  janela_dias integer,
  runs_lidos  integer,
  obs         text
);

-- ---------- RLS ------------------------------------------------------------
alter table public.saude_wf     enable row level security;
alter table public.saude_dia    enable row level security;
alter table public.saude_base   enable row level security;
alter table public.saude_painel enable row level security;
alter table public.saude_coleta enable row level security;

drop policy if exists saude_wf_sel     on public.saude_wf;
drop policy if exists saude_dia_sel    on public.saude_dia;
drop policy if exists saude_base_sel   on public.saude_base;
drop policy if exists saude_painel_sel on public.saude_painel;
drop policy if exists saude_coleta_sel on public.saude_coleta;

create policy saude_wf_sel     on public.saude_wf     for select to authenticated using (true);
create policy saude_dia_sel    on public.saude_dia    for select to authenticated using (true);
create policy saude_base_sel   on public.saude_base   for select to authenticated using (true);
create policy saude_painel_sel on public.saude_painel for select to authenticated using (true);
create policy saude_coleta_sel on public.saude_coleta for select to authenticated using (true);
-- escrita: sem policy => só a service_role (o robô).

-- ---------- Conferência ----------------------------------------------------
-- select coletado_em, janela_dias, runs_lidos from public.saude_coleta;
-- select wf, nome, tipo, ult_conclusao, falhas_seq, ult_em from public.saude_wf order by falhas_seq desc, ult_em desc;
-- select dia, sum(runs) runs, sum(falha) falha from public.saude_dia group by dia order by dia desc limit 14;

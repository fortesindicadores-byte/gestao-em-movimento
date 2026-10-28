-- ============================================================
-- Remuneração do Freightech por mês (Renan, 28/10/2026) — base do painel
-- /remuneracao/. Uma linha por operação × unidade × mês, montada pelo
-- scripts/ft-remuneracao.mjs a partir de ft_linha/ft_layout (o robô do FT).
--   operacao: ROTA · VAN · UDC · AS · EMPURRADA · INSUMOS · ARMAZEM
--   valores em R$ por mês (mês = média das quinzenas do FT)
-- Leitura só para admin (é remuneração); escrita só service_role. Reexecutável.
-- ============================================================

create table if not exists public.ft_rem_mes (
  operacao     text not null,
  unidade      text not null,              -- sigla do portal (BLC, CBA, CGR…)
  vigencia     text not null,              -- AAAA-MM
  unidade_ft   text,                       -- como o FT escreve (CDD CAMBORIU…)
  ano          int  not null,
  mes          int  not null,
  quinzenas    int  not null default 0,    -- quantas quinzenas do FT entraram no mês
  ativos       numeric,                    -- frota ativa (caminhões, cavalos, empilhadeiras)
  parados      numeric,                    -- frota parada
  km_teto      numeric,                    -- km remunerado do mês (25 mapas por ativo; T1: km previsto dos trechos)
  comb         numeric,                    -- variável: combustível (T2 e T1), gás (armazém)
  manut        numeric,                    -- variável: manutenção do caminhão/cavalo
  carroc       numeric,                    -- variável: manutenção da carroceria/carreta
  pneu         numeric,                    -- variável: pneu
  lavagem_var  numeric,                    -- variável: lavagem por km (AS, T1)
  outros_var   numeric,                    -- variável fora da frota (T1: pedágio, seguro, salário e lucro variáveis; armazém: custo variável)
  variavel     numeric,                    -- total do variável (T2: Total Viagens do Resumo)
  fixo_ativo   numeric,                    -- custo fixo da frota ativa
  fixo_parado  numeric,                    -- custo fixo da frota parada
  seguro       numeric,                    -- peças do fixo (informativas, já estão no fixo)
  finame       numeric,
  ipva         numeric,
  lavagem      numeric,
  rastreador   numeric,
  equipe       numeric,                    -- equipe de entrega / equipe ativa / operadores
  qlp_adm      numeric,                    -- QLP administrativo / gestão
  outras       numeric,                    -- outras despesas (+ estacionária no T1)
  total        numeric,                    -- variável + fixo ativo + fixo parado + equipe + QLP + outras
  atualizado_em timestamptz not null default now(),
  primary key (operacao, unidade, vigencia)
);
create index if not exists ft_rem_mes_vig on public.ft_rem_mes (vigencia);

alter table public.ft_rem_mes enable row level security;
drop policy if exists ft_rem_mes_le on public.ft_rem_mes;
create policy ft_rem_mes_le on public.ft_rem_mes for select to authenticated using (public.fca_is_admin());
grant select on public.ft_rem_mes to authenticated;

-- 2ª parte (28/10/2026): peças a mais, para o painel abrir o fixo e o variável do T1
alter table public.ft_rem_mes add column if not exists faixa       numeric;   -- faixa refletiva (fixo)
alter table public.ft_rem_mes add column if not exists deprec      numeric;   -- depreciação caminhão + carroceria (fixo, modelo antigo)
alter table public.ft_rem_mes add column if not exists rem_k       numeric;   -- remuneração K + impostos (fixo, modelo antigo)
alter table public.ft_rem_mes add column if not exists pedagio     numeric;   -- T1: pedágio do trecho (variável)
alter table public.ft_rem_mes add column if not exists seguro_var  numeric;   -- T1: seguro do trecho (variável)
alter table public.ft_rem_mes add column if not exists salario_var numeric;   -- T1: salário variável do motorista (não é frota)
alter table public.ft_rem_mes add column if not exists lucro_var   numeric;   -- T1: lucro variável (não é frota)

-- conferência
select count(*) as linhas, min(vigencia) as de, max(vigencia) as ate from public.ft_rem_mes;

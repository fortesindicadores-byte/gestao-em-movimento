-- ============================================================
-- Contrato de manutenção da VW (portal Volks|Total) — a foto crua
-- (Renan, 15/09/2026: "quero gerar ano todo (variáveis) e jogar no banco")
--
-- Uma linha por CONTRATO × VIGÊNCIA × CHASSI, exatamente como o relatório
-- "Consulta Valor da Nota Fiscal" entrega: km anterior e atual com as datas
-- das leituras, a faixa do contrato, o km rodado e o valor cobrado.
--
-- POR QUE A FOTO CRUA PRIMEIRO: o destino é substituir a planilha "Contratos
-- Man." como fonte da Carta de Custos. Trocar a fonte antes de comparar é o
-- erro que a migração do Km/L ensinou a não cometer — lá o comparador rodou
-- antes e pegou justamente o que a planilha escondia. Então o robô grava o
-- que o portal diz, o comparador mostra se bate, e só então a Carta troca de
-- fonte.
--
-- REEXECUTÁVEL. Rodar no SQL Editor do Supabase.
-- ============================================================

create table if not exists public.vw_contrato_km (
  contrato        text not null,
  vigencia        text not null,          -- 'AAAA-MM', o mês consultado
  chassi          text not null,
  placa           text,
  km_anterior     numeric,
  data_anterior   date,
  km_atual        numeric,
  data_atual      date,
  faixa           text,
  km_rodado       numeric,
  valor           numeric,
  coletado_em     timestamptz not null default now(),
  -- a chave é o que identifica a cobrança: o mesmo chassi aparece uma vez por
  -- mês em cada contrato. Assim recoletar corrige em vez de duplicar.
  primary key (contrato, vigencia, chassi)
);

create index if not exists vw_contrato_km_vig   on public.vw_contrato_km (vigencia);
create index if not exists vw_contrato_km_placa on public.vw_contrato_km (placa);

-- Leitura para quem está logado no portal (é custo da frota, como a Carta);
-- escrita só a service_role, que é quem o robô usa.
alter table public.vw_contrato_km enable row level security;
drop policy if exists vw_contrato_km_read on public.vw_contrato_km;
create policy vw_contrato_km_read on public.vw_contrato_km
  for select to authenticated using (true);

-- confere
select count(*) as linhas,
       count(distinct contrato) as contratos,
       count(distinct vigencia) as vigencias
  from public.vw_contrato_km;
